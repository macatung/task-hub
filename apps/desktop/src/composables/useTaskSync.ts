import { ref, onMounted } from 'vue';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  key?: string | null;
  color?: string | null;
}

export interface DesktopCredential {
  taskHubUrl: string;
  token: string;
  projectId: string;
  projectTitle?: string;
  workspaceId?: string;
  workspaceName?: string;
  userEmail?: string;
  userName?: string;
}

export interface TaskItem {
  id: number;
  project_id?: number | null;
  project?: ProjectItem | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  estimated_pomodoros: number;
  completed_pomodoros: number;
  due_date: string | null;
  completed_at: string | null;
  issue_key?: string | null;
  issue_type?: 'epic' | 'story' | 'task' | 'bug';
  story_points?: number | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  notes?: string | null;
}

export interface DailyDispatchData {
  dispatch_date: string;
  active_tasks: TaskItem[];
  completed_today_count: number;
  greeting: string;
}

export interface DailyReviewData {
  review_date: string;
  completed_count: number;
  incompleted_count: number;
  total_pomodoros_done: number;
  completed_tasks: TaskItem[];
  incompleted_tasks: TaskItem[];
  wisdom_quote: string;
}

declare global { interface Window { desktopApi?: any; } }
const DEFAULT_TASK_HUB_URL = (import.meta as any).env?.VITE_TASK_HUB_URL || 'https://task-hub.macatung.dev';

export function useTaskSync() {
  const tasks = ref<TaskItem[]>([]);
  const agentTasks = ref<TaskItem[]>([]);
  const activeTask = ref<TaskItem | null>(null);
  const isLoading = ref(false);
  const isOnline = ref(false);
  const credential = ref<DesktopCredential | null>(null);
  const connectionError = ref('');

  const cacheKey = () => `task_hub_desktop_synced_tasks:${credential.value?.projectId || 'offline'}`;
  const apiUrl = (suffix = '') => `${(credential.value?.taskHubUrl || DEFAULT_TASK_HUB_URL).replace(/\/$/, '')}/api/v1/desktop/tasks${suffix}`;
  const authHeaders = (): Record<string, string> => credential.value ? {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credential.value.token}`,
    'X-Task-Hub-Project': credential.value.projectId,
  } : { 'Content-Type': 'application/json' };

  // Load from local storage cache initially
  const loadLocalCache = () => {
    try {
      const saved = localStorage.getItem(cacheKey());
      if (saved) {
        tasks.value = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Local task cache error:', e);
    }
  };

  const saveLocalCache = () => {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(tasks.value));
    } catch (e) {
      console.warn('Local task save error:', e);
    }
  };

  // Fetch tasks from API
  const loadCredential = async () => {
    try { credential.value = await window.desktopApi?.taskHub?.getCredential?.() || null; }
    catch { credential.value = null; }
    return credential.value;
  };

  const setCredential = async (next: DesktopCredential) => {
    await window.desktopApi?.taskHub?.saveCredential?.(next);
    credential.value = next;
    connectionError.value = '';
    await fetchTasks();
  };

  const clearCredential = async () => {
    await window.desktopApi?.taskHub?.clearCredential?.();
    credential.value = null;
    tasks.value = [];
    agentTasks.value = [];
    isOnline.value = false;
  };

  const fetchTasks = async () => {
    isLoading.value = true;
    if (!credential.value) await loadCredential();
    if (!credential.value) { loadLocalCache(); isOnline.value = false; isLoading.value = false; return; }
    try {
      const res = await fetch(`${apiUrl()}?today=1&project_id=${encodeURIComponent(credential.value.projectId)}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          tasks.value = json.data;
          saveLocalCache();
          isOnline.value = true;
          return;
        }
      }
    } catch (e) {
      isOnline.value = false;
      connectionError.value = e instanceof Error ? e.message : 'Unable to connect to Task Hub.';
      console.warn('Cannot connect to task backend, using offline cache:', e);
    } finally {
      isLoading.value = false;
    }
    loadLocalCache();
  };

  const fetchAgentTasks = async () => {
    if (!credential.value) return;
    try {
      const statuses = ['todo', 'in_progress', 'review'];
      const responses = await Promise.all(statuses.map(status => fetch(`${apiUrl()}?status=${status}&project_id=${encodeURIComponent(credential.value!.projectId)}`, { headers: authHeaders() })));
      const payloads = await Promise.all(responses.map(response => response.ok ? response.json() : null));
      const unique = new Map<number, TaskItem>();
      payloads.forEach(payload => (payload?.data || []).forEach((task: TaskItem) => unique.set(task.id, task)));
      agentTasks.value = Array.from(unique.values());
    } catch (e) {
      console.warn('Cannot load agent tasks:', e);
      agentTasks.value = tasks.value.filter(task => task.status !== 'done');
    }
  };

  // Create task
  const createTask = async (title: string, priority = 'high', category = 'backend', estimatedPomodoros = 2) => {
    if (!title.trim()) return null;

    if (!credential.value) return null;
    const newTask: TaskItem = {
      id: Date.now(),
      project_id: Number(credential.value.projectId),
      title: title.trim(),
      description: null,
      status: 'todo',
      priority: priority as any,
      category,
      estimated_pomodoros: estimatedPomodoros,
      completed_pomodoros: 0,
      due_date: new Date().toISOString().split('T')[0],
      completed_at: null,
    };

    tasks.value.unshift(newTask);
    saveLocalCache();

    try {
      const res = await fetch(apiUrl(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const idx = tasks.value.findIndex(t => t.id === newTask.id);
          if (idx !== -1) tasks.value[idx] = json.data;
          saveLocalCache();
        }
      }
    } catch (e) {
      console.warn('Failed to sync created task to API:', e);
    }

    return newTask;
  };

  // Toggle complete
  const toggleTaskComplete = async (task: TaskItem) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    task.status = newStatus;
    task.completed_at = newStatus === 'done' ? new Date().toISOString() : null;
    saveLocalCache();

    try {
      if (!credential.value) return;
      await fetch(`${apiUrl()}/${task.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.warn('Failed to sync status update:', e);
    }
  };

  // Increment Pomodoro
  const incrementPomodoro = async (task: TaskItem) => {
    task.completed_pomodoros++;
    saveLocalCache();

    try {
      if (!credential.value) return;
      await fetch(`${apiUrl()}/${task.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ completed_pomodoros: task.completed_pomodoros }),
      });
    } catch (e) {
      console.warn('Failed to sync pomodoro count:', e);
    }
  };

  onMounted(() => {
    void fetchTasks().then(() => fetchAgentTasks());
  });

  return {
    tasks,
    agentTasks,
    activeTask,
    isLoading,
    isOnline,
    credential,
    connectionError,
    setCredential,
    clearCredential,
    loadCredential,
    fetchTasks,
    fetchAgentTasks,
    createTask,
    toggleTaskComplete,
    incrementPomodoro,
  };
}
