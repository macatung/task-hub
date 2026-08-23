import { describe, it, expect, vi } from 'vitest';
import { AutoPilotRunner } from './autoPilotRunner';
import { useAutoPilotStore } from '../stores/useAutoPilotStore';

describe('Autonomous Task Auto-Pilot Execution Loop', () => {
  const createMockDesktopApi = (overrides: Record<string, any> = {}) => ({
    agent: {
      listWorkspaces: vi.fn().mockResolvedValue(['/mock/workspace']),
      preflight: vi.fn().mockResolvedValue({
        ok: true,
        repository: '/mock/workspace',
        checks: [{ id: 'cli', status: 'passed', message: 'Antigravity CLI available.' }],
      }),
      repairEnvironment: vi.fn().mockResolvedValue({
        ok: true,
        checks: [{ id: 'env', status: 'passed', message: 'Created .env' }],
        preflight: { ok: true, repository: '/mock/workspace', checks: [] },
      }),
      createWorktree: vi.fn().mockResolvedValue({
        path: '/mock/worktree/TASK-101',
        branch: 'codex/TASK-101',
      }),
      configureMcp: vi.fn().mockResolvedValue(true),
      startInteractive: vi.fn().mockResolvedValue({
        sessionId: 'session-mock-123',
        mode: 'internal',
      }),
      listFiles: vi.fn().mockResolvedValue(['src/index.ts']),
      readFile: vi.fn().mockResolvedValue('export const hello = "world";'),
      runTest: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Test Files 5 passed (5)\nTests 35 passed (35)\nDuration 1.2s',
        stderr: '',
        durationMs: 1200,
      }),
      getGitDiff: vi.fn().mockResolvedValue({
        numstat: '25\t5\tsrc/index.ts',
        diffs: [{ path: 'src/index.ts', additions: 25, deletions: 5 }],
      }),
      stop: vi.fn().mockResolvedValue(true),
      ...overrides.agent,
    },
    taskHub: {
      mcpCall: vi.fn().mockImplementation((_url, _token, _proj, method, params) => {
        if (params?.name === 'get_context_pack') {
          return Promise.resolve({ repository: '/mock/workspace', branch: 'main' });
        }
        if (params?.name === 'start_agent_run') {
          return Promise.resolve({ success: true, data: { id: 42 } });
        }
        if (params?.name === 'attach_evidence') {
          return Promise.resolve({ success: true });
        }
        if (params?.name === 'complete_agent_handoff') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
      ...overrides.taskHub,
    },
  });

  it('executes full 7-stage Auto-Pilot cycle to completion', async () => {
    const mockApi = createMockDesktopApi();
    const stageSequence: string[] = [];
    const stepUpdates: any[] = [];

    const runner = new AutoPilotRunner({
      desktopApi: mockApi,
      taskHubUrl: 'https://hub.example.com',
      token: 'secret-token',
      projectId: '1',
      provider: 'antigravity',
      model: 'gemini-3.7-flash',
      onStageChange: (stg) => stageSequence.push(stg),
      onStepChange: (step) => stepUpdates.push({ id: step.id, status: step.status }),
    });

    const result = await runner.start({
      id: 101,
      issue_key: 'TASK-101',
      title: 'Upgrade Auto-Pilot Execution Flow',
      description: 'Implement autonomous execution loop.',
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe('completed');
    expect(result.runId).toBe(42);
    expect(result.sessionId).toBe('session-mock-123');
    expect(result.worktreePath).toBe('/mock/worktree/TASK-101');

    // Verify all 7 steps completed
    const history = result.stepHistory;
    expect(history.length).toBe(7);
    for (const step of history) {
      expect(step.status, `Step ${step.id} should be completed`).toBe('completed');
    }

    // Verify evidence & handoff payloads
    expect(result.evidence).toBeDefined();
    expect(result.evidence?.evidence_type).toBe('automated_test');
    expect(result.evidence?.status).toBe('passed');
    expect(result.evidence?.metadata.total_tests).toBe(35);

    expect(result.handoff).toBeDefined();
    expect(result.handoff?.changed_files).toContain('src/index.ts');
    expect(result.handoff?.tests[0].status).toBe('passed');

    // Verify stage sequence
    expect(stageSequence).toEqual([
      'preflight',
      'worktree',
      'context',
      'executing',
      'waiting_input',
      'testing',
      'handoff',
      'completed',
    ]);
  });

  it('triggers environment auto-repair when preflight checks fail initially', async () => {
    let preflightAttempts = 0;
    const mockPreflight = vi.fn().mockImplementation(() => {
      preflightAttempts++;
      if (preflightAttempts === 1) {
        return Promise.resolve({
          ok: false,
          repository: '/mock/workspace',
          checks: [{ id: 'env', status: 'failed', message: 'Missing .env file' }],
        });
      }
      return Promise.resolve({
        ok: true,
        repository: '/mock/workspace',
        checks: [{ id: 'env', status: 'passed', message: '.env restored' }],
      });
    });

    const mockRepair = vi.fn().mockResolvedValue({
      ok: true,
      checks: [{ id: 'env', status: 'passed', message: 'Restored from .env.example' }],
      preflight: { ok: true, repository: '/mock/workspace', checks: [] },
    });

    const mockApi = createMockDesktopApi({
      agent: {
        preflight: mockPreflight,
        repairEnvironment: mockRepair,
      },
    });

    const runner = new AutoPilotRunner({
      desktopApi: mockApi,
      autoRepairOnPreflightFailure: true,
    });

    const result = await runner.start({
      issue_key: 'TASK-102',
      title: 'Auto Repair Test',
    });

    expect(mockRepair).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.stage).toBe('completed');
  });

  it('intercepts merge conflicts into waiting_input and proceeds upon approval', async () => {
    const conflictedCode = `
<<<<<<< HEAD
const theme = 'dark';
=======
const theme = 'light';
>>>>>>> branch-x
`;
    const mockApi = createMockDesktopApi({
      agent: {
        listFiles: vi.fn().mockResolvedValue(['src/theme.ts']),
        readFile: vi.fn().mockResolvedValue(conflictedCode),
      },
    });

    let interceptedAlert: any = null;
    const runner = new AutoPilotRunner({
      desktopApi: mockApi,
      onSafetyAlert: (alert) => {
        interceptedAlert = alert;
      },
    });

    // Start execution asynchronously
    const startPromise = runner.start({
      issue_key: 'TASK-103',
      title: 'Safety Intercept Test',
    });

    // Wait for the state machine to transition to waiting_input
    await new Promise((r) => setTimeout(r, 20));

    expect(runner.getStage()).toBe('waiting_input');
    expect(interceptedAlert).toBeDefined();
    expect(interceptedAlert.status).toBe('waiting_input');
    expect(interceptedAlert.category).toBe('conflict');
    expect(interceptedAlert.requiresApproval).toBe(true);

    // Developer approves the alert
    runner.approveSafetyAlert(interceptedAlert.eventId);

    const result = await startPromise;
    expect(result.success).toBe(true);
    expect(result.stage).toBe('completed');
  });

  it('halts execution when safety alert is rejected by developer', async () => {
    const conflictedCode = `
<<<<<<< HEAD
const x = 1;
=======
const x = 2;
>>>>>>> branch-y
`;
    const mockApi = createMockDesktopApi({
      agent: {
        listFiles: vi.fn().mockResolvedValue(['src/x.ts']),
        readFile: vi.fn().mockResolvedValue(conflictedCode),
      },
    });

    let interceptedAlert: any = null;
    const runner = new AutoPilotRunner({
      desktopApi: mockApi,
      onSafetyAlert: (alert) => {
        interceptedAlert = alert;
      },
    });

    const startPromise = runner.start({
      issue_key: 'TASK-104',
      title: 'Safety Rejection Test',
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(runner.getStage()).toBe('waiting_input');
    expect(interceptedAlert).toBeDefined();

    // Developer rejects the alert
    runner.rejectSafetyAlert(interceptedAlert.eventId, 'Cannot resolve conflict automatically');

    const result = await startPromise;
    expect(result.success).toBe(false);
    expect(result.stage).toBe('failed');
    expect(result.error).toContain('rejected');
  });

  it('supports cancellation during execution', async () => {
    const mockApi = createMockDesktopApi({
      agent: {
        startInteractive: vi.fn().mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 100));
          return { sessionId: 'sess-long' };
        }),
      },
    });

    const runner = new AutoPilotRunner({ desktopApi: mockApi });
    const startPromise = runner.start({
      issue_key: 'TASK-105',
      title: 'Cancellation Test',
    });

    await new Promise((r) => setTimeout(r, 15));
    await runner.cancel();

    const result = await startPromise;
    expect(result.success).toBe(false);
    expect(result.stage).toBe('cancelled');
  });

  describe('useAutoPilotStore composable', () => {
    it('manages reactive store lifecycle and calculations', async () => {
      const store = useAutoPilotStore();
      store.reset();

      expect(store.isRunning.value).toBe(false);
      expect(store.currentStage.value).toBe('idle');
      expect(store.progressPercent.value).toBe(0);

      const mockApi = createMockDesktopApi();
      const runPromise = store.startAutoPilot(
        {
          issue_key: 'TASK-106',
          title: 'Store Test',
        },
        { desktopApi: mockApi }
      );

      expect(store.isRunning.value).toBe(true);
      const result = await runPromise;

      expect(result.success).toBe(true);
      expect(store.isRunning.value).toBe(false);
      expect(store.currentStage.value).toBe('completed');
      expect(store.progressPercent.value).toBe(100);
      expect(store.lastEvidence.value).toBeDefined();
      expect(store.lastHandoff.value).toBeDefined();
    });
  });
});
