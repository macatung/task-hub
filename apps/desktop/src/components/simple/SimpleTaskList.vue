<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Search,
  Plus,
  Calendar,
  Flag,
  Layers,
  ChevronDown,
  Check,
  Star,
  Trash2,
  ArrowLeft,
  FolderKanban,
  Sun,
  ListTodo,
  CheckCircle2,
  Folder,
} from 'lucide-vue-next';
import type { TaskItem, ProjectItem } from '../../composables/useTaskSync';
import type { SmartListId } from './SimpleSidebar.vue';

const props = defineProps<{
  activeList: SmartListId;
  selectedProjectId: number | null;
  selectedEpicId?: number | null;
  tasks: TaskItem[];
  projects: ProjectItem[];
  selectedTaskId: number | null;
}>();

const emit = defineEmits<{
  (e: 'select-task', task: TaskItem): void;
  (e: 'toggle-status', task: TaskItem): void;
  (e: 'toggle-priority', task: TaskItem): void;
  (e: 'create-task', payload: { title: string; priority: 'low' | 'medium' | 'high' | 'urgent'; projectId?: number; epicId?: number }): void;
  (e: 'delete-task', task: TaskItem): void;
  (e: 'clear-epic'): void;
}>();

const newTaskTitle = ref('');
const newTaskPriority = ref<'medium' | 'high' | 'urgent'>('medium');
const searchQuery = ref('');

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayStr = getLocalDateString();

// Collapsible state for Epic accordions (default open for all)
const collapsedEpics = ref<Record<string | number, boolean>>({});
const toggleEpicCollapse = (id: number | 'unassigned') => {
  collapsedEpics.value[id] = !collapsedEpics.value[id];
};
const isEpicCollapsed = (id: number | 'unassigned') => {
  return Boolean(collapsedEpics.value[id]);
};

// Selected Epic object if filtered by an epic
const currentSelectedEpic = computed(() => {
  if (!props.selectedEpicId) return null;
  return props.tasks.find((t) => t.id === props.selectedEpicId && t.issue_type === 'epic') || null;
});

const listTitle = computed(() => {
  if (currentSelectedEpic.value) {
    return currentSelectedEpic.value.title.replace(/^\[.*?\]\s*/, '');
  }
  if (props.selectedProjectId) {
    const proj = props.projects.find((p) => p.id === props.selectedProjectId);
    return proj ? proj.title : 'Dự án';
  }
  switch (props.activeList) {
    case 'today': return 'Hôm nay';
    case 'important': return 'Quan trọng';
    case 'planned': return 'Có kế hoạch';
    case 'completed': return 'Đã hoàn thành';
    default: return 'Tất cả công việc';
  }
});

// Helper to find parent Epic of any task
const getEpicOfTask = (task: TaskItem) => {
  if (!task.epic_id) return null;
  const found = props.tasks.find((t) => t.id === task.epic_id && t.issue_type === 'epic');
  if (found) return found;
  if (task.epic && typeof task.epic === 'object') return task.epic;
  return null;
};

// Only actionable tasks (Epics themselves are excluded from normal list)
const filteredTasks = computed(() => {
  let list = props.tasks.filter((t) => t.issue_type !== 'epic');

  // Filter by single selected epic from sidebar
  if (props.selectedEpicId) {
    list = list.filter((t) => t.epic_id === props.selectedEpicId);
  } else if (props.selectedProjectId) {
    // Filter by project if selected
    list = list.filter((t) => t.project_id === props.selectedProjectId);
  } else {
    // Filter by smart list
    switch (props.activeList) {
      case 'today':
        list = list.filter((t) => t.due_date === todayStr || t.status === 'in_progress');
        break;
      case 'important':
        list = list.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'done');
        break;
      case 'planned':
        list = list.filter((t) => t.due_date && t.due_date !== todayStr && t.status !== 'done');
        break;
      case 'completed':
        list = list.filter((t) => t.status === 'done');
        break;
      case 'all':
      default:
        list = list.filter((t) => t.status !== 'done');
        break;
    }
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }

  return list;
});

// Grouped view is enabled for "All tasks" and "Project view" when not in single-epic filter mode
const isGroupedByEpic = computed(() => {
  if (props.selectedEpicId) return false;
  return props.activeList === 'all' || props.selectedProjectId !== null;
});

