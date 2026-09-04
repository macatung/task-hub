<script setup lang="ts">
import ConnectedAgentsRegistry, { type DesktopAgentItem } from '@/Components/tasks/ConnectedAgentsRegistry.vue';

const props = withDefaults(defineProps<{
  isDarkMode?: boolean;
  isCompact?: boolean;
}>(), {
  isDarkMode: true,
  isCompact: false,
});

const emit = defineEmits<{
  (e: 'dispatch', runner: DesktopAgentItem): void;
}>();

const handleDispatch = (runner: DesktopAgentItem) => {
  emit('dispatch', runner);
};
</script>

<template>
  <ConnectedAgentsRegistry :is-dark-mode="isDarkMode" :is-compact="isCompact" @dispatch="handleDispatch" />
</template>
