<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import confetti from 'canvas-confetti';
import { sound } from '@/audio/soundEffects';
import { trackEvent } from '@/utils/analytics';
import { useTimeCycle } from '@/composables/useTimeCycle';
import { useMascotReactor } from '@/composables/useMascotReactor';

const { activePhase } = useTimeCycle();
const { currentReaction, isIdleSleeping, totalHops, incrementHop } = useMascotReactor();

type Mood = 'normal' | 'caffeine' | 'sleepy' | 'rage';
type MascotSize = 'sm' | 'md' | 'lg' | 'hero';

interface Props {
  size?: MascotSize;
  showControls?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'hero',
  showControls: true,
});

const emit = defineEmits<{
  (e: 'hop-count-change', count: number): void;
  (e: 'mood-change', mood: Mood): void;
  (e: 'milestone', count: number): void;
  (e: 'hop-end'): void;
}>();

const hopCount = ref(0);
const isHopping = ref(false);
const mood = ref<Mood>('normal');
const currentQuoteIndex = ref(0);

// Minimalist, Clean Phase Roles
const currentJobDescription = computed(() => {
  switch (activePhase.value.id) {
    case 'dawn':
      return {
        title: 'Dawn Robusta',
        icon: '🌅',
        tag: 'BARISTA ARCHITECT',
        badgeColor: '#ffd166',
        accessory: 'coffee'
      };
    case 'afternoon':
      return {
        title: 'Cyber Shipper',
        icon: '☀️',
        tag: 'CYBER DEPLOYER',
        badgeColor: '#00d2ff',
        accessory: 'sunglasses'
      };
    case 'twilight':
      return {
        title: 'Twilight Alchemist',
        icon: '🔮',
        tag: 'TWILIGHT ALCHEMIST',
        badgeColor: '#c084fc',
        accessory: 'stretch'
      };
    case 'midnight':
    default:
      return {
        title: 'Midnight Sorcery',
        icon: '🌙',
        tag: 'NIGHT SORCERER',
        badgeColor: '#00f5a0',
        accessory: 'talisman'
      };
  }
});

const quotes = computed(() => {
  const phaseQuotes: Record<string, string[]> = {
    midnight: [
      'Code lúc nửa đêm là chân ái! 🌙',
      'Vạn vật say ngủ, dòng code thức giấc! ⚡',
      'Đang yểm bùa 0 bug vào từng dòng lệnh! 📜',
      'Tập trung 100% không một tiếng ồn! ⚡',
      'Thứ Sáu deploy, thứ Bảy ngủ ngon! 🚀',
    ],
    dawn: [
      'Tách Robusta sáng sớm, nạp trọn linh khí! ☕',
      'Bình minh rực rỡ, tư duy minh mẫn! 🌅',
      'Standup chuẩn chỉ, sẵn sàng tác chiến! ⚡',
      'Vừa uống cafe vừa review pull request! ☕',
      'Cà phê không đường, code không bug! ☕',
    ],
    afternoon: [
      'Đang ship tính năng, kính râm chống chói! 🕶️',
      'Tốc độ ánh sáng, bứt phá tiến độ! 🚀',
      'Review code chuẩn mực, 0 downtime! 💎',
      'Microservices chịu tải cao điểm! ⚡',
      'Deploying feature lên production... 🚀',
    ],
    twilight: [
      'Hoàng hôn buông xuống, bóng đêm trỗi dậy! 🌆',
      'Vươn vai khởi động gân cốt cho ca đêm! 🧛‍♂️',
      'Refactor code gọn gàng, đón trăng lên! 🔮',
      'Ánh đèn neon bật, phù phép bắt đầu! 💜',
      'Nhảy nhót tí cho ấm người nào! ⚡',
    ]
  };

  return phaseQuotes[activePhase.value.id] || phaseQuotes.midnight;
});

const effectiveMood = computed<Mood>(() => {
  if (currentReaction.value) return currentReaction.value.mood;
  if (isIdleSleeping.value) return 'sleepy';
  return mood.value;
});

const currentQuote = computed(() => {
  if (currentReaction.value) {
    return `${currentReaction.value.emoji} ${currentReaction.value.message}`;
  }
  if (isIdleSleeping.value) {
    return '😴 Zzz... Khò khò... (Lữ khách đi vắng, chợp mắt tí)...';
  }
  return quotes.value[currentQuoteIndex.value % quotes.value.length];
});

