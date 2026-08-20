<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const glasses = ref(0);
const target = 8;

const loadWater = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = localStorage.getItem('macatung_water_date');
    if (savedDate === today) {
      glasses.value = parseInt(localStorage.getItem('macatung_water_count') || '0', 10);
    } else {
      glasses.value = 0;
      localStorage.setItem('macatung_water_date', today);
      localStorage.setItem('macatung_water_count', '0');
    }
  } catch (e) {
    console.warn(e);
  }
};

const addGlass = () => {
  if (glasses.value < target) {
    glasses.value++;
    mindfulBell.ringBell(528, 1.2);
    saveWater();
  }
};

const removeGlass = () => {
  if (glasses.value > 0) {
    glasses.value--;
    saveWater();
  }
};

const saveWater = () => {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('macatung_water_date', today);
  localStorage.setItem('macatung_water_count', glasses.value.toString());
};

onMounted(() => {
  loadWater();
});
</script>

<template>
  <div class="w-80 rounded-3xl p-5 bg-slate-950/98 text-stone-100 border-2 border-blue-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans ring-1 ring-blue-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-blue-500/30">
      <div class="flex items-center gap-2 text-xs font-bold text-blue-300">
        <span>💧</span>
        <span>NHẬT KÝ UỐNG NƯỚC HÔM NAY</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <!-- Count & Progress -->
    <div class="text-center my-3">
      <div class="text-3xl font-extrabold text-blue-400 font-mono">
        {{ glasses }} / {{ target }} <span class="text-lg">ly</span>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">
        {{ glasses >= target ? '🎉 Tuyệt vời! Bạn đã nạp đủ 2 lít nước hôm nay!' : 'Mỗi ngụm nước nuôi dưỡng sự minh mẫn và tỉnh táo!' }}
      </p>
    </div>

    <!-- Glasses Icons Grid -->
    <div class="grid grid-cols-4 gap-2 my-4">
      <button
        v-for="i in target"
        :key="i"
        @click="i <= glasses ? removeGlass() : addGlass()"
        class="p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center hover:scale-105 active:scale-95"
        :class="[
          i <= glasses
            ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-sm shadow-blue-500/20'
            : 'bg-slate-900/60 border-slate-800 text-slate-600 hover:border-slate-700'
        ]"
        :title="i <= glasses ? 'Bấm để hoàn tác' : 'Bấm để uống 1 ly'"
      >
        <span class="text-lg">{{ i <= glasses ? '🥤' : '🥛' }}</span>
        <span class="text-[9px] font-mono mt-1">Ly {{ i }}</span>
      </button>
    </div>

    <!-- Quick Add Button -->
    <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
      <button
        @click="removeGlass"
        :disabled="glasses === 0"
        class="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
      >
        - Bớt 1 ly
      </button>

      <button
        @click="addGlass"
        :disabled="glasses >= target"
        class="flex-1 py-2 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        <span>💧</span>
        <span>+ Đã Uống 1 Ly Nước</span>
      </button>
    </div>
  </div>
</template>