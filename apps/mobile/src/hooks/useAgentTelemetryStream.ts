import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SSEStreamClient } from '@/services/sseStreamClient';
import { SecureStorageService } from '@/services/secureStorage';
import { queryKeys } from '@/api/queryClient';
import { env, normalizeApiUrl } from '@/config/env';
import {
  AgentRunEvent,
  AgentRunLog,
  AgentRunStatus,
  ConnectionState,
  VerificationEvidence,
} from '@/api/types';

export interface UseAgentTelemetryStreamOptions {
  runId?: number;
  workspaceId?: number;
  enabled?: boolean;
  maxLogBufferSize?: number;
  autoScrollDefault?: boolean;
  onTerminalStatus?: (status: AgentRunStatus, event: AgentRunEvent) => void;
}

export interface UseAgentTelemetryStreamResult {
  connectionState: ConnectionState;
  events: AgentRunEvent[];
  logs: AgentRunLog[];
  latestStatus: AgentRunStatus | null;
  latestStep: string | null;
  evidence: VerificationEvidence | null;
  autoScroll: boolean;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAutoScroll: () => void;
  clearLogs: () => void;
  reconnect: () => void;
  disconnect: () => void;
  error: any | null;
}

export function useAgentTelemetryStream({
  runId,
  workspaceId,
  enabled = true,
  maxLogBufferSize = 1000,
  autoScrollDefault = true,
  onTerminalStatus,
}: UseAgentTelemetryStreamOptions = {}): UseAgentTelemetryStreamResult {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [latestStatus, setLatestStatus] = useState<AgentRunStatus | null>(null);
  const [latestStep, setLatestStep] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<VerificationEvidence | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(autoScrollDefault);
  const [error, setError] = useState<any | null>(null);

  const clientRef = useRef<SSEStreamClient | null>(null);
  const seenLogIdsRef = useRef<Set<number>>(new Set());

  const handleTerminalStatusTransition = useCallback(
    (status: AgentRunStatus, event: AgentRunEvent) => {
      // Invalidate React Query caches for real-time consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      if (runId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.detail(runId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all });

      onTerminalStatus?.(status, event);
    },
    [queryClient, runId, onTerminalStatus]
  );

  const handleEvent = useCallback(
    (event: AgentRunEvent) => {
      setEvents((prev) => [...prev, event]);

      if (event.status) {
        setLatestStatus(event.status);

        const terminalStatuses: AgentRunStatus[] = [
          'verified',
          'failed',
          'needs_review',
          'cancelled',
        ];
        if (terminalStatuses.includes(event.status)) {
          handleTerminalStatusTransition(event.status, event);
        }
      }

      if (event.type === 'step_start' || event.type === 'stage_start') {
        setLatestStep(event.payload?.name || event.payload?.stage || event.type);
      }

      if (event.type === 'evidence' && event.payload) {
        setEvidence(event.payload);
      }
    },
    [handleTerminalStatusTransition]
  );

  const handleLog = useCallback(
    (log: AgentRunLog) => {
      if (log.id && seenLogIdsRef.current.has(log.id)) {
        return; // Deduplicate
      }
      if (log.id) {
        seenLogIdsRef.current.add(log.id);
      }

      setLogs((prev) => {
        const next = [...prev, log];
        if (next.length > maxLogBufferSize) {
          return next.slice(next.length - maxLogBufferSize);
        }
        return next;
      });
    },
    [maxLogBufferSize]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    seenLogIdsRef.current.clear();
  }, []);

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      setConnectionState('disconnected');
      return;
    }

    let isMounted = true;

    async function initStream() {
      const token = await SecureStorageService.getToken();
      const storedApiUrl = await SecureStorageService.getConfig('api_url');
      const storedWsId = await SecureStorageService.getConfig('workspace_id');

      if (!isMounted) return;

      const baseUrl = normalizeApiUrl(storedApiUrl || env.apiUrl);
      const streamUrl = `${baseUrl}/api/v1/tasks/agent-runs/stream`;
      const activeWsId = workspaceId || (storedWsId ? Number(storedWsId) : undefined);

      const client = new SSEStreamClient({
        url: streamUrl,
        token: token || '',
        runId,
        workspaceId: activeWsId,
        onEvent: handleEvent,
        onLog: handleLog,
        onStateChange: (s) => {
          if (isMounted) setConnectionState(s);
        },
        onError: (err) => {
          if (isMounted) setError(err);
        },
      });

      clientRef.current = client;
      client.connect();
    }

    initStream();

    // AppState lifecycle listener for background pause / foreground resume
    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        clientRef.current?.pause();
      } else if (nextState === 'active') {
        clientRef.current?.resume();
      }
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [enabled, runId, workspaceId, handleEvent, handleLog]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  return {
    connectionState,
    events,
    logs,
    latestStatus,
    latestStep,
    evidence,
    autoScroll,
    setAutoScroll,
    toggleAutoScroll,
    clearLogs,
    reconnect,
    disconnect,
    error,
  };
}
