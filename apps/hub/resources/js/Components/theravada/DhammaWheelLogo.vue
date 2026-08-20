<script setup lang="ts">
defineProps<{
  size?: number | string;
}>();
</script>

<template>
  <div class="relative flex items-center justify-center select-none group">
    <!-- Outer Golden Glow -->
    <div class="absolute -inset-1 rounded-2xl bg-amber-500/20 blur-md group-hover:bg-amber-400/35 transition-all" />

    <!-- Sacred 8-Spoke Wheel of Dhamma SVG -->
    <svg
      :width="size || 48"
      :height="size || 48"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="relative z-10 filter drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)] transition-transform duration-700 group-hover:rotate-45"
    >
      <defs>
        <radialGradient id="wheelGoldGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="60%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#b45309" />
        </radialGradient>
        
        <linearGradient id="lotusPetalGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="100%" stop-color="#d97706" />
        </linearGradient>
      </defs>

      <!-- Background Deep Obsidian Seal -->
      <rect width="100" height="100" rx="26" fill="#1c1917" stroke="#f59e0b" stroke-width="2.5" />

      <!-- Outer Lotus Rim (8 Cánh Sen Viền Quanh) -->
      <circle cx="50" cy="50" r="38" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 3" opacity="0.6" />
      <circle cx="50" cy="50" r="34" stroke="url(#wheelGoldGrad)" stroke-width="3" />
      <circle cx="50" cy="50" r="28" stroke="#fbbf24" stroke-width="1.5" />

      <!-- 8 Spoke Spokes (8 Nan Hoa Bát Chánh Đạo) -->
      <!-- 1. Vertical & Horizontal -->
      <line x1="50" y1="20" x2="50" y2="80" stroke="url(#wheelGoldGrad)" stroke-width="3.5" stroke-linecap="round" />
      <line x1="20" y1="50" x2="80" y2="50" stroke="url(#wheelGoldGrad)" stroke-width="3.5" stroke-linecap="round" />
      <!-- 2. Diagonals -->
      <line x1="28.8" y1="28.8" x2="71.2" y2="71.2" stroke="url(#wheelGoldGrad)" stroke-width="3.5" stroke-linecap="round" />
      <line x1="28.8" y1="71.2" x2="71.2" y2="28.8" stroke="url(#wheelGoldGrad)" stroke-width="3.5" stroke-linecap="round" />

      <!-- Central Hub (Trục Tâm Vô Vi) -->
      <circle cx="50" cy="50" r="11" fill="#1c1917" stroke="url(#wheelGoldGrad)" stroke-width="3" />
      <circle cx="50" cy="50" r="5" fill="#fef08a" />
      
      <!-- 8 Jewels on Outer Rim (8 Viên Bảo Ngọc Bát Thánh) -->
      <circle cx="50" cy="16" r="2.5" fill="#fef08a" />
      <circle cx="50" cy="84" r="2.5" fill="#fef08a" />
      <circle cx="16" cy="50" r="2.5" fill="#fef08a" />
      <circle cx="84" cy="50" r="2.5" fill="#fef08a" />
      <circle cx="26" cy="26" r="2.5" fill="#fef08a" />
      <circle cx="74" cy="74" r="2.5" fill="#fef08a" />
      <circle cx="26" cy="74" r="2.5" fill="#fef08a" />
      <circle cx="74" cy="26" r="2.5" fill="#fef08a" />
    </svg>
  </div>
</template>
