import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DesktopHeartbeatService, type DispatchCommand, type HeartbeatResponse } from './desktopHeartbeat';

describe('DesktopHeartbeatService', () => {
  let mockFetch: any;
  let service: DesktopHeartbeatService;

  beforeEach(() => {
    mockFetch = vi.fn();
    service = new DesktopHeartbeatService({
      baseUrl: 'http://localhost:8000',
      token: 'test-token-123',
      intervalMs: 10000,
      clientId: 'test-client-uuid-001',
      fetchFn: mockFetch,
    });
  });

  afterEach(() => {
    service.stop();
  });

  it('gathers valid workstation telemetry and builds heartbeat payload', () => {
    const telemetry = service.getTelemetry();

    expect(telemetry.client_id).toBe('test-client-uuid-001');
    expect(telemetry.name).toBeDefined();
    expect(telemetry.hostname).toBeDefined();
    expect(['win32', 'darwin', 'linux']).toContain(telemetry.platform);
    expect(telemetry.active_providers).toContain('antigravity');
    expect(telemetry.quota_metrics).toBeDefined();
    expect(telemetry.status).toBe('idle');
  });

  it('sends POST /api/v1/desktop/agents/heartbeat with Bearer token and updates ping latency', async () => {
    const mockResponse: HeartbeatResponse = {
      success: true,
      health: 'online',
      server_time: new Date().toISOString(),
      commands: [
        {
          type: 'ping_ack',
          command_id: 'cmd-ping-1',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await service.sendHeartbeat();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('http://localhost:8000/api/v1/desktop/agents/heartbeat');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Authorization']).toBe('Bearer test-token-123');

    const sentBody = JSON.parse(calledOptions.body);
    expect(sentBody.client_id).toBe('test-client-uuid-001');
    expect(sentBody.status).toBe('idle');

    expect(result).toEqual(mockResponse);
    expect(service.isOnline()).toBe(true);
    expect(service.getLastPingLatency()).toBeGreaterThanOrEqual(0);
  });

  it('dispatches incoming commands to registered listeners', async () => {
    const dispatchCmd: DispatchCommand = {
      type: 'remote_dispatch',
      command_id: 'cmd-dispatch-42',
      run_id: 101,
      task_id: 202,
      issue_key: 'TASK-202',
      mode: 'auto_pilot',
      provider: 'antigravity',
      model: 'gemini-3.7-flash',
      instruction: 'Implement feature X',
    };

    const cancelCmd: DispatchCommand = {
      type: 'cancel_run',
      command_id: 'cmd-cancel-99',
      run_id: 101,
      task_id: 202,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        health: 'online',
        server_time: new Date().toISOString(),
        commands: [dispatchCmd, cancelCmd],
      }),
    });

    const receivedDispatches: DispatchCommand[] = [];
    const receivedCancels: DispatchCommand[] = [];
    const allCommands: DispatchCommand[] = [];

    service.onDispatch((cmd) => receivedDispatches.push(cmd));
    service.onCancel((cmd) => receivedCancels.push(cmd));
    service.onCommand((cmd) => allCommands.push(cmd));

    await service.sendHeartbeat();

    expect(allCommands).toHaveLength(2);
    expect(receivedDispatches).toHaveLength(1);
    expect(receivedDispatches[0].command_id).toBe('cmd-dispatch-42');
    expect(receivedCancels).toHaveLength(1);
    expect(receivedCancels[0].command_id).toBe('cmd-cancel-99');
  });

  it('tracks active run IDs and updates status to busy', () => {
    expect(service.getTelemetry().status).toBe('idle');

    service.addActiveRunId(101);
    expect(service.getActiveRunIds()).toContain(101);
    expect(service.getTelemetry().status).toBe('busy');
    expect(service.getTelemetry().active_run_ids).toEqual([101]);

    service.removeActiveRunId(101);
    expect(service.getActiveRunIds()).toHaveLength(0);
    expect(service.getTelemetry().status).toBe('idle');
  });
});
