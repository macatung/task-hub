<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';
import StatusBadge from '@/Components/ui/StatusBadge.vue';

export interface AgentRunEventItem {
  id?: number | string;
  event_id?: string;
  event_type: string;
  status?: string;
  payload?: any;
  occurred_at?: string;
}

export interface VerificationEvidenceItem {
  id?: number;
  evidence_type: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | string;
  command?: string | null;
  summary?: string | null;
  artifact_url?: string | null;
  commit_sha?: string | null;
  metadata?: any;
  created_at?: string;
}

export interface AgentRunLogItem {
  id?: number;
  sequence?: number;
  stream?: 'stdout' | 'stderr' | 'system' | string;
  content: string;
  occurred_at?: string;
}

export interface AgentRunFullItem {
  id: number;
  task_id?: number | null;
  provider: string;
  execution_mode?: string;
  runner_id?: number | null;
  status: string;
  branch?: string | null;
  commit_sha?: string | null;
  pull_request_url?: string | null;
  summary?: string | null;
  failure_reason?: string | null;
  metadata?: {
    model?: string;
    mode?: string;
    target_runner?: { id: number; name: string; hostname?: string };
    context?: any;
    [key: string]: any;
  } | null;
  evidence?: VerificationEvidenceItem[];
  events?: AgentRunEventItem[];
  logs?: AgentRunLogItem[];
  runner?: { id: number; name: string; hostname?: string; os_platform?: string } | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface TaskItemProps {
  id: number;
  issue_key?: string;
  title: string;
  status: string;
  description?: string | null;
  priority?: string;
}

const props = withDefaults(defineProps<{
  task: TaskItemProps;
  activeRun: AgentRunFullItem | null;
  isDarkMode?: boolean;
}>(), {
  isDarkMode: true,
});

const emit = defineEmits<{
  (e: 'approved', task: TaskItemProps): void;
  (e: 'rejected', task: TaskItemProps): void;
  (e: 'refresh'): void;
}>();

const runDetails = ref<AgentRunFullItem | null>(null);
const logs = ref<AgentRunLogItem[]>([]);
const autoScroll = ref(true);
const terminalContainer = ref<HTMLElement | null>(null);
const isApproving = ref(false);
const isRejecting = ref(false);
const isActionFeedback = ref('');
const copiedLogs = ref(false);
const activeToolAccordion = ref<number | null>(null);
const handoffFiles = computed<string[]>(() => {
  const run = runDetails.value || props.activeRun;
  const files = run?.metadata?.handoff?.changed_files;
  return Array.isArray(files) ? files.filter((file): file is string => typeof file === 'string' && file.trim().length > 0) : [];
});
const autoReview = computed(() => {
  const run = runDetails.value || props.activeRun;
  return run?.metadata?.handoff?.auto_review || run?.metadata?.auto_review || null;
});

let sseSource: EventSource | null = null;
let pollInterval: number | null = null;

// 6-step Autonomous Execution Stepper
export interface StepItem {
  id: number;
  key: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  durationMs?: number;
}

const executionSteps = computed<StepItem[]>(() => {
  const run = runDetails.value || props.activeRun;
  const status = run?.status || 'pending';
  const events = run?.events || [];

  const hasEvent = (type: string) => events.some(e => e.event_type === type);

  // 1. Dispatched
  let step1Status: StepItem['status'] = 'pending';
  if (run) {
    step1Status = ['queued', 'claimed', 'preparing', 'running', 'waiting_input', 'testing', 'verified', 'needs_review', 'completed'].includes(status)
      ? 'completed'
      : (status === 'failed' && !hasEvent('worktree_prepared') ? 'failed' : 'completed');
  }

  // 2. Worktree Prepared
  let step2Status: StepItem['status'] = 'pending';
  if (run) {
    if (['preparing', 'running', 'waiting_input', 'testing', 'verified', 'needs_review', 'completed'].includes(status) || hasEvent('worktree_prepared') || hasEvent('worktree_ready')) {
      step2Status = 'completed';
    } else if (status === 'claimed') {
      step2Status = 'running';
    } else if (status === 'failed' && !hasEvent('context_loaded')) {
      step2Status = 'failed';
    }
  }

  // 3. MCP Context Loaded
  let step3Status: StepItem['status'] = 'pending';
  if (run) {
    if (['running', 'waiting_input', 'testing', 'verified', 'needs_review', 'completed'].includes(status) || hasEvent('context_loaded') || hasEvent('mcp_ready')) {
      step3Status = 'completed';
    } else if (status === 'preparing') {
      step3Status = 'running';
    } else if (status === 'failed' && !hasEvent('agent_started')) {
      step3Status = 'failed';
    }
  }

  // 4. Auto-Pilot Coding
  let step4Status: StepItem['status'] = 'pending';
  if (run) {
    if (['verified', 'needs_review', 'completed'].includes(status) || hasEvent('handoff_completed')) {
      step4Status = 'completed';
    } else if (status === 'running') {
      step4Status = 'running';
    } else if (status === 'waiting_input') {
      step4Status = 'paused';
    } else if (status === 'failed') {
      step4Status = 'failed';
    }
  }

  // 5. Tests Verified
  let step5Status: StepItem['status'] = 'pending';
  if (run) {
    const hasEvidence = (run.evidence && run.evidence.length > 0) || hasEvent('verification_passed');
    if (['verified', 'needs_review', 'completed'].includes(status) && hasEvidence) {
      step5Status = 'completed';
    } else if (status === 'running' && hasEvent('testing_started')) {
      step5Status = 'running';
    } else if (status === 'failed' && hasEvent('testing_started')) {
      step5Status = 'failed';
    }
  }

  // 6. Handoff Ready
  let step6Status: StepItem['status'] = 'pending';
  if (run) {
    if (['verified', 'completed'].includes(status) || props.task.status === 'done') {
      step6Status = 'completed';
    } else if (status === 'needs_review' || hasEvent('handoff_completed')) {
      step6Status = 'completed';
    } else if (status === 'failed') {
      step6Status = 'failed';
    }
  }

  return [
    { id: 1, key: 'dispatched', title: '1. Dispatched', description: 'Task queued & claimed by desktop runner', status: step1Status },
    { id: 2, key: 'worktree', title: '2. Worktree Prepared', description: 'Isolated Git branch & worktree created', status: step2Status },
    { id: 3, key: 'mcp', title: '3. MCP Context Loaded', description: 'Task requirements & workspace context injected', status: step3Status },
    { id: 4, key: 'coding', title: '4. Auto-Pilot Coding', description: 'Autonomous agent coding & tool execution', status: step4Status },
    { id: 5, key: 'tests', title: '5. Tests Verified', description: 'Automated test suite & evidence generated', status: step5Status },
    { id: 6, key: 'handoff', title: '6. Handoff Ready', description: 'Structured diff & pull request ready for review', status: step6Status },
  ];
});

// Tool Calls Extraction from events/logs
export interface ToolCallItem {
  id: number;
  tool: string;
  status: 'running' | 'success' | 'failed';
  params?: any;
  output?: string;
  durationMs?: number;
  time?: string;
}

const toolCalls = computed<ToolCallItem[]>(() => {
  const run = runDetails.value || props.activeRun;
  if (!run?.events) return [];
  const list: ToolCallItem[] = [];

  run.events.forEach((evt, idx) => {
    if (evt.event_type.startsWith('tool_') || evt.payload?.tool || evt.event_type === 'command_executed') {
      const toolName = evt.payload?.tool || evt.payload?.command || evt.event_type.replace('tool_', '');
      list.push({
        id: idx,
        tool: toolName,
        status: evt.status === 'failed' ? 'failed' : 'success',
        params: evt.payload?.params || evt.payload?.args || evt.payload?.command,
        output: evt.payload?.output || evt.payload?.result,
        durationMs: evt.payload?.duration_ms,
        time: evt.occurred_at ? new Date(evt.occurred_at).toLocaleTimeString() : undefined,
      });
    }
  });

  return list;
});

// Safety Interception Banner State
const safetyIntercept = computed(() => {
  const run = runDetails.value || props.activeRun;
  if (run?.status === 'waiting_input') {
    const safetyEvent = run.events?.find(e => ['safety_intercept', 'dangerous_command_blocked', 'human_approval_required', 'waiting_input'].includes(e.event_type));
    return {
      active: true,
      risk_level: safetyEvent?.payload?.risk_level || 'HIGH',
      reason: safetyEvent?.payload?.reason || run.failure_reason || 'Autonomous agent paused for developer authorization before running critical action.',
      command: safetyEvent?.payload?.command || safetyEvent?.payload?.action || null,
      context: safetyEvent?.payload,
    };
  }
  return null;
});

const loadRunDetails = async (runId: number) => {
  try {
    const res = await axios.get(`/api/tasks/agent-runs/${runId}`);
    if (res.data?.data) {
      runDetails.value = res.data.data;
      if (res.data.data.logs?.length) {
        logs.value = res.data.data.logs;
      }
      scrollToBottom();
    }
  } catch {}
};

const scrollToBottom = () => {
  if (!autoScroll.value) return;
  nextTick(() => {
    if (terminalContainer.value) {
      terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
    }
  });
};

const setupSse = (runId: number) => {
  if (sseSource) sseSource.close();
  try {
    sseSource = new EventSource(`/api/tasks/agent-runs/stream?run_id=${runId}`);
    sseSource.addEventListener('agent-run', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.run_id === runId) {
          void loadRunDetails(runId);
        }
      } catch {}
    });
    sseSource.addEventListener('agent-log', (e) => {
      try {
        const logData = JSON.parse((e as MessageEvent).data);
        if (logData.run_id === runId || !logData.run_id) {
          logs.value.push({
            id: logData.id,
            stream: logData.stream || 'stdout',
            content: logData.content,
            occurred_at: logData.occurred_at || new Date().toISOString(),
          });
          scrollToBottom();
        }
      } catch {}
    });
  } catch {}
};

