import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useTaskSync,
  invalidateTaskMemoryCache,
  getTaskMemoryCacheSnapshot,
  TASK_CACHE_STALE_TTL_MS,
  type TaskItem,
} from '../useTaskSync';

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

describe('useTaskSync - Two-Tier Caching & SWR Synchronization', () => {
  const mockTasks: TaskItem[] = [
    {
      id: 101,
      project_id: 1,
      title: 'Task 1: Setup schema',
      description: null,
      status: 'todo',
      priority: 'high',
      category: 'backend',
      estimated_pomodoros: 2,
      completed_pomodoros: 0,
      due_date: '2026-08-28',
      completed_at: null,
    },
    {
      id: 102,
      project_id: 1,
      title: 'Task 2: Implement endpoint',
      description: null,
      status: 'in_progress',
      priority: 'medium',
      category: 'backend',
      estimated_pomodoros: 3,
      completed_pomodoros: 1,
      due_date: '2026-08-28',
      completed_at: null,
    },
  ];

  beforeEach(() => {
    localStorageMock.clear();
    invalidateTaskMemoryCache();
    vi.restoreAllMocks();
  });

  it('populates memory cache and returns cached data instantly on repeated calls within stale window', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({ success: true, data: mockTasks }),
      };
    }) as any;

    const sync = useTaskSync();
    sync.credential.value = {
      taskHubUrl: 'https://test.task-hub.dev',
      token: 'test-token',
      projectId: 'project-1',
    };

    // First call: triggers real fetch
    const ok1 = await sync.fetchAgentTasks();
    expect(ok1).toBe(true);
    expect(fetchCount).toBe(1);
    expect(sync.agentTasks.value.length).toBe(2);

    // Snapshot exists in memory cache
    const snapshot = getTaskMemoryCacheSnapshot('project-1');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.tasks.length).toBe(2);

    // Second call: within 8s stale window -> returns immediately from memory cache without network call
    const ok2 = await sync.fetchAgentTasks();
    expect(ok2).toBe(true);
    expect(fetchCount).toBe(1); // No new network request!

    // Third call with forceRefresh: true -> ignores cache and makes network request
    const ok3 = await sync.fetchAgentTasks({ forceRefresh: true });
    expect(ok3).toBe(true);
    expect(fetchCount).toBe(2);
  });

  it('deduplicates multiple concurrent in-flight requests to a single HTTP call', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        json: async () => ({ success: true, data: mockTasks }),
      };
    }) as any;

    const sync = useTaskSync();
    sync.credential.value = {
      taskHubUrl: 'https://test.task-hub.dev',
      token: 'test-token',
      projectId: 'project-1',
    };

    // Fire 5 simultaneous requests
    const [r1, r2, r3, r4, r5] = await Promise.all([
      sync.fetchAgentTasks({ forceRefresh: true }),
      sync.fetchAgentTasks({ forceRefresh: true }),
      sync.fetchAgentTasks({ forceRefresh: true }),
      sync.fetchAgentTasks({ forceRefresh: true }),
      sync.fetchAgentTasks({ forceRefresh: true }),
    ]);

    expect(r1 && r2 && r3 && r4 && r5).toBe(true);
    expect(fetchCount).toBe(1); // Deduplicated to exactly 1 request!
  });

  it('re-fetches after stale window (TASK_CACHE_STALE_TTL_MS) has elapsed', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({ success: true, data: mockTasks }),
      };
    }) as any;

    const sync = useTaskSync();
    sync.credential.value = {
      taskHubUrl: 'https://test.task-hub.dev',
      token: 'test-token',
      projectId: 'project-1',
    };

    await sync.fetchAgentTasks();
    expect(fetchCount).toBe(1);

    // Manually age the memory cache snapshot by 10 seconds
    const snapshot = getTaskMemoryCacheSnapshot('project-1');
    if (snapshot) {
      snapshot.fetchedAt = Date.now() - (TASK_CACHE_STALE_TTL_MS + 2000);
    }

    // Now a non-forced fetchAgentTasks will trigger a fresh fetch
    await sync.fetchAgentTasks();
    expect(fetchCount).toBe(2);
  });

  it('immediately updates cache and persists on updateTaskStatus mutation', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { ...mockTasks[0], status: body.status },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockTasks }),
      };
    }) as any;

    const sync = useTaskSync();
    sync.credential.value = {
      taskHubUrl: 'https://test.task-hub.dev',
      token: 'test-token',
      projectId: 'project-1',
    };

    await sync.fetchAgentTasks();
    expect(sync.tasks.value[0].status).toBe('todo');

    // Mutate status to in_progress
    await sync.updateTaskStatus(sync.tasks.value[0], 'in_progress');

    // Cache should immediately reflect the mutation
    const snapshot = getTaskMemoryCacheSnapshot('project-1');
    expect(snapshot?.tasks[0].status).toBe('in_progress');

    // LocalStorage should also be updated
    const saved = localStorageMock.getItem('task_hub_desktop_synced_tasks:project-1');
    expect(saved).toContain('in_progress');
  });

  it('restores tasks from LocalStorage when memory cache is cold', () => {
    localStorageMock.setItem(
      'task_hub_desktop_synced_tasks:project-1',
      JSON.stringify(mockTasks),
    );

    const sync = useTaskSync();
    sync.credential.value = {
      taskHubUrl: 'https://test.task-hub.dev',
      token: 'test-token',
      projectId: 'project-1',
    };

    // Before any network fetch, loadLocalCache should populate agentTasks and memory cache
    sync.loadLocalCache();
    expect(sync.tasks.value.length).toBe(2);
    expect(sync.agentTasks.value.length).toBe(2);

    const snapshot = getTaskMemoryCacheSnapshot('project-1');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.tasks.length).toBe(2);
  });
});
