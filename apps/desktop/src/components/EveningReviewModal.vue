<script setup lang="ts">
import { computed } from 'vue';
import { TaskItem } from '../composables/useTaskSync';
import { mindfulBell } from '../audio/mindfulBellAudio';

const props = defineProps<{
  tasks: TaskItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const completedTasks = computed(() => props.tasks.filter(t => t.status === 'done'));
const totalPomodoros = computed(() => props.tasks.reduce((sum, t) => sum + (t.completed_pomodoros || 0), 0));
const completionRate = computed(() => {
  if (props.tasks.length === 0) return 100;
  return Math.round((completedTasks.value.length / props.tasks.length) * 100);
});

const handlePraise = () => {
  mindfulBell.ringBell(432, 6.0);
  emit('close');
};
</script>

<template>
  <div class="w-80 sm:w-96 rounded-3xl p-5 bg-slate-950/98 text-stone-100 border-2 border-purple-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans ring-1 ring-purple-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-purple-500/30">
      <div class="flex items-center gap-2">
        <span class="text-xl">🌙</span>
        <span class="text-xs font-bold text-purple-300">TỔNG KẾT NĂNG SUẤT CUỐI NGÀY</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-slate-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-3 gap-2 text-center my-3">
      <div class="p-2.5 rounded-2xl bg-slate-900/90 border border-purple-500/30">
        <div class="text-xl font-bold font-mono text-purple-300">{{ completedTasks.length }}/{{ tasks.length }}</div>
        <div class="text-[9px] text-slate-400 mt-0.5">Task Đã Xong</div>
      </div>

      <div class="p-2.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
        <div class="text-xl font-bold font-mono text-emerald-400">{{ completionRate }}%</div>
        <div class="text-[9px] text-slate-400 mt-0.5">Hoàn Thành</div>
      </div>

      <div class="p-2.5 rounded-2xl bg-slate-900/90 border border-amber-500/30">
        <div class="text-xl font-bold font-mono text-amber-300">🍅 {{ totalPomodoros }}</div>
        <div class="text-[9px] text-slate-400 mt-0.5">Pomodoros</div>
      </div>
    </div>

    <!-- Celebration Message -->
    <div class="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs my-3 space-y-1">
      <div class="font-bold flex items-center gap-1 text-purple-300">
        <span>✨</span>
        <span>Ma Cà Tưng Tán Thán:</span>
      </div>
      <p class="italic leading-relaxed">
        "Bạn đã nỗ lực hết mình hôm nay! Hãy xem lại kết quả và chọn việc quan trọng tiếp theo."
      </p>
    </div>

    <!-- Bottom Action -->
    <div class="pt-2 border-t border-slate-800 flex justify-end">
      <button
        @click="handlePraise"
        class="py-2 px-5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5"
      >
        <span>🔔</span>
        <span>Tiếp tục với task tiếp theo</span>
      </button>
    </div>
  </div>
</template>
