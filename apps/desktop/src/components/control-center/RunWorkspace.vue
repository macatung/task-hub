<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TaskItem } from "../../composables/useTaskSync";
import DangerousCommandBanner from "../DangerousCommandBanner.vue";
import type { SafetyInterceptEvent } from "../../utils/safetyGuardrails";
import FlowStepper from "./FlowStepper.vue";
import TaskProgressHero from "./TaskProgressHero.vue";
import ConversationThread from "./ConversationThread.vue";
import StreamCardsView from "./StreamCardsView.vue";
import ExecutionTimeline from "./ExecutionTimeline.vue";
import ExecutionDetailDrawer from "./ExecutionDetailDrawer.vue";
import EpicTaskAccordion from "./EpicTaskAccordion.vue";
import type { ExecutionStreamEvent } from "../../utils/executionStream";
import { useConversationThread } from "../../composables/useConversationThread";
import { useAutoPilotStore } from "../../stores/useAutoPilotStore";
import { deriveFlowState } from "../../utils/flowState";
import {
  PROVIDER_MODELS,
  DEFAULT_PROVIDER_MODELS,
} from "../../constants/models";

export type Provider = "codex" | "claude_code" | "antigravity";
export type RunStatus =
  "idle" | "running" | "completed" | "failed" | "cancelled";
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

export interface RunWorkspaceProps {
  task: TaskItem | null;
  tasks?: TaskItem[];
  provider: Provider;
  model?: string;
  executionPolicy: ExecutionPolicy;
  phase: string;
  workspace: string;
  output: string;
  running: boolean;
  runStatus: RunStatus;
  exitCode: number | null;
  error: string;
  approvalRequest: ApprovalRequest | null;
  safetyAlert?: SafetyInterceptEvent | null;
  diagnosticsLoading: boolean;
  handoffReviewUrl?: string;
  epicChildCount?: number;
  epicCompletedCount?: number;
  epicAutoContinue?: boolean;
  epicSequenceRunning?: boolean;
  epicFinalizing?: boolean;
  autoReviewStatus?:
    | "idle"
    | "reviewing"
    | "changes_requested"
    | "approved"
    | "max_iterations"
    | "failed";
  autoReviewIteration?: number;
  autoReviewMaxIterations?: number;
  autoReviewFeedback?: string;
  reviewerProvider?: Provider;
  contextHealth?: "healthy" | "quiet";
  caoAvailable?: boolean;
  executionRoute?: ExecutionRoute;
  orchestrationMode?: "workflow" | "supervisor";
  workflowSteps?: Array<{ id: string; label: string; shortLabel: string }>;
  workflowCurrentStep?: string;
  canReconnectCao?: boolean;
  caoStatus?: {
    running: boolean;
    available: boolean;
    reconnecting?: boolean;
    port?: number;
    source?: "embedded" | "external" | "offline";
    cli?: string | null;
    error?: string;
  } | null;
  agentRole?: "supervisor" | "worker" | "reviewer" | "implementation" | "tool" | string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  caoReconnecting?: boolean;
  isEpicBlocked?: boolean;
  epicBlockedReason?: string;
  streamEvents?: ExecutionStreamEvent[];
  epicTaskGroups?: Array<{ id?: number; taskKey?: string; title: string; dependencies?: string[]; steps: any[]; status?: string }>;
  workflowStatus?: any;
  workflowKind?: any;
  pipelineVariant?: any;
  epicTitle?: string;
  workers?: Array<{ sessionId?: string; id?: string; name?: string; provider?: string; role?: string; status?: string; stepInfo?: string }>;
}

const props = defineProps<RunWorkspaceProps>();

const emit = defineEmits<{
  "update:provider": [value: Provider];
  "update:model": [value: string];
  "update:executionPolicy": [value: ExecutionPolicy];
  "update:agentRole": [value: string];
  "open-agent-room": [];
  chooseWorkspace: [];
  launch: [];
  cancel: [];
  send: [message: string];
  handoff: [payload: any];
  "open-hub": [];
  "request-approval": [];
  'reopen-todo': [];
  approveRetry: [policy: "workspace_write" | "full_access"];
  dismissApproval: [];
  timeline: [];
  approveSafetyAlert: [eventId: string];
  rejectSafetyAlert: [eventId: string];
  manualReviewApprove: [];
  manualReviewChanges: [feedback: string];
  increaseReviewLimit: [limit: number];
  reconnectCao: [];
  restartCao: [];
  "restart-cao": [];
  retryEpicTask: [];
  "retry-epic-task": [];
  skipEpicTask: [];
  "skip-epic-task": [];
  skipReviewAndContinueEpic: [];
  "skip-review-and-continue-epic": [];
  resume: [];
  retry: [stepId?: string];
  selectSubTask: [taskId: number | string];
  "select-sub-task": [taskId: number | string];
}>();

const followUp = ref("");
const showHandoff = ref(false);
const summary = ref("");
const changedFiles = ref("");
const tests = ref("");
const testStatus = ref("passed");
const testSummary = ref("");
const commitSha = ref("");
const pullRequestUrl = ref("");
const blockers = ref("");
const activeSubTab = ref<"execution" | "conversation" | "debug">("execution");
const humanReviewFeedback = ref("");
const increasedReviewLimit = ref(3);
const isChatDockCollapsed = ref(false);
const showRunContext = ref(false);

const handleSelectSubTask = (taskId: number | string) => {
  emit('selectSubTask', taskId);
  emit('select-sub-task', taskId);
};
const selectedStreamEvent = ref<ExecutionStreamEvent | null>(null);
const selectedWorkerId = ref<string | null>(null);

const autoPilotStore = useAutoPilotStore();
const thread = useConversationThread();

watch(
  () => props.task?.id,
  (id) => {
    if (id) thread.loadThread(id);
  },
  { immediate: true },
);

watch(
  () => props.output,
  (out) => {
    if (props.running && out) {
      thread.updateStreamingAgentTurn(out, {
        provider: props.provider,
        model: props.model,
        role: (props.agentRole as any) || 'worker',
        status: 'stream',
      });
    }
  },
);

watch(
  () => props.running,
  (isRun, wasRun) => {
    if (wasRun && !isRun) {
      thread.finalizeStreamingTurn(props.runStatus === 'failed' ? 'failed' : 'completed');
    }
  },
);

const handleSendPrompt = (text: string) => {
  if (!text.trim()) return;
  thread.addUserMessage(text.trim());
  emit("send", text.trim());
  activeSubTab.value = "conversation";
};

watch(() => props.orchestrationMode, (mode) => {
  if (mode === 'workflow' || mode === 'supervisor') activeSubTab.value = 'execution';
}, { immediate: true });

const isStreaming = computed(
  () => props.running && Boolean(props.output?.trim()),
);

const isCaoReconnecting = computed(
  () => Boolean(props.caoReconnecting || props.caoStatus?.reconnecting),
);

const isCaoAvailable = computed(() => {
  if (props.caoAvailable !== undefined) return props.caoAvailable;
  if (props.caoStatus?.available !== undefined) return props.caoStatus.available;
  return true;
});

const caoStatusLabel = computed(() => {
  if (isCaoReconnecting.value) return "Đang kết nối lại…";
  if (isCaoAvailable.value) return "Sẵn sàng";
  return "Bắt buộc · chưa sẵn sàng";
});

const caoStatusTone = computed(() => {
  if (isCaoReconnecting.value) return "text-amber-400";
  if (isCaoAvailable.value) return "cc-state--success";
  return "cc-state--blocked";
});

const roleBadgeLabel = computed(() => {
  if (!props.agentRole) return "";
  if (props.agentRole === "supervisor") return "SUPERVISOR";
  if (props.agentRole === "worker") return "WORKER";
  if (props.agentRole === "reviewer") return "REVIEWER";
  return props.agentRole.toUpperCase();
});

const roleBadgeClass = computed(() => {
  if (props.agentRole === "supervisor")
    return "border-purple-500/50 bg-purple-950/40 text-purple-300";
  if (props.agentRole === "worker")
    return "border-sky-500/50 bg-sky-950/40 text-sky-300";
  if (props.agentRole === "reviewer")
    return "border-amber-500/50 bg-amber-950/40 text-amber-300";
  return "border-zinc-700 bg-zinc-800/50 text-zinc-300";
});

