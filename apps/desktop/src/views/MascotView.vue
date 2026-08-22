<script setup lang="ts">
import { ref } from 'vue';
import type { TaskItem } from '../composables/useTaskSync';
import ZenMascotStage from '../components/ZenMascotStage.vue';
import TaskDispatchModal from '../components/TaskDispatchModal.vue';
import PomodoroTimer from '../components/PomodoroTimer.vue';
import EveningReviewModal from '../components/EveningReviewModal.vue';
import RubberDuckModal from '../components/RubberDuckModal.vue';
import QuickNotesModal from '../components/QuickNotesModal.vue';
import CommandPaletteModal from '../components/CommandPaletteModal.vue';
import DailyFocusBar from '../components/DailyFocusBar.vue';
import TaskHubSetupModal from '../components/TaskHubSetupModal.vue';
import UpdateStatus from '../components/UpdateStatus.vue';
import MacatungIcon from '../components/MacatungIcon.vue';
import { sfx } from '../audio/soundEffects';
import { mindfulBell } from '../audio/mindfulBellAudio';

const props = defineProps<{
  tasks: TaskItem[];
  projects: any[];
  activeTask?: TaskItem | null;
  isOnline?: boolean;
  credential?: any;
}>();

const emit = defineEmits<{
  (e: 'switch-mode', mode: 'ide'): void;
  (e: 'create-task', title: string, priority?: string, projectId?: number): void;
  (e: 'toggle-complete', task: TaskItem): void;
  (e: 'start-pomodoro', task: TaskItem): void;
  (e: 'pomodoro-completed', task: TaskItem): void;
  (e: 'set-credential', credential: any): void;
  (e: 'clear-credential'): void;
}>();

const isHovered = ref(false);
const zenMascotRef = ref<InstanceType<typeof ZenMascotStage> | null>(null);
const TASK_HUB_URL = (import.meta as any).env?.VITE_TASK_HUB_URL || 'https://task-hub.macatung.dev';

export type ActiveMascotModal = 'palette' | 'dispatch' | 'review' | 'pomodoro' | 'duck' | 'notes' | 'taskhub' | null;
const activeModal = ref<ActiveMascotModal>(null);

const openWebAction = (path = '/tasks') => {
  const url = `${TASK_HUB_URL}${path}`;
  if ((window as any).desktopApi?.openExternal) (window as any).desktopApi.openExternal(url);
  else window.open(url, '_blank');
};

const closeAll = () => {
  activeModal.value = null;
};

const openModal = (modal: ActiveMascotModal) => {
  activeModal.value = activeModal.value === modal ? null : modal;
  sfx.playClick();
};

const handleMascotClick = () => {
  mindfulBell.ringBell(432, 5.5);
  zenMascotRef.value?.triggerChime?.();
  if (!activeModal.value) {
    openModal('dispatch');
  } else {
    closeAll();
  }
};

let isDragging = false;
let startScreenX = 0;
let startScreenY = 0;
let hasMoved = false;

const onMascotMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return;
  isDragging = true;
  hasMoved = false;
  startScreenX = event.screenX;
  startScreenY = event.screenY;

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging) return;
    const dx = moveEvent.screenX - startScreenX;
    const dy = moveEvent.screenY - startScreenY;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      hasMoved = true;
      startScreenX = moveEvent.screenX;
      startScreenY = moveEvent.screenY;
      (window as any).desktopApi?.moveWindow?.(dx, dy);
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (!hasMoved) handleMascotClick();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const handleCreateTask = (title: string, priority = 'high', projectId?: number) => {
  emit('create-task', title, priority, projectId);
  sfx.playSuccess();
};

const handleStartPomodoro = (task: TaskItem) => {
  emit('start-pomodoro', task);
  openModal('pomodoro');
};

const handlePomodoroCompleted = (task: TaskItem) => {
  emit('pomodoro-completed', task);
  sfx.playSuccess();
};

const handleTaskHubConnected = (next: any) => {
  emit('set-credential', next);
  activeModal.value = 'dispatch';
  sfx.playSuccess();
};

const handleTaskHubDisconnect = () => {
  emit('clear-credential');
  activeModal.value = null;
};

const hideMascot = () => (window as any).desktopApi?.close?.();
const checkForUpdates = () => (window as any).desktopApi?.updater?.check?.();
const installUpdate = () => (window as any).desktopApi?.updater?.install?.();

const switchToIde = () => {
  sfx.playClick();
  emit('switch-mode', 'ide');
};

defineExpose({
  openModal,
  closeAll,
});
</script>

