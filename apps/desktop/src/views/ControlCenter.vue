<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ConnectionBar from '../components/control-center/ConnectionBar.vue';
import TaskQueue from '../components/control-center/TaskQueue.vue';
import RunWorkspace, {
  type Provider,
} from '../components/control-center/RunWorkspace.vue';
import WorkflowPanel from '../components/control-center/WorkflowPanel.vue';
import SettingsPanel from '../components/control-center/SettingsPanel.vue';
import StatusFooter from '../components/control-center/StatusFooter.vue';
import AgentFleetBar from '../components/control-center/AgentFleetBar.vue';
import AgentInbox from '../components/control-center/AgentInbox.vue';
import FilesDrawer from '../components/control-center/FilesDrawer.vue';
import ActivityTimelineDrawer from '../components/ActivityTimelineDrawer.vue';
import { useTaskSync, type TaskItem } from '../composables/useTaskSync';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useContextPackCache } from '../composables/useContextPackCache';
import { useMcpOutbox } from '../composables/useMcpOutbox';
import {
  parseDiscoveryPlan,
  serializeDiscoveryPlanContract,
} from '../utils/discoveryPlan';
import { buildAutoHandoffPayload } from '../utils/autoHandoff';
import { hasAgentReportedFailure } from '../utils/agentRunOutcome';
import { InteractiveRunReporter } from '../services/interactiveRunReporter';
import type { SafetyInterceptEvent } from '../utils/safetyGuardrails';
import { DEFAULT_PROVIDER_MODELS } from '../constants/models';
type ToolMode = "requirement" | "docs" | null;
type RunStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
type ExecutionPolicy = "restricted" | "workspace_write" | "full_access";
type ExecutionRoute = "cao" | null;
type ApprovalRequest = {
  id: string;
  reason: string;
  requestedAt: string;
  recommendedPolicy: "workspace_write" | "full_access";
  diagnosticSummary?: string;
  diagnosticDetails?: string[];
};
type RunIntent = "task" | "epic" | "docs" | "requirement";
type PendingLaunch = {
  prompt: string;
  kind: "task" | "docs";
  policy: ExecutionPolicy;
  intent: RunIntent;
};
type AgentRole =
  | "supervisor"
  | "worker"
  | "reviewer"
  | "implementation"
  | "tool";
type AutoReviewStatus =
  | "idle"
  | "reviewing"
  | "changes_requested"
  | "approved"
  | "max_iterations"
  | "failed";
const sync = useTaskSync();
const contextPackCache = useContextPackCache();
const mcpOutbox = useMcpOutbox(() => sync.credential.value?.projectId);
const {
  notify,
  startOperation,
  updateOperation,
  finishOperation,
  activityTimeline,
  clearTimeline,
} = useActionFeedback();
const interactiveReporter = new InteractiveRunReporter();
const selectedTask = ref<TaskItem | null>(null);
const provider = ref<Provider>("codex");
const selectedModel = ref<string>(DEFAULT_PROVIDER_MODELS.codex || "gpt-5");
const executionPolicy = ref<ExecutionPolicy>("workspace_write");
const workspace = ref("");
const worktree = ref("");
const phase = ref("Ready");
const output = ref("");
const sessionId = ref<string | null>(null);
const executionRoute = ref<ExecutionRoute>(null);
const runId = ref<number | null>(null);
const implementationRunId = ref<number | null>(null);
const reviewerRunId = ref<number | null>(null);
const activeAgentRole = ref<AgentRole>("implementation");
const runStatus = ref<RunStatus>("idle");
const runExitCode = ref<number | null>(null);
const syncing = ref(false);
const lastSynced = ref<string | null>(null);
const error = ref("");
const approvalRequest = ref<ApprovalRequest | null>(null);
const activeSafetyAlert = ref<SafetyInterceptEvent | null>(null);
const pendingLaunch = ref<PendingLaunch | null>(null);
const runIntent = ref<RunIntent>("task");
const diagnostics = ref<any>(null);
const diagnosticsLoading = ref(false);
const runOutputStart = ref(0);
const implementationOutputStart = ref(0);
const reviewOutputStart = ref(0);
const autoHandoffSubmitting = ref(false);
const handoffReviewUrl = ref("");
const lastAgentOutputAt = ref<number | null>(null);
const contextHealth = ref<"healthy" | "quiet">("healthy");
const toolMode = ref<ToolMode>(null);
const toolProjectId = ref<number | null>(null);
const requirement = ref("");
const requirementPlan = ref("");
const docsReady = ref(false);
const toolMessage = ref("");
const toolBusy = ref(false);
const showTimelineDrawer = ref(false);
const showFilesDrawer = ref(false);
const showAgentRoomDrawer = ref(false);
type EpicSequence = {
  epic: TaskItem;
  tasks: TaskItem[];
  completedIds: number[];
  skippedIds?: number[];
  activeChildId: number | null;
  waitingForApproval: boolean;
  autoContinue: boolean;
  parentRunId: number | null;
  childRunIds: number[];
  childResults: EpicChildResult[];
  transitionToken: number;
  processingChildId: number | null;
  finalizing: boolean;
  worktreePath: string | null;
};
type EpicChildResult = {
  taskId: number;
  runId: number | null;
  issueKey: string;
  title: string;
  summary: string;
  changedFiles: string[];
  tests: string;
  testStatus: string;
  testSummary: string;
  commitSha: string;
  pullRequestUrl: string;
  blockers: string;
  review?: {
    status: AutoReviewStatus;
    reviewerProvider?: Provider;
    reviewerRunId?: number | null;
    iterations?: number;
    feedback?: string;
  };
};
const epicSequence = ref<EpicSequence | null>(null);
let epicApprovalToken = 0;
const autoSubmitHandoff = ref(
  localStorage.getItem('task-hub-auto-submit-handoff') !== 'false',
);
const autoContinueEpic = ref(
  localStorage.getItem('task-hub-auto-continue-epic') !== 'false',
);
const autoReviewEnabled = ref(
  localStorage.getItem('task-hub-auto-review-enabled') === 'true',
);
const reviewerProvider = ref<Provider>(
  (localStorage.getItem('task-hub-reviewer-provider') as Provider) ||
    provider.value ||
    'antigravity',
);
const autoReviewMaxIterations = ref(
  Math.min(
    5,
    Math.max(
      1,
      Number(localStorage.getItem("task-hub-auto-review-max-iterations") || 3),
    ),
  ),
);
const autoReviewIteration = ref(0);
const taskReviewMaxIterations = ref<number | null>(null);
const activeReviewMaxIterations = computed(() =>
  taskReviewMaxIterations.value ?? autoReviewMaxIterations.value,
);
const autoReviewStatus = ref<AutoReviewStatus>("idle");
const autoReviewFeedback = ref("");
const autoReviewSummary = ref("");
const settingsOpen = ref(false);
const updater = ref<{
  status: string;
  version?: string;
  percent?: number;
  message?: string;
}>({ status: "idle" });
type AgentRuntime = {
  provider: Provider;
  label: string;
  command: string;
  executable: string | null;
  status: "ready" | "missing" | "installing" | "failed";
  message: string;
};
const agentRuntimes = ref<AgentRuntime[]>([]);
const caoStatus = ref<{
  running: boolean;
  available: boolean;
  port: number;
  cli: string | null;
  source: "embedded" | "external" | "offline";
} | null>(null);
const fleetAgents = ref<any[]>([]);
const sessionTokenUsage = ref<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null>(null);
const caoReconnecting = ref(false);
const previousCaoAvailable = ref<boolean | null>(null);
const inboxMessages = ref<any[]>([]);
const inboxLoading = ref(false);
const runtimeRepairing = ref(false);
const cockpitAgentKey = (() => {
  const stored = localStorage.getItem("task-hub-cockpit-agent-key");
  if (stored) return stored;
  const value = `desktop-${crypto.randomUUID()}`;
  localStorage.setItem("task-hub-cockpit-agent-key", value);
  return value;
})();
const refreshFleet = async () => {
  try {
    const [active, saved] = await Promise.all([
      window.desktopApi?.agent?.listSessions?.() || [],
      window.desktopApi?.agent?.listSavedSessions?.() || [],
    ]);
    const byId = new Map<string, any>();
    [...saved, ...active].forEach((agent: any) =>
      byId.set(agent.sessionId, agent),
    );
    const sorted = [...byId.values()].sort(
      (a, b) =>
        Number(b.sessionId === sessionId.value) -
        Number(a.sessionId === sessionId.value),
    );
    const activeSessions = sorted.filter(
      (s) => s.status === "running" || s.sessionId === sessionId.value,
    );
    const inactiveSessions = sorted.filter(
      (s) => s.status !== "running" && s.sessionId !== sessionId.value,
    );
    fleetAgents.value = [...activeSessions, ...inactiveSessions.slice(0, 5)];
  } catch {
    fleetAgents.value = [];
  }
};
const handleSelectFleetSession = (targetSessionId: string) => {
  const agent = fleetAgents.value.find(
    (candidate) => candidate.sessionId === targetSessionId,
  );
  if (!agent) return;
  sessionId.value = targetSessionId;
  if (agent.role) {
    activeAgentRole.value = agent.role as AgentRole;
  }
  if (agent.tokenUsage) {
    sessionTokenUsage.value = agent.tokenUsage;
  }
  if (agent.cwd) {
    workspace.value = agent.cwd;
  }
  notify({
    type: "info",
    title: "Agent Room",
    message: `Đã chọn session: ${agent.provider ? agent.provider.toUpperCase() : "CAO"} (${targetSessionId.slice(0, 8)})`,
  });
};
const isMaximized = ref(false);
const minimize = () => window.desktopApi?.minimize?.();
const maximize = async () => {
  isMaximized.value = Boolean(await window.desktopApi?.toggleMaximize?.());
};
const appVersion = ref("Task Hub Desktop");
const running = computed(() => runStatus.value === "running");
const reconnectableCaoSession = computed(() => {
  const directories = new Set([workspace.value, worktree.value].filter(Boolean));
  return fleetAgents.value.find((candidate) =>
    candidate?.route === 'cao' &&
    directories.has(candidate.cwd) &&
    candidate.status !== 'running' &&
    candidate.caoSessionName,
  ) || null;
});
const reconnectCaoSession = async () => {
  const candidate = reconnectableCaoSession.value;
  if (!candidate?.sessionId) return;
  try {
    const saved = await window.desktopApi?.agent?.getSessionState?.(candidate.sessionId);
    const result = await window.desktopApi?.agent?.reconnectCaoSession?.(candidate.sessionId);
    if (!result) throw new Error('Desktop could not reconnect to the saved CAO session.');
    sessionId.value = result.sessionId;
    executionRoute.value = 'cao';
    runStatus.value = 'running';
    runExitCode.value = null;
    error.value = '';
    approvalRequest.value = null;
    if (saved?.output) output.value = saved.output;
    phase.value = 'CAO worker resumed';
    toolMessage.value = `Reconnected to ${result.workers?.length || 0} CAO worker(s); the existing Hub run is still active.`;
    await refreshFleet();
    notify({ type: 'success', title: 'CAO reconnected', message: 'Đã tiếp tục session hiện có, không tạo run Hub mới.' });
  } catch (e: any) {
    error.value = e?.message || 'Could not reconnect to the CAO session.';
    phase.value = 'CAO reconnect failed';
    notify({ type: 'warning', title: 'Không thể reconnect CAO', message: error.value });
  }
};
const hubUrl = computed(
  () => sync.credential.value?.taskHubUrl || "https://task-hub.macatung.dev",
);
const openHub = () =>
  window.desktopApi?.openExternal?.(`${hubUrl.value}/tasks`);
const close = () => window.desktopApi?.close?.();
const updateAutoSubmitHandoff = (enabled: boolean) => {
  autoSubmitHandoff.value = enabled;
  localStorage.setItem("task-hub-auto-submit-handoff", String(enabled));
  if (enabled)
    queueMicrotask(() => {
      void tryAutoSubmitHandoff();
    });
};
const updateAutoContinueEpic = (enabled: boolean) => {
  autoContinueEpic.value = enabled;
  localStorage.setItem("task-hub-auto-continue-epic", String(enabled));
};
const updateAutoReview = ({
  enabled,
  reviewer,
  maxIterations,
}: {
  enabled: boolean;
  reviewer: Provider;
  maxIterations: number;
}) => {
  autoReviewEnabled.value = enabled;
  reviewerProvider.value = reviewer;
  autoReviewMaxIterations.value = Math.min(
    5,
    Math.max(1, Number(maxIterations) || 3),
  );
  localStorage.setItem("task-hub-auto-review-enabled", String(enabled));
  localStorage.setItem("task-hub-reviewer-provider", reviewer);
  localStorage.setItem(
    "task-hub-auto-review-max-iterations",
    String(autoReviewMaxIterations.value),
  );
  if (!enabled && autoReviewStatus.value === "reviewing") {
    autoReviewStatus.value = "failed";
    autoReviewFeedback.value =
      "Automatic review was disabled; finish this run with human review.";
    phase.value = "Auto-review paused — human review required";
  }
};
const checkAppUpdate = async () => {
  updater.value = (await window.desktopApi?.updater?.check?.()) || {
    status: "error",
    message: "Desktop updater is unavailable.",
  };
};
const installAppUpdate = async () => {
  updater.value =
    (await window.desktopApi?.updater?.install?.()) || updater.value;
};
const isSandboxFailure = (value: string) =>
  /codex-windows-sandbox-setup|sandbox startup failure|workspace sandbox.*(?:fail|cannot|missing|error)|helper executable.*(?:fail|cannot|missing)|(?:sandbox|codex).*(?:access denied|could not start|failed to launch)/i.test(
    value,
  );
const isEnvironmentLaunchFailure = (value: string) =>
  /SPAWN_ERROR|Unable to launch|executable not found|ENOENT/i.test(value);
