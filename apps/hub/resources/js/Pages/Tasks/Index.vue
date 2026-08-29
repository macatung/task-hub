<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import axios from 'axios';
import TasksEmptyState from '@/Components/tasks/TasksEmptyState.vue';
import ProjectDocumentsPanel from '@/Components/tasks/ProjectDocumentsPanel.vue';
import ProjectReleaseLog from '@/Components/tasks/ProjectReleaseLog.vue';
import RunnerDashboard from '@/Components/tasks/RunnerDashboard.vue';
import RemoteDispatchModal, { type TaskItemProps } from '@/Components/tasks/RemoteDispatchModal.vue';
import StreambackConsole from '@/Components/tasks/StreambackConsole.vue';
import TaskContextRail from '@/Components/tasks/TaskContextRail.vue';
import TaskHistoryTimeline from '@/Components/tasks/TaskHistoryTimeline.vue';
import WorkspaceEmptyBoard from '@/Components/tasks/WorkspaceEmptyBoard.vue';
import ProjectRoadmapDashboard from '@/Components/tasks/ProjectRoadmapDashboard.vue';
import ProjectGantt from '@/Components/tasks/ProjectGantt.vue';
import WorkspaceBrand from '@/Components/layout/WorkspaceBrand.vue';
import Icons from '@/Components/ui/Icons.vue';
import StatusBadge from '@/Components/ui/StatusBadge.vue';
import UpgradeModal from '@/Components/billing/UpgradeModal.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';
import type { DesktopAgentItem } from '@/Components/tasks/ConnectedAgentsRegistry.vue';
import { sound } from '@/audio/soundEffects';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  tagline?: string;
  key?: string;
  category?: string;
  tags?: string[] | null;
  color?: string;
  description?: string | null;
  tasks_count?: number;
  github_repository?: string | null;
  github_default_branch?: string | null;
  github_sync_status?: string | null;
  github_last_sync_at?: string | null;
}

interface GithubRepositoryItem {
  id: number;
  name: string;
  full_name: string;
  owner?: string;
  private: boolean;
  description?: string | null;
  html_url?: string;
  default_branch?: string;
  language?: string | null;
}

export interface SprintItem {
  id: number;
  project_id: number;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'future' | 'active' | 'completed';
  total_points?: number;
  done_points?: number;
  total_tasks?: number;
  done_tasks?: number;
  tasks?: TaskItem[];
  created_at?: string;
}

export interface SubtaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskItem {
  id: number;
  project_id: number | null;
  project?: ProjectItem | null;
  issue_key?: string;
  issue_type: 'epic' | 'story' | 'task' | 'bug';
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  story_points: number | null;
  sprint_id: number | null;
  sprint?: SprintItem | null;
  epic_id: number | null;
  epic?: TaskItem | null;
  sort_order?: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_pomodoros: number;
  completed_pomodoros: number;
  notes: string | null;
  subtasks?: SubtaskItem[];
  created_at?: string;
  updated_at?: string;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  documents?: Array<{ id: number; title: string; document_type: string; url?: string | null; repository_path?: string | null; pivot?: { is_required: boolean; purpose?: string | null } }>;
  dependencies?: Array<{ id: number; depends_on_task_id: number; depends_on?: Pick<TaskItem, 'id' | 'issue_key' | 'title' | 'status'> | null }>;
}

export interface AgentRunItem {
  id: number;
  task_id?: number | null;
  provider: string;
  execution_mode?: 'desktop';
  runner_id?: number | null;
  agent_session_id?: string;
  status: string;
  branch?: string | null;
  commit_sha?: string | null;
  pull_request_url?: string | null;
  summary?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  metadata?: { model?: string; [key: string]: any } | null;
  evidence?: Array<{ id: number; evidence_type: string; status: string; command?: string; summary?: string }>;
  task?: TaskItem | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Stats {
  total: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  total_story_points: number;
  completed_story_points: number;
  total_pomodoros_estimated: number;
  total_pomodoros_completed: number;
  completion_rate: number;
}

export interface TaskDelayStatus {
  status: 'overdue' | 'at_risk' | 'on_track' | 'completed';
  isOverdue: boolean;
  isDelayed: boolean;
  daysOverdue: number;
  daysRemaining: number;
  label: string;
  reason: string;
  badgeClass: string;
  cardBorderClass: string;
  progressPercent: number;
}

const props = defineProps<{
  tasks: TaskItem[];
  projects: ProjectItem[];
  sprints?: SprintItem[];
  epics?: TaskItem[];
  stats: Stats;
  selectedDate: string;
  selectedProjectId?: string | number;
  workspaces?: { id: number; name: string; slug: string; plan?: string }[];
  currentWorkspaceId?: number | null;
  auth?: { user?: { id: number; name: string; email: string; github_login?: string; github_avatar_url?: string } | null };
}>();

// Main Reactive State
const taskList = ref<TaskItem[]>(
  props.tasks.map(t => ({
    ...t,
    issue_type: t.issue_type || 'task',
    issue_key: t.issue_key || ('MCT-' + t.id),
    subtasks: t.notes ? tryParseSubtasks(t.notes) : [],
  }))
);

const projectList = ref<ProjectItem[]>([...props.projects]);
const sprintList = ref<SprintItem[]>(props.sprints ? [...props.sprints] : []);
const epicList = computed(() => taskList.value.filter(t => t.issue_type === 'epic'));

function tryParseSubtasks(notes: string): SubtaskItem[] {
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [];
}

const dependencySummary = (task: TaskItem) => {
  // Prefer the reactive taskList target over the eager-loaded nested snapshot.
  // This keeps blocker/reconsideration notes correct immediately after a
  // prerequisite is moved backwards in the board.
  const dependencies = (task.dependencies || [])
    .map(dependency => ({
      ...dependency,
      depends_on: taskList.value.find(candidate => candidate.id === dependency.depends_on_task_id) || dependency.depends_on,
    }));
  const labels = dependencies.map((dependency) => dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`);
  const pendingLabels = dependencies
    .filter((dependency) => !dependency.depends_on || dependency.depends_on.status !== 'done')
    .map((dependency) => dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`);
  const dependents = taskList.value
    .filter(candidate => candidate.id !== task.id)
    .filter(candidate => (candidate.dependencies || []).some(dependency => dependency.depends_on_task_id === task.id))
    .map(candidate => candidate.issue_key || `#${candidate.id}`);
  return { total: dependencies.length, labels, pendingLabels, missingLabels: dependencies.filter(dependency => !dependency.depends_on).map(dependency => `#${dependency.depends_on_task_id}`), dependents };
};

// Light is the default work surface. A saved explicit preference wins after
// hydration, so returning users never lose their chosen theme.
const isDarkMode = ref(false);

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('macatung_tasks_theme', isDarkMode.value ? 'dark' : 'light');
  sound.playClick();
};

// Sidebar & Keyboard Navigation State
const keyboardSequence = ref('');
const isSidebarOpen = ref(true);
const selectedProjectId = ref<string | number>(props.selectedProjectId || 'all');
const currentView = ref<'board' | 'backlog' | 'roadmap'>('board');
const roadmapTab = ref<'overview' | 'timeline' | 'epics'>('overview');
const isRoadmapExporting = ref(false);
const roadmapTabs = [
  { id: 'overview', label: 'Overview', icon: 'BarChart3' },
  { id: 'timeline', label: 'Timeline', icon: 'GanttChart' },
  { id: 'epics', label: 'Epics', icon: 'Layers' },
] as const;
const setRoadmapTab = (tab: typeof roadmapTab.value) => { roadmapTab.value = tab; };
const activeProjectMenuId = ref<number | null>(null);
const isWorkspaceMenuOpen = ref(false);
const isAiMenuOpen = ref(false);
const isNotificationsOpen = ref(false);
const readNotificationIds = ref<string[]>([]);
const agentRunNotifications = ref<AgentRunItem[]>([]);
let notificationPollTimer: number | null = null;
const isDocsModalOpen = ref(false);
const isReleasesModalOpen = ref(false);
// Collapsed Sprints in Backlog View
const collapsedSprints = ref<Record<number, boolean>>({});
const toggleSprintCollapse = (sprintId: number) => {
  collapsedSprints.value[sprintId] = !collapsedSprints.value[sprintId];
  sound.playClick();
};

// Quick Filters
const searchQuery = ref('');
const filterIssueType = ref<'all' | 'story' | 'task' | 'bug' | 'epic'>('all');
const filterPriority = ref<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
const filterEpicId = ref<string | number>('all');
const filterSprintId = ref<string | number>('active');
const filterHealth = ref<'all' | 'warning' | 'overdue' | 'at_risk' | 'on_track'>('all');

const quickInputText = ref('');
const quickInputRef = ref<HTMLInputElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

// PIN Security State (Master PIN: 301095)
const isPinUnlocked = ref(false);
const pinInput = ref('');
const pinError = ref('');
const isPinShaking = ref(false);

const checkPin = () => {
  if (pinInput.value === '301095') {
    sound.playSuccess();
    isPinUnlocked.value = true;
    pinError.value = '';
    sessionStorage.setItem('macatung_tasks_pin_auth', '301095');
  } else {
    sound.playError();
    pinError.value = 'Incorrect PIN. Please try again.';
    isPinShaking.value = true;
    setTimeout(() => {
      isPinShaking.value = false;
      pinInput.value = '';
    }, 600);
  }
};

const handleNumpadPress = (digit: string) => {
  if (pinInput.value.length < 6) {
    pinInput.value += digit;
    sound.playClick();
    pinError.value = '';
    if (pinInput.value.length === 6) {
      checkPin();
    }
  }
};

const handleNumpadBackspace = () => {
  if (pinInput.value.length > 0) {
    pinInput.value = pinInput.value.slice(0, -1);
    sound.playClick();
    pinError.value = '';
  }
};

const handleNumpadClear = () => {
  pinInput.value = '';
  pinError.value = '';
  sound.playClick();
};

const lockWorkspace = () => {
  sessionStorage.removeItem('macatung_tasks_pin_auth');
  isPinUnlocked.value = false;
  pinInput.value = '';
  pinError.value = '';
  sound.playClick();
};

// =============================================================================
// DELAY & OVERDUE DETECTION ENGINE
// =============================================================================
const getTaskDelayStatus = (task: TaskItem): TaskDelayStatus => {
  if (task.status === 'done') {
    return {
      status: 'completed',
      isOverdue: false,
      isDelayed: false,
      daysOverdue: 0,
      daysRemaining: 0,
      label: 'Completed',
      reason: 'Task completed successfully.',
      badgeClass: isDarkMode.value
        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
        : 'bg-emerald-50 text-emerald-800 border-emerald-200',
      cardBorderClass: isDarkMode.value ? 'border-emerald-500/30' : 'border-emerald-200',
      progressPercent: 100,
    };
  }

  // Calculate subtasks progress
  const subtasks = task.subtasks || [];
  const doneSubtasks = subtasks.filter(s => s.done).length;
  let progressPercent = 0;
  if (subtasks.length > 0) {
    progressPercent = Math.round((doneSubtasks / subtasks.length) * 100);
  } else if (task.status === 'in_progress') {
    progressPercent = 50;
  } else if (task.status === 'review') {
    progressPercent = 85;
  } else {
    progressPercent = 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!task.due_date) {
    return {
      status: 'on_track',
      isOverdue: false,
      isDelayed: false,
      daysOverdue: 0,
      daysRemaining: 999,
      label: 'No due date',
      reason: 'No due date set',
      badgeClass: isDarkMode.value ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200',
      cardBorderClass: isDarkMode.value ? 'border-slate-800' : 'border-slate-200',
      progressPercent,
    };
  }

  const dueDate = new Date(task.due_date + 'T00:00:00');
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  // 1. OVERDUE
  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return {
      status: 'overdue',
      isOverdue: true,
      isDelayed: false,
      daysOverdue,
      daysRemaining: 0,
      label: `🚨 ${daysOverdue} DAYS OVERDUE`,
      reason: `${daysOverdue} days past the due date (${task.due_date}). Prioritize or reschedule this task.`,
      badgeClass: isDarkMode.value
        ? 'bg-rose-950/90 text-rose-300 border-rose-600 font-bold shadow-xs'
        : 'bg-rose-100 text-rose-900 border-rose-300 font-bold shadow-xs ring-1 ring-rose-300',
      cardBorderClass: isDarkMode.value
        ? '!border-l-4 !border-l-rose-500 border-rose-900/60 bg-rose-950/15'
        : '!border-l-4 !border-l-rose-600 border-rose-200 bg-rose-50/40 shadow-xs',
      progressPercent,
    };
  }

  // 2. AT RISK / BEHIND SCHEDULE
  // Condition a: Due today and not done
  if (diffDays === 0) {
    return {
      status: 'at_risk',
      isOverdue: false,
      isDelayed: true,
      daysOverdue: 0,
      daysRemaining: 0,
      label: '⚠️ DUE TODAY',
      reason: 'Due today. Focus on completing this task.',
      badgeClass: isDarkMode.value
        ? 'bg-amber-950/90 text-amber-300 border-amber-600 font-bold'
        : 'bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-xs ring-1 ring-amber-300',
      cardBorderClass: isDarkMode.value
        ? '!border-l-4 !border-l-amber-500 border-amber-900/60 bg-amber-950/15'
        : '!border-l-4 !border-l-amber-500 border-amber-200 bg-amber-50/40 shadow-xs',
      progressPercent,
    };
  }

  // Condition b: Time ratio vs progress
  let isBehindTime = false;
  let reasonText = '';
  if (task.start_date) {
    const startDate = new Date(task.start_date + 'T00:00:00');
    const totalDuration = dueDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    if (totalDuration > 0 && elapsed > 0) {
      const timeRatio = elapsed / totalDuration;
      if (timeRatio > 0.55 && progressPercent < 30 && task.status === 'todo') {
        isBehindTime = true;
        reasonText = `${Math.round(timeRatio * 100)}% of the schedule has passed while the task is still To Do.`;
      } else if (timeRatio > 0.7 && progressPercent < 40) {
        isBehindTime = true;
        reasonText = `${Math.round(timeRatio * 100)}% of the schedule has passed, but progress is only ~${progressPercent}%.`;
      }
    }
  }

  // Condition c: Due in 1-2 days with High/Urgent priority and still in Todo
  if (!isBehindTime && diffDays <= 2 && task.status === 'todo' && (task.priority === 'urgent' || task.priority === 'high')) {
    isBehindTime = true;
    reasonText = `${diffDays} days remain, but this high-priority task has not started.`;
  }

  if (isBehindTime) {
    return {
      status: 'at_risk',
      isOverdue: false,
      isDelayed: true,
      daysOverdue: 0,
      daysRemaining: diffDays,
      label: '⚠️ AT RISK',
      reason: reasonText || `Task may miss its due date (${diffDays} days remaining).`,
      badgeClass: isDarkMode.value
        ? 'bg-amber-950/90 text-amber-300 border-amber-600 font-semibold'
        : 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-xs',
      cardBorderClass: isDarkMode.value
        ? '!border-l-4 !border-l-amber-500 border-amber-900/40 bg-amber-950/10'
        : '!border-l-4 !border-l-amber-500 border-amber-200 bg-amber-50/30',
      progressPercent,
    };
  }

  // 3. ON TRACK
  return {
    status: 'on_track',
    isOverdue: false,
    isDelayed: false,
    daysOverdue: 0,
    daysRemaining: diffDays,
    label: `${diffDays} days remaining`,
    reason: `On track. Due date: ${task.due_date}.`,
    badgeClass: isDarkMode.value ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300',
    cardBorderClass: isDarkMode.value ? 'border-slate-800' : 'border-slate-200/90',
    progressPercent,
  };
};

// Summary metrics for warnings
const overdueTasksCount = computed(() => {
  return taskList.value.filter(t => getTaskDelayStatus(t).isOverdue).length;
});

const delayedTasksCount = computed(() => {
  return taskList.value.filter(t => getTaskDelayStatus(t).isDelayed).length;
});

const warningTasksCount = computed(() => {
  return overdueTasksCount.value + delayedTasksCount.value;
});

// Personal command center: daily focus, review and next action.
const dailyFocusTasks = computed(() => taskList.value
  .filter(task => task.status !== 'done')
  .sort((a, b) => {
    const statusRank = (status: string) => status === 'in_progress' ? 0 : status === 'review' ? 1 : 2;
    const priorityRank = (priority: string) => ({ urgent: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4);
    return statusRank(a.status) - statusRank(b.status) || priorityRank(a.priority) - priorityRank(b.priority) || (a.due_date || '9999').localeCompare(b.due_date || '9999');
  })
  .slice(0, 3));

const nextActionTask = computed(() => dailyFocusTasks.value[0] || null);
const completedRecentlyTasks = computed(() => taskList.value
  .filter(task => task.status === 'done')
  .sort((a, b) => String(b.completed_at || b.updated_at || '').localeCompare(String(a.completed_at || a.updated_at || '')))
  .slice(0, 5));
const showDailyReview = ref(false);
const dailyReviewData = ref<{ completed_tasks: TaskItem[]; incompleted_tasks: TaskItem[]; total_pomodoros_done: number } | null>(null);
const isDailyLoading = ref(false);

const startMyDay = () => {
  currentView.value = 'board';
  filterSprintId.value = activeSprint.value ? 'active' : 'all';
  filterHealth.value = 'all';
  sound.playSuccess();
};

const openNextAction = () => {
  if (nextActionTask.value) openTaskDrawer(nextActionTask.value);
  sound.playClick();
};

const openDailyReview = async () => {
  showDailyReview.value = true;
  isDailyLoading.value = true;
  try {
    const res = await axios.get('/api/tasks/daily-review');
    dailyReviewData.value = res.data;
  } catch (err) {
    console.error('Daily review error:', err);
  } finally {
    isDailyLoading.value = false;
  }
};

// Private AI provider settings: the API only returns whether a key exists.
const showAiSettingsModal = ref(false);
const isAiSettingsSaving = ref(false);
const aiSettingsFeedback = ref('');
const aiSettings = ref({
  provider: 'template' as 'template' | 'openai_compatible',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  api_key: '',
  has_api_key: false,
});

const openAiSettings = async () => {
  showAiSettingsModal.value = true;
  aiSettingsFeedback.value = '';
  try {
    const res = await axios.get('/api/tasks/ai-settings');
    if (res.data.success) aiSettings.value = { ...aiSettings.value, ...res.data.data, api_key: '' };
  } catch (err) {
    aiSettingsFeedback.value = 'Unable to load AI settings.';
  }
};

const saveAiSettings = async () => {
  isAiSettingsSaving.value = true;
  aiSettingsFeedback.value = '';
  try {
    const res = await axios.post('/api/tasks/ai-settings', aiSettings.value);
    if (res.data.success) {
      aiSettingsFeedback.value = '✓ Saved securely. The API key will not be shown again.';
      aiSettings.value.api_key = '';
      sound.playSuccess();
    }
  } catch (err: any) {
    aiSettingsFeedback.value = err.response?.data?.message || 'Unable to save AI settings.';
  } finally {
    isAiSettingsSaving.value = false;
  }
};

// Modals & Drawer State
const selectedTask = ref<TaskItem | null>(null);
const selectedDependencyIds = ref<number[]>([]);
const dependencyCandidates = computed(() => {
  const task = selectedTask.value;
  if (!task?.project_id) return [];
  return taskList.value.filter(candidate =>
    candidate.project_id === task.project_id
    && candidate.id !== task.id
    && candidate.issue_type !== 'epic'
  );
});
const selectedAgentRuns = ref<AgentRunItem[]>([]);
const isAgentRunsLoading = ref(false);
const agentRunFeedback = ref('');
const isEditingDescription = ref(false);
const descriptionEditContent = ref('');
const drawerSaveError = ref('');
const isDrawerExpanded = ref(false);
const showCreateModal = ref(false);
const showSprintModal = ref(false);
const showStartSprintModal = ref(false);
const showCompleteSprintModal = ref(false);
const targetSprintForAction = ref<SprintItem | null>(null);
const isSubmitting = ref(false);
const newSubtaskText = ref('');

type ExecutionGate = { allowed: boolean; code: 'ready' | 'blocked' | 'review' | 'done' | 'invalid'; title: string; detail: string; pendingLabels: string[] };
const executionGateFor = (task: TaskItem | null): ExecutionGate => {
  if (!task) return { allowed: false, code: 'invalid', title: 'Select a task first', detail: 'Choose a task from the board before starting execution.', pendingLabels: [] };
  const currentTask = taskList.value.find(candidate => candidate.id === task.id) || task;
  const dependencies = dependencySummary(currentTask);
  if (currentTask.status === 'done') return { allowed: false, code: 'done', title: 'Task already completed', detail: 'Reopen this task on Hub before starting another run.', pendingLabels: [] };
  if (currentTask.status === 'review') return { allowed: false, code: 'review', title: 'Waiting for Hub review', detail: 'Approve or request changes on Hub before starting another run.', pendingLabels: [] };
  if (dependencies.pendingLabels.length) return { allowed: false, code: 'blocked', title: 'Blocked by prerequisites', detail: `Complete ${dependencies.pendingLabels.join(', ')} before dispatching this task.`, pendingLabels: dependencies.pendingLabels };
  return { allowed: true, code: 'ready', title: 'Ready to run', detail: 'Execution can be dispatched to a connected agent.', pendingLabels: [] };
};
const selectedExecutionGate = computed(() => executionGateFor(selectedTask.value));
const guardExecution = (task: TaskItem | null) => {
  const gate = executionGateFor(task);
  if (!gate.allowed) {
    agentRunFeedback.value = `${gate.title}. ${gate.detail}`;
    return false;
  }
  return true;
};

const loadAgentRuns = async (taskId: number) => {
  isAgentRunsLoading.value = true;
  agentRunFeedback.value = '';
  try {
    const res = await axios.get('/api/tasks/agent-runs', { params: { task_id: taskId } });
    selectedAgentRuns.value = res.data.data || [];
  } catch (err) {
    agentRunFeedback.value = 'Unable to load agent run history.';
  } finally {
    isAgentRunsLoading.value = false;
  }
};

const selectedProviderModel = ref<Record<string, string>>({
  codex: 'gpt-5.6-sol',
  claude_code: 'claude-3-7-sonnet-20250219',
  antigravity: 'gemini-3.7-flash',
});

const startAgentRun = async (provider: string, model?: string) => {
  if (!selectedTask.value) return;
  if (!guardExecution(selectedTask.value)) return;
  const targetModel = model || selectedProviderModel.value[provider] || undefined;
  try {
    const res = await axios.post('/api/tasks/agent-runs', {
      task_id: selectedTask.value.id,
      provider,
      model: targetModel,
      execution_mode: 'desktop',
    });
    selectedAgentRuns.value.unshift(res.data.data);
    agentRunFeedback.value = `Created a local ${provider} (${targetModel || 'default'}) run. Open Task Companion to execute it with the agent installed on your machine.`;
  } catch (err: any) {
    agentRunFeedback.value = err.response?.data?.message || 'Unable to create agent run.';
  }
};

// Remote Task Dispatch Modal State & Handlers
const showRemoteDispatchModal = ref(false);
const taskForRemoteDispatch = ref<TaskItem | null>(null);
const initialRunnerForDispatch = ref<number | null>(null);

const openRemoteDispatch = (task?: TaskItem | null, runnerId?: number | null) => {
  if (!guardExecution(task || selectedTask.value)) return;
  taskForRemoteDispatch.value = task || null;
  initialRunnerForDispatch.value = runnerId || null;
  showRemoteDispatchModal.value = true;
  sound.playClick();
};

const handleRunnerDashboardDispatch = (runner: DesktopAgentItem) => {
  const targetTask = selectedTask.value && executionGateFor(selectedTask.value).allowed
    ? selectedTask.value
    : taskList.value.find(task => executionGateFor(task).allowed) || null;
  if (targetTask) openRemoteDispatch(targetTask, runner.id);
  else agentRunFeedback.value = 'No runnable task is available. Resolve prerequisites or finish the current Hub review first.';
};

const handleRemoteDispatched = (payload: { run: any; task: TaskItemProps }) => {
  const idx = taskList.value.findIndex(t => t.id === payload.task.id);
  if (idx !== -1) {
    taskList.value[idx].status = 'in_progress';
  }
  const matchingTask = taskList.value.find(t => t.id === payload.task.id);
  if (matchingTask) {
    openTaskDrawer(matchingTask);
  }
  if (payload.run) {
    selectedAgentRuns.value.unshift(payload.run);
  }
};

// Weekly Email Report Modal State
const showReportModal = ref(false);
const isReportLoading = ref(false);
const isReportSaving = ref(false);
const isReportSending = ref(false);
const reportFeedbackMsg = ref('');
const reportFeedbackType = ref<'success' | 'error'>('success');
const reportForm = ref({
  is_enabled: false,
  recipients: '',
  day_of_week: 'monday',
  send_time: '08:00',
  report_title: 'Weekly Executive Progress & Sprint Report',
  selected_project_ids: ['all'] as (number | string)[],
  include_upcoming: true,
  include_warnings: true,
  last_sent_at: null as string | null,
});

const toggleReportProject = (id: number | string) => {
  sound.playClick();
  if (id === 'all') {
    reportForm.value.selected_project_ids = ['all'];
    return;
  }

  let current = reportForm.value.selected_project_ids.filter(x => x !== 'all');
  const numId = Number(id);
  if (current.includes(numId)) {
    current = current.filter(x => x !== numId);
    if (current.length === 0) {
      current = ['all'];
    }
  } else {
    current.push(numId);
  }
  reportForm.value.selected_project_ids = current;
};

const isReportProjectSelected = (id: number | string) => {
  if (id === 'all') {
    return reportForm.value.selected_project_ids.includes('all') || reportForm.value.selected_project_ids.length === 0;
  }
  if (reportForm.value.selected_project_ids.includes('all')) {
    return false;
  }
  return reportForm.value.selected_project_ids.includes(Number(id));
};

const openReportModal = async () => {
  showReportModal.value = true;
  isReportLoading.value = true;
  reportFeedbackMsg.value = '';
  sound.playClick();

  try {
    const res = await axios.get('/api/tasks/report-settings');
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      if (data.selected_project_ids && Array.isArray(data.selected_project_ids)) {
        reportForm.value = { ...reportForm.value, ...data };
      } else if (data.project_filter && data.project_filter !== 'all') {
        reportForm.value = { ...reportForm.value, ...data, selected_project_ids: [Number(data.project_filter)] };
      } else {
        reportForm.value = { ...reportForm.value, ...data, selected_project_ids: ['all'] };
      }
    }
  } catch (err) {
    console.error('Failed to load report settings:', err);
  } finally {
    isReportLoading.value = false;
  }
};

const handleSaveReportSettings = async () => {
  isReportSaving.value = true;
  reportFeedbackMsg.value = '';
  sound.playClick();

  try {
    const res = await axios.post('/api/tasks/report-settings', reportForm.value);
    if (res.data.success) {
      reportFeedbackMsg.value = '✓ ' + (res.data.message || 'Settings successfully saved');
      reportFeedbackType.value = 'success';
      sound.playSuccess();
    }
  } catch (err: any) {
    console.error('Save report settings error:', err);
    reportFeedbackMsg.value = '✕ ' + (err.response?.data?.message || 'Error saving settings');
    reportFeedbackType.value = 'error';
  } finally {
    isReportSaving.value = false;
  }
};

const handleSendReportNow = async () => {
  if (!reportForm.value.recipients.trim()) {
    alert('Please enter at least one recipient email address!');
    return;
  }

  isReportSending.value = true;
  reportFeedbackMsg.value = '';
  sound.playClick();

  try {
    const res = await axios.post('/api/tasks/send-report-now', {
      email: reportForm.value.recipients,
      project_ids: reportForm.value.selected_project_ids,
    });

    if (res.data.success) {
      reportFeedbackMsg.value = '🚀 ' + (res.data.message || 'Weekly report successfully dispatched!');
      reportFeedbackType.value = 'success';
      if (res.data.sent_at) {
        reportForm.value.last_sent_at = res.data.sent_at;
      }
      sound.playSuccess();
    }
  } catch (err: any) {
    console.error('Send report error:', err);
    reportFeedbackMsg.value = '✕ ' + (err.response?.data?.message || 'Error dispatching report email');
    reportFeedbackType.value = 'error';
  } finally {
    isReportSending.value = false;
  }
};

// Project CRUD Modal State
const showProjectModal = ref(false);
const projectModalMode = ref<'create' | 'edit'>('create');
const editingProjectId = ref<number | null>(null);
const isProjectSubmitting = ref(false);

const projectForm = ref({
  title: '',
  key: '',
  color: '#2563eb',
  description: '',
  tags: '',
  github_repository: '',
  github_default_branch: 'main',
  github_token: '',
  github_webhook_secret: '',
  task_hub_mcp_token: '',
  clear_github_token: false,
  clear_github_webhook_secret: false,
  clear_task_hub_mcp_token: false,
});
const projectGithubStatus = ref<any>(null);
const projectGithubFeedback = ref('');
const isProjectGithubSyncing = ref(false);
const githubRepositories = ref<GithubRepositoryItem[]>([]);
const githubRepositorySearch = ref('');
const selectedGithubRepository = ref<GithubRepositoryItem | null>(null);
const isGithubRepositoriesLoading = ref(false);
const filteredGithubRepositories = computed(() => githubRepositories.value.filter(repo => {
  const query = githubRepositorySearch.value.toLowerCase().trim();
  return !query || (repo.full_name + ' ' + (repo.description || '')).toLowerCase().includes(query);
}));

const logoutGithub = () => router.post('/auth/github/logout');

// =========================================================================
// Model Context Protocol (MCP) & AI Agent Integration State & Handlers
// =========================================================================
const showMcpModal = ref(false);
const selectedMcpProjectId = ref<number | null>(null);
const mcpData = ref<any>(null);
const isMcpLoading = ref(false);
const isMcpGenerating = ref(false);
const isMcpSaving = ref(false);
const customMcpTokenInput = ref('');
const showRawToken = ref(false);
const copiedSnippetType = ref<string | null>(null);
const activeMcpTab = ref<'antigravity' | 'cursor' | 'claude' | 'env' | 'tools'>('antigravity');
const mcpFeedbackMsg = ref('');
const mcpFeedbackType = ref<'success' | 'error'>('success');
const isTestingMcp = ref(false);
const mcpTestStatus = ref<{ tested: boolean; success: boolean; latency?: number; message?: string; toolCount?: number } | null>(null);

