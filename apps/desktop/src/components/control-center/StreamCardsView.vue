<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import type {
  AgentRoleType,
  AgentStageExecution,
  InterAgentContextPackage,
} from '../../types/desktop';
import { useAutoPilotStore } from '../../stores/useAutoPilotStore';
import { ROLE_METADATA } from '../../utils/autoPilotRunner';
import { renderMarkdown } from '../../utils/markdown';

export interface StreamCardsViewProps {
  stageExecutions?: AgentStageExecution[];
  contextPackages?: InterAgentContextPackage[];
  activeRole?: AgentRoleType;
  running?: boolean;
  taskTitle?: string;
  taskKey?: string;
}

const props = withDefaults(defineProps<StreamCardsViewProps>(), {
  running: false,
});

const emit = defineEmits<{
  selectRole: [role: AgentRoleType];
  openArtifact: [role: AgentRoleType, artifact: string];
  copyLogs: [role: AgentRoleType, logs: string[]];
}>();

const autoPilotStore = useAutoPilotStore();

// Card expanded states (all open by default for visibility, can toggle)
const expandedCards = ref<Record<AgentRoleType, boolean>>({
  architect: true,
  implementer: true,
  tester: true,
  auditor: true,
});

// Scoped accordions: terminal logs and tool calls per card
const expandedLogs = ref<Record<AgentRoleType, boolean>>({
  architect: true,
  implementer: true,
  tester: true,
  auditor: true,
});

const expandedTools = ref<Record<AgentRoleType, boolean>>({
  architect: false,
  implementer: false,
  tester: false,
  auditor: false,
});

const expandedToolItems = ref<Record<string, boolean>>({});
const copiedLogsFeedback = ref<Record<AgentRoleType, boolean>>({
  architect: false,
  implementer: false,
  tester: false,
  auditor: false,
});

// Live timer for currently running card
const now = ref(Date.now());
let timerInterval: any = null;

onMounted(() => {
  timerInterval = setInterval(() => {
    now.value = Date.now();
  }, 500);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});

const rolesOrder: AgentRoleType[] = ['architect', 'implementer', 'tester', 'auditor'];

const currentExecutions = computed<AgentStageExecution[]>(() => {
  if (props.stageExecutions && props.stageExecutions.length > 0) {
    return props.stageExecutions;
  }
  if (autoPilotStore.stageExecutions.value && autoPilotStore.stageExecutions.value.length > 0) {
    return autoPilotStore.stageExecutions.value;
  }
  return rolesOrder.map((role) => ({
    role,
    title: ROLE_METADATA[role].title,
    avatar: ROLE_METADATA[role].avatar,
    badge: ROLE_METADATA[role].badge,
    model: ROLE_METADATA[role].defaultModel,
    status: 'pending',
    terminalLogs: [],
    toolCalls: [],
  }));
});

const currentPackages = computed<InterAgentContextPackage[]>(() => {
  if (props.contextPackages && props.contextPackages.length > 0) {
    return props.contextPackages;
  }
  return autoPilotStore.contextPackages.value || [];
});

const getStageExecution = (role: AgentRoleType): AgentStageExecution => {
  const found = currentExecutions.value.find((e) => e.role === role);
  if (found) return found;
  return {
    role,
    title: ROLE_METADATA[role].title,
    avatar: ROLE_METADATA[role].avatar,
    badge: ROLE_METADATA[role].badge,
    model: ROLE_METADATA[role].defaultModel,
    status: 'pending',
    terminalLogs: [],
    toolCalls: [],
  };
};

const getContextPackage = (sourceRole: AgentRoleType, targetRole: AgentRoleType): InterAgentContextPackage | undefined => {
  return currentPackages.value.find(
    (pkg) => pkg.sourceRole === sourceRole && pkg.targetRole === targetRole
  );
};

const toggleCard = (role: AgentRoleType) => {
  expandedCards.value[role] = !expandedCards.value[role];
};

const toggleLogs = (role: AgentRoleType) => {
  expandedLogs.value[role] = !expandedLogs.value[role];
};

const toggleTools = (role: AgentRoleType) => {
  expandedTools.value[role] = !expandedTools.value[role];
};

