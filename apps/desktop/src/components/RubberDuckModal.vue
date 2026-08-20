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
  'Đã kiểm tra log request / payload đầu vào tại middleware chưa?',
  'Chú ý các giá trị undefined / null hoặc race condition trong async/await!',
  'Hãy in ra (console.log / dump) kiểu dữ liệu thực tế trước khi parse.',
  'Kiểm tra lại cache: thử xóa cache Redis / Browser / Config và build lại.',
  'Quán chiếu luồng dữ liệu từng bước: Input ➔ Transformation ➔ Output.',
  'Nếu bế tắc hơn 30 phút, hãy đứng dậy uống 1 ngụm nước ấm rồi nhìn lại!',
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
        <span>DEBUG TÂM THỨC (RUBBER DUCK & YỂM BÙA)</span>
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
      Gặp bug hóc búa? Hãy giải thích vắn tắt vấn đề cho Ma Cà Tưng nghe. Nói ra thành lời là 70% lời giải sẽ tự xuất hiện!
    </p>

    <!-- Textarea input -->
    <div class="mb-3">
      <textarea
        v-model="problemInput"
        rows="3"
        placeholder="Mô tả bug đang gặp phải (ví dụ: API trả về 500 khi upload file, UI bị re-render liên tục...)"
        class="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-400 text-xs text-white placeholder-slate-500 outline-none resize-none font-mono"
      ></textarea>
    </div>

    <!-- Blessed Advice Output Box -->
    <div v-if="isBlessed" class="mb-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
      <div class="font-bold flex items-center gap-1.5 text-amber-300">
        <span>📜</span>
        <span>Lời Khuyên Khai Sáng Từ Midnight Architect:</span>
      </div>
      <p class="italic leading-relaxed">"{{ advice }}"</p>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
      <span class="text-[10px] text-slate-400 font-mono">Bùa chú 0 Bug ⚡</span>

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
        <span>Yểm Bùa & Gợi Ý Debug</span>
      </button>
    </div>
  </div>
</template>