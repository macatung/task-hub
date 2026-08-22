<script setup lang="ts">
import type { ProjectItem, TaskItem } from '../composables/useTaskSync';
import AgentConsoleModal from '../components/AgentConsoleModal.vue';

const props = defineProps<{
  tasks: TaskItem[];
  projects?: ProjectItem[];
  initialTask?: TaskItem | null;
  isConnected?: boolean;
  desktopCredential?: { taskHubUrl: string; token: string; projectId: string } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fullscreen-change', value: boolean): void;
  (e: 'switch-mode', mode: 'mascot'): void;
}>();
</script>

<template>
  <div class="w-full h-full min-w-0 min-h-0 overflow-hidden bg-[#1e1e1e] text-zinc-100 flex flex-col select-none">
    <AgentConsoleModal
      :tasks="tasks"
      :projects="projects"
      :initial-task="initialTask"
      :is-connected="isConnected"
      :desktop-credential="desktopCredential"
      :is-standalone="true"
      @close="emit('close')"
      @fullscreen-change="emit('fullscreen-change', $event)"
      @switch-mode="emit('switch-mode', $event)"
    />
  </div>
</template>

<style scoped>
</style>
