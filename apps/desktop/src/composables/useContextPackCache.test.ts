import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContextPackCache } from './useContextPackCache';

// Mock localStorage for test environment
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = { localStorage: localStorageMock };
} else {
  globalThis.window.localStorage = localStorageMock as any;
}
(globalThis as any).localStorage = localStorageMock;

describe('useContextPackCache - Optimized Local Background Context Sync', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('initializes with empty cache and provides get/set operations', () => {
    const cache = useContextPackCache('test-scope-1');
    cache.invalidate();
    expect(cache.get(101)).toBeNull();

    const sampleContext = {
      version: 1,
      context_hash: 'hash-abc-123',
      work_item: { id: 101, title: 'Test Task' },
    };

    cache.set(101, sampleContext, '2026-08-25T10:00:00Z');

    const cached = cache.get(101);
    expect(cached).not.toBeNull();
    expect(cached?.taskId).toBe(101);
    expect(cached?.contextHash).toBe('hash-abc-123');
    expect(cached?.data.work_item.title).toBe('Test Task');
    expect(cached?.status).toBe('ready');
  });

  it('determines freshness based on TTL and task updated_at matching', () => {
    const cache = useContextPackCache('test-scope-2');
    const sampleContext = {
      context_hash: 'hash-xyz',
      work_item: { id: 202, title: 'Task 202' },
    };

    cache.set(202, sampleContext, '2026-08-25T10:00:00Z');

    // Fresh when updated_at matches and within TTL
    expect(cache.isFresh(202, '2026-08-25T10:00:00Z')).toBe(true);

    // Stale when hub updated_at has changed
    expect(cache.isFresh(202, '2026-08-25T10:05:00Z')).toBe(false);

    // Stale when expired past TTL
    expect(cache.isFresh(202, '2026-08-25T10:00:00Z', -1000)).toBe(false);
  });

  it('prefetches context pack in background and caches result', async () => {
    const cache = useContextPackCache('test-scope-3');
    const mockMcp = vi.fn().mockResolvedValue({
      data: {
        context_hash: 'hash-prefetched',
        work_item: { id: 303, title: 'Prefetched Task' },
      },
    });

    const result = await cache.prefetch(303, mockMcp, '2026-08-25T10:00:00Z');
    expect(mockMcp).toHaveBeenCalledWith('get_context_pack', { task_id: 303 });
    expect(result.work_item.title).toBe('Prefetched Task');

    // Subsequent call uses cached result without extra network call
    const cachedResult = await cache.prefetch(303, mockMcp, '2026-08-25T10:00:00Z');
    expect(mockMcp).toHaveBeenCalledTimes(1);
    expect(cachedResult.work_item.title).toBe('Prefetched Task');
  });

  it('prefetches a queue of runnable tasks in the background', async () => {
    const cache = useContextPackCache('test-scope-4');
    const mockMcp = vi.fn().mockImplementation((method, args) => Promise.resolve({
      data: {
        context_hash: `hash-${args.task_id}`,
        work_item: { id: args.task_id, title: `Task #${args.task_id}` },
      },
    }));

    const tasks = [
      { id: 1, status: 'in_progress', updated_at: '2026-08-25T10:00:00Z' },
      { id: 2, status: 'todo', updated_at: '2026-08-25T10:00:00Z' },
      { id: 3, status: 'done', updated_at: '2026-08-25T10:00:00Z' }, // will be skipped
    ];

    await cache.prefetchQueue(tasks, mockMcp);
    expect(mockMcp).toHaveBeenCalledWith('get_context_pack', { task_id: 1 });
    expect(mockMcp).toHaveBeenCalledWith('get_context_pack', { task_id: 2 });
    expect(mockMcp).not.toHaveBeenCalledWith('get_context_pack', { task_id: 3 });

    expect(cache.isReady(1)).toBe(true);
    expect(cache.isReady(2)).toBe(true);
    expect(cache.isReady(3)).toBe(false);
  });

  it('invalidates cache correctly for a single task or entire workspace', () => {
    const cache = useContextPackCache('test-scope-5');
    cache.set(10, { context_hash: '10' });
    cache.set(20, { context_hash: '20' });

    expect(cache.get(10)).not.toBeNull();
    expect(cache.get(20)).not.toBeNull();

    cache.invalidate(10);
    expect(cache.get(10)).toBeNull();
    expect(cache.get(20)).not.toBeNull();

    cache.invalidate();
    expect(cache.get(20)).toBeNull();
  });
});