const approveSafetyOrHandoff = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run) return;

  isApproving.value = true;
  isActionFeedback.value = '';
  try {
    sound.playSuccess();
    if (run.status === 'waiting_input') {
      // Approve safety intercept to continue
      await axios.post(`/api/v1/agent-runs/${run.id}/events`, {
        event_id: crypto.randomUUID(),
        event_type: 'safety_approved',
        status: 'running',
        payload: { approved_at: new Date().toISOString() },
      });
      isActionFeedback.value = '✓ Action approved. Agent is resuming execution...';
    } else {
      // Final task approval
      const res = await axios.post(`/api/tasks/work-items/${props.task.id}/approve`);
      if (res.data?.success) {
        isActionFeedback.value = '✓ Task approved & marked Done!';
        emit('approved', res.data.data);
      }
    }
    emit('refresh');
    if (run.id) void loadRunDetails(run.id);
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Approval failed.';
  } finally {
    isApproving.value = false;
  }
};

const rejectSafetyOrHandoff = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run) return;

  isRejecting.value = true;
  isActionFeedback.value = '';
  try {
    sound.playClick();
    const reason = window.prompt('Enter reason for rejection / feedback:', 'Safety command denied by reviewer.') || 'Rejected by reviewer.';
    const res = await axios.post(`/api/tasks/work-items/${props.task.id}/reject`, { reason });
    if (res.data?.success) {
      isActionFeedback.value = '✓ Task returned to changes requested.';
      emit('rejected', res.data.data);
      emit('refresh');
    }
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Rejection failed.';
  } finally {
    isRejecting.value = false;
  }
};