const activeMcpProject = computed(() => {
  if (!selectedMcpProjectId.value) return projectList.value[0] || null;
  return projectList.value.find(p => p.id === selectedMcpProjectId.value) || projectList.value[0] || null;
});

const openMcpModal = async (projectId?: number) => {
  sound.playClick();
  showMcpModal.value = true;
  mcpFeedbackMsg.value = '';
  mcpTestStatus.value = null;
  showRawToken.value = false;

  const targetId = projectId || (activeProjectObject.value ? activeProjectObject.value.id : (projectList.value[0]?.id || null));
  if (targetId) {
    selectedMcpProjectId.value = targetId;
    await fetchMcpInfo(targetId);
  }
};

const handleSelectMcpProject = async (id: number) => {
  selectedMcpProjectId.value = id;
  mcpFeedbackMsg.value = '';
  mcpTestStatus.value = null;
  showRawToken.value = false;
  await fetchMcpInfo(id);
};

const fetchMcpInfo = async (projectId: number) => {
  isMcpLoading.value = true;
  try {
    const res = await axios.get(`/api/projects/${projectId}/mcp`);
    if (res.data.success) {
      mcpData.value = res.data.data;
      customMcpTokenInput.value = '';
    }
  } catch (err: any) {
    console.error('Failed to load MCP info:', err);
    mcpFeedbackMsg.value = err.response?.data?.message || 'Unable to load MCP details.';
    mcpFeedbackType.value = 'error';
  } finally {
    isMcpLoading.value = false;
  }
};

const generateMcpTokenForProject = async () => {
  if (!selectedMcpProjectId.value) return;
  isMcpGenerating.value = true;
  mcpFeedbackMsg.value = '';
  mcpTestStatus.value = null;
  sound.playClick();

  try {
    const res = await axios.post(`/api/projects/${selectedMcpProjectId.value}/mcp/generate-token`);
    if (res.data.success) {
      mcpData.value = res.data.data;
      showRawToken.value = true;
      mcpFeedbackMsg.value = '⚡ New secure MCP token generated and saved!';
      mcpFeedbackType.value = 'success';
      sound.playSuccess();
    }
  } catch (err: any) {
    console.error('Failed to generate MCP token:', err);
    mcpFeedbackMsg.value = err.response?.data?.message || 'Unable to generate token.';
    mcpFeedbackType.value = 'error';
  } finally {
    isMcpGenerating.value = false;
  }
};

const saveCustomMcpToken = async () => {
  if (!selectedMcpProjectId.value || !customMcpTokenInput.value.trim()) return;
  isMcpSaving.value = true;
  mcpFeedbackMsg.value = '';
  sound.playClick();

  try {
    const res = await axios.post(`/api/projects/${selectedMcpProjectId.value}/mcp/token`, {
      token: customMcpTokenInput.value.trim(),
    });
    if (res.data.success) {
      mcpData.value = res.data.data;
      showRawToken.value = true;
      customMcpTokenInput.value = '';
      mcpFeedbackMsg.value = '✓ Custom MCP token saved successfully!';
      mcpFeedbackType.value = 'success';
      sound.playSuccess();
    }
  } catch (err: any) {
    console.error('Failed to save custom MCP token:', err);
    mcpFeedbackMsg.value = err.response?.data?.message || 'Unable to save custom token.';
    mcpFeedbackType.value = 'error';
  } finally {
    isMcpSaving.value = false;
  }
};

const clearMcpTokenForProject = async () => {
  if (!selectedMcpProjectId.value) return;
  if (!confirm('Are you sure you want to revoke the MCP token for this project? Any active AI agent connections using this token will stop working.')) return;

  isMcpSaving.value = true;
  mcpFeedbackMsg.value = '';
  mcpTestStatus.value = null;

  try {
    const res = await axios.post(`/api/projects/${selectedMcpProjectId.value}/mcp/token`, { clear: true });
    if (res.data.success) {
      mcpData.value = res.data.data;
      showRawToken.value = false;
      mcpFeedbackMsg.value = 'MCP token revoked.';
      mcpFeedbackType.value = 'success';
      sound.playSuccess();
    }
  } catch (err: any) {
    console.error('Failed to clear MCP token:', err);
    mcpFeedbackMsg.value = err.response?.data?.message || 'Unable to clear token.';
    mcpFeedbackType.value = 'error';
  } finally {
    isMcpSaving.value = false;
  }
};

const copyMcpSnippet = (type: string, text: string) => {
  navigator.clipboard.writeText(text);
  copiedSnippetType.value = type;
  sound.playSuccess();
  setTimeout(() => {
    if (copiedSnippetType.value === type) copiedSnippetType.value = null;
  }, 2500);
};

const testMcpConnection = async () => {
  if (!mcpData.value?.token && !mcpData.value?.has_token) {
    mcpFeedbackMsg.value = 'Generate or enter an MCP token first before testing.';
    mcpFeedbackType.value = 'error';
    return;
  }
  isTestingMcp.value = true;
  mcpTestStatus.value = null;
  sound.playClick();

  const startTime = performance.now();
  try {
    const token = mcpData.value?.token;
    const res = await axios.post('/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { arguments: { project_id: selectedMcpProjectId.value } }
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    const latency = Math.round(performance.now() - startTime);
    if (res.data?.result?.tools) {
      mcpTestStatus.value = {
        tested: true,
        success: true,
        latency,
        toolCount: res.data.result.tools.length,
        message: `MCP Server connected! Protocol v2024-11-05 verified with ${res.data.result.tools.length} active tools (${latency}ms).`
      };
      sound.playSuccess();
    } else if (res.data?.error) {
      mcpTestStatus.value = {
        tested: true,
        success: false,
        latency,
        message: `MCP Error [${res.data.error.code}]: ${res.data.error.message}`
      };
    }
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    mcpTestStatus.value = {
      tested: true,
      success: false,
      latency,
      message: err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Connection test failed'
    };
  } finally {
    isTestingMcp.value = false;
  }
};

// Sprint Form
const sprintForm = ref({
  name: '',
  goal: '',
  duration_weeks: 2,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
});

// Drag & Drop State
const draggedTaskId = ref<number | null>(null);
const dragOverColumn = ref<string | null>(null);
const dragOverSprintId = ref<string | number | null>(null);

// New Task Form
const newTaskForm = ref({
  project_id: null as number | null,
  issue_type: 'task' as TaskItem['issue_type'],
  title: '',
  description: '',
  status: 'todo' as TaskItem['status'],
  priority: 'high' as TaskItem['priority'],
  category: 'backend',
  story_points: 3,
  sprint_id: null as number | null,
  epic_id: null as number | null,
  estimated_pomodoros: 2,
  start_date: new Date().toISOString().split('T')[0],
  due_date: new Date().toISOString().split('T')[0],
});

// =============================================================================
// AI SPRINT & TASK GENERATOR STATE
// =============================================================================
export interface AiTaskItem {
  issue_type: 'epic' | 'story' | 'task' | 'bug';
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  story_points: number;
  status: 'todo' | 'in_progress';
  estimated_pomodoros: number;
  start_date: string;
  due_date: string;
  subtasks: Array<{ text: string }>;
  epic_ref?: string;
  epic_title?: string;
  enabled?: boolean;
}

export interface AiEpicItem {
  title: string;
  description: string;
  story_points?: number;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
}

export interface AiSprintItem {
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'future';
  tasks: AiTaskItem[];
}

export interface AiPlanPreview {
  project: {
    title: string;
    key: string;
    color: string;
    description: string;
  };
  summary: {
    sprint_count: number;
    total_tasks: number;
    total_story_points: number;
    total_pomodoros: number;
    estimated_weeks: number;
    start_date: string;
    end_date: string;
  };
  epics?: AiEpicItem[];
  sprints: AiSprintItem[];
}

const showAiGeneratorModal = ref(false);
const aiGeneratorStep = ref<'input' | 'preview'>('input');
const isAiAnalyzing = ref(false);
const isAiCommitting = ref(false);
const showAiPlanningOptions = ref(false);

const aiForm = ref({
  prompt: '',
  project_id: 'new' as string | number,
  project_title: '',
  project_key: '',
  project_color: '#2563eb',
  sprint_count: 3,
  sprint_duration_weeks: 2,
  start_date: new Date().toISOString().split('T')[0],
});

const aiGeneratedPlan = ref<AiPlanPreview | null>(null);

const aiTemplates = [
  {
    title: 'Multi-channel E-commerce Platform (B2C)',
    label: 'Multi-channel E-commerce Platform (B2C)',
    prompt: 'Build a multi-channel e-commerce platform with payment gateways, a real-time cart, inventory management, a driver mobile app and revenue dashboards.',
  },
  {
    title: 'AI SaaS Platform & Intelligent Chatbot',
    label: 'AI SaaS Platform & Intelligent Chatbot',
    prompt: 'Build an AI SaaS platform with Gemini and OpenAI models, PDF analysis, streaming Q&A and monthly subscriptions.',
  },
  {
    title: 'HR Management & GPS Attendance App',
    label: 'HR Management & GPS Attendance App',
    prompt: 'Build an HR management system with GPS attendance in a Flutter mobile app, multi-level leave approvals and automated payroll exports.',
  },
  {
    title: 'Microservices & Real-time Message Queue',
    label: 'Microservices & Real-time Message Queue',
    prompt: 'Design a microservices backend with Redis messaging, real-time WebSocket notifications, OAuth2 JWT authentication and Docker/Kubernetes CI/CD.',
  },
];

const openAiGeneratorModal = () => {
  aiGeneratorStep.value = 'input';
  aiForm.value = {
    prompt: '',
    project_id: selectedProjectId.value !== 'all' ? selectedProjectId.value : 'new',
    project_title: '',
    project_key: '',
    project_color: '#2563eb',
    sprint_count: 3,
    sprint_duration_weeks: 2,
    start_date: new Date().toISOString().split('T')[0],
  };
  aiGeneratedPlan.value = null;
  showAiPlanningOptions.value = false;
  showAiGeneratorModal.value = true;
  sound.playClick();
};

const selectAiTemplate = (tpl: { title: string; prompt: string }) => {
  aiForm.value.prompt = tpl.prompt;
  aiForm.value.project_title = tpl.title;
  sound.playClick();
};

const handleAnalyzeAiPlan = async () => {
  if (!aiForm.value.prompt.trim()) return;
  isAiAnalyzing.value = true;
  sound.playClick();

  try {
    const payload = {
      prompt: aiForm.value.prompt,
      // Requirement planning is repository-aware. Passing the selected project
      // lets the API include its synced project documents and existing backlog
      // in the read-only preview context.
      project_id: aiForm.value.project_id !== 'new' ? aiForm.value.project_id : undefined,
      project_title: aiForm.value.project_title || undefined,
      project_key: aiForm.value.project_key || undefined,
      project_color: aiForm.value.project_color,
      sprint_count: aiForm.value.sprint_count,
      sprint_duration_weeks: aiForm.value.sprint_duration_weeks,
      start_date: aiForm.value.start_date,
    };

    const res = await axios.post('/api/tasks/ai-preview', payload);
    if (res.data.success) {
      aiGeneratedPlan.value = {
        ...res.data,
        sprints: res.data.sprints.map((sp: AiSprintItem) => ({
          ...sp,
          tasks: (sp.tasks || []).map((t: AiTaskItem) => ({
            ...t,
            enabled: true,
          })),
        })),
      };
      aiGeneratorStep.value = 'preview';
      sound.playSuccess();
    }
  } catch (err) {
    console.error('AI plan preview error:', err);
    alert('Unable to analyze the project request. Please try again.');
  } finally {
    isAiAnalyzing.value = false;
  }
};

const handleCommitAiPlan = async () => {
  if (!aiGeneratedPlan.value) return;
  isAiCommitting.value = true;
  sound.playClick();

  try {
    // Filter only enabled tasks
    const sanitizedPlan = {
      ...aiGeneratedPlan.value,
      sprints: aiGeneratedPlan.value.sprints.map(sp => ({
        ...sp,
        tasks: sp.tasks.filter(t => t.enabled !== false),
      })),
    };

    const payload = {
      plan: sanitizedPlan,
      project_id: aiForm.value.project_id !== 'new' ? aiForm.value.project_id : null,
    };

    const res = await axios.post('/api/tasks/ai-generate', payload);
    if (res.data.success) {
      // 1. Add new Project if created
      if (res.data.project) {
        const existingIdx = projectList.value.findIndex(p => p.id === res.data.project.id);
        if (existingIdx === -1) {
          projectList.value.push(res.data.project);
        } else {
          projectList.value[existingIdx] = res.data.project;
        }
        selectedProjectId.value = res.data.project.id;
      }

      // 2. Add Sprints
      if (res.data.sprints && Array.isArray(res.data.sprints)) {
        res.data.sprints.forEach((sp: SprintItem) => {
          sprintList.value.unshift(sp);
        });
      }

      // 3. Add Tasks
      if (res.data.tasks && Array.isArray(res.data.tasks)) {
        res.data.tasks.forEach((t: TaskItem) => {
          taskList.value.unshift({
            ...t,
            subtasks: t.notes ? tryParseSubtasks(t.notes) : [],
          });
        });
      }

      sound.playSuccess();
      showAiGeneratorModal.value = false;
      currentView.value = 'board';
    }
  } catch (err) {
    console.error('AI commit error:', err);
    alert('Unable to save the generated plan. Please try again.');
  } finally {
    isAiCommitting.value = false;
  }
};

// Quick Date Extension in Task Detail Drawer
const extendDueDate = async (days: number) => {
  if (!selectedTask.value) return;
  const current = selectedTask.value.due_date ? new Date(selectedTask.value.due_date + 'T00:00:00') : new Date();
  current.setDate(current.getDate() + days);
  selectedTask.value.due_date = current.toISOString().split('T')[0];
  sound.playClick();
  await saveTaskDrawerChanges();
};

const increaseTaskPriority = async () => {
  if (!selectedTask.value) return;
  selectedTask.value.priority = 'urgent';
  sound.playClick();
  await saveTaskDrawerChanges();
};

// Computed Properties
const activeProjectObject = computed(() => {
  if (selectedProjectId.value === 'all') {
    return null;
  }
  return projectList.value.find(p => p.id === Number(selectedProjectId.value)) || null;
});

const hasSelectedProject = computed(() => Boolean(activeProjectObject.value));

const loadAgentRunNotifications = async () => {
  try {
    const [review, failed] = await Promise.all([
      axios.get('/api/tasks/agent-runs', { params: { status: 'needs_review' } }),
      axios.get('/api/tasks/agent-runs', { params: { status: 'failed' } }),
    ]);
    const runs = [...(review.data?.data || []), ...(failed.data?.data || [])] as AgentRunItem[];
    const unique = new Map<number, AgentRunItem>();
    runs.forEach(run => unique.set(run.id, run));
    agentRunNotifications.value = [...unique.values()]
      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
      .slice(0, 12);
  } catch (error) {
    console.debug('Agent notification refresh skipped', error);
  }
};

const notificationItems = computed(() => {
  const items: Array<{ id: string; tone: 'warning' | 'info' | 'success'; title: string; detail: string; task?: TaskItem }> = [];
  agentRunNotifications.value.forEach(run => {
    const task = run.task || taskList.value.find(candidate => candidate.id === (run.task_id || 0));
    const issue = task?.issue_key || (run.task_id ? `Task #${run.task_id}` : `Run #${run.id}`);
    items.push({
      id: `agent-run-${run.id}`,
      tone: run.status === 'needs_review' ? 'success' : 'warning',
      title: run.status === 'needs_review' ? `${issue} handoff is ready for review` : `${issue} agent run failed`,
      detail: run.status === 'needs_review' && run.metadata?.handoff?.auto_review?.reviewer_provider
        ? `${task?.title || run.summary || `Provider: ${run.provider}`} · independently reviewed by ${run.metadata.handoff.auto_review.reviewer_provider}`
        : task?.title || run.summary || `Provider: ${run.provider}`,
      task,
    });
  });
  activeProjectTasks.value
    .filter(task => task.status !== 'done' && (getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed))
    .sort((a, b) => Number(getTaskDelayStatus(b).isOverdue) - Number(getTaskDelayStatus(a).isOverdue))
    .slice(0, 6)
    .forEach(task => {
      const delay = getTaskDelayStatus(task);
      items.push({
        id: `risk-${task.id}`,
        tone: 'warning',
        title: delay.isOverdue ? `${task.issue_key} is overdue` : `${task.issue_key} needs attention`,
        detail: task.title,
        task,
      });
    });

  if (activeSprint.value) {
    items.push({
      id: `sprint-${activeSprint.value.id}`,
      tone: 'info',
      title: `${activeSprint.value.name} is active`,
      detail: activeSprint.value.end_date ? `Sprint ends ${activeSprint.value.end_date}.` : 'Keep the current sprint moving.',
    });
  }

  completedRecentlyTasks.value.slice(0, 2).forEach(task => {
    items.push({ id: `done-${task.id}`, tone: 'success', title: `${task.issue_key} completed`, detail: task.title, task });
  });

  return items;
});

const unreadNotificationCount = computed(() => notificationItems.value.filter(item => !readNotificationIds.value.includes(item.id)).length);
const pendingAgentReviews = computed(() => agentRunNotifications.value.filter(run => run.status === 'needs_review'));

const toggleNotifications = () => {
  isNotificationsOpen.value = !isNotificationsOpen.value;
  isAiMenuOpen.value = false;
  sound.playClick();
};

const markAllNotificationsRead = () => {
  readNotificationIds.value = notificationItems.value.map(item => item.id);
  sound.playClick();
};

const openNotification = (item: { id: string; task?: TaskItem }) => {
  if (!readNotificationIds.value.includes(item.id)) readNotificationIds.value.push(item.id);
  if (item.task) openTaskDrawer(item.task);
  isNotificationsOpen.value = false;
};

const activeProjectTasks = computed(() => {
  if (selectedProjectId.value === 'all') return taskList.value.filter(t => t.issue_type !== 'epic');
  return taskList.value.filter(t => t.project_id === Number(selectedProjectId.value) && t.issue_type !== 'epic');
});

const roadmapEpics = computed(() => {
  if (!hasSelectedProject.value) return [];
  return taskList.value.filter(task => task.project_id === Number(selectedProjectId.value) && task.issue_type === 'epic');
});

const roadmapTasks = computed(() => {
  if (!hasSelectedProject.value) return [];
  return taskList.value.filter(task => task.project_id === Number(selectedProjectId.value) && task.issue_type !== 'epic');
});

const expandedRoadmapEpicIds = ref<number[]>([]);
const epicChildren = (epicId: number) => roadmapTasks.value
  .filter(task => task.epic_id === epicId)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
const toggleRoadmapEpic = (epicId: number) => {
  expandedRoadmapEpicIds.value = expandedRoadmapEpicIds.value.includes(epicId)
    ? expandedRoadmapEpicIds.value.filter(id => id !== epicId)
    : [...expandedRoadmapEpicIds.value, epicId];
};

const activeProjectCompletedCount = computed(() => {
  return activeProjectTasks.value.filter(t => t.status === 'done').length;
});

const activeProjectProgressPercent = computed(() => {
  const total = activeProjectTasks.value.length;
  if (total === 0) return 0;
  return Math.round((activeProjectCompletedCount.value / total) * 100);
});

const activeProjectStoryPoints = computed(() => {
  return activeProjectTasks.value.reduce((sum, t) => sum + (t.story_points || 0), 0);
});

const activeProjectWarningCount = computed(() => {
  return activeProjectTasks.value.filter(t => {
    const s = getTaskDelayStatus(t);
    return s.isOverdue || s.isDelayed;
  }).length;
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
    filterHealth.value !== 'all' ||
    filterIssueType.value !== 'all' ||
    filterPriority.value !== 'all' ||
    filterEpicId.value !== 'all';
});

const resetFilters = () => {
  searchQuery.value = '';
  filterHealth.value = 'all';
  filterIssueType.value = 'all';
  filterPriority.value = 'all';
  filterEpicId.value = 'all';
  sound.playClick();
};

const activeSprint = computed(() => {
  return sprintList.value.find(s => s.status === 'active') || null;
});

// Filtered Tasks for Active Board with Warning / Health Filters
const filteredBoardTasks = computed(() => {
  return taskList.value.filter(task => {
    // Epics are high-level roadmap containers, not direct sprint board cards unless explicitly filtered
    if (task.issue_type === 'epic' && filterIssueType.value !== 'epic') {
      return false;
    }

    // Project filter
    if (selectedProjectId.value !== 'all' && task.project_id !== Number(selectedProjectId.value)) return false;

    // Sprint filter
    if (filterSprintId.value === 'active') {
      if (activeSprint.value) {
        if (task.sprint_id !== activeSprint.value.id) return false;
      }
    } else if (filterSprintId.value !== 'all') {
      if (task.sprint_id !== Number(filterSprintId.value)) return false;
    }

    // Search query
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchKey = (task.issue_key || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchKey && !matchDesc) return false;
    }

    // Health / Warning Filter
    if (filterHealth.value !== 'all') {
      const delayInfo = getTaskDelayStatus(task);
      if (filterHealth.value === 'warning') {
        if (!delayInfo.isOverdue && !delayInfo.isDelayed) return false;
      } else if (filterHealth.value === 'overdue') {
        if (!delayInfo.isOverdue) return false;
      } else if (filterHealth.value === 'at_risk') {
        if (!delayInfo.isDelayed) return false;
      } else if (filterHealth.value === 'on_track') {
        if (delayInfo.status !== 'on_track') return false;
      }
    }

    // Issue Type Filter
    if (filterIssueType.value !== 'all' && task.issue_type !== filterIssueType.value) {
      return false;
    }

    // Priority Filter
    if (filterPriority.value !== 'all' && task.priority !== filterPriority.value) {
      return false;
    }

    // Epic Filter
    if (filterEpicId.value !== 'all') {
      if (filterEpicId.value === 'none') {
        if (task.epic_id !== null) return false;
      } else {
        if (task.epic_id !== Number(filterEpicId.value)) return false;
      }
    }

    return true;
  });
});

// Smart Sort Score for Tasks: Status (In Progress > Todo > Review > Done) + Priority (Urgent > High > Medium > Low)
const getTaskSortScore = (task: TaskItem) => {
  let score = 0;
  if (task.status === 'in_progress') score += 1000;
  else if (task.status === 'todo') score += 800;
  else if (task.status === 'review') score += 400;
  else if (task.status === 'done') score += 100;

  if (task.priority === 'urgent') score += 400;
  else if (task.priority === 'high') score += 300;
  else if (task.priority === 'medium') score += 200;
  else if (task.priority === 'low') score += 100;

  score += Math.min(task.id || 0, 99) * 0.01;
  return score;
};

const taskExecutionMeta = (task: TaskItem) => {
  const summary = dependencySummary(task);
  return {
    blocked: summary.pendingLabels.length > 0,
    dependents: summary.dependents,
    reconsidered: task.status === 'done' && summary.pendingLabels.length > 0,
    dependentReconsideration: summary.dependents.filter(issueKey => {
      const dependent = taskList.value.find(candidate => (candidate.issue_key || `#${candidate.id}`) === issueKey);
      return dependent && dependent.status !== 'todo';
    }),
  };
};
const dependencyAwareSort = (a: TaskItem, b: TaskItem) => {
  const aMeta = taskExecutionMeta(a);
  const bMeta = taskExecutionMeta(b);
  if (aMeta.blocked !== bMeta.blocked) return Number(aMeta.blocked) - Number(bMeta.blocked);
  return getTaskSortScore(b) - getTaskSortScore(a);
};

// Board Columns (Smart Sorted by Priority & Score)
const todoTasks = computed(() => [...filteredBoardTasks.value.filter(t => t.status === 'todo')].sort(dependencyAwareSort));
const inProgressTasks = computed(() => [...filteredBoardTasks.value.filter(t => t.status === 'in_progress')].sort(dependencyAwareSort));
const reviewTasks = computed(() => [...filteredBoardTasks.value.filter(t => t.status === 'review')].sort(dependencyAwareSort));
const doneTasks = computed(() => [...filteredBoardTasks.value.filter(t => t.status === 'done')].sort(dependencyAwareSort));

const webNextUpTaskId = computed(() => {
  const candidates = filteredBoardTasks.value.filter(t => ['in_progress', 'todo'].includes(t.status) && t.issue_type !== 'epic');
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => getTaskSortScore(b) - getTaskSortScore(a));
  return sorted[0]?.id || null;
});

// Backlog Pool Tasks (No sprint assigned, excluding epics, sorted by priority)
const backlogTasks = computed(() => {
  return taskList.value
    .filter(task => {
      if (selectedProjectId.value !== 'all' && task.project_id !== Number(selectedProjectId.value)) return false;
      return task.sprint_id === null && task.issue_type !== 'epic';
    })
    .sort((a, b) => getTaskSortScore(b) - getTaskSortScore(a));
});

const getSprintTasks = (sprintId: number) => {
  return taskList.value.filter(t => t.sprint_id === sprintId && t.issue_type !== 'epic');
};

const getSprintStats = (sprintId: number) => {
  const tasks = getSprintTasks(sprintId);
  const totalPts = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const donePts = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
  const inProgressPts = tasks.filter(t => t.status === 'in_progress' || t.status === 'review').reduce((sum, t) => sum + (t.story_points || 0), 0);
  const todoPts = tasks.filter(t => t.status === 'todo').reduce((sum, t) => sum + (t.story_points || 0), 0);

  const donePercent = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
  const inProgressPercent = totalPts > 0 ? Math.round((inProgressPts / totalPts) * 100) : 0;
  const todoPercent = totalPts > 0 ? Math.max(0, 100 - donePercent - inProgressPercent) : 0;

  return {
    totalTasks: tasks.length,
    doneTasks: tasks.filter(t => t.status === 'done').length,
    inProgressTasks: tasks.filter(t => t.status === 'in_progress' || t.status === 'review').length,
    todoTasks: tasks.filter(t => t.status === 'todo').length,
    totalPts,
    donePts,
    inProgressPts,
    todoPts,
    donePercent,
    inProgressPercent,
    todoPercent,
  };
};

// High-Contrast Adaptive Badges for Light & Dark Modes
const getIssueTypeBadge = (type: string) => {
  switch (type) {
    case 'epic':
      return {
        label: 'EPIC',
        icon: 'Zap',
        class: isDarkMode.value
          ? 'bg-purple-950/70 text-purple-300 border-purple-700/60 shadow-[0_0_8px_rgba(168,85,247,0.2)] font-bold'
          : 'bg-purple-50 text-purple-700 border-purple-300 font-bold shadow-xs'
      };
    case 'story':
      return {
        label: 'STORY',
        icon: 'BookOpen',
        class: isDarkMode.value
          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-semibold'
          : 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shadow-xs'
      };
    case 'bug':
      return {
        label: 'BUG',
        icon: 'Bug',
        class: isDarkMode.value
          ? 'bg-rose-950/70 text-rose-300 border-rose-700/60 shadow-[0_0_8px_rgba(244,63,94,0.2)] font-semibold'
          : 'bg-rose-50 text-rose-700 border-rose-300 font-bold shadow-xs'
      };
    case 'task':
    default:
      return {
        label: 'TASK',
        icon: 'CheckSquare',
        class: isDarkMode.value
          ? 'bg-blue-950/70 text-blue-300 border-blue-700/60 font-semibold'
          : 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-xs'
      };
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Urgent',
        icon: 'Flame',
        class: isDarkMode.value
          ? 'bg-rose-950/80 text-rose-300 border-rose-600/80 shadow-[0_0_12px_rgba(244,63,94,0.35)] font-bold'
          : 'bg-rose-50 text-rose-700 border-rose-300 font-bold shadow-xs'
      };
    case 'high':
      return {
        label: 'High',
        icon: 'ChevronsUp',
        class: isDarkMode.value
          ? 'bg-amber-950/70 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.2)] font-semibold'
          : 'bg-amber-50 text-amber-700 border-amber-300 font-bold shadow-xs'
      };
    case 'medium':
      return {
        label: 'Medium',
        icon: 'ChevronUp',
        class: isDarkMode.value
          ? 'bg-sky-950/60 text-sky-300 border-sky-600/60 font-medium'
          : 'bg-sky-50 text-sky-700 border-sky-300 font-semibold shadow-xs'
      };
    case 'low':
    default:
      return {
        label: 'Low',
        icon: 'Minus',
        class: isDarkMode.value
          ? 'bg-slate-900/80 text-slate-400 border-slate-700/60 font-medium'
          : 'bg-slate-100 text-slate-700 border-slate-300 font-semibold shadow-xs'
      };
  }
};

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'ai_agent':
      return {
        label: 'AI Agent',
        class: isDarkMode.value
          ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
          : 'bg-purple-100 text-purple-950 border-purple-300 font-bold shadow-xs'
      };
    case 'backend':
      return {
        label: 'Backend',
        class: isDarkMode.value
          ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
          : 'bg-blue-100 text-blue-950 border-blue-300 font-bold shadow-xs'
      };
    case 'frontend':
      return {
        label: 'Frontend',
        class: isDarkMode.value
          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
          : 'bg-cyan-100 text-cyan-950 border-cyan-300 font-bold shadow-xs'
      };
    case 'infra':
      return {
        label: 'Infra',
        class: isDarkMode.value
          ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
          : 'bg-amber-100 text-amber-950 border-amber-300 font-bold shadow-xs'
      };
    case 'mindful':
      return {
        label: 'Mindful',
        class: isDarkMode.value
          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
          : 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold shadow-xs'
      };
    default:
      return {
        label: category,
        class: isDarkMode.value
          ? 'bg-slate-800 text-slate-300 border-slate-700'
          : 'bg-slate-100 text-slate-900 border-slate-300 font-semibold shadow-xs'
      };
  }
};

