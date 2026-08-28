<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Head, usePage } from '@inertiajs/vue3';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';
import WorkspaceBrand from '@/Components/layout/WorkspaceBrand.vue';
import UpgradeModal from '@/Components/billing/UpgradeModal.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';

export interface WorkspaceProps {
  id: number;
  name: string;
  slug: string;
  plan?: string;
  agent_concurrency_limit?: number;
  owner_id?: number;
  user_role?: string;
}

export interface SubscriptionData {
  id?: number;
  plan_slug: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  seat_quantity: number;
  extra_runners_quantity: number;
  current_period_starts_at: string;
  current_period_ends_at: string;
  canceled_at?: string | null;
}

export interface UsageGauge {
  active: number;
  limit: number | null;
  percent: number;
}

export interface UsageSummary {
  runners: UsageGauge;
  seats: UsageGauge;
  projects: UsageGauge;
}

export interface PlanItem {
  id: number;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_runners: number | null;
  max_seats: number | null;
  max_projects: number | null;
  features: string[];
  limits?: Record<string, any>;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

export interface InvoiceItem {
  id: number;
  invoice_number: string;
  workspace_id: number;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  billing_reason?: string;
  description?: string;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string;
}

export interface WorkspaceOption {
  id: number;
  name: string;
  slug: string;
  plan?: string;
}

interface UserAuth {
  id: number;
  name: string;
  email: string;
  github_login?: string | null;
  github_avatar_url?: string | null;
}

interface PageProps {
  appName?: string;
  auth?: { user?: UserAuth | null };
  flash?: { success?: string | null; error?: string | null };
  workspace: WorkspaceProps;
  subscription: SubscriptionData;
  usage: UsageSummary;
  plans: PlanItem[];
  invoices: InvoiceItem[];
  workspaces?: WorkspaceOption[];
  currentWorkspaceId?: number;
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    workspace: WorkspaceProps;
    subscription: SubscriptionData;
    usage: UsageSummary;
    plans?: PlanItem[];
    invoices?: InvoiceItem[];
    workspaces?: WorkspaceOption[];
    currentWorkspaceId?: number;
  }>(),
  {
    plans: () => [],
    invoices: () => [],
    workspaces: () => [],
  }
);

const page = usePage<PageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const { openUpgradeModal } = useUpgradeModal();

// Theme State
const isDarkMode = ref(true);
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

// Billing Cycle selection
const billingCycle = ref<'monthly' | 'yearly'>(props.subscription?.billing_cycle || 'monthly');

// Add-ons State
const extraRunners = ref<number>(props.subscription?.extra_runners_quantity || 0);
const seatQuantity = ref<number>(props.subscription?.seat_quantity || 1);

// Reactive Data Copies
const localSubscription = ref<SubscriptionData>({ ...props.subscription });
const localUsage = ref<UsageSummary>({ ...props.usage });
const localInvoices = ref<InvoiceItem[]>([...props.invoices]);

