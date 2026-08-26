<script setup lang="ts">
import type { Provider } from './RunWorkspace.vue';

const props = defineProps<{
  online: boolean;
  connected: boolean;
  provider: Provider;
  workspace: string;
  worktree: string;
  phase: string;
  runStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  appVersion: string;
}>();

const connectionLabel = () => props.online ? 'Hub connected' : props.connected ? 'Hub offline' : 'Hub not connected';
const runLabel = () => ({ idle: 'Ready', running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }[props.runStatus]);
const locationLabel = () => props.worktree || props.workspace || 'No workspace selected';
</script>

<template>
  <footer class="flex min-h-[2.25rem] items-center justify-between border-t border-[#251e18] bg-[#14100e] px-3.5 py-1 text-[11px] text-zinc-400 select-none" aria-label="Application status">
    <!-- Left: Real Operational Pills in AgentsRoom Style -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <!-- Hub Connection State Pill -->
      <div
        class="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border"
        :class="online ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300' : connected ? 'bg-amber-950/40 border-amber-600/40 text-amber-300' : 'bg-[#1c1713] border-[#2b221a] text-zinc-500'"
        :title="connectionLabel()"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="online ? 'bg-emerald-400 animate-pulse' : connected ? 'bg-amber-400' : 'bg-zinc-600'"></span>
        <span class="text-[10px] font-bold tracking-wider uppercase">{{ connectionLabel() }}</span>
      </div>

      <!-- AI Provider Pill -->
      <div class="flex items-center gap-1.5 rounded-full bg-[#1c1713] border border-[#2b221a] px-2.5 py-0.5 text-zinc-300" :title="`AI Engine: ${provider}`">
        <i class="codicon codicon-hubot text-xs text-orange-400"></i>
        <span class="text-[10px] font-bold tracking-wider uppercase font-mono">{{ provider.toUpperCase() }}</span>
      </div>

      <!-- Worktree / Workspace Location Pill -->
      <div class="hidden md:flex items-center gap-1.5 rounded-full bg-[#1c1713] border border-[#2b221a] px-2.5 py-0.5 text-zinc-400 max-w-[240px] truncate" :title="locationLabel()">
        <i class="codicon codicon-folder text-xs text-zinc-500"></i>
        <span class="text-[10px] truncate font-mono">{{ locationLabel() }}</span>
      </div>
    </div>

    <!-- Center: Real Execution Status & Phase Indicator -->
    <div class="flex items-center gap-2">
      <div
        class="flex items-center gap-1.5 rounded-full px-3 py-0.5 border"
        :class="
          runStatus === 'running'
            ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
            : runStatus === 'failed'
              ? 'bg-rose-950/40 border-rose-600/40 text-rose-400'
              : runStatus === 'completed'
                ? 'bg-sky-950/40 border-sky-600/40 text-sky-400'
                : 'bg-[#1e1814] border-[#31251c] text-zinc-400'
        "
        :title="`${runLabel()} · ${phase}`"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="runStatus === 'running' ? 'bg-emerald-400 animate-pulse' : runStatus === 'failed' ? 'bg-rose-400' : 'bg-zinc-500'"></span>
        <span class="text-[10px] font-bold tracking-wider uppercase">{{ runLabel() }} · {{ phase }}</span>
      </div>
    </div>

    <!-- Right: App Version Badge -->
    <div class="flex items-center gap-2">
      <span class="flex items-center gap-1 rounded-full bg-[#1a1511] border border-[#2b221a] px-2.5 py-0.5 font-mono text-[10px] text-zinc-400" :title="`Task Hub Desktop ${appVersion}`">
        <i class="codicon codicon-zap text-xs text-orange-400"></i>
        <span>{{ appVersion.startsWith('v') ? appVersion : `v${appVersion}` }}</span>
      </span>
    </div>
  </footer>
</template>
