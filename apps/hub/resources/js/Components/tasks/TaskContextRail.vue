<script setup lang="ts">
defineProps<{ dark?: boolean }>();
</script>

<template>
  <aside
    aria-label="Task context and agent activity"
    :class="[
      'task-context-rail space-y-5 p-5 sm:p-6 rounded-xl border shadow-sm',
      dark ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50/90 border-slate-200/90',
    ]"
  >
    <slot />
  </aside>
</template>