// UI States
const isSubmitting = ref(false);
const submittingPlanSlug = ref<string | null>(null);
const isAddonsSubmitting = ref(false);
const isCancelingSubmitting = ref(false);
const showCancelModal = ref(false);
const isWorkspaceMenuOpen = ref(false);
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Fallback plans if database returned empty
const allPlans = computed<PlanItem[]>(() => {
  if (props.plans && props.plans.length > 0) {
    return props.plans;
  }
  return [
    {
      id: 1,
      slug: 'community',
      name: 'Community',
      tagline: 'For individual developers & hackers',
      description: 'Free forever with 1 concurrent runner and standard MCP support.',
      price_monthly: 0,
      price_yearly: 0,
      currency: 'USD',
      max_runners: 1,
      max_seats: 1,
      max_projects: 3,
      features: ['1 Concurrent Runner', 'Up to 3 Projects', '1 Personal Seat', 'Community Discord Support'],
      is_active: true,
      is_popular: false,
      sort_order: 1,
    },
    {
      id: 2,
      slug: 'pro',
      name: 'Pro Developer',
      tagline: 'For professional AI-augmented engineers',
      description: 'Triple concurrency, unlimited projects, and priority streaming.',
      price_monthly: 19,
      price_yearly: 180,
      currency: 'USD',
      max_runners: 3,
      max_seats: 1,
      max_projects: null,
      features: ['3 Concurrent Runners', 'Unlimited Projects', '1 Developer Seat', 'Priority AI Dispatch', '90-Day History'],
      is_active: true,
      is_popular: true,
      sort_order: 2,
    },
    {
      id: 3,
      slug: 'team',
      name: 'Team / Startup',
      tagline: 'For collaborative engineering teams',
      description: '10 runners, 10 team seats, role-based access, and shared vaults.',
      price_monthly: 49,
      price_yearly: 468,
      currency: 'USD',
      max_runners: 10,
      max_seats: 10,
      max_projects: null,
      features: ['10 Concurrent Runners', '10 Team Seats', 'Unlimited Projects & Epics', 'Shared Credential Vaults', 'Fleet Dashboard'],
      is_active: true,
      is_popular: false,
      sort_order: 3,
    },
    {
      id: 4,
      slug: 'enterprise',
      name: 'Enterprise',
      tagline: 'For large orgs needing custom fleets & SLA',
      description: 'Unlimited scale, custom security appliances, SAML SSO, and 99.9% SLA.',
      price_monthly: 199,
      price_yearly: 1908,
      currency: 'USD',
      max_runners: null,
      max_seats: null,
      max_projects: null,
      features: ['Unlimited Runners', 'Unlimited Team Seats', 'Dedicated On-Prem Appliances', 'SAML SSO & Audit Logs', '24/7 SLA'],
      is_active: true,
      is_popular: false,
      sort_order: 4,
    },
  ];
});

// Computed active plan model
const currentPlanModel = computed(() => {
  return allPlans.value.find((p) => p.slug === localSubscription.value.plan_slug) || allPlans.value[0];
});

// Calculate display pricing for plan switch cards
const getDisplayPrice = (plan: PlanItem) => {
  if (plan.price_monthly === 0) return 0;
  if (billingCycle.value === 'yearly') {
    return Math.round(plan.price_yearly / 12);
  }
  return plan.price_monthly;
};

// Threshold coloring helper
const getThresholdColor = (percent: number) => {
  if (percent >= 90) {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500',
      border: 'border-rose-500/40',
      pill: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
  }
  if (percent >= 70) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500',
      border: 'border-amber-500/40',
      pill: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };
  }
  return {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    border: 'border-emerald-500/40',
    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
};

// Date formatter
const formatDate = (isoString?: string | null) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
};

// Format currency
const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format limit text
const formatLimit = (limit: number | null, unit: string) => {
  if (limit === null) return 'Unlimited';
  return `${limit} ${unit}${limit > 1 ? 's' : ''}`;
};

// Additional Add-on Pricing Calculation
const addonTotalMonthly = computed(() => {
  const runnerRate = billingCycle.value === 'yearly' ? 12 : 15;
  const seatRate = billingCycle.value === 'yearly' ? 8 : 10;
  const includedSeats = currentPlanModel.value?.max_seats || 1;
  const extraSeatsCount = Math.max(0, seatQuantity.value - includedSeats);
  return extraRunners.value * runnerRate + extraSeatsCount * seatRate;
});

// Contact Sales & Download Helpers
const handleContactSales = () => {
  if (typeof window !== 'undefined') {
    window.location.href = '/pricing#contact';
  }
};

const handleDownloadInvoice = (invoiceNumber: string) => {
  if (typeof window !== 'undefined') {
    window.alert(`Invoice ${invoiceNumber} receipt download simulated.`);
  }
};

