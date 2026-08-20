<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';
import { TaskItem } from '../composables/useTaskSync';

const props = defineProps<{
  activeTask?: TaskItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pomodoro-completed', task: TaskItem): void;
}>();

type PomodoroMode = 'focus25' | 'deep50' | 'shortBreak' | 'longBreak';

const isCompact = ref(false);
const currentMode = ref<PomodoroMode>('focus25');
const totalSeconds = ref(25 * 60);
const remainingSeconds = ref(25 * 60);
const isRunning = ref(false);
const completedSessions = ref(0);

let timerInterval: ReturnType<typeof setInterval> | null = null;

const modes: Record<PomodoroMode, { label: string; duration: number; icon: string }> = {
  focus25: { label: 'Tập Trung 25p', duration: 25 * 60, icon: '🍅' },
  deep50: { label: 'Deep Work 50p', duration: 50 * 60, icon: '⚡' },
  shortBreak: { label: 'Nghỉ Ngắn 5p', duration: 5 * 60, icon: '☕' },
  longBreak: { label: 'Nghỉ Dài 15p', duration: 15 * 60, icon: '🍃' },
};

const formattedTime = computed(() => {
  const mins = Math.floor(remainingSeconds.value / 60);
  const secs = remainingSeconds.value % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

const progressPercent = computed(() => {
  return ((totalSeconds.value - remainingSeconds.value) / totalSeconds.value) * 100;
});

const setMode = (mode: PomodoroMode) => {
  currentMode.value = mode;
  totalSeconds.value = modes[mode].duration;
  remainingSeconds.value = modes[mode].duration;
  isRunning.value = false;
  if (timerInterval) clearInterval(timerInterval);
};

const toggleTimer = () => {
  if (isRunning.value) {
    pauseTimer();
  } else {
    startTimer();
    // Auto-compact on start to save screen space
    isCompact.value = true;
  }
};

const startTimer = () => {
  isRunning.value = true;
  mindfulBell.ringBell(528, 2.0);
  timerInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--;
    } else {
      finishTimer();
    }
  }, 1000);
};

const pauseTimer = () => {
  isRunning.value = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

const resetTimer = () => {
  pauseTimer();
  remainingSeconds.value = totalSeconds.value;
};

const finishTimer = () => {
  pauseTimer();
  mindfulBell.ringBell(432, 6.0);
  if (currentMode.value.startsWith('focus') || currentMode.value === 'deep50') {
    completedSessions.value++;
    if (props.activeTask) {
      emit('pomodoro-completed', props.activeTask);
    }
    setMode('shortBreak');
  } else {
    setMode('focus25');
  }
  isCompact.value = false; // Expand back on finish
};

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});
</script>