const isCaoRuntimeFailure = (value: string) =>
  /CAO (?:could not launch|daemon is not ready|session failed|runtime)|cao-server|HTTP\s*500|internal server error|operation not supported|fifo|TASK_HUB_RUN_BLOCKED: command not found/i.test(
    value,
  );
const runDiagnostics = async () => {
  if (provider.value !== "codex") return;
  diagnosticsLoading.value = true;
  try {
    diagnostics.value = await window.desktopApi.agent.codexDiagnostics();
  } catch (e: any) {
    diagnostics.value = {
      ok: false,
      summary: "Could not run Codex diagnostics.",
      details: [e?.message || "Unknown error."],
    };
  } finally {
    diagnosticsLoading.value = false;
  }
};
const requestHumanApproval = async (
  reason = error.value || "The local agent needs an approval to continue.",
) => {
  if (isCaoRuntimeFailure(reason)) {
    approvalRequest.value = null;
    phase.value = 'CAO runtime needs repair';
    error.value = reason;
    toolMessage.value = 'CAO could not create a worker. Restart the CAO runtime; a sandbox approval cannot fix this error.';
    return;
  }
  if (!pendingLaunch.value && selectedTask.value) {
    pendingLaunch.value = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: "task",
      policy: executionPolicy.value,
      intent: "task",
    };
  }
  await runDiagnostics();
  const sandboxBlocked = isSandboxFailure(
    `${reason}\n${diagnostics.value?.summary || ""}`,
  );
  const alreadyFullAccess = pendingLaunch.value?.policy === 'full_access';
  const diagnosticDetails = [...(diagnostics.value?.details || [])];
  if (alreadyFullAccess)
    diagnosticDetails.unshift(
      "This run already used full access. Approval can record a deliberate retry, but it cannot repair the missing Windows sandbox helper. Repair or restart Codex if the retry fails again.",
    );
  approvalRequest.value = {
    id: `approval-${Date.now()}`,
    reason,
    requestedAt: new Date().toLocaleString(),
    recommendedPolicy:
      sandboxBlocked || alreadyFullAccess ? "full_access" : "workspace_write",
    diagnosticSummary: alreadyFullAccess
      ? "Full-access run failed — human review required before retrying."
      : diagnostics.value?.summary || "Human review required before retrying.",
    diagnosticDetails,
  };
  phase.value = "Awaiting human approval";
};
const approveRetry = async (policy: 'workspace_write' | 'full_access') => {
  const request = approvalRequest.value;
  let pending = pendingLaunch.value;
  if (!pending && selectedTask.value) {
    pending = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: "task",
      policy: executionPolicy.value,
      intent: "task",
    };
    pendingLaunch.value = pending;
  }
  if (!request || !pending) return;
  const warning =
    policy === "full_access"
      ? "Approve one full-access retry? Codex will bypass its sandbox and native approval prompts. The worktree remains isolated, but this grants the agent broader access on this machine."
      : "Approve a workspace-write retry? Codex can edit only the isolated worktree and may request another escalation.";
  if (!window.confirm(warning)) return;
  executionPolicy.value = policy;
  approvalRequest.value = null;
  error.value = "";
  phase.value = `Human approved ${policy === "full_access" ? "full access" : "workspace-write"} retry`;
  output.value += `\n✓ Human approval recorded at ${new Date().toLocaleTimeString()}: ${policy}. Continuing the same run.\n`;
  try {
    if (runId.value)
      await updateRun("running", `Human approved retry with ${policy}.`);
    await startLocal(pending.prompt, pending.kind, policy, pending.intent, true);
  } catch (e: any) {
    error.value = e?.message || "Could not start approved retry.";
    void requestHumanApproval(error.value);
  }
};
const dismissApproval = () => {
  approvalRequest.value = null;
  phase.value = 'Approval declined — run remains stopped';
  output.value += "\nHuman approval declined. No retry was started.\n";
};
const approveSafetyAlert = (eventId?: string) => {
  if (activeSafetyAlert.value) {
    notify({
      type: "info",
      title: "Quy trình an toàn",
      message: `Đã phê duyệt: ${activeSafetyAlert.value.command || "Thao tác"}`,
    });
    activeSafetyAlert.value = null;
    if (phase.value === "waiting_input") {
      phase.value = "running";
      runStatus.value = "running";
    }
  }
};
const rejectSafetyAlert = (eventId?: string) => {
  if (activeSafetyAlert.value) {
    notify({
      type: "warning",
      title: "Quy trình an toàn",
      message: "Đã từ chối lệnh nguy hiểm. Dừng phiên chạy.",
    });
    activeSafetyAlert.value = null;
    cancel();
  }
};
const mcp = async (name: string, args: Record<string, unknown>) => {
  const cred = sync.credential.value;
  if (!cred) throw new Error("Connect Task Hub before starting an agent.");
  let rawArgs: Record<string, unknown> = {};
  try {
    rawArgs = JSON.parse(JSON.stringify(args));
  } catch {
    rawArgs = { ...args };
  }
  const response = await window.desktopApi.taskHub.mcpCall(
    cred.taskHubUrl,
    cred.token,
    String(cred.projectId),
    "tools/call",
    { name, arguments: rawArgs },
  );
  if (response?.error)
    throw new Error(response.error.message || "Task Hub request failed.");
  const text = response?.result?.content?.find(
    (item: any) => item.type === "text",
  )?.text;
  return text ? JSON.parse(text) : response?.result;
};
const syncCockpitAgent = async (
  status: "idle" | "working" | "waiting" | "blocked",
  summary: string,
) => {
  const projectId =
    selectedTask.value?.project_id || sync.credential.value?.projectId;
  if (!projectId || !sync.credential.value) return;
  const role =
    activeAgentRole.value === "reviewer" ? "Reviewer" : "Implementation";
  try {
    await mcp("agents_register", {
      project_id: Number(projectId),
      agent_key: cockpitAgentKey,
      name: `Desktop ${role}`,
      role,
      provider: provider.value,
      model: selectedModel.value,
      status,
    });
    await mcp("agents_report_status", {
      project_id: Number(projectId),
      agent_key: cockpitAgentKey,
      status,
      summary,
      run_id: runId.value || undefined,
    });
  } catch {
    // Cockpit telemetry must never prevent a local agent run.
  }
};
const refreshInbox = async () => {
  const projectId =
    selectedTask.value?.project_id || sync.credential.value?.projectId;
  if (!projectId || !sync.credential.value) {
    inboxMessages.value = [];
    return;
  }
  inboxLoading.value = true;
  try {
    const result: any = await mcp("agents_read_inbox", {
      project_id: Number(projectId),
      agent_key: cockpitAgentKey,
    });
    inboxMessages.value = result?.data || result || [];
  } catch {
    inboxMessages.value = [];
  } finally {
    inboxLoading.value = false;
  }
};
const acknowledgeInboxMessage = async (
  messageId: number,
  status: "accepted" | "declined" | "done",
) => {
  const projectId =
    selectedTask.value?.project_id || sync.credential.value?.projectId;
  if (!projectId) return;
  try {
    await mcp("agents_ack", {
      project_id: Number(projectId),
      agent_key: cockpitAgentKey,
      message_id: messageId,
      status,
    });
    await refreshInbox();
  } catch (e: any) {
    notify({
      type: "warning",
      title: "Inbox",
      message: e?.message || "Could not update agent message.",
    });
  }
};
const refresh = async () => {
  if (syncing.value) return;
  syncing.value = true;
  error.value = "";
  try {
    await Promise.race([
      (async () => {
        await sync.loadCredential();
        const [, backlogLoaded] = await Promise.all([
          sync.fetchProjects(),
          sync.fetchAgentTasks(),
        ]);
        lastSynced.value = new Date().toLocaleTimeString();
        if (!backlogLoaded) {
          error.value =
            sync.connectionError.value ||
            "Could not load the Task Hub backlog. Your cached queue may be stale.";
        } else {
          if (sync.agentTasks.value.length) {
            // Auto background prefetch context packs for active workspace tasks
            void contextPackCache.prefetchQueue(sync.agentTasks.value, mcp);
          }
          // Replay pending offline MCP operations (handoffs, evidence) in background
          if (mcpOutbox.pendingCount.value > 0) {
            void mcpOutbox.replay(mcp).then((res) => {
              if (res.processed > 0) {
                notify({
                  type: "success",
                  title: "Đồng bộ ngoại tuyến",
                  message: `Đã đồng bộ thành công ${res.processed} mục lên Task Hub!`,
                  durationMs: 4000,
                });
              }
            });
          }
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Đồng bộ quá thời gian (Timeout 8s). Sử dụng dữ liệu cache.",
              ),
            ),
          8000,
        ),
      ),
    ]);
  } catch (e: any) {
    error.value = e?.message || "Sync failed.";
  } finally {
    syncing.value = false;
  }
};
const reopenEpicAsTodo = async () => {
  const epic = selectedTask.value;
  if (!epic || epic.issue_type !== "epic" || epic.status !== "review") return;
  if (
    !window.confirm(
      `Move ${epic.issue_key || epic.title} back to To do? This keeps the handoff history and allows the Epic sequence to be started again.`,
    )
  )
    return;
  startOperation(
    "reopen-epic",
    "Đưa Epic về To do",
    "Đang cập nhật trạng thái trên Hub…",
  );
  try {
    const updated = await sync.updateTaskStatus(epic, 'todo');
    selectedTask.value = {
      ...epic,
      ...(updated || {}),
      status: "todo",
      completed_at: null,
    };
    epicSequence.value = null;
    runStatus.value = "idle";
    runIntent.value = "task";
    phase.value = "Ready";
    error.value = "";
    await sync.fetchAgentTasks();
    finishOperation(
      "reopen-epic",
      "success",
      "Đã đưa Epic về To do",
      "Bạn có thể chạy lại Epic sequence khi các task con sẵn sàng.",
    );
  } catch (e: any) {
    error.value = e?.message || "Không thể đưa Epic về To do.";
    finishOperation(
      "reopen-epic",
      "error",
      "Không thể cập nhật Epic",
      error.value,
    );
  }
};
const chooseWorkspace = async () => {
  notify({
    type: "info",
    title: "Chọn thư mục dự án",
    message: "Đang mở hộp thoại chọn thư mục làm việc…",
  });
  const next = await window.desktopApi?.agent?.pickWorkspace?.();
  if (next) {
    workspace.value = next;
    await window.desktopApi.agent.saveWorkspace(next);
    notify({
      type: "success",
      title: "Đã chọn thư mục dự án",
      message: `Thư mục: ${next}`,
    });
    if (sync.agentTasks.value.length) {
      void contextPackCache.prefetchQueue(sync.agentTasks.value, mcp);
    }
  }
};
const connect = async () => {
  startOperation(
    "pairing",
    "Kết nối Task Hub",
    "Đang tạo mã ghép nối và mở trình duyệt xác thực…",
  );
  const pairing = await window.desktopApi.taskHub.startPairing(
    hubUrl.value,
    selectedTask.value?.project_id || null,
  );
  await window.desktopApi.openExternal(pairing.approval_url);
  phase.value = "Waiting for Hub approval";
  const timer = window.setInterval(async () => {
    try {
      const status = await window.desktopApi.taskHub.pollPairing(
        hubUrl.value,
        pairing.pairing_id,
        pairing.device_secret,
      );
      if (status.status === "approved") {
        window.clearInterval(timer);
        await sync.setCredential({
          taskHubUrl: hubUrl.value,
          token: status.mcp_token,
          projectId: String(status.project_id),
          projectTitle: status.project_title,
          workspaceName: status.workspace_name,
        });
        phase.value = "Ready";
        finishOperation(
          "pairing",
          "success",
          "Kết nối thành công!",
          `Dự án: ${status.project_title || status.project_id}`,
        );
        await refresh();
      } else if (["denied", "expired", "rejected"].includes(status.status)) {
        window.clearInterval(timer);
        error.value = `Pairing ${status.status}.`;
        phase.value = "Ready";
        finishOperation(
          "pairing",
          "error",
          "Ghép nối thất bại",
          `Trạng thái: ${status.status}`,
        );
      }
    } catch (e: any) {
      window.clearInterval(timer);
      error.value = e.message;
      phase.value = "Ready";
      finishOperation("pairing", "error", "Lỗi kết nối", error.value);
    }
  }, 1800);
};
const prepareWorktree = async (suffix: string) => {
  if (!workspace.value) await chooseWorkspace();
  if (!workspace.value) throw new Error("Choose a local repository first.");
  notify({
    type: "loading",
    id: "prepare-worktree",
    title: "Chuẩn bị Git Worktree",
    message: "Tạo nhánh cô lập và kiểm tra môi trường…",
  });
  const preflight = await window.desktopApi.agent.preflight(
    provider.value,
    workspace.value,
  );
  if (!preflight?.ok) throw new Error("Local agent preflight failed.");
  const result = await window.desktopApi.agent.createWorktree(
    preflight.repository,
    suffix,
  );
  if (!result?.path) throw new Error("Worktree environment setup failed.");
  worktree.value = result.path;
  finishOperation(
    "prepare-worktree",
    "success",
    "Worktree sẵn sàng",
    `Nhánh: ${result.path.split(/[\\/]/).pop()}`,
  );
  return { preflight, result };
};
const startLocal = async (
  prompt: string,
  kind: "task" | "docs" = "task",
  policy: ExecutionPolicy = "workspace_write",
  intent: RunIntent = "task",
  preserveOutput = false,
  role: AgentRole = "implementation",
) => {
  const launchProvider = role === 'reviewer' ? reviewerProvider.value : provider.value;
  pendingLaunch.value = { prompt, kind, policy, intent };
  activeAgentRole.value = role;
  runIntent.value = intent;
  if (!preserveOutput) output.value = '';
  if (!preserveOutput) sessionTokenUsage.value = null;
  executionRoute.value = null;
  runOutputStart.value = output.value.length;
  if (role === "implementation")
    implementationOutputStart.value = runOutputStart.value;
  if (role === "reviewer") reviewOutputStart.value = runOutputStart.value;
  error.value = "";
  phase.value = "Running";
  runStatus.value = "running";
  lastAgentOutputAt.value = Date.now();
  contextHealth.value = "healthy";
  runExitCode.value = null;
  notify({
    type: "loading",
    id: "start-local",
    title: "Agent đang thực thi",
    message: `Chạy ${launchProvider.toUpperCase()} trong worktree cô lập…`,
    persistent: true,
  });
  try {
    let result: any = null;
    try {
      result = await window.desktopApi.agent.startInteractive(
        launchProvider,
        worktree.value,
        prompt,
        kind,
        selectedModel.value || undefined,
        policy,
      );
    } catch (firstErr) {
      // If previous session is tearing down or port is momentarily busy, wait 800ms and retry once
      await new Promise((r) => setTimeout(r, 800));
      result = await window.desktopApi.agent.startInteractive(
        launchProvider,
        worktree.value,
        prompt,
        kind,
        selectedModel.value || undefined,
        policy,
      );
    }
    sessionId.value = result.sessionId;
    executionRoute.value = result.route === 'cao' ? 'cao' : null;
    void refreshFleet();
    void syncCockpitAgent(
      "working",
      `${launchProvider} is running ${selectedTask.value?.issue_key || "a local task"}.`,
    );
    if (result.mode === "external")
      output.value +=
        "External agent session opened. Return here when the work is complete.\n";
  } catch (e) {
    runStatus.value = "failed";
    phase.value = "Run failed";
    finishOperation(
      "start-local",
      "error",
      "Không thể bắt đầu Agent",
      String(e),
    );
    throw e;
  }
};
const epicTaskIsReady = (task: TaskItem, sequence: EpicSequence) => {
  if (
    task.status === "done" ||
    sequence.completedIds.includes(task.id) ||
    (sequence.skippedIds || []).includes(task.id)
  )
    return false;
  return !(task.dependencies || []).some((dependency) => {
    const dependencyId = dependency.depends_on_task_id;
    return (
      !sequence.completedIds.includes(dependencyId) &&
      dependency.depends_on?.status !== "done"
    );
  });
};
const nextEpicTask = (sequence: EpicSequence) =>
  sequence.tasks.find((task) => epicTaskIsReady(task, sequence)) || null;
