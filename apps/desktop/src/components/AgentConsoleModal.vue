<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TaskItem } from '../composables/useTaskSync';
import MacatungIcon from './MacatungIcon.vue';
import { ansiToHtml, stripAnsiToPlainText, escapeHtml } from '../utils/ansi';

declare global {
  interface Window {
    desktopApi?: any;
  }
}

const props = defineProps<{
  tasks: TaskItem[];
  initialTask?: TaskItem | null;
  isConnected?: boolean;
  desktopCredential?: { taskHubUrl: string; token: string; projectId: string } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fullscreen-change', value: boolean): void;
}>();

type Phase = 'select' | 'preflight' | 'pairing' | 'context' | 'ready' | 'running' | 'handoff' | 'review' | 'error';
type Provider = 'codex' | 'claude_code' | 'antigravity';

const phase = ref<Phase>('select');
const provider = ref<Provider>('codex');
const isFullscreen = ref(false);

const sourceWorkspace = ref(localStorage.getItem('task_companion_agent_workspace') || '');
const savedWorkspaces = ref<string[]>([]);
const worktree = ref('');
const taskId = ref<number | null>(props.initialTask?.id || null);
const taskSearch = ref('');
const setupState = ref<any>(null);
const setupBusy = ref(false);
const docsOnly = ref(false);

const taskHubUrl = ref(localStorage.getItem('task_hub_base_url') || 'https://task-hub.macatung.dev');
const credential = ref<{ token: string; projectId: string } | null>(null);
const contextPack = ref<any>(null);
const runId = ref<number | null>(null);
const sessionId = ref<string | null>(null);

