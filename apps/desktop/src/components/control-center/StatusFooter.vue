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
  <footer class="cc-statusbar" aria-label="Application status">
    <span class="cc-statusbar__item" :class="online ? 'cc-statusbar__item--success' : ''" :title="connectionLabel()"><i class="codicon" :class="online ? 'codicon-cloud' : 'codicon-circle-slash'" />{{ connectionLabel() }}</span>
    <span class="cc-statusbar__divider" />
    <span class="cc-statusbar__item" title="Selected AI provider"><i class="codicon codicon-hubot" />{{ provider === 'claude_code' ? 'Claude Code' : provider === 'antigravity' ? 'Antigravity' : 'Codex' }}</span>
    <span class="cc-statusbar__divider" />
    <span class="cc-statusbar__item cc-statusbar__location" :title="locationLabel()"><i class="codicon codicon-folder" />{{ locationLabel() }}</span>
    <span class="cc-statusbar__item cc-statusbar__phase" :class="`cc-statusbar__item--${runStatus}`" :title="phase"><i class="codicon" :class="runStatus === 'running' ? 'codicon-loading~spin' : runStatus === 'failed' ? 'codicon-error' : 'codicon-circle-large-outline'" />{{ runLabel() }} · {{ phase }}</span>
    <span class="cc-statusbar__version" :title="`Task Hub Desktop ${appVersion}`">{{ appVersion }}</span>
  </footer>
</template>
