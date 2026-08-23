import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteDispatchService } from './remoteDispatchService';
import { DesktopHeartbeatService, type DispatchCommand } from './desktopHeartbeat';

describe('RemoteDispatchService', () => {
  let mockFetch: any;
  let heartbeatService: DesktopHeartbeatService;
  let dispatchService: RemoteDispatchService;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    heartbeatService = new DesktopHeartbeatService({
      baseUrl: 'http://localhost:8000',
      token: 'test-token-123',
      fetchFn: mockFetch,
    });

    dispatchService = new RemoteDispatchService({
      baseUrl: 'http://localhost:8000',
      token: 'test-token-123',
      heartbeatService,
      fetchFn: mockFetch,
      autoPilotConfig: {
        autoRepairOnPreflightFailure: true,
      },
    });
  });

  afterEach(() => {
    dispatchService.destroy();
    heartbeatService.stop();
  });

  it('ingests remote_dispatch command and launches Auto-Pilot execution', async () => {
    const cmd: DispatchCommand = {
      type: 'remote_dispatch',
      command_id: 'cmd-remote-1',
      run_id: 88,
      task_id: 105,
      issue_key: 'TASK-105',
      title: 'Auto-pilot implementation',
      description: 'Implement remote dispatch relay',
      mode: 'auto_pilot',
      provider: 'antigravity',
      model: 'gemini-3.7-flash',
      instruction: 'Autonomous execution mode',
      dispatched_at: new Date(Date.now() - 50).toISOString(),
    };

    const result = await dispatchService.handleCommand(cmd);

    expect(result).toBeDefined();
    expect(result?.success).toBe(true);

    const history = dispatchService.getExecutionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].commandId).toBe('cmd-remote-1');
    expect(history[0].runId).toBe(88);
    expect(history[0].taskId).toBe(105);
    expect(history[0].issueKey).toBe('TASK-105');
    expect(history[0].status).toBe('completed');
    expect(history[0].dispatchLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('relays logs, events, test evidence, and diff handoffs to Hub endpoints', async () => {
    await dispatchService.relayLog(88, 1, 'stdout', 'Auto-Pilot started');
    await dispatchService.relayEvent(88, 'test_started', 'running', { test: 'suite' });
    await dispatchService.relayEvidence(88, {
      evidence_type: 'automated_test',
      status: 'passed',
      command: 'npm test',
      summary: '35 passed',
      metadata: {
        total_tests: 35,
        passed: 35,
        failed: 0,
        skipped: 0,
        duration_ms: 1200,
        runner: 'vitest',
        timestamp: new Date().toISOString(),
      },
    });
    await dispatchService.relayHandoff(88, {
      summary: 'Completed task',
      changed_files: ['src/services/desktopHeartbeat.ts'],
      tests: [{ command: 'npm test', status: 'passed', summary: '35 passed' }],
    });

    expect(mockFetch).toHaveBeenCalled();
    const urls = mockFetch.mock.calls.map((c: any) => c[0]);

    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/logs');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/events');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/evidence');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/handoff');
  });

  it('handles cancellation commands for active runs', async () => {
    const cancelCmd: DispatchCommand = {
      type: 'cancel_run',
      command_id: 'cmd-cancel-1',
      run_id: 88,
      task_id: 105,
    };

    await expect(dispatchService.handleCancelCommand(cancelCmd)).resolves.not.toThrow();
  });
});
