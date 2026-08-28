<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';
import StatusBadge from '@/Components/ui/StatusBadge.vue';
import { sound } from '@/audio/soundEffects';

export interface QuotaMetrics {
  plan?: string;
  gemini?: { used_tokens?: number; limit?: number; weekly_percent?: number; five_hour_percent?: number };
  claude_gpt?: { used_tokens?: number; limit?: number; weekly_percent?: number; five_hour_percent?: number };
  codex?: { used_tokens?: number; limit?: number; weekly_percent?: number; five_hour_percent?: number };
  [key: string]: any;
}

export interface DesktopAgentItem {
  id: number;
  client_id?: string | null;
  name: string;
  machine_name?: string | null;
  hostname?: string | null;
  os_platform?: string | null;
  os_version?: string | null;
  ip_address?: string | null;
  version?: string | null;
  status: string;
  health: 'online' | 'busy' | 'offline' | 'revoked' | string;
  active_provider?: string | null;
  active_model?: string | null;
  workspace_cwd?: string | null;
  quota_metrics?: QuotaMetrics | null;
  ping_latency_ms?: number | null;
  active_runs_count: number;
  last_heartbeat_at?: string | null;
  latest_error?: string | null;
}

const props = withDefaults(defineProps<{
  isDarkMode?: boolean;
}>(), {
  isDarkMode: true,
});

const emit = defineEmits<{
  (e: 'dispatch', runner: DesktopAgentItem): void;
}>();

const runners = ref<DesktopAgentItem[]>([]);
const isConnected = ref(false);
const isExpanded = ref(false);
const isRefreshing = ref(false);
const latestLog = ref('');
const copiedCwdId = ref<number | null>(null);

let eventSource: EventSource | null = null;
let pollTimer: number | null = null;

const onlineCount = computed(() =>
  runners.value.filter(r => ['online', 'busy'].includes(r.health || r.status)).length
);

const busyCount = computed(() =>
  runners.value.filter(r => r.health === 'busy' || r.status === 'busy' || (r.active_runs_count > 0 && r.health !== 'offline')).length
);

const idleCount = computed(() =>
  Math.max(0, onlineCount.value - busyCount.value)
);

let lastFetchTime = 0;
let fetchTimeout: number | null = null;

const fetchRunners = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastFetchTime < 6000) {
    if (!fetchTimeout) {
      fetchTimeout = window.setTimeout(() => {
        fetchTimeout = null;
        void fetchRunners(true);
      }, 6000 - (now - lastFetchTime));
    }
    return;
  }
  lastFetchTime = now;
  isRefreshing.value = true;
  try {
    const res = await axios.get('/api/v1/desktop/agents');
    if (res.data?.data) {
      runners.value = res.data.data;
    } else {
      const fallback = await axios.get('/api/runners/dashboard');
      runners.value = fallback.data?.data || [];
    }
  } catch {
    try {
      const fallback = await axios.get('/api/runners/dashboard');
      runners.value = fallback.data?.data || [];
    } catch {
      // Keep existing runners state
    }
  } finally {
    isRefreshing.value = false;
  }
};

const setupEventSource = () => {
  try {
    eventSource = new EventSource('/api/tasks/agent-runs/stream');
    eventSource.onopen = () => {
      isConnected.value = true;
    };
    eventSource.onerror = () => {
      isConnected.value = false;
    };
    eventSource.addEventListener('agent-run', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data);
        // Only re-fetch runners list if status actually changed or a run started/finished
        if (['queued', 'running', 'verified', 'failed', 'cancelled'].includes(parsed.status)) {
          void fetchRunners();
        }
      } catch {
        void fetchRunners();
      }
    });
    eventSource.addEventListener('agent-log', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data);
        if (parsed.content) {
          latestLog.value = `[${new Date().toLocaleTimeString()}] ${parsed.content}`;
        }
      } catch {}
    });
  } catch {}
};

