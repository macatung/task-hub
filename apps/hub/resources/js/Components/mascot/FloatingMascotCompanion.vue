<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTimeCycle } from '@/composables/useTimeCycle';
import { useMascotReactor } from '@/composables/useMascotReactor';
import TimeTravelerSlider from '@/Components/mascot/TimeTravelerSlider.vue';
import confetti from 'canvas-confetti';

const { activePhase, formattedTime } = useTimeCycle();
const {
  currentReaction,
  isIdleSleeping,
  totalHops,
  feedCoffee,
  applyTalisman,
  petMascot,
  incrementHop
} = useMascotReactor();

// UI States
const isMinimized = ref(false);
const showTimeTraveler = ref(false);
const isHovered = ref(false);
const isDragging = ref(false);

// Draggable Position
const posX = ref(0);
const posY = ref(0);
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;
let hasDragged = false;

// Compute dynamic quote or reactor message
const displayMessage = computed(() => {
  if (currentReaction.value) {
    return currentReaction.value.message;
  }
  if (isIdleSleeping.value) {
    return '😴 Zzz... Khò khò... (Lữ khách vắng mặt)...';
  }
  return activePhase.value.tagline;
});

// Drag handlers
const onPointerDown = (e: PointerEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('button') || target.closest('input')) return;

  isDragging.value = true;
  hasDragged = false;
  startX = e.clientX;
  startY = e.clientY;
  initialX = posX.value;
  initialY = posY.value;

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    hasDragged = true;
  }

  // Constrain inside viewport
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 300 : 800;
  const maxY = typeof window !== 'undefined' ? window.innerHeight - 340 : 600;
  
  posX.value = Math.max(-maxX, Math.min(20, initialX + deltaX));
  posY.value = Math.max(-maxY, Math.min(20, initialY + deltaY));
};

const onPointerUp = () => {
  isDragging.value = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
};

const handleAvatarClick = () => {
  if (hasDragged) return;
  incrementHop();
  if (totalHops.value % 10 === 0) {
    try {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.85, x: 0.85 },
        colors: [activePhase.value.accentHex, '#ffd166', '#ff0054']
      });
    } catch {}
  }
};

onMounted(() => {
  try {
    const savedMin = localStorage.getItem('macatung_companion_minimized');
    if (savedMin === 'true') isMinimized.value = true;
  } catch {}
});

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
  try {
    localStorage.setItem('macatung_companion_minimized', String(isMinimized.value));
  } catch {}
};
</script>