// Switch / Upgrade Plan
const handleSwitchPlan = async (planSlug: string) => {
  if (submittingPlanSlug.value || isSubmitting.value) return;
  submittingPlanSlug.value = planSlug;
  isSubmitting.value = true;
  feedback.value = null;

  try {
    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/subscription`, {
      plan_slug: planSlug,
      billing_cycle: billingCycle.value,
      seat_quantity: seatQuantity.value,
      extra_runners_quantity: extraRunners.value,
    });

    if (res.data?.success) {
      localSubscription.value = res.data.data.subscription;
      if (res.data.data.usage) {
        localUsage.value = res.data.data.usage;
      }
      if (res.data.data.invoice) {
        localInvoices.value.unshift(res.data.data.invoice);
      }
      feedback.value = {
        type: 'success',
        message: `✓ Successfully switched workspace subscription to ${res.data.data.subscription.plan_name} (${res.data.data.subscription.billing_cycle}).`,
      };
    } else {
      feedback.value = {
        type: 'error',
        message: res.data?.message || 'Failed to update subscription.',
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || err.message || 'An unexpected error occurred while updating subscription.',
    };
  } finally {
    isSubmitting.value = false;
    submittingPlanSlug.value = null;
  }
};

// Update Add-ons
const handleApplyAddons = async () => {
  if (isAddonsSubmitting.value) return;
  isAddonsSubmitting.value = true;
  feedback.value = null;

  try {
    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/subscription`, {
      plan_slug: localSubscription.value.plan_slug,
      billing_cycle: localSubscription.value.billing_cycle,
      seat_quantity: seatQuantity.value,
      extra_runners_quantity: extraRunners.value,
    });

    if (res.data?.success) {
      localSubscription.value = res.data.data.subscription;
      if (res.data.data.usage) {
        localUsage.value = res.data.data.usage;
      }
      if (res.data.data.invoice) {
        localInvoices.value.unshift(res.data.data.invoice);
      }
      feedback.value = {
        type: 'success',
        message: '✓ Add-on capacity updated and invoice generated.',
      };
    } else {
      feedback.value = {
        type: 'error',
        message: res.data?.message || 'Failed to apply add-ons.',
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || err.message || 'Unable to update add-ons.',
    };
  } finally {
    isAddonsSubmitting.value = false;
  }
};

