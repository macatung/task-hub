import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMcpOutbox, saveMcpOutbox, useMcpOutbox } from '../useMcpOutbox';

// Mock localStorage for node test environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};
(globalThis as any).localStorage = localStorageMock;
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { localStorage: localStorageMock };
} else {
  (globalThis as any).window.localStorage = localStorageMock;
}

describe('useMcpOutbox - Persistent Offline MCP Queue & Auto-Replay', () => {
  beforeEach(() => {
    localStorageMock.clear();
    saveMcpOutbox([], 'project-101');
  });

  it('enqueues MCP call to memory and persists in LocalStorage', () => {
    const outbox = useMcpOutbox(() => 'project-101');
    expect(outbox.pendingCount.value).toBe(0);

    const item = outbox.enqueue(
      'complete_auto_approved_handoff',
      { run_id: 1234, summary: 'Task verified' },
      { taskId: 2, runId: 1234, description: 'Complete TH-2' }
    );

    expect(item.id).toMatch(/^mcp-/);
    expect(item.name).toBe('complete_auto_approved_handoff');
    expect(outbox.pendingCount.value).toBe(1);

    // Verify localStorage persistence
    const raw = localStorageMock.getItem('task_hub_desktop_mcp_outbox:project-101');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('complete_auto_approved_handoff');
    expect(parsed[0].targetTaskId).toBe(2);
  });

  it('replays queued MCP calls in FIFO order upon network reconnection', async () => {
    const outbox = useMcpOutbox(() => 'project-101');
    outbox.enqueue('attach_verification_evidence', { run_id: 1, command: 'npm test' }, { taskId: 10 });
    outbox.enqueue('complete_auto_approved_handoff', { run_id: 1, summary: 'Handoff 1' }, { taskId: 10 });
    outbox.enqueue('attach_verification_evidence', { run_id: 2, command: 'npm test' }, { taskId: 11 });

    expect(outbox.pendingCount.value).toBe(3);

    const mockMcp = vi.fn().mockResolvedValue({ success: true });

    const result = await outbox.replay(mockMcp);

    expect(result.processed).toBe(3);
    expect(result.remaining).toBe(0);
    expect(outbox.pendingCount.value).toBe(0);
    expect(mockMcp).toHaveBeenCalledTimes(3);
    expect(mockMcp.mock.calls[0][0]).toBe('attach_verification_evidence');
    expect(mockMcp.mock.calls[1][0]).toBe('complete_auto_approved_handoff');
    expect(mockMcp.mock.calls[2][0]).toBe('attach_verification_evidence');

    // Storage is cleared
    expect(loadMcpOutbox('project-101')).toHaveLength(0);
  });

  it('handles transient errors with retry and pauses replay on network failure', async () => {
    const outbox = useMcpOutbox(() => 'project-101');
    outbox.enqueue('complete_auto_approved_handoff', { run_id: 1 }, { taskId: 1 });
    outbox.enqueue('complete_auto_approved_handoff', { run_id: 2 }, { taskId: 2 });

    const mockMcp = vi.fn().mockRejectedValue(new Error('Task Hub request to /mcp timed out after 8s.'));

    const result = await outbox.replay(mockMcp);

    expect(result.processed).toBe(0);
    expect(result.remaining).toBe(2);
    expect(outbox.pendingCount.value).toBe(2);

    const current = loadMcpOutbox('project-101');
    expect(current[0].retries).toBe(1);
    expect(current[0].lastError).toContain('timed out');
  });

  it('drops malformed item after 5 failed retries to avoid poisoning the queue', async () => {
    const outbox = useMcpOutbox(() => 'project-101');
    const item = outbox.enqueue('invalid_tool', { bad_payload: true }, { taskId: 99 });
    item.retries = 4;
    saveMcpOutbox([item], 'project-101');

    const mockMcp = vi.fn().mockRejectedValue(new Error('HTTP 400 Bad Request'));

    const result = await outbox.replay(mockMcp);

    expect(result.processed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(outbox.pendingCount.value).toBe(0);
    expect(loadMcpOutbox('project-101')).toHaveLength(0);
  });
});
