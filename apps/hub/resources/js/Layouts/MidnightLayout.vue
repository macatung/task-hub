<script setup lang="ts">
import MidnightNavbar from '@/Components/layout/MidnightNavbar.vue';
import MidnightFooter from '@/Components/layout/MidnightFooter.vue';

defineProps<{
  badge?: string;
}>();
</script>

<template>
  <div class="min-h-screen bg-midnight-950 text-slate-100 font-sans selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden antialiased">
    <!-- Ambient Background Glows -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[1000px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-phantom-cyan/15 to-transparent blur-[140px]" />
      <div class="absolute top-[800px] -left-40 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-phantom-blue/10 via-purple-600/10 to-transparent blur-[130px]" />
      <div class="absolute bottom-20 -right-40 h-[600px] w-[800px] rounded-full bg-gradient-to-tl from-emerald-600/10 via-teal-600/10 to-transparent blur-[150px]" />
    </div>

    <!-- Reusable Midnight Navbar -->
    <MidnightNavbar :badge="badge" />

    <!-- Main Content Area -->
    <main class="relative z-10 flex-1">
      <slot />
    </main>

    <!-- Reusable Midnight Footer -->
    <MidnightFooter />
  </div>
</template>
