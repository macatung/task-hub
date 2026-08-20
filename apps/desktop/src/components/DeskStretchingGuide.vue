<script setup lang="ts">
import { ref } from 'vue';
import { mindfulBell } from '../audio/mindfulBellAudio';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentStep = ref(0);

const exercises = [
  {
    title: '1. Quy Tắc 20-20-20 Cho Đôi Mắt 👀',
    desc: 'Nhìn xa vào một vật cách khoảng 6 mét (20 feet) trong ít nhất 20 giây. Chớp mắt nhẹ nhàng 5 lần để giữ ẩm cho giác mạc.',
    icon: '🌿',
  },
  {
    title: '2. Xoay Khớp Cổ & Thả Lỏng Vai Gáy 🧘‍♂️',
    desc: 'Nghiêng đầu nhẹ sang phải 5 giây, sang trái 5 giây. Xoay tròn khớp vai ra sau 5 vòng để giải phóng áp lực tích tụ.',
    icon: '⚡',
  },
  {
    title: '3. Vươn Cột Sống Mở Rộng Lồng Ngực 🌸',
    desc: 'Đan hai tay lại và duỗi thẳng lên trời. Hít vào thật sâu kéo giãn toàn bộ đốt sống lưng, thở ra hạ tay xuống.',
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
        <span>VẬN ĐỘNG CỘT SỐNG & NGHỈ MẮT (30s)</span>
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
          <span class="text-[10px] text-cyan-300 font-mono">Động tác {{ currentStep + 1 }}/3</span>
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
        {{ currentStep === exercises.length - 1 ? 'Hoàn tất ✓' : 'Động tác tiếp →' }}
      </button>
    </div>
  </div>
</template>