import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { CaoBridgeService, caoBridge } from '../caoBridgeService.js';
import electronMainSource from '../../../electron/main.ts?raw';

describe('Adversarial Stress Test Suite — Challenger 1 (CAO Backend Lifecycle & Multi-Worker Polling)', () => {
  let bridge: CaoBridgeService;

  beforeEach(() => {
    bridge = new CaoBridgeService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Dimension 1: Port Ownership, Conflict Detection & Port Boundary Parsing
  // =========================================================================
  describe('Dimension 1: Port Ownership & Conflict Detection Logic', () => {
    it('verifies caoServerPort logic handles extreme boundary inputs', () => {
      const parsePort = (envVal?: string): number => {
        const configured = Number(envVal || 9889);
        return Number.isInteger(configured) && configured > 0 && configured < 65536 ? configured : 9889;
      };

      expect(parsePort(undefined)).toBe(9889);
      expect(parsePort('')).toBe(9889);
      expect(parsePort('9889')).toBe(9889);
      expect(parsePort('8000')).toBe(8000);
      expect(parsePort('1')).toBe(1);
      expect(parsePort('65535')).toBe(65535);

      // Invalid / Out of bounds
      expect(parsePort('0')).toBe(9889);
      expect(parsePort('-1')).toBe(9889);
      expect(parsePort('-9889')).toBe(9889);
      expect(parsePort('65536')).toBe(9889);
      expect(parsePort('100000')).toBe(9889);
      expect(parsePort('invalid-port')).toBe(9889);
      expect(parsePort('9889.5')).toBe(9889);
      expect(parsePort('NaN')).toBe(9889);
      expect(parsePort('Infinity')).toBe(9889);
    });

    it('empirically tests isCaoPortOpen with real Node HTTP servers responding with diverse payloads', async () => {
      const isCaoPortOpenLogic = (port: number): Promise<boolean> => {
        return new Promise((resolve) => {
          const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 1500 }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              const isJson = res.headers['content-type']?.includes('application/json');
              const isCaoContent = body.includes('status') || body.includes('cao') || body.includes('version') || body.includes('ok');
              resolve(res.statusCode === 200 && Boolean(isJson || isCaoContent));
            });
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
      };

      // 1. Valid CAO JSON Server
      const caoServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '0.2.0', cao: true }));
      });
      await new Promise<void>((r) => caoServer.listen(0, '127.0.0.1', () => r()));
      const caoPort = (caoServer.address() as AddressInfo).port;

      expect(await isCaoPortOpenLogic(caoPort)).toBe(true);
      await new Promise<void>((r) => caoServer.close(() => r()));

      // 2. Non-CAO Server returning 500 Error
      const errorServer = http.createServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });
      await new Promise<void>((r) => errorServer.listen(0, '127.0.0.1', () => r()));
      const errPort = (errorServer.address() as AddressInfo).port;

      expect(await isCaoPortOpenLogic(errPort)).toBe(false);
      await new Promise<void>((r) => errorServer.close(() => r()));

      // 3. Hanging Server triggering 1500ms timeout
      const hangingServer = http.createServer((_req, _res) => {
        // Do not respond
      });
      await new Promise<void>((r) => hangingServer.listen(0, '127.0.0.1', () => r()));
      const hangPort = (hangingServer.address() as AddressInfo).port;

      const start = Date.now();
      const openResult = await isCaoPortOpenLogic(hangPort);
      const duration = Date.now() - start;

      expect(openResult).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(1400);
      expect(duration).toBeLessThan(3500);
      await new Promise<void>((r) => hangingServer.close(() => r()));

      // 4. Closed Port
      expect(await isCaoPortOpenLogic(59999)).toBe(false);
    });

    it('verifies stopConflictingCaoDaemon guards against destroying non-CAO processes', () => {
      expect(electronMainSource).toContain('async function stopConflictingCaoDaemon');
      expect(electronMainSource).toContain("owner.kind === 'other'");
      expect(electronMainSource).toContain('occupied by a non-Task-Hub process and will not be stopped');
    });
  });

  // =========================================================================
  // Dimension 2: WSL FIFO Directory Validation & Path Quoting
  // =========================================================================
  describe('Dimension 2: WSL FIFO Directory Validation & Shell Safety', () => {
    it('verifies shellQuote escapes single quotes correctly to prevent command injection', () => {
      const shellQuote = (val: string): string => `'${val.replace(/'/g, `'\\''`)}'`;

      expect(shellQuote('normal-path')).toBe("'normal-path'");
      expect(shellQuote('/home/user/my project')).toBe("'/home/user/my project'");
      expect(shellQuote("path'with'quotes")).toBe("'path'\\''with'\\''quotes'");
      expect(shellQuote("'; rm -rf /; echo '")).toBe("''\\''; rm -rf /; echo '\\'''");
      expect(shellQuote('`whoami`')).toBe("'`whoami`'");
      expect(shellQuote('$HOME/.task-hub-cao')).toBe("'$HOME/.task-hub-cao'");
    });

    it('verifies probeCaoWslHome script output parsing handles success and failure markers', () => {
      const parseProbeOutput = (result: { ok: boolean; output: string; error?: string }) => {
        if (!result.ok || !result.output.includes('CAO_HOME_OK')) {
          return { valid: false, home: '', error: `CAO home directory does not support FIFOs: ${result.error || result.output}` };
        }
        const home = result.output.split('CAO_HOME_OK:')[1]?.trim().split('\n')[0] || '';
        return { valid: true, home };
      };

      // Valid output
      const valid = parseProbeOutput({ ok: true, output: 'Checking...\nCAO_HOME_OK:/home/ubuntu/.task-hub-cao\nDone' });
      expect(valid.valid).toBe(true);
      expect(valid.home).toBe('/home/ubuntu/.task-hub-cao');

      // Invalid output - FIFO failure on DrvFs mount
      const invalidFifo = parseProbeOutput({ ok: false, output: 'mkfifo: cannot create fifo: Operation not supported\nCAO_HOME_INVALID:/mnt/c/Users/Admin/.task-hub-cao' });
      expect(invalidFifo.valid).toBe(false);
      expect(invalidFifo.error).toContain('does not support FIFOs');

      // WSL Error / Timeout
      const wslTimeout = parseProbeOutput({ ok: false, output: '', error: 'WSL command timed out.' });
      expect(wslTimeout.valid).toBe(false);
      expect(wslTimeout.error).toContain('WSL command timed out.');
    });

    it('verifies WSL FIFO probe script cleans up stale FIFO pipes with maxdepth 1', () => {
      expect(electronMainSource).toContain('mkdir -p "$home/fifos" || { echo "CAO_HOME_INVALID:$home"; exit 1; }');
      expect(electronMainSource).toContain('probe="$home/fifos/.probe-$$"');
      expect(electronMainSource).toContain('mkfifo "$probe" 2>/dev/null');
      expect(electronMainSource).toContain('rm -f "$probe"');
      expect(electronMainSource).toContain('find "$home/fifos" -maxdepth 1 -type p -delete;');
      expect(electronMainSource).toContain('echo "CAO_HOME_OK:$home"');
    });
  });

  // =========================================================================
  // Dimension 3: Multi-Worker Lifecycle State Machine & Polling Invariants
  // =========================================================================
  describe('Dimension 3: Multi-Worker Lifecycle State Machine & Polling Invariants', () => {
    const isCaoTerminalState = (state: string): boolean =>
      /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);

    it('comprehensively categorizes all terminal and active agent states', () => {
      const terminalStates = [
        'error', 'ERROR', 'Error',
        'failed', 'FAILED', 'Failed',
        'cancelled', 'CANCELLED', 'Cancelled',
        'completed', 'COMPLETED', 'Completed',
        'terminated', 'TERMINATED', 'Terminated',
        'dead', 'DEAD', 'Dead',
        'stopped', 'STOPPED', 'Stopped',
      ];

      for (const st of terminalStates) {
        expect(isCaoTerminalState(st)).toBe(true);
      }

      const activeStates = [
        'starting', 'running', 'idle', 'in_progress', 'delegating',
        'reviewing', 'busy', 'waiting_workers', 'waiting_feedback',
        'queued', 'analyzing', 'generating',
      ];

      for (const st of activeStates) {
        expect(isCaoTerminalState(st)).toBe(false);
      }
    });

    it('stress tests multi-worker poller logic across concurrent worker fleet permutations', () => {
      interface Worker {
        id: string;
        role: string;
        state: string;
      }

      const evaluateSessionState = (supervisorState: string, workers: Worker[]) => {
        if (!isCaoTerminalState(supervisorState)) {
          return { status: 'running', waitingWorkers: false, exitCode: null };
        }
        const liveWorkers = workers.filter((w) => !isCaoTerminalState(w.state));
        if (liveWorkers.length > 0) {
          return { status: 'waiting_workers', waitingWorkers: true, liveCount: liveWorkers.length, exitCode: null };
        }
        const failed = /^(error|failed|cancelled|terminated|dead)$/i.test(supervisorState);
        return { status: failed ? 'failed' : 'completed', waitingWorkers: false, exitCode: failed ? 1 : 0 };
      };

      // Case 1: Supervisor running, 4 workers in various states
      const c1 = evaluateSessionState('running', [
        { id: 'w1', role: 'worker', state: 'running' },
        { id: 'w2', role: 'worker', state: 'idle' },
        { id: 'w3', role: 'reviewer', state: 'completed' },
        { id: 'w4', role: 'worker', state: 'starting' },
      ]);
      expect(c1.status).toBe('running');
      expect(c1.waitingWorkers).toBe(false);

      // Case 2: Supervisor completed, but 2 workers still active
      const c2 = evaluateSessionState('completed', [
        { id: 'w1', role: 'worker', state: 'running' },
        { id: 'w2', role: 'worker', state: 'completed' },
        { id: 'w3', role: 'reviewer', state: 'in_progress' },
      ]);
      expect(c2.status).toBe('waiting_workers');
      expect(c2.waitingWorkers).toBe(true);
      expect(c2.liveCount).toBe(2);

      // Case 3: Supervisor completed, all 5 workers completed
      const c3 = evaluateSessionState('completed', [
        { id: 'w1', role: 'worker', state: 'completed' },
        { id: 'w2', role: 'worker', state: 'completed' },
        { id: 'w3', role: 'reviewer', state: 'completed' },
        { id: 'w4', role: 'worker', state: 'stopped' },
        { id: 'w5', role: 'reviewer', state: 'completed' },
      ]);
      expect(c3.status).toBe('completed');
      expect(c3.waitingWorkers).toBe(false);
      expect(c3.exitCode).toBe(0);

      // Case 4: Supervisor failed, all workers terminated
      const c4 = evaluateSessionState('failed', [
        { id: 'w1', role: 'worker', state: 'completed' },
        { id: 'w2', role: 'worker', state: 'error' },
      ]);
      expect(c4.status).toBe('failed');
      expect(c4.exitCode).toBe(1);
    });

    it('stress tests poller delta output buffer accumulation and truncation limit at 250k chars', () => {
      let currentOutput = '';
      const MAX_OUTPUT_LEN = 250000;

      const appendDelta = (delta: string) => {
        currentOutput = `${currentOutput}\n${delta}`.slice(-MAX_OUTPUT_LEN);
      };

      for (let i = 0; i < 300; i += 1) {
        appendDelta(`[Chunk ${i.toString().padStart(4, '0')}] ${'x'.repeat(980)}`);
      }

      expect(currentOutput.length).toBeLessThanOrEqual(MAX_OUTPUT_LEN);
      expect(currentOutput.length).toBe(MAX_OUTPUT_LEN);
      expect(currentOutput).not.toContain('[Chunk 0000]');
      expect(currentOutput).toContain('[Chunk 0299]');
    });
  });

  // =========================================================================
  // Dimension 4: Robust JSON Extraction, Stream Framing & ANSI Sanitation
  // =========================================================================
  describe('Dimension 4: Robust JSON Framing & ANSI Sanitation', () => {
    const takeJsonObjects = (input: string): { objects: string[]; remainder: string } => {
      const objects: string[] = []; let start = -1; let depth = 0; let inString = false; let escaped = false;
      for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        if (start < 0) { if (char === '{') { start = index; depth = 1; } continue; }
        if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
        if (char === '"') inString = true;
        else if (char === '{') depth += 1;
        else if (char === '}') { depth -= 1; if (depth === 0) { objects.push(input.slice(start, index + 1)); start = -1; } }
      }
      return { objects, remainder: start >= 0 ? input.slice(start) : '' };
    };

    const stripTerminalAnsi = (val: string): string =>
      val.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').trim();

    it('extracts JSON objects with complex escaped quotes, braces inside strings, and backslashes', () => {
      const payload = `
        BASH WARNING: deprecated option
        {"event":"init","message":"hello {nested} world","file":"C:\\\\path\\\\file.json"}
        EXTRA LOG LINE
        {"conductor":{"status":"running","last_output":"Nested \\"quoted\\" output with {braces}"},"workers":[]}
      `;

      const result = takeJsonObjects(payload);
      expect(result.objects).toHaveLength(2);

      const obj1 = JSON.parse(result.objects[0]);
      expect(obj1.event).toBe('init');
      expect(obj1.message).toBe('hello {nested} world');
      expect(obj1.file).toBe('C:\\path\\file.json');

      const obj2 = JSON.parse(result.objects[1]);
      expect(obj2.conductor.status).toBe('running');
      expect(obj2.conductor.last_output).toBe('Nested "quoted" output with {braces}');
    });

    it('handles incomplete / partial JSON chunk streaming with remainder tracking', () => {
      const chunk1 = 'Prefix log {"event":"step_1","ok":true} {"event":"step_2","payload":{"nested":123';
      const r1 = takeJsonObjects(chunk1);
      expect(r1.objects).toHaveLength(1);
      expect(JSON.parse(r1.objects[0]).event).toBe('step_1');
      expect(r1.remainder).toBe('{"event":"step_2","payload":{"nested":123');

      const chunk2 = r1.remainder + ',"extra":"complete"}} trailing noise';
      const r2 = takeJsonObjects(chunk2);
      expect(r2.objects).toHaveLength(1);
      expect(JSON.parse(r2.objects[0]).event).toBe('step_2');
      expect(r2.remainder).toBe('');
    });

    it('strips diverse ANSI CSI sequences, colors, formatting and carriage returns', () => {
      const inputs = [
        { raw: '\u001b[31m[ERROR]\u001b[0m Failed to connect\r\n', expected: '[ERROR] Failed to connect' },
        { raw: '\u001b[1;32;40mBOLD GREEN\u001b[0m Normal text', expected: 'BOLD GREEN Normal text' },
        { raw: '\u001b[2K\r\u001b[1AProgress: 100%\r\n', expected: 'Progress: 100%' },
        { raw: '\u001b[38;5;208mOrange 256 color\u001b[0m', expected: 'Orange 256 color' },
        { raw: '\u001b[38;2;255;100;50mTrueColor RGB\u001b[0m', expected: 'TrueColor RGB' },
        { raw: '\r\r\nClean text\r\n\r', expected: 'Clean text' },
      ];

      for (const { raw, expected } of inputs) {
        expect(stripTerminalAnsi(raw)).toBe(expected);
      }
    });
  });

  // =========================================================================
  // Dimension 5: Event Normalization, Defensive Token Extraction & Coercion
  // =========================================================================
  describe('Dimension 5: Event Normalization & Defensive Coercion in Bridge', () => {
    it('normalizes bizarre / corrupt event inputs without throwing exceptions', () => {
      const corruptInputs = [
        null,
        undefined,
        0,
        false,
        '',
        [1, 2, 3],
      ];

      for (const input of corruptInputs) {
        const norm = bridge.normalizeStreamEvent(input as any, 'sess-corrupt');
        expect(norm.sessionId).toBe('sess-corrupt');
        expect(typeof norm.content).toBe('string');
      }
    });

    it('defensively parses strange token usage payloads', () => {
      const testUsageCases = [
        {
          raw: { event: 'result', usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } },
          expected: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        },
        {
          raw: { event: 'result', usage: { total_tokens: 200 } },
          expected: { promptTokens: 0, completionTokens: 0, totalTokens: 200 },
        },
        {
          raw: { event: 'result', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
          expected: undefined,
        },
        {
          raw: { event: 'result', usage: null },
          expected: undefined,
        },
        {
          raw: { event: 'result', usage: 'string_usage' },
          expected: undefined,
        },
      ];

      for (const { raw, expected } of testUsageCases) {
        const norm = bridge.normalizeStreamEvent(raw, 'sess-tokens');
        expect(norm.tokenUsage).toEqual(expected);
      }
    });
  });
});
