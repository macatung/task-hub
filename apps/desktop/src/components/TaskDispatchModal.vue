<script setup lang="ts">
import { ref } from 'vue';
import { TaskItem } from '../composables/useTaskSync';
import { mindfulBell } from '../audio/mindfulBellAudio';

const props = defineProps<{
  tasks: TaskItem[];
  isOnline: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'start-pomodoro', task: TaskItem): void;
  (e: 'toggle-complete', task: TaskItem): void;
  (e: 'create-task', title: string, priority: string): void;
}>();

const newTaskTitle = ref('');
const selectedPriority = ref('high');

const handleAddTask = () => {
  if (!newTaskTitle.value.trim()) return;
  emit('create-task', newTaskTitle.value.trim(), selectedPriority.value);
  mindfulBell.ringBell(528, 1.5);
  newTaskTitle.value = '';
};

const handleToggle = (task: TaskItem) => {
  emit('toggle-complete', task);
  if (task.status !== 'done') {
    mindfulBell.ringBell(528, 3.0);
  }
};

const handleSelectForPomodoro = (task: TaskItem) => {
  emit('start-pomodoro', task);
  mindfulBell.ringBell(528, 2.0);
};

const openWebHub = () => {
  if ((window as any).electron?.shell?.openExternal) {
    (window as any).desktopApi?.openExternal?.(`${(import.meta as any).env?.VITE_TASK_HUB_URL || 'https://tasks.macatung.dev'}/tasks`);
  } else {
    window.open(`${(import.meta as any).env?.VITE_TASK_HUB_URL || 'https://tasks.macatung.dev'}/tasks`, '_blank');
  }
};
</script>

<template>
  <div class="w-80 sm:w-88 rounded-2xl p-4 bg-slate-950/98 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-2xl no-drag select-none text-left font-sans animate-fadeIn">
    <!-- Clean Minimalist Header -->
    <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <span>🎯</span>
          <span class="font-mono text-[11px] uppercase tracking-wider">NHIỆM VỤ HÔM NAY</span>
        </div>
        <div class="text-[9px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
          <span class="w-1.5 h-1.5 rounded-full" :class="isOnline ? 'bg-emerald-400' : 'bg-amber-400'"></span>
          <span>{{ isOnline ? 'Đồng bộ tasks.macatung.dev' : 'Offline Cache' }}</span>
        </div>
      </div>

      <button
        @click="$emit('close')"
        class="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer text-xs transition-colors"
        title="Đóng"
      >
        ✕
      </button>
    </div>

    <!-- Quick Add Input -->
    <div class="flex gap-1.5 mb-2.5">
      <input
        v-model="newTaskTitle"
        @keyup.enter="handleAddTask"
        type="text"
        placeholder="+ Giao việc mới... (Enter)"
        class="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-slate-600 text-xs text-white placeholder-slate-500 outline-none font-sans transition-colors"
      />
      <button
        @click="handleAddTask"
        :disabled="!newTaskTitle.trim()"
        class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Thêm
      </button>
    </div>

    <!-- Minimalist Tasks List -->
    <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1 mb-2.5">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all flex items-start justify-between gap-2 text-xs group"
      >
        <div class="flex items-start gap-2.5 flex-1 min-w-0">
          <input
            type="checkbox"
            :checked="task.status === 'done'"
            @change="handleToggle(task)"
            class="accent-emerald-500 w-3.5 h-3.5 mt-0.5 cursor-pointer shrink-0"
          />
          <div class="min-w-0 flex-1">
            <!-- Project Identifier (Minimalist Color Dot) -->
            <div v-if="task.project" class="text-[9px] font-mono text-slate-400 truncate flex items-center gap-1 mb-0.5">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: task.project.color || '#3b82f6' }"></span>
              <span class="truncate">{{ task.project.title }}</span>
            </div>

            <!-- Task Title -->
            <div
              :class="[
                'font-semibold text-xs leading-snug truncate',
                task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'
              ]"
            >
              {{ task.title }}
            </div>

            <!-- Metadata Info -->
            <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
              <span>🍅 {{ task.completed_pomodoros }}/{{ task.estimated_pomodoros }}</span>
              <span v-if="task.priority === 'urgent'" class="text-red-400 font-medium">Khẩn cấp</span>
              <span v-else-if="task.priority === 'high'" class="text-amber-300 font-medium">Ưu tiên</span>
            </div>
          </div>
        </div>

        <!-- Focus Button -->
        <button
          v-if="task.status !== 'done'"
          @click="handleSelectForPomodoro(task)"
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 font-medium text-[10px] shrink-0 transition-all cursor-pointer flex items-center gap-1"
          title="Bật Pomodoro cho task này"
        >
          <span>🍅 Focus</span>
        </button>
      </div>

      <div v-if="tasks.length === 0" class="text-center py-5 text-xs text-slate-500 italic">
        Chưa có nhiệm vụ nào cho hôm nay.
      </div>
    </div>

    <!-- Bottom Actions & Web Hub Link -->
    <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
      <span class="text-[10px] font-mono text-slate-500">
        Đã hoàn tất: <strong class="text-emerald-400">{{ tasks.filter(t => t.status === 'done').length }}/{{ tasks.length }}</strong>
      </span>

      <button
        @click="openWebHub"
        class="text-[10px] font-mono text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
      >
        <span>Mở Bảng Kanban Web</span>
        <span>↗</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s ease-out forwards;
}
</style>
