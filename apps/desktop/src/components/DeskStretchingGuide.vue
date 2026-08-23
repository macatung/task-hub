<script setup lang="ts">
import { ref } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentStep = ref(0);

const exercises = [
  {
    title: '1. 20-20-20 Rule for Eyes 👀',
    desc: 'Look at an object 20 feet (6m) away for at least 20 seconds. Blink gently 5 times to lubricate the corneas.',
    icon: '🌿',
  },
  {
    title: '2. Neck Rolls & Shoulder Relaxation 🧘‍♂️',
    desc: 'Tilt head right for 5s, left for 5s. Roll shoulders backwards 5 times to release accumulated tension.',
    icon: '⚡',
  },
  {
    title: '3. Spine Extension & Chest Opener 🌸',
    desc: 'Interlace fingers and stretch arms upward. Inhale deeply extending the spine, then gently exhale.',
    icon: '✨',
  },
];

const nextStep = () => {
  if (currentStep.value < exercises.length - 1) {
    currentStep.value++;
    mindfulBell.ringBell(528, 1.5);
  } else {
    mindfulBell.ringBell(432, 4.0);
    emit('close');
  }
};
</script>

<template>
  <div class="w-80 sm:w-96 rounded-3xl p-5 bg-stone-950/98 text-stone-100 border-2 border-cyan-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans ring-1 ring-cyan-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-cyan-500/30">
      <div class="flex items-center gap-2 text-xs font-bold text-cyan-300">
        <span>🧘‍♂️</span>
        <span>DESK STRETCH & EYE RELIEF (30s)</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-stone-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <!-- Step Content -->
    <div class="my-3 space-y-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
          {{ exercises[currentStep].icon }}
        </div>
        <div>
          <h4 class="text-xs font-bold text-white">{{ exercises[currentStep].title }}</h4>
          <span class="text-[10px] text-cyan-300 font-mono">Exercise {{ currentStep + 1 }}/3</span>
        </div>
      </div>

      <p class="text-xs text-stone-200 leading-relaxed bg-stone-900/80 p-3 rounded-2xl border border-stone-800">
        {{ exercises[currentStep].desc }}
      </p>
    </div>

    <!-- Progress Dots & Next Button -->
    <div class="flex items-center justify-between pt-2 border-t border-stone-800">
      <div class="flex gap-1.5">
        <span
          v-for="(_, i) in exercises"
          :key="i"
          class="w-2.5 h-2.5 rounded-full transition-all"
          :class="i === currentStep ? 'bg-cyan-400 scale-110 shadow-sm' : 'bg-stone-800'"
        />
      </div>

      <button
        @click="nextStep"
        class="py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold text-xs shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        {{ currentStep === exercises.length - 1 ? 'Done ✓' : 'Next →' }}
      </button>
    </div>
  </div>
</template>