const formatTokens = (count?: number): string => {
  if (count === undefined || count === null || isNaN(count)) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
};

const flowState = computed(() =>
  deriveFlowState({
    phase: props.phase,
    runStatus: props.runStatus,
    autoReviewStatus: props.autoReviewStatus,
    approvalPending: Boolean(props.approvalRequest),
    caoAvailable: isCaoAvailable.value,
    executionRoute: props.executionRoute,
  }),
);

const insertSnippet = (template: string) => {
  followUp.value = followUp.value ? `${followUp.value}\n${template}` : template;
};

const availableModels = computed(() => PROVIDER_MODELS[props.provider] || []);

const activeModelValue = computed(
  () => props.model || DEFAULT_PROVIDER_MODELS[props.provider] || "default",
);

const dependencyState = computed(() => {
  const dependencies = (props.task?.dependencies || [])
    .map((dependency) => ({
      ...dependency,
      depends_on:
        props.tasks?.find(
          (candidate) => candidate.id === dependency.depends_on_task_id,
        ) || dependency.depends_on,
    }))
    .filter((dependency) => dependency.depends_on);
  const pendingLabels = dependencies
    .filter((dependency) => dependency.depends_on?.status !== "done")
    .map(
      (dependency) =>
        dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`,
    );
  const dependents = (props.tasks || [])
    .filter((candidate) => candidate.id !== props.task?.id)
    .filter((candidate) =>
      (candidate.dependencies || []).some(
        (dependency) => dependency.depends_on_task_id === props.task?.id,
      ),
    )
    .map((candidate) => ({
      label: candidate.issue_key || `#${candidate.id}`,
      status: candidate.status,
    }));
  const dependentReconsideration = dependents.filter(
    (candidate) => candidate.status !== "todo",
  );
  return {
    labels: dependencies.map(
      (dependency) =>
        dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`,
    ),
    pendingLabels,
    reconsidered: props.task?.status === "done" && pendingLabels.length > 0,
    dependents,
    dependentReconsideration,
  };
});

const isEpic = computed(() => props.task?.issue_type === "epic");
const isEpicContext = computed(
  () => isEpic.value || Boolean(props.epicSequenceRunning || props.epicFinalizing),
);
const runnableStatus = computed(
  () => props.task?.status === "todo" || props.task?.status === "in_progress",
);

const executionBlock = computed(() => {
  if (!props.task) return null;
  if (!runnableStatus.value) {
    if (props.task.status === "review")
      return {
        title: "Waiting for Hub review",
        detail:
          "This task is in Review. Approve or request changes on Hub before starting another local run.",
        tone: "amber",
      };
    if (props.task.status === "done")
      return {
        title: "Task already completed",
        detail:
          "This task is complete. Reopen it on Hub before running it again.",
        tone: "slate",
      };
    return {
      title: "Execution unavailable",
      detail: "The current task status does not allow a local run.",
      tone: "slate",
    };
  }
  if (dependencyState.value.pendingLabels.length) {
    return {
      title: "Blocked by prerequisites",
      detail: `Complete ${dependencyState.value.pendingLabels.join(", ")} before running this task.`,
      tone: "amber",
    };
  }
  if (isEpic.value && !(props.epicChildCount || 0)) {
    return {
      title: "Epic has no runnable child tasks",
      detail:
        "Add or unblock a child task on Hub before starting the sequence.",
      tone: "slate",
    };
  }
  if (props.caoAvailable === false || (props.caoStatus && !props.caoStatus.available && !isCaoReconnecting.value)) {
    return {
      title: "CAO daemon is required",
      detail: "CAO daemon is required to orchestrate multi-agent sessions. Start or restart the CAO daemon to proceed.",
      tone: "rose",
    };
  }
  return null;
});

const canLaunch = computed(() =>
  Boolean(
    props.task &&
      props.workspace &&
      !props.running &&
      !props.epicSequenceRunning &&
      runnableStatus.value &&
      !executionBlock.value &&
      props.caoAvailable !== false &&
      (!props.caoStatus || props.caoStatus.available || isCaoReconnecting.value),
  ),
);

type ActivityKind = "tool" | "progress" | "result" | "warning" | "thinking";
type Activity = { kind: ActivityKind; line: string };
type ResponseTurn = {
  response: string;
  activity: Activity[];
  pending?: boolean;
  outcome?: Exclude<RunStatus, "idle">;
};
type ActivityGroup = { kind: ActivityKind; lines: string[] };

const classifyActivity = (line: string): ActivityKind => {
  if (/^(?:💭\s*|(?:thinking|reasoning)\s*[:：]|<thinking>)/i.test(line))
    return "thinking";
  if (/\[Executing command\]|⚙|^\$\s/.test(line)) return "tool";
  if (/✓ Turn completed|✓ Completed|Process exited/.test(line)) return "result";
  if (
    /exit code:\s*(?!0\b)\d+|(?:^|\s)(?:ERROR|FATAL)\s+(?:[\w:.-]+|$)|^(?:stderr:|✕|🛑)\b|process exited \((?!0\))|command failed|failed to execute/i.test(
      line,
    )
  )
    return "warning";
  return "progress";
};

const MAX_LOG_LINES_TO_PARSE = 2500;
const MAX_RENDERED_LINES_PER_GROUP = 300;

const responseTurns = computed<ResponseTurn[]>(() => {
  const rawOutput = props.output || "";
  if (!rawOutput) return [];
  const allLines = rawOutput.split(/\r?\n/);
  const lines =
    allLines.length > MAX_LOG_LINES_TO_PARSE
      ? allLines.slice(-MAX_LOG_LINES_TO_PARSE)
      : allLines;

  const turns: ResponseTurn[] = [];
  let pending: Activity[] = [];
  let active: ResponseTurn | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    if (/^💬\s*/.test(line)) {
      active = { response: line.replace(/^💬\s*/, ""), activity: pending };
      pending = [];
      turns.push(active);
      continue;
    }
    const kind = classifyActivity(line);
    if (active && kind === "progress") {
      active.response += `\n${line}`;
      continue;
    }
    pending.push({ kind, line });
    active = undefined;
  }
  if (pending.length && turns.length && !props.running)
    turns.at(-1)!.activity.push(...pending);
  else if (pending.length || (!turns.length && props.running)) {
    const outcome = props.runStatus === "idle" ? undefined : props.runStatus;
    const response = props.running ? 'Working…' : props.runStatus === 'failed' ? 'Run failed before a final agent response.' : props.runStatus === 'cancelled' ? 'Run cancelled.' : props.runStatus === 'completed' ? 'Run completed.' : 'Working…';
    turns.push({
      response,
      activity: pending,
      pending: props.running,
      outcome,
    });
  }
  return turns;
});

const activityGroups = (turn: ResponseTurn): ActivityGroup[] =>
  (["tool", "progress", "thinking", "warning", "result"] as ActivityKind[])
    .map((kind) => {
      const allLines = turn.activity
        .filter((item) => item.kind === kind)
        .map((item) => item.line);
      const lines =
        allLines.length > MAX_RENDERED_LINES_PER_GROUP
          ? allLines.slice(-MAX_RENDERED_LINES_PER_GROUP)
          : allLines;
      return {
        kind,
        lines,
      };
    })
    .filter((group) => group.lines.length);

const activityLabel = (kind: ActivityKind) =>
  ({
    tool: "Tools",
    progress: "Progress",
    thinking: "Thinking",
    warning: "Warnings",
    result: "Result",
  })[kind];

const activityTone = (kind: ActivityKind) =>
  ({
    tool: "cc-activity-tone--tool",
    progress: "text-zinc-400 hover:text-zinc-200",
    thinking: "cc-activity-tone--thinking",
    warning: "cc-activity-tone--warning",
    result: "cc-activity-tone--result",
  })[kind];

const groupSummary = (group: ActivityGroup) =>
  `${group.lines.length} ${activityLabel(group.kind).toLowerCase()} item${group.lines.length === 1 ? "" : "s"}`;

const turnSummary = (turn: ResponseTurn) => {
  const counts = turn.activity.reduce(
    (acc, item) => {
      acc[item.kind] = (acc[item.kind] || 0) + 1;
      return acc;
    },
    {} as Record<ActivityKind, number>,
  );
  const parts = Object.entries(counts).map(
    ([kind, count]) =>
      `${count} ${activityLabel(kind as ActivityKind).toLowerCase()}`,
  );
  return parts.length
    ? parts.join(" · ")
    : `${turn.activity.length} item${turn.activity.length === 1 ? "" : "s"}`;
};

const statusLabel = computed(() => {
  if (props.running) return "Running";
  if (props.runStatus === "completed") return "Completed";
  if (props.runStatus === "failed") return "Failed";
  if (props.runStatus === "cancelled") return "Cancelled";
  return "Idle";
});

const responseLabel = (turn: ResponseTurn) => {
  if (turn.pending) return "Working…";
  if (turn.outcome === "failed") return "Failed turn";
  if (turn.outcome === "cancelled") return "Cancelled turn";
  return "Agent response";
};

const providerTitle = computed(() => {
  if (props.provider === "antigravity") return "Google Antigravity";
  if (props.provider === "claude_code") return "Anthropic Claude Code";
  return "OpenAI Codex";
});

const providerVersion = computed(() => {
  if (props.provider === "antigravity") return "agy v1.1.20";
  if (props.provider === "claude_code") return "v1.0.12";
  return "v0.141.0";
});

const providerTone = computed(() => {
  return {
    border: "cc-provider-border",
    bg: "cc-provider-bg",
    text: "cc-provider-text",
    subText: "cc-provider-subtext",
    highlight: "cc-provider-highlight",
  };
});

const displayModelName = computed(() => {
  const found = availableModels.value.find((m) => m.id === props.model);
  return found ? found.name : props.model || "Default model";
});

const displayDirectory = computed(() => {
  if (!props.workspace) return "~/workspace";
  return props.workspace;
});

const displayPermission = computed(() => {
  if (props.executionPolicy === "full_access")
    return "Full access (Unrestricted)";
  if (props.executionPolicy === "workspace_write")
    return "Workspace write (Sandboxed)";
  return "Read only";
});

const permissionTone = computed(() => {
  if (props.executionPolicy === "full_access")
    return "cc-permission-tone--elevated font-medium";
  if (props.executionPolicy === "workspace_write")
    return "cc-permission-tone--write font-medium";
  return "cc-permission-tone--readonly";
});

const displayResponse = computed(() => props.output || '');

const copyTechnicalOutput = async () => {
  if (!props.output) return;
  try {
    await navigator.clipboard.writeText(props.output);
  } catch (e) {
    console.warn('Failed to copy technical output', e);
  }
};

const downloadTechnicalOutput = () => {
  if (!props.output) return;
  const blob = new Blob([props.output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terminal-output-${Date.now()}.log`;
  a.click();
  URL.revokeObjectURL(url);
};

const submit = () => {
  emit("handoff", {
    summary: summary.value,
    changedFiles: changedFiles.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    tests: tests.value,
    testStatus: testStatus.value,
    testSummary: testSummary.value,
    commitSha: commitSha.value,
    pullRequestUrl: pullRequestUrl.value,
    blockers: blockers.value,
  });
  showHandoff.value = false;
};
</script>

<template>
  <section
    class="flex flex-1 flex-col overflow-hidden bg-[#04070d] select-none"
  >
    <!-- Active Agent Header Banner (AgentsRoom style) -->
    <header
      class="cc-run-header flex items-center justify-between border-b border-[#141b2d] bg-[#070b14] px-5 py-2.5"
    >
      <div
        class="cc-run-header__identity flex items-center gap-3 min-w-0 flex-1 mr-3"
      >
        <!-- Avatar with status dot -->
        <div class="relative shrink-0 flex items-center justify-center">
          <div
            class="cc-task-avatar inline-flex items-center justify-center shrink-0 h-10 w-10 rounded-2xl text-white font-black text-xs ring-2 ring-white/10"
            :class="
              task?.issue_type === 'epic'
                ? 'cc-task-avatar--epic'
                : task?.issue_type === 'story'
                  ? 'cc-task-avatar--story'
                  : task?.issue_type === 'bug'
                    ? 'cc-task-avatar--bug'
                    : 'cc-task-avatar--task'
            "
          >
            <i
              class="codicon text-lg shrink-0"
              :class="
                task?.issue_type === 'epic'
                  ? 'codicon-layers'
                  : task?.issue_type === 'story'
                    ? 'codicon-bookmark'
                    : task?.issue_type === 'bug'
                      ? 'codicon-bug'
                      : 'codicon-checklist'
              "
            ></i>
          </div>
          <span
            class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#070b14] shrink-0"
            :class="
              running
                ? 'cc-dot--active'
                : task
                  ? 'cc-dot--accent'
                  : 'cc-dot--muted'
            "
          ></span>
        </div>

        <!-- Task Title & Tag -->
        <div class="min-w-0 flex-1 flex flex-col justify-center">
          <div class="flex items-center gap-2 min-w-0">
            <h2
              class="text-sm font-bold text-zinc-100 truncate font-['Space_Grotesk'] leading-tight"
              :title="task ? task.title : 'Chưa chọn tác vụ'"
            >
              {{ task ? task.title : "Chưa chọn tác vụ" }}
            </h2>
            <span
              v-if="task?.priority === 'high'"
              class="cc-status-chip cc-status-chip--danger shrink-0 inline-flex items-center justify-center h-4 px-1.5 rounded-full text-[9px] font-bold"
            >
              ƯU TIÊN
            </span>
          </div>

          <div
            class="cc-run-header__meta flex items-center gap-2 mt-0.5 min-w-0 flex-wrap"
          >
            <span
              class="cc-status-chip cc-status-chip--accent shrink-0 rounded-full px-2 py-0.2 text-[9px] font-bold tracking-wide uppercase font-mono inline-flex items-center justify-center"
            >
              ●
              {{ task ? task.issue_key || `#${task.id}` : "CHƯA CHỌN TASK" }}
            </span>

            <!-- Multi-Agent Role Badge -->
            <span
              v-if="agentRole"
              class="cc-status-chip shrink-0 rounded-full px-2 py-0.2 text-[9px] font-bold tracking-wide uppercase border inline-flex items-center justify-center font-mono"
              :class="roleBadgeClass"
              :title="`Multi-agent role: ${agentRole}`"
            >
              {{ roleBadgeLabel }}
            </span>

            <!-- Live Token Usage Telemetry Widget -->
            <span
              v-if="tokenUsage && tokenUsage.totalTokens > 0"
              class="shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-300 bg-[#0c1220] border border-[#141b2d] rounded-full px-2 py-0.2"
              :title="`Token usage: Prompt: ${formatTokens(tokenUsage.promptTokens)} · Completion: ${formatTokens(tokenUsage.completionTokens)} · Total: ${formatTokens(tokenUsage.totalTokens)}`"
            >
              <i
                class="codicon codicon-dashboard text-[10px] text-[#00f5a0] shrink-0"
              ></i>
              <span class="leading-none"
                >Tokens: <b>{{ formatTokens(tokenUsage.totalTokens) }}</b></span
              >
              <span
                class="text-zinc-500 text-[9px] hidden md:inline leading-none"
                >(P: {{ formatTokens(tokenUsage.promptTokens) }} · C:
                {{ formatTokens(tokenUsage.completionTokens) }})</span
              >
            </span>

            <span
              class="cc-run-header__workspace-meta shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400"
            >
              <span
                class="h-1.5 w-1.5 rounded-full shrink-0"
                :class="workspace ? 'cc-dot--success' : 'cc-dot--warning'"
              ></span>
              <span class="leading-none">{{
                workspace
                  ? workspace.split(/[\\/]/).pop() || "Workspace"
                  : "Chưa chọn thư mục"
              }}</span>
            </span>
            <span
              class="cc-run-header__phase-meta text-[10px] text-zinc-500 truncate hidden md:inline leading-none"
            >
              {{ phase }} ·
              {{
                contextHealth === "quiet" ? "Quiet context" : "Context healthy"
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Header Controls: primary action plus secondary controls that move into overflow on narrow widths. -->
      <div class="cc-run-header__actions flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        <!-- 1. Agent Role Selector Pill -->
        <div class="flex items-center gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-[#00f5a0]/40 transition">
          <span class="text-xs">{{ agentRole === 'supervisor' ? '🏛️' : agentRole === 'reviewer' ? '🔍' : agentRole === 'qa' ? '🧪' : '🛠️' }}</span>
          <select
            :value="agentRole || 'implementation'"
            class="bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer"
            title="Chọn vai trò tác tử (Agent Role)"
            aria-label="Agent Role"
            @change="$emit('update:agentRole', ($event.target as HTMLSelectElement).value)"
          >
            <option value="implementation" class="bg-[#070b14] text-zinc-200">🛠️ Implementation (Dev)</option>
            <option value="supervisor" class="bg-[#070b14] text-zinc-200">🏛️ Supervisor (Lead)</option>
            <option value="reviewer" class="bg-[#070b14] text-zinc-200">🔍 Reviewer (Auditor)</option>
            <option value="qa" class="bg-[#070b14] text-zinc-200">🧪 QA (Tester)</option>
          </select>
        </div>

        <!-- 2. AI Provider Selector Pill -->
        <div class="flex items-center gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-[#00f5a0]/40 transition">
          <span
            class="h-2 w-2 rounded-full shrink-0"
            :class="provider === 'codex' ? 'bg-[#00f5a0] shadow-[0_0_8px_#00f5a0]' : provider === 'claude_code' ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'"
          ></span>
          <select
            :value="provider"
            class="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer"
            title="Chọn AI Provider / Engine"
            aria-label="Provider"
            @change="$emit('update:provider', ($event.target as HTMLSelectElement).value as Provider)"
          >
            <option value="codex" class="bg-[#070b14] text-zinc-200">Codex</option>
            <option value="antigravity" class="bg-[#070b14] text-zinc-200">Antigravity</option>
            <option value="claude_code" class="bg-[#070b14] text-zinc-200">Claude Code</option>
          </select>
        </div>

        <!-- 3. AI Model Selector Pill -->
        <div class="hidden md:flex items-center gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-[#00f5a0]/40 transition">
          <i class="codicon codicon-chip text-zinc-400 text-xs shrink-0"></i>
          <select
            :value="activeModelValue"
            class="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
            title="Chọn Model AI"
            aria-label="Select AI Model"
            @change="$emit('update:model', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="m in availableModels"
              :key="m.id"
              :value="m.id"
              class="bg-[#070b14] text-zinc-200"
            >
              {{ m.name }}
            </option>
          </select>
        </div>

        <!-- 4. Quick Switch Agent / Fleet Button -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0c1220] to-[#101a2e] border border-[#00f5a0]/40 hover:border-[#00f5a0] px-2.5 py-1 text-xs font-semibold text-[#00f5a0] hover:text-white transition shadow-sm shrink-0 cursor-pointer"
          title="Mở phòng trực chiến để chuyển đổi tác tử hoặc điều phối fleet"
          @click="$emit('open-agent-room')"
        >
          <i class="codicon codicon-organization text-xs"></i>
          <span class="hidden sm:inline">Fleet / Đổi Agent</span>
          <span class="sm:hidden">Fleet</span>
          <span v-if="workers?.length" class="rounded-full bg-[#00f5a0]/15 border border-[#00f5a0]/40 px-1.5 py-0.2 text-[10px] font-mono text-[#00f5a0]">
            {{ workers.length }}
          </span>
        </button>

        <!-- Secondary Controls in Kebab -->
        <details class="cc-overflow-menu cc-run-header-overflow shrink-0">
          <summary
            class="cc-run-header-overflow__trigger grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#11182c] hover:text-zinc-200 transition shrink-0"
            title="Tùy chọn bổ sung"
            aria-label="Tùy chọn bổ sung"
          >
            <i class="codicon codicon-kebab-vertical text-xs shrink-0"></i>
          </summary>
          <div
            class="cc-overflow-menu__panel cc-run-header-overflow__panel bg-[#070b14] border border-[#141b2d]"
          >
            <select
              :value="executionPolicy"
              class="cc-run-header-control rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs font-medium text-zinc-300 focus:outline-none"
              title="Quyền hạn thực thi"
              aria-label="Execution permission"
              @change="$emit('update:executionPolicy', ($event.target as HTMLSelectElement).value as ExecutionPolicy)"
            >
              <option value="restricted" class="bg-[#070b14]">Read only</option>
              <option value="workspace_write" class="bg-[#070b14]">Workspace write</option>
              <option value="full_access" class="bg-[#070b14]">Full access</option>
            </select>

            <button
              class="cc-run-header-control cc-button text-xs"
              title="View E2E Activity and Audit Timeline"
              @click="$emit('timeline')"
            >
              ⏱ Timeline
            </button>
            <button
              class="cc-run-header-control cc-button text-xs"
              @click="$emit('chooseWorkspace')"
            >
              {{ workspace ? "Đổi thư mục" : "Chọn thư mục" }}
            </button>
            <button
              v-if="!running && task && !(isEpicContext && (epicSequenceRunning || epicFinalizing))"
              class="cc-run-header-control cc-button text-xs"
              @click="showHandoff = !showHandoff"
            >
              Review & submit handoff
            </button>
          </div>
        </details>

        <!-- Unified execution tabs. Legacy role cards are only available to Auto-Pilot. -->
        <div class="flex items-center gap-1 rounded-xl bg-[#0c1220] border border-[#141b2d] p-1 shadow-sm shrink-0">
          <button
            class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition"
            :class="
              activeSubTab === 'execution'
                ? 'bg-[#11182c] border border-cyan-500/60 text-cyan-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            "
            @click="activeSubTab = 'execution'"
          >
            <span class="leading-none">◉ Execution</span>
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition"
            :class="
              activeSubTab === 'conversation'
                ? 'bg-[#0b1d16] border border-[#00f5a0]/60 text-[#00f5a0] shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            "
            @click="activeSubTab = 'conversation'"
          >
            <span class="leading-none">💬 Cuộc trò chuyện ({{ thread.messages.value.length }})</span>
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition"
            :class="activeSubTab === 'debug' ? 'bg-[#11182c] border border-amber-500/50 text-amber-300 shadow-sm' : ''"
            @click="activeSubTab = 'debug'"
          >
            <span class="leading-none">&gt;_ Debug</span>
          </button>
        </div>

        <!-- Launch / Run Button -->
        <button
          class="cc-primary cc-run-header__launch text-xs shrink-0"
          :disabled="!canLaunch"
          @click="$emit('launch')"
        >
          {{ isEpic ? "Run Epic sequence" : "Launch agent" }}
        </button>

        <!-- Header Actions: fullscreen -->
        <button
          class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#11182c] hover:text-zinc-200 transition shrink-0"
          title="Toàn màn hình"
        >
          <i class="codicon codicon-screen-full text-xs shrink-0"></i>
        </button>
      </div>
    </header>

    <!-- Epic / Dependency / Safety Banners -->
    <div
      v-if="isEpicContext"
      class="cc-muted-callout px-5 pt-2 text-[11px] font-semibold"
    >
      <template v-if="orchestrationMode === 'workflow' && isEpicContext">
        <span>Strict CAO Workflow · </span>
        {{ task?.issue_key || task?.title || "Epic" }} ·
        {{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks mapped
      </template>
      <template v-else-if="epicSequenceRunning || epicFinalizing">
        <span v-if="epicFinalizing"
          >Epic handoff is being completed automatically ·
        </span>
        <span v-else
          >CAO đang chạy xuyên Epic ·
          {{ task?.issue_key || task?.title || "TH-01" }} ·
        </span>
        {{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks completed
      </template>
      <template v-else>
        Epic sequence ·
        {{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks completed ·
        runs one task at a time<span v-if="epicAutoContinue">
          and starts the next task after each automatic verification. </span
        ><!-- it never bypasses dependencies --><span v-else>
          and pauses only if a human decision is required.
        </span>
      </template>
    </div>

    <!-- CAO Daemon Offline Warning Banner -->
    <div
      v-if="
        (props.caoAvailable === false ||
          (props.caoStatus &&
            !props.caoStatus.available &&
            !isCaoReconnecting)) &&
        !running
      "
      class="mx-5 mt-3 rounded-xl border border-rose-900/60 bg-rose-950/25 p-3.5 text-xs text-rose-100 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2">
        <i
          class="codicon codicon-warning text-sm text-rose-400 shrink-0"
        ></i>
        <div>
          <p class="font-semibold text-rose-200">CAO daemon is required</p>
          <p class="text-[11px] text-rose-300/80 mt-0.5">
            Task Hub requires the CAO daemon on port 9889 to orchestrate
            multi-agent runs.
          </p>
        </div>
      </div>
      <button
        class="cc-button shrink-0 text-xs border-rose-700/60 hover:bg-rose-900/40 text-rose-200"
        :disabled="isCaoReconnecting"
        @click="$emit('restart-cao'); $emit('restartCao')"
      >
        {{ isCaoReconnecting ? "Đang khởi động lại…" : "Restart CAO" }}
      </button>
    </div>

    <!-- Only show review UI when the configured automatic limit needs a human decision. -->
    <section
      v-if="autoReviewStatus === 'max_iterations'"
      class="mx-5 mt-3 rounded-xl border border-amber-600/60 bg-amber-950/25 p-4 text-xs text-amber-100"
    >
      <div class="flex items-center justify-between gap-3">
        <b>Auto-review reached its limit</b
        ><span
          >{{ autoReviewIteration || 0 }}/{{
            autoReviewMaxIterations || 0
          }}
          rounds</span
        >
      </div>
      <p class="mt-2 text-amber-100/80">
        Review the final feedback, approve the task, request another
        implementation pass, or increase this task’s review limit.
      </p>
      <p
        v-if="autoReviewFeedback"
        class="mt-3 whitespace-pre-wrap rounded-lg bg-black/20 p-3 leading-5"
      >
        {{ autoReviewFeedback }}
      </p>
      <textarea
        v-model="humanReviewFeedback"
        class="mt-3 min-h-20 w-full rounded-lg border border-amber-700/60 bg-black/20 p-2 text-xs text-amber-50"
        placeholder="Human review feedback (required when requesting changes)"
      />
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          class="cc-primary text-xs"
          @click="$emit('manualReviewApprove')"
        >
          Approve &amp; mark Done
        </button>
        <button
          class="cc-button text-xs"
          :disabled="!humanReviewFeedback.trim()"
          @click="$emit('manualReviewChanges', humanReviewFeedback)"
        >
          Request changes
        </button>
        <label class="ml-auto flex items-center gap-2 text-[11px]"
          >Increase to
          <input
            v-model.number="increasedReviewLimit"
            class="w-14 rounded border border-amber-700/60 bg-black/20 px-1.5 py-1"
            type="number"
            :min="(autoReviewMaxIterations || 1) + 1"
            max="10"
          />
          rounds
        </label>
        <button
          class="cc-button text-xs"
          :disabled="
            increasedReviewLimit <= (autoReviewMaxIterations || 0)
          "
          @click="$emit('increaseReviewLimit', increasedReviewLimit)"
        >
          Continue auto-review
        </button>
      </div>
    </section>

    <!-- Dangerous Command & Safety Interception Banner -->
    <div v-if="safetyAlert" class="mx-5 mt-3">
      <DangerousCommandBanner
        :alert="safetyAlert"
        @approve="$emit('approveSafetyAlert', $event)"
        @reject="$emit('rejectSafetyAlert', $event)"
      />
    </div>

    <!-- Error / Approval Request Banner -->
    <div
      v-if="error"
      class="cc-error-banner mx-5 mt-3 rounded-xl border px-3.5 py-3 text-sm"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1 min-w-0 flex-1">
          <span>{{ error }}</span>
          <div v-if="isEpicContext || isEpicBlocked" class="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-semibold text-white shadow transition text-xs"
              @click="$emit('skip-review-and-continue-epic'); $emit('skipReviewAndContinueEpic')"
            >
              <i class="codicon codicon-pass-filled shrink-0"></i>
              <span>Bỏ qua review & Chạy tiếp Epic</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1 font-semibold text-zinc-100 shadow-sm transition text-xs"
              @click="$emit('retry-epic-task'); $emit('retryEpicTask')"
            >
              <i class="codicon codicon-debug-restart shrink-0"></i>
              <span>Thử lại task</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-[#11182c] hover:bg-[#16203a] border border-[#141b2d] px-3 py-1 font-semibold text-zinc-300 hover:text-white transition text-xs"
              @click="$emit('skip-epic-task'); $emit('skipEpicTask')"
            >
              <i class="codicon codicon-debug-step-over shrink-0"></i>
              <span>Bỏ qua task</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="canReconnectCao"
            class="cc-primary shrink-0"
            @click="$emit('reconnectCao')"
          >
            Reconnect CAO session
          </button>
          <button
            v-if="!approvalRequest"
            class="cc-button shrink-0"
            :disabled="diagnosticsLoading"
            @click="$emit('request-approval')"
          >
            {{ diagnosticsLoading ? "Checking…" : "Request human approval" }}
          </button>
        </div>
      </div>
      <div
        v-if="approvalRequest"
        class="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-100"
      >
        <p class="font-semibold">Human approval required</p>
        <p class="mt-1 text-amber-100/80">
          {{ approvalRequest.diagnosticSummary || approvalRequest.reason }}
        </p>
        <ul
          v-if="approvalRequest.diagnosticDetails?.length"
          class="mt-2 list-disc space-y-1 pl-4 text-amber-100/75"
        >
          <li
            v-for="detail in approvalRequest.diagnosticDetails"
            :key="detail"
          >
            {{ detail }}
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            class="cc-button"
            @click="$emit('approveRetry', 'workspace_write')"
          >
            Approve workspace-write retry
          </button>
          <button
            class="cc-danger"
            @click="$emit('approveRetry', 'full_access')"
          >
            Approve full-access retry
          </button>
          <button class="cc-button" @click="$emit('dismissApproval')">
            Decline
          </button>
        </div>
        <p class="mt-2 text-[11px] text-amber-100/60">
          Requested {{ approvalRequest.requestedAt }}. A full-access retry
          bypasses Codex sandbox and native approval prompts; it cannot repair a
          missing sandbox helper.
        </p>
      </div>
    </div>

    <!-- Main Workspace Content / Compact stream display -->
        <!-- Multi-Agent Fleet Switcher Strip -->
    <div
      v-if="workers && workers.length > 0"
      class="flex items-center gap-2 border-b border-[#141b2d] bg-[#060a14] px-4 py-2 text-xs overflow-x-auto shrink-0"
    >
      <div class="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] shrink-0">
        <i class="codicon codicon-organization text-[#00f5a0]"></i>
        <span class="font-bold text-zinc-200">Đổi Tác tử / Fleet:</span>
      </div>
      <div class="flex items-center gap-1.5 min-w-0 flex-nowrap">
        <button
          v-for="w in workers"
          :key="w.sessionId || w.id"
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition shrink-0 cursor-pointer"
          :class="[
            selectedWorkerId === (w.sessionId || w.id)
              ? 'border-[#00f5a0]/60 bg-[#00f5a0]/15 text-[#00f5a0] shadow-sm'
              : 'border-[#141b2d] bg-[#0c1220] text-zinc-300 hover:border-zinc-500 hover:text-white'
          ]"
          @click="handleSelectSubTask(w.sessionId || w.id || '')"
        >
          <span
            class="h-1.5 w-1.5 rounded-full shrink-0"
            :class="w.status === 'running' ? 'bg-[#00f5a0] animate-ping' : 'bg-zinc-500'"
          ></span>
          <span class="font-mono text-[11px] font-bold">{{ w.role || 'Worker' }}</span>
          <span class="text-[10px] text-zinc-400 font-mono">({{ w.provider || 'Codex' }})</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-lg border border-dashed border-[#141b2d] hover:border-[#00f5a0] px-2 py-1 text-[11px] text-zinc-400 hover:text-[#00f5a0] transition shrink-0 cursor-pointer"
          @click="$emit('open-agent-room')"
        >
          <i class="codicon codicon-plus text-xs"></i>
          <span>Quản lý Fleet</span>
        </button>
      </div>
    </div>

    <!-- Main Workspace Content / Compact stream display -->
    <main class="cc-run-content min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
      <!-- Task Progress Hero: Prioritized visual progress when running or executing -->
      <TaskProgressHero
        v-if="running || runStatus === 'running' || isEpicContext || workflowCurrentStep || (task && ['in_progress', 'running'].includes(task.status))"
        :task="task"
        :tasks="tasks"
        :running="running"
        :run-status="runStatus"
        :workflow-status="workflowStatus"
        :workflow-kind="workflowKind"
        :pipeline-variant="pipelineVariant"
        :epic-title="epicTitle || (isEpicContext ? task?.title : undefined)"
        :epic-completed-count="epicCompletedCount"
        :epic-child-count="epicChildCount"
        :epic-task-groups="epicTaskGroups"
        :agent-role="agentRole"
        :provider="provider"
        :model="model"
        :token-usage="tokenUsage"
        :phase="phase"
        :error="error"
        @cancel="$emit('cancel')"
        @resume="$emit('resume')"
        @retry="$emit('retry', $event)"
        @select-sub-task="handleSelectSubTask"
        @update:provider="$emit('update:provider', $event as Provider)"
        @update:model="$emit('update:model', $event)"
        @update:agent-role="$emit('update:agentRole', $event)"
        @open-agent-room="$emit('open-agent-room')"
      />
      <!-- Compact execution context: collapses automatically once text starts streaming. -->
      <section
        class="cc-run-surface"
        :class="{ 'cc-run-surface--streaming': isStreaming }"
      >
        <button
          type="button"
          class="cc-run-context__summary"
          :aria-expanded="showRunContext"
          @click="showRunContext = !showRunContext"
        >
          <span
            class="cc-run-context__dot"
            :class="
              isStreaming
                ? 'cc-run-context__dot--live'
                : 'cc-run-context__dot--idle'
            "
          ></span>
          <span class="cc-run-context__title">{{
            isStreaming ? "Đang stream" : "Execution context"
          }}</span>
          <span class="cc-run-context__meta font-mono">{{ displayModelName }} · {{ displayDirectory.split(/[\\/]/).pop() || 'workspace' }}</span>
          <span class="cc-run-context__action inline-flex items-center gap-1">
            {{ showRunContext ? 'Thu gọn' : 'Chi tiết' }}
            <i
              class="codicon text-[10px] shrink-0"
              :class="
                showRunContext ? 'codicon-chevron-up' : 'codicon-chevron-down'
              "
            ></i>
          </span>
        </button>

        <div v-if="showRunContext" class="cc-run-context__body">
          <div class="cc-run-context__identity">
            <span class="cc-run-context__provider">{{ providerTitle }}</span>
            <span class="cc-run-context__version font-mono">{{ providerVersion }}</span>
          </div>
          <div class="cc-run-context__details">
            <div>
              <span>Model</span
              ><strong :class="providerTone.highlight" class="font-mono">{{
                displayModelName
              }}</strong>
            </div>
            <div>
              <span>Directory</span
              ><strong :title="displayDirectory" class="font-mono">{{ displayDirectory }}</strong>
            </div>
            <div>
              <span>Permissions</span
              ><strong :class="permissionTone">{{
                displayPermission
              }}</strong>
            </div>
            <div v-if="task">
              <span>Task</span
              ><strong :title="task.title"
                ><span class="font-mono text-[#00f5a0]">{{ task.issue_key || `#${task.id}` }}</span> ·
                {{ task.title }}</strong
              >
            </div>
          </div>
        </div>

        <FlowStepper
          v-if="orchestrationMode !== 'workflow'"
          :current-step="flowState.currentStep"
          :state="flowState.state"
          :label="flowState.label"
          :details="showRunContext ? flowState.details : undefined"
          :mode="undefined"
          :steps="undefined"
        />

        <!-- Epic Sequence Blocked Recovery Banner -->
        <div
          v-if="isEpicBlocked || (isEpicContext && runStatus === 'failed')"
          class="rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-[#190d14] to-[#070b14] p-4 text-xs shadow-lg space-y-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <i class="codicon codicon-warning text-rose-400 text-base mt-0.5 shrink-0"></i>
              <div>
                <b class="text-rose-200 text-sm font-semibold block font-['Space_Grotesk']">Chuỗi Epic đang bị tạm dừng (Epic Sequence Blocked)</b>
                <p class="text-zinc-400 text-xs mt-1 leading-relaxed">
                  {{ epicBlockedReason || error || "Lượt chạy gặp lỗi hoặc chưa hoàn tất phản hồi cuối cùng từ agent. Bạn có thể thử lại task này hoặc bỏ qua để tiếp tục các task độc lập khác." }}
                </p>
              </div>
            </div>
            <span class="rounded-full bg-rose-900/60 border border-rose-500/50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-rose-200 shrink-0 inline-flex items-center justify-center">
              BLOCKED
            </span>
          </div>

          <div class="flex items-center flex-wrap gap-2 pt-1 border-t border-rose-500/20">
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 font-semibold text-white shadow transition text-xs"
              @click="$emit('skip-review-and-continue-epic'); $emit('skipReviewAndContinueEpic')"
            >
              <i class="codicon codicon-pass-filled shrink-0"></i>
              <span>Bỏ qua review & Tiếp tục Epic</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3.5 py-1.5 font-semibold text-zinc-100 shadow-sm transition text-xs"
              @click="$emit('retry-epic-task'); $emit('retryEpicTask')"
            >
              <i class="codicon codicon-debug-restart shrink-0"></i>
              <span>Thử lại task này (Giữ worktree)</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-lg bg-[#11182c] hover:bg-[#16203a] border border-[#141b2d] px-3.5 py-1.5 font-semibold text-zinc-300 hover:text-white transition text-xs"
              @click="$emit('skip-epic-task'); $emit('skipEpicTask')"
            >
              <i class="codicon codicon-debug-step-over shrink-0"></i>
              <span>Bỏ qua & Tiếp tục Epic (DAG)</span>
            </button>
          </div>
        </div>

        <!-- Status line stays visible while the terminal-like context collapses. -->
        <div class="cc-run-statusline">
          <div class="cc-run-statusline__items">
            <div class="flex items-center gap-1.5">
              <i class="codicon codicon-pass text-xs cc-icon--success shrink-0"></i>
              <span>Task Hub Protocol · <b>Đã sẵn sàng</b></span>
            </div>
            <div class="flex items-center gap-1.5">
              <i
                class="codicon codicon-server-process text-xs shrink-0"
                :class="
                  isCaoReconnecting
                    ? 'text-amber-400 animate-spin'
                    : isCaoAvailable
                      ? 'cc-icon--info'
                      : 'text-rose-400'
                "
              ></i>
              <span
                >CAO ·
                <b :class="caoStatusTone">{{ caoStatusLabel }}</b></span
              >
            </div>
            <div
              class="cc-run-route"
              :class="executionRoute === 'cao' ? 'cc-run-route--cao' : ''"
            >
              <i
                class="codicon shrink-0"
                :class="
                  executionRoute === 'cao'
                    ? 'codicon-broadcast'
                    : 'codicon-terminal'
                "
                aria-hidden="true"
              ></i>
              <span>{{
                executionRoute === "cao"
                  ? "CAO session stream"
                  : "Chưa khởi động — CAO bắt buộc"
              }}</span>
            </div>
          </div>
          <span
            class="cc-run-statusline__state shrink-0 inline-flex items-center gap-1.5"
            :class="`cc-run-statusline__state--${runStatus}`"
          >
            <i class="h-1.5 w-1.5 rounded-full bg-current shrink-0"></i
            >{{ statusLabel }}
          </span>
        </div>

        <!-- Dynamic execution surface for CAO Workflow and Supervisor. -->
        <div v-if="activeSubTab === 'execution' && (orchestrationMode === 'workflow' || orchestrationMode === 'supervisor')" class="execution-surface">
          <div v-if="orchestrationMode === 'workflow' && epicTaskGroups?.length" class="execution-surface__outline">
            <EpicTaskAccordion :tasks="epicTaskGroups" :current-step="workflowCurrentStep" :selected-task-id="task?.id" />
          </div>
          <div v-else-if="orchestrationMode === 'supervisor'" class="execution-surface__outline supervisor-worker-tree">
            <header><span>Supervisor workers</span><span>{{ workers?.length || 0 }}</span></header>
            <button type="button" class="supervisor-worker" :class="{ 'is-selected': !selectedWorkerId }" @click="selectedWorkerId = null">
              <span class="supervisor-worker__dot"></span><span><strong>All workers</strong><small>Full session timeline</small></span>
            </button>
            <button v-for="worker in workers" :key="worker.sessionId || worker.id || worker.name" type="button" class="supervisor-worker" :class="{ 'is-selected': selectedWorkerId === (worker.sessionId || worker.id) }" @click="selectedWorkerId = worker.sessionId || worker.id || null">
              <span class="supervisor-worker__dot" :class="worker.status === 'failed' ? 'is-error' : worker.status === 'completed' ? 'is-success' : 'is-active'"></span><span><strong>{{ worker.name || worker.stepInfo || worker.id || 'Worker' }}</strong><small>{{ worker.provider || 'cao' }} · {{ worker.status || 'running' }}</small></span>
            </button>
            <p v-if="!workers?.length" class="supervisor-worker-tree__empty">Workers sẽ xuất hiện khi CAO phát event assign/handoff.</p>
          </div>
          <div class="execution-surface__timeline">
            <ExecutionTimeline :events="streamEvents || []" :running="running" :current-step="workflowCurrentStep" :selected-worker="selectedWorkerId" @select="selectedStreamEvent = $event" />
          </div>
        </div>
        <div v-else-if="activeSubTab === 'execution'" class="flex-1 min-h-[480px] h-full rounded-xl border border-[#141b2d] bg-[#070b14] shadow-inner overflow-hidden flex flex-col">
          <StreamCardsView
            :stage-executions="autoPilotStore.stageExecutions.value"
            :context-packages="autoPilotStore.contextPackages.value"
            :running="running"
            :task-title="task?.title"
            :task-key="task?.issue_key || (task?.id ? `#${task.id}` : undefined)"
          />
        </div>

        <!-- Conversation Thread Tab (Linear Chat View) -->
        <div v-else-if="activeSubTab === 'conversation'" class="flex-1 min-h-[480px] h-full rounded-xl border border-[#141b2d] bg-[#070b14] shadow-inner overflow-hidden flex flex-col">
          <ConversationThread
            :messages="thread.messages.value"
            :running="running"
            :streaming-text="displayResponse"
            :provider="provider"
            :model="model"
            :role="(agentRole as any)"
            :task-title="task?.title"
            @send-prompt="handleSendPrompt"
            @stop="$emit('cancel')"
          />
        </div>

        <!-- Debug tab: select an event; full payload/raw terminal opens in drawer. -->
        <div v-else-if="activeSubTab === 'debug'" class="flex-1 min-h-[480px] h-full rounded-xl border border-[#141b2d] bg-[#070b14] shadow-inner overflow-auto p-4">
          <div class="cc-run-section-heading"><span class="flex items-center gap-2"><i class="codicon codicon-debug text-amber-300 shrink-0"></i><span class="font-['Space_Grotesk'] font-bold">Debug events</span></span><span class="text-[11px] text-zinc-500 font-mono">{{ streamEvents?.length || 0 }} events</span></div>
          <p class="mb-3 text-[11px] text-zinc-500">Raw terminal và payload đầy đủ chỉ mở khi chọn một event.</p>
          <button v-for="event in streamEvents" :key="event.id" type="button" class="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-[#17253b] bg-[#0b1220] px-3 py-2 text-left hover:border-amber-500/40" @click="selectedStreamEvent = event"><span class="min-w-0 truncate text-xs text-zinc-200">{{ event.summary }}</span><span class="shrink-0 text-[10px] font-mono text-zinc-500">{{ event.type }}</span></button>
          <p v-if="!streamEvents?.length" class="py-10 text-center text-xs text-zinc-500">Chưa có debug event cho run này.</p>
        </div>

        <!-- Dynamic Agent Turns & Execution Logs (Turns Tab) -->
        <div v-else class="space-y-4">
          <div class="cc-run-section-heading">
            <span class="font-['Space_Grotesk'] font-bold">Hoạt động & Lượt phản hồi</span>
            <span class="text-[11px] text-zinc-400 font-mono">{{
              responseTurns.length
                ? `${responseTurns.length} lượt`
                : "Chưa có lượt"
            }}</span>
          </div>

          <!-- Empty State or Live Execution Output -->
          <div
            v-if="!responseTurns.length"
            class="py-6 text-center text-xs text-zinc-500"
          >
            <div v-if="running" class="inline-flex flex-col items-center gap-2">
              <span
                class="inline-flex items-center gap-2 font-medium cc-state--active"
              >
                <i class="h-2 w-2 rounded-full cc-dot--active shrink-0"></i>Đang thực thi
                và streaming dữ liệu…
              </span>
              <span class="text-[11px] text-zinc-500"
                >Dòng dữ liệu streaming sẽ hiển thị tại đây khi tiến trình
                output.</span
              >
            </div>
            <p v-else>
              Chưa có luồng thực thi mới. Nhập lệnh hoặc bấm Launch agent để bắt
              đầu.
            </p>
          </div>

          <!-- Response Turns Cards -->
          <div v-else class="space-y-4">
            <article
              v-for="(turn, index) in responseTurns"
              :key="index"
              class="cc-response-card rounded-xl p-3.5 space-y-2.5 bg-[#0c1220] border border-[#141b2d]"
            >
              <div
                class="flex items-center justify-between gap-3 text-xs text-zinc-400 border-b border-[#141b2d] pb-2"
              >
                <span
                  class="font-semibold flex items-center gap-1.5 text-zinc-200"
                >
                  <span
                    class="h-2 w-2 rounded-full shrink-0"
                    :class="
                      turn.pending
                        ? 'cc-dot--active'
                        : turn.outcome === 'completed'
                          ? 'cc-dot--success'
                          : turn.outcome === 'failed'
                            ? 'cc-dot--danger'
                            : turn.outcome === 'cancelled'
                              ? 'cc-dot--warning'
                              : 'cc-dot--muted'
                    "
                  ></span>
                  <span>{{ responseLabel(turn) }}</span>
                </span>
                <span class="text-[11px] text-zinc-500 font-mono"
                  >Step {{ index + 1 }}</span
                >
              </div>

              <div
                class="cc-response-text whitespace-pre-wrap break-words text-sm leading-6"
              >
                {{ turn.response }}
              </div>

              <!-- Technical Details & Logs Disclosures -->
              <details
                v-if="turn.activity.length"
                :open="!isStreaming && turn.pending"
                class="group mt-2"
              >
                <summary
                  class="cursor-pointer list-none text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  <span
                    class="inline-block transition-transform group-open:rotate-90"
                    >›</span
                  >
                  <span>{{ turnSummary(turn) }}</span>
                  <span class="ml-2 text-zinc-500 text-[11px]">View details</span>
                </summary>
                <div class="mt-2.5 space-y-2 border-l border-white/10 pl-3">
                  <details
                    v-for="group in activityGroups(turn)"
                    :key="group.kind"
                    :open="!isStreaming && !running"
                    class="group/nested"
                  >
                    <summary
                      class="cursor-pointer list-none text-xs font-mono"
                      :class="activityTone(group.kind)"
                    >
                      <span
                        class="mr-1 inline-block transition-transform group-open/nested:rotate-90"
                        >›</span
                      >
                      <span>{{ groupSummary(group) }}</span>
                    </summary>
                    <div class="mt-2 space-y-1 border-l border-white/10 pl-3">
                      <details
                        v-for="(line, lineIndex) in group.lines"
                        :key="lineIndex"
                        :open="
                          running && lineIndex === group.lines.length - 1
                        "
                        class="group/line"
                      >
                        <summary
                          class="cursor-pointer list-none truncate font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
                        >
                          <span
                            class="mr-1 inline-block transition-transform group-open/line:rotate-90"
                            >›</span
                          >
                          <span>{{ line }}</span>
                        </summary>
                        <pre
                          class="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2.5 font-mono text-[11px] leading-5 text-zinc-300 border border-white/5"
                          >{{ line }}</pre
                        >
                      </details>
                    </div>
                  </details>
                </div>
              </details>
            </article>
          </div>
        </div>
        <ExecutionDetailDrawer
          :event="selectedStreamEvent"
          :raw-terminal="output"
          @close="selectedStreamEvent = null"
        />
      </section>

    </main>

    <!-- Floating Command Input Bar & Sub-Tabs Footer -->
    <footer
      class="border-t border-[#141b2d] bg-[#070b14] px-5 py-3 space-y-2.5"
    >
      <!-- Collapsed State Bar -->
      <div
        v-if="isChatDockCollapsed"
        class="flex items-center justify-between rounded-xl border border-[#141b2d] bg-[#0c1220] px-4 py-2 text-xs text-zinc-400 shadow-md"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="h-2 w-2 rounded-full shrink-0"
            :class="running ? 'cc-dot--active animate-ping' : 'cc-dot--muted'"
          ></span>
          <span class="font-mono text-[11px] text-zinc-300">
            {{ running ? 'Đang thực thi tác vụ… Nhấn để mở rộng Chat & Chỉ thị' : 'Khung Chat & Chỉ thị đang thu gọn' }}
          </span>
        </div>
        <button
          type="button"
          class="cc-button text-[11px] py-1 px-3 flex items-center gap-1.5 hover:text-white"
          @click="isChatDockCollapsed = false"
        >
          <i class="codicon codicon-chevron-up text-xs"></i>
          <span>Mở rộng Chat</span>
        </button>
      </div>

      <!-- Expanded Rich Input Box (Large rounded-2xl container) -->
      <div
        v-else
        class="rounded-2xl border border-[#141b2d] bg-[#0c1220] p-3 shadow-lg focus-within:border-[#00f5a0]/80 focus-within:ring-1 focus-within:ring-[#00f5a0]/40 transition-all"
      >
        <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-white/5 text-[11px] text-zinc-400">
          <span class="font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
            <i class="codicon codicon-terminal text-[#00f5a0]"></i>
            Chỉ thị & Chat tương tác
          </span>
          <button
            type="button"
            class="hover:text-zinc-200 flex items-center gap-1 text-[10px] font-mono text-zinc-500 transition cursor-pointer"
            title="Thu gọn khung chat để ưu tiên không gian cho tiến độ"
            @click="isChatDockCollapsed = true"
          >
            <i class="codicon codicon-chevron-down text-xs"></i>
            <span>Thu gọn khung chat để ưu tiên không gian cho tiến độ</span>
          </button>
        </div>

        <textarea
          v-model="followUp"
          rows="2"
          class="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-5"
          :placeholder="
            running
              ? 'Gửi tin nhắn hoặc chỉ thị bổ sung…'
              : task
                ? `Nhập yêu cầu hoặc chỉ thị thực thi cho ${task.issue_key || 'tác vụ'}…`
                : 'Chọn một tác vụ từ danh sách để bắt đầu'
          "
          @keyup.enter="
            followUp.trim() &&
            (handleSendPrompt(followUp.trim()),
            $emit('send', followUp),
            (followUp = ''))
          "
        ></textarea>

        <!-- Command Toolbar & Action Pill -->
        <div
          class="mt-2 flex items-center justify-between pt-1 border-t border-[#141b2d]"
        >
          <!-- Left Tool Icons: Snippet, Format, Code, File, Task -->
          <div class="flex items-center gap-1.5 text-zinc-400">
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#11182c] hover:text-[#00f5a0] transition shrink-0"
              title="Chèn kế hoạch /plan"
              @click="insertSnippet('/plan ')"
            >
              <i class="codicon codicon-sparkle text-xs shrink-0"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#11182c] hover:text-[#00f5a0] transition shrink-0"
              title="Chèn khối code"
              @click="insertSnippet('```\n\n```')"
            >
              <i class="codicon codicon-code text-xs shrink-0"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#11182c] hover:text-[#00f5a0] transition shrink-0"
              title="Tham chiếu task"
              @click="
                insertSnippet(
                  task?.issue_key ? `@${task.issue_key} ` : '@task ',
                )
              "
            >
              <i class="codicon codicon-mention text-xs shrink-0"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#11182c] hover:text-[#00f5a0] transition shrink-0"
              title="Chèn đường dẫn tệp"
              @click="insertSnippet('@file: ')"
            >
              <i class="codicon codicon-file text-xs shrink-0"></i>
            </button>
          </div>

          <!-- Right: 3-in-1 Orange Action Pill Button & Cancel -->
          <div class="flex items-center gap-2">
            <!-- 3-in-1 Action Pill Button (Plan, Prompt, Send) -->
            <div
              class="flex items-center rounded-full bg-gradient-to-r from-[#00f5a0] to-[#00f5d4] p-0.5 shadow-[0_0_14px_rgba(0,245,160,0.35)] hover:shadow-[0_0_18px_rgba(0,245,160,0.55)] transition"
            >
              <button
                class="grid h-6 w-6 place-items-center text-black/80 hover:text-black transition shrink-0"
                title="Thêm tiền tố kế hoạch (/plan)"
                @click="insertSnippet('/plan ')"
              >
                <i class="codicon codicon-menu text-xs shrink-0"></i>
              </button>
              <button
                class="grid h-7 w-7 place-items-center rounded-full bg-[#00f5a0] text-black hover:brightness-110 font-black transition ml-0.5 shrink-0"
                title="Gửi lệnh cho tác nhân (Enter)"
                :disabled="!followUp && !running && !canLaunch"
                @click="
                  followUp.trim()
                    ? (handleSendPrompt(followUp.trim()), (followUp = ''))
                    : canLaunch
                      ? $emit('launch')
                      : null
                "
              >
                <i class="codicon codicon-send text-xs shrink-0"></i>
              </button>
            </div>

            <!-- Cancel Button if Running -->
            <button
              v-if="running"
              class="cc-danger text-xs shrink-0"
              @click="$emit('cancel')"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Handoff Submission Form -->
      <form
        v-if="
          showHandoff &&
          !(isEpicContext && (epicSequenceRunning || epicFinalizing))
        "
        class="cc-handoff-modal grid grid-cols-2 gap-2.5 rounded-xl bg-[#0c1220] border border-[#141b2d] p-3.5 text-xs"
        @submit.prevent="submit"
      >
        <textarea
          v-model="summary"
          class="cc-input col-span-2 min-h-16"
          placeholder="Tóm tắt kết quả bàn giao"
        ></textarea>
        <textarea
          v-model="changedFiles"
          class="cc-input min-h-16 font-mono"
          placeholder="Danh sách tệp thay đổi (mỗi dòng 1 tệp)"
        ></textarea>
        <textarea
          v-model="tests"
          class="cc-input min-h-16 font-mono"
          placeholder="Bằng chứng kiểm thử"
        ></textarea>
        <select v-model="testStatus" class="cc-select font-mono">
          <option value="passed">Đã vượt qua (Passed)</option>
          <option value="failed">Thất bại (Failed)</option>
          <option value="skipped">Bỏ qua (Skipped)</option>
        </select>
        <input
          v-model="testSummary"
          class="cc-input"
          placeholder="Tóm tắt kiểm thử"
        />
        <input
          v-model="commitSha"
          class="cc-input font-mono"
          placeholder="Commit SHA"
        />
        <input
          v-model="pullRequestUrl"
          class="cc-input font-mono"
          placeholder="Pull request URL"
        />
        <textarea
          v-model="blockers"
          class="cc-input col-span-2 min-h-12"
          placeholder="Các vướng mắc (nếu có)"
        ></textarea>
        <div class="col-span-2 flex justify-end gap-2 mt-1">
          <button
            type="button"
            class="cc-button"
            @click="showHandoff = false"
          >
            Hủy
          </button>
          <button class="cc-primary">Gửi lên Hub</button>
        </div>
      </form>
    </footer>

    <!-- Epic Review Reopen Footer Note -->
    <div
      v-if="task?.issue_type === 'epic' && task.status === 'review'"
      class="border-t border-amber-700/50 bg-amber-950/20 px-5 py-2.5"
    >
      <div
        class="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100"
      >
        <span
          >Epic đang ở Review. Đưa về To do để chạy lại sequence.</span
        >
        <button class="cc-button shrink-0" @click="$emit('reopen-todo')">
          Reopen as To do
        </button>
      </div>
    </div>
  </section>
</template>