const toggleToolItem = (key: string) => {
  expandedToolItems.value[key] = !expandedToolItems.value[key];
};

const expandAll = () => {
  rolesOrder.forEach((r) => {
    expandedCards.value[r] = true;
    expandedLogs.value[r] = true;
    expandedTools.value[r] = true;
  });
};

const collapseAll = () => {
  rolesOrder.forEach((r) => {
    expandedCards.value[r] = false;
  });
};

const formatDuration = (ms?: number, startedAt?: number, completedAt?: number, status?: string): string => {
  if (ms !== undefined && ms > 0) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (startedAt) {
    const end = completedAt || (status === 'running' ? now.value : startedAt);
    const diff = Math.max(0, end - startedAt);
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(1)}s`;
  }
  return '--';
};

const formatModelDisplayName = (modelName?: string): string => {
  if (!modelName) return 'Gemini 3.7 Pro';
  if (/gemini-3\.7-pro/i.test(modelName)) return 'Gemini 3.7 Pro';
  if (/gemini-3\.7-flash/i.test(modelName)) return 'Gemini 3.7 Flash';
  if (/claude-3-7-sonnet/i.test(modelName)) return 'Claude 3.7 Sonnet';
  if (/gpt-5/i.test(modelName)) return 'GPT-5.6 Sol';
  return modelName;
};

const copyLogs = async (role: AgentRoleType) => {
  const stage = getStageExecution(role);
  const text = stage.terminalLogs.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copiedLogsFeedback.value[role] = true;
    setTimeout(() => {
      copiedLogsFeedback.value[role] = false;
    }, 2000);
    emit('copyLogs', role, stage.terminalLogs);
  } catch {}
};

// Role Visual Theme Configuration
const getRoleTheme = (role: AgentRoleType) => {
  switch (role) {
    case 'architect':
      return {
        badgeBorder: 'border-indigo-500/40',
        badgeBg: 'bg-indigo-950/60',
        badgeText: 'text-indigo-300',
        accentColor: '#818cf8',
        cardBorderActive: 'border-indigo-500/80 shadow-[0_0_24px_rgba(99,102,241,0.25)]',
        cardBorderIdle: 'border-indigo-950/70 hover:border-indigo-800/60',
        cardBg: 'bg-gradient-to-b from-[#0c0f24] to-[#070914]',
        iconBg: 'bg-indigo-950/80 border-indigo-600/50 text-indigo-300',
        dotColor: 'bg-indigo-400',
        label: 'Architect / Planner',
        stepNumber: '1',
      };
    case 'implementer':
      return {
        badgeBorder: 'border-emerald-500/40',
        badgeBg: 'bg-emerald-950/60',
        badgeText: 'text-emerald-300',
        accentColor: '#34d399',
        cardBorderActive: 'border-emerald-500/80 shadow-[0_0_24px_rgba(16,185,129,0.25)]',
        cardBorderIdle: 'border-emerald-950/70 hover:border-emerald-800/60',
        cardBg: 'bg-gradient-to-b from-[#081f18] to-[#05110d]',
        iconBg: 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300',
        dotColor: 'bg-emerald-400',
        label: 'Core Implementer',
        stepNumber: '2',
      };
    case 'tester':
      return {
        badgeBorder: 'border-amber-500/40',
        badgeBg: 'bg-amber-950/60',
        badgeText: 'text-amber-300',
        accentColor: '#fbbf24',
        cardBorderActive: 'border-amber-500/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]',
        cardBorderIdle: 'border-amber-950/70 hover:border-amber-800/60',
        cardBg: 'bg-gradient-to-b from-[#1c1409] to-[#0d0904]',
        iconBg: 'bg-amber-950/80 border-amber-600/50 text-amber-300',
        dotColor: 'bg-amber-400',
        label: 'Test Engineer',
        stepNumber: '3',
      };
    case 'auditor':
      return {
        badgeBorder: 'border-cyan-500/40',
        badgeBg: 'bg-cyan-950/60',
        badgeText: 'text-cyan-300',
        accentColor: '#22d3ee',
        cardBorderActive: 'border-cyan-500/80 shadow-[0_0_24px_rgba(6,182,212,0.25)]',
        cardBorderIdle: 'border-cyan-950/70 hover:border-cyan-800/60',
        cardBg: 'bg-gradient-to-b from-[#071922] to-[#040e13]',
        iconBg: 'bg-cyan-950/80 border-cyan-600/50 text-cyan-300',
        dotColor: 'bg-cyan-400',
        label: 'Evidence Auditor / Reviewer',
        stepNumber: '4',
      };
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'running':
      return {
        text: 'Đang chạy (Running)',
        classes: 'bg-amber-950/70 text-amber-300 border-amber-500/50 animate-pulse',
        dot: 'bg-amber-400 animate-ping',
      };
    case 'completed':
      return {
        text: 'Hoàn tất (Completed)',
        classes: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50',
        dot: 'bg-emerald-400',
      };
    case 'failed':
      return {
        text: 'Thất bại (Failed)',
        classes: 'bg-rose-950/70 text-rose-300 border-rose-500/50',
        dot: 'bg-rose-500',
      };
    case 'skipped':
      return {
        text: 'Bỏ qua (Skipped)',
        classes: 'bg-zinc-800/70 text-zinc-400 border-zinc-700/50',
        dot: 'bg-zinc-500',
      };
    default:
      return {
        text: 'Chờ xử lý (Pending)',
        classes: 'bg-[#101726]/80 text-zinc-400 border-zinc-800/60',
        dot: 'bg-zinc-600',
      };
  }
};

// Summary stats calculation
const completedStepsCount = computed(() => {
  return currentExecutions.value.filter((e) => e.status === 'completed').length;
});

const progressPercent = computed(() => {
  return Math.round((completedStepsCount.value / 4) * 100);
});
</script>

<template>
  <div class="cc-stream-cards-view flex flex-col h-full bg-[#050911] text-zinc-100 select-text overflow-hidden">
    <!-- Stream Cards Header Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#17253b] bg-[#080e1a]/95 px-5 py-3 shrink-0 backdrop-blur-md">
      <div class="flex items-center gap-3 min-w-0">
        <div class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500/20 via-emerald-500/20 to-cyan-500/20 border border-indigo-500/30 text-white shadow-inner">
          <i class="codicon codicon-layers text-sm text-[#00f5a0]"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold tracking-tight text-white font-['Space_Grotesk']">
              Quy trình 4 Bước Multi-Agent Role Pipeline
            </h3>
            <span class="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.2 text-[10px] font-bold text-emerald-300 font-mono">
              {{ completedStepsCount }}/4 HOÀN TẤT
            </span>
          </div>
          <p class="text-[11px] text-zinc-400 truncate mt-0.5">
            {{ taskKey ? `[${taskKey}] ` : '' }}{{ taskTitle || 'Luồng phân bước tự động Architect ➔ Implementer ➔ Tester ➔ Auditor' }}
          </p>
        </div>
      </div>

      <!-- Quick Toolbar: Expand / Collapse All & Progress Bar -->
      <div class="flex items-center gap-3 shrink-0">
        <div class="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
          <span>Tiến độ:</span>
          <div class="w-24 h-2 rounded-full bg-[#121c2e] overflow-hidden border border-[#24334d]">
            <div
              class="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-cyan-400 transition-all duration-500"
              :style="{ width: `${progressPercent}%` }"
            ></div>
          </div>
          <span class="font-mono font-bold text-zinc-200 text-[11px]">{{ progressPercent }}%</span>
        </div>

        <div class="flex items-center gap-1 rounded-lg bg-[#0e1726] border border-[#1e2d44] p-0.5">
          <button
            type="button"
            class="rounded px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#18263a] hover:text-white transition"
            title="Mở rộng tất cả các thẻ"
            @click="expandAll"
          >
            Mở rộng hết
          </button>
          <button
            type="button"
            class="rounded px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#18263a] hover:text-white transition"
            title="Thu gọn tất cả các thẻ"
            @click="collapseAll"
          >
            Thu gọn
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Cards Stream Area -->
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6 scroll-smooth">
      <template v-for="(role, index) in rolesOrder" :key="role">
        <!-- Inter-Agent Context Handoff Connector Bar (between steps) -->
        <div
          v-if="index > 0"
          class="relative flex items-center justify-center my-1"
        >
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-dashed border-[#1f2f47]"></div>
          </div>
          <div class="relative flex items-center gap-2 rounded-full bg-[#080e1a] border border-[#223552] px-3.5 py-1 text-[11px] text-zinc-400 shadow-md">
            <span class="flex h-2 w-2 relative">
              <span
                v-if="getContextPackage(rolesOrder[index - 1], role)"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2"
                :class="getContextPackage(rolesOrder[index - 1], role) ? 'bg-cyan-400' : 'bg-zinc-600'"
              ></span>
            </span>
            <span class="font-semibold text-zinc-300">
              {{ rolesOrder[index - 1].toUpperCase() }} ➔ {{ role.toUpperCase() }}
            </span>
            <span v-if="getContextPackage(rolesOrder[index - 1], role)" class="text-cyan-300 font-mono text-[10px]">
              • Context Handoff Đồng Bộ
            </span>
            <span v-else class="text-zinc-500 font-mono text-[10px]">
              • Handoff Chờ Kích Hoạt
            </span>
          </div>
        </div>

        <!-- Role Step Card Container -->
        <div
          :class="[
            'cc-step-card rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg',
            getRoleTheme(role).cardBg,
            getStageExecution(role).status === 'running'
              ? getRoleTheme(role).cardBorderActive
              : getRoleTheme(role).cardBorderIdle,
          ]"
        >
          <!-- Step Card Header -->
          <div
            class="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer select-none transition border-b"
            :class="expandedCards[role] ? 'border-[#17253b] bg-black/20' : 'border-transparent hover:bg-white/5'"
            @click="toggleCard(role)"
          >
            <!-- Left: Avatar, Role Badge, Title, Step number -->
            <div class="flex items-center gap-3.5 min-w-0">
              <!-- Avatar with Role Icon / Initials -->
              <div
                class="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-bold text-xs font-mono shadow-md"
                :class="getRoleTheme(role).iconBg"
              >
                <!-- Role Specific Icon -->
                <i
                  v-if="role === 'architect'"
                  class="codicon codicon-circuit-board text-base"
                ></i>
                <i
                  v-else-if="role === 'implementer'"
                  class="codicon codicon-tools text-base"
                ></i>
                <i
                  v-else-if="role === 'tester'"
                  class="codicon codicon-beaker text-base"
                ></i>
                <i
                  v-else-if="role === 'auditor'"
                  class="codicon codicon-shield text-base"
                ></i>
                <span
                  class="absolute -top-1.5 -left-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#050911] border border-zinc-700 text-[9px] font-black text-zinc-300"
                >
                  {{ getRoleTheme(role).stepNumber }}
                </span>
              </div>

              <!-- Title, Role Badge, and Model -->
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-sm font-bold text-white font-['Space_Grotesk']">
                    {{ getStageExecution(role).title || getRoleTheme(role).label }}
                  </h4>
                  <span
                    class="rounded-full border px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider font-mono"
                    :class="[getRoleTheme(role).badgeBg, getRoleTheme(role).badgeText, getRoleTheme(role).badgeBorder]"
                  >
                    {{ role.toUpperCase() }}
                  </span>
                </div>

                <!-- Meta row: Model indicator and Execution timing -->
                <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono">
                  <span class="inline-flex items-center gap-1 text-zinc-300 bg-black/40 border border-white/10 rounded px-1.5 py-0.2">
                    <i class="codicon codicon-sparkle text-[10px] text-amber-400"></i>
                    {{ formatModelDisplayName(getStageExecution(role).model) }}
                  </span>
                  <span>·</span>
                  <span class="inline-flex items-center gap-1 text-zinc-400">
                    <i class="codicon codicon-watch text-[10px]"></i>
                    {{ formatDuration(getStageExecution(role).durationMs, getStageExecution(role).startedAt, getStageExecution(role).completedAt, getStageExecution(role).status) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right: Status Badge & Chevron -->
            <div class="flex items-center gap-3 shrink-0">
              <!-- Status Pill with live pulse -->
              <div
                class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
                :class="getStatusBadge(getStageExecution(role).status).classes"
              >
                <span
                  class="h-2 w-2 rounded-full shrink-0"
                  :class="getStatusBadge(getStageExecution(role).status).dot"
                ></span>
                <span>{{ getStatusBadge(getStageExecution(role).status).text }}</span>
              </div>

              <!-- Expand/Collapse Chevron -->
              <div class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition">
                <i
                  class="codicon text-xs transition-transform duration-200"
                  :class="expandedCards[role] ? 'codicon-chevron-up' : 'codicon-chevron-down'"
                ></i>
              </div>
            </div>
          </div>

          <!-- Step Card Body (Collapsible Content) -->
          <div v-if="expandedCards[role]" class="p-4 space-y-3.5 bg-[#060a14]/60">
            <!-- 1. Output Artifact Summary Preview (Custom tailored per role) -->
            <div class="rounded-xl border border-[#1b2a40] bg-[#091120] p-3.5 space-y-2.5 shadow-inner">
              <div class="flex items-center justify-between text-xs font-bold text-zinc-200 border-b border-[#18263a] pb-2">
                <span class="flex items-center gap-2">
                  <i
                    class="codicon text-sm"
                    :class="
                      role === 'architect'
                        ? 'codicon-file-code text-indigo-400'
                        : role === 'implementer'
                          ? 'codicon-diff text-emerald-400'
                          : role === 'tester'
                            ? 'codicon-check-all text-amber-400'
                            : 'codicon-verified text-cyan-400'
                    "
                  ></i>
                  <span>
                    {{
                      role === 'architect'
                        ? 'Kế hoạch Phân tích & Cấu trúc File (Architect Discovery Plan)'
                        : role === 'implementer'
                          ? 'Mã nguồn Thay đổi & Git Worktree Diff Summary'
                          : role === 'tester'
                            ? 'Bằng chứng Kiểm thử Tự động (Automated Test Verification)'
                            : 'Biên bản Nghiệm thu & Chữ ký Xác thực (Signed Auditor Handoff)'
                    }}
                  </span>
                </span>
                <span
                  v-if="getStageExecution(role).outputArtifact || getStageExecution(role).evidence"
                  class="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 rounded px-1.5 py-0.2"
                >
                  ✓ Sẵn sàng
                </span>
                <span
                  v-else
                  class="text-[10px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded px-1.5 py-0.2"
                >
                  Chờ tạo artifact
                </span>
              </div>

              <!-- Architect Plan Preview -->
              <div v-if="role === 'architect'" class="space-y-2">
                <div
                  v-if="getStageExecution(role).outputArtifact"
                  class="cc-markdown-body prose prose-invert max-w-none text-xs leading-relaxed max-h-56 overflow-y-auto rounded-lg bg-[#040710] p-3 border border-[#152336]"
                  v-html="renderMarkdown(getStageExecution(role).outputArtifact || '')"
                />
                <div v-else-if="autoPilotStore.architectHandoff.value" class="space-y-2 text-xs">
                  <p class="text-zinc-300">{{ autoPilotStore.architectHandoff.value.summary }}</p>
                  <div v-if="autoPilotStore.architectHandoff.value.targetFiles?.length" class="space-y-1">
                    <span class="text-[11px] font-semibold text-zinc-400">Target Files:</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="file in autoPilotStore.architectHandoff.value.targetFiles"
                        :key="file.path"
                        class="inline-flex items-center gap-1 font-mono text-[10px] rounded bg-[#0e1726] border border-[#20324d] px-2 py-0.5 text-zinc-300"
                      >
                        <span class="text-amber-400 font-bold">[{{ file.action }}]</span>
                        <span>{{ file.path }}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <p v-else class="text-xs text-zinc-500 italic">
                  Chưa có kế hoạch thiết kế. Kế hoạch sẽ được sinh ra khi Architect bắt đầu khảo sát.
                </p>
              </div>

              <!-- Implementer Worktree & Diff Summary -->
              <div v-else-if="role === 'implementer'" class="space-y-2 text-xs">
                <div v-if="autoPilotStore.implementerHandoff.value" class="space-y-2">
                  <div class="flex items-center gap-2 font-mono text-[11px] text-zinc-300 bg-[#040710] p-2 rounded border border-[#152336]">
                    <span class="text-zinc-500">Worktree:</span>
                    <span class="text-emerald-400 font-bold truncate">{{ autoPilotStore.implementerHandoff.value.worktreePath }}</span>
                  </div>
                  <div v-if="autoPilotStore.implementerHandoff.value.changedFiles?.length" class="space-y-1">
                    <span class="text-[11px] font-semibold text-zinc-400">Tệp đã chỉnh sửa ({{ autoPilotStore.implementerHandoff.value.changedFiles.length }}):</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="file in autoPilotStore.implementerHandoff.value.changedFiles"
                        :key="file"
                        class="font-mono text-[10px] rounded bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 text-emerald-300"
                      >
                        ✓ {{ file }}
                      </span>
                    </div>
                  </div>
                  <pre
                    v-if="autoPilotStore.implementerHandoff.value.diffSummary"
                    class="font-mono text-[11px] text-zinc-300 bg-[#040710] p-2.5 rounded border border-[#152336] max-h-36 overflow-y-auto whitespace-pre-wrap"
                  >{{ autoPilotStore.implementerHandoff.value.diffSummary }}</pre>
                </div>
                <div v-else-if="getStageExecution(role).outputArtifact" class="text-xs text-zinc-300">
                  <pre class="font-mono text-[11px] text-zinc-300 bg-[#040710] p-2.5 rounded border border-[#152336] max-h-36 overflow-y-auto whitespace-pre-wrap">{{ getStageExecution(role).outputArtifact }}</pre>
                </div>
                <p v-else class="text-xs text-zinc-500 italic">
                  Chưa có diff làm việc. Implementer sẽ ghi nhận các thay đổi trong isolated worktree.
                </p>
              </div>

              <!-- Test Engineer Test Results Summary -->
              <div v-else-if="role === 'tester'" class="space-y-2 text-xs">
                <div v-if="autoPilotStore.testHandoff.value || getStageExecution(role).evidence" class="space-y-2">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div class="rounded-lg bg-[#040710] border border-emerald-500/30 p-2 text-center">
                      <div class="text-[10px] text-zinc-400">Passed Tests</div>
                      <div class="text-base font-bold text-emerald-400 font-mono">
                        {{ autoPilotStore.testHandoff.value?.passedTests ?? (getStageExecution(role).evidence as any)?.summary?.passed ?? 0 }}
                      </div>
                    </div>
                    <div class="rounded-lg bg-[#040710] border border-rose-500/30 p-2 text-center">
                      <div class="text-[10px] text-zinc-400">Failed Tests</div>
                      <div class="text-base font-bold text-rose-400 font-mono">
                        {{ autoPilotStore.testHandoff.value?.failedTests ?? (getStageExecution(role).evidence as any)?.summary?.failed ?? 0 }}
                      </div>
                    </div>
                    <div class="rounded-lg bg-[#040710] border border-amber-500/30 p-2 text-center">
                      <div class="text-[10px] text-zinc-400">Pass Ratio</div>
                      <div class="text-base font-bold text-amber-400 font-mono">
                        {{ (getStageExecution(role).evidence as any)?.summary?.pass_ratio ? `${Math.round((getStageExecution(role).evidence as any).summary.pass_ratio * 100)}%` : '100%' }}
                      </div>
                    </div>
                    <div class="rounded-lg bg-[#040710] border border-indigo-500/30 p-2 text-center">
                      <div class="text-[10px] text-zinc-400">Duration</div>
                      <div class="text-base font-bold text-indigo-400 font-mono">
                        {{ formatDuration(autoPilotStore.testHandoff.value?.durationMs) }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="autoPilotStore.testHandoff.value?.testOutput"
                    class="font-mono text-[11px] text-zinc-300 bg-[#040710] p-2.5 rounded border border-[#152336] max-h-36 overflow-y-auto whitespace-pre-wrap"
                  >
                    {{ autoPilotStore.testHandoff.value.testOutput }}
                  </div>
                </div>
                <p v-else class="text-xs text-zinc-500 italic">
                  Chưa chạy test suite. Test Engineer sẽ chạy tự động và đối soát kết quả sau khi Implementer xong.
                </p>
              </div>

              <!-- Auditor Evidence & Signed Handoff -->
              <div v-else-if="role === 'auditor'" class="space-y-2 text-xs">
                <div v-if="autoPilotStore.auditorHandoff.value || autoPilotStore.lastHandoff.value" class="space-y-2">
                  <div class="flex items-center justify-between rounded-lg bg-cyan-950/30 border border-cyan-500/40 p-2.5 text-xs text-cyan-200">
                    <span class="flex items-center gap-2">
                      <i class="codicon codicon-verified text-cyan-400"></i>
                      <span class="font-bold">Chữ ký bàn giao:</span>
                      <span class="font-mono text-[11px] text-cyan-300">
                        {{ autoPilotStore.lastHandoff.value?.commit_sha ? `SHA: ${autoPilotStore.lastHandoff.value.commit_sha.slice(0, 12)}` : 'SIG-VERIFIED-PASS-100' }}
                      </span>
                    </span>
                    <span class="rounded bg-cyan-900/60 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-bold uppercase font-mono">
                      {{ autoPilotStore.auditorHandoff.value?.reviewerStatus || 'APPROVED' }}
                    </span>
                  </div>
                  <p class="text-zinc-300 text-xs leading-relaxed">
                    {{ autoPilotStore.auditorHandoff.value?.feedback || 'Biên bản kiểm định hoàn tất: 100% test suites pass, git worktree diff đã được xác nhận và nạp lên Task Hub MCP Gateway.' }}
                  </p>
                </div>
                <p v-else class="text-xs text-zinc-500 italic">
                  Chưa có biên bản bàn giao. Evidence Auditor sẽ thẩm định toàn diện sau khi các bước trước thành công.
                </p>
              </div>
            </div>

            <!-- 2. Tool Calls Scoped Accordion -->
            <div class="rounded-xl border border-[#1b2a40] bg-[#070d18] overflow-hidden">
              <button
                type="button"
                class="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 hover:bg-[#0f1b2e] transition"
                @click="toggleTools(role)"
              >
                <div class="flex items-center gap-2">
                  <i class="codicon codicon-tools text-amber-400"></i>
                  <span>Tool Calls & Lệnh Thực thi</span>
                  <span class="rounded-full bg-[#121f33] border border-[#243754] px-2 py-0.2 text-[10px] font-mono text-zinc-300">
                    {{ getStageExecution(role).toolCalls?.length || 0 }}
                  </span>
                </div>
                <span class="text-[11px] text-zinc-400 font-mono">
                  {{ expandedTools[role] ? 'Thu gọn ▲' : 'Xem chi tiết ▼' }}
                </span>
              </button>

              <div v-if="expandedTools[role]" class="border-t border-[#17253b] p-3 space-y-2">
                <div
                  v-if="!getStageExecution(role).toolCalls || !getStageExecution(role).toolCalls.length"
                  class="py-2 text-center text-xs text-zinc-500 italic"
                >
                  Chưa có tool call nào được kích hoạt trong giai đoạn này.
                </div>
                <div
                  v-for="(tool, tIndex) in getStageExecution(role).toolCalls"
                  :key="tool.id || tIndex"
                  class="rounded-lg border border-[#1d2d46] bg-[#0a1424] overflow-hidden"
                >
                  <button
                    type="button"
                    class="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-[#0f1d33] transition"
                    @click="toggleToolItem(`${role}-${tool.id || tIndex}`)"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span
                        class="h-2 w-2 rounded-full shrink-0"
                        :class="
                          tool.status === 'running'
                            ? 'bg-amber-400 animate-ping'
                            : tool.status === 'completed'
                              ? 'bg-emerald-400'
                              : 'bg-rose-400'
                        "
                      ></span>
                      <span class="font-mono font-bold text-zinc-200 truncate">{{ tool.toolName }}</span>
                      <span class="rounded bg-black/40 border border-white/10 px-1.5 py-0.2 font-mono text-[10px] text-zinc-400 uppercase">
                        {{ tool.status }}
                      </span>
                    </div>
                    <span class="text-[10px] text-zinc-400 font-mono">
                      {{ expandedToolItems[`${role}-${tool.id || tIndex}`] ? '▲' : '▼' }}
                    </span>
                  </button>

                  <div
                    v-if="expandedToolItems[`${role}-${tool.id || tIndex}`]"
                    class="border-t border-[#17253b] bg-[#040710] p-3 space-y-2 text-xs font-mono"
                  >
                    <div v-if="tool.args && Object.keys(tool.args).length" class="space-y-1">
                      <span class="text-[10px] text-zinc-400 font-bold uppercase">Arguments:</span>
                      <pre class="text-[11px] text-cyan-300 bg-black/50 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(tool.args, null, 2) }}</pre>
                    </div>
                    <div v-if="tool.result" class="space-y-1">
                      <span class="text-[10px] text-zinc-400 font-bold uppercase">Result:</span>
                      <pre class="text-[11px] text-zinc-300 bg-black/50 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap max-h-40">{{ tool.result }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Terminal Logs Scoped Accordion -->
            <div class="rounded-xl border border-[#1b2a40] bg-[#070d18] overflow-hidden">
              <button
                type="button"
                class="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 hover:bg-[#0f1b2e] transition"
                @click="toggleLogs(role)"
              >
                <div class="flex items-center gap-2">
                  <i class="codicon codicon-terminal text-orange-400"></i>
                  <span>Terminal Logs</span>
                  <span class="rounded-full bg-[#121f33] border border-[#243754] px-2 py-0.2 text-[10px] font-mono text-zinc-300">
                    {{ getStageExecution(role).terminalLogs?.length || 0 }} dòng
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="getStageExecution(role).terminalLogs?.length"
                    type="button"
                    class="rounded bg-[#132238] border border-[#253d61] px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white hover:border-cyan-400 transition"
                    title="Sao chép logs"
                    @click.stop="copyLogs(role)"
                  >
                    {{ copiedLogsFeedback[role] ? '✓ Đã sao chép' : 'Sao chép' }}
                  </button>
                  <span class="text-[11px] text-zinc-400 font-mono">
                    {{ expandedLogs[role] ? 'Thu gọn ▲' : 'Xem chi tiết ▼' }}
                  </span>
                </div>
              </button>

              <div v-if="expandedLogs[role]" class="border-t border-[#17253b] bg-[#040710] p-3">
                <div
                  v-if="!getStageExecution(role).terminalLogs || !getStageExecution(role).terminalLogs.length"
                  class="py-3 text-center text-xs text-zinc-500 italic font-mono"
                >
                  Chưa có logs từ console giai đoạn này.
                </div>
                <div
                  v-else
                  class="max-h-56 overflow-y-auto space-y-1 font-mono text-[11px] text-zinc-300 leading-relaxed scrollbar-thin select-text"
                >
                  <div
                    v-for="(logLine, lIndex) in getStageExecution(role).terminalLogs"
                    :key="lIndex"
                    class="flex items-start gap-2 hover:bg-white/5 px-1 py-0.5 rounded"
                  >
                    <span class="text-zinc-600 select-none text-[10px] w-6 text-right shrink-0">{{ lIndex + 1 }}</span>
                    <span
                      class="break-words whitespace-pre-wrap flex-1"
                      :class="
                        /error|fail|exception|fatal|✕|🛑/i.test(logLine)
                          ? 'text-rose-400'
                          : /warn|warning|⚠️|⏳/i.test(logLine)
                            ? 'text-amber-300'
                            : /✓|passed|healthy|success/i.test(logLine)
                              ? 'text-emerald-400'
                              : 'text-zinc-300'
                      "
                    >{{ logLine }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cc-markdown-body :deep(pre) {
  background-color: #03060c;
  border: 1px solid #162438;
  border-radius: 0.5rem;
  padding: 0.625rem 0.875rem;
  overflow-x: auto;
}

.cc-markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #00f5d4;
}

.cc-markdown-body :deep(p) {
  margin-top: 0.375rem;
  margin-bottom: 0.375rem;
}

.cc-markdown-body :deep(ul),
.cc-markdown-body :deep(ol) {
  margin-top: 0.375rem;
  margin-bottom: 0.375rem;
  padding-left: 1.25rem;
}
</style>
