<script setup lang="ts">
import { ref, watch } from 'vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';
import { useZenTimeCycle } from '@/composables/useZenTimeCycle';

const { activeZenPhase } = useZenTimeCycle();

const isHovered = ref(false);
const activeQuoteIndex = ref(0);
const isSpeaking = ref(false);
const customQuote = ref<string | null>(null);

const allZenQuotes = [
  'Dù thân là Ma Cà Tưng lang thang trong đêm tối, khi gặp Chánh Pháp cũng buông bỏ chấp thủ để an trú trong Chánh Niệm.',
  'Đêm dài với kẻ mất ngủ; Luân hồi dài với kẻ chưa thấy Chánh Pháp. Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười.',
  'Ý dẫn đầu các pháp, Ý làm chủ, ý tạo. Giữ tâm ý trong sạch, an lạc sẽ theo sau như bóng không rời hình.',
  'Vạn pháp do duyên sinh, cũng do duyên mà diệt. An nhiên trước thị phi, được mất của thế gian.',
  'Ehipassiko — Hãy Đến Để Thấy! Chánh Pháp không phân biệt xuất thân hay giai cấp, ma hay người đều có thể giác ngộ.'
];

// When phase changes, trigger speech bubble with phase advice
watch(
  () => activeZenPhase.value.id,
  () => {
    customQuote.value = activeZenPhase.value.mascotQuote;
    isSpeaking.value = true;
    setTimeout(() => {
      isSpeaking.value = false;
    }, 7000);
  }
);

const handleMascotClick = () => {
  mindfulBell.ringBell(432, 6.0);
  activeQuoteIndex.value = (activeQuoteIndex.value + 1) % allZenQuotes.length;
  customQuote.value = allZenQuotes[activeQuoteIndex.value];
  isSpeaking.value = true;
  setTimeout(() => {
    isSpeaking.value = false;
  }, 7000);
};

const currentDisplayQuote = () => {
  return customQuote.value || activeZenPhase.value.mascotQuote || allZenQuotes[0];
};
</script>

