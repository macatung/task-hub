import EventSource from 'react-native-sse';
import { AgentRunEvent, AgentRunLog, ConnectionState } from '@/api/types';

export interface SSEConnectOptions {
  url: string;
  token: string;
  runId?: number;
  workspaceId?: number;
  onEvent?: (event: AgentRunEvent) => void;
  onLog?: (log: AgentRunLog) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: any) => void;
  initialAfter?: number;
  initialAfterLog?: number;
}

export class SSEStreamClient {
  private eventSource: EventSource<'agent-run' | 'agent-log'> | null = null;
  private options: SSEConnectOptions | null = null;
  private state: ConnectionState = 'disconnected';
  private lastEventId: number = 0;
  private lastLogId: number = 0;
  private retryCount: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManuallyClosed: boolean = false;
  private isPaused: boolean = false;

  constructor(options?: SSEConnectOptions) {
    if (options) {
      this.options = options;
      if (options.initialAfter) this.lastEventId = options.initialAfter;
      if (options.initialAfterLog) this.lastLogId = options.initialAfterLog;
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getLastEventId(): number {
    return this.lastEventId;
  }

  public getLastLogId(): number {
    return this.lastLogId;
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.options?.onStateChange?.(newState);
  }

  public connect(options?: SSEConnectOptions): () => void {
    if (options) {
      this.options = options;
      if (options.initialAfter) this.lastEventId = options.initialAfter;
      if (options.initialAfterLog) this.lastLogId = options.initialAfterLog;
    }

    if (!this.options) {
      throw new Error('SSEConnectOptions must be provided to connect()');
    }

    this.isManuallyClosed = false;
    this.isPaused = false;
    this.retryCount = 0;
    this.initiateConnection();

    return () => this.disconnect();
  }

  private buildUrl(): string {
    if (!this.options) return '';
    const base = this.options.url.replace(/\/+$/, '');
    const urlObj = new URL(base.startsWith('http') ? base : `http://${base}`);

    if (this.lastEventId > 0) {
      urlObj.searchParams.set('after', String(this.lastEventId));
    }
    if (this.lastLogId > 0) {
      urlObj.searchParams.set('after_log', String(this.lastLogId));
    }
    if (this.options.runId) {
      urlObj.searchParams.set('run_id', String(this.options.runId));
    }
    if (this.options.workspaceId) {
      urlObj.searchParams.set('workspace_id', String(this.options.workspaceId));
    }

    return urlObj.toString();
  }

  private initiateConnection() {
    if (this.isManuallyClosed || this.isPaused || !this.options) return;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    this.setState(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    const streamUrl = this.buildUrl();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.token}`,
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    if (this.options.workspaceId) {
      headers['X-Workspace-Id'] = String(this.options.workspaceId);
    }

    try {
      this.eventSource = new EventSource<'agent-run' | 'agent-log'>(streamUrl, {
        headers,
        pollingInterval: 0,
      });

      this.eventSource.addEventListener('open', () => {
        this.retryCount = 0;
        this.setState('connected');
      });

      // Handle agent-run events
      this.eventSource.addEventListener('agent-run', (event: any) => {
        try {
          const rawData = event.data;
          if (!rawData || rawData === ': keepalive') return;
          const parsed = JSON.parse(rawData);
          if (!parsed || typeof parsed !== 'object') return;
          if (typeof parsed.id === 'number') {
            if (parsed.id > this.lastEventId) {
              this.lastEventId = parsed.id;
            }
          }
          this.options?.onEvent?.(parsed);
        } catch {
          // Ignore malformed chunk
        }
      });

      // Handle agent-log events
      this.eventSource.addEventListener('agent-log', (event: any) => {
        try {
          const rawData = event.data;
          if (!rawData || rawData === ': keepalive') return;
          const parsed = JSON.parse(rawData);
          if (!parsed || typeof parsed !== 'object') return;
          if (typeof parsed.id === 'number') {
            if (parsed.id > this.lastLogId) {
              this.lastLogId = parsed.id;
            }
          }
          this.options?.onLog?.(parsed);
        } catch {
          // Ignore malformed chunk
        }
      });

      // Handle generic messages
      this.eventSource.addEventListener('message', (event: any) => {
        try {
          const rawData = event.data;
          if (!rawData || rawData === ': keepalive') return;
          const parsed = JSON.parse(rawData);
          if (!parsed || typeof parsed !== 'object') return;
          if (parsed.stream) {
            if (typeof parsed.id === 'number' && parsed.id > this.lastLogId) {
              this.lastLogId = parsed.id;
            }
            this.options?.onLog?.(parsed);
          } else if (parsed.type) {
            if (typeof parsed.id === 'number' && parsed.id > this.lastEventId) {
              this.lastEventId = parsed.id;
            }
            this.options?.onEvent?.(parsed);
          }
        } catch {}
      });

      this.eventSource.addEventListener('error', (err: any) => {
        this.options?.onError?.(err);
        this.handleConnectionError();
      });
    } catch (err) {
      this.options?.onError?.(err);
      this.handleConnectionError();
    }
  }

  private handleConnectionError() {
    if (this.isManuallyClosed || this.isPaused) return;

    this.setState('reconnecting');
    this.retryCount += 1;

    // Exponential backoff: base 1000ms * (1.5 ^ retryCount), capped at 15000ms
    const delay = Math.min(1000 * Math.pow(1.5, this.retryCount), 15000);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.initiateConnection();
    }, delay);
  }

  public pause() {
    this.isPaused = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    this.setState('disconnected');
  }

  public resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.initiateConnection();
  }

  public disconnect() {
    this.isManuallyClosed = true;
    this.isPaused = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    this.setState('disconnected');
  }
}
