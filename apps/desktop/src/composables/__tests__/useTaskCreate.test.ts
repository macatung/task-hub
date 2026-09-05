import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskSync } from '../useTaskSync';

// Mock localStorage
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

describe('useTaskSync - createTask resilience', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('creates task successfully when passed an object payload (Simple Mode)', async () => {
    const sync = useTaskSync();
    sync.projects.value = [{ id: 42, title: 'Test Project', slug: 'test-project' }];

    const created = await sync.createTask({
      title: 'Soạn thảo kế hoạch tuần mới',
      priority: 'high',
      project_id: null, // should auto-resolve to first available project
      due_date: '2026-09-05',
    });

    expect(created).not.toBeNull();
    expect(created?.title).toBe('Soạn thảo kế hoạch tuần mới');
    expect(created?.priority).toBe('high');
    expect(created?.project_id).toBe(42);
    expect(created?.due_date).toBe('2026-09-05');
    expect(sync.tasks.value[0].title).toBe('Soạn thảo kế hoạch tuần mới');
  });

  it('creates task successfully with positional arguments (legacy compatibility)', async () => {
    const sync = useTaskSync();
    sync.projects.value = [{ id: 10, title: 'Main Project', slug: 'main' }];

    const created = await sync.createTask('Họp ban giám đốc', 'urgent', 10);

    expect(created).not.toBeNull();
    expect(created?.title).toBe('Họp ban giám đốc');
    expect(created?.priority).toBe('urgent');
    expect(created?.project_id).toBe(10);
    expect(sync.tasks.value[0].title).toBe('Họp ban giám đốc');
  });

  it('rejects empty or whitespace titles gracefully without throwing errors', async () => {
    const sync = useTaskSync();
    const initialCount = sync.tasks.value.length;

    const res1 = await sync.createTask('');
    const res2 = await sync.createTask('    ');
    const res3 = await sync.createTask({ title: '   ' });

    expect(res1).toBeNull();
    expect(res2).toBeNull();
    expect(res3).toBeNull();
    expect(sync.tasks.value.length).toBe(initialCount);
  });

  it('persists newly created tasks into local cache immediately', async () => {
    const sync = useTaskSync();
    sync.projects.value = [{ id: 1, title: 'Project 1', slug: 'p1' }];

    await sync.createTask({
      title: 'Mua tài liệu tham khảo',
      priority: 'medium',
      due_date: '2026-09-05',
    });

    const cachedStr = store['task_hub_desktop_synced_tasks:offline'];
    expect(cachedStr).toBeDefined();
    const parsed = JSON.parse(cachedStr);
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed.some((t: any) => t.title === 'Mua tài liệu tham khảo')).toBe(true);
  });
});