<template>
  <!-- ========================================================================= -->
  <!-- 1. COMPACT MINI PILL MODE (TIẾT KIỆM KHÔNG GIAN TỐI ĐA TRÊN MÀN HÌNH)     -->
  <!-- ========================================================================= -->
  <div
    v-if="isCompact"
    class="no-drag flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-950/98 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-xl select-none font-sans transition-all animate-fadeIn text-xs max-w-sm"
  >
    <!-- Status Icon & Time -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="text-sm" :class="{ 'animate-pulse': isRunning }">🍅</span>
      <span class="font-mono font-extrabold text-sm text-emerald-400">
        {{ formattedTime }}
      </span>
    </div>

    <!-- Active Task Summary -->
    <div class="min-w-0 flex-1 px-1 border-l border-slate-800">
      <div v-if="activeTask" class="truncate">
        <span class="text-[11px] font-semibold text-slate-200 truncate block">
          {{ activeTask.title }}
        </span>
        <span class="text-[9px] font-mono text-slate-400 block truncate">
          {{ activeTask.project ? activeTask.project.title : 'Chung' }}
        </span>
      </div>
      <div v-else class="text-[11px] text-slate-400 font-mono truncate">
        {{ modes[currentMode].label }}
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-1 shrink-0">
      <!-- Toggle Pause / Play -->
      <button
        @click="toggleTimer"
        :class="[
          'p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
          isRunning ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
        ]"
        :title="isRunning ? 'Tạm dừng' : 'Tiếp tục'"
      >
        <span>{{ isRunning ? '⏸' : '▶' }}</span>
      </button>

      <!-- Expand Button -->
      <button
        @click="isCompact = false"
        class="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
        title="Mở rộng chi tiết"
      >
        ⤢
      </button>

      <!-- Close Button -->
      <button
        @click="$emit('close')"
        class="p-1.5 rounded-lg bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors cursor-pointer text-xs"
        title="Đóng đồng hồ"
      >
        ✕
      </button>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- 2. FULL DIAL MODE (GIAO DIỆN CHI TIẾT TỐI GIẢN DARK SLATE)                -->
  <!-- ========================================================================= -->
  <div
    v-else
    class="w-72 rounded-2xl p-4 bg-slate-950/98 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-2xl no-drag select-none text-left font-sans animate-fadeIn"
  >
    <!-- Header with Minimize & Close -->
    <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
      <div class="flex items-center gap-1.5 text-xs font-bold text-slate-200">
        <span>🍅</span>
        <span class="font-mono text-[11px] text-emerald-400 uppercase tracking-wider">POMODORO FOCUS</span>
      </div>

      <div class="flex items-center gap-1">
        <button
          @click="isCompact = true"
          class="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
          title="Thu nhỏ thành thanh mini"
        >
          —
        </button>
        <button
          @click="$emit('close')"
          class="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer text-xs"
          title="Đóng"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Active Task Badge -->
    <div v-if="activeTask" class="p-2 mb-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
      <div class="truncate flex-1 pr-2">
        <span class="text-[9px] text-slate-400 font-mono block">🎯 Nhiệm vụ:</span>
        <span class="font-semibold text-slate-100 text-xs truncate block">{{ activeTask.title }}</span>
      </div>
      <span class="text-[10px] font-mono text-emerald-400 shrink-0 font-bold">
        🍅 {{ activeTask.completed_pomodoros }}/{{ activeTask.estimated_pomodoros }}
      </span>
    </div>

    <!-- Mode Selector Tabs -->
    <div class="grid grid-cols-2 gap-1 mb-3">
      <button
        v-for="(cfg, key) in modes"
        :key="key"
        @click="setMode(key as PomodoroMode)"
        :class="[
          'py-1 px-1.5 rounded-lg text-[10px] font-medium border transition-all cursor-pointer flex items-center justify-center gap-1',
          currentMode === key
            ? 'bg-slate-800 text-emerald-300 border-slate-700 font-bold'
            : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-white'
        ]"
      >
        <span>{{ cfg.icon }}</span>
        <span>{{ cfg.label }}</span>
      </button>
    </div>

    <!-- Main Circular Timer Dial -->
    <div class="flex flex-col items-center justify-center my-2 relative">
      <div class="relative w-28 h-28 flex items-center justify-center">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="#1e293b" stroke-width="5" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="#10b981"
            stroke-width="5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="264"
            :stroke-dashoffset="264 - (264 * progressPercent) / 100"
            class="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div class="absolute flex flex-col items-center">
          <span class="text-2xl font-mono font-extrabold text-white tracking-wider">
            {{ formattedTime }}
          </span>
          <span class="text-[9px] font-mono text-emerald-400 mt-0.5">
            {{ isRunning ? '⚡ Đang chạy' : 'Tạm dừng' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Completed Sessions Counter -->
    <div class="text-center text-[10px] text-slate-500 mb-2.5 flex items-center justify-center gap-1 font-mono">
      <span>Hoàn thành:</span>
      <span class="font-bold text-emerald-400">{{ completedSessions }} phiên</span>
    </div>

    <!-- Action Controls -->
    <div class="flex items-center gap-2 pt-2 border-t border-slate-800">
      <button
        @click="resetTimer"
        class="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all cursor-pointer flex-1 text-center"
      >
        ↺ Đặt lại
      </button>

      <button
        @click="toggleTimer"
        :class="[
          'py-2 px-4 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex-[2] flex items-center justify-center gap-1',
          isRunning
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
        ]"
      >
        <span>{{ isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s ease-out forwards;
}
</style>