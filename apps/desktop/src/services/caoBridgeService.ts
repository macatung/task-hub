/**
 * CAO (CLI Agent Orchestrator) Bridge Service
 * Integrates AWS Labs CLI Agent Orchestrator (CAO) with Task Hub Desktop.
 * 
 * Renderer-safe event normalization for CAO. Process launch, messaging and
 * shutdown are intentionally owned by Electron main through the official
 * `cao` CLI so renderer code never controls local orchestration processes.
 */

export interface CaoAgentSession {
  sessionId: string;
  provider: string;
  model?: string;
  status: 'starting' | 'running' | 'idle' | 'completed' | 'failed';
  workingDirectory: string;
  createdAt: string;
  eventsCount: number;
}

export interface CaoOrchestratorConfig {
  endpoint: string;
  enabled: boolean;
  autoStartDaemon: boolean;
  supervisorProvider: string;
  workerProviders: string[];
}

export interface CaoNormalizedEvent {
  type: 'init' | 'tool_call' | 'tool_result' | 'text' | 'turn_complete' | 'error';
  sessionId: string;
  agentRole?: 'supervisor' | 'worker' | 'reviewer';
  provider: string;
  content: string;
  timestamp: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class CaoBridgeService {
  private endpoint: string;
  private isConnected: boolean = false;
  private activeSessions: Map<string, CaoAgentSession> = new Map();

  constructor(endpoint = 'http://127.0.0.1:9889') {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  /**
   * Health check for local cao-server daemon
   */
  public async checkHealth(): Promise<{ ok: boolean; version?: string; message: string }> {
    try {
      if (typeof fetch === 'undefined') {
        return { ok: false, message: 'Fetch API not available' };
      }
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        this.isConnected = true;
        return {
          ok: true,
          version: data.version || '0.1.0',
          message: 'Connected to local CAO Orchestrator daemon.',
        };
      }
      this.isConnected = false;
      return {
        ok: false,
        message: `CAO server responded with HTTP ${response.status}`,
      };
    } catch {
      this.isConnected = false;
      return {
        ok: false,
        message: 'CAO Orchestrator daemon is not running on ' + this.endpoint,
      };
    }
  }

  /**
   * Spawns an agent session using CAO multi-agent orchestration
   */
  public async createSession(payload: {
    taskKey: string;
    taskTitle: string;
    instructions: string;
    provider: string;
    model?: string;
    workingDirectory: string;
    role?: 'supervisor' | 'worker' | 'reviewer';
  }): Promise<{ ok: boolean; session?: CaoAgentSession; error?: string }> {
    const sessionId = `cao-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const session: CaoAgentSession = {
      sessionId,
      provider: payload.provider,
      model: payload.model,
      status: 'starting',
      workingDirectory: payload.workingDirectory,
      createdAt: new Date().toISOString(),
      eventsCount: 0,
    };

    // This renderer service must never synthesize a CAO session. The official
    // CAO lifecycle is CLI-owned (`cao launch`, `cao session send`, and
    // `cao shutdown`), and Electron main is the only process allowed to run
    // those commands. Keeping this boundary explicit avoids a false-positive
    // "running" session when the daemon merely answers /health.
    if (!this.isConnected) {
      return { ok: false, error: 'CAO daemon is unavailable. Electron main must launch CAO before creating a session.' };
    }
    return { ok: false, error: 'CAO session creation is owned by Electron main; use desktopApi.agent.start().' };
  }

  /**
   * Normalizes raw event text from CAO or agent CLI stream into Task Hub standard format
   */
  public normalizeStreamEvent(rawEvent: any, sessionId: string): CaoNormalizedEvent {
    if (typeof rawEvent === 'string' || !rawEvent || typeof rawEvent !== 'object') {
      return {
        type: 'text',
        sessionId,
        provider: 'cao',
        content: rawEvent != null ? String(rawEvent) : '',
        timestamp: new Date().toISOString(),
      };
    }

    const type = rawEvent.event === 'init'
      ? 'init'
      : rawEvent.event === 'tool_call'
        ? 'tool_call'
        : rawEvent.event === 'result'
          ? 'turn_complete'
          : rawEvent.type === 'error'
            ? 'error'
            : 'text';

    const content = rawEvent.text || rawEvent.content || rawEvent.message || JSON.stringify(rawEvent);
    const tokenUsage = rawEvent.usage?.total_tokens
      ? {
          promptTokens: rawEvent.usage.prompt_tokens || 0,
          completionTokens: rawEvent.usage.completion_tokens || 0,
          totalTokens: rawEvent.usage.total_tokens || 0,
        }
      : undefined;

    return {
      type,
      sessionId,
      agentRole: rawEvent.role || 'worker',
      provider: rawEvent.provider || 'cao',
      content,
      timestamp: rawEvent.timestamp || new Date().toISOString(),
      tokenUsage,
    };
  }

  /**
   * Terminates an active CAO session
   */
  public async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    session.status = 'completed';
    // Actual CAO shutdown is deliberately handled by Electron main through
    // `cao shutdown --session`; this method only clears a renderer-side
    // compatibility mirror and never calls an undocumented REST endpoint.
    this.activeSessions.delete(sessionId);
    return true;
  }

  /**
   * Lists all tracked CAO sessions
   */
  public getActiveSessions(): CaoAgentSession[] {
    return Array.from(this.activeSessions.values());
  }
}

export const caoBridge = new CaoBridgeService();