const isCancelling = ref(false);
const cancelActiveRun = async () => {
  const run = runDetails.value || props.activeRun;
  if (!run?.id) return;
  if (!window.confirm(`Are you sure you want to cancel Agent Run #${run.id}?`)) return;
  isCancelling.value = true;
  try {
    const res = await axios.post(`/api/tasks/agent-runs/${run.id}/cancel`);
    if (res.data?.success) {
      isActionFeedback.value = `✓ Run #${run.id} cancellation requested.`;
      emit('refresh');
      void loadRunDetails(run.id);
    }
  } catch (err: any) {
    isActionFeedback.value = err.response?.data?.message || 'Failed to cancel run.';
  } finally {
    isCancelling.value = false;
  }
};

const copyAllLogs = async () => {
  const text = logs.value.map(l => `[${l.stream || 'stdout'}] ${l.content}`).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copiedLogs.value = true;
    sound.playClick();
    setTimeout(() => { copiedLogs.value = false; }, 2000);
  } catch {}
};

watch(() => props.activeRun?.id, (newId) => {
  if (newId) {
    logs.value = props.activeRun?.logs || [];
    void loadRunDetails(newId);
    setupSse(newId);
  }
}, { immediate: true });

onMounted(() => {
  if (props.activeRun?.id) {
    void loadRunDetails(props.activeRun.id);
    setupSse(props.activeRun.id);
  }
  pollInterval = window.setInterval(() => {
    if (props.activeRun?.id && ['queued', 'claimed', 'preparing', 'running', 'waiting_input'].includes(props.activeRun.status)) {
      void loadRunDetails(props.activeRun.id);
    }
  }, 5000);
});

