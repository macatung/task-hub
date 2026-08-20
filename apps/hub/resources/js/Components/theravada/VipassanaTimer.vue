<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';

const durationMinutes = ref<number>(15);
const isRunning = ref(false);
const isPaused = ref(false);
const totalSeconds = computed(() => durationMinutes.value * 60);
const remainingSeconds = ref(totalSeconds.value);
const accumulatedMinutes = ref(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

// Breathing animation state: 'inhale' (4s), 'hold' (2s), 'exhale' (6s)
const breathingPhase = ref<'inhale' | 'exhale'>('inhale');
let breathingInterval: ReturnType<typeof setInterval> | null = null;

const selectDuration = (mins: number) => {
  if (isRunning.value) return;
  durationMinutes.value = mins;
  remainingSeconds.value = mins * 60;
};

const formattedTime = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60);
  const s = remainingSeconds.value % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
});

const progressPercent = computed(() => {
  if (totalSeconds.value <= 0) return 0;
  return Math.round(((totalSeconds.value - remainingSeconds.value) / totalSeconds.value) * 100);
});

const startTimer = () => {
  isRunning.value = true;
  isPaused.value = false;
  
  // Ring opening Bell
  mindfulBell.ringBell(432, 6.0);

  // Start countdown
  timerInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--;
    } else {
      endTimer();
    }
  }, 1000);

  // Start breathing cycle (4s inhale, 6s exhale)
  breathingPhase.value = 'inhale';
  breathingInterval = setInterval(() => {
    breathingPhase.value = breathingPhase.value === 'inhale' ? 'exhale' : 'inhale';
  }, 5000);
};

const pauseTimer = () => {
  isPaused.value = true;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
  }
};

const resumeTimer = () => {
  isPaused.value = false;
  timerInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--;
    } else {
      endTimer();
    }
  }, 1000);

  breathingInterval = setInterval(() => {
    breathingPhase.value = breathingPhase.value === 'inhale' ? 'exhale' : 'inhale';
  }, 5000);
};

const resetTimer = () => {
  isRunning.value = false;
  isPaused.value = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
  }
  remainingSeconds.value = totalSeconds.value;
};

const endTimer = () => {
  // Ring ending 3 bells
  mindfulBell.ringBell(432, 8.0);
  setTimeout(() => mindfulBell.ringBell(432, 8.0), 3000);
  setTimeout(() => mindfulBell.ringBell(432, 8.0), 6000);

  accumulatedMinutes.value += durationMinutes.value;
  resetTimer();
};

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (breathingInterval) clearInterval(breathingInterval);
});
</script>

