<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ProjectItem, TaskItem } from '../composables/useTaskSync';
import MacatungIcon from './MacatungIcon.vue';
import MonacoEditorView from './MonacoEditorView.vue';
import AntigravitySkillsModal from './AntigravitySkillsModal.vue';
import AntigravityScheduledTasksModal from './AntigravityScheduledTasksModal.vue';
import AntigravitySettingsPermissionsModal from './AntigravitySettingsPermissionsModal.vue';
import MarkdownView from './MarkdownView.vue';
import { ansiToHtml, stripAnsiToPlainText, escapeHtml } from '../utils/ansi';
import { parseDiscoveryPlan, serializeDiscoveryPlanContract } from '../utils/discoveryPlan';
import { buildInitialRequest, consumePendingUserEcho, normalizeConversationText } from '../utils/conversation';
declare global {
  interface Window {
    desktopApi?: any;
  }
}

const props = withDefaults(
  defineProps<{
    tasks: TaskItem[];
    projects?: ProjectItem[];
    initialTask?: TaskItem | null;
    isConnected?: boolean;
    desktopCredential?: { taskHubUrl: string; token: string; projectId: string } | null;
    isStandalone?: boolean;
  }>(),
  {
    isStandalone: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fullscreen-change', value: boolean): void;
  (e: 'switch-mode', mode: 'mascot'): void;
}>();

type Phase = 'select' | 'preflight' | 'pairing' | 'context' | 'ready' | 'running' | 'handoff' | 'review' | 'error';
type Provider = 'codex' | 'claude_code' | 'antigravity';

type ModelOption = {
  id: string;
  name: string;
  badges: string[];
  badge?: string;
  description?: string;
  source?: 'preset' | 'hub' | 'cli' | 'custom';
};

const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  antigravity: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badges: ['High', 'Fast'], description: 'Latest generation model, optimized for speed and agentic reasoning' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badges: ['Medium', 'Fast'], description: 'Balanced high speed and reasoning capabilities' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', badges: ['Medium', 'Fast'], description: 'Fast response for standard coding tasks' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badges: ['Low'], description: 'Standard model for lightweight tasks' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Thinking'], description: 'Extended reasoning and deep source code architecture analysis' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Thinking'], description: 'Premier analysis model for complex problems' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: 'High-performance 120B open-weights model' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badges: ['Recommended', '1M+ Context'], description: 'DeepMind flagship model, 1M+ context window' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badges: ['Fast & Smart'], description: 'High speed with exceptional reasoning capabilities' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', badges: ['Ultra Fast'], description: 'Instant response for repetitive tasks' },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro Exp', badges: ['Experimental'], description: 'Experimental model for algorithms and code generation' },
    { id: 'default', name: 'IDE / CLI Default', badges: ['Default'], description: 'Default Antigravity configuration' },
  ],
  claude_code: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', badges: ['High', 'Recommended'], description: 'Top optimization for coding, architecture & hybrid reasoning' },
    { id: 'claude-3-7-sonnet-thinking', name: 'Claude 3.7 (Thinking)', badges: ['High', 'Thinking'], description: 'Enables extended thinking for complex refactoring' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Next-Gen', 'Thinking'], description: 'Next-gen Sonnet model optimized for agentic workflows' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Deep Analysis', 'Thinking'], description: 'Large system analysis & complex logic structures' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (v2)', badges: ['Balanced', 'Fast'], description: 'Stable industry-standard coding model' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', badges: ['Super Fast'], description: 'Super fast speed for small tasks and light refactoring' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', badges: ['Deep Analysis'], description: 'Large system analysis & complex problems' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Claude Code CLI configuration' },
  ],
  codex: [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', badges: ['High', 'Flagship'], description: 'Flagship GPT-5.6 model for reasoning, research & agentic coding' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', badges: ['Medium', 'Fast'], description: 'Balanced intelligence and speed for production workloads' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badges: ['Low', 'Ultra Fast'], description: 'Lightweight model optimized for speed and cost efficiency at scale' },
    { id: 'gpt-5.6-cyber', name: 'GPT-5.6 Cyber', badges: ['Specialized', 'Security'], description: 'Specialized model for security analysis & source code audits' },
    { id: 'o3-pro', name: 'o3-pro', badges: ['High', 'Deep Reasoning'], description: 'Deep extended reasoning for challenging architecture & algorithmic problems' },
    { id: 'o3', name: 'o3', badges: ['High', 'Reasoning'], description: 'Powerful multi-step reasoning model from the o-series' },
    { id: 'o3-mini', name: 'o3-mini', badges: ['Fast Reasoning', 'High'], description: 'High-level logical reasoning with rapid response times' },
    { id: 'gpt-5', name: 'GPT-5 (Foundational)', badges: ['High', 'Foundational'], description: 'Foundational model of the GPT-5 generation' },
    { id: 'gpt-4.1', name: 'GPT-4.1', badges: ['Balanced', 'Fast'], description: 'High-performance version optimized for daily coding tasks' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', badges: ['Ultra Fast'], description: 'Ultra-lightweight model with high execution speed' },
    { id: 'o1', name: 'o1', badges: ['Deep Reasoning'], description: 'Step-by-step reasoning for complex problem solving' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', badges: ['High Quality', 'Large Context'], description: 'Deep context comprehension and complex architecture understanding' },
    { id: 'gpt-4o', name: 'GPT-4o', badges: ['Omni', 'Fast'], description: 'Balanced execution speed and output quality' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', badges: ['Ultra Fast'], description: 'Compact model with high execution speed' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: '120B-parameter open-weights model' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Codex CLI configuration' },
  ],
};

const phase = ref<Phase>('select');
const provider = ref<Provider>('codex');
const isFullscreen = ref(false);
const modelSearchQuery = ref('');
const modelsState = ref<Record<Provider, ModelOption[]>>({
  antigravity: [...PROVIDER_MODELS.antigravity],
  claude_code: [...PROVIDER_MODELS.claude_code],
  codex: [...PROVIDER_MODELS.codex],
});
const isSyncingModels = ref(false);
const modelSyncTimestamp = ref<string | null>(null);
const modelSyncSource = ref<'preset' | 'live' | 'cache'>('preset');

const selectedModels = ref<Record<Provider, string>>({
  codex: 'gpt-5.6-sol',
  claude_code: 'claude-3-7-sonnet-20250219',
  // Recent AGY CLI versions require an explicit reasoning tier. The generic
  // `gemini-3.7-flash` ID is retained only as a migration alias in main.ts.
  antigravity: 'gemini-3.7-flash-high',
});
const customModelInput = ref<Record<Provider, string>>({
  codex: '',
  claude_code: '',
  antigravity: '',
});
const isCustomModel = ref<Record<Provider, boolean>>({
  codex: false,
  claude_code: false,
  antigravity: false,
});

const LEGACY_AGY_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.7-flash': 'gemini-3.7-flash-high',
  'gemini-3.6-flash': 'gemini-3.6-flash-medium',
  'gemini-3.5-flash': 'gemini-3.5-flash-medium',
};

const migrateLegacyAgySelection = () => {
  const selected = selectedModels.value.antigravity;
  if (LEGACY_AGY_MODEL_ALIASES[selected]) {
    selectedModels.value.antigravity = LEGACY_AGY_MODEL_ALIASES[selected];
    isCustomModel.value.antigravity = false;
  }
  const custom = customModelInput.value.antigravity;
  if (LEGACY_AGY_MODEL_ALIASES[custom]) {
    customModelInput.value.antigravity = LEGACY_AGY_MODEL_ALIASES[custom];
  }
};

const sourceWorkspace = ref(localStorage.getItem('task_companion_agent_workspace') || '');
const savedWorkspaces = ref<string[]>([]);
const worktree = ref('');
const taskId = ref<number | null>(props.initialTask?.id || null);
const taskSearch = ref('');
const setupState = ref<any>(null);
const setupBusy = ref(false);
const docsOnly = ref(false);
type WorkflowMode = 'task' | 'docs' | 'discovery';
const workflowMode = ref<WorkflowMode>('task');
const docsProjectId = ref<number | null>(null);
const requirementText = ref('');
const conversationDraft = ref('');
const pendingInitialRequest = ref('');
const pendingUserEchoes = ref<string[]>([]);
const showAdvancedTools = ref(false);
const showAgentSettings = ref(false);
const showActivityTimeline = ref(false);
const showProcessDrawer = ref(false);

const taskHubUrl = ref(localStorage.getItem('task_hub_base_url') || 'https://task-hub.macatung.dev');
const credential = ref<{ token: string; projectId: string } | null>(null);
const contextPack = ref<any>(null);
const runId = ref<number | null>(null);
const sessionId = ref<string | null>(null);

// Stream & Event Cards State
type StreamCard = {
  id: string;
  type: 'agent_message' | 'command_execution' | 'tool_execution' | 'user_message' | 'turn_completed' | 'thought' | 'info';
  text?: string;
  thought?: string;
  command?: string;
  toolName?: string;
  toolParameters?: any;
  output?: string;
  status?: string;
  exitCode?: number | null;
  duration?: string;
  expanded?: boolean;
  usage?: { input_tokens: number; output_tokens: number; cached_input_tokens?: number; total_tokens?: number };
  time: string;
};

const streamCards = ref<StreamCard[]>([]);
const viewMode = ref<'cards' | 'terminal'>('cards');
const rawOutput = ref('');
const terminalHtml = ref('');
const plainOutput = ref('');
const logSearchQuery = ref('');
const autoScroll = ref(true);
const streamContainer = ref<HTMLElement | null>(null);
const terminalContainer = ref<HTMLElement | null>(null);
const isScrolledUp = ref(false);
const followUp = ref('');
const errorMessage = ref('');
const preflight = ref<any>(null);
const timeline = ref<Array<{ id: string; label: string; detail: string; tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'muted'; time: string }>>([]);

// Collapsible sidebar sections
const collapsed = ref({
  model: true,
  workspace: true,
  tasks: true,
  docs: true,
  timeline: true,
});

// Running Timer State
const runDurationSeconds = ref(0);
let durationTimer: ReturnType<typeof setInterval> | undefined;

// Structured Handoff State
const handoff = ref({
  summary: '',
  changedFiles: '',
  tests: 'npm test',
  testStatus: 'passed',
  testSummary: '',
  commitSha: '',
  pullRequestUrl: '',
  blockers: '',
});

let pollTimer: ReturnType<typeof setInterval> | undefined;
let renderTimer: ReturnType<typeof setTimeout> | undefined;
let removeOutput: (() => void) | undefined;
let removeExit: (() => void) | undefined;

const STORAGE_KEY = 'task_companion_agent_workspace_state_v2';

const localTasks = ref<TaskItem[]>([]);
const allTasks = computed(() => localTasks.value.length ? localTasks.value : props.tasks);
const selectedTask = computed(() => allTasks.value.find((task) => task.id === taskId.value) || null);
const selectedDocsProject = computed(() => props.projects?.find((project) => project.id === docsProjectId.value) || null);
const conversationCards = computed(() => streamCards.value.filter((card) => card.type === 'user_message' || card.type === 'agent_message' || card.type === 'turn_completed' || card.type === 'thought'));
const processCards = computed(() => streamCards.value.filter((card) => card.type === 'command_execution' || card.type === 'tool_execution'));
const activeProcessCard = computed(() => {
  return [...processCards.value].reverse().find((card) => card.status === 'in_progress')
    || (phase.value === 'running' && processCards.value.length ? processCards.value[processCards.value.length - 1] : null);
});
const isAgentWorking = computed(() => phase.value === 'running');
const activeWorkingStatus = computed(() => {
  if (!isAgentWorking.value) return '';
  if (activeProcessCard.value) {
    if (activeProcessCard.value.type === 'tool_execution') {
      const tool = activeProcessCard.value.toolName || 'tool';
      const cmd = activeProcessCard.value.command ? ` · ${activeProcessCard.value.command}` : '';
      return `Executing tool: ${tool}${cmd}`;
    }
    if (activeProcessCard.value.type === 'command_execution') {
      return `Executing command: ${activeProcessCard.value.command || 'terminal'}`;
    }
  }
  return 'Local agent is reading context and preparing response…';
});
const composerPlaceholder = computed(() => {
  if (phase.value === 'running') return `Agent processing turn (${formattedDuration.value})… You can send additional notes`;
  if (workflowMode.value === 'discovery') return 'What would you like to build or change?';
  if (workflowMode.value === 'task') return selectedTask.value ? 'Additional notes for this task (optional)…' : 'Select a task from the left sidebar first.';
  return 'Scope documentation scan (optional)…';
});
const composerActionLabel = computed(() => phase.value === 'running' ? 'Send' : phase.value === 'ready' && workflowMode.value === 'task' ? 'Launch Agent' : workflowMode.value === 'discovery' ? 'Analyze' : workflowMode.value === 'docs' ? 'Generate Docs' : 'Prepare Task');

watch(
  () => props.projects,
  (projects) => {
    if (!docsProjectId.value && projects?.length) {
      docsProjectId.value = props.desktopCredential?.projectId !== 'all'
        ? Number(props.desktopCredential?.projectId)
        : projects[0].id;
    }
  },
  { immediate: true }
);

const selectWorkflowMode = (mode: WorkflowMode) => {
  workflowMode.value = mode;
  docsOnly.value = mode === 'docs';
  errorMessage.value = '';
  activeEditorTab.value = 'terminal';
  showAdvancedTools.value = false;
  if (mode === 'docs') {
    docsProjectId.value ||= selectedTask.value?.project_id || (props.desktopCredential?.projectId !== 'all' ? Number(props.desktopCredential?.projectId) : null) || props.projects?.[0]?.id || null;
    collapsed.value.workspace = false;
    collapsed.value.docs = false;
  } else if (mode === 'discovery') {
    docsProjectId.value ||= selectedTask.value?.project_id || (props.desktopCredential?.projectId !== 'all' ? Number(props.desktopCredential?.projectId) : null) || props.projects?.[0]?.id || null;
    collapsed.value.workspace = false;
  } else {
    collapsed.value.tasks = false;
  }
};

const activeModel = computed<string>(() => {
  if (isCustomModel.value[provider.value] && customModelInput.value[provider.value]?.trim()) {
    return customModelInput.value[provider.value].trim();
  }
  return selectedModels.value[provider.value] || 'default';
});

const currentModelOption = computed(() => {
  const list = modelsState.value[provider.value] || PROVIDER_MODELS[provider.value] || [];
  return list.find((m) => m.id === activeModel.value) || null;
});

const filteredProviderModels = computed(() => {
  const list = modelsState.value[provider.value] || PROVIDER_MODELS[provider.value] || [];
  const q = modelSearchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) =>
    m.name.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    (m.badges && m.badges.some((b) => b.toLowerCase().includes(q)))
  );
});

const activeModelLabel = computed(() => {
  if (isCustomModel.value[provider.value] && customModelInput.value[provider.value]?.trim()) {
    return customModelInput.value[provider.value].trim();
  }
  return currentModelOption.value?.name || activeModel.value;
});

const activeModelBadge = computed(() => {
  if (isCustomModel.value[provider.value]) return 'Custom';
  if (currentModelOption.value?.badges?.length) return currentModelOption.value.badges[0];
  return currentModelOption.value?.badge || 'Model';
});

const getBadgeClass = (badge: string) => {
  const b = badge.toLowerCase();
  if (b.includes('high') || b.includes('flagship') || b.includes('foundational')) return 'bg-[#1b3a24] border-[#276738] text-[#73c991]';
  if (b.includes('fast') || b.includes('ultra')) return 'bg-[#1b2f3f] border-[#234c6b] text-[#70b8ff]';
  if (b.includes('thinking') || b.includes('reasoning')) return 'bg-[#31233f] border-[#4c3263] text-[#c59bee]';
  return 'bg-[#2d2d2d] border-[#3e3e42] text-[#cccccc]';
};

const saveWorkspaceState = () => {
  try {
    const payload = {
      phase: phase.value,
      provider: provider.value,
      model: activeModel.value,
      selectedModels: selectedModels.value,
      customModelInput: customModelInput.value,
      isCustomModel: isCustomModel.value,
      sourceWorkspace: sourceWorkspace.value,
      worktree: worktree.value,
      taskId: taskId.value,
      docsOnly: docsOnly.value,
      workflowMode: workflowMode.value,
      docsProjectId: docsProjectId.value,
      requirementText: requirementText.value,
      conversationDraft: conversationDraft.value,
      sessionId: sessionId.value,
      runId: runId.value,
      streamCards: streamCards.value,
      timeline: timeline.value,
      rawOutput: rawOutput.value,
      handoff: handoff.value,
      preflight: preflight.value,
      viewMode: viewMode.value,
      runDurationSeconds: runDurationSeconds.value,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    if (sessionId.value && window.desktopApi?.agent?.saveSessionState) {
      window.desktopApi.agent.saveSessionState({
        sessionId: sessionId.value,
        provider: provider.value,
        model: activeModel.value,
        sourceWorkspace: sourceWorkspace.value,
        worktree: worktree.value,
        taskId: taskId.value,
        taskTitle: selectedTask.value?.title || (workflowMode.value === 'discovery' ? 'Requirement Discovery' : docsOnly.value ? 'Repo Documentation (Docs)' : undefined),
        issueKey: selectedTask.value?.issue_key,
        mode: 'exec',
        kind: workflowMode.value === 'discovery' ? 'discovery' : docsOnly.value ? 'docs' : 'task',
        workflowMode: workflowMode.value,
        docsProjectId: docsProjectId.value,
        requirementText: requirementText.value,
        conversationDraft: conversationDraft.value,
        status: phase.value === 'running' ? 'running' : 'completed',
        streamCards: streamCards.value,
        timeline: timeline.value,
        output: rawOutput.value,
        handoff: handoff.value,
        durationSeconds: runDurationSeconds.value,
      });
    }
  } catch (e) {
    console.warn('Failed to save agent workspace state:', e);
  }
};

const addTimeline = (label: string, detail: string, tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'muted' = 'muted') => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  timeline.value.unshift({ id: `${Date.now()}-${Math.random()}`, label, detail, tone, time });
  if (timeline.value.length > 50) timeline.value.pop();
  const logWorkspace = worktree.value || sourceWorkspace.value;
  if (logWorkspace) {
    void window.desktopApi?.agent?.logActivity?.(logWorkspace, sessionId.value, { label, detail, tone });
  }
  saveWorkspaceState();
};

const TASKS_CACHE_KEY = 'task_companion_tasks_cache';
const loadCachedTasks = () => {
  try {
    const raw = localStorage.getItem(TASKS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        localTasks.value = parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading task cache:', e);
  }
};

const isRefreshingTasks = ref(false);
const refreshAgentTasks = async () => {
  if (isRefreshingTasks.value) return;
  isRefreshingTasks.value = true;
  try {
    const hubUrl = taskHubUrl.value || (credential.value as any)?.taskHubUrl || 'http://localhost:8000';
    const projId = credential.value?.projectId;
    const token = credential.value?.token;
    if (token && projId) {
      const url = `${hubUrl.replace(/\/$/, '')}/api/v1/desktop/tasks?status=todo,in_progress,review&project_id=${encodeURIComponent(projId)}`;
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Task-Hub-Project': projId,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          localTasks.value = json.data;
          try { localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(json.data)); } catch {}
          addTimeline('Tasks refreshed', `Synced ${json.data.length} latest tasks from Task Hub.`, 'ok');
        }
      } else if (res.status === 404 || res.status === 401) {
        loadCachedTasks();
      }
    } else {
      loadCachedTasks();
    }
  } catch (e: any) {
    console.warn('Error refreshing tasks, using fallback cache:', e);
    loadCachedTasks();
  } finally {
    isRefreshingTasks.value = false;
  }
};

const filteredTasks = computed(() => {
  const query = taskSearch.value.trim().toLowerCase();
  return allTasks.value.filter((task) => !query || [task.title, task.issue_key, task.project?.title].filter(Boolean).join(' ').toLowerCase().includes(query));
});

const busy = computed(() => ['preflight', 'pairing', 'context'].includes(phase.value));

const phaseLabel = computed(() => {
  const map: Record<Phase, string> = {
    select: 'Prepare',
    preflight: 'Preflight',
    pairing: 'Task Hub Pairing',
    context: 'Context & MCP Load',
    ready: 'Ready to Launch',
    running: workflowMode.value === 'discovery' ? 'Analyzing Requirements' : docsOnly.value ? 'Generating Docs' : 'Agent Running',
    handoff: 'Handoff & Review',
    review: 'Review Results',
    error: 'Action Required',
  };
  return map[phase.value];
});

const phaseTone = computed(() => {
  if (phase.value === 'error') return 'error';
  if (['ready', 'review'].includes(phase.value)) return 'success';
  if (['preflight', 'pairing', 'context', 'running'].includes(phase.value)) return 'active';
  return 'neutral';
});

