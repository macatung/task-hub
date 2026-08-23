<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import type { DesktopCredential } from '../composables/useTaskSync';
import MacatungIcon from './MacatungIcon.vue';

const props = defineProps<{ credential: DesktopCredential | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'connected', credential: DesktopCredential): void; (e: 'disconnect'): void }>();

const taskHubUrl = 'https://task-hub.macatung.dev';
const status = ref<'idle' | 'pairing' | 'connected' | 'error'>('idle');
const message = ref('');
let pollTimer: ReturnType<typeof setInterval> | undefined;

const stopPolling = () => { if (pollTimer) clearInterval(pollTimer); pollTimer = undefined; };
const startPairing = async () => {
  stopPolling(); message.value = '';
  status.value = 'pairing';
  try {
    const pairing = await window.desktopApi.taskHub.startPairing(taskHubUrl, null);
    await window.desktopApi.openExternal(pairing.approval_url);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      try {
        if (Date.now() - started > 600000) throw new Error('Pairing expired. Start a new request.');
        const result = await window.desktopApi.taskHub.pollPairing(taskHubUrl, pairing.pairing_id, pairing.device_secret);
        if (result.status === 'approved') {
          stopPolling();
          const credential: DesktopCredential = { taskHubUrl, token: result.mcp_token, projectId: 'all', projectTitle: result.project_title, workspaceId: result.workspace_id ? String(result.workspace_id) : undefined, workspaceName: result.workspace_name, userEmail: result.user_email, userName: result.user_name };
          status.value = 'connected';
          message.value = 'Workspace authenticated. All project sync is ready.';
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
      <div><h2 class="flex items-center gap-2 font-bold"><span class="grid h-8 w-8 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><MacatungIcon name="shield" :size="17" /></span><span>Task Hub Workspace</span></h2><p class="mt-1 text-[11px] text-slate-400">Securely connect all projects in your Task Hub SaaS workspace.</p></div>
      <button class="text-slate-400 hover:text-white" @click="emit('close')">✕</button>
    </header>
    <div class="space-y-3 pt-4 text-xs">
      <div class="rounded-xl border border-cyan-900/70 bg-cyan-950/20 p-3 text-[11px] leading-relaxed text-cyan-100"><span class="mb-2 flex items-center gap-2 font-semibold text-cyan-200"><MacatungIcon name="workspace" :size="16" /> One-time confirmation · workspace-wide</span>Click Connect to launch your browser. Sign in and confirm once; Desktop Studio will automatically synchronize all authorized projects.</div>
      <p v-if="message" :class="status === 'error' ? 'text-rose-300' : 'text-emerald-300'">{{ message }}</p>
      <div class="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <button v-if="props.credential" class="rounded-lg border border-rose-800 px-3 py-2 text-rose-300 hover:bg-rose-950/50" @click="emit('disconnect')">Disconnect</button>
        <span v-else />
        <button class="rounded-lg bg-blue-500 px-4 py-2 font-bold text-slate-950 hover:bg-blue-400 disabled:opacity-50" :disabled="status === 'pairing'" @click="startPairing">{{ status === 'pairing' ? 'Waiting for approval…' : props.credential ? 'Reconnect workspace' : 'Connect Task Hub' }}</button>
      </div>
    </div>
  </div>
</template>
