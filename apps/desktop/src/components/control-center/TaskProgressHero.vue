<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { TaskItem } from '../../composables/useTaskSync';
import type { CaoWorkflowRunStatus, TaskPipelineVariant, WorkflowKind } from '../../services/caoBridgeService';

export interface TaskProgressHeroProps {
  task: TaskItem | null;
  tasks?: TaskItem[];
  running: boolean;
  runStatus: string;
  workflowStatus?: CaoWorkflowRunStatus | null;
  workflowKind?: WorkflowKind;
  pipelineVariant?: TaskPipelineVariant;
  epicTitle?: string;
  epicCompletedCount?: number;
  epicChildCount?: number;
  epicTaskGroups?: Array<{
    id?: number;
    taskKey?: string;
    title: string;
    dependencies?: string[];
    steps?: any[];
    status?: string;
  }>;
  agentRole?: string;
  provider?: string;
  model?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  phase?: string;
  error?: string;
}

const props = withDefaults(defineProps<TaskProgressHeroProps>(), {
  running: false,
  runStatus: 'idle',
  epicCompletedCount: 0,
  epicChildCount: 0,
});

const emit = defineEmits<{
  resume: [];
  retry: [stepId?: string];
  cancel: [];
  selectSubTask: [taskId: number | string];
  "update:provider": [value: string];
  "update:model": [value: string];
  "update:agentRole": [value: string];
  openAgentRoom: [];
}>();

const startTime = ref<number>(Date.now());
const elapsedSeconds = ref<number>(0);
let timer: any = null;

onMounted(() => {
  if (props.running) {
    startTime.value = Date.now();
    timer = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - startTime.value) / 1000);
    }, 1000);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const formattedTime = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60);
  const secs = elapsedSeconds.value % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

const isEpic = computed(() => props.task?.issue_type === 'epic' || props.workflowKind === 'epic');

const progressPercent = computed(() => {
  if (isEpic.value && props.epicChildCount > 0) {
    return Math.min(100, Math.round((props.epicCompletedCount / props.epicChildCount) * 100));
  }
  if (props.workflowStatus?.steps?.length) {
    const total = props.workflowStatus.steps.length;
    const completed = props.workflowStatus.steps.filter(s => s.state === 'completed').length;
    const runningStep = props.workflowStatus.steps.some(s => s.state === 'running' || s.state === 'validating');
    const base = Math.round((completed / total) * 100);
    return runningStep ? Math.min(95, base + Math.round(50 / total)) : base;
  }
  if (props.running) return 45;
  if (props.runStatus === 'completed') return 100;
  return 0;
});

const standardSteps = computed(() => {
  if (props.workflowStatus?.steps?.length) {
    return props.workflowStatus.steps.map((s, idx) => ({
      id: s.id,
      label: s.label || s.taskKey || `Bước ${idx + 1}`,
      state: s.state,
      subtitle: s.state === 'completed' ? 'Hoàn tất' : s.state === 'running' ? 'Đang thực thi' : s.state === 'failed' ? 'Lỗi' : 'Chờ xử lý',
    }));
  }

  const cur = props.workflowStatus?.currentStep || 'implement';
  return [
    {
      id: 'implement',
      label: '1. Implement',
      state: cur === 'implement' && props.running ? 'running' : cur !== 'implement' ? 'completed' : 'pending',
      subtitle: 'Sinh mã & Worktree',
    },
    {
      id: 'review',
      label: '2. Review',
      state: cur === 'review' && props.running ? 'running' : ['evidence', 'handoff'].includes(cur) ? 'completed' : 'pending',
      subtitle: 'Kiểm định chất lượng',
    },
    {
      id: 'evidence',
      label: '3. Evidence',
      state: cur === 'evidence' && props.running ? 'running' : cur === 'handoff' ? 'completed' : 'pending',
      subtitle: 'Kiểm thử & Bằng chứng',
    },
    {
      id: 'handoff',
      label: '4. Handoff',
      state: cur === 'handoff' && props.running ? 'running' : props.runStatus === 'completed' ? 'completed' : 'pending',
      subtitle: 'Phê duyệt & Hợp nhất',
    },
  ];
});