const getPitchMultiplier = (): number => {
  switch (effectiveMood.value) {
    case 'caffeine':
      return 1.35;
    case 'sleepy':
      return 0.75;
    case 'rage':
      return 1.8;
    default:
      return 1.0;
  }
};

const setMood = (newMood: Mood) => {
  if (['normal', 'caffeine', 'sleepy', 'rage'].includes(newMood)) {
    mood.value = newMood;
  } else {
    mood.value = 'normal';
  }
  emit('mood-change', mood.value);
  sound.playClick();
};

const triggerHop = () => {
  hopCount.value++;
  isHopping.value = true;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('macatung_hop_count', String(hopCount.value));
    }
  } catch {
    // LocalStorage quota fallback
  }

  currentQuoteIndex.value = (currentQuoteIndex.value + 1) % quotes.value.length;
  emit('hop-count-change', hopCount.value);

  const pitch = getPitchMultiplier();
  sound.playHop(pitch);

  if (activePhase.value.id === 'midnight') {
    sound.playTerminalKey();
  }

  // Track analytics event
  trackEvent('hop_mascot', { hop_count: hopCount.value, mood: mood.value, phase: activePhase.value.id });

  // Milestone celebration on every multiple of 10
  if (hopCount.value > 0 && hopCount.value % 10 === 0) {
    emit('milestone', hopCount.value);
    sound.playSuccess();
    try {
      confetti({
        particleCount: 50,
        spread: 65,
        origin: { y: 0.65 },
        colors: [activePhase.value.accentHex, '#ffd166', '#ff0054', '#9d4edd'],
      });
    } catch {
      // Graceful fallback
    }
  }

  setTimeout(() => {
    isHopping.value = false;
    emit('hop-end');
  }, 450);
};

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches && e.touches.length > 0) {
    triggerHop();
  }
};

onMounted(() => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('macatung_hop_count');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        hopCount.value = parsed;
      }
    }
  }
});

// Size Dimensions Mapping
const dimensions = computed(() => {
  switch (props.size) {
    case 'sm':
      return { width: 'w-24', height: 'h-28', bubbleMax: 'max-w-[200px]' };
    case 'md':
      return { width: 'w-36', height: 'h-44', bubbleMax: 'max-w-[240px]' };
    case 'lg':
      return { width: 'w-52', height: 'h-64', bubbleMax: 'max-w-[280px]' };
    case 'hero':
    default:
      return { width: 'w-64 sm:w-80', height: 'h-72 sm:h-84', bubbleMax: 'max-w-[340px]' };
  }
});
</script>

