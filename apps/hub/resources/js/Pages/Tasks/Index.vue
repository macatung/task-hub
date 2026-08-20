<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import axios from 'axios';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import TasksEmptyState from '@/Components/tasks/TasksEmptyState.vue';
import ProjectDocumentsPanel from '@/Components/tasks/ProjectDocumentsPanel.vue';
import ProjectReleaseLog from '@/Components/tasks/ProjectReleaseLog.vue';
import { sound } from '@/audio/soundEffects';

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  key?: string;
  category?: string;
  type: 'work' | 'personal';
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
  project_id: number | null;
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
  agent_session_id?: string;
  status: string;
  branch?: string | null;
  commit_sha?: string | null;
  pull_request_url?: string | null;
  summary?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
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

// Light / Dark Theme State (Default: Light Mode with High Contrast)
const isDarkMode = ref(false);

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('macatung_tasks_theme', isDarkMode.value ? 'dark' : 'light');
  sound.playClick();
};

// Sidebar State
const isSidebarOpen = ref(true);
const selectedProjectId = ref<string | number>(props.selectedProjectId || 'all');
const activeProjectMenuId = ref<number | null>(null);
const keyboardSequence = ref('');

// Top View Mode: Board (Kanban) | Backlog (Sprint Planning) | Roadmap (Gantt)
const currentView = ref<'board' | 'backlog' | 'roadmap'>('board');

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
    pinError.value = 'Mã PIN không chính xác. Vui lòng thử lại!';
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
// DELAY & OVERDUE DETECTION ENGINE (TRỄ HẠN & CHẬM TIẾN ĐỘ)
// =============================================================================
const getTaskDelayStatus = (task: TaskItem): TaskDelayStatus => {
  if (task.status === 'done') {
    return {
      status: 'completed',
      isOverdue: false,
      isDelayed: false,
      daysOverdue: 0,
      daysRemaining: 0,
      label: 'Đã hoàn thành',
      reason: 'Nhiệm vụ đã hoàn tất thành công.',
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
      label: 'Không có hạn',
      reason: 'Chưa đặt hạn chót',
      badgeClass: isDarkMode.value ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200',
      cardBorderClass: isDarkMode.value ? 'border-slate-800' : 'border-slate-200',
      progressPercent,
    };
  }

  const dueDate = new Date(task.due_date + 'T00:00:00');
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  // 1. OVERDUE (Trễ hạn)
  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return {
      status: 'overdue',
      isOverdue: true,
      isDelayed: false,
      daysOverdue,
      daysRemaining: 0,
      label: `🚨 TRỄ ${daysOverdue} NGÀY`,
      reason: `Đã quá hạn chót ${daysOverdue} ngày (${task.due_date}) mà chưa hoàn thành. Cần ưu tiên xử lý ngay hoặc gia hạn!`,
      badgeClass: isDarkMode.value
        ? 'bg-rose-950/90 text-rose-300 border-rose-600 font-bold shadow-xs'
        : 'bg-rose-100 text-rose-900 border-rose-300 font-bold shadow-xs ring-1 ring-rose-300',
      cardBorderClass: isDarkMode.value
        ? '!border-l-4 !border-l-rose-500 border-rose-900/60 bg-rose-950/15'
        : '!border-l-4 !border-l-rose-600 border-rose-200 bg-rose-50/40 shadow-xs',
      progressPercent,
    };
  }

  // 2. AT RISK / BEHIND SCHEDULE (Chậm tiến độ / Nguy cơ trễ)
  // Condition a: Due today and not done
  if (diffDays === 0) {
    return {
      status: 'at_risk',
      isOverdue: false,
      isDelayed: true,
      daysOverdue: 0,
      daysRemaining: 0,
      label: '⚠️ HẠN HÔM NAY',
      reason: 'Hạn chót là hôm nay. Cần tập trung hoàn tất trong ngày!',
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
        reasonText = `Đã trôi qua ${Math.round(timeRatio * 100)}% thời gian nhưng vẫn ở trạng thái Cần Làm (To Do).`;
      } else if (timeRatio > 0.7 && progressPercent < 40) {
        isBehindTime = true;
        reasonText = `Đã trôi qua ${Math.round(timeRatio * 100)}% thời gian nhưng tiến độ chỉ đạt ~${progressPercent}%.`;
      }
    }
  }

  // Condition c: Due in 1-2 days with High/Urgent priority and still in Todo
  if (!isBehindTime && diffDays <= 2 && task.status === 'todo' && (task.priority === 'urgent' || task.priority === 'high')) {
    isBehindTime = true;
    reasonText = `Còn ${diffDays} ngày đến hạn nhưng nhiệm vụ ưu tiên cao vẫn chưa được bắt đầu (To Do).`;
  }

  if (isBehindTime) {
    return {
      status: 'at_risk',
      isOverdue: false,
      isDelayed: true,
      daysOverdue: 0,
      daysRemaining: diffDays,
      label: '⚠️ CHẬM TIẾN ĐỘ',
      reason: reasonText || `Nhiệm vụ có nguy cơ trễ hạn (còn ${diffDays} ngày).`,
      badgeClass: isDarkMode.value
        ? 'bg-amber-950/90 text-amber-300 border-amber-600 font-semibold'
        : 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-xs',
      cardBorderClass: isDarkMode.value
        ? '!border-l-4 !border-l-amber-500 border-amber-900/40 bg-amber-950/10'
        : '!border-l-4 !border-l-amber-500 border-amber-200 bg-amber-50/30',
      progressPercent,
    };
  }

  // 3. ON TRACK (Đúng tiến độ)
  return {
    status: 'on_track',
    isOverdue: false,
    isDelayed: false,
    daysOverdue: 0,
    daysRemaining: diffDays,
    label: `Còn ${diffDays} ngày`,
    reason: `Đúng tiến độ. Hạn chót: ${task.due_date}.`,
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
    aiSettingsFeedback.value = 'Không thể tải cài đặt AI.';
  }
};

const saveAiSettings = async () => {
  isAiSettingsSaving.value = true;
  aiSettingsFeedback.value = '';
  try {
    const res = await axios.post('/api/tasks/ai-settings', aiSettings.value);
    if (res.data.success) {
      aiSettingsFeedback.value = '✓ Đã lưu an toàn. API key không được hiển thị lại.';
      aiSettings.value.api_key = '';
      sound.playSuccess();
    }
  } catch (err: any) {
    aiSettingsFeedback.value = err.response?.data?.message || 'Không thể lưu cài đặt AI.';
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
    agentRunFeedback.value = 'Không thể tải lịch sử agent run.';
  } finally {
    isAgentRunsLoading.value = false;
  }
};