const formattedDuration = computed(() => {
  const minutes = Math.floor(runDurationSeconds.value / 60);
  const seconds = runDurationSeconds.value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

const lineCount = computed(() => {
  if (!rawOutput.value) return 0;
  return (rawOutput.value.match(/\n/g) || []).length + 1;
});

const latestDiscoveryAgentMessage = computed(() => [...streamCards.value]
  .reverse()
  .find((card) => card.type === 'agent_message' && card.text?.trim())?.text || '');
const hasDiscoveryAgentResponse = computed(() => Boolean(latestDiscoveryAgentMessage.value.trim()));
const discoveryPlanResult = computed(() => parseDiscoveryPlan(latestDiscoveryAgentMessage.value));
const parsedDiscoveryPlan = computed(() => discoveryPlanResult.value.plan);
const discoveryPlanErrors = computed(() => discoveryPlanResult.value.errors);
const discoveryPlan = computed(() => parsedDiscoveryPlan.value || {
  summary: discoveryPlanErrors.value?.[0] || 'No valid plan generated.',
  assumptions: [] as string[],
  affected_docs: [] as string[],
  architecture_notes: [] as string[],
  risks: [] as string[],
  epic: { title: 'Plan Requires Normalization' },
  stories: [] as Array<{ title: string; story_points: number; acceptance_criteria: string[]; tasks: Array<{ ref: string; title: string; story_points: number; acceptance_criteria: string[]; depends_on: string[] }> }>,
});
const isDiscoveryPlanValid = computed(() => Boolean(parsedDiscoveryPlan.value && discoveryPlanErrors.value.length === 0));
const discoveryTotalPoints = computed(() => discoveryPlan.value.stories.reduce((total, story) => total + story.story_points, 0));
const discoveryTaskCount = computed(() => discoveryPlan.value.stories.reduce((total, story) => total + story.tasks.length, 0));
const workflowTitle = computed(() => workflowMode.value === 'discovery' ? 'Requirement Discovery' : workflowMode.value === 'docs' ? 'Repo Documentation' : 'Task Execution');

const requestDiscoveryPlanCorrection = () => {
  if (!sessionId.value) {
    errorMessage.value = 'Agent session closed before responding. Please rerun analysis to create a new session.';
    return;
  }
  followUp.value = 'Please fix the plan according to the Task Hub contract: output a valid <task-hub-discovery-plan> JSON payload with Fibonacci story points, acceptance criteria, and valid dependency refs at the end of the response.';
  sendFollowUp();
  phase.value = 'running';
};

const openCurrentProcess = (mode: 'cards' | 'terminal' = 'terminal') => {
  viewMode.value = mode;
  showProcessDrawer.value = true;
};

const filteredTerminalHtml = computed(() => {
  if (!logSearchQuery.value.trim()) return terminalHtml.value;
  const q = logSearchQuery.value.trim().toLowerCase();
  const lines = terminalHtml.value.split('\n');
  return lines.filter((l) => l.toLowerCase().includes(q)).join('\n');
});

const selectModel = (modelId: string) => {
  isCustomModel.value[provider.value] = false;
  selectedModels.value[provider.value] = modelId;
  addTimeline('Model selected', `${provider.value.toUpperCase()} → ${modelId}`, 'ok');
  saveWorkspaceState();
};

const setCustomModel = (customId: string) => {
  isCustomModel.value[provider.value] = true;
  customModelInput.value[provider.value] = customId;
  saveWorkspaceState();
};

const toggleCustomModelMode = () => {
  isCustomModel.value[provider.value] = !isCustomModel.value[provider.value];
  saveWorkspaceState();
};

const toggleFullscreen = async () => {
  isFullscreen.value = (await window.desktopApi?.toggleFullscreen?.(!isFullscreen.value)) ?? !isFullscreen.value;
  emit('fullscreen-change', isFullscreen.value);
};

const handleMinimizeWindow = () => {
  (window as any).desktopApi?.minimize?.();
};

let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let pendingResize: { width: number; height: number } | null = null;
let resizeAnimationFrame: number | null = null;

const flushWindowResize = () => {
  resizeAnimationFrame = null;
  if (!pendingResize) return;
  (window as any).desktopApi?.resizeWindow?.(pendingResize.width, pendingResize.height);
  pendingResize = null;
};

const stopWindowResize = () => {
  document.removeEventListener('pointermove', resizeWindowFromPointer);
  document.removeEventListener('pointerup', stopWindowResize);
  if (resizeAnimationFrame !== null) {
    cancelAnimationFrame(resizeAnimationFrame);
    resizeAnimationFrame = null;
  }
  flushWindowResize();
};

const resizeWindowFromPointer = (event: PointerEvent) => {
  pendingResize = {
    width: Math.max(960, resizeStartWidth + event.screenX - resizeStartX),
    height: Math.max(600, resizeStartHeight + event.screenY - resizeStartY),
  };
  if (resizeAnimationFrame === null) resizeAnimationFrame = requestAnimationFrame(flushWindowResize);
};

const startWindowResize = (event: PointerEvent) => {
  if (isFullscreen.value || event.button !== 0) return;
  event.preventDefault();
  resizeStartX = event.screenX;
  resizeStartY = event.screenY;
  resizeStartWidth = window.innerWidth;
  resizeStartHeight = window.innerHeight;
  document.addEventListener('pointermove', resizeWindowFromPointer);
  document.addEventListener('pointerup', stopWindowResize, { once: true });
};

const syncAvailableModels = async (forceRefresh = false) => {
  if (isSyncingModels.value) return;
  isSyncingModels.value = true;
  try {
    const res: any = await (window as any).desktopApi?.agent?.listAvailableModels?.(provider.value, {
      forceRefresh,
      taskHubUrl: localStorage.getItem('task_companion_hub_url') || undefined,
    });
    if (res?.ok && res?.models) {
      if (Array.isArray(res.models)) {
        modelsState.value[provider.value] = res.models;
      } else if (typeof res.models === 'object') {
        Object.keys(res.models).forEach((p) => {
          if (modelsState.value[p as Provider]) {
            modelsState.value[p as Provider] = res.models[p];
          }
        });
      }
      const available = modelsState.value[provider.value] || [];
      if (available.length && !available.some((model: any) => model.id === selectedModels.value[provider.value])) {
        selectedModels.value[provider.value] = available[0].id;
        addTimeline('Model updated', `Replaced legacy model with ${available[0].name || available[0].id} as AGY CLI no longer supports the previous model.`, 'warning');
      }
      if (res.syncedAt) {
        modelSyncTimestamp.value = new Date(res.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (res.source) {
        modelSyncSource.value = res.source;
      }
    }
  } catch (err) {
    console.warn('Failed to sync available models:', err);
  } finally {
    isSyncingModels.value = false;
  }
};

const saveCustomModelOption = async () => {
  const customId = customModelInput.value[provider.value]?.trim();
  if (!customId) return;
  try {
    const res: any = await (window as any).desktopApi?.agent?.saveCustomModel?.(provider.value, {
      id: customId,
      name: customId,
    });
    if (res?.ok && res?.models) {
      if (Array.isArray(res.models)) {
        modelsState.value[provider.value] = res.models;
      } else if (typeof res.models === 'object' && res.models[provider.value]) {
        modelsState.value[provider.value] = res.models[provider.value];
      }
    }
    isCustomModel.value[provider.value] = false;
    selectedModels.value[provider.value] = customId;
    addTimeline('Model saved & selected', `${provider.value.toUpperCase()} → ${customId}`, 'ok');
    saveWorkspaceState();
  } catch (err) {
    console.warn('Failed to save custom model:', err);
  }
};

const deleteCustomModelOption = async (modelId: string) => {
  try {
    const res: any = await (window as any).desktopApi?.agent?.deleteCustomModel?.(provider.value, modelId);
    if (res?.ok && res?.models) {
      if (Array.isArray(res.models)) {
        modelsState.value[provider.value] = res.models;
      } else if (typeof res.models === 'object' && res.models[provider.value]) {
        modelsState.value[provider.value] = res.models[provider.value];
      }
    }
    if (selectedModels.value[provider.value] === modelId) {
      selectedModels.value[provider.value] = modelsState.value[provider.value]?.[0]?.id || 'default';
    }
    saveWorkspaceState();
  } catch (err) {
    console.warn('Failed to delete custom model:', err);
  }
};

const showModelsAndUsageModal = ref(false);
const isSyncingQuota = ref(false);
const quotaUsageState = ref({
  plan: 'Google AI Ultra',
  planTier: 'Highest rate limits',
  enableCreditOverages: false,
  gemini: {
    id: 'gemini',
    name: 'Gemini Models',
    provider: 'antigravity',
    weeklyRemainingPercent: 69,
    weeklyResetIn: '4 days, 9 hours',
    fiveHourRemainingPercent: 93,
    fiveHourResetIn: '3 hours, 50 minutes',
  },
  claudeGpt: {
    id: 'claude_gpt',
    name: 'Claude and GPT models',
    provider: 'claude_code',
    weeklyRemainingPercent: 100,
    weeklyResetIn: '7 days',
    fiveHourRemainingPercent: 100,
    fiveHourResetIn: '5 hours',
  },
  codex: {
    id: 'codex',
    name: 'Codex Models',
    provider: 'codex',
    weeklyRemainingPercent: 98,
    weeklyResetIn: '6 days, 20 hours',
    fiveHourRemainingPercent: 95,
    fiveHourResetIn: '4 hours, 30 minutes',
  },
});

const activeQuotaGroup = computed(() => {
  if (provider.value === 'antigravity') {
    return quotaUsageState.value.gemini || { name: 'Gemini Models', weeklyRemainingPercent: 69, fiveHourRemainingPercent: 93 };
  }
  if (provider.value === 'claude_code') {
    return quotaUsageState.value.claudeGpt || { name: 'Claude and GPT models', weeklyRemainingPercent: 100, fiveHourRemainingPercent: 100 };
  }
  return quotaUsageState.value.codex || { name: 'Codex Models', weeklyRemainingPercent: 98, fiveHourRemainingPercent: 95 };
});

const loadQuotaUsage = async () => {
  try {
    const res = await (window as any).desktopApi?.agent?.getQuotaUsage?.();
    if (res) {
      quotaUsageState.value = { ...quotaUsageState.value, ...res };
    }
  } catch (err) {
    console.warn('Failed to load quota usage:', err);
  }
};

const refreshQuotaUsage = async () => {
  if (isSyncingQuota.value) return;
  isSyncingQuota.value = true;
  try {
    const res = await (window as any).desktopApi?.agent?.syncQuotaUsage?.(localStorage.getItem('task_companion_hub_url') || undefined);
    if (res) {
      quotaUsageState.value = { ...quotaUsageState.value, ...res };
      addTimeline('Quota synced', 'Synced latest Quota & Rate limits metrics.', 'ok');
    }
  } catch (err) {
    console.warn('Failed to refresh quota:', err);
  } finally {
    isSyncingQuota.value = false;
  }
};

const toggleCreditOverages = async () => {
  quotaUsageState.value.enableCreditOverages = !quotaUsageState.value.enableCreditOverages;
  try {
    await (window as any).desktopApi?.agent?.updateQuotaSettings?.({
      enableCreditOverages: quotaUsageState.value.enableCreditOverages,
    });
  } catch (err) {
    console.warn('Failed to update credit overages:', err);
  }
};

const openModelsAndUsageModal = () => {
  void loadQuotaUsage();
  showModelsAndUsageModal.value = true;
};

// Antigravity 2.0 Modals
const showSkillsModal = ref(false);
const showScheduledTasksModal = ref(false);
const showSettingsPermissionsModal = ref(false);

export type ActivityType = 'agent' | 'workspaces' | 'explorer' | 'diff' | 'skills' | 'schedule' | 'models' | 'history' | 'settings';
export type EditorTabType = 'terminal' | 'monaco' | 'context' | 'evidence' | 'subagents' | 'tasks' | 'artifacts';

const activeActivity = ref<ActivityType>('agent');
const activeEditorTab = ref<EditorTabType>('terminal');

const workspaceSearchQuery = ref('');
const manualWorkspaceInput = ref('');

const filteredSavedWorkspaces = computed(() => {
  const q = workspaceSearchQuery.value.trim().toLowerCase();
  if (!q) return savedWorkspaces.value;
  return savedWorkspaces.value.filter((w) => w.toLowerCase().includes(q));
});

const addManualWorkspacePath = async () => {
  const p = manualWorkspaceInput.value.trim();
  if (!p) return;
  try {
    const list = await window.desktopApi?.agent?.saveWorkspace?.(p);
    if (list) {
      savedWorkspaces.value = list;
    } else if (!savedWorkspaces.value.includes(p)) {
      savedWorkspaces.value = [p, ...savedWorkspaces.value];
    }
    sourceWorkspace.value = p;
    localStorage.setItem('task_companion_agent_workspace', p);
    manualWorkspaceInput.value = '';
    addTimeline('Workspace added', p, 'ok');
  } catch (err: any) {
    errorMessage.value = err?.message || 'Invalid directory path.';
  }
};

// Antigravity 2.0 Subagents & Tasks tracking state
const activeSubagents = ref<Array<{ id: string; role: string; type: string; model: string; state: string; stateDetail?: string }>>([
  { id: 'sub-self-01', role: 'Code Refactor Specialist', type: 'self', model: 'Gemini 3.7 Flash', state: 'idle', stateDetail: 'Ready for specialized tasks' },
  { id: 'sub-research-01', role: 'Codebase Researcher', type: 'research', model: 'Gemini 3.7 Flash', state: 'idle', stateDetail: 'Ready to survey documentation and codebase' }
]);

const activeBackgroundTasks = ref<Array<{ id: string; name: string; status: 'running' | 'completed' | 'failed'; duration: string; progress?: string }>>([]);

// Antigravity 2.0 Slash Commands
const slashCommands = [
  { cmd: '/goal', label: '/goal', desc: 'Autonomous long-horizon execution until goal completion', icon: 'codicon-milestone' },
  { cmd: '/schedule', label: '/schedule', desc: 'Schedule recurring cron or one-shot timer execution', icon: 'codicon-history' },
  { cmd: '/browser', label: '/browser', desc: 'Automate browser interactions and web data extraction', icon: 'codicon-globe' },
  { cmd: '/grill-me', label: '/grill-me', desc: 'Interactive interview to clarify design and architecture requirements', icon: 'codicon-comment-discussion' },
  { cmd: '/teamwork-preview', label: '/teamwork-preview', desc: 'Multi-agent team coordination with parallel execution', icon: 'codicon-organization' },
  { cmd: '/learn', label: '/learn', desc: 'Extract lessons and persist guidelines to project rules', icon: 'codicon-book' },
  { cmd: '/diff', label: '/diff', desc: 'Open Monaco Diff Inspector', icon: 'codicon-diff' },
  { cmd: '/clear', label: '/clear', desc: 'Clear terminal stream output', icon: 'codicon-clear-all' },
];

const showSlashMenu = ref(false);
const slashFilter = ref('');

const filteredSlashCommands = computed(() => {
  if (!slashFilter.value) return slashCommands;
  const q = slashFilter.value.toLowerCase();
  return slashCommands.filter(c => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
});

const insertSlashCommand = (cmd: string) => {
  followUp.value = `${cmd} `;
  showSlashMenu.value = false;
};

watch(
  () => followUp.value,
  (val) => {
    if (val.startsWith('/')) {
      showSlashMenu.value = true;
      slashFilter.value = val.slice(1);
    } else {
      showSlashMenu.value = false;
    }
  }
);

const startNewConversation = () => {
  if (phase.value === 'running') {
    const ok = confirm('Agent is currently running. Stop current session and start a new one?');
    if (!ok) return;
    void stopAgent();
  }
  followUp.value = '';
  rawOutput.value = '';
  terminalHtml.value = '';
  plainOutput.value = '';
  phase.value = 'ready';
  activeEditorTab.value = 'terminal';
  selectedDiffFile.value = null;
  selectedEditorFile.value = null;
  addTimeline('New Session', 'Initialized new Antigravity 2.0 session', 'ok');
};

const activeCwd = computed(() => worktree.value || sourceWorkspace.value || '');

const workspaceFiles = ref<Array<{ path: string; isDir: boolean; name: string }>>([]);
const isLoadingFiles = ref(false);

type DiffItem = {
  file: string;
  status: string;
  original: string;
  modified: string;
  patch: string;
  additions?: number;
  deletions?: number;
};

const gitDiffData = ref<{
  dirtyFiles: Array<{ status: string; file: string }>;
  diffs: Array<DiffItem>;
  totalAdditions?: number;
  totalDeletions?: number;
  totalChangedFiles?: number;
}>({ dirtyFiles: [], diffs: [], totalAdditions: 0, totalDeletions: 0, totalChangedFiles: 0 });
const isLoadingDiff = ref(false);

const selectedDiffFile = ref<DiffItem | null>(null);
const selectedEditorFile = ref<{ path: string; content: string } | null>(null);

const loadWorkspaceFiles = async () => {
  const dir = activeCwd.value;
  if (!dir) return;
  isLoadingFiles.value = true;
  try {
    const list = await (window as any).desktopApi?.agent?.listFiles?.(dir, 300);
    if (Array.isArray(list)) {
      workspaceFiles.value = list;
    }
  } catch (err) {
    console.warn('Failed to list workspace files:', err);
  } finally {
    isLoadingFiles.value = false;
  }
};

const loadGitDiff = async () => {
  const dir = activeCwd.value;
  if (!dir) return;
  isLoadingDiff.value = true;
  try {
    const res = await (window as any).desktopApi?.agent?.getGitDiff?.(dir);
    if (res && Array.isArray(res.diffs)) {
      gitDiffData.value = {
        dirtyFiles: res.dirtyFiles || [],
        diffs: res.diffs || [],
        totalAdditions: res.totalAdditions ?? res.diffs.reduce((acc: number, d: any) => acc + (d.additions || 0), 0),
        totalDeletions: res.totalDeletions ?? res.diffs.reduce((acc: number, d: any) => acc + (d.deletions || 0), 0),
        totalChangedFiles: res.totalChangedFiles ?? res.diffs.length,
      };
      if (!selectedDiffFile.value && res.diffs.length > 0) {
        selectedDiffFile.value = res.diffs[0];
      }
    }
  } catch (err) {
    console.warn('Failed to get git diff:', err);
  } finally {
    isLoadingDiff.value = false;
  }
};

const revertDiffFile = async (filePath: string) => {
  const dir = activeCwd.value;
  if (!dir || !filePath) return;
  const ok = confirm(`Are you sure you want to revert "${filePath}" to its state before agent modification?`);
  if (!ok) return;
  try {
    const res = await (window as any).desktopApi?.agent?.revertFile?.(dir, filePath);
    if (res?.success) {
      addTimeline('File Reverted', `Reverted file: ${filePath}`, 'ok');
      await loadGitDiff();
      if (selectedDiffFile.value?.file === filePath) {
        selectedDiffFile.value = gitDiffData.value.diffs[0] || null;
      }
    } else {
      errorMessage.value = res?.message || 'Failed to revert file.';
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Error reverting file.';
  }
};

const populateHandoffFromDiff = () => {
  if (!gitDiffData.value.diffs.length) return;
  const fileList = gitDiffData.value.diffs.map((d: any) => `${d.file} (+${d.additions || 0} -${d.deletions || 0})`).join('\n');
  handoff.value.changedFiles = fileList;
  if (!handoff.value.summary) {
    handoff.value.summary = `Agent completed changes on ${gitDiffData.value.totalChangedFiles || gitDiffData.value.diffs.length} files (+${gitDiffData.value.totalAdditions || 0} / -${gitDiffData.value.totalDeletions || 0} lines).`;
  }
  activeEditorTab.value = 'evidence';
};

watch(
  () => phase.value,
  (newPhase) => {
    if (newPhase === 'handoff' || newPhase === 'review') {
      void loadGitDiff();
    }
  }
);

const selectActivity = (act: ActivityType) => {
  activeActivity.value = act;
  if (act === 'workspaces') {
    void loadSavedWorkspaces();
  } else if (act === 'explorer') {
    void loadWorkspaceFiles();
  } else if (act === 'diff') {
    void loadGitDiff();
  } else if (act === 'skills') {
    showSkillsModal.value = true;
  } else if (act === 'schedule') {
    showScheduledTasksModal.value = true;
  } else if (act === 'models') {
    openModelsAndUsageModal();
  } else if (act === 'history') {
    openSessionHistory();
  } else if (act === 'settings') {
    showSettingsPermissionsModal.value = true;
  }
};

const openFileInMonaco = async (fileItem: { path: string; isDir: boolean }) => {
  if (fileItem.isDir || !activeCwd.value) return;
  try {
    const content = await (window as any).desktopApi?.agent?.readFile?.(activeCwd.value, fileItem.path);
    selectedEditorFile.value = { path: fileItem.path, content: content || '' };
    selectedDiffFile.value = null;
    activeEditorTab.value = 'monaco';
  } catch (err) {
    console.warn('Failed to read file:', err);
  }
};

const getFileIconClass = (path: string, isDir: boolean): { icon: string; color: string } => {
  if (isDir) return { icon: 'codicon-folder', color: 'text-amber-400' };
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'vue':
      return { icon: 'codicon-symbol-class', color: 'text-emerald-400' };
    case 'ts':
    case 'tsx':
      return { icon: 'codicon-file-code', color: 'text-blue-400' };
    case 'js':
    case 'jsx':
    case 'mjs':
      return { icon: 'codicon-file-code', color: 'text-yellow-400' };
    case 'json':
      return { icon: 'codicon-json', color: 'text-yellow-300' };
    case 'css':
    case 'scss':
    case 'less':
      return { icon: 'codicon-symbol-color', color: 'text-cyan-400' };
    case 'html':
      return { icon: 'codicon-code', color: 'text-orange-400' };
    case 'md':
    case 'markdown':
      return { icon: 'codicon-markdown', color: 'text-sky-300' };
    case 'php':
      return { icon: 'codicon-file-code', color: 'text-purple-400' };
    case 'py':
      return { icon: 'codicon-file-code', color: 'text-blue-300' };
    case 'sql':
      return { icon: 'codicon-database', color: 'text-amber-300' };
    case 'sh':
    case 'bat':
    case 'ps1':
      return { icon: 'codicon-terminal', color: 'text-emerald-300' };
    case 'yml':
    case 'yaml':
      return { icon: 'codicon-gear', color: 'text-rose-400' };
    default:
      return { icon: 'codicon-file', color: 'text-zinc-400' };
  }
};

const openDiffInMonaco = (diffItem: DiffItem) => {
  selectedDiffFile.value = diffItem;
  selectedEditorFile.value = null;
  activeEditorTab.value = 'monaco';
};

// VS Code Command Palette
const showCommandPalette = ref(false);
const commandPaletteSearch = ref('');

type VSCommand = {
  id: string;
  title: string;
  category: string;
  icon: string;
  shortcut?: string;
  action: () => void | Promise<void>;
};

const vsCommands = computed<VSCommand[]>(() => [
  {
    id: 'run-codex',
    category: 'Agent',
    title: 'Switch Provider to OpenAI Codex (Native Stream)',
    icon: 'codicon-copilot',
    action: () => { provider.value = 'codex'; activeActivity.value = 'agent'; },
  },
  {
    id: 'run-claude',
    category: 'Agent',
    title: 'Switch Provider to Claude Code (Auto Tool Execution)',
    icon: 'codicon-sparkle',
    action: () => { provider.value = 'claude_code'; activeActivity.value = 'agent'; },
  },
  {
    id: 'run-agy',
    category: 'Agent',
    title: 'Switch Provider to Google Antigravity (IDE Direct)',
    icon: 'codicon-hubot',
    action: () => { provider.value = 'antigravity'; activeActivity.value = 'agent'; },
  },
  {
    id: 'sync-models',
    category: 'Models & Quota',
    title: 'Auto-Discover & Sync Available Models from Hub & CLI',
    icon: 'codicon-refresh',
    shortcut: 'Ctrl+Shift+R',
    action: () => syncAvailableModels(true),
  },
  {
    id: 'open-quota',
    category: 'Models & Quota',
    title: 'Open Models & Quota Usage (% 5-Hour & Weekly Remaining)',
    icon: 'codicon-pulse',
    action: () => openModelsAndUsageModal(),
  },
  {
    id: 'git-diff',
    category: 'Git',
    title: 'View Working Tree Changes in Monaco Diff Editor',
    icon: 'codicon-diff',
    shortcut: 'Ctrl+Shift+G',
    action: () => { selectActivity('diff'); activeEditorTab.value = 'monaco'; },
  },
  {
    id: 'browse-files',
    category: 'View',
    title: 'Open File Explorer Tree in Sidebar',
    icon: 'codicon-files',
    shortcut: 'Ctrl+Shift+E',
    action: () => { selectActivity('explorer'); },
  },
  {
    id: 'terminal-view',
    category: 'View',
    title: 'Show Terminal & Live Stream Output',
    icon: 'codicon-terminal',
    shortcut: 'Ctrl+`',
    action: () => { activeEditorTab.value = 'terminal'; },
  },
  {
    id: 'generate-docs',
    category: 'Docs',
    title: 'Scan Repo & Generate Complete Documentation Suite',
    icon: 'codicon-book',
    action: () => startDocsGeneration(),
  },
  {
    id: 'preflight',
    category: 'Preflight',
    title: 'Run Isolation Preflight & Worktree Setup',
    icon: 'codicon-play',
    action: () => runPreflight(),
  },
  {
    id: 'fullscreen',
    category: 'View',
    title: 'Toggle Fullscreen Mode',
    icon: 'codicon-screen-full',
    shortcut: 'F11',
    action: () => toggleFullscreen(),
  },
]);

const filteredCommands = computed(() => {
  const q = commandPaletteSearch.value.trim().toLowerCase();
  if (!q) return vsCommands.value;
  return vsCommands.value.filter(
    (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
});

const executeCommand = (cmd: VSCommand) => {
  showCommandPalette.value = false;
  commandPaletteSearch.value = '';
  void cmd.action();
};

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    showCommandPalette.value = !showCommandPalette.value;
    commandPaletteSearch.value = '';
  } else if (e.key === 'Escape' && showCommandPalette.value) {
    showCommandPalette.value = false;
  }
};

// SESSION HISTORY STATE
const showSessionHistory = ref(false);
const savedSessions = ref<any[]>([]);

const refreshSavedSessions = async () => {
  try {
    const list = (await window.desktopApi?.agent?.listSavedSessions?.()) || [];
    savedSessions.value = list;
  } catch (e) {
    console.warn('Failed to fetch saved sessions:', e);
  }
};

const openSessionHistory = async () => {
  await refreshSavedSessions();
  showSessionHistory.value = true;
};

const openSavedSessionProcess = async (sess: any, mode: 'cards' | 'terminal' = 'terminal') => {
  await switchSession(sess);
  openCurrentProcess(mode);
};

const switchSession = async (sess: any) => {
  if (!sess) return;
  stopDurationTimer();

  provider.value = sess.provider || 'codex';
  if (sess.model) {
    const prov = (sess.provider || 'codex') as Provider;
    const existsInPresets = (PROVIDER_MODELS[prov] || []).some((m) => m.id === sess.model);
    if (existsInPresets) {
      selectedModels.value[prov] = sess.model;
      isCustomModel.value[prov] = false;
    } else {
      customModelInput.value[prov] = sess.model;
      isCustomModel.value[prov] = true;
    }
  }
  sourceWorkspace.value = sess.sourceWorkspace || sess.cwd || '';
  worktree.value = sess.worktree || sess.cwd || '';
  taskId.value = sess.taskId ?? null;
  workflowMode.value = sess.workflowMode === 'discovery' || sess.kind === 'discovery'
    ? 'discovery'
    : sess.kind === 'docs'
      ? 'docs'
      : 'task';
  docsOnly.value = workflowMode.value === 'docs';
  if (sess.docsProjectId !== undefined) docsProjectId.value = sess.docsProjectId;
  if (sess.requirementText) requirementText.value = sess.requirementText;
  if (sess.conversationDraft) conversationDraft.value = sess.conversationDraft;
  sessionId.value = sess.sessionId;
  streamCards.value = Array.isArray(sess.streamCards) ? sess.streamCards : [];
  timeline.value = Array.isArray(sess.timeline) ? sess.timeline : [];
  rawOutput.value = sess.output || '';
  if (sess.handoff) handoff.value = { ...handoff.value, ...sess.handoff };
  runDurationSeconds.value = typeof sess.durationSeconds === 'number' ? sess.durationSeconds : 0;
  updateTerminalRender();

  // Check if still running
  try {
    const live = (await window.desktopApi?.agent?.listSessions?.()) || [];
    const active = live.find((s: any) => s.sessionId === sess.sessionId);
    if (active) {
      phase.value = 'running';
      startDurationTimer();
      addTimeline('Session resumed', `Resuming background session ${sess.provider}...`, 'ok');
    } else {
      phase.value = workflowMode.value === 'discovery' || sess.kind === 'docs' ? 'review' : 'handoff';
      addTimeline('Session loaded', `Reopened session data ${sess.sessionId.slice(0, 16)}...`, 'ok');
    }
  } catch {
    phase.value = workflowMode.value === 'discovery' || sess.kind === 'docs' ? 'review' : 'handoff';
  }

  showSessionHistory.value = false;
  saveWorkspaceState();
};

const removeSavedSession = async (targetSessionId: string, event?: Event) => {
  event?.stopPropagation();
  try {
    await window.desktopApi?.agent?.deleteSavedSession?.(targetSessionId);
    if (sessionId.value === targetSessionId) {
      startNewRun();
    }
    await refreshSavedSessions();
  } catch (e) {
    console.warn('Failed to delete session:', e);
  }
};

// PERSISTENCE: Restore state on mount
const restoreWorkspaceState = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let state: any = null;
    if (raw) {
      state = JSON.parse(raw);
    } else {
      const list = (await window.desktopApi?.agent?.listSavedSessions?.()) || [];
      if (list.length) state = list[0];
    }

    if (state) {
      if (state.provider) provider.value = state.provider;
      if (state.selectedModels && typeof state.selectedModels === 'object') {
        selectedModels.value = { ...selectedModels.value, ...state.selectedModels };
      }
      if (state.customModelInput && typeof state.customModelInput === 'object') {
        customModelInput.value = { ...customModelInput.value, ...state.customModelInput };
      }
      if (state.isCustomModel && typeof state.isCustomModel === 'object') {
        isCustomModel.value = { ...isCustomModel.value, ...state.isCustomModel };
      }
      if (state.model) {
        const prov = (state.provider || provider.value) as Provider;
        const existsInPresets = (PROVIDER_MODELS[prov] || []).some((m) => m.id === state.model);
        if (existsInPresets) {
          selectedModels.value[prov] = state.model;
          isCustomModel.value[prov] = false;
        } else {
          customModelInput.value[prov] = state.model;
          isCustomModel.value[prov] = true;
        }
      }
      if (state.sourceWorkspace) sourceWorkspace.value = state.sourceWorkspace;
      if (state.worktree) worktree.value = state.worktree;
      if (state.taskId !== undefined) taskId.value = state.taskId;
      if (state.docsOnly !== undefined) docsOnly.value = state.docsOnly;
      if (state.workflowMode === 'discovery' || state.workflowMode === 'docs' || state.workflowMode === 'task') {
        workflowMode.value = state.workflowMode;
        docsOnly.value = state.workflowMode === 'docs';
      }
      if (state.docsProjectId !== undefined) docsProjectId.value = state.docsProjectId;
      if (state.requirementText) requirementText.value = state.requirementText;
      if (state.conversationDraft) conversationDraft.value = state.conversationDraft;
      if (state.sessionId) sessionId.value = state.sessionId;
      if (state.runId) runId.value = state.runId;
      if (Array.isArray(state.streamCards) && state.streamCards.length) streamCards.value = state.streamCards;
      if (Array.isArray(state.timeline) && state.timeline.length) timeline.value = state.timeline;
      if (state.rawOutput) {
        rawOutput.value = state.rawOutput;
        updateTerminalRender();
      }
      if (state.handoff) handoff.value = { ...handoff.value, ...state.handoff };
      if (state.preflight) preflight.value = state.preflight;
      if (state.viewMode) viewMode.value = state.viewMode;
      if (state.phase) phase.value = state.phase;
      if (typeof state.runDurationSeconds === 'number') runDurationSeconds.value = state.runDurationSeconds;
      else if (typeof state.durationSeconds === 'number') runDurationSeconds.value = state.durationSeconds;
      migrateLegacyAgySelection();
    }
  } catch (e) {
    console.warn('Failed to restore agent workspace state:', e);
  }

  // Old builds persisted a completed Requirement run as `review` even when
  // the stream contained only the user request. Do not leave that dead state
  // looking approvable after an upgrade.
  if (workflowMode.value === 'discovery' && phase.value === 'review' && !hasDiscoveryAgentResponse.value) {
    phase.value = 'error';
    errorMessage.value = 'Previous plan has no agent response. Please rerun analysis to generate a new plan.';
  }

  // Refresh saved sessions list
  void refreshSavedSessions();

  // Check live background processes
  try {
    const sessions = (await window.desktopApi?.agent?.listSessions?.()) || [];
    const active = sessions.find((s: any) => s.sessionId === sessionId.value);
    if (active) {
      phase.value = 'running';
      if (active.output && active.output.length > rawOutput.value.length) {
        rawOutput.value = active.output;
        updateTerminalRender();
      }
      if (active.events && Array.isArray(active.events)) {
        active.events.forEach((ev: any) => handleStreamEvent({ event: ev }));
      }
      startDurationTimer();
      addTimeline('Session reconnected', `Reconnecting to session ${active.provider}...`, 'ok');
    } else if (phase.value === 'running') {
      stopDurationTimer();
      if (workflowMode.value === 'discovery' || docsOnly.value) {
        if (workflowMode.value === 'discovery' && !hasDiscoveryAgentResponse.value) {
          phase.value = 'error';
          errorMessage.value = 'Previous agent session ended without a plan response. Please rerun analysis.';
          addTimeline('Discovery response missing', errorMessage.value, 'error');
        } else {
          phase.value = 'review';
        }
      } else {
        phase.value = 'handoff';
      }
    }
  } catch (e) {
    console.warn('Failed to sync live sessions:', e);
  }
};

const syncSessionOutput = restoreWorkspaceState;

// RESET / NEW RUN
const startNewRun = () => {
  stopDurationTimer();
  phase.value = 'select';
  worktree.value = '';
  sessionId.value = null;
  runId.value = null;
  docsOnly.value = false;
  workflowMode.value = 'task';
  requirementText.value = '';
  conversationDraft.value = '';
  pendingInitialRequest.value = '';
  pendingUserEchoes.value = [];
  rawOutput.value = '';
  terminalHtml.value = '';
  plainOutput.value = '';
  streamCards.value = [];
  handoff.value = {
    summary: '',
    changedFiles: '',
    tests: 'npm test',
    testStatus: 'passed',
    testSummary: '',
    commitSha: '',
    pullRequestUrl: '',
    blockers: '',
  };
  addTimeline('New run started', 'Initialized fresh workspace environment.', 'muted');
  saveWorkspaceState();
};

// Watchers for auto-saving
watch([phase, provider, selectedModels, customModelInput, isCustomModel, sourceWorkspace, worktree, taskId, docsOnly, workflowMode, docsProjectId, requirementText, conversationDraft, sessionId, runId, streamCards, timeline, rawOutput, handoff, viewMode], () => {
  saveWorkspaceState();
}, { deep: true });

const appendUserConversation = (text: string, expectEcho = false) => {
  const message = text.trim();
  if (!message) return;
  if (expectEcho) pendingUserEchoes.value.push(normalizeConversationText(message));
  streamCards.value.push({ id: `user-${Date.now()}-${Math.random()}`, type: 'user_message', text: message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
};

const beginConversationRun = (initialRequest: string) => {
  rawOutput.value = '';
  terminalHtml.value = '';
  plainOutput.value = '';
  streamCards.value = [];
  pendingUserEchoes.value = [];
  appendUserConversation(initialRequest);
};

// Process structured stream events
const handleStreamEvent = (payload: any) => {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (payload.stream === 'user') {
    const text = payload.event?.text || payload.text || '';
    const result = consumePendingUserEcho(pendingUserEchoes.value, text);
    pendingUserEchoes.value = result.pending;
    if (!result.duplicate) streamCards.value.push({ id: `user-${Date.now()}`, type: 'user_message', text, time: now });
    return;
  }

  const ev = payload.event;
  if (!ev) return;

  // 1. Codex format events
  if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
    streamCards.value.push({
      id: ev.item.id || `msg-${Date.now()}`,
      type: 'agent_message',
      text: ev.item.text,
      time: now,
    });
  } else if ((ev.type === 'item.completed' || ev.type === 'item.started') && (ev.item?.type === 'thought' || ev.item?.type === 'reasoning')) {
    const cardId = ev.item.id || `thought-${Date.now()}`;
    const existing = streamCards.value.find((c) => c.id === cardId);
    if (existing && existing.type === 'thought') {
      if (ev.item.text) existing.text = ev.item.text;
    } else if (ev.item?.text) {
      streamCards.value.push({
        id: cardId,
        type: 'thought',
        text: ev.item.text,
        status: ev.type === 'item.completed' ? 'completed' : 'in_progress',
        time: now,
      });
    }
  } else if (ev.type === 'item.started' && ev.item?.type === 'command_execution') {
    const existing = streamCards.value.find((c) => c.id === ev.item.id);
    if (existing) {
      existing.status = 'in_progress';
      existing.command = ev.item.command;
    } else {
      streamCards.value.push({
        id: ev.item.id || `cmd-${Date.now()}`,
        type: 'command_execution',
        command: ev.item.command,
        status: 'in_progress',
        expanded: false,
        time: now,
      });
    }
  } else if (ev.type === 'item.completed' && ev.item?.type === 'command_execution') {
    const existing = streamCards.value.find((c) => c.id === ev.item.id);
    if (existing) {
      existing.status = ev.item.status || (ev.item.exit_code === 0 ? 'completed' : 'failed');
      existing.output = ev.item.aggregated_output;
      existing.exitCode = ev.item.exit_code;
    } else {
      streamCards.value.push({
        id: ev.item.id || `cmd-${Date.now()}`,
        type: 'command_execution',
        command: ev.item.command,
        status: ev.item.status || 'completed',
        output: ev.item.aggregated_output,
        exitCode: ev.item.exit_code,
        expanded: false,
        time: now,
      });
    }
  } else if (ev.type === 'turn.completed') {
    streamCards.value.push({
      id: `turn-${Date.now()}`,
      type: 'turn_completed',
      usage: ev.usage,
      time: now,
    });
  }

  // 2. Antigravity (agy) format events
  else if (ev.event === 'step_update' && (ev.step_update?.step_type === 'thought' || ev.step_update?.step_type === 'reasoning' || ev.step_update?.thought_delta || ev.step_update?.reasoning_content)) {
    const su = ev.step_update;
    const cardId = `agy-thought-${su.step_index ?? 'current'}`;
    const thoughtDelta = su.thought_delta || su.reasoning_content || su.thought || su.text_delta || '';
    const existing = streamCards.value.find((c) => c.id === cardId);

    if (existing && existing.type === 'thought') {
      if (thoughtDelta) existing.text = (existing.text || '') + thoughtDelta;
      if (su.state === 'DONE') existing.status = 'completed';
    } else if (thoughtDelta) {
      streamCards.value.push({
        id: cardId,
        type: 'thought',
        text: thoughtDelta,
        status: su.state === 'DONE' ? 'completed' : 'in_progress',
        time: now,
      });
    }
  } else if (ev.event === 'thought') {
    const cardId = `agy-thought-${Date.now()}`;
    const thoughtDelta = ev.thought_delta || ev.delta || ev.reasoning_content || ev.thought || '';
    const lastThought = [...streamCards.value].reverse().find((c) => c.type === 'thought' && c.status === 'in_progress');
    if (lastThought && thoughtDelta) {
      lastThought.text = (lastThought.text || '') + thoughtDelta;
    } else if (thoughtDelta) {
      streamCards.value.push({
        id: cardId,
        type: 'thought',
        text: thoughtDelta,
        status: 'completed',
        time: now,
      });
    }
  } else if (ev.event === 'step_update' && ev.step_update?.step_type === 'tool') {
    const su = ev.step_update;
    const cardId = `agy-tool-${su.step_index ?? Date.now()}`;
    const toolName = su.tool_name || su.tool_info?.name || 'tool';
    const params = su.tool_info?.parameters || {};
    const paramSummary = params.AbsolutePath || params.TargetFile || params.CommandLine || params.Query || (Object.keys(params).length ? JSON.stringify(params) : '');
    const existing = streamCards.value.find((c) => c.id === cardId);

    if (existing) {
      existing.status = su.state === 'DONE' ? 'completed' : 'in_progress';
      if (su.duration_seconds) existing.duration = `${su.duration_seconds.toFixed(2)}s`;
      if (su.tool_info?.output) existing.output = su.tool_info.output;
    } else {
      streamCards.value.push({
        id: cardId,
        type: 'tool_execution',
        toolName,
        command: paramSummary,
        toolParameters: params,
        output: su.tool_info?.output || '',
        status: su.state === 'DONE' ? 'completed' : 'in_progress',
        duration: su.duration_seconds ? `${su.duration_seconds.toFixed(2)}s` : undefined,
        expanded: false,
        time: now,
      });
    }
  } else if (ev.event === 'step_update' && ev.step_update?.step_type === 'agent_response') {
    const su = ev.step_update;
    const cardId = `agy-msg-${su.step_index ?? 'current'}`;
    const delta = su.text_delta || '';
    const existing = streamCards.value.find((c) => c.id === cardId);

    if (existing && existing.type === 'agent_message') {
      if (delta) existing.text = (existing.text || '') + delta;
    } else if (delta) {
      streamCards.value.push({
        id: cardId,
        type: 'agent_message',
        text: delta,
        time: now,
      });
    }
  } else if (ev.event === 'result') {
    const res = ev.result;
    if (res?.response) {
      const lastMsg = [...streamCards.value].reverse().find((c) => c.type === 'agent_message');
      if (lastMsg && (!lastMsg.text || lastMsg.text.length < res.response.length)) {
        lastMsg.text = res.response;
      } else if (!lastMsg) {
        streamCards.value.push({
          id: `agy-res-${Date.now()}`,
          type: 'agent_message',
          text: res.response,
          time: now,
        });
      }
    }
    if (res?.usage) {
      streamCards.value.push({
        id: `turn-${Date.now()}`,
        type: 'turn_completed',
        usage: {
          input_tokens: res.usage.input_tokens || 0,
          output_tokens: res.usage.output_tokens || 0,
          total_tokens: res.usage.total_tokens || ((res.usage.input_tokens || 0) + (res.usage.output_tokens || 0)),
        },
        time: now,
      });
    }
  }
};

// Smooth terminal rendering
const updateTerminalRender = () => {
  if (!rawOutput.value) {
    terminalHtml.value = '';
    plainOutput.value = '';
    return;
  }
  terminalHtml.value = ansiToHtml(rawOutput.value);
  plainOutput.value = stripAnsiToPlainText(rawOutput.value);

  if (autoScroll.value && !isScrolledUp.value) {
    nextTick(() => {
      scrollToBottom();
    });
  }
};

const scheduleLiveRender = () => {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = undefined;
    updateTerminalRender();
  }, 40);
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  isScrolledUp.value = distanceFromBottom > 60;
};

const scrollToBottom = () => {
  if (viewMode.value === 'cards' && streamContainer.value) {
    streamContainer.value.scrollTop = streamContainer.value.scrollHeight;
  } else if (terminalContainer.value) {
    terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
  }
  isScrolledUp.value = false;
};

const clearTerminal = () => {
  rawOutput.value = '';
  terminalHtml.value = '';
  plainOutput.value = '';
  streamCards.value = [];
  addTimeline('Logs cleared', 'Cleared logs and cards screen.', 'muted');
};

const copyTerminalOutput = async () => {
  const text = plainOutput.value || stripAnsiToPlainText(rawOutput.value);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addTimeline('Logs copied', 'Full terminal content copied to clipboard.', 'ok');
};

const copyCardText = async (text?: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addTimeline('Message copied', 'Agent response copied to clipboard.', 'ok');
};

const startDurationTimer = () => {
  if (durationTimer) clearInterval(durationTimer);
  durationTimer = setInterval(() => {
    runDurationSeconds.value++;
  }, 1000);
};

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = undefined;
  }
};