<template>
  <div class="macatung-mascot-wrapper flex flex-col items-center select-none relative group">
    
    <!-- Speech Bubble (Visible on md, lg, hero sizes) -->
    <div
      v-if="size !== 'sm'"
      class="mb-3 px-4 py-2 rounded-2xl glass-panel-talisman border text-xs sm:text-sm font-sans font-medium text-center shadow-lg transition-all duration-300 relative"
      :class="dimensions.bubbleMax"
      :style="{
        borderColor: activePhase.accentBorder,
        color: activePhase.accentHex,
        boxShadow: `0 8px 24px -6px ${activePhase.accentGlow}`
      }"
    >
      <span>{{ currentQuote }}</span>
      <div
        class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-midnight-950 border-b border-r rotate-45"
        :style="{ borderColor: activePhase.accentBorder }"
      />
    </div>

    <!-- Interactive Mascot Stage with Tap/Click handlers -->
    <div
      class="mascot-avatar relative cursor-pointer flex flex-col items-center transition-transform duration-300 ease-out focus:outline-none"
      :class="[
        dimensions.width,
        dimensions.height,
        isHopping ? '-translate-y-8 scale-y-110 animate-squash-stretch' : 'hover:scale-105 active:scale-95'
      ]"
      tabindex="0"
      role="button"
      :aria-label="`Ma Cà Tưng mascot - ${currentJobDescription.title} - click to hop`"
      @click="triggerHop"
      @touchstart.passive="handleTouchStart"
      @keydown.space.prevent="triggerHop"
      @keydown.enter.prevent="triggerHop"
    >
      <!-- Jiangshi Cyber Mascot SVG (viewBox: 0 0 240 280) -->
      <svg
        class="mascot-svg w-full h-full filter transition-all duration-500"
        :style="{ filter: `drop-shadow(0 10px 24px ${activePhase.accentGlow})` }"
        viewBox="0 0 240 280"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="robeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#11182c" />
            <stop offset="60%" stop-color="#0c1220" />
            <stop offset="100%" stop-color="#04070d" />
          </linearGradient>
          <linearGradient id="hatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#070b14" />
          </linearGradient>
          <linearGradient id="talismanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" :stop-color="activePhase.particlePalette[1] || '#ffe57f'" />
            <stop offset="50%" :stop-color="activePhase.accentHex" />
            <stop offset="100%" :stop-color="activePhase.particlePalette[2] || '#f59e0b'" />
          </linearGradient>
          <radialGradient id="ghostSkin" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e2fbeb" />
            <stop offset="70%" stop-color="#b7e4c7" />
            <stop offset="100%" stop-color="#74c69d" />
          </radialGradient>
          <!-- Cyber Sunglasses Gradient -->
          <linearGradient id="sunglassesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00d2ff" />
            <stop offset="50%" stop-color="#091b34" />
            <stop offset="100%" stop-color="#00f5a0" />
          </linearGradient>
          <!-- Coffee Cup Gradient -->
          <linearGradient id="coffeeCupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#d97706" />
            <stop offset="50%" stop-color="#ffd166" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
        </defs>

        <!-- 1. Ambient Mystic Aura Circle in Midnight / Twilight (Background Layer) -->
        <circle
          v-if="activePhase.id === 'midnight' || activePhase.id === 'twilight'"
          cx="120"
          cy="140"
          r="105"
          fill="none"
          :stroke="activePhase.accentHex"
          stroke-width="1.2"
          stroke-dasharray="6,6"
          class="animate-spin-slow opacity-40 origin-center"
        />

        <!-- 2. Dynamic Ground Shadow -->
        <ellipse
          class="mascot-shadow transition-all duration-200"
          cx="120"
          cy="265"
          :rx="isHopping ? 28 : 55"
          :ry="isHopping ? 4 : 9"
          :fill="isHopping ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.65)'"
        />

        <!-- 3. Hopping Feet -->
        <ellipse cx="96" cy="248" rx="14" ry="7" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="1.5" />
        <ellipse cx="144" cy="248" rx="14" ry="7" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="1.5" />

        <!-- 4. Main Robe Body -->
        <g class="mascot-robe">
          <path
            d="M75 130 C75 130, 95 125, 120 125 C145 125, 165 130, 165 130 L182 245 C182 245, 120 252, 58 245 Z"
            fill="url(#robeGrad)"
            :stroke="activePhase.accentHex"
            stroke-width="2"
          />
          <!-- Phase-colored Robe Collar Trim -->
          <path d="M100 132 L120 162 L140 132" :stroke="activePhase.accentHex" stroke-width="2.5" fill="none" stroke-linecap="round" />
          
          <!-- Central Hexagon Core Rune -->
          <polygon points="120,172 132,179 132,193 120,200 108,193 108,179" fill="#070b14" :stroke="activePhase.accentHex" stroke-width="1.5" />
          <text x="120" y="190" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold" :fill="activePhase.accentHex">
            {{ activePhase.id === 'dawn' ? '☕' : activePhase.id === 'afternoon' ? '⚡' : activePhase.id === 'twilight' ? '🔮' : '{ }' }}
          </text>
        </g>

        <!-- 5. Ghost Head & Headphone Band -->
        <circle cx="120" cy="95" r="48" fill="url(#ghostSkin)" :stroke="activePhase.accentHex" stroke-width="2" />
        <path d="M68 95 C68 58, 172 58, 172 95" stroke="#11182c" stroke-width="8" fill="none" stroke-linecap="round" />
        
        <!-- Headphone Ear Cups with Dynamic Phase Colors -->
        <rect x="62" y="80" width="12" height="30" rx="6" :fill="activePhase.accentHex" stroke="#070b14" stroke-width="1.5" />
        <rect x="166" y="80" width="12" height="30" rx="6" :fill="activePhase.accentHex" stroke="#070b14" stroke-width="1.5" />

        <!-- 6. Jiangshi Mandarin Hat with Antenna -->
        <g class="mascot-hat">
          <path d="M74 68 C76 28, 164 28, 166 68 Z" fill="url(#hatGrad)" :stroke="activePhase.accentHex" stroke-width="2" />
          <ellipse cx="120" cy="68" rx="54" ry="14" fill="#0c1220" :stroke="activePhase.accentHex" stroke-width="2" />
          <!-- Hat Gem -->
          <circle cx="120" cy="50" r="6" :fill="activePhase.id === 'afternoon' ? '#00d2ff' : activePhase.id === 'twilight' ? '#c084fc' : '#ff0054'" :stroke="activePhase.accentHex" stroke-width="1.5" />
          <!-- Cyber Antenna & Phase Light Tip -->
          <line x1="120" y1="44" x2="120" y2="24" :stroke="activePhase.accentHex" stroke-width="2" />
          <circle cx="120" cy="22" r="4" :fill="activePhase.accentHex" class="animate-pulse" />
        </g>

        <!-- 7. Blushing Cheeks -->
        <ellipse cx="92" cy="116" rx="7" ry="4" :fill="activePhase.id === 'dawn' ? '#f59e0b' : '#ff0054'" opacity="0.4" />
        <ellipse cx="148" cy="116" rx="7" ry="4" :fill="activePhase.id === 'dawn' ? '#f59e0b' : '#ff0054'" opacity="0.4" />

        <!-- 8. Dynamic Eyes Based on Mood & Phase -->
        <g class="mascot-eyes">
          <!-- Heart Eyes on Petting -->
          <template v-if="currentReaction?.type === 'pet_loved'">
            <text x="96" y="104" font-size="16" fill="#ff0054">💖</text>
            <text x="132" y="104" font-size="16" fill="#ff0054">💖</text>
          </template>

          <!-- Dizzy Spiral Eyes on Fast Scroll -->
          <template v-else-if="currentReaction?.type === 'fast_scroll'">
            <circle cx="102" cy="98" r="8" fill="none" stroke="#00d2ff" stroke-width="2" stroke-dasharray="4 2" class="animate-spin origin-[102px_98px]" />
            <circle cx="138" cy="98" r="8" fill="none" stroke="#00d2ff" stroke-width="2" stroke-dasharray="4 2" class="animate-spin origin-[138px_98px]" />
          </template>

          <!-- Cyber Sunglasses Overlay in Afternoon Mode 🕶️ -->
          <template v-else-if="activePhase.id === 'afternoon' && effectiveMood !== 'sleepy'">
            <!-- Left Frame -->
            <polygon points="86,90 114,90 110,106 90,106" fill="url(#sunglassesGrad)" stroke="#00d2ff" stroke-width="2" />
            <!-- Right Frame -->
            <polygon points="126,90 154,90 150,106 130,106" fill="url(#sunglassesGrad)" stroke="#00d2ff" stroke-width="2" />
            <!-- Bridge -->
            <line x1="114" y1="94" x2="126" y2="94" stroke="#00d2ff" stroke-width="2" />
            <!-- Neon Glare Shine -->
            <line x1="90" y1="94" x2="98" y2="94" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
            <line x1="130" y1="94" x2="138" y2="94" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
          </template>

          <!-- Caffeine Eyes (Glowing Yellow) -->
          <template v-else-if="effectiveMood === 'caffeine'">
            <circle cx="102" cy="98" r="7" fill="#ffd166" class="animate-ping" />
            <circle cx="102" cy="98" r="6.5" fill="#ffd166" />
            <circle cx="104" cy="96" r="2.5" fill="#ffffff" />
            <circle cx="138" cy="98" r="7" fill="#ffd166" class="animate-ping" />
            <circle cx="138" cy="98" r="6.5" fill="#ffd166" />
            <circle cx="140" cy="96" r="2.5" fill="#ffffff" />
          </template>

          <!-- Sleepy Eyes (Half-closed Violet Lines) -->
          <template v-else-if="effectiveMood === 'sleepy' || isIdleSleeping">
            <path d="M96 98 Q103 104 110 98" stroke="#9d4edd" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <path d="M130 98 Q137 104 144 98" stroke="#9d4edd" stroke-width="3.5" fill="none" stroke-linecap="round" />
          </template>

          <!-- Rage Eyes (Sharp Crimson Slits) -->
          <template v-else-if="effectiveMood === 'rage'">
            <polygon points="94,92 110,99 95,102" fill="#ff0054" />
            <polygon points="146,92 130,99 145,102" fill="#ff0054" />
          </template>

          <!-- Normal Eyes -->
          <template v-else>
            <circle cx="102" cy="98" r="6" :fill="activePhase.accentHex" />
            <circle cx="104" cy="96" r="2" fill="#ffffff" />
            <circle cx="138" cy="98" r="6" :fill="activePhase.accentHex" />
            <circle cx="140" cy="96" r="2" fill="#ffffff" />
          </template>
        </g>

        <!-- 9. Cute Vampire Mouth with Fangs -->
        <path d="M112 120 Q120 127 128 120" stroke="#070b14" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <polygon points="114,120 117,126 119,120" fill="#ffffff" />
        <polygon points="121,120 123,126 126,120" fill="#ffffff" />

        <!-- 10. Forehead Talisman -->
        <g class="mascot-talisman animate-talisman-flutter origin-top">
          <rect x="105" y="55" width="30" height="62" rx="3" fill="url(#talismanGrad)" stroke="#c9182b" stroke-width="1.2" />
          <!-- Red Header Seal -->
          <circle cx="120" cy="65" r="5" fill="#c9182b" />
          <text x="120" y="68" text-anchor="middle" font-size="6" font-family="monospace" font-weight="bold" fill="#ffffff">
            {{ activePhase.id === 'dawn' ? '☕' : activePhase.id === 'afternoon' ? '🚀' : activePhase.id === 'twilight' ? '🔮' : '&lt;/&gt;' }}
          </text>
          <!-- Dynamic Inscription based on Phase & Mood -->
          <text
            x="120"
            y="85"
            text-anchor="middle"
            font-size="7.5"
            font-family="monospace"
            font-weight="bold"
            fill="#c9182b"
            letter-spacing="0.5"
          >
            {{
              mood === 'rage'
                ? 'DEPLOY'
                : activePhase.id === 'dawn'
                ? 'ROBUSTA'
                : activePhase.id === 'afternoon'
                ? 'SHIP IT'
                : activePhase.id === 'twilight'
                ? 'REFACTOR'
                : '0 BUG'
            }}
          </text>
          <!-- Circuit Rune at Bottom -->
          <path d="M112 98 L120 102 L128 98 M120 102 L120 108" stroke="#c9182b" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </g>

        <!-- ========================================================================= -->
        <!-- 11. OUTSTRETCHED JIANGSHI ARMS & CLEAN PHASE PROPS (CLEAN & MINIMALIST)    -->
        <!-- ========================================================================= -->

        <!-- A. MIDNIGHT VOID: Classic Outstretched Arms with Glowing Magic Code Runes ✨ -->
        <g v-if="activePhase.id === 'midnight'" class="animate-talisman-flutter origin-center">
          <!-- Left Arm -->
          <path d="M75 145 C40 145 25 155 18 160" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="16" cy="160" r="9" :fill="activePhase.accentHex" />
          <path d="M12 155 L8 153 M10 162 L5 163 M14 168 L10 171" stroke="#04070d" stroke-width="2" stroke-linecap="round" />
          
          <!-- Floating Glowing Code Runes & Sparks (Clean & Elegant) -->
          <text x="6" y="146" font-size="9" font-family="monospace" font-weight="bold" :fill="activePhase.accentHex" class="animate-pulse">&lt;/&gt;</text>
          <text x="24" y="184" font-size="8" font-family="monospace" :fill="activePhase.accentHex" class="animate-pulse">{ }</text>

          <!-- Right Arm -->
          <path d="M165 145 C200 145 215 155 222 160" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="224" cy="160" r="9" :fill="activePhase.accentHex" />
          <path d="M228 155 L232 153 M230 162 L235 163 M226 168 L230 171" stroke="#04070d" stroke-width="2" stroke-linecap="round" />
          
          <!-- Floating Glowing Code Runes Right -->
          <text x="216" y="146" font-size="9" font-family="monospace" font-weight="bold" :fill="activePhase.accentHex" class="animate-pulse">0 BUG</text>
          <text x="204" y="184" font-size="8" font-family="monospace" :fill="activePhase.accentHex" class="animate-pulse">⚡</text>
        </g>

        <!-- B. GOLDEN DAWN: Outstretched Arms Holding Minimalist Coffee Cup ☕ -->
        <g v-else-if="activePhase.id === 'dawn'" class="origin-center">
          <!-- Left Arm -->
          <path d="M75 145 C40 145 25 155 18 160" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="16" cy="160" r="9" fill="#00f5a0" />
          <text x="10" y="146" font-size="10" fill="#ffd166" class="animate-pulse">✨</text>

          <!-- Right Arm Holding Small Coffee Cup -->
          <path d="M165 145 C195 145 208 155 214 162" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="214" cy="162" r="9" fill="#00f5a0" />
          
          <!-- Small Clean Coffee Cup -->
          <g class="coffee-cup-prop animate-bounce-subtle" transform="translate(14, -8)">
            <polygon points="196,160 218,160 213,184 201,184" fill="url(#coffeeCupGrad)" stroke="#78350f" stroke-width="1.2" />
            <rect x="194" y="157" width="26" height="4" rx="1.5" fill="#f8fafc" stroke="#64748b" stroke-width="0.8" />
            <text x="207" y="174" text-anchor="middle" font-size="6" fill="#451a03">☕</text>
            <path d="M202 152 Q200 145 204 139" stroke="#ffd166" stroke-width="1.2" fill="none" stroke-linecap="round" class="animate-pulse" />
          </g>
        </g>

        <!-- C. HIGH-NOON FORGE: Outstretched Arms & Floating Deploy Sparks 🚀 -->
        <g v-else-if="activePhase.id === 'afternoon'" class="origin-center">
          <!-- Left Arm -->
          <path d="M75 145 C40 145 25 155 18 160" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="16" cy="160" r="9" fill="#00f5a0" />
          <text x="8" y="146" font-size="9" font-family="monospace" fill="#00d2ff" font-weight="bold" class="animate-pulse">100%</text>

          <!-- Right Arm -->
          <path d="M165 145 C200 145 215 155 222 160" stroke="#0c1220" stroke-width="16" stroke-linecap="round" fill="none" />
          <circle cx="224" cy="160" r="9" fill="#00f5a0" />
          <text x="218" y="146" font-size="9" font-family="monospace" fill="#00d2ff" font-weight="bold" class="animate-pulse">SHIP 🚀</text>
        </g>

        <!-- D. TWILIGHT DUSK: Stretching / Yoga Warm-up Pose 🔮 -->
        <g v-else class="origin-center">
          <!-- Glowing Mystic Beads across Chest -->
          <path d="M85 145 Q120 180 155 145" stroke="#c084fc" stroke-width="2.5" fill="none" stroke-dasharray="4,4" class="animate-pulse" />

          <!-- Left Arm Stretching Upward -->
          <path d="M75 145 C45 130 35 110 40 95" stroke="#0c1220" stroke-width="15" stroke-linecap="round" fill="none" />
          <circle cx="40" cy="95" r="8" :fill="activePhase.accentHex" />
          <text x="30" y="90" font-size="10" fill="#c084fc" class="animate-pulse">✨</text>

          <!-- Right Arm Stretching Upward -->
          <path d="M165 145 C195 130 205 110 200 95" stroke="#0c1220" stroke-width="15" stroke-linecap="round" fill="none" />
          <circle cx="200" cy="95" r="8" :fill="activePhase.accentHex" />
          <text x="202" y="90" font-size="10" fill="#c084fc" class="animate-pulse">✨</text>
        </g>
      </svg>
    </div>

    <!-- Minimalist Role Badge (Icon + Tên Tối Giản) -->
    <div
      class="mt-3 px-3.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg border transition-all duration-300"
      :style="{
        backgroundColor: `${activePhase.accentHex}15`,
        borderColor: activePhase.accentBorder,
        color: activePhase.accentHex,
        boxShadow: `0 0 16px -4px ${activePhase.accentGlow}`
      }"
    >
      <span>{{ currentJobDescription.icon }}</span>
      <span>{{ currentJobDescription.title }}</span>
    </div>

    <!-- Interactive Mood Switcher & Hop Tracker (Optional Controls) -->
    <div v-if="showControls" class="mt-4 flex flex-col items-center gap-3">
      <!-- Hop Counter Display -->
      <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-midnight-900/90 border border-white/10 text-xs font-mono text-slate-300">
        <span>Hops:</span>
        <span class="font-extrabold text-sm tabular-nums" :style="{ color: activePhase.accentHex }">{{ hopCount }}</span>
      </div>

      <!-- Mood Selection Pills -->
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-midnight-900/80 border border-white/10">
        <button
          v-for="m in (['normal', 'caffeine', 'sleepy', 'rage'] as const)"
          :key="m"
          type="button"
          class="px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all min-h-[32px] cursor-pointer"
          :class="mood === m
            ? 'text-midnight-950 font-bold shadow-lg'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'"
          :style="mood === m ? {
            backgroundColor: activePhase.accentHex,
            boxShadow: `0 0 12px ${activePhase.accentGlow}`
          } : {}"
          @click="setMood(m)"
        >
          {{ m }}
        </button>
      </div>
    </div>
  </div>
</template>
