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
  caoStatus?: {
    running: boolean;
    available: boolean;
    reconnecting?: boolean;
    port?: number;
  } | null;
  caoReconnecting?: boolean;
}>();

const connectionLabel = () => props.online ? 'Midnight Hub connected' : props.connected ? 'Midnight Hub offline' : 'Midnight Hub not connected';
const runLabel = () => ({ idle: 'Ready', running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }[props.runStatus]);
const locationLabel = () => props.worktree || props.workspace || 'No workspace selected';
</script>

<template>
  <footer class="flex min-h-[2.25rem] items-center justify-between border-t border-[#141b2d] bg-[#070b14] px-3.5 py-1 text-[11px] text-zinc-400 select-none" aria-label="Application status">
    <!-- Left: Real Operational Pills in AgentsRoom Style -->
    <div class="flex items-center gap-1.5 flex-wrap shrink-0">
      <!-- Hub Connection State Pill -->
      <div
        class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-0.5 border"
        :class="online ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300' : connected ? 'bg-amber-950/40 border-amber-600/40 text-amber-300' : 'bg-[#0c1220] border-[#141b2d] text-zinc-500'"
        :title="connectionLabel()"
      >
        <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="online ? 'bg-[#00f5a0] animate-pulse' : connected ? 'bg-amber-400' : 'bg-zinc-600'"></span>
        <span class="text-[10px] font-bold tracking-wider uppercase leading-none font-mono">{{ connectionLabel() }}</span>
      </div>

      <!-- CAO Daemon Status Pill -->
      <div
        class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-0.5 border"
        :class="
          (caoReconnecting || caoStatus?.reconnecting)
            ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
            : caoStatus?.available
              ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
              : 'bg-[#0c1220] border-[#141b2d] text-zinc-500'
        "
        :title="
          (caoReconnecting || caoStatus?.reconnecting)
            ? 'CAO Daemon: Reconnecting'
            : caoStatus?.available
              ? `CAO Daemon: Connected on port ${caoStatus.port || 9889}`
              : 'CAO Daemon: Offline'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full shrink-0"
          :class="
            (caoReconnecting || caoStatus?.reconnecting)
              ? 'bg-amber-400 animate-pulse'
              : caoStatus?.available
                ? 'bg-[#00f5a0]'
                : 'bg-zinc-600'
          "
        ></span>
        <span class="text-[10px] font-bold tracking-wider uppercase leading-none font-mono">
          {{
            (caoReconnecting || caoStatus?.reconnecting)
              ? 'CAO: RECONNECTING'
              : caoStatus?.available
                ? 'CAO: CONNECTED'
                : 'CAO: OFFLINE'
          }}
        </span>
      </div>

      <!-- AI Provider Pill -->
      <div class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-0.5 text-zinc-300" :title="`AI Engine: ${provider}`">
        <i class="codicon codicon-hubot text-xs text-[#00f5a0] shrink-0"></i>
        <span class="text-[10px] font-bold tracking-wider uppercase font-mono leading-none">{{ provider.toUpperCase() }}</span>
      </div>

      <!-- Worktree / Workspace Location Pill -->
      <div class="hidden md:inline-flex items-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-0.5 text-zinc-400 max-w-[240px] truncate" :title="locationLabel()">
        <i class="codicon codicon-folder text-xs text-zinc-500 shrink-0"></i>
        <span class="text-[10px] truncate font-mono leading-none">{{ locationLabel() }}</span>
      </div>
    </div>

    <!-- Center: Real Execution Status & Phase Indicator -->
    <div class="flex items-center gap-2 shrink-0">
      <div
        class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-3 py-0.5 border"
        :class="
          runStatus === 'running'
            ? 'bg-emerald-950/40 border-emerald-600/40 text-[#00f5a0]'
            : runStatus === 'failed'
              ? 'bg-rose-950/40 border-rose-600/40 text-rose-400'
              : runStatus === 'completed'
                ? 'bg-sky-950/40 border-sky-600/40 text-[#00f5d4]'
                : 'bg-[#11182c] border-[#141b2d] text-zinc-400'
        "
        :title="`${runLabel()} · ${phase}`"
      >
        <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="runStatus === 'running' ? 'bg-[#00f5a0] animate-pulse' : runStatus === 'failed' ? 'bg-rose-400' : 'bg-zinc-500'"></span>
        <span class="text-[10px] font-bold tracking-wider uppercase leading-none font-mono">{{ runLabel() }} · {{ phase }}</span>
      </div>
    </div>

    <!-- Right: App Version Badge -->
    <div class="flex items-center gap-2 shrink-0">
      <span class="inline-flex items-center justify-center shrink-0 gap-1 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-0.5 font-mono text-[10px] text-zinc-400" :title="`Midnight Hub Desktop ${appVersion}`">
        <i class="codicon codicon-zap text-xs text-[#00f5a0] shrink-0"></i>
        <span class="leading-none">{{ appVersion.startsWith('v') ? appVersion : `v${appVersion}` }}</span>
      </span>
    </div>
  </footer>
</template>