const loadSavedWorkspaces = async () => {
  savedWorkspaces.value = (await window.desktopApi?.agent?.listWorkspaces?.()) || [];
  if (!sourceWorkspace.value && savedWorkspaces.value.length) {
    sourceWorkspace.value = savedWorkspaces.value[0];
  }
  if (sourceWorkspace.value && !savedWorkspaces.value.includes(sourceWorkspace.value)) {
    savedWorkspaces.value = [sourceWorkspace.value, ...savedWorkspaces.value];
  }
};

const selectWorkspace = (workspace: string) => {
  sourceWorkspace.value = workspace;
  localStorage.setItem('task_companion_agent_workspace', workspace);
  addTimeline('Workspace selected', workspace.split('\\').pop() || workspace, 'ok');
};

const addWorkspaceFolder = async () => {
  const selected = await window.desktopApi?.agent?.pickWorkspace();
  if (selected) {
    sourceWorkspace.value = selected;
    localStorage.setItem('task_companion_agent_workspace', selected);
    savedWorkspaces.value = (await window.desktopApi?.agent?.saveWorkspace?.(selected)) || [
      selected,
      ...savedWorkspaces.value.filter((item) => item !== selected),
    ];
    addTimeline('Workspace added', selected, 'ok');
  }
};

const removeSavedWorkspace = async (workspace: string) => {
  savedWorkspaces.value =
    (await window.desktopApi?.agent?.removeWorkspace?.(workspace)) || savedWorkspaces.value.filter((item) => item !== workspace);
  if (sourceWorkspace.value === workspace) {
    selectWorkspace(savedWorkspaces.value[0] || '');
  }
};

const chooseWorkspace = addWorkspaceFolder;

const runQuickSetup = async () => {
  if (!sourceWorkspace.value) await addWorkspaceFolder();
  if (!sourceWorkspace.value) return;
  setupBusy.value = true;
  try {
    setupState.value = await window.desktopApi.agent.quickSetup(sourceWorkspace.value, true);
    setupState.value.checks.forEach((check: any) => addTimeline(`Setup · ${check.id}`, check.message, check.status));
  } catch (error: any) {
    setupState.value = { ok: false, checks: [{ id: 'setup', status: 'failed', message: error.message || 'Local setup failed.' }] };
    addTimeline('Setup error', error.message || 'Error setting up environment.', 'error');
  } finally {
    setupBusy.value = false;
  }
};

const mcpCall = (method: string, params: Record<string, any> = {}) => {
  if (!credential.value) throw new Error('Task Hub is not authenticated.');
  return window.desktopApi.taskHub.mcpCall(taskHubUrl.value, credential.value.token, credential.value.projectId, method, params);
};

const readMcpText = (response: any) => {
  if (response?.error) throw new Error(response.error.message || 'MCP request failed.');
  const text = response?.result?.content?.find((item: any) => item.type === 'text')?.text;
  if (!text) throw new Error('MCP returned no data.');
  return JSON.parse(text);
};

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
};

const verifyTaskHub = async () => {
  const response = await window.desktopApi.taskHub.getCapabilities(taskHubUrl.value);
  const capabilities = response?.data;
  if (capabilities?.api_version !== 'v1') {
    throw new Error('Task Hub server does not support API v1. Please upgrade server or select another URL.');
  }
  localStorage.setItem('task_hub_base_url', taskHubUrl.value.replace(/\/$/, ''));
  addTimeline('Server compatible', `Task Hub API ${capabilities.api_version}`, 'ok');
};

const contract = (developerRequest = '') =>
  `TASK HUB CONTRACT\nProvider: ${provider.value}\nModel: ${activeModel.value} (${activeModelLabel.value})\nWork only on ${selectedTask.value?.issue_key || `task-${taskId.value}`}. You have full execution permissions in this isolated worktree; do not ask for human approval before running commands, editing files, testing, committing, pushing, merging, or deploying when those actions are required by the task. Use Task Hub MCP for lifecycle/evidence and end with summary, changed files, tests, commit/PR and blockers.${developerRequest ? `\n\nDEVELOPER REQUEST:\n${developerRequest}` : ''}\n\nCONTEXT:\n${JSON.stringify(contextPack.value, null, 2)}`;

const docsPrompt = (scopeNote = '') =>
  `You are generating Task Hub standard documentation in a supervised worktree. Model: ${activeModel.value} (${activeModelLabel.value}).${scopeNote ? ` Additional developer scope: ${scopeNote}` : ''} First scan repository structure, package manifests, entry points, configuration, public interfaces, database/migrations, tests, and existing documentation. Create or update ONLY these canonical files under docs/: PROJECT_DOCUMENTS.md, PROJECT_BRIEF.md, PRD.md, ARCHITECTURE.md, QA_PLAN.md, and RELEASE_RUNBOOK.md. PROJECT_DOCUMENTS.md MUST use the exact Task Hub registry marker <!-- task-hub:document-registry:v1 --> and these five rows/types: brief→docs/PROJECT_BRIEF.md, prd→docs/PRD.md, architecture→docs/ARCHITECTURE.md, qa_plan→docs/QA_PLAN.md, release_runbook→docs/RELEASE_RUNBOOK.md. Each core document must have stable headings: Purpose, Scope, Current State, Constraints, Open Questions; add domain-specific sections only after those. Base every statement on files you actually inspected; mark unknowns as TODO instead of guessing. Include source paths and an As-of commit/date in each document. Do not modify application source code, credentials, lockfiles, generated output, README, or deployment state. Do not commit, push, merge, or deploy. Finish with a summary of scanned areas, created/updated canonical files, and documentation gaps. These files will be synced by Task Hub and passed into future task context, so preserve the schema and paths exactly.`;

const discoveryPrompt = () =>
  `You are the local Requirement Discovery agent for Task Hub. Requirement: ${requirementText.value}\n\nFirst inspect the current repository and docs/ in this worktree. Use Task Hub MCP to read get_project_state, list_project_documents and get_repository_context for project ${docsProjectId.value}. Do not edit files, commit, deploy, or create any Task Hub record in this run. Return a concise, reviewable plan in Vietnamese with: clarified requirement, assumptions/questions, affected docs and architecture, risks, one Epic for this request, User Stories with acceptance criteria, implementation Tasks, Fibonacci story points, and an explicit dependency map using a unique ref for every task (for example api depends_on schema). Prefer grouping this request in one Sprint unless its size clearly requires splitting. Every work item over 8 points must be split. Finish with an explicit human approval request.${serializeDiscoveryPlanContract()}`;

const approvedBacklogPrompt = () =>
  `The developer approved creating the backlog for this requirement: ${requirementText.value}\n\nUse Task Hub MCP for project ${docsProjectId.value}. Read get_project_state and list_project_documents again. Then call create_requirement_backlog exactly once. Its payload must include one epic and every Story/Task for this requirement. Use the active Sprint when possible (or specify a single new sprint); the MCP tool will keep all generated work in that one Sprint and link it to the one Epic. Give every task a unique ref and declare depends_on with predecessor refs, so a task can only start after its prerequisites are done. Use Fibonacci story points (1,2,3,5,8); split anything larger. Include acceptance criteria and risks in the relevant descriptions. Do not call create_sprint or create_work_item for this approved requirement unless create_requirement_backlog is unavailable. Do not modify repository files, commit, push, merge or deploy. End by listing the Epic, Sprint, every created Task Hub issue key, and the dependency chain.`;

const startPairing = async () => {
  phase.value = 'pairing';
  addTimeline('Pairing', 'Awaiting Task Hub authentication approval...', 'active');
  try {
    await verifyTaskHub();
    const projId = selectedTask.value?.project_id || (docsProjectId.value ? Number(docsProjectId.value) : null);
    const pairing = await window.desktopApi.taskHub.startPairing(taskHubUrl.value, projId);
    await window.desktopApi.openExternal(pairing.approval_url);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      try {
        if (Date.now() - started > 600000) throw new Error('Pairing timed out.');
        const status = await window.desktopApi.taskHub.pollPairing(taskHubUrl.value, pairing.pairing_id, pairing.device_secret);
        if (status.status === 'approved') {
          stopPolling();
          credential.value = { token: status.mcp_token, projectId: String(status.project_id) };
          localStorage.setItem('task_hub_credential', JSON.stringify(credential.value));
          addTimeline('Pairing', 'MCP authenticated successfully.', 'ok');
          await refreshAgentTasks();
          if (selectedTask.value) {
            await loadContext();
          } else {
            phase.value = 'select';
          }
        } else if (['denied', 'expired', 'rejected'].includes(status.status)) {
          throw new Error(`Pairing ${status.status}.`);
        }
      } catch (error: any) {
        stopPolling();
        phase.value = 'error';
        errorMessage.value = error.message;
        addTimeline('Pairing error', error.message, 'error');
      }
    }, 1800);
  } catch (err: any) {
    phase.value = 'error';
    errorMessage.value = err.message || 'Could not start pairing.';
    addTimeline('Pairing error', errorMessage.value, 'error');
  }
};

const runPreflight = async (initialRequest = '') => {
  errorMessage.value = '';
  if (!selectedTask.value?.project_id) {
    errorMessage.value = 'Please select a task from the list before starting.';
    return;
  }
  if (!sourceWorkspace.value) await chooseWorkspace();
  if (!sourceWorkspace.value) {
    errorMessage.value = 'Please select a local Git repository directory.';
    return;
  }
  phase.value = 'preflight';
  if (initialRequest) {
    pendingInitialRequest.value = initialRequest;
    beginConversationRun(initialRequest);
  }
  addTimeline('Preflight', `Checking ${provider.value} (${activeModel.value}) and repository...`, 'active');
  try {
    preflight.value = await window.desktopApi.agent.preflight(provider.value, sourceWorkspace.value);
    preflight.value.checks.forEach((check: any) => addTimeline(check.id, check.message, check.status));
    if (!preflight.value.ok) throw new Error('Preflight failed. Address warnings/errors and retry.');

    const workspace = await window.desktopApi.agent.createWorktree(
      preflight.value.repository,
      selectedTask.value.issue_key || `task-${selectedTask.value.id}`
    );
    worktree.value = workspace.path;
    addTimeline('Worktree ready', `${workspace.branch} · ${workspace.reused ? 'reused' : 'created'}`, 'ok');

    if (props.desktopCredential) {
      credential.value = { token: props.desktopCredential.token, projectId: props.desktopCredential.projectId };
      await loadContext();
    } else {
      await startPairing();
    }
  } catch (error: any) {
    phase.value = 'error';
    errorMessage.value = error.message || 'Preflight failed.';
    addTimeline('Preflight failed', error.message, 'error');
  }
};

const startDocsGeneration = async (scopeNote = '', initialRequest = '') => {
  errorMessage.value = '';
  workflowMode.value = 'docs';
  docsOnly.value = true;
  if (!docsProjectId.value) {
    errorMessage.value = 'Select Repo/Project on Task Hub before scanning and syncing documentation.';
    return;
  }
  if (!sourceWorkspace.value) await chooseWorkspace();
  if (!sourceWorkspace.value) {
    docsOnly.value = false;
    errorMessage.value = 'Please select a Git repository directory.';
    return;
  }
  phase.value = 'preflight';
  addTimeline('Docs scan', `Checking ${provider.value} (${activeModel.value}) and repository...`, 'active');
  try {
    preflight.value = await window.desktopApi.agent.preflight(provider.value, sourceWorkspace.value);
    preflight.value.checks.forEach((check: any) => addTimeline(check.id, check.message, check.status));
    if (!preflight.value.ok) throw new Error('Preflight checks failed. Please check environment.');

    const workspace = await window.desktopApi.agent.createWorktree(preflight.value.repository, 'docs-from-repo');
    worktree.value = workspace.path;
    addTimeline('Docs worktree', `${workspace.branch} · ${workspace.reused ? 'reused' : 'created'}`, 'ok');

    phase.value = 'running';
    beginConversationRun(initialRequest || buildInitialRequest({ mode: 'docs', projectTitle: selectedDocsProject.value?.title, note: scopeNote }));
    runDurationSeconds.value = 0;
    startDurationTimer();

    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, docsPrompt(scopeNote), 'docs', activeModel.value);
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);

    if (result.mode === 'external') {
      rawOutput.value = `Agent is running in external application (Antigravity · ${activeModel.value}). Complete execution then stop session to review.\n`;
      updateTerminalRender();
    }
    addTimeline(
      'Docs agent started',
      result.mode === 'external' ? `Prompt sent to Antigravity (${activeModel.value}).` : `${provider.value} (${activeModel.value}) is scanning repository and generating documentation...`,
      'ok'
    );
  } catch (error: any) {
    docsOnly.value = false;
    stopDurationTimer();
    phase.value = 'error';
    errorMessage.value = error.message || 'Failed to launch docs agent.';
    addTimeline('Docs agent error', error.message, 'error');
  }
};

const startRequirementDiscovery = async (initialRequest = '') => {
  errorMessage.value = '';
  workflowMode.value = 'discovery';
  docsOnly.value = false;
  if (!props.desktopCredential || !docsProjectId.value) {
    errorMessage.value = 'Connect Task Hub and select Repo/Project before analyzing requirements.';
    return;
  }
  if (!requirementText.value.trim()) {
    errorMessage.value = 'Enter a requirement description for the agent to analyze.';
    return;
  }
  if (!sourceWorkspace.value) await chooseWorkspace();
  if (!sourceWorkspace.value) {
    errorMessage.value = 'Select a Git repository directory before starting.';
    return;
  }
  phase.value = 'preflight';
  addTimeline('Requirement discovery', `Preparing ${provider.value} (${activeModel.value}) with Repo docs and MCP...`, 'active');
  try {
    preflight.value = await window.desktopApi.agent.preflight(provider.value, sourceWorkspace.value);
    preflight.value.checks.forEach((check: any) => addTimeline(check.id, check.message, check.status));
    if (!preflight.value.ok) throw new Error('Preflight checks failed. Please check environment.');
    const workspace = await window.desktopApi.agent.createWorktree(preflight.value.repository, 'requirement-discovery');
    worktree.value = workspace.path;
    await window.desktopApi.agent.configureMcp({
      cwd: worktree.value,
      provider: provider.value,
      taskHubUrl: props.desktopCredential.taskHubUrl,
      projectId: String(docsProjectId.value),
      token: props.desktopCredential.token,
    });
    phase.value = 'running';
    beginConversationRun(initialRequest || requirementText.value);
    runDurationSeconds.value = 0;
    startDurationTimer();
    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, discoveryPrompt(), 'task', activeModel.value);
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);
    if (result.mode === 'external') {
      rawOutput.value = `Agent is running in external application (${provider.value}). Complete analysis then click Stop to review.\n`;
      updateTerminalRender();
    }
    addTimeline('Discovery agent started', 'Local agent is reading docs, repository and Task Hub MCP; backlog is not created yet.', 'ok');
  } catch (error: any) {
    stopDurationTimer();
    phase.value = 'error';
    errorMessage.value = error.message || 'Failed to launch Requirement Discovery.';
    addTimeline('Discovery error', errorMessage.value, 'error');
  }
};

const retryRequirementDiscovery = async () => {
  sessionId.value = null;
  errorMessage.value = '';
  await startRequirementDiscovery(requirementText.value);
};

const hasFixableEnvironmentIssue = computed(() =>
  Boolean(preflight.value?.checks?.some((check: any) => check.fixable))
);

const repairEnvironment = async () => {
  if (!sourceWorkspace.value) await addWorkspaceFolder();
  if (!sourceWorkspace.value) return;
  setupBusy.value = true;
  errorMessage.value = '';
  addTimeline('Environment repair', 'Safely auto-repairing .env, dependencies and Git worktree metadata...', 'active');
  try {
    const result = await window.desktopApi.agent.repairEnvironment(provider.value, sourceWorkspace.value);
    setupState.value = result;
    preflight.value = result.preflight;
    result.checks.forEach((check: any) => addTimeline(`Repair · ${check.id}`, check.message, check.status));
    if (result.ok) {
      phase.value = 'select';
      addTimeline('Environment ready', 'Environment repaired and rechecked. Ready for preflight.', 'ok');
    } else {
      phase.value = 'error';
      errorMessage.value = 'Some items still require manual resolution. See checklist for details.';
    }
  } catch (error: any) {
    phase.value = 'error';
    errorMessage.value = error.message || 'Failed to auto-repair environment.';
    addTimeline('Environment repair failed', errorMessage.value, 'error');
  } finally {
    setupBusy.value = false;
  }
};

const createApprovedBacklog = async () => {
  if (!props.desktopCredential || !docsProjectId.value || !requirementText.value.trim() || !worktree.value) return;
  if (!isDiscoveryPlanValid.value) {
    errorMessage.value = 'Plan is not valid. Please request local agent to correct it before creating backlog.';
    addTimeline('Backlog blocked', errorMessage.value, 'warning');
    return;
  }
  phase.value = 'running';
  rawOutput.value = '';
  terminalHtml.value = '';
  streamCards.value = [];
  runDurationSeconds.value = 0;
  startDurationTimer();
  try {
    await window.desktopApi.agent.configureMcp({
      cwd: worktree.value,
      provider: provider.value,
      taskHubUrl: props.desktopCredential.taskHubUrl,
      projectId: String(docsProjectId.value),
      token: props.desktopCredential.token,
    });
    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, approvedBacklogPrompt(), 'task', activeModel.value);
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);
    addTimeline('Backlog creation started', 'Approved: local agent is creating Epic, Story and Tasks via Task Hub MCP.', 'active');
  } catch (error: any) {
    stopDurationTimer();
    phase.value = 'review';
    errorMessage.value = error.message || 'Failed to create backlog.';
    addTimeline('Backlog creation error', errorMessage.value, 'error');
  }
};

const loadContext = async () => {
  if (!selectedTask.value || !credential.value) return;
  phase.value = 'context';
  try {
    const taskIdOrKey = selectedTask.value.id || selectedTask.value.issue_key;
    contextPack.value = readMcpText(
      await mcpCall('tools/call', { name: 'get_context_pack', arguments: { task_id: taskIdOrKey } })
    );
    await window.desktopApi.agent.configureMcp({
      cwd: worktree.value,
      provider: provider.value,
      taskHubUrl: taskHubUrl.value,
      projectId: credential.value.projectId,
      token: credential.value.token,
    });
    const session = `${provider.value}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run = readMcpText(
      await mcpCall('tools/call', {
        name: 'start_agent_run',
        arguments: {
          task_id: taskIdOrKey,
          provider: provider.value,
          agent_session_id: session,
          repository: contextPack.value.repository,
          branch: preflight.value?.branch || contextPack.value.branch,
          context: { ...contextPack.value, model: activeModel.value },
          instruction: { contract: 'full_access_task_execution', approval_mode: 'none', model: activeModel.value },
        },
      })
    );
    runId.value = run?.data?.id || run?.id || null;
    addTimeline('Context ready', `Loaded Context pack + MCP configured successfully (Full Access · ${activeModel.value}).`, 'ok');
    phase.value = 'ready';
  } catch (error: any) {
    phase.value = 'error';
    const rawMsg = error.message || 'Failed to prepare agent run.';
    if (rawMsg.includes('does not exist') || rawMsg.includes('ModelNotFoundException') || rawMsg.includes('No query results')) {
      errorMessage.value = `Task #${selectedTask.value.issue_key || selectedTask.value.id} not found on Task Hub. Refreshing task list...`;
      addTimeline('Context error', errorMessage.value, 'error');
      void refreshAgentTasks();
    } else {
      errorMessage.value = rawMsg;
      addTimeline('Context error', rawMsg, 'error');
    }
  }
};

const updateRun = async (status: string, summary?: string) => {
  if (runId.value && credential.value) {
    await mcpCall('tools/call', {
      name: 'update_agent_run',
      arguments: {
        run_id: runId.value,
        status,
        summary,
        metadata: {
          model: activeModel.value,
          worktree_path: worktree.value,
          base_commit: preflight.value?.baseCommit,
          provider_capabilities: preflight.value?.capabilities,
        },
      },
    });
  }
};

