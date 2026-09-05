<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  RefreshCw,
  Sparkles,
  AppWindow,
  Settings,
} from 'lucide-vue-next';
import { useTaskSync, type TaskItem } from '../composables/useTaskSync';
import SimpleSidebar, { type SmartListId } from '../components/simple/SimpleSidebar.vue';
import SimpleTaskList from '../components/simple/SimpleTaskList.vue';
import SimpleTaskDetail from '../components/simple/SimpleTaskDetail.vue';
import SimpleAiAssistant from '../components/simple/SimpleAiAssistant.vue';
import MiniFloatWidget from '../components/simple/MiniFloatWidget.vue';
import SimpleSettingsModal from '../components/simple/SimpleSettingsModal.vue';

const emit = defineEmits<{
  (e: 'switch-mode', mode: 'developer'): void;
}>();

const sync = useTaskSync();

// Navigation state
const activeList = ref<SmartListId>('today');
const selectedProjectId = ref<number | null>(null);
const selectedEpicId = ref<number | null>(null);
const selectedTaskId = ref<number | null>(null);

// All Epics list for drawer and sidebar
const epics = computed(() => sync.tasks.value.filter((t) => t.issue_type === 'epic'));

// UI Drawer & Modal state
const isAiOpen = ref(false);
const aiInitialAction = ref<'breakdown' | 'summary' | 'draft' | null>(null);
const isSettingsOpen = ref(false);
const isMiniMode = ref(false);
const isAlwaysOnTop = ref(false);

const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null;
  return sync.tasks.value.find((t) => t.id === selectedTaskId.value) || null;
});

// Selection handlers
const onSelectList = (list: SmartListId) => {
  activeList.value = list;
  selectedProjectId.value = null;
  selectedEpicId.value = null;
};

const onSelectProject = (projectId: number | null) => {
  selectedProjectId.value = projectId;
  selectedEpicId.value = null;
};

const onSelectEpic = (epicId: number | null) => {
  selectedEpicId.value = epicId;
  selectedProjectId.value = null;
};

const onSelectTask = (task: TaskItem) => {
  selectedTaskId.value = task.id;
};

const onCloseDetail = () => {
  selectedTaskId.value = null;
};

// Task CRUD handlers
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const handleCreateTask = async (payload: {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: number;
  epicId?: number;
}) => {
  const todayStr = getLocalDateString();
  const tmr = new Date(Date.now() + 86400000);
  const tomorrowStr = getLocalDateString(tmr);

  let dueDate: string | null = null;
  if (activeList.value === 'today') {
    dueDate = todayStr;
  } else if (activeList.value === 'planned') {
    dueDate = tomorrowStr;
  }

  let priority = payload.priority;
  if (activeList.value === 'important' && priority !== 'urgent') {
    priority = 'high';
  }

  const targetProjectId = payload.projectId || selectedProjectId.value || null;
  const targetEpicId = payload.epicId || selectedEpicId.value || null;

  const newTask = await sync.createTask({
    title: payload.title,
    priority,
    project_id: targetProjectId,
    epic_id: targetEpicId,
    status: 'todo',
    due_date: dueDate,
  });

  if (newTask) {
    selectedTaskId.value = newTask.id;
  }
};

const handleToggleStatus = async (task: TaskItem) => {
  await sync.toggleTaskComplete(task);
};

const handleTogglePriority = async (task: TaskItem) => {
  const priorities: TaskItem['priority'][] = ['low', 'medium', 'high', 'urgent'];
  const nextPriority = priorities[(priorities.indexOf(task.priority) + 1) % priorities.length];
  await sync.updateTask(task.id, { priority: nextPriority });
};

const handleUpdateTask = async (updated: Partial<TaskItem>) => {
  if (!selectedTaskId.value) return;
  await sync.updateTask(selectedTaskId.value, updated);
};

const handleDeleteTask = async (task: TaskItem) => {
  if (selectedTaskId.value === task.id) {
    selectedTaskId.value = null;
  }
  await sync.deleteTask(task.id);
};