const startAgentRun = async (provider: string) => {
  if (!selectedTask.value) return;
  try {
    const res = await axios.post('/api/tasks/agent-runs', { task_id: selectedTask.value.id, provider });
    selectedAgentRuns.value.unshift(res.data.data);
    agentRunFeedback.value = `Đã tạo run cho ${provider}. Agent có thể lấy Context Pack từ Task Hub.`;
  } catch (err: any) {
    agentRunFeedback.value = err.response?.data?.message || 'Không thể tạo agent run.';
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
  type: 'work' as 'work' | 'personal',
  color: '#2563eb',
  description: '',
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
// AI SPRINT & TASK GENERATOR STATE (TỰ ĐỘNG PHÂN RÃ DỰ ÁN)
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
    type: 'work' | 'personal';
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

const aiForm = ref({
  prompt: '',
  project_id: 'new' as string | number,
  project_title: '',
  project_key: '',
  project_type: 'work' as 'work' | 'personal',
  project_color: '#2563eb',
  sprint_count: 3,
  sprint_duration_weeks: 2,
  start_date: new Date().toISOString().split('T')[0],
});

const aiGeneratedPlan = ref<AiPlanPreview | null>(null);

const aiTemplates = [
  {
    title: 'Sàn Thương Mại Điện Tử (E-Commerce B2C)',
    prompt: 'Xây dựng hệ thống thương mại điện tử đa kênh bao gồm cổng thanh toán VNPay/Momo, giỏ hàng realtime, quản lý kho hàng, ứng dụng mobile cho shipper và dashboard báo cáo doanh thu.',
  },
  {
    title: 'Nền Tảng AI SaaS & Chatbot Thông Minh',
    prompt: 'Phát triển nền tảng AI SaaS tích hợp mô hình Gemini & OpenAI, hỗ trợ người dùng tải lên tài liệu PDF để phân tích, hỏi đáp thông minh qua stream SSE và thanh toán gói thuê bao hàng tháng.',
  },
  {
    title: 'Ứng Dụng Quản Lý Nhân Sự & Chấm Công GPS',
    prompt: 'Hệ thống quản lý nhân sự HRM và chấm công qua định vị GPS trên ứng dụng mobile Flutter, phân quyền phê duyệt đơn nghỉ phép nhiều cấp và xuất bảng lương tự động.',
  },
  {
    title: 'Hạ Tầng Microservices & Realtime Message Queue',
    prompt: 'Thiết kế kiến trúc backend Microservices với Redis Message Queue, WebSocket notification realtime, xác thực tập trung OAuth2 JWT và cấu hình CI/CD Docker Kubernetes trên Cloud.',
  },
];

const openAiGeneratorModal = () => {
  aiGeneratorStep.value = 'input';
  aiForm.value = {
    prompt: '',
    project_id: selectedProjectId.value !== 'all' && selectedProjectId.value !== 'unassigned' ? selectedProjectId.value : 'new',
    project_title: '',
    project_key: '',
    project_type: 'work',
    project_color: '#2563eb',
    sprint_count: 3,
    sprint_duration_weeks: 2,
    start_date: new Date().toISOString().split('T')[0],
  };
  aiGeneratedPlan.value = null;
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
      project_title: aiForm.value.project_title || undefined,
      project_key: aiForm.value.project_key || undefined,
      project_type: aiForm.value.project_type,
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
    alert('Không thể phân tích yêu cầu dự án. Vui lòng kiểm tra lại!');
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
    alert('Không thể lưu kế hoạch tự động vào dự án. Vui lòng thử lại!');
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
const workProjects = computed(() => projectList.value.filter(p => p.type === 'work'));
const personalProjects = computed(() => projectList.value.filter(p => p.type === 'personal'));

const activeProjectObject = computed(() => {
  if (selectedProjectId.value === 'all' || selectedProjectId.value === 'unassigned') {
    return null;
  }
  return projectList.value.find(p => p.id === Number(selectedProjectId.value)) || null;
});

const activeProjectTasks = computed(() => {
  if (selectedProjectId.value === 'all') return taskList.value;
  if (selectedProjectId.value === 'unassigned') return taskList.value.filter(t => t.project_id === null);
  return taskList.value.filter(t => t.project_id === Number(selectedProjectId.value));
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
    // Project filter
    if (selectedProjectId.value !== 'all') {
      if (selectedProjectId.value === 'unassigned') {
        if (task.project_id !== null) return false;
      } else {
        if (task.project_id !== Number(selectedProjectId.value)) return false;
      }
    }

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

// Backlog Pool Tasks (No sprint assigned)
const backlogTasks = computed(() => {
  return taskList.value.filter(task => {
    if (selectedProjectId.value !== 'all') {
      if (selectedProjectId.value === 'unassigned') {
        if (task.project_id !== null) return false;
      } else {
        if (task.project_id !== Number(selectedProjectId.value)) return false;
      }
    }
    return task.sprint_id === null;
  });
});

const getSprintTasks = (sprintId: number) => {
  return taskList.value.filter(t => t.sprint_id === sprintId);
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
        label: 'Khẩn cấp',
        icon: '🔴',
        class: isDarkMode.value
          ? 'bg-red-950/70 text-red-300 border-red-700/60 font-bold'
          : 'bg-red-100 text-red-950 border-red-300 font-bold shadow-xs'
      };
    case 'high':
      return {
        label: 'Ưu tiên',
        icon: '🟠',
        class: isDarkMode.value
          ? 'bg-amber-950/70 text-amber-300 border-amber-700/60 font-semibold'
          : 'bg-amber-100 text-amber-950 border-amber-300 font-bold shadow-xs'
      };
    case 'medium':
      return {
        label: 'Bình thường',
        icon: '🟡',
        class: isDarkMode.value
          ? 'bg-slate-800 text-slate-200 border-slate-700 font-medium'
          : 'bg-slate-100 text-slate-900 border-slate-300 font-semibold shadow-xs'
      };
    case 'low':
      return {
        label: 'Thấp',
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
        label: 'Chánh Niệm',
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
  if (projectId === 'unassigned') return taskList.value.filter(t => t.project_id === null).length;
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
  isSubmitting.value = true;

  try {
    const payload = {
      project_id: selectedProjectId.value !== 'all' && selectedProjectId.value !== 'unassigned' ? Number(selectedProjectId.value) : null,
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
    alert('Không thể tạo Sprint. Vui lòng thử lại!');
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
    alert('Lỗi khi bắt đầu Sprint!');
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
    alert('Lỗi khi hoàn thành Sprint!');
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteSprint = async (sprint: SprintItem) => {
  if (!confirm(`Bạn có chắc muốn xóa Sprint "${sprint.name}"?\n(Toàn bộ công việc trong Sprint sẽ được chuyển về Backlog an toàn)`)) return;

  try {
    await axios.delete(`/api/sprints/${sprint.id}`);
    sprintList.value = sprintList.value.filter(s => s.id !== sprint.id);
    taskList.value.forEach(t => {
      if (t.sprint_id === sprint.id) t.sprint_id = null;
    });
    sound.playClick();
  } catch (err) {
    console.error('Delete sprint failed:', err);
    alert('Lỗi khi xóa Sprint!');
  }
};

// PROJECT CRUD
const openCreateProjectModal = (type: 'work' | 'personal' = 'work') => {
  projectModalMode.value = 'create';
  editingProjectId.value = null;
  projectForm.value = {
    title: '',
    key: '',
    type,
    color: type === 'work' ? '#2563eb' : '#f59e0b',
    description: '',
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
    type: project.type || 'work',
    color: project.color || '#2563eb',
    description: project.description || '',
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
    projectGithubFeedback.value = err.response?.data?.message || 'Không thể tải repository GitHub.';
  } finally {
    isGithubRepositoriesLoading.value = false;
  }
};

const handleSaveProject = async () => {
  if (projectModalMode.value === 'create' && !selectedGithubRepository.value) {
    projectGithubFeedback.value = 'Hãy chọn một repository GitHub trước khi tạo dự án.';
    return;
  }
  if (projectModalMode.value === 'edit' && !projectForm.value.title.trim()) return;
  isProjectSubmitting.value = true;

  try {
    if (projectModalMode.value === 'create') {
      const res = await axios.post('/api/projects/from-github', { repository: selectedGithubRepository.value!.full_name, type: projectForm.value.type, color: projectForm.value.color });
      if (res.data.success) {
        const created: ProjectItem = res.data.data;
        if (projectForm.value.github_repository.trim()) {
          await axios.post(`/api/projects/${created.id}/github/connect`, projectForm.value);
        }
        projectList.value.push(created);
        selectedProjectId.value = created.id;
        sound.playSuccess();
        showProjectModal.value = false;
      }
    } else if (projectModalMode.value === 'edit' && editingProjectId.value) {
      const res = await axios.patch(`/api/projects/${editingProjectId.value}`, projectForm.value);
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
    const message = err.response?.data?.message || 'Không thể lưu dự án. Vui lòng thử lại!';
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
    projectGithubFeedback.value = 'Không thể tải trạng thái GitHub.';
  }
};

const syncProjectGithub = async () => {
  if (!editingProjectId.value) return;
  isProjectGithubSyncing.value = true;
  projectGithubFeedback.value = '';
  try {
    const res = await axios.post(`/api/projects/${editingProjectId.value}/github/sync`);
    projectGithubStatus.value = res.data.data;
    projectGithubFeedback.value = '✓ Đã lấy repository, issue và pull request đang mở từ GitHub.';
  } catch (err: any) {
    projectGithubFeedback.value = err.response?.data?.message || 'Không thể đồng bộ GitHub.';
  } finally {
    isProjectGithubSyncing.value = false;
  }
};

const handleDeleteProject = async (project: ProjectItem) => {
  activeProjectMenuId.value = null;
  if (!confirm(`Bạn có chắc muốn xóa dự án "${project.title}"?\n(Toàn bộ các nhiệm vụ thuộc dự án này sẽ được giữ lại an toàn)`)) {
    return;
  }

  try {
    await axios.delete(`/api/projects/${project.id}`);
    projectList.value = projectList.value.filter(p => p.id !== project.id);
    taskList.value.forEach(t => {
      if (t.project_id === project.id) {
        t.project_id = null;
        t.project = null;
      }
    });
    if (selectedProjectId.value === project.id) selectedProjectId.value = 'all';
    sound.playClick();
  } catch (err) {
    console.error('Delete project failed:', err);
    alert('Lỗi khi xóa dự án!');
  }
};

// TASK / ISSUE CRUD & DRAWER
const openCreateTaskModal = () => {
  newTaskForm.value = {
    project_id: selectedProjectId.value !== 'all' && selectedProjectId.value !== 'unassigned' ? Number(selectedProjectId.value) : null,
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
    alert('Lỗi khi tạo nhiệm vụ mới!');
  } finally {
    isSubmitting.value = false;
  }
};

const handleQuickCreate = async (targetSprintId: number | null = null) => {
  if (!quickInputText.value.trim()) return;
  const title = quickInputText.value.trim();
  quickInputText.value = '';

  try {
    const payload = {
      title,
      project_id: selectedProjectId.value !== 'all' && selectedProjectId.value !== 'unassigned' ? Number(selectedProjectId.value) : null,
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
  if (!confirm(`Bạn có chắc muốn xóa Issue "${task.issue_key || ''} — ${task.title}"?`)) return;

  try {
    await axios.delete(`/api/tasks/${task.id}`);
    taskList.value = taskList.value.filter(t => t.id !== task.id);
    if (selectedTask.value?.id === task.id) selectedTask.value = null;
    sound.playClick();
  } catch (err) {
    console.error('Delete task error:', err);
    alert('Lỗi khi xóa nhiệm vụ!');
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
  if (task && task.sprint_id !== targetSprintId) {
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
    openCreateProjectModal('work');
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
};

onMounted(() => {
  const savedPin = sessionStorage.getItem('macatung_tasks_pin_auth');
  if (savedPin === '301095') {
    isPinUnlocked.value = true;
  }

  const savedTheme = localStorage.getItem('macatung_tasks_theme');
  if (savedTheme === 'dark') {
    isDarkMode.value = true;
  } else {
    isDarkMode.value = false;
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
    'tasks-page min-h-screen font-sans flex flex-col transition-colors duration-150 selection:bg-blue-100 selection:text-blue-900',
      isDarkMode ? 'dark bg-[#080d1a] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    ]"
  >
    <!-- ========================================================================= -->
    <!-- 1. TOP NAVBAR (STICKY GLASSMORPHISM & LINEAR ENTERPRISE CONTROLS)         -->
    <!-- ========================================================================= -->
    <header
      :class="[
        'sticky top-0 z-40 border-b backdrop-blur-md transition-colors',
        isDarkMode ? 'bg-[#0b101e]/90 border-slate-800/80 text-slate-100 shadow-sm' : 'bg-white/90 border-slate-200/90 text-slate-900 shadow-xs'
      ]"
    >
      <div class="w-full px-3 sm:px-6 min-h-16 py-2 lg:h-16 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
        <!-- Left: Sidebar toggle + Logo + Breadcrumb -->
        <div class="flex items-center gap-3 min-w-0">
          <button
            @click="isSidebarOpen = !isSidebarOpen"
            :class="[
              'p-2 rounded-xl border transition-all cursor-pointer text-xs font-bold shadow-xs',
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
            ]"
            title="Đóng / Mở danh mục dự án"
          >
            {{ isSidebarOpen ? '◀' : '▶' }}
          </button>

          <!-- Logo & Brand -->
          <a href="/" class="flex items-center gap-2.5 group shrink-0">
            <MiniMascotLogo size="sm" :enable-sound="true" />
            <div class="flex items-center gap-2">
              <span :class="['font-display font-bold text-base tracking-tight', isDarkMode ? 'text-white' : 'text-slate-950']">
                Tasks Hub
              </span>
              <span class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[10px] font-bold">
                JIRA LITE
              </span>
            </div>
          </a>

          <!-- Dynamic Breadcrumbs -->
          <div class="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs min-w-0">
            <span class="text-slate-400">/</span>
            <div class="flex items-center gap-1.5 font-bold truncate">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: activeProjectObject?.color || '#2563eb' }"></span>
              <span :class="['truncate', isDarkMode ? 'text-slate-200' : 'text-slate-800']">
                {{ activeProjectObject ? activeProjectObject.title : (selectedProjectId === 'unassigned' ? 'Chung (Chưa gán)' : 'Tất Cả Dự Án') }}
              </span>
              <span v-if="activeProjectObject?.key" class="font-mono text-[10px] px-1.5 py-0.2 rounded font-bold border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {{ activeProjectObject.key }}
              </span>
            </div>
            <template v-if="activeSprint">
              <span class="text-slate-400">/</span>
              <span class="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 truncate max-w-[140px]">
                🏃 {{ activeSprint.name }}
              </span>
            </template>
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
                ? (isDarkMode ? 'bg-blue-600 text-white font-bold shadow-md' : 'bg-white text-blue-800 font-bold shadow-xs border border-slate-200/80')
                : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
            ]"
          >
            <span>📋</span>
            <span>Bảng Công Việc</span>
            <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', currentView === 'board' ? 'bg-white/20 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')]">
              {{ filteredBoardTasks.length }}
            </span>
          </button>

          <button
            @click="currentView = 'backlog'; sound.playClick();"
            :class="[
              'px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
              currentView === 'backlog'
                ? (isDarkMode ? 'bg-blue-600 text-white font-bold shadow-md' : 'bg-white text-blue-800 font-bold shadow-xs border border-slate-200/80')
                : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
            ]"
          >
            <span>📦</span>
            <span>Kế Hoạch Sprint</span>
            <span :class="['px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', currentView === 'backlog' ? 'bg-white/20 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')]">
              {{ sprintList.length }}
            </span>
          </button>

          <button
            @click="currentView = 'roadmap'; sound.playClick();"
            :class="[
              'px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
              currentView === 'roadmap'
                ? (isDarkMode ? 'bg-blue-600 text-white font-bold shadow-md' : 'bg-white text-blue-800 font-bold shadow-xs border border-slate-200/80')
                : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-700 hover:text-slate-950 hover:bg-white/60')
            ]"
          >
            <span>🗺️</span>
            <span>Tiến Độ (Roadmap)</span>
          </button>
        </div>

        <!-- Right Controls -->
        <div class="flex flex-wrap items-center justify-end gap-2 shrink-0 w-full lg:w-auto">
          <!-- Weekly Email Report Settings & Send Button -->
          <button
            @click="openReportModal"
            :class="[
              'px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            ]"
            title="Cài đặt và gửi email báo cáo tiến độ tuần cho sếp & quản lý"
          >
            <span>✉️</span>
            <span class="hidden sm:inline">Email Báo Cáo</span>
            <span class="sm:hidden">Report</span>
          </button>

          <!-- AI Sprint & Task Generator Button -->
          <button
            @click="openAiGeneratorModal"
            class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Tự động phân rã yêu cầu dự án thành Sprints, Epics & Tasks bằng AI"
          >
            <span>✨</span>
            <span class="hidden sm:inline">AI Lập Kế Hoạch</span>
            <span class="sm:hidden">AI</span>
          </button>

          <button
            @click="openAiSettings"
            :class="['px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-purple-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-purple-800 hover:bg-purple-50']"
            title="Cấu hình provider AI và API key riêng tư"
          >
            <span>⚙️</span>
            <span class="hidden xl:inline">AI Settings</span>
          </button>

          <!-- Light / Dark Toggle Button -->
          <button
            @click="toggleTheme"
            :class="[
              'px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs',
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            ]"
            :title="isDarkMode ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'"
          >
            <span>{{ isDarkMode ? '☀️' : '🌙' }}</span>
            <span class="hidden sm:inline">{{ isDarkMode ? 'Sáng' : 'Tối' }}</span>
          </button>

          <!-- Create Issue Button -->
          <button
            @click="openCreateTaskModal"
            class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            title="Tạo Issue mới (Phím C)"
          >
            <span class="text-sm font-black">+</span>
            <span>Tạo Task</span>
          </button>

          <template v-if="props.auth?.user">
            <span class="hidden xl:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold" :class="isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'">
              <img v-if="props.auth.user.github_avatar_url" :src="props.auth.user.github_avatar_url" class="h-4 w-4 rounded-full" alt="GitHub avatar" />
              @{{ props.auth.user.github_login || props.auth.user.name }}
            </span>
            <button @click="logoutGithub" class="rounded-xl border px-2.5 py-2 text-[10px] font-bold" :class="isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'">Đăng xuất</button>
          </template>
          <a v-else href="/auth/github" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">Đăng nhập GitHub</a>

          <!-- Lock Button -->
          <button
            @click="lockWorkspace"
            :class="[
              'p-2 rounded-xl border text-xs transition-colors cursor-pointer shadow-xs',
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50'
            ]"
            title="Khóa không gian làm việc (PIN: 301095)"
          >
            <span>🔒</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ========================================================================= -->
    <!-- 2. MAIN LAYOUT (SIDEBAR + MAIN CANVAS)                                    -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex min-h-0 overflow-visible md:overflow-hidden">
      <!-- SIDEBAR: DỰ ÁN 2-LINE HIGH CONTRAST LAYOUT -->
      <aside
        v-if="isSidebarOpen"
        :class="[
          'fixed md:relative left-0 top-16 md:top-auto bottom-0 md:bottom-auto z-30 w-[min(88vw,20rem)] md:w-72 border-r flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] select-none transition-colors shadow-xl md:shadow-none',
          isDarkMode ? 'bg-[#090d16] border-slate-800/80' : 'bg-white border-slate-200/90'
        ]"
      >
        <div class="p-3.5 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
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
                <span class="text-base">📁</span>
                <div>
                  <div :class="['font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-950']">Tất Cả Dự Án</div>
                  <div :class="['text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-600']">Toàn bộ công việc & nhiệm vụ</div>
                </div>
              </div>
              <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full', isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                {{ getProjectTaskCount('all') }}
              </span>
            </button>

            <button
              @click="selectedProjectId = 'unassigned'"
              :class="[
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border text-left',
                selectedProjectId === 'unassigned'
                  ? (isDarkMode ? 'bg-slate-900 text-white border-blue-500/60 font-bold' : 'bg-blue-50/90 text-blue-950 border-blue-300 font-bold shadow-xs')
                  : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-slate-900/60' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-base">📦</span>
                <div>
                  <div :class="['font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-950']">Chung (Chưa gán)</div>
                  <div :class="['text-[11px]', isDarkMode ? 'text-slate-400' : 'text-slate-600']">Task lẻ chưa gán vào dự án</div>
                </div>
              </div>
              <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full', isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                {{ getProjectTaskCount('unassigned') }}
              </span>
            </button>
          </div>

          <!-- GROUP 1: WORK PROJECTS (2-LINE ITEM) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between px-2 text-[11px] font-mono font-bold uppercase tracking-wider">
              <span class="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold">
                <span>💼</span>
                <span>DỰ ÁN CÔNG VIỆC</span>
              </span>
              <button
                @click="openCreateProjectModal('work')"
                class="hover:text-blue-600 p-0.5 rounded cursor-pointer text-xs font-bold"
                title="Tạo dự án mới"
              >
                +
              </button>
            </div>

            <div class="space-y-1">
              <div
                v-for="proj in workProjects"
                :key="proj.id"
                :class="[
                  'relative group rounded-xl',
                  activeProjectMenuId === proj.id ? 'z-50' : 'z-10'
                ]"
              >
                <button
                  @click="selectedProjectId = proj.id"
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
                      {{ proj.description || 'Dự án trọng điểm' }}
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
                      <span>Chỉnh Sửa</span>
                    </button>
                    <button
                      @click.stop="handleDeleteProject(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <span>🗑️</span>
                      <span>Xóa Dự Án</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- GROUP 2: PERSONAL PROJECTS (2-LINE ITEM) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between px-2 text-[11px] font-mono font-bold uppercase tracking-wider">
              <span class="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                <span>👤</span>
                <span>CÁ NHÂN</span>
              </span>
              <button
                @click="openCreateProjectModal('personal')"
                class="hover:text-amber-600 p-0.5 rounded cursor-pointer text-xs font-bold"
              >
                +
              </button>
            </div>

            <div class="space-y-1">
              <div
                v-for="proj in personalProjects"
                :key="proj.id"
                :class="[
                  'relative group rounded-xl',
                  activeProjectMenuId === proj.id ? 'z-50' : 'z-10'
                ]"
              >
                <button
                  @click="selectedProjectId = proj.id"
                  :class="[
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border text-left',
                    selectedProjectId === proj.id
                      ? (isDarkMode ? 'bg-slate-900 text-white border-amber-500 font-bold' : 'bg-amber-50/90 text-amber-950 border-amber-300 font-bold shadow-xs')
                      : (isDarkMode ? 'text-slate-300 border-transparent hover:text-white hover:bg-slate-900/50' : 'text-slate-800 border-transparent hover:bg-slate-50 hover:text-slate-950')
                  ]"
                >
                  <div class="min-w-0 pr-2 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: proj.color || '#f59e0b' }"></span>
                      <span :class="['font-bold text-xs truncate', isDarkMode ? 'text-white' : 'text-slate-950']">{{ proj.title }}</span>
                      <span v-if="proj.key" :class="['px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0', isDarkMode ? 'bg-amber-950/80 text-amber-300 border border-amber-800' : 'bg-amber-50 text-amber-900 border border-amber-200']">
                        {{ proj.key }}
                      </span>
                    </div>
                    <div :class="['text-[11px] truncate pl-4.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                      {{ proj.description || 'Dự án cá nhân' }}
                    </div>
                  </div>

                  <span :class="['font-mono text-xs font-bold px-2 py-0.5 rounded-full shrink-0', isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-300']">
                    {{ getProjectTaskCount(proj.id) }}
                  </span>
                </button>

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
                      <span>Chỉnh Sửa</span>
                    </button>
                    <button
                      @click.stop="handleDeleteProject(proj)"
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <span>🗑️</span>
                      <span>Xóa Dự Án</span>
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
            <span>AI Phân Rã Dự Án</span>
          </button>

          <button
            @click="openCreateProjectModal('work')"
            :class="[
              'w-full py-2 px-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
            ]"
          >
            <span>+</span>
            <span>Thêm Dự Án Mới</span>
          </button>
        </div>
      </aside>

      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 top-16 z-20 bg-slate-950/30 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <!-- MAIN WORKSPACE -->
      <main :class="['min-w-0 flex-1 flex flex-col overflow-visible md:overflow-hidden', isDarkMode ? 'bg-[#070b14]' : 'bg-[#f8fafc]']">
        <!-- =================================================================== -->
        <!-- MODERN 2-TIER PROJECT SUB-HEADER & SMART FILTER BAR                 -->
        <!-- =================================================================== -->
        <div :class="['p-5 sm:p-6 border-b space-y-4 shrink-0 shadow-xs backdrop-blur-md transition-colors', isDarkMode ? 'bg-slate-950/90 border-slate-800/90' : 'bg-white/95 border-slate-200/90']">
          <!-- TẦNG 1: PROJECT BANNER & ANALYTICS METRICS -->
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
                <span v-if="activeProjectObject?.type === 'personal'">👤</span>
                <span v-else-if="activeProjectObject">💼</span>
                <span v-else-if="selectedProjectId === 'unassigned'">📦</span>
                <span v-else>📁</span>
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h1 :class="['text-xl sm:text-2xl font-bold font-display tracking-tight truncate', isDarkMode ? 'text-white' : 'text-slate-950']">
                    {{ activeProjectObject ? activeProjectObject.title : (selectedProjectId === 'unassigned' ? 'Nhiệm Vụ Chưa Phân Dự Án' : 'Tất Cả Nhiệm Vụ & Dự Án') }}
                  </h1>

                  <span v-if="activeProjectObject?.key" class="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 font-mono text-xs font-bold border border-blue-300 dark:border-blue-800 shadow-xs">
                    {{ activeProjectObject.key }}
                  </span>

                  <span v-if="activeProjectObject" class="px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-bold border shadow-xs" :class="activeProjectObject.type === 'work' ? 'bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'">
                    {{ activeProjectObject.type === 'work' ? '💼 Công Việc' : '👤 Cá Nhân' }}
                  </span>
                </div>

                <p :class="['text-xs sm:text-sm mt-1 line-clamp-1 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-700']">
                  {{ activeProjectObject?.tagline || activeProjectObject?.description || 'Quản lý toàn bộ tiến độ, Sprint Scrum và Backlog nhiệm vụ.' }}
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
                <span :class="isDarkMode ? 'text-slate-400' : 'text-slate-700 font-bold'">Tiến độ:</span>
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
                title="Lọc nhanh các task trễ hạn hoặc chậm tiến độ"
              >
                <span>🚨</span>
                <strong class="font-black">{{ activeProjectWarningCount }} Cần Chú Ý</strong>
              </button>
            </div>
          </div>

          <ProjectDocumentsPanel :project-id="activeProjectObject?.id || null" :repository="activeProjectObject?.github_repository" :branch="activeProjectObject?.github_default_branch" :dark="isDarkMode" />
          <ProjectReleaseLog :project-id="activeProjectObject?.id || null" :dark="isDarkMode" />

          <!-- TẦNG 2: SMART FILTER & QUICK ACTION BAR -->
          <div :class="['flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t text-xs', isDarkMode ? 'border-slate-800/80' : 'border-slate-200']">
            <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <!-- Search Input with Shortcut Badge -->
              <div class="relative min-w-[200px] max-w-xs flex-1">
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  placeholder="Tìm kiếm task... (Phím '/')"
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
                <option value="all">📊 Tất cả tiến độ</option>
                <option value="warning" :disabled="activeProjectWarningCount === 0">
                  ⚡ Cần chú ý (Trễ + Chậm) ({{ activeProjectWarningCount }})
                </option>
                <option value="overdue" :disabled="overdueTasksCount === 0">
                  🚨 Chỉ task trễ hạn ({{ overdueTasksCount }})
                </option>
                <option value="at_risk" :disabled="delayedTasksCount === 0">
                  ⚠️ Chỉ task chậm tiến độ ({{ delayedTasksCount }})
                </option>
                <option value="on_track">🟢 Đúng tiến độ</option>
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
                <option value="all">Tất cả loại issue</option>
                <option value="story">📖 Story (Tính năng)</option>
                <option value="task">☑️ Task (Công việc)</option>
                <option value="bug">🐞 Bug (Lỗi)</option>
                <option value="epic">⚡ Epic (Mục tiêu lớn)</option>
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
                <option value="all">Tất cả độ ưu tiên</option>
                <option value="urgent">🔴 Khẩn cấp</option>
                <option value="high">🟠 Ưu tiên cao</option>
                <option value="medium">🟡 Bình thường</option>
                <option value="low">⚪ Thấp</option>
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
                <option value="all">Tất cả Epic</option>
                <option value="none">Không thuộc Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  ⚡ {{ epic.issue_key }} — {{ epic.title }}
                </option>
              </select>

              <!-- Reset Filter Button -->
              <button
                v-if="hasActiveFilters"
                @click="resetFilters"
                class="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                title="Xóa toàn bộ bộ lọc hiện tại"
              >
                <span>✕</span>
                <span>Xóa Bộ Lọc</span>
              </button>
            </div>

            <!-- Quick Add in Bar -->
            <div class="flex items-center gap-2">
              <input
                ref="quickInputRef"
                v-model="quickInputText"
                type="text"
                placeholder="+ Thêm nhanh task mới... (Enter)"
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
        <!-- PERSONAL DAILY COMMAND CENTER                                         -->
        <!-- ===================================================================== -->
        <section :class="['p-4 sm:p-6 border-b', isDarkMode ? 'bg-indigo-950/20 border-slate-800' : 'bg-indigo-50/50 border-slate-200']">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p :class="['text-[10px] font-mono font-bold uppercase tracking-widest', isDarkMode ? 'text-indigo-300' : 'text-indigo-700']">Personal Command Center</p>
              <h2 :class="['text-lg font-bold tracking-tight', isDarkMode ? 'text-white' : 'text-slate-950']">Hôm nay cần làm gì?</h2>
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
              <p class="mt-1 text-[10px] text-slate-500 truncate">{{ task.project?.title || 'Chung' }} · {{ task.due_date || 'Không hạn' }}</p>
            </button>
            <TasksEmptyState
              v-if="dailyFocusTasks.length === 0"
              :dark="isDarkMode"
              icon="✓"
              title="Không còn task đang mở"
              description="Hãy tạo kế hoạch tiếp theo hoặc xem lại backlog."
            />
          </div>
          <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Cần chú ý</h3><span class="font-mono text-[10px] text-slate-500">{{ warningTasksCount }}</span></div>
              <button v-for="task in taskList.filter(t => t.status !== 'done' && (getTaskDelayStatus(t).isOverdue || getTaskDelayStatus(t).isDelayed)).slice(0, 3)" :key="task.id" @click="openTaskDrawer(task)" class="w-full flex items-center gap-2 border-b py-2 text-left last:border-0 border-slate-200 dark:border-slate-800">
                <span class="h-2 w-2 rounded-full bg-rose-500 shrink-0"></span><span class="truncate text-[11px] font-medium">{{ task.title }}</span>
              </button>
              <p v-if="!taskList.some(t => t.status !== 'done' && (getTaskDelayStatus(t).isOverdue || getTaskDelayStatus(t).isDelayed))" class="text-[11px] text-slate-500">Không có cảnh báo.</p>
            </div>
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Sprint hiện tại</h3><span class="text-[10px] text-slate-500">{{ activeSprint?.end_date || 'Chưa đặt hạn' }}</span></div>
              <p v-if="activeSprint" class="truncate text-[11px] font-medium">{{ activeSprint.name }}</p>
              <div v-if="activeSprint" class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div class="h-full rounded-full bg-blue-600" :style="{ width: (activeSprint.total_tasks ? Math.round(((activeSprint.done_tasks || 0) / activeSprint.total_tasks) * 100) : 0) + '%' }"></div></div>
              <p v-if="activeSprint" class="mt-2 text-[10px] text-slate-500">{{ activeSprint.done_tasks || 0 }}/{{ activeSprint.total_tasks || 0 }} task hoàn thành</p>
              <p v-else class="text-[11px] text-slate-500">Chưa có sprint active.</p>
            </div>
            <div :class="['rounded-xl border p-4', isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200']">
              <div class="flex items-center justify-between mb-3"><h3 class="text-xs font-bold">Hoàn thành gần đây</h3><span class="text-[10px] text-slate-500">{{ completedRecentlyTasks.length }}</span></div>
              <button v-for="task in completedRecentlyTasks.slice(0, 3)" :key="task.id" @click="openTaskDrawer(task)" class="w-full flex items-center gap-2 border-b py-2 text-left last:border-0 border-slate-200 dark:border-slate-800">
                <span class="text-emerald-600">✓</span><span class="truncate text-[11px] font-medium">{{ task.title }}</span>
              </button>
              <p v-if="!completedRecentlyTasks.length" class="text-[11px] text-slate-500">Chưa có task hoàn thành gần đây.</p>
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
                  <span class="font-bold text-sm">CẢNH BÁO TIẾN ĐỘ CÔNG VIỆC</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white">
                    {{ warningTasksCount }} VẤN ĐỀ
                  </span>
                </div>
                <p class="text-xs mt-0.5 opacity-90">
                  Có <strong class="font-bold underline text-rose-700 dark:text-rose-300">{{ overdueTasksCount }} task đã quá hạn</strong> và <strong class="font-bold underline text-amber-700 dark:text-amber-300">{{ delayedTasksCount }} task chậm tiến độ</strong> cần được gia hạn hoặc điều chỉnh ưu tiên.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="filterHealth !== 'warning'"
                @click="filterHealth = 'warning'"
                class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                🚨 Xem Chi Tiết
              </button>
              <button
                v-else
                @click="filterHealth = 'all'"
                :class="[
                  'px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-colors',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'
                ]"
              >
                🔄 Bỏ Lọc
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
                Hạn chót: <strong class="text-slate-950 dark:text-white font-black">{{ activeSprint.end_date || 'Chưa đặt' }}</strong>
              </span>
              <button
                @click="openCompleteSprintModal(activeSprint)"
                :class="[
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors shadow-xs',
                  isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 hover:bg-emerald-900' : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 font-bold'
                ]"
              >
                Hoàn Thành Sprint 🏁
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
                  <span>CẦN LÀM (TO DO)</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-950 border-slate-300 shadow-xs']">
                  {{ todoTasks.length }}
                </span>
              </div>

              <div class="space-y-3 flex-1">
                <div
                  v-for="task in todoTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 group shadow-xs',
                    isDarkMode ? 'bg-[#0f1523] border-slate-800 hover:border-blue-500/70' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-xs font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-blue-950/80 text-blue-300 border-blue-800' : 'bg-blue-100 text-blue-950 border-blue-300']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-sm font-bold line-clamp-2 leading-relaxed', isDarkMode ? 'text-slate-100 group-hover:text-blue-300' : 'text-slate-950 group-hover:text-blue-700']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[11px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-700 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[11px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-2 py-0.5 rounded border', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="todoTasks.length === 0" class="h-28 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Kéo thả task vào đây
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
                  <span>ĐANG LÀM</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-amber-300 border-slate-700' : 'bg-white text-amber-950 border-amber-300 shadow-xs']">
                  {{ inProgressTasks.length }}
                </span>
              </div>

              <div class="space-y-3 flex-1">
                <div
                  v-for="task in inProgressTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 group shadow-xs',
                    isDarkMode ? 'bg-[#0f1523] border-amber-500/40 hover:border-amber-500' : 'bg-white border-amber-200 hover:border-amber-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-xs font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-100 text-amber-950 border-amber-300']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-sm font-bold line-clamp-2 leading-relaxed', isDarkMode ? 'text-slate-100 group-hover:text-amber-300' : 'text-slate-950 group-hover:text-amber-900']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[11px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-700 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[11px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-2 py-0.5 rounded border', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="inProgressTasks.length === 0" class="h-28 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Kéo thả task vào đây
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
                  <span>KIỂM THỬ (REVIEW)</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-purple-300 border-slate-700' : 'bg-white text-purple-950 border-purple-300 shadow-xs']">
                  {{ reviewTasks.length }}
                </span>
              </div>

              <div class="space-y-3 flex-1">
                <div
                  v-for="task in reviewTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 group shadow-xs',
                    isDarkMode ? 'bg-[#0f1523] border-purple-500/40 hover:border-purple-500' : 'bg-white border-purple-200 hover:border-purple-500 hover:shadow-md',
                    getTaskDelayStatus(task).cardBorderClass
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-xs font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-100 text-purple-950 border-purple-300']">{{ task.issue_key }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span v-if="getTaskDelayStatus(task).isOverdue || getTaskDelayStatus(task).isDelayed" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', getTaskDelayStatus(task).badgeClass]" :title="getTaskDelayStatus(task).reason">
                        {{ getTaskDelayStatus(task).label }}
                      </span>
                      <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-950 border-indigo-300']">
                        {{ task.story_points }} pts
                      </span>
                    </div>
                  </div>

                  <h4 :class="['text-sm font-bold line-clamp-2 leading-relaxed', isDarkMode ? 'text-slate-100 group-hover:text-purple-300' : 'text-slate-950 group-hover:text-purple-900']">
                    {{ task.title }}
                  </h4>

                  <!-- Subtask & Due Date mini indicator -->
                  <div v-if="task.subtasks?.length || task.due_date" :class="['flex items-center justify-between text-[11px] font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-700 font-semibold']">
                    <span v-if="task.subtasks?.length" class="flex items-center gap-1">
                      <span>☑️</span>
                      <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    </span>
                    <span v-if="task.due_date" :class="['flex items-center gap-1', getTaskDelayStatus(task).isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : '']">
                      <span>📅</span>
                      <span>{{ task.due_date }}</span>
                    </span>
                  </div>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[11px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-2 py-0.5 rounded border', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span :class="['px-2 py-0.5 rounded border', getPriorityBadge(task.priority).class]">
                      {{ getPriorityBadge(task.priority).label }}
                    </span>
                  </div>
                </div>

                <div v-if="reviewTasks.length === 0" class="h-28 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Kéo thả task vào đây
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
                  <span>ĐÃ HOÀN TẤT</span>
                </span>
                <span :class="['font-mono text-xs px-2.5 py-0.5 rounded-lg font-bold border', isDarkMode ? 'bg-slate-900 text-emerald-300 border-slate-700' : 'bg-white text-emerald-950 border-emerald-300 shadow-xs']">
                  {{ doneTasks.length }}
                </span>
              </div>

              <div class="space-y-3 flex-1">
                <div
                  v-for="task in doneTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="onDragStart($event, task.id)"
                  @click="openTaskDrawer(task)"
                  :class="[
                    'p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 group shadow-xs opacity-90 hover:opacity-100',
                    isDarkMode ? 'bg-[#0f1523] border-emerald-500/30 hover:border-emerald-500' : 'bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-md'
                  ]"
                >
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5">
                      <span>{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <span :class="['font-mono text-xs font-bold px-1.5 py-0.2 rounded border', isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-950 border-emerald-300']">{{ task.issue_key }}</span>
                    </div>
                    <span v-if="task.story_points" :class="['px-2 py-0.5 rounded text-xs font-mono font-bold border', isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-950 border-emerald-300']">
                      {{ task.story_points }} pts
                    </span>
                  </div>

                  <h4 :class="['text-sm font-semibold line-clamp-2 line-through', isDarkMode ? 'text-slate-400' : 'text-slate-700']">
                    {{ task.title }}
                  </h4>

                  <div :class="['flex items-center justify-between pt-1.5 border-t text-[11px]', isDarkMode ? 'border-slate-800/80' : 'border-slate-100']">
                    <span :class="['px-2 py-0.5 rounded border', getCategoryBadge(task.category).class]">
                      {{ getCategoryBadge(task.category).label }}
                    </span>
                    <span class="text-emerald-800 dark:text-emerald-400 font-mono font-bold">Hoàn tất ✓</span>
                  </div>
                </div>

                <div v-if="doneTasks.length === 0" class="h-28 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                  Kéo thả task vào đây
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
                📦 Lập Kế Hoạch Sprint & Backlog
              </h2>
              <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Kéo thả các task vào từng Sprint để chuẩn bị giai đoạn phát triển.
              </p>
            </div>

            <button
              @click="openCreateSprintModal"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Tạo Sprint Mới</span>
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
                    title="Thu gọn / Mở rộng"
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
                      Bắt Đầu Sprint ▶
                    </button>

                    <button
                      v-if="sprint.status === 'active'"
                      @click="openCompleteSprintModal(sprint)"
                      class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Hoàn Thành Sprint ✓
                    </button>

                    <button
                      @click="handleDeleteSprint(sprint)"
                      class="p-1 text-slate-400 hover:text-red-600 cursor-pointer text-xs font-bold"
                      title="Xóa Sprint"
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
                  Sprint này chưa có task. Kéo thả từ Backlog vào đây.
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
                  <h3 :class="['text-sm sm:text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Backlog (Chưa Gán Sprint)</h3>
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
                  Backlog đang trống!
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
              🗺️ Roadmap & Tiến Độ Các Mục Tiêu Lớn (Epics)
            </h2>
            <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
              Theo dõi tiến độ tổng thể của các Epic và Milestone theo dòng thời gian.
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
                  {{ epic.start_date || 'Bắt đầu' }} ➔ {{ epic.due_date || 'Hạn chót' }}
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
                  <span>Trạng thái: <strong :class="['uppercase font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ epic.status }}</strong></span>
                  <span class="font-bold">{{ epic.story_points || 0 }} Story Points</span>
                </div>
              </div>
            </div>

            <div v-if="epicList.length === 0" class="py-8 text-center text-xs text-slate-500 italic font-medium">
              Chưa có Epic nào. Hãy tạo Issue loại Epic để hiển thị trên Roadmap.
            </div>
          </div>
        </div>
      </main>
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
              {{ selectedTask.project?.title || 'Chung (Chưa phân dự án)' }}
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
              :title="isDrawerExpanded ? 'Thu nhỏ bảng chi tiết' : 'Mở rộng toàn màn hình'"
            >
              <span>{{ isDrawerExpanded ? '🗗' : '⛶' }}</span>
              <span class="hidden sm:inline">{{ isDrawerExpanded ? 'Thu Gọn' : 'Toàn Màn Hình' }}</span>
            </button>

            <!-- Delete Button -->
            <button
              @click="deleteTask(selectedTask)"
              class="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border border-transparent hover:border-red-200 text-xs cursor-pointer font-bold flex items-center gap-1 transition-colors"
              title="Xóa Issue"
            >
              <span>🗑️</span>
              <span class="hidden sm:inline">Xóa</span>
            </button>

            <!-- Close Button -->
            <button
              @click="closeTaskDrawer"
              :class="[
                'p-2 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-xs',
                isDarkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              ]"
              title="Đóng bảng chi tiết (Phím Esc)"
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
                Tiêu Đề Nhiệm Vụ (Issue Title)
              </label>
              <input
                v-model="selectedTask.title"
                @blur="saveTaskDrawerChanges"
                :class="[
                  'w-full font-bold text-xl sm:text-2xl lg:text-3xl bg-transparent border-b-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none py-2 transition-colors leading-snug',
                  isDarkMode ? 'text-white placeholder-slate-600' : 'text-slate-950 placeholder-slate-400'
                ]"
                placeholder="Nhập tiêu đề nhiệm vụ..."
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
                <span class="font-mono text-xs font-bold uppercase opacity-80 mr-1">Xử lý nhanh:</span>
                <button
                  @click="extendDueDate(1)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Gia hạn thêm 1 ngày"
                >
                  +1 Ngày
                </button>
                <button
                  @click="extendDueDate(3)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Gia hạn thêm 3 ngày"
                >
                  +3 Ngày
                </button>
                <button
                  @click="extendDueDate(7)"
                  class="px-3 py-1.5 rounded-xl font-bold border bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
                  title="Gia hạn thêm 1 tuần"
                >
                  +1 Tuần
                </button>
                <button
                  v-if="selectedTask.priority !== 'urgent'"
                  @click="increaseTaskPriority"
                  class="px-3.5 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs ml-auto"
                >
                  🔴 Đặt Khẩn Cấp
                </button>
              </div>
            </div>

            <!-- Description Markdown & Code Render -->
            <div class="space-y-2.5">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <span :class="['text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <span>📝</span>
                  <span>MÔ TẢ CHI TIẾT (MARKDOWN)</span>
                </span>
                <button
                  @click="isEditingDescription = !isEditingDescription"
                  class="text-xs px-3.5 py-1.5 rounded-xl font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer shadow-xs"
                >
                  {{ isEditingDescription ? '👁️ Xem Trước Format' : '✏️ Chỉnh Sửa Markdown' }}
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
                  placeholder="Nhập mô tả task bằng markdown (# Tiêu đề, - Danh sách, ```code...)"
                ></textarea>
                <div class="flex justify-end gap-2">
                  <button
                    @click="isEditingDescription = false"
                    class="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    @click="isEditingDescription = false; saveTaskDrawerChanges();"
                    class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    Lưu Mô Tả ✓
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
                  Chưa có mô tả chi tiết cho issue này. Bấm "✏️ Chỉnh Sửa Markdown" để thêm nội dung.
                </div>
              </div>
            </div>

            <!-- Subtasks Checklist -->
            <div class="space-y-3 pt-2">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <span :class="['text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2', isDarkMode ? 'text-slate-300' : 'text-slate-700']">
                  <span>☑️</span>
                  <span>NHIỆM VỤ CON (SUBTASKS)</span>
                </span>
                <span :class="['font-mono text-xs font-bold px-3 py-1 rounded-full border', isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-300 shadow-xs']">
                  {{ (selectedTask.subtasks || []).filter(s => s.done).length }}/{{ (selectedTask.subtasks || []).length }} hoàn thành
                </span>
              </div>

              <div class="flex gap-2.5">
                <input
                  v-model="newSubtaskText"
                  @keydown.enter="addSubtask"
                  placeholder="+ Thêm subtask mới... (Nhấn Enter)"
                  :class="[
                    'flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-blue-500 shadow-xs font-medium',
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                  ]"
                />
                <button
                  @click="addSubtask"
                  class="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs transition-colors"
                >
                  Thêm
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

                  <button @click="deleteSubtask(st.id)" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-xs cursor-pointer font-bold ml-2" title="Xóa subtask">
                    ✕
                  </button>
                </div>

                <div v-if="!selectedTask.subtasks || selectedTask.subtasks.length === 0" class="py-4 text-center text-xs text-slate-400 italic">
                  Chưa có nhiệm vụ con nào. Nhập tiêu đề ở trên để thêm.
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT ATTRIBUTES SIDEBAR (Col-span 4) -->
          <div :class="['lg:col-span-4 space-y-5 p-5 sm:p-6 rounded-3xl border shadow-sm', isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50/90 border-slate-200/90']">
            <div class="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>THÔNG TIN THUỘC TÍNH</span>
            </div>

            <!-- Status -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Trạng Thái (Status)</label>
              <select
                v-model="selectedTask.status"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="todo">⚪ Cần Làm (To Do)</option>
                <option value="in_progress">🟡 Đang Thực Thi (In Progress)</option>
                <option value="review">🟣 Kiểm Thử (Review)</option>
                <option value="done">🟢 Đã Hoàn Tất (Done)</option>
              </select>
            </div>

            <!-- Issue Type -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Loại Issue</label>
              <select
                v-model="selectedTask.issue_type"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="task">☑️ Task (Công việc)</option>
                <option value="story">📖 Story (Tính năng)</option>
                <option value="bug">🐞 Bug (Lỗi)</option>
                <option value="epic">⚡ Epic (Mục tiêu lớn)</option>
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
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Sprint Kế Hoạch</label>
              <select
                v-model="selectedTask.sprint_id"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-semibold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">📦 Backlog (Chưa gán Sprint)</option>
                <option v-for="sprint in sprintList" :key="sprint.id" :value="sprint.id">
                  🏃 {{ sprint.name }} ({{ sprint.status.toUpperCase() }})
                </option>
              </select>
            </div>

            <!-- Epic Link -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Gán Vào Epic</label>
              <select
                v-model="selectedTask.epic_id"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-semibold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option :value="null">Không thuộc Epic</option>
                <option v-for="epic in epicList" :key="epic.id" :value="epic.id">
                  ⚡ {{ epic.issue_key }} — {{ epic.title }}
                </option>
              </select>
            </div>

            <!-- Priority -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Độ Ưu Tiên (Priority)</label>
              <select
                v-model="selectedTask.priority"
                @change="saveTaskDrawerChanges"
                :class="[
                  'w-full border rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 shadow-xs font-bold',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
                ]"
              >
                <option value="urgent">🔴 Khẩn cấp (Urgent)</option>
                <option value="high">🟠 Ưu tiên cao (High)</option>
                <option value="medium">🟡 Bình thường (Medium)</option>
                <option value="low">⚪ Thấp (Low)</option>
              </select>
            </div>

            <!-- Due Date -->
            <div class="space-y-1.5">
              <label :class="['font-mono text-xs font-bold uppercase block', isDarkMode ? 'text-slate-300' : 'text-slate-700']">Hạn Chót (Due Date)</label>
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
                <span v-if="isAgentRunsLoading" class="text-[10px] text-slate-500">Đang tải…</span>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <button v-for="provider in ['codex', 'claude_code', 'antigravity']" :key="provider" @click="startAgentRun(provider)" class="rounded-lg border px-2 py-2 text-[10px] font-bold cursor-pointer hover:border-blue-500" :class="isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'">
                  {{ provider === 'claude_code' ? 'Claude' : provider === 'antigravity' ? 'Antigravity' : 'Codex' }}
                </button>
              </div>
              <p v-if="agentRunFeedback" class="text-[11px] leading-relaxed text-blue-600 dark:text-blue-300">{{ agentRunFeedback }}</p>
              <div v-for="run in selectedAgentRuns" :key="run.id" :class="['rounded-xl border p-3 space-y-2', isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white']">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-bold">{{ run.provider }}</span>
                  <span class="rounded-full border px-2 py-0.5 font-mono text-[10px]">{{ run.status }}</span>
                </div>
                <p v-if="run.branch || run.commit_sha" class="font-mono text-[10px] text-slate-500 truncate">{{ run.branch || 'no branch' }} · {{ run.commit_sha || 'no commit' }}</p>
                <p v-if="run.summary" class="text-[11px] leading-relaxed text-slate-500">{{ run.summary }}</p>
                <a v-if="run.pull_request_url" :href="run.pull_request_url" target="_blank" rel="noreferrer" class="text-[11px] text-blue-600 underline">Mở Pull Request</a>
                <div v-if="run.evidence?.length" class="space-y-1">
                  <p v-for="item in run.evidence" :key="item.id" class="text-[10px]" :class="item.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'">{{ item.status === 'passed' ? '✓' : '!' }} {{ item.evidence_type }}{{ item.command ? ` · ${item.command}` : '' }}</p>
                </div>
              </div>
              <p v-if="!selectedAgentRuns.length && !isAgentRunsLoading" class="text-[11px] text-slate-500">Chưa có agent run. Chọn provider để tạo một run có audit trail.</p>
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
          <h3 class="font-bold text-sm">⚡ Tạo Sprint Scrum Mới</h3>
          <button @click="showSprintModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Tên Sprint</label>
            <input
              v-model="sprintForm.name"
              placeholder="VD: Sprint 1 — Triển Khai Tính Năng"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Mục Tiêu (Goal)</label>
            <textarea
              v-model="sprintForm.goal"
              rows="3"
              placeholder="Mục tiêu sprint..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
          <button @click="handleSaveSprint" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Tạo Sprint</button>
        </div>
      </div>
    </div>

    <!-- Modal: Start Sprint -->
    <div v-if="showStartSprintModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-blue-500/50 text-white' : 'bg-white border-blue-300 text-slate-950']">
        <h3 class="font-bold text-sm">🚀 Bắt Đầu Sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">Sprint sẽ được chuyển sang trạng thái <strong>ACTIVE</strong>.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showStartSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
          <button @click="confirmStartSprint" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Bắt Đầu ▶</button>
        </div>
      </div>
    </div>

    <!-- Modal: Complete Sprint -->
    <div v-if="showCompleteSprintModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-emerald-500/50 text-white' : 'bg-white border-emerald-300 text-slate-950']">
        <h3 class="font-bold text-sm">🏁 Hoàn Thành Sprint: {{ targetSprintForAction?.name }}</h3>
        <p :class="['text-xs font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600']">Các task chưa xong sẽ được tự động chuyển về <strong>Backlog</strong> an toàn.</p>
        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showCompleteSprintModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
          <button @click="confirmCompleteSprint" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">Hoàn Thành ✓</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create Task -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-lg border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">✨ Tạo Task Mới</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Tiêu Đề Task *</label>
            <input
              v-model="newTaskForm.title"
              placeholder="VD: Cập nhật giao diện High Contrast"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Loại Issue</label>
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
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Mô Tả</label>
            <textarea
              v-model="newTaskForm.description"
              rows="3"
              placeholder="Chi tiết công việc..."
              :class="['w-full p-2.5 rounded-xl border focus:outline-none font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            ></textarea>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showCreateModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
          <button @click="handleCreateTask" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Tạo Task</button>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Project -->
    <div v-if="showProjectModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div :class="['w-full max-w-md border rounded-3xl p-6 shadow-2xl space-y-4', isDarkMode ? 'bg-[#0a0f1d] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950']">
        <div :class="['flex items-center justify-between pb-3 border-b', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <h3 class="font-bold text-sm">
            {{ projectModalMode === 'create' ? 'Tạo Dự Án Mới' : 'Chỉnh Sửa Dự Án' }}
          </h3>
          <button @click="showProjectModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div v-if="projectModalMode === 'create'" class="space-y-3">
            <div v-if="!props.auth?.user" class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <p class="font-bold">Cần xác thực GitHub</p>
              <p class="mt-1 text-[11px]">Đăng nhập GitHub để cấp quyền và chọn repository tạo dự án.</p>
              <a href="/auth/github" class="mt-3 inline-block rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white">Đăng nhập GitHub</a>
            </div>
            <template v-else>
              <input v-model="githubRepositorySearch" placeholder="Tìm repository GitHub..." :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
              <div v-if="isGithubRepositoriesLoading" class="rounded-xl border p-4 text-center text-slate-500">Đang tải repository…</div>
              <div v-else class="max-h-56 space-y-2 overflow-y-auto pr-1">
                <button v-for="repo in filteredGithubRepositories" :key="repo.id" type="button" @click="selectedGithubRepository = repo" :class="['w-full rounded-xl border p-3 text-left', selectedGithubRepository?.id === repo.id ? 'border-blue-500 bg-blue-50 text-blue-950' : (isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')]">
                  <div class="flex items-center justify-between gap-2"><span class="font-bold">{{ repo.full_name }}</span><span class="text-[10px]">{{ repo.private ? 'Private' : 'Public' }}</span></div>
                  <p class="mt-1 line-clamp-2 text-[11px] text-slate-500">{{ repo.description || 'Không có mô tả' }}</p>
                  <span class="text-[10px] text-slate-500">{{ repo.default_branch || 'main' }} · {{ repo.language || 'Unknown' }}</span>
                </button>
                <p v-if="!filteredGithubRepositories.length" class="p-4 text-center text-slate-500">Không tìm thấy repository.</p>
              </div>
              <div v-if="selectedGithubRepository" class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">Đã chọn <strong>{{ selectedGithubRepository.full_name }}</strong>.</div>
            </template>
          </div>
          <div v-if="projectModalMode === 'edit'">
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Tên Dự Án *</label>
            <input
              v-model="projectForm.title"
              placeholder="VD: Mobile App 2026"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-medium', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div v-if="projectModalMode === 'edit'">
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Mã Key Dự Án (2-5 ký tự)</label>
            <input
              v-model="projectForm.key"
              placeholder="VD: APP"
              :class="['w-full p-2.5 rounded-xl border font-mono uppercase focus:outline-none focus:border-blue-500 font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            />
          </div>

          <div>
            <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Phân Loại</label>
            <select
              v-model="projectForm.type"
              :class="['w-full p-2.5 rounded-xl border focus:outline-none font-bold', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
            >
              <option value="work">💼 Công Việc (Work)</option>
              <option value="personal">👤 Cá Nhân (Personal)</option>
            </select>
          </div>

          <div v-if="projectModalMode === 'edit'" :class="['pt-3 mt-3 border-t space-y-3', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-bold text-xs">Kết nối riêng cho Project</h4>
                <p class="text-[10px] text-slate-500">Cấu hình này không dùng chung với project khác.</p>
              </div>
              <span v-if="projectGithubStatus?.connected" class="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">GitHub {{ projectGithubStatus.sync_status }}</span>
            </div>
            <input v-model="projectForm.github_repository" placeholder="GitHub repository: owner/repository" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-mono text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_default_branch" placeholder="Default branch: main" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 font-mono text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.github_webhook_secret" type="password" autocomplete="new-password" placeholder="Webhook secret riêng của repo này" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <input v-model="projectForm.task_hub_mcp_token" type="password" autocomplete="new-password" placeholder="MCP token riêng cho agent của project" :class="['w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 text-xs', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']" />
            <div class="flex flex-wrap gap-3 text-[10px] text-slate-500">
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_github_token" type="checkbox" /> Xóa GitHub token</label>
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_github_webhook_secret" type="checkbox" /> Xóa webhook secret</label>
              <label class="flex items-center gap-1"><input v-model="projectForm.clear_task_hub_mcp_token" type="checkbox" /> Xóa MCP token</label>
            </div>
            <div v-if="projectModalMode === 'edit'" class="flex items-center justify-between gap-2">
              <span class="text-[10px] text-slate-500">{{ projectGithubStatus?.last_sync_at ? `Sync lần cuối: ${projectGithubStatus.last_sync_at}` : 'Chưa sync dữ liệu GitHub' }}</span>
              <button @click="syncProjectGithub" :disabled="isProjectGithubSyncing || !projectForm.github_repository" class="rounded-lg border border-blue-300 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 disabled:opacity-50">{{ isProjectGithubSyncing ? 'Đang sync…' : 'Sync GitHub' }}</button>
            </div>
            <p v-if="projectGithubFeedback" class="text-[10px] text-blue-600">{{ projectGithubFeedback }}</p>
          </div>
        </div>

        <div :class="['flex justify-end gap-2 pt-2 border-t', isDarkMode ? 'border-slate-800' : 'border-slate-200']">
          <button @click="showProjectModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
          <button @click="handleSaveProject" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Lưu Dự Án</button>
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
                <h3 class="font-bold text-base sm:text-lg font-display">AI Lập Kế Hoạch & Tự Động Phân Rã Dự Án</h3>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  SMART SCRUM ENGINE
                </span>
              </div>
              <p :class="['text-xs mt-0.5 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                {{ aiGeneratorStep === 'input' ? 'Bước 1: Nhập yêu cầu dự án hoặc chọn mẫu gợi ý' : 'Bước 2: Xem trước, tùy chỉnh và xác nhận tạo Sprints & Tasks' }}
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
              Mô tả yêu cầu dự án / tính năng *
            </label>
            <textarea
              v-model="aiForm.prompt"
              rows="4"
              placeholder="VD: Xây dựng hệ thống thương mại điện tử tích hợp cổng thanh toán VNPay, giỏ hàng, thông báo realtime và dashboard phân tích doanh thu..."
              :class="[
                'w-full p-3.5 rounded-2xl border text-xs focus:outline-none focus:border-indigo-500 shadow-xs font-medium leading-relaxed',
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              ]"
            ></textarea>
          </div>

          <!-- Quick Templates Picker -->
          <div class="space-y-2">
            <label :class="['font-mono text-[11px] font-bold uppercase tracking-wider block', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
              💡 Mẫu yêu cầu dự án phổ biến (Bấm để điền nhanh)
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
                  <span class="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 font-bold">Chọn ➔</span>
                </div>
                <div :class="['text-[11px] line-clamp-2', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                  {{ tpl.prompt }}
                </div>
              </button>
            </div>
          </div>

          <!-- Config Form: Project, Sprints, Duration, Start Date -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <!-- Target Project -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Dự Án Đích</label>
              <select
                v-model="aiForm.project_id"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option value="new">✨ Tự tạo dự án mới</option>
                <option v-for="proj in projects" :key="proj.id" :value="proj.id">
                  📁 {{ proj.title }}
                </option>
              </select>
            </div>

            <!-- Sprint Count -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Số Lượng Sprint</label>
              <select
                v-model="aiForm.sprint_count"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option :value="1">1 Sprint (Quick MVP)</option>
                <option :value="2">2 Sprints (MVP + Core)</option>
                <option :value="3">3 Sprints (Chuẩn Scrum)</option>
                <option :value="4">4 Sprints (Dự án lớn)</option>
              </select>
            </div>

            <!-- Sprint Duration -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Thời Lượng Mỗi Sprint</label>
              <select
                v-model="aiForm.sprint_duration_weeks"
                :class="['w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none', isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-950']"
              >
                <option :value="1">1 Tuần / Sprint</option>
                <option :value="2">2 Tuần / Sprint (Chuẩn)</option>
                <option :value="3">3 Tuần / Sprint</option>
              </select>
            </div>

            <!-- Start Date -->
            <div>
              <label :class="['font-mono text-[10px] font-bold uppercase block mb-1', isDarkMode ? 'text-slate-400' : 'text-slate-700']">Ngày Bắt Đầu</label>
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
                <strong class="text-blue-600 font-bold">{{ aiGeneratedPlan.sprints?.length || 0 }}</strong> Sprints
              </span>
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-purple-600 font-bold">{{ aiGeneratedPlan.summary?.total_tasks || 0 }}</strong> Tasks
              </span>
              <span :class="['px-3 py-1.5 rounded-xl border font-bold', isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-xs']">
                <strong class="text-emerald-600 font-bold">{{ aiGeneratedPlan.summary?.total_story_points || 0 }}</strong> Story Pts
              </span>
            </div>
          </div>

          <!-- Sprints & Tasks Hierarchy List -->
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
                  {{ sprint.tasks?.length || 0 }} tasks • {{ sprint.tasks?.reduce((acc: number, t: any) => acc + (Number(t.story_points) || 0), 0) }} pts
                </span>
              </div>

              <div class="text-xs italic text-slate-500 font-medium">
                🎯 Mục tiêu: {{ sprint.goal }}
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
                      <span class="text-sm">{{ getIssueTypeBadge(task.issue_type).icon }}</span>
                      <input
                        v-model="task.title"
                        :class="['font-semibold text-xs bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1 min-w-0', isDarkMode ? 'text-slate-100' : 'text-slate-950']"
                      />
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
                        <option value="urgent">🔴 Khẩn cấp</option>
                        <option value="high">🟠 Ưu tiên</option>
                        <option value="medium">🟡 Bình thường</option>
                        <option value="low">⚪ Thấp</option>
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
            ← Quay Lại Nhập
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
              Hủy
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
              <span>{{ isAiAnalyzing ? 'Đang Phân Tích & Sinh Kế Hoạch...' : 'Phân Rã Dự Án Bằng AI' }}</span>
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
              <span>{{ isAiCommitting ? 'Đang Lưu Vào Database...' : 'Tạo Sprints & Tasks Vào Dự Án' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- DAILY REVIEW MODAL -->
    <div v-if="showDailyReview" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" @click.self="showDailyReview = false">
      <div :class="['w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-5', isDarkMode ? 'bg-[#0b101e] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-950']">
        <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><div><p class="text-[10px] font-mono uppercase text-indigo-500 font-bold">Daily Review</p><h2 class="text-lg font-bold">Kết thúc ngày</h2></div><button @click="showDailyReview = false" class="text-slate-400 font-bold cursor-pointer">✕</button></div>
        <div v-if="isDailyLoading" class="py-8 text-center text-slate-500 text-xs">Đang tổng kết...</div>
        <div v-else-if="dailyReviewData" class="space-y-4 text-xs">
          <div class="grid grid-cols-3 gap-2"><div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"><strong class="block text-xl text-emerald-600">{{ dailyReviewData.completed_tasks?.length || 0 }}</strong><span>Hoàn thành</span></div><div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"><strong class="block text-xl text-amber-600">{{ dailyReviewData.incompleted_tasks?.length || 0 }}</strong><span>Còn lại</span></div><div class="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"><strong class="block text-xl text-indigo-600">{{ dailyReviewData.total_pomodoros_done || 0 }}</strong><span>Pomodoros</span></div></div>
          <div><h3 class="font-bold mb-2">Việc chưa xong</h3><div v-if="dailyReviewData.incompleted_tasks?.length" class="space-y-1.5 max-h-48 overflow-y-auto"><button v-for="task in dailyReviewData.incompleted_tasks" :key="task.id" @click="showDailyReview = false; openTaskDrawer(task)" class="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 cursor-pointer"><span class="font-mono text-[10px] text-slate-500">{{ task.issue_key }}</span> · <span class="font-medium">{{ task.title }}</span></button></div><p v-else class="text-emerald-600 font-medium">✓ Bạn đã xử lý hết việc trọng tâm hôm nay.</p></div>
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
          <label class="block"><span class="block mb-1 font-bold">API key <span v-if="aiSettings.has_api_key" class="text-emerald-600">(đã lưu)</span></span><input v-model="aiSettings.api_key" type="password" autocomplete="new-password" class="w-full p-2.5 rounded-xl border bg-transparent" placeholder="Để trống nếu không muốn thay đổi" /></label>
          <p class="text-[11px] text-slate-500">Key được mã hóa ở server và không bao giờ trả về trình duyệt. Nếu provider lỗi, hệ thống tự dùng template offline.</p>
        </div>
        <div class="flex justify-end gap-2 border-t pt-3" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><button @click="showAiSettingsModal = false" class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">Hủy</button><button @click="saveAiSettings" :disabled="isAiSettingsSaving" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{{ isAiSettingsSaving ? 'Đang lưu...' : 'Lưu cài đặt' }}</button></div>
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
                Cài Đặt Email Báo Cáo Tuần (Executive Report)
              </h2>
              <p :class="['text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
                Tổng hợp KPIs, Story Points và tiến độ dự án gửi đến Sếp & Quản Lý.
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
          <span>Đang tải cấu hình báo cáo email...</span>
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
                  Tự động gửi email báo cáo hàng tuần
                </div>
                <div :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                  Hệ thống sẽ tự động quét tiến độ và gửi báo cáo theo đúng ngày & giờ đã chọn.
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
              Danh sách Email người nhận (Sếp / PM / Khách hàng) <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="reportForm.recipients"
              rows="2"
              placeholder="ví dụ: boss@company.com, ceo@company.com, manager@company.com"
              :class="[
                'w-full border rounded-xl p-3 focus:outline-none focus:border-blue-500 font-mono text-xs shadow-xs',
                isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              ]"
            ></textarea>
            <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
              💡 Phân tách nhiều địa chỉ email bằng dấu phẩy (<strong class="font-mono">,</strong>).
            </p>
          </div>

          <!-- 3. Schedule Timing (Day & Time) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                Ngày gửi trong tuần
              </label>
              <select
                v-model="reportForm.day_of_week"
                :class="[
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-semibold shadow-xs',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="monday">📅 Thứ Hai (Gợi ý: Khởi động tuần mới)</option>
                <option value="tuesday">📅 Thứ Ba</option>
                <option value="wednesday">📅 Thứ Tư</option>
                <option value="thursday">📅 Thứ Năm</option>
                <option value="friday">📅 Thứ Sáu (Gợi ý: Tổng kết tuần làm việc)</option>
                <option value="saturday">📅 Thứ Bảy</option>
                <option value="sunday">📅 Chủ Nhật (Chuẩn bị tuần mới)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                Khung giờ gửi
              </label>
              <select
                v-model="reportForm.send_time"
                :class="[
                  'w-full border rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-semibold font-mono shadow-xs',
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                ]"
              >
                <option value="07:30">⏰ 07:30 AM</option>
                <option value="08:00">⏰ 08:00 AM (Chuẩn đầu giờ làm)</option>
                <option value="08:30">⏰ 08:30 AM</option>
                <option value="09:00">⏰ 09:00 AM</option>
                <option value="17:00">⏰ 17:00 PM (Cuối giờ chiều)</option>
                <option value="18:00">⏰ 18:00 PM</option>
                <option value="20:00">⏰ 20:00 PM</option>
              </select>
            </div>
          </div>

          <!-- 4. Report Title -->
          <div>
            <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
              Tiêu đề Email Báo Cáo
            </label>
            <input
              v-model="reportForm.report_title"
              type="text"
              placeholder="Báo Cáo Tiến Độ Công Việc & Dự Án Hàng Tuần"
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
                  Phạm vi dự án (Chọn nhiều dự án gộp vào báo cáo)
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
                  📁 Tất Cả Dự Án
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
                  <span>{{ p.type === 'work' ? '💼' : '👤' }} {{ p.title }}</span>
                  <span v-if="isReportProjectSelected(p.id)" class="text-[11px] font-bold">✓</span>
                </button>
              </div>
              <p :class="['text-[11px] mt-1', isDarkMode ? 'text-slate-400' : 'text-slate-500']">
                💡 Báo cáo sẽ tổng hợp các task hoàn thành, sprint và cảnh báo thuộc các dự án được chọn (hoặc toàn bộ dự án nếu chọn "Tất Cả").
              </p>
            </div>

            <div class="flex flex-wrap gap-4 pt-1">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_upcoming" class="w-4 h-4 rounded text-blue-600" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Bao gồm kế hoạch tuần tới (Next Week Focus)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="reportForm.include_warnings" class="w-4 h-4 rounded text-blue-600" />
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Bao gồm cảnh báo task trễ hạn (Risk Alerts)</span>
              </label>
            </div>
          </div>

          <!-- Last Sent Status -->
          <div
            v-if="reportForm.last_sent_at"
            :class="['p-3 rounded-xl border text-[11px] font-mono flex items-center justify-between', isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600']"
          >
            <span>🕒 Lần gửi thành công gần nhất:</span>
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
            title="Gửi ngay một bản email báo cáo mẫu đến danh sách email đã nhập"
          >
            <span v-if="isReportSending" class="animate-spin">⏳</span>
            <span v-else>🚀</span>
            <span>{{ isReportSending ? 'Đang Gửi Báo Cáo...' : 'Gửi Thử Báo Cáo Ngay' }}</span>
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
              Đóng
            </button>

            <button
              @click="handleSaveReportSettings"
              :disabled="isReportSaving || isReportLoading"
              class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isReportSaving" class="animate-spin">⏳</span>
              <span v-else>✓</span>
              <span>{{ isReportSaving ? 'Đang Lưu...' : 'Lưu Cài Đặt' }}</span>
            </button>
          </div>
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
            BẢO MẬT TASKS WORKSPACE
          </h2>
          <p :class="['text-xs mt-1 font-medium', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
            Nhập mã PIN <strong class="text-blue-600 dark:text-blue-400 font-mono font-bold">6 chữ số</strong> để mở khóa không gian làm việc.
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
            XÓA
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
            ← Về Trang Chủ
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
            <span>MỞ KHÓA</span>
            <span>🔓</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
