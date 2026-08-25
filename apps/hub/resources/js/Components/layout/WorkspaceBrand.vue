<script setup lang="ts">
defineProps<{ dark?: boolean }>();
</script>

<template>
  <a href="/" class="workspace-brand group flex items-center gap-2.5 shrink-0" aria-label="Task Hub home">
    <img src="/brand/task-hub-mark.svg" alt="" class="h-9 w-9 rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-105" />
    <span class="leading-tight">
      <span :class="['block font-display text-base font-bold tracking-tight', dark ? 'text-white' : 'text-slate-950']">Task Hub</span>
      <span :class="['block text-[10px] font-medium tracking-wide', dark ? 'text-slate-400' : 'text-slate-500']">Delivery workspace</span>
    </span>
  </a>
</template>
