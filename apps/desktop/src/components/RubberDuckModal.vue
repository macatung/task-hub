<script setup lang="ts">
import { ref } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const problemInput = ref('');
const isBlessed = ref(false);
const advice = ref('');

const tips = [
  'Have you inspected the request payload and headers at the middleware layer?',
  'Check for undefined/null values or race conditions in async/await workflows!',
  'Log or inspect the actual runtime data types before parsing.',
  'Invalidate caches: clear Redis, browser state, config cache, and rebuild.',
  'Trace the data flow step-by-step: Input ➔ Transformation ➔ Output.',
  'Stuck for more than 30 minutes? Step back, take a breath, and look with fresh eyes!',
];

const handleBlessBug = () => {
  if (!problemInput.value.trim()) return;
  isBlessed.value = true;
  advice.value = tips[Math.floor(Math.random() * tips.length)];
  mindfulBell.ringBell(528, 4.0);
};
</script>

<template>
  <div class="w-80 sm:w-96 rounded-3xl p-5 bg-slate-950/98 text-stone-100 border-2 border-amber-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans ring-1 ring-amber-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-amber-500/30">
      <div class="flex items-center gap-2 text-xs font-bold text-amber-300">
        <span>🦆</span>
        <span>RUBBER DUCK DEBUGGING & INSIGHTS</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <!-- Description -->
    <p class="text-xs text-slate-300 mb-3 leading-relaxed">
      Facing a stubborn bug? Explain it clearly to the Rubber Duck. Articulating the problem solves 70% of it!
    </p>

    <!-- Textarea input -->
    <div class="mb-3">
      <textarea
        v-model="problemInput"
        rows="3"
        placeholder="Describe the issue (e.g., API 500 on upload, continuous UI re-renders...)"
        class="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-400 text-xs text-white placeholder-slate-500 outline-none resize-none font-mono"
      ></textarea>
    </div>

    <!-- Blessed Advice Output Box -->
    <div v-if="isBlessed" class="mb-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
      <div class="font-bold flex items-center gap-1.5 text-amber-300">
        <span>📜</span>
        <span>Insight from the Midnight Architect:</span>
      </div>
      <p class="italic leading-relaxed">"{{ advice }}"</p>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
      <span class="text-[10px] text-slate-400 font-mono">0-Bug Charm ⚡</span>

      <button
        @click="handleBlessBug"
        :disabled="!problemInput.trim()"
        :class="[
          'py-2 px-4 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer',
          problemInput.trim()
            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 hover:scale-105 active:scale-95'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
        ]"
      >
        <span>📜</span>
        <span>Duck Debug & Insights</span>
      </button>
    </div>
  </div>
</template>