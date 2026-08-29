<script setup lang="ts">
import type { CaoWorkflowRunStatus, CaoWorkflowStepStatus, WorkflowKind } from '../../services/caoBridgeService';

const props = defineProps<{
  status: CaoWorkflowRunStatus | null;
  kind?: WorkflowKind;
  epicTitle?: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  resume: [];
  retry: [stepId?: string];
  cancel: [];
}>();

const stateLabel = (state?: string) => {
  const labels: Record<string, string> = {
    validating: 'Đang validate', running: 'Đang chạy', waiting_input: 'Chờ phản hồi',
    blocked: 'Bị chặn', completed: 'Hoàn tất', failed: 'Thất bại', interrupted: 'Bị gián đoạn', cancelled: 'Đã hủy',
  };
  return labels[state || ''] || state || 'Chưa chạy';
};

const stepLabel = (step: CaoWorkflowStepStatus) => step.label || step.taskKey || step.id;
const stepTone = (state: string) => {
  if (state === 'completed') return 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20';
  if (['failed', 'blocked'].includes(state)) return 'text-rose-300 border-rose-500/30 bg-rose-950/20';
  if (['running', 'waiting_input'].includes(state)) return 'text-amber-300 border-amber-500/30 bg-amber-950/20';
  return 'text-zinc-400 border-[#1b2940] bg-[#0b1220]';
};
</script>

<template>
  <section class="rounded-xl border border-[#1b2940] bg-[#070b14] p-4 text-zinc-100 shadow-inner" data-testid="cao-workflow-panel">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[#1b2940] pb-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-300 border border-cyan-500/30">STRICT WORKFLOW</span>
          <span v-if="kind === 'epic'" class="text-[10px] font-mono text-purple-300">EPIC</span>
        </div>
        <h3 class="mt-1 text-sm font-bold text-white">{{ epicTitle || status?.workflowName || 'CAO workflow' }}</h3>
        <p class="mt-1 text-[10px] font-mono text-zinc-500">CAO run: {{ status?.runId || (status?.state === 'failed' ? 'chưa tạo — validation failed' : 'chưa tạo') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold" :class="stepTone(status?.state || 'pending')">{{ stateLabel(status?.state) }}</span>
        <button v-if="status && ['interrupted', 'blocked'].includes(status.state)" class="cc-button text-[11px]" @click="emit('resume')">Resume</button>
        <button v-if="status && ['failed', 'blocked'].includes(status.state)" class="cc-button text-[11px]" @click="emit('retry', status.currentStep)">Retry from step</button>
        <button v-if="status && ['validating', 'running', 'waiting_input'].includes(status.state)" class="cc-button text-[11px]" @click="emit('cancel')">Cancel</button>
      </div>
    </header>

    <div class="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
      <span>Current step / total: <b class="text-zinc-200">{{ status?.currentStep || '—' }}</b></span>
      <span class="font-mono">{{ status?.completedSteps?.length || 0 }}/{{ status?.totalSteps || status?.steps?.length || 0 }}</span>
    </div>

    <ol v-if="status?.steps?.length" class="mt-3 space-y-2">
      <li v-for="step in status.steps" :key="step.id" class="flex items-start gap-2 rounded-lg border px-3 py-2" :class="stepTone(step.state)">
        <span class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-current text-[9px]">{{ step.state === 'completed' ? '✓' : '·' }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-xs font-semibold">{{ stepLabel(step) }}</span>
            <span class="shrink-0 text-[10px] font-mono uppercase">{{ step.state }}</span>
          </div>
          <p v-if="step.error" class="mt-1 text-[10px] leading-4 text-rose-200">{{ step.error }}</p>
        </div>
      </li>
    </ol>
    <p v-else class="mt-3 rounded-lg border border-dashed border-[#1b2940] px-3 py-4 text-center text-[11px] text-zinc-500">Workflow steps sẽ xuất hiện sau khi CAO trả status.</p>
    <p v-if="status?.error" class="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">{{ status.error }}</p>
  </section>
</template>
