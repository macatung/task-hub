<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Head, usePage, router } from '@inertiajs/vue3';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';
import WorkspaceBrand from '@/Components/layout/WorkspaceBrand.vue';
import UpgradeModal from '@/Components/billing/UpgradeModal.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';
import type {
  WorkspaceProps,
  WorkspaceOption,
  WorkspaceAnalyticsPayload,
  WorkspaceAnalyticsPageProps,
} from '@/types/workspace';

const props = withDefaults(
  defineProps<{
    workspace: WorkspaceProps;
    analytics: WorkspaceAnalyticsPayload;
    canAccessAnalytics: boolean;
    timeRange?: '7d' | '30d' | '90d' | '1y';
    workspaces?: WorkspaceOption[];
    currentWorkspaceId?: number;
  }>(),
  {
    timeRange: '30d',
    workspaces: () => [],
    canAccessAnalytics: false,
  }
);

const page = usePage<WorkspaceAnalyticsPageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const { openUpgradeModal, handleQuotaError } = useUpgradeModal();

// Theme State
const isDarkMode = ref(true);
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

// UI States
const isWorkspaceMenuOpen = ref(false);
const currentTimeRange = ref<'7d' | '30d' | '90d' | '1y'>(props.timeRange || '30d');
const localAnalytics = ref<WorkspaceAnalyticsPayload>({ ...props.analytics });
const isLoading = ref(false);
const activeHoveredBar = ref<{ date: string; count: number; index: number } | null>(null);

// Sync local data if props change
watch(
  () => props.analytics,
  (newVal) => {
    if (newVal) {
      localAnalytics.value = { ...newVal };
    }
  },
  { deep: true }
);

// Format number helper (e.g. 12.4k, 1.5M)
const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
};

// Format token count helper
const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
};

// Change Time Range filter
const selectTimeRange = async (range: '7d' | '30d' | '90d' | '1y') => {
  currentTimeRange.value = range;
  if (!props.canAccessAnalytics) return;

  isLoading.value = true;
  try {
    const res = await axios.get(`/api/v1/workspaces/${props.workspace.id}/analytics`, {
      params: { time_range: range },
    });
    if (res.data?.success && res.data.data) {
      localAnalytics.value = res.data.data;
    }
  } catch (err: any) {
    handleQuotaError(err);
    // Fallback: reload page via Inertia
    router.get(
      `/workspaces/${props.workspace.id}/analytics`,
      { time_range: range },
      { preserveState: true, preserveScroll: true }
    );
  } finally {
    isLoading.value = false;
  }
};

// Trigger Upgrade Modal
const triggerUpgrade = () => {
  openUpgradeModal({
    resource: 'analytics',
    current_usage: 0,
    limit: 0,
    current_plan: props.workspace.plan || 'community',
    suggested_plan: 'team',
    upgrade_url: `/workspaces/${props.workspace.id}/billing`,
    message: 'Gain full visibility into team throughput, AI model efficiency, and lead times with Workspace Analytics.',
  });
};

// Model badge coloring & icon helper
const getModelBadge = (modelName: string) => {
  const low = modelName.toLowerCase();
  if (low.includes('gemini')) {
    return {
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      bar: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      tagBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      icon: 'Sparkles',
    };
  }
  if (low.includes('claude')) {
    return {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
      tagBg: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      icon: 'Cpu',
    };
  }
  if (low.includes('codex') || low.includes('gpt') || low.includes('openai')) {
    return {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      tagBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
      icon: 'Code',
    };
  }
  return {
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    bar: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    tagBg: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
    icon: 'Activity',
  };
};

// SVG Chart Calculations
const historyList = computed(() => localAnalytics.value.throughput?.throughput_history || []);
const maxDailyCount = computed(() => {
  const counts = historyList.value.map((h) => h.count);
  return counts.length > 0 ? Math.max(...counts, 5) : 5;
});

// Donut Chart Calculations for Success Rate
const totalRuns = computed(() => localAnalytics.value.success_rate?.total_runs || 0);
const successfulRuns = computed(() => localAnalytics.value.success_rate?.successful_runs || 0);
const failedRuns = computed(() => localAnalytics.value.success_rate?.failed_runs || 0);
const cancelledRuns = computed(() => localAnalytics.value.success_rate?.cancelled_runs || 0);

const successRatePct = computed(() => localAnalytics.value.success_rate?.success_percentage ?? 0);

