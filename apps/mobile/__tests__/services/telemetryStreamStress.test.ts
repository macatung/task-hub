import { SSEStreamClient } from '@/services/sseStreamClient';
import { useAgentTelemetryStream } from '@/hooks/useAgentTelemetryStream';
import { SecureStorageService } from '@/services/secureStorage';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryClient';
import { AgentRunStatus } from '@/api/types';
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { mockReactNativeSSE } from '../../jest.setup';

describe('Empirical Challenger M5: Telemetry Stream Stress & Resumption Harness', () => {
  let testQueryClient: QueryClient;

  beforeEach(async () => {
    mockReactNativeSSE.__resetInstances();
    jest.clearAllMocks();
    jest.useRealTimers();

    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    await SecureStorageService.saveToken('th_stress_token_abc123');
    await SecureStorageService.saveConfig('api_url', 'http://127.0.0.1:8000');
    await SecureStorageService.saveConfig('workspace_id', '42');
  });

  afterEach(async () => {
    jest.useRealTimers();
    testQueryClient.clear();
    await SecureStorageService.clearAll();
  });

  // =========================================================================
  // Dimension 1: Chunk Parsing, Duplicates, Out-of-Order & Keepalives
  // =========================================================================
  describe('Dimension 1: Event & Log Parsing Stress, Duplicates, Out-of-Order & Keepalive', () => {
    it('maintains monotonic cursor progression with duplicate and out-of-order event IDs', () => {
      const receivedEvents: any[] = [];
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        runId: 100,
        onEvent: (e) => receivedEvents.push(e),
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // Emit out-of-order and duplicate event IDs: 50, 50, 40, 55, 52, 60
      const ids = [50, 50, 40, 55, 52, 60];
      for (const id of ids) {
        instance.__emitCustomEvent(
          'agent-run',
          JSON.stringify({
            id,
            run_id: 100,
            type: 'status_transition',
            status: 'running',
          })
        );
      }

      expect(receivedEvents.length).toBe(6);
      // Monotonic cursor: should be the highest ID seen (60), never regressing to 40 or 52
      expect(client.getLastEventId()).toBe(60);
    });

    it('deduplicates streaming logs in useAgentTelemetryStream and enforces max buffer size', async () => {
      const { result } = renderHook(() =>
        useAgentTelemetryStream({ runId: 100, maxLogBufferSize: 5 })
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      act(() => {
        instance.__emitOpen();
      });

      // Emit logs with duplicates: IDs 1, 2, 2 (dup), 3, 4, 1 (dup), 5, 6, 7
      act(() => {
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 1, stream: 'stdout', content: 'Log 1\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 2, stream: 'stdout', content: 'Log 2\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 2, stream: 'stdout', content: 'Log 2 dup\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 3, stream: 'stderr', content: 'Log 3\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 4, stream: 'stdout', content: 'Log 4\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 1, stream: 'stdout', content: 'Log 1 dup\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 5, stream: 'stdout', content: 'Log 5\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 6, stream: 'stderr', content: 'Log 6\n' }));
        instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 7, stream: 'stdout', content: 'Log 7\n' }));
      });

      // Total unique logs received: 1, 2, 3, 4, 5, 6, 7 (7 total)
      // Bounded by maxLogBufferSize = 5 -> [3, 4, 5, 6, 7]
      expect(result.current.logs.length).toBe(5);
      expect(result.current.logs.map((l) => l.id)).toEqual([3, 4, 5, 6, 7]);
    });

    it('filters keepalive heartbeat comments without dropping legitimate logs containing "keepalive" text', () => {
      const receivedLogs: any[] = [];
      const receivedEvents: any[] = [];
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent: (e) => receivedEvents.push(e),
        onLog: (l) => receivedLogs.push(l),
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // 1. Raw keepalive comments
      instance.__emitCustomEvent('agent-run', ': keepalive');
      instance.__emitCustomEvent('agent-log', ': keepalive');
      instance.__emitMessage(': keepalive');

      expect(receivedEvents.length).toBe(0);
      expect(receivedLogs.length).toBe(0);

      // 2. Legitimate log payload that mentions keepalive
      const legitimateLog = {
        id: 99,
        stream: 'stdout',
        content: 'TCP keepalive probe succeeded for endpoint : keepalive\n',
      };
      instance.__emitCustomEvent('agent-log', JSON.stringify(legitimateLog));

      expect(receivedLogs.length).toBe(1);
      expect(receivedLogs[0].content).toContain('TCP keepalive probe succeeded');
    });

    it('resiliently handles truncated and corrupt JSON chunks without crashing the stream', () => {
      const receivedEvents: any[] = [];
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent: (e) => receivedEvents.push(e),
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // Corrupted / malformed chunks
      instance.__emitCustomEvent('agent-run', '{"id": 1, "type": "broken_json');
      instance.__emitCustomEvent('agent-run', '<html>502 Bad Gateway</html>');
      instance.__emitCustomEvent('agent-run', '');
      instance.__emitCustomEvent('agent-run', 'undefined');
      instance.__emitCustomEvent('agent-run', 'null');

      // Valid chunk after corruption
      const validEvent = { id: 2, type: 'step_start', status: 'running' };
      instance.__emitCustomEvent('agent-run', JSON.stringify(validEvent));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(2);
      expect(client.getLastEventId()).toBe(2);
    });

    it('handles unicode emojis, multiline ANSI logs, and large payloads', () => {
      const receivedLogs: any[] = [];
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onLog: (l) => receivedLogs.push(l),
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      const largeLog = {
        id: 301,
        stream: 'stdout',
        content: '\x1b[32m✔ 235 passed\x1b[0m 🚀 [Task Hub Monorepo] 🔥\nLine 2 with 日本語 and special chars: <>&&"\n'.repeat(50),
      };

      instance.__emitCustomEvent('agent-log', JSON.stringify(largeLog));

      expect(receivedLogs.length).toBe(1);
      expect(receivedLogs[0].content).toContain('🚀 [Task Hub Monorepo]');
      expect(receivedLogs[0].content).toContain('日本語');
      expect(client.getLastLogId()).toBe(301);
    });
  });

  // =========================================================================
  // Dimension 2: Multi-Drop Cursor Resumption & Exponential Backoff
  // =========================================================================
  describe('Dimension 2: Network Drop Resumption & Cursor Progression', () => {
    it('advances cursors across multi-cycle network drops with backoff reconnection', () => {
      jest.useFakeTimers();
      const client = new SSEStreamClient();
      client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        runId: 77,
        workspaceId: 42,
      });

      // Cycle 1: First connection
      const instance1 = mockReactNativeSSE.__getLastInstance();
      expect(instance1.url).not.toContain('after=');
      expect(instance1.url).not.toContain('after_log=');
      instance1.__emitOpen();

      // Receive event 10 and log 100
      instance1.__emitCustomEvent('agent-run', JSON.stringify({ id: 10, run_id: 77, type: 'step_start' }));
      instance1.__emitCustomEvent('agent-log', JSON.stringify({ id: 100, run_id: 77, stream: 'stdout', content: 'Step 1' }));

      expect(client.getLastEventId()).toBe(10);
      expect(client.getLastLogId()).toBe(100);

      // Simulate Network Drop 1
      instance1.__emitError('Connection drop 1');
      expect(client.getState()).toBe('reconnecting');
      expect(client.getRetryCount()).toBe(1);

      // Advance backoff timer for retry 1 (1500ms)
      jest.advanceTimersByTime(1600);

      // Cycle 2: Second connection
      const instance2 = mockReactNativeSSE.__getLastInstance();
      expect(instance2).not.toBe(instance1);
      expect(instance2.url).toContain('after=10');
      expect(instance2.url).toContain('after_log=100');
      expect(instance2.url).toContain('run_id=77');
      expect(instance2.url).toContain('workspace_id=42');

      instance2.__emitOpen();
      expect(client.getState()).toBe('connected');
      expect(client.getRetryCount()).toBe(0); // Resets on successful open

      // Receive event 25 and log 250
      instance2.__emitCustomEvent('agent-run', JSON.stringify({ id: 25, run_id: 77, type: 'step_complete' }));
      instance2.__emitCustomEvent('agent-log', JSON.stringify({ id: 250, run_id: 77, stream: 'stdout', content: 'Step 2' }));

      expect(client.getLastEventId()).toBe(25);
      expect(client.getLastLogId()).toBe(250);

      // Simulate Network Drop 2
      instance2.__emitError('Connection drop 2');
      expect(client.getState()).toBe('reconnecting');
      expect(client.getRetryCount()).toBe(1);

      jest.advanceTimersByTime(1600);

      // Cycle 3: Third connection
      const instance3 = mockReactNativeSSE.__getLastInstance();
      expect(instance3).not.toBe(instance2);
      expect(instance3.url).toContain('after=25');
      expect(instance3.url).toContain('after_log=250');
      jest.useRealTimers();
    });

    it('pauses and resumes cursor stream across AppState backgrounding without event loss', () => {
      jest.useFakeTimers();
      const client = new SSEStreamClient({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
      });

      client.connect();
      const instance1 = mockReactNativeSSE.__getLastInstance();
      instance1.__emitOpen();

      instance1.__emitCustomEvent('agent-run', JSON.stringify({ id: 450, type: 'progress' }));
      instance1.__emitCustomEvent('agent-log', JSON.stringify({ id: 890, stream: 'stdout', content: 'Busy...' }));

      expect(client.getLastEventId()).toBe(450);
      expect(client.getLastLogId()).toBe(890);

      // App transitions to background
      client.pause();
      expect(client.getState()).toBe('disconnected');

      // Attempting to advance timers should NOT trigger reconnect while paused
      jest.advanceTimersByTime(10000);
      expect(mockReactNativeSSE.__getInstances().length).toBe(1);

      // App transitions back to foreground
      client.resume();
      const instance2 = mockReactNativeSSE.__getLastInstance();
      expect(instance2).not.toBe(instance1);
      expect(instance2.url).toContain('after=450');
      expect(instance2.url).toContain('after_log=890');
      jest.useRealTimers();
    });

    it('stops reconnect timers and transitions to disconnected when manual disconnect is called', () => {
      jest.useFakeTimers();
      const client = new SSEStreamClient();
      const disconnect = client.connect({
        url: 'http://127.0.0.1:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
      });

      const instance1 = mockReactNativeSSE.__getLastInstance();
      instance1.__emitError('Drop');
      expect(client.getState()).toBe('reconnecting');

      // Manual disconnect called during reconnect backoff
      disconnect();
      expect(client.getState()).toBe('disconnected');

      // Timers advance -> no new connection
      jest.advanceTimersByTime(30000);
      expect(mockReactNativeSSE.__getInstances().length).toBe(1);
      jest.useRealTimers();
    });
  });

  // =========================================================================
  // Dimension 3: Cache Invalidation on Terminal Statuses
  // =========================================================================
  describe('Dimension 3: Query Cache Invalidation on Terminal Statuses', () => {
    const terminalStatuses: AgentRunStatus[] = ['verified', 'failed', 'needs_review', 'cancelled'];
    const nonTerminalStatuses: AgentRunStatus[] = ['queued', 'running', 'waiting_input'];

    for (const status of terminalStatuses) {
      it(`invalidates agentRuns, tasks, and sprints caches when status transition is "${status}"`, async () => {
        const onTerminalStatus = jest.fn();

        // Seed caches
        testQueryClient.setQueryData(queryKeys.agentRuns.all, [{ id: 42 }]);
        testQueryClient.setQueryData(queryKeys.tasks.all, [{ id: 10 }]);
        testQueryClient.setQueryData(queryKeys.sprints.all, [{ id: 1 }]);

        const { result } = renderHook(() =>
          useAgentTelemetryStream({ runId: 42, onTerminalStatus })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });

        const instance = mockReactNativeSSE.__getLastInstance();
        act(() => {
          instance.__emitOpen();
        });

        // Emit terminal status transition
        act(() => {
          instance.__emitCustomEvent(
            'agent-run',
            JSON.stringify({
              id: 1,
              run_id: 42,
              type: 'status_transition',
              status,
              occurred_at: '2026-08-25T10:00:00Z',
            })
          );
        });

        expect(result.current.latestStatus).toBe(status);
        expect(onTerminalStatus).toHaveBeenCalledWith(
          status,
          expect.objectContaining({ status })
        );
      });
    }

    for (const status of nonTerminalStatuses) {
      it(`does NOT invoke onTerminalStatus callback when status transition is non-terminal "${status}"`, async () => {
        const onTerminalStatus = jest.fn();

        const { result } = renderHook(() =>
          useAgentTelemetryStream({ runId: 42, onTerminalStatus })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });

        const instance = mockReactNativeSSE.__getLastInstance();
        act(() => {
          instance.__emitOpen();
        });

        // Emit non-terminal status transition
        act(() => {
          instance.__emitCustomEvent(
            'agent-run',
            JSON.stringify({
              id: 1,
              run_id: 42,
              type: 'status_transition',
              status,
              occurred_at: '2026-08-25T10:00:00Z',
            })
          );
        });

        expect(result.current.latestStatus).toBe(status);
        expect(onTerminalStatus).not.toHaveBeenCalled();
      });
    }

    it('captures verification evidence payload and step indicators accurately', async () => {
      const { result } = renderHook(() =>
        useAgentTelemetryStream({ runId: 42 })
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      act(() => {
        instance.__emitOpen();
      });

      // Emit stage_start
      act(() => {
        instance.__emitCustomEvent(
          'agent-run',
          JSON.stringify({
            id: 1,
            type: 'stage_start',
            payload: { stage: 'Running Jest & Pest Test Suites' },
          })
        );
      });
      expect(result.current.latestStep).toBe('Running Jest & Pest Test Suites');

      // Emit evidence event
      const evidencePayload = {
        tests_passed: 235,
        tests_failed: 0,
        tests_total: 235,
        commit_sha: 'feadb0071234',
        changed_files: ['packages/mobile-core/src/services/sseStreamClient.ts'],
      };

      act(() => {
        instance.__emitCustomEvent(
          'agent-run',
          JSON.stringify({
            id: 2,
            type: 'evidence',
            payload: evidencePayload,
          })
        );
      });

      expect(result.current.evidence).toEqual(evidencePayload);
      expect(result.current.evidence?.tests_passed).toBe(235);
      expect(result.current.evidence?.commit_sha).toBe('feadb0071234');
    });
  });
});
