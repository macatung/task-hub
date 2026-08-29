<script setup lang="ts">
import { computed, ref } from 'vue';
import TailwindIcon from './TailwindIcon.vue';

export interface PlanUpgradeModalProps {
  show: boolean;
  currentPlan?: string;
  currentLimit?: number;
  activeCount?: number;
  workspaceSlug?: string;
  taskHubUrl?: string;
  reasonMessage?: string;
}

const props = withDefaults(defineProps<PlanUpgradeModalProps>(), {
  show: false,
  currentPlan: 'community',
  currentLimit: 1,
  activeCount: 1,
  workspaceSlug: '',
  taskHubUrl: '',
  reasonMessage: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'upgrade', url: string): void;
}>();

const billingCycle = ref<'monthly' | 'annual'>('annual');

const normalizedPlan = computed(() => (props.currentPlan || 'community').toLowerCase().trim());

const formattedPlanName = computed(() => {
  const plan = normalizedPlan.value;
  switch (plan) {
    case 'pro':
      return 'Pro';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Enterprise';
    case 'community':
    default:
      return 'Community';
  }
});

const formattedReason = computed(() => {
  if (props.reasonMessage && props.reasonMessage.trim()) {
    return props.reasonMessage.trim();
  }
  return 'Concurrent runner limit reached for your current plan. Upgrade to run multiple AI agents simultaneously.';
});

const billingUrl = computed(() => {
  const base = (
    props.taskHubUrl ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TASK_HUB_URL) ||
    'https://midnight.macatung.dev'
  ).replace(/\/$/, '');

  if (props.workspaceSlug && props.workspaceSlug.trim()) {
    return `${base}/workspaces/${encodeURIComponent(props.workspaceSlug.trim())}/billing`;
  }
  return `${base}/pricing`;
});

const handleUpgrade = (customUrl?: string) => {
  const targetUrl = customUrl || billingUrl.value;
  try {
    if (typeof window !== 'undefined' && (window as any).desktopApi?.openExternal) {
      (window as any).desktopApi.openExternal(targetUrl);
    } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(targetUrl, '_blank');
    }
  } catch (err) {
    console.warn('Failed to open external billing URL:', err);
  }
  emit('upgrade', targetUrl);
  emit('close');
};
</script>

