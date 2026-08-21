<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import type { DesktopCredential } from '../composables/useTaskSync';

const props = defineProps<{ credential: DesktopCredential | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'connected', credential: DesktopCredential): void; (e: 'disconnect'): void }>();

const taskHubUrl = ref(props.credential?.taskHubUrl || localStorage.getItem('task_hub_base_url') || 'https://task-hub.macatung.dev');
const projectId = ref(props.credential?.projectId || localStorage.getItem('task_hub_project_id') || '');
const status = ref<'idle' | 'pairing' | 'connected' | 'error'>('idle');
const message = ref('');
let pollTimer: ReturnType<typeof setInterval> | undefined;

const stopPolling = () => { if (pollTimer) clearInterval(pollTimer); pollTimer = undefined; };
const startPairing = async () => {
  stopPolling(); message.value = '';
  if (!/^https?:\/\//i.test(taskHubUrl.value.trim())) { status.value = 'error'; message.value = 'Task Hub URL must start with http:// or https://.'; return; }
  if (!/^\d+$/.test(projectId.value.trim())) { status.value = 'error'; message.value = 'Enter the numeric project ID shown in Task Hub.'; return; }
  status.value = 'pairing';
  try {
    const pairing = await window.desktopApi.taskHub.startPairing(taskHubUrl.value.trim(), Number(projectId.value));
    await window.desktopApi.openExternal(pairing.approval_url);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      try {
        if (Date.now() - started > 600000) throw new Error('Pairing expired. Start a new request.');
        const result = await window.desktopApi.taskHub.pollPairing(taskHubUrl.value.trim(), pairing.pairing_id, pairing.device_secret);
        if (result.status === 'approved') {
          stopPolling();
          const credential: DesktopCredential = { taskHubUrl: taskHubUrl.value.trim().replace(/\/$/, ''), token: result.mcp_token, projectId: String(result.project_id) };
          localStorage.setItem('task_hub_base_url', credential.taskHubUrl);
          localStorage.setItem('task_hub_project_id', credential.projectId);
          status.value = 'connected';
          message.value = 'SaaS project authenticated. Desktop sync is ready.';
          emit('connected', credential);
        } else if (['denied', 'expired', 'rejected', 'consumed'].includes(result.status)) throw new Error(`Pairing ${result.status}.`);
      } catch (error: any) { stopPolling(); status.value = 'error'; message.value = error?.message || 'Pairing failed.'; }
    }, 1800);
  } catch (error: any) { status.value = 'error'; message.value = error?.message || 'Could not start secure pairing.'; }
};
onUnmounted(stopPolling);
</script>

<template>
  <div class="no-drag w-[min(92vw,430px)] rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-2xl" @mousedown.stop>
    <header class="flex items-start justify-between border-b border-slate-800 pb-3">
      <div><h2 class="font-bold">🔐 Task Hub SaaS connection</h2><p class="mt-1 text-[11px] text-slate-400">Authenticate one project securely for this desktop companion.</p></div>
      <button class="text-slate-400 hover:text-white" @click="emit('close')">✕</button>
    </header>
    <div class="space-y-3 pt-4 text-xs">
      <label class="block"><span class="mb-1 block font-semibold text-slate-300">Task Hub URL</span><input v-model="taskHubUrl" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-blue-500" :disabled="status === 'pairing'" /></label>
      <label class="block"><span class="mb-1 block font-semibold text-slate-300">Project ID</span><input v-model="projectId" inputmode="numeric" placeholder="Example: 12" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-blue-500" :disabled="status === 'pairing'" /></label>
      <div class="rounded-xl border border-blue-900/70 bg-blue-950/30 p-3 text-[11px] leading-relaxed text-blue-100">Click connect, approve the request in your browser while signed in with GitHub, then return here. The credential is stored in OS secure storage and is scoped to this project.</div>
      <p v-if="message" :class="status === 'error' ? 'text-rose-300' : 'text-emerald-300'">{{ message }}</p>
      <div class="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <button v-if="props.credential" class="rounded-lg border border-rose-800 px-3 py-2 text-rose-300 hover:bg-rose-950/50" @click="emit('disconnect')">Disconnect</button>
        <span v-else />
        <button class="rounded-lg bg-blue-500 px-4 py-2 font-bold text-slate-950 hover:bg-blue-400 disabled:opacity-50" :disabled="status === 'pairing'" @click="startPairing">{{ status === 'pairing' ? 'Waiting for approval…' : props.credential ? 'Reconnect project' : 'Connect project' }}</button>
      </div>
    </div>
  </div>
</template>
