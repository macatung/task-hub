<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import ZenMascotStage from './components/ZenMascotStage.vue';
import TaskDispatchModal from './components/TaskDispatchModal.vue';
import PomodoroTimer from './components/PomodoroTimer.vue';
import EveningReviewModal from './components/EveningReviewModal.vue';
import RubberDuckModal from './components/RubberDuckModal.vue';
import QuickNotesModal from './components/QuickNotesModal.vue';
import CommandPaletteModal from './components/CommandPaletteModal.vue';
import DailyFocusBar from './components/DailyFocusBar.vue';
import AgentConsoleModal from './components/AgentConsoleModal.vue';
import UpdateStatus from './components/UpdateStatus.vue';
import { useTaskSync, TaskItem } from './composables/useTaskSync';
import { sfx } from './audio/soundEffects';
import { mindfulBell } from './audio/mindfulBellAudio';

const { tasks, agentTasks, activeTask, isOnline, createTask, toggleTaskComplete, incrementPomodoro } = useTaskSync();
const isHovered = ref(false);
const zenMascotRef = ref<InstanceType<typeof ZenMascotStage> | null>(null);
const TASK_HUB_URL = (import.meta as any).env?.VITE_TASK_HUB_URL || 'https://tasks.macatung.dev';
type ActiveModal = 'palette' | 'dispatch' | 'review' | 'pomodoro' | 'duck' | 'notes' | 'agent' | null;
const activeModal = ref<ActiveModal>(null);

const openWebAction = (path = '/tasks') => {
  const url = `${TASK_HUB_URL}${path}`;
  if ((window as any).desktopApi?.openExternal) (window as any).desktopApi.openExternal(url);
  else window.open(url, '_blank');
};

const closeAll = () => { activeModal.value = null; };
const openModal = (modal: ActiveModal) => {
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
  isDragging = true; hasMoved = false; startScreenX = event.screenX; startScreenY = event.screenY;
  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging) return;
    const dx = moveEvent.screenX - startScreenX; const dy = moveEvent.screenY - startScreenY;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      hasMoved = true; startScreenX = moveEvent.screenX; startScreenY = moveEvent.screenY;
      (window as any).desktopApi?.moveWindow?.(dx, dy);
    }
  };
  const onMouseUp = () => {
    isDragging = false; window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp);
    if (!hasMoved) handleMascotClick();
  };
  window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
};

const handleCreateTask = (title: string, priority = 'high') => { createTask(title, priority); sfx.playSuccess(); };
const handleStartPomodoro = (task: TaskItem) => { activeTask.value = task; openModal('pomodoro'); };
const handlePomodoroCompleted = (task: TaskItem) => { incrementPomodoro(task); sfx.playSuccess(); };
const hideMascot = () => (window as any).desktopApi?.close?.();
const checkForUpdates = () => (window as any).desktopApi?.updater?.check?.();
const installUpdate = () => (window as any).desktopApi?.updater?.install?.();
const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openModal('palette'); }
  else if (event.key === 'Escape') closeAll();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  (window as any).desktopApi?.onTrayAction?.((action: string) => {
    const actions: Record<string, ActiveModal> = { 'open-dispatch': 'dispatch', 'open-agent': 'agent', 'open-review': 'review', 'open-pomodoro': 'pomodoro', 'open-duck': 'duck', 'open-notes': 'notes' };
    if (actions[action]) openModal(actions[action]);
    if (action === 'open-tasks') openWebAction('/tasks');
    if (action === 'check-updates') checkForUpdates();
    if (action === 'install-update') installUpdate();
  });
});
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
</script>

<template>
  <div class="w-full h-full p-4 flex items-end justify-end relative select-none bg-transparent overflow-visible font-sans">
    <div class="mr-3 mb-2 z-30 shrink-0">
      <UpdateStatus />
      <CommandPaletteModal v-if="activeModal === 'palette'" @close="activeModal = null" @create-task="handleCreateTask" @start-pomodoro="openModal('pomodoro')" @open-duck="openModal('duck')" @open-notes="openModal('notes')" @open-dispatch="openModal('dispatch')" @open-review="openModal('review')" @check-updates="checkForUpdates" @install-update="installUpdate" />
      <TaskDispatchModal v-if="activeModal === 'dispatch'" :tasks="tasks" :is-online="isOnline" @close="activeModal = null" @start-pomodoro="handleStartPomodoro" @toggle-complete="toggleTaskComplete" @create-task="handleCreateTask" />
      <AgentConsoleModal v-if="activeModal === 'agent'" :tasks="agentTasks" :initial-task="activeTask" @close="activeModal = null" />
      <PomodoroTimer v-if="activeModal === 'pomodoro'" :active-task="activeTask" @pomodoro-completed="handlePomodoroCompleted" @close="activeModal = null" />
      <EveningReviewModal v-if="activeModal === 'review'" :tasks="tasks" @close="activeModal = null" />
      <RubberDuckModal v-if="activeModal === 'duck'" @close="activeModal = null" />
      <QuickNotesModal v-if="activeModal === 'notes'" @close="activeModal = null" />
    </div>

    <div class="mascot-shell no-drag relative flex flex-col items-center cursor-pointer active:scale-98 transition-transform z-20 shrink-0 mr-2 mb-2" @mouseenter="isHovered = true" @mouseleave="isHovered = false" @mousedown="onMascotMouseDown" title="Mở Tasks và kéo để di chuyển">
      <nav class="no-drag absolute -top-12 right-0 flex items-center gap-1 rounded-2xl border border-slate-700/80 bg-slate-950/98 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-200" :class="isHovered ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'" aria-label="Task Companion actions" @click.stop @mousedown.stop>
        <button class="dock-button text-violet-300" title="Command center (Ctrl+K)" @click="openModal('palette')">⌘</button>
        <button class="dock-button text-blue-300" title="AI Agent" @click="openModal('agent')">🤖</button>
        <button class="dock-button text-amber-300" title="Tasks hôm nay" @click="openModal('dispatch')">✓</button>
        <button class="dock-button text-sky-300" title="Mở Task Hub" @click="openWebAction('/tasks')">↗</button>
        <button class="dock-button text-slate-300" title="Ẩn mascot" @click="hideMascot">×</button>
      </nav>

      <ZenMascotStage ref="zenMascotRef" :is-hovered="isHovered" />
      <DailyFocusBar :tasks="tasks" />
    </div>
  </div>
</template>

<style scoped>
.no-drag { -webkit-app-region: no-drag; }
.mascot-shell::before { content: ''; position: absolute; top: -3.75rem; left: -1.25rem; right: -1.25rem; height: 3.75rem; z-index: 0; }
.dock-button { width: 1.9rem; height: 1.9rem; display: grid; place-items: center; border-radius: .7rem; font-size: .85rem; font-weight: 700; transition: background-color .15s, transform .15s; cursor: pointer; }
.dock-button:hover { background: rgb(30 41 59); transform: translateY(-1px); }
</style>
