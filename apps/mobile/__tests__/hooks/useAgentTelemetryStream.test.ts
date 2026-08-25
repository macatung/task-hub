import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAgentTelemetryStream } from '@/hooks/useAgentTelemetryStream';
import { SecureStorageService } from '@/services/secureStorage';
import { mockReactNativeSSE } from '../../jest.setup';

describe('useAgentTelemetryStream Hook (Milestone 5)', () => {
  beforeEach(async () => {
    mockReactNativeSSE.__resetInstances();
    jest.clearAllMocks();
    await SecureStorageService.saveToken('th_bearer_token');
    await SecureStorageService.saveConfig('api_url', 'http://localhost:8000');
    await SecureStorageService.saveConfig('workspace_id', '1');
  });

  afterEach(async () => {
    await SecureStorageService.clearAll();
  });

  it('initializes SSEStreamClient with token and workspace config and sets connected state on open', async () => {
    const { result } = renderHook(() =>
      useAgentTelemetryStream({ runId: 42, workspaceId: 1 })
    );

    // Allow async initStream to resolve storage reads
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const instance = mockReactNativeSSE.__getLastInstance();
    expect(instance).toBeDefined();
    expect(instance.url).toContain('run_id=42');
    expect(instance.options?.headers?.Authorization).toBe('Bearer th_bearer_token');

    // Simulate SSE open event
    act(() => {
      instance.__emitOpen();
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('ingests agent-run status transitions, stage/step starts, and verification evidence', async () => {
    const onTerminalStatus = jest.fn();
    const { result } = renderHook(() =>
      useAgentTelemetryStream({ runId: 42, onTerminalStatus })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const instance = mockReactNativeSSE.__getLastInstance();
    expect(instance).toBeDefined();
    act(() => {
      instance.__emitOpen();
    });

    // 1. Emit step_start
    act(() => {
      instance.__emitCustomEvent(
        'agent-run',
        JSON.stringify({
          id: 1,
          run_id: 42,
          type: 'step_start',
          status: 'running',
          payload: { name: 'Running automated test suite' },
          occurred_at: '2026-08-25T08:00:00Z',
        })
      );
    });

    expect(result.current.latestStatus).toBe('running');
    expect(result.current.latestStep).toBe('Running automated test suite');
    expect(result.current.events.length).toBe(1);

    // 2. Emit evidence
    act(() => {
      instance.__emitCustomEvent(
        'agent-run',
        JSON.stringify({
          id: 2,
          run_id: 42,
          type: 'evidence',
          status: 'needs_review',
          payload: {
            tests_passed: 120,
            tests_failed: 0,
            tests_total: 120,
            commit_sha: 'c0ffee1234',
          },
          occurred_at: '2026-08-25T08:05:00Z',
        })
      );
    });

    expect(result.current.latestStatus).toBe('needs_review');
    expect(result.current.evidence?.tests_passed).toBe(120);
    expect(onTerminalStatus).toHaveBeenCalledWith(
      'needs_review',
      expect.objectContaining({ type: 'evidence' })
    );
  });

  it('buffers and deduplicates streaming logs up to maxLogBufferSize', async () => {
    const { result } = renderHook(() =>
      useAgentTelemetryStream({ runId: 42, maxLogBufferSize: 3 })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const instance = mockReactNativeSSE.__getLastInstance();
    expect(instance).toBeDefined();
    act(() => {
      instance.__emitOpen();
    });

    // Emit 4 log lines (buffer size is 3)
    act(() => {
      instance.__emitCustomEvent(
        'agent-log',
        JSON.stringify({ id: 10, run_id: 42, stream: 'stdout', content: 'Line 1\n' })
      );
      instance.__emitCustomEvent(
        'agent-log',
        JSON.stringify({ id: 11, run_id: 42, stream: 'stdout', content: 'Line 2\n' })
      );
      instance.__emitCustomEvent(
        'agent-log',
        JSON.stringify({ id: 11, run_id: 42, stream: 'stdout', content: 'Duplicate line 2\n' })
      );
      instance.__emitCustomEvent(
        'agent-log',
        JSON.stringify({ id: 12, run_id: 42, stream: 'stdout', content: 'Line 3\n' })
      );
      instance.__emitCustomEvent(
        'agent-log',
        JSON.stringify({ id: 13, run_id: 42, stream: 'stdout', content: 'Line 4\n' })
      );
    });

    // Should have max 3 lines (11, 12, 13)
    expect(result.current.logs.length).toBe(3);
    expect(result.current.logs[0].id).toBe(11);
    expect(result.current.logs[2].id).toBe(13);

    // Test clearLogs
    act(() => {
      result.current.clearLogs();
    });
    expect(result.current.logs.length).toBe(0);
  });

  it('handles autoScroll state and toggling', () => {
    const { result } = renderHook(() =>
      useAgentTelemetryStream({ autoScrollDefault: true })
    );

    expect(result.current.autoScroll).toBe(true);

    act(() => {
      result.current.toggleAutoScroll();
    });
    expect(result.current.autoScroll).toBe(false);

    act(() => {
      result.current.setAutoScroll(true);
    });
    expect(result.current.autoScroll).toBe(true);
  });

  it('pauses stream on AppState background transition and resumes on active', async () => {
    let appStateCallback: any = null;
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: any, handler: any) => {
        appStateCallback = handler;
        return { remove: jest.fn() } as any;
      });

    const { result } = renderHook(() =>
      useAgentTelemetryStream({ runId: 42 })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const instance1 = mockReactNativeSSE.__getLastInstance();
    expect(instance1).toBeDefined();
    act(() => {
      instance1.__emitOpen();
    });
    expect(result.current.connectionState).toBe('connected');

    // Simulate backgrounding
    act(() => {
      appStateCallback('background');
    });
    expect(result.current.connectionState).toBe('disconnected');

    // Simulate returning to foreground
    act(() => {
      appStateCallback('active');
    });

    const instance2 = mockReactNativeSSE.__getLastInstance();
    expect(instance2).toBeDefined();

    addEventListenerSpy.mockRestore();
  });

  it('reconnects and disconnects explicitly on command', async () => {
    const { result } = renderHook(() =>
      useAgentTelemetryStream({ runId: 42 })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const instance1 = mockReactNativeSSE.__getLastInstance();
    expect(instance1).toBeDefined();
    act(() => {
      instance1.__emitOpen();
    });

    // Reconnect
    act(() => {
      result.current.reconnect();
    });

    const instance2 = mockReactNativeSSE.__getLastInstance();
    expect(instance2).toBeDefined();

    // Disconnect
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connectionState).toBe('disconnected');
  });
});
