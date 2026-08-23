/**
 * Remote Task Dispatch Service
 * 
 * Ingests remote dispatch commands from Web Hub (via SSE Command Stream or Heartbeat),
 * triggers autonomous Auto-Pilot execution loop in under 2 seconds, and streams
 * live logs, events, test evidence, and diff handoffs back to the Hub SaaS.
 */

import {
  AutoPilotRunner,
  type AutoPilotTaskTarget,
  type AutoPilotResult,
  type AutoPilotConfig,
} from '../utils/autoPilotRunner';
import type { DesktopHeartbeatService, DispatchCommand } from './desktopHeartbeat';
import type { VerificationEvidence } from '../utils/testEvidence';
import type { AgentHandoffPayload } from '../utils/diffHandoff';

export interface RemoteDispatchOptions {
  baseUrl: string;
  token?: string;
  runnerId?: number;
  heartbeatService?: DesktopHeartbeatService;
  fetchFn?: typeof fetch;
  autoPilotConfig?: Partial<AutoPilotConfig>;
}

export interface DispatchExecutionRecord {
  commandId: string;
  runId: number;
  taskId: number;
  issueKey: string;
  dispatchedAt: number;
  startedAt: number;
  dispatchLatencyMs: number;
  status: 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: AutoPilotResult;
}

export class RemoteDispatchService {
  private options: RemoteDispatchOptions;
  private heartbeatService?: DesktopHeartbeatService;
  private activeRunner: AutoPilotRunner | null = null;
  private activeExecution: DispatchExecutionRecord | null = null;
  private executionHistory: DispatchExecutionRecord[] = [];
  private eventSource: any = null;
  private logSequence = 0;
  private unsubscribeHeartbeat?: () => void;
  private unsubscribeCancel?: () => void;