<template>
  <div class="relative inline-flex flex-col items-center select-none group max-w-full">
    <!-- 1. Floating Speech Bubble (Lời Khai Thị Biến Đổi Theo Thời Gian) -->
    <transition
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="opacity-0 translate-y-3 scale-90"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-3 scale-90"
    >
      <div
        v-if="isSpeaking || isHovered"
        class="absolute -top-24 sm:-top-24 z-30 w-[270px] sm:w-auto max-w-[88vw] sm:max-w-md px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-stone-900/98 border-2 border-amber-500/60 text-amber-100 text-xs sm:text-sm font-serif shadow-[0_20px_50px_rgba(217,119,6,0.35)] backdrop-blur-xl text-center leading-relaxed left-1/2 -translate-x-1/2"
      >
        <p class="italic text-[11px] sm:text-xs md:text-sm break-words">"{{ currentDisplayQuote() }}"</p>
        <div class="flex items-center justify-center gap-1.5 sm:gap-2 mt-1.5 pt-1.5 border-t border-amber-500/20 text-[10px] text-amber-400 font-sans font-bold">
          <span>{{ activeZenPhase.icon }}</span>
          <span>Ma Cà Tưng • {{ activeZenPhase.vietnameseName }}</span>
        </div>
        <!-- Speech Bubble Arrow -->
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-stone-900 border-r-2 border-b-2 border-amber-500/60 rotate-45" />
      </div>
    </transition>

    <!-- 2. Dynamic 4-Phase Zen Mascot SVG Stage (~160-220px) -->
    <div
      class="relative cursor-pointer transition-all duration-500 hover:scale-105 active:scale-95 flex items-center justify-center"
      @click="handleMascotClick"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      title="Bấm vào Ma Cà Tưng Tọa Thiền để thỉnh chuông & đàm đạo Chánh Pháp"
    >
      <!-- Radiant Golden Aura Atmosphere dynamically tinted by time phase -->
      <div
        class="absolute -inset-3 sm:-inset-4 rounded-full blur-xl animate-pulse-glow pointer-events-none transition-all duration-700"
        :style="{ background: `radial-gradient(circle, ${activeZenPhase.accentGlow} 0%, transparent 70%)` }"
      />

      <!-- HD SVG Canvas (320x320) -->
      <svg
        class="w-40 h-40 sm:w-52 sm:h-52 lg:w-56 lg:h-56 filter drop-shadow-[0_12px_28px_rgba(245,158,11,0.35)] transition-all duration-500"
        viewBox="0 0 320 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- Dynamic Aura Gradient based on phase -->
          <radialGradient id="phaseAuraGrad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" :stop-color="activeZenPhase.accentHex" stop-opacity="0.7" />
            <stop offset="40%" :stop-color="activeZenPhase.accentHex" stop-opacity="0.3" />
            <stop offset="80%" stop-color="#b45309" stop-opacity="0.1" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0" />
          </radialGradient>

          <!-- Lotus Petals Outer -->
          <linearGradient id="lotusOuterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="45%" stop-color="#f43f5e" />
            <stop offset="100%" stop-color="#881337" />
          </linearGradient>

          <!-- Lotus Front Petals -->
          <linearGradient id="lotusFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="30%" stop-color="#fb923c" />
            <stop offset="70%" stop-color="#f43f5e" />
            <stop offset="100%" stop-color="#9f1239" />
          </linearGradient>

          <!-- Lotus Seedpod Platform -->
          <linearGradient id="lotusPodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="50%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>

          <!-- Saffron Robe Variations -->
          <linearGradient id="saffronRobeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" :stop-color="activeZenPhase.id === 'dawn' ? '#fde047' : activeZenPhase.id === 'midnight' ? '#d97706' : '#fbbf24'" />
            <stop offset="50%" :stop-color="activeZenPhase.id === 'dawn' ? '#f59e0b' : activeZenPhase.id === 'midnight' ? '#92400e' : '#d97706'" />
            <stop offset="100%" stop-color="#451a03" />
          </linearGradient>

          <!-- Vampire Skin -->
          <linearGradient id="vampireSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3b4866" />
            <stop offset="50%" stop-color="#242f47" />
            <stop offset="100%" stop-color="#141c2e" />
          </linearGradient>

          <!-- Alms Bowl Metal Gradient -->
          <linearGradient id="almsBowlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#475569" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>

          <!-- Palm Leaf Scroll Gradient -->
          <linearGradient id="scrollGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#fef3c7" />
            <stop offset="50%" stop-color="#fde68a" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>

          <!-- Flame Gradient -->
          <radialGradient id="flameGrad" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="30%" stop-color="#fef08a" />
            <stop offset="60%" stop-color="#f97316" />
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- 1. BODHI HALO & ROTATING LIGHT -->
        <circle cx="160" cy="135" r="105" fill="url(#phaseAuraGrad)" />
        
        <g class="animate-spin" style="transform-origin: 160px 135px; animation-duration: 40s;">
          <circle cx="160" cy="135" r="88" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 8" opacity="0.65" />
          <circle cx="160" cy="135" r="76" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.45" />
          <line x1="160" y1="42" x2="160" y2="52" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" />
          <line x1="160" y1="218" x2="160" y2="228" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" />
          <line x1="67" y1="135" x2="77" y2="135" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" />
          <line x1="243" y1="135" x2="253" y2="135" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" />
        </g>

        <!-- 2. LOTUS THRONE PLATFORM -->
        <g id="LotusThrone" transform="translate(0, 15)">
          <g filter="drop-shadow(0 4px 10px rgba(0,0,0,0.5))">
            <path d="M70 230 C40 215 45 190 75 195 C95 198 105 220 70 230 Z" fill="url(#lotusOuterGrad)" stroke="#f59e0b" stroke-width="1.5" />
            <path d="M100 240 C65 225 75 185 110 195 C125 200 130 225 100 240 Z" fill="url(#lotusOuterGrad)" stroke="#f59e0b" stroke-width="1.5" />
            <path d="M250 230 C280 215 275 190 245 195 C225 198 215 220 250 230 Z" fill="url(#lotusOuterGrad)" stroke="#f59e0b" stroke-width="1.5" />
            <path d="M220 240 C255 225 245 185 210 195 C195 200 190 225 220 240 Z" fill="url(#lotusOuterGrad)" stroke="#f59e0b" stroke-width="1.5" />
          </g>

          <ellipse cx="160" cy="235" rx="72" ry="24" fill="url(#lotusPodGrad)" stroke="#fbbf24" stroke-width="2.5" />
          <circle cx="120" cy="234" r="3" fill="#78350f" />
          <circle cx="136" cy="238" r="3" fill="#78350f" />
          <circle cx="152" cy="240" r="3" fill="#78350f" />
          <circle cx="168" cy="240" r="3" fill="#78350f" />
          <circle cx="184" cy="238" r="3" fill="#78350f" />
          <circle cx="200" cy="234" r="3" fill="#78350f" />

          <g filter="drop-shadow(0 6px 12px rgba(136,19,55,0.4))">
            <path d="M105 255 C80 230 90 195 125 205 C140 210 145 245 105 255 Z" fill="url(#lotusFrontGrad)" stroke="#fef08a" stroke-width="2" />
            <path d="M215 255 C240 230 230 195 195 205 C180 210 175 245 215 255 Z" fill="url(#lotusFrontGrad)" stroke="#fef08a" stroke-width="2" />
            <path d="M160 200 C138 225 142 262 160 268 C178 262 182 225 160 200 Z" fill="url(#lotusFrontGrad)" stroke="#fef08a" stroke-width="2.5" />
            <path d="M160 206 L160 258" stroke="#fef08a" stroke-width="2" stroke-linecap="round" opacity="0.9" />
          </g>
        </g>

        <!-- 3. BODY & SAFFRON ROBE -->
        <g id="VampireBody">
          <ellipse cx="160" cy="226" rx="66" ry="22" fill="#78350f" stroke="#f59e0b" stroke-width="2" />
          
          <path
            d="M100 172 C98 150 124 142 160 142 C196 142 222 150 220 172 C226 195 234 218 224 228 C206 238 114 238 96 228 C86 218 94 195 100 172 Z"
            fill="url(#saffronRobeGrad)"
            stroke="#fbbf24"
            stroke-width="2.5"
          />

          <path d="M125 146 C150 162 178 185 186 222" stroke="#fef08a" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M116 165 C138 180 160 202 166 224" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8" />
        </g>

        <!-- 4. DYNAMIC 4-PHASE PROPS & HANDS -->
        
        <!-- [PHASE 1: MIDNIGHT] — Dhyāna Mudrā & Bodhi Mala Beads -->
        <g v-if="activeZenPhase.id === 'midnight'" id="PropMidnight" class="transition-opacity duration-500">
          <!-- Mala Beads -->
          <circle cx="132" cy="162" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <circle cx="138" cy="172" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <circle cx="146" cy="180" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <circle cx="156" cy="184" r="5.5" fill="#f59e0b" stroke="#fef08a" stroke-width="1.2" />
          <circle cx="166" cy="180" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <circle cx="174" cy="172" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <circle cx="180" cy="162" r="4.5" fill="#78350f" stroke="#fbbf24" stroke-width="0.8" />
          <path d="M156 189 L156 200" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
          
          <!-- Dhyāna Mudrā Hands -->
          <g transform="translate(136, 196)">
            <ellipse cx="24" cy="12" rx="18" ry="7" fill="#3b4866" stroke="#fde047" stroke-width="1.8" />
            <ellipse cx="24" cy="7" rx="15" ry="6" fill="#475569" stroke="#fde047" stroke-width="1.8" />
            <circle cx="24" cy="3" r="3.5" fill="#fbbf24" stroke="#78350f" stroke-width="1" />
          </g>
        </g>

        <!-- [PHASE 2: DAWN] — Alms Bowl (Bình Bát Khất Thực Đón Nắng Sớm) -->
        <g v-else-if="activeZenPhase.id === 'dawn'" id="PropDawn" class="transition-opacity duration-500">
          <g transform="translate(126, 178)">
            <!-- Alms Bowl Body -->
            <ellipse cx="34" cy="24" rx="26" ry="16" fill="url(#almsBowlGrad)" stroke="#fbbf24" stroke-width="2" />
            <!-- Gold Rim -->
            <ellipse cx="34" cy="14" rx="22" ry="7" fill="#f59e0b" stroke="#fef08a" stroke-width="1.5" />
            <!-- Steam / Fresh Scent -->
            <path d="M26 8 Q24 0 28 -4" stroke="#fde047" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7" />
            <path d="M34 6 Q38 -2 34 -6" stroke="#fde047" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7" />
            <path d="M42 8 Q40 0 44 -4" stroke="#fde047" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7" />
            <!-- Gentle Hands holding bowl -->
            <ellipse cx="10" cy="22" rx="8" ry="6" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
            <ellipse cx="58" cy="22" rx="8" ry="6" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
          </g>
        </g>

        <!-- [PHASE 3: AFTERNOON] — Palm Leaf Sutta Scroll (Kinh Lá Bối Pāḷi) -->
        <g v-else-if="activeZenPhase.id === 'afternoon'" id="PropAfternoon" class="transition-opacity duration-500">
          <g transform="translate(120, 180)">
            <!-- Palm Leaf Manuscript Box / Scroll -->
            <rect x="6" y="8" width="68" height="20" rx="4" fill="url(#scrollGrad)" stroke="#78350f" stroke-width="2" />
            <!-- Pāḷi Scripture Inscription lines -->
            <line x1="14" y1="14" x2="66" y2="14" stroke="#78350f" stroke-width="1.5" stroke-dasharray="3 2" />
            <line x1="14" y1="20" x2="58" y2="20" stroke="#78350f" stroke-width="1.5" stroke-dasharray="4 2" />
            <!-- Red Binding Ribbon -->
            <rect x="36" y="6" width="6" height="24" fill="#e11d48" stroke="#fef08a" stroke-width="1" />
            <!-- Scholar Hands holding manuscript -->
            <ellipse cx="8" cy="18" rx="7" ry="5" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
            <ellipse cx="72" cy="18" rx="7" ry="5" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
          </g>
        </g>

        <!-- [PHASE 4: TWILIGHT] — Lotus Oil Lamp (Ngọn Đèn Dầu Hoa Sen Tuệ Giác) -->
        <g v-else id="PropTwilight" class="transition-opacity duration-500">
          <g transform="translate(132, 175)">
            <!-- Golden Lotus Oil Lamp Base -->
            <path d="M18 36 C24 30 32 30 38 36 L44 42 L12 42 Z" fill="#f59e0b" stroke="#fef08a" stroke-width="1.5" />
            <ellipse cx="28" cy="28" rx="16" ry="8" fill="#d97706" stroke="#fbbf24" stroke-width="1.5" />
            <!-- Flickering Sacred Flame -->
            <ellipse cx="28" cy="14" rx="8" ry="14" fill="url(#flameGrad)" class="animate-pulse" />
            <circle cx="28" cy="16" r="3" fill="#ffffff" />
            <!-- Holding Hands -->
            <ellipse cx="14" cy="34" rx="7" ry="5" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
            <ellipse cx="42" cy="34" rx="7" ry="5" fill="#3b4866" stroke="#fde047" stroke-width="1.5" />
          </g>
        </g>

        <!-- 5. HEAD & FACIAL EXPRESSIONS (Dynamically morphs per phase) -->
        <g id="VampireHead">
          <ellipse cx="160" cy="112" rx="46" ry="42" fill="url(#vampireSkinGrad)" stroke="#fde047" stroke-width="2.5" />

          <!-- Rosy Cheeks -->
          <ellipse cx="130" cy="118" rx="8" ry="4.5" fill="#fb7185" opacity="0.6" />
          <ellipse cx="190" cy="118" rx="8" ry="4.5" fill="#fb7185" opacity="0.6" />

          <!-- EYES: DAWN (Awake Joyful Sparkling) vs OTHERS (Peaceful Meditating Closed) -->
          <g v-if="activeZenPhase.id === 'dawn'">
            <!-- Sparkling Open Joyful Eyes for Dawn -->
            <ellipse cx="140" cy="108" rx="5" ry="6" fill="#fef08a" />
            <circle cx="141" cy="107" r="2" fill="#0c0a09" />
            <circle cx="139" cy="105" r="1" fill="#ffffff" />

            <ellipse cx="180" cy="108" rx="5" ry="6" fill="#fef08a" />
            <circle cx="181" cy="107" r="2" fill="#0c0a09" />
            <circle cx="179" cy="105" r="1" fill="#ffffff" />
          </g>
          <g v-else-if="activeZenPhase.id === 'afternoon'">
            <!-- Scholarly Studying Downcast Eyes -->
            <path d="M130 106 C138 112 148 112 152 108" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" fill="none" />
            <path d="M168 108 C172 112 182 112 190 106" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" fill="none" />
          </g>
          <g v-else>
            <!-- Deep Meditation Closed Eyes -->
            <path d="M128 108 C136 115 146 115 152 108" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" fill="none" />
            <path d="M168 108 C174 115 184 115 192 108" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" fill="none" />
          </g>

          <!-- Gentle Smile -->
          <path d="M152 126 Q160 133 168 126" stroke="#fef08a" stroke-width="3" stroke-linecap="round" fill="none" />
          <polygon points="152,126 154,130 156,126" fill="#ffffff" />
          <polygon points="164,126 166,130 168,126" fill="#ffffff" />

          <!-- Third Eye Urna -->
          <circle cx="160" cy="94" r="3" fill="#fef08a" class="animate-pulse" />
          <circle cx="160" cy="94" r="6" stroke="#f59e0b" stroke-width="1" opacity="0.5" />

          <!-- Hat With Lotus -->
          <path
            d="M106 82 C106 66 214 66 214 82 L228 92 L92 92 Z"
            fill="#1c1917"
            stroke="#fbbf24"
            stroke-width="2.5"
          />
          <rect x="126" y="44" width="68" height="42" rx="6" fill="#1c1917" stroke="#fbbf24" stroke-width="2.5" />
          <line x1="126" y1="65" x2="194" y2="65" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3 3" />

          <circle cx="160" cy="65" r="11" fill="#f59e0b" stroke="#fef08a" stroke-width="2" />
          <path d="M160 57 L160 73 M152 65 L168 65 M154 59 L166 71 M154 71 L166 59" stroke="#0c0a09" stroke-width="2" stroke-linecap="round" />
          <circle cx="160" cy="65" r="3" fill="#fef08a" />
        </g>
      </svg>
    </div>

    <!-- 3. Interactive Call to Action Banner -->
    <div class="mt-2.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-serif shadow-md transition-all group-hover:border-amber-400 max-w-[90vw] text-center">
      <span class="text-[10px] sm:text-xs animate-pulse">🌸</span>
      <span class="font-bold truncate">Ma Cà Tưng • {{ activeZenPhase.vietnameseName }}</span>
      <span class="text-[10px] sm:text-xs animate-pulse">{{ activeZenPhase.icon }}</span>
    </div>
  </div>
</template>