<template>
  <div class="w-full max-w-4xl mx-auto p-4 sm:p-8 rounded-3xl bg-gradient-to-br from-stone-900/95 via-stone-950/90 to-stone-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl font-serif text-stone-100 relative overflow-hidden">
    <!-- Center Radiant Amber Aura -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-amber-500/10 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" />

    <div class="relative z-10 space-y-5 sm:space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-amber-500/20 pb-4 sm:pb-5 text-left">
        <div>
          <div class="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold mb-2">
            <span>🧘</span>
            <span>ỨNG DỤNG PHÁP HÀNH • THIỀN MINH SÁT VIPASSANĀ</span>
          </div>
          <h3 class="text-lg sm:text-2xl font-bold text-amber-100 tracking-tight">
            Đồng Hồ Tọa Thiền & Điều Tức Chánh Niệm
          </h3>
          <p class="text-xs sm:text-sm text-stone-400 mt-1">
            Thiết lập thời gian tĩnh tâm, quán niệm hơi thở vô - ra theo tiếng chuông đồng thiêng liêng 432Hz.
          </p>
        </div>

        <!-- Today Mindfulness Counter -->
        <div class="shrink-0 px-3.5 py-2 rounded-2xl bg-stone-950/80 border border-stone-800 flex items-center gap-2 text-xs text-stone-300 self-start sm:self-auto">
          <span>⏱️ Tích lũy hôm nay:</span>
          <span class="font-mono text-amber-300 font-bold text-sm">{{ accumulatedMinutes }} phút</span>
        </div>
      </div>

      <!-- Main Meditation & Breathing Circle Stage -->
      <div class="flex flex-col items-center justify-center py-4 sm:py-10">
        <!-- Breathing Pacer & Progress Circle -->
        <div class="relative flex items-center justify-center">
          <!-- Outer Breathing Aura Pulse -->
          <div
            class="absolute rounded-full bg-amber-500/20 blur-2xl transition-all duration-[5000ms] ease-in-out pointer-events-none"
            :class="[
              isRunning && !isPaused
                ? breathingPhase === 'inhale' ? 'w-64 sm:w-80 h-64 sm:h-80 opacity-90' : 'w-48 sm:w-56 h-48 sm:h-56 opacity-30'
                : 'w-52 sm:w-64 h-52 sm:h-64 opacity-20'
            ]"
          />

          <!-- SVG Progress Circle -->
          <svg class="w-56 h-56 sm:w-72 sm:h-72 -rotate-90" viewBox="0 0 240 240">
            <!-- Background track -->
            <circle cx="120" cy="120" r="100" stroke="#292524" stroke-width="8" fill="none" />
            <!-- Progress bar -->
            <circle
              cx="120"
              cy="120"
              r="100"
              stroke="#f59e0b"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              stroke-dasharray="628.3"
              :stroke-dashoffset="628.3 - (628.3 * progressPercent) / 100"
              class="transition-all duration-1000 ease-linear"
            />
          </svg>

          <!-- Center Content: Countdown Time & Breathing Advice -->
          <div class="absolute flex flex-col items-center justify-center text-center space-y-1 px-4">
            <span class="text-3xl sm:text-5xl font-mono font-bold text-amber-100 tracking-wider">
              {{ formattedTime }}
            </span>

            <!-- Breathing Status -->
            <div v-if="isRunning && !isPaused" class="transition-all duration-700 max-w-[180px] sm:max-w-none">
              <span
                class="inline-block px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-serif font-bold transition-all duration-1000 leading-tight"
                :class="breathingPhase === 'inhale' ? 'bg-amber-500/25 text-amber-200 border border-amber-400' : 'bg-stone-800 text-stone-300'"
              >
                {{ breathingPhase === 'inhale' ? '🌸 Hít Vào — Tâm Tĩnh' : '🍃 Thở Ra — Miệng Cười' }}
              </span>
            </div>
            <div v-else class="text-[11px] sm:text-xs font-serif text-stone-400">
              {{ isPaused ? '⏸️ Tạm dừng' : '☸️ Sẵn sàng tọa thiền' }}
            </div>
          </div>
        </div>

        <!-- Duration Selection Presets (Disabled while running) -->
        <div class="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
          <span class="text-xs text-stone-400 w-full sm:w-auto text-center sm:text-left mb-1 sm:mb-0">
            Thời lượng:
          </span>
          <div class="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button
              v-for="mins in [5, 15, 30, 45, 60]"
              :key="mins"
              @click="selectDuration(mins)"
              :disabled="isRunning"
              :class="[
                'px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-serif transition-all cursor-pointer border min-h-[38px]',
                durationMinutes === mins
                  ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-md'
                  : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:border-amber-500/40 hover:text-white',
                isRunning ? 'opacity-40 cursor-not-allowed' : ''
              ]"
            >
              {{ mins }} Phút
            </button>
          </div>
        </div>
      </div>

      <!-- Action Controls Bar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4 sm:pt-5 border-t border-stone-800">
        <!-- Start Button -->
        <button
          v-if="!isRunning"
          @click="startTimer"
          class="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-serif font-bold text-sm sm:text-base shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer min-h-[46px]"
        >
          <span>🔔</span>
          <span>Bắt Đầu Tọa Thiền</span>
        </button>

        <!-- Pause / Resume Button -->
        <button
          v-if="isRunning && !isPaused"
          @click="pauseTimer"
          class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 border border-stone-700 text-stone-200 hover:text-amber-300 font-serif text-sm font-bold transition-all cursor-pointer min-h-[44px]"
        >
          <span>⏸️</span>
          <span>Tạm Dừng</span>
        </button>

        <button
          v-if="isRunning && isPaused"
          @click="resumeTimer"
          class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-stone-950 font-serif text-sm font-bold shadow-lg hover:bg-amber-400 transition-all cursor-pointer min-h-[44px]"
        >
          <span>▶️</span>
          <span>Tiếp Tục</span>
        </button>

        <!-- Stop / Reset Button -->
        <button
          v-if="isRunning"
          @click="resetTimer"
          class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl bg-stone-900 border border-rose-500/30 text-rose-300 hover:bg-rose-950/40 text-xs sm:text-sm font-serif font-bold transition-all cursor-pointer min-h-[44px]"
        >
          <span>⏹️</span>
          <span>Xả Thiền / Kết Thúc</span>
        </button>
      </div>
    </div>
  </div>
</template>
