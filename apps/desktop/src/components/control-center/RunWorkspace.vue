<script setup lang="ts">
import { computed, ref } from "vue";
import type { TaskItem } from "../../composables/useTaskSync";
import DangerousCommandBanner from "../DangerousCommandBanner.vue";
import type { SafetyInterceptEvent } from "../../utils/safetyGuardrails";
import {
  PROVIDER_MODELS,
  DEFAULT_PROVIDER_MODELS,
} from "../../constants/models";

export type Provider = "codex" | "claude_code" | "antigravity";
export type RunStatus =
  "idle" | "running" | "completed" | "failed" | "cancelled";
type ExecutionPolicy = "restricted" | "workspace_write" | "full_access";
type ApprovalRequest = {
  id: string;
  reason: string;
  requestedAt: string;
  recommendedPolicy: "workspace_write" | "full_access";
  diagnosticSummary?: string;
  diagnosticDetails?: string[];
};
const props = defineProps<{
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
}>();
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
const activeSubTab = ref<'terminal' | 'turns' | 'handoff'>('terminal');
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
  return null;
});
const canLaunch = computed(() =>
  Boolean(
    props.task &&
    props.workspace &&
    !props.running &&
    !props.epicSequenceRunning &&
    runnableStatus.value &&
    !executionBlock.value,
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
  // Source code can legitimately contain Error/Exception/throw. Only explicit
  // runtime diagnostics or non-zero command exits are warnings.
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
  const lines = allLines.length > MAX_LOG_LINES_TO_PARSE
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
      const lines = allLines.length > MAX_RENDERED_LINES_PER_GROUP
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
    tool: "text-violet-300 hover:text-violet-200",
    progress: "text-zinc-400 hover:text-zinc-200",
    thinking: "text-cyan-300 hover:text-cyan-200",
    warning: "text-amber-300 hover:text-amber-200",
    result: "text-emerald-300 hover:text-emerald-200",
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
  if (props.provider === "antigravity") {
    return {
      border: "border-orange-500/50",
      bg: "bg-[#18130f]/80",
      text: "text-orange-400",
      subText: "text-orange-500",
      highlight: "text-orange-300",
    };
  }
  if (props.provider === "claude_code") {
    return {
      border: "border-purple-500/50",
      bg: "bg-[#161219]/80",
      text: "text-purple-400",
      subText: "text-purple-500",
      highlight: "text-purple-300",
    };
  }
  return {
    border: "border-cyan-500/60",
    bg: "bg-[#121619]/80",
    text: "text-cyan-400",
    subText: "text-cyan-500",
    highlight: "text-cyan-300",
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
  if (props.executionPolicy === "full_access") return "Full access (Unrestricted)";
  if (props.executionPolicy === "workspace_write") return "Workspace write (Sandboxed)";
  return "Read only";
});

const permissionTone = computed(() => {
  if (props.executionPolicy === "full_access") return "text-amber-400 font-medium";
  if (props.executionPolicy === "workspace_write") return "text-emerald-400 font-medium";
  return "text-zinc-400";
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
  <section class="flex flex-1 flex-col overflow-hidden bg-[#12100e] select-none">
    <!-- Active Agent Header Banner (AgentsRoom style) -->
    <header class="flex items-center justify-between border-b border-[#251e18] bg-[#161310] px-5 py-2.5">
      <div class="flex items-center gap-3 min-w-0 flex-1 mr-3">
        <!-- Avatar with status dot -->
        <div class="relative shrink-0">
          <div
            class="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr text-white font-black text-xs shadow-md ring-2 ring-white/10"
            :class="
              task?.issue_type === 'epic'
                ? 'from-purple-600 via-indigo-700 to-purple-800 ring-purple-500/30'
                : task?.issue_type === 'story'
                  ? 'from-emerald-600 via-teal-700 to-emerald-800 ring-emerald-500/30'
                  : task?.issue_type === 'bug'
                    ? 'from-rose-600 via-red-700 to-rose-800 ring-rose-500/30'
                    : 'from-amber-600 via-orange-700 to-amber-800 ring-amber-500/30'
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
            :class="running ? 'bg-emerald-400 animate-pulse' : task ? 'bg-orange-500' : 'bg-zinc-600'"
          ></span>
        </div>

        <!-- Task Title & Tag -->
        <div class="min-w-0 flex-1 flex flex-col justify-center">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-sm font-bold text-zinc-100 truncate" :title="task ? task.title : 'Chưa chọn tác vụ'">
              {{ task ? task.title : 'Chưa chọn tác vụ' }}
            </h2>
            <span v-if="task?.priority === 'high'" class="shrink-0 grid h-4 px-1.5 place-items-center rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-bold">
              ƯU TIÊN
            </span>
          </div>

          <div class="flex items-center gap-2 mt-0.5 min-w-0">
            <span class="shrink-0 rounded-full bg-[#241d18] border border-[#3b2e24] px-2 py-0.2 text-[9px] font-bold tracking-wide uppercase text-orange-400">
              ● {{ task ? (task.issue_key || `#${task.id}`) : 'CHƯA CHỌN TASK' }}
            </span>
            <span class="shrink-0 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400">
              <span class="h-1.5 w-1.5 rounded-full" :class="workspace ? 'bg-emerald-400' : 'bg-amber-400'"></span>
              <span>{{ workspace ? (workspace.split(/[\\/]/).pop() || 'Workspace') : 'Chưa chọn thư mục' }}</span>
            </span>
            <span class="text-[10px] text-zinc-500 truncate hidden md:inline">
              {{ phase }} · {{ contextHealth === 'quiet' ? 'Quiet context' : 'Context healthy' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Header Controls: Model Selector, Timeline, Launch & Window Controls -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Model Selector Pill (AgentsRoom style: gpt-5.5 with purple dot) -->
        <div class="flex items-center gap-1 rounded-full bg-[#1e1915] border border-[#332a21] px-3 py-1 text-xs">
          <span class="h-2 w-2 rounded-full bg-purple-400"></span>
          <select
            :value="activeModelValue"
            class="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer"
            title="Select AI Model"
            @change="$emit('update:model', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="m in availableModels" :key="m.id" :value="m.id" class="bg-[#181411] text-zinc-200">
              {{ m.name }}
            </option>
          </select>
        </div>

        <!-- Provider Switcher -->
        <select
          :value="provider"
          class="hidden md:block rounded-full bg-[#1e1915] border border-[#332a21] px-2.5 py-1 text-xs font-medium text-zinc-300 focus:outline-none"
          @change="$emit('update:provider', ($event.target as HTMLSelectElement).value as Provider)"
        >
          <option value="codex" class="bg-[#181411]">Codex</option>
          <option value="claude_code" class="bg-[#181411]">Claude Code</option>
          <option value="antigravity" class="bg-[#181411]">Antigravity</option>
        </select>

        <!-- Execution Policy Selector -->
        <select
          :value="executionPolicy"
          class="hidden lg:block rounded-full bg-[#1e1915] border border-[#332a21] px-2.5 py-1 text-xs font-medium text-zinc-300 focus:outline-none"
          title="Execution permission"
          @change="$emit('update:executionPolicy', ($event.target as HTMLSelectElement).value as ExecutionPolicy)"
        >
          <option value="restricted" class="bg-[#181411]">Read only</option>
          <option value="workspace_write" class="bg-[#181411]">Workspace write</option>
          <option value="full_access" class="bg-[#181411]">Full access</option>
        </select>

        <button
          class="hidden sm:inline-flex cc-button text-xs"
          title="View E2E Activity and Audit Timeline"
          @click="$emit('timeline')"
        >
          ⏱ Timeline
        </button>

        <button class="hidden sm:inline-flex cc-button text-xs" @click="$emit('chooseWorkspace')">
          {{ workspace ? "Đổi thư mục" : "Chọn thư mục" }}
        </button>

        <!-- Launch / Run Button -->
        <button
          class="cc-primary text-xs"
          :disabled="!canLaunch"
          @click="$emit('launch')"
        >
          {{ isEpic ? "Run Epic sequence" : "Launch agent" }}
        </button>

        <!-- Header Actions: 3-dot, Expand, Close -->
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#251e18] hover:text-zinc-200 transition" title="More options">
          <i class="codicon codicon-kebab-vertical text-xs"></i>
        </button>
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#251e18] hover:text-zinc-200 transition" title="Toàn màn hình">
          <i class="codicon codicon-screen-full text-xs"></i>
        </button>
      </div>
    </header>

    <!-- Epic / Dependency / Safety Banners -->
    <div v-if="isEpic" class="px-5 pt-2 text-[11px] font-semibold text-violet-300">
      Epic sequence · {{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks completed · runs one task at a time<span v-if="epicAutoContinue">
        and starts the next task after each handoff; Hub review remains required.
      </span><!-- it never bypasses dependencies --><span v-else>
        and waits for Hub approval before continuing.
      </span>
    </div>

    <!-- Independent Review Banner -->
    <div
      v-if="autoReviewStatus && autoReviewStatus !== 'idle'"
      class="mx-5 mt-2 rounded-xl border px-3.5 py-2 text-xs"
      :class="
        autoReviewStatus === 'approved'
          ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200'
          : autoReviewStatus === 'reviewing'
            ? 'border-sky-700/70 bg-sky-950/30 text-sky-200'
            : 'border-amber-700/70 bg-amber-950/30 text-amber-200'
      "
    >
      <div class="flex items-center justify-between gap-3">
        <b>{{
          autoReviewStatus === "reviewing"
            ? `Independent review ${autoReviewIteration || 0}/${autoReviewMaxIterations || 0}`
            : autoReviewStatus === "approved"
              ? "Independent review approved"
              : autoReviewStatus === "changes_requested"
                ? "Reviewer requested changes"
                : autoReviewStatus === "max_iterations"
                  ? "Review limit reached"
                  : "Independent review failed"
        }}</b>
        <span v-if="reviewerProvider" class="text-[11px] opacity-80">
          {{ reviewerProvider === "claude_code" ? "Claude Code" : reviewerProvider === "antigravity" ? "Antigravity" : "Codex" }}
        </span>
      </div>
      <p v-if="autoReviewFeedback" class="mt-1 whitespace-pre-wrap leading-5 opacity-90">
        {{ autoReviewFeedback }}
      </p>
    </div>

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
      class="mx-5 mt-3 rounded-xl border border-rose-900/70 bg-rose-950/30 px-3.5 py-3 text-sm text-rose-200"
    >
      <div class="flex items-start justify-between gap-3">
        <span>{{ error }}</span>
        <button
          v-if="!approvalRequest"
          class="cc-button shrink-0"
          :disabled="diagnosticsLoading"
          @click="$emit('request-approval')"
        >
          {{ diagnosticsLoading ? "Checking…" : "Request human approval" }}
        </button>
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
          <li v-for="detail in approvalRequest.diagnosticDetails" :key="detail">
            {{ detail }}
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="cc-button" @click="$emit('approveRetry', 'workspace_write')">
            Approve workspace-write retry
          </button>
          <button class="cc-danger" @click="$emit('approveRetry', 'full_access')">
            Approve full-access retry
          </button>
          <button class="cc-button" @click="$emit('dismissApproval')">
            Decline
          </button>
        </div>
        <p class="mt-2 text-[11px] text-amber-100/60">
          Requested {{ approvalRequest.requestedAt }}. A full-access retry bypasses Codex sandbox and native approval prompts; it cannot repair a missing sandbox helper.
        </p>
      </div>
    </div>

    <!-- Main Workspace Content / Terminal Display -->
    <main class="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
      <!-- Terminal Frame (Dynamically adapted to active provider & model) -->
      <section
        class="rounded-2xl border bg-[#0e0c0b] p-4 shadow-lg transition-colors"
        :class="providerTone.border"
      >
        <!-- Terminal Header Box (Dynamic style based on Provider) -->
        <div
          class="rounded-xl border p-3.5 text-xs font-mono mb-4 max-w-xl shadow-md transition-all"
          :class="[providerTone.border, providerTone.bg, providerTone.text]"
        >
          <div class="font-bold text-sm flex items-center gap-1.5" :class="providerTone.text">
            <span>&gt;_</span>
            <span>{{ providerTitle }}</span>
            <span class="text-xs font-normal opacity-75">({{ providerVersion }})</span>
          </div>
          <div class="mt-2.5 space-y-1.5 text-[11px]">
            <div class="grid grid-cols-[100px_1fr] gap-2 items-center">
              <span class="text-zinc-400">model:</span>
              <span class="font-semibold" :class="providerTone.highlight">
                {{ displayModelName }}
              </span>
            </div>
            <div class="grid grid-cols-[100px_1fr] gap-2 items-center">
              <span class="text-zinc-400">directory:</span>
              <span class="text-zinc-200 truncate font-mono text-[10px]" :title="displayDirectory">{{ displayDirectory }}</span>
            </div>
            <div class="grid grid-cols-[100px_1fr] gap-2 items-center">
              <span class="text-zinc-400">permissions:</span>
              <span :class="permissionTone">{{ displayPermission }}</span>
            </div>
            <div v-if="task" class="grid grid-cols-[100px_1fr] gap-2 items-center">
              <span class="text-zinc-400">active task:</span>
              <span class="text-orange-300 font-semibold truncate">{{ task.issue_key || `#${task.id}` }}: {{ task.title }}</span>
            </div>
          </div>
        </div>

        <!-- Terminal Status & Environment Output -->
        <div class="font-mono text-xs text-zinc-400 space-y-2.5 leading-relaxed border-b border-[#221c17] pb-4 mb-4">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-emerald-400">
            <div class="flex items-center gap-1.5">
              <i class="codicon codicon-pass text-xs"></i>
              <span>Task Hub Protocol: <span class="font-bold">Đã sẵn sàng</span></span>
            </div>
            <span class="text-zinc-600 hidden sm:inline">•</span>
            <div class="flex items-center gap-1.5 text-sky-300">
              <i class="codicon codicon-server-process text-xs"></i>
              <span>CAO Orchestrator: <span class="font-bold" :class="caoAvailable ? 'text-sky-200' : 'text-amber-300'">{{ caoAvailable ? 'Sẵn sàng (CAO-first)' : 'Native fallback' }}</span></span>
            </div>
          </div>
          <p class="text-zinc-300 flex items-center gap-2">
            <span :class="providerTone.text">&gt;</span>
            <span class="font-semibold" :class="providerTone.highlight">{{ displayModelName }}</span>
            <span class="text-zinc-500">•</span>
            <span class="text-zinc-400">{{ displayDirectory.split(/[\\/]/).pop() || 'workspace' }}</span>
          </p>
        </div>

        <!-- Dynamic Agent Turns & Execution Logs -->
        <div class="space-y-4">
          <div class="flex items-center justify-between text-xs text-zinc-500 pb-1">
            <span>Hoạt động & Lượt phản hồi</span>
            <span
              class="inline-flex items-center gap-1.5 font-medium"
              :class="{
                'text-sky-400': runStatus === 'running',
                'text-emerald-400': runStatus === 'completed',
                'text-rose-400': runStatus === 'failed',
                'text-amber-400': runStatus === 'cancelled',
              }"
            >
              <i class="h-1.5 w-1.5 rounded-full bg-current"></i>
              {{ statusLabel }}
            </span>
          </div>

          <!-- Empty State or Live Execution Output -->
          <div v-if="!responseTurns.length" class="py-6 text-center text-xs text-zinc-500">
            <div v-if="running" class="inline-flex flex-col items-center gap-2">
              <span class="inline-flex items-center gap-2 font-medium text-sky-400 animate-pulse">
                <i class="h-2 w-2 rounded-full bg-sky-400"></i>Đang thực thi và streaming dữ liệu…
              </span>
              <span class="text-[11px] text-zinc-500">Dòng dữ liệu streaming sẽ hiển thị tại đây khi tiến trình output.</span>
            </div>
            <p v-else>Chưa có luồng thực thi mới. Nhập lệnh hoặc bấm Launch agent để bắt đầu.</p>
          </div>

          <!-- Response Turns Cards -->
          <div v-else class="space-y-4">
            <article
              v-for="(turn, index) in responseTurns"
              :key="index"
              class="rounded-xl border border-[#27201a] bg-[#16120f] p-3.5 space-y-2.5"
            >
              <div class="flex items-center justify-between gap-3 text-xs text-zinc-400 border-b border-[#241c16] pb-2">
                <span class="font-semibold flex items-center gap-1.5 text-zinc-200">
                  <span
                    class="h-2 w-2 rounded-full"
                    :class="{
                      'bg-sky-400 animate-pulse': turn.pending,
                      'bg-emerald-400': turn.outcome === 'completed',
                      'bg-rose-400': turn.outcome === 'failed',
                      'bg-amber-400': turn.outcome === 'cancelled',
                    }"
                  ></span>
                  <span>{{ responseLabel(turn) }}</span>
                </span>
                <span class="text-[11px] text-zinc-500">Step {{ index + 1 }}</span>
              </div>

              <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-100 bg-[#0e0c0a] p-3 rounded-lg border border-[#201914]">{{ turn.response }}</pre>

              <!-- Technical Details & Logs Disclosures -->
              <details
                v-if="turn.activity.length"
                :open="turn.pending || running"
                class="group mt-2"
              >
                <summary class="cursor-pointer list-none text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                  <span class="inline-block transition-transform group-open:rotate-90">›</span>
                  <span>{{ turnSummary(turn) }}</span>
                  <span class="ml-2 text-zinc-500 text-[11px]">View details</span>
                </summary>
                <div class="mt-2.5 space-y-2 border-l border-white/10 pl-3">
                  <details
                    v-for="group in activityGroups(turn)"
                    :key="group.kind"
                    :open="running"
                    class="group/nested"
                  >
                    <summary class="cursor-pointer list-none text-xs font-mono" :class="activityTone(group.kind)">
                      <span class="mr-1 inline-block transition-transform group-open/nested:rotate-90">›</span>
                      <span>{{ groupSummary(group) }}</span>
                    </summary>
                    <div class="mt-2 space-y-1 border-l border-white/10 pl-3">
                      <details
                        v-for="(line, lineIndex) in group.lines"
                        :key="lineIndex"
                        :open="running && lineIndex === group.lines.length - 1"
                        class="group/line"
                      >
                        <summary class="cursor-pointer list-none truncate font-mono text-[11px] text-zinc-500 hover:text-zinc-300">
                          <span class="mr-1 inline-block transition-transform group-open/line:rotate-90">›</span>
                          <span>{{ line }}</span>
                        </summary>
                        <pre class="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2.5 font-mono text-[11px] leading-5 text-zinc-300 border border-white/5">{{ line }}</pre>
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
      <div class="rounded-xl border border-amber-600/30 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-200 flex items-start gap-2.5">
        <i class="codicon codicon-info text-amber-400 mt-0.5 shrink-0"></i>
        <p class="leading-5 text-[11px]">
          Chưa gửi: tác vụ này chưa từng khởi động nên terminal chỉ là một shell. Hãy hoàn tất phần cài đặt hiển thị phía trên, khởi động tác vụ rồi gửi lại. Tin nhắn của bạn vẫn được giữ.
        </p>
      </div>
    </main>

    <!-- Floating Command Input Bar & Sub-Tabs Footer -->
    <footer class="border-t border-[#251e18] bg-[#14110f] px-5 py-3 space-y-2.5">
      <!-- Rich Input Box (Large rounded-2xl container) -->
      <div class="rounded-2xl border border-[#2d251e] bg-[#191512] p-3 shadow-lg focus-within:border-orange-500/80 focus-within:ring-1 focus-within:ring-orange-500/40 transition-all">
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
          @keyup.enter="followUp && ($emit('send', followUp), (followUp = ''))"
        ></textarea>

        <!-- Command Toolbar & Action Pill -->
        <div class="mt-2 flex items-center justify-between pt-1 border-t border-[#251e18]">
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
              @click="insertSnippet(task?.issue_key ? `@${task.issue_key} ` : '@task ')"
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
            <div class="flex items-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 p-0.5 shadow-[0_0_14px_rgba(249,115,22,0.4)] hover:shadow-[0_0_18px_rgba(249,115,22,0.55)] transition">
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
                @click="followUp ? ($emit('send', followUp), (followUp = '')) : canLaunch ? $emit('launch') : null"
              >
                <i class="codicon codicon-send text-xs"></i>
              </button>
            </div>

            <!-- Cancel Button if Running -->
            <button v-if="running" class="cc-danger text-xs" @click="$emit('cancel')">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Sub-Tabs Toolbar: Terminal, Lượt phản hồi, Bàn giao, Dòng thời gian -->
      <div class="flex items-center justify-between text-xs pt-1">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition"
            :class="activeSubTab === 'terminal' ? 'bg-[#241d18] border border-orange-500/40 text-orange-400 shadow-sm' : 'bg-[#181411] border border-[#2b231c] text-zinc-400 hover:text-zinc-200'"
            @click="activeSubTab = 'terminal'"
          >
            <span>>_ Luồng Terminal</span>
          </button>
          <button
            class="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition"
            :class="activeSubTab === 'turns' ? 'bg-[#241d18] border border-orange-500/40 text-orange-400 shadow-sm' : 'bg-[#181411] border border-[#2b231c] text-zinc-400 hover:text-zinc-200'"
            @click="activeSubTab = 'turns'"
          >
            <span>💬 Lượt phản hồi ({{ responseTurns.length }})</span>
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
          <button
            v-if="task"
            class="cc-button text-xs"
            @click="showHandoff = !showHandoff"
          >
            Review & submit handoff
          </button>
          <button v-else class="cc-button text-xs" @click="$emit('open-hub')">
            Open Hub for review
          </button>
        </div>
      </div>

      <!-- Handoff Submission Form -->
      <form
        v-if="showHandoff"
        class="mt-3 grid grid-cols-2 gap-2.5 rounded-xl bg-[#181411] border border-[#2a221b] p-3.5 text-xs"
        @submit.prevent="submit"
      >
        <textarea v-model="summary" class="cc-input col-span-2 min-h-16" placeholder="Tóm tắt kết quả bàn giao"></textarea>
        <textarea v-model="changedFiles" class="cc-input min-h-16" placeholder="Danh sách tệp thay đổi (mỗi dòng 1 tệp)"></textarea>
        <textarea v-model="tests" class="cc-input min-h-16" placeholder="Bằng chứng kiểm thử"></textarea>
        <select v-model="testStatus" class="cc-select">
          <option value="passed">Đã vượt qua (Passed)</option>
          <option value="failed">Thất bại (Failed)</option>
          <option value="skipped">Bỏ qua (Skipped)</option>
        </select>
        <input v-model="testSummary" class="cc-input" placeholder="Tóm tắt kiểm thử" />
        <input v-model="commitSha" class="cc-input" placeholder="Commit SHA" />
        <input v-model="pullRequestUrl" class="cc-input" placeholder="Pull request URL" />
        <textarea v-model="blockers" class="cc-input col-span-2 min-h-12" placeholder="Các vướng mắc (nếu có)"></textarea>
        <div class="col-span-2 flex justify-end gap-2 mt-1">
          <button type="button" class="cc-button" @click="showHandoff = false">Hủy</button>
          <button class="cc-primary">Gửi lên Hub</button>
        </div>
      </form>
    </footer>

    <!-- Epic Review Reopen Footer Note -->
    <div
      v-if="task?.issue_type === 'epic' && task.status === 'review'"
      class="border-t border-amber-700/50 bg-amber-950/20 px-5 py-2.5"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100">
        <span>Epic đang ở Review. Đưa về To do để chạy lại sequence.</span>
        <button class="cc-button shrink-0" @click="$emit('reopen-todo')">
          Reopen as To do
        </button>
      </div>
    </div>
  </section>
</template>
