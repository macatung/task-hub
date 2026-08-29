<script setup lang="ts">
import type { SafetyInterceptEvent } from '../utils/safetyGuardrails';
import TailwindIcon from './TailwindIcon.vue';

const props = defineProps<{
  alert: SafetyInterceptEvent | null;
}>();

const emit = defineEmits<{
  (e: 'approve', eventId: string): void;
  (e: 'reject', eventId: string): void;
}>();

const handleApprove = () => {
  if (props.alert) {
    emit('approve', props.alert.eventId);
  }
};

const handleReject = () => {
  if (props.alert) {
    emit('reject', props.alert.eventId);
  }
};
</script>

<template>
  <div
    v-if="alert"
    class="w-full my-3 p-4 rounded-xl border border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-[#190d14] to-[#070b14] text-slate-100 shadow-2xl backdrop-blur-md animate-pulse-glow"
    role="alert"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-lg bg-rose-900/60 border border-rose-700/50 text-rose-300 inline-flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
          <TailwindIcon name="alert-triangle" :size="20" class="text-rose-400 shrink-0" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono inline-flex items-center justify-center gap-1 shrink-0"
              :class="{
                'bg-red-600 text-white': alert.riskLevel === 'critical',
                'bg-amber-600 text-white': alert.riskLevel === 'high',
                'bg-yellow-600 text-black': alert.riskLevel === 'medium',
                'bg-slate-700 text-slate-200': !['critical', 'high', 'medium'].includes(alert.riskLevel)
              }"
            >
              <TailwindIcon name="shield" :size="10" class="shrink-0" />
              <span>{{ alert.riskLevel }} Risk Guardrail</span>
            </span>
            <span class="text-xs font-semibold text-rose-200 font-mono">
              Action Intercepted &middot; Waiting Developer Approval
            </span>
          </div>

          <p class="text-xs text-rose-200/90 mt-1 leading-relaxed">
            {{ alert.reason }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="handleReject"
          class="inline-flex items-center justify-center shrink-0 px-3 py-1.5 rounded-lg border border-rose-700/80 bg-rose-900/40 hover:bg-rose-800/80 text-rose-200 hover:text-white text-xs font-medium cursor-pointer transition-all shadow-sm gap-1.5"
          title="Reject command and halt execution"
        >
          <TailwindIcon name="x" :size="13" class="shrink-0" />
          <span>Reject & Abort</span>
        </button>
        <button
          @click="handleApprove"
          class="inline-flex items-center justify-center shrink-0 px-4 py-1.5 rounded-lg bg-[#00f5a0] hover:bg-[#00f5d4] text-black text-xs font-bold cursor-pointer transition-all shadow-md gap-1.5"
          title="Approve command and proceed"
        >
          <TailwindIcon name="check" :size="13" class="shrink-0" />
          <span>Approve & Continue</span>
        </button>
      </div>
    </div>

    <!-- Monospace Command / Conflict Snippet Box -->
    <div v-if="alert.command" class="mt-3 p-2.5 rounded-lg bg-black/80 border border-rose-900/50 font-mono text-[11px] text-rose-200 overflow-x-auto select-text">
      <div class="text-[9px] uppercase tracking-wider text-rose-400 font-semibold mb-1">Target Command / Pattern</div>
      <pre class="whitespace-pre-wrap break-all leading-tight">{{ alert.command }}</pre>
    </div>

    <!-- Extra metadata if present -->
    <div v-if="alert.details?.filePath" class="mt-2 text-[10px] font-mono text-slate-400">
      Target File: <code class="text-rose-300 font-bold">{{ alert.details.filePath }}</code>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.25);
  }
  50% {
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.45);
  }
}

.animate-pulse-glow {
  animation: pulseGlow 3s ease-in-out infinite;
}
</style>
