<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';
import StatusBadge from '@/Components/ui/StatusBadge.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';
import type { DesktopAgentItem } from './ConnectedAgentsRegistry.vue';

export interface TaskItemProps {
  id: number;
  issue_key?: string;
  issue_type: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  story_points?: number | null;
  project?: { id: number; title: string } | null;
}

const props = withDefaults(defineProps<{
  show: boolean;
  task: TaskItemProps | null;
  allTasks?: TaskItemProps[];
  initialRunnerId?: number | null;
  isDarkMode?: boolean;
}>(), {
  allTasks: () => [],
  initialRunnerId: null,
  isDarkMode: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'dispatched', payload: { run: any; task: TaskItemProps }): void;
}>();

const runners = ref<DesktopAgentItem[]>([]);
const isFetchingRunners = ref(false);
const isDispatching = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
type EpicDispatchDiagnostics = {
  blocked?: Array<TaskItemProps & { blocked_by: Array<Pick<TaskItemProps, 'id' | 'issue_key' | 'title' | 'status'>> }>;
  active?: TaskItemProps[];
  cycles?: Array<Array<Pick<TaskItemProps, 'id' | 'issue_key' | 'title'>>>;
};
const dispatchDiagnostics = ref<EpicDispatchDiagnostics | null>(null);

const selectedTaskId = ref<number | null>(null);
const selectedRunnerId = ref<number | null>(null);
const selectedProvider = ref<'antigravity' | 'claude_code' | 'codex'>('antigravity');
const selectedModel = ref('gemini-3.7-flash');
const executionMode = ref<'auto_pilot' | 'supervised'>('auto_pilot');
const customInstruction = ref('');

const providerModels: Record<string, Array<{ id: string; name: string; desc: string; badge?: string }>> = {
  antigravity: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', desc: 'Fast, high-throughput autonomous coding', badge: 'Recommended' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Deep architectural reasoning & complex refactoring' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 Thinking', desc: 'Step-by-step thinking & rigorous verification' },
  ],
  claude_code: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', desc: 'Anthropic Claude Code CLI autonomous agent', badge: 'Fast' },
  ],
  codex: [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', desc: 'OpenAI Codex specialized for full-stack tasks', badge: 'Sol' },
    { id: 'o3-pro', name: 'o3-pro Reasoning', desc: 'OpenAI o3 high-compute reasoning model' },
  ],
};

const currentModels = computed(() => providerModels[selectedProvider.value] || []);

const activeTask = computed(() => {
  if (props.task) return props.task;
  if (selectedTaskId.value && props.allTasks?.length) {
    return props.allTasks.find(t => t.id === selectedTaskId.value) || null;
  }
  return null;
});

const onlineRunners = computed(() =>
  runners.value.filter(r => ['online', 'busy'].includes(r.health || r.status))
);

const fetchRunners = async () => {
  isFetchingRunners.value = true;
  try {
    const res = await axios.get('/api/v1/desktop/agents');
    runners.value = res.data?.data || [];
  } catch {
    try {
      const fallback = await axios.get('/api/runners/dashboard');
      runners.value = fallback.data?.data || [];
    } catch {
      runners.value = [];
    }
  } finally {
    isFetchingRunners.value = false;
    if (!selectedRunnerId.value && onlineRunners.value.length > 0) {
      selectedRunnerId.value = onlineRunners.value[0].id;
    }
  }
};

const handleProviderChange = (provider: 'antigravity' | 'claude_code' | 'codex') => {
  selectedProvider.value = provider;
  const models = providerModels[provider];
  if (models && models.length > 0) {
    selectedModel.value = models[0].id;
  }
  sound.playClick();
};

const getOsIcon = (platform?: string | null) => {
  const p = (platform || '').toLowerCase();
  if (p.includes('win') || p === 'win32') return '🪟';
  if (p.includes('darwin') || p.includes('mac')) return '🍎';
  if (p.includes('linux')) return '🐧';
  return '💻';
};