<template>
  <div
    v-if="show"
    data-testid="plan-upgrade-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl bg-[#1e1e1e] border border-[#3e3e42] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-200"
      @mousedown.stop
    >
      <!-- Header -->
      <div class="h-14 px-5 border-b border-[#2d2d2d] bg-[#252526] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center">
            <TailwindIcon name="sparkles" :size="16" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <span>Runner Limit Reached — Upgrade Plan</span>
            </h2>
            <p class="text-[11px] text-zinc-400">Scale concurrent AI runners, workspace seats, and priority execution</p>
          </div>
        </div>

        <button
          data-testid="close-modal-button"
          class="w-7 h-7 rounded-lg hover:bg-[#333333] text-zinc-400 hover:text-white grid place-items-center transition-colors cursor-pointer"
          title="Close modal"
          @click="emit('close')"
        >
          <TailwindIcon name="x" :size="14" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        <!-- Current Quota Alert Banner -->
        <div
          data-testid="current-plan-banner"
          class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-3 text-amber-200"
        >
          <div class="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <TailwindIcon name="alert-triangle" :size="14" />
          </div>
          <div class="flex-1 min-w-0 text-xs">
            <div class="font-semibold text-amber-100 flex items-center gap-2">
              <span>{{ formattedPlanName }} Plan — {{ activeCount }}/{{ currentLimit }} concurrent runner{{ currentLimit === 1 ? '' : 's' }} in use</span>
            </div>
            <p class="mt-0.5 text-[11px] text-amber-200/90 leading-relaxed">
              {{ formattedReason }}
            </p>
          </div>
        </div>

        <!-- Billing Cycle Toggle -->
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Available Subscription Tiers</span>
          <div class="flex items-center gap-1 bg-[#252526] p-1 rounded-lg border border-[#333333]">
            <button
              type="button"
              class="px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer font-medium"
              :class="billingCycle === 'monthly' ? 'bg-[#37373d] text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'"
              @click="billingCycle = 'monthly'"
            >
              Monthly
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer font-medium flex items-center gap-1.5"
              :class="billingCycle === 'annual' ? 'bg-sky-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'"
              @click="billingCycle = 'annual'"
            >
              <span>Annual</span>
              <span class="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-400 text-zinc-950">SAVE 20%</span>
            </button>
          </div>
        </div>

        <!-- Tier Comparison Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- PRO TIER -->
          <div
            data-testid="tier-card-pro"
            class="relative rounded-xl border p-4 flex flex-col justify-between transition-all bg-[#252526]/80 hover:bg-[#252526] border-sky-500/50 shadow-lg shadow-sky-950/20"
          >
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-sky-500 text-zinc-950">
              POPULAR
            </div>

            <div class="space-y-2.5">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Pro</span>
                </h3>
                <p class="text-[11px] text-zinc-400 mt-0.5">For solo power developers and active autonomous agents</p>
              </div>

              <div class="flex items-baseline gap-1">
                <span class="text-xl font-extrabold text-white font-mono">
                  {{ billingCycle === 'annual' ? '$15' : '$19' }}
                </span>
                <span class="text-[11px] text-zinc-400">/ month</span>
              </div>
              <p v-if="billingCycle === 'annual'" class="text-[10px] text-sky-400 font-mono">Billed annually ($180/yr)</p>

              <div class="border-t border-[#333333] pt-2.5 space-y-1.5 text-[11px]">
                <div class="flex items-center gap-2 text-sky-200 font-semibold">
                  <TailwindIcon name="zap" :size="13" class="text-sky-400 shrink-0" />
                  <span>3 Concurrent Runners</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Unlimited Projects</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Priority AI Agent Queue</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>1 User Seat included</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="mt-4 w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer text-center"
              @click="handleUpgrade()"
            >
              Select Pro
            </button>
          </div>

          <!-- TEAM TIER -->
          <div
            data-testid="tier-card-team"
            class="relative rounded-xl border p-4 flex flex-col justify-between transition-all bg-[#252526]/80 hover:bg-[#252526] border-purple-500/50 shadow-lg shadow-purple-950/20"
          >
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-purple-500 text-white">
              TEAM
            </div>

            <div class="space-y-2.5">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Team</span>
                </h3>
                <p class="text-[11px] text-zinc-400 mt-0.5">For engineering teams scaling parallel AI workflows</p>
              </div>

              <div class="flex items-baseline gap-1">
                <span class="text-xl font-extrabold text-white font-mono">
                  {{ billingCycle === 'annual' ? '$39' : '$49' }}
                </span>
                <span class="text-[11px] text-zinc-400">/ month</span>
              </div>
              <p v-if="billingCycle === 'annual'" class="text-[10px] text-purple-400 font-mono">Billed annually ($468/yr)</p>

              <div class="border-t border-[#333333] pt-2.5 space-y-1.5 text-[11px]">
                <div class="flex items-center gap-2 text-purple-200 font-semibold">
                  <TailwindIcon name="zap" :size="13" class="text-purple-400 shrink-0" />
                  <span>10 Concurrent Runners</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>5 Workspace Seats included</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Shared Team MCPs & Skills</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Centralized Run Telemetry</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="mt-4 w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer text-center"
              @click="handleUpgrade()"
            >
              Select Team
            </button>
          </div>

          <!-- ENTERPRISE TIER -->
          <div
            data-testid="tier-card-enterprise"
            class="relative rounded-xl border p-4 flex flex-col justify-between transition-all bg-[#252526]/50 hover:bg-[#252526] border-[#3e3e42]"
          >
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-zinc-700 text-zinc-200">
              SCALE
            </div>

            <div class="space-y-2.5">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Enterprise</span>
                </h3>
                <p class="text-[11px] text-zinc-400 mt-0.5">Custom concurrency, SLA, and dedicated infrastructure</p>
              </div>

              <div class="flex items-baseline gap-1">
                <span class="text-xl font-extrabold text-white font-mono">Custom</span>
                <span class="text-[11px] text-zinc-400">/ enterprise</span>
              </div>
              <p class="text-[10px] text-zinc-400 font-mono">Starts at $199/mo or custom quote</p>

              <div class="border-t border-[#333333] pt-2.5 space-y-1.5 text-[11px]">
                <div class="flex items-center gap-2 text-zinc-200 font-semibold">
                  <TailwindIcon name="zap" :size="13" class="text-amber-400 shrink-0" />
                  <span>Unlimited / Custom Runners</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Unlimited Seats & SSO / SAML</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Dedicated 24/7 Support & SLA</span>
                </div>
                <div class="flex items-center gap-2 text-zinc-300">
                  <TailwindIcon name="check" :size="13" class="text-emerald-400 shrink-0" />
                  <span>Self-Hosted Runners Option</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="mt-4 w-full py-1.5 rounded-lg bg-[#37373d] hover:bg-[#45454c] text-zinc-200 text-xs font-semibold transition-all cursor-pointer text-center"
              @click="handleUpgrade()"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-[#2d2d2d] bg-[#252526] flex items-center justify-between shrink-0">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#333333] text-xs font-medium transition-colors cursor-pointer"
          @click="emit('close')"
        >
          Cancel
        </button>

        <div class="flex items-center gap-2">
          <button
            data-testid="upgrade-cta-button"
            type="button"
            class="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:from-sky-600 active:to-blue-700 text-white text-xs font-bold shadow-lg shadow-sky-900/30 flex items-center gap-1.5 transition-all cursor-pointer"
            @click="handleUpgrade()"
          >
            <span>Upgrade to Pro / Team on Web Hub</span>
            <TailwindIcon name="arrow-right" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