const startAgent = async () => {
  try {
    docsOnly.value = false;
    phase.value = 'running';
    rawOutput.value = '';
    terminalHtml.value = '';
    if (!streamCards.value.length) {
      beginConversationRun(pendingInitialRequest.value || buildInitialRequest({ mode: 'task', task: { issueKey: selectedTask.value?.issue_key ?? undefined, title: selectedTask.value?.title ?? undefined } }));
    }
    runDurationSeconds.value = 0;
    startDurationTimer();
    await updateRun('running');

    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, contract(pendingInitialRequest.value), 'task', activeModel.value);
    pendingInitialRequest.value = '';
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);

    addTimeline(
      'Agent started',
      result.mode === 'external' ? `Antigravity (${activeModel.value}) launched · prompt copied.` : `${provider.value} (${activeModel.value}) execution activated with full permissions.`,
      'ok'
    );
    if (result.mode === 'external') {
      rawOutput.value = 'Antigravity is running externally. Submit handoff when done.\n';
      updateTerminalRender();
    }
  } catch (error: any) {
    stopDurationTimer();
    phase.value = 'error';
    errorMessage.value = error.message || 'Failed to launch agent.';
    addTimeline('Agent start error', error.message, 'error');
  }
};

const sendFollowUp = () => {
  if (sessionId.value && followUp.value.trim()) {
    const message = followUp.value.trim();
    appendUserConversation(message, true);
    window.desktopApi.agent.send(sessionId.value, message);
    addTimeline('Follow-up sent', message, 'active');
    followUp.value = '';
  }
};

const sendConversation = () => {
  const note = conversationDraft.value.trim();
  if (phase.value === 'running') {
    if (!note) return;
    followUp.value = note;
    sendFollowUp();
    conversationDraft.value = '';
    return;
  }
  if (sessionId.value && ['review', 'handoff'].includes(phase.value) && note) {
    followUp.value = note;
    sendFollowUp();
    phase.value = 'running';
    conversationDraft.value = '';
    return;
  }
  if (workflowMode.value === 'discovery') {
    if (!note) {
      errorMessage.value = 'Enter desired outcome before analysis.';
      return;
    }
    requirementText.value = note;
    conversationDraft.value = '';
    void startRequirementDiscovery(note);
    return;
  }
  if (workflowMode.value === 'docs') {
    const request = buildInitialRequest({ mode: 'docs', projectTitle: selectedDocsProject.value?.title ?? undefined, note });
    conversationDraft.value = '';
    void startDocsGeneration(note, request);
    return;
  }
  if (!selectedTask.value) {
    errorMessage.value = 'Select a Task Hub task in the left sidebar before sending.';
    return;
  }
  if (phase.value === 'ready') {
    void startAgent();
    return;
  }
  const request = buildInitialRequest({ mode: 'task', task: { issueKey: selectedTask.value.issue_key ?? undefined, title: selectedTask.value.title ?? undefined }, note });
  conversationDraft.value = '';
  void runPreflight(request);
};

const sendQuickPrompt = (promptText: string) => {
  followUp.value = promptText;
  sendFollowUp();
};

const stopAgent = async () => {
  stopDurationTimer();
  if (sessionId.value) {
    await window.desktopApi.agent.stop(sessionId.value);
    localStorage.removeItem('task_companion_active_session');
    sessionId.value = null;
  }
  if (workflowMode.value === 'discovery') {
    handoff.value.summary = 'Local agent completed requirement analysis. Awaiting developer approval before creating backlog.';
    handoff.value.tests = 'Requirement discovery and Task Hub MCP context review';
    handoff.value.testSummary = 'Plan is ready for human approval.';
    addTimeline('Discovery review', 'Review agent outcome, then approve to create backlog on Task Hub.', 'ok');
    phase.value = 'review';
    return;
  }
  if (docsOnly.value) {
    handoff.value.summary = 'Agent completed repository scan and created standard docs/ files.';
    handoff.value.changedFiles = 'docs/PROJECT_DOCUMENTS.md\ndocs/PROJECT_BRIEF.md\ndocs/PRD.md\ndocs/ARCHITECTURE.md\ndocs/QA_PLAN.md\ndocs/RELEASE_RUNBOOK.md';
    handoff.value.tests = 'Documentation scan & schema verification';
    handoff.value.testSummary = 'Documentation generated successfully in worktree.';
    addTimeline('Docs review', 'Docs generation session stopped. You can review and sync to Task Hub.', 'ok');
    phase.value = 'review';
    return;
  }
  await updateRun('cancelled', 'Agent stopped by user.');
  phase.value = 'handoff';
  addTimeline('Agent stopped', 'Session stopped · transitioned to handoff.', 'warning');
};

const completeExternalSession = async () => {
  stopDurationTimer();
  await updateRun('waiting_input', 'External agent completed; structured handoff required.');
  addTimeline('External session', 'External session completed · ready for handoff.', 'ok');
  phase.value = 'handoff';
};

const submitHandoff = async () => {
  try {
    const data = readMcpText(
      await mcpCall('tools/call', {
        name: 'complete_agent_handoff',
        arguments: {
          run_id: runId.value,
          summary: handoff.value.summary,
          changed_files: handoff.value.changedFiles.split('\n').map((v) => v.trim()).filter(Boolean),
          tests: [{ command: handoff.value.tests, status: handoff.value.testStatus, summary: handoff.value.testSummary }],
          commit_sha: handoff.value.commitSha || undefined,
          pull_request_url: handoff.value.pullRequestUrl || undefined,
          blockers: handoff.value.blockers || undefined,
        },
      })
    );
    addTimeline('Handoff submitted', `Submitted to Task Hub · Run ID: ${data?.data?.id || runId.value}`, 'ok');
    phase.value = 'review';
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to submit handoff.';
    addTimeline('Handoff error', error.message, 'error');
  }
};

const copyHandoff = async () => {
  const content = `## Task Hub Agent Handoff\n\n**Summary:**\n${handoff.value.summary}\n\n**Changed Files:**\n${handoff.value.changedFiles}\n\n**Tests:**\n- Command: \`${handoff.value.tests}\`\n- Status: ${handoff.value.testStatus}\n- Result: ${handoff.value.testSummary}\n\n**Commit / PR:**\n- Commit: ${handoff.value.commitSha || 'N/A'}\n- PR: ${handoff.value.pullRequestUrl || 'N/A'}\n\n**Blockers:**\n${handoff.value.blockers || 'None'}`;
  await navigator.clipboard.writeText(content);
  addTimeline('Handoff copied', 'Handoff markdown report copied to clipboard.', 'ok');
};

const isApproving = ref(false);
const showRejectModal = ref(false);
const rejectReason = ref('');
const isRejecting = ref(false);

const approveTaskReview = async () => {
  if (!selectedTask.value) return;
  isApproving.value = true;
  errorMessage.value = '';
  try {
    const taskIdOrKey = selectedTask.value.id || selectedTask.value.issue_key;
    if (credential.value) {
      await mcpCall('tools/call', {
        name: 'request_human_approval',
        arguments: { task_id: taskIdOrKey },
      });
    } else if (props.desktopCredential) {
      const hubUrl = props.desktopCredential.taskHubUrl || taskHubUrl.value;
      const res = await fetch(`${hubUrl.replace(/\/$/, '')}/api/v1/tasks/work-items/${encodeURIComponent(String(taskIdOrKey))}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${props.desktopCredential.token}`,
          'X-Task-Hub-Project': props.desktopCredential.projectId,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Task approval failed.');
      }
    }
    if (selectedTask.value) {
      selectedTask.value.status = 'done';
    }
    addTimeline('Task Approved', `Task ${selectedTask.value?.issue_key || `#${selectedTask.value?.id}`} approved successfully (Task Done · Verified).`, 'ok');
    void refreshAgentTasks();
  } catch (err: any) {
    errorMessage.value = err.message || 'Error approving task completion.';
    addTimeline('Approval Error', errorMessage.value, 'error');
  } finally {
    isApproving.value = false;
  }
};

const openRejectDialog = () => {
  rejectReason.value = '';
  showRejectModal.value = true;
};

const confirmRejectTask = async () => {
  const reason = rejectReason.value.trim();
  if (!reason || !selectedTask.value) {
    errorMessage.value = 'Please enter a reason for requested changes.';
    return;
  }
  isRejecting.value = true;
  errorMessage.value = '';
  try {
    const taskIdOrKey = selectedTask.value.id || selectedTask.value.issue_key;
    if (credential.value) {
      await mcpCall('tools/call', {
        name: 'reject_task',
        arguments: { task_id: taskIdOrKey, reason },
      });
    } else if (props.desktopCredential) {
      const hubUrl = props.desktopCredential.taskHubUrl || taskHubUrl.value;
      const res = await fetch(`${hubUrl.replace(/\/$/, '')}/api/v1/tasks/work-items/${encodeURIComponent(String(taskIdOrKey))}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${props.desktopCredential.token}`,
          'X-Task-Hub-Project': props.desktopCredential.projectId,
        },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Change request submission failed.');
      }
    }
    if (selectedTask.value) {
      selectedTask.value.status = 'in_progress';
    }
    showRejectModal.value = false;
    addTimeline('Changes Requested', `Submitted change request: ${reason}`, 'warning');
    followUp.value = `Change request from Reviewer: ${reason}`;
    phase.value = 'ready';
    void refreshAgentTasks();
  } catch (err: any) {
    errorMessage.value = err.message || 'Error submitting change request.';
    addTimeline('Rejection Error', errorMessage.value, 'error');
  } finally {
    isRejecting.value = false;
  }
};

const openWorktree = () => {
  if (worktree.value) {
    window.desktopApi.agent.openWorkspace(worktree.value);
    addTimeline('Worktree opened', worktree.value, 'ok');
  }
};

const syncGeneratedDocs = async () => {
  if (!props.desktopCredential || !worktree.value) {
    errorMessage.value = 'Task Hub not connected. You can click "Save to Main Workspace" to save docs directly to your project.';
    addTimeline('Docs sync info', 'Task Hub SaaS not connected. Use the option to save to Workspace.', 'muted');
    return;
  }
  // Documentation is owned by a repository/project, not by an individual
  // task. A desktop-wide pairing uses projectId = "all", so this explicit
  // project choice is required for the project-scoped import endpoint.
  const projectId = docsProjectId.value;
  if (!projectId) {
    errorMessage.value = 'Select Repo/Project before syncing documentation.';
    addTimeline('Docs sync info', errorMessage.value, 'muted');
    return;
  }
  try {
    const payload = await window.desktopApi.agent.readGeneratedDocuments(worktree.value);
    await window.desktopApi.taskHub.importGeneratedDocuments(
      props.desktopCredential.taskHubUrl,
      props.desktopCredential.token,
      projectId,
      payload
    );
    addTimeline('Docs synced', 'Standard documentation synced to Task Hub successfully!', 'ok');
  } catch (error: any) {
    const raw = error.message || 'Failed to sync docs to Task Hub.';
    if (raw.includes('404')) {
      errorMessage.value = `Task Hub server (${props.desktopCredential.taskHubUrl}) does not support docs sync endpoint. Click "Save to Main Workspace" to save docs into repo.`;
    } else if (raw.includes('500') && props.desktopCredential.projectId === 'all') {
      errorMessage.value = 'Task Hub could not determine Repo/Project for this docs set. Select Repo/Project and retry.';
    } else {
      errorMessage.value = raw;
    }
    addTimeline('Docs sync error', errorMessage.value, 'error');
  }
};

const applyDocsToWorkspace = async () => {
  if (!worktree.value || !sourceWorkspace.value) {
    errorMessage.value = 'Worktree or main workspace path not found.';
    return;
  }
  try {
    const res = await window.desktopApi.agent.applyDocsToWorkspace(worktree.value, sourceWorkspace.value);
    addTimeline('Docs applied', `Saved ${res.count} document files to docs/ in repo successfully!`, 'ok');
    errorMessage.value = '';
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to copy docs to workspace.';
    addTimeline('Docs apply error', error.message, 'error');
  }
};

const openSessionLog = async () => {
  if (!sessionId.value) return;
  try {
    const logPath = await window.desktopApi.agent.openSessionLog(sessionId.value);
    addTimeline('Logs opened', `Opened log file: ${logPath}`, 'ok');
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to open agent log.';
  }
};

