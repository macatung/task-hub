<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
type Runner = { id: number; name: string; version?: string | null; health: string; active_runs_count: number; next_lease_expires_at?: string | null; latest_error?: string | null };
const runners = ref<Runner[]>([]); const connected = ref(false); const latestLog = ref(''); let source: EventSource | undefined; let timer: number | undefined;
const online = computed(() => runners.value.filter((r) => ['online', 'busy'].includes(r.health)).length);
const refresh = async () => { runners.value = (await axios.get('/api/runners/dashboard')).data.data || []; };
onMounted(() => { void refresh(); source = new EventSource('/api/tasks/agent-runs/stream'); source.onopen = () => { connected.value = true; }; source.onerror = () => { connected.value = false; }; source.addEventListener('agent-run', () => void refresh()); source.addEventListener('agent-log', (event) => { try { latestLog.value = JSON.parse((event as MessageEvent).data).content || ''; } catch {} }); timer = window.setInterval(() => void refresh(), 30000); });
onBeforeUnmount(() => { source?.close(); if (timer) window.clearInterval(timer); });
</script>
<template>
  <section class="mx-4 mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
    <div class="mb-2 flex items-center justify-between text-xs"><b class="text-slate-700 dark:text-slate-100">Local Runners <span class="font-normal text-slate-400">{{ online }}/{{ runners.length }} online</span></b><span :class="connected ? 'text-emerald-500' : 'text-amber-500'">{{ connected ? '● Live' : '● Polling' }}</span></div>
    <div v-if="!runners.length" class="text-xs text-slate-400">Chưa có runner nào trong workspace này.</div>
    <div v-else class="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><article v-for="runner in runners" :key="runner.id" class="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700"><div class="flex justify-between gap-2"><b class="truncate">{{ runner.name }}</b><span :class="runner.health === 'offline' ? 'text-rose-500' : runner.health === 'busy' ? 'text-amber-500' : 'text-emerald-500'">{{ runner.health }}</span></div><div class="mt-1 text-slate-500">{{ runner.version || 'unknown' }} · {{ runner.active_runs_count }} active</div><div class="truncate text-slate-400">Lease: {{ runner.next_lease_expires_at || '—' }}</div><div v-if="runner.latest_error" class="truncate text-rose-500">Error: {{ runner.latest_error }}</div></article></div>
    <pre v-if="latestLog" class="mt-2 max-h-16 overflow-auto rounded bg-slate-950 p-2 text-[10px] text-emerald-300">{{ latestLog }}</pre>
  </section>
</template>