const stopEpicSequence = (message = "Epic sequence stopped.") => {
  epicApprovalToken += 1;
  epicSequence.value = null;
  if (message) toolMessage.value = message;
};
const retryEpicChildTask = async (customPrompt?: string) => {
  const sequence = epicSequence.value;
  if (sequence) {
    sequence.finalizing = false;
    sequence.waitingForApproval = false;
  }
  runStatus.value = "idle";
  error.value = "";
  phase.value = `Retrying ${selectedTask.value?.issue_key || 'task'} in Epic sequence`;
  notify({
    type: "info",
    title: "Thử lại task",
    message: `Đang khởi chạy lại ${selectedTask.value?.issue_key || 'task'} giữ nguyên worktree.`,
  });
  await launch();
};
const skipEpicChildTask = async () => {
  const sequence = epicSequence.value;
  if (!sequence || !selectedTask.value) {
    if (selectedTask.value) {
      notify({
        type: "warning",
        title: "Bỏ qua task",
        message: `Đã bỏ qua ${selectedTask.value.issue_key || selectedTask.value.title}.`,
      });
    }
    return;
  }
  const currentChildId = selectedTask.value.id;
  sequence.skippedIds = [...new Set([...(sequence.skippedIds || []), currentChildId])];
  sequence.finalizing = false;
  sequence.waitingForApproval = false;
  runStatus.value = "idle";
  error.value = "";
  notify({
    type: "warning",
    title: "Bỏ qua task",
    message: `Đã bỏ qua ${selectedTask.value.issue_key || selectedTask.value.title}. Đang tìm task độc lập tiếp theo trong Epic.`,
  });
  const next = nextEpicTask(sequence);
  if (!next) {
    phase.value = "Epic sequence stopped — no unblocked tasks";
    toolMessage.value = "Không còn task độc lập nào sẵn sàng để chạy tiếp sau khi bỏ qua task này.";
    return;
  }
  sequence.activeChildId = next.id;
  selectedTask.value = next;
  handoffReviewUrl.value = "";
  output.value = "";
  phase.value = `Starting ${next.issue_key || `#${next.id}`} in Epic sequence (${sequence.completedIds.length + 1}/${sequence.tasks.length})`;
  await launch();
};
const skipReviewAndContinueEpic = async () => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  error.value = "";
  sequence.finalizing = false;
  sequence.waitingForApproval = false;
  phase.value = "Epic sequence resuming";
  toolMessage.value = "Skipping review and advancing to next Epic task.";
  const payload = autoHandoffPayload();
  if (payload) {
    await recordEpicChildResult(payload, {
      status: "approved",
      feedback: "User chose to skip review and continue Epic sequence.",
    });
    notify({
      type: "success",
      title: "Tiếp tục Epic",
      message: "Đã bỏ qua review và tiếp tục task kế tiếp trong Epic.",
      durationMs: 3500,
    });
  } else if (sequence.activeChildId) {
    await advanceEpicSequence(sequence.activeChildId, "handoff");
  }
};
const advanceEpicSequence = async (
  childId: number,
  gate: "handoff" | "approval",
) => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  if (sequence.finalizing) return;
  const transitionToken = ++sequence.transitionToken;
  sequence.completedIds = [...new Set([...sequence.completedIds, childId])];
  sequence.waitingForApproval = false;
  const next = nextEpicTask(sequence);
  if (epicSequence.value !== sequence || sequence.transitionToken !== transitionToken)
    return;
  if (!next) {
    const unfinished = sequence.tasks.filter(
      (task) =>
        !sequence.completedIds.includes(task.id) && task.status !== "done",
    );
    if (unfinished.length) {
      await failEpicSequence(
        `No dependency-ready task remains. Review: ${unfinished.map((task) => task.issue_key || `#${task.id}`).join(", ")}.`,
      );
      return;
    }
    phase.value = "Epic sequence complete";
    toolMessage.value = `All ${sequence.tasks.length} tasks have run. Preparing one final Epic handoff for Hub review.`;
    selectedTask.value = sequence.epic;
    sequence.finalizing = true;
    sequence.waitingForApproval = true;
    runStatus.value = "completed";
    runIntent.value = "epic";
    await finalizeEpicHandoff(sequence);
    return;
  }
  sequence.activeChildId = next.id;
  selectedTask.value = next;
  handoffReviewUrl.value = "";
  output.value = "";
  runStatus.value = "idle";
  phase.value = `Starting ${next.issue_key || `#${next.id}`} in Epic sequence (${sequence.completedIds.length + 1}/${sequence.tasks.length})`;
  await launch();
};
const waitForEpicApproval = async (childId: number) => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  const token = ++epicApprovalToken;
  sequence.waitingForApproval = true;
  phase.value = "Waiting for Hub approval";
  toolMessage.value = `Waiting for Hub approval for ${selectedTask.value?.issue_key || `#${childId}`} before continuing the Epic.`;
  for (
    let attempt = 0;
    attempt < 720 && epicSequence.value && token === epicApprovalToken;
    attempt += 1
  ) {
    await new Promise((resolve) => window.setTimeout(resolve, 2500));
    if (!epicSequence.value || token !== epicApprovalToken) return;
    const synced = await sync.fetchAgentTasks();
    if (!synced) continue;
    const current = sync.agentTasks.value.find((task) => task.id === childId);
    // Approved/done tasks disappear from the runnable queue, so the original
    // snapshot plus the completed id is the source of truth for the sequence.
    if (current?.status !== "done" && current) continue;
    await advanceEpicSequence(childId, "approval");
    return;
  }
};
const launchEpic = async () => {
  const epic = selectedTask.value;
  if (!epic || epic.issue_type !== "epic") return;
  const tasks = sync.agentTasks.value
    .filter(task => task.epic_id === epic.id && task.issue_type !== 'epic')
    .sort((a, b) => a.id - b.id);
  if (!tasks.length) {
    error.value = "This Epic has no runnable child tasks yet.";
    phase.value = "Epic has no child tasks";
    return;
  }
  const sequence: EpicSequence = {
    epic,
    tasks,
    completedIds: tasks
      .filter((task) => task.status === "done")
      .map((task) => task.id),
    activeChildId: null,
    waitingForApproval: false,
    autoContinue: autoContinueEpic.value,
    parentRunId: null,
    childRunIds: [],
    childResults: [],
  transitionToken: ++epicApprovalToken,
    processingChildId: null,
    finalizing: false,
    worktreePath: null,
  };
  const first = nextEpicTask(sequence);
  if (!first) {
    error.value = "No dependency-ready child task is available for this Epic.";
    phase.value = "Epic is blocked by dependencies";
    return;
  }
  epicSequence.value = sequence;
  selectedTask.value = first;
  sequence.activeChildId = first.id;
  phase.value = `Starting ${first.issue_key || `#${first.id}`} in Epic sequence (1/${tasks.length})`;
  await launch();
};
const ensureEpicParentRun = async (repository: string, context: any) => {
  const sequence = epicSequence.value;
  if (!sequence) return null;
  if (sequence.parentRunId) return sequence.parentRunId;
  let parentRunId: number | null = null;
  try {
    const started = await mcp("start_agent_run", {
      task_id: sequence.epic.id,
      provider: provider.value,
      agent_session_id: `${provider.value}-epic-${Date.now()}`,
      repository,
      branch: worktree.value,
      run_type: "epic",
      context: {
        ...(context || {}),
        epic_id: sequence.epic.id,
        epic_issue_key: sequence.epic.issue_key,
        child_task_ids: sequence.tasks.map((task) => task.id),
      },
      metadata: {
        epic_sequence: {
          local_cao: true,
          epic_id: sequence.epic.id,
          child_task_ids: sequence.tasks.map((task) => task.id),
          child_run_ids: [],
          children: [],
        },
      },
      instruction: {
        role: "epic_orchestrator",
        execution_policy: executionPolicy.value,
        approval_mode: "final_epic_review",
      },
    });
    parentRunId = Number(started?.data?.id || started?.id || 0) || null;
  } catch {
    parentRunId = Date.now();
  }
  if (!parentRunId) parentRunId = Date.now();
  sequence.parentRunId = parentRunId;
  void updateRunFor(
    parentRunId,
    "running",
    `CAO Epic sequence started for ${sequence.epic.issue_key || sequence.epic.title}.`,
    {
      epic_sequence: {
        local_cao: true,
        epic_id: sequence.epic.id,
        child_task_ids: sequence.tasks.map((task) => task.id),
        child_run_ids: [],
        children: [],
      },
    },
  ).catch(() => {});
  return parentRunId;
};
const launch = async () => {
  try {
    error.value = "";
    handoffReviewUrl.value = "";
    approvalRequest.value = null;
    if (!selectedTask.value) throw new Error("Select a task first.");
    if (selectedTask.value.issue_type === "epic") {
      await launchEpic();
      return;
    }
    const launchIntent: RunIntent = epicSequence.value ? "epic" : "task";
    pendingLaunch.value = {
      prompt: `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.`,
      kind: "task",
      policy: executionPolicy.value,
      intent: launchIntent,
    };
    startOperation(
      "agent-run",
      "Đã ghi nhận lệnh chạy",
      `Khởi chạy ${selectedTask.value.issue_key || `#${selectedTask.value.id}`} với ${provider.value.toUpperCase()}…`,
    );
    let preflight: any;
    if (epicSequence.value?.worktreePath) {
      preflight = await window.desktopApi.agent.preflight(
        provider.value,
        epicSequence.value.worktreePath,
      );
      if (!preflight?.ok) throw new Error("Epic worktree preflight failed.");
      worktree.value = epicSequence.value.worktreePath;
    } else {
      const prepared = await prepareWorktree(
        selectedTask.value.issue_key || `task-${selectedTask.value.id}`,
      );
      preflight = prepared.preflight;
      if (epicSequence.value) {
        epicSequence.value.worktreePath = prepared.result.path;
      }
    }

    const taskUpdatedAt = (selectedTask.value as any).updated_at;
    let context = contextPackCache.get(selectedTask.value.id)?.data;
    if (
      context &&
      contextPackCache.isFresh(selectedTask.value.id, taskUpdatedAt)
    ) {
      updateOperation("agent-run", "Nạp Context Pack cục bộ đã đồng bộ sẵn…");
      // Fire background silent revalidation for next execution
      void contextPackCache
        .prefetch(selectedTask.value.id, mcp, taskUpdatedAt, true)
        .catch(() => {});
    } else {
      updateOperation("agent-run", "Tải context pack từ Task Hub…");
      try {
        const res = await mcp("get_context_pack", {
          task_id: selectedTask.value.id,
        });
        context = res?.data || res;
        if (context)
          contextPackCache.set(selectedTask.value.id, context, taskUpdatedAt);
      } catch {
        // Fallback for offline mode: construct context from local selected task
        context = {
          task: selectedTask.value,
          title: selectedTask.value.title,
          issue_key: selectedTask.value.issue_key,
          description: selectedTask.value.description,
        };
      }
    }

    let plainContext: any = {};
    try {
      plainContext = JSON.parse(JSON.stringify(context?.data || context || {}));
    } catch {
      plainContext = context || {};
    }

    const epicParentRunId = epicSequence.value
      ? await ensureEpicParentRun(preflight.repository, plainContext)
      : null;

    let started: any = null;
    try {
      started = await mcp("start_agent_run", {
        task_id: selectedTask.value.id,
        provider: provider.value,
        agent_session_id: `${provider.value}-${Date.now()}`,
        repository: preflight.repository,
        branch: worktree.value,
        context: plainContext,
        instruction: {
          execution_policy: executionPolicy.value,
          approval_mode:
            executionPolicy.value === "full_access"
              ? "bypass"
              : "request_human_approval",
        },
        metadata: epicParentRunId
          ? {
              epic_sequence: {
                local_cao: true,
                epic_id: epicSequence.value?.epic.id,
                parent_run_id: epicParentRunId,
              },
            }
          : undefined,
      });
    } catch {
      started = { id: Date.now() };
    }
    runId.value = Number(started?.data?.id || started?.id || 0) || Date.now();
    implementationRunId.value = runId.value;
    if (epicSequence.value && runId.value) {
      epicSequence.value.childRunIds = [
        ...new Set([...epicSequence.value.childRunIds, Number(runId.value)]),
      ];
      void updateEpicParentRun(
        epicSequence.value,
        "running",
        `CAO child ${selectedTask.value.issue_key || selectedTask.value.title} started.`,
      ).catch(() => {});
    }
    reviewerRunId.value = null;
    autoReviewIteration.value = 0;
    taskReviewMaxIterations.value = selectedTask.value
      ? Number(
          localStorage.getItem(
            `task-hub-auto-review-limit-${selectedTask.value.id}`,
          ),
        ) || null
      : null;
    autoReviewStatus.value = "idle";
    autoReviewFeedback.value = "";
    autoReviewSummary.value = "";
    if (sync.credential.value?.token) {
      await window.desktopApi.agent
        .configureMcp({
          cwd: worktree.value,
          provider: provider.value,
          taskHubUrl: hubUrl.value,
          projectId: String(
            selectedTask.value.project_id || sync.credential.value?.projectId,
          ),
          token: sync.credential.value!.token,
        })
        .catch(() => {});
    }
    if (runId.value) {
      interactiveReporter.start(runId.value);
      void updateRun("running").catch(() => {});
    }
    finishOperation(
      "agent-run",
      "success",
      "Khởi chạy thành công",
      "Agent đang streaming mã nguồn và log.",
    );
    await startLocal(
      `Execute only ${selectedTask.value.issue_key || selectedTask.value.title}. Use the supplied Task Hub context, work in this isolated worktree, run relevant tests, and finish with a concise handoff.${epicSequence.value ? ` This task is one step in Epic ${epicSequence.value.epic.issue_key || epicSequence.value.epic.title}; do not work on sibling tasks.` : ""}\n\n${JSON.stringify(plainContext, null, 2)}`,
      "task",
      executionPolicy.value,
      launchIntent,
    );
  } catch (e: any) {
    interactiveReporter.finish("failed", { error: e?.message || String(e) });
    if (runId.value)
      void updateRun("failed", e?.message || "Could not launch local agent.");
    runStatus.value = "failed";
    const launchError = e?.message || "Could not launch agent.";
    phase.value = isCaoRuntimeFailure(launchError) ? 'CAO runtime needs repair' : "Run failed";
    error.value = launchError;
    finishOperation("agent-run", "error", "Lỗi khởi chạy", error.value);
    if (epicSequence.value) {
      await failEpicSequence(error.value);
    } else if (!isCaoRuntimeFailure(error.value)) {
      void requestHumanApproval(error.value);
    }
  }
};
const updateRunFor = async (
  targetRunId: number | null,
  status: string,
  summary?: string,
  metadata?: Record<string, unknown>,
) => {
  if (!targetRunId) return;
  try {
    await mcp("update_agent_run", {
      run_id: targetRunId,
      status,
      summary,
      ...(metadata ? { metadata } : {}),
    });
  } catch {
    mcpOutbox.enqueue(
      "update_agent_run",
      {
        run_id: targetRunId,
        status,
        summary,
        ...(metadata ? { metadata } : {}),
      },
      {
        runId: targetRunId,
        description: `Update run #${targetRunId} status to ${status}`,
      },
    );
  }
};
const updateRun = async (status: string, summary?: string) =>
  updateRunFor(runId.value, status, summary);
