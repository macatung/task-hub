import { beforeEach, describe, expect, it, vi } from 'vitest';

const { heartbeat, dispatch } = vi.hoisted(() => ({
  heartbeat: { addActiveRunId: vi.fn(), removeActiveRunId: vi.fn() },
  dispatch: { relayEvent: vi.fn().mockResolvedValue(undefined), relayLog: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./index', () => ({
  defaultHeartbeatService: heartbeat,
  defaultRemoteDispatchService: dispatch,
}));

import { InteractiveRunReporter } from './interactiveRunReporter';

describe('InteractiveRunReporter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks the run and relays ordered interactive output', () => {
    const reporter = new InteractiveRunReporter();
    reporter.start(42);
    reporter.append('stdout', 'first');
    reporter.append('stderr', 'second');

    expect(heartbeat.addActiveRunId).toHaveBeenCalledWith(42);
    expect(dispatch.relayEvent).toHaveBeenCalledWith(42, 'interactive_started', 'running', { channel: 'control_center' });
    expect(dispatch.relayLog).toHaveBeenNthCalledWith(1, 42, 1, 'stdout', 'first');
    expect(dispatch.relayLog).toHaveBeenNthCalledWith(2, 42, 2, 'stderr', 'second');
  });

  it('ends the heartbeat lease and records a reviewable completion', () => {
    const reporter = new InteractiveRunReporter();
    reporter.start(9);
    reporter.finish('completed', { exit_code: 0 });

    expect(dispatch.relayEvent).toHaveBeenLastCalledWith(9, 'interactive_finished', 'waiting_input', { exit_code: 0 });
    expect(heartbeat.removeActiveRunId).toHaveBeenCalledWith(9);
  });
});
