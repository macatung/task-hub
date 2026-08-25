<script setup lang="ts">
import type { DesktopCredential } from '../../composables/useTaskSync';
defineProps<{ credential: DesktopCredential | null; online: boolean; syncing: boolean; lastSynced: string | null; isMaximized: boolean }>();
defineEmits<{ sync: []; connect: []; disconnect: []; settings: []; requirement: []; docs: []; openHub: []; timeline: []; minimize: []; maximize: []; close: [] }>();
</script>

<template>
  <header class="cc-titlebar drag-region border-b border-slate-200 text-slate-900">
    <div class="cc-titlebar__identity">
      <div class="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">TH</div>
      <div class="min-w-0"><h1 class="truncate text-sm font-semibold">Task Hub Control Center</h1><p class="truncate text-xs text-slate-500">{{ credential?.workspaceName || credential?.projectTitle || 'Local AI workspace' }}</p></div>
      <span class="cc-connection-state" :class="online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'" :title="online ? 'Connected and synchronized with Task Hub' : credential ? 'Task Hub is temporarily offline' : 'Connect a Task Hub workspace to synchronize work'">
        <i class="h-1.5 w-1.5 rounded-full" :class="online ? 'bg-emerald-500' : 'bg-slate-400'" />{{ online ? 'Synced' : credential ? 'Offline' : 'Not connected' }}
      </span>
    </div>
    <div class="no-drag cc-titlebar__actions">
      <span v-if="lastSynced" class="hidden text-slate-400 xl:inline">Updated {{ lastSynced }}</span>
      <button class="cc-button" :disabled="syncing" @click="$emit('sync')">{{ syncing ? 'Syncing…' : 'Sync now' }}</button>
      <button class="cc-button" @click="$emit('requirement')">New requirement</button>
      <details class="cc-overflow-menu"><summary class="cc-button" aria-label="More workspace actions">More <i class="codicon codicon-chevron-down" /></summary><div class="cc-overflow-menu__panel"><button @click="$emit('docs')">Scan repo docs</button><button @click="$emit('timeline')">Timeline</button><button @click="$emit('settings')">Settings</button><button v-if="credential" @click="$emit('openHub')">Open Hub</button><button @click="credential ? $emit('disconnect') : $emit('connect')">{{ credential ? 'Disconnect' : 'Connect Hub' }}</button></div></details>
    </div>
    <div class="no-drag cc-window-controls" aria-label="Window controls"><button aria-label="Minimize" title="Minimize" @click="$emit('minimize')"><i class="codicon codicon-chrome-minimize" /></button><button :aria-label="isMaximized ? 'Restore window' : 'Maximize window'" :title="isMaximized ? 'Restore window' : 'Maximize window'" @click="$emit('maximize')"><i class="codicon" :class="isMaximized ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'" /></button><button class="cc-window-controls__close" aria-label="Close" title="Close" @click="$emit('close')"><i class="codicon codicon-chrome-close" /></button></div>
  </header>
</template>