// Cancel Subscription
const handleCancelSubscription = async () => {
  if (isCancelingSubmitting.value) return;
  isCancelingSubmitting.value = true;
  feedback.value = null;

  try {
    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/subscription/cancel`);
    if (res.data?.success) {
      localSubscription.value.status = 'canceled';
      localSubscription.value.canceled_at = new Date().toISOString();
      showCancelModal.value = false;
      feedback.value = {
        type: 'success',
        message: 'Subscription has been canceled. Access remains active until period end.',
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || 'Unable to cancel subscription.',
    };
  } finally {
    isCancelingSubmitting.value = false;
  }
};

// Check for URL query param `?plan=` to focus on plan
onMounted(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam && allPlans.value.some((p) => p.slug === planParam)) {
      const planGrid = document.getElementById('plan-switcher-grid');
      if (planGrid) {
        planGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
});
</script>

<template>
  <Head :title="`${props.workspace.name} — Billing & Subscription`" />

  <div
    :class="[
      'min-h-screen font-sans transition-colors duration-150 selection:bg-emerald-500 selection:text-slate-950',
      isDarkMode ? 'dark bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900'
    ]"
  >
    <!-- ========================================================================= -->
    <!-- TOP NAVIGATION BAR                                                        -->
    <!-- ========================================================================= -->
    <header
      :class="[
        'sticky top-0 z-40 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4',
        isDarkMode ? 'bg-[#0c1220]/90 border-slate-800/80 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
      ]"
    >
      <!-- Left: Logo & Breadcrumbs -->
      <div class="flex items-center gap-3 min-w-0">
        <WorkspaceBrand :dark="isDarkMode" />

        <div class="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60 text-xs min-w-0 font-medium">
          <a href="/tasks" class="text-slate-400 hover:text-emerald-400 transition-colors">Workspace</a>
          <span class="text-slate-500">/</span>
          <span class="font-bold text-slate-200 truncate">{{ props.workspace.name }}</span>
          <span class="text-slate-500">/</span>
          <span class="text-emerald-400 font-bold">Billing & Quota</span>
        </div>
      </div>

      <!-- Right: Workspace Switcher + Back to Board + Theme + User Profile -->
      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Workspace Dropdown -->
        <div v-if="props.workspaces && props.workspaces.length > 1" class="relative">
          <button
            @click="isWorkspaceMenuOpen = !isWorkspaceMenuOpen"
            :class="[
              'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            ]"
          >
            <Icons name="Layers" :size="14" />
            <span class="max-w-[120px] truncate">{{ props.workspace.name }}</span>
            <Icons name="ChevronDown" :size="12" />
          </button>

          <div
            v-if="isWorkspaceMenuOpen"
            :class="[
              'absolute right-0 mt-2 w-56 rounded-2xl border p-2 shadow-2xl z-50',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            ]"
          >
            <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Workspace</div>
            <div class="mt-1 space-y-1">
              <a
                v-for="w in props.workspaces"
                :key="w.id"
                :href="`/workspaces/${w.id}/billing`"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  w.id === props.workspace.id
                    ? (isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-800 border border-emerald-200')
                    : (isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                ]"
              >
                <span class="truncate">{{ w.name }}</span>
                <span class="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{{ w.plan || 'community' }}</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Back to Workspace Tasks Board -->
        <a
          href="/tasks"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="LayoutGrid" :size="14" />
          <span class="hidden md:inline">Task Board</span>
        </a>

        <!-- Dark / Light Theme Toggle -->
        <button
          @click="toggleTheme"
          :class="[
            'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          ]"
          :title="isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <Icons :name="isDarkMode ? 'Sun' : 'Moon'" :size="15" />
        </button>

        <!-- User Profile Avatar -->
        <div v-if="user" class="flex items-center gap-2 pl-2 border-l border-slate-800">
          <img
            v-if="user.github_avatar_url"
            :src="user.github_avatar_url"
            alt="User Avatar"
            class="h-7 w-7 rounded-full border border-emerald-500/40 shadow-xs"
          />
          <span class="text-xs font-bold hidden lg:inline text-slate-300">@{{ user.github_login || user.name }}</span>
        </div>
      </div>
    </header>

    <!-- ========================================================================= -->
    <!-- MAIN BILLING CONTENT CONTAINER                                            -->
    <!-- ========================================================================= -->
    <main class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <!-- Title & Feedback Alert -->
      <div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-display font-black tracking-tight text-white flex items-center gap-3">
              <span>Billing & Subscription</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                {{ props.workspace.name }}
              </span>
            </h1>
            <p class="mt-1 text-sm text-slate-400">
              Manage your commercial subscription, monitor real-time resource quotas, and configure extra concurrency.
            </p>
          </div>

          <a
            href="/pricing"
            class="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>View Public Pricing Matrix</span>
            <Icons name="ExternalLink" :size="14" />
          </a>
        </div>

        <!-- Global Flash / Feedback Message -->
        <div
          v-if="feedback"
          :class="[
            'mt-4 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-md transition-all',
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          ]"
        >
          <div class="flex items-center gap-2.5">
            <Icons :name="feedback.type === 'success' ? 'CheckCircle' : 'AlertTriangle'" :size="18" />
            <span>{{ feedback.message }}</span>
          </div>
          <button @click="feedback = null" class="text-slate-400 hover:text-white p-1 cursor-pointer">
            <Icons name="X" :size="14" />
          </button>
        </div>
      </div>

      <!-- ======================================================================= -->
      <!-- 1. ACTIVE SUBSCRIPTION SUMMARY CARD                                     -->
      <!-- ======================================================================= -->
      <section
        class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 relative overflow-hidden shadow-xl"
      >
        <!-- Background Gradient Orb -->
        <div class="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-600/10 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center relative z-10">
          <!-- Left: Current Plan Details -->
          <div class="lg:col-span-2 space-y-4">
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="px-3.5 py-1 rounded-xl text-sm font-extrabold uppercase tracking-wider font-mono bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20"
              >
                {{ localSubscription.plan_name }}
              </span>

              <span
                :class="[
                  'px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border',
                  localSubscription.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                ]"
              >
                ● {{ localSubscription.status }}
              </span>

              <span class="text-xs font-semibold text-slate-400 capitalize">
                {{ localSubscription.billing_cycle }} billing cycle
              </span>
            </div>

            <p class="text-sm text-slate-300 max-w-xl">
              {{ currentPlanModel.description || 'Access powerful local AI agent execution and team synchronization capabilities.' }}
            </p>

            <div class="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              <div>
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Current Period End</span>
                <span class="font-bold text-slate-200">{{ formatDate(localSubscription.current_period_ends_at) }}</span>
              </div>
              <div>
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Included Seats</span>
                <span class="font-bold text-slate-200">{{ localSubscription.seat_quantity }} seats</span>
              </div>
              <div v-if="localSubscription.extra_runners_quantity > 0">
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Extra Runners</span>
                <span class="font-bold text-emerald-400">+{{ localSubscription.extra_runners_quantity }} runners</span>
              </div>
              <div>
                <span class="text-slate-500 block text-[10px] uppercase font-bold">Role in Workspace</span>
                <span class="font-mono text-slate-300 font-bold uppercase">{{ props.workspace.user_role || 'member' }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Price & Quick Action -->
          <div class="lg:border-l lg:border-slate-800 lg:pl-8 flex flex-col justify-between h-full space-y-4">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Current Plan Cost</span>
              <div class="mt-1 flex items-baseline gap-1.5">
                <span class="text-3xl sm:text-4xl font-display font-black text-white">
                  {{ formatCurrency(getDisplayPrice(currentPlanModel)) }}
                </span>
                <span class="text-xs font-semibold text-slate-400">/ month</span>
              </div>
              <span v-if="localSubscription.billing_cycle === 'yearly'" class="text-[11px] font-bold text-emerald-400 block mt-0.5">
                Billed annually (20% savings applied)
              </span>
            </div>

            <div class="flex flex-col sm:flex-row lg:flex-col gap-2 pt-2">
              <a
                href="#plan-switcher-grid"
                class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs text-center shadow-md transition-all cursor-pointer"
              >
                Change Workspace Plan
              </a>

              <button
                v-if="localSubscription.status === 'active' && localSubscription.plan_slug !== 'community'"
                type="button"
                @click="showCancelModal = true"
                class="py-2 px-3 rounded-xl border border-slate-800 hover:border-rose-800/60 hover:bg-rose-950/20 text-slate-400 hover:text-rose-300 text-xs font-semibold text-center transition-colors cursor-pointer"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- 2. USAGE PROGRESS GAUGES                                                -->
      <!-- ======================================================================= -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold font-display text-white flex items-center gap-2">
              <Icons name="Activity" :size="18" class="text-emerald-400" />
              <span>Resource Quotas & Real-Time Usage</span>
            </h2>
            <p class="text-xs text-slate-400">
              Live capacity metrics enforced across your connected runners and team members.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- Gauge 1: Concurrent Runners -->
          <div
            :class="[
              'rounded-3xl border bg-[#0c1220] p-5 relative overflow-hidden transition-all shadow-lg',
              getThresholdColor(localUsage.runners.percent).border
            ]"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Icons name="Terminal" :size="15" class="text-emerald-400" />
                <span>Concurrent Runners</span>
              </span>
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono',
                  getThresholdColor(localUsage.runners.percent).pill
                ]"
              >
                {{ localUsage.runners.percent }}%
              </span>
            </div>

            <div class="mt-4 flex items-baseline justify-between">
              <span class="text-2xl font-display font-black text-white font-mono">
                {{ localUsage.runners.active }}
                <span class="text-xs font-normal text-slate-400">/ {{ formatLimit(localUsage.runners.limit, 'runner') }}</span>
              </span>
              <span v-if="localSubscription.extra_runners_quantity > 0" class="text-[10px] font-bold text-emerald-400">
                +{{ localSubscription.extra_runners_quantity }} extra
              </span>
            </div>

            <!-- Progress Bar -->
            <div class="mt-3 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                :class="['h-full transition-all duration-500 rounded-full', getThresholdColor(localUsage.runners.percent).bg]"
                :style="{ width: `${Math.min(100, localUsage.runners.percent || (localUsage.runners.limit === null ? 5 : 0))}%` }"
              />
            </div>

            <p class="mt-3 text-[11px] text-slate-400">
              Active executions currently running across desktop companion agents.
            </p>
          </div>

          <!-- Gauge 2: Active Projects -->
          <div
            :class="[
              'rounded-3xl border bg-[#0c1220] p-5 relative overflow-hidden transition-all shadow-lg',
              getThresholdColor(localUsage.projects.percent).border
            ]"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Icons name="Layers" :size="15" class="text-purple-400" />
                <span>Active Projects</span>
              </span>
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono',
                  getThresholdColor(localUsage.projects.percent).pill
                ]"
              >
                {{ localUsage.projects.percent }}%
              </span>
            </div>

            <div class="mt-4 flex items-baseline justify-between">
              <span class="text-2xl font-display font-black text-white font-mono">
                {{ localUsage.projects.active }}
                <span class="text-xs font-normal text-slate-400">/ {{ formatLimit(localUsage.projects.limit, 'project') }}</span>
              </span>
            </div>

            <!-- Progress Bar -->
            <div class="mt-3 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                :class="['h-full transition-all duration-500 rounded-full', getThresholdColor(localUsage.projects.percent).bg]"
                :style="{ width: `${Math.min(100, localUsage.projects.percent || (localUsage.projects.limit === null ? 5 : 0))}%` }"
              />
            </div>

            <p class="mt-3 text-[11px] text-slate-400">
              Total connected GitHub repositories and workspace project boards.
            </p>
          </div>

          <!-- Gauge 3: Workspace Seats -->
          <div
            :class="[
              'rounded-3xl border bg-[#0c1220] p-5 relative overflow-hidden transition-all shadow-lg',
              getThresholdColor(localUsage.seats.percent).border
            ]"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Icons name="Sparkles" :size="15" class="text-cyan-400" />
                <span>Workspace Seats</span>
              </span>
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono',
                  getThresholdColor(localUsage.seats.percent).pill
                ]"
              >
                {{ localUsage.seats.percent }}%
              </span>
            </div>

            <div class="mt-4 flex items-baseline justify-between">
              <span class="text-2xl font-display font-black text-white font-mono">
                {{ localUsage.seats.active }}
                <span class="text-xs font-normal text-slate-400">/ {{ formatLimit(localUsage.seats.limit, 'seat') }}</span>
              </span>
            </div>

            <!-- Progress Bar -->
            <div class="mt-3 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                :class="['h-full transition-all duration-500 rounded-full', getThresholdColor(localUsage.seats.percent).bg]"
                :style="{ width: `${Math.min(100, localUsage.seats.percent || (localUsage.seats.limit === null ? 5 : 0))}%` }"
              />
            </div>

            <p class="mt-3 text-[11px] text-slate-400">
              Active team members and invited contributors in this workspace.
            </p>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- 3. INTERACTIVE PLAN SWITCHER GRID                                       -->
      <!-- ======================================================================= -->
      <section id="plan-switcher-grid" class="space-y-6 pt-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold font-display text-white">
              Upgrade or Switch Plan
            </h2>
            <p class="text-xs text-slate-400">
              Select the plan that fits your engineering team size and concurrency requirements.
            </p>
          </div>

          <!-- Billing Cycle Toggle -->
          <div class="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              @click="billingCycle = 'monthly'"
              :class="[
                'px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                billingCycle === 'monthly'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              ]"
            >
              Monthly
            </button>
            <button
              type="button"
              @click="billingCycle = 'yearly'"
              :class="[
                'px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              ]"
            >
              <span>Yearly</span>
              <span :class="['px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase', billingCycle === 'yearly' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400']">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <!-- Plans Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="plan in allPlans"
            :key="plan.id"
            :class="[
              'rounded-3xl border p-6 flex flex-col justify-between transition-all duration-200 relative',
              plan.slug === localSubscription.plan_slug
                ? 'bg-gradient-to-b from-emerald-950/30 to-[#0c1220] border-emerald-500/50 shadow-xl shadow-emerald-950/20'
                : (plan.is_popular ? 'bg-[#0e1626] border-purple-500/40 hover:border-purple-500/70 shadow-lg' : 'bg-[#0c1220] border-slate-800 hover:border-slate-700')
            ]"
          >
            <!-- Popular Badge -->
            <div
              v-if="plan.is_popular && plan.slug !== localSubscription.plan_slug"
              class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md"
            >
              Most Popular
            </div>

            <!-- Current Plan Badge -->
            <div
              v-if="plan.slug === localSubscription.plan_slug"
              class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md"
            >
              Current Active Plan
            </div>

            <div>
              <!-- Plan Header -->
              <h3 class="text-lg font-bold font-display text-white">
                {{ plan.name }}
              </h3>
              <p class="mt-1 text-xs text-slate-400 min-h-[32px]">
                {{ plan.tagline || plan.description }}
              </p>

              <!-- Price -->
              <div class="mt-4 pt-4 border-t border-slate-800/80 flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-black text-white">
                  {{ formatCurrency(getDisplayPrice(plan)) }}
                </span>
                <span class="text-xs font-semibold text-slate-400">/ month</span>
              </div>
              <div v-if="billingCycle === 'yearly' && plan.price_yearly > 0" class="text-[10px] text-emerald-400 font-semibold mt-0.5">
                Billed {{ formatCurrency(plan.price_yearly) }} yearly
              </div>
              <div v-else-if="plan.price_monthly === 0" class="text-[10px] text-slate-500 font-semibold mt-0.5">
                Free forever
              </div>

              <!-- Quota Breakdown -->
              <div class="mt-5 space-y-2.5">
                <div class="flex items-center gap-2 text-xs text-slate-300">
                  <Icons name="Terminal" :size="14" class="text-emerald-400 shrink-0" />
                  <span class="font-semibold">{{ formatLimit(plan.max_runners, 'Runner') }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-300">
                  <Icons name="Layers" :size="14" class="text-purple-400 shrink-0" />
                  <span class="font-semibold">{{ formatLimit(plan.max_projects, 'Project') }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-300">
                  <Icons name="Sparkles" :size="14" class="text-cyan-400 shrink-0" />
                  <span class="font-semibold">{{ formatLimit(plan.max_seats, 'Seat') }}</span>
                </div>
              </div>

              <!-- Feature Bullet Points -->
              <div class="mt-5 pt-4 border-t border-slate-800/80">
                <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Key Features</span>
                <ul class="space-y-2">
                  <li
                    v-for="(feature, fIdx) in plan.features.slice(0, 5)"
                    :key="fIdx"
                    class="flex items-start gap-2 text-[11px] text-slate-300"
                  >
                    <Icons name="Check" :size="13" class="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{{ feature }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- CTA Action Button -->
            <div class="mt-6 pt-4 border-t border-slate-800/80">
              <button
                v-if="plan.slug === localSubscription.plan_slug"
                disabled
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs cursor-default flex items-center justify-center gap-1.5"
              >
                <Icons name="Check" :size="14" />
                <span>Current Plan</span>
              </button>

              <button
                v-else-if="plan.slug === 'enterprise'"
                type="button"
                @click="handleContactSales"
                class="w-full py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Contact Sales</span>
                <Icons name="ExternalLink" :size="13" />
              </button>

              <button
                v-else
                type="button"
                :disabled="isSubmitting"
                @click="handleSwitchPlan(plan.slug)"
                :class="[
                  'w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md',
                  plan.is_popular
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-purple-950/40'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40'
                ]"
              >
                <Icons v-if="submittingPlanSlug === plan.slug" name="Zap" :size="14" class="animate-spin" />
                <Icons v-else name="Zap" :size="14" />
                <span>{{ submittingPlanSlug === plan.slug ? 'Switching...' : `Switch to ${plan.name}` }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- 4. ADD-ONS SECTION                                                      -->
      <!-- ======================================================================= -->
      <section class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 space-y-6 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold font-display text-white flex items-center gap-2">
              <Icons name="Plus" :size="18" class="text-emerald-400" />
              <span>Workspace Add-ons & Extra Capacity</span>
            </h2>
            <p class="text-xs text-slate-400">
              Need extra concurrency without changing tiers? Add dynamic runners and team seats on demand.
            </p>
          </div>

          <button
            type="button"
            :disabled="isAddonsSubmitting"
            @click="handleApplyAddons"
            class="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Icons v-if="isAddonsSubmitting" name="Zap" :size="14" class="animate-spin" />
            <span>{{ isAddonsSubmitting ? 'Updating...' : 'Apply Add-on Changes' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Add-on 1: Extra Concurrent Runners -->
          <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-bold text-white block">Extra Desktop Runners</span>
                <span class="text-xs text-slate-400">$15 / runner / mo ($144 / yr)</span>
              </div>
              <span class="font-mono text-emerald-400 text-sm font-bold">+{{ extraRunners }} runners</span>
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="extraRunners = Math.max(0, extraRunners - 1)"
                class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                <Icons name="Minus" :size="14" />
              </button>
              <input
                type="number"
                v-model.number="extraRunners"
                min="0"
                max="50"
                class="w-20 text-center font-mono font-bold text-sm bg-slate-950 border border-slate-700 rounded-xl py-1.5 text-white focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                @click="extraRunners = Math.min(50, extraRunners + 1)"
                class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                <Icons name="Plus" :size="14" />
              </button>
            </div>
            <p class="text-[11px] text-slate-500">
              Increases maximum concurrent agent executions across desktop runners.
            </p>
          </div>

          <!-- Add-on 2: Member Seats -->
          <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-bold text-white block">Workspace Team Seats</span>
                <span class="text-xs text-slate-400">$10 / seat / mo ($96 / yr)</span>
              </div>
              <span class="font-mono text-cyan-400 text-sm font-bold">{{ seatQuantity }} seats total</span>
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="seatQuantity = Math.max(currentPlanModel.max_seats || 1, seatQuantity - 1)"
                class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                <Icons name="Minus" :size="14" />
              </button>
              <input
                type="number"
                v-model.number="seatQuantity"
                :min="currentPlanModel.max_seats || 1"
                max="200"
                class="w-20 text-center font-mono font-bold text-sm bg-slate-950 border border-slate-700 rounded-xl py-1.5 text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                @click="seatQuantity = Math.min(200, seatQuantity + 1)"
                class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                <Icons name="Plus" :size="14" />
              </button>
            </div>
            <p class="text-[11px] text-slate-500">
              Included in current tier: {{ currentPlanModel.max_seats || 1 }} seat(s).
            </p>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- 5. INVOICES TRANSACTION HISTORY TABLE                                   -->
      <!-- ======================================================================= -->
      <section class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 space-y-4 shadow-xl">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold font-display text-white flex items-center gap-2">
              <Icons name="Mail" :size="18" class="text-emerald-400" />
              <span>Invoices & Billing History</span>
            </h2>
            <p class="text-xs text-slate-400">
              Past payment transactions and generated tax invoices for this workspace.
            </p>
          </div>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">Invoice #</th>
                <th class="py-3 px-4">Date</th>
                <th class="py-3 px-4">Description</th>
                <th class="py-3 px-4">Amount</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-300">
              <tr
                v-for="inv in localInvoices"
                :key="inv.id"
                class="hover:bg-slate-900/40 transition-colors"
              >
                <td class="py-3 px-4 font-mono font-bold text-white">
                  {{ inv.invoice_number }}
                </td>
                <td class="py-3 px-4 text-slate-400">
                  {{ formatDate(inv.paid_at || inv.created_at) }}
                </td>
                <td class="py-3 px-4 font-medium text-slate-200">
                  {{ inv.description || `${inv.plan_name} (${inv.billing_cycle})` }}
                </td>
                <td class="py-3 px-4 font-mono font-bold text-white">
                  {{ formatCurrency(inv.amount, inv.currency) }}
                </td>
                <td class="py-3 px-4">
                  <span
                    :class="[
                      'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                      inv.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : (inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30')
                    ]"
                  >
                    ● {{ inv.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    type="button"
                    @click="handleDownloadInvoice(inv.invoice_number)"
                    class="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
                  >
                    Download
                  </button>
                </td>
              </tr>

              <tr v-if="localInvoices.length === 0">
                <td colspan="6" class="py-8 text-center text-slate-500">
                  No invoices recorded yet. Invoices will automatically appear when subscriptions renew or upgrade.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- ========================================================================= -->
    <!-- CANCEL SUBSCRIPTION CONFIRMATION MODAL                                    -->
    <!-- ========================================================================= -->
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
          v-if="showCancelModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showCancelModal = false" />

          <div class="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0c1220] p-6 text-slate-100 shadow-2xl space-y-4 my-auto">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <Icons name="AlertTriangle" :size="20" />
              </div>
              <div>
                <h3 class="text-base font-bold text-white">Cancel Subscription?</h3>
                <p class="text-xs text-slate-400">Workspace: {{ props.workspace.name }}</p>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed">
              Your subscription will remain active until the end of the current billing period ({{ formatDate(localSubscription.current_period_ends_at) }}). Afterwards, the workspace will automatically downgrade to the free Community tier.
            </p>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                @click="showCancelModal = false"
                class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                :disabled="isCancelingSubmitting"
                @click="handleCancelSubscription"
                class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                {{ isCancelingSubmitting ? 'Canceling...' : 'Confirm Cancellation' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Mount Global UpgradeModal Component -->
    <UpgradeModal />
  </div>
</template>
