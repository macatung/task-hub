<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DesktopCredential } from '../../composables/useTaskSync';

const props = defineProps<{
  open: boolean;
  credential: DesktopCredential | null;
  workspace: string;
  executionPolicy: 'restricted' | 'workspace_write' | 'full_access';
  diagnostics: { ok: boolean; sandbox: string; summary: string; details: string[]; version?: string } | null;
  diagnosticsLoading: boolean;
  updater: { status: string; version?: string; percent?: number; message?: string };
  router: { enabled: boolean; endpoint: string; hasApiKey: boolean } | null;
  routerMessage: string;
  saving: boolean;
  autoSubmitHandoff: boolean;
}>();

const emit = defineEmits<{
  close: [];
  chooseWorkspace: [];
  updateExecutionPolicy: [value: 'restricted' | 'workspace_write' | 'full_access'];
  runDiagnostics: [];
  checkAppUpdate: [];
  installAppUpdate: [];
  saveRouter: [payload: { enabled: boolean; apiKey: string }];
  checkRouter: [];
  openRouterDashboard: [];
  openHub: [];
  updateAutoSubmitHandoff: [value: boolean];
}>();

const routerEnabled = ref(false);
const apiKey = ref('');
watch(() => [props.open, props.router] as const, () => {
  routerEnabled.value = Boolean(props.router?.enabled);
  apiKey.value = '';
}, { immediate: true });
const routerHint = computed(() => props.router?.hasApiKey
  ? 'An encrypted API key is already stored on this device.'
  : 'Enter the local 9Router API key to enable this route.');
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex justify-end bg-black/55" @click.self="emit('close')">
    <aside class="flex h-full w-full max-w-xl flex-col border-l border-[#2a3546] bg-[#0b1019] text-[#e6edf7] shadow-2xl">
      <header class="flex items-start justify-between gap-4 border-b border-[#263244] px-6 py-5">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7db0ff]">Control Center</p>
          <h2 class="mt-1 text-lg font-semibold text-white">Settings & approvals</h2>
          <p class="mt-1 text-sm leading-6 text-[#a8b5c7]">Configure the local runtime. Sensitive changes stay on this device.</p>
        </div>
        <button class="cc-button" @click="emit('close')">Close</button>
      </header>

      <main class="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
        <section class="space-y-3">
          <div>
            <h3 class="text-sm font-semibold text-white">Connection</h3>
            <p class="mt-1 text-xs text-[#8b9bb0]">{{ credential ? `${credential.workspaceName || credential.projectTitle || 'Task Hub workspace'} · ${credential.taskHubUrl}` : 'No Hub workspace connected.' }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="cc-button" @click="emit('openHub')">Open Hub</button>
            <button v-if="!credential" class="cc-button" @click="emit('openHub')">Pair a workspace in Hub</button>
          </div>
        </section>

        <section class="border-t border-[#263244] pt-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-semibold text-white">Desktop update</h3>
              <p class="mt-1 text-xs leading-5 text-[#8b9bb0]">{{ updater.message || 'Check the installed desktop release for an available update.' }}</p>
            </div>
            <button class="cc-button shrink-0" :disabled="updater.status === 'checking' || updater.status === 'downloading'" @click="emit('checkAppUpdate')">{{ updater.status === 'checking' || updater.status === 'downloading' ? (updater.percent ? `Downloading ${updater.percent}%` : 'Checking…') : 'Check for updates' }}</button>
          </div>
          <div v-if="updater.status === 'downloaded'" class="mt-3 flex items-center justify-between gap-3 rounded-md border border-emerald-800/70 bg-emerald-950/30 px-3 py-2">
            <span class="text-xs text-emerald-200">Version {{ updater.version }} is ready.</span>
            <button class="cc-primary shrink-0" @click="emit('installAppUpdate')">Restart & install</button>
          </div>
          <p v-else-if="updater.status === 'error'" class="mt-3 rounded-md border border-rose-900/70 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">Update check failed. Install the latest signed Task Companion setup package, then restart the app.</p>
        </section>

        <section class="border-t border-[#263244] pt-6">
          <h3 class="text-sm font-semibold text-white">Local repository</h3>
          <p class="mt-1 text-xs leading-5 text-[#8b9bb0]">Task Hub creates isolated worktrees from this repository before starting an agent.</p>
          <div class="mt-3 flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate rounded-md bg-black/25 px-3 py-2 font-mono text-xs text-[#cbd5e1]">{{ workspace || 'No repository selected' }}</code>
            <button class="cc-button shrink-0" @click="emit('chooseWorkspace')">{{ workspace ? 'Change repo' : 'Choose repo' }}</button>
          </div>
        </section>

        <section class="border-t border-[#263244] pt-6">
          <h3 class="text-sm font-semibold text-white">Run & handoff</h3>
          <p class="mt-1 text-xs leading-5 text-[#8b9bb0]">Choose the default execution policy and decide whether a verified local run should be sent to Hub automatically.</p>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <button class="rounded-lg border px-3 py-3 text-left text-xs" :class="executionPolicy === 'restricted' ? 'border-[#4d86e8] bg-[#13233b] text-white' : 'border-[#2a3546] text-[#a8b5c7]'" @click="emit('updateExecutionPolicy', 'restricted')"><b class="block">Read only</b><span class="mt-1 block">No repository edits.</span></button>
            <button class="rounded-lg border px-3 py-3 text-left text-xs" :class="executionPolicy === 'workspace_write' ? 'border-[#4d86e8] bg-[#13233b] text-white' : 'border-[#2a3546] text-[#a8b5c7]'" @click="emit('updateExecutionPolicy', 'workspace_write')"><b class="block">Workspace write</b><span class="mt-1 block">Default for tasks.</span></button>
            <button class="rounded-lg border px-3 py-3 text-left text-xs" :class="executionPolicy === 'full_access' ? 'border-amber-500/70 bg-amber-950/30 text-white' : 'border-[#2a3546] text-[#a8b5c7]'" @click="emit('updateExecutionPolicy', 'full_access')"><b class="block">Full access</b><span class="mt-1 block">Human-approved only.</span></button>
          </div>
          <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[#2f5d9a] bg-[#10213a] p-3">
            <input class="mt-0.5" type="checkbox" :checked="autoSubmitHandoff" @change="emit('updateAutoSubmitHandoff', ($event.target as HTMLInputElement).checked)">
            <span>
              <span class="flex items-center gap-2"><b class="text-xs text-white">Auto-submit verified handoffs</b><span class="rounded-full bg-[#1e4d38] px-2 py-0.5 text-[10px] font-semibold text-emerald-200">{{ autoSubmitHandoff ? 'Enabled' : 'Disabled' }}</span></span>
              <span class="mt-1 block text-xs leading-5 text-[#b7c5d8]">When enabled, a successful task run is sent to Hub automatically only after current-run test evidence is detected and no blocker is present. Hub review is still required; this never auto-approves or merges work.</span>
            </span>
          </label>
          <div class="mt-4 rounded-lg border border-[#263244] bg-black/20 p-3">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-medium text-white">Codex diagnostics</p><p class="mt-1 text-xs text-[#8b9bb0]">Checks CLI and Windows sandbox readiness on this device.</p></div>
              <button class="cc-button shrink-0" :disabled="diagnosticsLoading" @click="emit('runDiagnostics')">{{ diagnosticsLoading ? 'Checking…' : 'Run diagnostics' }}</button>
            </div>
            <div v-if="diagnostics" class="mt-3 text-xs">
              <p :class="diagnostics.ok ? 'text-emerald-300' : 'text-amber-300'">{{ diagnostics.summary }}{{ diagnostics.version ? ` · ${diagnostics.version}` : '' }}</p>
              <ul v-if="diagnostics.details?.length" class="mt-2 list-disc space-y-1 pl-4 text-[#a8b5c7]"><li v-for="detail in diagnostics.details" :key="detail">{{ detail }}</li></ul>
            </div>
          </div>
        </section>

        <section class="border-t border-[#263244] pt-6">
          <div class="flex items-start justify-between gap-4">
            <div><h3 class="text-sm font-semibold text-white">Local 9Router</h3><p class="mt-1 text-xs leading-5 text-[#8b9bb0]">Route Codex or Claude Code through an OpenAI-compatible service on this machine. Antigravity always stays native.</p></div>
            <label class="flex shrink-0 items-center gap-2 text-xs text-[#cbd5e1]"><input v-model="routerEnabled" type="checkbox"> Enable</label>
          </div>
          <div class="mt-4 space-y-3">
            <label class="block text-xs font-medium text-[#cbd5e1]">Endpoint<input class="cc-input mt-2" :value="router?.endpoint || 'http://127.0.0.1:20128/v1'" readonly></label>
            <label class="block text-xs font-medium text-[#cbd5e1]">API key<input v-model="apiKey" class="cc-input mt-2" type="password" :placeholder="router?.hasApiKey ? 'Saved securely — enter a new key to replace' : '9Router API key'" autocomplete="off"><span class="mt-1 block font-normal text-[#8b9bb0]">{{ routerHint }}</span></label>
            <div class="flex flex-wrap items-center gap-2"><button class="cc-primary" :disabled="saving" @click="emit('saveRouter', { enabled: routerEnabled, apiKey })">{{ saving ? 'Saving…' : 'Save configuration' }}</button><button class="cc-button" :disabled="saving" @click="emit('checkRouter')">Test connection</button><button class="cc-button" @click="emit('openRouterDashboard')">Open dashboard</button></div>
            <p v-if="routerMessage" class="rounded-md border border-[#263244] bg-black/20 px-3 py-2 text-xs text-[#cbd5e1]">{{ routerMessage }}</p>
          </div>
        </section>
      </main>
    </aside>
  </div>
</template>
