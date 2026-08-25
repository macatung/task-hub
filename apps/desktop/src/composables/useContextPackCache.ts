import { ref, computed, markRaw, toRaw } from 'vue';

export interface CachedContextPackEntry {
  taskId: number;
  taskUpdatedAt?: string | null;
  contextHash: string;
  cachedAt: string;
  data: any;
  status: 'ready' | 'fetching' | 'stale';
}

const cacheMap = ref<Record<number, CachedContextPackEntry>>({});
const activeFetches = new Map<number, Promise<any>>();
const isPrefetching = ref(false);

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes fresh cache

export function useContextPackCache(scopeKey = 'default') {
  const storageKey = () => `task_hub_context_pack_cache:${scopeKey}`;

  const loadFromStorage = () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(storageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cacheMap.value = { ...cacheMap.value, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Could not load context pack cache from storage', e);
    }
  };

  const saveToStorage = () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(storageKey(), JSON.stringify(cacheMap.value));
    } catch (e) {
      console.warn('Could not persist context pack cache to storage', e);
    }
  };

  const get = (taskId: number): CachedContextPackEntry | null => {
    const entry = cacheMap.value[taskId];
    if (!entry) return null;
    return {
      ...entry,
      data: toRaw(entry.data),
    };
  };

  const isFresh = (
    taskId: number,
    currentTaskUpdatedAt?: string | null,
    maxAgeMs = DEFAULT_TTL_MS
  ): boolean => {
    const entry = cacheMap.value[taskId];
    if (!entry || !entry.data) return false;
    if (entry.status !== 'ready') return false;

    // Check if task on hub has been modified since we cached it
    if (currentTaskUpdatedAt && entry.taskUpdatedAt && currentTaskUpdatedAt !== entry.taskUpdatedAt) {
      return false;
    }

    const age = Date.now() - new Date(entry.cachedAt).getTime();
    return age < maxAgeMs;
  };

  const set = (taskId: number, data: any, taskUpdatedAt?: string | null): CachedContextPackEntry => {
    const rawData = toRaw(data?.data || data);
    const contextHash = rawData?.context_hash || `hash-${Date.now()}`;
    const entry: CachedContextPackEntry = {
      taskId,
      taskUpdatedAt: taskUpdatedAt || null,
      contextHash,
      cachedAt: new Date().toISOString(),
      data: markRaw(rawData),
      status: 'ready',
    };
    cacheMap.value[taskId] = entry;
    saveToStorage();
    return entry;
  };

  const prefetch = async (
    taskId: number,
    mcpCaller: (method: string, args: any) => Promise<any>,
    taskUpdatedAt?: string | null,
    force = false
  ): Promise<any> => {
    if (!taskId) return null;

    // If fresh and not forcing, return immediately
    if (!force && isFresh(taskId, taskUpdatedAt)) {
      return cacheMap.value[taskId].data;
    }

    // Deduplicate active inflight request for the same task
    if (activeFetches.has(taskId)) {
      return activeFetches.get(taskId);
    }

    const fetchPromise = (async () => {
      try {
        if (cacheMap.value[taskId]) {
          cacheMap.value[taskId].status = 'fetching';
        }
        const res = await mcpCaller('get_context_pack', { task_id: taskId });
        const data = res?.data || res;
        if (data) {
          set(taskId, data, taskUpdatedAt);
          return data;
        }
        return null;
      } catch (err) {
        if (cacheMap.value[taskId]) {
          cacheMap.value[taskId].status = 'stale';
        }
        console.warn(`[ContextPackCache] Failed to prefetch task #${taskId}`, err);
        return null;
      } finally {
        activeFetches.delete(taskId);
      }
    })();

    activeFetches.set(taskId, fetchPromise);
    return fetchPromise;
  };

  const prefetchQueue = async (
    tasks: Array<{ id: number; updated_at?: string | null; status?: string }>,
    mcpCaller: (method: string, args: any) => Promise<any>,
    maxTasks = 8
  ): Promise<void> => {
    if (!tasks || tasks.length === 0) return;
    isPrefetching.value = true;

    try {
      // Prioritize in_progress, then todo, then review
      const eligible = [...tasks]
        .filter(t => t.status !== 'done')
        .slice(0, maxTasks);

      for (const task of eligible) {
        if (!isFresh(task.id, task.updated_at)) {
          await prefetch(task.id, mcpCaller, task.updated_at);
        }
      }
    } catch (e) {
      console.warn('[ContextPackCache] Queue prefetch error', e);
    } finally {
      isPrefetching.value = false;
    }
  };

  const invalidate = (taskId?: number) => {
    if (typeof taskId === 'number') {
      delete cacheMap.value[taskId];
    } else {
      cacheMap.value = {};
    }
    saveToStorage();
  };

  const cachedCount = computed(() => Object.keys(cacheMap.value).length);
  const isReady = (taskId: number) => Boolean(cacheMap.value[taskId]?.status === 'ready');

  // Initialize from storage
  loadFromStorage();

  return {
    cacheMap,
    get,
    set,
    isFresh,
    prefetch,
    prefetchQueue,
    invalidate,
    isPrefetching,
    cachedCount,
    isReady,
    loadFromStorage,
    saveToStorage,
  };
}
