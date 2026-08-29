<script setup lang="ts">
defineProps<{ dark?: boolean }>();
</script>

<template>
  <aside
    aria-label="Task context and agent activity"
    :class="[
      'task-context-rail space-y-5 p-5 sm:p-6 rounded-2xl border shadow-sm',
      dark ? 'bg-midnight-900/90 border-midnight-800/80 text-slate-100' : 'bg-slate-50/90 border-slate-200/90 text-slate-900',
    ]"
  >
    <slot />
  </aside>
</template>
