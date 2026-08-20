<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';

const emit = defineEmits<{
  (e: 'finish'): void;
}>();

const breathCount = ref(1);
const maxBreaths = 3;
const phase = ref<'inhale' | 'hold' | 'exhale'>('inhale');
const instruction = ref('Hít vào thật sâu... Thân an tịnh');

let timer: ReturnType<typeof setTimeout> | null = null;

const runCycle = () => {
  if (breathCount.value > maxBreaths) {
    mindfulBell.ringBell(432, 6.0);
    emit('finish');
    return;
  }

  // 1. Inhale (4 seconds)
  phase.value = 'inhale';
  instruction.value = `Nhịp ${breathCount.value}/${maxBreaths}: Hít vào... Tâm tĩnh lặng 🌸`;
  mindfulBell.ringBell(528, 2.0);

  timer = setTimeout(() => {
    // 2. Hold (2 seconds)
    phase.value = 'hold';
    instruction.value = `Giữ hơi thở... Cảm nhận sự an yên 🧘`;

    timer = setTimeout(() => {
      // 3. Exhale (6 seconds)
      phase.value = 'exhale';
      instruction.value = `Thở ra nhẹ nhàng... Miệng mỉm cười 🍃`;

      timer = setTimeout(() => {
        breathCount.value++;
        runCycle();
      }, 6000);
    }, 2000);
  }, 4000);
};

onMounted(() => {
  runCycle();
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="w-80 rounded-3xl p-5 bg-stone-950/95 border-2 border-amber-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-center text-stone-100 backdrop-blur-2xl no-drag select-none ring-1 ring-amber-400/30">
    <div class="flex items-center justify-between pb-2 mb-3 border-b border-amber-500/30">
      <span class="text-xs font-serif font-bold text-amber-300 flex items-center gap-1.5">
        <span>🧘</span>
        <span>ĐIỀU TỨC 3 NHỊP THỞ CHÁNH NIỆM</span>
      </span>
      <button
        @click="$emit('finish')"
        class="text-xs text-stone-400 hover:text-white p-1 rounded-lg bg-stone-900 cursor-pointer"
      >
        ✕
      </button>
    </div>

    <!-- Pacing Circle Stage -->
    <div class="my-4 flex flex-col items-center justify-center relative">
      <div
        class="w-32 h-32 rounded-full border-4 border-amber-400 flex items-center justify-center transition-all duration-[4000ms] ease-in-out shadow-2xl"
        :class="[
          phase === 'inhale' ? 'scale-125 bg-amber-500/25 border-amber-300' : phase === 'hold' ? 'scale-125 bg-amber-500/35 border-yellow-300 animate-pulse' : 'scale-90 bg-stone-900 border-amber-600'
        ]"
      >
        <span class="text-3xl select-none">
          {{ phase === 'inhale' ? '🌸' : phase === 'hold' ? '✨' : '🍃' }}
        </span>
      </div>

      <p class="mt-4 text-xs font-serif font-bold text-amber-200 min-h-[32px] flex items-center justify-center">
        {{ instruction }}
      </p>
    </div>

    <div class="flex justify-center gap-1.5 mt-2">
      <span
        v-for="b in maxBreaths"
        :key="b"
        class="w-2.5 h-2.5 rounded-full transition-all"
        :class="b <= breathCount ? 'bg-amber-400 scale-110 shadow-sm' : 'bg-stone-800'"
      />
    </div>
  </div>
</template>
