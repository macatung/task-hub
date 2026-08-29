<script setup lang="ts">
defineProps<{ dark?: boolean }>();
</script>

<template>
  <a href="/" class="workspace-brand group flex items-center gap-2.5 shrink-0" aria-label="Midnight Hub home">
    <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-9 w-9 rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-105" />
    <span class="leading-tight">
      <span :class="['block font-display text-base font-extrabold tracking-tight font-[\'Space_Grotesk\']', dark ? 'text-white' : 'text-slate-950']">Midnight Hub</span>
      <span :class="['block text-[10px] font-medium tracking-wide font-mono', dark ? 'text-[#00f5a0]' : 'text-emerald-700']">MDNT · Studio</span>
    </span>
  </a>
</template>
