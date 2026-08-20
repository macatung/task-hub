import { ref, onMounted } from 'vue';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  key?: string | null;
  color?: string | null;
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

const API_BASE = `${(import.meta as any).env?.VITE_TASK_HUB_URL || 'http://localhost:8080'}/api/v1/tasks`;

export function useTaskSync() {
  const tasks = ref<TaskItem[]>([]);
  const agentTasks = ref<TaskItem[]>([]);
  const activeTask = ref<TaskItem | null>(null);
  const isLoading = ref(false);
  const isOnline = ref(true);

  // Load from local storage cache initially
  const loadLocalCache = () => {
    try {
      const saved = localStorage.getItem('task_hub_desktop_synced_tasks');
      if (saved) {
        tasks.value = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Local task cache error:', e);
    }
  };

  const saveLocalCache = () => {
    try {
      localStorage.setItem('task_hub_desktop_synced_tasks', JSON.stringify(tasks.value));
    } catch (e) {
      console.warn('Local task save error:', e);
    }
  };

  // Fetch tasks from API
  const fetchTasks = async () => {
    isLoading.value = true;
    try {
      const res = await fetch(`${API_BASE}?today=1`);
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
      console.warn('Cannot connect to task backend, using offline cache:', e);
    } finally {
      isLoading.value = false;
    }
    loadLocalCache();
  };

  const fetchAgentTasks = async () => {
    try {
      const statuses = ['todo', 'in_progress', 'review'];
      const responses = await Promise.all(statuses.map(status => fetch(`${API_BASE}?status=${status}`)));
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

    const newTask: TaskItem = {
      id: Date.now(),
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
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE}/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE}/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_pomodoros: task.completed_pomodoros }),
      });
    } catch (e) {
      console.warn('Failed to sync pomodoro count:', e);
    }
  };

  onMounted(() => {
    fetchTasks();
    fetchAgentTasks();
  });

  return {
    tasks,
    agentTasks,
    activeTask,
    isLoading,
    isOnline,
    fetchTasks,
    fetchAgentTasks,
    createTask,
    toggleTaskComplete,
    incrementPomodoro,
  };
}