// SVG circumference calculation (radius = 42, circumference = 2 * PI * 42 ≈ 263.89)
const circumference = 263.89;
const successOffset = computed(() => {
  if (totalRuns.value === 0) return circumference;
  const pct = Math.min(100, Math.max(0, (successfulRuns.value / totalRuns.value) * 100));
  return circumference - (circumference * pct) / 100;
});
const failedOffset = computed(() => {
  if (totalRuns.value === 0) return circumference;
  const pct = Math.min(100, Math.max(0, (failedRuns.value / totalRuns.value) * 100));
  return circumference - (circumference * pct) / 100;
});
</script>

<template>
  <Head :title="`${props.workspace.name} — Team Velocity & Analytics`" />

  <div
    :class="[
      'min-h-screen font-sans transition-colors duration-150 selection:bg-cyan-500 selection:text-slate-950',
      isDarkMode ? 'dark bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900',
    ]"
  >
    <!-- Top Navigation Bar -->
    <header
      :class="[
        'sticky top-0 z-40 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4',
        isDarkMode ? 'bg-[#0c1220]/90 border-slate-800/80 text-white' : 'bg-white/90 border-slate-200 text-slate-900',
      ]"
    >
      <div class="flex items-center gap-3 min-w-0">
        <WorkspaceBrand :dark="isDarkMode" />
        <div class="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60 text-xs min-w-0 font-medium">
          <a href="/tasks" class="text-slate-400 hover:text-cyan-400 transition-colors">Workspace</a>
          <span class="text-slate-500">/</span>
          <span class="font-bold text-slate-200 truncate">{{ props.workspace.name }}</span>
          <span class="text-slate-500">/</span>
          <span class="text-cyan-400 font-bold">Velocity & Analytics</span>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Workspace Switcher -->
        <div v-if="props.workspaces && props.workspaces.length > 1" class="relative">
          <button
            @click="isWorkspaceMenuOpen = !isWorkspaceMenuOpen"
            :class="[
              'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100',
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
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800',
            ]"
          >
            <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Workspace</div>
            <div class="mt-1 space-y-1">
              <a
                v-for="w in props.workspaces"
                :key="w.id"
                :href="`/workspaces/${w.id}/analytics`"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  w.id === props.workspace.id
                    ? isDarkMode
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                      : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                    : isDarkMode
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700',
                ]"
              >
                <span class="truncate">{{ w.name }}</span>
                <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{
                  w.plan || 'community'
                }}</span>
              </a>
            </div>
          </div>
        </div>

        <a
          :href="`/workspaces/${props.workspace.id}/billing`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Zap" :size="14" class="text-amber-400" />
          <span class="hidden md:inline">Billing & Quotas</span>
        </a>

        <a
          :href="`/workspaces/${props.workspace.id}/members`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Users" :size="14" class="text-emerald-400" />
          <span class="hidden md:inline">Members</span>
        </a>

        <a
          :href="`/workspaces/${props.workspace.id}/secrets`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Lock" :size="14" class="text-cyan-400" />
          <span class="hidden md:inline">Secrets</span>
        </a>

        <a
          :href="`/workspaces/${props.workspace.id}/analytics`"
          class="px-3.5 py-1.5 rounded-xl bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="BarChart" :size="14" class="text-purple-400" />
          <span class="hidden md:inline">Analytics</span>
        </a>

        <a
          href="/tasks"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="LayoutGrid" :size="14" />
          <span class="hidden md:inline">Task Board</span>
        </a>

        <button
          @click="toggleTheme"
          :class="[
            'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode
              ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50',
          ]"
          :title="isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <Icons :name="isDarkMode ? 'Sun' : 'Moon'" :size="15" />
        </button>

        <div v-if="user" class="flex items-center gap-2 pl-2 border-l border-slate-800">
          <img
            v-if="user.github_avatar_url"
            :src="user.github_avatar_url"
            alt="User Avatar"
            class="h-7 w-7 rounded-full border border-cyan-500/40 shadow-xs"
          />
          <span class="text-xs font-bold hidden lg:inline text-slate-300">@{{ user.github_login || user.name }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <!-- Title Header & Filter Buttons -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span class="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 inline-flex">
                <Icons name="Activity" :size="24" />
              </span>
              Workspace Velocity & Team Analytics
            </h1>
            <span
              :class="[
                'text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                props.canAccessAnalytics
                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/40',
              ]"
            >
              {{ props.workspace.plan || 'community' }}
            </span>
          </div>
          <p class="text-sm text-slate-400 mt-1">
            Real-time throughput metrics, AI model distribution, and agent completion lead times.
          </p>
        </div>

        <!-- Date Range Filter Tabs -->
        <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 self-start md:self-auto">
          <button
            v-for="period in (['7d', '30d', '90d', '1y'] as const)"
            :key="period"
            @click="selectTimeRange(period)"
            :class="[
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
              currentTimeRange === period
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
            ]"
          >
            <Icons v-if="currentTimeRange === period && isLoading" name="Loader" :size="12" class="animate-spin" />
            <span>{{ period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : period === '90d' ? '90 Days' : '1 Year' }}</span>
          </button>
        </div>
      </div>

      <!-- Plan Gating Lock Overlay Banner (When Free/Pro/Community) -->
      <div
        v-if="!props.canAccessAnalytics"
        class="analytics-locked-overlay relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-950/90 p-8 sm:p-12 text-center backdrop-blur-xl shadow-2xl"
      >
        <div class="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 max-w-2xl mx-auto space-y-4">
          <div class="inline-flex p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-1">
            <Icons name="Lock" :size="32" />
          </div>
          <h3 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Workspace Velocity Analytics is a Team Plan Feature
          </h3>
          <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
            Gain full visibility into team throughput, AI model efficiency, and lead times.
            Upgrade to the Team or Enterprise plan to unlock advanced velocity charts, token breakdown, and historical lead-time metrics.
          </p>
          <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              @click="triggerUpgrade"
              class="upgrade-btn w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-slate-950 font-extrabold text-sm transition-all shadow-lg shadow-purple-500/25 cursor-pointer flex items-center justify-center gap-2"
            >
              <Icons name="Zap" :size="16" />
              <span>Upgrade Now</span>
            </button>
            <a
              :href="`/workspaces/${props.workspace.id}/billing`"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Icons name="Crown" :size="16" class="text-amber-400" />
              <span>Compare Plan Tiers</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Active Analytics Dashboard Grid (renders when authorized or as preview underneath) -->
      <div
        :class="[
          'analytics-dashboard space-y-8 transition-opacity duration-300',
          !props.canAccessAnalytics ? 'opacity-40 pointer-events-none select-none blur-[1px]' : '',
        ]"
      >
        <!-- 4 Primary KPI Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- KPI 1: Total Tasks Completed -->
          <div class="stat-card p-5 bg-[#0c1220] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-400">Total Tasks Completed</span>
              <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Icons name="CheckCircle" :size="15" />
              </span>
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold text-white">
              {{ localAnalytics.throughput?.total_tasks_completed ?? 0 }}
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Icons name="ChevronUp" :size="14" />
              <span>Completed in {{ currentTimeRange }} window</span>
            </div>
          </div>

          <!-- KPI 2: Velocity Points Per Week -->
          <div class="stat-card p-5 bg-[#0c1220] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-400">Velocity (Points/Wk)</span>
              <span class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Icons name="Zap" :size="15" />
              </span>
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold text-phantom-mint">
              {{ localAnalytics.throughput?.velocity_points_per_week ?? 0 }} pts
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Icons name="Activity" :size="13" class="text-cyan-400" />
              <span>Average story points / week</span>
            </div>
          </div>

          <!-- KPI 3: 24h Run Throughput -->
          <div class="stat-card p-5 bg-[#0c1220] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-400">24h Run Throughput</span>
              <span class="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Icons name="Cpu" :size="15" />
              </span>
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold text-white">
              {{ localAnalytics.throughput?.run_throughput_24h ?? 0 }}
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-xs text-purple-400 font-medium">
              <Icons name="Clock" :size="13" />
              <span>Runs dispatched past 24h</span>
            </div>
          </div>

          <!-- KPI 4: Run Success Rate -->
          <div class="stat-card p-5 bg-[#0c1220] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-400">Run Success Rate</span>
              <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Icons name="Sparkles" :size="15" />
              </span>
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {{ successRatePct }}%
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <span>{{ successfulRuns }} pass / {{ failedRuns }} fail ({{ totalRuns }} total)</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Charts Grid (Throughput History & Success Distribution) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Throughput Trend Daily Bar/Area Chart (2 Cols) -->
          <div class="lg:col-span-2 p-6 bg-[#0c1220] border border-slate-800 rounded-2xl space-y-4 shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <Icons name="BarChart" :size="18" class="text-cyan-400" />
                  Throughput & Completed Tasks Trend
                </h3>
                <p class="text-xs text-slate-400">Daily velocity volume across the {{ currentTimeRange }} window</p>
              </div>
              <span class="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300">
                Peak: {{ maxDailyCount }} tasks/day
              </span>
            </div>

            <!-- SVG Bar Chart -->
            <div class="relative pt-4">
              <div v-if="historyList.length === 0" class="h-56 flex flex-col items-center justify-center text-slate-500 text-sm">
                <Icons name="Activity" :size="32" class="mb-2 opacity-50" />
                <span>No completed tasks in selected period</span>
              </div>
              <div v-else class="h-56 w-full flex items-end gap-1 sm:gap-2 px-2 pb-6 border-b border-slate-800 relative">
                <!-- Tooltip when hovering a bar -->
                <div
                  v-if="activeHoveredBar"
                  class="absolute top-0 right-4 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 shadow-xl z-20 pointer-events-none"
                >
                  <div class="text-slate-400 text-[10px]">{{ activeHoveredBar.date }}</div>
                  <div class="font-bold text-cyan-300">{{ activeHoveredBar.count }} tasks completed</div>
                </div>

                <div
                  v-for="(item, idx) in historyList"
                  :key="item.date"
                  class="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  @mouseenter="activeHoveredBar = { date: item.date, count: item.count, index: idx }"
                  @mouseleave="activeHoveredBar = null"
                >
                  <!-- Bar Column -->
                  <div
                    class="w-full max-w-[28px] rounded-t-md transition-all duration-200 group-hover:brightness-125"
                    :class="[
                      item.count > 0
                        ? 'bg-gradient-to-t from-cyan-600 via-cyan-500 to-purple-500 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800/40',
                    ]"
                    :style="{
                      height: `${Math.max(4, (item.count / maxDailyCount) * 100)}%`,
                    }"
                  ></div>
                  <!-- Date label (sampled for readability) -->
                  <span
                    v-if="idx % Math.ceil(historyList.length / 7) === 0 || idx === historyList.length - 1"
                    class="absolute -bottom-5 text-[10px] font-mono text-slate-500 truncate"
                  >
                    {{ item.date.slice(5) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Run Success vs Failure Distribution Radial / Donut (1 Col) -->
          <div class="p-6 bg-[#0c1220] border border-slate-800 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <Icons name="CheckCircle" :size="18" class="text-emerald-400" />
                Agent Run Success Rate
              </h3>
              <p class="text-xs text-slate-400">Execution status distribution</p>
            </div>

            <!-- Radial Gauge -->
            <div class="flex items-center justify-center py-2 relative">
              <svg class="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                <!-- Background Ring -->
                <circle cx="50" cy="50" r="42" stroke="currentColor" stroke-width="9" fill="transparent" class="text-slate-800/80" />
                <!-- Successful Runs Arc -->
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  stroke-width="9"
                  fill="transparent"
                  stroke-dasharray="263.89"
                  :stroke-dashoffset="successOffset"
                  stroke-linecap="round"
                  class="text-emerald-400 transition-all duration-700"
                />
              </svg>
              <!-- Center Text -->
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span class="text-2xl font-extrabold text-white">{{ successRatePct }}%</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Success</span>
              </div>
            </div>

            <!-- Breakdown Summary Counts -->
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
              <div class="p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/30">
                <div class="text-[10px] uppercase font-bold text-emerald-400">Pass</div>
                <div class="text-sm font-bold text-white font-mono">{{ successfulRuns }}</div>
              </div>
              <div class="p-2 rounded-xl bg-rose-950/30 border border-rose-800/30">
                <div class="text-[10px] uppercase font-bold text-rose-400">Fail</div>
                <div class="text-sm font-bold text-white font-mono">{{ failedRuns }}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div class="text-[10px] uppercase font-bold text-slate-400">Cancel</div>
                <div class="text-sm font-bold text-white font-mono">{{ cancelledRuns }}</div>
              </div>
            </div>

            <!-- Failure Reasons List -->
            <div v-if="localAnalytics.success_rate?.failure_reasons?.length" class="pt-2">
              <div class="text-xs font-bold text-slate-300 mb-2">Failure Reasons Breakdown:</div>
              <ul class="failure-reasons-list divide-y divide-slate-800/80 text-xs">
                <li
                  v-for="item in localAnalytics.success_rate.failure_reasons"
                  :key="item.reason"
                  class="py-1.5 flex justify-between items-center"
                >
                  <span class="text-slate-300 truncate max-w-[200px]">{{ item.reason }}</span>
                  <span class="font-mono text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-[11px]">
                    {{ item.count }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Section 3: AI Model Distribution & Turnaround Lead Times -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- AI Model Distribution Breakdown -->
          <div class="p-6 bg-[#0c1220] border border-slate-800 rounded-2xl space-y-4 shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <Icons name="Cpu" :size="18" class="text-cyan-400" />
                  AI Model Distribution
                </h3>
                <p class="text-xs text-slate-400">Invocations and token utilization across models</p>
              </div>
              <span class="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                {{ localAnalytics.ai_models?.total_model_invocations ?? 0 }} total calls
              </span>
            </div>

            <div v-if="!localAnalytics.ai_models?.distribution?.length" class="py-10 text-center text-slate-500 text-xs">
              No model invocations logged in this period.
            </div>

            <div v-else class="model-distribution-chart space-y-4 pt-2">
              <div
                v-for="m in localAnalytics.ai_models.distribution"
                :key="m.model"
                class="model-bar-row space-y-1.5"
              >
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <span :class="['p-1 rounded-md border text-xs', getModelBadge(m.model).bg]">
                      <Icons :name="getModelBadge(m.model).icon" :size="13" />
                    </span>
                    <span class="font-semibold text-slate-200">{{ m.model }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-slate-400 font-mono">{{ m.percentage }}% ({{ m.count }} calls)</span>
                    <span class="font-mono text-cyan-400 text-[11px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                      {{ formatTokens(m.tokens_used) }} tokens
                    </span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all duration-500', getModelBadge(m.model).bar]"
                    :style="{ width: `${m.percentage}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Turnaround & Velocity Lead Times Card -->
          <div class="turnaround-card p-6 bg-[#0c1220] border border-slate-800 rounded-2xl space-y-5 shadow-lg flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <Icons name="Clock" :size="18" class="text-amber-400" />
                    Execution & Turnaround Times
                  </h3>
                  <p class="text-xs text-slate-400">Agent run latencies and task turnaround metrics</p>
                </div>
                <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Icons name="Zap" :size="15" />
                </span>
              </div>

              <!-- Latency Stat Rows -->
              <div class="space-y-3 pt-4">
                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <Icons name="Play" :size="16" class="text-cyan-400" />
                    <div>
                      <div class="text-sm font-medium text-slate-300">
                        Avg Run Execution Time: <span class="text-white font-mono font-bold">{{ localAnalytics.turnaround_time?.avg_run_duration_seconds ?? 0 }}s</span>
                      </div>
                      <div class="text-[11px] text-slate-500">Mean time spent executing prompt, diff, & tests</div>
                    </div>
                  </div>
                  <span class="text-xs font-mono font-bold text-cyan-400">{{ localAnalytics.turnaround_time?.avg_run_duration_seconds ?? 0 }}s</span>
                </div>

                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <Icons name="Activity" :size="16" class="text-purple-400" />
                    <div>
                      <div class="text-sm font-medium text-slate-300">
                        P95 Execution Latency: <span class="text-white font-mono font-bold">{{ localAnalytics.turnaround_time?.p95_duration_seconds ?? 0 }}s</span>
                      </div>
                      <div class="text-[11px] text-slate-500">95th percentile worst-case run duration</div>
                    </div>
                  </div>
                  <span class="text-xs font-mono font-bold text-purple-400">{{ localAnalytics.turnaround_time?.p95_duration_seconds ?? 0 }}s</span>
                </div>

                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <Icons name="Layers" :size="16" class="text-amber-400" />
                    <div>
                      <div class="text-sm font-medium text-slate-300">
                        Queue Latency: <span class="text-white font-mono font-bold">{{ localAnalytics.turnaround_time?.avg_queue_wait_seconds ?? 0 }}s</span>
                      </div>
                      <div class="text-[11px] text-slate-500">Time waiting in queue before runner claims job</div>
                    </div>
                  </div>
                  <span class="text-xs font-mono font-bold text-amber-400">{{ localAnalytics.turnaround_time?.avg_queue_wait_seconds ?? 0 }}s</span>
                </div>
              </div>
            </div>

            <!-- Review Turnaround Footer Notice -->
            <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span class="flex items-center gap-1.5">
                <Icons name="CheckSquare" :size="14" class="text-emerald-400" />
                Review Turnaround Latency:
              </span>
              <span class="font-mono text-slate-200 font-bold">
                {{ localAnalytics.turnaround_time?.avg_review_turnaround_seconds ?? 0 }}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Commercial Plan Upgrade Modal -->
    <UpgradeModal />
  </div>
</template>