const autoReviewCanRun = computed(() =>
  Boolean(
    autoReviewEnabled.value &&
    selectedTask.value &&
    ["task", "epic"].includes(runIntent.value),
  ),
);
const reviewerLabel = (value: Provider) =>
  value === "claude_code"
    ? "Claude Code"
    : value === "antigravity"
      ? "Antigravity"
      : "Codex";
const reviewPayloadFromOutput = (text: string) => {
  let body = "";
  const marker = text.match(/<TASK_HUB_REVIEW>([\s\S]*?)<\/TASK_HUB_REVIEW>/i);
  if (marker?.[1]) {
    body = marker[1].trim();
  } else {
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?"verdict"[\s\S]*?)\s*```/i);
    if (codeBlock?.[1]) {
      body = codeBlock[1].trim();
    } else {
      const rawMatch = text.match(/(\{[\s\S]*?"verdict"\s*:\s*"(?:approved|changes_requested)"[\s\S]*?\})/i);
      if (rawMatch?.[1]) {
        body = rawMatch[1].trim();
      }
    }
  }

  let parsed: any = null;
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      try {
        const cleaned = body.replace(/,\s*([\]}])/g, '$1');
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = null;
      }
    }
  }
  const verdictText = String(parsed?.verdict || "").toLowerCase();
  const approved = Boolean(parsed && verdictText === "approved");
  const feedback = String(
    parsed?.feedback || parsed?.summary || body || text.slice(-8000),
  ).trim();
  return {
    approved,
    feedback: feedback || "Reviewer did not provide a structured explanation.",
    summary: String(parsed?.summary || feedback).trim(),
    tests: Array.isArray(parsed?.tests) ? parsed.tests : [],
  };
};
const readWorktreeDiff = async () => {
  try {
    const diff = await window.desktopApi?.agent?.getGitDiff?.(worktree.value);
    if (!diff)
      return "No diff metadata was available; inspect the worktree directly.";
    const serialized = typeof diff === "string" ? diff : JSON.stringify(diff);
    return serialized.slice(-30000);
  } catch (e: any) {
    return `Diff inspection was unavailable: ${e?.message || "unknown error"}`;
  }
};
const startAutoReview = async (
  implementationOutput: string,
  implementationIntent: RunIntent = runIntent.value,
) => {
  if (!selectedTask.value || !worktree.value)
    return false;
  if (!implementationRunId.value) {
    implementationRunId.value = runId.value || Date.now();
  }
  if (!autoReviewCanRun.value) return false;
  if (autoReviewIteration.value >= activeReviewMaxIterations.value) return false;
  autoReviewIteration.value += 1;
  autoReviewStatus.value = "reviewing";
  autoReviewFeedback.value = "";
  autoReviewSummary.value = "";
  error.value = "";
  phase.value = `Independent review ${autoReviewIteration.value}/${activeReviewMaxIterations.value}`;
  toolMessage.value = `${reviewerLabel(reviewerProvider.value)} is reviewing the implementation in read-only mode…`;
  const reviewerPreflight = await window.desktopApi.agent.preflight(
    reviewerProvider.value,
    worktree.value,
  );
  let activePreflight = reviewerPreflight;
  if (!activePreflight?.ok && provider.value) {
    const fallbackPreflight = await window.desktopApi.agent.preflight(
      provider.value,
      worktree.value,
    );
    if (fallbackPreflight?.ok) {
      reviewerProvider.value = provider.value;
      activePreflight = fallbackPreflight;
    }
  }
  if (!activePreflight?.ok) {
    autoReviewStatus.value = "failed";
    const detail =
      activePreflight?.details?.find((line: string) =>
        /\b(error|enoent|invalid|not found|failed)\b/i.test(line),
      ) ||
      activePreflight?.summary ||
      "preflight verification failed.";
    autoReviewFeedback.value = `Independent reviewer cannot start: ${detail}`;
    toolMessage.value = `Independent reviewer cannot start: ${detail}`;
    phase.value = "Independent review failed";
    return false;
  }
  const diff = await readWorktreeDiff();
  const reviewerPrompt = `You are a separate independent reviewer session for Task Hub task ${selectedTask.value.issue_key || selectedTask.value.title}. Review the implementation currently present in this isolated worktree. Do not edit files, commit, push, deploy, or create Hub records. Inspect the task brief, acceptance criteria, tests, and git diff. Run safe read-only verification when useful.

Implementation agent output:
${implementationOutput.slice(-12000)}

Git diff snapshot:
${diff}

Return exactly one machine-readable block and a concise explanation:
<TASK_HUB_REVIEW>{"verdict":"approved" or "changes_requested","summary":"...","feedback":"...","tests":[{"command":"...","status":"passed|failed|skipped","summary":"..."}]}</TASK_HUB_REVIEW>
Use changes_requested for any correctness, scope, security, test, or acceptance-criteria gap. Be specific enough for another agent to fix every issue.`;
  try {
    const started = await mcp("start_agent_run", {
      task_id: selectedTask.value.id,
      provider: reviewerProvider.value,
      agent_session_id: `${reviewerProvider.value}-review-${Date.now()}`,
      repository: worktree.value,
      branch: worktree.value,
      run_type: 'review',
      context: {
        task_id: selectedTask.value.id,
        implementation_run_id: implementationRunId.value,
        auto_review_iteration: autoReviewIteration.value,
      },
      instruction: {
        role: "independent_reviewer",
        execution_policy: "restricted",
        review_of_run_id: implementationRunId.value,
      },
    }).catch(() => null);
    reviewerRunId.value = Number(started?.data?.id || started?.id || 0) || Date.now();
    runId.value = reviewerRunId.value;
    activeAgentRole.value = "reviewer";
    runStatus.value = "running";
    runExitCode.value = null;
    if (reviewerRunId.value) interactiveReporter.start(reviewerRunId.value);
    await window.desktopApi.agent.configureMcp({
      cwd: worktree.value,
      provider: reviewerProvider.value,
      taskHubUrl: hubUrl.value,
      projectId: String(
        selectedTask.value.project_id || sync.credential.value?.projectId,
      ),
      token: sync.credential.value!.token,
    }).catch(() => {});
    await updateRunFor(
      reviewerRunId.value,
      "running",
      `Independent review ${autoReviewIteration.value}/${activeReviewMaxIterations.value} started.`,
      {
        auto_review: {
          iteration: autoReviewIteration.value,
          implementation_run_id: implementationRunId.value,
          reviewer_provider: reviewerProvider.value,
        },
      },
    );
    // Keep the original task/epic intent while the reviewer session is active;
    // the handoff and Epic scheduler still need to know which implementation
    // run produced this review.
    await startLocal(
      reviewerPrompt,
      "task",
      "restricted",
      implementationIntent,
      true,
      "reviewer",
    );
    return true;
  } catch (e: any) {
    autoReviewStatus.value = "failed";
    autoReviewFeedback.value =
      e?.message || "Could not start the independent reviewer.";
    phase.value = "Auto-review failed — human review required";
    toolMessage.value = autoReviewFeedback.value;
    if (reviewerRunId.value)
      void updateRunFor(
        reviewerRunId.value,
        "failed",
        autoReviewFeedback.value,
      );
    return false;
  }
};
const continueAfterReview = async (review: {
  approved: boolean;
  feedback: string;
  summary: string;
  tests: any[];
}) => {
  const currentReviewerRunId = reviewerRunId.value;
  if (currentReviewerRunId) {
    await updateRunFor(
      currentReviewerRunId,
      review.approved ? "verified" : "waiting_input",
      review.summary,
      {
        auto_review: {
          verdict: review.approved ? "approved" : "changes_requested",
          feedback: review.feedback,
          iteration: autoReviewIteration.value,
          implementation_run_id: implementationRunId.value,
        },
      },
    );
    const evidenceArgs = {
      run_id: currentReviewerRunId,
      evidence_type: "independent_review",
      status: review.approved ? "passed" : "failed",
      command: "Task Hub independent reviewer",
      summary: review.feedback,
    };
    try {
      await mcp("attach_verification_evidence", evidenceArgs);
    } catch {
      mcpOutbox.enqueue("attach_verification_evidence", evidenceArgs, {
        runId: currentReviewerRunId,
        description: `Independent review evidence for run #${currentReviewerRunId}`,
      });
    }
  }
  if (review.approved) {
    autoReviewStatus.value = "approved";
    autoReviewFeedback.value = review.feedback;
    autoReviewSummary.value = review.summary;
    phase.value = "Auto-review approved — preparing Hub handoff";
    toolMessage.value = `${reviewerLabel(reviewerProvider.value)} approved the implementation. Human Hub approval is still required.`;
    runId.value = implementationRunId.value;
    activeAgentRole.value = "implementation";
    runOutputStart.value = implementationOutputStart.value;
    runStatus.value = "completed";
    if (epicSequence.value && runIntent.value === 'epic') {
      const payload = autoHandoffPayload();
      if (!payload) {
        await failEpicSequence(
          `${selectedTask.value?.issue_key || 'Epic child'} completed without a safe handoff payload.`,
        );
        return;
      }
      await recordEpicChildResult(payload, {
        status: 'approved',
        reviewerProvider: reviewerProvider.value,
        reviewerRunId: currentReviewerRunId,
        iterations: autoReviewIteration.value,
        feedback: review.feedback,
      });
      return;
    }
    await updateRunFor(
      implementationRunId.value,
      "waiting_input",
      "Implementation approved by independent reviewer; automatically completing handoff.",
      {
        auto_review: {
          status: "approved",
          reviewer_run_id: currentReviewerRunId,
          reviewer_provider: reviewerProvider.value,
          iterations: autoReviewIteration.value,
          feedback: review.feedback,
        },
      },
    );
    const payload = autoHandoffPayload();
    if (payload) {
      // Keep the approval note informational. The handoff path treats any
      // non-empty `blockers` value as a failed verification for Epic
      // auto-continuation, so putting a successful review note there would
      // incorrectly pause an otherwise verified handoff.
      payload.summary = [
        payload.summary,
        `Independent review approved by ${reviewerLabel(reviewerProvider.value)} after ${autoReviewIteration.value} iteration(s).`,
      ]
        .filter(Boolean)
        .join("\n");
      await handoff(payload, true);
    }
    return;
  }
  autoReviewStatus.value = "changes_requested";
  autoReviewFeedback.value = review.feedback;
  autoReviewSummary.value = review.summary;
  if (autoReviewIteration.value >= activeReviewMaxIterations.value) {
    autoReviewStatus.value = "max_iterations";
    phase.value = "Auto-review reached its limit — human decision required";
    toolMessage.value = `${reviewerLabel(reviewerProvider.value)} requested changes after ${autoReviewIteration.value} iteration(s). Choose a manual review or increase this task's limit.`;
    runId.value = implementationRunId.value;
    activeAgentRole.value = "implementation";
    runOutputStart.value = implementationOutputStart.value;
    runStatus.value = "completed";
    await updateRunFor(
      implementationRunId.value,
      "waiting_input",
      `Auto-review reached the ${activeReviewMaxIterations.value}-iteration limit. Human decision required.`,
      {
        auto_review: {
          status: "max_iterations",
          reviewer_run_id: currentReviewerRunId,
          feedback: review.feedback,
          iterations: autoReviewIteration.value,
        },
      },
    );
    return;
  }
  if (!selectedTask.value || !implementationRunId.value) return;
  runId.value = implementationRunId.value;
  activeAgentRole.value = "implementation";
  runOutputStart.value = implementationOutputStart.value;
  phase.value = `Implementation agent applying review changes (${autoReviewIteration.value + 1}/${activeReviewMaxIterations.value})`;
  toolMessage.value = `Sending ${reviewerLabel(reviewerProvider.value)}'s feedback to the implementation agent…`;
  output.value += `\n\n--- Independent review ${autoReviewIteration.value}: changes requested ---\n${review.feedback}\n`;
  await updateRunFor(
    implementationRunId.value,
    "running",
    `Applying independent review feedback from iteration ${autoReviewIteration.value}.`,
  );
  await startLocal(
    `Continue the implementation for ${selectedTask.value.issue_key || selectedTask.value.title}. A separate reviewer requested the changes below. Apply every item in the isolated worktree, run the relevant tests, and finish with a concise handoff summary. Do not work on sibling tasks.

Reviewer feedback:
${review.feedback}

This is review iteration ${autoReviewIteration.value + 1} of ${activeReviewMaxIterations.value}.`,
    "task",
    executionPolicy.value,
    runIntent.value,
    true,
    "implementation",
  );
};
const approveAfterManualReview = async () => {
  const task = selectedTask.value;
  const payload = autoHandoffPayload();
  if (!task || !payload) return;
  await handoff(payload);
  const result = await mcp('request_human_approval', { task_id: task.id });
  if (result?.success === false) throw new Error(result.message || 'Could not complete manual review.');
  phase.value = 'Completed after manual review';
  autoReviewStatus.value = 'idle';
  await refresh();
};
const continueAfterHumanReview = async (feedback: string) => {
  if (!selectedTask.value || !implementationRunId.value) return;
  const nextLimit = Math.min(10, Math.max(activeReviewMaxIterations.value + 1, autoReviewIteration.value + 1));
  taskReviewMaxIterations.value = nextLimit;
  localStorage.setItem(`task-hub-auto-review-limit-${selectedTask.value.id}`, String(nextLimit));
  autoReviewStatus.value = 'changes_requested';
  autoReviewFeedback.value = feedback.trim() || autoReviewFeedback.value;
  await updateRunFor(implementationRunId.value, 'running', 'Human requested additional changes after the auto-review limit.', {
    auto_review: { status: 'changes_requested', max_iterations: nextLimit, feedback: autoReviewFeedback.value },
  });
  phase.value = `Implementation agent applying human review changes (${autoReviewIteration.value + 1}/${nextLimit})`;
  await startLocal(
    `Continue the implementation for ${selectedTask.value.issue_key || selectedTask.value.title}. A human reviewer requested the changes below after the automatic review limit was reached. Apply every item, run relevant tests, and finish with a concise handoff summary.\n\nHuman feedback:\n${autoReviewFeedback.value}`,
    'task', executionPolicy.value, runIntent.value, true, 'implementation',
  );
};
const increaseTaskReviewLimit = async (limit: number) => {
  const nextLimit = Math.min(10, Math.max(activeReviewMaxIterations.value + 1, Number(limit) || 0));
  taskReviewMaxIterations.value = nextLimit;
  if (selectedTask.value)
    localStorage.setItem(`task-hub-auto-review-limit-${selectedTask.value.id}`, String(nextLimit));
  autoReviewStatus.value = 'changes_requested';
  if (implementationRunId.value) {
    await updateRunFor(implementationRunId.value, 'waiting_input', `Review limit raised to ${nextLimit} for this task.`, {
      auto_review: { status: 'changes_requested', max_iterations: nextLimit, feedback: autoReviewFeedback.value },
    });
  }
  await continueAfterHumanReview('');
};
const cancel = async () => {
  notify({
    type: "warning",
    title: "Đang hủy phiên chạy",
    message: "Gửi tín hiệu dừng agent…",
  });
  runStatus.value = "cancelled";
  phase.value = "Run cancelled";
  if (sessionId.value) await window.desktopApi.agent.stop(sessionId.value);
  interactiveReporter.finish("cancelled", { reason: "stopped_by_user" });
  await updateRun('cancelled', 'Stopped by user.');
  if (reviewerRunId.value && reviewerRunId.value !== runId.value)
    await updateRunFor(
      reviewerRunId.value,
      "cancelled",
      "Automatic review cancelled by user.",
    );
  if (implementationRunId.value && implementationRunId.value !== runId.value)
    await updateRunFor(
      implementationRunId.value,
      "cancelled",
      "Automatic review loop cancelled by user.",
    );
  if (epicSequence.value?.parentRunId)
    await updateRunFor(
      epicSequence.value.parentRunId,
      "cancelled",
      "CAO Epic sequence cancelled by user.",
    );
  autoReviewStatus.value = "failed";
  autoReviewFeedback.value = "Automatic review loop cancelled by user.";
  sessionId.value = null;
  void refreshFleet();
  void syncCockpitAgent("idle", "Local run was cancelled by the user.");
  if (epicSequence.value)
    stopEpicSequence("Epic sequence cancelled by the user.");
  notify({
    type: "info",
    title: "Đã hủy phiên chạy",
    message: "Tiến trình Agent đã dừng an toàn.",
  });
};
const send = (message: string) => {
  if (sessionId.value && message.trim()) {
    window.desktopApi.agent.send(sessionId.value, message.trim());
    notify({ type: 'info', title: 'Đã gửi tin nhắn đến Agent', message: message.trim() });
  }
};
const handoff = async (payload: any, autoApprove = false) => {
  try {
    if (!selectedTask.value) return;
    const handoffTaskId = selectedTask.value.id;
    const isEpicChild = Boolean(
      epicSequence.value &&
        runIntent.value === "epic" &&
        selectedTask.value.id !== epicSequence.value.epic.id,
    );
    const isEpicAggregate = Boolean(
      epicSequence.value && selectedTask.value.id === epicSequence.value.epic.id,
    );
    startOperation(
      "handoff",
      "Đang gửi bàn giao",
      "Đồng bộ kết quả kiểm thử và PR lên Task Hub…",
    );
    const handoffRunId = implementationRunId.value || runId.value;
    let result: any = null;
    const handoffTool = autoApprove ? 'complete_auto_approved_handoff' : 'complete_agent_handoff';
    const handoffArgs = {
      run_id: handoffRunId || undefined,
      task_id: handoffTaskId,
      summary: payload.summary || "Local agent completed work.",
      changed_files: String(payload.changedFiles || "")
        .split("\n")
        .map((x: string) => x.trim())
        .filter(Boolean),
      tests: [
        {
          command: payload.tests || "Verification",
          status: payload.testStatus,
          summary: payload.testSummary || "Completed",
        },
      ],
      commit_sha: payload.commitSha || undefined,
      pull_request_url: payload.pullRequestUrl || undefined,
      blockers: payload.blockers || undefined,
      review:
        autoReviewStatus.value !== "idle"
          ? {
              status: autoReviewStatus.value,
              reviewer_provider: reviewerProvider.value,
              reviewer_run_id: reviewerRunId.value,
              iterations: autoReviewIteration.value,
              feedback: autoReviewFeedback.value,
            }
          : undefined,
    };
    try {
      result = await mcp(handoffTool, handoffArgs);
      if (result?.success === false)
        throw new Error(result.message || "Task Hub rejected the handoff.");
    } catch {
      // Offline fallback: save to local outbox so workflow proceeds uninterrupted
      mcpOutbox.enqueue(handoffTool, handoffArgs, {
        taskId: handoffTaskId,
        runId: handoffRunId || undefined,
        description: `Handoff for ${selectedTask.value?.issue_key || `#${handoffTaskId}`}`,
      });
      result = { success: true, data: { id: handoffRunId } };
    }
    const confirmedRunId = Number(result?.data?.id || runId.value || 0);
    handoffReviewUrl.value = `${hubUrl.value.replace(/\/$/, "")}/tasks?task_id=${encodeURIComponent(String(handoffTaskId))}${confirmedRunId ? `&run_id=${confirmedRunId}` : ""}`;
    if (autoApprove) {
      phase.value = isEpicAggregate ? 'Epic completed automatically' : 'Completed after automatic review';
    } else if (isEpicAggregate) {
      phase.value = 'Epic handoff ready for final Hub review';
    } else {
      phase.value = 'Submitted for Hub review';
    }
    finishOperation(
      "handoff",
      "success",
      autoApprove ? "Auto-review đã hoàn tất" : (isEpicAggregate ? "Epic handoff đã sẵn sàng!" : "Bàn giao thành công!"),
      autoApprove
        ? "Evidence đã được lưu và task đã tự chuyển sang Done."
        : (isEpicAggregate ? "Toàn bộ task con đã chạy qua CAO. Chỉ cần duyệt một lần trên Hub." : "Task đã chuyển sang chế độ chờ duyệt trên Hub. Mở link để review và approve/reject."),
      autoApprove ? undefined : handoffReviewUrl.value,
    );
    if (isEpicAggregate && selectedTask.value) {
      selectedTask.value = { ...selectedTask.value, status: autoApprove ? 'done' : 'review' };
    }
    await refresh();
    if (isEpicChild && epicSequence.value) {
      const failedVerification =
        payload.testStatus === "failed" ||
        Boolean(String(payload.blockers || "").trim());
      if (autoApprove && epicSequence.value.autoContinue && !failedVerification) {
        void advanceEpicSequence(handoffTaskId, 'handoff');
      } else if (failedVerification) {
        phase.value = "Epic paused — review failed handoff";
        toolMessage.value =
          "The Epic stopped because this child handoff contains failed verification or blockers. Review it on Hub before continuing.";
      } else {
        void waitForEpicApproval(handoffTaskId);
      }
    }
  } catch (e: any) {
    error.value = e.message || "Handoff submission failed.";
    phase.value = "Handoff submission failed — review and retry";
    toolMessage.value = error.value;
    finishOperation("handoff", "error", "Lỗi gửi bàn giao", error.value);
  } finally {
    autoHandoffSubmitting.value = false;
  }
};
const autoHandoffPayload = () =>
  selectedTask.value
    ? buildAutoHandoffPayload({
        output: output.value.slice(runOutputStart.value),
        taskTitle: selectedTask.value.title,
        exitCode: runExitCode.value,
      })
    : null;