onBeforeUnmount(() => {
  if (sseSource) sseSource.close();
  if (pollInterval) window.clearInterval(pollInterval);
});
</script>

<template>
  <div class="streamback-console space-y-4">
    <!-- Header: Active Run Info & Runner Badge -->
    <div
      class="p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs"
      :class="isDarkMode ? 'bg-[#0a0f1d] border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
          <Icons name="Zap" :size="16" class="text-amber-300 animate-pulse" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-xs font-display truncate">
              Autonomous Desktop Auto-Pilot
            </h4>
            <StatusBadge
              :status="activeRun?.status || 'idle'"
              variant="status"
              size="xs"
              :dark="isDarkMode"
            />
          </div>
          <p class="font-mono text-[10px] text-slate-400 truncate">
            Run #{{ activeRun?.id }} · {{ activeRun?.provider?.toUpperCase() }} ({{ activeRun?.metadata?.model || 'gemini-3.7-flash' }})
            <span v-if="activeRun?.runner">· {{ activeRun.runner.name }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="['queued', 'claimed', 'preparing', 'running', 'waiting_input'].includes(activeRun?.status || '')"
          @click="cancelActiveRun"
          :disabled="isCancelling"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          title="Cancel active agent execution"
        >
          <Icons name="X" :size="11" />
          <span>{{ isCancelling ? 'Stopping…' : 'Cancel' }}</span>
        </button>

        <!-- Action: Reload Streamback -->
        <button
          @click="activeRun?.id && loadRunDetails(activeRun.id)"
          class="px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5"
          :class="isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white' : 'border-slate-300 bg-white text-slate-700 hover:text-slate-950'"
          title="Refresh streamback logs"
        >
          <Icons name="Refresh" :size="12" />
          <span>Sync</span>
        </button>
      </div>
    </div>

    <!-- 1. 6-STEP AUTONOMOUS EXECUTION STEPPER -->
    <div
      class="p-4 rounded-2xl border space-y-3"
      :class="isDarkMode ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-slate-200'"
    >
      <div class="flex items-center justify-between text-xs">
        <span class="font-mono font-bold uppercase tracking-wider text-slate-400 text-[10px]">
          Autonomous 6-Stage Execution Loop
        </span>
        <span class="font-mono text-[10px] text-slate-500">
          {{ executionSteps.filter(s => s.status === 'completed').length }}/6 Completed
        </span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div
          v-for="step in executionSteps"
          :key="step.id"
          class="p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all text-xs"
          :class="[
            step.status === 'completed'
              ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50/80 border-emerald-300 text-emerald-900')
              : step.status === 'running'
              ? (isDarkMode ? 'bg-blue-950/30 border-blue-500/60 text-blue-300 ring-1 ring-blue-500/40' : 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-300')
              : step.status === 'paused'
              ? (isDarkMode ? 'bg-amber-950/30 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40' : 'bg-amber-50 border-amber-300 text-amber-900')
              : step.status === 'failed'
              ? (isDarkMode ? 'bg-rose-950/30 border-rose-500/60 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-900')
              : (isDarkMode ? 'bg-slate-900/40 border-slate-800/80 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')
          ]"
        >
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-[11px] truncate">{{ step.title }}</span>
            <span
              class="w-4 h-4 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0"
              :class="[
                step.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : step.status === 'running'
                  ? 'bg-blue-500 text-white'
                  : step.status === 'paused'
                  ? 'bg-amber-500 text-white animate-bounce'
                  : step.status === 'failed'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              ]"
            >
              <Icons v-if="step.status === 'completed'" name="Check" :size="10" />
              <Icons v-else-if="step.status === 'running'" name="Loader" :size="10" class="animate-spin" />
              <Icons v-else-if="step.status === 'paused'" name="AlertTriangle" :size="10" />
              <Icons v-else-if="step.status === 'failed'" name="X" :size="10" />
              <span v-else>{{ step.id }}</span>
            </span>
          </div>
          <p class="text-[9.5px] leading-tight opacity-75 line-clamp-2">{{ step.description }}</p>
        </div>
      </div>
    </div>

    <!-- 2. SAFETY INTERCEPTION BANNER (waiting_input state) -->
    <div
      v-if="safetyIntercept"
      class="p-4 rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent space-y-3 animate-pulse shadow-lg"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <Icons name="Shield" :size="20" class="text-amber-400 shrink-0" />
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-xs text-amber-400 uppercase tracking-wider">
                Safety Guardrail Intercept (Action Required)
              </h4>
              <span class="px-2 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {{ safetyIntercept.risk_level }} RISK
              </span>
            </div>
            <p class="text-[11px] text-slate-200 mt-0.5 leading-relaxed">
              {{ safetyIntercept.reason }}
            </p>
          </div>
        </div>
      </div>

      <!-- Command Preview Block -->
      <pre
        v-if="safetyIntercept.command"
        class="p-2.5 rounded-xl bg-black text-amber-300 font-mono text-[10px] border border-amber-500/30 overflow-auto"
      >{{ safetyIntercept.command }}</pre>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 pt-1">
        <button
          @click="approveSafetyOrHandoff"
          :disabled="isApproving"
          class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Icons name="Check" :size="12" />
          <span>{{ isApproving ? 'Approving...' : 'Authorize & Continue Execution' }}</span>
        </button>

        <button
          @click="rejectSafetyOrHandoff"
          :disabled="isRejecting"
          class="px-4 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <Icons name="X" :size="12" />
          <span>{{ isRejecting ? 'Rejecting...' : 'Reject Action' }}</span>
        </button>
      </div>
    </div>

    <!-- 3. LIVE TERMINAL LOG STREAM -->
    <div
      class="rounded-2xl border overflow-hidden shadow-2xl flex flex-col"
      :class="isDarkMode ? 'bg-[#070b14] border-slate-800' : 'bg-slate-950 border-slate-800 text-white'"
    >
      <!-- Terminal Header Bar -->
      <div class="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <!-- Window Dots -->
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span class="font-mono text-[11px] text-slate-300 font-bold ml-1">Live Streamback Console</span>
          <span class="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {{ logs.length }} lines
          </span>
        </div>

        <!-- Terminal Controls -->
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 font-mono text-[10px] text-slate-400 cursor-pointer select-none">
            <input type="checkbox" v-model="autoScroll" class="rounded text-emerald-500 focus:ring-0" />
            <span>Auto-Scroll</span>
          </label>
          <button
            @click="copyAllLogs"
            class="px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1"
          >
            <Icons :name="copiedLogs ? 'Check' : 'Copy'" :size="11" />
            <span>{{ copiedLogs ? 'Copied' : 'Copy' }}</span>
          </button>
          <button
            @click="logs = []"
            class="px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Terminal Log Container -->
      <div
        ref="terminalContainer"
        class="p-4 font-mono text-[11px] leading-relaxed max-h-72 sm:max-h-96 overflow-y-auto space-y-1 select-all bg-black/90"
      >
        <div v-if="!logs.length" class="text-slate-500 italic py-4 text-center">
          Waiting for live output from desktop agent runner...
        </div>

        <div
          v-for="(log, idx) in logs"
          :key="log.id || idx"
          class="flex items-start gap-2 break-all"
        >
          <span class="text-slate-600 select-none text-[9px] pt-0.5 shrink-0">{{ idx + 1 }}</span>
          <span
            :class="[
              log.stream === 'stderr'
                ? 'text-rose-400 font-semibold'
                : log.stream === 'system'
                ? 'text-cyan-400 font-bold'
                : 'text-emerald-300'
            ]"
          >
            {{ log.content }}
          </span>
        </div>
      </div>
    </div>

    <!-- 4. TOOL CALLS ACCORDION -->
    <div
      v-if="toolCalls.length"
      class="p-4 rounded-2xl border space-y-2.5"
      :class="isDarkMode ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-slate-200'"
    >
      <div class="flex items-center justify-between text-xs">
        <span class="font-mono font-bold uppercase tracking-wider text-slate-400 text-[10px]">
          Agent Tool Calls Timeline ({{ toolCalls.length }})
        </span>
      </div>

      <div class="space-y-1.5">
        <div
          v-for="tc in toolCalls"
          :key="tc.id"
          class="rounded-xl border overflow-hidden transition-all text-xs"
          :class="isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'"
        >
          <div
            @click="activeToolAccordion = activeToolAccordion === tc.id ? null : tc.id"
            class="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/30"
          >
            <div class="flex items-center gap-2 min-w-0 font-mono text-[11px]">
              <Icons name="Wrench" :size="13" class="text-emerald-400 shrink-0" />
              <span class="font-bold truncate text-slate-200">{{ tc.tool }}</span>
              <span v-if="tc.durationMs" class="text-slate-500 text-[9px]">({{ tc.durationMs }}ms)</span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span
                class="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase border"
                :class="tc.status === 'failed' ? 'bg-rose-950 text-rose-400 border-rose-800' : 'bg-emerald-950 text-emerald-400 border-emerald-800'"
              >
                {{ tc.status }}
              </span>
              <Icons :name="activeToolAccordion === tc.id ? 'ChevronUp' : 'ChevronDown'" :size="12" class="text-slate-400" />
            </div>
          </div>

          <!-- Expanded Tool Details -->
          <div
            v-if="activeToolAccordion === tc.id"
            class="p-3 border-t font-mono text-[10px] space-y-2"
            :class="isDarkMode ? 'border-slate-800 bg-black/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-800'"
          >
            <div v-if="tc.params">
              <span class="text-slate-500 block mb-0.5 font-bold">INPUT PARAMETERS:</span>
              <pre class="overflow-x-auto p-1.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">{{ typeof tc.params === 'string' ? tc.params : JSON.stringify(tc.params, null, 2) }}</pre>
            </div>
            <div v-if="tc.output">
              <span class="text-slate-500 block mb-0.5 font-bold">RESULT / OUTPUT:</span>
              <pre class="overflow-x-auto p-1.5 rounded bg-slate-950 text-emerald-300 border border-slate-800 max-h-32">{{ typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. VERIFICATION EVIDENCE & HANDOFF SUMMARY -->
    <div
      v-if="activeRun?.evidence?.length || activeRun?.pull_request_url || activeRun?.commit_sha"
      class="p-4 rounded-2xl border space-y-3"
      :class="isDarkMode ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-slate-200'"
    >
      <div class="flex items-center justify-between text-xs">
        <span class="font-mono font-bold uppercase tracking-wider text-slate-400 text-[10px]">
          Verification Evidence & Structured Handoff
        </span>
      </div>

      <!-- Test Evidence Cards -->
      <div v-if="activeRun?.evidence?.length" class="space-y-2">
        <div
          v-for="ev in activeRun.evidence"
          :key="ev.id"
          class="p-3 rounded-xl border flex items-start justify-between gap-3 text-xs"
          :class="[
            ev.status === 'passed'
              ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900')
              : (isDarkMode ? 'bg-rose-950/20 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-900')
          ]"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-1.5">
              <Icons :name="ev.status === 'passed' ? 'CheckCircle' : 'AlertCircle'" :size="13" />
              <span class="font-bold">{{ ev.status === 'passed' ? 'Passed' : 'Failed' }}</span>
              <span class="font-mono text-[10px] opacity-80">· {{ ev.evidence_type }}</span>
            </div>
            <p v-if="ev.command" class="font-mono text-[10px] opacity-85 truncate">
              Command: {{ ev.command }}
            </p>
            <p v-if="ev.summary" class="text-[11px] leading-relaxed">
              {{ ev.summary }}
            </p>
          </div>
        </div>
      </div>

      <details v-if="handoffFiles.length" class="rounded-xl border border-slate-700/70 bg-slate-950/40">
        <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-200">Changed files ({{ handoffFiles.length }})</summary>
        <ul class="max-h-40 overflow-auto border-t border-slate-800 px-3 py-2 font-mono text-[11px] text-slate-300">
          <li v-for="file in handoffFiles" :key="file" class="py-0.5">{{ file }}</li>
        </ul>
      </details>

      <div v-if="autoReview" class="rounded-xl border border-violet-700/60 bg-violet-950/20 p-3 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold text-violet-200">Independent review loop</span>
          <span class="rounded-full border border-violet-500/40 px-2 py-0.5 font-mono text-[10px] uppercase text-violet-300">{{ autoReview.status || 'recorded' }}</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-300">Reviewer: {{ autoReview.reviewer_provider || 'second local agent' }} · {{ autoReview.iterations || 0 }} round(s)</p>
        <p v-if="autoReview.feedback" class="mt-2 whitespace-pre-wrap leading-relaxed text-slate-200">{{ autoReview.feedback }}</p>
        <p class="mt-2 text-[11px] text-violet-200/80">This is additional evidence. Final approval and merge remain a human action on Hub.</p>
      </div>

      <!-- PR & Git Commit Links -->
      <div class="flex flex-wrap items-center gap-3 pt-1 text-xs">
        <a
          v-if="activeRun?.pull_request_url"
          :href="activeRun.pull_request_url"
          target="_blank"
          rel="noreferrer"
          class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Icons name="GitPullRequest" :size="13" />
          <span>View Pull Request</span>
        </a>

        <span v-if="activeRun?.commit_sha" class="font-mono text-[10px] text-slate-400 flex items-center gap-1">
          <Icons name="GitBranch" :size="11" />
          <span>Commit:</span>
          <code class="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">{{ activeRun.commit_sha.slice(0, 7) }}</code>
        </span>
      </div>
    </div>

    <!-- Final Approval Actions -->
    <div
      v-if="activeRun?.status === 'needs_review' || activeRun?.status === 'verified'"
      class="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between gap-3 shadow-md"
    >
      <div>
        <h4 class="font-bold text-xs text-emerald-400">
          Automated Handoff Ready for Final Review
        </h4>
        <p class="text-[11px] text-slate-300">
          All test evidence has passed. Click below to approve and mark this task as Done.
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <button
          @click="rejectSafetyOrHandoff"
          :disabled="isRejecting"
          class="px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 font-bold text-xs transition-all hover:bg-amber-500/20 disabled:opacity-60"
        >{{ isRejecting ? 'Sending…' : 'Request changes' }}</button>
        <button
          @click="approveSafetyOrHandoff"
          :disabled="isApproving"
          class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95 shrink-0"
        >
          <Icons name="Check" :size="13" />
          <span>{{ isApproving ? 'Approving...' : 'Approve & Mark Done' }}</span>
        </button>
      </div>
    </div>

    <!-- Feedback Message -->
    <p v-if="isActionFeedback" class="text-xs text-emerald-400 font-medium">
      {{ isActionFeedback }}
    </p>
  </div>
</template>

<style scoped>
.streamback-console {
  contain: layout style;
}
</style>