const getProjectTaskCount = (projectId: string | number) => {
  if (projectId === 'all') return taskList.value.length;
  return taskList.value.filter(t => t.project_id === Number(projectId)).length;
};

// Lightweight High-Contrast Markdown Formatter
const formatMarkdown = (content: string | null): string => {
  if (!content) return '';

  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Format Code Blocks ```lang ... ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 shadow-md">
      <div class="px-3.5 py-1.5 bg-slate-900 text-[11px] font-mono text-slate-400 border-b border-slate-800 flex items-center justify-between font-bold">
        <span>${lang ? lang.toUpperCase() : 'CODE'}</span>
      </div>
      <pre class="p-3.5 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed font-semibold"><code>${code.trim()}</code></pre>
    </div>`;
  });

  // Format Headings
  html = html
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-bold font-display uppercase tracking-wider text-slate-900 dark:text-slate-100 mt-3 mb-1.5">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-950 dark:text-white mt-3.5 mb-1.5 border-b border-slate-200 dark:border-slate-800 pb-1">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-slate-950 dark:text-white mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-slate-950 dark:text-white mt-4 mb-2">$1</h1>');

  // Format Bold & Italic
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-950 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-700 dark:text-slate-300">$1</em>');

  // Format Bullet Points
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-800 dark:text-slate-200 my-0.5 font-medium">$1</li>');

  // Format Paragraphs
  html = html.replace(/\n\n/g, '<div class="h-2"></div>');

  return html;
};

// SPRINT ACTIONS
const openCreateSprintModal = () => {
  sprintForm.value = {
    name: `Sprint ${sprintList.value.length + 1} — `,
    goal: '',
    duration_weeks: 2,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  };
  showSprintModal.value = true;
  sound.playClick();
};