const epicChildResultFor = (task: TaskItem, payload: any, review?: EpicChildResult['review']): EpicChildResult => ({
  taskId: task.id,
  runId: implementationRunId.value || runId.value,
  issueKey: task.issue_key || `#${task.id}`,
  title: task.title,
  summary: String(payload.summary || `Completed ${task.issue_key || task.title}.`),
  changedFiles: String(payload.changedFiles || '')
    .split(/\r?\n/)
    .map((item: string) => item.trim())
    .filter(Boolean),
  tests: String(payload.tests || 'Agent process exited with code 0'),
  testStatus: String(payload.testStatus || 'skipped'),
  testSummary: String(payload.testSummary || 'Completed.'),
  commitSha: String(payload.commitSha || ''),
  pullRequestUrl: String(payload.pullRequestUrl || ''),
  blockers: String(payload.blockers || ''),
  review,
});
const updateEpicParentRun = async (sequence: EpicSequence, status = 'running', summary?: string) => {
  if (!sequence.parentRunId) return;
  await updateRunFor(
    sequence.parentRunId,
    status,
    summary,
    {
      epic_sequence: {
        local_cao: true,
        epic_id: sequence.epic.id,
        child_task_ids: sequence.tasks.map((task) => task.id),
        child_run_ids: sequence.childRunIds,
        children: sequence.childResults,
      },
    },
  ).catch(() => {});
};
const recordEpicChildResult = async (
  payload: any,
  review?: EpicChildResult['review'],
) => {
  const sequence = epicSequence.value;
  const task = selectedTask.value;
  if (!sequence || !task || task.id === sequence.epic.id) return false;
  if (sequence.finalizing || sequence.completedIds.includes(task.id)) return false;
  if (sequence.processingChildId !== null && sequence.processingChildId !== task.id)
    return false;
  sequence.processingChildId = task.id;
  const childRunId = implementationRunId.value || runId.value;
  const result = epicChildResultFor(task, payload, review);
  const failedVerification = result.testStatus === 'failed' || Boolean(result.blockers.trim());
  try {
    sequence.childResults = [
      ...sequence.childResults.filter((item) => item.taskId !== task.id),
      result,
    ];
    if (childRunId) {
      await updateRunFor(
        childRunId,
        failedVerification ? 'failed' : 'verified',
        result.summary,
        {
          epic_sequence: {
            local_cao: true,
            epic_id: sequence.epic.id,
            parent_run_id: sequence.parentRunId,
            child_task_id: task.id,
            child_result: result,
          },
        },
      ).catch(() => {});
      const evidenceStatus = ['passed', 'failed', 'skipped', 'pending'].includes(result.testStatus)
        ? result.testStatus
        : 'skipped';
      const evidenceArgs = {
        run_id: childRunId,
        task_id: task.id,
        evidence_type: 'epic_child_verification',
        status: evidenceStatus,
        command: result.tests,
        summary: result.testSummary,
      };
      try {
        await mcp('attach_verification_evidence', evidenceArgs);
      } catch {
        mcpOutbox.enqueue('attach_verification_evidence', evidenceArgs, {
          taskId: task.id,
          runId: childRunId,
          description: `Evidence for ${task.issue_key || task.title}`,
        });
      }

      if (!failedVerification && review?.status === 'approved') {
        const handoffArgs = {
          run_id: childRunId,
          summary: result.summary,
          changed_files: result.changedFiles,
          tests: [{ command: result.tests || 'Verification', status: result.testStatus, summary: result.testSummary }],
          commit_sha: result.commitSha || undefined,
          pull_request_url: result.pullRequestUrl || undefined,
          review: {
            status: 'approved', reviewer_provider: review.reviewerProvider,
            reviewer_run_id: review.reviewerRunId, iterations: review.iterations,
            feedback: review.feedback,
          },
        };
        try {
          const completion = await mcp('complete_auto_approved_handoff', handoffArgs);
          if (completion?.success === false) throw new Error(completion.message || 'Could not automatically complete Epic child.');
        } catch {
          // Store in persistent local outbox to sync later; do NOT block the Epic sequence!
          mcpOutbox.enqueue('complete_auto_approved_handoff', handoffArgs, {
            taskId: task.id,
            runId: childRunId,
            description: `Auto-approved handoff for ${task.issue_key || task.title}`,
          });
        }
      }
    }
    await updateEpicParentRun(
      sequence,
      failedVerification ? 'failed' : 'running',
      failedVerification
        ? `${result.issueKey} failed verification; Epic sequence stopped.`
        : `Verified ${result.issueKey}; ${sequence.childResults.length}/${sequence.tasks.length} Epic tasks complete.`,
    );
    if (failedVerification) {
      await failEpicSequence(
        `${result.issueKey} contains failed verification or blockers; the Epic sequence was stopped safely.`,
      );
      return false;
    }
    await advanceEpicSequence(task.id, 'handoff');
    return true;
  } finally {
    if (sequence.processingChildId === task.id) sequence.processingChildId = null;
  }
};
const failEpicSequence = async (reason: string) => {
  const sequence = epicSequence.value;
  if (!sequence) return;
  sequence.finalizing = true;
  sequence.waitingForApproval = false;
  phase.value = 'Epic sequence blocked';
  error.value = reason;
  toolMessage.value = reason;
  runStatus.value = 'failed';
  await updateEpicParentRun(sequence, 'failed', reason);
};
const finalizeEpicHandoff = async (sequence: EpicSequence) => {
  if (!sequence.parentRunId || !sequence.childResults.length) {
    await failEpicSequence('Epic has no verified child results to hand off.');
    return false;
  }
  const failedChild = sequence.childResults.find(
    (child) => child.testStatus === 'failed' || child.blockers,
  );
  if (failedChild) {
    await failEpicSequence(
      `${failedChild.issueKey} contains failed verification or blockers; Epic handoff was not submitted.`,
    );
    return false;
  }
  const changedFiles = [...new Set(sequence.childResults.flatMap((child) => child.changedFiles))];
  const tests = sequence.childResults
    .map((child) => `${child.issueKey}: ${child.tests} — ${child.testSummary}`)
    .join('\n');
  const summary = sequence.childResults
    .map((child) => `${child.issueKey}: ${child.summary}`)
    .join('\n');
  const lastCommit = [...sequence.childResults].reverse().find((child) => child.commitSha)?.commitSha || '';
  const lastPullRequest = [...sequence.childResults].reverse().find((child) => child.pullRequestUrl)?.pullRequestUrl || '';
  runId.value = sequence.parentRunId;
  implementationRunId.value = sequence.parentRunId;
  activeAgentRole.value = 'implementation';
  runOutputStart.value = 0;
  try {
    autoReviewStatus.value = 'approved';
    await handoff({
      summary: `Epic ${sequence.epic.issue_key || sequence.epic.title} completed through CAO.\n${summary}`,
      changedFiles: changedFiles.join('\n'),
      tests,
      testStatus: 'passed',
      testSummary: `Verified ${sequence.childResults.length} child task(s) through the CAO Epic sequence.`,
      commitSha: lastCommit,
      pullRequestUrl: lastPullRequest,
      blockers: '',
    }, true);
    sequence.waitingForApproval = false;
    phase.value = 'Epic completed automatically';
    toolMessage.value = 'All Epic tasks passed automatic review and are Done.';
    return true;
  } catch (e: any) {
    await failEpicSequence(e?.message || 'Epic handoff submission failed.');
    return false;
  }
};
const tryAutoSubmitHandoff = () => {
  if (epicSequence.value && runIntent.value === 'epic') return false;
  const epicAutoSubmit = runIntent.value === 'epic' && epicSequence.value?.autoContinue === true;
  if (
    autoReviewStatus.value !== "idle" ||
    !(autoSubmitHandoff.value || epicAutoSubmit) ||
    !["task", "epic"].includes(runIntent.value) ||
    runStatus.value !== "completed" ||
    autoHandoffSubmitting.value ||
    phase.value === "Submitted for Hub review"
  )
    return false;
  const payload = autoHandoffPayload();
  if (!payload) return false;
  autoHandoffSubmitting.value = true;
  phase.value = "Auto-submitting handoff";
  void handoff(payload);
  return true;
};
const openTool = (mode: Exclude<ToolMode, null>) => {
  toolMode.value = mode;
  toolMessage.value = "";
  output.value = "";
  docsReady.value = false;
  if (!toolProjectId.value && sync.projects.value[0])
    toolProjectId.value = sync.projects.value[0].id;
  notify({
    type: "info",
    title: mode === "requirement" ? "AI Requirement Discovery" : "Docs Scanner",
    message:
      mode === "requirement"
        ? "Nhập yêu cầu để AI phân tích và lập kế hoạch Backlog."
        : "Quét mã nguồn để sinh bộ tài liệu chuẩn docs/.",
  });
};
const runRequirement = async ({
  projectId,
  requirement: text,
}: {
  projectId: number;
  requirement: string;
}) => {
  try {
    toolBusy.value = true;
    toolProjectId.value = projectId;
    requirement.value = text;
    requirementPlan.value = "";
    docsReady.value = false;
    startOperation(
      "req-run",
      "Đang phân tích yêu cầu",
      "Tạo Git worktree và nạp ngữ cảnh dự án…",
    );
    await prepareWorktree("requirement-discovery");
    toolMessage.value = "Preparing repository context…";
    updateOperation("req-run", "Agent đang khám phá mã nguồn và tài liệu…");
    await startLocal(
      `You are Task Hub's Requirement Discovery agent. Analyze this requirement: ${text}\n\nInspect the repository and its docs. Do not create work items. Return a concise Vietnamese plan with one Epic, Stories and implementation Tasks, acceptance criteria, Fibonacci story points and explicit task dependencies.${serializeDiscoveryPlanContract()}`,
      "task",
      executionPolicy.value,
      'requirement');
  } catch (e: any) {
    error.value = e.message || "Requirement analysis failed.";
    toolMessage.value = error.value;
    finishOperation("req-run", "error", "Lỗi phân tích yêu cầu", error.value);
  } finally {
    toolBusy.value = false;
  }
};
const reviseRequirement = async ({
  projectId,
  requirement: text,
  feedback,
}: {
  projectId: number;
  requirement: string;
  feedback: string;
}) => {
  try {
    if (!feedback.trim())
      throw new Error(
        "Describe the changes you want before requesting a revision.",
      );
    toolBusy.value = true;
    toolProjectId.value = projectId;
    requirement.value = text;
    const previousProposal =
      requirementPlan.value || conciseAgentReply(output.value);
    requirementPlan.value = "";
    startOperation(
      "req-revise",
      "Đang yêu cầu sửa đổi",
      "Gửi ghi chú phản hồi đến AI Agent…",
    );
    toolMessage.value = "Sending your review notes to the local agent…";
    if (!worktree.value) await prepareWorktree("requirement-revision");
    await startLocal(
      `You are revising a Task Hub backlog proposal. Do not create or sync any work items.\n\nOriginal requirement:\n${text}\n\nCurrent proposal:\n${previousProposal}\n\nReviewer feedback — apply every requested change:\n${feedback}\n\nReturn the complete replacement proposal in Vietnamese: one Epic, Stories and implementation Tasks, acceptance criteria, Fibonacci story points and explicit task dependencies.${serializeDiscoveryPlanContract()}`,
      "task",
      executionPolicy.value,
      'requirement');
  } catch (e: any) {
    error.value = e.message || "Could not request proposal changes.";
    toolMessage.value = error.value;
    finishOperation("req-revise", "error", "Lỗi yêu cầu sửa đổi", error.value);
  } finally {
    toolBusy.value = false;
  }
};
const conciseAgentReply = (value: string) => {
  const replies = [...value.matchAll(/💬\s*([\s\S]*?)(?=\n(?:⚡|✓|💬)|$)/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return replies.at(-1) || value.slice(-12000);
};
const createBacklog = async () => {
  try {
    if (!toolProjectId.value || !requirement.value) return;
    const parsed = parseDiscoveryPlan(requirementPlan.value || output.value);
    if (!parsed.plan || parsed.errors.length)
      throw new Error(parsed.errors.join(" "));
    const totalTasks = parsed.plan.stories.reduce(
      (count, story) => count + story.tasks.length,
      0,
    );
    if (!window.confirm(`Approve and sync this proposal to Hub? This will create 1 Epic and ${totalTasks} task(s) in the selected project.`)) return;
    toolBusy.value = true;
    startOperation(
      "create-backlog",
      "Đang tạo Backlog trên Hub",
      `Khởi tạo 1 Epic và ${totalTasks} task(s)…`,
    );
    toolMessage.value = "Creating linked Epic and backlog on Hub…";
    const tasks = parsed.plan.stories.flatMap((story) =>
      story.tasks.map((task) => ({
        ref: task.ref,
        title: task.title,
        issue_type: "task",
        description: `Story: ${story.title}\n\n${task.acceptance_criteria.join("\n")}`,
        acceptance_criteria: task.acceptance_criteria.join("\n"),
        story_points: task.story_points,
        priority: "medium",
        depends_on: task.depends_on,
      })),
    );
    const result = await mcp('create_requirement_backlog', {
      project_id: toolProjectId.value,
      epic: parsed.plan.epic,
      tasks,
    });
    toolMessage.value =
      result?.message || `Created 1 Epic and ${totalTasks} task(s) on Hub.`;
    phase.value = "Backlog created and synced";
    finishOperation(
      "create-backlog",
      "success",
      "Đã tạo Backlog thành công!",
      toolMessage.value,
    );
    await refresh();
  } catch (e: any) {
    error.value = e.message || "Backlog creation failed.";
    toolMessage.value = error.value;
    finishOperation("create-backlog", "error", "Lỗi tạo Backlog", error.value);
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
    const { result } = await prepareWorktree("docs-from-repo");
    toolMessage.value = "Scanning repository in an isolated worktree…";
    updateOperation(
      "docs-scan",
      "Agent đang phân tích mã nguồn và soạn thảo docs/…",
    );
    await startLocal(
      "Scan this repository and generate/update only docs/PROJECT_DOCUMENTS.md, docs/PROJECT_BRIEF.md, docs/PRD.md, docs/FUNCTIONAL_SPECIFICATION.md (structured with explicit Functional vs Non-Functional requirements, per-function specifications, and embedded Mermaid diagrams), docs/ARCHITECTURE.md, docs/QA_PLAN.md and docs/RELEASE_RUNBOOK.md. Base every statement on inspected code. Do not edit application code, commit, push, deploy or create Task Hub records. Finish with a concise summary.",
      "docs",
    );
    worktree.value = result.path;
  } catch (e: any) {
    error.value = e.message || "Documentation scan failed.";
    toolMessage.value = error.value;
    finishOperation("docs-scan", "error", "Lỗi quét tài liệu", error.value);
  } finally {
    toolBusy.value = false;
  }
};
const saveDocs = async () => {
  try {
    toolBusy.value = true;
    toolMessage.value = "Saving documentation to the repository…";
    startOperation(
      "save-docs",
      "Đang lưu tài liệu",
      "Ghi các file tài liệu vào thư mục docs/…",
    );
    await window.desktopApi.agent.applyDocsToWorkspace(
      worktree.value,
      workspace.value,
    );
    contextPackCache.invalidate();
    toolMessage.value = "Documentation saved to the repository.";
    finishOperation(
      "save-docs",
      "success",
      "Đã lưu tài liệu vào repository!",
      "Các file docs/ đã được cập nhật.",
    );
  } catch (e: any) {
    toolMessage.value = e.message || "Could not save documentation.";
    finishOperation(
      "save-docs",
      "error",
      "Lỗi lưu tài liệu",
      toolMessage.value,
    );
  } finally {
    toolBusy.value = false;
  }
};
const syncDocs = async () => {
  try {
    toolBusy.value = true;
    if (!toolProjectId.value) throw new Error("Select a Hub project first.");
    toolMessage.value = "Syncing documentation to Task Hub…";
    startOperation(
      "sync-docs",
      "Đang đồng bộ tài liệu lên Hub",
      "Đăng ký tài liệu với Task Hub API…",
    );
    const payload = await window.desktopApi.agent.readGeneratedDocuments(
      worktree.value,
    );
    await window.desktopApi.taskHub.importGeneratedDocuments(
      hubUrl.value,
      sync.credential.value!.token,
      toolProjectId.value,
      payload,
    );
    contextPackCache.invalidate();
    toolMessage.value = "Documentation synced to Task Hub.";
    finishOperation('sync-docs', 'success', 'Đã đồng bộ tài liệu thành công!', 'Tài liệu đã xuất hiện trên Task Hub.');
  } catch (e: any) {
    toolMessage.value = e.message || "Could not sync documentation.";
    finishOperation(
      "sync-docs",
      "error",
      "Lỗi đồng bộ tài liệu",
      toolMessage.value,
    );
  } finally {
    toolBusy.value = false;
  }
};
const selectTask = (task: TaskItem) => {
  if (
    epicSequence.value &&
    task.id !== epicSequence.value.epic.id &&
    task.id !== epicSequence.value.activeChildId
  )
    stopEpicSequence("Epic sequence paused because another task was selected.");
  selectedTask.value = task;
  executionRoute.value = null;
  handoffReviewUrl.value = "";
  implementationRunId.value = null;
  reviewerRunId.value = null;
  activeAgentRole.value = "implementation";
  autoReviewIteration.value = 0;
  autoReviewStatus.value = "idle";
  autoReviewFeedback.value = "";
  autoReviewSummary.value = "";
  void contextPackCache.prefetch(task.id, mcp, (task as any).updated_at);
  notify({
    type: "info",
    title: "Đã chọn nhiệm vụ",
    message: `${task.issue_key || `#${task.id}`} — ${task.title}`,
    durationMs: 2500,
  });
};
let unsubOutput: (() => void) | undefined;
let unsubExit: (() => void) | undefined;
let unsubUpdater: (() => void) | undefined;
let contextCanaryTimer: ReturnType<typeof setInterval> | undefined;
const handleAgentExit = async (event: any) => {
  if (event.sessionId !== sessionId.value) return;
  const exitCode = typeof event.code === "number" ? event.code : null;
  const role = activeAgentRole.value;
  const trackedRunId = runId.value;
  const agentOutput = output.value.slice(
    role === "reviewer" ? reviewOutputStart.value : runOutputStart.value,
  );
  output.value += `\nProcess exited (${exitCode ?? "unknown"}).`;
  sessionId.value = null;
  runExitCode.value = exitCode;
  void syncCockpitAgent(
    exitCode === 0 ? "waiting" : "blocked",
    exitCode === 0
      ? "Local run finished and is awaiting review or handoff."
      : "Local run failed; review the execution details.",
  );
  if (runStatus.value !== "cancelled")
    runStatus.value = exitCode === 0 ? "completed" : "failed";
  interactiveReporter.finish(
    runStatus.value === "completed"
      ? "completed"
      : runStatus.value === "cancelled"
        ? "cancelled"
        : "failed",
    { exit_code: exitCode },
  );

  if (role === "reviewer") {
    if (runStatus.value === "cancelled") {
      autoReviewStatus.value = "failed";
      autoReviewFeedback.value = "Automatic review loop cancelled by user.";
      phase.value = "Auto-review cancelled — human review required";
      toolMessage.value =
        "The reviewer was stopped before it could finish. Review and submit the implementation handoff manually.";
      if (epicSequence.value && runIntent.value === 'epic') {
        await failEpicSequence(
          "Automatic review was cancelled for an Epic child; the sequence was stopped safely.",
        );
      }
      if (trackedRunId)
        void updateRunFor(trackedRunId, "cancelled", autoReviewFeedback.value);
      finishOperation(
        "auto-review",
        "warning",
        "Independent review cancelled",
        autoReviewFeedback.value,
      );
      return;
    }
    if (runStatus.value === "failed") {
      autoReviewStatus.value = "failed";
      autoReviewFeedback.value = `Reviewer process ended with exit code ${exitCode ?? "unknown"}.`;
      phase.value = "Auto-review failed — human review required";
      toolMessage.value = `${reviewerLabel(reviewerProvider.value)} could not complete its review. You can review the diff and submit a human handoff.`;
      if (epicSequence.value && runIntent.value === 'epic') {
        await failEpicSequence(
          "Automatic review failed for an Epic child; the sequence was stopped safely.",
        );
      }
      if (trackedRunId)
        void updateRunFor(trackedRunId, "failed", autoReviewFeedback.value);
      finishOperation(
        "auto-review",
        "error",
        "Independent review failed",
        autoReviewFeedback.value,
      );
      return;
    }
    const review = reviewPayloadFromOutput(agentOutput);
    try {
      await continueAfterReview(review);
      finishOperation(
        "auto-review",
        review.approved ? "success" : "warning",
        review.approved
          ? "Independent review approved"
          : "Changes requested by independent reviewer",
        review.feedback,
      );
    } catch (e: any) {
      autoReviewStatus.value = "failed";
      autoReviewFeedback.value =
        e?.message || "The review loop could not persist its result.";
      phase.value = "Auto-review failed — human review required";
      toolMessage.value =
        "The reviewer finished, but Task Hub could not save the review evidence. Review and submit the handoff manually.";
      if (epicSequence.value && runIntent.value === 'epic')
        await failEpicSequence(autoReviewFeedback.value);
      if (trackedRunId)
        void updateRunFor(trackedRunId, "failed", autoReviewFeedback.value);
      finishOperation(
        "auto-review",
        "error",
        "Could not save independent review",
        autoReviewFeedback.value,
      );
    }
    return;
  }

  // Codex can explain that the Windows sandbox helper failed and still end the
  // turn successfully. Treat that response as a blocked run, not a completed
  // task, so the human approval flow is surfaced instead of being hidden under
  // a misleading green "Completed" status.
  if (runStatus.value === 'completed' && isSandboxFailure(output.value.slice(runOutputStart.value))) {
    runStatus.value = "failed";
    phase.value = 'Sandbox blocked — approval required';
    error.value =
      "Codex could not start its workspace sandbox. This task has not run; review diagnostics and approve a retry.";
    toolMessage.value =
      "The local sandbox blocked this run before work could begin.";
    finishOperation(
      "start-local",
      "warning",
      "Sandbox bị chặn",
      "Cần cấp quyền để thử lại.",
    );
    if (epicSequence.value && runIntent.value === 'epic')
      await failEpicSequence(error.value);
    else if (pendingLaunch.value)
      void requestHumanApproval(agentOutput.slice(-8000));
    if (trackedRunId) void updateRunFor(trackedRunId, "failed", error.value);
    return;
  }

  // Providers such as Antigravity may return exit code 0 after explaining
  // that they could not read the staged task file. That is not a completed
  // task and must never become an automatic handoff.
  if (runStatus.value === "completed" && hasAgentReportedFailure(agentOutput)) {
    runStatus.value = "failed";
    phase.value = "Agent blocked — task not completed";
    error.value =
      "The agent reported that it could not complete the task. Review its response and retry only after resolving the reported access or prompt issue.";
    toolMessage.value =
      "No handoff was created because the agent reported a blocking error.";
    finishOperation("start-local", "error", "Agent báo lỗi chặn", error.value);
    if (epicSequence.value && runIntent.value === 'epic')
      await failEpicSequence(error.value);
    if (trackedRunId) void updateRunFor(trackedRunId, "failed", error.value);
    return;
  }

  if (runStatus.value === "failed") {
    if (executionRoute.value === 'cao' && event.signal === 'CAO_STATUS') {
      phase.value = 'CAO session failed';
      error.value = 'CAO reported that the supervisor and all workers stopped. Check the CAO session details or reconnect a still-live session; sandbox approval cannot repair this failure.';
      toolMessage.value = 'CAO session ended before implementation/review could finish.';
      finishOperation('start-local', 'error', 'CAO session failed', error.value);
      if (epicSequence.value && runIntent.value === 'epic')
        await failEpicSequence(error.value);
      if (trackedRunId) void updateRunFor(trackedRunId, 'failed', error.value);
      return;
    }
    if (isEnvironmentLaunchFailure(output.value.slice(runOutputStart.value))) {
      phase.value = 'Environment needs repair';
      error.value =
        "Agent executable could not start. This is not a sandbox approval issue. Repair environment in settings.";
      toolMessage.value = "The agent runtime environment requires repair.";
      finishOperation(
        "start-local",
        "error",
        "Môi trường cần sửa chữa",
        error.value,
      );
      if (epicSequence.value && runIntent.value === 'epic')
        await failEpicSequence(error.value);
      if (trackedRunId) void updateRunFor(trackedRunId, "failed", error.value);
      return;
    }
    phase.value = "Run failed";
    error.value = `Agent process ended with exit code ${exitCode ?? "unknown"}. Review the execution details below.`;
    toolMessage.value = "The agent did not complete successfully.";
    finishOperation("start-local", "error", "Agent dừng thực thi", error.value);
    if (epicSequence.value && runIntent.value === 'epic')
      await failEpicSequence(error.value);
    else if (pendingLaunch.value)
      void requestHumanApproval(`${error.value}\n${output.value.slice(-8000)}`);
    if (trackedRunId) void updateRunFor(trackedRunId, "failed", error.value);
    return;
  }

  if (runStatus.value === "cancelled") {
    phase.value = "Run cancelled";
    toolMessage.value = "The agent was stopped by the user.";
    finishOperation(
      "start-local",
      "warning",
      "Đã hủy phiên chạy",
      "Tiến trình agent đã dừng.",
    );
    if (epicSequence.value && runIntent.value === 'epic')
      await failEpicSequence("Epic sequence was cancelled by the user.");
    if (trackedRunId)
      void updateRunFor(trackedRunId, "cancelled", "Stopped by user.");
    return;
  }

  if (runIntent.value === 'requirement' && requirement.value) {
    requirementPlan.value = conciseAgentReply(output.value);
    toolMessage.value = 'Review the backlog proposal before creating tasks.';
    phase.value = "Backlog proposal ready";
    toolMode.value = 'requirement';
    finishOperation(
      "req-run",
      "success",
      "Bản thảo Backlog sẵn sàng!",
      "Vui lòng kiểm tra và phê duyệt.",
    );
  } else if (toolMode.value === "docs") {
    docsReady.value = true;
    toolMessage.value = "Review the generated docs, then save or sync them.";
    phase.value = "Documentation ready";
    finishOperation(
      "docs-scan",
      "success",
      "Tài liệu sẵn sàng!",
      "Vui lòng kiểm tra và lưu hoặc đồng bộ.",
    );
  } else if (autoReviewCanRun.value) {
    // Reserve the review slot before awaiting the lifecycle update. Vue's
    // auto-handoff watcher can otherwise observe `completed + idle` during the
    // network round-trip and submit the handoff before the reviewer starts.
    autoReviewStatus.value = "reviewing";
    if (trackedRunId)
      void updateRunFor(
        trackedRunId,
        "waiting_input",
        `Implementation complete; starting independent review with ${reviewerLabel(reviewerProvider.value)}.`,
      );
    let started = false;
    try {
      started = await startAutoReview(agentOutput);
    } catch {
      started = false;
    }
    if (!started) {
      if (epicSequence.value && runIntent.value === 'epic') {
        const payload = autoHandoffPayload();
        if (payload && (exitCode === 0 || exitCode === null)) {
          await recordEpicChildResult(payload, {
            status: 'approved',
            feedback: 'Independent reviewer was unavailable; child task verified through clean implementation exit.',
          });
          finishOperation(
            "start-local",
            "success",
            "Agent hoàn tất thực thi",
            "Đã tự động xác minh và chuyển sang task kế tiếp trong Epic.",
          );
          return;
        }
        await failEpicSequence(
          "Automatic review could not start for this Epic child; the sequence was stopped safely.",
        );
      } else {
        phase.value = "Run completed — human review required";
        toolMessage.value =
          "Automatic review could not start. Review and submit the handoff manually.";
      }
    }
    finishOperation(
      "start-local",
      "success",
      "Agent hoàn tất thực thi",
      started
        ? "Đang chạy independent review trước khi gửi Hub."
        : "Sẵn sàng cho human review.",
    );
  } else if (epicSequence.value && runIntent.value === 'epic') {
    const payload = autoHandoffPayload();
    if (!payload) {
      await failEpicSequence(
        `${selectedTask.value?.issue_key || 'Epic child'} completed without a safe handoff payload.`,
      );
      finishOperation(
        "start-local",
        "error",
        "Epic child verification failed",
        error.value,
      );
    } else {
      await recordEpicChildResult(payload);
      finishOperation(
        "start-local",
        "success",
        "Epic child verified",
        "Đang tự động chuyển sang task kế tiếp trong Epic.",
      );
    }
  } else if (
    ["task", "epic"].includes(runIntent.value) &&
    (autoSubmitHandoff.value ||
      (runIntent.value === 'epic' && epicSequence.value?.autoContinue))
  ) {
    if (!tryAutoSubmitHandoff()) {
      phase.value = "Run completed — handoff needs review";
      toolMessage.value =
        "Auto-submit is enabled, but this run was blocked or has no selected task. Review and submit the handoff manually.";
    }
    finishOperation(
      "start-local",
      "success",
      "Agent hoàn tất thực thi",
      "Đang xử lý kiểm thử & bàn giao.",
    );
  } else {
    phase.value = "Run completed — ready for handoff";
    finishOperation(
      "start-local",
      "success",
      "Agent hoàn tất thực thi",
      "Sẵn sàng gửi báo cáo bàn giao.",
    );
  }
  if (
    trackedRunId &&
    !(epicSequence.value && runIntent.value === 'epic') &&
    !autoHandoffSubmitting.value &&
    autoReviewStatus.value === "idle"
  )
    await updateRunFor(
      trackedRunId,
      "waiting_input",
      "Agent process completed; awaiting handoff.",
    );
};
watch([autoSubmitHandoff, runStatus], () => {
  void tryAutoSubmitHandoff();
});
watch(provider, (next) => {
  selectedModel.value = (DEFAULT_PROVIDER_MODELS as Record<string, string>)[next] || "default";
});
const refreshAgentRuntimes = async () => {
  try {
    const statuses = await window.desktopApi?.agent?.runtimeStatus?.();
    if (statuses && Array.isArray(statuses)) {
      agentRuntimes.value = statuses;
    }
  } catch {
    // ignore
  }
};
const consecutiveCaoFailures = ref(0);
const refreshCaoStatus = async () => {
  try {
    const current = (await window.desktopApi?.cao?.getStatus?.()) || null;
    if (current?.available) {
      consecutiveCaoFailures.value = 0;
    } else {
      consecutiveCaoFailures.value += 1;
    }

    if (
      previousCaoAvailable.value === true &&
      current?.available === false &&
      consecutiveCaoFailures.value >= 2 &&
      runStatus.value === "running"
    ) {
      notify({
        type: "error",
        title: "Mất kết nối CAO",
        message:
          "CAO Daemon bị ngắt kết nối trong khi agent đang chạy. Phiên làm việc có thể bị gián đoạn.",
      });
      void restartCao();
    }
    previousCaoAvailable.value = current?.available ?? null;
    caoStatus.value = current;
  } catch {
    consecutiveCaoFailures.value += 1;
    if (
      previousCaoAvailable.value === true &&
      consecutiveCaoFailures.value >= 2 &&
      runStatus.value === "running"
    ) {
      notify({
        type: "error",
        title: "Mất kết nối CAO",
        message:
          "CAO Daemon bị ngắt kết nối trong khi agent đang chạy. Phiên làm việc có thể bị gián đoạn.",
      });
      void restartCao();
    }
    previousCaoAvailable.value = false;
    caoStatus.value = null;
  }
};
const restartCao = async () => {
  caoReconnecting.value = true;
  try {
    const res = await window.desktopApi?.cao?.restartDaemon?.();
    await Promise.all([refreshCaoStatus(), refreshAgentRuntimes()]);
    if (res?.ok === false) {
      notify({
        type: "warning",
        title: "CAO daemon chưa sẵn sàng",
        message: res.error || "Không thể khởi động lại CAO daemon.",
      });
    } else {
      notify({
        type: "info",
        title: "CAO daemon",
        message: "Đã khởi động lại và kiểm tra CAO runtime.",
      });
    }
  } catch (e: any) {
    notify({
      type: "warning",
      title: "CAO daemon chưa sẵn sàng",
      message: e?.message || "Không thể khởi động lại CAO daemon.",
    });
  } finally {
    caoReconnecting.value = false;
  }
};
const repairAgentRuntimes = async () => {
  runtimeRepairing.value = true;
  try {
    const res = await window.desktopApi?.agent?.bootstrapRuntimes?.();
    if (res && Array.isArray(res)) {
      agentRuntimes.value = res;
    } else {
      await refreshAgentRuntimes();
    }
    notify({
      type: "info",
      title: "Môi trường Agent",
      message: "Đã kiểm tra provider trong runtime CAO; không cài provider native ngoài CAO.",
    });
  } catch (e: any) {
    notify({
      type: "warning",
      title: "Lỗi sửa chữa môi trường",
      message: e?.message || "Không thể tự động sửa chữa môi trường.",
    });
  } finally {
    runtimeRepairing.value = false;
  }
};
let handleVisibilityChange: (() => void) | undefined;
let caoStatusTimer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  const version = await window.desktopApi?.getAppVersion?.();
  if (version) appVersion.value = `v${version}`;
  const saved = await window.desktopApi?.agent?.listWorkspaces?.();
  if (saved?.[0]) workspace.value = saved[0];
  await refreshAgentRuntimes();
  await refreshCaoStatus();
  // The Electron main process starts the WSL/native CAO daemon in the
  // background, so the first status check can legitimately race startup.
  // Keep the badge and run-workspace routing state current without requiring
  // the operator to reopen Settings.
  caoStatusTimer = setInterval(() => {
    void refreshCaoStatus();
  }, 5_000);
  await refreshFleet();
  await refreshInbox();
  contextCanaryTimer = setInterval(() => {
    if (runStatus.value !== "running" || !lastAgentOutputAt.value) return;
    contextHealth.value =
      Date.now() - lastAgentOutputAt.value > 90_000 ? "quiet" : "healthy";
  }, 15_000);
  updater.value =
    (await window.desktopApi?.updater?.getState?.()) || updater.value;
  unsubUpdater = window.desktopApi?.updater?.onState?.((state: any) => {
    updater.value = state;
  });
  let pendingOutputBuffer = '';
  let outputRafHandle: number | null = null;
  const flushOutputBuffer = () => {
    if (pendingOutputBuffer) {
      output.value += pendingOutputBuffer;
      pendingOutputBuffer = '';
      lastAgentOutputAt.value = Date.now();
      contextHealth.value = 'healthy';
    }
    outputRafHandle = null;
  };

  handleVisibilityChange = () => {
    if (!document.hidden && sync.credential.value) {
      void refresh();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  unsubOutput = window.desktopApi?.agent?.onOutput?.((event: any) => {
    if (event.sessionId && !sessionId.value && running.value) {
      sessionId.value = event.sessionId;
    }
    if (
      event.sessionId === sessionId.value ||
      (!sessionId.value && running.value)
    ) {
      if (event.tokenUsage) {
        sessionTokenUsage.value = {
          promptTokens: event.tokenUsage.promptTokens || 0,
          completionTokens: event.tokenUsage.completionTokens || 0,
          totalTokens: event.tokenUsage.totalTokens || 0,
        };
      }
      if (event.agentRole) {
        activeAgentRole.value = event.agentRole;
      }
      if (typeof event.text === 'string' && event.text.length > 0) {
        pendingOutputBuffer += event.text;
        interactiveReporter.append(event.stream, event.text);
        if (!outputRafHandle) {
          outputRafHandle = requestAnimationFrame(flushOutputBuffer);
        }
      }
    }
  });
  unsubExit = window.desktopApi?.agent?.onExit?.((event: any) => {
    if (event.sessionId && !sessionId.value && running.value) {
      sessionId.value = event.sessionId;
    }
    flushOutputBuffer();
    void handleAgentExit(event);
  });
  await refresh();
});
onUnmounted(() => {
  interactiveReporter.reset();
  unsubOutput?.();
  unsubExit?.();
  unsubUpdater?.();
  if (contextCanaryTimer) clearInterval(contextCanaryTimer);
  if (caoStatusTimer) clearInterval(caoStatusTimer);
  if (handleVisibilityChange) document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>
<template>
  <main class="cc-shell">
    <ConnectionBar
      :credential="sync.credential.value"
      :online="sync.isOnline.value"
      :syncing="syncing"
      :pending-outbox-count="mcpOutbox.pendingCount.value"
      :last-synced="lastSynced"
      :is-maximized="isMaximized"
      :attention-count="approvalRequest ? 1 : 0"
      :projects="sync.projects.value"
      :fleet-count="fleetAgents.length"
      :active-fleet-count="fleetAgents.filter((a) => a.status === 'running').length"
      :cao-status="caoStatus"
      :cao-reconnecting="caoReconnecting"
      @sync="refresh"
      @connect="connect"
      @disconnect="
        () => {
          sync.clearCredential();
          notify({
            type: 'warning',
            title: 'Đã ngắt kết nối',
            message: 'Đã xóa thông tin xác thực Task Hub.',
          });
        }
      "
      @settings="settingsOpen = true"
      @requirement="openTool('requirement')"
      @docs="openTool('docs')"
      @timeline="showTimelineDrawer = true"
      @agent-room="showAgentRoomDrawer = true"
      @open-hub="openHub"
      @minimize="minimize"
      @maximize="maximize"
      @close="close"
      @restart-cao="restartCao"
    />
    <SettingsPanel
      :open="settingsOpen"
      :credential="sync.credential.value"
      :workspace="workspace"
      :execution-policy="executionPolicy"
      :diagnostics="diagnostics"
      :diagnostics-loading="diagnosticsLoading"
      :updater="updater"
      :agent-runtimes="agentRuntimes"
      :runtime-repairing="runtimeRepairing"
      :auto-submit-handoff="autoSubmitHandoff"
      :auto-continue-epic="autoContinueEpic"
      :auto-review-enabled="autoReviewEnabled"
      :reviewer-provider="reviewerProvider"
      :auto-review-max-iterations="autoReviewMaxIterations"
      :cao-status="caoStatus"
      :cao-reconnecting="caoReconnecting"
      @close="settingsOpen = false"
      @choose-workspace="chooseWorkspace"
      @update-execution-policy="
        (policy: ExecutionPolicy) => {
          executionPolicy = policy;
          notify({
            type: 'info',
            title: 'Quyền thực thi',
            message: `Đã đổi thành: ${policy}`,
          });
        }
      "
      @update-auto-submit-handoff="updateAutoSubmitHandoff"
      @update-auto-continue-epic="updateAutoContinueEpic"
      @update-auto-review="updateAutoReview"
      @run-diagnostics="runDiagnostics"
      @repair-runtimes="repairAgentRuntimes"
      @restart-cao="restartCao"
      @check-app-update="checkAppUpdate"
      @install-app-update="installAppUpdate"
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
      @update-proposal="
        (proposal) => {
          requirementPlan = proposal;
          notify({
            type: 'success',
            title: 'Đã lưu bản thảo',
            message: 'Bản thảo Backlog đã được cập nhật.',
          });
        }
      "
      @create-backlog="createBacklog"
      @run-docs="runDocs"
      @save-docs="saveDocs"
      @sync-docs="syncDocs"
    />
    <div class="cc-workspace-grid">
      <TaskQueue
        :tasks="sync.tasks.value.length ? sync.tasks.value : sync.agentTasks.value"
        :projects="sync.projects.value"
        :selected-id="selectedTask?.id || null"
        :loading="sync.isLoading.value"
        @select="selectTask"
        @requirement="openTool('requirement')"
        @open-hub="openHub"
      />
      <AgentFleetBar
        :open="showAgentRoomDrawer"
        :drawer="true"
        :agents="fleetAgents"
        :active-session-id="sessionId"
        @select="handleSelectFleetSession"
        @close="showAgentRoomDrawer = false"
      />
      <div class="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <RunWorkspace
          v-model:provider="provider"
          v-model:model="selectedModel"
          v-model:execution-policy="executionPolicy"
          :task="selectedTask"
          :tasks="sync.tasks.value.length ? sync.tasks.value : sync.agentTasks.value"
          :phase="phase"
          :workspace="workspace"
          :output="output"
          :running="running"
          :run-status="runStatus"
          :context-health="contextHealth"
          :cao-available="Boolean(caoStatus?.available)"
          :cao-status="caoStatus"
          :cao-reconnecting="caoReconnecting"
          :agent-role="activeAgentRole"
          :token-usage="sessionTokenUsage"
          :execution-route="executionRoute"
          :can-reconnect-cao="Boolean(reconnectableCaoSession)"
          :exit-code="runExitCode"
          :error="error"
          :approval-request="approvalRequest"
          :safety-alert="activeSafetyAlert"
          :epic-child-count="
            epicSequence?.tasks.length || (selectedTask?.issue_type === 'epic'
              ? (sync.tasks.value.length ? sync.tasks.value : sync.agentTasks.value).filter(
                  (task) =>
                    task.epic_id === selectedTask?.id &&
                    task.issue_type !== 'epic',
                ).length
              : 0)
          "
          :epic-completed-count="epicSequence?.completedIds.length || 0"
          :epic-auto-continue="epicSequence?.autoContinue ?? autoContinueEpic"
          :epic-sequence-running="Boolean(epicSequence)"
          :epic-finalizing="Boolean(epicSequence?.finalizing)"
          :diagnostics-loading="diagnosticsLoading"
          :handoff-review-url="handoffReviewUrl"
          :auto-review-status="autoReviewStatus"
          :auto-review-iteration="autoReviewIteration"
          :auto-review-max-iterations="activeReviewMaxIterations"
          :auto-review-feedback="autoReviewFeedback"
          :reviewer-provider="reviewerProvider"
          :is-epic-blocked="Boolean(epicSequence && (phase === 'Epic sequence blocked' || runStatus === 'failed' || error))"
          :epic-blocked-reason="error || toolMessage"
          @choose-workspace="chooseWorkspace"
          @launch="launch"
          @cancel="cancel"
          @send="send"
          @handoff="handoff"
          @request-approval="requestHumanApproval"
          @reconnect-cao="reconnectCaoSession"
          @restart-cao="restartCao"
          @reopen-todo="reopenEpicAsTodo"
          @retry-epic-task="retryEpicChildTask"
          @skip-epic-task="skipEpicChildTask"
          @skip-review-and-continue-epic="skipReviewAndContinueEpic"
          @skipReviewAndContinueEpic="skipReviewAndContinueEpic"
          @approve-retry="approveRetry"
          @dismiss-approval="dismissApproval"
          @approve-safety-alert="approveSafetyAlert"
          @reject-safety-alert="rejectSafetyAlert"
          @manual-review-approve="approveAfterManualReview"
          @manual-review-changes="continueAfterHumanReview"
          @increase-review-limit="increaseTaskReviewLimit"
          @open-hub="openHub"
          @timeline="showTimelineDrawer = true"
        />
      </div>
      <FilesDrawer
        :workspace="workspace"
        :worktree="worktree"
        :task="selectedTask"
        :is-open="showFilesDrawer"
        @toggle="showFilesDrawer = !showFilesDrawer"
        @close="showFilesDrawer = false"
      />
    </div>
    <StatusFooter
      :online="sync.isOnline.value"
      :connected="Boolean(sync.credential.value)"
      :provider="provider"
      :workspace="workspace"
      :worktree="worktree"
      :phase="phase"
      :run-status="runStatus"
      :app-version="appVersion"
      :cao-status="caoStatus"
      :cao-reconnecting="caoReconnecting"
    />
    <ActivityTimelineDrawer
      :show="showTimelineDrawer"
      :timeline="activityTimeline"
      :active-task="selectedTask"
      @close="showTimelineDrawer = false"
      @clear-timeline="clearTimeline"
    />
  </main>
</template>