// AI Drawer handlers
const handleOpenAi = (action: 'breakdown' | 'summary' | 'draft', task: TaskItem) => {
  selectedTaskId.value = task.id;
  aiInitialAction.value = action;
  isAiOpen.value = true;
};

const toggleAiAssistant = () => {
  isAiOpen.value = !isAiOpen.value;
  if (isAiOpen.value && !aiInitialAction.value) {
    aiInitialAction.value = null;
  }
};

const handleApplySubtasks = async (subtaskLines: string[]) => {
  if (!selectedTask.value) return;
  const currentDesc = selectedTask.value.description || '';
  const currentNonChecklist = currentDesc
    .split('\n')
    .filter((line) => !line.match(/^[-*]\s+\[([ xX])\]/))
    .join('\n')
    .trim();

  const newChecklist = subtaskLines.map((s) => `- [ ] ${s}`).join('\n');
  const fullDesc = currentNonChecklist
    ? `${currentNonChecklist}\n\n### Các bước thực hiện:\n${newChecklist}`
    : `### Các bước thực hiện:\n${newChecklist}`;

  await sync.updateTask(selectedTask.value.id, { description: fullDesc });
};

const handleApplyNotes = async (notesText: string) => {
  if (!selectedTask.value) return;
  const currentDesc = selectedTask.value.description || '';
  const fullDesc = currentDesc
    ? `${currentDesc}\n\n---\n${notesText}`
    : notesText;

  await sync.updateTask(selectedTask.value.id, { description: fullDesc });
};

// Mini Mode window toggling
const toggleMiniMode = () => {
  isMiniMode.value = !isMiniMode.value;
  if (isMiniMode.value) {
    isAlwaysOnTop.value = true;
    window.desktopApi?.resizeWindow?.(380, 140);
    window.desktopApi?.setAlwaysOnTop?.(true);
  } else {
    isAlwaysOnTop.value = false;
    window.desktopApi?.resizeWindow?.(1120, 720);
    window.desktopApi?.setAlwaysOnTop?.(false);
  }
};

const togglePin = () => {
  isAlwaysOnTop.value = !isAlwaysOnTop.value;
  window.desktopApi?.setAlwaysOnTop?.(isAlwaysOnTop.value);
};

// Periodic deadline notification check
let notifyInterval: any = null;
let taskSyncInterval: any = null;
const checkDueDeadlines = () => {
  const today = new Date().toISOString().split('T')[0];
  const urgentTasks = sync.tasks.value.filter(
    (t) => t.status !== 'done' && (t.due_date === today || t.priority === 'urgent')
  );

  if (urgentTasks.length > 0 && window.desktopApi?.showNotification) {
    window.desktopApi.showNotification(
      'Midnight Task Hub',
      `Bạn có ${urgentTasks.length} công việc cần xử lý hôm nay: ${urgentTasks[0].title}`
    );
  }
};

// Global keyboard shortcut (Ctrl+Shift+T or Escape)
const handleGlobalKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isAiOpen.value) {
      isAiOpen.value = false;
    } else if (selectedTaskId.value) {
      selectedTaskId.value = null;
    } else if (isSettingsOpen.value) {
      isSettingsOpen.value = false;
    }
  }
};

// Windows Standard Window Caption Controls
const isMaximized = ref(false);

const minimizeWindow = () => {
  window.desktopApi?.minimize?.();
};

const toggleMaximize = async () => {
  const next = await window.desktopApi?.toggleMaximize?.();
  if (typeof next === 'boolean') {
    isMaximized.value = next;
  } else {
    isMaximized.value = !isMaximized.value;
  }
};

const closeWindow = () => {
  window.desktopApi?.close?.();
};

let unsubMaxState: (() => void) | undefined;