const dispatchTask = async () => {
  const taskToDispatch = activeTask.value;
  if (!taskToDispatch) {
    errorMessage.value = 'Please select a task to dispatch.';
    return;
  }
  if (!selectedRunnerId.value) {
    errorMessage.value = 'Please select a connected desktop agent.';
    return;
  }

  isDispatching.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  dispatchDiagnostics.value = null;

  try {
    const isEpicSequence = taskToDispatch.issue_type === 'epic';
    const res = await axios.post(`/api/v1/tasks/${taskToDispatch.id}/${isEpicSequence ? 'dispatch-sequence' : 'dispatch'}`, {
      runner_id: selectedRunnerId.value,
      provider: selectedProvider.value,
      model: selectedModel.value,
      execution_mode: executionMode.value,
      custom_instruction: customInstruction.value.trim() || undefined,
    });

    if (res.data?.success) {
      sound.playSuccess();
      successMessage.value = isEpicSequence
        ? `✓ Started Epic sequence at #${res.data.data?.task?.issue_key || taskToDispatch.issue_key || taskToDispatch.id}. The next task will queue after approval.`
        : `✓ Successfully dispatched #${taskToDispatch.issue_key || taskToDispatch.id} to ${res.data.target_runner?.name || 'Desktop Agent'}!`;
      setTimeout(() => {
        emit('dispatched', { run: res.data.data || res.data, task: taskToDispatch });
        emit('close');
      }, 500);
    } else {
      errorMessage.value = res.data?.message || 'Dispatch failed.';
      dispatchDiagnostics.value = res.data?.dispatch_diagnostics || null;
    }
  } catch (err: any) {
    const { handleQuotaError } = useUpgradeModal();
    const quotaHandled = handleQuotaError(err);
    if (!quotaHandled) {
      const response = err.response?.data;
      errorMessage.value = response?.message || err.message || 'Unable to dispatch task to desktop runner.';
      dispatchDiagnostics.value = response?.dispatch_diagnostics || null;
    } else {
      emit('close');
    }
  } finally {
    isDispatching.value = false;
  }
};

watch(() => props.show, (newVal) => {
  if (newVal) {
    errorMessage.value = '';
    successMessage.value = '';
    dispatchDiagnostics.value = null;
    if (props.task) {
      selectedTaskId.value = props.task.id;
    }
    if (props.initialRunnerId) {
      selectedRunnerId.value = props.initialRunnerId;
    }
    void fetchRunners();
  }
});