interface EpicGroup {
  id: number | 'unassigned';
  epic: TaskItem | null;
  title: string;
  issue_key?: string | null;
  tasks: TaskItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

const epicGroups = computed<EpicGroup[]>(() => {
  const allEpics = props.tasks.filter((t) => t.issue_type === 'epic');
  const tasksToGroup = filteredTasks.value;
  const groups: EpicGroup[] = [];

  // Group by known epics
  allEpics.forEach((epic) => {
    const tasksInEpic = tasksToGroup.filter((t) => t.epic_id === epic.id);
    if (tasksInEpic.length > 0) {
      const completed = tasksInEpic.filter((t) => t.status === 'done').length;
      const total = tasksInEpic.length;
      groups.push({
        id: epic.id,
        epic,
        title: epic.title.replace(/^\[.*?\]\s*/, ''),
        issue_key: epic.issue_key,
        tasks: tasksInEpic,
        completedCount: completed,
        totalCount: total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
    }
  });

  // Group unassigned tasks
  const unassigned = tasksToGroup.filter((t) => !t.epic_id);
  if (unassigned.length > 0) {
    const completed = unassigned.filter((t) => t.status === 'done').length;
    const total = unassigned.length;
    groups.push({
      id: 'unassigned',
      epic: null,
      title: 'Công việc chung (Chưa phân nhóm)',
      issue_key: null,
      tasks: unassigned,
      completedCount: completed,
      totalCount: total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  return groups;
});

const handleCreateTask = () => {
  if (!newTaskTitle.value.trim()) return;
  emit('create-task', {
    title: newTaskTitle.value.trim(),
    priority: newTaskPriority.value,
    projectId: props.selectedProjectId || undefined,
    epicId: props.selectedEpicId || undefined,
  });
  newTaskTitle.value = '';
};

const getProject = (projectId?: number | null) => {
  if (!projectId) return null;
  return props.projects.find((p) => p.id === projectId);
};

const formatDueDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  if (dateStr === todayStr) return { label: 'Hôm nay', isOverdue: false, isToday: true };
  const d = new Date(dateStr);
  const now = new Date(todayStr);
  const isOverdue = d < now;
  return {
    label: `${d.getDate()}/${d.getMonth() + 1}`,
    isOverdue,
    isToday: false,
  };
};
</script>

<template>
  <div class="simple-task-list flex-1 flex flex-col h-full bg-[#09090b] overflow-hidden select-none">
    <!-- Header: Title + Search -->
    <header class="p-4 sm:p-5 pb-3 border-b border-[#232430] flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div>
        <div class="flex items-center gap-2.5">
          <button
            v-if="selectedEpicId"
            @click="emit('clear-epic')"
            class="p-1.5 rounded-lg hover:bg-[#1c1d27] border border-[#232430] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Quay lại Tất cả việc"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
          </button>

          <!-- Current List Icon -->
          <Sun v-if="!selectedEpicId && !selectedProjectId && activeList === 'today'" class="w-5 h-5 text-amber-400 shrink-0" />
          <Star v-else-if="!selectedEpicId && !selectedProjectId && activeList === 'important'" class="w-5 h-5 text-rose-400 shrink-0" />
          <Calendar v-else-if="!selectedEpicId && !selectedProjectId && activeList === 'planned'" class="w-5 h-5 text-sky-400 shrink-0" />
          <CheckCircle2 v-else-if="!selectedEpicId && !selectedProjectId && activeList === 'completed'" class="w-5 h-5 text-emerald-400 shrink-0" />
          <FolderKanban v-else-if="selectedEpicId" class="w-5 h-5 text-purple-400 shrink-0" />
          <Folder v-else-if="selectedProjectId" class="w-5 h-5 text-indigo-400 shrink-0" />
          <ListTodo v-else class="w-5 h-5 text-indigo-400 shrink-0" />

          <h1 class="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
            <span class="truncate max-w-[420px] sm:max-w-[560px]">{{ listTitle }}</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-zinc-300 shrink-0">
              {{ filteredTasks.length }}
            </span>
          </h1>
        </div>

        <div class="flex items-center gap-3 mt-1 ml-0.5">
          <p class="text-xs text-zinc-400">
            {{ new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }) }}
          </p>
          <button
            v-if="selectedEpicId"
            @click="emit('clear-epic')"
            class="text-[11px] font-mono text-purple-400 hover:text-purple-300 underline cursor-pointer"
          >
            Quay lại xem tất cả
          </button>
        </div>
      </div>

      <!-- Quick Search Input -->
      <div class="relative w-48 sm:w-60">
        <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm việc..."
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
        />
      </div>
    </header>

    <!-- Quick Add Bar -->
    <div class="p-4 sm:p-5 py-3 border-b border-[#232430] bg-[#0c0d12]/50 shrink-0">
      <form @submit.prevent="handleCreateTask" class="flex items-center gap-2 bg-[#14151c] border border-[#232430] hover:border-[#323444] focus-within:border-indigo-500/80 rounded-2xl px-3.5 py-2 shadow-xs transition-all">
        <Plus class="w-4 h-4 text-indigo-400 shrink-0" />
        <input
          v-model="newTaskTitle"
          type="text"
          placeholder="Thêm việc cần làm... (Nhấn Enter để lưu)"
          class="flex-1 bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />

        <!-- Quick Priority Picker -->
        <select
          v-model="newTaskPriority"
          class="bg-[#18181b] border border-[#27272a] text-[11px] text-zinc-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
        >
          <option value="medium">Ưu tiên: Vừa</option>
          <option value="high">Ưu tiên: Cao</option>
          <option value="urgent">Ưu tiên: Khẩn cấp</option>
        </select>

        <button
          type="submit"
          :disabled="!newTaskTitle.trim()"
          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-all cursor-pointer shadow-xs shadow-indigo-600/20"
        >
          Thêm
        </button>
      </form>
    </div>

    <!-- Scrollable Tasks List -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
      <!-- Empty State -->
      <div v-if="filteredTasks.length === 0" class="h-64 flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-[#14151c] border border-[#232430] flex items-center justify-center text-zinc-500">
          <Check class="w-6 h-6" />
        </div>
        <div>
          <div class="font-bold text-sm text-zinc-300">Không có công việc nào</div>
          <div class="text-xs text-zinc-500 mt-1 max-w-xs">
            Bạn đã hoàn thành hết việc hoặc chưa tạo công việc trong mục này.
          </div>
        </div>
      </div>

      <!-- MODE 1: GROUPED BY EPIC (All Tasks / Project View) -->
      <template v-else-if="isGroupedByEpic">
        <div
          v-for="group in epicGroups"
          :key="group.id"
          class="rounded-2xl border border-[#232430] bg-[#101118]/80 overflow-hidden shadow-xs transition-all"
        >
          <!-- Epic Group Header / Accordion Bar -->
          <button
            type="button"
            @click="toggleEpicCollapse(group.id)"
            class="w-full flex items-center justify-between p-3 sm:p-3.5 bg-[#14151c]/90 hover:bg-[#181924] transition-colors text-left cursor-pointer border-b border-[#232430]"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
              <!-- Chevron Indicator -->
              <ChevronDown
                class="w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0"
                :class="{ '-rotate-90': isEpicCollapsed(group.id) }"
              />

              <!-- Icon & Title -->
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <FolderKanban v-if="group.id !== 'unassigned'" class="w-4 h-4 text-purple-400 shrink-0" />
                <Layers v-else class="w-4 h-4 text-zinc-400 shrink-0" />
                <span class="font-bold text-xs sm:text-sm text-zinc-100 truncate tracking-tight">
                  {{ group.title }}
                </span>
                <span
                  v-if="group.issue_key"
                  class="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0"
                >
                  {{ group.issue_key }}
                </span>
              </div>
            </div>

            <!-- Progress Info & Bar -->
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-[11px] font-mono text-zinc-400">
                <strong class="text-zinc-200">{{ group.completedCount }}</strong>/{{ group.totalCount }} xong
              </span>

              <!-- Mini Progress Track -->
              <div class="w-16 sm:w-24 h-1.5 rounded-full bg-[#1f202c] overflow-hidden shrink-0">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="group.percent === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'"
                  :style="{ width: `${group.percent}%` }"
                ></div>
              </div>
              <span class="text-[10px] font-mono font-bold w-7 text-right shrink-0" :class="group.percent === 100 ? 'text-emerald-400' : 'text-zinc-400'">
                {{ group.percent }}%
              </span>
            </div>
          </button>

          <!-- Child Tasks in this Epic -->
          <div v-show="!isEpicCollapsed(group.id)" class="p-2 sm:p-2.5 space-y-1.5">
            <div
              v-for="task in group.tasks"
              :key="task.id"
              @click="emit('select-task', task)"
              :class="[
                'group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer',
                selectedTaskId === task.id
                  ? 'bg-[#1a1b26] border-indigo-500/60 shadow-md ring-1 ring-indigo-500/20'
                  : 'bg-[#14151c]/60 hover:bg-[#181924] border-[#232430] hover:border-[#323444] shadow-xs'
              ]"
            >
              <!-- Checkbox + Title + Meta -->
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  @click.stop="emit('toggle-status', task)"
                  :class="['linear-checkbox', task.status === 'done' ? 'is-checked' : '']"
                  title="Đánh dấu hoàn thành"
                >
                  <Check v-if="task.status === 'done'" class="w-3 h-3 text-zinc-950 stroke-[3]" />
                </button>

                <div class="min-w-0 flex-1">
                  <div
                    :class="[
                      'text-xs sm:text-sm font-medium tracking-tight truncate',
                      task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-100'
                    ]"
                  >
                    {{ task.title }}
                  </div>

