import { ref, onMounted } from 'vue';
import { defaultHeartbeatService, defaultRemoteDispatchService } from '../services';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  key?: string | null;
  color?: string | null;
}

export interface TaskDependencyTarget {
  id: number;
  issue_key?: string | null;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
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
  sprint_id?: number | null;
  epic_id?: number | null;
  epic?: TaskItem | { id: number; title: string; issue_key?: string | null } | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: Array<{
    id: number;
    depends_on_task_id: number;
    depends_on?: TaskDependencyTarget | null;
  }>;
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

type PendingSyncOperation = {
  id: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
  temporaryTaskId?: number;
};

/** Keep completed tasks visible when a prerequisite regresses so desktop can
 * surface the required human reconsideration instead of hiding the warning. */
const needsDependencyReview = (task: TaskItem, allTasks: TaskItem[]) => {
  if (task.status !== 'done') return false;
  return (task.dependencies || []).some(dependency => {
    const target = allTasks.find(candidate => candidate.id === dependency.depends_on_task_id) || dependency.depends_on;
    return target?.status !== 'done';
  });
};

declare global { interface Window { desktopApi?: any; } }
const DEFAULT_TASK_HUB_URL = (import.meta as any).env?.VITE_TASK_HUB_URL || 'https://task-hub.macatung.dev';
let unsubQuotaListener: (() => void) | undefined;

export function formatQuotaTelemetry(quota: any): any {
  if (!quota) return undefined;
  return {
    plan: quota.plan || 'Google AI Ultra',
    gemini: {
      used_tokens: quota.gemini?.usedTokens || 0,
      limit: quota.gemini?.totalLimitTokens || 2000000,
      weekly_percent: quota.gemini?.weeklyRemainingPercent ?? 100,
      five_hour_percent: quota.gemini?.fiveHourRemainingPercent ?? 100,
      weekly_reset_in: quota.gemini?.weeklyResetIn,
      five_hour_reset_in: quota.gemini?.fiveHourResetIn,
    },
    claude_gpt: {
      used_tokens: quota.claudeGpt?.usedTokens || 0,
      limit: quota.claudeGpt?.totalLimitTokens || 1000000,
      weekly_percent: quota.claudeGpt?.weeklyRemainingPercent ?? 100,
      five_hour_percent: quota.claudeGpt?.fiveHourRemainingPercent ?? 100,
      weekly_reset_in: quota.claudeGpt?.weeklyResetIn,
      five_hour_reset_in: quota.claudeGpt?.fiveHourResetIn,
    },
    codex: {
      used_tokens: quota.codex?.usedTokens || 0,
      limit: quota.codex?.totalLimitTokens || 1000000,
      weekly_percent: quota.codex?.weeklyRemainingPercent ?? 100,
      five_hour_percent: quota.codex?.fiveHourRemainingPercent ?? 100,
      weekly_reset_in: quota.codex?.weeklyResetIn,
      five_hour_reset_in: quota.codex?.fiveHourResetIn,
    },
  };
}

export function useTaskSync() {
  const tasks = ref<TaskItem[]>([]);
  const agentTasks = ref<TaskItem[]>([]);
  const projects = ref<ProjectItem[]>([]);
  const activeTask = ref<TaskItem | null>(null);
  const isLoading = ref(false);
  const isOnline = ref(false);
  const credential = ref<DesktopCredential | null>(null);
  const connectionError = ref('');

  const cacheKey = () => `task_hub_desktop_synced_tasks:${credential.value?.projectId || 'offline'}`;
  const outboxKey = () => `task_hub_desktop_outbox:${credential.value?.projectId || 'offline'}`;
  const apiUrl = (suffix = '') => `${(credential.value?.taskHubUrl || DEFAULT_TASK_HUB_URL).replace(/\/$/, '')}/api/v1/desktop/tasks${suffix}`;
  const projectsUrl = () => `${(credential.value?.taskHubUrl || DEFAULT_TASK_HUB_URL).replace(/\/$/, '')}/api/v1/desktop/projects`;
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

  const readOutbox = (): PendingSyncOperation[] => {
    try {
      const value = JSON.parse(localStorage.getItem(outboxKey()) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };

  const writeOutbox = (operations: PendingSyncOperation[]) => {
    localStorage.setItem(outboxKey(), JSON.stringify(operations));
  };

  const enqueueSync = (operation: PendingSyncOperation) => {
    const current = readOutbox();
    // Keep the newest pending change for an existing task while preserving
    // creates as a separate operation that must be replayed first.
    const filtered = operation.method === 'PATCH'
      ? current.filter(item => !(item.method === 'PATCH' && item.path === operation.path))
      : current;
    writeOutbox([...filtered, operation]);
  };

  const replayOutbox = async () => {
    if (!credential.value) return false;
    let operations = readOutbox();
    while (operations.length) {
      const operation = operations[0];
      try {
        const response = await fetch(`${apiUrl()}${operation.path}`, {
          method: operation.method,
          headers: { ...authHeaders(), 'X-Idempotency-Key': operation.id },
          body: JSON.stringify(operation.body),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.success === false) throw new Error(payload?.message || `HTTP ${response.status}`);
        if (operation.temporaryTaskId && payload?.data?.id) {
          const index = tasks.value.findIndex(task => task.id === operation.temporaryTaskId);
          if (index !== -1) tasks.value[index] = payload.data;
          saveLocalCache();
        }
        if (operation.method === 'PATCH' && payload?.data?.id) {
          const replace = (items: TaskItem[]) => {
            const index = items.findIndex(task => task.id === payload.data.id);
            if (index !== -1) items[index] = { ...items[index], ...payload.data };
          };
          replace(tasks.value);
          replace(agentTasks.value);
          saveLocalCache();
        }
        operations = operations.slice(1);
        writeOutbox(operations);
      } catch (error) {
        connectionError.value = error instanceof Error ? error.message : 'Pending changes are waiting to sync.';
        return false;
      }
    }
    return true;
  };

  const syncHeartbeatService = async (cred: DesktopCredential | null) => {
    if (cred?.token && cred?.taskHubUrl) {
      let hostname = 'DESKTOP-DEV';
      let machineName = cred.userName ? `${cred.userName}'s Workstation` : (cred.workspaceName ? `${cred.workspaceName} Agent` : 'Desktop Agent');
      let osPlatform = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'win32' : 'darwin';
      let osRelease = 'Windows 11';
      let cwd = 'd:\\Project\\task-hub';

      try {
        if (window.desktopApi?.getSystemInfo) {
          const info = await window.desktopApi.getSystemInfo();
          if (info.hostname) hostname = info.hostname;
          if (info.platform) osPlatform = info.platform;
          if (info.osRelease) osRelease = info.osRelease;
          if (info.username) machineName = `${info.username}'s Workstation`;
        }
        if (window.desktopApi?.agent?.listWorkspaces) {
          const workspaces = await window.desktopApi.agent.listWorkspaces();
          if (Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]) {
            cwd = workspaces[0];
          }
        }
      } catch {}

      let quotaMetrics: any = undefined;
      try {
        if (window.desktopApi?.agent?.getQuotaUsage) {
          const quota = await window.desktopApi.agent.getQuotaUsage();
          if (quota) {
            quotaMetrics = formatQuotaTelemetry(quota);
          }
        }
      } catch {}

      defaultHeartbeatService.setOptions({
        baseUrl: cred.taskHubUrl,
        token: cred.token,
      });
      defaultHeartbeatService.setTelemetryOverrides({
        hostname,
        machine_name: machineName,
        name: machineName,
        platform: osPlatform,
        os_release: osRelease,
        workspace_cwd: cwd,
        ...(quotaMetrics ? { quota_metrics: quotaMetrics } : {}),
      });
      defaultHeartbeatService.start();

      // Continuous live quota listener
      if (window.desktopApi?.agent?.onQuotaUpdated) {
        unsubQuotaListener?.();
        unsubQuotaListener = window.desktopApi.agent.onQuotaUpdated((quota: any) => {
          if (quota) {
            const formatted = formatQuotaTelemetry(quota);
            if (formatted) {
              defaultHeartbeatService.setQuotaMetrics(formatted);
            }
          }
        });
      }

      defaultRemoteDispatchService.setOptions({
        baseUrl: cred.taskHubUrl,
        token: cred.token,
        heartbeatService: defaultHeartbeatService,
      });
    } else {
      unsubQuotaListener?.();
      unsubQuotaListener = undefined;
      defaultHeartbeatService.stop();
    }
  };

  // Fetch tasks from API
  const loadCredential = async () => {
    try {
      const electronCred = await window.desktopApi?.taskHub?.getCredential?.();
      if (electronCred?.token) {
        credential.value = electronCred;
        void syncHeartbeatService(electronCred);
        return credential.value;
      }
    } catch {}
    credential.value = null;
    void syncHeartbeatService(null);
    return null;
  };

  const setCredential = async (next: DesktopCredential) => {
    try {
      await window.desktopApi?.taskHub?.saveCredential?.(next);
    } catch {}
    credential.value = next;
    connectionError.value = '';
    void syncHeartbeatService(next);
    await fetchProjects();
    await fetchTasks();
  };

  const fetchProjects = async () => {
    if (!credential.value) return false;
    try {
      const response = await fetch(projectsUrl(), { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.message || `Task Hub returned HTTP ${response.status}.`);
      projects.value = json.data || [];
      connectionError.value = '';
      isOnline.value = true;
      return true;
    } catch (e) {
      isOnline.value = false;
      connectionError.value = e instanceof Error ? e.message : 'Unable to load Task Hub projects.';
      return false;
    }
  };

  const clearCredential = async () => {
    try {
      await window.desktopApi?.taskHub?.clearCredential?.();
    } catch {}
    credential.value = null;
    void syncHeartbeatService(null);
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
          void replayOutbox();
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
    if (!credential.value) return false;
    try {
      // Fetch the complete selected-project backlog once.  The old three
      // status requests were brittle with scoped desktop credentials and
      // could leave the queue empty although the project had work items.
      const response = await fetch(`${apiUrl()}?project_id=${encodeURIComponent(credential.value.projectId)}`, { headers: authHeaders() });
      const payload = response.ok ? await response.json() : null;
      if (!payload?.success || !Array.isArray(payload.data)) throw new Error('Task Hub did not return a project backlog.');
      tasks.value = payload.data;
      // Keep Epics in the local queue so the desktop can launch a supervised
      // dependency-aware sequence. Completed items normally stay hidden, but
      // a completed task with a regressed prerequisite remains visible for
      // human reconsideration.
      agentTasks.value = payload.data.filter((task: TaskItem) => task.status !== 'done' || needsDependencyReview(task, payload.data));
      saveLocalCache();
      isOnline.value = true;
      connectionError.value = '';
      return true;
    } catch (e) {
      console.warn('Cannot load agent tasks:', e);
      agentTasks.value = tasks.value.filter(task => task.status !== 'done' || needsDependencyReview(task, tasks.value));
      isOnline.value = false;
      connectionError.value = e instanceof Error ? e.message : 'Unable to load the Task Hub backlog.';
      return false;
    }
  };

  // Create task
  const createTask = async (title: string, priority = 'high', projectId?: number, category = 'backend', estimatedPomodoros = 2) => {
    if (!title.trim()) return null;

    if (!credential.value) return null;
    const selectedProjectId = projectId || projects.value[0]?.id;
    if (!selectedProjectId) return null;
    const newTask: TaskItem = {
      id: Date.now(),
      project_id: selectedProjectId,
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

    const operation: PendingSyncOperation = {
      id: crypto.randomUUID(), method: 'POST', path: '', body: { ...newTask }, temporaryTaskId: newTask.id,
    };
    try {
      const res = await fetch(apiUrl(), {
        method: 'POST',
        headers: { ...authHeaders(), 'X-Idempotency-Key': operation.id },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const idx = tasks.value.findIndex(t => t.id === newTask.id);
          if (idx !== -1) tasks.value[idx] = json.data;
          saveLocalCache();
        }
      } else {
        enqueueSync(operation);
      }
    } catch (e) {
      console.warn('Failed to sync created task to API:', e);
      enqueueSync(operation);
    }

    return newTask;
  };

  const updateTaskStatus = async (task: TaskItem, newStatus: TaskItem['status']) => {
    task.status = newStatus;
    task.completed_at = newStatus === 'done' ? new Date().toISOString() : null;
    saveLocalCache();

    try {
      if (!credential.value) throw new Error('Connect Task Hub before changing task status.');
      const response = await fetch(`${apiUrl()}/${task.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) throw new Error(json?.message || `Task Hub returned HTTP ${response.status}.`);
      const updated = json?.data as TaskItem | undefined;
      if (updated) {
        const replace = (items: TaskItem[]) => {
          const index = items.findIndex(candidate => candidate.id === task.id);
          if (index !== -1) items[index] = { ...items[index], ...updated };
        };
        replace(tasks.value);
        replace(agentTasks.value);
        saveLocalCache();
        return updated;
      }
      return task;
    } catch (e) {
      saveLocalCache();
      enqueueSync({
        id: crypto.randomUUID(), method: 'PATCH', path: `/${task.id}`,
        body: { status: newStatus },
      });
      throw e;
    }
  };

  // Toggle complete
  const toggleTaskComplete = async (task: TaskItem) => {
    try {
      await updateTaskStatus(task, task.status === 'done' ? 'todo' : 'done');
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
      const response = await fetch(`${apiUrl()}/${task.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ completed_pomodoros: task.completed_pomodoros }),
      });
      if (!response.ok) throw new Error(`Task Hub returned HTTP ${response.status}.`);
    } catch (e) {
      console.warn('Failed to sync pomodoro count:', e);
      enqueueSync({
        id: crypto.randomUUID(), method: 'PATCH', path: `/${task.id}`,
        body: { completed_pomodoros: task.completed_pomodoros },
      });
    }
  };

  onMounted(() => {
    void loadCredential().then(() => fetchProjects()).then(() => fetchTasks()).then(() => fetchAgentTasks()).then(() => replayOutbox());
  });

  return {
    tasks,
    projects,
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
    fetchProjects,
    fetchAgentTasks,
    createTask,
    updateTaskStatus,
    toggleTaskComplete,
    incrementPomodoro,
    replayOutbox,
  };
}
