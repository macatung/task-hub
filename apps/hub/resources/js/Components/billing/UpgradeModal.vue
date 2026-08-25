<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useUpgradeModal, type QuotaPayload } from '@/composables/useUpgradeModal';
import Icons from '@/Components/ui/Icons.vue';

interface Props {
  modelValue?: boolean;
  quota?: QuotaPayload | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

const { isOpen: composableIsOpen, quotaData: composableQuotaData, closeUpgradeModal } = useUpgradeModal();

const isVisible = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue;
  }
  return composableIsOpen.value;
});

const currentQuota = computed<QuotaPayload>(() => {
  if (props.quota) return props.quota;
  if (composableQuotaData.value) return composableQuotaData.value;
  return {
    resource: 'runners',
    current_usage: 1,
    limit: 1,
    current_plan: 'community',
    suggested_plan: 'pro',
    upgrade_url: '/pricing',
    message: 'You have reached the limit for your current plan.',
  };
});

const resourceTitle = computed(() => {
  switch (currentQuota.value.resource) {
    case 'runners':
      return 'Concurrent Runner Limit Reached';
    case 'seats':
      return 'Workspace Seat Limit Reached';
    case 'projects':
      return 'Active Project Limit Reached';
    default:
      return 'Plan Quota Limit Reached';
  }
});

const planNames: Record<string, string> = {
  community: 'Community',
  pro: 'Pro Developer',
  team: 'Team / Startup',
  enterprise: 'Enterprise',
};

const currentPlanName = computed(() => planNames[currentQuota.value.current_plan] || currentQuota.value.current_plan);
const suggestedPlanName = computed(() => planNames[currentQuota.value.suggested_plan] || currentQuota.value.suggested_plan);

const planPerks = computed(() => {
  switch (currentQuota.value.suggested_plan) {
    case 'pro':
      return [
        '3 Concurrent Desktop Runners',
        'Unlimited Projects & Roadmaps',
        '1 Developer Seat included',
        'Priority AI task dispatch & fast streaming',
        '90-day agent run history retention',
      ];
    case 'team':
      return [
        '10 Concurrent Desktop Runners',
        '10 Team Member Seats included',
        'Unlimited Projects & Epics',
        'Team Shared Credential Vaults',
        'Fleet Dashboard & Velocity Analytics',
      ];
    case 'enterprise':
      return [
        'Unlimited Concurrent Runners & Fleets',
        'Unlimited Team Seats',
        'Dedicated On-Premise Runner Appliances',
        'Custom SAML/SSO & 99.9% SLA',
        'Custom Billing & Procurement Invoicing',
      ];
    default:
      return [
        'Higher runner concurrency limits',
        'Unlimited project creation',
        'Team collaboration seats',
        'Priority support',
      ];
  }
});

const currentLimitDisplay = computed(() => {
  if (currentQuota.value.limit === null) return 'Unlimited';
  const res = currentQuota.value.resource;
  const unit = res === 'runners' ? 'runner' : (res === 'seats' ? 'seat' : 'project');
  return `${currentQuota.value.limit} ${unit}${currentQuota.value.limit > 1 ? 's' : ''}`;
});

const suggestedLimitDisplay = computed(() => {
  switch (currentQuota.value.suggested_plan) {
    case 'pro':
      if (currentQuota.value.resource === 'runners') return '3 runners';
      if (currentQuota.value.resource === 'projects') return 'Unlimited';
      return '1 seat';
    case 'team':
      if (currentQuota.value.resource === 'runners') return '10 runners';
      if (currentQuota.value.resource === 'projects') return 'Unlimited';
      return '10 seats';
    case 'enterprise':
      return 'Unlimited';
    default:
      return 'Higher limits';
  }
});

