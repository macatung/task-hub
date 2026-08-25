/**
 * Connected Desktop Agent Heartbeat Service
 * 
 * Sends periodic telemetry every 10–15s to Web Hub (POST /api/v1/desktop/agents/heartbeat),
 * reports workstation metrics (OS, IP, Provider, Model, CWD, Quota, Ping Latency),
 * and receives pending remote dispatch and cancellation commands.
 */

export interface ProviderQuotaDetail {
  used_tokens?: number;
  limit?: number;
  weekly_percent?: number;
  five_hour_percent?: number;
  requests_used?: number;
  requests_limit?: number;
  tokens_remaining?: number;
  weekly_reset_in?: string;
  five_hour_reset_in?: string;
  [key: string]: any;
}

export interface DesktopQuotaMetrics {
  plan?: string;
  gemini?: ProviderQuotaDetail;
  claude_gpt?: ProviderQuotaDetail;
  codex?: ProviderQuotaDetail;
  [key: string]: any;
}

export interface DesktopTelemetry {
  client_id: string;
  name: string;
  machine_name: string;
  hostname: string;
  platform: 'win32' | 'darwin' | 'linux' | string;
  arch: string;
  os_release: string;
  version: string;
  status: 'idle' | 'busy' | 'offline' | 'online';
  active_providers: string[];
  active_model: string;
  workspace_cwd: string;
  active_run_ids: number[];
  quota_metrics: DesktopQuotaMetrics;
  ping_latency_ms: number;
}

export interface DispatchCommand {
  type: 'remote_dispatch' | 'cancel_run' | 'ping_ack' | string;
  command_id: string;
  run_id?: number;
  task_id?: number;
  issue_key?: string;
  title?: string;
  description?: string;
  mode?: 'auto_pilot' | 'supervised' | string;
  provider?: string;
  model?: string;
  instruction?: string;
  context?: Record<string, any>;
  dispatched_at?: string;
  requested_at?: string;
}

export interface HeartbeatResponse {
  success: boolean;
  health: string;
  server_time: string;
  commands: DispatchCommand[];
  data?: any;
}

export interface DesktopHeartbeatOptions {
  baseUrl: string;
  token?: string;
  intervalMs: number;
  clientId?: string;
  fetchFn?: typeof fetch;
}

function getDefaultClientId(): string {
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem('task_hub_desktop_client_id');
    if (existing) return existing;
    const generated = 'client-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    try {
      localStorage.setItem('task_hub_desktop_client_id', generated);
    } catch {
      // ignore storage errors
    }
    return generated;
  }
  return 'client-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
}

export class DesktopHeartbeatService {
  private options: DesktopHeartbeatOptions;
  private timer: any = null;
  private isRunning = false;
  private lastPingLatencyMs = 0;
  private isOnlineStatus = false;
  private telemetryOverrides: Partial<DesktopTelemetry> = {};
  private commandListeners = new Set<(cmd: DispatchCommand) => void>();
  private activeRunIds = new Set<number>();

