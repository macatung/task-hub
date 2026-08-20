<script setup lang="ts">
import { computed } from 'vue';
import { useTimeCycle, TimePhaseId } from '@/composables/useTimeCycle';
import { sound } from '@/audio/soundEffects';

const {
  currentDisplayHour,
  currentRealHour,
  formattedTime,
  activePhase,
  activePhaseId,
  isTimeTravelActive,
  setSimulatedHour,
  setPhaseOverride,
  resetToRealTime
} = useTimeCycle();

const sliderHour = computed({
  get: () => currentDisplayHour.value,
  set: (val: number) => {
    setSimulatedHour(val);
  }
});

const phasePresets: { id: TimePhaseId; hour: number; label: string; icon: string; color: string }[] = [
  { id: 'midnight', hour: 0, label: '00:00 Nửa Đêm', icon: '🌙', color: '#00f5a0' },
  { id: 'dawn', hour: 6, label: '06:00 Rạng Đông', icon: '🌅', color: '#ffd166' },
  { id: 'afternoon', hour: 12, label: '12:00 Chính Ngọ', icon: '☀️', color: '#00d2ff' },
  { id: 'twilight', hour: 18, label: '18:00 Hoàng Hôn', icon: '🔮', color: '#c084fc' },
];

const handleSliderChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const h = parseInt(target.value, 10);
  setSimulatedHour(h);
  try {
    sound.playClick?.();
  } catch {}
};

const handlePresetClick = (preset: typeof phasePresets[0]) => {
  setPhaseOverride(preset.id);
  try {
    sound.playTalisman?.();
  } catch {}
};

const handleReset = () => {
  resetToRealTime();
  try {
    sound.playSuccess?.();
  } catch {}
};
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-midnight-900/90 p-4 sm:p-5 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-slate-700/80">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2.5">
        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-lg shadow-inner">
          {{ activePhase.icon === 'Moon' ? '🌙' : activePhase.icon === 'Sunrise' ? '🌅' : activePhase.icon === 'Sun' ? '☀️' : '🔮' }}
        </span>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-mono tracking-wider text-slate-400 uppercase">Cỗ Máy Thời Gian 24H</h4>
            <span
              v-if="isTimeTravelActive"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
            >
              ⚡ Du Hành Thời Gian
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            >
              ● Giờ Thực Tế
            </span>
          </div>
          <p class="text-sm font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
            <span>{{ activePhase.vietnameseName }}</span>
            <span class="text-slate-500 text-xs font-mono">({{ activePhase.timeRange }})</span>
          </p>
        </div>
      </div>

      <!-- Time Display & Reset -->
      <div class="flex items-center gap-2">
        <div class="px-3 py-1.5 rounded-lg bg-midnight-950/80 border border-slate-800 font-mono text-sm font-bold text-phantom-mint shadow-inner">
          {{ formattedTime }}
        </div>
        <button
          v-if="isTimeTravelActive"
          @click="handleReset"
          class="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
          title="Quay về giờ thực"
        >
          <span>↺ Giờ Thực</span>
        </button>
      </div>
    </div>

    <!-- 24H Range Slider -->
    <div class="relative py-2 px-1">
      <div class="flex justify-between items-center text-[11px] font-mono font-semibold text-slate-500 mb-1.5">
        <span :class="{ 'text-emerald-400 font-bold': activePhaseId === 'midnight' }">00:00 Đêm</span>
        <span :class="{ 'text-amber-400 font-bold': activePhaseId === 'dawn' }">06:00 Sáng</span>
        <span :class="{ 'text-cyan-400 font-bold': activePhaseId === 'afternoon' }">12:00 Trưa</span>
        <span :class="{ 'text-purple-400 font-bold': activePhaseId === 'twilight' }">18:00 Tối</span>
        <span class="text-slate-600">23:59</span>
      </div>

      <!-- Custom Stylized Range Slider -->
      <div class="relative flex items-center">
        <input
          type="range"
          min="0"
          max="23"
          step="1"
          v-model.number="sliderHour"
          @input="handleSliderChange"
          class="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-phantom-mint border border-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-phantom-mint/50"
          :style="{
            background: `linear-gradient(to right, #00f5a0 0%, #ffd166 25%, #00d2ff 50%, #c084fc 75%, #00f5a0 100%)`
          }"
        />
      </div>
    </div>

    <!-- Preset Quick Jumps -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/60">
      <button
        v-for="preset in phasePresets"
        :key="preset.id"
        @click="handlePresetClick(preset)"
        :class="[
          'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 border',
          activePhaseId === preset.id
            ? 'bg-slate-800/90 text-white shadow-md'
            : 'bg-midnight-950/50 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-slate-800/80'
        ]"
        :style="{
          borderColor: activePhaseId === preset.id ? preset.color : undefined,
          boxShadow: activePhaseId === preset.id ? `0 0 12px ${preset.color}33` : undefined
        }"
      >
        <span>{{ preset.icon }}</span>
        <span>{{ preset.label.split(' ')[0] }}</span>
      </button>
    </div>

    <!-- Dynamic Tagline -->
    <div class="mt-3 flex items-center gap-2 text-xs text-slate-400 font-sans italic bg-midnight-950/60 px-3 py-2 rounded-xl border border-slate-800/40">
      <span class="text-phantom-mint font-bold not-italic">💬 Ma Cà Tưng:</span>
      <span class="truncate">"{{ activePhase.tagline }}"</span>
    </div>
  </div>
</template>