const getOsBadge = (platform?: string | null) => {
  const p = (platform || '').toLowerCase();
  if (p.includes('win') || p === 'win32') {
    return { icon: '🪟', name: 'Windows', class: 'bg-sky-500/10 text-sky-400 border-sky-500/30' };
  }
  if (p.includes('darwin') || p.includes('mac') || p.includes('apple')) {
    return { icon: '🍎', name: 'macOS', class: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30' };
  }
  if (p.includes('linux')) {
    return { icon: '🐧', name: 'Linux', class: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  }
  return { icon: '💻', name: 'Desktop', class: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
};

const getLatencyBadge = (latency?: number | null) => {
  if (latency === null || latency === undefined) {
    return { text: '-- ms', class: 'text-slate-500 bg-slate-800/40 border-slate-700' };
  }
  if (latency < 40) {
    return { text: `${latency}ms`, class: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' };
  }
  if (latency < 120) {
    return { text: `${latency}ms`, class: 'text-amber-400 bg-amber-950/60 border-amber-800/60' };
  }
  return { text: `${latency}ms`, class: 'text-rose-400 bg-rose-950/60 border-rose-800/60' };
};

const copyCwd = async (runner: DesktopAgentItem) => {
  if (!runner.workspace_cwd) return;
  try {
    await navigator.clipboard.writeText(runner.workspace_cwd);
    copiedCwdId.value = runner.id;
    sound.playClick();
    setTimeout(() => {
      if (copiedCwdId.value === runner.id) copiedCwdId.value = null;
    }, 2000);
  } catch {}
};

const handleDispatchClick = (runner: DesktopAgentItem) => {
  sound.playClick();
  emit('dispatch', runner);
};

onMounted(() => {
  void fetchRunners(true);
  setupEventSource();
  pollTimer = window.setInterval(() => {
    void fetchRunners();
  }, 30000);
});

onBeforeUnmount(() => {
  if (fetchTimeout) {
    window.clearTimeout(fetchTimeout);
    fetchTimeout = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <section
    class="connected-agents-registry mx-3 sm:mx-6 mt-2.5 rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs backdrop-blur-md"
    :class="[
      isDarkMode
        ? 'border-slate-800/90 bg-[#0a0f1d]/90 text-slate-100 shadow-slate-950/40'
        : 'border-slate-200/90 bg-white/90 text-slate-900 shadow-slate-200/40'
    ]"
  >
    <!-- Top Registry Bar -->
    <div class="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      <!-- Left: Glowing Live Beacon & Registry Title -->
      <div class="flex items-center gap-3 min-w-0">
        <!-- Glowing Beacon -->
        <div class="relative flex items-center justify-center h-4 w-4">
          <span
            v-if="onlineCount > 0"
            class="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full opacity-75"
            :class="busyCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'"
          />
          <span
            class="relative inline-flex rounded-full h-2.5 w-2.5 shadow-sm"
            :class="[
              busyCount > 0
                ? 'bg-amber-500 shadow-amber-500/50 ring-2 ring-amber-400/20'
                : onlineCount > 0
                ? 'bg-emerald-500 shadow-emerald-500/50 ring-2 ring-emerald-400/20'
                : 'bg-slate-500'
            ]"
          />
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-xs font-display tracking-tight">Connected Desktop Agents</span>
          <div class="flex items-center gap-1.5 font-mono text-[10px]">
            <span
              class="px-2 py-0.5 rounded-full font-bold border transition-colors"
              :class="[
                onlineCount > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              ]"
            >
              {{ onlineCount }} Online
            </span>
            <span
              v-if="busyCount > 0"
              class="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30"
            >
              {{ busyCount }} Busy
            </span>
            <span
              v-if="idleCount > 0"
              class="hidden sm:inline px-1.5 py-0.5 rounded-full font-semibold text-slate-400"
            >
              ({{ idleCount }} ready for dispatch)
            </span>
          </div>
        </div>
      </div>

      <!-- Right: SSE Stream Health & Expand Toggle -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Live SSE Beacon -->
        <span
          class="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
          :class="[
            isConnected
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 shadow-xs'
              : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
          ]"
          :title="isConnected ? 'Real-time Server-Sent Events live stream connected' : 'Connecting to live stream... Fallback polling active'"
        >
          <span class="inline-block w-1.5 h-1.5 rounded-full" :class="isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'" />
          <span>{{ isConnected ? 'SSE Live' : 'Polling (10s)' }}</span>
        </span>

        <!-- Refresh Button -->
        <button
          @click="() => fetchRunners(true)"
          :disabled="isRefreshing"
          class="p-1.5 rounded-lg border text-[11px] transition-all cursor-pointer flex items-center justify-center"
          :class="[
            isDarkMode
              ? 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:border-slate-700'
              : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 hover:border-slate-300'
          ]"
          title="Refresh connected agents registry"
        >
          <Icons name="Refresh" :size="14" :class="['transition-transform', isRefreshing ? 'animate-spin text-emerald-400' : '']" />
        </button>

        <!-- Toggle Workstations Grid -->
        <button
          @click="isExpanded = !isExpanded"
          class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border"
          :class="[
            isExpanded
              ? 'bg-blue-600/15 text-blue-400 border-blue-500/40'
              : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950')
          ]"
        >
          <span>{{ isExpanded ? 'Hide Workstations' : 'View Workstations' }}</span>
          <Icons :name="isExpanded ? 'ChevronUp' : 'ChevronDown'" :size="12" />
        </button>
      </div>
    </div>

    <!-- Collapsible Workstations Cards Grid & Live Telemetry -->
    <div
      v-if="isExpanded"
      class="border-t px-4 py-3 space-y-3"
      :class="isDarkMode ? 'border-slate-800/80 bg-slate-950/50' : 'border-slate-200/80 bg-slate-50/50'"
    >
      <!-- Workstation Cards Grid -->
      <div v-if="runners.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="runner in runners"
          :key="runner.id"
          class="workstation-card rounded-2xl border p-3.5 space-y-2.5 transition-all duration-200 shadow-xs relative overflow-hidden"
          :class="[
            runner.health === 'offline'
              ? (isDarkMode ? 'bg-slate-900/30 border-slate-800/60 opacity-60' : 'bg-slate-100/60 border-slate-200 opacity-60')
              : runner.health === 'busy'
              ? (isDarkMode ? 'bg-amber-950/15 border-amber-500/40 shadow-amber-950/20' : 'bg-amber-50/60 border-amber-300')
              : (isDarkMode ? 'bg-[#0d1424] border-slate-800 hover:border-emerald-500/50 hover:shadow-md' : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md')
          ]"
        >
          <!-- Card Header: Machine Name, OS Badge & Status -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-1.5">
                <Icons name="Desktop" :size="14" class="text-blue-400 shrink-0" />
                <h4 class="font-bold text-xs truncate tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-950'">
                  {{ runner.machine_name || runner.name }}
                </h4>
              </div>
              <p class="font-mono text-[10px] text-slate-500 truncate" :title="runner.hostname || runner.client_id || ''">
                {{ runner.hostname || (runner.client_id ? `ID: ${runner.client_id.slice(0, 8)}` : 'localhost') }}
                <span v-if="runner.ip_address" class="text-slate-400">· {{ runner.ip_address }}</span>
              </p>
            </div>

            <!-- Health Status Badge -->
            <StatusBadge
              :status="runner.health === 'busy' ? 'busy' : runner.health === 'offline' ? 'offline' : 'idle'"
              variant="agent"
              size="xs"
              :dark="isDarkMode"
            />
          </div>

          <!-- Active AI Provider & Model -->
          <div class="flex items-center justify-between gap-2 text-[10px]">
            <div class="flex items-center gap-1.5 truncate">
              <span class="font-bold text-slate-400">AI:</span>
              <span
                class="font-mono px-1.5 py-0.2 rounded border truncate"
                :class="isDarkMode ? 'bg-slate-900 border-slate-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'"
              >
                {{ runner.active_provider ? runner.active_provider.toUpperCase() : 'ANTIGRAVITY' }}
              </span>
              <span class="font-mono text-slate-400 truncate text-[9px]">
                {{ runner.active_model || 'gemini-3.7-flash' }}
              </span>
            </div>

            <!-- Ping Latency Badge -->
            <span
              class="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0"
              :class="getLatencyBadge(runner.ping_latency_ms).class"
              :title="`Heartbeat ping round-trip latency: ${runner.ping_latency_ms || 0}ms`"
            >
              {{ getLatencyBadge(runner.ping_latency_ms).text }}
            </span>
          </div>

          <!-- Workspace CWD with Copy Button -->
          <div
            v-if="runner.workspace_cwd"
            class="flex items-center justify-between gap-1.5 p-1.5 rounded-xl border font-mono text-[10px]"
            :class="isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-slate-100/90 border-slate-200 text-slate-700'"
          >
            <span class="truncate text-[9.5px] flex items-center gap-1" :title="runner.workspace_cwd">
              <Icons name="Folder" :size="12" class="text-amber-400 shrink-0" />
              <span class="truncate">{{ runner.workspace_cwd }}</span>
            </span>
            <button
              @click="copyCwd(runner)"
              class="shrink-0 p-0.5 text-[9px] text-slate-400 hover:text-white cursor-pointer font-sans flex items-center gap-1"
              :title="'Copy workspace directory path'"
            >
              <Icons v-if="copiedCwdId === runner.id" name="Check" :size="11" class="text-emerald-400" />
              <Icons v-else name="Copy" :size="11" class="text-slate-400" />
              <span>{{ copiedCwdId === runner.id ? 'Copied' : '' }}</span>
            </button>
          </div>

          <!-- Quota Metrics Gauges -->
          <div v-if="runner.quota_metrics" class="space-y-1.5 pt-1">
            <!-- Weekly Limit Bar -->
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>Weekly Quota</span>
                <span class="font-bold text-slate-300">
                  {{ runner.quota_metrics?.gemini?.weekly_percent ?? 100 }}% left
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden flex">
                <div
                  class="h-full transition-all duration-300"
                  :class="[
                    (runner.quota_metrics?.gemini?.weekly_percent ?? 100) < 20
                      ? 'bg-rose-500'
                      : (runner.quota_metrics?.gemini?.weekly_percent ?? 100) < 50
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  ]"
                  :style="{ width: `${Math.min(100, Math.max(0, runner.quota_metrics?.gemini?.weekly_percent ?? 100))}%` }"
                />
              </div>
            </div>

            <!-- 5-Hour Limit Bar -->
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>5-Hour Limit</span>
                <span class="font-bold text-slate-300">
                  {{ runner.quota_metrics?.gemini?.five_hour_percent ?? 100 }}% left
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden flex">
                <div
                  class="h-full bg-cyan-500 transition-all duration-300"
                  :style="{ width: `${Math.min(100, Math.max(0, runner.quota_metrics?.gemini?.five_hour_percent ?? 100))}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Quick Dispatch Button -->
          <div class="pt-1 flex items-center justify-between gap-2">
            <span class="text-[10px] text-slate-500 font-mono">
              {{ runner.active_runs_count }} active run{{ runner.active_runs_count === 1 ? '' : 's' }}
            </span>
            <button
              @click="handleDispatchClick(runner)"
              :disabled="runner.health === 'offline'"
              class="px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs"
              :class="[
                runner.health === 'offline'
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-500/50 shadow-emerald-950/40 active:scale-95'
              ]"
              title="⚡ Dispatch Task"
            >
              <Icons name="Zap" :size="12" class="text-amber-300" />
              <span>⚡ Dispatch Task</span>
            </button>
          </div>
        </article>
      </div>

      <!-- Empty State: No Desktop Agents Connected -->
      <div
        v-else
        class="py-6 px-4 rounded-2xl border border-dashed text-center space-y-2"
        :class="isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50'"
      >
        <Icons name="Desktop" :size="32" class="mx-auto text-slate-500" />
        <h4 class="font-bold text-xs" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">No Desktop Agents Connected</h4>
        <p class="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
          Open Task Hub Desktop App on your workstation to automatically connect and receive remote task dispatches in under 2 seconds.
        </p>
      </div>

      <!-- Live Log Stream Preview -->
      <div v-if="latestLog" class="space-y-1 pt-1">
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Live Streamback Telemetry</span>
          <button @click="latestLog = ''" class="text-slate-500 hover:text-slate-300 cursor-pointer">Clear</button>
        </div>
        <pre
          class="max-h-20 overflow-auto rounded-xl p-2.5 text-[10px] font-mono border leading-relaxed select-all"
          :class="isDarkMode ? 'bg-black text-emerald-400 border-slate-800' : 'bg-slate-950 text-emerald-300 border-slate-800'"
        >{{ latestLog }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workstation-card {
  transform: translateZ(0);
}
</style>
