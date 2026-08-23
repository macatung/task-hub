<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import axios from 'axios';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import TasksEmptyState from '@/Components/tasks/TasksEmptyState.vue';
import ProjectDocumentsPanel from '@/Components/tasks/ProjectDocumentsPanel.vue';
import ProjectReleaseLog from '@/Components/tasks/ProjectReleaseLog.vue';
import RunnerDashboard from '@/Components/tasks/RunnerDashboard.vue';
import { sound } from '@/audio/soundEffects';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
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
}

export interface AgentRunItem {
  id: number;
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

// Light / Dark Theme State (Default: Dark Mode for SaaS Experience)
const isDarkMode = ref(true);

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('macatung_tasks_theme', isDarkMode.value ? 'dark' : 'light');
  sound.playClick();
};

// Sidebar State
const isSidebarOpen = ref(true);
const selectedProjectId = ref<string | number>(props.selectedProjectId || 'all');
const currentView = ref<'board' | 'backlog' | 'roadmap'>('board');
const activeProjectMenuId = ref<number | null>(null);
const isAiMenuOpen = ref(false);
const isNotificationsOpen = ref(false);
const readNotificationIds = ref<string[]>([]);
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
const selectedAgentRuns = ref<AgentRunItem[]>([]);
const isAgentRunsLoading = ref(false);
const agentRunFeedback = ref('');
const isEditingDescription = ref(false);
const descriptionEditContent = ref('');
const isDrawerExpanded = ref(false);
const showCreateModal = ref(false);
const showSprintModal = ref(false);
const showStartSprintModal = ref(false);
const showCompleteSprintModal = ref(false);
const targetSprintForAction = ref<SprintItem | null>(null);
const isSubmitting = ref(false);
const newSubtaskText = ref('');

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
  enabled?: boolean;
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
    prompt: 'Build a multi-channel e-commerce platform with payment gateways, a real-time cart, inventory management, a driver mobile app and revenue dashboards.',
  },
  {
    title: 'AI SaaS Platform & Intelligent Chatbot',
    prompt: 'Build an AI SaaS platform with Gemini and OpenAI models, PDF analysis, streaming Q&A and monthly subscriptions.',
  },
  {
    title: 'HR Management & GPS Attendance App',
    prompt: 'Build an HR management system with GPS attendance in a Flutter mobile app, multi-level leave approvals and automated payroll exports.',
  },
  {
    title: 'Microservices & Real-time Message Queue',
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

const notificationItems = computed(() => {
  const items: Array<{ id: string; tone: 'warning' | 'info' | 'success'; title: string; detail: string; task?: TaskItem }> = [];
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

// Board Columns
const todoTasks = computed(() => filteredBoardTasks.value.filter(t => t.status === 'todo'));
const inProgressTasks = computed(() => filteredBoardTasks.value.filter(t => t.status === 'in_progress'));
const reviewTasks = computed(() => filteredBoardTasks.value.filter(t => t.status === 'review'));
const doneTasks = computed(() => filteredBoardTasks.value.filter(t => t.status === 'done'));

// Backlog Pool Tasks (No sprint assigned, excluding epics)
const backlogTasks = computed(() => {
  return taskList.value.filter(task => {
    if (selectedProjectId.value !== 'all' && task.project_id !== Number(selectedProjectId.value)) return false;
    return task.sprint_id === null && task.issue_type !== 'epic';
  });
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
        icon: '⚡',
        class: isDarkMode.value
          ? 'bg-purple-950/70 text-purple-300 border-purple-700/60 font-bold'
          : 'bg-purple-100 text-purple-950 border-purple-300 font-bold shadow-xs'
      };
    case 'story':
      return {
        label: 'STORY',
        icon: '📖',
        class: isDarkMode.value
          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 font-semibold'
          : 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold shadow-xs'
      };
    case 'bug':
      return {
        label: 'BUG',
        icon: '🐞',
        class: isDarkMode.value
          ? 'bg-rose-950/70 text-rose-300 border-rose-700/60 font-semibold'
          : 'bg-rose-100 text-rose-950 border-rose-300 font-bold shadow-xs'
      };
    case 'task':
    default:
      return {
        label: 'TASK',
        icon: '☑️',
        class: isDarkMode.value
          ? 'bg-blue-950/70 text-blue-300 border-blue-700/60 font-semibold'
          : 'bg-blue-100 text-blue-950 border-blue-300 font-bold shadow-xs'
      };
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Urgent',
        icon: '🔴',
        class: isDarkMode.value
          ? 'bg-red-950/70 text-red-300 border-red-700/60 font-bold'
          : 'bg-red-100 text-red-950 border-red-300 font-bold shadow-xs'
      };
    case 'high':
      return {
        label: 'High',
        icon: '🟠',
        class: isDarkMode.value
          ? 'bg-amber-950/70 text-amber-300 border-amber-700/60 font-semibold'
          : 'bg-amber-100 text-amber-950 border-amber-300 font-bold shadow-xs'
      };
    case 'medium':
      return {
        label: 'Medium',
        icon: '🟡',
        class: isDarkMode.value
          ? 'bg-slate-800 text-slate-200 border-slate-700 font-medium'
          : 'bg-slate-100 text-slate-900 border-slate-300 font-semibold shadow-xs'
      };
    case 'low':
      return {
        label: 'Low',
        icon: '⚪',
        class: isDarkMode.value
          ? 'bg-slate-900 text-slate-400 border-slate-800 font-medium'
          : 'bg-slate-100 text-slate-700 border-slate-300 font-semibold shadow-xs'
      };
    default:
      return {
        label: priority,
        icon: '⚪',
        class: isDarkMode.value
          ? 'bg-slate-800 text-slate-300 border-slate-700'
          : 'bg-slate-100 text-slate-800 border-slate-300 font-semibold'
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
    const message = err.response?.data?.message || 'Unable to save the project. Please try again.';
    projectGithubFeedback.value = message;
    alert(message);
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
  selectedTask.value = { ...task };
  selectedAgentRuns.value = [];
  loadAgentRuns(task.id);
  descriptionEditContent.value = task.description || '';
  isEditingDescription.value = false;
  sound.playClick();
};

const closeTaskDrawer = () => {
  if (selectedTask.value) {
    saveTaskDrawerChanges();
  }
  selectedTask.value = null;
  isEditingDescription.value = false;
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

  const idx = taskList.value.findIndex(t => t.id === task.id);
  if (idx !== -1) {
    taskList.value[idx] = { ...task };
  }

  try {
    await axios.patch(`/api/tasks/${task.id}`, {
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
    });
  } catch (err) {
    console.error('Failed to sync task drawer:', err);
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
};

onMounted(() => {
  const savedPin = sessionStorage.getItem('macatung_tasks_pin_auth');
  if (savedPin === '301095') {
    isPinUnlocked.value = true;
  }

  const savedTheme = localStorage.getItem('macatung_tasks_theme');
  if (savedTheme === 'light') {
    isDarkMode.value = false;
  } else {
    isDarkMode.value = true;
  }

  window.addEventListener('keydown', handleGlobalKey);
  window.addEventListener('click', closeAllMenus);

  // Allow the desktop mascot to deep-link into the same actions as the web
  // header without duplicating the modal implementations.
  const requestedAction = new URLSearchParams(window.location.search).get('open');
  if (requestedAction === 'ai-plan') openAiGeneratorModal();
  if (requestedAction === 'email-report') openReportModal();
  if (requestedAction === 'ai-settings') openAiSettings();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
  window.removeEventListener('click', closeAllMenus);
});
</script>

<template>
  <Head title="Tasks Hub | High Contrast Linear & Jira Workspace" />

  <div
    :class="[
      'tasks-page h-screen w-screen overflow-hidden font-sans flex flex-col transition-colors duration-150 select-none selection:bg-emerald-500 selection:text-slate-950',
      isDarkMode ? 'dark bg-[#080d1a] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    ]"
  >
    <!-- ========================================================================= -->
    <!-- 1. TOP NAVBAR (STICKY GLASSMORPHISM & LINEAR ENTERPRISE CONTROLS)         -->
    <!-- ========================================================================= -->
    <header
      :class="[
        'h-16 shrink-0 z-40 border-b backdrop-blur-md transition-colors w-full px-3 sm:px-6 flex items-center justify-between gap-3',
        isDarkMode ? 'bg-[#0b101e]/95 border-slate-800/80 text-slate-100 shadow-sm' : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-xs'
      ]"
    >
      <!-- Left: Sidebar toggle + Logo + Breadcrumb -->
      <div class="flex items-center gap-3 min-w-0">
        <button
          @click="isSidebarOpen = !isSidebarOpen"
          :class="[
            'p-2 rounded-xl border transition-all cursor-pointer text-xs font-bold shadow-xs',
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
          ]"
          title="Toggle project navigation"
        >
          {{ isSidebarOpen ? '◀' : '▶' }}
        </button>

        <!-- Logo & Brand -->
        <a href="/" class="flex items-center gap-2.5 group shrink-0">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/20 text-slate-950 font-black text-sm group-hover:scale-105 transition-transform">
            ⚡
          </div>
          <div class="flex items-center gap-2">
            <span :class="['font-bold text-base tracking-tight', isDarkMode ? 'text-white' : 'text-slate-950']">
              Task Hub
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[10px] font-bold">
              SAAS
            </span>
          </div>
        </a>

        <!-- Dynamic Breadcrumbs -->
        <div class="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs min-w-0">
          <span class="text-slate-400">/</span>
          <div class="flex items-center gap-1.5 font-bold truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: activeProjectObject?.color || '#10b981' }"></span>
            <span :class="['truncate', isDarkMode ? 'text-slate-200' : 'text-slate-800']">
              {{ activeProjectObject ? activeProjectObject.title : 'All Projects' }}
            </span>
            <span v-if="activeProjectObject?.key" class="font-mono text-[10px] px-1.5 py-0.2 rounded font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              {{ activeProjectObject.key }}
            </span>
          </div>
          <template v-if="activeSprint">
            <span class="text-slate-400">/</span>
            <span class="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 truncate max-w-[140px]">
              🏃 {{ activeSprint.name }}
            </span>
          </template>
          
    <!-- PROJECT DOCUMENTS MODAL -->
    <div
      v-if="isDocsModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      @click.self="isDocsModalOpen = false"
    >
      <div
        :class="[
          'w-full max-w-4xl rounded-3xl border p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar transition-all',
          isDarkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
      >
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'">
          <div class="flex items-center gap-2.5">
            <span class="mono-icon text-xl">▤</span>
            <div>
              <h3 class="font-bold text-base">Project Documents & Context Pack</h3>
            <p class="text-xs text-slate-400">{{ activeProjectObject?.title || 'Project' }} · shared context for developers and AI agents</p>
            </div>
          </div>
          <button
            @click="isDocsModalOpen = false"
            aria-label="Close project documents"
            title="Close project documents"
            class="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            ✕
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
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      @click.self="isReleasesModalOpen = false"
    >
      <div
        :class="[
          'w-full max-w-2xl rounded-3xl border p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto custom-scrollbar transition-all',
          isDarkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
      >
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'">
          <div class="flex items-center gap-2.5">
            <span class="mono-icon text-xl">↗</span>
            <div>
              <h3 class="font-bold text-base">Project Release Log</h3>
            <p class="text-xs text-slate-400">Track deployments, commit SHAs and release changes</p>
            </div>
          </div>
          <button
            @click="isReleasesModalOpen = false"
            class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <ProjectReleaseLog
          :project-id="activeProjectObject?.id || null"
          :dark="isDarkMode"
        />
      </div>
    </div>
        </div>
      </div>

      <!-- Center Tabs: Board | Backlog | Roadmap with dynamic counts -->
      <div
        :class="[
          'hidden md:flex items-center p-1 rounded-2xl border font-semibold text-xs gap-1 shadow-xs',
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100/90 border-slate-200/80'
        ]"
      >
        <button
          @click="currentView = 'board'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
            currentView === 'board'
              ? (isDarkMode ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-950/40' : 'bg-white text-emerald-900 font-bold shadow-xs border border-slate-200/80')
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <span class="mono-icon">▦</span>
          <span>Task Board</span>
          <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', currentView === 'board' ? 'bg-white/20 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')]">
            {{ filteredBoardTasks.length }}
          </span>
        </button>

        <button
          @click="currentView = 'backlog'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
            currentView === 'backlog'
              ? (isDarkMode ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-950/40' : 'bg-white text-emerald-900 font-bold shadow-xs border border-slate-200/80')
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <span class="mono-icon">▤</span>
          <span>Sprint Backlog</span>
          <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', currentView === 'backlog' ? 'bg-white/20 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')]">
            {{ sprintList.length }}
          </span>
        </button>

        <button
          @click="currentView = 'roadmap'; sound.playClick();"
          :class="[
            'px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
            currentView === 'roadmap'
              ? (isDarkMode ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-950/40' : 'bg-white text-emerald-900 font-bold shadow-xs border border-slate-200/80')
              : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
          ]"
        >
          <span class="mono-icon">⌁</span>
          <span>Roadmap</span>
        </button>
      </div>

      <!-- Right Controls -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- AI Engine Dropdown Button -->
        <div class="relative">
          <button
            @click.stop="isAiMenuOpen = !isAiMenuOpen"
            :class="[
              'px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs',
              isDarkMode ? 'bg-slate-900 border-purple-800/60 text-purple-300 hover:bg-purple-950/30' : 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
            ]"
            title="AI planning and settings"
          >
            <span class="mono-icon">✦</span>
            <span class="hidden sm:inline">AI Engine</span>
            <span class="text-[10px]">▾</span>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isAiMenuOpen"
            @click.stop
            :class="[
              'absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-2xl p-2 z-50 text-xs font-medium backdrop-blur-xl',
              isDarkMode ? 'bg-slate-900/95 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            ]"
          >
            <button
              @click="isAiMenuOpen = false; openAiGeneratorModal();"
              class="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-800/60 flex items-center gap-2.5 cursor-pointer font-medium"
            >
              <span class="mono-icon">✦</span>
              <div>
                <div class="font-bold text-xs">AI Project Planner</div>
                <div class="text-[10px] text-slate-400">Break down epics, sprints and tasks</div>
              </div>
            </button>
            <button
              @click="isAiMenuOpen = false; openAiSettings();"
              class="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-800/60 flex items-center gap-2.5 cursor-pointer font-medium border-t border-slate-800/50 mt-1"
            >
              <span>⚙️</span>
              <div>
                <div class="font-bold text-xs">AI Settings</div>
                <div class="text-[10px] text-slate-400">Private provider and API key</div>
              </div>
            </button>
          </div>
        </div>

        <!-- MCP & AI Agents Button -->
        <button
          @click="openMcpModal()"
          :class="[
            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode ? 'bg-slate-900 border-indigo-500/40 text-indigo-300 hover:bg-slate-800 hover:border-indigo-400' : 'bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
          ]"
          title="Model Context Protocol (MCP) & AI Agent Integration (Antigravity 2.0, Cursor, Claude)"
        >
          <span>⚡</span>
          <span>MCP & Agents</span>
        </button>

        <!-- Weekly Email Report Button -->
        <button
          @click="openReportModal"
          :class="[
            'hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          ]"
          title="Configure and send the weekly progress report"
        >
          <span>✉️</span>
          <span>Reports</span>
        </button>

        <!-- Notifications -->
        <button
          @click.stop="toggleNotifications"
          :class="[
            'relative p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isNotificationsOpen
              ? (isDarkMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-50 border-blue-300 text-blue-800')
              : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50')
          ]"
          title="Open notifications"
          aria-label="Open notifications"
        >
          <span>🔔</span>
          <span v-if="unreadNotificationCount" class="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] leading-4 font-black border-2 border-[#070b14]">
            {{ unreadNotificationCount > 9 ? '9+' : unreadNotificationCount }}
          </span>
        </button>

        <!-- Light / Dark Toggle Button -->
        <button
          @click="toggleTheme"
          :class="[
            'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode
              ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          ]"
          :title="isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <span>{{ isDarkMode ? '☀️' : '🌙' }}</span>
        </button>

        <!-- Primary Action: + Create Task -->
        <button
          @click="openCreateTaskModal"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          title="Create a new task"
        >
          <span class="text-sm font-black">+</span>
          <span>Create Task</span>
        </button>

        <!-- User Profile & Action Controls -->
        <template v-if="props.auth?.user">
          <div class="flex items-center gap-2 pl-2 border-l border-slate-800">
            <span class="hidden xl:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold" :class="isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'">
              <img v-if="props.auth.user.github_avatar_url" :src="props.auth.user.github_avatar_url" class="h-4 w-4 rounded-full" alt="GitHub avatar" />
              @{{ props.auth.user.github_login || props.auth.user.name }}
            </span>
            <button @click="logoutGithub" class="rounded-xl border px-2.5 py-2 text-[10px] font-bold cursor-pointer" :class="isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'">Sign out</button>
          </div>
        </template>
        <a v-else href="/auth/github" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">Sign in with GitHub</a>

        <!-- Lock Button -->
        <button
          @click="lockWorkspace"
          :class="[
            'p-2 rounded-xl border text-xs transition-colors cursor-pointer shadow-xs',
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50'
          ]"
          title="Lock workspace (PIN: 301095)"
        >
          <span class="mono-icon">□</span>
        </button>
      </div>
    </header>

    <RunnerDashboard />

    <!-- ========================================================================= -->
    <!-- 2. MAIN LAYOUT (SIDEBAR + MAIN CANVAS)                                    -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex min-h-0 overflow-hidden w-full">
      <!-- SIDEBAR: TWO-LINE HIGH-CONTRAST PROJECT LAYOUT -->
      <aside
        v-if="isSidebarOpen"
        :class="[
          'fixed md:relative left-0 top-16 md:top-auto bottom-0 md:bottom-auto z-30 w-[min(88vw,20rem)] md:w-72 border-r flex flex-col justify-between shrink-0 h-full select-none transition-colors shadow-xl md:shadow-none overflow-hidden',
          isDarkMode ? 'bg-[#090d16] border-slate-800/80' : 'bg-white border-slate-200/90'
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
                  ? (isDarkMode ? 'bg-slate-900 text-white border-blue-500/60 font-bold' : 'bg-blue-50/90 text-blue-950 border-blue-300 font-bold shadow-xs')
                  : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-slate-900/60' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="mono-icon text-base">▦</span>
                <div>
                  <div :class="['font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-950']">All Projects</div>
                  <div :class="['text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-600']">All projects and tasks</div>
                </div>
              </div>
              <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full', isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                {{ getProjectTaskCount('all') }}
              </span>
            </button>

          </div>

          <!-- PROJECTS -->
          <div class="space-y-2">
            <div class="flex items-center justify-between px-2 text-[11px] font-mono font-bold uppercase tracking-wider">
              <span class="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold">
                <span>💼</span>
                <span>PROJECTS</span>
              </span>
              <button
                @click="openCreateProjectModal()"
                class="hover:text-blue-600 p-0.5 rounded cursor-pointer text-xs font-bold"
                title="Create project"
              >
                +
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
                      ? (isDarkMode ? 'bg-slate-900 text-white border-blue-500 font-bold' : 'bg-blue-50/90 text-blue-950 border-blue-300 font-bold shadow-xs')
                      : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-slate-900/50' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
                  ]"
                >
                  <!-- Left side: 2 Lines (Title + Description) -->
                  <div class="min-w-0 pr-2 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: proj.color || '#2563eb' }"></span>
                      <span :class="['font-bold text-xs truncate', isDarkMode ? 'text-white' : 'text-slate-950']">{{ proj.title }}</span>
                      <span v-if="proj.key" :class="['px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0', isDarkMode ? 'bg-blue-950/80 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-800 border border-blue-200']">
                        {{ proj.key }}
                      </span>
                    </div>

                    <div :class="['text-[11px] truncate pl-4.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                      {{ proj.description || 'Project description' }}
                    </div>
                    <div v-if="proj.tags?.length" class="mt-1 flex gap-1 overflow-hidden pl-4.5">
                      <span v-for="tag in proj.tags.slice(0, 3)" :key="tag" class="shrink-0 rounded bg-blue-950/50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">#{{ tag }}</span>
                    </div>
                  </div>

                  <!-- Right side: Count Badge -->
                  <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0', isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
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
                      'p-1 rounded-md text-xs cursor-pointer border font-bold',
                      isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-300 shadow-xs hover:bg-slate-100'
                    ]"
                  >
                    •••
                  </button>

                  <div
                    v-if="activeProjectMenuId === proj.id"
                    :class="[
                      'absolute right-0 top-full mt-1.5 w-36 rounded-xl border shadow-xl p-1.5 z-50 text-xs font-medium',
                      isDarkMode ? 'bg-[#0f172a] border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    ]"
                    @click.stop
                  >
                    <button
                      @click.stop="openEditProjectModal(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                    <button
                      @click.stop="handleDeleteProject(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <span>🗑️</span>
                      <span>Delete Project</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Sidebar Footer -->
        <div :class="['p-3.5 border-t space-y-2', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50']">
          <!-- AI Sprint Plan Button in Sidebar -->
          <button
            @click="openAiGeneratorModal"
            class="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>✨</span>
            <span>AI Project Planner</span>
          </button>

          <button
            @click="openCreateProjectModal()"
            :class="[
              'w-full py-2 px-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
            ]"
          >
            <span>+</span>
            <span>Add Project</span>
          </button>
        </div>
      </aside>

      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 top-16 z-20 bg-slate-950/30 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <!-- MAIN WORKSPACE -->
      <main :class="['min-w-0 flex-1 flex flex-col h-full overflow-hidden', isDarkMode ? 'bg-[#070b14]' : 'bg-[#f8fafc]']">
        <!-- =================================================================== -->
        <!-- MODERN 2-TIER PROJECT SUB-HEADER & SMART FILTER BAR (STICKY)        -->
        <!-- =================================================================== -->
        <div :class="['p-4 sm:p-5 border-b space-y-3.5 shrink-0 shadow-xs backdrop-blur-md transition-colors z-20', isDarkMode ? 'bg-slate-950/90 border-slate-800/90' : 'bg-white/95 border-slate-200/90']">
          <!-- TIER 1: PROJECT BANNER & ANALYTICS METRICS -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Left: Project Identity -->
            <div class="flex items-start gap-3.5 min-w-0 max-w-2xl">
              <div
                class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-xs shrink-0 border"
                :style="{
                  backgroundColor: activeProjectObject?.color ? `${activeProjectObject.color}20` : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                  borderColor: activeProjectObject?.color || (isDarkMode ? '#334155' : '#cbd5e1')
                }"
              >
                <span>▦</span>
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h1 :class="['text-xl sm:text-2xl font-bold font-display tracking-tight truncate', isDarkMode ? 'text-white' : 'text-slate-950']">
                    {{ activeProjectObject ? activeProjectObject.title : 'All Projects & Tasks' }}
                  </h1>

                  <span v-if="activeProjectObject?.key" class="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 font-mono text-xs font-bold border border-blue-300 dark:border-blue-800 shadow-xs">
                    {{ activeProjectObject.key }}
                  </span>

                  <span v-if="activeProjectObject" class="px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold border shadow-xs bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800">PROJECT</span>
                </div>

                <p :class="['text-xs sm:text-sm mt-1 line-clamp-1 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-700']">
                  {{ activeProjectObject?.tagline || activeProjectObject?.description || 'Manage project delivery, sprints and task backlog.' }}
                </p>
              </div>
            </div>

            <!-- Right: Project Analytics & Health Metric Pills -->
            <div class="flex flex-wrap items-center gap-2.5 font-mono text-xs">
              <!-- Total Tasks Pill -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2 shadow-xs', isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Tasks:</span>
                <strong class="text-blue-600 dark:text-blue-400 text-sm font-black">{{ activeProjectTasks.length }}</strong>
              </div>

              <!-- Story Points Pill -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2 shadow-xs', isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Points:</span>
                <strong class="text-purple-600 dark:text-purple-400 text-sm font-black">{{ activeProjectStoryPoints }}</strong>
              </div>

              <!-- Progress % Pill with Mini Bar -->
              <div :class="['px-3.5 py-2 rounded-2xl border font-bold flex items-center gap-2.5 shadow-xs', isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-xs']">
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Progress:</span>
                <div class="w-14 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" :style="{ width: `${activeProjectProgressPercent}%` }"></div>
                </div>
                <strong class="text-emerald-700 dark:text-emerald-400 text-xs font-black">{{ activeProjectProgressPercent }}%</strong>
              </div>

              <!-- Warning Pill (Click to filter) -->
              <button
                v-if="activeProjectWarningCount > 0"
                @click="filterHealth = filterHealth === 'warning' ? 'all' : 'warning'"
                :class="[
                  'px-3.5 py-2 rounded-2xl border font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs',
                  filterHealth === 'warning'
                    ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 shadow-md'
                    : (isDarkMode ? 'bg-rose-950/80 border-rose-800 text-rose-300 hover:bg-rose-900' : 'bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200 font-bold')
                ]"
                title="Filter overdue and at-risk tasks"
              >
                <span>🚨</span>
                <strong class="font-black">{{ activeProjectWarningCount }} Attention</strong>
              </button>

              <!-- Documents Button -->
              <button
                v-if="activeProjectObject?.id"
                @click="isDocsModalOpen = true; sound.playClick();"
                :class="[
                  'px-3 py-2 rounded-2xl border font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-105',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-950/30' : 'bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100'
                ]"
                title="Open project documents and GitHub sync"
              >
                <span>📚</span>
                <span class="text-xs">Docs</span>
              </button>

              <!-- Releases Button -->
              <button
                v-if="activeProjectObject?.id"
                @click="isReleasesModalOpen = true; sound.playClick();"
                :class="[
                  'px-3 py-2 rounded-2xl border font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-105',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-950/30' : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                ]"
                title="Open release history"
              >
                <span>🚀</span>
                <span class="text-xs">Releases</span>
              </button>
            </div>
          </div>



          <!-- TIER 2: SMART FILTER & QUICK ACTION BAR -->
          <div :class="['flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t text-xs', isDarkMode ? 'border-slate-800/80' : 'border-slate-200']">
            <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <!-- Search Input with Shortcut Badge -->
              <div class="relative min-w-[200px] max-w-xs flex-1">
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search tasks... (Press '/')"
                  :class="[
                    'w-full border rounded-xl pl-8 pr-8 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-xs font-medium transition-colors',
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  ]"
                />
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                <span v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer font-bold">✕</span>
                <span v-else class="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.2 rounded border text-[10px] font-mono text-slate-400 border-slate-300 dark:border-slate-700 font-bold">/</span>
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
                    : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">📊 All progress</option>
                <option value="warning" :disabled="activeProjectWarningCount === 0">
                  ⚡ Attention needed (Overdue + At risk) ({{ activeProjectWarningCount }})
                </option>
                <option value="overdue" :disabled="overdueTasksCount === 0">
                  🚨 Overdue only ({{ overdueTasksCount }})
                </option>
                <option value="at_risk" :disabled="delayedTasksCount === 0">
                  ⚠️ At risk only ({{ delayedTasksCount }})
                </option>
                <option value="on_track">🟢 On track</option>
              </select>

              <!-- Issue Type Filter -->
              <select
                v-model="filterIssueType"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterIssueType !== 'all'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-bold'
                    : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All issue types</option>
                <option value="story">📖 Story</option>
                <option value="task">☑️ Task</option>
                <option value="bug">🐞 Bug</option>
                <option value="epic">⚡ Epic</option>
              </select>

              <!-- Priority Filter -->
              <select
                v-model="filterPriority"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterPriority !== 'all'
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold'
                    : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All priorities</option>
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>

              <!-- Epic Filter -->
              <select
                v-model="filterEpicId"
                :class="[
                  'border text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-xs font-semibold',
                  filterEpicId !== 'all'
                    ? 'bg-purple-50 dark:bg-purple-950 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-bold'
                    : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
                ]"
              >
                <option value="all">All Epics</option>
                <option value="none">No Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  ⚡ {{ epic.issue_key }} — {{ epic.title }}
                </option>
              </select>

              <!-- Reset Filter Button -->
              <button
                v-if="hasActiveFilters"
                @click="resetFilters"
                class="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Clear all active filters"
              >
                <span>✕</span>
                <span>Clear Filters</span>
              </button>
            </div>

            <!-- Quick Add in Bar -->
            <div class="flex items-center gap-2">
              <input
                ref="quickInputRef"
                v-model="quickInputText"
                type="text"
                placeholder="+ Quick add task... (Enter)"
                @keydown.enter="handleQuickCreate(null)"
                :class="[
                  'min-w-[220px] sm:min-w-[260px] border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-xs font-medium transition-colors',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
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
        <!-- Keep the board as the primary detail-page surface. Daily planning is
             available from the task actions and should not push the repo board down. -->
        <section v-if="false" :class="['p-4 sm:p-6 border-b', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p :class="['text-[10px] font-mono font-bold uppercase tracking-widest', isDarkMode ? 'text-indigo-300' : 'text-indigo-700']">Personal Command Center</p>
              <h2 :class="['text-lg font-bold tracking-tight', isDarkMode ? 'text-white' : 'text-slate-950']">What needs your attention today?</h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <button @click="startMyDay" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs">☀️ Start my day</button>
              <button @click="openNextAction" :disabled="!nextActionTask" class="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-50" :class="isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'">▶ Next action</button>
              <button @click="openDailyReview" class="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer" :class="isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'">🌙 End my day</button>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button v-for="task in dailyFocusTasks" :key="task.id" @click="openTaskDrawer(task)" :class="['text-left p-3 rounded-2xl border transition-all hover:-translate-y-0.5 cursor-pointer', isDarkMode ? 'bg-slate-950/70 border-slate-800 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-400 shadow-xs']">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="font-mono text-[10px] text-slate-500">{{ task.issue_key }}</span>
                <span class="text-[10px] font-bold uppercase" :class="task.priority === 'urgent' ? 'text-rose-600' : task.priority === 'high' ? 'text-amber-600' : 'text-slate-500'">{{ task.priority }}</span>
              </div>
              <p :class="['text-xs font-bold line-clamp-2', isDarkMode ? 'text-slate-100' : 'text-slate-900']">{{ task.title }}</p>
              <p class="mt-1 text-[10px] text-slate-500 truncate">{{ task.project?.title || 'Project' }} · {{ task.due_date || 'No due date' }}</p>
            </button>
            <TasksEmptyState
              v-if="dailyFocusTasks.length === 0"
              :dark="isDarkMode"
              icon="✓"
              title="No open tasks"
              description="Create the next plan or review the backlog."
            />
          </div>
          <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Attention</h3><span class="font-mono text-[10px] text-slate-500">{{ warningTasksCount }}</span></div>
              <button v-for="task in taskList.filter(t => t.status !== 'done' && (getTaskDelayStatus(t).isOverdue || getTaskDelayStatus(t).isDelayed)).slice(0, 3)" :key="task.id" @click="openTaskDrawer(task)" class="w-full flex items-center gap-2 border-b py-2 text-left last:border-0 border-slate-200 dark:border-slate-800">
                <span class="h-2 w-2 rounded-full bg-rose-500 shrink-0"></span><span class="truncate text-[11px] font-medium">{{ task.title }}</span>
              </button>
              <p v-if="!taskList.some(t => t.status !== 'done' && (getTaskDelayStatus(t).isOverdue || getTaskDelayStatus(t).isDelayed))" class="text-[11px] text-slate-500">No alerts.</p>
            </div>
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Current sprint</h3><span class="text-[10px] text-slate-500">{{ activeSprint?.end_date || 'No deadline' }}</span></div>
              <p v-if="activeSprint" class="truncate text-[11px] font-medium">{{ activeSprint.name }}</p>
              <div v-if="activeSprint" class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div class="h-full rounded-full bg-blue-600" :style="{ width: (activeSprint.total_tasks ? Math.round(((activeSprint.done_tasks || 0) / activeSprint.total_tasks) * 100) : 0) + '%' }"></div></div>
              <p v-if="activeSprint" class="mt-2 text-[10px] text-slate-500">{{ activeSprint.done_tasks || 0 }}/{{ activeSprint.total_tasks || 0 }} tasks complete</p>
              <p v-else class="text-[11px] text-slate-500">No active sprint.</p>
            </div>
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Recently completed</h3><span class="text-[10px] text-slate-500">{{ completedRecentlyTasks.length }}</span></div>
              <button v-for="task in completedRecentlyTasks.slice(0, 3)" :key="task.id" @click="openTaskDrawer(task)" class="w-full flex items-center gap-2 border-b py-2 text-left last:border-0 border-slate-200 dark:border-slate-800">
                <span class="text-emerald-600">✓</span><span class="truncate text-[11px] font-medium">{{ task.title }}</span>
              </button>
              <p v-if="!completedRecentlyTasks.length" class="text-[11px] text-slate-500">No recently completed tasks.</p>
            </div>
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
              <div class="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-lg animate-bounce">
                🚨
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
                class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                🚨 View Details
              </button>
              <button
                v-else
                @click="filterHealth = 'all'"
                :class="[
                  'px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-colors',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'
                ]"
              >
                🔄 Clear Filter
              </button>
            </div>
          </div>

          <!-- Active Sprint Banner -->
          <div
            v-if="activeSprint"
            :class="[
              'mb-5 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs',
              isDarkMode ? 'bg-slate-900/80 border-blue-500/50' : 'bg-white border-blue-300 ring-2 ring-blue-50 shadow-sm'
            ]"
          >
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
              <div>
                <div class="flex items-center gap-2">
                  <span :class="['font-bold text-sm sm:text-base', isDarkMode ? 'text-white' : 'text-slate-950']">{{ activeSprint.name }}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-xs">ACTIVE</span>
                </div>
                <p v-if="activeSprint.goal" :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-700']">{{ activeSprint.goal }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span :class="['text-xs font-mono font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold']">
                Due date: <strong class="text-slate-950 dark:text-white font-black">{{ activeSprint.end_date || 'Not set' }}</strong>
              </span>
              <button
                @click="openCompleteSprintModal(activeSprint)"
                :class="[
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors shadow-xs',
                  isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 hover:bg-emerald-900' : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 font-bold'
                ]"
              >
                Complete Sprint 🏁
              </button>
            </div>
          </div>

          <!-- 4 HIGH-CONTRAST KANBAN COLUMNS -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full items-start">
            <!-- 1. TO DO -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-100/90 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'todo')"
              @drop="onDropColumn('todo')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-slate-800' : 'border-slate-300']">
                <span class="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wide">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                  <span>TO DO</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-950 border-slate-300 shadow-xs']">
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
                    isDarkMode ? 'bg-[#0b101c] border-slate-800/90 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-950/20' : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-slate-900 text-blue-300 border-blue-900/60' : 'bg-blue-50 text-blue-900 border-blue-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-1.5 py-0.2 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-slate-100 group-hover:text-emerald-300' : 'text-slate-900 group-hover:text-emerald-700']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-500 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-1.5 py-0.2 rounded border font-semibold', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="todoTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 2. IN PROGRESS -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'in_progress')"
              @drop="onDropColumn('in_progress')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>IN PROGRESS</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-amber-300 border-slate-700' : 'bg-white text-amber-950 border-amber-300 shadow-xs']">
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
                    isDarkMode ? 'bg-[#0b101c] border-amber-500/40 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-950/20' : 'bg-white border-amber-200 hover:border-amber-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-900 border-amber-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-1.5 py-0.2 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-slate-100 group-hover:text-amber-300' : 'text-slate-900 group-hover:text-amber-700']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-500 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-1.5 py-0.2 rounded border font-semibold', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="inProgressTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 3. REVIEW -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'review')"
              @drop="onDropColumn('review')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                  <span>REVIEW</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-purple-300 border-slate-700' : 'bg-white text-purple-950 border-purple-300 shadow-xs']">
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
                    isDarkMode ? 'bg-[#0b101c] border-purple-500/40 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-950/20' : 'bg-white border-purple-200 hover:border-purple-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-900 border-purple-200']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[9px] font-bold">🤖 Agent Review</span>
                      <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-900 border-indigo-200']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 leading-snug', isDarkMode ? 'text-slate-100 group-hover:text-purple-300' : 'text-slate-900 group-hover:text-purple-700']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[10px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-500 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-1.5 py-0.2 rounded border font-semibold', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="reviewTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Drag tasks here
                </div>
              </div>
            </div>

            <!-- 4. DONE -->
            <div
              :class="['flex flex-col border rounded-2xl p-3.5 min-h-[480px] transition-colors', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-inner']"
              @dragover="onDragOverColumn($event, 'done')"
              @drop="onDropColumn('done')"
            >
              <div :class="['flex items-center justify-between pb-3 mb-3 border-b px-1', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
                <span class="flex items-center gap-2 font-mono text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                  <span>DONE</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-emerald-300 border-slate-700' : 'bg-white text-emerald-950 border-emerald-300 shadow-xs']">
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
                    isDarkMode ? 'bg-[#0b101c] border-emerald-500/30 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20' : 'bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-md'
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-[11px] font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-900 border-emerald-200']">{{ task.issue_key }}</span>
                    </div>
                    <span v-if="task.story_points" :class="['px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border', isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-900 border-emerald-200']">
                      {{ task.story_points }} pts
                    </span>
                  </div>

                  <h4 :class="['text-xs sm:text-sm font-semibold line-clamp-2 line-through', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                    {{ task.title }}
                  </h4>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[10px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-1.5 py-0.2 rounded border font-medium', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span class="text-emerald-500 font-mono font-bold">Done ✓</span>
                  </div>
                </div>

                <div v-if="doneTasks.length === 0" class="h-24 border-2 border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
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
          <div :class="['flex flex-wrap items-center justify-between gap-3 pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
            <div>
              <h2 :class="['text-base sm:text-lg font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">
                📦 Sprint Planning & Backlog
              </h2>
              <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Drag tasks into sprints to prepare the delivery stages.
              </p>
            </div>

            <button
              @click="openCreateSprintModal"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Create Sprint</span>
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
                  ? (isDarkMode ? 'bg-[#0a0f1d] border-blue-500/50' : 'bg-white border-blue-300 ring-2 ring-blue-50')
                  : (isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200')
              ]"
              @dragover="onDragOverSprint($event, sprint.id)"
              @drop="onDropSprint(sprint.id)"
            >
              <!-- Sprint Header Row -->
              <div :class="['p-4 flex flex-wrap items-center justify-between gap-3 border-b', isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/90 border-slate-200']">
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Collapse/Expand Toggle -->
                  <button
                    @click="toggleSprintCollapse(sprint.id)"
                    :class="['p-1 rounded cursor-pointer text-xs font-bold', isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-950']"
                  title="Collapse / expand"
                  >
                    {{ collapsedSprints[sprint.id] ? '▶' : '▼' }}
                  </button>

                  <span
                    :class="[
                      'px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold border',
                      sprint.status === 'active' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700' : (sprint.status === 'completed' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700')
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
                    <div class="h-2.5 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div class="bg-emerald-500 h-full" :style="{ width: `${getSprintStats(sprint.id).donePercent}%` }"></div>
                      <div class="bg-amber-500 h-full" :style="{ width: `${getSprintStats(sprint.id).inProgressPercent}%` }"></div>
                      <div class="bg-slate-300 dark:bg-slate-700 h-full" :style="{ width: `${getSprintStats(sprint.id).todoPercent}%` }"></div>
                    </div>
                    <span :class="['font-mono text-[11px] font-bold', isDarkMode ? 'text-slate-300' : 'text-slate-800']">{{ getSprintStats(sprint.id).donePercent }}%</span>
                  </div>

                  <!-- Sprint Action Buttons -->
                  <div class="flex items-center gap-2">
                    <button
                      v-if="sprint.status === 'future'"
                      @click="openStartSprintModal(sprint)"
                      class="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Start Sprint ▶
                    </button>

                    <button
                      v-if="sprint.status === 'active'"
                      @click="openCompleteSprintModal(sprint)"
                      class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Complete Sprint ✓
                    </button>

                    <button
                      @click="handleDeleteSprint(sprint)"
                      class="p-1 text-slate-400 hover:text-red-600 cursor-pointer text-xs font-bold"
                      title="Delete Sprint"
                    >
                      🗑️
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
                    isDarkMode ? 'bg-[#0f1523] border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-sm',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="text-sm">{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                    <span :class="['font-mono text-xs font-bold px-1.5 py-0.5 rounded border shrink-0', isDarkMode ? 'bg-blue-950/80 text-blue-300 border-blue-800' : 'bg-blue-100 text-blue-950 border-blue-300']">{{ task.issue_key }}</span>
                    <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-950']">{{ task.title }}</span>
                  </div>

                  <div class="flex items-center gap-2.5 shrink-0">
                    <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                      {{ getTaskDelayStatus(task).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded text-[11px] font-mono border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                    <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                      {{ task.story_points }} pts
                    </span>
                  </div>
                </div>

                <div v-if="getSprintTasks(sprint.id).length === 0" class="py-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 font-medium">
                  This sprint has no tasks. Drag tasks here from the backlog.
                </div>
              </div>
            </div>

            <!-- Backlog Pool Box -->
            <div
              :class="['p-4 rounded-2xl border space-y-3 shadow-xs', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']"
              @dragover="onDragOverSprint($event, 'backlog')"
              @drop="onDropSprint(null)"
            >
              <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
                <div class="flex items-center gap-2">
                  <span class="text-lg">📦</span>
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
                    isDarkMode ? 'bg-[#0e1422] border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-sm',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="text-sm">{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                    <span :class="['font-mono text-xs font-bold px-1.5 py-0.5 rounded border shrink-0', isDarkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300 font-bold']">{{ task.issue_key }}</span>
                    <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-950']">{{ task.title }}</span>
                  </div>

                  <div class="flex items-center gap-2.5 shrink-0">
                    <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                      {{ getTaskDelayStatus(task).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded text-[11px] font-mono border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                    <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                      {{ task.story_points }} pts
                    </span>
                  </div>
                </div>

                <div v-if="backlogTasks.length === 0" class="py-6 text-center text-xs text-slate-500 italic font-medium">
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
          <div :class="['pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
            <h2 :class="['text-base sm:text-lg font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">
              🗺️ Roadmap & Epic Progress
            </h2>
            <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
              Track overall epic and milestone progress over time.
            </p>
          </div>

          <div class="space-y-4">
            <div
              v-for="epic in epicList"
              :key="epic.id"
              :class="['p-4 rounded-2xl border space-y-3 shadow-xs', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <span class="text-lg">⚡</span>
                  <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded border', isDarkMode ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-800 border-purple-200']">{{ epic.issue_key }}</span>
                  <h3 :class="['text-sm sm:text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ epic.title }}</h3>
                </div>

                <span :class="['font-mono text-xs font-bold', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                  {{ epic.start_date || 'Start' }} ➔ {{ epic.due_date || 'Due date' }}
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="space-y-1.5">
                <div :class="['h-3 w-full rounded-full overflow-hidden p-0.5', isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-300']">
                  <div
                    class="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
                    :style="{ width: `${epic.status === 'done' ? 100 : (epic.status === 'in_progress' ? 50 : 20)}%` }"
                  ></div>
                </div>
                <div :class="['flex justify-between text-xs font-mono font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                  <span>Status: <strong :class="['uppercase font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ epic.status }}</strong></span>
                  <span class="font-bold">{{ epic.story_points || 0 }} Story Points</span>
                </div>
              </div>
            </div>

            <div v-if="epicList.length === 0" class="py-8 text-center text-xs text-slate-500 italic font-medium">
              No epics yet. Create an Epic issue to show it on the roadmap.
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>

    <!-- NOTIFICATION DRAWER -->
    <div
      v-if="isNotificationsOpen"
      class="fixed inset-0 z-[55] bg-slate-950/30"
      @click="isNotificationsOpen = false"
    >
      <aside
        :class="[
          'absolute right-0 top-0 h-full w-full max-w-sm border-l flex flex-col shadow-2xl animate-slideInRight',
          isDarkMode ? 'bg-[#0b101e] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        ]"
        @click.stop
      >
        <div :class="['px-5 py-4 border-b flex items-center justify-between shrink-0', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <div>
            <p class="text-[10px] uppercase tracking-[0.18em] font-bold text-blue-500">Workspace inbox</p>
            <h2 class="mt-1 text-lg font-bold tracking-tight">Notifications</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="unreadNotificationCount"
              @click="markAllNotificationsRead"
              class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50 cursor-pointer"
            >
              Mark all read
            </button>
            <button
              @click="isNotificationsOpen = false"
              class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              aria-label="Close notifications"
            >
              ✕
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
                ? (isDarkMode ? 'border-slate-800 bg-slate-950/40 hover:bg-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50')
                : (isDarkMode ? 'border-blue-900/70 bg-blue-950/20 hover:bg-blue-950/40' : 'border-blue-200 bg-blue-50/60 hover:bg-blue-50')
            ]"
          >
            <span
              :class="[
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                item.tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : item.tone === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
              ]"
            >
              {{ item.tone === 'warning' ? '!' : item.tone === 'success' ? '✓' : 'i' }}
            </span>
            <span class="min-w-0 flex-1">
              <span :class="['block text-xs font-bold', isDarkMode ? 'text-slate-100' : 'text-slate-900']">{{ item.title }}</span>
              <span class="mt-1 block text-[11px] leading-4 text-slate-500">{{ item.detail }}</span>
            </span>
            <span v-if="!readNotificationIds.includes(item.id)" class="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500"></span>
          </button>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl text-slate-400 dark:border-slate-800 dark:bg-slate-950">✓</div>
          <h3 class="mt-3 text-sm font-bold">You’re all caught up</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">No task risks or workspace updates need your attention.</p>
        </div>
      </aside>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. TASK DETAIL DRAWER (HIGH CONTRAST MARKDOWN & CODE BLOCKS)              -->
    <!-- ========================================================================= -->
    <!-- ========================================================================= -->
    <!-- 3. TASK DETAIL DRAWER (HIGH CONTRAST, EXPANDABLE & CLEAR TYPOGRAPHY)      -->
    <!-- ========================================================================= -->
    <div
      v-if="selectedTask"
      class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end"
      @click.self="closeTaskDrawer"
    >
      <div
        :class="[
          'task-detail-drawer w-full border-l h-full flex flex-col shadow-2xl animate-slideInRight transition-all duration-200',
          isDrawerExpanded ? 'max-w-full' : 'max-w-4xl lg:max-w-5xl xl:max-w-6xl',
          isDarkMode ? 'bg-[#090d18] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        ]"
      >
        <!-- Drawer Header -->
        <div :class="['px-6 py-4.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200']">
          <div class="flex items-center gap-3 min-w-0">
            <span class="p-1.5 rounded-xl border bg-white dark:bg-slate-900 text-lg shadow-xs">
              {{ getIssueTypeBadge(selectedTask.issue_type).icon }}
            </span>
            <span :class="['font-mono text-sm font-bold px-3 py-1 rounded-xl shadow-xs border', isDarkMode ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-800 border-blue-200']">
              {{ selectedTask.issue_key }}
            </span>
            <span class="text-slate-400 font-bold">/</span>
            <span :class="['text-sm truncate font-bold', isDarkMode ? 'text-slate-300' : 'text-slate-800']">
              {{ selectedTask.project?.title || 'Project required' }}
            </span>
            <span v-if="selectedTask.epic" class="hidden sm:inline-flex px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              ⚡ {{ selectedTask.epic.issue_key }}
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Fullscreen / Expand Toggle Button -->
            <button
              @click="isDrawerExpanded = !isDrawerExpanded"
              :class="[
                'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs',
                isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              ]"
              :title="isDrawerExpanded ? 'Collapse details' : 'Expand to full screen'"
            >
              <span>{{ isDrawerExpanded ? '🗗' : '⛶' }}</span>
              <span class="hidden sm:inline">{{ isDrawerExpanded ? 'Collapse' : 'Full Screen' }}</span>
            </button>

            <!-- Delete Button -->
            <button
              @click="deleteTask(selectedTask)"
              class="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border border-transparent hover:border-red-200 text-xs cursor-pointer font-bold flex items-center gap-1 transition-colors"
              title="Delete issue"
            >
              <span>🗑️</span>
                <span class="hidden sm:inline">Delete</span>
            </button>

            <!-- Close Button -->
            <button
              @click="closeTaskDrawer"
              :class="[
                'p-2 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-xs',
                isDarkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              ]"
              title="Close details (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Drawer Body (Spacious 12-column layout) -->
        <div class="flex-1 p-6 sm:p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- LEFT MAIN CONTENT PANE (Col-span 8) -->
          <div class="lg:col-span-8 space-y-6">
            <!-- Large Title Input -->
            <div class="space-y-1">
              <label :class="['font-mono text-[11px] font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Task Title (Issue Title)
              </label>
              <input
                v-model="selectedTask.title"
                @blur="saveTaskDrawerChanges"
                :class="[
                  'w-full font-bold text-xl sm:text-2xl lg:text-3xl bg-transparent border-b-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none py-2 transition-colors leading-snug',
                  isDarkMode ? 'text-white placeholder-slate-600' : 'text-slate-950 placeholder-slate-400'
                ]"
                placeholder="Enter task title..."
              />
            </div>

            <!-- Warning Diagnosis & Quick Actions Box -->
            <div
              v-if="getTaskDelayStatus(selectedTask).isOverdue || getTaskDelayStatus(selectedTask).isDelayed"
              :class="[
                'p-4 sm:p-5 rounded-2xl border space-y-3 transition-all shadow-xs',
                getTaskDelayStatus(selectedTask).isOverdue
                  ? (isDarkMode ? 'bg-rose-950/50 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-950')
                  : (isDarkMode ? 'bg-amber-950/50 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950')
              ]"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">{{ getTaskDelayStatus(selectedTask).isOverdue ? '🚨' : '⚠️' }}</span>
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
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Extend by 1 day"
                >
                  +1 Day
                </button>
                <button
                  @click="extendDueDate(3)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Extend by 3 days"
                >
                  +3 Days
                </button>
                <button
                  @click="extendDueDate(7)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Extend by 1 week"
                >
                  +1 Week
                </button>
                <button
                  v-if="selectedTask.priority !== 'urgent'"
                  @click="increaseTaskPriority"
                  class="px-3.5 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs ml-auto"
                >
                  🔴 Mark Urgent
                </button>
              </div>
            </div>

            <!-- Description Markdown & Code Render -->
            <div class="space-y-2.5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <span :class="['text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <span>📝</span>
                  <span>DESCRIPTION (MARKDOWN)</span>
                </span>
                <button
                  @click="isEditingDescription = !isEditingDescription"
                  class="text-xs px-3.5 py-1.5 rounded-xl font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer shadow-xs"
                >
                  {{ isEditingDescription ? '👁️ Preview' : '✏️ Edit Markdown' }}
                </button>
              </div>

              <!-- Editing Mode -->
              <div v-if="isEditingDescription" class="space-y-2">
                <textarea
                  v-model="descriptionEditContent"
                  rows="10"
                  :class="[
                    'w-full p-4 rounded-2xl border text-sm font-mono focus:outline-none focus:border-blue-500 shadow-xs font-medium leading-relaxed',
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950'
                  ]"
                  placeholder="Enter a Markdown description (# heading, - list, ```code...)"
                ></textarea>
                <div class="flex justify-end gap-2">
                  <button
                    @click="isEditingDescription = false"
                    class="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    @click="isEditingDescription = false; saveTaskDrawerChanges();"
                    class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    Save Description ✓
                  </button>
                </div>
              </div>

              <!-- Rendered Markdown Mode -->
              <div
                v-else
                :class="[
                  'p-6 rounded-2xl border text-sm sm:text-base leading-relaxed min-h-[140px] shadow-xs',
                  isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-100' : 'bg-slate-50/90 border-slate-200/90 text-slate-900'
                ]"
              >
                <div v-if="selectedTask.description" v-html="formatMarkdown(selectedTask.description)"></div>
                <div v-else class="text-slate-400 italic font-medium py-6 text-center">
                  No detailed description yet. Click "✏️ Edit Markdown" to add content.
                </div>
              </div>
            </div>

            <!-- Subtasks Checklist -->
            <div class="space-y-3 pt-2">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <span :class="['text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <span>☑️</span>
                  <span>SUBTASKS</span>
                </span>
                <span :class="['font-mono text-xs font-bold px-3 py-1 rounded-full border', isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-300 shadow-xs']">
                  {{ (selectedTask.subtasks || []).filter(s => s.done).length }}/{{ (selectedTask.subtasks || []).length }} complete
                </span>
              </div>

              <div class="flex gap-2.5">
                <input
                  v-model="newSubtaskText"
                  @keydown.enter="addSubtask"
                  placeholder="+ Add a subtask... (Press Enter)"
                  :class="[
                    'flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-blue-500 shadow-xs font-medium',
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  ]"
                />
                <button
                  @click="addSubtask"
                  class="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs transition-colors"
                >
                  Add
                </button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="st in selectedTask.subtasks || []"
                  :key="st.id"
                  :class="[
                    'flex items-center justify-between p-3.5 rounded-xl border text-sm shadow-xs transition-all',
                    st.done
                      ? (isDarkMode ? 'bg-slate-950/60 border-slate-800/80 opacity-75' : 'bg-slate-50/80 border-slate-200 opacity-75')
                      : (isDarkMode ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200')
                  ]"
                >
                  <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      :checked="st.done"
                      @change="toggleSubtask(st)"
                      class="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span :class="['truncate text-sm font-semibold', st.done ? 'line-through text-slate-400 dark:text-slate-500' : (isDarkMode ? 'text-slate-100' : 'text-slate-950')]">
                      {{ st.text }}
                    </span>
                  </label>

                  <button @click="deleteSubtask(st.id)" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-xs cursor-pointer font-bold ml-2" title="Delete subtask">
                    ✕
                  </button>
                </div>

                <div v-if="!selectedTask.subtasks || selectedTask.subtasks.length === 0" class="py-4 text-center text-xs text-slate-400 italic">
                  No subtasks yet. Enter a title above to add one.
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT ATTRIBUTES SIDEBAR (Col-span 4) -->
          <div :class="['lg:col-span-4 space-y-5 p-5 sm:p-6 rounded-3xl border shadow-sm', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50/90 border-slate-200/90']">
            <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>ATTRIBUTES</span>
            </div>

            <!-- Status -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Status</label>
              <select
                v-model="selectedTask.status"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="todo">⚪ To Do</option>
                <option value="in_progress">🟡 In Progress</option>
                <option value="review">🟣 Review</option>
                <option value="done">🟢 Done</option>
              </select>
            </div>

            <!-- Issue Type -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Issue Type</label>
              <select
                v-model="selectedTask.issue_type"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="task">☑️ Task</option>
                <option value="story">📖 Story</option>
                <option value="bug">🐞 Bug</option>
                <option value="epic">⚡ Epic</option>
              </select>
            </div>

            <!-- Story Points (7 Fibonacci Buttons Grid) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Story Points (Fibonacci)</label>
                <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{{ selectedTask.story_points || 0 }} pts</span>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="pts in [1, 2, 3, 5, 8, 13, 21]"
                  :key="pts"
                  @click="selectedTask.story_points = pts; saveTaskDrawerChanges();"
                  :class="[
                    'h-10 rounded-xl font-mono font-bold text-sm border transition-all cursor-pointer shadow-xs flex items-center justify-center',
                    selectedTask.story_points === pts
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold scale-105'
                      : (isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100')
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
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-semibold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">📦 Backlog (No Sprint)</option>
                <option v-for="sprint in sprintList" :key="sprint.id" :value="sprint.id">
                  🏃 {{ sprint.name }} ({{ sprint.status.toUpperCase() }})
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
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-semibold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">No Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  ⚡ {{ epic.issue_key }} — {{ epic.title }}
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
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
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
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-semibold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              />
            </div>

            <div v-if="selectedTask.documents?.length" :class="['space-y-2 pt-4 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
              <label :class="['font-mono text-xs font-bold uppercase', isDarkMode ? 'text-slate-300' : 'text-slate-700']">📚 Task references</label>
              <a v-for="document in selectedTask.documents" :key="document.id" :href="document.url || '#'" target="_blank" rel="noreferrer" class="block text-[11px] text-blue-600 underline">{{ document.pivot?.is_required ? 'Required · ' : '' }}{{ document.title }}</a>
            </div>

            <!-- Agent execution and verification -->
            <div :class="['space-y-3 pt-4 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
              <div class="flex items-center justify-between">
                <label :class="['font-mono text-xs font-bold uppercase', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Agent Run</label>
                <span v-if="isAgentRunsLoading" class="text-[10px] text-slate-500">Loading…</span>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <button v-for="provider in ['codex', 'claude_code', 'antigravity']" :key="`local-${provider}`" @click="startAgentRun(provider)" class="rounded-lg border px-2 py-2 text-[10px] font-bold cursor-pointer hover:border-blue-500 flex flex-col items-center gap-0.5" :class="isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'">
                  <span>{{ provider === 'claude_code' ? 'Local Claude' : provider === 'antigravity' ? 'Local AGY' : 'Local Codex' }}</span>
                  <span class="text-[8px] font-mono text-slate-400 opacity-80">{{ selectedProviderModel[provider] }}</span>
                </button>
              </div>
              <p v-if="agentRunFeedback" class="text-[11px] leading-relaxed text-blue-600 dark:text-blue-300">{{ agentRunFeedback }}</p>
              <div v-for="run in selectedAgentRuns" :key="run.id" :class="['rounded-xl border p-3 space-y-2', isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white']">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold">{{ run.provider }} · {{ run.execution_mode || 'desktop' }}</span>
                    <span v-if="run.metadata?.model" class="rounded px-1.5 py-0.2 font-mono text-[9px] border" :class="isDarkMode ? 'border-slate-700 bg-slate-800 text-cyan-300' : 'border-slate-200 bg-slate-100 text-cyan-700'">
                      {{ run.metadata.model }}
                    </span>
                  </div>
                  <span class="rounded-full border px-2 py-0.5 font-mono text-[10px]">{{ run.status }}</span>
                </div>
                <p v-if="run.branch || run.commit_sha" class="font-mono text-[10px] text-slate-500 truncate">{{ run.branch || 'no branch' }} · {{ run.commit_sha || 'no commit' }}</p>
                <p v-if="run.summary" class="text-[11px] leading-relaxed text-slate-500">{{ run.summary }}</p>
                <a v-if="run.pull_request_url" :href="run.pull_request_url" target="_blank" rel="noreferrer" class="text-[11px] text-blue-600 underline">Open Pull Request</a>
                <div v-if="run.evidence?.length" class="space-y-1">
                  <p v-for="item in run.evidence" :key="item.id" class="text-[10px]" :class="item.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'">{{ item.status === 'passed' ? '✓' : '!' }} {{ item.evidence_type }}{{ item.command ? ` · ${item.command}` : '' }}</p>
                </div>
              </div>
              <p v-if="!selectedAgentRuns.length && !isAgentRunsLoading" class="text-[11px] text-slate-500">No agent runs yet. Select a provider to create an audited run.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 4. MODALS (CREATE SPRINT, START SPRINT, COMPLETE SPRINT, CREATE TASK)      -->
    <!-- ========================================================================= -->
    <!-- Modal: Create Sprint -->
    <div v-if="showSprintModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">⚡ Create Scrum Sprint</h3>
          <button @click="showSprintModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project *</label>
            <select
              v-model="newTaskForm.project_id"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            >
              <option v-for="project in projectList" :key="project.id" :value="project.id">{{ project.title }}</option>
            </select>
          </div>
          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Sprint name</label>
            <input
              v-model="sprintForm.name"
              placeholder="e.g. Sprint 1 — Feature delivery"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Goal</label>
            <textarea
              v-model="sprintForm.goal"
              rows="3"
              placeholder="Sprint goal..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
          <button @click="handleSaveSprint" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Create Sprint</button>
        </div>
      </div>
    </div>

    <!-- Modal: Start Sprint -->
    <div v-if="showStartSprintModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-blue-500/50 text-white' : 'bg-white border-blue-300 text-slate-950']">
        <h3 class="font-bold text-sm">🚀 Start Sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">The sprint will move to <strong>ACTIVE</strong>.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showStartSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
          <button @click="confirmStartSprint" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Start ▶</button>
        </div>
      </div>
    </div>

    <!-- Modal: Complete Sprint -->
    <div v-if="showCompleteSprintModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-emerald-500/50 text-white' : 'bg-white border-emerald-300 text-slate-950']">
        <h3 class="font-bold text-sm">🏁 Complete Sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">Incomplete tasks will be moved safely to the <strong>Backlog</strong>.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showCompleteSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
          <button @click="confirmCompleteSprint" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">Complete ✓</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create Task -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">✨ Create Task</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Task title *</label>
            <input
              v-model="newTaskForm.title"
              placeholder="e.g. Update the project dashboard"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Issue Type</label>
              <select
                v-model="newTaskForm.issue_type"
                :class="['w-full p-2.5 rounded-xl border focus:outline-none font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option value="task">☑️ Task</option>
                <option value="story">📖 Story</option>
                <option value="bug">🐞 Bug</option>
                <option value="epic">⚡ Epic</option>
              </select>
            </div>

            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Story Points</label>
              <select
                v-model="newTaskForm.story_points"
                :class="['w-full p-2.5 rounded-xl border focus:outline-none font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
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
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Description</label>
            <textarea
              v-model="newTaskForm.description"
              rows="3"
              placeholder="Task details..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showCreateModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
          <button @click="handleCreateTask" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Create Task</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Project -->
    <div v-if="showProjectModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">
            {{ projectModalMode === 'create' ? 'Create Project' : 'Edit Project' }}
          </h3>
          <button @click="showProjectModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div v-if="projectModalMode === 'create'" class="space-y-3">
            <div v-if="!props.auth?.user" class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <p class="font-bold">GitHub authentication required</p>
              <p class="mt-1 text-[11px]">Sign in with GitHub to select a repository for this project.</p>
              <a href="/auth/github" class="mt-3 inline-block rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white">Sign in with GitHub</a>
            </div>
            <template v-else>
              <input v-model="githubRepositorySearch" placeholder="Search GitHub repositories..." :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
              <div v-if="isGithubRepositoriesLoading" class="rounded-xl border p-4 text-center text-slate-500">Loading repositories…</div>
              <div v-else class="max-h-56 space-y-2 overflow-y-auto pr-1">
                <button v-for="repo in filteredGithubRepositories" :key="repo.id" type="button" @click="selectedGithubRepository = repo" :class="['w-full rounded-xl border p-3 text-left', selectedGithubRepository?.id === repo.id ? 'border-blue-500 bg-blue-50 text-blue-950' : (isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')]">
                  <div class="flex items-center justify-between gap-2"><span class="font-bold">{{ repo.full_name }}</span><span class="text-[10px]">{{ repo.private ? 'Private' : 'Public' }}</span></div>
                  <p class="mt-1 line-clamp-2 text-[11px] text-slate-500">{{ repo.description || 'No description' }}</p>
                  <span class="text-[10px] text-slate-500">{{ repo.default_branch || 'main' }} · {{ repo.language || 'Unknown' }}</span>
                </button>
                <p v-if="!filteredGithubRepositories.length" class="p-4 text-center text-slate-500">No repositories found.</p>
              </div>
              <div v-if="selectedGithubRepository" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">Selected <strong>{{ selectedGithubRepository.full_name }}</strong>.</div>
            </template>
          </div>
          <div v-if="projectModalMode === 'edit'">
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project name *</label>
            <input
              v-model="projectForm.title"
              placeholder="e.g. Mobile App 2026"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div v-if="projectModalMode === 'edit'">
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project key (2-5 characters)</label>
            <input
              v-model="projectForm.key"
              placeholder="e.g. APP"
              :class="['w-full p-2.5 rounded-xl border font-mono uppercase focus:outline-none focus:border-blue-500 font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project tags</label>
            <input
              v-model="projectForm.tags"
              placeholder="product, platform, priority"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
            <p class="mt-1 text-[10px] text-slate-500">Separate tags with commas.</p>
          </div>

          <div v-if="projectModalMode === 'edit'" :class="['pt-3 mt-3 border-t space-y-3', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-xs">Project integrations</h4>
                <p class="text-[10px] text-slate-500">These settings are isolated to this project.</p>
              </div>
              <span v-if="projectGithubStatus?.connected" class="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">GitHub {{ projectGithubStatus.sync_status }}</span>
            </div>
            <input v-model="projectForm.github_repository" placeholder="GitHub repository: owner/repository" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-mono text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_default_branch" placeholder="Default branch: main" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-mono text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_webhook_secret" type="password" autocomplete="new-password" placeholder="Repository webhook secret" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <div>
              <div class="flex items-center justify-between mb-1">
                <label :class="['font-mono text-[10px] font-bold uppercase', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Project MCP Token (AI Agents)</label>
                <button
                  type="button"
                  @click="projectForm.task_hub_mcp_token = 'th_mcp_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')"
                  class="text-[10px] text-blue-500 hover:text-blue-400 font-bold cursor-pointer"
                >
                  ⚡ Auto-Generate Token
                </button>
              </div>
              <div class="flex items-center gap-2">
                <input v-model="projectForm.task_hub_mcp_token" type="text" autocomplete="new-password" placeholder="Project MCP token for agents (e.g. th_mcp_...)" :class="['flex-1 p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-mono text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
                <button
                  type="button"
                  v-if="editingProjectId"
                  @click="openMcpModal(editingProjectId)"
                  class="px-2.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] whitespace-nowrap cursor-pointer shadow-xs"
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
              <button @click="syncProjectGithub" :disabled="isProjectGithubSyncing || !projectForm.github_repository" class="rounded-lg border border-blue-300 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 disabled:opacity-50">{{ isProjectGithubSyncing ? 'Syncing…' : 'Sync GitHub' }}</button>
            </div>
            <p v-if="projectGithubFeedback" class="text-[10px] text-blue-600">{{ projectGithubFeedback }}</p>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showProjectModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
          <button @click="handleSaveProject" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Save Project</button>
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
      class="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        :class="[
          'w-full max-w-4xl border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] flex flex-col',
          isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950'
        ]"
      >
        <!-- Modal Header -->
        <div :class="['flex items-center justify-between pb-4 border-b shrink-0', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-xs">
              <span class="text-xl">✨</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base sm:text-lg font-display">AI Project Planning & Breakdown</h3>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  SMART SCRUM ENGINE
                </span>
              </div>
              <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                {{ aiGeneratorStep === 'input' ? 'Select repo and enter requirements; AI will analyze project context and draft the plan.' : 'Review, edit, and confirm your backlog plan.' }}
              </p>
            </div>
          </div>

          <button
            @click="showAiGeneratorModal = false"
            :class="['p-2 rounded-xl text-xs font-bold cursor-pointer', isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600']"
          >
            ✕
          </button>
        </div>

        <!-- STEP 1: INPUT REQUIREMENTS & CONFIG -->
        <div v-if="aiGeneratorStep === 'input'" class="space-y-5 overflow-y-auto pr-1 flex-1">
          <!-- Requirement Textarea -->
          <div class="space-y-1.5">
            <label :class="['font-mono text-xs font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
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
    <div v-if="showDailyReview" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" @click.self="showDailyReview = false">
      <div :class="['w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-5', isDarkMode ? 'bg-[#0b101e] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-950']">
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><div><p class="text-[10px] font-mono uppercase text-indigo-500 font-bold">Daily Review</p><h2 class="text-lg font-bold">End of Day Review</h2></div><button @click="showDailyReview = false" class="text-slate-400 font-bold cursor-pointer">✕</button></div>
        <div v-if="isDailyLoading" class="py-8 text-center text-slate-500 text-xs">Summarizing...</div>
        <div v-else-if="dailyReviewData" class="space-y-4 text-xs">
          <div class="grid grid-cols-3 gap-2"><div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"><strong class="block text-xl text-emerald-600">{{ dailyReviewData.completed_tasks?.length || 0 }}</strong><span>Completed</span></div><div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"><strong class="block text-xl text-amber-600">{{ dailyReviewData.incompleted_tasks?.length || 0 }}</strong><span>Remaining</span></div><div class="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"><strong class="block text-xl text-indigo-600">{{ dailyReviewData.total_pomodoros_done || 0 }}</strong><span>Pomodoros</span></div></div>
          <div><h3 class="font-bold mb-2">Incomplete Tasks</h3><div v-if="dailyReviewData.incompleted_tasks?.length" class="space-y-1.5 max-h-48 overflow-y-auto"><button v-for="task in dailyReviewData.incompleted_tasks" :key="task.id" @click="showDailyReview = false; openTaskDrawer(task)" class="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 cursor-pointer"><span class="font-mono text-[10px] text-slate-500">{{ task.issue_key }}</span> · <span class="font-medium">{{ task.title }}</span></button></div><p v-else class="text-emerald-600 font-medium">✓ You completed all priority tasks today.</p></div>
        </div>
      </div>
    </div>

    <!-- AI SETTINGS MODAL -->
    <div v-if="showAiSettingsModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" @click.self="showAiSettingsModal = false">
      <div :class="['w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-5', isDarkMode ? 'bg-[#0b101e] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-950']">
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><div><p class="text-[10px] font-mono uppercase text-purple-500 font-bold">Private Configuration</p><h2 class="text-lg font-bold">AI Planning Settings</h2></div><button @click="showAiSettingsModal = false" class="text-slate-400 font-bold cursor-pointer">✕</button></div>
        <div v-if="aiSettingsFeedback" class="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-bold">{{ aiSettingsFeedback }}</div>
        <div class="space-y-3 text-xs">
          <label class="block"><span class="block mb-1 font-bold">Provider</span><select v-model="aiSettings.provider" class="w-full p-2.5 rounded-xl border bg-transparent"><option value="template">Offline template fallback</option><option value="openai_compatible">OpenAI-compatible API</option></select></label>
          <label class="block"><span class="block mb-1 font-bold">Base URL</span><input v-model="aiSettings.base_url" class="w-full p-2.5 rounded-xl border bg-transparent" placeholder="https://api.openai.com/v1" /></label>
          <div class="grid grid-cols-2 gap-3"><label class="block"><span class="block mb-1 font-bold">Model</span><input v-model="aiSettings.model" class="w-full p-2.5 rounded-xl border bg-transparent" /></label><label class="block"><span class="block mb-1 font-bold">Temperature</span><input v-model.number="aiSettings.temperature" type="number" min="0" max="2" step="0.1" class="w-full p-2.5 rounded-xl border bg-transparent" /></label></div>
          <label class="block"><span class="block mb-1 font-bold">API key <span v-if="aiSettings.has_api_key" class="text-emerald-600">(saved)</span></span><input v-model="aiSettings.api_key" type="password" autocomplete="new-password" class="w-full p-2.5 rounded-xl border bg-transparent" placeholder="Leave blank to keep the current key" /></label>
          <p class="text-[11px] text-slate-500">The key is encrypted on the server and never returned to the browser. If the provider fails, the workspace uses offline templates.</p>
        </div>
        <div class="flex justify-end gap-2 border-t pt-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><button @click="showAiSettingsModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Cancel</button><button @click="saveAiSettings" :disabled="isAiSettingsSaving" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{{ isAiSettingsSaving ? 'Saving...' : 'Save settings' }}</button></div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- ✉️ WEEKLY EMAIL REPORT CONFIGURATION & SEND MODAL                    -->
    <!-- ==================================================================== -->
    <div
      v-if="showReportModal"
      class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      @click.self="showReportModal = false"
    >
      <div
        :class="[
          'w-full max-w-2xl rounded-3xl border shadow-2xl p-6 sm:p-7 space-y-5 my-8 transition-colors',
          isDarkMode ? 'bg-[#0b101e] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-950'
        ]"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b pb-4 shrink-0" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-xl shadow-xs">
              ✉️
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
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 text-base cursor-pointer"
          >
            ✕
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
          <button @click="reportFeedbackMsg = ''" class="hover:opacity-75 cursor-pointer">✕</button>
        </div>

        <div v-if="isReportLoading" class="py-12 text-center text-slate-400 text-xs font-medium">
          <span class="animate-spin inline-block mr-2 text-base">⏳</span>
          <span>Loading email report settings...</span>
        </div>

        <!-- Settings Form -->
        <div v-else class="space-y-4 text-xs">
          <!-- 1. Enable / Disable Automation Toggle -->
          <div
            :class="[
              'p-4 rounded-2xl border flex items-center justify-between gap-4 cursor-pointer transition-all',
              reportForm.is_enabled
                ? (isDarkMode ? 'bg-blue-950/30 border-blue-700/80 ring-1 ring-blue-500/30' : 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200')
                : (isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200')
            ]"
            @click="reportForm.is_enabled = !reportForm.is_enabled"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">{{ reportForm.is_enabled ? '🔔' : '🔕' }}</span>
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
                reportForm.is_enabled ? 'bg-blue-600' : (isDarkMode ? 'bg-slate-800' : 'bg-slate-300')
              ]"
            >
              <div
                :class="[
                  'w-5 h-5 rounded-full bg-white transition-transform shadow-xs',
                  reportForm.is_enabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              ></div>
            </div>
          </div>

          <!-- 2. Recipients Emails -->
          <div>
            <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
              Recipient email addresses (stakeholders / PM / clients) <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="reportForm.recipients"
              rows="2"
              placeholder="e.g. boss@company.com, ceo@company.com, manager@company.com"
              :class="[
                'w-full border rounded-xl p-3 focus:outline-none focus:border-blue-500 font-mono text-xs shadow-xs',
                isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              ]"
            ></textarea>
            <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
              💡 Separate multiple email addresses with commas (<strong class="font-mono">,</strong>).
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
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-semibold shadow-xs',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="monday">📅 Monday (Suggested: start the week)</option>
                <option value="tuesday">📅 Tuesday</option>
                <option value="wednesday">📅 Wednesday</option>
                <option value="thursday">📅 Thursday</option>
                <option value="friday">📅 Friday (Suggested: wrap up the week)</option>
                <option value="saturday">📅 Saturday</option>
                <option value="sunday">📅 Sunday (Prepare for the week)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                Delivery time
              </label>
              <select
                v-model="reportForm.send_time"
                :class="[
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-semibold font-mono shadow-xs',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="07:30">⏰ 07:30 AM</option>
                <option value="08:00">⏰ 08:00 AM (Start of workday)</option>
                <option value="08:30">⏰ 08:30 AM</option>
                <option value="09:00">⏰ 09:00 AM</option>
                <option value="17:00">⏰ 17:00 PM (End of workday)</option>
                <option value="18:00">⏰ 18:00 PM</option>
                <option value="20:00">⏰ 20:00 PM</option>
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
                'w-full border rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-medium shadow-xs',
                isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
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
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200')
                  ]"
                >
                  📁 All Projects
                </button>
              </div>

              <!-- Project Multi-Select Chips -->
              <div class="flex flex-wrap gap-2 p-3 rounded-2xl border max-h-36 overflow-y-auto" :class="isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'">
                <button
                  v-for="p in projectList"
                  :key="p.id"
                  type="button"
                  @click="toggleReportProject(p.id)"
                  :class="[
                    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 shadow-xs',
                    isReportProjectSelected(p.id)
                      ? (isDarkMode ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-sm' : 'bg-blue-50 text-blue-900 border-blue-400 font-bold')
                      : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100')
                  ]"
                >
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: p.color || '#2563eb' }"></span>
                  <span>▦ {{ p.title }}</span>
                  <span v-if="isReportProjectSelected(p.id)" class="text-[11px] font-bold">✓</span>
                </button>
              </div>
              <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
                💡 The report includes completed tasks, sprints, and alerts from selected projects (or all projects when "All Projects" is selected).
              </p>
            </div>

            <div class="flex flex-wrap gap-4 pt-1">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_upcoming" class="w-4 h-4 rounded text-blue-600" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Include next-week focus</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_warnings" class="w-4 h-4 rounded text-blue-600" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Include task risk alerts</span>
              </label>
            </div>
          </div>

          <!-- Last Sent Status -->
          <div
            v-if="reportForm.last_sent_at"
            :class="['p-3 rounded-xl border text-[11px] font-mono flex items-center justify-between', isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600']"
          >
            <span>🕒 Last successful delivery:</span>
            <strong :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ reportForm.last_sent_at }}</strong>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div :class="['flex flex-wrap items-center justify-between gap-3 pt-4 border-t shrink-0', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <!-- Left: Send Test Report Button -->
          <button
            @click="handleSendReportNow"
            :disabled="isReportSending || isReportLoading || !reportForm.recipients.trim()"
            class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send a sample report immediately to the entered recipients"
          >
            <span v-if="isReportSending" class="animate-spin">⏳</span>
            <span v-else>🚀</span>
            <span>{{ isReportSending ? 'Sending report...' : 'Send test report now' }}</span>
          </button>

          <!-- Right: Cancel & Save -->
          <div class="flex items-center gap-2">
            <button
              @click="showReportModal = false"
              :class="[
                'px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors',
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              ]"
            >
              Close
            </button>

            <button
              @click="handleSaveReportSettings"
              :disabled="isReportSaving || isReportLoading"
              class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isReportSaving" class="animate-spin">⏳</span>
              <span v-else>✓</span>
              <span>{{ isReportSaving ? 'Saving...' : 'Save settings' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- ⚡ MODEL CONTEXT PROTOCOL (MCP) & AI AGENTS MODAL                     -->
    <!-- ==================================================================== -->
    <div
      v-if="showMcpModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto backdrop-blur-md bg-black/70 animate-fadeIn"
      @click.self="showMcpModal = false"
    >
      <div
        :class="[
          'relative w-full max-w-4xl border rounded-3xl p-5 sm:p-7 shadow-2xl z-10 transition-all flex flex-col max-h-[92vh] overflow-hidden',
          isDarkMode ? 'bg-[#0b1120] border-slate-700/80 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        ]"
      >
        <!-- Modal Header -->
        <div class="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl shadow-inner text-indigo-400">
              ⚡
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h3 class="text-base sm:text-lg font-bold font-display">
                  Model Context Protocol (MCP) & AI Agent Setup
                </h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
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
              'p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer',
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            ]"
            title="Close modal"
          >
            ✕
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
          <button @click="mcpFeedbackMsg = ''" class="text-xs opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="overflow-y-auto custom-scrollbar space-y-5 py-4 flex-1 pr-1">
          <!-- 1. Project Selector & Server Endpoint -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            <!-- Project Picker -->
            <div :class="['md:col-span-6 p-4 rounded-2xl border', isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200']">
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
                      ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                      : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100')
                  ]"
                >
                  <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: p.color || '#3b82f6' }"></span>
                  <span>{{ p.title }}</span>
                  <span v-if="p.key" class="font-mono text-[9px] opacity-75">({{ p.key }})</span>
                </button>
              </div>
            </div>

            <!-- Server Endpoint -->
            <div :class="['md:col-span-6 p-4 rounded-2xl border flex flex-col justify-between', isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200']">
              <div>
                <label class="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                  2. MCP Server Endpoint URL
                </label>
                <div class="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    readonly
                    :value="mcpData?.server_url || 'https://task-hub.macatung.dev/mcp'"
                    :class="['flex-1 p-2 rounded-xl font-mono text-xs border select-all', isDarkMode ? 'bg-slate-950 border-slate-800 text-indigo-300' : 'bg-white border-slate-300 text-indigo-900']"
                  />
                  <button
                    @click="copyMcpSnippet('url', mcpData?.server_url || 'https://task-hub.macatung.dev/mcp')"
                    class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors shrink-0"
                  >
                    {{ copiedSnippetType === 'url' ? '✓ Copied' : 'Copy' }}
                  </button>
                </div>
              </div>
              <p class="text-[10px] text-slate-500 mt-2">
                Standard JSON-RPC 2.0 over HTTP endpoint supporting Bearer Token authentication.
              </p>
            </div>
          </div>

          <!-- 2. MCP Authentication Token Management -->
          <div :class="['p-4 sm:p-5 rounded-2xl border space-y-3.5', isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200']">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-bold text-xs flex items-center gap-2">
                  <span>🔑</span>
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
                  Secures AI Agent communication for <strong class="text-blue-500">{{ activeMcpProject?.title }}</strong>.
                </p>
              </div>

              <!-- Quick Generate / Revoke Actions -->
              <div class="flex items-center gap-2">
                <button
                  @click="generateMcpTokenForProject"
                  :disabled="isMcpGenerating || isMcpLoading"
                  class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{{ isMcpGenerating ? '⏳' : '⚡' }}</span>
                  <span>{{ mcpData?.has_token ? 'Regenerate Token' : 'Generate Secure Token' }}</span>
                </button>

                <button
                  v-if="mcpData?.has_token"
                  @click="clearMcpTokenForProject"
                  :disabled="isMcpSaving"
                  class="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold cursor-pointer transition-colors"
                >
                  Revoke
                </button>
              </div>
            </div>

            <!-- Token View / Copy Box -->
            <div v-if="mcpData?.has_token" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div :class="['flex-1 flex items-center justify-between p-2.5 rounded-xl border font-mono text-xs min-w-0', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300']">
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
                class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>{{ copiedSnippetType === 'token' ? '✓' : '📋' }}</span>
                <span>{{ copiedSnippetType === 'token' ? 'Copied Token' : 'Copy Token' }}</span>
              </button>
            </div>

            <!-- Custom Token Option -->
            <div class="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                v-model="customMcpTokenInput"
                type="text"
                placeholder="Or paste your own custom MCP token / secret key..."
                :class="['flex-1 p-2 rounded-xl text-xs border font-mono', isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900']"
              />
              <button
                @click="saveCustomMcpToken"
                :disabled="!customMcpTokenInput.trim() || isMcpSaving"
                class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer disabled:opacity-40 shrink-0"
              >
                {{ isMcpSaving ? 'Saving...' : 'Set Custom Token' }}
              </button>
            </div>
          </div>

          <!-- 3. Client Configuration Snippets (Tabbed) -->
          <div :class="['p-4 sm:p-5 rounded-2xl border space-y-3.5', isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200']">
            <!-- Tabs -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  @click="activeMcpTab = 'antigravity'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    activeMcpTab === 'antigravity'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <span>🌟</span>
                  <span>Google Antigravity 2.0</span>
                </button>

                <button
                  @click="activeMcpTab = 'cursor'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    activeMcpTab === 'cursor'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <span>⚡</span>
                  <span>Cursor IDE</span>
                </button>

                <button
                  @click="activeMcpTab = 'claude'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    activeMcpTab === 'claude'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <span>🤖</span>
                  <span>Claude Desktop</span>
                </button>

                <button
                  @click="activeMcpTab = 'tools'"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    activeMcpTab === 'tools'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200')
                  ]"
                >
                  <span>🛠️</span>
                  <span>14 AI Tools</span>
                </button>
              </div>

              <!-- Test Connection Button -->
              <button
                @click="testMcpConnection"
                :disabled="isTestingMcp || !mcpData?.has_token"
                class="px-3 py-1.5 rounded-xl border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>{{ isTestingMcp ? '⏳' : '🚀' }}</span>
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
                  <li><strong>Workspace level (Recommended):</strong> Create <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">.agents/mcp_config.json</code> in your project root.</li>
                  <li><strong>Global level:</strong> Save into <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">~/.gemini/config/mcp_config.json</code> (or <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">%USERPROFILE%\.gemini\config\mcp_config.json</code>).</li>
                </ul>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-[#060913] border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.antigravity || {
  "mcpServers": {
    "task-hub": {
      "serverUrl": mcpData?.server_url || "https://task-hub.macatung.dev/mcp",
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
                        'serverUrl': mcpData?.server_url || 'https://task-hub.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'antigravity' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Cursor IDE -->
            <div v-else-if="activeMcpTab === 'cursor'" class="space-y-3">
              <div class="text-xs space-y-1">
                <p class="font-bold text-slate-200">Where to save this configuration for Cursor:</p>
                <p class="text-slate-400 text-[11px]">Save into <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">.cursor/mcp.json</code> or project root <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">.mcp.json</code>.</p>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-[#060913] border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.cursor || {
  "mcpServers": {
    "task-hub": {
      "url": mcpData?.server_url || "https://task-hub.macatung.dev/mcp",
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
                        'url': mcpData?.server_url || 'https://task-hub.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'cursor' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Claude Desktop -->
            <div v-else-if="activeMcpTab === 'claude'" class="space-y-3">
              <div class="text-xs space-y-1">
                <p class="font-bold text-slate-200">Where to save for Claude Desktop:</p>
                <p class="text-slate-400 text-[11px]">Save into <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows) or <code class="px-1 py-0.5 rounded bg-slate-950 font-mono text-indigo-300">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS).</p>
              </div>

              <div class="relative">
                <pre :class="['p-4 rounded-xl border font-mono text-xs overflow-x-auto select-all leading-relaxed', isDarkMode ? 'bg-[#060913] border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-700 text-emerald-300']"><code>{{ JSON.stringify(mcpData?.configs?.claude_desktop || {
  "mcpServers": {
    "task-hub": {
      "url": mcpData?.server_url || "https://task-hub.macatung.dev/mcp",
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
                        'url': mcpData?.server_url || 'https://task-hub.macatung.dev/mcp',
                        'headers': {
                          'Authorization': `Bearer ${mcpData?.token || 'YOUR_TASK_HUB_MCP_TOKEN'}`
                        }
                      }
                    }
                  }, null, 2))"
                  class="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
                >
                  {{ copiedSnippetType === 'claude' ? '✓ Copied' : 'Copy JSON' }}
                </button>
              </div>
            </div>

            <!-- Tab Content: Tools Directory -->
            <div v-else-if="activeMcpTab === 'tools'" class="space-y-2.5">
              <p class="text-xs text-slate-400">
                The Task Hub MCP server automatically exposes these 14 tools to the AI agent:
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">get_next_action</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Return the smallest actionable high-priority task.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">get_work_item</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read task details, subtasks & sprint backlog.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">get_context_pack</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Build full context pack for AI code synthesis.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">get_project_state</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read project sprint health, blockers & progress.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">start_agent_run</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Register auditable agent lifecycle session.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">complete_agent_handoff</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Submit files changed, tests & request review.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">attach_verification_evidence</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Attach build, test & security logs.</div>
                </div>
                <div :class="['p-2.5 rounded-xl border', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200']">
                  <div class="font-mono font-bold text-indigo-400">list_project_documents</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Read project architecture & spec registry.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <span class="text-xs text-slate-500">
            Endpoint: <code class="font-mono text-indigo-400">/mcp</code> | JSON-RPC 2.0
          </span>
          <button
            @click="showMcpModal = false"
            class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-md transition-colors"
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
        isDarkMode ? 'bg-[#04070d]/95' : 'bg-slate-900/60'
      ]"
    >
      <div
        :class="[
          'relative w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl text-center z-10 transition-all duration-300',
          isPinShaking ? 'animate-bounce !border-red-500' : (isDarkMode ? 'bg-[#0a0f1d] border-slate-700' : 'bg-white border-slate-300 text-slate-950')
        ]"
      >
        <div class="flex flex-col items-center mb-6">
          <div class="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-xs mb-3">
            <span class="text-2xl">🔒</span>
          </div>

          <h2 :class="['text-lg sm:text-xl font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">
            TASK HUB WORKSPACE SECURITY
          </h2>
          <p :class="['text-xs mt-1 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
            Enter the <strong class="text-blue-600 dark:text-blue-400 font-mono font-bold">6-digit PIN</strong> to unlock the workspace.
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
                ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 scale-105 shadow-xs'
                : pinInput.length === i - 1
                ? 'border-blue-500 bg-slate-50 dark:bg-slate-900 text-slate-400 ring-2 ring-blue-200 dark:ring-blue-900'
                : (isDarkMode ? 'border-slate-800 bg-slate-950 text-slate-600' : 'border-slate-300 bg-slate-50 text-slate-400')
            ]"
          >
            <span v-if="pinInput.length >= i" class="text-xl text-blue-600 dark:text-blue-400">●</span>
            <span v-else class="text-slate-400 dark:text-slate-700 text-xs">―</span>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="pinError" class="mb-4 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 py-2 px-3 rounded-xl font-bold">
          ⚠️ {{ pinError }}
        </div>

        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-2.5 mb-6 max-w-xs mx-auto">
          <button
            v-for="num in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
            :key="num"
            @click="handleNumpadPress(num)"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer shadow-xs',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800' : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
            ]"
          >
            {{ num }}
          </button>

          <button
            @click="handleNumpadClear"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer',
              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            ]"
          >
            CLEAR
          </button>

          <button
            @click="handleNumpadPress('0')"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer shadow-xs',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800' : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
            ]"
          >
            0
          </button>

          <button
            @click="handleNumpadBackspace"
            :class="[
              'h-12 rounded-2xl border font-mono font-bold text-lg transition-all active:scale-95 cursor-pointer',
              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-red-400' : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-red-600 hover:bg-red-50'
            ]"
          >
            ⌫
          </button>
        </div>

        <div :class="['flex items-center justify-between pt-4 border-t text-xs', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <a href="/" :class="['font-bold flex items-center gap-1', isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-950']">
            ← Back to home
          </a>

          <button
            @click="checkPin"
            :disabled="pinInput.length !== 6"
            :class="[
              'px-5 py-2 rounded-xl font-bold font-mono text-xs transition-all flex items-center gap-1.5 shadow-xs',
              pinInput.length === 6
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : (isDarkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-60' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60')
            ]"
          >
            <span>UNLOCK</span>
            <span>🔓</span>
          </button>
        </div>
      </div>
    </div>
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