  constructor(options: Partial<RemoteDispatchOptions> = {}) {
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8000',
      token: options.token,
      runnerId: options.runnerId,
      fetchFn: options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined),
      autoPilotConfig: options.autoPilotConfig || {},
    };

    if (options.heartbeatService) {
      this.attachHeartbeatService(options.heartbeatService);
    }
  }

  public setOptions(options: Partial<RemoteDispatchOptions>) {
    this.options = { ...this.options, ...options };
    if (options.heartbeatService && options.heartbeatService !== this.heartbeatService) {
      this.attachHeartbeatService(options.heartbeatService);
    }
  }

  public attachHeartbeatService(service: DesktopHeartbeatService) {
    if (this.unsubscribeHeartbeat) this.unsubscribeHeartbeat();
    if (this.unsubscribeCancel) this.unsubscribeCancel();

    this.heartbeatService = service;
    this.unsubscribeHeartbeat = service.onDispatch((cmd) => {
      this.handleCommand(cmd).catch((err) => {
        console.error('[RemoteDispatch] Failed to handle dispatch command:', err);
      });
    });

    this.unsubscribeCancel = service.onCancel((cmd) => {
      this.handleCancelCommand(cmd).catch((err) => {
        console.error('[RemoteDispatch] Failed to handle cancel command:', err);
      });
    });
  }

  public connectSseStream(runnerId?: number) {
    const targetRunnerId = runnerId || this.options.runnerId;
    if (!targetRunnerId) {
      console.warn('[RemoteDispatch] No runner ID provided for SSE command stream.');
      return;
    }

    this.disconnectSseStream();

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/desktop/agents/${targetRunnerId}/command-stream`;
    if (typeof EventSource !== 'undefined') {
      try {
        this.eventSource = new EventSource(url);
        this.eventSource.addEventListener('command', (event: any) => {
          try {
            const cmd = JSON.parse(event.data);
            this.handleCommand(cmd).catch((err) => {
              console.error('[RemoteDispatch] Error in SSE command handler:', err);
            });
          } catch (e) {
            console.error('[RemoteDispatch] Malformed SSE command payload:', e);
          }
        });
        this.eventSource.onerror = (err: any) => {
          console.warn('[RemoteDispatch] SSE stream connection error:', err);
        };
      } catch (err) {
        console.warn('[RemoteDispatch] Could not open EventSource:', err);
      }
    }
  }

  public disconnectSseStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public async handleCommand(cmd: DispatchCommand): Promise<AutoPilotResult | null> {
    if (cmd.type !== 'remote_dispatch') {
      return null;
    }

    const receivedTime = Date.now();
    const dispatchedTimestamp = cmd.dispatched_at ? new Date(cmd.dispatched_at).getTime() : receivedTime;
    const latencyMs = Math.max(0, receivedTime - dispatchedTimestamp);

    const runId = cmd.run_id || (cmd.task_id ? Number(cmd.task_id) : Date.now());
    const taskId = cmd.task_id || 0;
    const issueKey = cmd.issue_key || `TASK-${taskId}`;

    const executionRecord: DispatchExecutionRecord = {
      commandId: cmd.command_id || `cmd-${Date.now()}`,
      runId,
      taskId,
      issueKey,
      dispatchedAt: dispatchedTimestamp,
      startedAt: receivedTime,
      dispatchLatencyMs: latencyMs,
      status: 'executing',
    };

    this.activeExecution = executionRecord;
    this.logSequence = 0;

    if (this.heartbeatService && cmd.run_id) {
      this.heartbeatService.addActiveRunId(cmd.run_id);
    }

    const taskTarget: AutoPilotTaskTarget = {
      id: taskId,
      issue_key: issueKey,
      key: issueKey,
      title: cmd.title || `Task #${taskId}`,
      description: cmd.description,
      instruction: cmd.instruction,
      repository: cmd.context?.repository,
      workspacePath: cmd.context?.workspace_cwd || cmd.context?.cwd,
      project_id: cmd.context?.project_id,
    };

    const runner = new AutoPilotRunner({
      ...this.options.autoPilotConfig,
      provider: (cmd.provider as any) || 'antigravity',
      model: cmd.model || 'gemini-3.7-flash',
      onStageChange: (stage) => {
        this.relayEvent(runId, `stage_${stage}`, stage, { stage }).catch(() => {});
      },
      onLog: ({ text, stream }) => {
        this.logSequence++;
        this.relayLog(runId, this.logSequence, stream || 'stdout', text).catch(() => {});
      },
      onEvidence: (evidence: VerificationEvidence) => {
        this.relayEvidence(runId, evidence).catch(() => {});
      },
      onHandoff: (handoff: AgentHandoffPayload) => {
        this.relayHandoff(runId, handoff).catch(() => {});
      },
    });

    this.activeRunner = runner;

    try {
      const result = await runner.start(taskTarget);
      executionRecord.status = result.success ? 'completed' : 'failed';
      executionRecord.result = result;
      this.executionHistory.push({ ...executionRecord });
      return result;
    } catch (err: any) {
      const errorResult: AutoPilotResult = {
        success: false,
        stage: 'failed',
        error: err?.message || String(err),
        stepHistory: [],
      };
      executionRecord.status = 'failed';
      executionRecord.result = errorResult;
      this.executionHistory.push({ ...executionRecord });
      return errorResult;
    } finally {
      this.activeRunner = null;
      this.activeExecution = null;
      if (this.heartbeatService && cmd.run_id) {
        this.heartbeatService.removeActiveRunId(cmd.run_id);
      }
    }
  }

  public async handleCancelCommand(cmd: DispatchCommand) {
    if (this.activeRunner && this.activeExecution && (!cmd.run_id || cmd.run_id === this.activeExecution.runId)) {
      await this.activeRunner.cancel();
      this.activeExecution.status = 'cancelled';
      if (this.heartbeatService && cmd.run_id) {
        this.heartbeatService.removeActiveRunId(cmd.run_id);
      }
    }
  }

  public async relayLog(runId: number, sequence: number, stream: string, content: string) {
    const fetchImpl = this.options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) return;

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/agent-runs/${runId}/logs`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;

    try {
      await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sequence, stream, content }),
      });
    } catch (e) {
      // Non-blocking log relay error
    }
  }

  public async relayEvent(runId: number, eventType: string, status: string, payload: any = {}) {
    const fetchImpl = this.options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) return;

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/agent-runs/${runId}/events`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;

    try {
      await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event_id: 'evt-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now(),
          event_type: eventType,
          status,
          payload,
          occurred_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      // Non-blocking event relay error
    }
  }

  public async relayEvidence(runId: number, evidence: VerificationEvidence) {
    const fetchImpl = this.options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) return;

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/agent-runs/${runId}/evidence`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;

    try {
      await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          evidence_type: evidence.evidence_type || 'test',
          status: evidence.status || 'passed',
          command: evidence.command,
          summary: evidence.summary,
          metadata: evidence.metadata,
        }),
      });
    } catch (e) {
      // Non-blocking evidence relay error
    }
  }

  public async relayHandoff(runId: number, handoff: AgentHandoffPayload) {
    const fetchImpl = this.options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) return;

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/agent-runs/${runId}/handoff`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;

    try {
      await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(handoff),
      });
    } catch (e) {
      // Non-blocking handoff relay error
    }
  }

  public getActiveExecution(): DispatchExecutionRecord | null {
    return this.activeExecution;
  }

  public getExecutionHistory(): DispatchExecutionRecord[] {
    return [...this.executionHistory];
  }

  public destroy() {
    this.disconnectSseStream();
    if (this.unsubscribeHeartbeat) this.unsubscribeHeartbeat();
    if (this.unsubscribeCancel) this.unsubscribeCancel();
  }
}

export const defaultRemoteDispatchService = new RemoteDispatchService();
