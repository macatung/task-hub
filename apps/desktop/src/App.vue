<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import IdeView from './views/IdeView.vue';
import MascotView from './views/MascotView.vue';
import { useTaskSync, TaskItem } from './composables/useTaskSync';
import { sfx } from './audio/soundEffects';

export type ActiveMascotModal = 'palette' | 'dispatch' | 'review' | 'pomodoro' | 'duck' | 'notes' | 'taskhub' | null;
type AppMode = 'ide' | 'mascot';

const {
  tasks,
  projects,
  agentTasks,
  activeTask,
  isOnline,
  credential,
  setCredential,
  clearCredential,
  loadCredential,
  fetchAgentTasks,
  createTask,
  toggleTaskComplete,
  incrementPomodoro,
} = useTaskSync();

const currentMode = ref<AppMode>('ide');
const mascotViewRef = ref<InstanceType<typeof MascotView> | null>(null);

const setAppMode = async (mode: AppMode) => {
  currentMode.value = mode;
  if ((window as any).desktopApi?.setAppMode) {
    await (window as any).desktopApi.setAppMode(mode);
  }
  if (mode === 'ide') {
    await loadCredential();
    await fetchAgentTasks();
  }
};

const toggleAppMode = async () => {
  const next = currentMode.value === 'ide' ? 'mascot' : 'ide';
  await setAppMode(next);
};

const handleCreateTask = (title: string, priority = 'high', projectId?: number) => {
  createTask(title, priority, projectId);
  sfx.playSuccess();
};

const handleStartPomodoro = (task: TaskItem) => {
  activeTask.value = task;
  if (currentMode.value === 'ide') {
    void setAppMode('mascot');
  }
  nextTick(() => {
    mascotViewRef.value?.openModal?.('pomodoro');
  });
};

const handlePomodoroCompleted = (task: TaskItem) => {
  incrementPomodoro(task);
  sfx.playSuccess();
};

const handleTaskHubConnected = async (next: any) => {
  await setCredential(next);
  sfx.playSuccess();
};

const handleTaskHubDisconnect = async () => {
  await clearCredential();
};

const handleCloseWindow = () => {
  (window as any).desktopApi?.close?.();
};

const handleGlobalKeyDown = (event: KeyboardEvent) => {
  // Ctrl+Shift+M or Cmd+Shift+M -> Toggle between IDE and Mascot mode
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    void toggleAppMode();
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeyDown);

  // Initialize mode from Electron
  if ((window as any).desktopApi?.getAppMode) {
    try {
      const mode = await (window as any).desktopApi.getAppMode();
      if (mode === 'ide' || mode === 'mascot') {
        currentMode.value = mode;
      }
    } catch {
      /* ignore */
    }
  }

  // Listen for mode changes from Electron (e.g. CLI or Tray actions)
  (window as any).desktopApi?.onAppModeChange?.((mode: AppMode) => {
    currentMode.value = mode;
    if (mode === 'ide') {
      void loadCredential();
      void fetchAgentTasks();
    }
  });

  // Listen for Tray actions
  (window as any).desktopApi?.onTrayAction?.(async (action: string) => {
    const mascotModals: Record<string, ActiveMascotModal> = {
      'open-dispatch': 'dispatch',
      'open-review': 'review',
      'open-pomodoro': 'pomodoro',
      'open-duck': 'duck',
      'open-notes': 'notes',
      'open-taskhub': 'taskhub',
    };

    if (action === 'open-agent') {
      await setAppMode('ide');
    } else if (mascotModals[action]) {
      if (currentMode.value !== 'mascot') {
        await setAppMode('mascot');
      }
      nextTick(() => {
        mascotViewRef.value?.openModal?.(mascotModals[action]);
      });
    }
  });

  if (currentMode.value === 'ide') {
    await loadCredential();
    await fetchAgentTasks();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<template>
  <main class="w-full h-full select-none overflow-hidden font-sans" :class="currentMode === 'ide' ? 'bg-[#1e1e1e]' : 'bg-transparent'">
    <!-- 1. VS CODE IDE MODE -->
    <IdeView
      v-if="currentMode === 'ide'"
      :tasks="agentTasks"
      :initial-task="activeTask"
      :is-connected="Boolean(credential)"
      :desktop-credential="credential"
      @switch-mode="setAppMode('mascot')"
      @close="handleCloseWindow"
    />

    <!-- 2. MASCOT REMINDER COMPANION MODE -->
    <MascotView
      v-else-if="currentMode === 'mascot'"
      ref="mascotViewRef"
      :tasks="tasks"
      :projects="projects"
      :active-task="activeTask"
      :is-online="isOnline"
      :credential="credential"
      @switch-mode="setAppMode('ide')"
      @create-task="handleCreateTask"
      @toggle-complete="toggleTaskComplete"
      @start-pomodoro="handleStartPomodoro"
      @pomodoro-completed="handlePomodoroCompleted"
      @set-credential="handleTaskHubConnected"
      @clear-credential="handleTaskHubDisconnect"
    />
  </main>
</template>

<style scoped>
</style>