onMounted(() => {
  if (props.show) {
    void fetchRunners();
  }
});
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
      :class="[
        isDarkMode
          ? 'bg-[#0a0f1d] border-slate-800 text-slate-100 shadow-slate-950/80'
          : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
      ]"
    >
      <!-- Modal Header -->
      <div
        class="px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0"
        :class="isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <Icons name="Zap" :size="18" class="text-amber-300 animate-pulse" />
          </div>
          <div>
            <h3 class="font-bold text-sm sm:text-base font-display tracking-tight">
              Remote Task Dispatch to Desktop
            </h3>
            <p class="text-[11px] text-slate-400">
              Trigger autonomous execution on your connected local workstation (&lt; 2s dispatch).
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors"
          title="Close dialog (Esc)"
        >
          <Icons name="X" :size="16" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto space-y-5 text-xs flex-1">
        <!-- Target Task Card -->
        <div
          v-if="activeTask"
          class="p-3.5 rounded-2xl border space-y-1.5"
          :class="isDarkMode ? 'bg-[#0f1526] border-slate-800' : 'bg-slate-50 border-slate-200'"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0"
                :class="isDarkMode ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-900 border-blue-200'"
              >
                {{ activeTask.issue_key || `#${activeTask.id}` }}
              </span>
              <h4 class="font-bold text-xs truncate" :class="isDarkMode ? 'text-white' : 'text-slate-950'">
                {{ activeTask.title }}
              </h4>
            </div>
            <StatusBadge
              :status="activeTask.status"
              variant="status"
              size="xs"
              :dark="isDarkMode"
            />
          </div>
          <p v-if="activeTask.description" class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {{ activeTask.description }}
          </p>
          <p v-if="activeTask.issue_type === 'epic'" class="text-[11px] leading-relaxed text-emerald-400">Epic sequence: dispatches one dependency-ready child at a time. The following task is queued after the current task is approved.</p>
        </div>

        <!-- Task Selector (If no initial task was passed) -->
        <div v-else-if="allTasks.length" class="space-y-1.5">
          <label class="font-mono text-[11px] font-bold uppercase text-slate-400 block">Select Task *</label>
          <select
            v-model="selectedTaskId"
            class="w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:border-emerald-500"
            :class="isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'"
          >
            <option :value="null" disabled>Choose a task from backlog / board...</option>
            <option v-for="t in allTasks" :key="t.id" :value="t.id">
              {{ t.issue_key ? `[${t.issue_key}] ` : '' }}{{ t.title }} ({{ t.status }})
            </option>
          </select>
        </div>

        <!-- Target Desktop Workstation -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="font-mono text-[11px] font-bold uppercase text-slate-400 block">
              1. Target Desktop Workstation *
            </label>
            <span class="text-[10px] font-mono text-emerald-400">
              {{ onlineRunners.length }} workstation{{ onlineRunners.length === 1 ? '' : 's' }} online
            </span>
          </div>

          <!-- Workstation Grid -->
          <div v-if="onlineRunners.length" class="grid gap-2 sm:grid-cols-2">
            <div
              v-for="runner in onlineRunners"
              :key="runner.id"
              @click="selectedRunnerId = runner.id"
              class="p-3 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-2 relative"
              :class="[
                selectedRunnerId === runner.id
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-sm'
                  : (isDarkMode ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700' : 'border-slate-200 bg-slate-50 hover:border-slate-300')
              ]"
            >
              <div class="min-w-0 space-y-0.5">
                <div class="flex items-center gap-1.5">
                  <Icons name="Desktop" :size="14" class="text-blue-400 shrink-0" />
                  <span class="font-bold text-xs truncate" :class="isDarkMode ? 'text-white' : 'text-slate-950'">
                    {{ runner.machine_name || runner.name }}
                  </span>
                </div>
                <p class="font-mono text-[10px] text-slate-400 truncate">
                  {{ runner.hostname || 'localhost' }}
                </p>
              </div>

              <div class="flex flex-col items-end gap-1 shrink-0">
                <span
                  class="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border"
                  :class="[
                    (runner.ping_latency_ms || 0) < 50
                      ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                      : 'text-amber-400 bg-amber-950/60 border-amber-800'
                  ]"
                >
                  {{ runner.ping_latency_ms ? `${runner.ping_latency_ms}ms` : '<20ms' }}
                </span>
                <span
                  class="w-2 h-2 rounded-full"
                  :class="selectedRunnerId === runner.id ? 'bg-emerald-400 ring-2 ring-emerald-400/40' : 'bg-slate-600'"
                />
              </div>
            </div>
          </div>

          <!-- Empty State if no runners online -->
          <div
            v-else
            class="p-4 rounded-2xl border border-dashed text-center space-y-1.5"
            :class="isDarkMode ? 'border-amber-500/40 bg-amber-950/10 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-900'"
          >
            <div class="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
              <Icons name="AlertTriangle" :size="14" />
              <span>No Desktop Companion Online</span>
            </div>
            <p class="text-[11px] opacity-85 leading-relaxed">
              Launch Midnight Hub Desktop on your workstation. It will automatically pair and show up here.
            </p>
          </div>
        </div>

        <!-- AI Provider & Model Selection -->
        <div class="space-y-3">
          <label class="font-mono text-[11px] font-bold uppercase text-slate-400 block">
            2. AI Provider & Model *
          </label>

          <!-- Provider Tabs -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in ['antigravity', 'claude_code', 'codex'] as const"
              :key="p"
              type="button"
              @click="handleProviderChange(p)"
              class="p-2.5 rounded-xl border font-bold text-center transition-all cursor-pointer flex flex-col items-center gap-0.5"
              :class="[
                selectedProvider === p
                  ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500 text-blue-400 ring-1 ring-blue-500/30'
                  : (isDarkMode ? 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300')
              ]"
            >
              <span class="flex items-center gap-1">
                <Icons :name="p === 'antigravity' ? 'Zap' : p === 'claude_code' ? 'Agent' : 'Terminal'" :size="12" />
                <span>{{ p === 'antigravity' ? 'Antigravity' : p === 'claude_code' ? 'Claude Code' : 'Codex' }}</span>
              </span>
              <span class="text-[9px] font-mono text-slate-400 font-normal">
                {{ p === 'antigravity' ? 'Autonomous SDK' : p === 'claude_code' ? 'Anthropic CLI' : 'OpenAI CLI' }}
              </span>
            </button>
          </div>

          <!-- Model Radio Group -->
          <div class="space-y-1.5">
            <div
              v-for="model in currentModels"
              :key="model.id"
              @click="selectedModel = model.id"
              class="p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2"
              :class="[
                selectedModel === model.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : (isDarkMode ? 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
              ]"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-xs font-mono">{{ model.name }}</span>
                  <span
                    v-if="model.badge"
                    class="px-1.5 py-0.2 rounded font-mono text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  >
                    {{ model.badge }}
                  </span>
                </div>
                <p class="text-[10px] text-slate-400">{{ model.desc }}</p>
              </div>

              <span
                class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                :class="selectedModel === model.id ? 'border-blue-400 bg-blue-500 text-white text-[9px]' : 'border-slate-600'"
              >
                <Icons v-if="selectedModel === model.id" name="Check" :size="10" />
              </span>
            </div>
          </div>
        </div>

        <!-- Execution Mode (Auto-Pilot vs Supervised) -->
        <div class="space-y-2">
          <label class="font-mono text-[11px] font-bold uppercase text-slate-400 block">
            3. Autonomous Execution Mode *
          </label>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              @click="executionMode = 'auto_pilot'"
              class="p-3 rounded-2xl border text-left space-y-1 transition-all cursor-pointer"
              :class="[
                executionMode === 'auto_pilot'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                  : (isDarkMode ? 'border-slate-800 bg-slate-900/40 opacity-75' : 'border-slate-200 bg-white opacity-75')
              ]"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                  <Icons name="Zap" :size="12" />
                  <span>Autonomous Auto-Pilot</span>
                </span>
                <Icons v-if="executionMode === 'auto_pilot'" name="Check" :size="12" class="text-emerald-400" />
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                7-stage autonomous cycle: Git worktree ➔ MCP context ➔ Coding ➔ Test verification ➔ Handoff.
              </p>
            </button>

            <button
              type="button"
              @click="executionMode = 'supervised'"
              class="p-3 rounded-2xl border text-left space-y-1 transition-all cursor-pointer"
              :class="[
                executionMode === 'supervised'
                  ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                  : (isDarkMode ? 'border-slate-800 bg-slate-900/40 opacity-75' : 'border-slate-200 bg-white opacity-75')
              ]"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-indigo-400 flex items-center gap-1.5">
                  <Icons name="Shield" :size="12" />
                  <span>Supervised Mode</span>
                </span>
                <Icons v-if="executionMode === 'supervised'" name="Check" :size="12" class="text-indigo-400" />
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                Requires manual confirmation for critical tool calls and dangerous commands.
              </p>
            </button>
          </div>
        </div>

        <!-- Custom Prompt / Instruction Override -->
        <div class="space-y-1.5">
          <label class="font-mono text-[11px] font-bold uppercase text-slate-400 block">
            4. Custom Instructions (Optional)
          </label>
          <textarea
            v-model="customInstruction"
            rows="2"
            class="w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:border-emerald-500 font-mono"
            :class="isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'"
            placeholder="Add special instructions or architectural hints for the agent..."
          />
        </div>

        <!-- Error & Success Messages -->
        <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs space-y-2">
          <div class="flex items-start gap-2">
            <Icons name="AlertCircle" :size="14" class="shrink-0 mt-0.5" />
            <span>{{ errorMessage }}</span>
          </div>
          <div v-if="dispatchDiagnostics" class="ml-5 space-y-2 text-[11px] leading-relaxed">
            <p v-if="dispatchDiagnostics.cycles?.length" class="text-amber-300">
              Human action required: this is a dependency cycle. Open the listed tasks in the board and remove one circular dependency before dispatching.
            </p>
            <ul v-if="dispatchDiagnostics.cycles?.length" class="space-y-1 text-rose-200">
              <li v-for="(cycle, index) in dispatchDiagnostics.cycles" :key="`cycle-${index}`">
                Cycle: {{ cycle.map(task => task.issue_key || `#${task.id}`).join(' → ') }}
              </li>
            </ul>
            <p v-else-if="dispatchDiagnostics.active?.length" class="text-amber-300">
              Human action required: finish, approve, or request changes on the active task before the Epic can continue.
            </p>
            <p v-else class="text-amber-300">
              Human action required: complete a prerequisite or correct the dependency links shown below, then retry dispatch.
            </p>
            <ul v-if="dispatchDiagnostics.blocked?.length" class="space-y-1 text-rose-200">
              <li v-for="task in dispatchDiagnostics.blocked.slice(0, 4)" :key="task.id">
                <strong>{{ task.issue_key || `#${task.id}` }}</strong> waits for
                {{ task.blocked_by.map(dependency => `${dependency.issue_key || `#${dependency.id}`} (${dependency.status})`).join(', ') }}
              </li>
            </ul>
            <ul v-if="dispatchDiagnostics.active?.length" class="space-y-1 text-rose-200">
              <li v-for="task in dispatchDiagnostics.active.slice(0, 4)" :key="task.id">
                <strong>{{ task.issue_key || `#${task.id}` }}</strong> is {{ task.status }}
              </li>
            </ul>
          </div>
        </div>
        <div v-if="successMessage" class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2">
          <Icons name="CheckCircle" :size="14" class="shrink-0" />
          <span>{{ successMessage }}</span>
        </div>
      </div>

      <!-- Modal Footer CTA -->
      <div
        class="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0"
        :class="isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'"
      >
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer"
          :class="isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'"
        >
          Cancel
        </button>

        <button
          type="button"
          @click="dispatchTask"
          :disabled="isDispatching || !activeTask || !selectedRunnerId"
          class="px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 shadow-lg border"
          :class="[
            isDispatching || !activeTask || !selectedRunnerId
              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-emerald-400/40 shadow-emerald-950/40 active:scale-95'
          ]"
        >
          <Icons :name="isDispatching ? 'Refresh' : 'Zap'" :size="14" :class="[isDispatching ? 'animate-spin' : 'text-amber-300']" />
          <span>
            {{ isDispatching ? 'Dispatching (< 2s)...' : activeTask?.issue_type === 'epic' ? `Run Epic step by step (${executionMode === 'auto_pilot' ? 'Auto-Pilot' : 'Supervised'})` : `Dispatch to Desktop (${executionMode === 'auto_pilot' ? 'Auto-Pilot' : 'Supervised'})` }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
