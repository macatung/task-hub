<script setup lang="ts">
import { ref } from 'vue';
import { useZenTimeCycle } from '../composables/useZenTimeCycle';

defineProps<{
  isHovered?: boolean;
}>();

const { activeZenPhase } = useZenTimeCycle();
const isRippling = ref(false);

const triggerChime = () => {
  isRippling.value = true;
  setTimeout(() => {
    isRippling.value = false;
  }, 1200);
};

defineExpose({
  triggerChime,
});
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center select-none cursor-pointer group"
    @click="triggerChime"
  >
    <!-- Dynamic Ambient Aura Atmosphere (Time-of-day tinted) -->
    <div
      class="absolute -inset-4 rounded-full blur-2xl opacity-60 pointer-events-none transition-all duration-1000 animate-zen-pulse"
      :style="{ background: `radial-gradient(circle, ${activeZenPhase.accentGlow} 0%, transparent 70%)` }"
    />

    <!-- Expanding Golden Shockwave Ripple on Click / Chime -->
    <div
      v-if="isRippling"
      class="absolute w-36 h-36 rounded-full border-2 border-amber-300/80 pointer-events-none animate-zen-shockwave"
      :style="{ borderColor: activeZenPhase.haloColor }"
    />

    <!-- Mindful Stardust Particles (Floating motes) -->
    <div class="absolute inset-0 pointer-events-none overflow-visible">
      <span
        class="zen-particle p1"
        :style="{ backgroundColor: activeZenPhase.stardustColor }"
      />
      <span
        class="zen-particle p2"
        :style="{ backgroundColor: activeZenPhase.stardustColor }"
      />
      <span
        class="zen-particle p3"
        :style="{ backgroundColor: activeZenPhase.stardustColor }"
      />
      <span
        class="zen-particle p4"
        :style="{ backgroundColor: activeZenPhase.stardustColor }"
      />
    </div>

    <!-- Main HD Vector SVG Stage -->
    <div class="relative z-10 flex flex-col items-center animate-zen-float">
      <svg
        width="140"
        height="155"
        viewBox="0 0 180 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <!-- Dynamic Phase Halo Gradient -->
          <radialGradient id="phaseHaloGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" :stop-color="activeZenPhase.accentHex" stop-opacity="0.8" />
            <stop offset="60%" :stop-color="activeZenPhase.secondaryHex" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0" />
          </radialGradient>

          <!-- Lotus Petals Gradient -->
          <linearGradient id="lotusPetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fda4af" />
            <stop offset="35%" stop-color="#f43f5e" />
            <stop offset="85%" stop-color="#be123c" />
            <stop offset="100%" stop-color="#4c0519" />
          </linearGradient>

          <!-- Kasaya Robe Gradient -->
          <linearGradient id="kasayaRobeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="25%" stop-color="#f59e0b" />
            <stop offset="70%" stop-color="#b45309" />
            <stop offset="100%" stop-color="#78350f" />
          </linearGradient>

          <!-- Monk Skin Gradient -->
          <linearGradient id="monkSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fffbeb" />
            <stop offset="55%" stop-color="#fef3c7" />
            <stop offset="100%" stop-color="#fde68a" />
          </linearGradient>

          <!-- Golden Accent Gradient -->
          <linearGradient id="goldTrimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#fde047" />
            <stop offset="50%" stop-color="#eab308" />
            <stop offset="100%" stop-color="#ca8a04" />
          </linearGradient>
        </defs>

        <!-- 1. Background Radiant Halo Disc -->
        <circle
          cx="90"
          cy="70"
          r="54"
          fill="url(#phaseHaloGrad)"
          class="animate-pulse opacity-75"
        />

        <!-- 2. Rotating 8-Spoke Dhammacakka Halo (Bát Chánh Đạo) -->
        <g class="animate-dhammacakka-spin" transform-origin="90 70">
          <circle
            cx="90"
            cy="70"
            r="46"
            stroke="url(#goldTrimGrad)"
            stroke-width="1.8"
            stroke-dasharray="4 2"
            opacity="0.85"
          />
          <circle
            cx="90"
            cy="70"
            r="38"
            stroke="url(#goldTrimGrad)"
            stroke-width="1"
            opacity="0.5"
          />
          <!-- 8 Spokes of the Wheel of Dhamma -->
          <line x1="90" y1="24" x2="90" y2="116" stroke="url(#goldTrimGrad)" stroke-width="1.2" opacity="0.6" />
          <line x1="44" y1="70" x2="136" y2="70" stroke="url(#goldTrimGrad)" stroke-width="1.2" opacity="0.6" />
          <line x1="57.5" y1="37.5" x2="122.5" y2="102.5" stroke="url(#goldTrimGrad)" stroke-width="1.2" opacity="0.6" />
          <line x1="122.5" y1="37.5" x2="57.5" y2="102.5" stroke="url(#goldTrimGrad)" stroke-width="1.2" opacity="0.6" />
          <!-- Small jewel studs on halo rim -->
          <circle cx="90" cy="24" r="2" fill="#fef08a" />
          <circle cx="90" cy="116" r="2" fill="#fef08a" />
          <circle cx="44" cy="70" r="2" fill="#fef08a" />
          <circle cx="136" cy="70" r="2" fill="#fef08a" />
        </g>

        <!-- 3. Blooming Lotus Throne (Padmāsana) -->
        <g transform="translate(15, 12)">
          <!-- Rear Petals -->
          <path
            d="M32 108 C16 98 22 84 40 88 C52 92 56 104 32 108 Z"
            fill="url(#lotusPetalGrad)"
            stroke="#fde047"
            stroke-width="1.2"
          />
          <path
            d="M118 108 C134 98 128 84 110 88 C98 92 94 104 118 108 Z"
            fill="url(#lotusPetalGrad)"
            stroke="#fde047"
            stroke-width="1.2"
          />

          <!-- Golden Lotus Base Pedestal -->
          <ellipse
            cx="75"
            cy="114"
            rx="45"
            ry="14"
            fill="url(#goldTrimGrad)"
            stroke="#fef08a"
            stroke-width="1.8"
          />

          <!-- Front Layer Blooming Petals -->
          <path
            d="M44 122 C30 108 38 90 56 96 C66 100 66 118 44 122 Z"
            fill="url(#lotusPetalGrad)"
            stroke="#fef08a"
            stroke-width="1.5"
          />
          <path
            d="M106 122 C120 108 112 90 94 96 C84 100 84 118 106 122 Z"
            fill="url(#lotusPetalGrad)"
            stroke="#fef08a"
            stroke-width="1.5"
          />
          <!-- Center Lotus Petal -->
          <path
            d="M75 92 C62 108 65 128 75 132 C85 128 88 108 75 92 Z"
            fill="#f43f5e"
            stroke="#fef08a"
            stroke-width="1.6"
          />
          <line x1="75" y1="96" x2="75" y2="126" stroke="#fef08a" stroke-width="1.2" stroke-linecap="round" />
        </g>

        <!-- 4. Meditating Body in Kasaya Robe -->
        <g transform="translate(15, 12)">
          <!-- Robe Shape -->
          <path
            d="M48 82 C44 68 56 64 75 64 C94 64 106 68 102 82 C106 96 112 110 106 116 C96 122 54 122 44 116 C38 110 44 96 48 82 Z"
            fill="url(#kasayaRobeGrad)"
            stroke="#fef08a"
            stroke-width="1.8"
          />
          <!-- Kasaya Sash & Fold Line -->
          <path
            d="M58 66 C72 78 86 92 88 112"
            stroke="url(#goldTrimGrad)"
            stroke-width="2.2"
            fill="none"
            stroke-linecap="round"
          />

          <!-- 108 Bodhi Mala Beads Necklace -->
          <path
            d="M62 76 Q75 90 88 76"
            stroke="#78350f"
            stroke-width="1.5"
            stroke-dasharray="2 3"
            fill="none"
            stroke-linecap="round"
          />
          <circle cx="75" cy="85" r="2.2" fill="#eab308" stroke="#78350f" stroke-width="0.8" />

          <!-- Meditating Hands in Dhyāna Mudrā -->
          <ellipse
            cx="75"
            cy="102"
            rx="13"
            ry="6"
            fill="#fef3c7"
            stroke="#fde047"
            stroke-width="1.5"
          />
          <!-- Glowing Pearl of Wisdom in Palm -->
          <circle cx="75" cy="100" r="2.5" fill="#fef08a" stroke="#d97706" stroke-width="0.8" />

          <!-- 5. Serene Monk Head -->
          <ellipse
            cx="75"
            cy="52"
            rx="23"
            ry="21"
            fill="url(#monkSkinGrad)"
            stroke="url(#goldTrimGrad)"
            stroke-width="2"
          />
          <!-- Ūrṇā Jewel (Bạch Ngọc Minh Châu) between brows -->
          <circle cx="75" cy="40" r="2.5" fill="#d97706" stroke="#fef08a" stroke-width="0.6" />
          <circle cx="75" cy="40" r="1.2" fill="#fffbeb" />

          <!-- Meditative Peaceful Eyes (Khép Hờ Quán Thở) -->
          <path
            d="M61 51 Q67 57 73 51"
            stroke="#78350f"
            stroke-width="2.4"
            stroke-linecap="round"
            fill="none"
          />
          <path
            d="M77 51 Q83 57 89 51"
            stroke="#78350f"
            stroke-width="2.4"
            stroke-linecap="round"
            fill="none"
          />

          <!-- Serene Compassionate Smile -->
          <path
            d="M71 62 Q75 66 79 62"
            stroke="#92400e"
            stroke-width="1.8"
            stroke-linecap="round"
            fill="none"
          />

          <!-- Rosy Cheeks of Serenity -->
          <ellipse cx="60" cy="55" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.55" />
          <ellipse cx="90" cy="55" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.55" />
        </g>
      </svg>

      <!-- Compact Zen Task Companion Badge with Time Phase Icon -->
      <div
        class="mt-1 px-3 py-0.5 rounded-full bg-stone-950/95 border text-[10px] font-serif font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-colors duration-700 ring-1 ring-white/10"
        :style="{ borderColor: activeZenPhase.accentHex, color: activeZenPhase.stardustColor }"
      >
        <span class="text-[11px]">{{ activeZenPhase.icon }}</span>
        <span>{{ activeZenPhase.paliName }}</span>
        <span class="w-1 h-1 rounded-full animate-ping" :style="{ backgroundColor: activeZenPhase.accentHex }"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes zen-float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes zen-pulse {
  0%, 100% {
    transform: scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.8;
  }
}

