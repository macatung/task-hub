<script setup lang="ts">
import { computed } from 'vue';
import { TaskItem } from '../composables/useTaskSync';

const props = defineProps<{
  tasks: TaskItem[];
  pomodoroGoal?: number;
}>();

const completedPomodoros = computed(() => {
  return props.tasks.reduce((sum, t) => sum + (t.completed_pomodoros || 0), 0);
});

const totalTasks = computed(() => props.tasks.length);
const completedTasks = computed(() => props.tasks.filter(t => t.status === 'done').length);

const targetPomodoros = computed(() => props.pomodoroGoal || 8);

const focusProgressPercent = computed(() => {
  const pRatio = Math.min(1, completedPomodoros.value / targetPomodoros.value);
  const tRatio = totalTasks.value > 0 ? completedTasks.value / totalTasks.value : 0;
  const overall = (pRatio * 0.7 + tRatio * 0.3) * 100;
  return Math.min(100, Math.round(overall));
});
</script>

<template>
  <div class="mt-1 w-32 flex flex-col items-center select-none group/focusbar relative">
    <!-- Slim Progress Track -->
    <div class="w-full h-1 bg-slate-900/90 rounded-full overflow-hidden border border-slate-800/80">
      <div
        class="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
        :style="{ width: `${Math.max(5, focusProgressPercent)}%` }"
      ></div>
    </div>

    <!-- Quick Micro Stats Line -->
    <div class="w-full flex items-center justify-between mt-0.5 px-0.5 text-[8px] font-mono text-slate-500 font-semibold">
      <span>🍅 {{ completedPomodoros }}/{{ targetPomodoros }}</span>
      <span class="text-emerald-400 font-bold">{{ focusProgressPercent }}%</span>
    </div>

    <!-- Hover Micro Tooltip Summary -->
    <div class="opacity-0 group-hover/focusbar:opacity-100 transition-opacity duration-200 pointer-events-none absolute bottom-full mb-1.5 right-0 w-40 p-2 rounded-xl bg-slate-950/98 border border-slate-800 shadow-xl backdrop-blur-md text-[10px] text-slate-300 font-sans z-50">
      <div class="font-bold text-white mb-1 flex items-center justify-between border-b border-slate-800 pb-1">
        <span>⚡ Tiến Độ Hôm Nay</span>
        <span class="font-mono text-emerald-400 font-bold">{{ focusProgressPercent }}%</span>
      </div>
      <div class="space-y-0.5 font-mono text-[9px]">
        <div class="flex justify-between">
          <span class="text-slate-400">Pomodoros:</span>
          <span class="text-amber-300 font-bold">{{ completedPomodoros }}/{{ targetPomodoros }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Task hoàn tất:</span>
          <span class="text-emerald-300 font-bold">{{ completedTasks }}/{{ totalTasks }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
