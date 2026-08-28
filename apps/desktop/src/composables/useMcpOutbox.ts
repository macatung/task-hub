import { computed, ref } from 'vue';

export interface McpOutboxItem {
  id: string;
  name: string;
  args: Record<string, unknown>;
  createdAt: number;
  retries: number;
  targetTaskId?: number;
  runId?: number;
  description?: string;
  lastError?: string;
}

const OUTBOX_STORAGE_KEY_PREFIX = 'task_hub_desktop_mcp_outbox';
const outboxItems = ref<McpOutboxItem[]>([]);
const isReplaying = ref(false);

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {}
  return null;
};

const getStorageKey = (projectId = 'default') => `${OUTBOX_STORAGE_KEY_PREFIX}:${projectId}`;

export function loadMcpOutbox(projectId = 'default'): McpOutboxItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(getStorageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        outboxItems.value = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[McpOutbox] Could not parse stored outbox:', e);
  }
  outboxItems.value = [];
  return [];
}

export function saveMcpOutbox(items: McpOutboxItem[], projectId = 'default'): void {
  outboxItems.value = items;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getStorageKey(projectId), JSON.stringify(items));
  } catch (e) {
    console.warn('[McpOutbox] Could not save outbox to storage:', e);
  }
}

export function useMcpOutbox(projectIdGetter?: () => string | number | undefined) {
  const currentProjectId = () => {
    const raw = projectIdGetter ? projectIdGetter() : undefined;
    return raw !== undefined && raw !== null && String(raw).trim() !== '' ? String(raw) : 'default';
  };

  // Initialize from storage
  loadMcpOutbox(currentProjectId());

  const pendingCount = computed(() => outboxItems.value.length);

  const enqueue = (
    name: string,
    args: Record<string, unknown>,
    meta?: { taskId?: number; runId?: number; description?: string },
  ): McpOutboxItem => {
    const pId = currentProjectId();
    const current = loadMcpOutbox(pId);
    const item: McpOutboxItem = {
      id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      args,
      createdAt: Date.now(),
      retries: 0,
      targetTaskId: meta?.taskId,
      runId: meta?.runId,
      description: meta?.description || `${name} for task #${meta?.taskId || 'unknown'}`,
    };
    const next = [...current, item];
    saveMcpOutbox(next, pId);
    return item;
  };

  const replay = async (
    mcpCaller: (name: string, args: Record<string, unknown>) => Promise<any>,
  ): Promise<{ processed: number; remaining: number }> => {
    if (isReplaying.value) return { processed: 0, remaining: outboxItems.value.length };
    isReplaying.value = true;
    const pId = currentProjectId();
    let current = loadMcpOutbox(pId);
    let processed = 0;

    try {
      while (current.length > 0) {
        const item = current[0];
        try {
          await mcpCaller(item.name, item.args);
          // Success: pop item and persist immediately
          current = current.slice(1);
          saveMcpOutbox(current, pId);
          processed++;
        } catch (err: any) {
          item.retries += 1;
          item.lastError = err?.message || String(err);
          // If permanent client error (e.g. 400 Bad Request or malformed payload), drop after 5 retries
          if (item.retries >= 5) {
            console.warn(`[McpOutbox] Dropping item ${item.id} after ${item.retries} failed attempts:`, item.lastError);
            current = current.slice(1);
            saveMcpOutbox(current, pId);
          } else {
            // Save state with updated retry count and stop replay until next connectivity window
            saveMcpOutbox(current, pId);
            break;
          }
        }
      }
    } finally {
      isReplaying.value = false;
    }

    return { processed, remaining: outboxItems.value.length };
  };

  const clear = () => {
    const pId = currentProjectId();
    saveMcpOutbox([], pId);
  };

  return {
    outboxItems,
    pendingCount,
    isReplaying,
    enqueue,
    replay,
    clear,
    reload: () => loadMcpOutbox(currentProjectId()),
  };
}