const upgradeTargetUrl = computed(() => {
  const base = currentQuota.value.upgrade_url || '/pricing';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}plan=${currentQuota.value.suggested_plan}`;
});

const handleClose = () => {
  emit('update:modelValue', false);
  emit('close');
  closeUpgradeModal();
};

const handleUpgradeNavigate = () => {
  window.location.href = upgradeTargetUrl.value;
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isVisible.value) {
    handleClose();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isVisible"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        :aria-label="resourceTitle"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          @click="handleClose"
        />

        <!-- Modal Card -->
        <div
          class="relative w-full max-w-lg rounded-3xl border border-slate-700/80 bg-[#0c1220] p-6 sm:p-8 text-slate-100 shadow-2xl shadow-purple-950/40 overflow-hidden my-auto"
        >
          <!-- Decorative Glow -->
          <div class="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br from-purple-600/30 to-amber-500/20 blur-3xl pointer-events-none" />
          <div class="absolute -left-24 -bottom-24 h-48 w-48 rounded-full bg-gradient-to-tr from-emerald-600/20 to-cyan-500/20 blur-3xl pointer-events-none" />

          <!-- Header -->
          <div class="flex items-start justify-between gap-4 relative z-10">
            <div class="flex items-center gap-3.5">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/40 text-amber-400 shadow-inner">
                <Icons name="Zap" :size="24" class="text-amber-400 animate-pulse" />
              </div>
              <div>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Quota Exceeded
                </span>
                <h3 class="mt-1 text-lg sm:text-xl font-bold font-display text-white">
                  {{ resourceTitle }}
                </h3>
              </div>
            </div>

            <button
              type="button"
              @click="handleClose"
              class="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <Icons name="X" :size="18" />
            </button>
          </div>

          <!-- Description Message -->
          <p class="mt-4 text-sm text-slate-300 leading-relaxed relative z-10">
            {{ currentQuota.message || 'You have reached the maximum allowed capacity for your current subscription. Upgrade your workspace plan to unlock higher limits and uninterrupted agent concurrency.' }}
          </p>

          <!-- Capacity Comparison Widget -->
          <div class="mt-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 relative z-10">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Limit Comparison</span>
              <span class="font-mono text-amber-400">{{ currentQuota.current_usage }} in use</span>
            </div>

            <div class="grid grid-cols-2 gap-3 items-center">
              <!-- Current Plan Card -->
              <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
                <span class="text-[11px] font-semibold text-slate-400 block">{{ currentPlanName }}</span>
                <span class="text-base font-bold text-slate-300 font-mono mt-0.5 block">
                  {{ currentLimitDisplay }}
                </span>
                <span class="text-[10px] text-rose-400 font-medium mt-1 block">Current Limit</span>
              </div>

              <!-- Suggested Plan Card -->
              <div class="rounded-xl border border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 to-slate-950/60 p-3 text-center shadow-lg shadow-emerald-950/30 relative">
                <span class="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                  Recommended
                </span>
                <span class="text-[11px] font-semibold text-emerald-300 block">{{ suggestedPlanName }}</span>
                <span class="text-base font-bold text-white font-mono mt-0.5 block">
                  {{ suggestedLimitDisplay }}
                </span>
                <span class="text-[10px] text-emerald-400 font-semibold mt-1 block">Upgrade Tier</span>
              </div>
            </div>
          </div>

          <!-- Feature Perks -->
          <div class="mt-5 relative z-10">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <Icons name="Sparkles" :size="14" class="text-emerald-400" />
              <span>Included in {{ suggestedPlanName }}</span>
            </h4>
            <ul class="space-y-2">
              <li
                v-for="(perk, idx) in planPerks"
                :key="idx"
                class="flex items-start gap-2 text-xs text-slate-300"
              >
                <Icons name="CheckCircle" :size="15" class="text-emerald-400 shrink-0 mt-0.5" />
                <span>{{ perk }}</span>
              </li>
            </ul>
          </div>

          <!-- Actions -->
          <div class="mt-7 flex flex-col sm:flex-row items-center gap-3 relative z-10">
            <button
              type="button"
              @click="handleUpgradeNavigate"
              class="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Icons name="Zap" :size="16" />
              <span>Upgrade to {{ suggestedPlanName }}</span>
            </button>

            <a
              :href="currentQuota.upgrade_url"
              class="w-full sm:w-auto py-3 px-4 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs text-center transition-colors cursor-pointer"
            >
              View All Plans
            </a>
          </div>

          <!-- Footer note -->
          <p class="mt-4 text-center text-[11px] text-slate-400 relative z-10">
            Need custom runner capacity or on-premise appliances?
            <a href="/pricing#contact" class="text-cyan-400 hover:underline font-semibold ml-1">Contact Enterprise Sales</a>
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
