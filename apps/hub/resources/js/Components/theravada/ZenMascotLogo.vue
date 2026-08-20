<script setup lang="ts">
import { useZenTimeCycle } from '@/composables/useZenTimeCycle';

defineProps<{
  size?: number | string;
}>();

const { activeZenPhase } = useZenTimeCycle();
</script>

<template>
  <div class="relative flex items-center justify-center select-none group shrink-0">
    <!-- Dynamic Ambient Glow based on active phase -->
    <div
      class="absolute -inset-1 rounded-2xl blur-md transition-all duration-700"
      :style="{ backgroundColor: activeZenPhase.accentGlow }"
    />

    <!-- Crisp Mini Zen Mascot on Lotus Emblem -->
    <svg
      :width="size || 48"
      :height="size || 48"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="relative z-10 filter drop-shadow-[0_3px_10px_rgba(245,158,11,0.5)] transition-transform duration-300 group-hover:scale-105"
    >
      <defs>
        <radialGradient id="logoBgGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#292524" />
          <stop offset="70%" stop-color="#1c1917" />
          <stop offset="100%" stop-color="#0c0a09" />
        </radialGradient>

        <radialGradient id="logoAuraDyn" cx="50%" cy="45%" r="50%">
          <stop offset="0%" :stop-color="activeZenPhase.accentHex" stop-opacity="0.8" />
          <stop offset="50%" :stop-color="activeZenPhase.accentHex" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#d97706" stop-opacity="0" />
        </radialGradient>

        <linearGradient id="logoLotus" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fb7185" />
          <stop offset="50%" stop-color="#f43f5e" />
          <stop offset="100%" stop-color="#9f1239" />
        </linearGradient>

        <linearGradient id="logoRobe" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" :stop-color="activeZenPhase.id === 'dawn' ? '#fde047' : '#fbbf24'" />
          <stop offset="50%" stop-color="#d97706" />
          <stop offset="100%" stop-color="#78350f" />
        </linearGradient>

        <linearGradient id="logoSkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3b4866" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>

      <!-- 1. Outer Rounded Shield -->
      <rect width="120" height="120" rx="30" fill="url(#logoBgGrad)" stroke="#f59e0b" stroke-width="3" />
      <rect x="4" y="4" width="112" height="112" rx="26" stroke="#fbbf24" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />

      <!-- 2. Golden Halo -->
      <circle cx="60" cy="52" r="38" fill="url(#logoAuraDyn)" />
      <circle cx="60" cy="52" r="32" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3 4" opacity="0.7" />

      <!-- 3. Blooming Lotus Throne -->
      <g transform="translate(0, 4)">
        <path d="M26 88 C14 80 18 68 32 72 C42 75 46 86 26 88 Z" fill="url(#logoLotus)" stroke="#f59e0b" stroke-width="1.2" />
        <path d="M94 88 C106 80 102 68 88 72 C78 75 74 86 94 88 Z" fill="url(#logoLotus)" stroke="#f59e0b" stroke-width="1.2" />
        
        <ellipse cx="60" cy="90" rx="30" ry="10" fill="#f59e0b" stroke="#fef08a" stroke-width="1.5" />
        
        <path d="M38 98 C28 86 34 72 48 76 C56 79 56 94 38 98 Z" fill="url(#logoLotus)" stroke="#fef08a" stroke-width="1.5" />
        <path d="M82 98 C92 86 86 72 72 76 C64 79 64 94 82 98 Z" fill="url(#logoLotus)" stroke="#fef08a" stroke-width="1.5" />
        <path d="M60 74 C50 86 52 102 60 105 C68 102 70 86 60 74 Z" fill="#f43f5e" stroke="#fef08a" stroke-width="1.5" />
        <line x1="60" y1="76" x2="60" y2="100" stroke="#fef08a" stroke-width="1.2" stroke-linecap="round" />
      </g>

      <!-- 4. Meditating Vampire -->
      <path
        d="M38 68 C36 56 46 52 60 52 C74 52 84 56 82 68 C84 78 88 88 84 92 C76 96 44 96 36 92 C32 88 36 78 38 68 Z"
        fill="url(#logoRobe)"
        stroke="#fef08a"
        stroke-width="1.5"
      />
      <path d="M48 54 C58 62 68 72 70 88" stroke="#fef08a" stroke-width="1.8" fill="none" stroke-linecap="round" />

      <!-- Mini Prop based on phase -->
      <g v-if="activeZenPhase.id === 'dawn'">
        <!-- Mini Alms Bowl -->
        <ellipse cx="60" cy="80" rx="9" ry="5" fill="#1e293b" stroke="#fef08a" stroke-width="1.2" />
      </g>
      <g v-else-if="activeZenPhase.id === 'afternoon'">
        <!-- Mini Sutta Scroll -->
        <rect x="52" y="76" width="16" height="7" rx="1.5" fill="#fde68a" stroke="#78350f" stroke-width="1" />
      </g>
      <g v-else-if="activeZenPhase.id === 'twilight'">
        <!-- Mini Flame -->
        <circle cx="60" cy="79" r="4" fill="#f97316" />
        <circle cx="60" cy="78" r="2" fill="#fef08a" />
      </g>
      <g v-else>
        <!-- Mini Dhyāna Mudrā -->
        <ellipse cx="60" cy="80" rx="10" ry="4" fill="#3b4866" stroke="#fef08a" stroke-width="1" />
        <circle cx="60" cy="78" r="1.8" fill="#fbbf24" />
      </g>

      <!-- Head Shell -->
      <ellipse cx="60" cy="44" rx="18" ry="16" fill="url(#logoSkin)" stroke="#fef08a" stroke-width="1.5" />
      
      <!-- Rosy Cheeks -->
      <ellipse cx="48" cy="46" rx="3.5" ry="2" fill="#fb7185" opacity="0.7" />
      <ellipse cx="72" cy="46" rx="3.5" ry="2" fill="#fb7185" opacity="0.7" />

      <!-- Eyes (Dawn Open vs Closed) -->
      <g v-if="activeZenPhase.id === 'dawn'">
        <circle cx="52" cy="43" r="2" fill="#fef08a" />
        <circle cx="68" cy="43" r="2" fill="#fef08a" />
      </g>
      <g v-else>
        <path d="M47 42 C50 45 54 45 57 42" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M63 42 C66 45 70 45 73 42" stroke="#fef08a" stroke-width="1.8" stroke-linecap="round" fill="none" />
      </g>

      <!-- Smile -->
      <path d="M57 49 Q60 52 63 49" stroke="#fef08a" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <polygon points="57,49 58,51 59,49" fill="#ffffff" />
      <polygon points="61,49 62,51 63,49" fill="#ffffff" />

      <!-- Third Eye Urna -->
      <circle cx="60" cy="36" r="1.5" fill="#fef08a" />

      <!-- Official Hat with Gold Lotus -->
      <path d="M40 32 C40 26 80 26 80 32 L86 36 L34 36 Z" fill="#1c1917" stroke="#f59e0b" stroke-width="1.5" />
      <rect x="47" y="18" width="26" height="16" rx="3" fill="#1c1917" stroke="#f59e0b" stroke-width="1.5" />
      <circle cx="60" cy="26" r="4.5" fill="#f59e0b" stroke="#fef08a" stroke-width="1" />
      <circle cx="60" cy="26" r="1.5" fill="#fef08a" />
    </svg>
  </div>
</template>
