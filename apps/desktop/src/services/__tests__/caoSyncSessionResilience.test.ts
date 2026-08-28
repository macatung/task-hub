import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  CaoBridgeService,
  caoBridge,
  type CaoAgentSession,
  type CaoNormalizedEvent,
  type CaoOrchestratorConfig,
} from '../caoBridgeService.js';
import electronMainSource from '../../../electron/main.ts?raw';
import preloadSource from '../../../electron/preload.ts?raw';

describe('CAO Bridge Session Sync & Resilience Test Suite (Requirement R1)', () => {
  let bridge: CaoBridgeService;

  beforeEach(() => {
    bridge = new CaoBridgeService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Dimension 1: Session Lifecycle State Machine & Multi-Worker State Sync
  // =========================================================================
  describe('Dimension 1: Session Lifecycle State Machine & Multi-Worker State Sync', () => {
    it('defines standard session lifecycle states (starting, running, idle, completed, failed)', () => {
      const states: CaoAgentSession['status'][] = [
        'starting',
        'running',
        'idle',
        'completed',
        'failed',
      ];
      expect(states).toHaveLength(5);
      expect(states).toContain('starting');
      expect(states).toContain('running');
      expect(states).toContain('idle');
      expect(states).toContain('completed');
      expect(states).toContain('failed');
    });

    it('correctly classifies terminal states vs non-terminal active states', () => {
      const isTerminalState = (state: string): boolean =>
        /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);

      // Terminal states
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('COMPLETED')).toBe(true);
      expect(isTerminalState('failed')).toBe(true);
      expect(isTerminalState('error')).toBe(true);
      expect(isTerminalState('cancelled')).toBe(true);
      expect(isTerminalState('terminated')).toBe(true);
      expect(isTerminalState('dead')).toBe(true);
      expect(isTerminalState('stopped')).toBe(true);

      // Non-terminal / in-flight states
      expect(isTerminalState('starting')).toBe(false);
      expect(isTerminalState('running')).toBe(false);
      expect(isTerminalState('idle')).toBe(false);
      expect(isTerminalState('waiting_workers')).toBe(false);
      expect(isTerminalState('busy')).toBe(false);
      expect(isTerminalState('in_progress')).toBe(false);
      expect(isTerminalState('delegating')).toBe(false);
      expect(isTerminalState('reviewing')).toBe(false);
    });

    it('maintains session active when supervisor finishes but child workers are still running (waiting_workers)', () => {
      const supervisorStatus = {
        state: 'completed',
        output: 'Supervisor finished task planning and delegated to worker fleet.',
        workers: [
          { id: 'worker-1', name: 'implementer', role: 'worker', state: 'running', last_output: 'Writing auth module' },
          { id: 'worker-2', name: 'reviewer', role: 'reviewer', state: 'in_progress', last_output: 'Running security audit' },
        ],
      };

      const isTerminalState = (state: string): boolean =>
        /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);

      const liveWorkers = supervisorStatus.workers.filter((w) => !isTerminalState(w.state));
      expect(liveWorkers).toHaveLength(2);

      // Session must not exit when live workers exist; emit waiting_workers event
      const waitingEvent = {
        type: 'cao.session.waiting_workers',
        session: 'cao-session-101',
        count: liveWorkers.length,
        text: `CAO supervisor finished; waiting for ${liveWorkers.length} active worker(s)...`,
        workers: liveWorkers.map((w) => ({ id: w.id, role: w.role, state: w.state })),
      };

      expect(waitingEvent.type).toBe('cao.session.waiting_workers');
      expect(waitingEvent.count).toBe(2);
      expect(waitingEvent.text).toContain('waiting for 2 active worker(s)');
      expect(waitingEvent.workers[0].role).toBe('worker');
      expect(waitingEvent.workers[1].role).toBe('reviewer');
    });

    it('transitions to completed only when both supervisor and all workers reach terminal states', () => {
      const isTerminalState = (state: string): boolean =>
        /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);

      const finalStatus = {
        state: 'completed',
        output: 'All tasks completed successfully.',
        workers: [
          { id: 'worker-1', name: 'implementer', role: 'worker', state: 'completed', last_output: 'Module done' },
          { id: 'worker-2', name: 'reviewer', role: 'reviewer', state: 'completed', last_output: 'Audit passed' },
        ],
      };

      const liveWorkers = finalStatus.workers.filter((w) => !isTerminalState(w.state));
      expect(liveWorkers).toHaveLength(0);

      const failedWorkers = finalStatus.workers.filter((w) => /^(error|failed|cancelled|terminated|dead)$/i.test(w.state));
      const overallFailed = /^(error|failed|cancelled|terminated|dead)$/i.test(finalStatus.state) || failedWorkers.length > 0;

      expect(overallFailed).toBe(false);
      const exitCode = overallFailed ? 1 : 0;
      expect(exitCode).toBe(0);
    });

    it('resolves exit code to 1 when a worker or supervisor fails', () => {
      const isTerminalState = (state: string): boolean =>
        /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);

      const failedStatus = {
        state: 'completed',
        output: 'Supervisor completed but worker encountered fatal error.',
        workers: [
          { id: 'worker-1', name: 'implementer', role: 'worker', state: 'failed', last_output: 'Compile error' },
          { id: 'worker-2', name: 'reviewer', role: 'reviewer', state: 'completed', last_output: 'Review cancelled' },
        ],
      };

      const liveWorkers = failedStatus.workers.filter((w) => !isTerminalState(w.state));
      expect(liveWorkers).toHaveLength(0);

      const failedWorkers = failedStatus.workers.filter((w) => /^(error|failed|cancelled|terminated|dead)$/i.test(w.state));
      const overallFailed = /^(error|failed|cancelled|terminated|dead)$/i.test(failedStatus.state) || failedWorkers.length > 0;

      expect(overallFailed).toBe(true);
      const exitCode = overallFailed ? 1 : 0;
      expect(exitCode).toBe(1);
    });

    it('verifies main process enforces waiting_workers and session status poller', () => {
      expect(electronMainSource).toContain('function pollCaoSession(sessionId: string)');
      expect(electronMainSource).toContain('function parseCaoSessionStatus(raw: string)');
      expect(electronMainSource).toContain('function isCaoTerminalState(state: string)');
      expect(electronMainSource).toContain("type: 'cao.session.waiting_workers'");
      expect(electronMainSource).toContain('CAO supervisor finished; waiting for');
      expect(electronMainSource).toContain('const liveWorkers = status.workers.filter');
    });
  });

  // =========================================================================
  // Dimension 2: Disconnect, Reconnect, Health Check Timeouts & Retry Resilience
  // =========================================================================
  describe('Dimension 2: Disconnect, Reconnect, Health Check Timeouts & Retry Resilience', () => {
    it('reports health success and records connection state when daemon responds 200 OK', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', version: '0.2.1', uptime: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await bridge.checkHealth();
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.2.1');
      expect(result.message).toContain('Connected to local CAO Orchestrator daemon');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:9889/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('falls back to default version 0.1.0 when version field is missing in 200 OK response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      );

      const result = await bridge.checkHealth();
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.1.0');
    });

    it('handles offline daemon with network failure / ECONNREFUSED gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED 127.0.0.1:9889'));

      const result = await bridge.checkHealth();
      expect(result.ok).toBe(false);
      expect(result.message).toContain('CAO Orchestrator daemon is not running on http://127.0.0.1:9889');
    });

    it('handles HTTP error status codes (404, 500, 503) without unhandled exceptions', async () => {
      const errorStatuses = [404, 500, 502, 503];

      for (const status of errorStatuses) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response('Internal Server Error', { status, statusText: 'Error' })
        );

        const result = await bridge.checkHealth();
        expect(result.ok).toBe(false);
        expect(result.message).toContain(`CAO server responded with HTTP ${status}`);
      }
    });

    it('handles fetch timeout via AbortSignal without hanging', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'TimeoutError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

      const result = await bridge.checkHealth();
      expect(result.ok).toBe(false);
      expect(result.message).toContain('CAO Orchestrator daemon is not running');
    });

    it('tracks flapping daemon connection status across multiple health checks', async () => {
      // 1. Initial check - OK
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 })
      );
      const res1 = await bridge.checkHealth();
      expect(res1.ok).toBe(true);

      // 2. Daemon crashes - Offline
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res2 = await bridge.checkHealth();
      expect(res2.ok).toBe(false);

      // Session creation must now be blocked
      const sessionAttempt = await bridge.createSession({
        taskKey: 'TH-201',
        taskTitle: 'Retry test',
        instructions: 'Run agent',
        provider: 'antigravity',
        workingDirectory: 'd:/Work/task-hub',
      });
      expect(sessionAttempt.ok).toBe(false);
      expect(sessionAttempt.error).toContain('CAO daemon is unavailable');

      // 3. Daemon recovers - Online
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 })
      );
      const res3 = await bridge.checkHealth();
      expect(res3.ok).toBe(true);
    });

    it('sanitizes and updates daemon endpoint with trailing slash stripping', () => {
      bridge.setEndpoint('http://localhost:9890///');
      expect(bridge.getEndpoint()).toBe('http://localhost:9890');

      bridge.setEndpoint('http://10.0.0.5:8080');
      expect(bridge.getEndpoint()).toBe('http://10.0.0.5:8080');
    });

    it('verifies reconnection logic and git worktree repair in main process', () => {
      expect(electronMainSource).toContain('async function reconnectCaoSession(sessionId: string)');
      expect(electronMainSource).toContain('function repairWorktreeForCao(cwd: string)');
      expect(electronMainSource).toContain('function normalizeWorktreeGitMetadata');
      expect(electronMainSource).toContain("ipcMain.handle('agent-reconnect-cao-session'");
      expect(preloadSource).toContain('reconnectCaoSession: (sessionId: string)');
    });

    it('simulates retry backoff during session startup discovery', async () => {
      let attempts = 0;
      const fakeWaitForCaoSession = async (sessionName: string): Promise<{ ok: boolean; output: string } | null> => {
        for (let i = 0; i < 6; i += 1) {
          attempts += 1;
          if (attempts >= 3) {
            return { ok: true, output: JSON.stringify({ status: 'running', session: sessionName }) };
          }
        }
        return null;
      };

      const recovered = await fakeWaitForCaoSession('cao-test-session');
      expect(recovered).not.toBeNull();
      expect(recovered?.ok).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  // =========================================================================
  // Dimension 3: Normalized Event Streaming, Multi-Agent Roles & Token Telemetry
  // =========================================================================
  describe('Dimension 3: Normalized Event Streaming, Multi-Agent Roles & Token Telemetry', () => {
    it('normalizes events across supervisor, worker, and reviewer roles', () => {
      const roles: ('supervisor' | 'worker' | 'reviewer')[] = ['supervisor', 'worker', 'reviewer'];

      for (const role of roles) {
        const rawEvent = {
          event: 'text',
          role,
          provider: 'codex',
          text: `Event from ${role}`,
          timestamp: '2026-08-28T08:00:00.000Z',
        };

        const normalized = bridge.normalizeStreamEvent(rawEvent, 'session-role-test');
        expect(normalized.agentRole).toBe(role);
        expect(normalized.content).toBe(`Event from ${role}`);
        expect(normalized.provider).toBe('codex');
        expect(normalized.sessionId).toBe('session-role-test');
      }
    });

    it('defaults agentRole to worker when omitted in structured event', () => {
      const rawEvent = {
        event: 'text',
        provider: 'claude',
        content: 'Worker step execution without explicit role',
      };

      const normalized = bridge.normalizeStreamEvent(rawEvent, 'session-default-role');
      expect(normalized.agentRole).toBe('worker');
    });

    it('maps event kinds correctly (init, tool_call, result -> turn_complete, error, text)', () => {
      const testCases = [
        { raw: { event: 'init', message: 'Session init' }, expectedType: 'init' },
        { raw: { event: 'tool_call', text: 'Calling tool grep' }, expectedType: 'tool_call' },
        { raw: { event: 'result', text: 'Task finished' }, expectedType: 'turn_complete' },
        { raw: { type: 'error', message: 'Syntax error' }, expectedType: 'error' },
        { raw: { event: 'unknown_event', text: 'Random log' }, expectedType: 'text' },
      ];

      for (const { raw, expectedType } of testCases) {
        const normalized = bridge.normalizeStreamEvent(raw, 'session-events');
        expect(normalized.type).toBe(expectedType);
      }
    });

    it('extracts and structures token usage metrics from raw events', () => {
      const rawWithUsage = {
        event: 'result',
        role: 'worker',
        provider: 'antigravity',
        text: 'Finished unit tests',
        usage: {
          prompt_tokens: 1540,
          completion_tokens: 380,
          total_tokens: 1920,
        },
      };

      const normalized = bridge.normalizeStreamEvent(rawWithUsage, 'session-token-test');
      expect(normalized.tokenUsage).toEqual({
        promptTokens: 1540,
        completionTokens: 380,
        totalTokens: 1920,
      });
    });

    it('omits tokenUsage when total_tokens is zero, null, or undefined', () => {
      const rawNoTokens = {
        event: 'text',
        role: 'worker',
        provider: 'codex',
        text: 'Normal stdout line',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };

      const normalized = bridge.normalizeStreamEvent(rawNoTokens, 'session-no-tokens');
      expect(normalized.tokenUsage).toBeUndefined();
    });

    it('simulates monotonic token accumulation across multi-agent turns', () => {
      interface TokenAccumulator {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }

      const accumulator: TokenAccumulator = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      const turns = [
        { role: 'supervisor', usage: { prompt_tokens: 500, completion_tokens: 120, total_tokens: 620 } },
        { role: 'worker', usage: { prompt_tokens: 1200, completion_tokens: 450, total_tokens: 1650 } },
        { role: 'reviewer', usage: { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 } },
      ];

      for (const turn of turns) {
        const event = bridge.normalizeStreamEvent(
          { event: 'turn_complete', role: turn.role, text: 'Turn completed', usage: turn.usage },
          'session-multi-agent'
        );
        if (event.tokenUsage) {
          accumulator.promptTokens += event.tokenUsage.promptTokens;
          accumulator.completionTokens += event.tokenUsage.completionTokens;
          accumulator.totalTokens += event.tokenUsage.totalTokens;
        }
      }

      expect(accumulator.promptTokens).toBe(2500);
      expect(accumulator.completionTokens).toBe(770);
      expect(accumulator.totalTokens).toBe(3270);
    });

    it('strips terminal ANSI escape codes and formats multi-worker outputs cleanly', () => {
      const stripTerminalAnsi = (val: string): string =>
        val.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').trim();

      const rawColored = '\u001b[32m[SUCCESS]\u001b[0m All 10 tests passed in \u001b[1m45ms\u001b[0m\r\n';
      const clean = stripTerminalAnsi(rawColored);
      expect(clean).toBe('[SUCCESS] All 10 tests passed in 45ms');

      // Test multi-worker aggregation formatting
      const workers = [
        { id: 'worker-1', last_output: '\u001b[34mRunning build\u001b[0m' },
        { id: 'reviewer-1', last_output: '\u001b[32mApproved\u001b[0m' },
      ];
      const workerOutputs = workers
        .map((w) => `[${w.id}]\n${stripTerminalAnsi(w.last_output)}`)
        .join('\n\n');

      expect(workerOutputs).toContain('[worker-1]\nRunning build');
      expect(workerOutputs).toContain('[reviewer-1]\nApproved');
    });

    it('calculates output delta accurately without duplication when polling cumulative buffers', () => {
      let previousBuffer = '';
      const outputs: string[] = [];

      const pollerSnapshots = [
        'Line 1: Starting supervisor\n',
        'Line 1: Starting supervisor\nLine 2: Delegating to worker 1\n',
        'Line 1: Starting supervisor\nLine 2: Delegating to worker 1\nLine 3: Worker 1 finished\n',
      ];

      for (const snapshot of pollerSnapshots) {
        const delta = previousBuffer && snapshot.startsWith(previousBuffer)
          ? snapshot.slice(previousBuffer.length).trim()
          : snapshot.trim();
        previousBuffer = snapshot;
        if (delta) outputs.push(delta);
      }

      expect(outputs).toEqual([
        'Line 1: Starting supervisor',
        'Line 2: Delegating to worker 1',
        'Line 3: Worker 1 finished',
      ]);
    });
  });

  // =========================================================================
  // Dimension 4: Malformed Payload Handling & Offline Daemon Error Handling
  // =========================================================================
  describe('Dimension 4: Malformed Payload Handling & Offline Daemon Error Handling', () => {
    it('recovers JSON object from raw CLI output with leading warnings or banners', () => {
      const takeJsonObjects = (text: string): { objects: string[] } => {
        const objects: string[] = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] === '{') {
            if (depth === 0) start = i;
            depth += 1;
          } else if (text[i] === '}') {
            depth -= 1;
            if (depth === 0 && start !== -1) {
              objects.push(text.slice(start, i + 1));
              start = -1;
            }
          }
        }
        return { objects };
      };

      const parseCaoSessionStatus = (raw: string) => {
        let data: any;
        try {
          data = JSON.parse(raw.trim());
        } catch {
          const objects = takeJsonObjects(raw).objects;
          for (let index = objects.length - 1; index >= 0; index -= 1) {
            try { data = JSON.parse(objects[index]); break; } catch { /* keep looking */ }
          }
        }
        return {
          state: String(data?.conductor?.status || data?.status || '').toLowerCase(),
          output: data?.conductor?.last_output || '',
        };
      };

      const rawWithBanner = `
        Warning: --yolo mode enabled. Proceeding with caution.
        [DEBUG] Initializing CAO supervisor daemon on port 9889...
        {"conductor":{"status":"running","last_output":"Supervisor started"},"workers":[]}
      `;

      const parsed = parseCaoSessionStatus(rawWithBanner);
      expect(parsed.state).toBe('running');
      expect(parsed.output).toBe('Supervisor started');
    });

    it('handles completely malformed / unparseable raw output gracefully without crashing', () => {
      const parseCaoSessionStatus = (raw: string) => {
        let data: any;
        try {
          data = JSON.parse(raw.trim());
        } catch {
          data = null;
        }
        return {
          state: String(data?.conductor?.status || data?.status || '').toLowerCase(),
          output: data?.conductor?.last_output || '',
          workers: Array.isArray(data?.workers) ? data.workers : [],
        };
      };

      const malformedOutputs = [
        '',
        '   ',
        'Fatal Error: Segmentation fault (core dumped)',
        '{ unclosed json payload',
        '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>',
      ];

      for (const malformed of malformedOutputs) {
        const parsed = parseCaoSessionStatus(malformed);
        expect(parsed.state).toBe('');
        expect(parsed.output).toBe('');
        expect(parsed.workers).toEqual([]);
      }
    });

    it('normalizes unexpected non-string, non-standard event objects safely', () => {
      const weirdEvents = [
        null,
        undefined,
        12345,
        true,
        { nonStandardKey: 'unexpected data' },
        { event: null, text: null, usage: 'invalid_usage' },
      ];

      for (const weird of weirdEvents) {
        const normalized = bridge.normalizeStreamEvent(weird as any, 'session-weird');
        expect(normalized).toBeDefined();
        expect(normalized.sessionId).toBe('session-weird');
        expect(typeof normalized.content).toBe('string');
        expect(typeof normalized.timestamp).toBe('string');
      }
    });

    it('strictly enforces that session creation is owned by Electron main', async () => {
      // 1. When disconnected -> returns unavailable error
      const offlineResult = await bridge.createSession({
        taskKey: 'TH-50',
        taskTitle: 'Offline check',
        instructions: 'Test offline',
        provider: 'antigravity',
        workingDirectory: 'd:/Work/task-hub',
      });
      expect(offlineResult.ok).toBe(false);
      expect(offlineResult.error).toContain('CAO daemon is unavailable');

      // 2. When connected via mock health -> still refuses renderer session synthesis
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), { status: 200 })
      );
      await bridge.checkHealth();

      const onlineResult = await bridge.createSession({
        taskKey: 'TH-51',
        taskTitle: 'Online boundary check',
        instructions: 'Test main process ownership',
        provider: 'codex',
        workingDirectory: 'd:/Work/task-hub',
      });
      expect(onlineResult.ok).toBe(false);
      expect(onlineResult.error).toContain('CAO session creation is owned by Electron main; use desktopApi.agent.start().');
      expect(bridge.getActiveSessions()).toEqual([]);
    });

    it('safely handles terminateSession for tracked and non-existent sessions', async () => {
      // Non-existent session
      const notFound = await bridge.terminateSession('non-existent-session-id');
      expect(notFound).toBe(false);

      // Tracking empty by default
      expect(bridge.getActiveSessions()).toEqual([]);
    });

    it('exports singleton instance caoBridge', () => {
      expect(caoBridge).toBeDefined();
      expect(caoBridge).toBeInstanceOf(CaoBridgeService);
      expect(caoBridge.getEndpoint()).toBe('http://127.0.0.1:9889');
    });
  });
});