const epicSubTasks = computed(() => {
  if (props.epicTaskGroups?.length) {
    return props.epicTaskGroups.map(g => ({
      id: g.id || g.taskKey || 'task',
      key: g.taskKey || `#${g.id}`,
      title: g.title,
      status: g.status || 'pending',
      dependencies: g.dependencies || [],
    }));
  }
  if (isEpic.value && props.tasks?.length && props.task) {
    return props.tasks
      .filter(t => t.epic_id === props.task?.id && t.issue_type !== 'epic')
      .map(t => ({
        id: t.id,
        key: t.issue_key || `#${t.id}`,
        title: t.title,
        status: t.status,
        dependencies: (t as any).dependencies || [],
      }));
  }
  return [];
});

const isSubTasksOpen = ref(true);

const formatTokens = (n: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
};
</script>

<template>
  <div class="task-progress-hero mb-3 select-none" data-testid="task-progress-hero">
    <div class="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#0a1324] via-[#070b14] to-[#04070d] p-4 sm:p-5 shadow-2xl shadow-emerald-950/20">
      <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
      <div class="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div class="relative z-10 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider border shadow-sm"
              :class="isEpic ? 'bg-purple-950/80 text-purple-300 border-purple-500/40' : 'bg-emerald-950/80 text-[#00f5a0] border-emerald-500/40'"
            >
              <span class="h-1.5 w-1.5 rounded-full animate-ping bg-current"></span>
              {{ isEpic ? 'EPIC RUN' : 'ACTIVE TASK' }} · {{ task?.issue_key || (task?.id ? `#${task.id}` : 'TH-01') }}
            </span>

            <span
              v-if="task?.priority === 'high'"
              class="rounded-full bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold text-rose-300 tracking-wide"
            >
              HIGH PRIORITY
            </span>

            <span
              class="rounded-full bg-[#0c162d] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-300"
            >
              {{ pipelineVariant === 'fast-track' ? '⚡ 2-STEP FAST-TRACK' : '🛡️ STRICT 4-TIER PIPELINE' }}
            </span>

            <span v-if="running" class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
              <i class="codicon codicon-watch text-cyan-400"></i>
              <span>{{ formattedTime }}</span>
            </span>
          </div>

          <h2 class="mt-2 text-base sm:text-lg font-extrabold text-white font-['Space_Grotesk'] tracking-tight leading-snug truncate" :title="task?.title || epicTitle">
            {{ task?.title || epicTitle || 'Đang thực thi tác vụ AI Supervised Vibe Coding' }}
          </h2>
          <p class="mt-0.5 text-xs text-zinc-400 truncate">
            {{ phase || 'Chế độ tự động hóa: Cô lập Git Worktree và kiểm định Test Evidence' }}
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <div class="text-right">
            <div class="text-2xl sm:text-3xl font-black font-['Space_Grotesk'] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#00f5a0] to-cyan-300">
              {{ progressPercent }}%
            </div>
            <div class="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              {{ isEpic ? `${epicCompletedCount}/${epicChildCount} Task xong` : running ? 'Đang tiến hành' : 'Sẵn sàng' }}
            </div>
          </div>

          <div v-if="running" class="flex items-center gap-1.5">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200 transition shadow-sm"
              title="Hủy tiến trình đang chạy"
              @click="emit('cancel')"
            >
              <i class="codicon codicon-stop-circle text-xs"></i>
              <span>Hủy</span>
            </button>
          </div>
        </div>
      </div>

      <div class="relative mt-4">
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-[#050b17] border border-white/10">
          <div
            class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-[#00f5a0] transition-all duration-500 ease-out relative"
            :style="{ width: `${progressPercent}%` }"
          >
            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
      </div>

      <div class="relative z-10 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div
          v-for="(step, idx) in standardSteps"
          :key="step.id"
          class="relative flex flex-col justify-between rounded-xl border p-2.5 transition-all"
          :class="[
            step.state === 'completed'
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200 shadow-sm shadow-emerald-950/30'
              : step.state === 'running'
                ? 'border-[#00f5a0]/60 bg-[#061814] text-[#00f5a0] ring-1 ring-[#00f5a0]/40 shadow-md shadow-emerald-950/40 animate-pulse'
                : step.state === 'failed'
                  ? 'border-rose-500/40 bg-rose-950/25 text-rose-200'
                  : 'border-white/5 bg-[#080e1a]/60 text-zinc-400'
          ]"
        >
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[11px] font-bold tracking-tight truncate">{{ step.label }}</span>
            <span
              class="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold font-mono"
              :class="[
                step.state === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : step.state === 'running'
                    ? 'bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/60 animate-spin'
                    : step.state === 'failed'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-zinc-800/40 text-zinc-400 border border-white/10'
              ]"
            >
              {{ step.state === 'completed' ? '✓' : step.state === 'running' ? '⟳' : step.state === 'failed' ? '✕' : `${idx + 1}` }}
            </span>
          </div>
          <div class="text-[10px] font-mono text-zinc-400 truncate">
            {{ step.subtitle }}
          </div>
        </div>
      </div>

      <!-- Interactive Active Agent Telemetry & Switcher Card -->
      <div class="relative z-10 mt-4 rounded-xl border border-[#141b2d] bg-gradient-to-r from-[#080e1c]/90 via-[#0a1224]/80 to-[#080e1c]/90 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00f5a0]/20 to-cyan-500/20 border border-[#00f5a0]/50 text-[#00f5a0] font-bold shadow-[0_0_12px_rgba(0,245,160,0.25)]">
            <i class="codicon codicon-hubot text-lg"></i>
            <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00f5a0] ring-2 ring-[#080e1c] animate-pulse"></span>
          </div>

          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Interactive Role Switcher Pill -->
              <div class="flex items-center gap-1 rounded-md bg-[#0c1424] border border-[#00f5a0]/30 px-2 py-0.5 text-xs text-zinc-200 hover:border-[#00f5a0] transition">
                <span class="text-xs">{{ agentRole === 'supervisor' ? '🏛️' : agentRole === 'reviewer' ? '🔍' : agentRole === 'qa' ? '🧪' : '🛠️' }}</span>
                <select
                  :value="agentRole || 'implementation'"
                  class="bg-transparent text-xs font-bold text-[#00f5a0] focus:outline-none cursor-pointer"
                  title="Đổi vai trò Agent (Switch Role)"
                  @change="$emit('update:agentRole', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="implementation" class="bg-[#070b14] text-zinc-200">🛠️ Implementation (Senior Dev)</option>
                  <option value="supervisor" class="bg-[#070b14] text-zinc-200">🏛️ Supervisor (Lead Architect)</option>
                  <option value="reviewer" class="bg-[#070b14] text-zinc-200">🔍 Reviewer (Code Auditor)</option>
                  <option value="qa" class="bg-[#070b14] text-zinc-200">🧪 QA (Tester)</option>
                </select>
              </div>

              <!-- Interactive Provider / Model Switcher Pill -->
              <div class="flex items-center gap-1 rounded-md bg-[#0c1424] border border-cyan-500/30 px-2 py-0.5 text-xs text-cyan-300 hover:border-cyan-400 transition font-mono">
                <span class="h-1.5 w-1.5 rounded-full" :class="provider === 'codex' ? 'bg-[#00f5a0]' : provider === 'claude_code' ? 'bg-amber-400' : 'bg-cyan-400'"></span>
                <select
                  :value="provider || 'codex'"
                  class="bg-transparent text-[11px] font-semibold text-cyan-300 focus:outline-none cursor-pointer font-mono"
                  title="Đổi AI Engine (Switch Provider)"
                  @change="$emit('update:provider', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="codex" class="bg-[#070b14] text-zinc-200">Codex Engine</option>
                  <option value="antigravity" class="bg-[#070b14] text-zinc-200">Antigravity 2.0</option>
                  <option value="claude_code" class="bg-[#070b14] text-zinc-200">Claude Code</option>
                </select>
              </div>

              <span class="font-mono text-[10px] text-zinc-400 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                {{ model || 'GPT-5 Flagship' }}
              </span>
            </div>
            <p class="text-[11px] text-zinc-400 truncate">
              Môi trường làm việc Git Worktree độc lập · Tự động ghi nhận bằng chứng kiểm thử
            </p>
          </div>
        </div>

        <!-- Right Action & Telemetry -->
        <div class="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
          <div v-if="tokenUsage && tokenUsage.totalTokens > 0" class="flex items-center gap-1 bg-[#050a14] px-2.5 py-1 rounded-lg border border-white/5">
            <i class="codicon codicon-dashboard text-[#00f5a0]"></i>
            <span class="text-zinc-200 font-bold">{{ formatTokens(tokenUsage.totalTokens) }}</span> tokens
          </div>

          <div class="flex items-center gap-1 bg-[#050a14] px-2.5 py-1 rounded-lg border border-white/5 text-emerald-400">
            <i class="codicon codicon-shield text-xs"></i>
            <span>Worktree Isolated</span>
          </div>
          
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-[#0c1424] hover:bg-[#111c34] border border-[#00f5a0]/40 hover:border-[#00f5a0] px-2.5 py-1 text-xs font-semibold text-[#00f5a0] hover:text-white transition shadow-sm cursor-pointer"
            title="Mở phòng trực chiến để chuyển đổi tác tử hoặc điều phối fleet"
            @click="$emit('openAgentRoom')"
          >
            <i class="codicon codicon-organization text-xs"></i>
            <span>Đổi Agent / Fleet</span>
          </button>
        </div>
      </div>

      <div v-if="isEpic && epicSubTasks.length" class="relative z-10 mt-4 rounded-xl border border-white/10 bg-[#060a14] overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between p-3 text-left hover:bg-white/5 transition"
          @click="isSubTasksOpen = !isSubTasksOpen"
        >
          <div class="flex items-center gap-2">
            <i class="codicon codicon-list-tree text-purple-400 text-sm"></i>
            <span class="font-bold text-xs text-zinc-200 font-['Space_Grotesk']">Danh sách Task trong Epic</span>
            <span class="rounded-full bg-purple-950/80 border border-purple-500/40 px-2 py-0.2 text-[10px] font-mono text-purple-300">
              {{ epicCompletedCount }}/{{ epicChildCount }} hoàn thành
            </span>
          </div>
          <i
            class="codicon text-xs text-zinc-400 transition-transform"
            :class="isSubTasksOpen ? 'codicon-chevron-up' : 'codicon-chevron-down'"
          ></i>
        </button>

        <div v-if="isSubTasksOpen" class="border-t border-white/5 divide-y divide-white/5 max-h-48 overflow-y-auto">
          <div
            v-for="sub in epicSubTasks"
            :key="sub.id"
            class="flex items-center justify-between p-2.5 text-xs hover:bg-white/[0.02] transition cursor-pointer"
            @click="emit('selectSubTask', sub.id)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold"
                :class="[
                  sub.status === 'done' || sub.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : sub.status === 'in_progress' || sub.status === 'running'
                      ? 'bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/60 animate-pulse'
                      : sub.status === 'blocked'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-zinc-800/40 text-zinc-500 border border-white/10'
                ]"
              >
                {{ sub.status === 'done' || sub.status === 'completed' ? '✓' : sub.status === 'in_progress' || sub.status === 'running' ? '●' : '·' }}
              </span>
              <span class="font-mono font-bold text-zinc-400 text-[11px] shrink-0">{{ sub.key }}</span>
              <span class="truncate text-zinc-200 font-medium" :title="sub.title">{{ sub.title }}</span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span
                class="rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase"
                :class="[
                  sub.status === 'done' || sub.status === 'completed'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    : sub.status === 'in_progress' || sub.status === 'running'
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                      : sub.status === 'blocked'
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        : 'bg-zinc-900 text-zinc-500 border border-white/5'
                ]"
              >
                {{ sub.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-progress-hero {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
