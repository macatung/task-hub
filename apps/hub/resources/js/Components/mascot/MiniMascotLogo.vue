<script setup lang="ts">
import { ref } from 'vue';
import { sound } from '@/audio/soundEffects';
import { useTimeCycle } from '@/composables/useTimeCycle';

const { activePhase } = useTimeCycle();

interface Props {
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  enableSound?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  animated: true,
  size: 'md',
  enableSound: true,
});

const emit = defineEmits<{
  (e: 'hop'): void;
}>();

const isJumping = ref(false);

const handleHopClick = () => {
  if (isJumping.value) return;

  isJumping.value = true;
  if (props.enableSound) {
    sound.playHop(1.35);
    if (activePhase.value.id === 'midnight') {
      sound.playTerminalKey();
    }
  }
  emit('hop');

  setTimeout(() => {
    isJumping.value = false;
  }, 420);
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};
</script>

<template>
  <div
    class="relative select-none flex items-center justify-center rounded-xl bg-midnight-900 border overflow-hidden group/logo cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
    :class="[
      sizeClasses[props.size],
      isJumping ? '-translate-y-1.5' : ''
    ]"
    :style="{
      borderColor: activePhase.accentBorder,
      boxShadow: isJumping ? `0 0 25px ${activePhase.accentHex}` : `0 0 12px -2px ${activePhase.accentGlow}`
    }"
    role="button"
    :aria-label="`Ma Cà Tưng Logo Mascot - ${activePhase.name}`"
    @click="handleHopClick"
  >
    <!-- Background Gradient Glow with Active Phase Accent -->
    <div
      class="absolute inset-0 transition-colors duration-500 pointer-events-none opacity-20"
      :style="{ backgroundColor: activePhase.accentHex }"
    />

    <!-- Animated Hopping Mascot Container -->
    <div
      class="w-full h-full flex items-center justify-center p-0.5 transition-transform duration-200"
      :class="[
        props.animated && !isJumping ? 'animate-mini-hop group-hover/logo:animate-hop-fast' : '',
        isJumping ? 'scale-110 -translate-y-1' : ''
      ]"
    >
      <!-- Crisp Vector SVG Mascot -->
      <svg
        class="w-full h-full filter transition-all duration-500"
        :style="{ filter: `drop-shadow(0 2px 6px ${activePhase.accentGlow})` }"
        viewBox="0 0 100 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="miniRobeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#151d33" />
            <stop offset="60%" stop-color="#0c1220" />
            <stop offset="100%" stop-color="#04070d" />
          </linearGradient>
          <linearGradient id="miniHatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#070b14" />
          </linearGradient>
          <linearGradient id="miniTalismanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" :stop-color="activePhase.particlePalette[1] || '#ffe57f'" />
            <stop offset="50%" :stop-color="activePhase.accentHex" />
            <stop offset="100%" :stop-color="activePhase.particlePalette[2] || '#f59e0b'" />
          </linearGradient>
          <radialGradient id="miniGhostSkin" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e2fbeb" />
            <stop offset="70%" stop-color="#b7e4c7" />
            <stop offset="100%" stop-color="#74c69d" />
          </radialGradient>
        </defs>

        <!-- Dynamic Ground Shadow -->
        <ellipse
          cx="50"
          cy="110"
          :rx="isJumping ? 12 : 22"
          :ry="isJumping ? 2 : 4"
          fill="rgba(0, 0, 0, 0.55)"
        />

        <!-- Outstretched Arms -->
        <g class="animate-talisman-flutter origin-center">
          <!-- Left Arm -->
          <path
            d="M32 66 C18 66 12 70 8 72"
            stroke="#0c1220"
            stroke-width="7"
            stroke-linecap="round"
          />
          <circle cx="8" cy="72" r="4" :fill="activePhase.accentHex" />

          <!-- Right Arm -->
          <path
            d="M68 66 C82 66 88 70 92 72"
            stroke="#0c1220"
            stroke-width="7"
            stroke-linecap="round"
          />
          <circle cx="92" cy="72" r="4" :fill="activePhase.accentHex" />
        </g>

        <!-- Robe Body -->
        <path
          d="M32 58 C32 58, 40 56, 50 56 C60 56, 68 58, 68 58 L76 102 C76 102, 50 106, 24 102 Z"
          fill="url(#miniRobeGrad)"
          :stroke="activePhase.accentHex"
          stroke-width="1.2"
        />
        <!-- Robe Collar -->
        <path d="M42 59 L50 71 L58 59" :stroke="activePhase.accentHex" stroke-width="1.5" fill="none" stroke-linecap="round" />
        <polygon points="50,75 55,78 55,84 50,87 45,84 45,78" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="0.8" />
        <text x="50" y="83" text-anchor="middle" font-size="4" font-family="monospace" font-weight="bold" :fill="activePhase.accentHex">
          {{ activePhase.id === 'dawn' ? '☕' : activePhase.id === 'afternoon' ? '⚡' : activePhase.id === 'twilight' ? '🔮' : '{ }' }}
        </text>

        <!-- Feet -->
        <ellipse cx="40" cy="103" rx="6" ry="3" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="0.8" />
        <ellipse cx="60" cy="103" rx="6" ry="3" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="0.8" />

        <!-- Ghost Head -->
        <circle cx="50" cy="42" r="21" fill="url(#miniGhostSkin)" :stroke="activePhase.accentHex" stroke-width="1.2" />

        <!-- Headphones with Dynamic Phase Accent -->
        <path d="M28 42 C28 24, 72 24, 72 42" stroke="#11182c" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <rect x="25" y="36" width="5" height="13" rx="2.5" :fill="activePhase.accentHex" stroke="#070b14" stroke-width="0.8" />
        <rect x="70" y="36" width="5" height="13" rx="2.5" :fill="activePhase.accentHex" stroke="#070b14" stroke-width="0.8" />

        <!-- Mandarin Hat -->
        <path d="M30 30 C31 12, 69 12, 70 30 Z" fill="url(#miniHatGrad)" :stroke="activePhase.accentHex" stroke-width="1.2" />
        <ellipse cx="50" cy="30" rx="23" ry="6" fill="#0c1220" :stroke="activePhase.accentHex" stroke-width="1.2" />
        <!-- Hat Gem -->
        <circle cx="50" cy="22" r="2.8" :fill="activePhase.id === 'afternoon' ? '#00d2ff' : activePhase.id === 'twilight' ? '#c084fc' : '#ff0054'" :stroke="activePhase.accentHex" stroke-width="0.8" />
        <!-- Antenna -->
        <line x1="50" y1="19" x2="50" y2="10" :stroke="activePhase.accentHex" stroke-width="1.2" />
        <circle cx="50" cy="9" r="2" :fill="activePhase.accentHex" class="animate-pulse" />

        <!-- Cheeks -->
        <ellipse cx="38" cy="51" rx="3" ry="1.8" :fill="activePhase.id === 'dawn' ? '#f59e0b' : '#ff0054'" opacity="0.4" />
        <ellipse cx="62" cy="51" rx="3" ry="1.8" :fill="activePhase.id === 'dawn' ? '#f59e0b' : '#ff0054'" opacity="0.4" />

        <!-- Cyber Sunglasses in Afternoon Phase 🕶️ -->
        <template v-if="activePhase.id === 'afternoon'">
          <polygon points="36,40 48,40 46,47 38,47" fill="#091b34" stroke="#00d2ff" stroke-width="1" />
          <polygon points="52,40 64,40 62,47 54,47" fill="#091b34" stroke="#00d2ff" stroke-width="1" />
          <line x1="48" y1="42" x2="52" y2="42" stroke="#00d2ff" stroke-width="1" />
        </template>
        <!-- Standard Eyes -->
        <template v-else>
          <circle cx="42" cy="43" r="2.8" :fill="activePhase.accentHex" />
          <circle cx="43" cy="42" r="1" fill="#ffffff" />
          <circle cx="58" cy="43" r="2.8" :fill="activePhase.accentHex" />
          <circle cx="59" cy="42" r="1" fill="#ffffff" />
        </template>

        <!-- Vampire Fangs Mouth -->
        <path d="M46 52 Q50 56 54 52" stroke="#070b14" stroke-width="1.2" fill="none" stroke-linecap="round" />
        <polygon points="47,52 48.5,55 50,52" fill="#ffffff" />
        <polygon points="50,52 51.5,55 53,52" fill="#ffffff" />

        <!-- Forehead Talisman -->
        <g class="animate-talisman-flutter origin-top">
          <rect x="43" y="24" width="14" height="28" rx="1.5" fill="url(#miniTalismanGrad)" stroke="#c9182b" stroke-width="0.8" />
          <!-- Seal Circle -->
          <circle cx="50" cy="29" r="2.5" fill="#c9182b" />
          <text x="50" y="30.5" text-anchor="middle" font-size="2.5" font-family="monospace" font-weight="bold" fill="#ffffff">
            {{ activePhase.id === 'dawn' ? '☕' : activePhase.id === 'afternoon' ? '🚀' : activePhase.id === 'twilight' ? '🔮' : '&lt;/&gt;' }}
          </text>
          <!-- Code Inscription -->
          <text x="50" y="38" text-anchor="middle" font-size="3" font-family="monospace" font-weight="bold" fill="#c9182b">
            {{ activePhase.id === 'dawn' ? 'CAFE' : activePhase.id === 'afternoon' ? 'SHIP' : activePhase.id === 'twilight' ? 'REFX' : '0 BUG' }}
          </text>
          <path d="M46 44 L50 46 L54 44" stroke="#c9182b" stroke-width="0.8" stroke-linecap="round" fill="none" />
        </g>
      </svg>
    </div>
  </div>
</template>