// Stream & Event Cards State
type StreamCard = {
  id: string;
  type: 'agent_message' | 'command_execution' | 'tool_execution' | 'user_message' | 'turn_completed' | 'info';
  text?: string;
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
  workspace: false,
  tasks: false,
  docs: false,
  timeline: false,
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

const selectedTask = computed(() => props.tasks.find((task) => task.id === taskId.value) || null);

const filteredTasks = computed(() => {
  const query = taskSearch.value.trim().toLowerCase();
  return props.tasks.filter((task) => !query || [task.title, task.issue_key, task.project?.title].filter(Boolean).join(' ').toLowerCase().includes(query));
});

const busy = computed(() => ['preflight', 'pairing', 'context'].includes(phase.value));

const phaseLabel = computed(() => {
  const map: Record<Phase, string> = {
    select: 'Chuẩn bị',
    preflight: 'Preflight',
    pairing: 'Kết nối Task Hub',
    context: 'Nạp Context & MCP',
    ready: 'Sẵn sàng khởi chạy',
    running: docsOnly.value ? 'Đang tạo tài liệu' : 'Agent đang chạy',
    handoff: 'Bàn giao & Nghiệm thu',
    review: 'Review kết quả',
    error: 'Cần chú ý',
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

const filteredTerminalHtml = computed(() => {
  if (!logSearchQuery.value.trim()) return terminalHtml.value;
  const q = logSearchQuery.value.trim().toLowerCase();
  const lines = terminalHtml.value.split('\n');
  return lines.filter((l) => l.toLowerCase().includes(q)).join('\n');
});

const addTimeline = (label: string, detail: string, tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'muted' = 'muted') => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  timeline.value.unshift({ id: `${Date.now()}-${Math.random()}`, label, detail, tone, time });
  if (timeline.value.length > 50) timeline.value.pop();
  saveWorkspaceState();
};

const toggleFullscreen = async () => {
  isFullscreen.value = (await window.desktopApi?.toggleFullscreen?.(!isFullscreen.value)) ?? !isFullscreen.value;
  emit('fullscreen-change', isFullscreen.value);
};

// PERSISTENCE: Save state to localStorage
const saveWorkspaceState = () => {
  try {
    const payload = {
      phase: phase.value,
      provider: provider.value,
      sourceWorkspace: sourceWorkspace.value,
      worktree: worktree.value,
      taskId: taskId.value,
      docsOnly: docsOnly.value,
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
        sourceWorkspace: sourceWorkspace.value,
        worktree: worktree.value,
        taskId: taskId.value,
        taskTitle: selectedTask.value?.title || (docsOnly.value ? 'Tạo bộ tài liệu Repo (Docs)' : undefined),
        issueKey: selectedTask.value?.issue_key,
        mode: 'exec',
        kind: docsOnly.value ? 'docs' : 'task',
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

const switchSession = async (sess: any) => {
  if (!sess) return;
  stopDurationTimer();

  provider.value = sess.provider || 'codex';
  sourceWorkspace.value = sess.sourceWorkspace || sess.cwd || '';
  worktree.value = sess.worktree || sess.cwd || '';
  taskId.value = sess.taskId ?? null;
  docsOnly.value = sess.kind === 'docs';
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
      addTimeline('Session resumed', `Đang tiếp tục phiên nền ${sess.provider}...`, 'ok');
    } else {
      phase.value = sess.kind === 'docs' ? 'review' : 'handoff';
      addTimeline('Session loaded', `Đã mở lại dữ liệu phiên ${sess.sessionId.slice(0, 16)}...`, 'ok');
    }
  } catch {
    phase.value = sess.kind === 'docs' ? 'review' : 'handoff';
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
      if (state.sourceWorkspace) sourceWorkspace.value = state.sourceWorkspace;
      if (state.worktree) worktree.value = state.worktree;
      if (state.taskId !== undefined) taskId.value = state.taskId;
      if (state.docsOnly !== undefined) docsOnly.value = state.docsOnly;
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
    }
  } catch (e) {
    console.warn('Failed to restore agent workspace state:', e);
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
      addTimeline('Session reconnected', `Đang kết nối lại phiên ${active.provider}...`, 'ok');
    } else if (phase.value === 'running') {
      stopDurationTimer();
      if (docsOnly.value) {
        phase.value = 'review';
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
  addTimeline('New run started', 'Đã khởi tạo lại không gian làm việc mới.', 'muted');
  saveWorkspaceState();
};

// Watchers for auto-saving
watch([phase, provider, sourceWorkspace, worktree, taskId, docsOnly, sessionId, runId, streamCards, timeline, rawOutput, handoff, viewMode], () => {
  saveWorkspaceState();
}, { deep: true });

// Process structured stream events
const handleStreamEvent = (payload: any) => {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (payload.stream === 'user') {
    streamCards.value.push({
      id: `user-${Date.now()}`,
      type: 'user_message',
      text: payload.event?.text || payload.text,
      time: now,
    });
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
  else if (ev.event === 'step_update' && ev.step_update?.step_type === 'tool') {
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
  addTimeline('Logs cleared', 'Đã làm mới màn hình logs và cards.', 'muted');
};

const copyTerminalOutput = async () => {
  const text = plainOutput.value || stripAnsiToPlainText(rawOutput.value);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addTimeline('Logs copied', 'Toàn bộ nội dung terminal đã được sao chép.', 'ok');
};

const copyCardText = async (text?: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  addTimeline('Message copied', 'Đã sao chép phản hồi của agent.', 'ok');
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
    addTimeline('Setup error', error.message || 'Lỗi khi setup môi trường.', 'error');
  } finally {
    setupBusy.value = false;
  }
};

const mcpCall = (method: string, params: Record<string, any> = {}) => {
  if (!credential.value) throw new Error('Task Hub chưa được xác thực.');
  return window.desktopApi.taskHub.mcpCall(taskHubUrl.value, credential.value.token, credential.value.projectId, method, params);
};

const readMcpText = (response: any) => {
  if (response?.error) throw new Error(response.error.message || 'MCP request failed.');
  const text = response?.result?.content?.find((item: any) => item.type === 'text')?.text;
  if (!text) throw new Error('MCP không trả về dữ liệu.');
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
    throw new Error('Task Hub server không hỗ trợ API v1. Hãy nâng cấp server hoặc chọn URL khác.');
  }
  localStorage.setItem('task_hub_base_url', taskHubUrl.value.replace(/\/$/, ''));
  addTimeline('Server compatible', `Task Hub API ${capabilities.api_version}`, 'ok');
};

const contract = () =>
  `TASK HUB CONTRACT\nWork only on ${selectedTask.value?.issue_key || `task-${taskId.value}`}. You have full execution permissions in this isolated worktree; do not ask for human approval before running commands, editing files, testing, committing, pushing, merging, or deploying when those actions are required by the task. Use Task Hub MCP for lifecycle/evidence and end with summary, changed files, tests, commit/PR and blockers.\n\nCONTEXT:\n${JSON.stringify(contextPack.value, null, 2)}`;

const docsPrompt = () =>
  `You are generating Task Hub standard documentation in a supervised worktree. First scan repository structure, package manifests, entry points, configuration, public interfaces, database/migrations, tests, and existing documentation. Create or update ONLY these canonical files under docs/: PROJECT_DOCUMENTS.md, PROJECT_BRIEF.md, PRD.md, ARCHITECTURE.md, QA_PLAN.md, and RELEASE_RUNBOOK.md. PROJECT_DOCUMENTS.md MUST use the exact Task Hub registry marker <!-- task-hub:document-registry:v1 --> and these five rows/types: brief→docs/PROJECT_BRIEF.md, prd→docs/PRD.md, architecture→docs/ARCHITECTURE.md, qa_plan→docs/QA_PLAN.md, release_runbook→docs/RELEASE_RUNBOOK.md. Each core document must have stable headings: Purpose, Scope, Current State, Constraints, Open Questions; add domain-specific sections only after those. Base every statement on files you actually inspected; mark unknowns as TODO instead of guessing. Include source paths and an As-of commit/date in each document. Do not modify application source code, credentials, lockfiles, generated output, README, or deployment state. Do not commit, push, merge, or deploy. Finish with a summary of scanned areas, created/updated canonical files, and documentation gaps. These files will be synced by Task Hub and passed into future task context, so preserve the schema and paths exactly.`;

const startPairing = async () => {
  if (!selectedTask.value) return;
  phase.value = 'pairing';
  addTimeline('Pairing', 'Chờ phê duyệt xác thực Task Hub...', 'active');
  await verifyTaskHub();
  const pairing = await window.desktopApi.taskHub.startPairing(taskHubUrl.value, selectedTask.value.project_id);
  await window.desktopApi.openExternal(pairing.approval_url);
  const started = Date.now();
  pollTimer = setInterval(async () => {
    try {
      if (Date.now() - started > 600000) throw new Error('Pairing đã hết hạn.');
      const status = await window.desktopApi.taskHub.pollPairing(taskHubUrl.value, pairing.pairing_id, pairing.device_secret);
      if (status.status === 'approved') {
        stopPolling();
        credential.value = { token: status.mcp_token, projectId: String(status.project_id) };
        addTimeline('Pairing', 'MCP authenticated.', 'ok');
        await loadContext();
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
};

const runPreflight = async () => {
  errorMessage.value = '';
  if (!selectedTask.value?.project_id) {
    errorMessage.value = 'Vui lòng chọn một task từ danh sách trước khi bắt đầu.';
    return;
  }
  if (!sourceWorkspace.value) await chooseWorkspace();
  if (!sourceWorkspace.value) {
    errorMessage.value = 'Vui lòng chọn thư mục Git repository trên máy.';
    return;
  }
  phase.value = 'preflight';
  addTimeline('Preflight', `Kiểm tra ${provider.value} và repository...`, 'active');
  try {
    preflight.value = await window.desktopApi.agent.preflight(provider.value, sourceWorkspace.value);
    preflight.value.checks.forEach((check: any) => addTimeline(check.id, check.message, check.status));
    if (!preflight.value.ok) throw new Error('Preflight chưa đạt. Xử lý các mục cảnh báo/lỗi rồi thử lại.');

    const workspace = await window.desktopApi.agent.createWorktree(
      preflight.value.repository,
      selectedTask.value.issue_key || `task-${selectedTask.value.id}`
    );
    worktree.value = workspace.path;
    addTimeline('Worktree ready', `${workspace.branch} · ${workspace.reused ? 'đã tồn tại' : 'tạo mới'}`, 'ok');

    if (props.desktopCredential) {
      credential.value = { token: props.desktopCredential.token, projectId: props.desktopCredential.projectId };
      await loadContext();
    } else {
      await startPairing();
    }
  } catch (error: any) {
    phase.value = 'error';
    errorMessage.value = error.message || 'Preflight thất bại.';
    addTimeline('Preflight failed', error.message, 'error');
  }
};

const startDocsGeneration = async () => {
  errorMessage.value = '';
  docsOnly.value = true;
  if (!sourceWorkspace.value) await chooseWorkspace();
  if (!sourceWorkspace.value) {
    docsOnly.value = false;
    errorMessage.value = 'Vui lòng chọn thư mục Git repository.';
    return;
  }
  phase.value = 'preflight';
  addTimeline('Docs scan', `Kiểm tra ${provider.value} và repository...`, 'active');
  try {
    preflight.value = await window.desktopApi.agent.preflight(provider.value, sourceWorkspace.value);
    preflight.value.checks.forEach((check: any) => addTimeline(check.id, check.message, check.status));
    if (!preflight.value.ok) throw new Error('Preflight chưa đạt. Kiểm tra lại môi trường.');

    const workspace = await window.desktopApi.agent.createWorktree(preflight.value.repository, 'docs-from-repo');
    worktree.value = workspace.path;
    addTimeline('Docs worktree', `${workspace.branch} · ${workspace.reused ? 'reused' : 'tạo mới'}`, 'ok');

    phase.value = 'running';
    rawOutput.value = '';
    terminalHtml.value = '';
    streamCards.value = [];
    runDurationSeconds.value = 0;
    startDurationTimer();

    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, docsPrompt(), 'docs');
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);

    if (result.mode === 'external') {
      rawOutput.value = 'Agent đang chạy trong ứng dụng bên ngoài (Antigravity). Hãy hoàn tất rồi dừng phiên để review.\n';
      updateTerminalRender();
    }
    addTimeline(
      'Docs agent started',
      result.mode === 'external' ? 'Prompt đã gửi cho Antigravity.' : `${provider.value} đang quét repository và tạo tài liệu...`,
      'ok'
    );
  } catch (error: any) {
    docsOnly.value = false;
    stopDurationTimer();
    phase.value = 'error';
    errorMessage.value = error.message || 'Không thể khởi động docs agent.';
    addTimeline('Docs agent error', error.message, 'error');
  }
};

const loadContext = async () => {
  if (!selectedTask.value || !credential.value) return;
  phase.value = 'context';
  try {
    contextPack.value = readMcpText(
      await mcpCall('tools/call', { name: 'get_context_pack', arguments: { task_id: selectedTask.value.id } })
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
          task_id: selectedTask.value.id,
          provider: provider.value,
          agent_session_id: session,
          repository: contextPack.value.repository,
          branch: preflight.value?.branch || contextPack.value.branch,
          context: contextPack.value,
          instruction: { contract: 'full_access_task_execution', approval_mode: 'none' },
        },
      })
    );
    runId.value = run?.data?.id || run?.id || null;
    addTimeline('Context ready', 'Nạp Context pack + cấu hình MCP thành công (Full Access).', 'ok');
    phase.value = 'ready';
  } catch (error: any) {
    phase.value = 'error';
    errorMessage.value = error.message || 'Không thể chuẩn bị agent run.';
    addTimeline('Context error', error.message, 'error');
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
    streamCards.value = [];
    runDurationSeconds.value = 0;
    startDurationTimer();
    await updateRun('running');

    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, contract(), 'task');
    sessionId.value = result.sessionId;
    localStorage.setItem('task_companion_active_session', result.sessionId);

    addTimeline(
      'Agent started',
      result.mode === 'external' ? 'Antigravity đã mở · prompt đã copy.' : `${provider.value} execution đã kích hoạt với full quyền.`,
      'ok'
    );
    if (result.mode === 'external') {
      rawOutput.value = 'Antigravity is running externally. Submit handoff when done.\n';
      updateTerminalRender();
    }
  } catch (error: any) {
    stopDurationTimer();
    phase.value = 'error';
    errorMessage.value = error.message || 'Không thể khởi động agent.';
    addTimeline('Agent start error', error.message, 'error');
  }
};

const sendFollowUp = () => {
  if (sessionId.value && followUp.value.trim()) {
    window.desktopApi.agent.send(sessionId.value, followUp.value);
    addTimeline('Follow-up sent', followUp.value.trim(), 'active');
    followUp.value = '';
  }
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
  if (docsOnly.value) {
    handoff.value.summary = 'Agent đã hoàn tất quét repository và tạo các file tài liệu chuẩn docs/.';
    handoff.value.changedFiles = 'docs/PROJECT_DOCUMENTS.md\ndocs/PROJECT_BRIEF.md\ndocs/PRD.md\ndocs/ARCHITECTURE.md\ndocs/QA_PLAN.md\ndocs/RELEASE_RUNBOOK.md';
    handoff.value.tests = 'Documentation scan & schema verification';
    handoff.value.testSummary = 'Tài liệu đã được tạo thành công trong worktree.';
    addTimeline('Docs review', 'Đã dừng phiên tạo docs. Bạn có thể review và sync lên Task Hub.', 'ok');
    phase.value = 'review';
    return;
  }
  await updateRun('cancelled', 'Agent stopped by user.');
  phase.value = 'handoff';
  addTimeline('Agent stopped', 'Phiên làm việc đã dừng · chuyển sang handoff.', 'warning');
};

const completeExternalSession = async () => {
  stopDurationTimer();
  await updateRun('waiting_input', 'External agent completed; structured handoff required.');
  addTimeline('External session', 'Đã hoàn tất phiên làm việc ngoài · sẵn sàng handoff.', 'ok');
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
    addTimeline('Handoff submitted', `Đã submit lên Task Hub · Run ID: ${data?.data?.id || runId.value}`, 'ok');
    phase.value = 'review';
  } catch (error: any) {
    errorMessage.value = error.message || 'Không thể submit handoff.';
    addTimeline('Handoff error', error.message, 'error');
  }
};

const copyHandoff = async () => {
  const content = `## Task Hub Agent Handoff\n\n**Summary:**\n${handoff.value.summary}\n\n**Changed Files:**\n${handoff.value.changedFiles}\n\n**Tests:**\n- Command: \`${handoff.value.tests}\`\n- Status: ${handoff.value.testStatus}\n- Result: ${handoff.value.testSummary}\n\n**Commit / PR:**\n- Commit: ${handoff.value.commitSha || 'N/A'}\n- PR: ${handoff.value.pullRequestUrl || 'N/A'}\n\n**Blockers:**\n${handoff.value.blockers || 'None'}`;
  await navigator.clipboard.writeText(content);
  addTimeline('Handoff copied', 'Bản ghi handoff markdown đã được sao chép.', 'ok');
};

const openWorktree = () => {
  if (worktree.value) {
    window.desktopApi.agent.openWorkspace(worktree.value);
    addTimeline('Worktree opened', worktree.value, 'ok');
  }
};

const syncGeneratedDocs = async () => {
  if (!props.desktopCredential || !worktree.value) {
    errorMessage.value = 'Chưa kết nối Task Hub. Bạn có thể bấm "Lưu vào Workspace chính" để lưu tài liệu trực tiếp vào dự án.';
    addTimeline('Docs sync info', 'Chưa kết nối Task Hub SaaS. Hãy dùng tùy chọn lưu vào Workspace.', 'muted');
    return;
  }
  try {
    const payload = await window.desktopApi.agent.readGeneratedDocuments(worktree.value);
    await window.desktopApi.taskHub.importGeneratedDocuments(
      props.desktopCredential.taskHubUrl,
      props.desktopCredential.token,
      props.desktopCredential.projectId,
      payload
    );
    addTimeline('Docs synced', 'Đã đồng bộ bộ tài liệu chuẩn vào Task Hub thành công!', 'ok');
  } catch (error: any) {
    const raw = error.message || 'Không thể đồng bộ docs vào Task Hub.';
    if (raw.includes('404')) {
      errorMessage.value = `Máy chủ Task Hub (${props.desktopCredential.taskHubUrl}) chưa có endpoint đồng bộ docs. Hãy bấm "Lưu vào Workspace chính" để đưa tài liệu vào repo.`;
    } else {
      errorMessage.value = raw;
    }
    addTimeline('Docs sync error', errorMessage.value, 'error');
  }
};

const applyDocsToWorkspace = async () => {
  if (!worktree.value || !sourceWorkspace.value) {
    errorMessage.value = 'Không tìm thấy đường dẫn worktree hoặc workspace chính.';
    return;
  }
  try {
    const res = await window.desktopApi.agent.applyDocsToWorkspace(worktree.value, sourceWorkspace.value);
    addTimeline('Docs applied', `Đã lưu thành công ${res.count} file tài liệu vào thư mục docs/ của repo!`, 'ok');
    errorMessage.value = '';
  } catch (error: any) {
    errorMessage.value = error.message || 'Không thể sao chép docs vào workspace.';
    addTimeline('Docs apply error', error.message, 'error');
  }
};

const openSessionLog = async () => {
  if (!sessionId.value) return;
  try {
    const logPath = await window.desktopApi.agent.openSessionLog(sessionId.value);
    addTimeline('Logs opened', `Đã mở log file: ${logPath}`, 'ok');
  } catch (error: any) {
    errorMessage.value = error.message || 'Không thể mở log agent.';
  }
};

onMounted(() => {
  void loadSavedWorkspaces();
  void restoreWorkspaceState();

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
      sessionId.value = null;
      if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = undefined;
      }
      updateTerminalRender();

      addTimeline('Process exited', `Exit code: ${event.code ?? 'unknown'}`, event.code === 0 ? 'ok' : 'error');

      if (docsOnly.value) {
        handoff.value.summary =
          event.code === 0 ? 'Agent đã quét repository và tạo bộ tài liệu chuẩn docs/.' : `Docs agent kết thúc với mã lỗi ${event.code}.`;
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
});

onUnmounted(() => {
  saveWorkspaceState();
  stopPolling();
  stopDurationTimer();
  if (renderTimer) clearTimeout(renderTimer);
  removeOutput?.();
  removeExit?.();
});
</script>

<template>
  <div
    class="agent-workspace no-drag min-w-0 w-full max-w-[1240px] max-h-[calc(100vh-1rem)] h-[min(94vh,860px)] rounded-2xl border border-slate-700/80 bg-slate-950/98 text-slate-100 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden font-sans select-none"
    :class="isFullscreen ? 'max-w-none max-h-none h-full rounded-none border-0' : ''"
    @mousedown.stop
  >
    <!-- TOP HEADER -->
    <header class="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-inner">
          <MacatungIcon name="agent" :size="20" />
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-bold text-sm text-slate-100 tracking-tight">Agent Run Workspace</h2>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
              :class="
                phaseTone === 'error'
                  ? 'bg-rose-950/80 border border-rose-800/60 text-rose-300'
                  : phaseTone === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300'
                  : phaseTone === 'active'
                  ? 'bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 animate-pulse'
                  : 'bg-slate-800 border border-slate-700 text-slate-300'
              "
            >
              {{ phaseLabel }}
            </span>
            <span v-if="phase === 'running'" class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-[10px] text-cyan-300 font-mono">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              {{ formattedDuration }}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span class="text-slate-500 font-mono uppercase text-[10px]">Pipeline:</span>
            <span>Preflight</span>
            <span class="text-slate-600">→</span>
            <span>Worktree</span>
            <span class="text-slate-600">→</span>
            <span class="text-cyan-400 font-medium">Full-access execution</span>
            <span class="text-slate-600">→</span>
            <span>Handoff</span>
            <span class="text-slate-600">→</span>
            <span>Review</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- SESSION HISTORY BUTTON -->
        <button
          class="h-8 px-2.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Xem danh sách các phiên làm việc đã lưu"
          @click="openSessionHistory"
        >
          <span>📜</span>
          <span class="text-[11px] hidden sm:inline">Lịch sử phiên</span>
          <span v-if="savedSessions.length" class="px-1.5 py-0.2 rounded-full bg-cyan-900/80 text-cyan-300 text-[9px] font-mono font-bold">{{ savedSessions.length }}</span>
        </button>

        <!-- START NEW RUN BUTTON -->
        <button
          class="h-8 px-2.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors flex items-center gap-1 cursor-pointer"
          title="Tạo phiên làm việc mới (Reset Workspace)"
          @click="startNewRun"
        >
          <span>🔄</span>
          <span class="text-[11px] hidden sm:inline">Phiên mới</span>
        </button>

        <button
          class="h-8 px-2.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors flex items-center gap-1 cursor-pointer"
          :title="isFullscreen ? 'Thu nhỏ' : 'Mở toàn màn hình'"
          @click="toggleFullscreen"
        >
          <span class="text-sm leading-none">{{ isFullscreen ? '↙' : '↗' }}</span>
          <span class="text-[11px] hidden sm:inline">{{ isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình' }}</span>
        </button>
        <button
          class="h-8 w-8 rounded-lg bg-slate-900/60 hover:bg-rose-950/60 hover:border-rose-800 border border-slate-700/80 text-slate-400 hover:text-rose-300 grid place-items-center transition-colors cursor-pointer text-sm font-bold"
          title="Đóng cửa sổ (Tiến độ vẫn được lưu tự động)"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </header>

    <!-- MAIN BODY GRID (2 COLUMNS) -->
    <div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)] overflow-hidden">
      <!-- LEFT CONTROL SIDEBAR (NATURALLY SCROLLABLE) -->
      <aside class="sidebar-scrollable flex flex-col gap-3 p-4 border-r border-slate-800/80 bg-slate-950/70 overflow-y-auto min-w-0 max-h-full pb-8">
        <!-- 1. PROVIDER SELECTOR -->
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 shrink-0">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">AI Execution Provider</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="p in ([{ id: 'codex', name: 'Codex', tag: 'Native Stream' }, { id: 'claude_code', name: 'Claude', tag: 'Auto' }, { id: 'antigravity', name: 'AGY', tag: 'IDE' }] as const)"
              :key="p.id"
              class="px-2.5 py-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :class="
                provider === p.id
                  ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-sm shadow-cyan-950/50'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              "
              :disabled="busy || phase === 'running'"
              @click="provider = p.id"
            >
              <span>{{ p.name }}</span>
              <span class="text-[9px] font-mono px-1 rounded" :class="provider === p.id ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'">{{ p.tag }}</span>
            </button>
          </div>
        </div>

        <!-- 2. WORKSPACE FOLDER -->
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repository Workspace</span>
            <div class="flex items-center gap-1.5">
              <button
                class="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                @click="chooseWorkspace"
              >
                📁 Chọn thư mục
              </button>
              <button
                class="px-2 py-0.5 rounded-md border border-emerald-800/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-[10px] text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                :disabled="setupBusy"
                @click="runQuickSetup"
              >
                {{ setupBusy ? 'Đang setup…' : '⚡ Quick setup' }}
              </button>
            </div>
          </div>

          <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-2">
            <span class="text-xs">📂</span>
            <span class="text-xs font-mono text-slate-300 truncate flex-1" :title="sourceWorkspace || 'Chưa chọn repository'">
              {{ sourceWorkspace || 'Chưa chọn repository' }}
            </span>
          </div>

          <!-- SAVED WORKSPACES -->
          <div v-if="savedWorkspaces.length > 0" class="pt-1">
            <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
              <span>Đã lưu gần đây:</span>
              <span class="font-mono text-slate-500">{{ savedWorkspaces.length }}/12</span>
            </div>
            <div class="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              <div
                v-for="w in savedWorkspaces"
                :key="w"
                class="group flex items-center gap-1 pl-2 pr-1 py-1 rounded-md border text-[10px] transition-colors cursor-pointer"
                :class="w === sourceWorkspace ? 'border-cyan-500/80 bg-cyan-950/30 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-300'"
                @click="selectWorkspace(w)"
              >
                <span class="truncate max-w-[120px]" :title="w">{{ w.split('\\').pop() || w }}</span>
                <button
                  class="w-3.5 h-3.5 rounded grid place-items-center hover:bg-rose-900/50 hover:text-rose-300 text-slate-500 transition-colors"
                  title="Xóa"
                  @click.stop="removeSavedWorkspace(w)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. TASK HUB & TASK SELECTOR -->
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhiệm vụ Task Hub</span>
            <span class="text-[10px] font-mono text-slate-400">{{ filteredTasks.length }} tasks</span>
          </div>

          <div class="relative">
            <input
              v-model="taskSearch"
              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
              placeholder="🔍 Tìm theo title, issue key..."
              :disabled="busy"
            />
          </div>

          <div v-if="!isConnected" class="p-2.5 rounded-lg border border-amber-900/60 bg-amber-950/30 text-[11px] text-amber-200">
            Chưa kết nối Task Hub SaaS. Bạn có thể dùng tính năng <b>Quét repo → Tạo tài liệu</b> trực tiếp.
          </div>
          <div v-else-if="filteredTasks.length === 0" class="p-2.5 text-center rounded-lg border border-slate-800 bg-slate-950/40 text-[11px] text-slate-500">
            Không có task nào phù hợp.
          </div>
          <div v-else class="max-h-32 overflow-y-auto space-y-1.5 pr-0.5">
            <button
              v-for="task in filteredTasks"
              :key="task.id"
              class="w-full p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex flex-col gap-1"
              :class="
                task.id === taskId
                  ? 'border-blue-500/80 bg-blue-950/40 text-blue-100 shadow-sm'
                  : 'border-slate-800/80 bg-slate-950/60 text-slate-300 hover:border-slate-700'
              "
              @click="taskId = task.id"
            >
              <div class="flex items-center justify-between gap-1">
                <span class="font-mono font-bold text-[11px]" :class="task.id === taskId ? 'text-blue-300' : 'text-slate-400'">
                  {{ task.issue_key || `#${task.id}` }}
                </span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase" :class="task.status === 'done' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'">
                  {{ task.status }}
                </span>
              </div>
              <p class="text-xs text-slate-200 truncate font-medium">{{ task.title }}</p>
            </button>
          </div>

          <!-- SELECTED TASK PREVIEW -->
          <div v-if="selectedTask" class="p-2 rounded-lg border border-blue-900/60 bg-blue-950/20 text-xs">
            <div class="font-bold text-blue-300 flex items-center justify-between">
              <span>{{ selectedTask.issue_key || `#${selectedTask.id}` }}</span>
              <span class="text-[10px] text-slate-400">{{ selectedTask.project?.title || 'Project' }}</span>
            </div>
            <p class="text-slate-300 text-[11px] mt-1 font-medium">{{ selectedTask.title }}</p>
            <p v-if="selectedTask.acceptance_criteria" class="text-slate-400 text-[10px] mt-1 line-clamp-2 italic">
              {{ selectedTask.acceptance_criteria }}
            </p>
          </div>
        </div>

        <!-- 4. QUICK ACTION: DOCS GENERATOR -->
        <div class="rounded-xl border border-cyan-900/60 bg-gradient-to-r from-cyan-950/30 to-blue-950/30 p-3 shrink-0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
              <span>📄</span> Quét repo → Tạo tài liệu
            </span>
          </div>
          <p class="text-[10px] text-slate-400 leading-relaxed mb-2.5">
            Agent quét toàn bộ cấu trúc repo, tạo tự động bộ tài liệu chuẩn (Brief, PRD, Architecture, QA, Runbook) vào <code>docs/</code>.
          </p>
          <button
            class="w-full py-1.5 px-3 rounded-lg border border-cyan-600/80 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            :disabled="busy || phase === 'running'"
            @click="startDocsGeneration"
          >
            Bắt đầu tạo Docs từ Repo
          </button>
        </div>

        <!-- 5. TIMELINE FEED (COMFORTABLE & NEVER SQUISHED) -->
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 flex flex-col min-h-[240px] shrink-0">
          <div class="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/60">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <span>⚡</span> Activity Timeline
            </span>
            <span class="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">{{ timeline.length }} events</span>
          </div>
          <div class="space-y-2 overflow-y-auto max-h-[300px] pr-1">
            <div v-if="timeline.length === 0" class="text-[10px] text-slate-500 text-center py-6 italic">
              Chưa có sự kiện nào.
            </div>
            <div
              v-for="item in timeline"
              :key="item.id"
              class="p-2 rounded-lg bg-slate-950/80 border border-slate-800/60 text-[10px] flex flex-col gap-0.5 shadow-sm"
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
                      : item.tone === 'active'
                      ? 'text-cyan-400'
                      : 'text-slate-300'
                  "
                >
                  {{ item.label }}
                </span>
                <span class="font-mono text-[9px] text-slate-500">{{ item.time }}</span>
              </div>
              <p class="text-slate-400 break-words leading-tight">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- RIGHT STUDIO / TERMINAL OUTPUT AREA -->
      <main class="flex flex-col min-h-0 bg-slate-950 p-4 gap-3 overflow-hidden">
        <!-- VIEW: PREFLIGHT / SETUP / READY -->
        <div
          v-if="['select', 'preflight', 'pairing', 'context', 'ready', 'error'].includes(phase)"
          class="flex-1 rounded-xl border border-slate-800 bg-slate-900/30 p-5 overflow-y-auto flex flex-col gap-4 text-xs"
        >
          <div class="border-b border-slate-800 pb-3">
            <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span class="text-cyan-400">⚡</span>
              {{ phase === 'ready' ? 'Sẵn sàng khởi chạy Agent' : 'Preflight & Sandbox Isolation' }}
            </h3>
            <p class="text-slate-400 text-xs mt-1 leading-relaxed">
              Desktop tạo <b>worktree Git cách ly</b> độc lập, cấu hình MCP protocol và cấp quyền full-access để Agent tự động code, test, và bàn giao mà không làm hỏng branch chính.
            </p>
          </div>

          <div v-if="worktree" class="p-3 rounded-lg border border-slate-700/80 bg-slate-950 flex flex-col gap-1 font-mono text-[11px]">
            <div class="text-slate-400">Isolated Worktree Path:</div>
            <div class="text-cyan-300 font-semibold break-all">{{ worktree }}</div>
          </div>

          <!-- CHECKLIST -->
          <div v-if="preflight?.checks" class="space-y-2">
            <h4 class="font-bold text-slate-300 text-xs uppercase tracking-wider">Trạng thái kiểm tra môi trường:</h4>
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
                  <div class="font-semibold text-xs capitalize">{{ check.id.replace(/_/g, ' ') }}</div>
                  <div class="text-[11px] opacity-90 mt-0.5">{{ check.message }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="p-3 rounded-lg border border-rose-900/80 bg-rose-950/40 text-rose-200 text-xs">
            <b>Lỗi:</b> {{ errorMessage }}
          </div>
        </div>

        <!-- VIEW: LIVE STREAM & TERMINAL (WHEN RUNNING) -->
        <div v-else-if="phase === 'running'" class="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-800 bg-black shadow-2xl overflow-hidden relative">
          <!-- TOP TOOLBAR -->
          <div class="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/80 text-xs shrink-0">
            <div class="flex items-center gap-2">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-mono text-cyan-300 font-bold text-[11px]">{{ provider.toUpperCase() }}</span>
              <span class="text-slate-500 font-mono text-[10px]">Session: {{ sessionId?.slice(0, 14) }}...</span>

              <!-- VIEW MODE SWITCHER -->
              <div class="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 ml-2">
                <button
                  class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  :class="viewMode === 'cards' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'"
                  @click="viewMode = 'cards'"
                >
                  💬 Stream Cards
                </button>
                <button
                  class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  :class="viewMode === 'terminal' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:text-slate-200'"
                  @click="viewMode = 'terminal'"
                >
                  🖥️ Terminal Logs
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-if="viewMode === 'terminal'"
                v-model="logSearchQuery"
                class="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-200 placeholder-slate-500 outline-none w-24 focus:w-40 transition-all"
                placeholder="Lọc logs..."
              />
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Sao chép logs"
                @click="copyTerminalOutput"
              >
                📋 Copy
              </button>
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Xóa màn hình"
                @click="clearTerminal"
              >
                🗑 Xóa
              </button>
              <button
                class="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Mở file log ngoài"
                @click="openSessionLog"
              >
                📄 Log file
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
              <span class="text-lg">🤖</span>
              <span>Đang khởi động Agent và chuẩn bị context...</span>
            </div>

            <div v-for="card in streamCards" :key="card.id" class="space-y-1">
              <!-- USER MESSAGE -->
              <div v-if="card.type === 'user_message'" class="flex justify-end">
                <div class="max-w-[85%] rounded-2xl rounded-tr-none bg-blue-600/90 text-white px-3.5 py-2 shadow-md">
                  <div class="text-[10px] opacity-75 font-mono mb-0.5 text-blue-200">Bạn · {{ card.time }}</div>
                  <p class="whitespace-pre-wrap leading-relaxed">{{ card.text }}</p>
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
                  <div class="whitespace-pre-wrap text-slate-200 leading-relaxed font-sans">{{ card.text }}</div>
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
                <span>✓ Turn hoàn thành · Tokens: {{ (card.usage?.input_tokens || 0).toLocaleString() }} in / {{ (card.usage?.output_tokens || 0).toLocaleString() }} out</span>
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
              Đang chờ dữ liệu log từ agent...
            </div>
            <div v-else class="whitespace-pre-wrap break-words font-mono" v-html="filteredTerminalHtml"></div>
          </div>

          <!-- JUMP TO BOTTOM BADGE -->
          <button
            v-if="isScrolledUp"
            class="absolute bottom-16 right-6 px-3 py-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] shadow-lg flex items-center gap-1.5 transition-all cursor-pointer animate-bounce"
            @click="scrollToBottom"
          >
            <span>↓</span> Cuộn xuống mới nhất
          </button>

          <!-- BOTTOM FOLLOW-UP INPUT -->
          <div class="p-2.5 border-t border-slate-800/80 bg-slate-900/60 flex flex-col gap-2 shrink-0">
            <!-- QUICK PROMPT CHIPS -->
            <div class="flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-400 pb-0.5">
              <span class="text-slate-500 font-mono text-[9px] uppercase">Gợi ý:</span>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Kiểm tra git status hiện tại trong worktree')"
              >
                Kiểm tra git status
              </button>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Chạy automated tests và báo cáo kết quả')"
              >
                Chạy tests
              </button>
              <button
                class="px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                @click="sendQuickPrompt('Tóm tắt những thay đổi bạn vừa thực hiện')"
              >
                Tóm tắt tiến độ
              </button>
            </div>

            <!-- INPUT FIELD -->
            <div class="flex items-center gap-2">
              <input
                v-model="followUp"
                class="flex-1 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-sans transition-colors"
                placeholder="Gửi chỉ dẫn / follow-up cho agent... (Nhấn Enter để gửi)"
                @keyup.enter="sendFollowUp"
              />
              <button
                class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
                :disabled="!followUp.trim()"
                @click="sendFollowUp"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>

        <!-- VIEW: STRUCTURED HANDOFF & REVIEW (WHEN FINISHED / REVIEWING) -->
        <div v-else class="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-5 flex flex-col gap-3 text-xs">
          <div class="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>📋</span> {{ docsOnly ? 'Review Tài liệu Đã Tạo' : 'Structured Agent Handoff' }}
              </h3>
              <p class="text-slate-400 text-xs mt-0.5">
                {{ docsOnly ? 'Kiểm tra các file tài liệu trước khi đồng bộ lên Task Hub.' : 'Ghi nhận kết quả thực thi, test results, and bằng chứng hoàn thành.' }}
              </p>
            </div>
            <button
              class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              @click="copyHandoff"
            >
              📄 Copy Handoff Markdown
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Tóm tắt công việc hoàn thành</label>
              <textarea
                v-model="handoff.summary"
                class="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
                rows="3"
                placeholder="Tóm tắt những thay đổi chính..."
              />
            </div>

            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Changed files (mỗi file một dòng)</label>
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
                placeholder="Tất cả unit test đều pass."
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Commit SHA (tùy chọn)</label>
                <input
                  v-model="handoff.commitSha"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="e.g. 7f3a9b2"
                />
              </div>
              <div>
                <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Pull Request URL (tùy chọn)</label>
                <input
                  v-model="handoff.pullRequestUrl"
                  class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="https://github.com/org/repo/pull/1"
                />
              </div>
            </div>

            <div>
              <label class="font-bold text-slate-300 block mb-1 text-[11px] uppercase tracking-wider">Blockers / Ghi chú bổ sung</label>
              <textarea
                v-model="handoff.blockers"
                class="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-200 outline-none focus:border-cyan-500"
                rows="2"
                placeholder="Không có blocker."
              />
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- BOTTOM FOOTER ACTION BAR -->
    <footer class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 shrink-0">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <button
          v-if="phase === 'select' || phase === 'error'"
          class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="busy || !selectedTask"
          @click="runPreflight"
        >
          {{ phase === 'error' ? 'Thử lại Preflight' : '⚡ Bắt đầu Preflight' }}
        </button>

        <button
          v-if="phase === 'ready'"
          class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          @click="startAgent"
        >
          <span>🚀</span> Khởi chạy Agent (Full Access)
        </button>

        <button
          v-if="phase === 'running' && provider === 'antigravity'"
          class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          @click="completeExternalSession"
        >
          Hoàn tất ngoài → Handoff
        </button>

        <button
          v-if="phase === 'running'"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          @click="stopAgent"
        >
          {{ docsOnly ? '⏹ Dừng → Review Docs' : '⏹ Dừng Agent → Handoff' }}
        </button>

        <button
          v-if="phase === 'handoff'"
          class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-40"
          :disabled="!handoff.summary || !handoff.changedFiles"
          @click="submitHandoff"
        >
          Submit Handoff lên Task Hub
        </button>

        <button
          v-if="phase === 'review' && docsOnly"
          class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          title="Sao chép toàn bộ file tài liệu đã tạo vào thư mục docs/ của workspace chính"
          @click="applyDocsToWorkspace"
        >
          📥 Lưu vào Workspace chính
        </button>

        <button
          v-if="phase === 'review' && docsOnly"
          class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          @click="syncGeneratedDocs"
        >
          ✓ Đồng bộ Docs lên Task Hub
        </button>

        <button
          v-if="worktree"
          class="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          @click="openWorktree"
        >
          📂 Mở Worktree
        </button>

        <button
          v-if="sessionId"
          class="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          @click="openSessionLog"
        >
          📄 Mở Log File
        </button>
      </div>

      <div class="text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
        <span v-if="worktree" class="hidden sm:inline font-mono text-[10px] text-slate-500 truncate max-w-[200px]" :title="worktree">
          {{ worktree.split('\\').pop() }}
        </span>
        <button
          class="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors text-xs cursor-pointer"
          @click="emit('close')"
        >
          Đóng
        </button>
      </div>
    </footer>

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
            <h3 class="text-sm font-bold text-slate-100">Lịch sử các phiên Agent đã lưu</h3>
            <span class="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/60 text-[10px] text-cyan-300 font-mono">
              {{ savedSessions.length }} phiên
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
            Chưa có phiên làm việc nào được lưu.
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
                    {{ sess.taskTitle || (sess.kind === 'docs' ? 'Tạo bộ tài liệu Repo (Docs)' : sess.issueKey || 'Agent Task Run') }}
                  </span>
                  <span
                    v-if="sess.sessionId === sessionId"
                    class="px-1.5 py-0.2 rounded text-[9px] bg-cyan-900/90 text-cyan-200 font-bold uppercase"
                  >
                    Đang mở
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
                    {{ sess.status === 'running' ? 'Đang chạy' : sess.status === 'failed' ? 'Thất bại' : 'Hoàn thành' }}
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
                class="px-2.5 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Mở phiên này để tiếp tục làm việc"
                @click.stop="switchSession(sess)"
              >
                <span>▶ Tiếp tục</span>
              </button>
              <button
                class="p-1.5 rounded-lg hover:bg-rose-950 text-slate-500 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                title="Xóa phiên này khỏi lịch sử"
                @click.stop="removeSavedSession(sess.sessionId, $event)"
              >
                🗑
              </button>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            @click="startNewRun(); showSessionHistory = false;"
          >
            ➕ Tạo phiên mới
          </button>
          <button
            class="text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-800 transition-colors text-xs cursor-pointer"
            @click="showSessionHistory = false"
          >
            Đóng
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
