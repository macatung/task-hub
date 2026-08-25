import { SSEStreamClient } from '@/services/sseStreamClient';
import { mockReactNativeSSE } from '../../jest.setup';

describe('SSEStreamClient (Tier 1, 2 & 3)', () => {
  beforeEach(() => {
    mockReactNativeSSE.__resetInstances();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Tier 1: Connection & Event Ingestion', () => {
    it('establishes SSE connection with correct Bearer header and parameters', () => {
      const onStateChange = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_ws_secret_123',
        workspaceId: 5,
        runId: 42,
        onStateChange,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      expect(instance).toBeDefined();
      expect(instance.url).toContain('http://localhost:8000/api/v1/tasks/agent-runs/stream');
      expect(instance.url).toContain('run_id=42');
      expect(instance.url).toContain('workspace_id=5');
      expect(instance.options?.headers?.Authorization).toBe('Bearer th_ws_secret_123');

      // Trigger open event
      instance.__emitOpen();
      expect(client.getState()).toBe('connected');
      expect(onStateChange).toHaveBeenCalledWith('connected');
    });

    it('parses structured agent-run status transition events and updates lastEventId cursor', () => {
      const onEvent = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      const eventPayload = {
        id: 105,
        run_id: 42,
        type: 'status_transition',
        status: 'running',
        occurred_at: '2026-08-25T07:00:00Z',
      };

      instance.__emitCustomEvent('agent-run', JSON.stringify(eventPayload));

      expect(onEvent).toHaveBeenCalledWith(eventPayload);
      expect(client.getLastEventId()).toBe(105);
    });

    it('parses agent-log streaming chunks and updates lastLogId cursor', () => {
      const onLog = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onLog,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      const logPayload = {
        id: 501,
        run_id: 42,
        stream: 'stdout',
        content: 'Running tests: 10 passed\n',
        occurred_at: '2026-08-25T07:01:00Z',
      };

      instance.__emitCustomEvent('agent-log', JSON.stringify(logPayload));

      expect(onLog).toHaveBeenCalledWith(logPayload);
      expect(client.getLastLogId()).toBe(501);
    });

    it('gracefully ignores keepalive heartbeat comments without crashing or firing callbacks', () => {
      const onEvent = jest.fn();
      const onLog = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent,
        onLog,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      instance.__emitCustomEvent('agent-run', ': keepalive');
      instance.__emitCustomEvent('agent-log', ': keepalive');

      expect(onEvent).not.toHaveBeenCalled();
      expect(onLog).not.toHaveBeenCalled();
    });

    it('parses generic message events containing log payloads', () => {
      const onLog = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onLog,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      const msg = {
        id: 602,
        stream: 'stderr',
        content: 'Warning: Deprecated API called\n',
      };
      instance.__emitMessage(JSON.stringify(msg));

      expect(onLog).toHaveBeenCalledWith(msg);
      expect(client.getLastLogId()).toBe(602);
    });
  });

  describe('Tier 2: Error Recovery, Backoff & Boundary Splitting', () => {
    it('schedules exponential backoff reconnect on network drop', () => {
      const onStateChange = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onStateChange,
      });

      const instance1 = mockReactNativeSSE.__getLastInstance();
      instance1.__emitOpen();
      expect(client.getState()).toBe('connected');

      // Simulate network error
      instance1.__emitError('Network connection lost', 0);
      expect(client.getState()).toBe('reconnecting');
      expect(client.getRetryCount()).toBe(1);

      // Advance timers by backoff interval (1500ms for retry 1)
      jest.advanceTimersByTime(1600);

      // New instance should be created for reconnect
      const instances = mockReactNativeSSE.__getInstances();
      expect(instances.length).toBe(2);
    });

    it('ignores malformed JSON chunks without throwing uncaught exceptions', () => {
      const onEvent = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // Emit broken json
      instance.__emitCustomEvent('agent-run', '{"id": 1, "unclosed_json:');
      expect(onEvent).not.toHaveBeenCalled();
    });

    it('disconnects cleanly and stops active reconnection timers', () => {
      const client = new SSEStreamClient();
      const disconnect = client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitError('Drop');

      // Call disconnect
      disconnect();
      expect(client.getState()).toBe('disconnected');

      // Advancing timer should NOT create new instance
      jest.advanceTimersByTime(5000);
      expect(mockReactNativeSSE.__getInstances().length).toBe(1);
    });

    it('invokes onError callback when EventSource emits error event', () => {
      const onError = jest.fn();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onError,
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitError('Unauthorized', 401);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorized',
          xhrStatus: 401,
        })
      );
    });
  });

  describe('Tier 3: Cursor Resumption & AppState Pause/Resume (Pairwise Integration)', () => {
    it('appends after and after_log query cursors when reconnecting after receiving events', () => {
      const client = new SSEStreamClient();
      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        runId: 99,
      });

      const instance1 = mockReactNativeSSE.__getLastInstance();
      instance1.__emitOpen();

      // Receive event id 204 and log id 880
      instance1.__emitCustomEvent('agent-run', JSON.stringify({ id: 204, run_id: 99, type: 'step' }));
      instance1.__emitCustomEvent('agent-log', JSON.stringify({ id: 880, run_id: 99, stream: 'stdout', content: 'hello' }));

      expect(client.getLastEventId()).toBe(204);
      expect(client.getLastLogId()).toBe(880);

      // Trigger error and advance backoff timer
      instance1.__emitError('Connection reset');
      jest.advanceTimersByTime(2000);

      const instance2 = mockReactNativeSSE.__getLastInstance();
      expect(instance2.url).toContain('after=204');
      expect(instance2.url).toContain('after_log=880');
      expect(instance2.url).toContain('run_id=99');
    });

    it('pauses connection when app enters background and resumes with cursors when returning to foreground', () => {
      const client = new SSEStreamClient({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        initialAfter: 50,
        initialAfterLog: 120,
      });

      client.connect();
      const instance1 = mockReactNativeSSE.__getLastInstance();
      instance1.__emitOpen();

      // App transitions to background
      client.pause();
      expect(client.getState()).toBe('disconnected');

      // App transitions to foreground
      client.resume();
      const instance2 = mockReactNativeSSE.__getLastInstance();
      expect(instance2.url).toContain('after=50');
      expect(instance2.url).toContain('after_log=120');
    });
  });
});
