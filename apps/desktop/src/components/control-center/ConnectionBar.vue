<script setup lang="ts">
import type { DesktopCredential } from '../../composables/useTaskSync';
defineProps<{ credential: DesktopCredential | null; online: boolean; syncing: boolean; lastSynced: string | null }>();
defineEmits<{ sync: []; connect: []; disconnect: []; settings: []; requirement: []; docs: []; openHub: []; timeline: []; close: [] }>();
</script>

<template>
  <header class="drag-region flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-5 text-slate-900">
    <div class="flex items-center gap-3"><div class="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">TH</div><div><h1 class="text-sm font-semibold">Task Hub Control Center</h1><p class="text-xs text-slate-500">{{ credential?.workspaceName || credential?.projectTitle || 'Local AI workspace' }}</p></div><span class="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" :class="online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"><i class="h-1.5 w-1.5 rounded-full" :class="online ? 'bg-emerald-500' : 'bg-slate-400'" />{{ online ? 'Synced' : credential ? 'Offline' : 'Not connected' }}</span></div>
    <div class="no-drag cc-toolbar flex items-center gap-2 text-xs"><span v-if="lastSynced" class="hidden text-slate-400 lg:inline">Updated {{ lastSynced }}</span><button class="cc-button" :disabled="syncing" @click="$emit('sync')">{{ syncing ? 'Syncing…' : 'Sync now' }}</button><button class="cc-button" @click="$emit('requirement')">New from requirement</button><button class="cc-button" @click="$emit('docs')">Scan repo docs</button><button class="cc-button" @click="$emit('timeline')">⏱ Timeline</button><button class="cc-button" @click="$emit('settings')">Settings</button><button v-if="credential" class="cc-button" @click="$emit('openHub')">Open Hub</button><button class="cc-button" @click="credential ? $emit('disconnect') : $emit('connect')">{{ credential ? 'Disconnect' : 'Connect Hub' }}</button><button class="px-2 text-lg text-slate-400 hover:text-slate-800" aria-label="Close" @click="$emit('close')">×</button></div>
  </header>
</template>