<template>
  <div class="w-full h-full p-4 flex items-end justify-end relative select-none bg-transparent overflow-visible font-sans">
    <!-- Update Badge -->
    <div class="absolute right-3 top-3 z-40 pointer-events-auto">
      <UpdateStatus />
    </div>

    <!-- Active Modals Area -->
    <div class="absolute inset-0 z-30 pointer-events-none flex items-end justify-end p-3 sm:p-4 overflow-hidden">
      <div
        class="w-full max-h-[calc(100vh-1rem)] mr-0 sm:mr-3 mb-0 sm:mb-2 overflow-hidden max-w-[min(960px,calc(100vw-1rem))]"
        :class="activeModal ? 'pointer-events-auto' : 'pointer-events-none'"
      >
        <CommandPaletteModal
          v-if="activeModal === 'palette'"
          @close="activeModal = null"
          @create-task="handleCreateTask"
          @start-pomodoro="openModal('pomodoro')"
          @open-duck="openModal('duck')"
          @open-notes="openModal('notes')"
          @open-dispatch="openModal('dispatch')"
          @open-review="openModal('review')"
          @check-updates="checkForUpdates"
          @install-update="installUpdate"
        />

        <TaskDispatchModal
          v-if="activeModal === 'dispatch'"
          :tasks="tasks"
          :projects="projects"
          :is-online="Boolean(isOnline)"
          :credential="credential"
          @close="activeModal = null"
          @start-pomodoro="handleStartPomodoro"
          @toggle-complete="emit('toggle-complete', $event)"
          @create-task="handleCreateTask"
        />

        <TaskHubSetupModal
          v-if="activeModal === 'taskhub'"
          :credential="credential"
          @close="activeModal = null"
          @connected="handleTaskHubConnected"
          @disconnect="handleTaskHubDisconnect"
        />

        <PomodoroTimer
          v-if="activeModal === 'pomodoro'"
          :active-task="activeTask"
          @pomodoro-completed="handlePomodoroCompleted"
          @close="activeModal = null"
        />

        <EveningReviewModal
          v-if="activeModal === 'review'"
          :tasks="tasks"
          @close="activeModal = null"
        />

        <RubberDuckModal
          v-if="activeModal === 'duck'"
          @close="activeModal = null"
        />

        <QuickNotesModal
          v-if="activeModal === 'notes'"
          @close="activeModal = null"
        />
      </div>
    </div>

    <!-- Draggable Floating Desktop Pet Mascot -->
    <div
      class="mascot-shell no-drag relative flex flex-col items-center cursor-pointer active:scale-98 transition-transform z-20 shrink-0 mr-2 mb-2"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @mousedown="onMascotMouseDown"
      title="Nhấn để mở Tasks và kéo để di chuyển vị trí"
    >
      <!-- Companion Quick Action Dock -->
      <nav
        class="no-drag absolute -top-12 right-0 flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/98 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-200"
        :class="isHovered ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'"
        aria-label="Mascot Actions"
        @click.stop
        @mousedown.stop
      >
        <!-- 1-Click Launch IDE Mode -->
        <button
          class="dock-button bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/80"
          title="Mở Task Hub IDE (VS Code Mode)"
          @click="switchToIde"
        >
          <MacatungIcon name="agent" :size="14" />
        </button>

        <div class="w-px h-4 bg-slate-800 mx-0.5" />

        <button
          class="dock-button text-violet-300 hover:text-violet-200"
          title="Command Palette (Ctrl+K)"
          @click="openModal('palette')"
        >
          ⌘
        </button>

        <button
          class="dock-button text-amber-300 hover:text-amber-200"
          title="Danh sách việc hôm nay"
          @click="openModal('dispatch')"
        >
          ✓
        </button>

        <button
          class="dock-button text-rose-300 hover:text-rose-200"
          title="Đồng hồ Pomodoro"
          @click="openModal('pomodoro')"
        >
          ⏱
        </button>

        <button
          class="dock-button text-yellow-300 hover:text-yellow-200"
          title="Debug cùng Rubber Duck"
          @click="openModal('duck')"
        >
          🦆
        </button>

        <button
          class="dock-button text-emerald-300 hover:text-emerald-200"
          :title="credential ? 'Task Hub connected' : 'Connect Task Hub SaaS'"
          @click="openModal('taskhub')"
        >
          <MacatungIcon name="shield" :size="14" />
        </button>

        <button
          class="dock-button text-sky-300 hover:text-sky-200"
          title="Mở Task Hub Web"
          @click="openWebAction('/tasks')"
        >
          <MacatungIcon name="arrow" :size="14" />
        </button>

        <button
          class="dock-button text-slate-400 hover:text-slate-200"
          title="Ẩn mascot"
          @click="hideMascot"
        >
          ×
        </button>
      </nav>

      <!-- Zen Mascot Animated Stage -->
      <ZenMascotStage ref="zenMascotRef" :is-hovered="isHovered" />

      <!-- Daily Focus Bar Progress Indicator -->
      <DailyFocusBar :tasks="tasks" />
    </div>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}
.mascot-shell::before {
  content: '';
  position: absolute;
  top: -3.75rem;
  left: -1.25rem;
  right: -1.25rem;
  height: 3.75rem;
  z-index: 0;
}
.dock-button {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  transition: background-color 0.15s, transform 0.15s;
  cursor: pointer;
}
.dock-button:hover {
  background: rgb(30 41 59);
  transform: translateY(-1px);
}
</style>