onMounted(async () => {
  loadCachedTasks();
  // Restore persisted state before checking the available model inventory.
  // Running these concurrently allowed stale localStorage to overwrite the
  // AGY 2.x model migration after it had already completed.
  await Promise.all([loadSavedWorkspaces(), restoreWorkspaceState()]);
  await syncAvailableModels(false);
  void loadQuotaUsage();

  removeOutput = window.desktopApi?.agent?.onOutput((event: any) => {
    if (event.sessionId === sessionId.value) {
      handleStreamEvent(event);
      rawOutput.value = `${rawOutput.value}${event.text}`.slice(-250000);
      scheduleLiveRender();
    }
  });

  removeExit = window.desktopApi?.agent?.onExit(async (event: any) => {
    if (event.sessionId === sessionId.value) {
      stopDurationTimer();
      localStorage.removeItem('task_companion_active_session');
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = undefined;
      }
      updateTerminalRender();

      addTimeline('Process exited', `Exit code: ${event.code ?? 'unknown'}`, event.code === 0 ? 'ok' : 'error');

      if (workflowMode.value === 'discovery') {
        const completedWithoutResponse = event.code === 0 && !hasDiscoveryAgentResponse.value;
        handoff.value.summary = completedWithoutResponse
          ? 'Agent finished without returning content to create a plan.'
          : event.code === 0
            ? 'Local agent completed requirement analysis. Awaiting developer approval before creating backlog.'
            : `Requirement Discovery exited with code ${event.code}.`;
        handoff.value.tests = 'Requirement discovery and Task Hub MCP context review';
        handoff.value.testSummary = completedWithoutResponse ? 'No agent response' : event.code === 0 ? 'Plan ready for review' : 'Needs review';
        if (completedWithoutResponse) {
          errorMessage.value = 'Agent finished successfully but sent no response. Cannot review or create backlog; open Process to view logs and retry.';
          addTimeline('Discovery response missing', errorMessage.value, 'error');
          phase.value = 'error';
        } else {
          phase.value = 'review';
        }
      } else if (docsOnly.value) {
        handoff.value.summary =
          event.code === 0 ? 'Agent scanned repository and created standard docs/ files.' : `Docs agent exited with code ${event.code}.`;
        handoff.value.changedFiles = 'docs/PROJECT_DOCUMENTS.md\ndocs/PROJECT_BRIEF.md\ndocs/PRD.md\ndocs/ARCHITECTURE.md\ndocs/QA_PLAN.md\ndocs/RELEASE_RUNBOOK.md';
        handoff.value.tests = 'Documentation scan';
        handoff.value.testSummary = event.code === 0 ? 'Completed' : 'Needs review';
        phase.value = 'review';
      } else {
        await updateRun(event.code === 0 ? 'waiting_input' : 'failed', event.code === 0 ? 'Handoff required.' : `Exited ${event.code}`);
        phase.value = 'handoff';
      }
      saveWorkspaceState();
    }
  });

  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  stopWindowResize();
  saveWorkspaceState();
  stopPolling();
  stopDurationTimer();
  if (renderTimer) clearTimeout(renderTimer);
  removeOutput?.();
  removeExit?.();
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div
    class="agent-workspace ide-minimal no-drag relative min-w-0 w-full flex flex-col overflow-hidden font-sans select-none"
    :class="[
      isStandalone || isFullscreen
        ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
        : 'max-w-[1240px] max-h-[calc(100vh-1rem)] h-[min(94vh,860px)] rounded-2xl border border-slate-700/80 bg-slate-950/98 text-slate-100 shadow-2xl backdrop-blur-2xl'
    ]"
    @mousedown.stop
  >
    <!-- 1. VS CODE WORKBENCH TITLE BAR -->
    <header class="drag-region h-9 px-3 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-between text-xs shrink-0 select-none text-zinc-300">
      <!-- Left: Logo & VS Code Menu -->
      <div class="flex items-center gap-3 min-w-0">
        <div class="flex items-center gap-1.5 text-white font-bold font-mono">
          <MacatungIcon name="agent" :size="16" />
          <span class="hidden sm:inline text-zinc-200 font-semibold">Task Hub IDE</span>
        </div>

        <!-- VS Code Top Menus -->
        <div class="hidden md:flex items-center gap-1 text-[11px] text-zinc-400">
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="selectActivity('explorer')">File</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="showCommandPalette = true">Edit</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="selectActivity('diff')">Selection</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="showCommandPalette = true">View</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="selectActivity('agent')">Run Agent</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="activeEditorTab = 'terminal'">Terminal</button>
          <button class="px-1.5 py-0.5 rounded hover:bg-[#333333] hover:text-white cursor-pointer" @click="showCommandPalette = true">Help</button>
        </div>
      </div>

      <!-- Center: VS Code Command Palette Search Trigger -->
      <div class="flex-1 max-w-md mx-4">
        <button
          class="w-full h-6 px-3 rounded bg-[#252526] hover:bg-[#2d2d2d] border border-[#3e3e42] text-[11px] text-zinc-400 flex items-center justify-between gap-2 transition-colors cursor-pointer"
          @click="showCommandPalette = true; commandPaletteSearch = '';"
          title="Open Command Palette (Ctrl+P / ⌘P)"
        >
          <div class="flex items-center gap-1.5 truncate">
            <i class="codicon codicon-search text-zinc-400 text-xs" />
            <span class="truncate font-mono">{{ activeCwd ? activeCwd.split('\\').pop() : 'task-hub' }} — Command Palette</span>
          </div>
          <span class="px-1 rounded bg-[#333333] text-[10px] font-mono text-zinc-400 shrink-0">Ctrl+P</span>
        </button>
      </div>

      <!-- Right: Model Badge, Mascot Switch & Window Controls -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Switch to Mascot Mode Button -->
        <button
          class="h-6 px-2.5 rounded bg-[#2d2d2d] hover:bg-[#383838] border border-[#3e3e42] text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          @click="emit('switch-mode', 'mascot')"
          title="Switch to Zen Companion (Ctrl+Shift+M)"
        >
          <i class="codicon codicon-device-desktop text-xs text-zinc-400" />
          <span>Zen Companion</span>
        </button>

        <!-- Quick Quota Button -->
        <button
          class="h-6 px-2 rounded bg-[#252526] hover:bg-[#2d2d2d] border border-[#3e3e42] text-zinc-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
          @click="openModelsAndUsageModal"
          title="Models & Usage Quota"
        >
          <i class="codicon codicon-pulse text-xs text-zinc-300" />
          <span>{{ activeQuotaGroup.fiveHourRemainingPercent }}%</span>
        </button>

        <!-- Provider Pill -->
        <span class="px-2 py-0.5 rounded bg-[#252526] border border-[#3e3e42] text-[10px] font-mono text-zinc-300 font-bold uppercase">
          {{ provider === 'antigravity' ? 'AGY' : provider.toUpperCase() }}
        </span>

        <!-- Window Controls -->
        <button
          class="w-7 h-6 rounded hover:bg-[#333333] text-zinc-400 hover:text-white grid place-items-center transition-colors cursor-pointer text-xs"
          title="Minimize window"
          @click="handleMinimizeWindow"
        >
          <i class="codicon codicon-chrome-minimize" />
        </button>

        <button
          class="w-7 h-6 rounded hover:bg-[#333333] text-zinc-400 hover:text-white grid place-items-center transition-colors cursor-pointer text-xs"
          :title="isFullscreen ? 'Restore window size' : 'Maximize window'"
          @click="toggleFullscreen"
        >
          <i class="codicon" :class="isFullscreen ? 'codicon-screen-normal' : 'codicon-screen-full'" />
        </button>

        <button
          class="w-7 h-6 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white grid place-items-center transition-colors cursor-pointer text-xs font-bold"
          title="Close window"
          @click="emit('close')"
        >
          <i class="codicon codicon-close" />
        </button>
      </div>
    </header>

    <button
      class="window-resize-grip no-drag"
      type="button"
      aria-label="Resize window"
      title="Drag to resize"
      @pointerdown.stop="startWindowResize"
    />

    <!-- MAIN BODY: VS CODE SHELL (ACTIVITY BAR + SIDEBAR + EDITOR) -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- 1. ANTIGRAVITY 2.0 ACTIVITY BAR -->
      <nav class="w-12 bg-[#333333] border-r border-[#252526] flex flex-col justify-between items-center py-2 shrink-0 select-none z-10">
        <!-- Top Icons -->
        <div class="flex flex-col items-center gap-1.5 w-full">
          <!-- + New Conversation -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center text-zinc-300 hover:text-white hover:bg-[#007acc] transition-colors cursor-pointer"
            @click="startNewConversation"
            title="New Conversation (+ New Conversation)"
          >
            <i class="codicon codicon-add text-lg" />
          </button>

          <div class="w-6 h-px bg-[#444444] my-0.5" />

          <!-- Agent Workspace Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'agent' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('agent')"
            title="Agent Canvas (Codex, Claude, AGY)"
          >
            <span v-if="activeActivity === 'agent'" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#007acc] rounded-r" />
            <i class="codicon codicon-copilot text-lg" />
          </button>

          <!-- Workspaces Manager Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'workspaces' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('workspaces')"
            title="Manage Workspaces"
          >
            <span v-if="activeActivity === 'workspaces'" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#007acc] rounded-r" />
            <i class="codicon codicon-root-folder text-lg" />
            <span v-if="savedWorkspaces.length" class="absolute top-1.5 right-1 px-1 py-0.2 rounded-full bg-[#3e3e42] text-[8px] font-bold text-zinc-300 font-mono leading-none">
              {{ savedWorkspaces.length }}
            </span>
          </button>

          <!-- Explorer Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'explorer' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('explorer')"
            title="Explorer (Ctrl+Shift+E)"
          >
            <span v-if="activeActivity === 'explorer'" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#007acc] rounded-r" />
            <i class="codicon codicon-files text-lg" />
          </button>

          <!-- Source Control / Git Diff Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'diff' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('diff')"
            title="Source Control & Git Diff (Ctrl+Shift+G)"
          >
            <span v-if="activeActivity === 'diff'" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#007acc] rounded-r" />
            <i class="codicon codicon-source-control text-lg" />
            <span v-if="gitDiffData.dirtyFiles.length" class="absolute top-1.5 right-1 px-1 py-0.2 rounded-full bg-[#007acc] text-[8px] font-bold text-white font-mono leading-none">
              {{ gitDiffData.dirtyFiles.length }}
            </span>
          </button>

          <!-- Skills & Customizations Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'skills' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('skills')"
            title="Skills, MCP & Customizations"
          >
            <i class="codicon codicon-extensions text-lg" />
          </button>

          <!-- Scheduled Tasks & Timers Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'schedule' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('schedule')"
            title="Scheduled Tasks & Timers (Cron)"
          >
            <i class="codicon codicon-history text-lg" />
          </button>

          <!-- Models & Quota Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'models' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('models')"
            title="Models & Usage Quota"
          >
            <i class="codicon codicon-dashboard text-lg" />
          </button>

          <!-- Session History Tab -->
          <button
            class="w-10 h-10 rounded flex items-center justify-center transition-colors cursor-pointer relative"
            :class="activeActivity === 'history' ? 'text-white bg-[#252526]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#3e3e42]'"
            @click="selectActivity('history')"
            title="Conversation History"
          >
            <i class="codicon codicon-comment-discussion text-lg" />
          </button>
        </div>

        <!-- Bottom Icons -->
        <div class="flex flex-col items-center gap-1 w-full pb-1">
          <button
            class="w-10 h-10 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#3e3e42] transition-colors cursor-pointer"
            @click="openModelsAndUsageModal"
            title="Account & Plan"
          >
            <i class="codicon codicon-account text-lg" />
          </button>
          <button
            class="w-10 h-10 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#3e3e42] transition-colors cursor-pointer"
            @click="selectActivity('settings')"
            title="Antigravity Settings & Permissions"
          >
            <i class="codicon codicon-settings-gear text-lg" />
          </button>
        </div>
      </nav>

      <!-- PRIMARY SIDEBAR (NATURALLY SCROLLABLE) -->
      <aside class="w-[320px] lg:w-[360px] sidebar-scrollable flex flex-col gap-3 p-3 border-r border-[#2b2b2b] bg-[#252526] overflow-y-auto shrink-0 max-h-full pb-8 text-zinc-300">
        <!-- SIDEBAR TITLE BAR -->
        <div class="flex items-center justify-between px-1 pb-1.5 border-b border-[#333333] shrink-0">
          <span class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
            {{ activeActivity === 'workspaces' ? 'WORKSPACES' : activeActivity === 'explorer' ? 'EXPLORER' : activeActivity === 'diff' ? 'SOURCE CONTROL' : activeActivity === 'history' ? 'SAVED SESSIONS' : 'AGENT WORKSPACE' }}
          </span>
          <div class="flex items-center gap-1">
            <button
              v-if="activeActivity === 'workspaces'"
              class="text-[11px] text-zinc-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#333333] flex items-center gap-1"
              @click="addWorkspaceFolder"
              title="Add workspace directory"
            >
              <i class="codicon codicon-add text-xs" />
              <span>Add</span>
            </button>
            <button
              v-if="activeActivity === 'explorer'"
              class="text-[11px] text-zinc-400 hover:text-white cursor-pointer p-1 rounded hover:bg-[#333333]"
              @click="loadWorkspaceFiles"
              title="Refresh file list"
            >
              <i class="codicon codicon-refresh text-xs" />
            </button>
            <button
              v-if="activeActivity === 'diff'"
              class="text-[11px] text-zinc-400 hover:text-white cursor-pointer p-1 rounded hover:bg-[#333333]"
              @click="loadGitDiff"
              title="Refresh Git Diff"
            >
              <i class="codicon codicon-refresh text-xs" />
            </button>
          </div>
        </div>

        <!-- WORKSPACES MANAGEMENT PANEL -->
        <div v-if="activeActivity === 'workspaces'" class="flex flex-col gap-2.5 flex-1">
          <!-- Add Workspace Section -->
          <div class="flex flex-col gap-2 p-2.5 rounded bg-[#1e1e1e] border border-[#333333]">
            <span class="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <i class="codicon codicon-folder-opened text-zinc-400" />
              <span>Add Workspace</span>
            </span>

            <button
              class="w-full py-1.5 px-3 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
              @click="addWorkspaceFolder"
            >
              <i class="codicon codicon-folder-opened text-xs" />
              <span>Browse folder from disk</span>
            </button>

            <!-- Manual Path Input -->
            <div class="flex items-center gap-1 mt-0.5">
              <input
                v-model="manualWorkspaceInput"
                class="flex-1 px-2 py-1 rounded bg-[#252526] border border-[#3e3e42] text-xs font-mono text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#007acc]"
                placeholder="D:\Projects\my-repo..."
                @keydown.enter="addManualWorkspacePath"
              />
              <button
                class="px-2 py-1 rounded bg-[#2d2d2d] hover:bg-[#383838] text-zinc-300 text-xs cursor-pointer border border-[#3e3e42]"
                title="Add path"
                @click="addManualWorkspacePath"
              >
                <i class="codicon codicon-add text-xs" />
              </button>
            </div>
          </div>

          <!-- Search Filter -->
          <div v-if="savedWorkspaces.length > 1" class="relative">
            <input
              v-model="workspaceSearchQuery"
              class="w-full pl-7 pr-2.5 py-1 rounded bg-[#1e1e1e] border border-[#333333] text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#007acc]"
              placeholder="Filter workspaces..."
            />
            <i class="codicon codicon-search absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500" />
          </div>

          <!-- Workspaces List -->
          <div class="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
            <div
              v-for="w in filteredSavedWorkspaces"
              :key="w"
              class="p-2.5 rounded border text-left flex flex-col gap-1.5 transition-all group"
              :class="w === sourceWorkspace ? 'border-[#007acc] bg-[#0e639c]/15 text-white' : 'border-[#333333] bg-[#1e1e1e] text-zinc-300 hover:border-[#444444]'"
            >
              <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <i class="codicon codicon-root-folder text-sm shrink-0" :class="w === sourceWorkspace ? 'text-[#007acc]' : 'text-zinc-400'" />
                  <span class="font-semibold text-xs truncate" :title="w">
                    {{ w.split(/[/\\]/).pop() || w }}
                  </span>
                </div>
                <span
                  v-if="w === sourceWorkspace"
                  class="px-1.5 py-0.2 rounded bg-[#0e639c] text-white text-[9px] font-mono font-semibold shrink-0 uppercase"
                >
                  Active
                </span>
              </div>

              <!-- Full Path -->
              <span class="text-[10px] font-mono text-zinc-400 truncate" :title="w">{{ w }}</span>

              <!-- Action Bar -->
              <div class="flex items-center justify-between border-t border-[#2d2d2d] pt-1.5 mt-0.5">
                <div class="flex items-center gap-1">
                  <button
                    v-if="w !== sourceWorkspace"
                    class="px-2 py-0.5 rounded bg-[#2d2d2d] hover:bg-[#383838] text-zinc-300 text-[11px] cursor-pointer"
                    @click="selectWorkspace(w)"
                  >
                    Select
                  </button>
                  <button
                    class="px-2 py-0.5 rounded bg-[#2d2d2d] hover:bg-[#383838] text-zinc-300 text-[11px] cursor-pointer flex items-center gap-1"
                    title="Open in Explorer"
                    @click="selectWorkspace(w); selectActivity('explorer')"
                  >
                    <i class="codicon codicon-files text-xs" />
                    <span>Files</span>
                  </button>
                  <button
                    class="px-2 py-0.5 rounded bg-[#2d2d2d] hover:bg-[#383838] text-zinc-300 text-[11px] cursor-pointer flex items-center gap-1"
                    title="Run Quick Setup"
                    @click="selectWorkspace(w); runQuickSetup()"
                  >
                    <i class="codicon codicon-tools text-xs" />
                    <span>Setup</span>
                  </button>
                </div>

                <button
                  class="w-5 h-5 rounded hover:bg-[#383838] text-zinc-500 hover:text-rose-400 grid place-items-center transition-colors cursor-pointer"
                  title="Remove from saved"
                  @click.stop="removeSavedWorkspace(w)"
                >
                  <i class="codicon codicon-trash text-xs" />
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="filteredSavedWorkspaces.length === 0" class="p-4 rounded bg-[#1e1e1e] border border-[#333333] text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <i class="codicon codicon-folder text-2xl text-zinc-500" />
              <p>No saved workspaces.</p>
              <button
                class="px-3 py-1 rounded bg-[#0e639c] text-white text-xs font-medium cursor-pointer hover:bg-[#1177bb]"
                @click="addWorkspaceFolder"
              >
                + Add Workspace
              </button>
            </div>
          </div>
        </div>

        <!-- EXPLORER PANEL -->
        <div v-else-if="activeActivity === 'explorer'" class="flex flex-col gap-2 flex-1">
          <p class="text-[11px] text-zinc-400 font-mono truncate px-1 flex items-center gap-1.5" :title="activeCwd">
            <i class="codicon codicon-root-folder text-zinc-400" />
            <span class="truncate font-semibold">{{ activeCwd ? activeCwd.split('\\').pop() : 'No workspace selected' }}</span>
          </p>
          <div v-if="isLoadingFiles" class="text-xs text-zinc-400 p-3 flex items-center gap-2">
            <i class="codicon codicon-loading animate-spin text-zinc-400" />
            <span>Scanning workspace files...</span>
          </div>
          <div v-else-if="workspaceFiles.length === 0" class="text-xs text-zinc-500 p-3 bg-[#1e1e1e] rounded border border-[#333333]">
            No files found or no workspace opened.
          </div>
          <div v-else class="space-y-0.5 overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-[11px]">
            <button
              v-for="f in workspaceFiles"
              :key="f.path"
              class="w-full px-2 py-1 rounded text-left flex items-center gap-1.5 transition-colors cursor-pointer truncate group"
              :class="selectedEditorFile?.path === f.path ? 'bg-[#37373d] text-white font-semibold' : 'text-zinc-300 hover:bg-[#2a2d2e] hover:text-white'"
              @click="openFileInMonaco(f)"
            >
              <i class="codicon text-xs shrink-0" :class="[getFileIconClass(f.path, f.isDir).icon, getFileIconClass(f.path, f.isDir).color]" />
              <span class="truncate">{{ f.path }}</span>
            </button>
          </div>
        </div>

        <!-- SOURCE CONTROL / GIT DIFF PANEL (AFTER CHANGES) -->
        <div v-else-if="activeActivity === 'diff'" class="flex flex-col gap-2 flex-1">
          <!-- Diff Summary Header -->
          <div class="p-2.5 rounded bg-[#1e1e1e] border border-[#333333] flex flex-col gap-1.5 shrink-0">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-zinc-200 flex items-center gap-1.5">
                <i class="codicon codicon-source-control text-zinc-400" />
                <span>Diff Inspector</span>
              </span>
              <span v-if="isLoadingDiff" class="codicon codicon-loading animate-spin text-zinc-400" />
              <button
                v-else
                class="text-[10px] text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-[#333333] cursor-pointer"
                @click="loadGitDiff"
                title="Refresh Diff"
              >
                <i class="codicon codicon-refresh" />
              </button>
            </div>

            <!-- Stats Bar -->
            <div class="flex items-center justify-between text-[11px] font-mono border-t border-[#2d2d2d] pt-1.5">
              <span class="text-zinc-400">{{ gitDiffData.diffs.length }} changed files</span>
              <div class="flex items-center gap-1.5 font-bold">
                <span class="text-emerald-400">+{{ gitDiffData.totalAdditions || 0 }}</span>
                <span class="text-rose-400">-{{ gitDiffData.totalDeletions || 0 }}</span>
              </div>
            </div>

            <!-- Action Button to Populate Handoff -->
            <button
              v-if="gitDiffData.diffs.length > 0"
              class="w-full mt-1 py-1 px-2 rounded bg-[#094771] hover:bg-[#007acc] text-white text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              @click="populateHandoffFromDiff"
              title="Insert changed files list and diff stats into handoff summary"
            >
              <i class="codicon codicon-checklist" />
              <span>Insert into Handoff Summary</span>
            </button>
          </div>

          <!-- Empty State -->
          <div v-if="gitDiffData.diffs.length === 0" class="text-xs text-zinc-400 p-4 bg-[#1e1e1e] rounded border border-[#333333] flex flex-col items-center gap-2 text-center">
            <i class="codicon codicon-check text-emerald-400 text-2xl" />
            <p class="font-medium text-zinc-300">No source code changes.</p>
            <p class="text-[11px] text-zinc-500">Working tree is clean or no files have been modified.</p>
          </div>

          <!-- Changed Files List -->
          <div v-else class="space-y-1 overflow-y-auto max-h-[calc(100vh-320px)] font-mono text-[11px]">
            <div
              v-for="d in gitDiffData.diffs"
              :key="d.file"
              class="w-full p-2 rounded text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer border group"
              :class="selectedDiffFile?.file === d.file ? 'border-[#007acc] bg-[#094771]/30 text-white' : 'border-[#333333] bg-[#1e1e1e] text-zinc-300 hover:border-[#444444]'"
              @click="openDiffInMonaco(d)"
            >
              <div class="min-w-0 flex items-center gap-1.5 flex-1">
                <i class="codicon text-xs shrink-0" :class="[getFileIconClass(d.file, false).icon, getFileIconClass(d.file, false).color]" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-zinc-200 group-hover:text-white" :title="d.file">{{ d.file.split(/[/\\]/).pop() }}</p>
                  <p class="truncate text-[9px] text-zinc-500 font-mono">{{ d.file }}</p>
                </div>
              </div>

              <!-- Stats & Revert Action -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="d.additions || d.deletions" class="text-[10px] font-mono">
                  <span class="text-emerald-400">+{{ d.additions || 0 }}</span>
                  <span class="text-rose-400 ml-0.5">-{{ d.deletions || 0 }}</span>
                </span>
                <span
                  class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 font-mono"
                  :class="d.status === 'M' ? 'bg-[#2d2d2d] text-amber-300 border border-[#3e3e42]' : d.status === 'A' ? 'bg-[#2d2d2d] text-emerald-300 border border-[#3e3e42]' : 'bg-[#2d2d2d] text-rose-300 border border-[#3e3e42]'"
                >
                  {{ d.status || 'M' }}
                </span>
                <!-- Revert Single File Button -->
                <button
                  class="w-5 h-5 rounded hover:bg-[#383838] hover:text-rose-300 text-zinc-500 grid place-items-center transition-colors cursor-pointer"
                  title="Revert this file to HEAD"
                  @click.stop="revertDiffFile(d.file)"
                >
                  <i class="codicon codicon-discard text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- DEFAULT AGENT WORKSPACE CONTROLS -->
        <template v-else>
        <!-- GUIDED WORKFLOW: choose intent, provide only the context needed, then run -->
        <div class="rounded-xl border border-[#333333] bg-[#1e1e1e] p-2.5 shrink-0 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Guided workspace</p>
              <p class="text-xs font-semibold text-zinc-100 mt-0.5">{{ workflowTitle }}</p>
            </div>
            <span class="px-2 py-1 rounded-full text-[10px] font-medium" :class="phaseTone === 'success' ? 'bg-emerald-950 text-emerald-300' : phaseTone === 'error' ? 'bg-rose-950 text-rose-300' : phaseTone === 'active' ? 'bg-amber-950 text-amber-300' : 'bg-[#252526] text-zinc-400'">{{ phaseLabel }}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              class="rounded px-3 py-2 text-left transition-colors cursor-pointer border"
              :class="workflowMode === 'discovery' ? 'bg-violet-950/60 border-violet-600 text-violet-100' : 'bg-[#252526] border-[#333333] text-zinc-400 hover:text-zinc-200'"
              @click="selectWorkflowMode('discovery')"
            >
              <span class="block text-xs font-semibold">Requirement</span>
              <span class="block mt-0.5 text-[10px] opacity-75">Input → Local Agent → Approve</span>
            </button>
            <button
              class="rounded px-3 py-2 text-left transition-colors cursor-pointer border"
              :class="workflowMode === 'task' ? 'bg-[#0e639c]/25 border-[#007acc] text-white' : 'bg-[#252526] border-[#333333] text-zinc-400 hover:text-zinc-200'"
              @click="selectWorkflowMode('task')"
            >
              <span class="block text-xs font-semibold">Task Execution</span>
              <span class="block mt-0.5 text-[10px] opacity-75">Select Task → Agent → Handoff</span>
            </button>
            <button
              class="rounded px-3 py-2 text-left transition-colors cursor-pointer border"
              :class="workflowMode === 'docs' ? 'bg-emerald-950/50 border-emerald-700 text-emerald-100' : 'bg-[#252526] border-[#333333] text-zinc-400 hover:text-zinc-200'"
              @click="selectWorkflowMode('docs')"
            >
              <span class="block text-xs font-semibold">Repo Documentation</span>
              <span class="block mt-0.5 text-[10px] opacity-75">Select Repo → Scan → Sync</span>
            </button>
          </div>
        </div>

        <div class="rounded-xl border border-[#333333] bg-[#1e1e1e] p-2.5 shrink-0 space-y-2">
          <div class="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
            <span :class="phase === 'select' || phase === 'error' ? 'text-white' : 'text-emerald-400'">1. Input</span>
            <span class="text-zinc-600">→</span>
            <span :class="phase === 'running' ? 'text-amber-300' : ['review', 'handoff'].includes(phase) ? 'text-emerald-400' : 'text-zinc-500'">2. Agent</span>
            <span class="text-zinc-600">→</span>
            <span :class="['review', 'handoff'].includes(phase) ? 'text-white' : 'text-zinc-500'">3. Review</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button class="max-w-full inline-flex items-center gap-1 rounded border border-[#333333] bg-[#252526] px-2 py-1 text-[10px] text-zinc-300 hover:text-white cursor-pointer" @click="chooseWorkspace" :title="sourceWorkspace || 'Select workspace'">
              <i class="codicon codicon-folder" /><span class="max-w-[128px] truncate">{{ sourceWorkspace ? sourceWorkspace.split(/[/\\]/).pop() : 'Select workspace' }}</span>
            </button>
            <select v-if="workflowMode !== 'task'" v-model="docsProjectId" class="max-w-[180px] rounded border border-[#333333] bg-[#252526] px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-cyan-500" :disabled="busy || !isConnected"><option :value="null" disabled>Select project</option><option v-for="project in projects || []" :key="project.id" :value="project.id">{{ project.title }}</option></select>
            <button
              class="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] cursor-pointer transition-colors"
              :class="credential ? 'border-emerald-900 bg-emerald-950/50 text-emerald-300' : 'border-amber-900 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'"
              :title="credential ? 'Task Hub Connected' : 'Click to connect Task Hub'"
              @click="!credential && startPairing()"
            >
              <i class="codicon" :class="credential ? 'codicon-plug' : 'codicon-debug-disconnect'" />
              <span>Task Hub {{ credential ? 'ready' : 'connect' }}</span>
            </button>
          </div>
          <button class="w-full flex items-center justify-between rounded-lg border border-[#333333] bg-[#252526] px-2.5 py-2 text-left hover:border-[#4b5563] cursor-pointer" @click="showAgentSettings = true">
            <span class="flex min-w-0 items-center gap-2"><i class="codicon codicon-copilot text-cyan-300" /><span class="min-w-0"><span class="block text-[10px] text-zinc-500">Local agent</span><span class="block max-w-[220px] truncate text-xs font-medium text-zinc-100">{{ provider === 'antigravity' ? 'AGY' : provider === 'claude_code' ? 'Claude' : 'Codex' }} · {{ activeModelLabel }}</span></span></span>
            <i class="codicon codicon-settings-gear text-zinc-400" />
          </button>
          <div class="flex gap-1.5">
            <button class="flex-1 rounded border border-[#333333] bg-[#252526] py-1.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer" @click="openCurrentProcess('cards')"><i class="codicon codicon-terminal mr-1" />Process</button>
            <button class="flex-1 rounded border border-[#333333] bg-[#252526] py-1.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer" @click="showActivityTimeline = true"><i class="codicon codicon-history mr-1" />Activity<span v-if="timeline.length" class="ml-1 text-zinc-500">{{ timeline.length }}</span></button>
            <button class="flex-1 rounded border border-[#333333] bg-[#252526] py-1.5 text-[10px] text-zinc-300 hover:text-white cursor-pointer" @click="openSessionHistory"><i class="codicon codicon-archive mr-1" />Sessions</button>
          </div>
        </div>

        <!-- 1. PROVIDER SELECTOR -->
        <template v-if="false">
        <div class="rounded border border-[#333333] bg-[#1e1e1e] p-2.5 shrink-0">
          <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">AI Execution Provider</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="p in ([{ id: 'codex', name: 'Codex', tag: 'Native' }, { id: 'claude_code', name: 'Claude', tag: 'Auto' }, { id: 'antigravity', name: 'AGY', tag: 'IDE' }] as const)"
              :key="p.id"
              class="px-2 py-1.5 rounded border text-xs font-medium flex flex-col items-center gap-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :class="
                provider === p.id
                  ? 'border-[#007acc] bg-[#0e639c]/25 text-white'
                  : 'border-[#333333] bg-[#252526] text-zinc-400 hover:border-[#444444] hover:text-zinc-200'
              "
              :disabled="busy || phase === 'running'"
              @click="provider = p.id"
            >
              <span>{{ p.name }}</span>
              <span class="text-[9px] font-mono px-1 rounded" :class="provider === p.id ? 'bg-[#007acc]/30 text-zinc-200' : 'bg-[#2d2d2d] text-zinc-500'">{{ p.tag }}</span>
            </button>
          </div>
        </div>

        <!-- 1.05 QUOTA & LIMITS QUICK BAR -->
        <div
          class="rounded border border-[#333333] bg-[#1e1e1e] p-2 shrink-0 flex items-center justify-between gap-2 hover:border-[#444444] transition-all cursor-pointer group"
          @click="openModelsAndUsageModal"
          title="View and manage Models & Quota Usage"
        >
          <div class="flex items-center gap-2 min-w-0">
            <i class="codicon codicon-dashboard text-zinc-400 text-sm shrink-0" />
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">Models & Quota</span>
                <span class="text-[8px] font-mono px-1 rounded bg-[#2d2d2d] text-zinc-400 font-medium shrink-0">{{ activeQuotaGroup.name }}</span>
              </div>
              <span class="text-[10px] text-zinc-400 truncate">
                5h: <strong class="text-zinc-200 font-mono">{{ activeQuotaGroup.fiveHourRemainingPercent }}%</strong> · Weekly: <strong class="text-zinc-200 font-mono">{{ activeQuotaGroup.weeklyRemainingPercent }}%</strong>
              </span>
            </div>
          </div>
          <i class="codicon codicon-chevron-right text-zinc-500 text-xs" />
        </div>

        <!-- 1.1 AI MODEL SELECTOR -->
        <div class="rounded border border-[#333333] bg-[#1e1e1e] p-2.5 flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <button class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer" @click="collapsed.model = !collapsed.model">
                <i class="codicon text-xs" :class="collapsed.model ? 'codicon-chevron-right' : 'codicon-chevron-down'" />
                Model
              </button>
              <span class="text-[9px] font-mono text-zinc-500">({{ filteredProviderModels.length }})</span>
              <span
                v-if="modelSyncTimestamp"
                class="text-[8px] font-mono text-zinc-400 px-1 py-0.2 rounded bg-[#2d2d2d] border border-[#3e3e42]"
                :title="`Synced from Task Hub & CLI at ${modelSyncTimestamp}`"
              >
                ● {{ modelSyncSource === 'live' ? 'Live' : 'Synced' }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <!-- Auto-sync / Refresh Models Button -->
              <button
                class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors cursor-pointer border flex items-center gap-1 bg-[#252526] border-[#333333] text-zinc-400 hover:text-white hover:border-[#444444] disabled:opacity-50"
                :disabled="isSyncingModels || busy || phase === 'running'"
                @click="syncAvailableModels(true)"
                title="Scan and fetch latest model list from Task Hub & CLI"
              >
                <i class="codicon codicon-refresh text-xs" :class="isSyncingModels ? 'animate-spin' : ''" />
                <span>{{ isSyncingModels ? 'Scanning...' : 'Sync' }}</span>
              </button>

              <button
                class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors cursor-pointer border flex items-center gap-1"
                :class="isCustomModel[provider] ? 'bg-[#0e639c]/30 border-[#007acc] text-white' : 'bg-[#252526] border-[#333333] text-zinc-400 hover:text-zinc-200'"
                @click="toggleCustomModelMode"
                :title="isCustomModel[provider] ? 'Switch to presets' : 'Enter custom model ID'"
              >
                <i class="codicon codicon-edit text-xs" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          <template v-if="!collapsed.model">
          <!-- Quick Search Filter -->
          <div v-if="!isCustomModel[provider]" class="relative">
            <input
              v-model="modelSearchQuery"
              class="w-full pl-7 pr-6 py-1 rounded bg-[#252526] border border-[#333333] text-[11px] text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#007acc] transition-colors"
              placeholder="Filter models..."
            />
            <i class="codicon codicon-search absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500" />
            <button
              v-if="modelSearchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
              @click="modelSearchQuery = ''"
            >
              <i class="codicon codicon-close" />
            </button>
          </div>

          <!-- IDE-Style Model List Items -->
          <div
            v-if="!isCustomModel[provider]"
            class="space-y-1 max-h-[220px] overflow-y-auto pr-0.5 sidebar-scrollable"
          >
            <div
              v-for="m in filteredProviderModels"
              :key="m.id"
              class="w-full px-2 py-1.5 rounded border text-left flex items-center justify-between gap-2 transition-all cursor-pointer group"
              :class="
                !isCustomModel[provider] && activeModel === m.id
                  ? 'border-[#007acc] bg-[#0e639c]/20 text-white'
                  : 'border-[#333333] bg-[#252526] text-zinc-300 hover:border-[#444444]'
              "
              @click="selectModel(m.id)"
            >
              <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-medium truncate group-hover:text-white" :class="activeModel === m.id ? 'text-white font-semibold' : 'text-zinc-300'">
                    {{ m.name }}
                  </span>
                  <span v-if="m.source === 'hub'" class="text-[8px] font-mono px-1 rounded bg-[#2d2d2d] text-zinc-400 border border-[#3e3e42] shrink-0">
                    HUB
                  </span>
                  <span v-else-if="m.source === 'custom'" class="text-[8px] font-mono px-1 rounded bg-[#2d2d2d] text-zinc-400 border border-[#3e3e42] shrink-0">
                    SAVED
                  </span>
                </div>
                <span class="text-[9px] font-mono text-zinc-500 truncate">{{ m.id }}</span>
              </div>

              <!-- Multi-Badge Pills -->
              <div class="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                <span
                  v-for="b in (m.badges || [m.badge].filter(Boolean))"
                  :key="b"
                  class="text-[8px] font-mono px-1 py-0.2 rounded border font-medium uppercase tracking-tight"
                  :class="getBadgeClass(b)"
                >
                  {{ b }}
                </span>

                <!-- Delete button for custom saved models -->
                <button
                  v-if="m.source === 'custom'"
                  class="text-zinc-500 hover:text-rose-400 p-0.5 ml-0.5 cursor-pointer"
                  title="Delete this custom model"
                  @click.stop="deleteCustomModelOption(m.id)"
                >
                  <i class="codicon codicon-trash text-xs" />
                </button>

                <!-- Selected Checkmark Icon -->
                <i
                  v-if="activeModel === m.id"
                  class="codicon codicon-check text-xs text-[#007acc] ml-0.5 shrink-0 font-bold"
                />
              </div>
            </div>

            <div v-if="filteredProviderModels.length === 0" class="text-center py-3 text-[10px] text-zinc-500 italic">
              No matching models found.
            </div>
          </div>

          <!-- Custom Model Free Text Input Mode -->
          <div v-if="isCustomModel[provider]" class="pt-1 flex flex-col gap-2">
            <div class="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
              <span>Custom Model ID:</span>
              <span class="text-zinc-500 font-mono text-[9px]">{{ provider === 'codex' ? '-m' : '--model' }}</span>
            </div>
            <div class="flex items-center gap-1">
              <input
                :value="customModelInput[provider]"
                @input="setCustomModel(($event.target as HTMLInputElement).value)"
                class="w-full px-2.5 py-1.5 rounded border border-[#3e3e42] bg-[#252526] text-xs font-mono text-zinc-200 placeholder-zinc-600 outline-none focus:border-[#007acc] transition-colors flex-1"
                :placeholder="provider === 'codex' ? 'vd: gpt-5.6-sol, gpt-4o-mini...' : provider === 'claude_code' ? 'vd: claude-3-7-sonnet...' : 'vd: gemini-2.5-flash...'"
                :disabled="busy || phase === 'running'"
              />
              <button
                v-if="customModelInput[provider]?.trim()"
                class="px-2 py-1.5 rounded border border-[#3e3e42] bg-[#2d2d2d] hover:bg-[#383838] text-zinc-200 text-xs font-medium shrink-0 cursor-pointer transition-colors flex items-center gap-1"
                @click="saveCustomModelOption"
                title="Save model to list"
              >
                <i class="codicon codicon-save text-xs" />
                <span>Save</span>
              </button>
            </div>
          </div>
          </template>
        </div>
        </template>

        <!-- 2. REPOSITORY WORKSPACE -->
        <div v-if="false && (workflowMode === 'docs' || workflowMode === 'task')" class="rounded border border-[#333333] bg-[#1e1e1e] p-2.5 flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between">
            <button class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer" @click="collapsed.workspace = !collapsed.workspace">
              <i class="codicon text-xs" :class="collapsed.workspace ? 'codicon-chevron-right' : 'codicon-chevron-down'" />
              Workspace
            </button>
            <div class="flex items-center gap-1">
              <button
                class="px-2 py-0.5 rounded border border-[#333333] bg-[#252526] hover:bg-[#2d2d2d] text-[10px] text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                @click="selectActivity('workspaces')"
                title="Manage all workspaces"
              >
                <i class="codicon codicon-root-folder text-xs" />
                <span>Manage</span>
              </button>
              <button
                class="px-2 py-0.5 rounded border border-[#333333] bg-[#252526] hover:bg-[#2d2d2d] text-[10px] text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                @click="chooseWorkspace"
                title="Select directory"
              >
                <i class="codicon codicon-folder text-xs" />
                <span>Change</span>
              </button>
            </div>
          </div>

          <template v-if="!collapsed.workspace">
          <div class="p-2 rounded bg-[#252526] border border-[#333333] flex items-center gap-2">
            <i class="codicon codicon-root-folder text-zinc-400 text-xs shrink-0" />
            <span class="text-xs font-mono text-zinc-300 truncate flex-1" :title="sourceWorkspace || 'No repository selected'">
              {{ sourceWorkspace || 'No repository selected' }}
            </span>
          </div>

          <!-- SAVED WORKSPACES QUICK BAR -->
          <div v-if="savedWorkspaces.length > 0" class="pt-0.5">
            <div class="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
              <span>Saved ({{ savedWorkspaces.length }}):</span>
            </div>
            <div class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              <div
                v-for="w in savedWorkspaces"
                :key="w"
                class="group flex items-center gap-1 pl-2 pr-1 py-0.5 rounded border text-[10px] transition-colors cursor-pointer"
                :class="w === sourceWorkspace ? 'border-[#007acc] bg-[#0e639c]/20 text-white' : 'border-[#333333] bg-[#252526] text-zinc-400 hover:border-[#444444] hover:text-zinc-200'"
                @click="selectWorkspace(w)"
              >
                <span class="truncate max-w-[110px]" :title="w">{{ w.split(/[/\\]/).pop() || w }}</span>
                <button
                  class="w-3.5 h-3.5 rounded grid place-items-center hover:bg-[#383838] hover:text-rose-400 text-zinc-500 transition-colors"
                  title="Remove"
                  @click.stop="removeSavedWorkspace(w)"
                >
                  <i class="codicon codicon-close text-[8px]" />
                </button>
              </div>
            </div>
          </div>
          </template>
        </div>

        <!-- 3. TASK HUB & TASK SELECTOR -->
        <div v-if="workflowMode === 'task'" class="rounded border border-[#333333] bg-[#1e1e1e] p-2.5 flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between">
            <button class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer" @click="collapsed.tasks = !collapsed.tasks">
              <i class="codicon text-xs" :class="collapsed.tasks ? 'codicon-chevron-right' : 'codicon-chevron-down'" />
              Task Hub Work Items
            </button>
            <div class="flex items-center gap-1.5">
              <button
                class="p-0.5 rounded text-[10px] text-zinc-400 hover:text-white hover:bg-[#333333] transition-colors flex items-center gap-1 cursor-pointer"
                title="Refresh tasks from Task Hub"
                @click="refreshAgentTasks"
              >
                <i class="codicon codicon-refresh" :class="{ 'animate-spin': isRefreshingTasks }" />
              </button>
              <span class="text-[10px] font-mono text-zinc-400">{{ filteredTasks.length }} tasks</span>
            </div>
          </div>

          <template v-if="!collapsed.tasks">
          <div class="relative">
            <input
              v-model="taskSearch"
              class="w-full pl-7 pr-2.5 py-1 rounded border border-[#333333] bg-[#252526] text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#007acc] transition-colors"
              placeholder="Search by title, issue key..."
              :disabled="busy"
            />
            <i class="codicon codicon-search absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500" />
          </div>

          <div v-if="!credential && !isConnected" class="p-2.5 rounded border border-[#333333] bg-[#252526] text-[11px] text-zinc-300 flex flex-col gap-2">
            <div class="flex items-center gap-1.5 text-amber-400 font-semibold">
              <i class="codicon codicon-warning" />
              <span>Task Hub Not Connected</span>
            </div>
            <p class="text-[10px] text-zinc-400 leading-tight">Pair with Task Hub to synchronize tasks, active sprint, and AI context packs.</p>
            <button
              class="w-full py-1.5 px-2.5 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              :disabled="phase === 'pairing'"
              @click="startPairing"
            >
              <i class="codicon" :class="phase === 'pairing' ? 'codicon-loading animate-spin' : 'codicon-link'" />
              <span>{{ phase === 'pairing' ? 'Awaiting Approval...' : 'Connect Task Hub' }}</span>
            </button>
          </div>
          <div v-else-if="filteredTasks.length === 0" class="p-2.5 text-center rounded border border-[#333333] bg-[#252526] text-[11px] text-zinc-400 flex flex-col gap-2">
            <span>No tasks loaded yet.</span>
            <button
              class="w-full py-1 px-2 rounded bg-[#2d2d2d] hover:bg-[#383838] text-zinc-200 text-xs font-medium border border-[#3e3e42] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              :disabled="phase === 'pairing' || isRefreshingTasks"
              @click="refreshAgentTasks"
            >
              <i class="codicon codicon-refresh" :class="{ 'animate-spin': isRefreshingTasks }" />
              <span>Refresh Tasks</span>
            </button>
          </div>
          <div v-else class="max-h-28 overflow-y-auto space-y-1 pr-0.5">
            <button
              v-for="task in filteredTasks"
              :key="task.id"
              class="w-full p-2 rounded border text-left text-xs transition-all cursor-pointer flex flex-col gap-1"
              :class="
                task.id === taskId
                  ? 'border-[#007acc] bg-[#0e639c]/20 text-white'
                  : 'border-[#333333] bg-[#252526] text-zinc-300 hover:border-[#444444]'
              "
              @click="taskId = task.id"
            >
              <div class="flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span
                    class="px-1 py-0.2 rounded text-[9px] font-bold font-mono uppercase border"
                    :class="
                      task.issue_type === 'epic'
                        ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                        : task.issue_type === 'story'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : task.issue_type === 'bug'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                        : 'bg-blue-950/80 text-blue-300 border-blue-800'
                    "
                  >
                    {{ task.issue_type === 'epic' ? '⚡ EPIC' : task.issue_type === 'story' ? '📖 STORY' : task.issue_type === 'bug' ? '🐞 BUG' : '☑️ TASK' }}
                  </span>
                  <span class="font-mono font-bold text-[11px] truncate" :class="task.id === taskId ? 'text-white' : 'text-zinc-400'">
                    {{ task.issue_key || `#${task.id}` }}
                  </span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <span v-if="task.story_points" class="font-mono font-bold text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                    {{ task.story_points }} pts
                  </span>
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-[#2d2d2d] text-zinc-300 border border-[#3e3e42]">
                    {{ task.status }}
                  </span>
                </div>
              </div>
              <p class="text-xs text-zinc-200 truncate font-medium">{{ task.title }}</p>
              <div v-if="task.epic" class="text-[10px] text-purple-300/80 truncate flex items-center gap-1">
                <span>⚡ {{ task.epic.title || task.epic.issue_key }}</span>
              </div>
            </button>
          </div>

          <!-- SELECTED TASK PREVIEW -->
          <div v-if="selectedTask" class="p-2 rounded border border-[#007acc]/40 bg-[#0e639c]/10 text-xs">
            <div class="font-semibold text-white flex items-center justify-between gap-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border"
                  :class="
                    selectedTask.issue_type === 'epic'
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                      : selectedTask.issue_type === 'story'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : selectedTask.issue_type === 'bug'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                      : 'bg-blue-950/80 text-blue-300 border-blue-800'
                  "
                >
                  {{ selectedTask.issue_type === 'epic' ? '⚡ EPIC' : selectedTask.issue_type === 'story' ? '📖 STORY' : selectedTask.issue_type === 'bug' ? '🐞 BUG' : '☑️ TASK' }}
                </span>
                <span class="font-mono">{{ selectedTask.issue_key || `#${selectedTask.id}` }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="selectedTask.story_points" class="font-mono text-[10px] font-bold text-indigo-300 px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800/80">{{ selectedTask.story_points }} pts</span>
                <span class="text-[10px] text-zinc-400">{{ selectedTask.project?.title || 'Project' }}</span>
              </div>
            </div>
            <p class="text-zinc-300 text-[11px] mt-1 font-medium">{{ selectedTask.title }}</p>
            <div v-if="selectedTask.epic" class="text-[10px] text-purple-300 mt-1 flex items-center gap-1">
              <span>Parent Epic: ⚡ {{ selectedTask.epic.title || selectedTask.epic.issue_key }}</span>
            </div>
            <p v-if="selectedTask.acceptance_criteria" class="text-zinc-400 text-[10px] mt-1 line-clamp-2 italic">
              {{ selectedTask.acceptance_criteria }}
            </p>
          </div>
          </template>
        </div>

        <!-- 4. QUICK ACTION: DOCS GENERATOR -->
        <div v-if="false && workflowMode === 'discovery'" class="rounded border border-violet-900/80 bg-[#1e1e1e] p-2.5 shrink-0 flex flex-col gap-2">
          <div class="text-xs font-semibold text-violet-100 flex items-center gap-1.5">
            <i class="codicon codicon-lightbulb" /> Requirement Discovery
          </div>
          <p class="text-[10px] text-zinc-400">Specify desired outcome. Local agent reads repo, docs, and Task Hub MCP; backlog will only be created upon your approval.</p>
          <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Repo / Project</label>
          <select v-model="docsProjectId" class="w-full rounded border border-[#333333] bg-[#252526] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500" :disabled="busy || !isConnected">
            <option :value="null" disabled>Select Repo / Project</option>
            <option v-for="project in projects || []" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select>
          <textarea v-model="requirementText" rows="3" class="w-full rounded border border-[#333333] bg-[#252526] px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-violet-500" placeholder="E.g., Add Google login for authenticated users." :disabled="busy" />
          <button class="w-full py-1.5 px-3 rounded bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50" :disabled="busy || !docsProjectId || !requirementText.trim()" @click="() => startRequirementDiscovery()">
            Analyze with Local Agent
          </button>
        </div>

        <div v-if="false && workflowMode === 'docs'" class="rounded border border-emerald-900/80 bg-[#1e1e1e] p-2.5 shrink-0 flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <button class="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer" @click="collapsed.docs = !collapsed.docs">
              <i class="codicon text-xs" :class="collapsed.docs ? 'codicon-chevron-right' : 'codicon-chevron-down'" />
              <i class="codicon codicon-book text-zinc-400" />
              <span>Repo Documentation</span>
            </button>
          </div>
          <template v-if="!collapsed.docs">
          <p class="text-[10px] text-zinc-400 leading-relaxed">
            Select Repo/Project; the agent scans repo and updates standard documentation in <code>docs/</code>.
          </p>
          <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Task Hub Repo / Project</label>
          <select
            v-model="docsProjectId"
            class="w-full rounded border border-[#333333] bg-[#252526] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-600"
            :disabled="busy || !isConnected"
          >
            <option :value="null" disabled>Select Repo / Project</option>
            <option v-for="project in projects || []" :key="project.id" :value="project.id">{{ project.title }}</option>
          </select>
          <p v-if="selectedDocsProject" class="text-[10px] text-emerald-300">Standard docs will belong to Repo/Project: {{ selectedDocsProject?.title }}</p>
          <p v-if="!isConnected" class="text-[10px] text-amber-300">Connect Task Hub to select Repo/Project and sync docs.</p>
          <button
            class="w-full py-1.5 px-3 rounded border border-[#333333] bg-[#252526] hover:bg-[#2d2d2d] text-zinc-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            :disabled="busy || phase === 'running' || !docsProjectId"
            @click="() => startDocsGeneration()"
          >
            Scan & Generate Docs
          </button>
          </template>
        </div>

        <!-- 5. TIMELINE FEED -->
        <div v-if="false" class="rounded border border-[#333333] bg-[#1e1e1e] p-2.5 flex flex-col min-h-[200px] shrink-0">
          <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-[#2d2d2d]">
            <button class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer" @click="collapsed.timeline = !collapsed.timeline">
              <i class="codicon text-xs" :class="collapsed.timeline ? 'codicon-chevron-right' : 'codicon-chevron-down'" />
              <i class="codicon codicon-history text-xs" />
              <span>Activity Timeline</span>
            </button>
            <span class="text-[9px] font-mono text-zinc-400 bg-[#252526] px-1.5 py-0.5 rounded">{{ timeline.length }}</span>
          </div>
          <div v-if="collapsed.timeline" class="text-[10px] text-zinc-500">Expand to view activity timeline.</div>
          <template v-else>
          <div class="space-y-1.5 overflow-y-auto max-h-[260px] pr-0.5">
            <div v-if="timeline.length === 0" class="text-[10px] text-zinc-500 text-center py-6 italic">
              No events recorded.
            </div>
            <div
              v-for="item in timeline"
              :key="item.id"
              class="p-2 rounded bg-[#252526] border border-[#333333] text-[10px] flex flex-col gap-0.5"
            >
              <div class="flex items-center justify-between">
                <span
                  class="font-semibold"
                  :class="
                    item.tone === 'ok' || item.tone === 'passed'
                      ? 'text-emerald-400'
                      : item.tone === 'failed' || item.tone === 'error'
                      ? 'text-rose-400'
                      : item.tone === 'warning'
                      ? 'text-amber-400'
                      : 'text-zinc-200'
                  "
                >
                  {{ item.label }}
                </span>
                <span class="font-mono text-[9px] text-zinc-500">{{ item.time }}</span>
              </div>
              <p class="text-zinc-400 break-words leading-tight">{{ item.detail }}</p>
            </div>
          </div>
          </template>
        </div>
        </template>
      </aside>

      <!-- RIGHT STUDIO / TERMINAL / MONACO OUTPUT AREA -->
      <main class="flex flex-col min-h-0 bg-[#1e1e1e] overflow-hidden flex-1">
        <!-- 2. VS CODE EDITOR TABS BAR -->
        <div class="h-9 bg-[#252526] border-b border-[#1e1e1e] flex items-center justify-between px-2 shrink-0 select-none overflow-x-auto">
          <div class="flex items-center gap-1 h-full">
            <!-- Terminal Tab -->
            <button
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'terminal' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'terminal'"
            >
              <i class="codicon codicon-terminal text-cyan-400" />
              <span>Terminal / Stream</span>
            </button>

            <!-- Monaco Code & Diff Tab -->
            <button
              v-if="workflowMode === 'task'"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'monaco' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'monaco'"
            >
              <i class="codicon" :class="selectedDiffFile ? 'codicon-diff text-cyan-400' : 'codicon-file-code text-blue-400'" />
              <span class="max-w-[180px] truncate">{{ selectedDiffFile?.file || selectedEditorFile?.path || 'Monaco Diff & Editor' }}</span>
              <span
                v-if="gitDiffData.diffs.length > 0 && !selectedEditorFile"
                class="px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-800/80 text-[9px] text-emerald-300 font-mono font-bold"
                title="Total additions and deletions"
              >
                +{{ gitDiffData.totalAdditions || 0 }} -{{ gitDiffData.totalDeletions || 0 }}
              </span>
              <span
                v-if="selectedDiffFile || selectedEditorFile"
                class="hover:bg-[#3e3e42] p-0.5 rounded text-[10px] text-zinc-400 hover:text-white"
                @click.stop="selectedDiffFile = null; selectedEditorFile = null; activeEditorTab = 'terminal'"
              >
                ✕
              </span>
            </button>

            <!-- Context Tab -->
            <button
              v-if="workflowMode === 'task' && showAdvancedTools"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'context' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'context'"
            >
              <i class="codicon codicon-book text-amber-400" />
              <span>Task Context</span>
            </button>

            <!-- Subagents Swarm Tab -->
            <button
              v-if="workflowMode === 'task' && showAdvancedTools"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'subagents' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'subagents'"
              title="Antigravity 2.0 Subagents Swarm"
            >
              <i class="codicon codicon-organization text-violet-400" />
              <span>Subagents ({{ activeSubagents.length }})</span>
            </button>

            <!-- Tasks & Scheduler Tab -->
            <button
              v-if="workflowMode === 'task' && showAdvancedTools"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'tasks' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'tasks'"
              title="Background Tasks & Timers"
            >
              <i class="codicon codicon-history text-amber-400" />
              <span>Tasks & Timers</span>
            </button>

            <!-- Artifacts Tab -->
            <button
              v-if="workflowMode === 'docs'"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'artifacts' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'artifacts'"
              title="Generated Artifacts & Documents"
            >
              <i class="codicon codicon-package text-emerald-400" />
              <span>Artifacts</span>
            </button>

            <!-- Evidence Tab -->
            <button
              v-if="workflowMode === 'task'"
              class="h-full px-3 text-xs font-medium flex items-center gap-2 border-r border-[#1e1e1e] transition-colors cursor-pointer"
              :class="activeEditorTab === 'evidence' ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
              @click="activeEditorTab = 'evidence'"
            >
              <i class="codicon codicon-shield text-emerald-400" />
              <span>Evidence & Review</span>
            </button>
          </div>

          <!-- Quick Actions on Tab Bar -->
          <div class="flex items-center gap-2">
            <button
              v-if="workflowMode === 'task'"
              class="text-[10px] px-2 py-0.5 rounded bg-[#333333] hover:bg-[#3e3e42] text-zinc-300 transition-colors cursor-pointer"
              @click="showAdvancedTools = !showAdvancedTools"
            >
              {{ showAdvancedTools ? 'Hide Advanced' : 'Advanced Tools' }}
            </button>
            <button
              v-if="workflowMode === 'task'"
              class="text-[10px] px-2 py-0.5 rounded bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 border border-[#3e3e42]"
              @click="loadGitDiff(); activeEditorTab = 'monaco';"
              title="Reload Git Diff in Monaco Diff Viewer"
            >
              <i class="codicon codicon-diff" />
              <span>Git Diff ({{ gitDiffData.diffs.length }})</span>
            </button>
          </div>
        </div>

        <!-- VS CODE BREADCRUMBS BAR -->
        <div class="h-6 px-3 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 shrink-0 select-none overflow-x-auto">
          <span>{{ activeCwd ? activeCwd.split('\\').pop() : 'workspace' }}</span>
          <span class="text-zinc-600">›</span>
          <span v-if="selectedDiffFile?.file || selectedEditorFile?.path" class="text-zinc-300 font-semibold truncate flex items-center gap-1">
            <i class="codicon text-xs" :class="selectedDiffFile ? 'codicon-diff text-cyan-400' : 'codicon-file-code text-blue-400'" />
            <span>{{ selectedDiffFile?.file || selectedEditorFile?.path }}</span>
          </span>
          <span v-else class="text-zinc-500 italic">
            {{ activeEditorTab === 'terminal' ? 'terminal-output.sh' : activeEditorTab === 'context' ? 'task-specification.md' : 'handoff-evidence.md' }}
          </span>
        </div>

        <!-- POST-CHANGE DIFF NOTIFICATION BANNER -->
        <div
          v-if="gitDiffData.diffs.length > 0 && ['running', 'handoff', 'review'].includes(phase)"
          class="px-3 py-1.5 bg-[#094771]/30 border-b border-[#007acc]/40 flex items-center justify-between text-xs shrink-0 select-none"
        >
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span class="text-zinc-200 font-semibold">
              Agent modified <strong class="text-cyan-300">{{ gitDiffData.diffs.length }} files</strong>:
            </span>
            <span class="text-[11px] font-mono">
              <span class="text-emerald-400 font-bold">+{{ gitDiffData.totalAdditions || 0 }}</span> /
              <span class="text-rose-400 font-bold">-{{ gitDiffData.totalDeletions || 0 }}</span> lines
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="px-2 py-0.5 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              @click="activeEditorTab = 'monaco'; if (!selectedDiffFile && gitDiffData.diffs.length) selectedDiffFile = gitDiffData.diffs[0];"
            >
              <i class="codicon codicon-diff" />
              <span>Inspect Diff</span>
            </button>
            <button
              v-if="phase === 'handoff' || phase === 'review'"
              class="px-2 py-0.5 rounded bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 border border-[#3e3e42]"
              @click="populateHandoffFromDiff"
            >
              <i class="codicon codicon-checklist" />
              <span>Insert Handoff</span>
            </button>
          </div>
        </div>

        <!-- MONACO CODE / DIFF VIEW TAB CONTENT -->
        <div v-show="activeEditorTab === 'monaco'" class="flex-1 min-h-0 w-full h-full bg-[#1e1e1e]">
          <MonacoEditorView
            v-if="selectedDiffFile"
            mode="diff"
            :original-content="selectedDiffFile.original"
            :modified-content="selectedDiffFile.modified"
            :filename="selectedDiffFile.file"
            :read-only="true"
          />
          <MonacoEditorView
            v-else-if="selectedEditorFile"
            mode="editor"
            :content="selectedEditorFile.content"
            :filename="selectedEditorFile.path"
            :read-only="false"
          />
          <div v-else class="flex flex-col items-center justify-center h-full text-zinc-400 gap-3 p-6 select-none">
            <i class="codicon codicon-file text-4xl text-zinc-300" />
            <p class="text-sm text-center max-w-md text-zinc-300">
              Select a file from Explorer or Source Control to view and edit with Monaco Editor.
            </p>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs"
                @click="selectActivity('diff')"
              >
                <i class="codicon codicon-diff mr-1" />View Git Diff Changes
              </button>
              <button
                class="px-3 py-1.5 rounded-lg bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 text-xs font-semibold cursor-pointer border border-[#444444]"
                @click="selectActivity('explorer')"
              >
                <i class="codicon codicon-folder-opened mr-1" />Open File Explorer
              </button>
            </div>
          </div>
        </div>

        <!-- CONTEXT TAB CONTENT -->
        <div v-show="activeEditorTab === 'context'" class="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          <div class="border-b border-[#333333] pb-3">
            <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <i class="codicon codicon-run text-zinc-200" />
              Task Context & Environment Details
            </h3>
            <p class="text-slate-400 text-xs mt-1 leading-relaxed">
              Detailed information on repository, branch, isolated worktree, and execution context.
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-if="worktree" class="p-3 rounded-lg border border-slate-700/80 bg-slate-950 flex flex-col gap-1 font-mono text-[11px]">
              <div class="text-slate-400">Isolated Worktree Path:</div>
              <div class="text-cyan-300 font-semibold break-all">{{ worktree }}</div>
            </div>
            <div class="p-3 rounded-lg border border-slate-700/80 bg-slate-950 flex flex-col gap-1 font-mono text-[11px]" :class="!worktree ? 'sm:col-span-2' : ''">
              <div class="text-slate-400">Active Workspace:</div>
              <div class="text-cyan-300 font-semibold break-all">{{ activeCwd || 'None selected' }}</div>
            </div>
          </div>
          <div v-if="selectedTask" class="p-4 rounded-xl border border-[#333333] bg-[#252526] flex flex-col gap-2.5">
            <div class="flex items-center justify-between font-bold text-sky-300 flex-wrap gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                  :class="
                    selectedTask.issue_type === 'epic'
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                      : selectedTask.issue_type === 'story'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : selectedTask.issue_type === 'bug'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                      : 'bg-blue-950/80 text-blue-300 border-blue-800'
                  "
                >
                  {{ selectedTask.issue_type === 'epic' ? '⚡ EPIC' : selectedTask.issue_type === 'story' ? '📖 STORY' : selectedTask.issue_type === 'bug' ? '🐞 BUG' : '☑️ TASK' }}
                </span>
                <span class="font-mono text-white">{{ selectedTask.issue_key || `#${selectedTask.id}` }}</span>
                <span class="text-zinc-200">· {{ selectedTask.title }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="selectedTask.story_points" class="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold">
                  {{ selectedTask.story_points }} pts
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-200 uppercase">
                  {{ selectedTask.status }}
                </span>
              </div>
            </div>
            <div v-if="selectedTask.epic" class="text-xs text-purple-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50">
              <span class="font-bold">Parent Epic:</span>
              <span>⚡ {{ selectedTask.epic.issue_key ? `${selectedTask.epic.issue_key} — ` : '' }}{{ selectedTask.epic.title }}</span>
            </div>
            <p v-if="selectedTask.description" class="text-zinc-300 whitespace-pre-wrap">{{ selectedTask.description }}</p>
            <div v-if="selectedTask.acceptance_criteria" class="p-2.5 rounded-lg bg-[#1e1e1e] border border-[#333333] text-zinc-400 text-[11px]">
              <div class="font-bold text-zinc-300 mb-1">Acceptance Criteria:</div>
              {{ selectedTask.acceptance_criteria }}
            </div>
          </div>
        </div>

        <!-- EVIDENCE TAB CONTENT -->
        <div v-show="activeEditorTab === 'evidence'" class="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          <div class="border-b border-[#333333] pb-3 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <i class="codicon codicon-shield text-zinc-200" />
              Verification Evidence & Review Summary
            </h3>
            <span class="text-xs text-zinc-400 font-mono">Status: {{ phase }}</span>
          </div>
          <div class="space-y-3">
            <div class="p-3.5 rounded-xl border border-[#333333] bg-[#252526] flex flex-col gap-2">
              <h4 class="font-bold text-zinc-200">Handoff Summary</h4>
              <textarea
                v-model="handoff.summary"
                rows="4"
                class="w-full p-2.5 rounded-lg border border-[#333333] bg-[#1e1e1e] text-zinc-200 text-xs font-mono outline-none focus:border-[#007acc]"
                placeholder="Summary of work and outcomes..."
              />
            </div>
            <div class="p-3.5 rounded-xl border border-[#333333] bg-[#252526] flex flex-col gap-2">
              <h4 class="font-bold text-zinc-200">Changed Files</h4>
              <textarea
                v-model="handoff.changedFiles"
                rows="3"
                class="w-full p-2.5 rounded-lg border border-[#333333] bg-[#1e1e1e] text-zinc-200 text-xs font-mono outline-none focus:border-[#007acc]"
                placeholder="Changed files list..."
              />
            </div>
          </div>
        </div>

        <!-- SUBAGENTS SWARM TAB CONTENT -->
        <div v-show="activeEditorTab === 'subagents'" class="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 text-xs bg-[#1e1e1e]">
          <div class="border-b border-[#333333] pb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <i class="codicon codicon-organization text-violet-400" />
                <span>Antigravity 2.0 · Autonomous Subagents Swarm</span>
              </h3>
              <p class="text-slate-400 text-xs mt-0.5">
                Specialized subagents coordinated in parallel isolated workspaces.
              </p>
            </div>
            <button
              class="px-2.5 py-1 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
              @click="followUp = '/teamwork-preview '; activeEditorTab = 'terminal';"
            >
              <i class="codicon codicon-add" />
              <span>Spawn Subagent</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="sub in activeSubagents"
              :key="sub.id"
              class="p-3.5 rounded-xl border border-[#3e3e42] bg-[#252526] flex flex-col gap-2 shadow-xs"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" :class="sub.state === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'" />
                  <h4 class="font-bold text-xs text-zinc-100">{{ sub.role }}</h4>
                </div>
                <span class="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase bg-[#333333] text-zinc-300">
                  {{ sub.type }}
                </span>
              </div>

              <div class="text-[11px] text-zinc-400 font-mono">
                Model: <span class="text-cyan-300">{{ sub.model }}</span> · ID: <span class="text-zinc-500">{{ sub.id }}</span>
              </div>

              <p class="text-xs text-zinc-300 bg-[#1e1e1e] p-2 rounded-lg border border-[#333333]">
                {{ sub.stateDetail || 'Ready to receive tasks...' }}
              </p>
            </div>
          </div>
        </div>

        <!-- TASKS & TIMERS TAB CONTENT -->
        <div v-show="activeEditorTab === 'tasks'" class="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 text-xs bg-[#1e1e1e]">
          <div class="border-b border-[#333333] pb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <i class="codicon codicon-history text-amber-400" />
                <span>Background Tasks & Scheduled Timers</span>
              </h3>
              <p class="text-slate-400 text-xs mt-0.5">
                Manage background processes, cron schedules, and timers.
              </p>
            </div>
            <button
              class="px-2.5 py-1 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
              @click="showScheduledTasksModal = true"
            >
              <i class="codicon codicon-add" />
              <span>Schedule Task</span>
            </button>
          </div>

          <div class="space-y-3">
            <div class="p-3 rounded-xl bg-[#252526] border border-[#3e3e42] flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <i class="codicon codicon-pulse text-emerald-400" />
                <div>
                  <h4 class="font-bold text-xs text-zinc-100">Antigravity Reactive Wakeup Service</h4>
                  <p class="text-[11px] text-zinc-400">Automatic wake-up on subagent messages or background task completion.</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-300 font-mono font-semibold">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        <!-- ARTIFACTS TAB CONTENT -->
        <div v-show="activeEditorTab === 'artifacts'" class="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4 text-xs bg-[#1e1e1e]">
          <div class="border-b border-[#333333] pb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <i class="codicon codicon-package text-emerald-400" />
                <span>Antigravity Generated Artifacts & Documents</span>
              </h3>
              <p class="text-slate-400 text-xs mt-0.5">
                Implementation plans, walkthrough handoffs, and architecture reports.
              </p>
            </div>
            <button
              class="px-2.5 py-1 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs"
              @click="applyDocsToWorkspace"
            >
              Save All to Workspace
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="art in [
                { name: 'walkthrough.md', title: 'Walkthrough Summary', desc: 'Summary of modifications and test results' },
                { name: 'implementation_plan.md', title: 'Implementation Plan', desc: 'Technical implementation plan and verification' },
                { name: 'INCIDENT_RESPONSE.md', title: 'Incident Response SOP', desc: 'Standard operating procedure for production incident response' },
                { name: 'PROJECT_DOCUMENTS.md', title: 'Project Master Index', desc: 'Master index for all project documentation' }
              ]"
              :key="art.name"
              class="p-3.5 rounded-xl border border-[#3e3e42] bg-[#252526] flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <i class="codicon codicon-file-text text-cyan-400" />
                  <h4 class="font-bold text-xs text-zinc-100">{{ art.title }}</h4>
                </div>
                <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#333333] text-zinc-300">
                  {{ art.name }}
                </span>
              </div>
              <p class="text-[11px] text-zinc-400">{{ art.desc }}</p>
              <button
                class="mt-1 py-1 px-2 rounded bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 text-[11px] cursor-pointer self-start"
                @click="openFileInMonaco({ path: `docs/${art.name}`, isDir: false })"
              >
                Open in Monaco Editor
              </button>
            </div>
          </div>
        </div>

        <!-- CHAT-FIRST CONTENT: requests and replies remain in the primary right column -->
        <div v-show="activeEditorTab === 'terminal'" class="flex-1 min-h-0 overflow-hidden flex flex-col bg-slate-950">
          <header class="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-5 py-3 shrink-0">
            <div class="min-w-0"><p class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">{{ workflowTitle }} · Conversation</p><div class="mt-1 flex items-center gap-2 text-xs"><span class="truncate font-semibold text-slate-100">{{ workflowMode === 'task' ? (selectedTask?.issue_key || selectedTask?.title || 'Select task') : (selectedDocsProject?.title || 'Select project') }}</span><span class="rounded-full px-2 py-0.5 text-[10px] flex items-center gap-1.5" :class="phaseTone === 'active' ? 'bg-amber-950 text-amber-300 border border-amber-800/80' : phaseTone === 'success' ? 'bg-emerald-950 text-emerald-300' : phaseTone === 'error' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-400'"><span v-if="phase === 'running'" class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" /><span>{{ phaseLabel }}</span><span v-if="phase === 'running'" class="font-mono text-[9px] text-amber-400/80">({{ formattedDuration }})</span></span></div></div>
            <div class="flex shrink-0 gap-1.5"><button class="rounded-lg border px-2.5 py-1.5 text-[11px] cursor-pointer transition-all flex items-center gap-1.5" :class="phase === 'running' ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200 shadow-sm shadow-cyan-500/20' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'" @click="showProcessDrawer = true"><span v-if="phase === 'running'" class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" /><span class="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" /></span><i v-else class="codicon codicon-terminal" /><span>Process</span><span v-if="processCards.length" class="ml-0.5 px-1 rounded bg-slate-900 text-cyan-300 font-mono text-[10px]">{{ processCards.length }}</span></button><button class="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer" @click="openSessionHistory"><i class="codicon codicon-history mr-1" />History</button></div>
          </header>

          <div ref="streamContainer" class="flex-1 min-h-0 overflow-y-auto px-5 py-6" @scroll="handleScroll">
            <div v-if="conversationCards.length === 0" class="mx-auto flex max-w-xl flex-col items-center justify-center py-20 text-center"><div class="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-800 bg-cyan-950/40 text-cyan-300"><i class="codicon codicon-comment-discussion text-xl" /></div><h3 class="text-base font-bold text-slate-100">Start {{ workflowTitle }}</h3><p class="mt-2 text-xs leading-relaxed text-slate-400">{{ workflowMode === 'discovery' ? 'Describe the desired outcome in the composer below. The agent reads the repository, documentation, and Task Hub context.' : workflowMode === 'task' ? 'Select a Task Hub task from the left sidebar, optionally add instructions before agent begins.' : 'Select a project then click Send. You can scope document scanning using instructions.' }}</p></div>
            <div v-else class="mx-auto max-w-4xl space-y-5">
              <article v-for="card in conversationCards" :key="card.id">
                <div v-if="card.type === 'user_message'" class="flex justify-end">
                  <div class="max-w-[82%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm text-white shadow-sm">
                    <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-100">You · {{ card.time }}</p>
                    <MarkdownView :content="card.text" :is-user="true" />
                  </div>
                </div>
                <div v-else-if="card.type === 'thought'" class="flex gap-3">
                  <div class="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-purple-800 bg-purple-950/60 text-[10px] font-bold text-purple-300">
                    <i class="codicon codicon-sparkle text-xs" />
                  </div>
                  <div class="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-purple-900/50 bg-purple-950/20 p-3.5">
                    <div class="mb-1.5 flex items-center justify-between border-b border-purple-900/40 pb-1.5">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <i class="codicon codicon-lightbulb text-[11px]" />
                        <span>Thinking / Reasoning · {{ card.time }}</span>
                      </span>
                      <button class="text-[10px] text-slate-500 hover:text-white cursor-pointer" @click="copyCardText(card.text)">Copy</button>
                    </div>
                    <MarkdownView :content="card.text" :strip-plan-marker="false" />
                  </div>
                </div>
                <div v-else-if="card.type === 'agent_message'" class="flex gap-3">
                  <div class="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-700 bg-cyan-950 text-[10px] font-bold text-cyan-300">AI</div>
                  <div class="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 p-4">
                    <div class="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">{{ provider === 'antigravity' ? 'Antigravity Agent' : provider === 'claude_code' ? 'Claude Code Agent' : 'Codex Agent' }}</span>
                      <button class="text-[10px] text-slate-500 hover:text-white cursor-pointer" @click="copyCardText(card.text)">Copy</button>
                    </div>
                    <MarkdownView :content="card.text" :strip-plan-marker="true" />
                  </div>
                </div>
                <div v-else class="flex items-center gap-2 py-1 text-[10px] text-slate-500">
                  <span class="h-px flex-1 bg-slate-800" />
                  <span>Turn completed · {{ (card.usage?.total_tokens || card.usage?.output_tokens || 0).toLocaleString() }} tokens</span>
                  <span class="h-px flex-1 bg-slate-800" />
                </div>
              </article>
              <div v-if="phase === 'running'" class="flex gap-3 items-start p-3.5 rounded-2xl border border-cyan-800/80 bg-cyan-950/30 text-xs shadow-lg shadow-cyan-950/40">
                <div class="relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-500 bg-cyan-950 text-[10px] font-bold text-cyan-300 shadow-sm shadow-cyan-500/30">
                  <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" /><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" /></span>AI
                </div>
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <span>{{ provider === 'antigravity' ? 'Antigravity Agent' : provider === 'claude_code' ? 'Claude Code Agent' : 'Codex Agent' }}</span>
                      <span class="text-slate-500">·</span>
                      <span class="font-mono text-[10px] text-cyan-400 font-normal">{{ formattedDuration }}</span>
                    </span>
                    <button class="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer flex items-center gap-1" @click="showProcessDrawer = true">
                      <i class="codicon codicon-terminal text-[11px]" />
                      <span>Xem Process ({{ processCards.length }})</span>
                    </button>
                  </div>
                  <div class="flex items-center gap-2 text-slate-200">
                    <span class="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <p class="truncate font-medium">{{ activeWorkingStatus }}</p>
                  </div>
                </div>
              </div>
              <section v-if="workflowMode === 'discovery' && phase === 'error'" class="rounded-2xl border border-rose-800/70 bg-rose-950/20 p-4">
                <p class="text-[10px] font-bold uppercase tracking-wider text-rose-300">No response from agent</p>
                <h3 class="mt-1 text-base font-bold text-rose-50">Plan Was Not Generated</h3>
                <p class="mt-2 text-xs leading-relaxed text-rose-100/80">{{ errorMessage || 'Agent session ended before sending response.' }}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 cursor-pointer" @click="retryRequirementDiscovery">Rerun Analysis</button>
                  <button class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer" @click="openCurrentProcess('terminal')">Open Process & Log</button>
                </div>
              </section>
              <section v-if="workflowMode === 'discovery' && phase === 'review'" class="rounded-2xl border border-violet-800/70 bg-violet-950/20 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-violet-300">Review Plan</p>
                    <h3 class="mt-1 text-base font-bold text-violet-50">{{ discoveryPlan?.epic.title || 'Plan Requires Normalization' }}</h3>
                    <p class="mt-2 text-xs text-violet-100/80">{{ discoveryPlan?.summary || discoveryPlanErrors[0] }}</p>
                  </div>
                  <button v-if="!isDiscoveryPlanValid" class="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 cursor-pointer" @click="requestDiscoveryPlanCorrection">Request Correction</button>
                </div>
                <div v-if="discoveryPlan" class="mt-4 space-y-2">
                  <div v-for="story in discoveryPlan.stories" :key="story.title" class="rounded-lg border border-violet-900/70 bg-slate-950/50 p-3">
                    <div class="flex justify-between gap-2">
                      <strong class="text-xs text-slate-100">{{ story.title }}</strong>
                      <span class="text-[10px] text-violet-300">{{ story.story_points }} pts</span>
                    </div>
                    <p class="mt-1 text-[11px] text-slate-400">{{ story.tasks.map((task) => task.title).join(' · ') }}</p>
                  </div>
                </div>
              </section>
              <section v-if="(workflowMode === 'task' && (phase === 'handoff' || phase === 'review')) || (workflowMode === 'docs' && phase === 'review')" class="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Handoff Summary & Review</p>
                    <h3 class="mt-1 text-base font-bold text-slate-100">{{ selectedTask?.title || 'Review Execution Outcome' }}</h3>
                  </div>
                  <button v-if="gitDiffData.diffs.length" class="rounded-lg border border-cyan-700 bg-cyan-950/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60 cursor-pointer flex items-center gap-1.5" @click="loadGitDiff(); activeEditorTab = 'monaco';">
                    <i class="codicon codicon-diff" />
                    <span>Soi Diff ({{ gitDiffData.diffs.length }} files)</span>
                  </button>
                </div>
                <p class="mt-2 text-sm text-slate-200 leading-relaxed">{{ handoff.summary || (workflowMode === 'docs' ? 'Agent completed documentation session.' : 'Agent completed execution session and attached verification evidence.') }}</p>
                <div v-if="handoff.changedFiles" class="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Changed Files:</p>
                  <p class="whitespace-pre-wrap font-mono text-[11px] text-slate-300">{{ handoff.changedFiles }}</p>
                </div>
                <div v-if="handoff.tests || handoff.testSummary" class="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Test Evidence & Verification:</span>
                    <span class="rounded px-2 py-0.5 text-[10px] font-bold uppercase" :class="handoff.testStatus === 'passed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'">
                      {{ handoff.testStatus }}
                    </span>
                  </div>
                  <p class="mt-1 font-mono text-[11px] text-cyan-300">{{ handoff.tests }}</p>
                  <p v-if="handoff.testSummary" class="mt-1 text-xs text-slate-300">{{ handoff.testSummary }}</p>
                </div>
                <div v-if="workflowMode === 'task' && phase === 'review'" class="mt-4 flex flex-wrap gap-2.5 pt-2 border-t border-emerald-900/40">
                  <button class="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40" :disabled="isApproving" @click="approveTaskReview">
                    <i v-if="isApproving" class="codicon codicon-loading animate-spin" />
                    <i v-else class="codicon codicon-pass" />
                    <span>Approve (Human Approval ➔ Task Done)</span>
                  </button>
                  <button class="rounded-xl border border-amber-700 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5" @click="openRejectDialog">
                    <i class="codicon codicon-warning" />
                    <span>Request Changes (Reject with feedback)</span>
                  </button>
                  <button class="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5" @click="activeEditorTab = 'evidence'">
                    <i class="codicon codicon-file-text" />
                    <span>Xem Evidence Log</span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          <div class="border-t border-slate-800 bg-slate-900/80 px-5 py-3 shrink-0"><div v-if="phase === 'running'" class="mb-2 flex gap-1.5 overflow-x-auto"><button v-for="prompt in ['Progress summary', 'Run tests', 'Check git status']" :key="prompt" class="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] text-slate-300 hover:text-white cursor-pointer" @click="conversationDraft = prompt">{{ prompt }}</button></div><div v-if="errorMessage" class="mb-2 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{{ errorMessage }}</div><div class="flex items-end gap-2"><textarea v-model="conversationDraft" rows="2" class="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500" :placeholder="composerPlaceholder" :disabled="['preflight', 'pairing', 'context'].includes(phase)" @keydown.ctrl.enter.prevent="sendConversation" /><button class="rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer flex items-center gap-1.5" :disabled="['preflight', 'pairing', 'context'].includes(phase) || (workflowMode === 'discovery' && phase !== 'running' && !conversationDraft.trim()) || (workflowMode === 'task' && !selectedTask)" @click="sendConversation"><i v-if="phase === 'running'" class="codicon codicon-loading animate-spin text-xs" /><span>{{ composerActionLabel }}</span></button></div><p class="mt-1.5 text-[10px] text-slate-500">Ctrl + Enter to send · Technical process in dedicated panel</p></div>
        </div>

        <!-- Legacy terminal/review layout retained only while migrating saved UI state. -->
        <div v-if="false" class="flex-1 min-h-0 p-3 overflow-hidden flex flex-col gap-2">
        <!-- VIEW: PREFLIGHT / SETUP / READY -->
        <div
          v-if="['select', 'preflight', 'pairing', 'context', 'ready', 'error'].includes(phase)"
          class="flex-1 rounded-xl border border-slate-800 bg-slate-900/30 p-5 overflow-y-auto flex flex-col gap-4 text-xs"
        >
          <div class="border-b border-slate-800 pb-3">
            <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <i class="codicon codicon-run text-zinc-200" />
              {{ phase === 'select' ? `Step 1 · Prepare ${workflowTitle}` : phase === 'ready' ? 'Ready to Launch Agent' : 'Preparing local agent' }}
            </h3>
            <p class="text-slate-400 text-xs mt-1 leading-relaxed">
              {{ phase === 'select' ? 'Select repo/project in left panel, then enter requirements or select a task. Agent settings and technical process available on demand.' : 'Desktop is creating isolated Git worktree and loading MCP context for safe local agent execution.' }}
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-if="worktree" class="p-3 rounded-lg border border-slate-700/80 bg-slate-950 flex flex-col gap-1 font-mono text-[11px]">
              <div class="text-slate-400">Isolated Worktree Path:</div>
              <div class="text-cyan-300 font-semibold break-all">{{ worktree }}</div>
            </div>
            <div class="p-3 rounded-lg border border-slate-700/80 bg-slate-950 flex flex-col gap-1 font-mono text-[11px]" :class="!worktree ? 'sm:col-span-2' : ''">
              <div class="text-slate-400">AI Model Engine:</div>
              <div class="text-cyan-300 font-semibold flex items-center justify-between">
                <span>{{ activeModelLabel }}</span>
                <span
                  class="text-[9px] px-1.5 py-0.5 rounded font-sans uppercase font-bold"
                  :class="
                    isCustomModel[provider]
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  "
                >
                  {{ activeModelBadge }}
                </span>
              </div>
            </div>
          </div>

          <!-- CHECKLIST -->
          <div v-if="preflight?.checks" class="space-y-2">
            <h4 class="font-bold text-slate-300 text-xs uppercase tracking-wider">Environment Check Status:</h4>
            <div class="grid gap-2">
              <div
                v-for="check in preflight.checks"
                :key="check.id"
                class="p-2.5 rounded-lg border flex items-start gap-2.5"
                :class="
                  check.status === 'passed'
                    ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'
                    : check.status === 'failed'
                    ? 'border-rose-900/60 bg-rose-950/20 text-rose-200'
                    : 'border-amber-900/60 bg-amber-950/20 text-amber-200'
                "
              >
                <span class="font-bold text-sm leading-none mt-0.5">
                  {{ check.status === 'passed' ? '✓' : check.status === 'failed' ? '✗' : '⚠' }}
                </span>
                <div class="flex-1">
                  <div class="font-semibold text-xs capitalize flex items-center gap-1.5">
                    <span>{{ check.id.replace(/_/g, ' ') }}</span>
                    <span v-if="check.fixable" class="px-1.5 py-0.5 rounded border border-zinc-600 text-[9px] font-mono uppercase text-zinc-300">
                      Auto-fixable
                    </span>
                  </div>
                  <div class="text-[11px] opacity-90 mt-0.5">{{ check.message }}</div>
                  <div v-if="check.fixHint" class="text-[10px] opacity-70 mt-1">{{ check.fixHint }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="p-3 rounded-lg border border-rose-900/80 bg-rose-950/40 text-rose-200 text-xs">
            <b>Error:</b> {{ errorMessage }}
          </div>
        </div>

        <!-- VIEW: LIVE STREAM & TERMINAL (WHEN RUNNING) -->
        <div v-else-if="phase === 'running'" class="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-800 bg-black shadow-2xl overflow-hidden relative">
          <!-- TOP TOOLBAR -->
          <div class="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/80 text-xs shrink-0">
            <div class="flex items-center gap-2">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-mono text-cyan-300 font-bold text-[11px]">{{ provider === 'antigravity' ? 'AGY' : provider.toUpperCase() }}</span>
              <span class="text-slate-600">·</span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-300" :title="activeModelLabel">{{ activeModel }}</span>
              <span class="text-slate-500 font-mono text-[10px]">Session: {{ sessionId?.slice(0, 14) }}...</span>

              <!-- VIEW MODE SWITCHER -->
              <div class="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 ml-2">
                <button
                  class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  :class="viewMode === 'cards' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'"
                  @click="viewMode = 'cards'"
                >
                  <i class="codicon codicon-comment-discussion mr-1" />Stream Cards
                </button>
                <button
                  class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  :class="viewMode === 'terminal' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'"
                  @click="viewMode = 'terminal'"
                >
                  <i class="codicon codicon-terminal mr-1" />Terminal Logs
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-if="viewMode === 'terminal'"
                v-model="logSearchQuery"
                class="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-200 placeholder-slate-500 outline-none w-24 focus:w-40 transition-all"
                placeholder="Filter logs..."
              />
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Copy logs"
                @click="copyTerminalOutput"
              >
                <i class="codicon codicon-copy mr-1" />Copy
              </button>
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Clear output"
                @click="clearTerminal"
              >
                <i class="codicon codicon-trash mr-1" />Clear
              </button>
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Open external log file"
                @click="openSessionLog"
              >
                <i class="codicon codicon-file mr-1" />Log file
              </button>
            </div>
          </div>

          <!-- 1. STREAM CARDS VIEW (DEFAULT) -->
          <div
            v-if="viewMode === 'cards'"
            ref="streamContainer"
            class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 font-sans text-xs bg-slate-950/95"
            @scroll="handleScroll"
          >
            <div v-if="streamCards.length === 0" class="text-slate-500 italic py-8 text-center animate-pulse flex flex-col items-center gap-2">
              <i class="codicon codicon-copilot text-lg" />
              <span>Launching Agent and preparing context...</span>
            </div>

            <div v-for="card in streamCards" :key="card.id" class="space-y-1">
              <!-- USER MESSAGE -->
              <div v-if="card.type === 'user_message'" class="flex justify-end">
                <div class="max-w-[85%] rounded-2xl rounded-tr-none bg-blue-600/90 text-white px-3.5 py-2 shadow-md">
                  <div class="text-[10px] opacity-75 font-mono mb-0.5 text-blue-200">You · {{ card.time }}</div>
                  <MarkdownView :content="card.text" :is-user="true" />
                </div>
              </div>

              <!-- AGENT MESSAGE CARD -->
              <div v-else-if="card.type === 'agent_message'" class="flex gap-2.5 items-start">
                <div class="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 grid place-items-center shrink-0 mt-0.5 text-xs font-bold">
                  AI
                </div>
                <div class="flex-1 min-w-0 rounded-2xl rounded-tl-none border border-slate-800 bg-slate-900/60 p-3.5 shadow-md">
                  <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
                    <span class="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                      {{ provider === 'codex' ? 'Codex Agent' : provider === 'antigravity' ? 'Antigravity Agent' : 'Claude Code Agent' }}
                    </span>
                    <button
                      class="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy message"
                      @click="copyCardText(card.text)"
                    >
                      Copy
                    </button>
                  </div>
                  <MarkdownView :content="card.text" :strip-plan-marker="true" />
                </div>
              </div>

              <!-- COMMAND EXECUTION CARD (SHELL) -->
              <div v-else-if="card.type === 'command_execution'" class="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono">
                <div
                  class="flex items-center justify-between gap-2 cursor-pointer"
                  @click="card.expanded = !card.expanded"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      :class="
                        card.status === 'in_progress'
                          ? 'bg-amber-400 animate-ping'
                          : card.status === 'failed' || (card.exitCode && card.exitCode !== 0)
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                      "
                    ></span>
                    <span class="text-slate-400 font-bold">$</span>
                    <span class="text-slate-200 truncate font-semibold">{{ card.command }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                      :class="
                        card.status === 'in_progress'
                          ? 'bg-amber-950 text-amber-300'
                          : card.status === 'failed' || (card.exitCode && card.exitCode !== 0)
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-emerald-950 text-emerald-300'
                      "
                    >
                      {{ card.status === 'in_progress' ? 'Running' : card.exitCode === 0 ? 'Success' : 'Failed' }}
                    </span>
                    <span class="text-slate-500 text-xs">{{ card.expanded ? '▲' : '▼' }}</span>
                  </div>
                </div>

                <div v-if="card.expanded && card.output" class="mt-2 pt-2 border-t border-slate-800/80">
                  <pre class="p-2 rounded bg-black/80 text-[11px] text-slate-300 overflow-x-auto max-h-48 whitespace-pre-wrap leading-tight">{{ card.output }}</pre>
                </div>
              </div>

              <!-- TOOL EXECUTION CARD (AGY / CODEX TOOLS) -->
              <div v-else-if="card.type === 'tool_execution'" class="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono">
                <div
                  class="flex items-center justify-between gap-2 cursor-pointer"
                  @click="card.expanded = !card.expanded"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      :class="
                        card.status === 'in_progress'
                          ? 'bg-amber-400 animate-ping'
                          : card.status === 'failed' || (card.exitCode && card.exitCode !== 0)
                          ? 'bg-rose-400'
                          : 'bg-cyan-400'
                      "
                    ></span>
                    <span class="text-cyan-400 font-bold">⚙️ {{ card.toolName }}</span>
                    <span class="text-slate-300 truncate font-mono text-[11px]">{{ card.command }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span v-if="card.duration" class="text-[10px] text-slate-500 font-mono">{{ card.duration }}</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                      :class="
                        card.status === 'in_progress'
                          ? 'bg-amber-950 text-amber-300'
                          : card.status === 'failed' || (card.exitCode && card.exitCode !== 0)
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-cyan-950 text-cyan-300'
                      "
                    >
                      {{ card.status === 'in_progress' ? 'Running' : 'Done' }}
                    </span>
                    <span class="text-slate-500 text-xs">{{ card.expanded ? '▲' : '▼' }}</span>
                  </div>
                </div>

                <div v-if="card.expanded && (card.output || card.toolParameters)" class="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div v-if="card.toolParameters && Object.keys(card.toolParameters).length" class="text-[10px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded max-h-36 overflow-y-auto">
                    <div class="text-slate-500 mb-0.5 font-bold uppercase text-[9px]">Parameters:</div>
                    <pre class="whitespace-pre-wrap">{{ JSON.stringify(card.toolParameters, null, 2) }}</pre>
                  </div>
                  <div v-if="card.output" class="text-[10px] text-slate-300 font-mono bg-black/80 p-2 rounded max-h-48 overflow-y-auto">
                    <div class="text-slate-500 mb-0.5 font-bold uppercase text-[9px]">Output:</div>
                    <pre class="whitespace-pre-wrap">{{ card.output }}</pre>
                  </div>
                </div>
              </div>

              <!-- TURN COMPLETED METRICS -->
              <div v-else-if="card.type === 'turn_completed'" class="flex items-center justify-center gap-2 text-[10px] text-slate-500 py-1">
                <span class="h-px bg-slate-800 flex-1"></span>
                <span>✓ Turn completed · Tokens: {{ (card.usage?.input_tokens || 0).toLocaleString() }} in / {{ (card.usage?.output_tokens || 0).toLocaleString() }} out</span>
                <span class="h-px bg-slate-800 flex-1"></span>
              </div>
            </div>
          </div>

          <!-- 2. RAW TERMINAL OUTPUT STREAM CONTAINER -->
          <div
            v-else
            ref="terminalContainer"
            class="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-[11.5px] leading-relaxed text-slate-200 bg-black selection:bg-cyan-900 selection:text-white"
            @scroll="handleScroll"
          >
            <div v-if="!rawOutput" class="text-slate-500 italic py-8 text-center animate-pulse">
              Waiting for log output from agent...
            </div>
            <div v-else class="whitespace-pre-wrap break-words font-mono" v-html="filteredTerminalHtml"></div>
          </div>

          <!-- JUMP TO BOTTOM BADGE -->
          <button
            v-if="isScrolledUp"
            class="absolute bottom-16 right-6 px-3 py-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] shadow-lg flex items-center gap-1.5 transition-all cursor-pointer animate-bounce"
            @click="scrollToBottom"
          >
            <span>↓</span> Scroll to bottom
          </button>

          <!-- BOTTOM FOLLOW-UP INPUT -->
          <div class="p-2.5 border-t border-slate-800/80 bg-slate-900/60 flex flex-col gap-2 shrink-0">
            <!-- QUICK PROMPT CHIPS -->
            <div class="flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-400 pb-0.5">
              <span class="text-slate-500 font-mono text-[9px] uppercase">Suggestions:</span>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Check current git status in worktree')"
              >Check git status</button>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Run automated tests and report results')"
              >Run tests</button>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Summarize changes you just made')"
              >Progress summary</button>
            </div>

            <!-- SLASH COMMANDS POPUP -->
            <div
              v-if="showSlashMenu && filteredSlashCommands.length > 0"
              class="bg-[#252526] border border-[#3e3e42] rounded-xl shadow-2xl p-1.5 space-y-0.5 mb-1 max-h-48 overflow-y-auto"
            >
              <div class="px-2 py-1 text-[10px] font-mono uppercase font-bold text-cyan-300 border-b border-[#333333] flex items-center justify-between">
                <span>Antigravity 2.0 Slash Commands</span>
                <span class="text-zinc-500 text-[9px]">Type command or click to insert</span>
              </div>
              <button
                v-for="cmd in filteredSlashCommands"
                :key="cmd.cmd"
                class="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer hover:bg-[#094771] hover:text-white text-zinc-300 group"
                @click="insertSlashCommand(cmd.cmd)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <i class="codicon text-xs text-cyan-400" :class="cmd.icon" />
                  <span class="font-mono font-bold text-cyan-300 group-hover:text-white">{{ cmd.label }}</span>
                  <span class="text-[11px] text-zinc-400 group-hover:text-zinc-200 truncate">{{ cmd.desc }}</span>
                </div>
              </button>
            </div>

            <!-- INPUT FIELD -->
            <div class="flex items-center gap-2 relative">
              <input
                v-model="followUp"
                class="flex-1 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-sans transition-colors"
                placeholder="Type instructions, command (/goal, /diff, /schedule...) or follow-up... (Enter to send)"
                @keyup.enter="sendFollowUp"
                @keydown.esc="showSlashMenu = false"
              />
              <button
                class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
                :disabled="!followUp.trim()"
                @click="sendFollowUp"
              >Send</button>
            </div>
          </div>
        </div>

        <!-- VIEW: STRUCTURED HANDOFF & REVIEW (WHEN FINISHED / REVIEWING) -->
        <div v-else class="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-5 flex flex-col gap-3 text-xs">
          <div class="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <i class="codicon codicon-checklist text-zinc-200" />{{ workflowMode === 'discovery' ? 'Review Requirement Plan' : docsOnly ? 'Review Generated Documentation' : 'Structured Agent Handoff' }}
              </h3>
              <p class="text-slate-400 text-xs mt-0.5">
                {{ workflowMode === 'discovery' ? 'Plan is separated from technical process. Backlog is only created upon approval.' : docsOnly ? 'Inspect documentation files before syncing to Task Hub.' : 'Review execution outcome, test results, and verification evidence.' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                title="Open technical process of local agent"
                @click="openCurrentProcess('cards')"
              >
                <i class="codicon codicon-terminal mr-1" />Process
              </button>
              <button
                class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                title="Reopen process of completed sessions"
                @click="openSessionHistory"
              >
                <i class="codicon codicon-history mr-1" />History
              </button>
              <button
                v-if="workflowMode !== 'discovery'"
                class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                @click="copyHandoff"
              >
                <i class="codicon codicon-copy mr-1" />Copy Handoff Markdown
              </button>
            </div>
          </div>

          <div v-if="workflowMode === 'discovery'" class="space-y-3">
            <div v-if="!isDiscoveryPlanValid" class="rounded-xl border border-amber-800/70 bg-amber-950/25 p-4">
              <div class="flex items-start justify-between gap-3"><div><h4 class="text-sm font-bold text-amber-100">Plan Requires Normalization</h4><p class="mt-1 text-xs text-amber-200/80">Raw logs are hidden here. Request structured plan from agent before approval.</p></div><button class="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-400 cursor-pointer" :disabled="!sessionId" @click="requestDiscoveryPlanCorrection">Request Correction</button></div>
              <ul class="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-200/80"><li v-for="error in discoveryPlanErrors" :key="error">{{ error }}</li></ul>
            </div>
            <template v-else-if="discoveryPlan">
              <section class="rounded-xl border border-violet-800/70 bg-violet-950/20 p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-[10px] font-bold uppercase tracking-wider text-violet-300">Plan Ready for Review</p><h4 class="mt-1 text-base font-bold text-violet-50">{{ discoveryPlan.epic.title }}</h4><p class="mt-2 max-w-3xl text-xs leading-relaxed text-violet-100/80">{{ discoveryPlan.summary }}</p></div><div class="flex gap-2 text-center"><span class="rounded-lg border border-violet-800 bg-violet-950 px-3 py-2"><b class="block text-base text-violet-100">{{ discoveryPlan.stories.length }}</b><small class="text-[10px] text-violet-300">Stories</small></span><span class="rounded-lg border border-violet-800 bg-violet-950 px-3 py-2"><b class="block text-base text-violet-100">{{ discoveryTaskCount }}</b><small class="text-[10px] text-violet-300">Tasks</small></span><span class="rounded-lg border border-violet-800 bg-violet-950 px-3 py-2"><b class="block text-base text-violet-100">{{ discoveryTotalPoints }}</b><small class="text-[10px] text-violet-300">Points</small></span></div></div><p v-if="discoveryPlan.epic.description" class="mt-3 border-t border-violet-900/70 pt-3 text-xs text-violet-200/80">{{ discoveryPlan.epic.description }}</p></section>
              <div class="grid gap-3 lg:grid-cols-3"><section class="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><h5 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assumptions</h5><ul class="mt-2 space-y-1 text-xs text-slate-300"><li v-for="item in discoveryPlan.assumptions" :key="item">• {{ item }}</li><li v-if="!discoveryPlan.assumptions.length" class="text-slate-500">None.</li></ul></section><section class="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><h5 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Docs & Architecture</h5><ul class="mt-2 space-y-1 text-xs text-slate-300"><li v-for="item in [...discoveryPlan.affected_docs, ...discoveryPlan.architecture_notes]" :key="item">• {{ item }}</li><li v-if="!discoveryPlan.affected_docs.length && !discoveryPlan.architecture_notes.length" class="text-slate-500">None.</li></ul></section><section class="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><h5 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risks</h5><ul class="mt-2 space-y-1 text-xs text-slate-300"><li v-for="item in discoveryPlan.risks" :key="item">• {{ item }}</li><li v-if="!discoveryPlan.risks.length" class="text-slate-500">None.</li></ul></section></div>
              <section class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><h5 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stories, tasks & dependencies</h5><div class="mt-3 space-y-3"><article v-for="(story, storyIndex) in discoveryPlan.stories" :key="`${story.title}-${storyIndex}`" class="rounded-lg border border-slate-800 bg-slate-900/50 p-3"><div class="flex items-start justify-between gap-3"><div><h6 class="text-sm font-semibold text-slate-100">{{ storyIndex + 1 }}. {{ story.title }}</h6><p class="mt-1 text-xs text-slate-400">{{ story.acceptance_criteria.join(' · ') }}</p></div><span class="rounded bg-violet-950 px-2 py-1 text-[10px] font-bold text-violet-200">{{ story.story_points }} pts</span></div><div class="mt-3 space-y-1.5"><div v-for="task in story.tasks" :key="task.ref" class="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded border border-slate-800 bg-slate-950/70 p-2"><code class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-cyan-300">{{ task.ref }}</code><div><p class="text-xs font-medium text-slate-200">{{ task.title }}</p><p class="mt-0.5 text-[10px] text-slate-500">{{ task.acceptance_criteria.join(' · ') }}<span v-if="task.depends_on.length"> · depends on: {{ task.depends_on.join(', ') }}</span></p></div><span class="text-[10px] font-mono text-slate-400">{{ task.story_points }}pt</span></div></div></article></div></section>
            </template>
          </div>

          <div v-else class="space-y-3">
            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Work Completion Summary</label>
              <textarea
                v-model="handoff.summary"
                class="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
                rows="3"
                placeholder="Summary of key modifications and architectural changes..."
              />
            </div>

            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Changed files (one file per line)</label>
              <textarea
                v-model="handoff.changedFiles"
                class="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-950 font-mono text-[11px] text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
                rows="3"
                placeholder="src/components/Example.vue&#10;electron/main.ts"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Test command</label>
                <input
                  v-model="handoff.tests"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="npm test"
                />
              </div>
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Test status</label>
                <select
                  v-model="handoff.testStatus"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="passed">✓ passed</option>
                  <option value="failed">✗ failed</option>
                  <option value="skipped">○ skipped</option>
                </select>
              </div>
            </div>

            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Test result summary</label>
              <input
                v-model="handoff.testSummary"
                class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                placeholder="All unit tests passed successfully."
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Commit SHA (optional)</label>
                <input
                  v-model="handoff.commitSha"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="e.g. 7f3a9b2"
                />
              </div>
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Pull Request URL (optional)</label>
                <input
                  v-model="handoff.pullRequestUrl"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="https://github.com/org/repo/pull/1"
                />
              </div>
            </div>

            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Blockers / Additional Notes</label>
              <textarea
                v-model="handoff.blockers"
                class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                rows="2"
                placeholder="No blockers encountered."
              />
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>

    <!-- BOTTOM ACTION & CONTROL BAR -->
    <div class="flex items-center justify-between gap-3 px-4 py-2 border-t border-[#333333] bg-[#252526] shrink-0 text-xs select-none">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <button
          v-if="false && workflowMode === 'task' && (phase === 'select' || phase === 'error')"
          class="px-3.5 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="busy || !selectedTask"
          @click="() => runPreflight()"
        >
          <i v-if="phase !== 'error'" class="codicon codicon-run mr-1" />{{ phase === 'error' ? 'Retry Preflight' : 'Start Preflight' }}
        </button>

        <button
          v-if="phase === 'error' && sourceWorkspace"
          class="px-3.5 py-1.5 rounded-lg border border-zinc-500 bg-zinc-200 hover:bg-white text-zinc-950 font-semibold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="setupBusy"
          @click="repairEnvironment"
        >
          <i class="codicon codicon-tools mr-1" />{{ setupBusy ? 'Auto-repairing...' : hasFixableEnvironmentIssue ? 'Auto-Repair & Recheck' : 'Clean Environment & Recheck' }}
        </button>

        <button
          v-if="false && workflowMode === 'task' && phase === 'ready'"
          @click="startAgent"
        >
          <i class="codicon codicon-play mr-1" />Launch Agent (Full Access)
        </button>

        <button
          v-if="workflowMode === 'task' && phase === 'running' && provider === 'antigravity'"
          class="px-3.5 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
          @click="completeExternalSession"
        >
          External Complete → Handoff
        </button>

        <button
          v-if="phase === 'running'"
          class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
          @click="stopAgent"
        >
          <i class="codicon codicon-debug-stop mr-1" />{{ workflowMode === 'discovery' ? 'Stop → Review Plan' : docsOnly ? 'Stop → Review Docs' : 'Stop Agent → Handoff' }}
        </button>

        <button
          v-if="workflowMode === 'task' && phase === 'handoff'"
          class="px-3.5 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-40"
          :disabled="!handoff.summary || !handoff.changedFiles"
          @click="submitHandoff"
        >
          Submit Handoff to Task Hub
        </button>

        <button
          v-if="workflowMode === 'task' && phase === 'review'"
          class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
          :disabled="isApproving"
          @click="approveTaskReview"
        >
          <i v-if="isApproving" class="codicon codicon-loading animate-spin" />
          <i v-else class="codicon codicon-pass" />
          <span>✓ Approve</span>
        </button>

        <button
          v-if="workflowMode === 'task' && phase === 'review'"
          class="px-3.5 py-1.5 rounded-lg border border-amber-700 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          @click="openRejectDialog"
        >
          <i class="codicon codicon-warning" />
          <span>Request Changes</span>
        </button>

        <button
          v-if="workflowMode === 'discovery' && phase === 'review'"
          class="px-3.5 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
          :class="!isDiscoveryPlanValid ? 'opacity-40 cursor-not-allowed' : ''"
          :disabled="!isDiscoveryPlanValid"
          title="Only create backlog when structured plan is valid"
          @click="createApprovedBacklog"
        >
          ✓ Approve & Create Backlog
        </button>

        <button
          v-if="phase === 'review' && docsOnly"
          class="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          title="Copy all generated document files to docs/ in the main workspace"
          @click="applyDocsToWorkspace"
        >
          <i class="codicon codicon-save mr-1" />Save to Main Workspace
        </button>

        <button
          v-if="phase === 'review' && docsOnly"
          class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
          @click="syncGeneratedDocs"
        >
          ✓ Sync Docs to Task Hub
        </button>

        <button
          v-if="false && worktree"
          class="px-2.5 py-1 rounded-lg border border-[#3e3e42] bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 text-xs transition-colors cursor-pointer"
          @click="openWorktree"
        >
          <i class="codicon codicon-folder-opened mr-1" />Open Worktree
        </button>

        <button
          v-if="false && sessionId"
          class="px-2.5 py-1 rounded-lg border border-[#3e3e42] bg-[#333333] hover:bg-[#3e3e42] text-zinc-200 text-xs transition-colors cursor-pointer"
          @click="openSessionLog"
        >
          <i class="codicon codicon-file mr-1" />Open Log File
        </button>
      </div>

      <div class="text-[11px] text-zinc-400 flex items-center gap-2 shrink-0">
        <span v-if="worktree" class="hidden sm:inline font-mono text-[10px] text-zinc-400 truncate max-w-[200px]" :title="worktree">
          {{ worktree.split('\\').pop() }}
        </span>
        <button
          class="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-colors text-xs cursor-pointer"
          @click="emit('close')"
        >Close</button>
      </div>
    </div>

    <!-- 3. VS CODE BLUE STATUS BAR (#007acc) -->
    <footer class="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] font-sans shrink-0 select-none z-10 shadow-xs">
      <div class="flex items-center gap-3">
        <!-- Git Branch -->
        <span class="flex items-center gap-1 font-semibold hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer" :title="`Branch: ${preflight?.repository || 'main'}`">
          <i class="codicon codicon-git-branch text-xs" />
          <span class="font-mono">{{ (preflight?.upstream || worktree || 'main').split('/').pop() }}*</span>
        </span>

        <!-- Sync -->
        <span class="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer">
          <i class="codicon codicon-sync text-xs" />
          <span>0↓ 1↑</span>
        </span>

        <!-- Diagnostics -->
        <span class="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer">
          <i class="codicon codicon-error text-xs" />
          <span>0</span>
          <i class="codicon codicon-warning text-xs ml-1" />
          <span>0</span>
        </span>

        <!-- AI Provider & Model -->
        <span class="flex items-center gap-1 font-semibold hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer" @click="selectActivity('agent')">
          <i class="codicon codicon-copilot text-xs" />
          <span>{{ provider.toUpperCase() }}: {{ activeModelLabel }}</span>
        </span>
      </div>

      <div class="flex items-center gap-3">
        <!-- Quota 5h / Weekly -->
        <span class="flex items-center gap-1 hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer" @click="openModelsAndUsageModal">
          <i class="codicon codicon-pulse text-xs" />
          <span>5h: {{ activeQuotaGroup.fiveHourRemainingPercent }}% · Weekly: {{ activeQuotaGroup.weeklyRemainingPercent }}%</span>
        </span>

        <!-- Indentation -->
        <span class="hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer hidden sm:inline">Spaces: 2</span>

        <!-- Encoding -->
        <span class="hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer">UTF-8</span>

        <!-- Mascot Mode Switcher in Status Bar -->
        <span
          class="bg-violet-950 hover:bg-violet-900 border border-violet-700/80 text-violet-200 px-2 py-0.2 rounded font-medium flex items-center gap-1 cursor-pointer transition-colors"
          title="Switch to Zen Companion (Ctrl+Shift+M)"
          @click="emit('switch-mode', 'mascot')"
        >
          <i class="codicon codicon-device-desktop text-xs" />
          <span>Zen Companion</span>
        </span>

        <!-- Core Marker -->
        <span class="bg-white/25 px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">VS Code Core</span>

        <!-- Notification Bell -->
        <span class="hover:bg-white/20 px-1.5 py-0.2 rounded cursor-pointer" title="Notifications">
          <i class="codicon codicon-bell text-xs" />
        </span>
      </div>
    </footer>

    <!-- COMMAND PALETTE OVERLAY (CTRL+P / ⌘P) -->
    <div
      v-if="showCommandPalette"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-12 p-4"
      @click.self="showCommandPalette = false"
    >
      <div class="w-full max-w-xl bg-[#252526] border border-[#3e3e42] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans select-none">
        <div class="p-2.5 border-b border-[#333333] flex items-center gap-2 bg-[#1e1e1e]">
          <i class="codicon codicon-search text-zinc-400" />
          <input
            v-model="commandPaletteSearch"
            type="text"
            autofocus
            placeholder="Type a command or search actions (e.g. Run, Diff, Quota, Model)..."
            class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            @keydown.esc="showCommandPalette = false"
          />
          <button
            class="px-1.5 py-0.5 rounded bg-[#333333] hover:bg-[#3e3e42] text-zinc-400 hover:text-white text-[10px] cursor-pointer"
            @click="showCommandPalette = false"
          >
            ESC
          </button>
        </div>
        <div class="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          <button
            v-for="cmd in filteredCommands"
            :key="cmd.id"
            class="w-full px-3 py-2 rounded text-left flex items-center justify-between text-xs transition-colors cursor-pointer group hover:bg-[#094771] hover:text-white text-zinc-300"
            @click="executeCommand(cmd)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <i class="codicon text-sm" :class="cmd.icon" />
              <span class="text-zinc-400 group-hover:text-cyan-300 text-[10px] font-semibold uppercase">{{ cmd.category }}:</span>
              <span class="font-medium truncate">{{ cmd.title }}</span>
            </div>
            <span v-if="cmd.shortcut" class="px-1.5 py-0.2 rounded bg-[#333333] group-hover:bg-[#007acc] text-[10px] font-mono text-zinc-400 group-hover:text-white shrink-0">
              {{ cmd.shortcut }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- PROCESS DRAWER: commands and logs are intentionally separate from the conversation -->
    <div v-if="showProcessDrawer" class="fixed inset-0 z-50 bg-black/60 flex justify-end" @click.self="showProcessDrawer = false">
      <section class="flex h-full w-full max-w-2xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        <header class="flex items-center justify-between border-b border-slate-800 px-5 py-3"><div><p class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Technical detail</p><h2 class="mt-1 text-sm font-bold text-slate-100">Process & logs</h2></div><div class="flex items-center gap-2"><button class="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:text-white cursor-pointer" @click="viewMode = viewMode === 'cards' ? 'terminal' : 'cards'">{{ viewMode === 'cards' ? 'Raw logs' : 'Process cards' }}</button><button class="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer" @click="showProcessDrawer = false">✕</button></div></header>
        <div v-if="viewMode === 'cards'" class="flex-1 overflow-y-auto p-4"><div v-if="processCards.length === 0" class="py-16 text-center text-xs italic text-slate-500">No command or tool output yet.</div><div v-else class="space-y-2"><article v-for="card in processCards" :key="card.id" class="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><button class="flex w-full items-center justify-between gap-3 text-left cursor-pointer" @click="card.expanded = !card.expanded"><span class="min-w-0 truncate font-mono text-xs text-slate-200"><span class="mr-2 text-cyan-400">{{ card.type === 'tool_execution' ? '⚙' : '$' }}</span>{{ card.toolName || card.command }}</span><span class="text-[10px] text-slate-500">{{ card.expanded ? 'Hide' : 'View' }}</span></button><pre v-if="card.expanded && (card.output || card.toolParameters)" class="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black p-3 text-[10px] text-slate-300">{{ card.output || JSON.stringify(card.toolParameters, null, 2) }}</pre></article></div></div>
        <div v-else class="flex-1 overflow-y-auto bg-black p-4 font-mono text-[11px] leading-relaxed text-slate-200"><div v-if="!rawOutput" class="py-16 text-center font-sans text-xs italic text-slate-500">No raw log output yet.</div><div v-else class="whitespace-pre-wrap break-words" v-html="filteredTerminalHtml" /></div>
      </section>
    </div>

    <!-- AGENT SETTINGS: advanced configuration stays out of the main workflow -->
    <div v-if="showAgentSettings" class="fixed inset-0 z-50 bg-black/60 flex justify-end" @click.self="showAgentSettings = false">
      <section class="h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <header class="mb-5 flex items-start justify-between gap-4">
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Advanced</p><h2 class="mt-1 text-base font-bold text-slate-100">Agent settings</h2><p class="mt-1 text-xs text-slate-400">This choice is saved for subsequent runs.</p></div>
          <button class="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer" @click="showAgentSettings = false">✕</button>
        </header>
        <div class="space-y-5">
          <div><label class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider</label><div class="grid grid-cols-3 gap-2"><button v-for="p in ([{ id: 'codex', name: 'Codex' }, { id: 'claude_code', name: 'Claude' }, { id: 'antigravity', name: 'AGY' }] as const)" :key="p.id" class="rounded-lg border px-2 py-2 text-xs font-medium cursor-pointer" :class="provider === p.id ? 'border-cyan-500 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'" :disabled="busy || phase === 'running'" @click="provider = p.id">{{ p.name }}</button></div></div>
          <div class="space-y-2"><div class="flex items-center justify-between"><label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</label><div class="flex gap-1"><button class="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:text-white cursor-pointer" :disabled="isSyncingModels || phase === 'running'" @click="syncAvailableModels(true)"><i class="codicon codicon-refresh" :class="isSyncingModels ? 'animate-spin' : ''" /> Sync</button><button class="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:text-white cursor-pointer" @click="toggleCustomModelMode">{{ isCustomModel[provider] ? 'List' : 'Custom' }}</button></div></div><input v-if="isCustomModel[provider]" :value="customModelInput[provider]" @input="setCustomModel(($event.target as HTMLInputElement).value)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-cyan-500" placeholder="Enter model ID" /><select v-else :value="activeModel" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500" @change="selectModel(($event.target as HTMLSelectElement).value)"><option v-for="model in filteredProviderModels" :key="model.id" :value="model.id">{{ model.name }} · {{ model.id }}</option></select></div>
          <button class="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 p-3 text-left hover:border-slate-600 cursor-pointer" @click="openModelsAndUsageModal"><span><span class="block text-xs font-semibold text-slate-100">Quota & usage</span><span class="mt-0.5 block text-[10px] text-slate-400">5h {{ activeQuotaGroup.fiveHourRemainingPercent }}% · Weekly {{ activeQuotaGroup.weeklyRemainingPercent }}%</span></span><i class="codicon codicon-dashboard text-slate-400" /></button>
          <button class="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900 cursor-pointer" @click="showAdvancedTools = !showAdvancedTools">{{ showAdvancedTools ? 'Hide Advanced IDE Tools' : 'Open Advanced IDE Tools' }}</button>
        </div>
      </section>
    </div>

    <!-- ACTIVITY TIMELINE: supporting detail, not a permanent sidebar section -->
    <div v-if="showActivityTimeline" class="fixed inset-0 z-50 bg-black/60 flex justify-end" @click.self="showActivityTimeline = false">
      <section class="h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <header class="mb-4 flex items-center justify-between"><div><p class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Session detail</p><h2 class="mt-1 text-base font-bold text-slate-100">Activity</h2></div><button class="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer" @click="showActivityTimeline = false">✕</button></header>
        <div v-if="timeline.length === 0" class="py-12 text-center text-xs italic text-slate-500">No activity recorded.</div>
        <div v-else class="space-y-2"><article v-for="item in timeline" :key="item.id" class="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div class="flex justify-between gap-2"><strong class="text-xs" :class="item.tone === 'error' || item.tone === 'failed' ? 'text-rose-300' : item.tone === 'warning' ? 'text-amber-300' : item.tone === 'ok' || item.tone === 'passed' ? 'text-emerald-300' : 'text-slate-200'">{{ item.label }}</strong><time class="text-[10px] font-mono text-slate-500">{{ item.time }}</time></div><p class="mt-1 text-xs leading-relaxed text-slate-400">{{ item.detail }}</p></article></div>
      </section>
    </div>

    <!-- SESSION HISTORY OVERLAY / MODAL -->
    <div
      v-if="showSessionHistory"
      class="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      @click.self="showSessionHistory = false"
    >
      <div class="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div class="flex items-center gap-2">
            <span class="text-base">📜</span>
            <h3 class="text-sm font-bold text-slate-100">Saved Agent Sessions History</h3>
            <span class="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-[10px] text-cyan-300 font-mono">
              {{ savedSessions.length }} sessions
            </span>
          </div>
          <button
            class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white grid place-items-center text-xs transition-colors cursor-pointer"
            @click="showSessionHistory = false"
          >
            ✕
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div v-if="savedSessions.length === 0" class="text-center py-12 text-slate-500 text-xs italic">
            No saved sessions.
          </div>

          <div
            v-for="sess in savedSessions"
            :key="sess.sessionId"
            class="p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group"
            :class="
              sess.sessionId === sessionId
                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            "
            @click="switchSession(sess)"
          >
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div
                class="w-8 h-8 rounded-lg grid place-items-center shrink-0 font-bold text-xs mt-0.5"
                :class="
                  sess.provider === 'antigravity'
                    ? 'bg-purple-950 border border-purple-800/80 text-purple-300'
                    : sess.provider === 'codex'
                    ? 'bg-cyan-950 border border-cyan-800/80 text-cyan-300'
                    : 'bg-emerald-950 border border-emerald-800/80 text-emerald-300'
                "
              >
                {{ sess.provider === 'antigravity' ? 'AGY' : sess.provider === 'codex' ? 'CDX' : 'CLD' }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-slate-200 text-xs truncate">
                    {{ sess.taskTitle || (sess.kind === 'discovery' || sess.workflowMode === 'discovery' ? 'Requirement Discovery' : sess.kind === 'docs' ? 'Repo Documentation (Docs)' : sess.issueKey || 'Agent Task Run') }}
                  </span>
                  <span
                    v-if="sess.model"
                    class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-900 text-slate-300 border border-slate-800"
                  >
                    {{ sess.model }}
                  </span>
                  <span
                    v-if="sess.sessionId === sessionId"
                    class="px-1.5 py-0.2 rounded text-[9px] bg-cyan-900/90 text-cyan-200 font-bold uppercase"
                  >
                    Active
                  </span>
                  <span
                    class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                    :class="
                      sess.status === 'running'
                        ? 'bg-amber-950 text-amber-300 animate-pulse'
                        : sess.status === 'failed'
                        ? 'bg-rose-950 text-rose-300'
                        : 'bg-emerald-950 text-emerald-300'
                    "
                  >
                    {{ sess.status === 'running' ? 'Running' : sess.status === 'failed' ? 'Failed' : 'Completed' }}
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                  <span>{{ new Date(sess.updatedAt || sess.startedAt).toLocaleString() }}</span>
                  <span>·</span>
                  <span class="truncate max-w-[200px]">{{ (sess.worktree || sess.cwd || '').split('\\').pop() }}</span>
                  <span v-if="sess.streamCards?.length">· {{ sess.streamCards.length }} cards</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                class="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Open full saved process/log for this session"
                @click.stop="openSavedSessionProcess(sess, 'terminal')"
              >
                <i class="codicon codicon-terminal mr-1" /><span>Process</span>
              </button>
              <button
                class="px-2.5 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Reopen this session in review view"
                @click.stop="switchSession(sess)"
              >
                <i class="codicon codicon-play mr-1" /><span>Reopen</span>
              </button>
              <button
                class="p-1.5 rounded-lg hover:bg-rose-950 text-slate-500 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                title="Delete this session from history"
                @click.stop="removeSavedSession(sess.sessionId, $event)"
              >
                <i class="codicon codicon-trash" />
              </button>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            @click="startNewRun(); showSessionHistory = false;"
          >
            <i class="codicon codicon-add mr-1" />New Session
          </button>
          <button
            class="text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-800 transition-colors text-xs cursor-pointer"
            @click="showSessionHistory = false"
          >Close</button>
        </div>
      </div>
    </div>

    <!-- 4. MODELS & USAGE / QUOTA MODAL (MATCHING SCREENSHOT) -->
    <div
      v-if="showModelsAndUsageModal"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      @click.self="showModelsAndUsageModal = false"
    >
      <div class="w-full max-w-2xl bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-zinc-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-white tracking-tight">Models & Usage</h2>
              <button
                class="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 text-sm disabled:opacity-50"
                :disabled="isSyncingQuota"
                @click="refreshQuotaUsage"
                title="Sync quota metrics from Task Hub & CLI"
              >
                <span :class="isSyncingQuota ? 'animate-spin inline-block' : ''">🔄</span>
              </button>
            </div>
            <p class="text-xs text-zinc-400">Manage your model quota and credits.</p>
          </div>
          <button
            class="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors text-base cursor-pointer"
            @click="showModelsAndUsageModal = false"
          >
            ✕
          </button>
        </div>

        <!-- Section 1: Plan -->
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Plan</label>
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 flex items-center justify-between gap-4">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-semibold text-white">Your Plan: {{ quotaUsageState.plan || 'Google AI Ultra' }}</span>
              <p class="text-xs text-zinc-400">You can upgrade to a higher Google AI Ultra plan to receive the highest rate limits.</p>
            </div>
            <button
              class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold shadow-sm shadow-sky-900/30 transition-all cursor-pointer shrink-0"
              @click="addTimeline('Upgrade requested', 'Open AI Plan upgrade details', 'muted')"
            >
              Upgrade
            </button>
          </div>
        </div>

        <!-- Section 2: Model Credits -->
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Model Credits</label>
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 flex items-center justify-between gap-4">
            <div class="flex flex-col gap-0.5 max-w-lg">
              <span class="text-sm font-semibold text-white">Enable AI Credit Overages</span>
              <p class="text-xs text-zinc-400 leading-relaxed">
                When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.
              </p>
            </div>
            <!-- Toggle Switch -->
            <button
              class="w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 border"
              :class="quotaUsageState.enableCreditOverages ? 'bg-sky-600 border-sky-500' : 'bg-zinc-800 border-zinc-700'"
              @click="toggleCreditOverages"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-xs"
                :class="quotaUsageState.enableCreditOverages ? 'translate-x-6' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>

        <!-- Section 3: Gemini Models -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <label class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Gemini Models</label>
            <span class="text-zinc-500 text-xs cursor-help" title="Sliding quota metrics for Gemini and Antigravity">ⓘ</span>
          </div>
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 flex flex-col gap-3.5">
            <!-- Weekly Limit -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-white">Weekly Limit Remaining</span>
                <span class="text-xs text-zinc-400">You have used some of your weekly limit, it will fully refresh in {{ quotaUsageState.gemini?.weeklyResetIn || '4 days, 9 hours' }}.</span>
              </div>
              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-sm font-bold font-mono text-zinc-100">{{ quotaUsageState.gemini?.weeklyRemainingPercent ?? 69 }}%</span>
                <div class="relative w-6 h-6 flex items-center justify-center">
                  <svg class="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" class="stroke-zinc-800" stroke-width="2.5" fill="none" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      class="stroke-emerald-400 transition-all duration-500"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      fill="none"
                      :stroke-dasharray="2 * Math.PI * 9"
                      :stroke-dashoffset="(2 * Math.PI * 9) * (1 - (quotaUsageState.gemini?.weeklyRemainingPercent ?? 69) / 100)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div class="h-px bg-zinc-800/80" />

            <!-- Five Hour Limit -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-white">Five Hour Limit Remaining</span>
                <span class="text-xs text-zinc-400">You have used some of your 5-hour limit, it will fully refresh in {{ quotaUsageState.gemini?.fiveHourResetIn || '3 hours, 50 minutes' }}.</span>
              </div>
              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-sm font-bold font-mono text-zinc-100">{{ quotaUsageState.gemini?.fiveHourRemainingPercent ?? 93 }}%</span>
                <div class="relative w-6 h-6 flex items-center justify-center">
                  <svg class="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" class="stroke-zinc-800" stroke-width="2.5" fill="none" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      class="stroke-emerald-400 transition-all duration-500"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      fill="none"
                      :stroke-dasharray="2 * Math.PI * 9"
                      :stroke-dashoffset="(2 * Math.PI * 9) * (1 - (quotaUsageState.gemini?.fiveHourRemainingPercent ?? 93) / 100)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 4: Claude and GPT models -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <label class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Claude and GPT models</label>
            <span class="text-zinc-500 text-xs cursor-help" title="Sliding quota metrics for Claude Code and Codex">ⓘ</span>
          </div>
          <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 flex flex-col gap-3.5">
            <!-- Weekly Limit -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-white">Weekly Limit Remaining</span>
                <span class="text-xs text-zinc-400">Weekly available quota for Claude & OpenAI models.</span>
              </div>
              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-sm font-bold font-mono text-zinc-100">{{ quotaUsageState.claudeGpt?.weeklyRemainingPercent ?? 100 }}%</span>
                <div class="relative w-6 h-6 flex items-center justify-center">
                  <svg class="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" class="stroke-zinc-800" stroke-width="2.5" fill="none" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      class="stroke-emerald-400 transition-all duration-500"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      fill="none"
                      :stroke-dasharray="2 * Math.PI * 9"
                      :stroke-dashoffset="(2 * Math.PI * 9) * (1 - (quotaUsageState.claudeGpt?.weeklyRemainingPercent ?? 100) / 100)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div class="h-px bg-zinc-800/80" />

            <!-- Five Hour Limit -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-white">Five Hour Limit Remaining</span>
                <span class="text-xs text-zinc-400">5-hour available quota for Claude & OpenAI models.</span>
              </div>
              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-sm font-bold font-mono text-zinc-100">{{ quotaUsageState.claudeGpt?.fiveHourRemainingPercent ?? 100 }}%</span>
                <div class="relative w-6 h-6 flex items-center justify-center">
                  <svg class="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" class="stroke-zinc-800" stroke-width="2.5" fill="none" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      class="stroke-emerald-400 transition-all duration-500"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      fill="none"
                      :stroke-dasharray="2 * Math.PI * 9"
                      :stroke-dashoffset="(2 * Math.PI * 9) * (1 - (quotaUsageState.claudeGpt?.fiveHourRemainingPercent ?? 100) / 100)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ANTIGRAVITY 2.0 SKILLS & CUSTOMIZATIONS MODAL -->
    <AntigravitySkillsModal
      v-if="showSkillsModal"
      :workspace-path="activeCwd"
      @close="showSkillsModal = false"
      @run-skill="followUp = `/skill ${$event} `; activeEditorTab = 'terminal'; addTimeline('Skill Loaded', `Loaded skill instructions: ${$event}`, 'ok');"
    />

    <!-- ANTIGRAVITY 2.0 SCHEDULED TASKS & TIMERS MODAL -->
    <AntigravityScheduledTasksModal
      v-if="showScheduledTasksModal"
      @close="showScheduledTasksModal = false"
      @task-triggered="followUp = $event; activeEditorTab = 'terminal';"
    />

    <!-- ANTIGRAVITY 2.0 SETTINGS & PERMISSIONS MODAL -->
    <AntigravitySettingsPermissionsModal
      v-if="showSettingsPermissionsModal"
      @close="showSettingsPermissionsModal = false"
    />

    <!-- REJECT FEEDBACK MODAL DIALOG -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      @click.self="showRejectModal = false"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <i class="codicon codicon-warning text-base" />
            <span>Request Task Changes</span>
          </div>
          <button class="text-slate-400 hover:text-white cursor-pointer" @click="showRejectModal = false">
            <i class="codicon codicon-close" />
          </button>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          Enter feedback or reason for requested changes. The task will transition to <code class="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300 font-mono">waiting_input</code> for the Agent to continue:
        </p>
        <textarea
          v-model="rejectReason"
          rows="4"
          placeholder="E.g., Add test cases for boundary conditions, optimize responsive layout..."
          class="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500"
        />
        <div class="flex justify-end gap-2 pt-2">
          <button
            class="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
            @click="showRejectModal = false"
          >Cancel</button>
          <button
            class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            :disabled="!rejectReason.trim() || isRejecting"
            @click="confirmRejectTask"
          >
            <i v-if="isRejecting" class="codicon codicon-loading animate-spin" />
            <span>Submit Change Request</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-workspace {
  animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.99);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Custom scrollbar for sidebar */
.sidebar-scrollable::-webkit-scrollbar {
  width: 6px;
}
.sidebar-scrollable::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 9999px;
}
.sidebar-scrollable::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.8);
  border-radius: 9999px;
  border: 1px solid rgba(15, 23, 42, 0.4);
}
.sidebar-scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 1);
}
</style>