@keyframes dhammacakka-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes zen-shockwave {
  0% {
    transform: scale(0.6);
    opacity: 1;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

@keyframes stardust-rise {
  0% {
    transform: translateY(10px) scale(0.5);
    opacity: 0;
  }
  50% {
    opacity: 0.9;
    transform: translateY(-10px) scale(1);
  }
  100% {
    transform: translateY(-25px) scale(0.2);
    opacity: 0;
  }
}

.animate-zen-float {
  animation: zen-float 4.5s ease-in-out infinite;
}

.animate-zen-pulse {
  animation: zen-pulse 5s ease-in-out infinite;
}

.animate-dhammacakka-spin {
  animation: dhammacakka-spin 24s linear infinite;
}

.animate-zen-shockwave {
  animation: zen-shockwave 1.1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}

.zen-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  filter: drop-shadow(0 0 4px currentColor);
  pointer-events: none;
}

.p1 {
  top: 30%;
  left: 10%;
  animation: stardust-rise 3.2s ease-in-out infinite;
  animation-delay: 0s;
}

.p2 {
  top: 45%;
  right: 12%;
  animation: stardust-rise 4.0s ease-in-out infinite;
  animation-delay: 1.2s;
}

.p3 {
  top: 65%;
  left: 18%;
  animation: stardust-rise 3.6s ease-in-out infinite;
  animation-delay: 2.1s;
}

.p4 {
  top: 20%;
  right: 22%;
  animation: stardust-rise 4.5s ease-in-out infinite;
  animation-delay: 0.7s;
}
</style>
