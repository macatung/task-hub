<script setup lang="ts">
import { ref } from 'vue';
import { DhammapadaVerse, HealthReminder } from '../data/dhammapadaVerses';
import { mindfulBell } from '../audio/mindfulBellAudio';

const props = defineProps<{
  type: 'verse' | 'health';
  verse?: DhammapadaVerse;
  healthReminder?: HealthReminder;
  persona: 'zen' | 'coder';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'draw-next'): void;
  (e: 'start-breathing'): void;
}>();

const copied = ref(false);

const copyText = async () => {
  if (props.type === 'verse' && props.verse) {
    const text = `☸️ KINH PHÁP CÚ — KỆ SỐ ${props.verse.verse_number}\n${props.verse.chapter_vi}\n\n"${props.verse.pali}"\n\n"${props.verse.vietnamese}"\n\n💡 ${props.verse.insight}\n— Ma Tọa Thiền (Desktop Companion)`;
    try {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      mindfulBell.ringBell(528, 1.5);
      setTimeout(() => (copied.value = false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  } else if (props.healthReminder) {
    try {
      await navigator.clipboard.writeText(`${props.healthReminder.title}\n${props.healthReminder.message}`);
      copied.value = true;
      setTimeout(() => (copied.value = false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  }
};

const ringSound = () => {
  mindfulBell.ringBell(props.persona === 'zen' ? 432 : 528, 5.0);
};
</script>

<template>
  <div
    class="w-72 sm:w-80 rounded-3xl p-4 sm:p-5 shadow-2xl border-2 transition-all duration-300 relative select-text no-drag backdrop-blur-2xl"
    :class="[
      persona === 'zen'
        ? 'bg-stone-950/95 text-stone-100 border-amber-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 ring-amber-400/30'
        : 'bg-slate-950/95 text-slate-100 border-emerald-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 ring-emerald-400/30'
    ]"
  >
    <!-- Pointer Notch -->
    <div
      class="absolute -left-2.5 top-12 w-4 h-4 transform rotate-45 border-l-2 border-b-2"
      :class="persona === 'zen' ? 'bg-stone-950 border-amber-500/80' : 'bg-slate-950 border-emerald-500/80'"
    />

    <!-- Header Actions & Title -->
    <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b" :class="persona === 'zen' ? 'border-amber-500/30' : 'border-emerald-500/30'">
      <div class="flex items-center gap-1.5 text-xs font-serif font-bold truncate" :class="persona === 'zen' ? 'text-amber-300' : 'text-emerald-300'">
        <span>{{ type === 'verse' ? '📜' : (healthReminder?.icon || '💡') }}</span>
        <span class="truncate">
          {{ type === 'verse' ? `KINH PHÁP CÚ • KỆ SỐ ${verse?.verse_number}` : healthReminder?.title }}
        </span>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <!-- Sound Bell Trigger -->
        <button
          @click="ringSound"
          class="p-1 rounded-lg text-xs transition-colors hover:scale-110 cursor-pointer"
          :class="persona === 'zen' ? 'bg-stone-900 text-amber-300 hover:bg-stone-800' : 'bg-slate-900 text-emerald-300 hover:bg-slate-800'"
          title="Thỉnh chuông chánh niệm"
        >
          🔔
        </button>

        <!-- Close Button -->
        <button
          @click="$emit('close')"
          class="p-1 rounded-lg text-xs transition-colors hover:scale-110 cursor-pointer text-stone-400 hover:text-white"
          :class="persona === 'zen' ? 'bg-stone-900 hover:bg-stone-800' : 'bg-slate-900 hover:bg-slate-800'"
          title="Đóng"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Content Stage: Dhammapada Verse -->
    <div v-if="type === 'verse' && verse" class="space-y-2 text-left font-serif">
      <!-- Chapter Badge -->
      <span class="text-[11px] font-sans opacity-70 block italic" :class="persona === 'zen' ? 'text-amber-200' : 'text-emerald-200'">
        {{ verse.chapter_vi }} ({{ verse.chapter_pali }})
      </span>

      <!-- Pali text -->
      <p class="text-[11px] italic leading-relaxed whitespace-pre-line pl-2 border-l-2" :class="persona === 'zen' ? 'text-amber-200/90 border-amber-500/40' : 'text-emerald-200/90 border-emerald-500/40'">
        "{{ verse.pali }}"
      </p>

      <!-- Vietnamese Translation (Crisp & High Contrast) -->
      <p class="text-xs sm:text-sm font-bold text-white leading-relaxed whitespace-pre-line bg-stone-900/90 p-2.5 rounded-xl border border-stone-800 shadow-inner">
        {{ verse.vietnamese }}
      </p>

      <!-- Insight Box -->
      <div class="text-[11px] italic p-2 rounded-lg leading-relaxed flex items-start gap-1.5" :class="persona === 'zen' ? 'bg-amber-950/40 text-amber-300 border border-amber-500/20' : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'">
        <span class="shrink-0">💡</span>
        <span>{{ verse.insight }}</span>
      </div>
    </div>

    <!-- Content Stage: Health Reminder -->
    <div v-else-if="type === 'health' && healthReminder" class="space-y-2.5 text-left font-sans">
      <p class="text-xs sm:text-sm text-stone-200 leading-relaxed bg-stone-900/90 p-3 rounded-xl border border-stone-800">
        {{ healthReminder.message }}
      </p>

      <div v-if="healthReminder.type === 'breathe'" class="pt-1">
        <button
          @click="$emit('start-breathing')"
          class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold text-xs shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>🌸</span>
          <span>Bắt Đầu Điều Tức 3 Nhịp Thở</span>
        </button>
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="mt-2.5 pt-2 border-t flex items-center justify-between gap-2 text-xs font-serif" :class="persona === 'zen' ? 'border-stone-800' : 'border-slate-800'">
      <button
        @click="copyText"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
        :class="persona === 'zen' ? 'text-amber-300/80 hover:text-amber-200 bg-stone-900 hover:bg-stone-800' : 'text-emerald-300/80 hover:text-emerald-200 bg-slate-900 hover:bg-slate-800'"
      >
        <span>{{ copied ? '✅' : '📋' }}</span>
        <span>{{ copied ? 'Đã chép' : 'Sao chép' }}</span>
      </button>

      <button
        @click="$emit('draw-next')"
        class="flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md shrink-0"
        :class="persona === 'zen' ? 'bg-amber-500 hover:bg-amber-400 text-stone-950' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'"
      >
        <span>🎲</span>
        <span>Rút câu khác →</span>
      </button>
    </div>
  </div>
</template>