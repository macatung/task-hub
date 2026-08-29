<script setup lang="ts">
const props = withDefaults(defineProps<{ name: 'agent' | 'workspace' | 'shield' | 'check' | 'lock' | 'spark' | 'arrow'; size?: number; class?: string }>(), { size: 18, class: '' });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" :class="['inline-block shrink-0', props.class]" aria-hidden="true">
    <template v-if="name === 'agent'"><path d="M7 8.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/><path d="M9 5.5V3.8M15 5.5V3.8M8.5 12h.01M15.5 12h.01M9 15h6M12 8.5V6"/><path d="M3.5 12.5v2M20.5 12.5v2"/></template>
    <template v-else-if="name === 'workspace'"><circle cx="12" cy="5" r="2.2"/><circle cx="5.5" cy="17" r="2.2"/><circle cx="18.5" cy="17" r="2.2"/><path d="m10.9 6.9-4.2 8.2M13.1 6.9l4.2 8.2M7.7 17h8.6"/></template>
    <template v-else-if="name === 'shield'"><path d="M12 3.3 19 6v5.2c0 4.3-2.8 7.7-7 9.5-4.2-1.8-7-5.2-7-9.5V6l7-2.7Z"/><path d="m8.8 12 2.1 2.1 4.4-4.4"/></template>
    <template v-else-if="name === 'check'"><path d="m5 12.5 4.2 4.2L19 7"/></template>
    <template v-else-if="name === 'lock'"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2"/></template>
    <template v-else-if="name === 'spark'"><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z"/></template>
    <template v-else><path d="M5 12h13M13 6l6 6-6 6"/></template>
  </svg>
</template>