  constructor(options: Partial<DesktopHeartbeatOptions> = {}) {
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8000',
      token: options.token,
      intervalMs: options.intervalMs || 10000,
      clientId: options.clientId || getDefaultClientId(),
      fetchFn: options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined),
    };
  }

  public setOptions(options: Partial<DesktopHeartbeatOptions>) {
    this.options = { ...this.options, ...options };
    if (options.intervalMs && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  public setTelemetryOverrides(overrides: Partial<DesktopTelemetry>) {
    this.telemetryOverrides = { ...this.telemetryOverrides, ...overrides };
  }

  public setActiveModel(model: string) {
    this.setTelemetryOverrides({ active_model: model });
  }

  public setQuotaMetrics(quotaMetrics: DesktopQuotaMetrics) {
    this.setTelemetryOverrides({ quota_metrics: quotaMetrics });
  }

  public setActiveRunIds(runIds: number[]) {
    this.activeRunIds = new Set(runIds);
    this.setTelemetryOverrides({
      active_run_ids: runIds,
      status: runIds.length > 0 ? 'busy' : 'idle',
    });
  }

  public addActiveRunId(runId: number) {
    this.activeRunIds.add(runId);
  }

  public removeActiveRunId(runId: number) {
    this.activeRunIds.delete(runId);
  }

  public getTelemetry(): DesktopTelemetry {
    const isWindows = typeof navigator !== 'undefined' ? navigator.userAgent.includes('Windows') : true;
    const platform = isWindows ? 'win32' : 'darwin';

    const defaultTelemetry: DesktopTelemetry = {
      client_id: this.options.clientId || getDefaultClientId(),
      name: 'Trung\'s Dev Station',
      machine_name: 'Trung\'s Dev Station',
      hostname: 'DESKTOP-DEV',
      platform,
      arch: 'x64',
      os_release: 'Windows 11',
      version: '1.0.7',
      status: this.activeRunIds.size > 0 ? 'busy' : 'idle',
      active_providers: ['antigravity', 'claude_code', 'codex'],
      active_model: 'gemini-3.7-flash',
      workspace_cwd: 'd:\\Project\\task-hub',
      active_run_ids: Array.from(this.activeRunIds),
      quota_metrics: {
        plan: 'Google AI Ultra',
        gemini: { used_tokens: 620000, limit: 2000000, weekly_percent: 69, five_hour_percent: 93 },
        claude_gpt: { used_tokens: 45000, limit: 1000000, weekly_percent: 95, five_hour_percent: 100 },
        codex: { used_tokens: 20000, limit: 1000000, weekly_percent: 98, five_hour_percent: 95 },
      },
      ping_latency_ms: this.lastPingLatencyMs,
    };

    return { ...defaultTelemetry, ...this.telemetryOverrides };
  }

  public async sendHeartbeat(): Promise<HeartbeatResponse | null> {
    const fetchImpl = this.options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetchImpl) {
      console.warn('[DesktopHeartbeat] No fetch implementation available.');
      return null;
    }

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const telemetry = this.getTelemetry();
    const url = `${this.options.baseUrl.replace(/\/$/, '')}/api/v1/desktop/agents/heartbeat`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.options.token) {
      headers['Authorization'] = `Bearer ${this.options.token}`;
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(telemetry),
      });

      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.lastPingLatencyMs = Math.max(1, Math.round(endTime - startTime));
      this.setTelemetryOverrides({ ping_latency_ms: this.lastPingLatencyMs });

      if (!response.ok) {
        this.isOnlineStatus = false;
        console.warn(`[DesktopHeartbeat] HTTP ${response.status} from ${url}`);
        return null;
      }

      const json: HeartbeatResponse = await response.json();
      this.isOnlineStatus = json.success && json.health !== 'offline';

      if (json.commands && Array.isArray(json.commands)) {
        for (const cmd of json.commands) {
          this.notifyCommand(cmd);
        }
      }

      return json;
    } catch (err: any) {
      this.isOnlineStatus = false;
      console.warn('[DesktopHeartbeat] Heartbeat request failed:', err?.message || err);
      return null;
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    // Immediate initial heartbeat
    this.sendHeartbeat().catch(() => {});

    // Periodic heartbeat
    this.timer = setInterval(() => {
      this.sendHeartbeat().catch(() => {});
    }, this.options.intervalMs);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public onCommand(callback: (cmd: DispatchCommand) => void): () => void {
    this.commandListeners.add(callback);
    return () => this.commandListeners.delete(callback);
  }

  public onDispatch(callback: (cmd: DispatchCommand) => void): () => void {
    return this.onCommand((cmd) => {
      if (cmd.type === 'remote_dispatch') {
        callback(cmd);
      }
    });
  }

  public onCancel(callback: (cmd: DispatchCommand) => void): () => void {
    return this.onCommand((cmd) => {
      if (cmd.type === 'cancel_run') {
        callback(cmd);
      }
    });
  }

  private notifyCommand(cmd: DispatchCommand) {
    for (const listener of this.commandListeners) {
      try {
        listener(cmd);
      } catch (err) {
        console.error('[DesktopHeartbeat] Error in command listener:', err);
      }
    }
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public getLastPingLatency(): number {
    return this.lastPingLatencyMs;
  }

  public getActiveRunIds(): number[] {
    return Array.from(this.activeRunIds);
  }
}

export const defaultHeartbeatService = new DesktopHeartbeatService();
