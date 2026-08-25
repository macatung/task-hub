<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ConnectionBar from '../components/control-center/ConnectionBar.vue';
import TaskQueue from '../components/control-center/TaskQueue.vue';
import RunWorkspace, { type Provider } from '../components/control-center/RunWorkspace.vue';
import WorkflowPanel from '../components/control-center/WorkflowPanel.vue';
import ActivityTimelineDrawer from '../components/ActivityTimelineDrawer.vue';
import { useTaskSync, type TaskItem } from '../composables/useTaskSync';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useContextPackCache } from '../composables/useContextPackCache';
import { parseDiscoveryPlan, serializeDiscoveryPlanContract } from '../utils/discoveryPlan';
import { buildAutoHandoffPayload } from '../utils/autoHandoff';
import { InteractiveRunReporter } from '../services/interactiveRunReporter';
type ToolMode = 'requirement' | 'docs' | null;
type RunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
type ExecutionPolicy = 'restricted' | 'workspace_write' | 'full_access';
type ApprovalRequest = { id: string; reason: string; requestedAt: string; recommendedPolicy: 'workspace_write' | 'full_access'; diagnosticSummary?: string; diagnosticDetails?: string[] };
type RunIntent = 'task' | 'epic' | 'docs' | 'requirement';
type PendingLaunch = { prompt: string; kind: 'task' | 'docs'; policy: ExecutionPolicy; intent: RunIntent };
const sync = useTaskSync();
const contextPackCache = useContextPackCache();
const {
  notify,
  startOperation,
  updateOperation,
  finishOperation,
  activityTimeline,
  clearTimeline,
} = useActionFeedback();
const interactiveReporter = new InteractiveRunReporter();
const selectedTask = ref<TaskItem | null>(null); const provider = ref<Provider>('codex'); const executionPolicy = ref<ExecutionPolicy>('workspace_write'); const workspace = ref(''); const worktree = ref(''); const phase = ref('Ready'); const output = ref(''); const sessionId = ref<string | null>(null); const runId = ref<number | null>(null); const runStatus = ref<RunStatus>('idle'); const runExitCode = ref<number | null>(null); const syncing = ref(false); const lastSynced = ref<string | null>(null); const error = ref(''); const approvalRequest = ref<ApprovalRequest | null>(null); const pendingLaunch = ref<PendingLaunch | null>(null); const runIntent = ref<RunIntent>('task'); const diagnostics = ref<any>(null); const diagnosticsLoading = ref(false); const runOutputStart = ref(0); const autoHandoffSubmitting = ref(false); const handoffReviewUrl = ref('');
const toolMode = ref<ToolMode>(null); const toolProjectId = ref<number | null>(null); const requirement = ref(''); const requirementPlan = ref(''); const docsReady = ref(false); const toolMessage = ref(''); const toolBusy = ref(false); const showTimelineDrawer = ref(false);
type EpicSequence = { epic: TaskItem; tasks: TaskItem[]; completedIds: number[]; activeChildId: number | null; waitingForApproval: boolean; autoContinue: boolean };
const epicSequence = ref<EpicSequence | null>(null);
let epicApprovalToken = 0;
const autoSubmitHandoff = ref(localStorage.getItem('task-hub-auto-submit-handoff') === 'true');
const autoContinueEpic = ref(localStorage.getItem('task-hub-auto-continue-epic') !== 'false');
const settingsOpen = ref(false); const router = ref<{ enabled: boolean; endpoint: string; hasApiKey: boolean } | null>(null); const routerMessage = ref(''); const routerSaving = ref(false); const updater = ref<{ status: string; version?: string; percent?: number; message?: string }>({ status: 'idle' });
const running = computed(() => runStatus.value === 'running'); const hubUrl = computed(() => sync.credential.value?.taskHubUrl || 'https://task-hub.macatung.dev');
const openHub = () => window.desktopApi?.openExternal?.(`${hubUrl.value}/tasks`); const close = () => window.desktopApi?.close?.();
const updateAutoSubmitHandoff = (enabled: boolean) => { autoSubmitHandoff.value = enabled; localStorage.setItem('task-hub-auto-submit-handoff', String(enabled)); if (enabled) queueMicrotask(() => { void tryAutoSubmitHandoff(); }); };
const updateAutoContinueEpic = (enabled: boolean) => { autoContinueEpic.value = enabled; localStorage.setItem('task-hub-auto-continue-epic', String(enabled)); };
const loadRouterSettings = async () => { try { router.value = await window.desktopApi?.agent?.getLocalRouter?.() || null; } catch { routerMessage.value = 'Could not read local router settings.'; } };
const saveRouterSettings = async ({ enabled, apiKey }: { enabled: boolean; apiKey: string }) => { try { routerSaving.value = true; routerMessage.value = ''; router.value = await window.desktopApi.agent.saveLocalRouter({ enabled, apiKey: apiKey.trim() || undefined }); routerMessage.value = enabled ? 'Local router configuration saved.' : 'Local router disabled. Providers will use their native routes.'; } catch (e: any) { routerMessage.value = e?.message || 'Could not save local router configuration.'; } finally { routerSaving.value = false; } };
const checkRouter = async () => { try { routerMessage.value = 'Testing local router…'; const result = await window.desktopApi.agent.checkLocalRouter(true); routerMessage.value = result?.ok ? `Connected. ${result.models?.length || 0} model(s) discovered.` : (result?.error || 'Local router is unavailable.'); } catch (e: any) { routerMessage.value = e?.message || 'Could not test local router.'; } };
const openRouterDashboard = () => window.desktopApi?.agent?.openLocalRouterDashboard?.();
const checkAppUpdate = async () => { updater.value = await window.desktopApi?.updater?.check?.() || { status: 'error', message: 'Desktop updater is unavailable.' }; };
const installAppUpdate = async () => { updater.value = await window.desktopApi?.updater?.install?.() || updater.value; };
const isSandboxFailure = (value: string) => /codex-windows-sandbox-setup|sandbox startup failure|workspace sandbox.*(?:fail|cannot|missing|error)|helper executable.*(?:fail|cannot|missing)|(?:sandbox|codex).*(?:access denied|could not start|failed to launch)/i.test(value);
const runDiagnostics = async () => { if (provider.value !== 'codex') return; diagnosticsLoading.value = true; try { diagnostics.value = await window.desktopApi.agent.codexDiagnostics(); } catch (e: any) { diagnostics.value = { ok: false, summary: 'Could not run Codex diagnostics.', details: [e?.message || 'Unknown error.'] }; } finally { diagnosticsLoading.value = false; } };
const requestHumanApproval = async (reason = error.value || 'The local agent needs an approval to continue.') => {
  if (!pendingLaunch.value && selectedTask.value) {
    pendingLaunch.value = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: 'task',
      policy: executionPolicy.value,
      intent: 'task',
    };
  }
  await runDiagnostics();
  const sandboxBlocked = isSandboxFailure(`${reason}\n${diagnostics.value?.summary || ''}`);
  const alreadyFullAccess = pendingLaunch.value?.policy === 'full_access';
  const diagnosticDetails = [...(diagnostics.value?.details || [])];
  if (alreadyFullAccess) diagnosticDetails.unshift('This run already used full access. Approval can record a deliberate retry, but it cannot repair the missing Windows sandbox helper. Repair or restart Codex if the retry fails again.');
  approvalRequest.value = {
    id: `approval-${Date.now()}`,
    reason,
    requestedAt: new Date().toLocaleString(),
    recommendedPolicy: sandboxBlocked || alreadyFullAccess ? 'full_access' : 'workspace_write',
    diagnosticSummary: alreadyFullAccess ? 'Full-access run failed — human review required before retrying.' : (diagnostics.value?.summary || 'Human review required before retrying.'),
    diagnosticDetails,
  };
  phase.value = 'Awaiting human approval';
};
const approveRetry = async (policy: 'workspace_write' | 'full_access') => {
  const request = approvalRequest.value;
  let pending = pendingLaunch.value;
  if (!pending && selectedTask.value) {
    pending = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: 'task',
      policy: executionPolicy.value,
      intent: 'task',
    };
    pendingLaunch.value = pending;
  }
  if (!request || !pending) return;
  const warning = policy === 'full_access' ? 'Approve one full-access retry? Codex will bypass its sandbox and native approval prompts. The worktree remains isolated, but this grants the agent broader access on this machine.' : 'Approve a workspace-write retry? Codex can edit only the isolated worktree and may request another escalation.';
  if (!window.confirm(warning)) return;
  executionPolicy.value = policy;
  approvalRequest.value = null;
  error.value = '';
  phase.value = `Human approved ${policy === 'full_access' ? 'full access' : 'workspace-write'} retry`;
  output.value += `\n✓ Human approval recorded at ${new Date().toLocaleTimeString()}: ${policy}. Continuing the same run.\n`;
  try {
    if (runId.value) await updateRun('running', `Human approved retry with ${policy}.`);
    await startLocal(pending.prompt, pending.kind, policy, pending.intent, true);
  } catch (e: any) {
    error.value = e?.message || 'Could not start approved retry.';
    void requestHumanApproval(error.value);
  }
};
const dismissApproval = () => { approvalRequest.value = null; phase.value = 'Approval declined — run remains stopped'; output.value += '\nHuman approval declined. No retry was started.\n'; };
const mcp = async (name: string, args: Record<string, unknown>) => {
  const cred = sync.credential.value;
  if (!cred) throw new Error('Connect Task Hub before starting an agent.');
  let rawArgs: Record<string, unknown> = {};
  try { rawArgs = JSON.parse(JSON.stringify(args)); } catch { rawArgs = { ...args }; }
  const response = await window.desktopApi.taskHub.mcpCall(cred.taskHubUrl, cred.token, String(cred.projectId), 'tools/call', { name, arguments: rawArgs });
  if (response?.error) throw new Error(response.error.message || 'Task Hub request failed.');
  const text = response?.result?.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : response?.result;
};
const refresh = async () => {
  syncing.value = true;
  error.value = '';
  try {
    await sync.loadCredential();
    const [, backlogLoaded] = await Promise.all([sync.fetchProjects(), sync.fetchAgentTasks()]);
    lastSynced.value = new Date().toLocaleTimeString();
    if (!backlogLoaded) {
      error.value = sync.connectionError.value || 'Could not load the Task Hub backlog. Your cached queue may be stale.';
    } else if (sync.agentTasks.value.length) {
      // Auto background prefetch context packs for active workspace tasks
      void contextPackCache.prefetchQueue(sync.agentTasks.value, mcp);
    }
  } catch (e: any) {
    error.value = e.message || 'Sync failed.';
  } finally {
    syncing.value = false;
  }
};
const chooseWorkspace = async () => {
  notify({ type: 'info', title: 'Chọn thư mục dự án', message: 'Đang mở hộp thoại chọn thư mục làm việc…' });
  const next = await window.desktopApi?.agent?.pickWorkspace?.();
  if (next) {
    workspace.value = next;
    await window.desktopApi.agent.saveWorkspace(next);
    notify({ type: 'success', title: 'Đã chọn thư mục dự án', message: `Thư mục: ${next}` });
    if (sync.agentTasks.value.length) {
      void contextPackCache.prefetchQueue(sync.agentTasks.value, mcp);
    }
  }
};
const connect = async () => {
  startOperation('pairing', 'Kết nối Task Hub', 'Đang tạo mã ghép nối và mở trình duyệt xác thực…');
  const pairing = await window.desktopApi.taskHub.startPairing(hubUrl.value, selectedTask.value?.project_id || null);
  await window.desktopApi.openExternal(pairing.approval_url);
  phase.value = 'Waiting for Hub approval';
  const timer = window.setInterval(async () => {
    try {
      const status = await window.desktopApi.taskHub.pollPairing(hubUrl.value, pairing.pairing_id, pairing.device_secret);
      if (status.status === 'approved') {
        window.clearInterval(timer);
        await sync.setCredential({ taskHubUrl: hubUrl.value, token: status.mcp_token, projectId: String(status.project_id), projectTitle: status.project_title, workspaceName: status.workspace_name });
        phase.value = 'Ready';
        finishOperation('pairing', 'success', 'Kết nối thành công!', `Dự án: ${status.project_title || status.project_id}`);
        await refresh();
      } else if (['denied', 'expired', 'rejected'].includes(status.status)) {
        window.clearInterval(timer);
        error.value = `Pairing ${status.status}.`;
        phase.value = 'Ready';
        finishOperation('pairing', 'error', 'Ghép nối thất bại', `Trạng thái: ${status.status}`);
      }
    } catch (e: any) {
      window.clearInterval(timer);
      error.value = e.message;
      phase.value = 'Ready';
      finishOperation('pairing', 'error', 'Lỗi kết nối', error.value);
    }
  }, 1800);
};
const prepareWorktree = async (suffix: string) => {
  if (!workspace.value) await chooseWorkspace();
  if (!workspace.value) throw new Error('Choose a local repository first.');
  notify({ type: 'loading', id: 'prepare-worktree', title: 'Chuẩn bị Git Worktree', message: 'Tạo nhánh cô lập và kiểm tra môi trường…' });
  const preflight = await window.desktopApi.agent.preflight(provider.value, workspace.value);
  if (!preflight?.ok) throw new Error('Local agent preflight failed.');
  const result = await window.desktopApi.agent.createWorktree(preflight.repository, suffix);
  worktree.value = result.path;
  finishOperation('prepare-worktree', 'success', 'Worktree sẵn sàng', `Nhánh: ${result.path.split(/[\\/]/).pop()}`);
  return { preflight, result };
};
const startLocal = async (prompt: string, kind: 'task' | 'docs' = 'task', policy: ExecutionPolicy = 'workspace_write', intent: RunIntent = 'task', preserveOutput = false) => {
  pendingLaunch.value = { prompt, kind, policy, intent };
  runIntent.value = intent;
  if (!preserveOutput) output.value = '';
  runOutputStart.value = output.value.length;
  error.value = '';
  phase.value = 'Running';
  runStatus.value = 'running';
  runExitCode.value = null;
  notify({ type: 'loading', id: 'start-local', title: 'Agent đang thực thi', message: `Chạy ${provider.value.toUpperCase()} trong worktree cô lập…`, persistent: true });
  try {
    const result = await window.desktopApi.agent.startInteractive(provider.value, worktree.value, prompt, kind, undefined, policy);
    sessionId.value = result.sessionId;
    if (result.mode === 'external') output.value += 'External agent session opened. Return here when the work is complete.\n';
  } catch (e) {
    runStatus.value = 'failed';
    phase.value = 'Run failed';
    finishOperation('start-local', 'error', 'Không thể bắt đầu Agent', String(e));
    throw e;
  }
};
const epicTaskIsReady = (task: TaskItem, sequence: EpicSequence) => {
  if (task.status === 'done' || sequence.completedIds.includes(task.id)) return false;
  return !(task.dependencies || []).some(dependency => {
    const dependencyId = dependency.depends_on_task_id;
    return !sequence.completedIds.includes(dependencyId) && dependency.depends_on?.status !== 'done';
  });
};
const nextEpicTask = (sequence: EpicSequence) => sequence.tasks.find(task => epicTaskIsReady(task, sequence)) || null;
const stopEpicSequence = (message = 'Epic sequence stopped.') => {
  epicApprovalToken += 1;
  epicSequence.value = null;
  if (message) toolMessage.value = message;
};
const advanceEpicSequence = async (childId: number, gate: 'handoff' | 'approval') => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  sequence.completedIds = [...new Set([...sequence.completedIds, childId])];
  sequence.waitingForApproval = false;
  const next = nextEpicTask(sequence);
  if (!next) {
    const unfinished = sequence.tasks.filter(task => !sequence.completedIds.includes(task.id) && task.status !== 'done');
    if (unfinished.length) {
      phase.value = 'Epic blocked by task dependencies';
      error.value = `No dependency-ready task remains. Review: ${unfinished.map(task => task.issue_key || `#${task.id}`).join(', ')}.`;
      return;
    }
    phase.value = 'Epic sequence complete';
    toolMessage.value = gate === 'approval'
      ? `All ${sequence.tasks.length} task handoffs were approved on Hub.`
      : `All ${sequence.tasks.length} tasks have run. Handoffs remain available for Hub review.`;
    selectedTask.value = sequence.epic;
    epicSequence.value = null;
    runStatus.value = 'idle';
    runIntent.value = 'task';
    return;
  }
  sequence.activeChildId = next.id;
  selectedTask.value = next;
  handoffReviewUrl.value = '';
  output.value = '';
  runStatus.value = 'idle';
  phase.value = `Starting ${next.issue_key || `#${next.id}`} in Epic sequence (${sequence.completedIds.length + 1}/${sequence.tasks.length})`;
  await launch();
};
const waitForEpicApproval = async (childId: number) => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  const token = ++epicApprovalToken;
  sequence.waitingForApproval = true;
  phase.value = 'Waiting for Hub approval';
  toolMessage.value = `Waiting for Hub approval for ${selectedTask.value?.issue_key || `#${childId}`} before continuing the Epic.`;
  for (let attempt = 0; attempt < 720 && epicSequence.value && token === epicApprovalToken; attempt += 1) {
    await new Promise(resolve => window.setTimeout(resolve, 2500));
    if (!epicSequence.value || token !== epicApprovalToken) return;
    const synced = await sync.fetchAgentTasks();
    if (!synced) continue;
    const current = sync.agentTasks.value.find(task => task.id === childId);
    // Approved/done tasks disappear from the runnable queue, so the original
    // snapshot plus the completed id is the source of truth for the sequence.
    if (current?.status !== 'done' && current) continue;
    await advanceEpicSequence(childId, 'approval');
    return;
  }
};
const launchEpic = async () => {
  const epic = selectedTask.value;
  if (!epic || epic.issue_type !== 'epic') return;
  const tasks = sync.agentTasks.value
    .filter(task => task.epic_id === epic.id && task.issue_type !== 'epic')
    .sort((a, b) => a.id - b.id);
  if (!tasks.length) {
    error.value = 'This Epic has no runnable child tasks yet.';
    phase.value = 'Epic has no child tasks';
    return;
  }
  const sequence: EpicSequence = { epic, tasks, completedIds: tasks.filter(task => task.status === 'done').map(task => task.id), activeChildId: null, waitingForApproval: false, autoContinue: autoContinueEpic.value };
  const first = nextEpicTask(sequence);
  if (!first) {
    error.value = 'No dependency-ready child task is available for this Epic.';
    phase.value = 'Epic is blocked by dependencies';
    return;
  }
  epicSequence.value = sequence;
  selectedTask.value = first;
  sequence.activeChildId = first.id;
  phase.value = `Starting ${first.issue_key || `#${first.id}`} in Epic sequence (1/${tasks.length})`;
  await launch();
};
const launch = async () => {
  try {
    error.value = '';
    handoffReviewUrl.value = '';
    approvalRequest.value = null;
    if (!selectedTask.value) throw new Error('Select a task first.');
    if (selectedTask.value.issue_type === 'epic') { await launchEpic(); return; }
    const launchIntent: RunIntent = epicSequence.value ? 'epic' : 'task';
    pendingLaunch.value = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: 'task',
      policy: executionPolicy.value,
      intent: launchIntent,
    };
    startOperation('agent-run', 'Đã ghi nhận lệnh chạy', `Khởi chạy ${selectedTask.value.issue_key || `#${selectedTask.value.id}`} với ${provider.value.toUpperCase()}…`);
    const { preflight } = await prepareWorktree(selectedTask.value.issue_key || `task-${selectedTask.value.id}`);
    
    const taskUpdatedAt = (selectedTask.value as any).updated_at;
    let context = contextPackCache.get(selectedTask.value.id)?.data;
    if (context && contextPackCache.isFresh(selectedTask.value.id, taskUpdatedAt)) {
      updateOperation('agent-run', 'Nạp Context Pack cục bộ đã đồng bộ sẵn…');
      // Fire background silent revalidation for next execution
      void contextPackCache.prefetch(selectedTask.value.id, mcp, taskUpdatedAt, true);
    } else {
      updateOperation('agent-run', 'Tải context pack từ Task Hub…');
      const res = await mcp('get_context_pack', { task_id: selectedTask.value.id });
      context = res?.data || res;
      if (context) contextPackCache.set(selectedTask.value.id, context, taskUpdatedAt);
    }

    let plainContext: any = {};
    try { plainContext = JSON.parse(JSON.stringify(context?.data || context || {})); } catch { plainContext = context || {}; }

    const started = await mcp('start_agent_run', {
      task_id: selectedTask.value.id,
      provider: provider.value,
      agent_session_id: `${provider.value}-${Date.now()}`,
      repository: preflight.repository,
      branch: worktree.value,
      context: plainContext,
      instruction: {
        execution_policy: executionPolicy.value,
        approval_mode: executionPolicy.value === 'full_access' ? 'bypass' : 'request_human_approval',
      },
    });
    runId.value = started?.data?.id || started?.id || null;
    await window.desktopApi.agent.configureMcp({
      cwd: worktree.value,
      provider: provider.value,
      taskHubUrl: hubUrl.value,
      projectId: String(selectedTask.value.project_id || sync.credential.value?.projectId),
      token: sync.credential.value!.token,
    });
    if (runId.value) { interactiveReporter.start(runId.value); await updateRun('running'); }
    finishOperation('agent-run', 'success', 'Khởi chạy thành công', 'Agent đang streaming mã nguồn và log.');
    await startLocal(`Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.${epicSequence.value ? ` This task is one step in Epic ${epicSequence.value.epic.issue_key || epicSequence.value.epic.title}; do not work on sibling tasks.` : ''}\n\n${JSON.stringify(plainContext, null, 2)}`, 'task', executionPolicy.value, launchIntent);
  } catch (e: any) {
    interactiveReporter.finish('failed', { error: e?.message || String(e) });
    if (runId.value) void updateRun('failed', e?.message || 'Could not launch local agent.');
    runStatus.value = 'failed';
    phase.value = 'Run failed';
    error.value = e.message || 'Could not launch agent.';
    finishOperation('agent-run', 'error', 'Lỗi khởi chạy', error.value);
    void requestHumanApproval(error.value);
  }
};
const updateRun = async (status: string, summary?: string) => { if (runId.value) await mcp('update_agent_run', { run_id: runId.value, status, summary }); };
const cancel = async () => {
  notify({ type: 'warning', title: 'Đang hủy phiên chạy', message: 'Gửi tín hiệu dừng agent…' });
  runStatus.value = 'cancelled';
  phase.value = 'Run cancelled';
  if (sessionId.value) await window.desktopApi.agent.stop(sessionId.value);
  interactiveReporter.finish('cancelled', { reason: 'stopped_by_user' });
  await updateRun('cancelled', 'Stopped by user.');
  sessionId.value = null;
  if (epicSequence.value) stopEpicSequence('Epic sequence cancelled by the user.');
  notify({ type: 'info', title: 'Đã hủy phiên chạy', message: 'Tiến trình Agent đã dừng an toàn.' });
};
const send = (message: string) => {
  if (sessionId.value && message.trim()) {
    window.desktopApi.agent.send(sessionId.value, message.trim());
    notify({ type: 'info', title: 'Đã gửi tin nhắn đến Agent', message: message.trim() });
  }
};
const handoff = async (payload: any) => {
  try {
    if (!selectedTask.value) return;
    const handoffTaskId = selectedTask.value.id;
    const isEpicChild = epicSequence.value && runIntent.value === 'epic';
    startOperation('handoff', 'Đang gửi bàn giao', 'Đồng bộ kết quả kiểm thử và PR lên Task Hub…');
    const result = await mcp('complete_agent_handoff', { run_id: runId.value || undefined, task_id: handoffTaskId, summary: payload.summary || 'Local agent completed work.', changed_files: String(payload.changedFiles || '').split('\n').map((x: string) => x.trim()).filter(Boolean), tests: [{ command: payload.tests || 'Verification', status: payload.testStatus, summary: payload.testSummary || 'Completed' }], commit_sha: payload.commitSha || undefined, pull_request_url: payload.pullRequestUrl || undefined, blockers: payload.blockers || undefined });
    if (result?.success === false) throw new Error(result.message || 'Task Hub rejected the handoff.');
    const confirmedRunId = Number(result?.data?.id || runId.value || 0);
    handoffReviewUrl.value = `${hubUrl.value.replace(/\/$/, '')}/tasks?task_id=${encodeURIComponent(String(handoffTaskId))}${confirmedRunId ? `&run_id=${confirmedRunId}` : ''}`;
    phase.value = 'Submitted for Hub review';
    finishOperation('handoff', 'success', 'Bàn giao thành công!', 'Task đã chuyển sang chế độ chờ duyệt trên Hub. Mở link để review và approve/reject.', handoffReviewUrl.value);
    await refresh();
    if (isEpicChild && epicSequence.value) {
      const failedVerification = payload.testStatus === 'failed' || Boolean(String(payload.blockers || '').trim());
      if (epicSequence.value.autoContinue && !failedVerification) {
        void advanceEpicSequence(handoffTaskId, 'handoff');
      } else if (failedVerification) {
        phase.value = 'Epic paused — review failed handoff';
        toolMessage.value = 'The Epic stopped because this child handoff contains failed verification or blockers. Review it on Hub before continuing.';
      } else {
        void waitForEpicApproval(handoffTaskId);
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Handoff submission failed.';
    phase.value = 'Handoff submission failed — review and retry';
    toolMessage.value = error.value;
    finishOperation('handoff', 'error', 'Lỗi gửi bàn giao', error.value);
  } finally {
    autoHandoffSubmitting.value = false;
  }
};
const autoHandoffPayload = () => selectedTask.value
  ? buildAutoHandoffPayload({ output: output.value.slice(runOutputStart.value), taskTitle: selectedTask.value.title, exitCode: runExitCode.value })
  : null;
const tryAutoSubmitHandoff = () => {
  const epicAutoSubmit = runIntent.value === 'epic' && epicSequence.value?.autoContinue === true;
  if (!(autoSubmitHandoff.value || epicAutoSubmit) || !['task', 'epic'].includes(runIntent.value) || runStatus.value !== 'completed' || autoHandoffSubmitting.value || phase.value === 'Submitted for Hub review') return false;
  const payload = autoHandoffPayload();
  if (!payload) return false;
  autoHandoffSubmitting.value = true;
  phase.value = 'Auto-submitting handoff';
  void handoff(payload);
  return true;
};
const openTool = (mode: Exclude<ToolMode, null>) => {
  toolMode.value = mode;
  toolMessage.value = '';
  output.value = '';
  docsReady.value = false;
  if (!toolProjectId.value && sync.projects.value[0]) toolProjectId.value = sync.projects.value[0].id;
  notify({
    type: 'info',
    title: mode === 'requirement' ? 'AI Requirement Discovery' : 'Docs Scanner',
    message: mode === 'requirement' ? 'Nhập yêu cầu để AI phân tích và lập kế hoạch Backlog.' : 'Quét mã nguồn để sinh bộ tài liệu chuẩn docs/.',
  });
};
const runRequirement = async ({ projectId, requirement: text }: { projectId: number; requirement: string }) => {
  try {
    toolBusy.value = true;
    toolProjectId.value = projectId;
    requirement.value = text;
    requirementPlan.value = '';
    docsReady.value = false;
    startOperation('req-run', 'Đang phân tích yêu cầu', 'Tạo Git worktree và nạp ngữ cảnh dự án…');
    await prepareWorktree('requirement-discovery');
    toolMessage.value = 'Preparing repository context…';
    updateOperation('req-run', 'Agent đang khám phá mã nguồn và tài liệu…');
    await startLocal(`You are Task Hub's Requirement Discovery agent. Analyze this requirement: ${text}\n\nInspect the repository and its docs. Do not create work items. Return a concise Vietnamese plan with one Epic, Stories and implementation Tasks, acceptance criteria, Fibonacci story points and explicit task dependencies.${serializeDiscoveryPlanContract()}`, 'task', executionPolicy.value, 'requirement');
  } catch (e: any) {
    error.value = e.message || 'Requirement analysis failed.';
    toolMessage.value = error.value;
    finishOperation('req-run', 'error', 'Lỗi phân tích yêu cầu', error.value);
  } finally {
    toolBusy.value = false;
  }
};
const reviseRequirement = async ({ projectId, requirement: text, feedback }: { projectId: number; requirement: string; feedback: string }) => {
  try {
    if (!feedback.trim()) throw new Error('Describe the changes you want before requesting a revision.');
    toolBusy.value = true;
    toolProjectId.value = projectId;
    requirement.value = text;
    const previousProposal = requirementPlan.value || conciseAgentReply(output.value);
    requirementPlan.value = '';
    startOperation('req-revise', 'Đang yêu cầu sửa đổi', 'Gửi ghi chú phản hồi đến AI Agent…');
    toolMessage.value = 'Sending your review notes to the local agent…';
    if (!worktree.value) await prepareWorktree('requirement-revision');
    await startLocal(`You are revising a Task Hub backlog proposal. Do not create or sync any work items.\n\nOriginal requirement:\n${text}\n\nCurrent proposal:\n${previousProposal}\n\nReviewer feedback — apply every requested change:\n${feedback}\n\nReturn the complete replacement proposal in Vietnamese: one Epic, Stories and implementation Tasks, acceptance criteria, Fibonacci story points and explicit task dependencies.${serializeDiscoveryPlanContract()}`, 'task', executionPolicy.value, 'requirement');
  } catch (e: any) {
    error.value = e.message || 'Could not request proposal changes.';
    toolMessage.value = error.value;
    finishOperation('req-revise', 'error', 'Lỗi yêu cầu sửa đổi', error.value);
  } finally {
    toolBusy.value = false;
  }
};
const conciseAgentReply = (value: string) => { const replies = [...value.matchAll(/💬\s*([\s\S]*?)(?=\n(?:⚡|✓|💬)|$)/g)].map(match => match[1].trim()).filter(Boolean); return replies.at(-1) || value.slice(-12000); };
const createBacklog = async () => {
  try {
    if (!toolProjectId.value || !requirement.value) return;
    const parsed = parseDiscoveryPlan(requirementPlan.value || output.value);
    if (!parsed.plan || parsed.errors.length) throw new Error(parsed.errors.join(' '));
    const totalTasks = parsed.plan.stories.reduce((count, story) => count + story.tasks.length, 0);
    if (!window.confirm(`Approve and sync this proposal to Hub? This will create 1 Epic and ${totalTasks} task(s) in the selected project.`)) return;
    toolBusy.value = true;
    startOperation('create-backlog', 'Đang tạo Backlog trên Hub', `Khởi tạo 1 Epic và ${totalTasks} task(s)…`);
    toolMessage.value = 'Creating linked Epic and backlog on Hub…';
    const tasks = parsed.plan.stories.flatMap(story => story.tasks.map(task => ({ ref: task.ref, title: task.title, issue_type: 'task', description: `Story: ${story.title}\n\n${task.acceptance_criteria.join('\n')}`, acceptance_criteria: task.acceptance_criteria.join('\n'), story_points: task.story_points, priority: 'medium', depends_on: task.depends_on })));
    const result = await mcp('create_requirement_backlog', { project_id: toolProjectId.value, epic: parsed.plan.epic, tasks });
    toolMessage.value = result?.message || `Created 1 Epic and ${totalTasks} task(s) on Hub.`;
    phase.value = 'Backlog created and synced';
    finishOperation('create-backlog', 'success', 'Đã tạo Backlog thành công!', toolMessage.value);
    await refresh();
  } catch (e: any) {
    error.value = e.message || 'Backlog creation failed.';
    toolMessage.value = error.value;
    finishOperation('create-backlog', 'error', 'Lỗi tạo Backlog', error.value);
  } finally {
    toolBusy.value = false;
  }
};
const runDocs = async (projectId: number) => {
  try {
    toolBusy.value = true;
    toolProjectId.value = projectId;
    docsReady.value = false;
    startOperation('docs-scan', 'Đang quét tài liệu', 'Tạo Git worktree và nạp ngữ cảnh dự án…');
    const { result } = await prepareWorktree('docs-from-repo');
    toolMessage.value = 'Scanning repository in an isolated worktree…';
    updateOperation('docs-scan', 'Agent đang phân tích mã nguồn và soạn thảo docs/…');
    await startLocal('Scan this repository and generate/update only docs/PROJECT_DOCUMENTS.md, docs/PROJECT_BRIEF.md, docs/PRD.md, docs/FUNCTIONAL_SPECIFICATION.md (structured with explicit Functional vs Non-Functional requirements, per-function specifications, and embedded Mermaid diagrams), docs/ARCHITECTURE.md, docs/QA_PLAN.md and docs/RELEASE_RUNBOOK.md. Base every statement on inspected code. Do not edit application code, commit, push, deploy or create Task Hub records. Finish with a concise summary.', 'docs');
    worktree.value = result.path;
  } catch (e: any) {
    error.value = e.message || 'Documentation scan failed.';
    toolMessage.value = error.value;
    finishOperation('docs-scan', 'error', 'Lỗi quét tài liệu', error.value);
  } finally {
    toolBusy.value = false;
  }
};
const saveDocs = async () => {
  try {
    toolBusy.value = true;
    toolMessage.value = 'Saving documentation to the repository…';
    startOperation('save-docs', 'Đang lưu tài liệu', 'Ghi các file tài liệu vào thư mục docs/…');
    await window.desktopApi.agent.applyDocsToWorkspace(worktree.value, workspace.value);
    contextPackCache.invalidate();
    toolMessage.value = 'Documentation saved to the repository.';
    finishOperation('save-docs', 'success', 'Đã lưu tài liệu vào repository!', 'Các file docs/ đã được cập nhật.');
  } catch (e: any) {
    toolMessage.value = e.message || 'Could not save documentation.';
    finishOperation('save-docs', 'error', 'Lỗi lưu tài liệu', toolMessage.value);
  } finally {
    toolBusy.value = false;
  }
};
const syncDocs = async () => {
  try {
    toolBusy.value = true;
    if (!toolProjectId.value) throw new Error('Select a Hub project first.');
    toolMessage.value = 'Syncing documentation to Task Hub…';
    startOperation('sync-docs', 'Đang đồng bộ tài liệu lên Hub', 'Đăng ký tài liệu với Task Hub API…');
    const payload = await window.desktopApi.agent.readGeneratedDocuments(worktree.value);
    await window.desktopApi.taskHub.importGeneratedDocuments(hubUrl.value, sync.credential.value!.token, toolProjectId.value, payload);
    contextPackCache.invalidate();
    toolMessage.value = 'Documentation synced to Task Hub.';
    finishOperation('sync-docs', 'success', 'Đã đồng bộ tài liệu thành công!', 'Tài liệu đã xuất hiện trên Task Hub.');
  } catch (e: any) {
    toolMessage.value = e.message || 'Could not sync documentation.';
    finishOperation('sync-docs', 'error', 'Lỗi đồng bộ tài liệu', toolMessage.value);
  } finally {
    toolBusy.value = false;
  }
};
const selectTask = (task: TaskItem) => {
  if (epicSequence.value && task.id !== epicSequence.value.epic.id && task.id !== epicSequence.value.activeChildId) stopEpicSequence('Epic sequence paused because another task was selected.');
  selectedTask.value = task;
  handoffReviewUrl.value = '';
  void contextPackCache.prefetch(task.id, mcp, (task as any).updated_at);
  notify({ type: 'info', title: 'Đã chọn nhiệm vụ', message: `${task.issue_key || `#${task.id}`} — ${task.title}`, durationMs: 2500 });
};
let unsubOutput: (() => void) | undefined; let unsubExit: (() => void) | undefined; let unsubUpdater: (() => void) | undefined;
const handleAgentExit = (event: any) => {
  if (event.sessionId !== sessionId.value) return;
  const exitCode = typeof event.code === 'number' ? event.code : null;
  output.value += `\nProcess exited (${exitCode ?? 'unknown'}).`;
  sessionId.value = null;
  runExitCode.value = exitCode;
  if (runStatus.value !== 'cancelled') runStatus.value = exitCode === 0 ? 'completed' : 'failed';

  // Codex can explain that the Windows sandbox helper failed and still end the
  // turn successfully. Treat that response as a blocked run, not a completed
  // task, so the human approval flow is surfaced instead of being hidden under
  // a misleading green "Completed" status.
  if (runStatus.value === 'completed' && isSandboxFailure(output.value.slice(runOutputStart.value))) {
    runStatus.value = 'failed';
    phase.value = 'Sandbox blocked — approval required';
    error.value = 'Codex could not start its workspace sandbox. This task has not run; review diagnostics and approve a retry.';
    toolMessage.value = 'The local sandbox blocked this run before work could begin.';
    finishOperation('start-local', 'warning', 'Sandbox bị chặn', 'Cần cấp quyền để thử lại.');
    if (pendingLaunch.value) void requestHumanApproval(output.value.slice(runOutputStart.value).slice(-8000));
    return;
  }

  if (runStatus.value === 'failed') {
    phase.value = 'Run failed';
    error.value = `Agent process ended with exit code ${exitCode ?? 'unknown'}. Review the execution details below.`;
    toolMessage.value = 'The agent did not complete successfully.';
    finishOperation('start-local', 'error', 'Agent dừng thực thi', error.value);
    if (pendingLaunch.value) void requestHumanApproval(`${error.value}\n${output.value.slice(-8000)}`);
    return;
  }

  if (runStatus.value === 'cancelled') {
    phase.value = 'Run cancelled';
    toolMessage.value = 'The agent was stopped by the user.';
    finishOperation('start-local', 'warning', 'Đã hủy phiên chạy', 'Tiến trình agent đã dừng.');
    return;
  }

  if (runIntent.value === 'requirement' && requirement.value) {
    requirementPlan.value = conciseAgentReply(output.value);
    toolMessage.value = 'Review the backlog proposal before creating tasks.';
    phase.value = 'Backlog proposal ready';
    toolMode.value = 'requirement';
    finishOperation('req-run', 'success', 'Bản thảo Backlog sẵn sàng!', 'Vui lòng kiểm tra và phê duyệt.');
  } else if (toolMode.value === 'docs') {
    docsReady.value = true;
    toolMessage.value = 'Review the generated docs, then save or sync them.';
    phase.value = 'Documentation ready';
    finishOperation('docs-scan', 'success', 'Tài liệu sẵn sàng!', 'Vui lòng kiểm tra và lưu hoặc đồng bộ.');
  } else if (['task', 'epic'].includes(runIntent.value) && (autoSubmitHandoff.value || (runIntent.value === 'epic' && epicSequence.value?.autoContinue))) {
    if (!tryAutoSubmitHandoff()) {
      phase.value = 'Run completed — handoff needs review';
      toolMessage.value = 'Auto-submit is enabled, but this run was blocked or has no selected task. Review and submit the handoff manually.';
    }
    finishOperation('start-local', 'success', 'Agent hoàn tất thực thi', 'Đang xử lý kiểm thử & bàn giao.');
  } else {
    phase.value = 'Run completed — ready for handoff';
    finishOperation('start-local', 'success', 'Agent hoàn tất thực thi', 'Sẵn sàng gửi báo cáo bàn giao.');
  }
};
watch([autoSubmitHandoff, runStatus], () => { void tryAutoSubmitHandoff(); });
onMounted(async () => {
  const saved = await window.desktopApi?.agent?.listWorkspaces?.();
  if (saved?.[0]) workspace.value = saved[0];
  await loadRouterSettings();
  updater.value = await window.desktopApi?.updater?.getState?.() || updater.value;
  unsubUpdater = window.desktopApi?.updater?.onState?.((state: any) => { updater.value = state; });
  unsubOutput = window.desktopApi?.agent?.onOutput?.((event: any) => {
    if (event.sessionId && !sessionId.value && running.value) {
      sessionId.value = event.sessionId;
    }
    if (event.sessionId === sessionId.value || (!sessionId.value && running.value)) {
      output.value += event.text;
      interactiveReporter.append(event.stream, event.text);
    }
  });
  unsubExit = window.desktopApi?.agent?.onExit?.((event: any) => {
    if (event.sessionId && !sessionId.value && running.value) {
      sessionId.value = event.sessionId;
    }
    const matchesActive = event.sessionId === sessionId.value || (!sessionId.value && running.value);
    const trackedRunId = runId.value;
    handleAgentExit(event);
    if (matchesActive && trackedRunId) {
      const status = event.code === 0 ? 'completed' : 'failed';
      interactiveReporter.finish(status, { exit_code: event.code ?? null, signal: event.signal ?? null });
      if (!autoHandoffSubmitting.value) void updateRun(status === 'completed' ? 'waiting_input' : 'failed', status === 'completed' ? 'Agent process completed; awaiting handoff.' : 'Agent process failed.');
    }
  });
  await refresh();
});
onUnmounted(() => { interactiveReporter.reset(); unsubOutput?.(); unsubExit?.(); unsubUpdater?.(); });
</script>
<template>
  <main class="cc-shell">
    <ConnectionBar
      :credential="sync.credential.value"
      :online="sync.isOnline.value"
      :syncing="syncing"
      :last-synced="lastSynced"
      @sync="refresh"
      @connect="connect"
      @disconnect="() => { sync.clearCredential(); notify({ type: 'warning', title: 'Đã ngắt kết nối', message: 'Đã xóa thông tin xác thực Task Hub.' }); }"
      @settings="settingsOpen = true"
      @requirement="openTool('requirement')"
      @docs="openTool('docs')"
      @timeline="showTimelineDrawer = true"
      @open-hub="openHub"
      @close="close"
    />
    <SettingsPanel
      :open="settingsOpen"
      :credential="sync.credential.value"
      :workspace="workspace"
      :execution-policy="executionPolicy"
      :diagnostics="diagnostics"
      :diagnostics-loading="diagnosticsLoading"
      :updater="updater"
      :router="router"
      :router-message="routerMessage"
       :saving="routerSaving"
       :auto-submit-handoff="autoSubmitHandoff"
       :auto-continue-epic="autoContinueEpic"
       @close="settingsOpen = false"
      @choose-workspace="chooseWorkspace"
       @update-execution-policy="(policy: ExecutionPolicy) => { executionPolicy = policy; notify({ type: 'info', title: 'Quyền thực thi', message: `Đã đổi thành: ${policy}` }); }"
       @update-auto-submit-handoff="updateAutoSubmitHandoff"
       @update-auto-continue-epic="updateAutoContinueEpic"
      @run-diagnostics="runDiagnostics"
      @check-app-update="checkAppUpdate"
      @install-app-update="installAppUpdate"
      @save-router="saveRouterSettings"
      @check-router="checkRouter"
      @open-router-dashboard="openRouterDashboard"
      @open-hub="openHub"
    />
    <WorkflowPanel
      :mode="toolMode"
      :projects="sync.projects.value"
      :provider="provider"
      :busy="toolBusy || running"
      :requirement-plan="requirementPlan"
      :docs-ready="docsReady"
      :message="toolMessage"
      :output="output"
      :phase="phase"
      :error="error"
      @close="toolMode = null"
      @run-requirement="runRequirement"
      @revise-requirement="reviseRequirement"
      @update-proposal="proposal => { requirementPlan = proposal; notify({ type: 'success', title: 'Đã lưu bản thảo', message: 'Bản thảo Backlog đã được cập nhật.' }); }"
      @create-backlog="createBacklog"
      @run-docs="runDocs"
      @save-docs="saveDocs"
      @sync-docs="syncDocs"
    />
    <div class="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)]">
      <TaskQueue
        :tasks="sync.agentTasks.value"
        :projects="sync.projects.value"
        :selected-id="selectedTask?.id || null"
        :loading="sync.isLoading.value"
          @select="selectTask"
        @requirement="openTool('requirement')"
        @open-hub="openHub"
      />
      <RunWorkspace
        v-model:provider="provider"
        v-model:execution-policy="executionPolicy"
        :task="selectedTask"
        :tasks="sync.agentTasks.value"
        :phase="phase"
        :workspace="workspace"
        :output="output"
        :running="running"
        :run-status="runStatus"
        :exit-code="runExitCode"
         :error="error"
         :approval-request="approvalRequest"
         :epic-child-count="selectedTask?.issue_type === 'epic' ? sync.agentTasks.value.filter(task => task.epic_id === selectedTask?.id && task.issue_type !== 'epic').length : 0"
         :epic-completed-count="epicSequence?.completedIds.length || 0"
         :epic-auto-continue="epicSequence?.autoContinue ?? autoContinueEpic"
         :epic-sequence-running="Boolean(epicSequence)"
         :diagnostics-loading="diagnosticsLoading"
         :handoff-review-url="handoffReviewUrl"
        @choose-workspace="chooseWorkspace"
        @launch="launch"
        @cancel="cancel"
        @send="send"
        @handoff="handoff"
        @request-approval="requestHumanApproval"
        @approve-retry="approveRetry"
        @dismiss-approval="dismissApproval"
        @open-hub="openHub"
        @timeline="showTimelineDrawer = true"
      />
    </div>
    <ActivityTimelineDrawer
      :show="showTimelineDrawer"
      :timeline="activityTimeline"
      :active-task="selectedTask"
      @close="showTimelineDrawer = false"
      @clear-timeline="clearTimeline"
    />
  </main>
</template>