const handleSaveSprint = async () => {
  if (!sprintForm.value.name.trim()) return;
  const projectId = selectedProjectId.value !== 'all'
    ? Number(selectedProjectId.value)
    : projectList.value[0]?.id;
  if (!projectId) {
    openCreateProjectModal();
    return;
  }
  isSubmitting.value = true;

  try {
    const payload = {
      project_id: projectId,
      name: sprintForm.value.name,
      goal: sprintForm.value.goal,
      start_date: sprintForm.value.start_date,
      end_date: sprintForm.value.end_date || null,
      status: 'future',
    };

    const res = await axios.post('/api/sprints', payload);
    if (res.data.success) {
      sprintList.value.unshift(res.data.data);
      sound.playSuccess();
      showSprintModal.value = false;
    }
  } catch (err) {
    console.error('Create sprint error:', err);
    alert('Unable to create the sprint. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const openStartSprintModal = (sprint: SprintItem) => {
  targetSprintForAction.value = sprint;
  showStartSprintModal.value = true;
  sound.playClick();
};

const confirmStartSprint = async () => {
  if (!targetSprintForAction.value) return;
  isSubmitting.value = true;

  try {
    const res = await axios.post(`/api/sprints/${targetSprintForAction.value.id}/start`, {
      duration_weeks: 2,
    });
    if (res.data.success) {
      sprintList.value.forEach(s => {
        if (s.id === targetSprintForAction.value?.id) {
          s.status = 'active';
        }
      });
      sound.playSuccess();
      showStartSprintModal.value = false;
    }
  } catch (err) {
    console.error('Start sprint error:', err);
    alert('Unable to start the sprint.');
  } finally {
    isSubmitting.value = false;
  }
};

const openCompleteSprintModal = (sprint: SprintItem) => {
  targetSprintForAction.value = sprint;
  showCompleteSprintModal.value = true;
  sound.playClick();
};

const confirmCompleteSprint = async () => {
  if (!targetSprintForAction.value) return;
  isSubmitting.value = true;

  try {
    const res = await axios.post(`/api/sprints/${targetSprintForAction.value.id}/complete`, {
      move_incomplete_to: 'backlog',
    });
    if (res.data.success) {
      const idx = sprintList.value.findIndex(s => s.id === targetSprintForAction.value?.id);
      if (idx !== -1) sprintList.value[idx].status = 'completed';

      taskList.value.forEach(t => {
        if (t.sprint_id === targetSprintForAction.value?.id && t.status !== 'done') {
          t.sprint_id = null;
        }
      });

      sound.playSuccess();
      showCompleteSprintModal.value = false;
    }
  } catch (err) {
    console.error('Complete sprint error:', err);
    alert('Unable to complete the sprint.');
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteSprint = async (sprint: SprintItem) => {
  if (!confirm(`Delete sprint "${sprint.name}"?\n(All sprint tasks will be moved safely to the backlog.)`)) return;

  try {
    await axios.delete(`/api/sprints/${sprint.id}`);
    sprintList.value = sprintList.value.filter(s => s.id !== sprint.id);
    taskList.value.forEach(t => {
      if (t.sprint_id === sprint.id) t.sprint_id = null;
    });
    sound.playClick();
  } catch (err) {
    console.error('Delete sprint failed:', err);
    alert('Unable to delete the sprint.');
  }
};

// PROJECT CRUD
const generateProjectMcpToken = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    projectForm.value.task_hub_mcp_token = `th_mcp_${token}`;
  } else {
    projectForm.value.task_hub_mcp_token = `th_mcp_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  }
};

const openCreateProjectModal = () => {
  projectModalMode.value = 'create';
  editingProjectId.value = null;
  projectForm.value = {
    title: '',
    key: '',
    color: '#2563eb',
    description: '',
    tags: '',
    github_repository: '',
    github_default_branch: 'main',
    github_token: '',
    github_webhook_secret: '',
    task_hub_mcp_token: '',
    clear_github_token: false,
    clear_github_webhook_secret: false,
    clear_task_hub_mcp_token: false,
  };
  projectGithubStatus.value = null;
  projectGithubFeedback.value = '';
  showProjectModal.value = true;
  githubRepositorySearch.value = '';
  selectedGithubRepository.value = null;
  if (props.auth?.user) loadGithubRepositories();
  activeProjectMenuId.value = null;
  sound.playClick();
};

const openEditProjectModal = (project: ProjectItem) => {
  projectModalMode.value = 'edit';
  editingProjectId.value = project.id;
  projectForm.value = {
    title: project.title,
    key: project.key || '',
    color: project.color || '#2563eb',
    description: project.description || '',
    tags: (project.tags || []).join(', '),
    github_repository: project.github_repository || '',
    github_default_branch: project.github_default_branch || 'main',
    github_token: '',
    github_webhook_secret: '',
    task_hub_mcp_token: '',
    clear_github_token: false,
    clear_github_webhook_secret: false,
    clear_task_hub_mcp_token: false,
  };
  projectGithubStatus.value = null;
  projectGithubFeedback.value = '';
  loadProjectGithubStatus(project.id);
  showProjectModal.value = true;
  activeProjectMenuId.value = null;
  sound.playClick();
};

const loadGithubRepositories = async () => {
  isGithubRepositoriesLoading.value = true;
  projectGithubFeedback.value = '';
  try {
    const res = await axios.get('/api/projects/github/repositories');
    githubRepositories.value = res.data.data || [];
  } catch (err: any) {
    projectGithubFeedback.value = err.response?.data?.message || 'Unable to load GitHub repositories.';
  } finally {
    isGithubRepositoriesLoading.value = false;
  }
};

const handleSaveProject = async () => {
  if (projectModalMode.value === 'create' && !selectedGithubRepository.value) {
    projectGithubFeedback.value = 'Select a GitHub repository before creating the project.';
    return;
  }
  if (projectModalMode.value === 'edit' && !projectForm.value.title.trim()) return;
  isProjectSubmitting.value = true;

  try {
    if (projectModalMode.value === 'create') {
      const res = await axios.post('/api/projects/from-github', { repository: selectedGithubRepository.value!.full_name, color: projectForm.value.color });
      if (res.data.success) {
        const created: ProjectItem = res.data.data;
        if (projectForm.value.tags.trim()) {
          await axios.patch(`/api/projects/${created.id}`, { tags: projectForm.value.tags.split(',').map(tag => tag.trim()).filter(Boolean) });
        }
        if (projectForm.value.github_repository.trim()) {
          await axios.post(`/api/projects/${created.id}/github/connect`, projectForm.value);
        }
        projectList.value.push(created);
        selectedProjectId.value = created.id;
        sound.playSuccess();
        showProjectModal.value = false;
      }
    } else if (projectModalMode.value === 'edit' && editingProjectId.value) {
      const res = await axios.patch(`/api/projects/${editingProjectId.value}`, {
        ...projectForm.value,
        tags: projectForm.value.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      });
      if (res.data.success) {
        const updated: ProjectItem = res.data.data;
        const idx = projectList.value.findIndex(p => p.id === updated.id);
        if (idx !== -1) projectList.value[idx] = updated;

        taskList.value.forEach(t => {
          if (t.project_id === updated.id) t.project = updated;
        });

        if (projectForm.value.github_repository.trim()) {
          const integration = await axios.post(`/api/projects/${updated.id}/github/connect`, projectForm.value);
          Object.assign(updated, { ...integration.data.data, github_repository: projectForm.value.github_repository, github_default_branch: projectForm.value.github_default_branch });
          projectGithubStatus.value = integration.data.data;
        }

        sound.playSuccess();
        showProjectModal.value = false;
      }
    }
  } catch (err: any) {
    console.error('Save project error:', err);
    const { handleQuotaError } = useUpgradeModal();
    const quotaHandled = handleQuotaError(err);
    if (!quotaHandled) {
      const message = err.response?.data?.message || 'Unable to save the project. Please try again.';
      projectGithubFeedback.value = message;
      alert(message);
    } else {
      showProjectModal.value = false;
    }
  } finally {
    isProjectSubmitting.value = false;
  }
};

const loadProjectGithubStatus = async (projectId: number) => {
  try {
    const res = await axios.get(`/api/projects/${projectId}/github`);
    projectGithubStatus.value = res.data.data;
    if (projectModalMode.value === 'edit') {
      projectForm.value.github_repository = res.data.data.repository || projectForm.value.github_repository;
      projectForm.value.github_default_branch = res.data.data.default_branch || projectForm.value.github_default_branch;
    }
  } catch (err) {
    projectGithubFeedback.value = 'Unable to load GitHub status.';
  }
};

const syncProjectGithub = async () => {
  if (!editingProjectId.value) return;
  isProjectGithubSyncing.value = true;
  projectGithubFeedback.value = '';
  try {
    const res = await axios.post(`/api/projects/${editingProjectId.value}/github/sync`);
    projectGithubStatus.value = res.data.data;
    projectGithubFeedback.value = '✓ Loaded the repository, open issues and pull requests from GitHub.';
  } catch (err: any) {
    projectGithubFeedback.value = err.response?.data?.message || 'Unable to sync GitHub.';
  } finally {
    isProjectGithubSyncing.value = false;
  }
};

const handleDeleteProject = async (project: ProjectItem) => {
  activeProjectMenuId.value = null;
  if (!confirm(`Delete project "${project.title}"?\n(The project must have no tasks.)`)) {
    return;
  }

  try {
    await axios.delete(`/api/projects/${project.id}`);
    projectList.value = projectList.value.filter(p => p.id !== project.id);
    if (selectedProjectId.value === project.id) selectedProjectId.value = 'all';
    sound.playClick();
  } catch (err) {
    console.error('Delete project failed:', err);
    alert('Unable to delete the project.');
  }
};

// TASK / ISSUE CRUD & DRAWER
const openCreateTaskModal = () => {
  const projectId = selectedProjectId.value !== 'all'
    ? Number(selectedProjectId.value)
    : projectList.value[0]?.id;
  if (!projectId) {
    openCreateProjectModal();
    return;
  }
  newTaskForm.value = {
    project_id: projectId,
    issue_type: 'task',
    title: '',
    description: '',
    status: 'todo',
    priority: 'high',
    category: 'backend',
    story_points: 3,
    sprint_id: activeSprint.value ? activeSprint.value.id : null,
    epic_id: null,
    estimated_pomodoros: 2,
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
  };
  showCreateModal.value = true;
  sound.playClick();
};

const handleCreateTask = async () => {
  if (!newTaskForm.value.title.trim()) return;
  if (newTaskForm.value.issue_type === 'epic') {
    newTaskForm.value.sprint_id = null;
    newTaskForm.value.epic_id = null;
  }
  isSubmitting.value = true;

  try {
    const res = await axios.post('/api/tasks', newTaskForm.value);
    if (res.data.success) {
      const created: TaskItem = {
        ...res.data.data,
        subtasks: [],
      };
      taskList.value.unshift(created);
      showCreateModal.value = false;
      sound.playSuccess();
    }
  } catch (err) {
    console.error('Create task failed:', err);
    alert('Unable to create the task.');
  } finally {
    isSubmitting.value = false;
  }
};

const handleQuickCreate = async (targetSprintId: number | null = null) => {
  if (!quickInputText.value.trim()) return;
  const projectId = selectedProjectId.value !== 'all'
    ? Number(selectedProjectId.value)
    : projectList.value[0]?.id;
  if (!projectId) {
    openCreateProjectModal();
    return;
  }
  const title = quickInputText.value.trim();
  quickInputText.value = '';

  try {
    const payload = {
      title,
      project_id: projectId,
      issue_type: 'task',
      status: 'todo',
      priority: 'high',
      category: 'backend',
      story_points: 2,
      sprint_id: targetSprintId !== null ? targetSprintId : (activeSprint.value?.id || null),
    };

    const res = await axios.post('/api/tasks', payload);
    if (res.data.success) {
      const created: TaskItem = {
        ...res.data.data,
        subtasks: [],
      };
      taskList.value.unshift(created);
      sound.playClick();
    }
  } catch (err) {
    console.error('Quick task create error:', err);
  }
};

const openTaskDrawer = (task: TaskItem) => {
  drawerSaveError.value = '';
  selectedTask.value = { ...task };
  selectedDependencyIds.value = (task.dependencies || []).map(dependency => dependency.depends_on_task_id);
  selectedAgentRuns.value = [];
  loadAgentRuns(task.id);
  descriptionEditContent.value = task.description || '';
  isEditingDescription.value = false;
  sound.playClick();
};

const closeTaskDrawer = () => {
  selectedTask.value = null;
  selectedDependencyIds.value = [];
  isEditingDescription.value = false;
  drawerSaveError.value = '';
};

const saveTaskDrawerChanges = async () => {
  if (!selectedTask.value) return;
  const task = selectedTask.value;

  if (task.issue_type === 'epic') {
    task.sprint_id = null;
    task.epic_id = null;
  }

  if (isEditingDescription.value) {
    task.description = descriptionEditContent.value;
  }

  task.notes = JSON.stringify(task.subtasks || []);

  drawerSaveError.value = '';
  const idx = taskList.value.findIndex(t => t.id === task.id);
  const previousTask = idx !== -1 ? { ...taskList.value[idx] } : null;
  if (idx !== -1) {
    taskList.value[idx] = { ...task };
  }

  try {
    const response = await axios.patch(`/api/tasks/${task.id}`, {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      issue_type: task.issue_type,
      category: task.category,
      story_points: task.story_points,
      sprint_id: task.sprint_id,
      epic_id: task.epic_id,
      project_id: task.project_id,
      estimated_pomodoros: task.estimated_pomodoros,
      completed_pomodoros: task.completed_pomodoros,
      start_date: task.start_date,
      due_date: task.due_date,
      notes: task.notes,
      acceptance_criteria: task.acceptance_criteria,
      definition_of_done: task.definition_of_done,
      risk_level: task.risk_level,
      depends_on_task_ids: selectedDependencyIds.value,
    });
    const updated = response.data?.data;
    if (updated && idx !== -1) {
      const hydrated = { ...taskList.value[idx], ...updated, subtasks: updated.notes ? tryParseSubtasks(updated.notes) : task.subtasks };
      taskList.value[idx] = hydrated;
      selectedTask.value = { ...hydrated };
      selectedDependencyIds.value = (updated.dependencies || []).map((dependency: { depends_on_task_id: number }) => dependency.depends_on_task_id);
    }
  } catch (err: any) {
    if (previousTask && idx !== -1) taskList.value[idx] = previousTask;
    drawerSaveError.value = err.response?.data?.message || 'Unable to save this task. Your latest change was not applied.';
  }
};

const updateTaskStatus = async (task: TaskItem, newStatus: TaskItem['status']) => {
  task.status = newStatus;
  if (newStatus === 'done') {
    task.completed_at = new Date().toISOString();
    sound.playSuccess();
  } else {
    task.completed_at = null;
    sound.playClick();
  }

  try {
    await axios.patch(`/api/tasks/${task.id}`, { status: newStatus });
  } catch (err) {
    console.error('Failed to update status:', err);
  }
};

const addSubtask = () => {
  if (!selectedTask.value || !newSubtaskText.value.trim()) return;
  if (!selectedTask.value.subtasks) selectedTask.value.subtasks = [];

  selectedTask.value.subtasks.push({
    id: 'st-' + Date.now(),
    text: newSubtaskText.value.trim(),
    done: false,
  });

  newSubtaskText.value = '';
  sound.playClick();
  saveTaskDrawerChanges();
};

const toggleSubtask = (st: SubtaskItem) => {
  st.done = !st.done;
  sound.playClick();
  saveTaskDrawerChanges();
};

const deleteSubtask = (stId: string) => {
  if (!selectedTask.value || !selectedTask.value.subtasks) return;
  selectedTask.value.subtasks = selectedTask.value.subtasks.filter(s => s.id !== stId);
  sound.playClick();
  saveTaskDrawerChanges();
};

const deleteTask = async (task: TaskItem) => {
  if (!confirm(`Delete issue "${task.issue_key || ''} — ${task.title}"?`)) return;

  try {
    await axios.delete(`/api/tasks/${task.id}`);
    taskList.value = taskList.value.filter(t => t.id !== task.id);
    if (selectedTask.value?.id === task.id) selectedTask.value = null;
    sound.playClick();
  } catch (err) {
    console.error('Delete task error:', err);
    alert('Unable to delete the task.');
  }
};

const deleteEpicFromRoadmap = async (epic: TaskItem) => {
  const childTasks = taskList.value.filter(task => task.epic_id === epic.id);
  const childMessage = childTasks.length
    ? `\n\n${childTasks.length} linked task${childTasks.length === 1 ? '' : 's'} will be kept and moved out of this Epic.`
    : '';
  if (!confirm(`Delete Epic "${epic.issue_key || ''} — ${epic.title}"? This cannot be undone.${childMessage}`)) return;

  try {
    await axios.delete(`/api/tasks/${epic.id}`);
    taskList.value = taskList.value
      .filter(task => task.id !== epic.id)
      .map(task => task.epic_id === epic.id ? { ...task, epic_id: null, epic: null } : task);
    if (selectedTask.value?.id === epic.id) selectedTask.value = null;
    if (filterEpicId.value === epic.id) filterEpicId.value = 'all';
    sound.playSuccess();
  } catch (err) {
    console.error('Delete Epic error:', err);
    alert('Unable to delete the Epic. Your tasks were not changed.');
  }
};

const exportRoadmapWorkbook = async () => {
  if (!activeProjectObject.value || isRoadmapExporting.value) return;
  isRoadmapExporting.value = true;
  try {
    const response = await axios.get(`/api/projects/${activeProjectObject.value.id}/roadmap-export`, { responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || `${activeProjectObject.value.slug || 'project'}-roadmap.xlsx`;
    const url = URL.createObjectURL(new Blob([response.data], { type: (response.headers['content-type'] as string) || undefined }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    sound.playSuccess();
  } catch (error) {
    console.error('Roadmap Excel export failed:', error);
    alert('Unable to create the Excel workbook. Please try again.');
  } finally {
    isRoadmapExporting.value = false;
  }
};

// DRAG & DROP HANDLERS
const onDragStart = (e: DragEvent, taskId: number) => {
  draggedTaskId.value = taskId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
  }
};

const onDragOverColumn = (e: DragEvent, status: string) => {
  e.preventDefault();
  dragOverColumn.value = status;
};

const onDropColumn = async (targetStatus: TaskItem['status']) => {
  dragOverColumn.value = null;
  if (!draggedTaskId.value) return;

  const task = taskList.value.find(t => t.id === draggedTaskId.value);
  if (task && task.status !== targetStatus) {
    await updateTaskStatus(task, targetStatus);
  }
  draggedTaskId.value = null;
};

const onDragOverSprint = (e: DragEvent, sprintId: string | number) => {
  e.preventDefault();
  dragOverSprintId.value = sprintId;
};

const onDropSprint = async (targetSprintId: number | null) => {
  dragOverSprintId.value = null;
  if (!draggedTaskId.value) return;

  const task = taskList.value.find(t => t.id === draggedTaskId.value);
  if (task && task.issue_type !== 'epic' && task.sprint_id !== targetSprintId) {
    task.sprint_id = targetSprintId;
    sound.playClick();

    try {
      await axios.patch(`/api/tasks/${task.id}`, { sprint_id: targetSprintId });
    } catch (err) {
      console.error('Failed to move task to sprint:', err);
    }
  }
  draggedTaskId.value = null;
};

// Global Keyboard Handler
const handleGlobalKey = (e: KeyboardEvent) => {
  if (!isPinUnlocked.value) {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      handleNumpadPress(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleNumpadBackspace();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      checkPin();
    }
    return;
  }

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
    if (e.key === 'Escape') {
      (e.target as HTMLElement).blur();
      closeTaskDrawer();
      showProjectModal.value = false;
      showCreateModal.value = false;
      showSprintModal.value = false;
      showAiSettingsModal.value = false;
      showDailyReview.value = false;
      activeProjectMenuId.value = null;
    }
    return;
  }

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openCreateTaskModal();
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    openCreateProjectModal();
  } else if (e.key === 'g' || e.key === 'G') {
    keyboardSequence.value = 'g';
    window.setTimeout(() => { keyboardSequence.value = ''; }, 1200);
  } else if ((e.key === 't' || e.key === 'T') && keyboardSequence.value === 'g') {
    e.preventDefault();
    keyboardSequence.value = '';
    selectedProjectId.value = 'all';
    currentView.value = 'board';
    filterHealth.value = 'all';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (e.key === '/') {
    e.preventDefault();
    searchInputRef.value?.focus();
  } else if (e.key === '1') {
    currentView.value = 'board';
  } else if (e.key === '2') {
    currentView.value = 'backlog';
  } else if (e.key === '3') {
    currentView.value = 'roadmap';
  } else if (e.key === 'Escape') {
    closeTaskDrawer();
    showCreateModal.value = false;
    showSprintModal.value = false;
    showStartSprintModal.value = false;
    showCompleteSprintModal.value = false;
    showProjectModal.value = false;
    showAiSettingsModal.value = false;
    showDailyReview.value = false;
    activeProjectMenuId.value = null;
  }
};

const closeAllMenus = () => {
  activeProjectMenuId.value = null;
  isAiMenuOpen.value = false;
  isWorkspaceMenuOpen.value = false;
};

onMounted(() => {
  const savedPin = sessionStorage.getItem('macatung_tasks_pin_auth');
  if (savedPin === '301095') {
    isPinUnlocked.value = true;
  }

  const savedTheme = localStorage.getItem('macatung_tasks_theme');
  isDarkMode.value = savedTheme === 'dark';

  window.addEventListener('keydown', handleGlobalKey);
  window.addEventListener('click', closeAllMenus);
  void loadAgentRunNotifications();
  notificationPollTimer = window.setInterval(() => { void loadAgentRunNotifications(); }, 10000);

  // Allow the desktop mascot to deep-link into the same actions as the web
  // header without duplicating the modal implementations.
  const requestedAction = new URLSearchParams(window.location.search).get('open');
  if (requestedAction === 'ai-plan') openAiGeneratorModal();
  if (requestedAction === 'email-report') openReportModal();
  if (requestedAction === 'ai-settings') openAiSettings();
  const requestedTaskId = Number(new URLSearchParams(window.location.search).get('task_id') || new URLSearchParams(window.location.search).get('task') || 0);
  if (requestedTaskId) {
    const requestedTask = taskList.value.find(task => task.id === requestedTaskId);
    if (requestedTask) openTaskDrawer(requestedTask);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
  window.removeEventListener('click', closeAllMenus);
  if (notificationPollTimer !== null) window.clearInterval(notificationPollTimer);
});
</script>

<template>
  <Head title="Midnight Hub — Delivery workspace" />

  <div
    :class="[
      'tasks-page minimal-theme h-screen w-screen overflow-hidden font-sans flex flex-col transition-colors duration-150 select-none selection:bg-phantom-mint selection:text-midnight-950 relative',
      isDarkMode ? 'dark bg-midnight-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    ]"
  >
    <!-- Ambient Background Glows (matching landing page) -->
    <div v-if="isDarkMode" class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[450px] w-[900px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-cyan-500/10 to-purple-600/10 blur-[140px]" />
      <div class="absolute top-[400px] -left-40 h-[400px] w-[600px] rounded-full bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-transparent blur-[130px]" />
      <div class="absolute bottom-10 -right-40 h-[500px] w-[700px] rounded-full bg-gradient-to-tl from-emerald-600/15 via-teal-500/10 to-transparent blur-[150px]" />
    </div>

    <!-- ========================================================================= -->
    <!-- 1. TOP NAVBAR (STICKY GLASSMORPHISM & LINEAR ENTERPRISE CONTROLS)         -->
    <!-- ========================================================================= -->
    <header
      :class="[
        'h-16 shrink-0 z-40 border-b backdrop-blur-xl transition-colors w-full px-3 sm:px-6 flex items-center justify-between gap-3 relative',
        isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80 text-slate-100 shadow-sm' : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-xs'
      ]"
    >
      <!-- Left: Sidebar toggle + Logo + Breadcrumb -->
      <div class="flex items-center gap-3 min-w-0">
        <button
          @click="isSidebarOpen = !isSidebarOpen"
          :class="[
            'h-9 w-9 rounded-xl border transition-all cursor-pointer inline-flex items-center justify-center shrink-0 shadow-xs',
            isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-300 hover:text-white hover:bg-midnight-800' : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
          ]"
          title="Toggle project navigation"
        >
          <Icons :name="isSidebarOpen ? 'PanelLeftClose' : 'PanelLeftOpen'" :size="16" />
        </button>

        <WorkspaceBrand :dark="isDarkMode" />

        <!-- Dynamic Breadcrumbs -->
        <div class="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-midnight-800 text-xs min-w-0 font-mono">
          <span class="text-slate-500">/</span>
          <div class="flex items-center gap-1.5 font-bold truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: activeProjectObject?.color || '#00f5a0' }"></span>
            <span :class="['truncate', isDarkMode ? 'text-slate-200' : 'text-slate-800']">
              {{ activeProjectObject ? activeProjectObject.title : 'All Projects' }}
            </span>
            <span v-if="activeProjectObject?.key" class="font-mono text-[10px] px-1.5 py-0.2 rounded font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
              {{ activeProjectObject.key }}
            </span>
          </div>
          <template v-if="activeSprint">
            <span class="text-slate-500">/</span>
            <span class="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 truncate max-w-[140px] inline-flex items-center justify-center shrink-0">
              {{ activeSprint.name }}
            </span>
          </template>
        </div>
      </div>

      <!-- Center Tabs: Board | Backlog | Roadmap with dynamic counts -->
      <div
        :class="[
          'hidden md:flex items-center p-1 rounded-2xl border font-bold text-xs gap-1 shadow-xs font-mono',
          isDarkMode ? 'bg-midnight-950 border-midnight-800/80' : 'bg-slate-100/90 border-slate-200/80'
        ]"
      >
        <button
          @click="currentView = 'board'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0',
            currentView === 'board'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-extrabold shadow-md shadow-emerald-500/20'
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <Icons name="LayoutGrid" :size="14" aria-hidden="true" />
          <span class="leading-none">Task Board</span>
          <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold inline-flex items-center justify-center', currentView === 'board' ? 'bg-midnight-950/20 text-midnight-950 font-extrabold' : (isDarkMode ? 'bg-midnight-850 text-slate-300' : 'bg-slate-200 text-slate-700')]">
            {{ filteredBoardTasks.length }}
          </span>
        </button>

        <button
          @click="currentView = 'backlog'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0',
            currentView === 'backlog'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-extrabold shadow-md shadow-emerald-500/20'
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <Icons name="Layers" :size="14" aria-hidden="true" />
          <span class="leading-none">Sprint Backlog</span>
          <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold inline-flex items-center justify-center', currentView === 'backlog' ? 'bg-midnight-950/20 text-midnight-950 font-extrabold' : (isDarkMode ? 'bg-midnight-850 text-slate-300' : 'bg-slate-200 text-slate-700')]">
            {{ sprintList.length }}
          </span>
        </button>

        <button
          @click="currentView = 'roadmap'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0',
            currentView === 'roadmap'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-extrabold shadow-md shadow-emerald-500/20'
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <Icons name="GitBranch" :size="14" aria-hidden="true" />
          <span class="leading-none">Roadmap</span>
        </button>
      </div>

      <!-- Right Controls -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- AI Engine Dropdown Button -->
        <div class="relative">
          <button
            @click.stop="isAiMenuOpen = !isAiMenuOpen"
            :class="[
              'px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs shrink-0',
              isDarkMode ? 'bg-midnight-850 border-purple-800/60 text-purple-300 hover:bg-purple-950/40' : 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
            ]"
            title="AI planning and settings"
          >
            <Icons name="Sparkles" :size="14" class="text-amber-300" aria-hidden="true" />
            <span class="hidden sm:inline leading-none">AI Engine</span>
            <Icons name="ChevronDown" :size="12" />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isAiMenuOpen"
            @click.stop
            :class="[
              'absolute right-0 top-full mt-2 w-60 rounded-2xl border shadow-2xl p-2 z-50 text-xs font-medium backdrop-blur-xl',
              isDarkMode ? 'bg-midnight-900/95 border-midnight-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            ]"
          >
            <button
              @click="isAiMenuOpen = false; openAiGeneratorModal();"
              class="w-full px-3 py-2.5 rounded-xl text-left hover:bg-midnight-850 flex items-center gap-2.5 cursor-pointer font-medium"
            >
              <div class="w-7 h-7 rounded-lg border border-purple-700 bg-purple-950/50 inline-flex items-center justify-center shrink-0 text-purple-300">
                <Icons name="Sparkles" :size="14" />
              </div>
              <div>
                <div class="font-bold text-xs">AI Project Planner</div>
                <div class="text-[10px] text-slate-400 font-mono">Break down epics, sprints and tasks</div>
              </div>
            </button>
            <button
              @click="isAiMenuOpen = false; openAiSettings();"
              class="w-full px-3 py-2.5 rounded-xl text-left hover:bg-midnight-850 flex items-center gap-2.5 cursor-pointer font-medium border-t border-midnight-800/80 mt-1"
            >
              <div class="w-7 h-7 rounded-lg border border-midnight-700 bg-midnight-800 inline-flex items-center justify-center shrink-0 text-slate-300">
                <Icons name="Settings" :size="14" />
              </div>
              <div>
                <div class="font-bold text-xs">AI Settings</div>
                <div class="text-[10px] text-slate-400 font-mono">Private provider and API key</div>
              </div>
            </button>
          </div>
        </div>

        <!-- MCP & AI Agents Button -->
        <button
          @click="openMcpModal()"
          :class="[
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0',
            isDarkMode ? 'bg-midnight-850 border-indigo-500/40 text-indigo-300 hover:bg-midnight-800 hover:border-indigo-400' : 'bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
          ]"
          title="Model Context Protocol (MCP) & AI Agent Integration (Antigravity 2.0, Cursor, Claude)"
        >
          <Icons name="Plug" :size="14" aria-hidden="true" />
          <span class="leading-none">MCP & Agents</span>
        </button>

        <!-- Weekly Email Report Button -->
        <button
          @click="openReportModal"
          :class="[
            'hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0',
            isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-200 hover:bg-midnight-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          ]"
          title="Configure and send the weekly progress report"
        >
          <Icons name="Mail" :size="14" aria-hidden="true" />
          <span class="leading-none">Reports</span>
        </button>

        <!-- Notifications -->
        <button
          @click.stop="toggleNotifications"
          :class="[
            'relative h-9 w-9 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0',
            isNotificationsOpen
              ? (isDarkMode ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-blue-50 border-blue-300 text-blue-800')
              : (isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-300 hover:bg-midnight-800 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50')
          ]"
          title="Open notifications"
          aria-label="Open notifications"
        >
          <Icons name="Bell" :size="15" aria-hidden="true" />
          <span v-if="unreadNotificationCount" class="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-cyan-500 text-midnight-950 text-[9px] leading-4 font-black border-2 border-midnight-900 inline-flex items-center justify-center">
            {{ unreadNotificationCount > 9 ? '9+' : unreadNotificationCount }}
          </span>
        </button>

        <!-- Light / Dark Toggle Button -->
        <button
          @click="toggleTheme"
          :class="[
            'h-9 w-9 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0',
            isDarkMode
              ? 'bg-midnight-850 border-midnight-800 text-amber-300 hover:bg-midnight-800'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          ]"
          :title="isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <Icons :name="isDarkMode ? 'Sun' : 'Moon'" :size="15" aria-hidden="true" />
        </button>

        <!-- Workspace & Billing Navigation -->
        <div class="relative">
          <button
            @click.stop="isWorkspaceMenuOpen = !isWorkspaceMenuOpen"
            :class="[
              'px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0',
              isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-300 hover:bg-midnight-800 hover:text-phantom-mint' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-700'
            ]"
            title="Workspace settings and billing"
          >
            <Icons name="Zap" :size="14" class="text-emerald-400" />
            <span class="hidden sm:inline leading-none">Billing</span>
            <Icons name="ChevronDown" :size="12" />
          </button>

          <!-- Workspace / Billing Menu -->
          <div
            v-if="isWorkspaceMenuOpen"
            :class="[
              'absolute right-0 mt-2 w-56 rounded-2xl border p-2 shadow-2xl z-50',
              isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            ]"
          >
            <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Workspace Management</div>
            <a
              :href="`/workspaces/${props.currentWorkspaceId || 'default'}/billing`"
              :class="[
                'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors',
                isDarkMode ? 'hover:bg-midnight-850 text-emerald-400' : 'hover:bg-slate-100 text-emerald-600'
              ]"
            >
              <Icons name="Zap" :size="14" />
              <span>Billing & Quota</span>
            </a>
            <a
              href="/pricing"
              :class="[
                'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors',
                isDarkMode ? 'hover:bg-midnight-850 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              ]"
            >
              <Icons name="ExternalLink" :size="14" />
              <span>Public Pricing Matrix</span>
            </a>
            <template v-if="props.workspaces && props.workspaces.length > 1">
              <div class="my-1 border-t border-midnight-800"></div>
              <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Switch Workspace</div>
              <a
                v-for="w in props.workspaces"
                :key="w.id"
                :href="`/workspaces/${w.id}/billing`"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  w.id === props.currentWorkspaceId
                    ? (isDarkMode ? 'bg-emerald-950/60 text-emerald-300' : 'bg-emerald-50 text-emerald-800')
                    : (isDarkMode ? 'hover:bg-midnight-850 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                ]"
              >
                <span class="truncate">{{ w.name }}</span>
                <span class="text-[9px] uppercase font-mono px-1 rounded bg-midnight-800 text-slate-400">{{ w.plan || 'free' }}</span>
              </a>
            </template>
          </div>
        </div>

        <!-- Primary Action: + Create Task -->
        <button
          @click="openCreateTaskModal"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          title="Create a new task"
        >
          <Icons name="Plus" :size="16" aria-hidden="true" />
          <span class="leading-none">Create Task</span>
        </button>

        <!-- User Profile & Action Controls -->
        <template v-if="props.auth?.user">
          <div class="flex items-center gap-2 pl-2 border-l border-midnight-800">
            <span class="hidden xl:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold" :class="isDarkMode ? 'border-midnight-800 bg-midnight-850 text-slate-300' : 'border-slate-300 text-slate-700'">
              <img v-if="props.auth.user.github_avatar_url" :src="props.auth.user.github_avatar_url" class="h-4 w-4 rounded-full" alt="GitHub avatar" />
              @{{ props.auth.user.github_login || props.auth.user.name }}
            </span>
            <button @click="logoutGithub" class="rounded-xl border px-2.5 py-2 text-[10px] font-bold cursor-pointer" :class="isDarkMode ? 'border-midnight-800 bg-midnight-850 text-slate-300 hover:bg-midnight-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'">Sign out</button>
          </div>
        </template>
        <a v-else href="/auth/github" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">Sign in with GitHub</a>

        <!-- Lock Button -->
        <button
          @click="lockWorkspace"
          :class="[
            'h-9 w-9 rounded-xl border text-xs transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0',
            isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-400 hover:text-rose-400 hover:bg-midnight-800' : 'bg-white border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-red-50'
          ]"
          title="Lock workspace (PIN: 301095)"
        >
          <Icons name="Lock" :size="14" />
        </button>
      </div>
    </header>

    <RunnerDashboard :is-dark-mode="isDarkMode" @dispatch="handleRunnerDashboardDispatch" />

    <!-- ========================================================================= -->
    <!-- 2. MAIN LAYOUT (SIDEBAR + MAIN CANVAS)                                    -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex min-h-0 overflow-hidden w-full">
      <!-- SIDEBAR: TWO-LINE HIGH-CONTRAST PROJECT LAYOUT -->
      <aside
        v-if="isSidebarOpen"
        :class="[
          'fixed md:relative left-0 top-16 md:top-auto bottom-0 md:bottom-auto z-30 w-[min(88vw,20rem)] md:w-72 border-r flex flex-col justify-between shrink-0 h-full select-none transition-colors shadow-xl md:shadow-none overflow-hidden',
          isDarkMode ? 'bg-midnight-900 border-midnight-800/80' : 'bg-white border-slate-200/90'
        ]"
      >
        <div class="p-3.5 space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-2 min-h-0">
          <!-- Overview Items -->
          <div class="space-y-1.5">
            <button
              @click="selectedProjectId = 'all'"
              :class="[
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border text-left',
                selectedProjectId === 'all'
                  ? (isDarkMode ? 'bg-midnight-850 text-white border-phantom-mint/60 font-bold shadow-xs' : 'bg-blue-50/90 text-blue-950 border-blue-300 font-bold shadow-xs')
                  : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-midnight-850/60' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg border border-midnight-700 bg-midnight-800 inline-flex items-center justify-center shrink-0 text-cyan-400">
                  <Icons name="LayoutGrid" :size="14" />
                </div>
                <div>
                  <div :class="['font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-950']">All Projects</div>
                  <div :class="['text-[11px]', isDarkMode ? 'text-slate-400 font-mono' : 'text-slate-600 font-mono']">All projects and tasks</div>
                </div>
              </div>
              <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-800 text-slate-300 border border-midnight-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                {{ getProjectTaskCount('all') }}
              </span>
            </button>
          </div>

          <!-- PROJECTS -->
          <div class="space-y-2">
            <div class="flex items-center justify-between px-2 text-[11px] font-mono font-bold uppercase tracking-wider">
              <span class="flex items-center gap-1.5 text-phantom-mint font-bold">
                <Icons name="Briefcase" :size="13" class="text-phantom-mint shrink-0" />
                <span>PROJECTS</span>
              </span>
              <button
                @click="openCreateProjectModal()"
                class="hover:text-phantom-mint p-1 rounded-lg border border-midnight-700 bg-midnight-850 cursor-pointer text-xs font-bold inline-flex items-center justify-center shrink-0 transition-colors"
                title="Create project"
              >
                <Icons name="Plus" :size="13" />
              </button>
            </div>

            <div class="space-y-1">
              <div
                v-for="proj in projectList"
                :key="proj.id"
                :class="[
                  'relative group rounded-xl',
                  activeProjectMenuId === proj.id ? 'z-50' : 'z-10'
                ]"
              >
                <button
                  @click="selectedProjectId = proj.id"
                  :title="`Project ID: ${proj.id}`"
                  :class="[
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border text-left',
                    selectedProjectId === proj.id
                      ? (isDarkMode ? 'bg-midnight-850 text-white border-phantom-mint font-bold shadow-xs' : 'bg-blue-50/90 text-blue-950 border-blue-300 font-bold shadow-xs')
                      : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-midnight-850/50' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
                  ]"
                >
                  <!-- Left side: 2 Lines (Title + Description) -->
                  <div class="min-w-0 pr-2 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: proj.color || '#00f5a0' }"></span>
                      <span :class="['font-bold text-xs truncate', isDarkMode ? 'text-white' : 'text-slate-950']">{{ proj.title }}</span>
                      <span v-if="proj.key" :class="['px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0', isDarkMode ? 'bg-midnight-950 text-emerald-400 border border-emerald-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200']">
                        {{ proj.key }}
                      </span>
                    </div>

                    <div :class="['text-[11px] truncate pl-4.5 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                      {{ proj.description || 'Project description' }}
                    </div>
                    <div v-if="proj.tags?.length" class="mt-1 flex gap-1 overflow-hidden pl-4.5 font-mono">
                      <span v-for="tag in proj.tags.slice(0, 3)" :key="tag" class="shrink-0 rounded bg-midnight-950 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 border border-midnight-800">#{{ tag }}</span>
                    </div>
                  </div>

                  <!-- Right side: Count Badge -->
                  <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0 inline-flex items-center justify-center', isDarkMode ? 'bg-midnight-800 text-slate-300 border border-midnight-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                    {{ getProjectTaskCount(proj.id) }}
                  </span>
                </button>

                <!-- 3-Dot Options Dropdown -->
                <div
                  :class="[
                    'absolute right-2 top-2.5 transition-opacity z-50',
                    activeProjectMenuId === proj.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  ]"
                >
                  <button
                    @click.stop="activeProjectMenuId = activeProjectMenuId === proj.id ? null : proj.id"
                    :class="[
                      'h-7 w-7 rounded-lg text-xs cursor-pointer border font-bold inline-flex items-center justify-center shrink-0',
                      isDarkMode ? 'bg-midnight-850 text-slate-200 border-midnight-700 hover:bg-midnight-800' : 'bg-white text-slate-700 border-slate-300 shadow-xs hover:bg-slate-100'
                    ]"
                  >
                    <Icons name="MoreVertical" :size="13" />
                  </button>

                  <div
                    v-if="activeProjectMenuId === proj.id"
                    :class="[
                      'absolute right-0 top-full mt-1.5 w-36 rounded-xl border shadow-xl p-1.5 z-50 text-xs font-medium',
                      isDarkMode ? 'bg-midnight-900 border-midnight-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    ]"
                    @click.stop
                  >
                    <button
                      @click.stop="openEditProjectModal(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-midnight-850 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icons name="Edit3" :size="13" class="text-slate-300" />
                      <span>Edit</span>
                    </button>
                    <button
                      @click.stop="handleDeleteProject(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icons name="Trash2" :size="13" class="text-rose-400" />
                      <span>Delete Project</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Footer -->
        <div :class="['p-3.5 border-t space-y-2', isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200 bg-slate-50']">
          <!-- AI Sprint Plan Button in Sidebar -->
          <button
            @click="openAiGeneratorModal"
            class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icons name="Sparkles" :size="14" class="text-midnight-950" />
            <span class="leading-none">AI Project Planner</span>
          </button>

          <button
            @click="openCreateProjectModal()"
            :class="[
              'w-full py-2 px-3 rounded-xl border font-bold text-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer',
              isDarkMode ? 'bg-midnight-850 hover:bg-midnight-800 border-midnight-700 text-slate-100' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
            ]"
          >
            <Icons name="Plus" :size="14" />
            <span class="leading-none">Add Project</span>
          </button>
        </div>
      </aside>

      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 top-16 z-20 bg-midnight-950/40 md:hidden backdrop-blur-xs"
        @click="isSidebarOpen = false"
      ></div>

      <!-- MAIN WORKSPACE -->
      <main :class="['min-w-0 flex-1 flex flex-col h-full overflow-hidden relative', isDarkMode ? 'bg-midnight-900/40' : 'bg-[#f8fafc]']">
        <!-- =================================================================== -->
        <!-- MODERN 2-TIER PROJECT SUB-HEADER & SMART FILTER BAR (STICKY)        -->
        <!-- =================================================================== -->
        <div :class="['p-4 sm:p-5 border-b space-y-3.5 shrink-0 shadow-xs backdrop-blur-xl transition-colors z-20', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80' : 'bg-white/95 border-slate-200/90']">
          <!-- TIER 1: PROJECT BANNER & ANALYTICS METRICS -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Left: Project Identity -->
            <div class="flex items-start gap-3.5 min-w-0 max-w-2xl">
              <div
                class="w-11 h-11 rounded-2xl inline-flex items-center justify-center shadow-xs shrink-0 border"
                :style="{
                  backgroundColor: activeProjectObject?.color ? `${activeProjectObject.color}20` : (isDarkMode ? '#0c1220' : '#f1f5f9'),
                  borderColor: activeProjectObject?.color || (isDarkMode ? '#141b2d' : '#cbd5e1')
                }"
              >
                <Icons name="Briefcase" :size="20" class="text-phantom-mint" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h1 :class="['text-xl sm:text-2xl font-bold font-display tracking-tight truncate', isDarkMode ? 'text-white' : 'text-slate-950']">
                    {{ activeProjectObject ? activeProjectObject.title : 'All Projects & Tasks' }}
                  </h1>

                  <span v-if="activeProjectObject?.key" class="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30 shadow-xs inline-flex items-center justify-center">
                    {{ activeProjectObject.key }}
                  </span>

                  <span v-if="activeProjectObject" class="px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold border shadow-xs bg-cyan-500/10 text-cyan-300 border-cyan-500/30 inline-flex items-center justify-center">PROJECT</span>
                </div>

                <p :class="['text-xs sm:text-sm mt-1 line-clamp-1 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-700']">
                  {{ activeProjectObject?.tagline || activeProjectObject?.description || 'Manage project delivery, sprints and task backlog.' }}
                </p>
              </div>
            </div>

            <!-- Right: Project Analytics & Health Metric Pills -->
            <div class="flex flex-wrap items-center gap-2.5 font-mono text-xs">
              <!-- Total Tasks Pill -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2 shadow-xs', isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Tasks:</span>
                <strong class="text-phantom-mint text-sm font-black">{{ activeProjectTasks.length }}</strong>
              </div>

              <!-- Story Points Pill -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2 shadow-xs', isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Points:</span>
                <strong class="text-purple-400 text-sm font-black">{{ activeProjectStoryPoints }}</strong>
              </div>

              <!-- Progress % Pill with Mini Bar -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2.5 shadow-xs', isDarkMode ? 'bg-midnight-850 border-midnight-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Progress:</span>
                <div class="w-14 h-2.5 rounded-full bg-midnight-950 border border-midnight-800 overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" :style="{ width: `${activeProjectProgressPercent}%` }"></div>
                </div>
                <strong class="text-phantom-mint text-xs font-black">{{ activeProjectProgressPercent }}%</strong>
              </div>

              <!-- Warning Pill (Click to filter) -->
              <button
                v-if="activeProjectWarningCount > 0"
                @click="filterHealth = filterHealth === 'warning' ? 'all' : 'warning'"
                :class="[
                  'px-3.5 py-2 rounded-2xl border font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-xs shrink-0',
                  filterHealth === 'warning'
                    ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 shadow-md'
                    : (isDarkMode ? 'bg-rose-950/80 border-rose-800 text-rose-300 hover:bg-rose-900' : 'bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200 font-bold')
                ]"
                title="Filter overdue and at-risk tasks"
              >
                <Icons name="AlertTriangle" :size="13" class="text-rose-300" />
                <strong class="font-black leading-none">{{ activeProjectWarningCount }} Attention</strong>
              </button>

              <!-- Documents Button -->
              <button
                v-if="activeProjectObject?.id"
                @click="isDocsModalOpen = true; sound.playClick();"
                :class="[
                  'px-3 py-2 rounded-2xl border font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-105 shrink-0',
                  isDarkMode ? 'bg-midnight-850 border-midnight-800 text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-950/30' : 'bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100'
                ]"
                title="Open project documents and GitHub sync"
              >
                <Icons name="FileText" :size="13" class="text-cyan-400" />
                <span class="text-xs leading-none">Docs</span>
              </button>

              <!-- Releases Button -->
              <button
                v-if="activeProjectObject?.id"
                @click="isReleasesModalOpen = true; sound.playClick();"
                :class="[
                  'px-3 py-2 rounded-2xl border font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-105 shrink-0',
                  isDarkMode ? 'bg-midnight-850 border-midnight-800 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-950/30' : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                ]"
                title="Open release history"
              >
                <Icons name="Rocket" :size="13" class="text-emerald-400" />
                <span class="text-xs leading-none">Releases</span>
              </button>
            </div>
          </div>

          <!-- TIER 2: SMART FILTER & QUICK ACTION BAR -->
          <div :class="['flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t text-xs', isDarkMode ? 'border-midnight-800/80' : 'border-slate-200']">
            <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-0 font-mono">
              <!-- Search Input with Shortcut Badge -->
              <div class="relative min-w-[200px] max-w-xs flex-1">
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search tasks... (Press '/')"
                  :class="[
                    'w-full border rounded-xl pl-8 pr-8 py-2 text-xs focus:outline-none focus:border-phantom-mint/60 shadow-xs font-medium transition-colors',
                    isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  ]"
                />
                <Icons name="Search" :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <span v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer font-bold">✕</span>
                <span v-else class="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.2 rounded border text-[10px] font-mono text-slate-400 border-midnight-800 font-bold">/</span>
              </div>

              <!-- Health / Progress Warning Filter -->
              <select
                v-model="filterHealth"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-bold transition-colors',
                  filterHealth === 'warning' || filterHealth === 'overdue'
                    ? (isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-600' : 'bg-rose-50 text-rose-900 border-rose-400')
                    : filterHealth === 'at_risk'
                    ? (isDarkMode ? 'bg-amber-950 text-amber-300 border-amber-600' : 'bg-amber-50 text-amber-900 border-amber-400')
                    : (isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All progress</option>
                <option value="warning" :disabled="activeProjectWarningCount === 0">
                  Attention needed (Overdue + At risk) ({{ activeProjectWarningCount }})
                </option>
                <option value="overdue" :disabled="overdueTasksCount === 0">
                  Overdue only ({{ overdueTasksCount }})
                </option>
                <option value="at_risk" :disabled="delayedTasksCount === 0">
                  At risk only ({{ delayedTasksCount }})
                </option>
                <option value="on_track">On track</option>
              </select>

              <!-- Issue Type Filter -->
              <select
                v-model="filterIssueType"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterIssueType !== 'all'
                    ? (isDarkMode ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700 font-bold' : 'bg-blue-50 text-blue-900 border-blue-300 font-bold')
                    : (isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All issue types</option>
                <option value="story">Story</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
              </select>

              <!-- Priority Filter -->
              <select
                v-model="filterPriority"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterPriority !== 'all'
                    ? (isDarkMode ? 'bg-amber-950/80 text-amber-300 border-amber-700 font-bold' : 'bg-amber-50 text-amber-900 border-amber-300 font-bold')
                    : (isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <!-- Epic Filter -->
              <select
                v-model="filterEpicId"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterEpicId !== 'all'
                    ? (isDarkMode ? 'bg-purple-950/80 text-purple-300 border-purple-700 font-bold' : 'bg-purple-50 text-purple-900 border-purple-300 font-bold')
                    : (isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All Epics</option>
                <option value="none">No Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  {{ epic.issue_key }} — {{ epic.title }}
                </option>
              </select>

              <!-- Reset Filter Button -->
              <button
                v-if="hasActiveFilters"
                @click="resetFilters"
                class="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/50 border border-rose-800 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
                title="Clear all active filters"
              >
                <Icons name="X" :size="12" />
                <span class="leading-none">Clear Filters</span>
              </button>
            </div>

            <!-- Quick Add in Bar -->
            <div class="flex items-center gap-2 font-mono">
              <input
                ref="quickInputRef"
                v-model="quickInputText"
                type="text"
                placeholder="+ Quick add task... (Enter)"
                @keydown.enter="handleQuickCreate(null)"
                :class="[
                  'min-w-[220px] sm:min-w-[260px] border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-phantom-mint/60 shadow-xs font-medium transition-colors',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                ]"
              />
            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- SCROLLABLE WORKSPACE CANVAS (KANBAN / BACKLOG / ROADMAP / COMMAND)    -->
        <!-- ===================================================================== -->
        <div class="flex-1 overflow-y-auto overflow-x-auto min-h-0 custom-scrollbar">
        <!-- ===================================================================== -->
        <!-- PERSONAL DAILY COMMAND CENTER                                         -->
        <!-- ===================================================================== -->
        <section
          v-if="!hasSelectedProject && projectList.length === 0"
          :class="['p-4 sm:p-6 pb-0', isDarkMode ? 'bg-[#070b14]' : 'bg-[#f8fafc]']"
        >
          <div
            :class="[
              'ml-auto max-w-xl rounded-2xl border p-4 sm:p-5 shadow-sm',
              isDarkMode ? 'border-blue-900/70 bg-blue-950/20' : 'border-blue-200 bg-blue-50/70'
            ]"
          >
            <div class="flex items-start gap-3">
              <div class="mono-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/40 text-blue-400" aria-hidden="true">⌂</div>
              <div class="min-w-0 flex-1">
                <h2 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Choose a project to get started</h2>
                <p :class="['mt-1 text-xs leading-5', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                  You are viewing the workspace overview. Select a project below to open its task board, docs, releases and context.
                </p>
              </div>
            </div>
            <div v-if="projectList.length" class="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                v-for="project in projectList.slice(0, 6)"
                :key="project.id"
                type="button"
                @click="selectedProjectId = project.id; sound.playClick()"
                :class="[
                  'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer',
                  isDarkMode ? 'border-slate-800 bg-slate-950/60 hover:border-blue-500/70 hover:bg-blue-950/20' : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50'
                ]"
              >
                <span class="mono-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold" :style="{ color: project.color || '#60a5fa', borderColor: `${project.color || '#60a5fa'}66` }" aria-hidden="true">▦</span>
                <span class="min-w-0">
                  <span :class="['block truncate text-xs font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-900']">{{ project.title }}</span>
                  <span class="block truncate text-[10px] text-slate-500">{{ project.github_repository || 'Project' }}</span>
                </span>
              </button>
            </div>
            <button v-else type="button" @click="openCreateProjectModal()" class="mt-4 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer">
              + Create your first project
            </button>
          </div>
        </section>

        <!-- ===================================================================== -->
        <!-- VIEW 1: CLEAN KANBAN BOARD (HIGH CONTRAST & CARD ELEVATION)          -->
        <!-- ===================================================================== -->
        <div v-if="currentView === 'board'" class="flex-1 p-4 sm:p-6 overflow-x-auto overflow-y-auto">
          <!-- Overdue / Delayed Warning Alert Banner -->
          <div
            v-if="warningTasksCount > 0"
            :class="[
              'mb-5 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all',
              isDarkMode
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                : 'bg-rose-50 border-rose-200 text-rose-900 ring-2 ring-rose-100/60'
            ]"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 inline-flex items-center justify-center shrink-0 text-lg animate-bounce">
                <Icons name="AlertTriangle" :size="18" class="text-rose-400" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm">TASK PROGRESS ALERTS</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white">
                    {{ warningTasksCount }} ISSUES
                  </span>
                </div>
                <p class="text-xs mt-0.5 opacity-90">
                  <strong class="font-bold underline text-rose-700 dark:text-rose-300">{{ overdueTasksCount }} overdue tasks</strong> and <strong class="font-bold underline text-amber-700 dark:text-amber-300">{{ delayedTasksCount }} at-risk tasks</strong> need rescheduling or reprioritization.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="filterHealth !== 'warning'"
                @click="filterHealth = 'warning'"
                class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 shrink-0"
              >
                <Icons name="AlertTriangle" :size="13" />
                <span class="leading-none">View Details</span>
              </button>
              <button
                v-else
                @click="filterHealth = 'all'"
                :class="[
                  'px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-colors inline-flex items-center justify-center shrink-0',
                  isDarkMode ? 'bg-midnight-850 border-midnight-700 text-slate-300 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'
                ]"
              >
                <span class="leading-none">Clear filter</span>
              </button>
            </div>
          </div>

          <!-- Active Sprint Banner -->
          <div
            v-if="activeSprint"
            :class="[
              'mb-5 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs',
              isDarkMode ? 'bg-midnight-900/90 border-emerald-500/40 backdrop-blur-xl' : 'bg-white border-blue-300 ring-2 ring-blue-50 shadow-sm'
            ]"
          >
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full bg-phantom-mint animate-pulse shrink-0"></span>
              <div>
                <div class="flex items-center gap-2">
                  <span :class="['font-bold text-sm sm:text-base', isDarkMode ? 'text-white' : 'text-slate-950']">{{ activeSprint.name }}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 shadow-xs inline-flex items-center justify-center">ACTIVE</span>
                </div>
                <p v-if="activeSprint.goal" :class="['text-xs mt-0.5 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-700']">{{ activeSprint.goal }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span :class="['text-xs font-mono font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold']">
                Due date: <strong class="text-slate-950 dark:text-white font-black">{{ activeSprint.end_date || 'Not set' }}</strong>
              </span>
              <button
                @click="openCompleteSprintModal(activeSprint)"
                :class="[
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors shadow-xs inline-flex items-center gap-1.5 shrink-0',
                  isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 hover:bg-emerald-900' : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 font-bold'
                ]"
              >
                <Icons name="CheckCircle" :size="13" class="text-emerald-400" />
                <span class="leading-none">Complete Sprint</span>
              </button>
            </div>
          </div>

          <WorkspaceEmptyBoard
            v-if="filteredBoardTasks.length === 0"
            :dark="isDarkMode"
            :has-project="Boolean(activeProjectObject)"
            @create-task="openCreateTaskModal"
            @plan-with-ai="openAiGeneratorModal"
          />

          <!-- 4 HIGH-CONTRAST KANBAN COLUMNS -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full items-start">
            <!-- 1. TO DO -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80' : 'bg-slate-100/90 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'todo')"
              @drop="onDropColumn('todo')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-midnight-800/80' : 'border-slate-300']">
                <span class="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                  <Icons name="Clock" :size="13" class="text-sky-400 shrink-0" />
                  <span>TO DO</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-850 text-sky-300 border-midnight-700' : 'bg-white text-slate-950 border-slate-300 shadow-xs']">
                  {{ todoTasks.length }}
                </span>
              </div>

              <div class="space-y-2.5 flex-1">
                <div
                  v-for="task in todoTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3 rounded-xl border transition-all duration-150 cursor-pointer space-y-2 group shadow-xs hover:scale-[1.01]',
                    isDarkMode ? 'bg-midnight-850 border-midnight-800 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-950/20' : 'bg-white border-slate-200 hover:border-sky-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <!-- Next Up Recommended Spotlight Banner -->
                  <div
                    v-if="task.id === webNextUpTaskId"
                    class="flex items-center justify-between px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 text-[9px] font-bold text-amber-600 dark:text-amber-300 tracking-wide uppercase shadow-xs font-mono"
                  >
                    <span class="flex items-center gap-1.5">
                      <Icons name="Sparkles" :size="12" class="text-amber-400 animate-pulse" />
                      <span>Next Up / Recommended</span>
                    </span>
                    <span class="text-[8px] font-mono opacity-75">Priority #1</span>
                  </div>

                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="13" class="shrink-0 text-cyan-400" />
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-midnight-950 text-cyan-300 border-midnight-700' : 'bg-blue-50 text-blue-900 border-blue-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1 font-mono">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-1.5 py-0.2 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-white' : 'text-slate-900 group-hover:text-sky-700']">
                    {{ task.title }}
                  </h4>

                  <div v-if="dependencySummary(task).total" class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                    <span class="text-slate-400">Depends on {{ dependencySummary(task).labels.join(', ') }}</span>
                    <span v-if="dependencySummary(task).pendingLabels.length" class="font-bold text-amber-300">· Blocked by {{ dependencySummary(task).pendingLabels.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).reconsidered" class="font-bold text-rose-400">· Needs review: a prerequisite moved back from done</span>
                  </div>

                  <div v-if="taskExecutionMeta(task).dependents.length" class="flex flex-wrap items-center gap-1 text-[10px] font-mono font-semibold">
                    <span class="text-slate-400">Unlocks {{ taskExecutionMeta(task).dependents.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).dependentReconsideration.length" class="text-rose-400">· reconsider dependent work: {{ taskExecutionMeta(task).dependentReconsideration.join(', ') }}</span>
                  </div>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1.5">
                      <Icons name="ListChecks" :size="12" class="text-indigo-400 shrink-0" />
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1.5', getTaskDelayStatus(task).isOverdue ? 'text-rose-400 font-bold' : '']">
                      <Icons name="Clock" :size="12" :class="getTaskDelayStatus(task).isOverdue ? 'text-rose-400' : 'text-slate-400'" />
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-midnight-800' : 'border-slate-100']">
                    <div class="flex items-center gap-1.5">
                      <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                        {{ getCategoryBadge(task.category).label }}
                      </span>
                      <span :class="['px-1.5 py-0.2 rounded border font-semibold inline-flex items-center gap-1', getPriorityBadge(task.priority).class]">
                        <Icons :name="getPriorityBadge(task.priority).icon" :size="10" />
                        <span class="leading-none">{{ getPriorityBadge(task.priority).label }}</span>
                      </span>
                    </div>
                    <button
                      @click.stop="openRemoteDispatch(task)"
                      :disabled="!executionGateFor(task).allowed"
                      class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="⚡ Dispatch to Connected Desktop Agent"
                    >
                      <Icons name="Zap" :size="11" class="text-phantom-mint" />
                      <span class="leading-none">⚡ Dispatch to Connected Desktop Agent</span>
                    </button>
                  </div>
                </div>

                <div v-if="todoTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-midnight-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium font-mono">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 2. IN PROGRESS -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'in_progress')"
              @drop="onDropColumn('in_progress')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-midnight-800/80' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                  <Icons name="Play" :size="13" class="text-amber-400 animate-pulse shrink-0" />
                  <span>IN PROGRESS</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-850 text-amber-300 border-midnight-700' : 'bg-white text-amber-950 border-amber-300 shadow-xs']">
                  {{ inProgressTasks.length }}
                </span>
              </div>

              <div class="space-y-2.5 flex-1">
                <div
                  v-for="task in inProgressTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3 rounded-xl border transition-all duration-150 cursor-pointer space-y-2 group shadow-xs hover:scale-[1.01]',
                    isDarkMode ? 'bg-midnight-850 border-amber-500/40 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-950/20' : 'bg-white border-amber-200 hover:border-amber-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <!-- Next Up Recommended Spotlight Banner -->
                  <div
                    v-if="task.id === webNextUpTaskId"
                    class="flex items-center justify-between px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 text-[9px] font-bold text-amber-600 dark:text-amber-300 tracking-wide uppercase shadow-xs font-mono"
                  >
                    <span class="flex items-center gap-1.5">
                      <Icons name="Sparkles" :size="12" class="text-amber-400 animate-pulse" />
                      <span>Next Up / Recommended</span>
                    </span>
                    <span class="text-[8px] font-mono opacity-75">Priority #1</span>
                  </div>

                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="13" class="shrink-0 text-amber-400" />
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-midnight-950 text-amber-300 border-midnight-700' : 'bg-amber-50 text-amber-900 border-amber-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1 font-mono">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-1.5 py-0.2 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-white' : 'text-slate-900 group-hover:text-amber-700']">
                    {{ task.title }}
                  </h4>

                  <div v-if="dependencySummary(task).total" class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                    <span class="text-slate-400">Depends on {{ dependencySummary(task).labels.join(', ') }}</span>
                    <span v-if="dependencySummary(task).pendingLabels.length" class="font-bold text-amber-300">· Blocked by {{ dependencySummary(task).pendingLabels.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).reconsidered" class="font-bold text-rose-400">· Needs review: a prerequisite moved back from done</span>
                  </div>

                  <div v-if="taskExecutionMeta(task).dependents.length" class="flex flex-wrap items-center gap-1 text-[10px] font-mono font-semibold">
                    <span class="text-slate-400">Unlocks {{ taskExecutionMeta(task).dependents.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).dependentReconsideration.length" class="text-rose-400">· reconsider dependent work: {{ taskExecutionMeta(task).dependentReconsideration.join(', ') }}</span>
                  </div>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1.5">
                      <Icons name="ListChecks" :size="12" class="text-indigo-400 shrink-0" />
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1.5', getTaskDelayStatus(task).isOverdue ? 'text-rose-400 font-bold' : '']">
                      <Icons name="Clock" :size="12" :class="getTaskDelayStatus(task).isOverdue ? 'text-rose-400' : 'text-slate-400'" />
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-midnight-800' : 'border-slate-100']">
                    <div class="flex items-center gap-1.5">
                      <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                        {{ getCategoryBadge(task.category).label }}
                      </span>
                      <span :class="['px-1.5 py-0.2 rounded border font-semibold inline-flex items-center gap-1', getPriorityBadge(task.priority).class]">
                        <Icons :name="getPriorityBadge(task.priority).icon" :size="10" />
                        <span class="leading-none">{{ getPriorityBadge(task.priority).label }}</span>
                      </span>
                    </div>
                    <button
                      @click.stop="openRemoteDispatch(task)"
                      :disabled="!executionGateFor(task).allowed"
                      class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="⚡ Re-dispatch / Run on Connected Desktop Agent"
                    >
                      <Icons name="Zap" :size="11" class="text-amber-300" />
                      <span class="leading-none">⚡ Re-dispatch / Run on Connected Desktop Agent</span>
                    </button>
                  </div>
                </div>

                <div v-if="inProgressTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-midnight-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium font-mono">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 3. REVIEW -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'review')"
              @drop="onDropColumn('review')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-midnight-800/80' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0"></span>
                  <Icons name="Eye" :size="13" class="text-purple-400 animate-pulse shrink-0" />
                  <span>REVIEW</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-850 text-purple-300 border-midnight-700' : 'bg-white text-purple-950 border-purple-300 shadow-xs']">
                  {{ reviewTasks.length }}
                </span>
              </div>

              <div class="space-y-2.5 flex-1">
                <div
                  v-for="task in reviewTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3 rounded-xl border transition-all duration-150 cursor-pointer space-y-2 group shadow-xs hover:scale-[1.01]',
                    isDarkMode ? 'bg-midnight-850 border-purple-500/40 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-950/20' : 'bg-white border-purple-200 hover:border-purple-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="13" class="shrink-0 text-purple-400" />
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-purple-50 text-purple-900 border-purple-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1 font-mono">
                      <span class="px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[9px] font-bold inline-flex items-center gap-1">
                        <Icons name="Bot" :size="10" />
                        <span class="leading-none">Review</span>
                      </span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-white' : 'text-slate-900 group-hover:text-purple-700']">
                    {{ task.title }}
                  </h4>

                  <div v-if="dependencySummary(task).total" class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                    <span class="text-slate-400">Depends on {{ dependencySummary(task).labels.join(', ') }}</span>
                    <span v-if="dependencySummary(task).pendingLabels.length" class="font-bold text-amber-300">· Blocked by {{ dependencySummary(task).pendingLabels.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).reconsidered" class="font-bold text-rose-400">· Needs review: a prerequisite moved back from done</span>
                  </div>

                  <div v-if="taskExecutionMeta(task).dependents.length" class="flex flex-wrap items-center gap-1 text-[10px] font-mono font-semibold">
                    <span class="text-slate-400">Unlocks {{ taskExecutionMeta(task).dependents.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).dependentReconsideration.length" class="text-rose-400">· reconsider dependent work: {{ taskExecutionMeta(task).dependentReconsideration.join(', ') }}</span>
                  </div>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1.5">
                      <Icons name="ListChecks" :size="12" class="text-indigo-400 shrink-0" />
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1.5', getTaskDelayStatus(task).isOverdue ? 'text-rose-400 font-bold' : '']">
                      <Icons name="Clock" :size="12" :class="getTaskDelayStatus(task).isOverdue ? 'text-rose-400' : 'text-slate-400'" />
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-midnight-800' : 'border-slate-100']">
                    <div class="flex items-center gap-1.5">
                      <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                        {{ getCategoryBadge(task.category).label }}
                      </span>
                      <span :class="['px-1.5 py-0.2 rounded border font-semibold inline-flex items-center gap-1', getPriorityBadge(task.priority).class]">
                        <Icons :name="getPriorityBadge(task.priority).icon" :size="10" />
                        <span class="leading-none">{{ getPriorityBadge(task.priority).label }}</span>
                      </span>
                    </div>
                    <button
                      @click.stop="openRemoteDispatch(task)"
                      :disabled="!executionGateFor(task).allowed"
                      class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="⚡ Re-test / Dispatch to Connected Desktop Agent"
                    >
                      <Icons name="Zap" :size="11" class="text-purple-300" />
                      <span class="leading-none">⚡ Re-test / Dispatch to Connected Desktop Agent</span>
                    </button>
                  </div>
                </div>

                <div v-if="reviewTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-midnight-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium font-mono">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 4. DONE -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'done')"
              @drop="onDropColumn('done')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-midnight-800/80' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                  <Icons name="CheckCircle" :size="13" class="text-emerald-400 shrink-0" />
                  <span>DONE</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-850 text-emerald-300 border-midnight-700' : 'bg-white text-emerald-950 border-emerald-300 shadow-xs']">
                  {{ doneTasks.length }}
                </span>
              </div>

              <div class="space-y-2.5 flex-1">
                <div
                  v-for="task in doneTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3 rounded-xl border transition-all duration-150 cursor-pointer space-y-2 group shadow-xs opacity-85 hover:opacity-100 hover:scale-[1.01]',
                    isDarkMode ? 'bg-midnight-850 border-emerald-500/30 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20' : 'bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-md'
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="13" class="shrink-0 text-emerald-400" />
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-midnight-950 text-emerald-300 border-midnight-700' : 'bg-emerald-50 text-emerald-900 border-emerald-200']">{{ task.issue_key }}</span>
                    </div>
                    <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-emerald-300 border-midnight-700' : 'bg-emerald-50 text-emerald-900 border-emerald-200']">
                      {{ task.story_points }} pts
                    </span>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 line-through', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                    {{ task.title }}
                  </h4>

                  <div v-if="dependencySummary(task).total" class="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                    <span class="text-slate-400">Depends on {{ dependencySummary(task).labels.join(', ') }}</span>
                    <span v-if="dependencySummary(task).pendingLabels.length" class="font-bold text-amber-300">· Blocked by {{ dependencySummary(task).pendingLabels.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).reconsidered" class="font-bold text-rose-400">· Needs review: a prerequisite moved back from done</span>
                  </div>
                  <div v-if="taskExecutionMeta(task).dependents.length" class="flex flex-wrap items-center gap-1 text-[10px] font-mono font-semibold">
                    <span class="text-slate-400">Unlocks {{ taskExecutionMeta(task).dependents.join(', ') }}</span>
                    <span v-if="taskExecutionMeta(task).dependentReconsideration.length" class="text-rose-400">· reconsider dependent work: {{ taskExecutionMeta(task).dependentReconsideration.join(', ') }}</span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-midnight-800' : 'border-slate-100']">
                    <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span class="text-emerald-400 font-mono font-bold inline-flex items-center gap-1">
                      <Icons name="CheckCircle" :size="12" />
                      <span class="leading-none">Done</span>
                    </span>
                  </div>
                </div>

                <div v-if="doneTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-midnight-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium font-mono">
                  Drag tasks here
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- VIEW 2: BACKLOG SPRINT PLANNING (COLLAPSIBLE + MULTI-BAR PROGRESS)   -->
        <!-- ===================================================================== -->
        <div v-else-if="currentView === 'backlog'" class="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          <div :class="['flex flex-wrap items-center justify-between gap-3 pb-3 border-b', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
            <div>
              <h2 :class="['text-base sm:text-lg font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">
                Sprint planning & backlog
              </h2>
              <p :class="['text-xs mt-0.5 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Drag tasks into sprints to prepare the delivery stages.
              </p>
            </div>

            <button
              @click="openCreateSprintModal"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs shadow-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Icons name="Plus" :size="14" />
              <span class="leading-none">Create Sprint</span>
            </button>
          </div>

          <div class="space-y-4">
            <!-- Sprint Containers -->
            <div
              v-for="sprint in sprintList"
              :key="sprint.id"
              :class="[
                'rounded-2xl border transition-all shadow-xs overflow-hidden',
                sprint.status === 'active'
                  ? (isDarkMode ? 'bg-midnight-900 border-emerald-500/50' : 'bg-white border-blue-300 ring-2 ring-blue-50')
                  : (isDarkMode ? 'bg-midnight-900/80 border-midnight-800' : 'bg-white border-slate-200')
              ]"
              @dragover="onDragOverSprint($event, sprint.id)"
              @drop="onDropSprint(sprint.id)"
            >
              <!-- Sprint Header Row -->
              <div :class="['p-4 flex flex-wrap items-center justify-between gap-3 border-b', isDarkMode ? 'bg-midnight-850 border-midnight-800' : 'bg-slate-50/90 border-slate-200']">
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Collapse/Expand Toggle -->
                  <button
                    @click="toggleSprintCollapse(sprint.id)"
                    :class="['h-7 w-7 rounded-lg border border-midnight-700 cursor-pointer text-xs font-bold inline-flex items-center justify-center shrink-0 transition-colors', isDarkMode ? 'text-slate-300 hover:text-white bg-midnight-900' : 'text-slate-700 hover:text-slate-950 bg-white']"
                    title="Collapse / expand"
                  >
                    <Icons :name="collapsedSprints[sprint.id] ? 'ChevronRight' : 'ChevronDown'" :size="13" />
                  </button>

                  <span
                    :class="[
                      'px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border inline-flex items-center justify-center',
                      sprint.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : (sprint.status === 'completed' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-midnight-950 text-slate-400 border-midnight-700')
                    ]"
                  >
                    {{ sprint.status.toUpperCase() }}
                  </span>

                  <h3 :class="['text-sm sm:text-base font-bold truncate', isDarkMode ? 'text-white' : 'text-slate-950']">{{ sprint.name }}</h3>

                  <span :class="['text-xs font-mono font-medium shrink-0', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                    ({{ getSprintStats(sprint.id).totalTasks }} tasks • {{ getSprintStats(sprint.id).donePts }}/{{ getSprintStats(sprint.id).totalPts }} pts)
                  </span>
                </div>

                <div class="flex items-center gap-3">
                  <!-- Multi-Segment Progress Bar -->
                  <div class="hidden sm:flex items-center gap-2 min-w-[140px]">
                    <div class="h-2.5 flex-1 bg-midnight-950 border border-midnight-800 rounded-full overflow-hidden flex">
                      <div class="bg-emerald-500 h-full" :style="{ width: `${getSprintStats(sprint.id).donePercent}%` }"></div>
                      <div class="bg-amber-500 h-full" :style="{ width: `${getSprintStats(sprint.id).inProgressPercent}%` }"></div>
                      <div class="bg-slate-700 h-full" :style="{ width: `${getSprintStats(sprint.id).todoPercent}%` }"></div>
                    </div>
                    <span :class="['font-mono text-[11px] font-bold', isDarkMode ? 'text-phantom-mint' : 'text-slate-800']">{{ getSprintStats(sprint.id).donePercent }}%</span>
                  </div>

                  <!-- Sprint Action Buttons -->
                  <div class="flex items-center gap-2 font-mono">
                    <button
                      v-if="sprint.status === 'future'"
                      @click="openStartSprintModal(sprint)"
                      class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Icons name="Play" :size="12" />
                      <span class="leading-none">Start Sprint</span>
                    </button>

                    <button
                      v-if="sprint.status === 'active'"
                      @click="openCompleteSprintModal(sprint)"
                      class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Icons name="CheckCircle" :size="12" />
                      <span class="leading-none">Complete Sprint</span>
                    </button>

                    <button
                      @click="handleDeleteSprint(sprint)"
                      class="h-8 w-8 rounded-lg border border-midnight-700 bg-midnight-900 text-slate-400 hover:text-rose-400 hover:border-rose-800 cursor-pointer inline-flex items-center justify-center shrink-0 transition-colors"
                      title="Delete Sprint"
                    >
                      <Icons name="Trash2" :size="13" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Sprint Tasks List (Collapsible) -->
              <div v-if="!collapsedSprints[sprint.id]" class="p-3.5 space-y-2">
                <div
                  v-for="task in getSprintTasks(sprint.id)"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer shadow-xs',
                    isDarkMode ? 'bg-midnight-850 border-midnight-800 hover:border-phantom-mint/50' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-sm',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="14" class="text-cyan-400 shrink-0" />
                    <span :class="['font-mono text-xs font-bold px-1.5 py-0.5 rounded border shrink-0', isDarkMode ? 'bg-midnight-950 text-cyan-300 border-midnight-700' : 'bg-blue-100 text-blue-950 border-blue-300']">{{ task.issue_key }}</span>
                    <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-950']">{{ task.title }}</span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0 font-mono">
                    <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                      {{ getTaskDelayStatus(task).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded text-[11px] font-mono border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                    <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                      {{ task.story_points }} pts
                    </span>
                    <button
                      @click.stop="openRemoteDispatch(task)"
                      :disabled="!executionGateFor(task).allowed"
                      class="px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="🚀 Run on Connected Desktop Agent"
                    >
                      <Icons name="Zap" :size="11" class="text-phantom-mint" />
                      <span class="leading-none">🚀 Run on Connected Desktop Agent</span>
                    </button>
                  </div>
                </div>

                <div v-if="getSprintTasks(sprint.id).length === 0" class="py-6 border-2 border-dashed border-slate-300 dark:border-midnight-800 rounded-xl text-center text-xs text-slate-500 font-mono">
                  This sprint has no tasks. Drag tasks here from the backlog.
                </div>
              </div>
            </div>

            <!-- Backlog Pool Box -->
            <div
              :class="['p-4 rounded-2xl border space-y-3 shadow-xs', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']"
              @dragover="onDragOverSprint($event, 'backlog')"
              @drop="onDropSprint(null)"
            >
              <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
                <div class="flex items-center gap-2">
                  <Icons name="Package" :size="16" class="text-phantom-mint shrink-0" />
                  <h3 :class="['text-sm sm:text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Backlog (No Sprint)</h3>
                  <span :class="['text-xs font-mono font-bold', isDarkMode ? 'text-slate-400' : 'text-slate-700']">({{ backlogTasks.length }} tasks)</span>
                </div>
              </div>

              <div class="space-y-2">
                <div
                  v-for="task in backlogTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer shadow-xs',
                    isDarkMode ? 'bg-midnight-850 border-midnight-800 hover:border-phantom-mint/50' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-sm',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <Icons :name="getIssueTypeBadge(task.issue_type).icon" :size="14" class="text-cyan-400 shrink-0" />
                    <span :class="['font-mono text-xs font-bold px-1.5 py-0.5 rounded border shrink-0', isDarkMode ? 'bg-midnight-950 text-slate-300 border-midnight-700' : 'bg-slate-100 text-slate-900 border-slate-300 font-bold']">{{ task.issue_key }}</span>
                    <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-950']">{{ task.title }}</span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0 font-mono">
                    <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                      {{ getTaskDelayStatus(task).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded text-[11px] font-mono border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                    <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-midnight-950 text-purple-300 border-midnight-700' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                      {{ task.story_points }} pts
                    </span>
                    <button
                      @click.stop="openRemoteDispatch(task)"
                      :disabled="!executionGateFor(task).allowed"
                      class="px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title="🚀 Run on Connected Desktop Agent"
                    >
                      <Icons name="Zap" :size="11" class="text-phantom-mint" />
                      <span class="leading-none">🚀 Run on Connected Desktop Agent</span>
                    </button>
                  </div>
                </div>

                <div v-if="backlogTasks.length === 0" class="py-6 text-center text-xs text-slate-500 italic font-medium font-mono">
                  Backlog is empty.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===================================================================== -->
        <!-- VIEW 3: ROADMAP & TIMELINE                                            -->
        <!-- ===================================================================== -->
        <div v-else-if="currentView === 'roadmap'" class="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          <div :class="['sticky top-0 z-10 -mx-4 -mt-4 border-b px-4 pt-4 pb-3 sm:-mx-6 sm:px-6 backdrop-blur-xl', isDarkMode ? 'border-midnight-800 bg-midnight-900/95' : 'border-slate-200 bg-slate-50/95']">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-phantom-mint">Delivery control</p>
                <h2 :class="['mt-0.5 text-lg font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">{{ activeProjectObject?.title || 'Roadmap & project delivery' }}</h2>
                <p :class="['mt-0.5 text-xs font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">A clear view of health, milestones and scheduled work.</p>
              </div>
              <button
                v-if="hasSelectedProject"
                @click="exportRoadmapWorkbook"
                :disabled="isRoadmapExporting"
                class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 px-3.5 py-2 text-xs font-extrabold shadow-sm transition-colors disabled:cursor-wait disabled:opacity-70 shrink-0"
              >
                <Icons :name="isRoadmapExporting ? 'LoaderCircle' : 'FileSpreadsheet'" :size="15" :class="isRoadmapExporting ? 'animate-spin' : ''" />
                <span class="leading-none">{{ isRoadmapExporting ? 'Creating Excel…' : 'Export Excel' }}</span>
              </button>
            </div>
            <div v-if="hasSelectedProject" class="mt-4 flex gap-1 overflow-x-auto rounded-xl border p-1 w-max min-w-full sm:min-w-0 font-mono" :class="isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200 bg-white'">
              <button
                v-for="tab in roadmapTabs"
                :key="tab.id"
                @click="setRoadmapTab(tab.id)"
                :class="[
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors shrink-0',
                  roadmapTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-extrabold shadow-sm'
                    : (isDarkMode ? 'text-slate-400 hover:bg-midnight-850 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950')
                ]"
              >
                <Icons :name="tab.icon" :size="14" />
                <span class="leading-none">{{ tab.label }}</span>
              </button>
            </div>
          </div>

          <div v-if="!hasSelectedProject" :class="['mx-auto mt-8 max-w-xl rounded-2xl border p-8 text-center', isDarkMode ? 'border-midnight-800 bg-midnight-900' : 'border-slate-200 bg-white']">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xl text-emerald-400">
              <Icons name="FolderGit2" :size="24" />
            </div>
            <h3 :class="['mt-4 text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Select a project to view its roadmap</h3>
            <p :class="['mt-2 text-sm leading-6 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">Project health, delivery trend and the Gantt timeline are intentionally scoped to one project so the signals stay actionable.</p>
            <div class="mt-5 flex flex-wrap justify-center gap-2 font-mono">
              <button
                v-for="project in projectList"
                :key="project.id"
                @click="selectedProjectId = project.id"
                :class="['rounded-lg border px-3 py-2 text-xs font-bold transition-colors', isDarkMode ? 'border-midnight-700 text-slate-200 hover:border-emerald-500 hover:bg-midnight-850' : 'border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50']"
              >
                {{ project.title }}
              </button>
            </div>
          </div>

          <template v-else>
            <ProjectRoadmapDashboard v-show="roadmapTab === 'overview'" :project-name="activeProjectObject?.title || 'Project'" :tasks="roadmapTasks" :is-dark-mode="isDarkMode" />
            <ProjectGantt v-show="roadmapTab === 'timeline'" :epics="roadmapEpics" :tasks="roadmapTasks" :is-dark-mode="isDarkMode" @open-task="openTaskDrawer" />

            <section v-show="roadmapTab === 'epics'" class="space-y-3">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <h3 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Epic progress</h3>
                  <p :class="['mt-0.5 text-xs font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Delete an Epic without deleting its linked tasks.</p>
                </div>
                <span :class="['text-xs font-mono font-semibold', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ roadmapEpics.length }} Epic{{ roadmapEpics.length === 1 ? '' : 's' }}</span>
              </div>

              <div class="space-y-4">
                <div
                  v-for="epic in roadmapEpics"
                  :key="epic.id"
                  :class="['p-4 rounded-2xl border space-y-3 shadow-xs', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                      <button
                        type="button"
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors"
                        :class="isDarkMode ? 'border-midnight-700 text-slate-300 hover:border-purple-500 hover:bg-midnight-850' : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50'"
                        :aria-label="`${expandedRoadmapEpicIds.includes(epic.id) ? 'Collapse' : 'Expand'} ${epic.title} tasks`"
                        @click="toggleRoadmapEpic(epic.id)"
                      >
                        <Icons :name="expandedRoadmapEpicIds.includes(epic.id) ? 'Minus' : 'Plus'" :size="14" />
                      </button>
                      <Icons name="Layers" :size="16" class="text-purple-400 shrink-0" />
                      <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded border', isDarkMode ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-800 border-purple-200']">{{ epic.issue_key }}</span>
                      <h3 :class="['text-sm sm:text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ epic.title }}</h3>
                    </div>

                    <div class="flex items-center gap-3 font-mono">
                      <span :class="['hidden text-xs font-bold sm:inline', isDarkMode ? 'text-slate-400' : 'text-slate-600']">{{ epic.start_date || 'Start' }} → {{ epic.due_date || 'Due date' }}</span>
                      <button @click="deleteEpicFromRoadmap(epic)" :class="['rounded-lg border p-2 text-rose-400 transition-colors hover:bg-rose-950/40', isDarkMode ? 'border-midnight-700' : 'border-slate-200']" :aria-label="`Delete Epic ${epic.title}`" :title="`Delete ${epic.title}`">
                        <Icons name="Trash2" :size="14" />
                      </button>
                    </div>
                  </div>

                  <!-- Progress Bar -->
                  <div class="space-y-1.5">
                    <div :class="['h-3 w-full rounded-full overflow-hidden p-0.5', isDarkMode ? 'bg-midnight-950 border border-midnight-800' : 'bg-slate-100 border border-slate-300']">
                      <div
                        class="h-full bg-gradient-to-r from-purple-500 via-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                        :style="{ width: `${(() => { const children = roadmapTasks.filter(task => task.epic_id === epic.id); return children.length ? Math.round((children.filter(task => task.status === 'done').length / children.length) * 100) : (epic.status === 'done' ? 100 : (epic.status === 'in_progress' ? 50 : 0)); })()}%` }"
                      ></div>
                    </div>
                    <div :class="['flex justify-between text-xs font-mono font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                      <span>Status: <strong :class="['uppercase font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ epic.status }}</strong></span>
                      <span class="font-bold">{{ epic.story_points || 0 }} Story Points</span>
                    </div>
                  </div>

                  <div v-if="expandedRoadmapEpicIds.includes(epic.id)" class="space-y-2 border-t pt-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
                    <div class="flex items-center justify-between gap-2 font-mono">
                      <p :class="['text-xs font-bold uppercase tracking-wide', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Tasks in this Epic</p>
                      <span :class="['text-xs font-semibold', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ epicChildren(epic.id).length }} task{{ epicChildren(epic.id).length === 1 ? '' : 's' }}</span>
                    </div>
                    <button
                      v-for="child in epicChildren(epic.id)"
                      :key="child.id"
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors font-mono"
                      :class="isDarkMode ? 'border-midnight-800 bg-midnight-850 hover:border-purple-500 hover:bg-midnight-800' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'"
                      @click="openTaskDrawer(child)"
                    >
                      <span class="min-w-0">
                        <span class="flex items-center gap-2">
                          <span :class="['font-mono text-[11px] font-bold', isDarkMode ? 'text-purple-300' : 'text-blue-700']">{{ child.issue_key }}</span>
                          <span :class="['truncate text-sm font-semibold', isDarkMode ? 'text-slate-100' : 'text-slate-800']">{{ child.title }}</span>
                        </span>
                        <span :class="['mt-1 block text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ child.story_points || 0 }} pts · {{ child.priority }}</span>
                      </span>
                      <span :class="['shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase', child.status === 'done' ? (isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-50 text-emerald-700') : child.status === 'review' ? (isDarkMode ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-amber-50 text-amber-700') : (isDarkMode ? 'bg-midnight-950 text-slate-300 border border-midnight-700' : 'bg-slate-200 text-slate-700')]">{{ child.status.replace('_', ' ') }}</span>
                    </button>
                    <p v-if="epicChildren(epic.id).length === 0" :class="['rounded-lg border border-dashed px-3 py-3 text-xs italic font-mono', isDarkMode ? 'border-midnight-800 text-slate-500' : 'border-slate-300 text-slate-500']">No tasks are linked to this Epic yet.</p>
                  </div>
                </div>

                <div v-if="roadmapEpics.length === 0" class="py-8 text-center text-xs text-slate-500 italic font-medium font-mono">
                  No epics yet. Create an Epic issue to show it on the roadmap.
                </div>
              </div>
            </section>
          </template>
        </div>
        </div>
      </main>
    </div>

    <!-- NOTIFICATION DRAWER -->
    <div
      v-if="isNotificationsOpen"
      class="fixed inset-0 z-[55] bg-midnight-950/50 backdrop-blur-xs"
      @click="isNotificationsOpen = false"
    >
      <aside
        :class="[
          'absolute right-0 top-0 h-full w-full max-w-sm border-l flex flex-col shadow-2xl animate-slideInRight font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
        @click.stop
      >
        <div :class="['px-5 py-4 border-b flex items-center justify-between shrink-0', isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200']">
          <div>
            <p class="text-[10px] uppercase tracking-[0.18em] font-bold text-phantom-mint">Workspace inbox</p>
            <h2 class="mt-1 text-lg font-bold tracking-tight">Notifications</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="unreadNotificationCount"
              @click="markAllNotificationsRead"
              class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-phantom-mint hover:bg-midnight-850 cursor-pointer"
            >
              Mark all read
            </button>
            <button
              @click="isNotificationsOpen = false"
              class="h-8 w-8 rounded-lg text-slate-400 hover:bg-midnight-850 hover:text-white cursor-pointer inline-flex items-center justify-center shrink-0 transition-colors"
              aria-label="Close notifications"
            >
              <Icons name="X" :size="14" />
            </button>
          </div>
        </div>

        <div v-if="notificationItems.length" class="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          <button
            v-for="item in notificationItems"
            :key="item.id"
            @click="openNotification(item)"
            :class="[
              'w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer',
              readNotificationIds.includes(item.id)
                ? (isDarkMode ? 'border-midnight-800 bg-midnight-950/40 hover:bg-midnight-850' : 'border-slate-200 bg-white hover:bg-slate-50')
                : (isDarkMode ? 'border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40' : 'border-blue-200 bg-blue-50/60 hover:bg-blue-50')
            ]"
          >
            <span
              :class="[
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                item.tone === 'warning' ? 'border-amber-500/40 bg-amber-950/50 text-amber-300' : item.tone === 'success' ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300' : 'border-cyan-500/40 bg-cyan-950/50 text-cyan-300'
              ]"
            >
              <Icons :name="item.tone === 'warning' ? 'AlertTriangle' : item.tone === 'success' ? 'CheckCircle' : 'Info'" :size="13" />
            </span>
            <span class="min-w-0 flex-1">
              <span :class="['block text-xs font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-900']">{{ item.title }}</span>
              <span class="mt-1 block text-[11px] leading-4 text-slate-400">{{ item.detail }}</span>
            </span>
            <span v-if="!readNotificationIds.includes(item.id)" class="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400"></span>
          </button>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-midnight-800 bg-midnight-950 text-xl text-slate-400">
            <Icons name="CheckCircle" :size="22" class="text-emerald-400" />
          </div>
          <h3 class="mt-3 text-sm font-bold">You’re all caught up</h3>
          <p class="mt-1 text-xs leading-5 text-slate-400 font-mono">No task risks or workspace updates need your attention.</p>
        </div>
      </aside>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. TASK DETAIL DRAWER (HIGH CONTRAST, EXPANDABLE & CLEAR TYPOGRAPHY)      -->
    <!-- ========================================================================= -->
    <div
      v-if="selectedTask"
      class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-sm flex justify-end"
      @click.self="closeTaskDrawer"
    >
      <div
        :class="[
          'task-detail-drawer w-full border-l h-full flex flex-col shadow-2xl animate-slideInRight transition-all duration-200',
          isDrawerExpanded ? 'max-w-[1440px]' : 'max-w-[980px]',
          isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        ]"
      >
        <!-- Drawer Header -->
        <div :class="['px-6 py-4.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0', isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200']">
          <div class="flex items-center gap-3 min-w-0 font-mono">
            <span :class="['text-sm font-bold px-3 py-1 rounded-xl shadow-xs border inline-flex items-center justify-center shrink-0', isDarkMode ? 'bg-midnight-900 text-cyan-300 border-cyan-500/40' : 'bg-blue-50 text-blue-800 border-blue-200']">
              {{ selectedTask.issue_key }}
            </span>
            <span class="text-slate-500 font-bold">/</span>
            <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-300' : 'text-slate-800']">
              {{ selectedTask.project?.title || 'Project required' }}
            </span>
            <span v-if="selectedTask.epic" class="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-800 shrink-0">
              <Icons name="Layers" :size="12" class="text-purple-400" />
              <span>{{ selectedTask.epic.issue_key }}</span>
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0 font-mono">
            <!-- Fullscreen / Expand Toggle Button -->
            <button
              @click="isDrawerExpanded = !isDrawerExpanded"
              :class="[
                'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs shrink-0',
                isDarkMode ? 'bg-midnight-850 hover:bg-midnight-800 border-midnight-700 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              ]"
              :title="isDrawerExpanded ? 'Collapse details' : 'Expand to full screen'"
            >
              <Icons :name="isDrawerExpanded ? 'Minimize2' : 'Maximize2'" :size="13" />
              <span class="hidden sm:inline leading-none">{{ isDrawerExpanded ? 'Collapse' : 'Full Screen' }}</span>
            </button>

            <!-- Delete Button -->
            <button
              @click="deleteTask(selectedTask)"
              class="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800 text-xs cursor-pointer font-bold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
              title="Delete issue"
            >
              <Icons name="Trash2" :size="13" />
              <span class="hidden sm:inline leading-none">Delete</span>
            </button>

            <!-- Close Button -->
            <button
              @click="closeTaskDrawer"
              :class="[
                'h-8 w-8 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-xs inline-flex items-center justify-center shrink-0',
                isDarkMode ? 'bg-midnight-850 hover:bg-midnight-800 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              ]"
              title="Close details (Esc)"
            >
              <Icons name="X" :size="14" />
            </button>
          </div>
        </div>

        <div v-if="drawerSaveError" class="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
          <span>{{ drawerSaveError }}</span><button class="font-bold underline cursor-pointer" @click="drawerSaveError = ''">Dismiss</button>
        </div>

        <!-- Drawer Body: reading-first surface with secondary context below -->
        <div class="flex-1 p-5 sm:p-8 overflow-y-auto">
          <div class="mx-auto max-w-5xl space-y-6">
            <!-- Large Title Input -->
            <div class="space-y-1 font-mono">
              <label :class="['text-[11px] font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Task Title (Issue Title)
              </label>
              <input
                v-model="selectedTask.title"
                @blur="saveTaskDrawerChanges"
                :class="[
                  'w-full font-bold text-xl sm:text-2xl lg:text-3xl bg-transparent border-b-2 border-midnight-800 focus:border-phantom-mint focus:outline-none py-2 transition-colors leading-snug',
                  isDarkMode ? 'text-white placeholder-slate-600' : 'text-slate-950 placeholder-slate-400'
                ]"
                placeholder="Enter task title..."
              />
            </div>

            <section :class="['rounded-2xl border p-3 shadow-sm font-mono', isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200 bg-white']" aria-label="Quick task edits">
              <div class="mb-2 flex items-center justify-between"><span :class="['text-[10px] font-bold uppercase tracking-[0.14em]', isDarkMode ? 'text-phantom-mint' : 'text-slate-500']">Quick edit</span><span :class="['text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Changes save automatically</span></div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <select v-model="selectedTask.status" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="review">Review</option><option value="done">Done</option></select>
                <select v-model="selectedTask.priority" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'"><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
                <select v-model="selectedTask.story_points" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'"><option :value="null">Points</option><option v-for="pts in [1, 2, 3, 5, 8, 13, 21]" :key="pts" :value="pts">{{ pts }} pts</option></select>
                <input v-model="selectedTask.due_date" type="date" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'" aria-label="Due date" />
                <select v-if="selectedTask.issue_type !== 'epic'" v-model="selectedTask.sprint_id" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'"><option :value="null">Backlog</option><option v-for="sprint in sprintList" :key="sprint.id" :value="sprint.id">{{ sprint.name }}</option></select>
                <select v-if="selectedTask.issue_type !== 'epic'" v-model="selectedTask.epic_id" @change="saveTaskDrawerChanges" class="min-w-0 rounded-lg border px-2 py-2 text-xs font-semibold" :class="isDarkMode ? 'border-midnight-700 bg-midnight-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'"><option :value="null">No Epic</option><option v-for="epic in epicList" :key="epic.id" :value="epic.id">{{ epic.issue_key }}</option></select>
              </div>
            </section>

            <details v-if="selectedTask.issue_type !== 'epic'" :class="['rounded-2xl border p-3 shadow-sm font-mono', isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200 bg-white']">
              <summary class="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-bold">
                <span>Dependencies <span class="text-phantom-mint">({{ selectedDependencyIds.length }})</span></span>
                <span class="text-[10px] font-normal text-amber-300">Human review required before changing execution order</span>
              </summary>
              <p class="mt-2 text-[11px] leading-relaxed text-slate-400">
                A selected task must be done before this task can run. Remove one circular link to unblock an Epic, then retry dispatch.
              </p>
              <div class="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
                <label v-for="candidate in dependencyCandidates" :key="candidate.id" class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-midnight-850">
                  <input v-model="selectedDependencyIds" :value="candidate.id" type="checkbox" class="h-3.5 w-3.5 rounded border-midnight-700 text-phantom-mint focus:ring-phantom-mint bg-midnight-900" @change="saveTaskDrawerChanges" />
                  <span class="text-cyan-300">{{ candidate.issue_key || `#${candidate.id}` }}</span>
                  <span class="truncate">{{ candidate.title }}</span>
                  <span class="ml-auto shrink-0 text-[10px] text-slate-500 uppercase">{{ candidate.status }}</span>
                </label>
                <p v-if="dependencyCandidates.length === 0" class="px-2 py-1 text-[11px] text-slate-500">No other work item is available in this project.</p>
              </div>
            </details>

            <!-- Warning Diagnosis & Quick Actions Box -->
            <div
              v-if="getTaskDelayStatus(selectedTask).isOverdue || getTaskDelayStatus(selectedTask).isDelayed"
              :class="[
                'p-4 sm:p-5 rounded-2xl border space-y-3 transition-all shadow-xs font-mono',
                getTaskDelayStatus(selectedTask).isOverdue
                  ? (isDarkMode ? 'bg-rose-950/50 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-950')
                  : (isDarkMode ? 'bg-amber-950/50 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950')
              ]"
            >
              <div class="flex items-center gap-3">
                <Icons name="AlertTriangle" :size="24" :class="getTaskDelayStatus(selectedTask).isOverdue ? 'text-rose-400' : 'text-amber-400'" />
                <div>
                  <div class="font-bold text-sm sm:text-base">
                    {{ getTaskDelayStatus(selectedTask).label }}
                  </div>
                  <div class="text-xs sm:text-sm opacity-90 font-medium mt-0.5">
                    {{ getTaskDelayStatus(selectedTask).reason }}
                  </div>
                </div>
              </div>

              <!-- Quick Action Buttons -->
              <div :class="['pt-3 border-t flex flex-wrap items-center gap-2 text-xs', isDarkMode ? 'border-rose-900/60' : 'border-rose-200']">
                <span class="font-mono text-xs font-bold uppercase opacity-80 mr-1">Quick actions:</span>
                <button
                  @click="extendDueDate(1)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-midnight-900 border-midnight-700 hover:bg-midnight-850 cursor-pointer shadow-xs"
                  title="Extend by 1 day"
                >
                  +1 Day
                </button>
                <button
                  @click="extendDueDate(3)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-midnight-900 border-midnight-700 hover:bg-midnight-850 cursor-pointer shadow-xs"
                  title="Extend by 3 days"
                >
                  +3 Days
                </button>
                <button
                  @click="extendDueDate(7)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-midnight-900 border-midnight-700 hover:bg-midnight-850 cursor-pointer shadow-xs"
                  title="Extend by 1 week"
                >
                  +1 Week
                </button>
                <button
                  v-if="selectedTask.priority !== 'urgent'"
                  @click="increaseTaskPriority"
                  class="px-3.5 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs ml-auto inline-flex items-center gap-1.5"
                >
                  <Icons name="AlertCircle" :size="13" />
                  <span class="leading-none">Mark Urgent</span>
                </button>
              </div>
            </div>

            <!-- Description Markdown & Code Render -->
            <div class="space-y-2.5 font-mono">
              <div class="flex items-center justify-between pb-2 border-b border-midnight-800">
                <span :class="['text-xs font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <Icons name="FileText" :size="14" class="text-phantom-mint" />
                  <span>DESCRIPTION (MARKDOWN)</span>
                </span>
                <button
                  @click="isEditingDescription = !isEditingDescription"
                  class="text-xs px-3.5 py-1.5 rounded-xl font-bold bg-midnight-850 text-cyan-300 hover:bg-midnight-800 transition-colors border border-midnight-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Icons :name="isEditingDescription ? 'Eye' : 'Edit3'" :size="12" />
                  <span class="leading-none">{{ isEditingDescription ? 'Preview' : 'Edit Markdown' }}</span>
                </button>
              </div>

              <!-- Editing Mode -->
              <div v-if="isEditingDescription" class="space-y-2">
                <textarea
                  v-model="descriptionEditContent"
                  rows="10"
                  :class="[
                    'w-full p-4 rounded-2xl border text-sm font-mono focus:outline-none focus:border-phantom-mint shadow-xs font-medium leading-relaxed',
                    isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950'
                  ]"
                  placeholder="Enter a Markdown description (# heading, - list, ```code...)"
                ></textarea>
                <div class="flex justify-end gap-2">
                  <button
                    @click="isEditingDescription = false"
                    class="px-4 py-2 rounded-xl border border-midnight-700 text-xs font-bold cursor-pointer hover:bg-midnight-850"
                  >
                    Cancel
                  </button>
                  <button
                    @click="isEditingDescription = false; saveTaskDrawerChanges();"
                    class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Icons name="CheckCircle" :size="13" />
                    <span class="leading-none">Save Description</span>
                  </button>
                </div>
              </div>

              <!-- Rendered Markdown Mode -->
              <div
                v-else
                :class="[
                  'p-6 rounded-2xl border text-sm sm:text-base leading-relaxed min-h-[140px] shadow-xs',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-slate-50/90 border-slate-200/90 text-slate-900'
                ]"
              >
                <div v-if="selectedTask.description" v-html="formatMarkdown(selectedTask.description)"></div>
                <div v-else class="text-slate-500 italic font-medium py-6 text-center">
                  No detailed description yet. Click "Edit Markdown" to add content.
                </div>
              </div>
            </div>

            <!-- Subtasks Checklist -->
            <div class="space-y-3 pt-2 font-mono">
              <div class="flex items-center justify-between pb-2 border-b border-midnight-800">
                <span :class="['text-xs font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <Icons name="ListChecks" :size="14" class="text-phantom-mint" />
                  <span>SUBTASKS</span>
                </span>
                <span :class="['text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center justify-center', isDarkMode ? 'bg-midnight-950 text-slate-200 border-midnight-800' : 'bg-slate-100 text-slate-800 border-slate-300 shadow-xs']">
                  {{ (selectedTask.subtasks || []).filter(s => s.done).length }}/{{ (selectedTask.subtasks || []).length }} complete
                </span>
              </div>

              <div class="flex gap-2.5">
                <input
                  v-model="newSubtaskText"
                  @keydown.enter="addSubtask"
                  placeholder="+ Add a subtask... (Press Enter)"
                  :class="[
                    'flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-medium font-mono',
                    isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  ]"
                />
                <button
                  @click="addSubtask"
                  class="px-5 py-2.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 cursor-pointer shadow-xs transition-colors shrink-0 inline-flex items-center gap-1.5"
                >
                  <Icons name="Plus" :size="14" />
                  <span class="leading-none">Add</span>
                </button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="st in selectedTask.subtasks || []"
                  :key="st.id"
                  :class="[
                    'flex items-center justify-between p-3.5 rounded-xl border text-sm shadow-xs transition-all',
                    st.done
                      ? (isDarkMode ? 'bg-midnight-950/60 border-midnight-800/80 opacity-75' : 'bg-slate-50/80 border-slate-200 opacity-75')
                      : (isDarkMode ? 'bg-midnight-850 border-midnight-800' : 'bg-white border-slate-200')
                  ]"
                >
                  <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      :checked="st.done"
                      @change="toggleSubtask(st)"
                      class="w-4 h-4 rounded text-phantom-mint focus:ring-0 cursor-pointer bg-midnight-900 border-midnight-700"
                    />
                    <span :class="['truncate text-sm font-semibold', st.done ? 'line-through text-slate-500' : (isDarkMode ? 'text-slate-100' : 'text-slate-950')]">
                      {{ st.text }}
                    </span>
                  </label>

                  <button @click="deleteSubtask(st.id)" class="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 text-xs cursor-pointer font-bold ml-2 transition-colors" title="Delete subtask">
                    <Icons name="X" :size="13" />
                  </button>
                </div>

                <div v-if="!selectedTask.subtasks || selectedTask.subtasks.length === 0" class="py-4 text-center text-xs text-slate-500 italic">
                  No subtasks yet. Enter a title above to add one.
                </div>
              </div>
            </div>
          </div>

          <TaskContextRail :dark="isDarkMode">
            <details class="group" open>
            <summary class="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-midnight-800 flex items-center justify-between gap-1.5 cursor-pointer list-none">
              <span class="flex items-center gap-1.5">
              <Icons name="Sliders" :size="14" class="text-phantom-mint" />
              <span>TASK CONTEXT</span>
              </span>
              <span class="text-[10px] transition-transform group-open:rotate-180">⌄</span>
            </summary>

            <div class="mt-5 space-y-5 font-mono">

            <!-- Status -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Status</label>
              <select
                v-model="selectedTask.status"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-bold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <!-- Issue Type -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Issue Type</label>
              <select
                v-model="selectedTask.issue_type"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-bold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="task">Task</option>
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
              </select>
            </div>

            <!-- Story Points (7 Fibonacci Buttons Grid) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Story Points (Fibonacci)</label>
                <span class="font-mono text-xs font-bold text-phantom-mint">{{ selectedTask.story_points || 0 }} pts</span>
              </div>
              <div class="grid grid-cols-4 gap-2 font-mono">
                <button
                  v-for="pts in [1, 2, 3, 5, 8, 13, 21]"
                  :key="pts"
                  @click="selectedTask.story_points = pts; saveTaskDrawerChanges();"
                  :class="[
                    'h-10 rounded-xl font-mono font-bold text-sm border transition-all cursor-pointer shadow-xs inline-flex items-center justify-center',
                    selectedTask.story_points === pts
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 border-transparent font-black shadow-md scale-105'
                      : (isDarkMode ? 'bg-midnight-950 text-slate-200 border-midnight-800 hover:bg-midnight-850' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100')
                  ]"
                >
                  {{ pts }}
                </button>
              </div>
            </div>

            <!-- Sprint Link -->
            <div v-if="selectedTask.issue_type !== 'epic'" class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Sprint</label>
              <select
                v-model="selectedTask.sprint_id"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-semibold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">Backlog (No Sprint)</option>
                <option v-for="sprint in sprintList" :key="sprint.id" :value="sprint.id">
                  {{ sprint.name }} ({{ sprint.status.toUpperCase() }})
                </option>
              </select>
            </div>

            <!-- Epic Link -->
            <div v-if="selectedTask.issue_type !== 'epic'" class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Epic</label>
              <select
                v-model="selectedTask.epic_id"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-semibold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">No Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  {{ epic.issue_key }} — {{ epic.title }}
                </option>
              </select>
            </div>

            <!-- Priority -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Priority</label>
              <select
                v-model="selectedTask.priority"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-bold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <!-- Due Date -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Due Date</label>
              <input
                v-model="selectedTask.due_date"
                type="date"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-phantom-mint shadow-xs font-semibold',
                  isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              />
            </div>

            <div v-if="selectedTask.documents?.length" :class="['space-y-2 pt-4 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
              <label :class="['font-mono text-xs font-bold uppercase', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Task references</label>
              <a v-for="document in selectedTask.documents" :key="document.id" :href="document.url || '#'" target="_blank" rel="noreferrer" class="block text-[11px] text-cyan-400 underline">{{ document.pivot?.is_required ? 'Required · ' : '' }}{{ document.title }}</a>
            </div>

            <!-- Agent execution and verification -->
            <details :class="['group border-t pt-4', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2">
                  <label :class="['font-mono text-xs font-bold uppercase', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Execution <span class="sr-only">Agent activity & evidence</span></label>
                  <span :class="['rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap inline-flex items-center justify-center', selectedExecutionGate.allowed ? (isDarkMode ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700') : selectedExecutionGate.code === 'blocked' || selectedExecutionGate.code === 'review' ? (isDarkMode ? 'border-amber-800 bg-amber-950/30 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700') : (isDarkMode ? 'border-midnight-700 bg-midnight-950 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500')]">{{ selectedExecutionGate.title }}</span>
                </div>
                <span class="flex shrink-0 items-center gap-2"><span v-if="selectedAgentRuns.length" class="text-[10px] text-slate-400 font-mono">{{ selectedAgentRuns.length }} run{{ selectedAgentRuns.length === 1 ? '' : 's' }}</span><span v-if="isAgentRunsLoading" class="text-[10px] text-slate-400 font-mono">Syncing…</span><span class="text-[10px] text-slate-500 transition-transform group-open:rotate-180">⌄</span></span>
              </summary>
              <div class="mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1 font-mono">
              <div :class="['rounded-xl border p-3 text-xs', selectedExecutionGate.allowed ? (isDarkMode ? 'border-emerald-800/70 bg-emerald-950/20 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800') : (isDarkMode ? 'border-amber-800/70 bg-amber-950/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800')]">
                <p class="font-semibold">{{ selectedExecutionGate.title }}</p>
                <p class="mt-1 leading-5 opacity-80">{{ selectedExecutionGate.detail }}</p>
                <div v-if="selectedExecutionGate.pendingLabels.length" class="mt-2 flex flex-wrap gap-1.5"><span v-for="label in selectedExecutionGate.pendingLabels" :key="label" class="rounded-md border border-amber-700/50 px-1.5 py-0.5 font-mono text-[10px]">{{ label }}</span></div>
              </div>

              <!-- Primary Remote Dispatch CTA -->
              <div class="space-y-2">
                <button
                  @click="openRemoteDispatch(selectedTask)"
                  :disabled="!selectedExecutionGate.allowed"
                  class="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 shadow-md shadow-emerald-500/20 active:scale-98 border border-emerald-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icons name="Zap" :size="14" class="text-midnight-950" />
                  <span class="leading-none">Dispatch to Connected Desktop Agent (Auto-Pilot)</span>
                </button>

                <!-- Quick local provider launcher -->
                <div class="grid grid-cols-3 gap-1.5">
                  <button v-for="provider in ['codex', 'claude_code', 'antigravity']" :key="`local-${provider}`" @click="startAgentRun(provider)" :disabled="!selectedExecutionGate.allowed" class="rounded-lg border px-2 py-1.5 text-[10px] font-bold cursor-pointer hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 flex flex-col items-center gap-0.5" :class="isDarkMode ? 'border-midnight-700 bg-midnight-950 text-slate-200' : 'border-slate-300 bg-white text-slate-800'">
                    <span>{{ provider === 'claude_code' ? 'Local Claude' : provider === 'antigravity' ? 'Local AGY' : 'Local Codex' }}</span>
                    <span class="text-[8px] font-mono text-slate-400 opacity-80">{{ selectedProviderModel[provider] }}</span>
                  </button>
                </div>
              </div>

              <p v-if="agentRunFeedback" class="text-[11px] leading-relaxed text-cyan-300">{{ agentRunFeedback }}</p>

              <!-- Real-time Streamback Console for Active Run -->
              <StreambackConsole
                v-if="selectedAgentRuns.length > 0"
                :task="selectedTask"
                :active-run="selectedAgentRuns[0] as any"
                :is-dark-mode="isDarkMode"
                @approved="saveTaskDrawerChanges(); loadAgentRuns(selectedTask.id)"
                @rejected="saveTaskDrawerChanges(); loadAgentRuns(selectedTask.id)"
                @refresh="loadAgentRuns(selectedTask.id)"
              />

              <!-- Older runs collapsed list -->
              <div v-if="selectedAgentRuns.length > 1" class="space-y-2 pt-2 border-t border-midnight-800/60">
                <span class="font-mono text-[10px] font-bold uppercase text-slate-400">Prior Runs History</span>
                <div v-for="run in selectedAgentRuns.slice(1)" :key="run.id" :class="['rounded-xl border p-2.5 space-y-1.5 opacity-80', isDarkMode ? 'border-midnight-800 bg-midnight-950' : 'border-slate-200 bg-white']">
                  <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="font-bold text-[11px]">{{ run.provider }} · Run #{{ run.id }}</span>
                    <span class="rounded-full border px-1.5 py-0.2 font-mono text-[9px]">{{ run.status }}</span>
                  </div>
                  <p v-if="run.summary" class="text-[10px] text-slate-400 truncate">{{ run.summary }}</p>
                </div>
              </div>

              <p v-if="!selectedAgentRuns.length && !isAgentRunsLoading" class="text-[11px] text-slate-500 font-mono">
                No active runs yet. Click Dispatch to Desktop Agent or choose a local CLI provider.
              </p>
              </div>
            </details>

            <!-- E2E Transition History & Actor Audit Trail -->
            <details open :class="['group border-t pt-4', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-mono">
                <label :class="['text-xs font-bold uppercase flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <Icons name="History" :size="14" class="text-phantom-mint shrink-0" />
                  <span class="leading-none">Lịch sử E2E & Người xử lý (Audit Trail)</span>
                </label>
                <span class="text-[10px] text-slate-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div class="mt-3">
                <TaskHistoryTimeline
                  v-if="selectedTask"
                  :task-id="selectedTask.id"
                  :is-dark-mode="isDarkMode"
                />
              </div>
            </details>
            </div>
            </details>
          </TaskContextRail>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 4. MODALS (REMOTE DISPATCH, CREATE SPRINT, START SPRINT, ETC.)             -->
    <!-- ========================================================================= -->
    <!-- Modal: Remote Task Dispatch to Connected Desktop -->
    <RemoteDispatchModal
      :show="showRemoteDispatchModal"
      :task="taskForRemoteDispatch || selectedTask"
      :all-tasks="taskList"
      :initial-runner-id="initialRunnerForDispatch"
      :is-dark-mode="isDarkMode"
      @close="showRemoteDispatchModal = false"
      @dispatched="handleRemoteDispatched"
    />

    <!-- Modal: Create Sprint -->
    <div v-if="showSprintModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">Create scrum sprint</h3>
          <button @click="showSprintModal = false" class="text-slate-400 hover:text-white cursor-pointer font-bold"><Icons name="X" :size="14" /></button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project *</label>
            <select
              v-model="newTaskForm.project_id"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-bold', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            >
              <option v-for="project in projectList" :key="project.id" :value="project.id">{{ project.title }}</option>
            </select>
          </div>
          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Sprint name</label>
            <input
              v-model="sprintForm.name"
              placeholder="e.g. Sprint 1 — Feature delivery"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Goal</label>
            <textarea
              v-model="sprintForm.goal"
              rows="3"
              placeholder="Sprint goal..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <button @click="showSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button>
          <button @click="handleSaveSprint" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer">Create Sprint</button>
        </div>
      </div>
    </div>

    <!-- Modal: Start Sprint -->
    <div v-if="showStartSprintModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 font-mono', isDarkMode ? 'bg-midnight-900 border-emerald-500/40 text-white' : 'bg-white border-blue-300 text-slate-950']">
        <h3 class="font-bold text-sm">Start sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">The sprint will move to <strong class="text-phantom-mint">ACTIVE</strong>.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <button @click="showStartSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button>
          <button @click="confirmStartSprint" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer">Start</button>
        </div>
      </div>
    </div>

    <!-- Modal: Complete Sprint -->
    <div v-if="showCompleteSprintModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 font-mono', isDarkMode ? 'bg-midnight-900 border-emerald-500/40 text-white' : 'bg-white border-emerald-300 text-slate-950']">
        <h3 class="font-bold text-sm">Complete Sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">Incomplete tasks will be moved safely to the <strong class="text-phantom-mint">Backlog</strong>.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <button @click="showCompleteSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button>
          <button @click="confirmCompleteSprint" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer">Complete</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create Task -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-4 font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">Create task</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white cursor-pointer font-bold"><Icons name="X" :size="14" /></button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Task title *</label>
            <input
              v-model="newTaskForm.title"
              placeholder="e.g. Update the project dashboard"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Issue Type</label>
              <select
                v-model="newTaskForm.issue_type"
                :class="['w-full p-2.5 rounded-xl border focus:outline-none font-bold', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option value="task">Task</option>
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
              </select>
            </div>

            <div>
              <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Story Points</label>
              <select
                v-model="newTaskForm.story_points"
                :class="['w-full p-2.5 rounded-xl border focus:outline-none font-bold', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option :value="1">1 pt</option>
                <option :value="2">2 pts</option>
                <option :value="3">3 pts</option>
                <option :value="5">5 pts</option>
                <option :value="8">8 pts</option>
                <option :value="13">13 pts</option>
              </select>
            </div>
          </div>

          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Description</label>
            <textarea
              v-model="newTaskForm.description"
              rows="3"
              placeholder="Task details..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <button @click="showCreateModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button>
          <button @click="handleCreateTask" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer">Create Task</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Project -->
    <div v-if="showProjectModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4 font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">
            {{ projectModalMode === 'create' ? 'Create Project' : 'Edit Project' }}
          </h3>
          <button @click="showProjectModal = false" class="text-slate-400 hover:text-white cursor-pointer font-bold"><Icons name="X" :size="14" /></button>
        </div>

        <div class="space-y-3 text-xs">
          <div v-if="projectModalMode === 'create'" class="space-y-3">
            <div v-if="!props.auth?.user" class="rounded-xl border border-cyan-500/40 bg-midnight-950 p-4 text-cyan-300">
              <p class="font-bold">GitHub authentication required</p>
              <p class="mt-1 text-[11px] text-slate-400">Sign in with GitHub to select a repository for this project.</p>
              <a href="/auth/github" class="mt-3 inline-block rounded-lg bg-midnight-850 border border-midnight-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-midnight-800">Sign in with GitHub</a>
            </div>
            <template v-else>
              <input v-model="githubRepositorySearch" placeholder="Search GitHub repositories..." :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-mono', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
              <div v-if="isGithubRepositoriesLoading" class="rounded-xl border border-midnight-800 p-4 text-center text-slate-500">Loading repositories…</div>
              <div v-else class="max-h-56 space-y-2 overflow-y-auto pr-1">
                <button v-for="repo in filteredGithubRepositories" :key="repo.id" type="button" @click="selectedGithubRepository = repo" :class="['w-full rounded-xl border p-3 text-left transition-colors cursor-pointer', selectedGithubRepository?.id === repo.id ? 'border-phantom-mint bg-midnight-850 text-white' : (isDarkMode ? 'border-midnight-700 bg-midnight-950 text-slate-300' : 'border-slate-200 bg-white')]">
                  <div class="flex items-center justify-between gap-2"><span class="font-bold">{{ repo.full_name }}</span><span class="text-[10px] uppercase font-mono">{{ repo.private ? 'Private' : 'Public' }}</span></div>
                  <p class="mt-1 line-clamp-2 text-[11px] text-slate-400">{{ repo.description || 'No description' }}</p>
                  <span class="text-[10px] text-slate-500">{{ repo.default_branch || 'main' }} · {{ repo.language || 'Unknown' }}</span>
                </button>
                <p v-if="!filteredGithubRepositories.length" class="p-4 text-center text-slate-500">No repositories found.</p>
              </div>
              <div v-if="selectedGithubRepository" class="rounded-xl border border-emerald-500/40 bg-midnight-950 p-3 text-emerald-300">Selected <strong>{{ selectedGithubRepository.full_name }}</strong>.</div>
            </template>
          </div>
          <div v-if="projectModalMode === 'edit'">
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project name *</label>
            <input
              v-model="projectForm.title"
              placeholder="e.g. Mobile App 2026"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div v-if="projectModalMode === 'edit'">
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project key (2-5 characters)</label>
            <input
              v-model="projectForm.key"
              placeholder="e.g. APP"
              :class="['w-full p-2.5 rounded-xl border font-mono uppercase focus:outline-none focus:border-phantom-mint font-bold', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project tags</label>
            <input
              v-model="projectForm.tags"
              placeholder="product, platform, priority"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-medium', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
            <p class="mt-1 text-[10px] text-slate-500">Separate tags with commas.</p>
          </div>

          <div v-if="projectModalMode === 'edit'" :class="['pt-3 mt-3 border-t space-y-3', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-xs">Project integrations</h4>
                <p class="text-[10px] text-slate-500">These settings are isolated to this project.</p>
              </div>
              <span v-if="projectGithubStatus?.connected" class="rounded-full border border-emerald-500/40 bg-midnight-950 px-2 py-0.5 text-[10px] font-bold text-emerald-300">GitHub {{ projectGithubStatus.sync_status }}</span>
            </div>
            <input v-model="projectForm.github_repository" placeholder="GitHub repository: owner/repository" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-mono text-xs', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_default_branch" placeholder="Default branch: main" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-mono text-xs', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_webhook_secret" type="password" autocomplete="new-password" placeholder="Repository webhook secret" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint text-xs', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <div>
              <div class="flex items-center justify-between mb-1">
                <label :class="['text-[10px] font-bold uppercase', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project MCP Token (AI Agents)</label>
                <button
                  type="button"
                  @click="generateProjectMcpToken"
                  class="text-[10px] text-phantom-mint hover:underline font-bold cursor-pointer"
                >
                  ⚡ Auto-Generate Token
                </button>
              </div>
              <div class="flex items-center gap-2">
                <input v-model="projectForm.task_hub_mcp_token" type="text" autocomplete="new-password" placeholder="Project MCP token for agents (e.g. th_mcp_...)" :class="['flex-1 p-2.5 rounded-xl border focus:outline-none focus:border-phantom-mint font-mono text-xs', isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
                <button
                  type="button"
                  v-if="editingProjectId"
                  @click="openMcpModal(editingProjectId)"
                  class="px-2.5 py-2.5 rounded-xl bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-[10px] whitespace-nowrap cursor-pointer shadow-xs"
                  title="Open MCP Guide & Config snippets"
                >
                  ⚡ MCP Guide
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 text-[10px] text-slate-500">
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_github_token" type="checkbox" /> Clear GitHub token</label>
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_github_webhook_secret" type="checkbox" /> Clear webhook secret</label>
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_task_hub_mcp_token" type="checkbox" /> Clear MCP token</label>
            </div>
            <div v-if="projectModalMode === 'edit'" class="flex items-center justify-between gap-2">
              <span class="text-[10px] text-slate-500">{{ projectGithubStatus?.last_sync_at ? `Last sync: ${projectGithubStatus.last_sync_at}` : 'GitHub has not been synced' }}</span>
              <button @click="syncProjectGithub" :disabled="isProjectGithubSyncing || !projectForm.github_repository" class="rounded-lg border border-cyan-500/40 bg-midnight-850 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300 hover:bg-midnight-800 disabled:opacity-50 cursor-pointer">{{ isProjectGithubSyncing ? 'Syncing…' : 'Sync GitHub' }}</button>
            </div>
            <p v-if="projectGithubFeedback" class="text-[10px] text-cyan-300">{{ projectGithubFeedback }}</p>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <button @click="showProjectModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button>
          <button @click="handleSaveProject" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 text-xs font-extrabold cursor-pointer">Save Project</button>
        </div>
      </div>
    </div>

    <!-- Backdrop for Project Actions Dropdown Menu -->
    <div
      v-if="activeProjectMenuId !== null"
      class="fixed inset-0 z-30 bg-transparent"
      @click="activeProjectMenuId = null"
    ></div>

    <!-- ========================================================================= -->
    <!-- 5. AI SPRINT & TASK BREAKDOWN GENERATOR MODAL                             -->
    <!-- ========================================================================= -->
    <div
      v-if="showAiGeneratorModal"
      class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        :class="[
          'w-full max-w-4xl border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] flex flex-col font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-950'
        ]"
      >
        <!-- Modal Header -->
        <div :class="['flex items-center justify-between pb-4 border-b shrink-0', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-midnight-950 border border-purple-500/40 inline-flex items-center justify-center shrink-0 shadow-xs text-purple-300">
              <Icons name="Sparkles" :size="20" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base sm:text-lg font-display">AI Project Planning & Breakdown</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  SMART SCRUM ENGINE
                </span>
              </div>
              <p :class="['text-xs mt-0.5 font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                {{ aiGeneratorStep === 'input' ? 'Select repo and enter requirements; AI will analyze project context and draft the plan.' : 'Review, edit, and confirm your backlog plan.' }}
              </p>
            </div>
          </div>

          <button
            @click="showAiGeneratorModal = false"
            :class="['h-8 w-8 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center shrink-0 transition-colors', isDarkMode ? 'hover:bg-midnight-850 text-slate-400' : 'hover:bg-slate-100 text-slate-600']"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <!-- STEP 1: INPUT REQUIREMENTS & CONFIG -->
        <div v-if="aiGeneratorStep === 'input'" class="space-y-5 overflow-y-auto pr-1 flex-1">
          <!-- Requirement Textarea -->
          <div class="space-y-1.5">
            <label :class="['text-xs font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
              Requirement *
            </label>
            <textarea
              v-model="aiForm.prompt"
              rows="3"
              placeholder="e.g., Implement Google OAuth authentication for existing users."
              :class="[
                'w-full p-3.5 rounded-2xl border text-xs focus:outline-none focus:border-indigo-500 shadow-xs font-medium leading-relaxed',
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              ]"
            ></textarea>
            <p :class="['text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
              Describe desired outcomes. AI leverages repository docs, architecture, and current backlog context.
            </p>
          </div>

          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Repo / Project</label>
            <select
              v-model="aiForm.project_id"
              :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            >
              <option value="new">✨ Create New Project</option>
              <option v-for="proj in projects" :key="proj.id" :value="proj.id">📁 {{ proj.title }}</option>
            </select>
          </div>

          <button
            class="text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer"
            @click="showAiPlanningOptions = !showAiPlanningOptions"
          >
            {{ showAiPlanningOptions ? '⌃ Hide Planning Options' : '⌄ Customize Sprints, Schedule & Templates' }}
          </button>

          <!-- Quick Templates Picker -->
          <div v-if="showAiPlanningOptions" class="space-y-2">
            <label :class="['font-mono text-[11px] font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
              💡 Common project templates (click to fill)
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="tpl in aiTemplates"
                :key="tpl.label"
                @click="aiForm.prompt = tpl.prompt"
                :class="[
                  'p-3 rounded-xl border text-left text-xs transition-all cursor-pointer shadow-xs group',
                  aiForm.prompt === tpl.prompt
                    ? (isDarkMode ? 'bg-indigo-950/60 border-indigo-500 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-950 ring-2 ring-indigo-100')
                    : (isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300')
                ]"
              >
                <div class="font-bold flex items-center justify-between mb-1">
                  <span>{{ tpl.label }}</span>
                  <span class="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 font-bold">Use ➔</span>
                </div>
                <div :class="['text-[11px] line-clamp-2', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                  {{ tpl.prompt }}
                </div>
              </button>
            </div>
          </div>

          <!-- Config Form: Project, Sprints, Duration, Start Date -->
          <div v-if="showAiPlanningOptions" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <!-- Target Project -->
            <div class="hidden">
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Target Project</label>
              <select
                v-model="aiForm.project_id"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option value="new">✨ Create a new project</option>
                <option v-for="proj in projects" :key="proj.id" :value="proj.id">
                  📁 {{ proj.title }}
                </option>
              </select>
            </div>

            <!-- Sprint Count -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Sprint Count</label>
              <select
                v-model="aiForm.sprint_count"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option :value="1">1 Sprint (Quick MVP)</option>
                <option :value="2">2 Sprints (MVP + Core)</option>
                <option :value="3">3 Sprints (Scrum standard)</option>
                <option :value="4">4 Sprints (Large project)</option>
              </select>
            </div>

            <!-- Sprint Duration -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Sprint Duration</label>
              <select
                v-model="aiForm.sprint_duration_weeks"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option :value="1">1 Week / Sprint</option>
                <option :value="2">2 Weeks / Sprint (Standard)</option>
                <option :value="3">3 Weeks / Sprint</option>
              </select>
            </div>

            <!-- Start Date -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Start Date</label>
              <input
                v-model="aiForm.start_date"
                type="date"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              />
            </div>
          </div>
        </div>

        <!-- STEP 2: INTERACTIVE PREVIEW & TREE VIEW -->
        <div v-else-if="aiGeneratorStep === 'preview' && aiGeneratedPlan" class="space-y-4 overflow-y-auto pr-1 flex-1">
          <!-- Summary Header Banner -->
          <div
            :class="[
              'p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs',
              isDarkMode ? 'bg-indigo-950/40 border-indigo-800' : 'bg-indigo-50 border-indigo-200'
            ]"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm sm:text-base text-indigo-700 dark:text-indigo-300">
                  📁 {{ aiGeneratedPlan.project?.title }}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-600 text-white">
                  KEY: {{ aiGeneratedPlan.project?.key }}
                </span>
              </div>
              <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">
                {{ aiGeneratedPlan.project?.description }}
              </p>
            </div>

            <div class="flex items-center gap-3 font-mono text-xs">
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-indigo-500 font-bold">⚡ {{ aiGeneratedPlan.epics?.length || 0 }}</strong> Epics
              </span>
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-blue-600 font-bold">🏃 {{ aiGeneratedPlan.sprints?.length || 0 }}</strong> Sprints
              </span>
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-purple-600 font-bold">📋 {{ aiGeneratedPlan.summary?.total_tasks || 0 }}</strong> Tasks
              </span>
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-emerald-600 font-bold">💎 {{ aiGeneratedPlan.summary?.total_story_points || 0 }}</strong> Story Pts
              </span>
            </div>
          </div>

          <!-- Section 1: Epics / Roadmap (Separated from Sprints) -->
          <div v-if="aiGeneratedPlan.epics?.length" class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-indigo-400">⚡ ROADMAP EPICS (INITIATIVES)</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {{ aiGeneratedPlan.epics.length }} Roadmap Epics
                </span>
              </div>
              <span class="text-[11px] text-slate-400 italic">Created at project level (sprint_id = null), outside active sprints</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="(epic, eIdx) in aiGeneratedPlan.epics"
                :key="eIdx"
                :class="[
                  'border rounded-2xl p-3.5 space-y-2 transition-all relative overflow-hidden',
                  isDarkMode ? 'bg-indigo-950/20 border-indigo-800/50' : 'bg-indigo-50/60 border-indigo-200 shadow-xs'
                ]"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-indigo-600 text-white shrink-0">
                      ⚡ EPIC
                    </span>
                    <input
                      v-model="epic.title"
                      :class="['font-bold text-xs bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none flex-1 min-w-0', isDarkMode ? 'text-indigo-100' : 'text-indigo-950']"
                    />
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <select
                      v-model="epic.story_points"
                      :class="['p-1 rounded-lg border text-[11px] font-mono font-bold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-indigo-300' : 'bg-white border-indigo-200 text-indigo-900']"
                    >
                      <option :value="5">5 pts</option>
                      <option :value="8">8 pts</option>
                      <option :value="13">13 pts</option>
                      <option :value="21">21 pts</option>
                    </select>
                    <select
                      v-model="epic.priority"
                      :class="['p-1 rounded-lg border text-[11px] font-bold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900']"
                    >
                      <option value="urgent">🔴 Urgent</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">⚪ Low</option>
                    </select>
                  </div>
                </div>
                <textarea
                  v-model="epic.description"
                  rows="2"
                  :class="['w-full text-[11px] bg-transparent border-0 resize-none focus:outline-none rounded p-1', isDarkMode ? 'text-slate-300 bg-slate-900/40' : 'text-slate-600 bg-white/60']"
                  placeholder="Describe Epic scope and acceptance criteria..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Section 2: Sprints & Tasks Hierarchy List -->
          <div class="space-y-3">
            <div class="flex items-center justify-between pt-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-blue-400">🏃 SPRINTS & SPRINT TASKS</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {{ aiGeneratedPlan.sprints?.length || 0 }} Sprints
                </span>
              </div>
              <span class="text-[11px] text-slate-400 italic">Contains Stories, Tasks, and Bugs linked to parent Epics</span>
            </div>

            <div class="space-y-4">
              <div
                v-for="(sprint, sIdx) in aiGeneratedPlan.sprints"
                :key="sIdx"
                :class="[
                  'border rounded-2xl p-4 space-y-3 transition-all shadow-xs',
                  isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                ]"
              >
                <!-- Sprint Header -->
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-blue-600"></span>
                    <input
                      v-model="sprint.name"
                      :class="['font-bold text-sm bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-0.5', isDarkMode ? 'text-white' : 'text-slate-950']"
                    />
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      {{ sprint.start_date }} ➔ {{ sprint.end_date }}
                    </span>
                  </div>
                  <span class="text-xs font-mono font-medium text-slate-500">
                    {{ sprint.tasks?.filter((t: any) => t.issue_type !== 'epic').length || 0 }} tasks • {{ sprint.tasks?.filter((t: any) => t.issue_type !== 'epic').reduce((acc: number, t: any) => acc + (Number(t.story_points) || 0), 0) }} pts
                  </span>
                </div>

                <div class="text-xs italic text-slate-500 font-medium">
                  🎯 Goal: {{ sprint.goal }}
                </div>

                <!-- Sprint Tasks -->
                <div class="space-y-2">
                  <div
                    v-for="(task, tIdx) in sprint.tasks"
                    :key="tIdx"
                    :class="[
                      'p-3 rounded-xl border space-y-2 transition-all',
                      isDarkMode ? 'bg-[#0f1523] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    ]"
                  >
                    <div class="flex items-center justify-between gap-2 text-xs">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <span class="text-sm shrink-0">{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                        <input
                          v-model="task.title"
                          :class="['font-semibold text-xs bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1 min-w-0', isDarkMode ? 'text-slate-100' : 'text-slate-950']"
                        />
                        <span v-if="task.epic_ref || task.epic_title" class="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 truncate max-w-[140px]" :title="task.epic_ref || task.epic_title">
                          ⚡ {{ task.epic_ref || task.epic_title }}
                        </span>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <!-- Story Points -->
                        <select
                          v-model="task.story_points"
                          :class="['p-1 rounded-lg border text-xs font-mono font-bold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-900']"
                        >
                          <option :value="1">1 pt</option>
                          <option :value="2">2 pts</option>
                          <option :value="3">3 pts</option>
                          <option :value="5">5 pts</option>
                          <option :value="8">8 pts</option>
                          <option :value="13">13 pts</option>
                        </select>

                        <!-- Priority -->
                        <select
                          v-model="task.priority"
                          :class="['p-1 rounded-lg border text-[11px] font-bold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900']"
                        >
                          <option value="urgent">🔴 Urgent</option>
                          <option value="high">🟠 High</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="low">⚪ Low</option>
                        </select>
                      </div>
                    </div>

                    <!-- Subtasks Mini Checklist -->
                    <div v-if="task.subtasks?.length" class="pl-6 space-y-1">
                      <div
                        v-for="(st, stIdx) in task.subtasks"
                        :key="stIdx"
                        class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        <span>▫️</span>
                        <input
                          v-model="st.text"
                          :class="['bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1', isDarkMode ? 'text-slate-300' : 'text-slate-700']"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div :class="['flex items-center justify-between pt-4 border-t shrink-0', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button
            v-if="aiGeneratorStep === 'preview'"
            @click="aiGeneratorStep = 'input'"
            :class="[
              'px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border',
              isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            ]"
          >
            ← Back to Input
          </button>
          <div v-else></div>

          <div class="flex items-center gap-2">
            <button
              @click="showAiGeneratorModal = false"
              :class="[
                'px-4 py-2 rounded-xl text-xs font-bold cursor-pointer',
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              ]"
            >
              Cancel
            </button>

            <!-- Action Button for Step 1 -->
            <button
              v-if="aiGeneratorStep === 'input'"
              @click="handleAnalyzeAiPlan"
              :disabled="isAiAnalyzing || !aiForm.prompt.trim()"
            class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isAiAnalyzing" class="animate-spin">⏳</span>
              <span v-else>✨</span>
              <span>{{ isAiAnalyzing ? 'Analyzing Requirements...' : 'Analyze Requirements' }}</span>
            </button>

            <!-- Action Button for Step 2 -->
            <button
              v-else-if="aiGeneratorStep === 'preview'"
              @click="handleCommitAiPlan"
              :disabled="isAiCommitting"
              class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isAiCommitting" class="animate-spin">⏳</span>
              <span v-else>🚀</span>
              <span>{{ isAiCommitting ? 'Saving...' : 'Generate Epics, Stories & Tasks' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- DAILY REVIEW MODAL -->
    <div v-if="showDailyReview" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4" @click.self="showDailyReview = false">
      <div :class="['w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-5 font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-200 text-slate-950']">
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'"><div><p class="text-[10px] font-mono uppercase text-phantom-mint font-bold">Daily Review</p><h2 class="text-lg font-bold">End of Day Review</h2></div><button @click="showDailyReview = false" class="text-slate-400 hover:text-white font-bold cursor-pointer"><Icons name="X" :size="14" /></button></div>
        <div v-if="isDailyLoading" class="py-8 text-center text-slate-500 text-xs">Summarizing...</div>
        <div v-else-if="dailyReviewData" class="space-y-4 text-xs">
          <div class="grid grid-cols-3 gap-2">
            <div class="p-3 rounded-2xl bg-midnight-950 border border-emerald-500/40"><strong class="block text-xl text-emerald-400 font-extrabold">{{ dailyReviewData.completed_tasks?.length || 0 }}</strong><span class="text-slate-400 text-[11px]">Completed</span></div>
            <div class="p-3 rounded-2xl bg-midnight-950 border border-amber-500/40"><strong class="block text-xl text-amber-400 font-extrabold">{{ dailyReviewData.incompleted_tasks?.length || 0 }}</strong><span class="text-slate-400 text-[11px]">Remaining</span></div>
            <div class="p-3 rounded-2xl bg-midnight-950 border border-purple-500/40"><strong class="block text-xl text-purple-400 font-extrabold">{{ dailyReviewData.total_pomodoros_done || 0 }}</strong><span class="text-slate-400 text-[11px]">Pomodoros</span></div>
          </div>
          <div><h3 class="font-bold mb-2 text-slate-300">Incomplete Tasks</h3><div v-if="dailyReviewData.incompleted_tasks?.length" class="space-y-1.5 max-h-48 overflow-y-auto"><button v-for="task in dailyReviewData.incompleted_tasks" :key="task.id" @click="showDailyReview = false; openTaskDrawer(task)" class="w-full text-left p-2.5 rounded-xl border border-midnight-800 bg-midnight-950 hover:border-phantom-mint cursor-pointer"><span class="font-mono text-[10px] text-cyan-300">{{ task.issue_key }}</span> · <span class="font-medium text-slate-200">{{ task.title }}</span></button></div><p v-else class="text-emerald-400 font-medium flex items-center gap-1.5"><Icons name="CheckCircle" :size="14" /> <span>You completed all priority tasks today.</span></p></div>
        </div>
      </div>
    </div>

    <!-- AI SETTINGS MODAL -->
    <div v-if="showAiSettingsModal" class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4" @click.self="showAiSettingsModal = false">
      <div :class="['w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-5 font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-200 text-slate-950']">
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'"><div><p class="text-[10px] uppercase text-purple-400 font-bold">Private Configuration</p><h2 class="text-lg font-bold">AI Planning Settings</h2></div><button @click="showAiSettingsModal = false" class="text-slate-400 hover:text-white font-bold cursor-pointer"><Icons name="X" :size="14" /></button></div>
        <div v-if="aiSettingsFeedback" class="p-3 rounded-xl bg-midnight-950 border border-purple-500/40 text-purple-300 text-xs font-bold">{{ aiSettingsFeedback }}</div>
        <div class="space-y-3 text-xs">
          <label class="block"><span class="block mb-1 font-bold text-slate-400">Provider</span><select v-model="aiSettings.provider" class="w-full p-2.5 rounded-xl border bg-midnight-950 border-midnight-700 text-slate-100"><option value="template">Offline template fallback</option><option value="openai_compatible">OpenAI-compatible API</option></select></label>
          <label class="block"><span class="block mb-1 font-bold text-slate-400">Base URL</span><input v-model="aiSettings.base_url" class="w-full p-2.5 rounded-xl border bg-midnight-950 border-midnight-700 text-slate-100" placeholder="https://api.openai.com/v1" /></label>
          <div class="grid grid-cols-2 gap-3"><label class="block"><span class="block mb-1 font-bold text-slate-400">Model</span><input v-model="aiSettings.model" class="w-full p-2.5 rounded-xl border bg-midnight-950 border-midnight-700 text-slate-100" /></label><label class="block"><span class="block mb-1 font-bold text-slate-400">Temperature</span><input v-model.number="aiSettings.temperature" type="number" min="0" max="2" step="0.1" class="w-full p-2.5 rounded-xl border bg-midnight-950 border-midnight-700 text-slate-100" /></label></div>
          <label class="block"><span class="block mb-1 font-bold text-slate-400">API key <span v-if="aiSettings.has_api_key" class="text-emerald-400">(saved)</span></span><input v-model="aiSettings.api_key" type="password" autocomplete="new-password" class="w-full p-2.5 rounded-xl border bg-midnight-950 border-midnight-700 text-slate-100" placeholder="Leave blank to keep the current key" /></label>
          <p class="text-[11px] text-slate-500">The key is encrypted on the server and never returned to the browser. If the provider fails, the workspace uses offline templates.</p>
        </div>
        <div class="flex justify-end gap-2 border-t pt-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'"><button @click="showAiSettingsModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-midnight-850">Cancel</button><button @click="saveAiSettings" :disabled="isAiSettingsSaving" class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{{ isAiSettingsSaving ? 'Saving...' : 'Save settings' }}</button></div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- WEEKLY EMAIL REPORT CONFIGURATION & SEND MODAL                       -->
    <!-- ==================================================================== -->
    <div
      v-if="showReportModal"
      class="fixed inset-0 z-50 bg-midnight-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      @click.self="showReportModal = false"
    >
      <div
        :class="[
          'w-full max-w-2xl rounded-3xl border shadow-2xl p-6 sm:p-7 space-y-5 my-8 transition-colors font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-700 text-white' : 'bg-white border-slate-200 text-slate-950'
        ]"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b pb-4 shrink-0" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-midnight-950 border border-midnight-700 flex items-center justify-center text-xl shadow-xs text-cyan-300">
              <Icons name="Mail" :size="18" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-bold font-display tracking-tight">
                Weekly Email Report Settings (Executive Report)
              </h2>
              <p :class="['text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Summarize KPIs, story points, and project progress for stakeholders.
              </p>
            </div>
          </div>
          <button
            @click="showReportModal = false"
            class="text-slate-400 hover:text-white font-bold p-1 text-base cursor-pointer"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <!-- Feedback Alert Banner -->
        <div
          v-if="reportFeedbackMsg"
          :class="[
            'p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between gap-2',
            reportFeedbackType === 'success'
              ? (isDarkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-900')
              : (isDarkMode ? 'bg-rose-950/60 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-900')
          ]"
        >
          <span>{{ reportFeedbackMsg }}</span>
          <button @click="reportFeedbackMsg = ''" class="hover:opacity-75 cursor-pointer"><Icons name="X" :size="12" /></button>
        </div>

        <div v-if="isReportLoading" class="py-12 text-center text-slate-400 text-xs font-medium font-mono">
          <Icons name="LoaderCircle" :size="20" class="animate-spin inline-block mr-2 text-cyan-300" />
          <span>Loading email report settings...</span>
        </div>

        <!-- Settings Form -->
        <div v-else class="space-y-4 text-xs">
          <!-- 1. Enable / Disable Automation Toggle -->
          <div
            :class="[
              'p-4 rounded-2xl border flex items-center justify-between gap-4 cursor-pointer transition-all',
              reportForm.is_enabled
                ? (isDarkMode ? 'bg-midnight-950 border-cyan-500/40 ring-1 ring-cyan-500/30' : 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200')
                : (isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200')
            ]"
            @click="reportForm.is_enabled = !reportForm.is_enabled"
          >
            <div class="flex items-center gap-3">
              <Icons :name="reportForm.is_enabled ? 'Bell' : 'BellOff'" :size="18" :class="reportForm.is_enabled ? 'text-phantom-mint' : 'text-slate-500'" />
              <div>
                <div class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-slate-950'">
                  Automatically send weekly email reports
                </div>
                <div :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                  The system will scan progress and send the report on the selected day and time.
                </div>
              </div>
            </div>

            <!-- Switch visual -->
            <div
              :class="[
                'w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5',
                reportForm.is_enabled ? 'bg-phantom-mint' : (isDarkMode ? 'bg-midnight-800' : 'bg-slate-300')
              ]"
            >
              <div
                :class="[
                  'w-5 h-5 rounded-full bg-midnight-950 transition-transform shadow-xs',
                  reportForm.is_enabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              ></div>
            </div>
          </div>

          <!-- 2. Recipients Emails -->
          <div>
            <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
              Recipient email addresses (stakeholders / PM / clients) <span class="text-rose-500">*</span>
            </label>
            <textarea
              v-model="reportForm.recipients"
              rows="2"
              placeholder="e.g. boss@company.com, ceo@company.com, manager@company.com"
              :class="[
                'w-full border rounded-xl p-3 focus:outline-none focus:border-phantom-mint font-mono text-xs shadow-xs',
                isDarkMode ? 'bg-midnight-950 border-midnight-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              ]"
            ></textarea>
            <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
              Separate multiple email addresses with commas (<strong class="font-mono">,</strong>).
            </p>
          </div>

          <!-- 3. Schedule Timing (Day & Time) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                Delivery day
              </label>
              <select
                v-model="reportForm.day_of_week"
                :class="[
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-phantom-mint font-semibold shadow-xs',
                  isDarkMode ? 'bg-midnight-950 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="monday">Monday (Suggested: start the week)</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday (Suggested: wrap up the week)</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday (Prepare for the week)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                Delivery time
              </label>
              <select
                v-model="reportForm.send_time"
                :class="[
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-phantom-mint font-semibold font-mono shadow-xs',
                  isDarkMode ? 'bg-midnight-950 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="07:30">07:30 AM</option>
                <option value="08:00">08:00 AM (Start of workday)</option>
                <option value="08:30">08:30 AM</option>
                <option value="09:00">09:00 AM</option>
                <option value="17:00">17:00 PM (End of workday)</option>
                <option value="18:00">18:00 PM</option>
                <option value="20:00">20:00 PM</option>
              </select>
            </div>
          </div>

          <!-- 4. Report Title -->
          <div>
            <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
              Report email subject
            </label>
            <input
              v-model="reportForm.report_title"
              type="text"
              placeholder="Weekly Project Progress Report"
              :class="[
                'w-full border rounded-xl p-2.5 focus:outline-none focus:border-phantom-mint font-medium shadow-xs',
                isDarkMode ? 'bg-midnight-950 border-midnight-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              ]"
            />
          </div>

          <!-- 5. Scope & Content Options -->
          <div class="space-y-3">
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="font-bold text-xs" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                  Project scope (select multiple projects to include)
                </label>
                <button
                  type="button"
                  @click="toggleReportProject('all')"
                  :class="[
                    'text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-xs',
                    isReportProjectSelected('all')
                      ? 'bg-phantom-mint text-midnight-950 border-phantom-mint shadow-sm font-extrabold'
                      : (isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-300 hover:bg-midnight-850' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200')
                  ]"
                >
                  All Projects
                </button>
              </div>

              <!-- Project Multi-Select Chips -->
              <div class="flex flex-wrap gap-2 p-3 rounded-2xl border max-h-36 overflow-y-auto" :class="isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200'">
                <button
                  v-for="p in projectList"
                  :key="p.id"
                  type="button"
                  @click="toggleReportProject(p.id)"
                  :class="[
                    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 shadow-xs',
                    isReportProjectSelected(p.id)
                      ? (isDarkMode ? 'bg-midnight-850 text-cyan-300 border-cyan-500/40 font-bold shadow-sm' : 'bg-blue-50 text-blue-900 border-blue-400 font-bold')
                      : (isDarkMode ? 'bg-midnight-900 border-midnight-700 text-slate-300 hover:bg-midnight-850' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100')
                  ]"
                >
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: p.color || '#00f5a0' }"></span>
                  <span>{{ p.title }}</span>
                  <span v-if="isReportProjectSelected(p.id)" class="text-[11px] font-bold">✓</span>
                </button>
              </div>
              <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
                The report includes completed tasks, sprints, and alerts from selected projects (or all projects when "All Projects" is selected).
              </p>
            </div>

            <div class="flex flex-wrap gap-4 pt-1">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_upcoming" class="w-4 h-4 rounded text-phantom-mint focus:ring-phantom-mint bg-midnight-950 border-midnight-700" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Include next-week focus</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_warnings" class="w-4 h-4 rounded text-phantom-mint focus:ring-phantom-mint bg-midnight-950 border-midnight-700" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Include task risk alerts</span>
              </label>
            </div>
          </div>

          <!-- Last Sent Status -->
          <div
            v-if="reportForm.last_sent_at"
            :class="['p-3 rounded-xl border text-[11px] font-mono flex items-center justify-between', isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600']"
          >
            <span>Last successful delivery:</span>
            <strong :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ reportForm.last_sent_at }}</strong>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div :class="['flex flex-wrap items-center justify-between gap-3 pt-4 border-t shrink-0', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <!-- Left: Send Test Report Button -->
          <button
            @click="handleSendReportNow"
            :disabled="isReportSending || isReportLoading || !reportForm.recipients.trim()"
            class="px-4 py-2.5 rounded-xl bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-xs shadow-md transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send a sample report immediately to the entered recipients"
          >
            <Icons v-if="isReportSending" name="LoaderCircle" :size="14" class="animate-spin" />
            <Icons v-else name="Send" :size="14" />
            <span>{{ isReportSending ? 'Sending report...' : 'Send test report now' }}</span>
          </button>

          <!-- Right: Cancel & Save -->
          <div class="flex items-center gap-2">
            <button
              @click="showReportModal = false"
              :class="[
                'px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors',
                isDarkMode ? 'hover:bg-midnight-850 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              ]"
            >
              Close
            </button>

            <button
              @click="handleSaveReportSettings"
              :disabled="isReportSaving || isReportLoading"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons v-if="isReportSaving" name="LoaderCircle" :size="14" class="animate-spin" />
              <Icons v-else name="CheckCircle" :size="14" />
              <span>{{ isReportSaving ? 'Saving...' : 'Save settings' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- MODEL CONTEXT PROTOCOL (MCP) & AI AGENTS MODAL                       -->
    <!-- ==================================================================== -->
    <div
      v-if="showMcpModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto backdrop-blur-md bg-midnight-950/80 animate-fadeIn"
      @click.self="showMcpModal = false"
    >
      <div
        :class="[
          'relative w-full max-w-4xl border rounded-3xl p-5 sm:p-7 shadow-2xl z-10 transition-all flex flex-col max-h-[92vh] overflow-hidden font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        ]"
      >
        <!-- Modal Header -->
        <div class="flex items-start justify-between pb-4 border-b border-midnight-800 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-midnight-950 border border-purple-500/30 flex items-center justify-center text-2xl shadow-inner text-purple-400">
              <Icons name="Zap" :size="22" />
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h3 class="text-base sm:text-lg font-bold font-display">
                  Model Context Protocol (MCP) & AI Agent Setup
                </h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Protocol: 2024-11-05
                </span>
              </div>
              <p :class="['text-xs mt-0.5', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Connect Antigravity 2.0, Cursor, and Claude to read tasks, load context packs, and submit code handoffs automatically.
              </p>
            </div>
          </div>

          <button
            @click="showMcpModal = false"
            :class="[
              'h-8 w-8 rounded-xl border text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center shrink-0',
              isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-400 hover:text-white hover:bg-midnight-850' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            ]"
            title="Close modal"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <!-- Feedback Alert -->
        <div
          v-if="mcpFeedbackMsg"
          :class="[
            'mt-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shrink-0',
            mcpFeedbackType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          ]"
        >
          <span>{{ mcpFeedbackMsg }}</span>
          <button @click="mcpFeedbackMsg = ''" class="text-xs opacity-70 hover:opacity-100 cursor-pointer"><Icons name="X" :size="12" /></button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="overflow-y-auto custom-scrollbar space-y-5 py-4 flex-1 pr-1">
          <!-- 1. Project Selector & Server Endpoint -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            <!-- Project Picker -->
            <div :class="['md:col-span-6 p-4 rounded-2xl border', isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200']">
              <label class="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Select Target Project
              </label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="p in projectList"
                  :key="p.id"
                  @click="handleSelectMcpProject(p.id)"
                  :class="[
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5',
                    selectedMcpProjectId === p.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 border-transparent font-extrabold shadow-xs'
                      : (isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-300 hover:bg-midnight-850' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100')
                  ]"
                >
                  <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: p.color || '#00f5a0' }"></span>
                  <span>{{ p.title }}</span>
                  <span v-if="p.key" class="font-mono text-[9px] opacity-75">({{ p.key }})</span>
                </button>
              </div>
            </div>

            <!-- Server Endpoint -->
            <div :class="['md:col-span-6 p-4 rounded-2xl border flex flex-col justify-between', isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200']">
              <div>
                <label class="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                  2. MCP Server Endpoint URL
                </label>
                <div class="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    readonly
                    :value="mcpData?.server_url || 'https://midnight.macatung.dev/mcp'"
                    :class="['flex-1 p-2 rounded-xl font-mono text-xs border select-all', isDarkMode ? 'bg-midnight-900 border-midnight-800 text-cyan-300' : 'bg-white border-slate-300 text-indigo-900']"
                  />
                  <button
                    @click="copyMcpSnippet('url', mcpData?.server_url || 'https://midnight.macatung.dev/mcp')"
                    class="px-3 py-2 rounded-xl bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 text-xs font-bold cursor-pointer transition-colors shrink-0 inline-flex items-center gap-1"
                  >
                    <Icons :name="copiedSnippetType === 'url' ? 'Check' : 'Copy'" :size="12" />
                    <span>{{ copiedSnippetType === 'url' ? 'Copied' : 'Copy' }}</span>
                  </button>
                </div>
              </div>
              <p class="text-[10px] text-slate-500 mt-2">
                Standard JSON-RPC 2.0 over HTTP endpoint supporting Bearer Token authentication.
              </p>
            </div>
          </div>

          <!-- 2. MCP Authentication Token Management -->
          <div :class="['p-4 sm:p-5 rounded-2xl border space-y-3.5', isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200']">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-bold text-xs flex items-center gap-2">
                  <Icons name="Key" :size="14" class="text-phantom-mint" />
                  <span>Project MCP Token</span>
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
                      mcpData?.has_token ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    ]"
                  >
                    {{ mcpData?.has_token ? '● Configured & Ready' : '○ No Token Set' }}
                  </span>
                </h4>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  Secures AI Agent communication for <strong class="text-phantom-mint">{{ activeMcpProject?.title }}</strong>.
                </p>
              </div>

              <!-- Quick Generate / Revoke Actions -->
              <div class="flex items-center gap-2">
                <button
                  @click="generateMcpTokenForProject"
                  :disabled="isMcpGenerating || isMcpLoading"
                  class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Icons :name="isMcpGenerating ? 'LoaderCircle' : 'Zap'" :size="13" :class="isMcpGenerating ? 'animate-spin' : ''" />
                  <span>{{ mcpData?.has_token ? 'Regenerate Token' : 'Generate Secure Token' }}</span>
                </button>

                <button
                  v-if="mcpData?.has_token"
                  @click="clearMcpTokenForProject"
                  :disabled="isMcpSaving"
                  class="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-950/40 text-xs font-bold cursor-pointer transition-colors"
                >
                  Revoke
                </button>
              </div>
            </div>

            <!-- Token View / Copy Box -->
            <div v-if="mcpData?.has_token" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div :class="['flex-1 flex items-center justify-between p-2.5 rounded-xl border font-mono text-xs min-w-0', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-300']">
                <span class="truncate select-all pr-2">
                  {{ showRawToken ? (mcpData.token || 'Encrypted on server') : (mcpData.masked_token || '••••••••••••••••••••••••••••••••') }}
                </span>
                <button
                  @click="showRawToken = !showRawToken"
                  class="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded cursor-pointer shrink-0"
                >
                  {{ showRawToken ? 'Hide' : 'Show' }}
                </button>
              </div>

              <button
                v-if="mcpData?.token"
                @click="copyMcpSnippet('token', mcpData.token)"
                class="px-4 py-2.5 rounded-xl bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 text-xs font-bold cursor-pointer transition-colors shrink-0 inline-flex items-center justify-center gap-1.5"
              >
                <Icons :name="copiedSnippetType === 'token' ? 'Check' : 'Copy'" :size="12" />
                <span>{{ copiedSnippetType === 'token' ? 'Copied Token' : 'Copy Token' }}</span>
              </button>
            </div>

            <!-- Custom Token Option -->
            <div class="pt-2 border-t border-midnight-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                v-model="customMcpTokenInput"
                type="text"
                placeholder="Or paste your own custom MCP token / secret key..."
                :class="['flex-1 p-2 rounded-xl text-xs border font-mono', isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900']"
              />
              <button
                @click="saveCustomMcpToken"
                :disabled="!customMcpTokenInput.trim() || isMcpSaving"
                class="px-3.5 py-2 rounded-xl bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-xs cursor-pointer disabled:opacity-40 shrink-0"
              >
                {{ isMcpSaving ? 'Saving...' : 'Set Custom Token' }}
              </button>
            </div>
          </div>

          <!-- 3. Client Configuration Snippets (Tabbed) -->
          <div :class="['p-4 sm:p-5 rounded-2xl border space-y-3.5', isDarkMode ? 'bg-midnight-950 border-midnight-800' : 'bg-slate-50 border-slate-200']">
            <!-- Tabs -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-midnight-800 pb-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  @click="activeMcpTab = 'antigravity'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5',
                    activeMcpTab === 'antigravity'
                      ? 'bg-phantom-mint text-midnight-950 font-extrabold shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <Icons name="Sparkles" :size="13" />
                  <span>Google Antigravity 2.0</span>
                </button>

                <button
                  @click="activeMcpTab = 'cursor'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5',
                    activeMcpTab === 'cursor'
                      ? 'bg-phantom-mint text-midnight-950 font-extrabold shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <Icons name="Zap" :size="13" />
                  <span>Cursor IDE</span>
                </button>

                <button
                  @click="activeMcpTab = 'claude'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5',
                    activeMcpTab === 'claude'
                      ? 'bg-phantom-mint text-midnight-950 font-extrabold shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <Icons name="Bot" :size="13" />
                  <span>Claude Desktop</span>
                </button>

                <button
                  @click="activeMcpTab = 'tools'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5',
                    activeMcpTab === 'tools'
                      ? 'bg-phantom-mint text-midnight-950 font-extrabold shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-midnight-850' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <Icons name="Wrench" :size="13" />
                  <span>14 AI Tools</span>
                </button>
              </div>

              <!-- Test Connection Button -->
              <button
                @click="testMcpConnection"
                :disabled="isTestingMcp || !mcpData?.has_token"
                class="px-3 py-1.5 rounded-xl border border-cyan-500/40 text-cyan-300 hover:bg-midnight-850 text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Icons :name="isTestingMcp ? 'LoaderCircle' : 'Send'" :size="13" :class="isTestingMcp ? 'animate-spin' : ''" />
                <span>{{ isTestingMcp ? 'Testing...' : 'Test Connection' }}</span>
              </button>
            </div>

            <!-- Live Test Feedback Box -->
            <div
              v-if="mcpTestStatus?.tested"
              :class="[
                'p-3 rounded-xl text-xs font-mono font-medium flex items-center justify-between',
                mcpTestStatus.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
              ]"
            >
              <span>{{ mcpTestStatus.message }}</span>
              <span v-if="mcpTestStatus.latency" class="text-[10px] opacity-75 font-bold">{{ mcpTestStatus.latency }}ms</span>
            </div>

            <!-- Tab Content: Antigravity 2.0 -->
            <div v-if="activeMcpTab === 'antigravity'" class="space-y-3">
              <div class="text-xs space-y-1">
                <p class="font-bold text-slate-200">Where to save this configuration:</p>
                <ul class="list-disc list-inside text-slate-400 text-[11px] space-y-0.5">
                  <li><strong>Workspace level (Recommended):</strong> Create <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">.agents/mcp_config.json</code> in your project root.</li>
                  <li><strong>Global level:</strong> Save into <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">~/.gemini/config/mcp_config.json</code> (or <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">%USERPROFILE%\.gemini\config\mcp_config.json</code>).</li>
                </ul>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-midnight-900 border-midnight-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.antigravity || {
  "mcpServers": {
    "task-hub": {
      "serverUrl": mcpData?.server_url || "https://midnight.macatung.dev/mcp",
      "headers": {
        "Authorization": `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
      }
    }
  }
}, null, 2) }}</code></pre>

                <button
                  @click="copyMcpSnippet('antigravity', JSON.stringify(mcpData?.configs?.antigravity || {
                    'mcpServers': {
                      'task-hub': {
                        'serverUrl': mcpData?.server_url || 'https://midnight.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'antigravity' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Cursor IDE -->
            <div v-else-if="activeMcpTab === 'cursor'" class="space-y-3">
              <div class="text-xs space-y-1">
                <p class="font-bold text-slate-200">Where to save this configuration for Cursor:</p>
                <p class="text-slate-400 text-[11px]">Save into <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">.cursor/mcp.json</code> or project root <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">.mcp.json</code>.</p>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-midnight-900 border-midnight-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.cursor || {
  "mcpServers": {
    "task-hub": {
      "url": mcpData?.server_url || "https://midnight.macatung.dev/mcp",
      "headers": {
        "Authorization": `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
      }
    }
  }
}, null, 2) }}</code></pre>

                <button
                  @click="copyMcpSnippet('cursor', JSON.stringify(mcpData?.configs?.cursor || {
                    'mcpServers': {
                      'task-hub': {
                        'url': mcpData?.server_url || 'https://midnight.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'cursor' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Claude Desktop -->
            <div v-else-if="activeMcpTab === 'claude'" class="space-y-3">
              <div class="text-xs space-y-1">
                <p class="font-bold text-slate-200">Where to save for Claude Desktop:</p>
                <p class="text-slate-400 text-[11px]">Save into <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows) or <code class="px-1 py-0.5 rounded bg-midnight-900 border border-midnight-800 font-mono text-cyan-300">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS).</p>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-midnight-900 border-midnight-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.claude_desktop || {
  "mcpServers": {
    "task-hub": {
      "url": mcpData?.server_url || "https://midnight.macatung.dev/mcp",
      "headers": {
        "Authorization": `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
      }
    }
  }
}, null, 2) }}</code></pre>

                <button
                  @click="copyMcpSnippet('claude', JSON.stringify(mcpData?.configs?.claude_desktop || {
                    'mcpServers': {
                      'task-hub': {
                        'url': mcpData?.server_url || 'https://midnight.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-midnight-850 hover:bg-midnight-800 border border-midnight-700 text-cyan-300 font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'claude' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Tools Directory -->
            <div v-else-if="activeMcpTab === 'tools'" class="space-y-2.5">
              <p class="text-xs text-slate-400">
                The Midnight Hub MCP server automatically exposes these 14 tools to the AI agent:
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">get_next_action</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Return the smallest actionable high-priority task.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">get_work_item</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read task details, subtasks & sprint backlog.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">get_context_pack</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Build full context pack for AI code synthesis.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">get_project_state</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read project sprint health, blockers & progress.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">start_agent_run</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Register auditable agent lifecycle session.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">complete_agent_handoff</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Submit files changed, tests & request review.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">attach_verification_evidence</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Attach build, test & security logs.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-midnight-900 border-midnight-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-cyan-300">list_project_documents</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read project architecture & spec registry.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-between pt-4 border-t border-midnight-800 shrink-0">
          <span class="text-xs text-slate-500 font-mono">
            Endpoint: <code class="font-mono text-cyan-300">/mcp</code> | JSON-RPC 2.0
          </span>
          <button
            @click="showMcpModal = false"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-midnight-950 font-extrabold text-xs cursor-pointer shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- 🔒 PIN SECURITY GATE MODAL (MASTER PIN: 301095)                      -->
    <!-- ==================================================================== -->
    <div
      v-if="!isPinUnlocked"
      :class="[
        'fixed inset-0 z-50 flex items-center justify-center p-4 select-none overflow-y-auto backdrop-blur-md',
        isDarkMode ? 'bg-midnight-950/95' : 'bg-slate-900/60'
      ]"
    >
      <div
        :class="[
          'relative w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl text-center z-10 transition-all duration-300 font-mono',
          isPinShaking ? 'animate-bounce !border-rose-500' : (isDarkMode ? 'bg-midnight-900 border-midnight-700' : 'bg-white border-slate-300 text-slate-950')
        ]"
      >
        <div class="flex flex-col items-center mb-6">
          <div class="w-14 h-14 rounded-2xl bg-midnight-950 border border-midnight-700 flex items-center justify-center shadow-xs mb-3 text-phantom-mint">
            <Icons name="Lock" :size="24" />
          </div>

          <h2 :class="['text-lg sm:text-xl font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">
            MIDNIGHT HUB WORKSPACE SECURITY
          </h2>
          <p :class="['text-xs mt-1 font-medium font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
            Enter the <strong class="text-phantom-mint font-mono font-bold">6-digit PIN</strong> to unlock the workspace.
          </p>
        </div>

        <!-- 6 PIN Digit Display Slots -->
        <div class="flex items-center justify-center gap-2.5 sm:gap-3 mb-6">
          <div
            v-for="i in 6"
            :key="i"
            :class="[
              'w-11 h-13 sm:w-12 sm:h-14 rounded-2xl border-2 flex items-center justify-center font-mono font-bold text-xl transition-all duration-150',
              pinInput.length >= i
                ? 'border-phantom-mint bg-midnight-950 text-phantom-mint scale-105 shadow-xs'
                : pinInput.length === i - 1
                ? 'border-cyan-400 bg-midnight-950 text-slate-400 ring-2 ring-cyan-500/30'
                : (isDarkMode ? 'border-midnight-800 bg-midnight-950 text-slate-600' : 'border-slate-300 bg-slate-50 text-slate-400')
            ]"
          >
            <span v-if="pinInput.length >= i" class="text-xl text-phantom-mint">●</span>
            <span v-else class="text-slate-600 text-xs">―</span>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="pinError" class="mb-4 text-xs text-rose-300 bg-rose-950/80 border border-rose-800 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5">
          <Icons name="AlertCircle" :size="14" />
          <span>{{ pinError }}</span>
        </div>

        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-2.5 mb-6 max-w-xs mx-auto">
          <button
            v-for="num in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
            :key="num"
            @click="handleNumpadPress(num)"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer shadow-xs',
              isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100 hover:bg-midnight-850' : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
            ]"
          >
            {{ num }}
          </button>

          <button
            @click="handleNumpadClear"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer',
              isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-400 hover:bg-midnight-850' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            ]"
          >
            CLEAR
          </button>

          <button
            @click="handleNumpadPress('0')"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer shadow-xs',
              isDarkMode ? 'bg-midnight-950 border-midnight-700 text-slate-100 hover:bg-midnight-850' : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
            ]"
          >
            0
          </button>

          <button
            @click="handleNumpadBackspace"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center',
              isDarkMode ? 'bg-midnight-950 border-midnight-800 text-slate-400 hover:text-rose-400 hover:bg-midnight-850' : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-red-600 hover:bg-red-50'
            ]"
          >
            <Icons name="Delete" :size="16" />
          </button>
        </div>

        <div :class="['flex items-center justify-between pt-4 border-t text-xs', isDarkMode ? 'border-midnight-800' : 'border-slate-200']">
          <a href="/" :class="['font-bold flex items-center gap-1', isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-950']">
            ← Back to home
          </a>

          <button
            @click="checkPin"
            :disabled="pinInput.length !== 6"
            :class="[
              'px-5 py-2 rounded-xl font-extrabold font-mono text-xs transition-all inline-flex items-center gap-1.5 shadow-xs',
              pinInput.length === 6
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 hover:from-emerald-400 hover:to-teal-400 cursor-pointer shadow-emerald-500/20'
                : (isDarkMode ? 'bg-midnight-800 text-slate-600 cursor-not-allowed opacity-60' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60')
            ]"
          >
            <span>UNLOCK</span>
            <Icons name="Unlock" :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- PROJECT DOCUMENTS MODAL -->
    <div
      v-if="isDocsModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-950/80 backdrop-blur-sm animate-fade-in"
      @click.self="isDocsModalOpen = false"
    >
      <div
        :class="[
          'w-full max-w-4xl rounded-3xl border p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar transition-all font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
      >
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
          <div class="flex items-center gap-2.5">
            <Icons name="FileText" :size="20" class="text-phantom-mint shrink-0" />
            <div>
              <h3 class="font-bold text-base">Project Documents & Context Pack</h3>
              <p class="text-xs text-slate-400">{{ activeProjectObject?.title || 'Project' }} · shared context for developers and AI agents</p>
            </div>
          </div>
          <button
            @click="isDocsModalOpen = false"
            aria-label="Close project documents"
            title="Close project documents"
            class="min-h-[36px] min-w-[36px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-midnight-850 focus:outline-none focus:ring-2 focus:ring-phantom-mint transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <ProjectDocumentsPanel
          :project-id="activeProjectObject?.id || null"
          :repository="activeProjectObject?.github_repository"
          :branch="activeProjectObject?.github_default_branch"
          :dark="isDarkMode"
        />
      </div>
    </div>

    <!-- PROJECT RELEASES MODAL -->
    <div
      v-if="isReleasesModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-950/80 backdrop-blur-sm animate-fade-in"
      @click.self="isReleasesModalOpen = false"
    >
      <div
        :class="[
          'w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto custom-scrollbar transition-all font-mono',
          isDarkMode ? 'bg-midnight-900 border-midnight-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
      >
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
          <div class="flex items-center gap-2.5">
            <Icons name="Rocket" :size="20" class="text-phantom-mint shrink-0" />
            <div>
              <h3 class="font-bold text-base">Project Release Log</h3>
              <p class="text-xs text-slate-400">Track deployments, commit SHAs and release changes</p>
            </div>
          </div>
          <button
            @click="isReleasesModalOpen = false"
            class="h-8 w-8 rounded-xl text-slate-400 hover:text-white hover:bg-midnight-850 transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <ProjectReleaseLog
          :project-id="activeProjectObject?.id || null"
          :dark="isDarkMode"
        />
      </div>
    </div>

    <!-- Mount Global UpgradeModal Component -->
    <UpgradeModal />
  </div>
</template>

<style scoped>
.mono-icon {
  color: currentColor;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  line-height: 1;
}

/* Tasks design system: neutral work surface, one accent, restrained motion. */
.tasks-page {
  --tasks-accent: #2563eb;
  --tasks-accent-hover: #1d4ed8;
  --tasks-surface: #ffffff;
  --tasks-surface-muted: #f8fafc;
  --tasks-border: #e2e8f0;
  --tasks-text: #0f172a;
  --tasks-muted: #64748b;
  --tasks-radius: 10px;
}

.tasks-page.dark {
  --tasks-surface: #0f172a;
  --tasks-surface-muted: #0b1220;
  --tasks-border: #1e293b;
  --tasks-text: #f8fafc;
  --tasks-muted: #94a3b8;
}

.tasks-page button,
.tasks-page input,
.tasks-page select,
.tasks-page textarea {
  outline-offset: 2px;
}

.tasks-page button:focus-visible,
.tasks-page input:focus-visible,
.tasks-page select:focus-visible,
.tasks-page textarea:focus-visible,
.tasks-page a:focus-visible {
  outline: 2px solid var(--tasks-accent);
  outline-offset: 2px;
}

.tasks-page header {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
}

.tasks-page [class*="rounded-3xl"],
.tasks-page [class*="rounded-2xl"] {
  border-radius: var(--tasks-radius) !important;
}

.tasks-page [class*="shadow-2xl"],
.tasks-page [class*="shadow-xl"],
.tasks-page [class*="shadow-lg"],
.tasks-page [class*="shadow-md"] {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08) !important;
}

.tasks-page.dark [class*="shadow-2xl"],
.tasks-page.dark [class*="shadow-xl"],
.tasks-page.dark [class*="shadow-lg"],
.tasks-page.dark [class*="shadow-md"] {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24) !important;
}

.tasks-page [class*="hover:-translate"],
.tasks-page [class*="active:scale"] {
  transform: none !important;
}

.tasks-page [class*="bg-gradient"] {
  background-image: none !important;
}

.tasks-page [class*="bg-gradient"] {
  background-color: var(--tasks-accent) !important;
}

/* Keep the workspace calm: blue is the primary action color, while the
   remaining utility accents stay available only for compact status markers. */
.tasks-page [class*="bg-purple-"],
.tasks-page [class*="bg-indigo-"],
.tasks-page [class*="bg-cyan-"],
.tasks-page [class*="bg-amber-"],
.tasks-page [class*="bg-emerald-"] {
  background-color: var(--tasks-surface) !important;
  border-color: var(--tasks-border) !important;
}

.tasks-page.dark [class*="bg-purple-"],
.tasks-page.dark [class*="bg-indigo-"],
.tasks-page.dark [class*="bg-cyan-"],
.tasks-page.dark [class*="bg-amber-"],
.tasks-page.dark [class*="bg-emerald-"] {
  background-color: var(--tasks-surface) !important;
  border-color: var(--tasks-border) !important;
}

.tasks-page [class*="text-purple-"],
.tasks-page [class*="text-indigo-"],
.tasks-page [class*="text-cyan-"] {
  color: var(--tasks-muted) !important;
}

.tasks-page [class*="animate-pulse"],
.tasks-page [class*="animate-bounce"] {
  animation: none !important;
}

.tasks-page [class*="bg-purple-50"],
.tasks-page [class*="bg-indigo-50"],
.tasks-page [class*="bg-cyan-50"],
.tasks-page [class*="bg-amber-50"],
.tasks-page [class*="bg-emerald-50"] {
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
}

.tasks-page.dark [class*="bg-purple-950"],
.tasks-page.dark [class*="bg-indigo-950"],
.tasks-page.dark [class*="bg-cyan-950"],
.tasks-page.dark [class*="bg-amber-950"],
.tasks-page.dark [class*="bg-emerald-950"] {
  background-color: #0f172a !important;
  border-color: #334155 !important;
}

/* Daily cockpit: calm hierarchy and clear focus cards. */
.tasks-page main > section {
  background-color: var(--tasks-surface-muted) !important;
}

.tasks-page main > section:first-of-type {
  border-color: var(--tasks-border) !important;
}

.tasks-page main > section:first-of-type button {
  transition: border-color 120ms ease, background-color 120ms ease;
}

.tasks-page main > section:first-of-type button:hover {
  transform: none !important;
}

/* Neutralize decorative semantic backgrounds while preserving text meaning. */
.tasks-page:not(.dark) [class*="bg-indigo-50"],
.tasks-page:not(.dark) [class*="bg-purple-50"],
.tasks-page:not(.dark) [class*="bg-cyan-50"],
.tasks-page:not(.dark) [class*="bg-amber-50"],
.tasks-page:not(.dark) [class*="bg-emerald-50"] {
  background-color: #ffffff !important;
}

/* Explicit light-mode contrast for the task drawer. Some nested utility
   combinations inherit muted/white text and become unreadable on white. */
.tasks-page:not(.dark) .task-detail-drawer {
  color: #0f172a !important;
  background-color: #ffffff !important;
}

.tasks-page:not(.dark) .task-detail-drawer input,
.tasks-page:not(.dark) .task-detail-drawer select,
.tasks-page:not(.dark) .task-detail-drawer textarea {
  color: #0f172a !important;
  background-color: #ffffff !important;
  border-color: #cbd5e1 !important;
  caret-color: #2563eb;
}

/* Mobile workspace: keep navigation reachable without shrinking the board
   into an unreadable desktop layout. */
@media (max-width: 767px) {
  .tasks-page > header {
    z-index: 50;
  }

  .tasks-page > header > div > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  .tasks-page > header > div > div:first-child > a > div {
    display: none;
  }

  .tasks-page > header > div > div:last-child {
    flex: 1 0 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 1px;
    scrollbar-width: none;
  }

  .tasks-page > header > div > div:last-child::-webkit-scrollbar {
    display: none;
  }

  .tasks-page main > div:first-child {
    padding: 1rem;
  }

  .tasks-page main > div:first-child > div:first-child {
    align-items: flex-start;
  }

  .tasks-page main > div:first-child .relative.min-w-\[200px\] {
    min-width: 100%;
    max-width: none;
  }

  .tasks-page main > div:first-child select,
  .tasks-page main > div:first-child button {
    min-height: 2.5rem;
  }

  .tasks-page .task-detail-drawer {
    max-width: 100vw !important;
    border-left: 0 !important;
  }

  .tasks-page .task-detail-drawer > div:first-child {
    padding: 0.75rem 1rem;
  }

  .tasks-page .task-detail-drawer > div:nth-child(2) {
    padding: 1rem;
    gap: 1.25rem;
  }

  .tasks-page [role="dialog"] {
    max-height: calc(100dvh - 1rem);
    overflow-y: auto;
  }
}

.tasks-page:not(.dark) .task-detail-drawer select option {
  color: #0f172a !important;
  background-color: #ffffff !important;
}

.tasks-page:not(.dark) .task-detail-drawer [class*="text-slate-400"],
.tasks-page:not(.dark) .task-detail-drawer [class*="text-slate-500"] {
  color: #475569 !important;
}

.tasks-page:not(.dark) .task-detail-drawer [class*="text-slate-100"] {
  color: #0f172a !important;
}

.tasks-page:not(.dark) .task-detail-drawer [class*="bg-slate-950"],
.tasks-page:not(.dark) .task-detail-drawer [class*="bg-slate-900"] {
  background-color: #f8fafc !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
}

.tasks-page:not(.dark) .task-detail-drawer [class*="text-slate-300"] {
  color: #334155 !important;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slideInRight {
  animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Custom Slim Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.25);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.5);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(51, 65, 85, 0.85);
}

</style>
