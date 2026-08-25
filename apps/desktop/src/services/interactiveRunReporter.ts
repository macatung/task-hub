import { defaultHeartbeatService, defaultRemoteDispatchService } from './index';

/** Reports supervised Control Center sessions through the same Hub endpoints
 * used by remote dispatch. Rendering remains the responsibility of the view. */
export class InteractiveRunReporter {
  private runId: number | null = null;
  private sequence = 0;

  start(runId: number) {
    this.runId = runId;
    this.sequence = 0;
    defaultHeartbeatService.addActiveRunId(runId);
    void defaultRemoteDispatchService.relayEvent(runId, 'interactive_started', 'running', { channel: 'control_center' });
  }

  append(stream: string, content: string) {
    if (!this.runId || !content) return;
    this.sequence += 1;
    void defaultRemoteDispatchService.relayLog(this.runId, this.sequence, stream || 'stdout', content);
  }

  finish(status: 'completed' | 'failed' | 'cancelled', payload: Record<string, unknown> = {}) {
    if (!this.runId) return;
    const runId = this.runId;
    void defaultRemoteDispatchService.relayEvent(runId, 'interactive_finished', status === 'completed' ? 'waiting_input' : status, payload);
    defaultHeartbeatService.removeActiveRunId(runId);
    this.runId = null;
  }

  reset() {
    if (this.runId) defaultHeartbeatService.removeActiveRunId(this.runId);
    this.runId = null;
    this.sequence = 0;
  }
}
