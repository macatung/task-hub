<script setup lang="ts">
import type { SafetyInterceptEvent } from '../utils/safetyGuardrails';

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
    class="w-full my-3 p-4 rounded-xl border border-red-500/80 bg-red-950/70 text-slate-100 shadow-2xl backdrop-blur-md animate-pulse-glow"
    role="alert"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="p-2.5 rounded-lg bg-red-900/60 border border-red-700/50 text-red-300 text-lg flex items-center justify-center shrink-0">
          ⚠️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
              :class="{
                'bg-red-600 text-white': alert.riskLevel === 'critical',
                'bg-amber-600 text-white': alert.riskLevel === 'high',
                'bg-yellow-600 text-black': alert.riskLevel === 'medium',
                'bg-slate-700 text-slate-200': !['critical', 'high', 'medium'].includes(alert.riskLevel)
              }"
            >
              {{ alert.riskLevel }} Risk Guardrail
            </span>
            <span class="text-xs font-semibold text-red-200 font-mono">
              Action Intercepted &middot; Waiting Developer Approval
            </span>
          </div>

          <p class="text-xs text-red-200/90 mt-1 leading-relaxed">
            {{ alert.reason }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="handleReject"
          class="px-3 py-1.5 rounded-lg border border-red-700/80 bg-red-900/40 hover:bg-red-800/80 text-red-200 hover:text-white text-xs font-medium cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
          title="Reject command and halt execution"
        >
          <span>✕</span>
          <span>Reject & Abort</span>
        </button>
        <button
          @click="handleApprove"
          class="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-1.5"
          title="Approve command and proceed"
        >
          <span>✓</span>
          <span>Approve & Continue</span>
        </button>
      </div>
    </div>

    <!-- Monospace Command / Conflict Snippet Box -->
    <div v-if="alert.command" class="mt-3 p-2.5 rounded-lg bg-black/70 border border-red-900/50 font-mono text-[11px] text-red-200 overflow-x-auto select-text">
      <div class="text-[9px] uppercase tracking-wider text-red-400 font-semibold mb-1">Target Command / Pattern</div>
      <pre class="whitespace-pre-wrap break-all leading-tight">{{ alert.command }}</pre>
    </div>

    <!-- Extra metadata if present -->
    <div v-if="alert.details?.filePath" class="mt-2 text-[10px] font-mono text-slate-400">
      Target File: <code class="text-red-300 font-bold">{{ alert.details.filePath }}</code>
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