onMounted(() => {
  void sync.fetchTasks();
  void sync.fetchProjects();
  window.addEventListener('keydown', handleGlobalKey);
  notifyInterval = setInterval(checkDueDeadlines, 15 * 60 * 1000);
  taskSyncInterval = setInterval(() => {
    void sync.fetchTasks();
  }, 60 * 1000);

  if (window.desktopApi?.isMaximized) {
    void window.desktopApi.isMaximized().then((val: boolean) => {
      isMaximized.value = Boolean(val);
    });
  }
  if (window.desktopApi?.onMaximizedState) {
    unsubMaxState = window.desktopApi.onMaximizedState((val: boolean) => {
      isMaximized.value = val;
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
  if (notifyInterval) clearInterval(notifyInterval);
  if (taskSyncInterval) clearInterval(taskSyncInterval);
  if (unsubMaxState) unsubMaxState();
});
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 flex flex-col">
    <!-- MINI MODE RENDER -->
    <div v-if="isMiniMode" class="w-full h-full p-2 bg-slate-950">
      <MiniFloatWidget
        :tasks="sync.tasks.value"
        :current-task-id="selectedTaskId"
        :is-always-on-top="isAlwaysOnTop"
        @toggle-complete="handleToggleStatus"
        @select-task="onSelectTask"
        @restore-window="toggleMiniMode"
        @toggle-pin="togglePin"
      />
    </div>

    <!-- REGULAR DESKTOP APP RENDER -->
    <template v-else>
      <!-- Top Window Titlebar & Quick Action strip -->
      <header
        class="h-9 pl-3 pr-0 bg-[#09090b] border-b border-[#232430] flex items-center justify-between select-none text-xs text-zinc-400 drag-region"
        @dblclick="toggleMaximize"
      >
        <!-- Window title & Sync Status -->
        <div class="flex items-center gap-2 pointer-events-none">
          <div class="flex items-center gap-1.5 font-semibold text-zinc-200">
            <span class="w-2 h-2 rounded-full" :class="sync.isOnline.value ? 'bg-emerald-400' : 'bg-amber-400'"></span>
            <span>Task Hub</span>
          </div>
          <span class="text-zinc-600">|</span>
          <span class="text-[11px] text-zinc-400 font-mono">
            {{ sync.isOnline.value ? 'Đồng bộ đám mây' : 'Chế độ ngoại tuyến' }}
          </span>
        </div>

        <!-- Right Side: Quick Tools + Windows Caption Controls -->
        <div class="flex items-center h-full">
          <!-- Quick Toolbar Tools -->
          <div class="flex items-center gap-1.5 no-drag pr-2">
            <!-- Refresh button -->
            <button
              @click="sync.fetchTasks"
              :disabled="sync.isLoading.value"
              class="p-1.5 rounded-lg hover:bg-[#1c1d27] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Làm mới danh sách công việc"
            >
              <RefreshCw
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin text-indigo-400': sync.isLoading.value }"
              />
            </button>

            <!-- Toggle Mini Widget button -->
            <button
              @click="toggleMiniMode"
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#14151c] hover:bg-[#1c1d27] border border-[#232430] hover:border-[#323444] text-zinc-300 hover:text-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Thu nhỏ thành thanh tiện ích nổi góc màn hình"
            >
              <AppWindow class="w-3 h-3 text-zinc-400" />
              <span>Thu nhỏ</span>
            </button>

            <!-- AI Assistant button -->
            <button
              @click="toggleAiAssistant"
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer"
              :class="[
                isAiOpen
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-xs'
                  : 'bg-[#14151c] hover:bg-[#1c1d27] border-[#232430] hover:border-[#323444] text-zinc-300 hover:text-white'
              ]"
              title="Mở Trợ lý AI Task Hub"
            >
              <Sparkles class="w-3 h-3 text-indigo-400" />
              <span>Trợ lý AI</span>
            </button>

            <!-- Settings Button -->
            <button
              @click="isSettingsOpen = true"
              class="p-1.5 rounded-lg hover:bg-[#1c1d27] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Cài đặt"
            >
              <Settings class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Divider -->
          <div class="h-4 w-px bg-[#232430] mr-1"></div>

          <!-- Windows Standard Window Caption Controls -->
          <div class="flex items-center h-full no-drag">
            <!-- Minimize Button -->
            <button
              @click="minimizeWindow"
              class="w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1c1d27] active:bg-[#27272a] transition-colors cursor-pointer"
              aria-label="Minimize"
              title="Ẩn xuống taskbar"
            >
              <i class="codicon codicon-chrome-minimize text-[12px]"></i>
            </button>

            <!-- Maximize / Restore Button -->
            <button
              @click="toggleMaximize"
              class="w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1c1d27] active:bg-[#27272a] transition-colors cursor-pointer"
              :aria-label="isMaximized ? 'Restore window' : 'Maximize window'"
              :title="isMaximized ? 'Khôi phục kích thước' : 'Phóng to tối đa'"
            >
              <i class="codicon" :class="isMaximized ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'" style="font-size: 11px;"></i>
            </button>

            <!-- Close Button (Windows Standard Red Hover) -->
            <button
              @click="closeWindow"
              class="w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#e81123] active:bg-[#c42b1c] transition-colors cursor-pointer"
              aria-label="Close"
              title="Đóng ứng dụng"
            >
              <i class="codicon codicon-chrome-close text-[13px]"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- Main App Content (Sidebar + Center Task List + Detail Drawer) -->
      <div class="flex-1 flex overflow-hidden relative">
        <!-- Sidebar Navigation -->
        <SimpleSidebar
          :active-list="activeList"
          :selected-project-id="selectedProjectId"
          :selected-epic-id="selectedEpicId"
          :tasks="sync.tasks.value"
          :projects="sync.projects.value"
          :credential="sync.credential.value"
          :is-online="sync.isOnline.value"
          @select-list="onSelectList"
          @select-project="onSelectProject"
          @select-epic="onSelectEpic"
          @open-settings="isSettingsOpen = true"
          @switch-mode="emit('switch-mode', 'developer')"
        />

        <!-- Center Task List Workspace -->
        <main class="flex-1 h-full overflow-hidden bg-slate-950 flex flex-col min-w-0">
          <SimpleTaskList
            :active-list="activeList"
            :selected-project-id="selectedProjectId"
            :selected-epic-id="selectedEpicId"
            :tasks="sync.tasks.value"
            :projects="sync.projects.value"
            :selected-task-id="selectedTaskId"
            @select-task="onSelectTask"
            @toggle-status="handleToggleStatus"
            @toggle-priority="handleTogglePriority"
            @create-task="handleCreateTask"
            @delete-task="handleDeleteTask"
            @clear-epic="selectedEpicId = null"
          />
        </main>

        <!-- Right Side: Task Detail Slide-over -->
        <SimpleTaskDetail
          v-if="selectedTask"
          :task="selectedTask"
          :projects="sync.projects.value"
          :epics="epics"
          @close="onCloseDetail"
          @update-task="handleUpdateTask"
          @open-ai="handleOpenAi"
          @delete-task="handleDeleteTask"
        />

        <!-- Right Side: AI Assistant Slide-over -->
        <SimpleAiAssistant
          :is-open="isAiOpen"
          :task="selectedTask"
          :initial-action="aiInitialAction"
          @close="isAiOpen = false"
          @apply-subtasks="handleApplySubtasks"
          @apply-notes="handleApplyNotes"
        />
      </div>

      <!-- Settings Modal -->
      <SimpleSettingsModal
        :is-open="isSettingsOpen"
        :credential="sync.credential.value"
        :is-online="sync.isOnline.value"
        app-mode="simple"
        @close="isSettingsOpen = false"
        @switch-mode="(mode) => emit('switch-mode', mode as any)"
        @disconnect="sync.clearCredential"
      />
    </template>
  </div>
</template>

<style scoped>
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
</style>
