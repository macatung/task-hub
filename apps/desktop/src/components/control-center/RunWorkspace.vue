<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TaskItem } from "../../composables/useTaskSync";
import DangerousCommandBanner from "../DangerousCommandBanner.vue";
import type { SafetyInterceptEvent } from "../../utils/safetyGuardrails";
import FlowStepper from "./FlowStepper.vue";
import ConversationThread from "./ConversationThread.vue";
import { useConversationThread } from "../../composables/useConversationThread";
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
}

const props = defineProps<RunWorkspaceProps>();

const emit = defineEmits<{
  "update:provider": [value: Provider];
  "update:model": [value: string];
  "update:executionPolicy": [value: ExecutionPolicy];
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
const activeSubTab = ref<"conversation" | "terminal" | "turns" | "handoff">("conversation");
const humanReviewFeedback = ref("");
const increasedReviewLimit = ref(3);
const showRunContext = ref(false);

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
    class="flex flex-1 flex-col overflow-hidden bg-[#12100e] select-none"
  >
    <!-- Active Agent Header Banner (AgentsRoom style) -->
    <header
      class="cc-run-header flex items-center justify-between border-b border-[#251e18] bg-[#161310] px-5 py-2.5"
    >
      <div
        class="cc-run-header__identity flex items-center gap-3 min-w-0 flex-1 mr-3"
      >
        <!-- Avatar with status dot -->
        <div class="relative shrink-0">
          <div
            class="cc-task-avatar grid h-10 w-10 place-items-center rounded-2xl text-white font-black text-xs ring-2 ring-white/10"
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
              class="codicon text-lg"
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
            class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#161310]"
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
              class="text-sm font-bold text-zinc-100 truncate"
              :title="task ? task.title : 'Chưa chọn tác vụ'"
            >
              {{ task ? task.title : "Chưa chọn tác vụ" }}
            </h2>
            <span
              v-if="task?.priority === 'high'"
              class="cc-status-chip cc-status-chip--danger shrink-0 grid h-4 px-1.5 place-items-center rounded-full text-[9px] font-bold"
            >
              ƯU TIÊN
            </span>
          </div>

          <div
            class="cc-run-header__meta flex items-center gap-2 mt-0.5 min-w-0 flex-wrap"
          >
            <span
              class="cc-status-chip cc-status-chip--accent shrink-0 rounded-full px-2 py-0.2 text-[9px] font-bold tracking-wide uppercase"
            >
              ●
              {{ task ? task.issue_key || `#${task.id}` : "CHƯA CHỌN TASK" }}
            </span>

            <!-- Multi-Agent Role Badge -->
            <span
              v-if="agentRole"
              class="cc-status-chip shrink-0 rounded-full px-2 py-0.2 text-[9px] font-bold tracking-wide uppercase border"
              :class="roleBadgeClass"
              :title="`Multi-agent role: ${agentRole}`"
            >
              {{ roleBadgeLabel }}
            </span>

            <!-- Live Token Usage Telemetry Widget -->
            <span
              v-if="tokenUsage && tokenUsage.totalTokens > 0"
              class="shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-300 bg-[#1e1915] border border-[#332a21] rounded-full px-2 py-0.2"
              :title="`Token usage: Prompt: ${formatTokens(tokenUsage.promptTokens)} · Completion: ${formatTokens(tokenUsage.completionTokens)} · Total: ${formatTokens(tokenUsage.totalTokens)}`"
            >
              <i
                class="codicon codicon-dashboard text-[10px] text-orange-400"
              ></i>
              <span
                >Tokens: <b>{{ formatTokens(tokenUsage.totalTokens) }}</b></span
              >
              <span
                class="text-zinc-500 text-[9px] hidden md:inline"
                >(P: {{ formatTokens(tokenUsage.promptTokens) }} · C:
                {{ formatTokens(tokenUsage.completionTokens) }})</span
              >
            </span>

            <span
              class="cc-run-header__workspace-meta shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="workspace ? 'cc-dot--success' : 'cc-dot--warning'"
              ></span>
              <span>{{
                workspace
                  ? workspace.split(/[\\/]/).pop() || "Workspace"
                  : "Chưa chọn thư mục"
              }}</span>
            </span>
            <span
              class="cc-run-header__phase-meta text-[10px] text-zinc-500 truncate hidden md:inline"
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
      <div class="cc-run-header__actions flex items-center gap-2 shrink-0">
        <details class="cc-overflow-menu cc-run-header-overflow">
          <summary
            class="cc-run-header-overflow__trigger grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#251e18] hover:text-zinc-200 transition"
            title="Tùy chọn agent"
            aria-label="Tùy chọn agent"
          >
            <i class="codicon codicon-kebab-vertical text-xs"></i>
          </summary>
          <div
            class="cc-overflow-menu__panel cc-run-header-overflow__panel"
          >
            <div
              class="cc-run-header-control cc-run-header-control--model flex items-center gap-1 rounded-full bg-[#1e1915] border border-[#332a21] px-3 py-1 text-xs"
            >
              <span class="h-2 w-2 rounded-full cc-dot--accent"></span>
              <select
                :value="activeModelValue"
                class="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer"
                title="Select AI Model"
                aria-label="Select AI Model"
                @change="
                  $emit(
                    'update:model',
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option
                  v-for="m in availableModels"
                  :key="m.id"
                  :value="m.id"
                  class="bg-[#181411] text-zinc-200"
                >
                  {{ m.name }}
                </option>
              </select>
            </div>

            <select
              :value="provider"
              class="cc-run-header-control rounded-full bg-[#1e1915] border border-[#332a21] px-2.5 py-1 text-xs font-medium text-zinc-300 focus:outline-none"
              aria-label="Provider"
              @change="
                $emit(
                  'update:provider',
                  ($event.target as HTMLSelectElement).value as Provider,
                )
              "
            >
              <option value="codex" class="bg-[#181411]">Codex</option>
              <option value="claude_code" class="bg-[#181411]">
                Claude Code
              </option>
              <option value="antigravity" class="bg-[#181411]">
                Antigravity
              </option>
            </select>

            <select
              :value="executionPolicy"
              class="cc-run-header-control rounded-full bg-[#1e1915] border border-[#332a21] px-2.5 py-1 text-xs font-medium text-zinc-300 focus:outline-none"
              title="Execution permission"
              aria-label="Execution permission"
              @change="
                $emit(
                  'update:executionPolicy',
                  ($event.target as HTMLSelectElement).value as ExecutionPolicy,
                )
              "
            >
              <option value="restricted" class="bg-[#181411]">
                Read only
              </option>
              <option value="workspace_write" class="bg-[#181411]">
                Workspace write
              </option>
              <option value="full_access" class="bg-[#181411]">
                Full access
              </option>
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
          </div>
        </details>

        <!-- Launch / Run Button -->
        <button
          class="cc-primary cc-run-header__launch text-xs"
          :disabled="!canLaunch"
          @click="$emit('launch')"
        >
          {{ isEpic ? "Run Epic sequence" : "Launch agent" }}
        </button>

        <!-- Header Actions: fullscreen -->
        <button
          class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#251e18] hover:text-zinc-200 transition"
          title="Toàn màn hình"
        >
          <i class="codicon codicon-screen-full text-xs"></i>
        </button>
      </div>
    </header>

    <!-- Epic / Dependency / Safety Banners -->
    <div
      v-if="isEpicContext"
      class="cc-muted-callout px-5 pt-2 text-[11px] font-semibold"
    >
      <template v-if="epicSequenceRunning || epicFinalizing">
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
              class="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-semibold text-white shadow transition text-xs"
              @click="$emit('skip-review-and-continue-epic'); $emit('skipReviewAndContinueEpic')"
            >
              <i class="codicon codicon-pass-filled"></i>
              <span>Bỏ qua review & Chạy tiếp Epic</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1 font-semibold text-white shadow transition text-xs"
              @click="$emit('retry-epic-task'); $emit('retryEpicTask')"
            >
              <i class="codicon codicon-debug-restart"></i>
              <span>Thử lại task</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-[#2b211d] hover:bg-[#382b26] border border-[#4a362f] px-3 py-1 font-semibold text-zinc-300 hover:text-white transition text-xs"
              @click="$emit('skip-epic-task'); $emit('skipEpicTask')"
            >
              <i class="codicon codicon-debug-step-over"></i>
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
    <main class="cc-run-content min-h-0 flex-1 overflow-y-auto">
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
          <span class="cc-run-context__meta">{{ displayModelName }} · {{ displayDirectory.split(/[\\/]/).pop() || 'workspace' }}</span>
          <span class="cc-run-context__action">
            {{ showRunContext ? 'Thu gọn' : 'Chi tiết' }}
            <i
              class="codicon text-[10px]"
              :class="
                showRunContext ? 'codicon-chevron-up' : 'codicon-chevron-down'
              "
            ></i>
          </span>
        </button>

        <div v-if="showRunContext" class="cc-run-context__body">
          <div class="cc-run-context__identity">
            <span class="cc-run-context__provider">{{ providerTitle }}</span>
            <span class="cc-run-context__version">{{ providerVersion }}</span>
          </div>
          <div class="cc-run-context__details">
            <div>
              <span>Model</span
              ><strong :class="providerTone.highlight">{{
                displayModelName
              }}</strong>
            </div>
            <div>
              <span>Directory</span
              ><strong :title="displayDirectory">{{ displayDirectory }}</strong>
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
                >{{ task.issue_key || `#${task.id}` }} ·
                {{ task.title }}</strong
              >
            </div>
          </div>
        </div>

        <FlowStepper
          :current-step="flowState.currentStep"
          :state="flowState.state"
          :label="flowState.label"
          :details="showRunContext ? flowState.details : undefined"
        />

        <!-- Epic Sequence Blocked Recovery Banner -->
        <div
          v-if="isEpicBlocked || (isEpicContext && runStatus === 'failed')"
          class="rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-[#261515] to-[#1a1212] p-4 text-xs shadow-lg space-y-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <i class="codicon codicon-warning text-rose-400 text-base mt-0.5 shrink-0"></i>
              <div>
                <b class="text-rose-200 text-sm font-semibold block">Chuỗi Epic đang bị tạm dừng (Epic Sequence Blocked)</b>
                <p class="text-zinc-400 text-xs mt-1 leading-relaxed">
                  {{ epicBlockedReason || error || "Lượt chạy gặp lỗi hoặc chưa hoàn tất phản hồi cuối cùng từ agent. Bạn có thể thử lại task này hoặc bỏ qua để tiếp tục các task độc lập khác." }}
                </p>
              </div>
            </div>
            <span class="rounded-full bg-rose-900/60 border border-rose-500/50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-rose-200 shrink-0">
              BLOCKED
            </span>
          </div>

          <div class="flex items-center flex-wrap gap-2 pt-1 border-t border-rose-500/20">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 font-semibold text-white shadow transition text-xs"
              @click="$emit('skip-review-and-continue-epic'); $emit('skipReviewAndContinueEpic')"
            >
              <i class="codicon codicon-pass-filled"></i>
              <span>Bỏ qua review & Tiếp tục Epic</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3.5 py-1.5 font-semibold text-white shadow transition text-xs"
              @click="$emit('retry-epic-task'); $emit('retryEpicTask')"
            >
              <i class="codicon codicon-debug-restart"></i>
              <span>Thử lại task này (Giữ worktree)</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg bg-[#2b211d] hover:bg-[#382b26] border border-[#4a362f] px-3.5 py-1.5 font-semibold text-zinc-300 hover:text-white transition text-xs"
              @click="$emit('skip-epic-task'); $emit('skipEpicTask')"
            >
              <i class="codicon codicon-debug-step-over"></i>
              <span>Bỏ qua & Tiếp tục Epic (DAG)</span>
            </button>
          </div>
        </div>

        <!-- Status line stays visible while the terminal-like context collapses. -->
        <div class="cc-run-statusline">
          <div class="cc-run-statusline__items">
            <div class="flex items-center gap-1.5">
              <i class="codicon codicon-pass text-xs cc-icon--success"></i>
              <span>Task Hub Protocol · <b>Đã sẵn sàng</b></span>
            </div>
            <div class="flex items-center gap-1.5">
              <i
                class="codicon codicon-server-process text-xs"
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
                class="codicon"
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
            class="cc-run-statusline__state"
            :class="`cc-run-statusline__state--${runStatus}`"
          >
            <i class="h-1.5 w-1.5 rounded-full bg-current"></i
            >{{ statusLabel }}
          </span>
        </div>

        <!-- Conversation Thread Tab (Default View) -->
        <div v-if="activeSubTab === 'conversation'" class="h-[440px] rounded-xl border border-[#17253b] bg-[#050911] shadow-inner overflow-hidden">
          <ConversationThread
            :messages="thread.messages.value"
            :running="running"
            :streaming-text="output"
            :provider="provider"
            :model="model"
            :role="(agentRole as any)"
            :task-title="task?.title"
            @send-prompt="handleSendPrompt"
            @stop="$emit('cancel')"
          />
        </div>

        <!-- Terminal Stream Output Tab -->
        <div v-else-if="activeSubTab === 'terminal'" class="space-y-3">
          <div class="cc-run-section-heading">
            <span class="flex items-center gap-2">
              <i class="codicon codicon-terminal text-orange-400"></i>
              <span>Luồng Terminal Output</span>
            </span>
            <span class="text-[11px] text-[#8e938f] font-mono">{{
              output ? `${output.length} ký tự` : "Chưa có output"
            }}</span>
          </div>

          <div
            class="rounded-xl border border-[#2b231c] bg-[#0c0a09] p-3.5 font-mono text-xs text-zinc-300 shadow-inner"
          >
            <pre
              v-if="output"
              class="max-h-[440px] overflow-auto whitespace-pre-wrap break-words leading-relaxed font-mono select-text"
              >{{ output }}</pre
            >
            <div v-else class="py-10 text-center text-xs text-zinc-500">
              <div v-if="running" class="inline-flex flex-col items-center gap-2">
                <span class="inline-flex items-center gap-2 font-medium cc-state--active">
                  <i class="h-2 w-2 rounded-full cc-dot--active"></i>Đang chờ dữ liệu streaming từ CAO…
                </span>
              </div>
              <p v-else>Chưa có dữ liệu terminal output từ phiên làm việc này.</p>
            </div>
          </div>
        </div>

        <!-- Dynamic Agent Turns & Execution Logs (Turns Tab) -->
        <div v-else class="space-y-4">
          <div class="cc-run-section-heading">
            <span>Hoạt động & Lượt phản hồi</span>
            <span class="text-[11px] text-[#8e938f]">{{
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
                <i class="h-2 w-2 rounded-full cc-dot--active"></i>Đang thực thi
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
              class="cc-response-card rounded-xl p-3.5 space-y-2.5"
            >
              <div
                class="flex items-center justify-between gap-3 text-xs text-zinc-400 border-b border-[#241c16] pb-2"
              >
                <span
                  class="font-semibold flex items-center gap-1.5 text-zinc-200"
                >
                  <span
                    class="h-2 w-2 rounded-full"
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
                <span class="text-[11px] text-zinc-500"
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
      </section>

      <!-- Status Notice Banner (AgentsRoom style callout) -->
      <div
        v-if="runStatus === 'idle' && !output.trim()"
        class="cc-muted-callout rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2.5"
      >
        <i
          class="codicon codicon-info cc-icon--warning mt-0.5 shrink-0"
        ></i>
        <p class="leading-5 text-[11px]">
          Chưa gửi: tác vụ này chưa từng khởi động nên terminal chỉ là một shell.
          Hãy hoàn tất phần cài đặt hiển thị phía trên, khởi động tác vụ rồi gửi
          lại. Tin nhắn của bạn vẫn được giữ.
        </p>
      </div>
    </main>

    <!-- Floating Command Input Bar & Sub-Tabs Footer -->
    <footer
      class="border-t border-[#251e18] bg-[#14110f] px-5 py-3 space-y-2.5"
    >
      <!-- Rich Input Box (Large rounded-2xl container) -->
      <div
        class="rounded-2xl border border-[#2d251e] bg-[#191512] p-3 shadow-lg focus-within:border-orange-500/80 focus-within:ring-1 focus-within:ring-orange-500/40 transition-all"
      >
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
          class="mt-2 flex items-center justify-between pt-1 border-t border-[#251e18]"
        >
          <!-- Left Tool Icons: Snippet, Format, Code, File, Task -->
          <div class="flex items-center gap-1.5 text-zinc-400">
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#251e18] hover:text-orange-400 transition"
              title="Chèn kế hoạch /plan"
              @click="insertSnippet('/plan ')"
            >
              <i class="codicon codicon-sparkle text-xs"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#251e18] hover:text-orange-400 transition"
              title="Chèn khối code"
              @click="insertSnippet('```\n\n```')"
            >
              <i class="codicon codicon-code text-xs"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#251e18] hover:text-orange-400 transition"
              title="Tham chiếu task"
              @click="
                insertSnippet(
                  task?.issue_key ? `@${task.issue_key} ` : '@task ',
                )
              "
            >
              <i class="codicon codicon-mention text-xs"></i>
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#251e18] hover:text-orange-400 transition"
              title="Chèn đường dẫn tệp"
              @click="insertSnippet('@file: ')"
            >
              <i class="codicon codicon-file text-xs"></i>
            </button>
          </div>

          <!-- Right: 3-in-1 Orange Action Pill Button & Cancel -->
          <div class="flex items-center gap-2">
            <!-- 3-in-1 Action Pill Button (Plan, Prompt, Send) -->
            <div
              class="flex items-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 p-0.5 shadow-[0_0_14px_rgba(249,115,22,0.4)] hover:shadow-[0_0_18px_rgba(249,115,22,0.55)] transition"
            >
              <button
                class="grid h-6 w-6 place-items-center text-black/80 hover:text-black transition"
                title="Thêm tiền tố kế hoạch (/plan)"
                @click="insertSnippet('/plan ')"
              >
                <i class="codicon codicon-menu text-xs"></i>
              </button>
              <button
                class="grid h-7 w-7 place-items-center rounded-full bg-orange-600 text-black hover:bg-orange-700 font-bold transition ml-0.5"
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
                <i class="codicon codicon-send text-xs"></i>
              </button>
            </div>

            <!-- Cancel Button if Running -->
            <button
              v-if="running"
              class="cc-danger text-xs"
              @click="$emit('cancel')"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Sub-Tabs Toolbar: Cuộc trò chuyện, Terminal, Dòng thời gian -->
      <div class="flex items-center justify-between text-xs pt-1">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition"
            :class="
              activeSubTab === 'conversation'
                ? 'bg-[#0b1c14] border border-[#00f5a0]/50 text-[#00f5a0] shadow-sm'
                : 'bg-[#181411] border border-[#2b231c] text-zinc-400 hover:text-zinc-200'
            "
            @click="activeSubTab = 'conversation'"
          >
            <span>💬 Cuộc trò chuyện ({{ thread.messages.value.length }})</span>
          </button>
          <button
            class="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition"
            :class="
              activeSubTab === 'terminal'
                ? 'bg-[#241d18] border border-orange-500/40 text-orange-400 shadow-sm'
                : 'bg-[#181411] border border-[#2b231c] text-zinc-400 hover:text-zinc-200'
            "
            @click="activeSubTab = 'terminal'"
          >
            <span>>_ Luồng Terminal</span>
          </button>
          <button
            class="flex items-center gap-1.5 rounded-full bg-[#181411] border border-[#2b231c] px-3 py-1 font-semibold hover:border-zinc-500 text-zinc-300 hover:text-white transition"
            @click="$emit('timeline')"
          >
            <span>⏱ Dòng thời gian</span>
          </button>
        </div>

        <div v-if="!running" class="flex items-center gap-2">
          <a
            v-if="handoffReviewUrl"
            :href="handoffReviewUrl"
            target="_blank"
            rel="noreferrer"
            class="cc-primary text-xs"
          >
            Open handoff in Hub ↗
          </a>
          <span
            v-if="isEpicContext && (epicSequenceRunning || epicFinalizing)"
            class="cc-button text-xs cursor-default"
          >
            CAO đang chạy xuyên Epic —
            {{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }}
          </span>
          <button
            v-else-if="task"
            class="cc-button text-xs"
            @click="showHandoff = !showHandoff"
          >
            Review & submit handoff
          </button>
          <button
            v-else
            class="cc-button text-xs"
            @click="$emit('open-hub')"
          >
            Open Hub for review
          </button>
        </div>
      </div>

      <!-- Handoff Submission Form -->
      <form
        v-if="
          showHandoff &&
          !(isEpicContext && (epicSequenceRunning || epicFinalizing))
        "
        class="mt-3 grid grid-cols-2 gap-2.5 rounded-xl bg-[#181411] border border-[#2a221b] p-3.5 text-xs"
        @submit.prevent="submit"
      >
        <textarea
          v-model="summary"
          class="cc-input col-span-2 min-h-16"
          placeholder="Tóm tắt kết quả bàn giao"
        ></textarea>
        <textarea
          v-model="changedFiles"
          class="cc-input min-h-16"
          placeholder="Danh sách tệp thay đổi (mỗi dòng 1 tệp)"
        ></textarea>
        <textarea
          v-model="tests"
          class="cc-input min-h-16"
          placeholder="Bằng chứng kiểm thử"
        ></textarea>
        <select v-model="testStatus" class="cc-select">
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
          class="cc-input"
          placeholder="Commit SHA"
        />
        <input
          v-model="pullRequestUrl"
          class="cc-input"
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