                  <!-- Meta Badges -->
                  <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-mono">
                    <!-- Due Date Badge -->
                    <span
                      v-if="formatDueDate(task.due_date)"
                      :class="[
                        'inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[10px]',
                        formatDueDate(task.due_date)?.isOverdue
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : formatDueDate(task.due_date)?.isToday
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#18181b] text-zinc-400 border border-[#27272a]'
                      ]"
                    >
                      <Calendar class="w-2.5 h-2.5" />
                      <span>{{ formatDueDate(task.due_date)?.label }}</span>
                    </span>

                    <!-- Priority Badge -->
                    <span
                      v-if="task.priority === 'urgent' || task.priority === 'high'"
                      :class="[
                        'inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold text-[9px] uppercase',
                        task.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      ]"
                    >
                      <Flag class="w-2.5 h-2.5" />
                      <span>{{ task.priority === 'urgent' ? 'Khẩn cấp' : 'Ưu tiên' }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: Star Priority Toggle + Delete -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click.stop="emit('toggle-priority', task)"
                  class="p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                  :class="[
                    task.priority === 'urgent' || task.priority === 'high'
                      ? 'text-amber-400'
                      : 'text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
                  ]"
                  title="Đánh dấu việc quan trọng"
                >
                  <Star class="w-3.5 h-3.5" :class="{ 'fill-amber-400': task.priority === 'urgent' || task.priority === 'high' }" />
                </button>

                <button
                  type="button"
                  @click.stop="emit('delete-task', task)"
                  class="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs cursor-pointer transition-colors"
                  title="Xóa công việc"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- MODE 2: FLAT LIST WITH PROMINENT EPIC BADGES (Today, Important, Single Epic filter) -->
      <template v-else>
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          @click="emit('select-task', task)"
          :class="[
            'group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer',
            selectedTaskId === task.id
              ? 'bg-[#1a1b26] border-indigo-500/60 shadow-md ring-1 ring-indigo-500/20'
              : 'bg-[#14151c]/80 hover:bg-[#181924] border-[#232430] hover:border-[#323444] shadow-xs'
          ]"
        >
          <!-- Left: Checkbox + Title + Meta -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <!-- Circular Checkbox -->
            <button
              type="button"
              @click.stop="emit('toggle-status', task)"
              :class="['linear-checkbox', task.status === 'done' ? 'is-checked' : '']"
              title="Đánh dấu hoàn thành"
            >
              <Check v-if="task.status === 'done'" class="w-3 h-3 text-zinc-950 stroke-[3]" />
            </button>

            <!-- Title & Badges -->
            <div class="min-w-0 flex-1">
              <div
                :class="[
                  'text-xs sm:text-sm font-medium tracking-tight truncate',
                  task.status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-100'
                ]"
              >
                {{ task.title }}
              </div>

              <!-- Meta Badges -->
              <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono">
                <!-- Epic Badge -->
                <span
                  v-if="getEpicOfTask(task)"
                  class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30"
                  :title="getEpicOfTask(task)?.title"
                >
                  <FolderKanban class="w-2.5 h-2.5 text-purple-400" />
                  <span class="truncate max-w-[140px] sm:max-w-[200px]">
                    {{ getEpicOfTask(task)?.title.replace(/^\[.*?\]\s*/, '') }}
                  </span>
                </span>

                <!-- Project Badge -->
                <span
                  v-if="getProject(task.project_id)"
                  class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[10px] bg-[#18181b] text-zinc-300 border border-[#27272a]"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: getProject(task.project_id)?.color || '#6366f1' }"></span>
                  <span class="truncate max-w-[120px]">{{ getProject(task.project_id)?.title }}</span>
                </span>

                <!-- Due Date Badge -->
                <span
                  v-if="formatDueDate(task.due_date)"
                  :class="[
                    'inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[10px]',
                    formatDueDate(task.due_date)?.isOverdue
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : formatDueDate(task.due_date)?.isToday
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-[#18181b] text-zinc-400 border border-[#27272a]'
                  ]"
                >
                  <Calendar class="w-2.5 h-2.5" />
                  <span>{{ formatDueDate(task.due_date)?.label }}</span>
                </span>

                <!-- Priority Badge -->
                <span
                  v-if="task.priority === 'urgent' || task.priority === 'high'"
                  :class="[
                    'inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold text-[9px] uppercase',
                    task.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  ]"
                >
                  <Flag class="w-2.5 h-2.5" />
                  <span>{{ task.priority === 'urgent' ? 'Khẩn cấp' : 'Ưu tiên' }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Star Priority Toggle + Delete -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              @click.stop="emit('toggle-priority', task)"
              class="p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
              :class="[
                task.priority === 'urgent' || task.priority === 'high'
                  ? 'text-amber-400'
                  : 'text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
              ]"
              title="Đánh dấu việc quan trọng"
            >
              <Star class="w-3.5 h-3.5" :class="{ 'fill-amber-400': task.priority === 'urgent' || task.priority === 'high' }" />
            </button>

            <button
              type="button"
              @click.stop="emit('delete-task', task)"
              class="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 text-xs cursor-pointer transition-colors"
              title="Xóa công việc"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