<template>
  <!-- Teleport directly to <body> so it never interferes with Navbar / Header layout -->
  <Teleport to="body">
    <aside
      class="fixed bottom-6 right-6 z-[9999] select-none transition-transform duration-75 ease-out pointer-events-auto"
      :style="{
        transform: `translate(${posX}px, ${posY}px)`,
        touchAction: 'none'
      }"
      @pointerdown="onPointerDown"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- MINIMIZED BADGE MODE -->
      <div
        v-if="isMinimized"
        class="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-midnight-950/95 border border-slate-700/80 backdrop-blur-2xl shadow-2xl cursor-pointer hover:border-phantom-mint hover:scale-105 transition-all duration-200"
        @click="toggleMinimize"
        title="Mở rộng Ma Cà Tưng Companion"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-lg shadow-inner animate-bounce">
          🧛‍♂️
        </span>
        <div class="flex flex-col pr-1">
          <span class="text-xs font-mono font-bold text-phantom-mint flex items-center gap-1.5">
            <span>Ma Cà Tưng</span>
            <span class="inline-block w-2 h-2 rounded-full bg-phantom-mint animate-pulse" />
          </span>
          <span class="text-[10px] font-mono text-slate-400">{{ formattedTime }}</span>
        </div>
        <button
          class="text-slate-500 hover:text-white text-xs p-1"
          aria-label="Mở rộng"
        >
          ▲
        </button>
      </div>

      <!-- EXPANDED COMPANION MODE -->
      <div
        v-else
        class="flex flex-col items-end gap-2.5 max-w-[320px] w-full"
      >
        <!-- Time Traveler Modal Dropdown (if active) -->
        <div
          v-if="showTimeTraveler"
          class="w-full mb-1 animate-fade-in"
        >
          <TimeTravelerSlider />
        </div>

        <!-- Context Reactive Speech Bubble -->
        <div
          class="relative px-4 py-2.5 rounded-2xl bg-midnight-950/95 border text-xs font-sans font-medium text-slate-200 shadow-2xl backdrop-blur-2xl transition-all duration-300 pointer-events-auto"
          :style="{
            borderColor: activePhase.accentBorder,
            boxShadow: `0 8px 32px -4px ${activePhase.accentGlow}`
          }"
        >
          <div class="flex items-start gap-2">
            <span class="text-base shrink-0">
              {{ currentReaction?.emoji || (isIdleSleeping ? '💤' : '💬') }}
            </span>
            <p class="leading-relaxed text-[12px] font-normal text-slate-200">
              {{ displayMessage }}
            </p>
          </div>
          <!-- Speech Bubble Arrow Tail -->
          <div
            class="absolute -bottom-1.5 right-8 w-3 h-3 bg-midnight-950 border-b border-r rotate-45"
            :style="{ borderColor: activePhase.accentBorder }"
          />
        </div>

        <!-- Mascot Card & Action Controls -->
        <div
          class="flex items-center gap-3 p-3.5 rounded-2xl bg-midnight-950/95 border border-slate-800/90 backdrop-blur-2xl shadow-2xl hover:border-slate-700/80 transition-all duration-300"
          :class="{ 'ring-2 ring-phantom-mint/40': isDragging }"
        >
          <!-- Interactive Avatar (Click to Hop / Drag to Move) -->
          <div
            class="relative cursor-grab active:cursor-grabbing flex flex-col items-center justify-center group/avatar shrink-0"
            @click="handleAvatarClick"
            :title="`Bấm để nhảy cùng Ma Cà Tưng! (Đã nhảy ${totalHops} bước)`"
          >
            <!-- Mascot Body SVG Animation -->
            <div class="w-16 h-20 flex items-center justify-center transition-transform duration-200 group-hover/avatar:scale-110 active:scale-95">
              <svg
                viewBox="0 0 100 120"
                class="w-full h-full drop-shadow-md"
                xmlns="http://www.w3.org/2000/svg"
              >
                <!-- Mascot Hat -->
                <path d="M20 36 C20 18 80 18 80 36 L88 44 L12 44 Z" fill="#0f172a" stroke="#ffd166" stroke-width="2" />
                <rect x="42" y="10" width="16" height="28" rx="2" fill="#ffd166" />
                <!-- Talisman Paper / Glasses based on Phase -->
                <rect
                  v-if="activePhase.mascotAccessory === 'sunglasses'"
                  x="28" y="52" width="44" height="12" rx="3" fill="#020617" stroke="#00d2ff" stroke-width="1.5"
                />
                <rect
                  v-else
                  x="44" y="32" width="12" height="26" rx="2" fill="#ffd166" stroke="#ff0054" stroke-width="1"
                />

                <!-- Head -->
                <circle cx="50" cy="58" r="28" fill="#1e293b" stroke="#00f5a0" stroke-width="2" />
                
                <!-- Eyes (Reacts to sleep/mood) -->
                <template v-if="isIdleSleeping || currentReaction?.mood === 'sleepy'">
                  <path d="M36 58 Q40 54 44 58" stroke="#94a3b8" stroke-width="2.5" fill="none" stroke-linecap="round" />
                  <path d="M56 58 Q60 54 64 58" stroke="#94a3b8" stroke-width="2.5" fill="none" stroke-linecap="round" />
                </template>
                <template v-else-if="currentReaction?.type === 'pet_loved'">
                  <text x="34" y="62" font-size="12" fill="#ff0054">💖</text>
                  <text x="54" y="62" font-size="12" fill="#ff0054">💖</text>
                </template>
                <template v-else-if="currentReaction?.type === 'fast_scroll'">
                  <circle cx="40" cy="58" r="5" fill="none" stroke="#00d2ff" stroke-width="1.5" stroke-dasharray="3 2" class="animate-spin" />
                  <circle cx="60" cy="58" r="5" fill="none" stroke="#00d2ff" stroke-width="1.5" stroke-dasharray="3 2" class="animate-spin" />
                </template>
                <template v-else>
                  <circle cx="40" cy="58" r="4.5" :fill="activePhase.accentHex" />
                  <circle cx="60" cy="58" r="4.5" :fill="activePhase.accentHex" />
                  <circle cx="41" cy="57" r="1.5" fill="#ffffff" />
                  <circle cx="61" cy="57" r="1.5" fill="#ffffff" />
                </template>

                <!-- Cute Blush Cheeks -->
                <ellipse cx="32" cy="67" rx="3.5" ry="2" fill="#ff0054" opacity="0.6" />
                <ellipse cx="68" cy="67" rx="3.5" ry="2" fill="#ff0054" opacity="0.6" />

                <!-- Robe Body -->
                <path d="M30 84 L70 84 L78 116 L22 116 Z" fill="#0f172a" stroke="#334155" stroke-width="2" />
                <!-- Talisman Runes on Robe -->
                <line x1="50" y1="88" x2="50" y2="110" stroke="#ffd166" stroke-width="2" stroke-dasharray="4 3" />

                <!-- Jiangshi Extended Arms -->
                <rect x="14" y="86" width="16" height="8" rx="4" fill="#1e293b" stroke="#00f5a0" stroke-width="1" />
                <rect x="70" y="86" width="16" height="8" rx="4" fill="#1e293b" stroke="#00f5a0" stroke-width="1" />
              </svg>
            </div>

            <!-- Hop Count Pill Badge -->
            <span class="absolute -bottom-1 px-1.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono text-[9px] font-bold text-phantom-mint shadow">
              {{ totalHops }} hops
            </span>
          </div>

          <!-- Quick Pet Action Tools -->
          <div class="flex flex-col gap-1.5 border-l border-slate-800/80 pl-3">
            <div class="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
              <span class="font-bold text-slate-300">Ma Cà Tưng Pet</span>
              <button
                @click="toggleMinimize"
                class="text-slate-500 hover:text-slate-200 px-1 hover:bg-slate-800 rounded transition-colors"
                title="Thu nhỏ thành icon"
              >
                ▼
              </button>
            </div>

            <!-- Quick Action Buttons -->
            <div class="grid grid-cols-2 gap-1.5">
              <!-- 1. Feed Robusta Coffee -->
              <button
                @click="feedCoffee"
                class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 text-[11px] font-medium text-slate-300 hover:text-amber-300 transition-all duration-150 active:scale-95 cursor-pointer"
                title="Cho uống cà phê Robusta"
              >
                <span>☕</span>
                <span>Cà phê</span>
              </button>

              <!-- 2. Apply Talisman Seal -->
              <button
                @click="applyTalisman"
                class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-[11px] font-medium text-slate-300 hover:text-phantom-mint transition-all duration-150 active:scale-95 cursor-pointer"
                title="Yểm bùa 0-Bug"
              >
                <span>📜</span>
                <span>Dán bùa</span>
              </button>

              <!-- 3. Pet / Headpat -->
              <button
                @click="petMascot"
                class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/50 text-[11px] font-medium text-slate-300 hover:text-pink-300 transition-all duration-150 active:scale-95 cursor-pointer"
                title="Xoa đầu Ma Cà Tưng"
              >
                <span>💖</span>
                <span>Xoa đầu</span>
              </button>

              <!-- 4. Toggle Time-Traveler Slider -->
              <button
                @click="showTimeTraveler = !showTimeTraveler"
                :class="[
                  'flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-150 active:scale-95 cursor-pointer',
                  showTimeTraveler
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-cyan-950/40 border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300'
                ]"
                title="Bật/Tắt Cỗ Máy Thời Gian 24H"
              >
                <span>⏳</span>
                <span>Tua giờ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
