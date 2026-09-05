<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Pin,
  Maximize2,
  Check,
  ChevronRight,
  Calendar,
  Timer,
  Sparkles,
} from 'lucide-vue-next';
import type { TaskItem } from '../../composables/useTaskSync';

const props = defineProps<{
  tasks: TaskItem[];
  currentTaskId?: number | null;
  isAlwaysOnTop?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-complete', task: TaskItem): void;
  (e: 'select-task', task: TaskItem): void;
  (e: 'restore-window'): void;
  (e: 'toggle-pin'): void;
}>();

const pendingTasks = computed(() => props.tasks.filter((t) => t.status !== 'done'));
const activeTask = computed(() => {
  if (props.currentTaskId) {
    const found = props.tasks.find((t) => t.id === props.currentTaskId);
    if (found) return found;
  }
  return pendingTasks.value[0] || null;
});

const isDragging = ref(false);
const startMouse = ref({ x: 0, y: 0 });

const onMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
    return;
  }
  isDragging.value = true;
  startMouse.value = { x: e.screenX, y: e.screenY };

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return;
    const dx = moveEvent.screenX - startMouse.value.x;
    const dy = moveEvent.screenY - startMouse.value.y;
    startMouse.value = { x: moveEvent.screenX, y: moveEvent.screenY };
    if (window.desktopApi?.moveWindow) {
      window.desktopApi.moveWindow(dx, dy);
    }
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const nextTask = () => {
  if (!activeTask.value || pendingTasks.value.length <= 1) return;
  const currentIndex = pendingTasks.value.findIndex((t) => t.id === activeTask.value?.id);
  const next = pendingTasks.value[(currentIndex + 1) % pendingTasks.value.length];
  emit('select-task', next);
};
</script>

<template>
  <div
    @mousedown="onMouseDown"
    class="w-full h-full select-none flex flex-col justify-between bg-[#0c0d12]/95 backdrop-blur-xl border border-[#232430] hover:border-[#323444] rounded-2xl shadow-2xl p-3.5 text-zinc-100 cursor-move transition-all"
  >
    <!-- Top toolbar of mini widget -->
    <div class="flex items-center justify-between text-xs text-zinc-400 mb-2">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
        <span class="font-medium text-[11px] text-zinc-300">Việc đang làm</span>
        <span v-if="pendingTasks.length > 0" class="text-[10px] text-zinc-500 font-mono">({{ pendingTasks.length }} còn lại)</span>
      </div>

      <div class="flex items-center gap-1" @mousedown.stop>
        <!-- Pin Always-on-top toggle -->
        <button
          @click="emit('toggle-pin')"
          class="p-1 rounded-lg hover:bg-[#1c1d27] text-zinc-400 hover:text-indigo-300 transition-colors cursor-pointer"
          :class="{ 'text-indigo-400 bg-indigo-950/40': isAlwaysOnTop }"
          title="Ghim nổi trên cùng"
        >
          <Pin class="w-3.5 h-3.5" :class="{ 'fill-indigo-400': isAlwaysOnTop }" />
        </button>

        <!-- Restore / expand button -->
        <button
          @click="emit('restore-window')"
          class="p-1 rounded-lg hover:bg-[#1c1d27] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Mở rộng cửa sổ"
        >
          <Maximize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Active Task Row -->
    <div v-if="activeTask" class="flex items-center gap-3 py-1" @mousedown.stop>
      <!-- Circular Checkbox -->
      <button
        @click="emit('toggle-complete', activeTask)"
        class="linear-checkbox"
        title="Đánh dấu hoàn thành"
      >
        <Check class="w-2.5 h-2.5 text-zinc-950 stroke-[3] opacity-0 hover:opacity-100" />
      </button>

      <!-- Title -->
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-zinc-100 truncate hover:text-indigo-300 transition-colors cursor-pointer" @click="emit('restore-window')">
          {{ activeTask.title }}
        </h4>
        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
          <span v-if="activeTask.priority === 'urgent'" class="text-rose-400 font-medium">Khẩn cấp</span>
          <span v-else-if="activeTask.priority === 'high'" class="text-amber-400 font-medium">Ưu tiên cao</span>
          <span v-if="activeTask.due_date" class="inline-flex items-center gap-1 text-zinc-400">
            <Calendar class="w-2.5 h-2.5" />
            <span>{{ activeTask.due_date }}</span>
          </span>
          <span v-if="activeTask.completed_pomodoros" class="inline-flex items-center gap-0.5 text-zinc-500">
            <Timer class="w-2.5 h-2.5" />
            <span>{{ activeTask.completed_pomodoros }}</span>
          </span>
        </div>
      </div>

      <!-- Next task switch button -->
      <button
        v-if="pendingTasks.length > 1"
        @click="nextTask"
        class="p-1.5 rounded-lg hover:bg-[#1c1d27] text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0 cursor-pointer"
        title="Chuyển việc tiếp theo"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>

    <!-- Empty state when all tasks done -->
    <div v-else class="py-2 text-center" @mousedown.stop>
      <p class="text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
        <Sparkles class="w-3.5 h-3.5" />
        <span>Đã hoàn thành hết việc hôm nay!</span>
      </p>
      <button
        @click="emit('restore-window')"
        class="mt-1 text-[11px] text-indigo-400 hover:underline inline-block cursor-pointer"
      >
        Mở Task Hub để thêm việc mới
      </button>
    </div>
  </div>
</template>
