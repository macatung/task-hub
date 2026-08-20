<script setup lang="ts">
withDefaults(defineProps<{
  dark?: boolean;
  icon?: string;
  title: string;
  description?: string;
}>(), {
  dark: false,
  icon: '○',
  description: '',
});
</script>

<template>
  <div
    :class="[
      'rounded-xl border border-dashed p-6 text-center',
      dark ? 'border-slate-700 bg-slate-950/40 text-slate-300' : 'border-slate-300 bg-white text-slate-700'
    ]"
  >
    <div class="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border text-sm" :class="dark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'">
      {{ icon }}
    </div>
    <p class="text-xs font-semibold">{{ title }}</p>
    <p v-if="description" class="mt-1 text-[11px]" :class="dark ? 'text-slate-500' : 'text-slate-500'">{{ description }}</p>
    <slot />
  </div>
</template>
