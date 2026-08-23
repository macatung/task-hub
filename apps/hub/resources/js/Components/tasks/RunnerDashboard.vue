<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';

type Runner = {
  id: number;
  name: string;
  version?: string | null;
  health: string;
  active_runs_count: number;
  next_lease_expires_at?: string | null;
  latest_error?: string | null;
};

const runners = ref<Runner[]>([]);
const connected = ref(false);
const isExpanded = ref(false);
const latestLog = ref('');
let source: EventSource | undefined;
let timer: number | undefined;

const online = computed(() => runners.value.filter((r) => ['online', 'busy'].includes(r.health)).length);

const refresh = async () => {
  try {
    runners.value = (await axios.get('/api/runners/dashboard')).data.data || [];
  } catch {
    runners.value = [];
  }
};

onMounted(() => {
  void refresh();
  try {
    source = new EventSource('/api/tasks/agent-runs/stream');
    source.onopen = () => { connected.value = true; };
    source.onerror = () => { connected.value = false; };
    source.addEventListener('agent-run', () => void refresh());
    source.addEventListener('agent-log', (event) => {
      try {
        latestLog.value = JSON.parse((event as MessageEvent).data).content || '';
      } catch {}
    });
  } catch {}
  timer = window.setInterval(() => void refresh(), 30000);
});

onBeforeUnmount(() => {
  source?.close();
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <section class="mx-3 sm:mx-6 mt-2 rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/60 backdrop-blur-md px-3.5 py-2 text-xs shadow-xs transition-all">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="flex h-2 w-2 relative">
          <span v-if="online > 0 || connected" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-2 w-2" :class="online > 0 ? 'bg-emerald-500' : connected ? 'bg-cyan-500' : 'bg-slate-500'" />
        </span>
        <span class="font-bold text-slate-800 dark:text-slate-200">Local Runners:</span>
        <span class="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
          {{ online }}/{{ runners.length }} active
        </span>
        <span v-if="!runners.length" class="hidden sm:inline text-slate-400 text-[11px]">
          (Pair Desktop Companion to execute tasks locally)
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span :class="['font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border', connected ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-amber-950/40 text-amber-400 border-amber-800/50']">
          {{ connected ? '● Live' : '● Polling' }}
        </span>
        <button
          v-if="runners.length"
          @click="isExpanded = !isExpanded"
          class="text-[11px] font-semibold text-blue-500 hover:text-blue-400 cursor-pointer"
        >
          {{ isExpanded ? 'Hide Details ▲' : 'Show Details ▼' }}
        </button>
      </div>
    </div>

    <!-- Expanded Runner Details -->
    <div v-if="isExpanded && runners.length" class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="runner in runners"
          :key="runner.id"
          class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-2.5 space-y-1"
        >
          <div class="flex items-center justify-between gap-2">
            <b class="truncate text-slate-800 dark:text-slate-200 font-bold text-xs">{{ runner.name }}</b>
            <span
              :class="[
                'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase',
                runner.health === 'offline' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                runner.health === 'busy' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-emerald-950 text-emerald-300 border border-emerald-800'
              ]"
            >
              {{ runner.health }}
            </span>
          </div>
          <div class="text-[10px] text-slate-500">v{{ runner.version || '1.0' }} · {{ runner.active_runs_count }} active tasks</div>
          <div v-if="runner.latest_error" class="text-[10px] text-rose-400 truncate">Error: {{ runner.latest_error }}</div>
        </article>
      </div>

      <pre v-if="latestLog" class="mt-2.5 max-h-20 overflow-auto rounded-xl bg-slate-950 p-2.5 text-[10px] font-mono text-emerald-300 border border-slate-800">{{ latestLog }}</pre>
    </div>
  </section>
</template>
