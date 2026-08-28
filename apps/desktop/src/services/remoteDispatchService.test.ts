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
    await dispatchService.relayLog(88, 1, 'stdout', '[Architect] Surveying repository structure...', 'architect');
    await dispatchService.relayEvent(88, 'stage_context', 'running', { stage: 'context' }, 'architect', 'context', [{ id: 'tc-1', toolName: 'read_dir', status: 'completed' }]);
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
    }, 'tester');
    await dispatchService.relayHandoff(88, {
      summary: 'Completed task',
      changed_files: ['src/services/desktopHeartbeat.ts'],
      tests: [{ command: 'npm test', status: 'passed', summary: '35 passed' }],
    }, 'auditor');

    expect(mockFetch).toHaveBeenCalled();
    const urls = mockFetch.mock.calls.map((c: any) => c[0]);

    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/logs');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/events');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/evidence');
    expect(urls).toContain('http://localhost:8000/api/v1/agent-runs/88/handoff');

    // Check payload serialization
    const logCall = mockFetch.mock.calls.find((c: any) => c[0].endsWith('/logs'));
    const logBody = JSON.parse(logCall[1].body);
    expect(logBody.role).toBe('architect');
    expect(logBody.content).toContain('[Architect]');

    const eventCall = mockFetch.mock.calls.find((c: any) => c[0].endsWith('/events'));
    const eventBody = JSON.parse(eventCall[1].body);
    expect(eventBody.role).toBe('architect');
    expect(eventBody.stage).toBe('context');
    expect(eventBody.tool_calls).toHaveLength(1);
    expect(eventBody.tool_calls[0].toolName).toBe('read_dir');

    const evidenceCall = mockFetch.mock.calls.find((c: any) => c[0].endsWith('/evidence'));
    const evidenceBody = JSON.parse(evidenceCall[1].body);
    expect(evidenceBody.role).toBe('tester');
    expect(evidenceBody.metadata.role).toBe('tester');

    const handoffCall = mockFetch.mock.calls.find((c: any) => c[0].endsWith('/handoff'));
    const handoffBody = JSON.parse(handoffCall[1].body);
    expect(handoffBody.role).toBe('auditor');
  });

  it('relays role stage execution and inter-agent context packages', async () => {
    await dispatchService.relayRoleStage(88, {
      role: 'implementer',
      title: 'Core Implementer',
      avatar: 'IM',
      badge: 'DEVELOPER',
      model: 'gemini-3.7-flash',
      status: 'running',
      terminalLogs: ['Modifying files...'],
      toolCalls: [{ id: 'tc-2', toolName: 'file_edit', status: 'completed' }],
    });

    await dispatchService.relayContextPackage(88, {
      sourceRole: 'architect',
      targetRole: 'implementer',
      taskId: '105',
      runId: '88',
      planContent: '### Plan for TASK-105',
      modifiedFiles: ['src/index.ts'],
      timestamp: new Date().toISOString(),
    });

    const eventCalls = mockFetch.mock.calls.filter((c: any) => c[0].endsWith('/events'));
    expect(eventCalls.length).toBeGreaterThanOrEqual(2);

    const roleStageCall = eventCalls.find((c: any) => JSON.parse(c[1].body).event_type === 'role_implementer_running');
    expect(roleStageCall).toBeDefined();
    const roleStageBody = JSON.parse(roleStageCall[1].body);
    expect(roleStageBody.role).toBe('implementer');
    expect(roleStageBody.tool_calls).toHaveLength(1);
    expect(roleStageBody.tool_calls[0].toolName).toBe('file_edit');

    const contextPkgCall = eventCalls.find((c: any) => JSON.parse(c[1].body).event_type === 'context_handoff');
    expect(contextPkgCall).toBeDefined();
    const contextPkgBody = JSON.parse(contextPkgCall[1].body);
    expect(contextPkgBody.role).toBe('architect');
    expect(contextPkgBody.payload.context_package.targetRole).toBe('implementer');
    expect(contextPkgBody.payload.context_package.taskId).toBe('105');
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
