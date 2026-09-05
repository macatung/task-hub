<script setup lang="ts">
import { computed } from 'vue';
import {
  Sun,
  Star,
  Calendar,
  ListTodo,
  CheckCircle2,
  Layers,
  Folder,
  FolderKanban,
  Settings,
  Code2,
  Check,
} from 'lucide-vue-next';
import type { ProjectItem, TaskItem, DesktopCredential } from '../../composables/useTaskSync';

export type SmartListId = 'today' | 'important' | 'planned' | 'all' | 'completed';

export interface EpicItem {
  id: number;
  title: string;
  rawTitle: string;
  issue_key?: string | null;
  count: number;
  completedCount: number;
  totalCount: number;
}

const props = defineProps<{
  activeList: SmartListId;
  selectedProjectId: number | null;
  selectedEpicId?: number | null;
  tasks: TaskItem[];
  projects: ProjectItem[];
  credential: DesktopCredential | null;
  isOnline: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-list', list: SmartListId): void;
  (e: 'select-project', projectId: number | null): void;
  (e: 'select-epic', epicId: number | null): void;
  (e: 'open-settings'): void;
  (e: 'switch-mode', mode: 'developer'): void;
}>();

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayStr = getLocalDateString();

const counts = computed(() => {
  // Exclude epics from active tasks count
  const active = props.tasks.filter((t) => t.status !== 'done' && t.issue_type !== 'epic');
  return {
    today: active.filter((t) => t.due_date === todayStr || t.status === 'in_progress').length,
    important: active.filter((t) => t.priority === 'urgent' || t.priority === 'high').length,
    planned: active.filter((t) => t.due_date && t.due_date !== todayStr).length,
    all: active.length,
    completed: props.tasks.filter((t) => t.status === 'done' && t.issue_type !== 'epic').length,
  };
});

const getProjectCount = (projectId: number) => {
  return props.tasks.filter((t) => t.project_id === projectId && t.status !== 'done' && t.issue_type !== 'epic').length;
};

const epics = computed<EpicItem[]>(() => {
  const epicTasks = props.tasks.filter((t) => t.issue_type === 'epic');
  return epicTasks.map((epic) => {
    const childTasks = props.tasks.filter((t) => t.epic_id === epic.id && t.issue_type !== 'epic');
    const openCount = childTasks.filter((t) => t.status !== 'done').length;
    const completedCount = childTasks.filter((t) => t.status === 'done').length;
    return {
      id: epic.id,
      title: epic.title.replace(/^\[.*?\]\s*/, ''),
      rawTitle: epic.title,
      issue_key: epic.issue_key,
      count: openCount,
      completedCount,
      totalCount: childTasks.length,
    };
  });
});
</script>

<template>
  <aside class="simple-sidebar w-64 md:w-72 bg-[#0c0d12] border-r border-[#232430] flex flex-col justify-between shrink-0 h-full select-none text-zinc-200">
    <!-- Top Brand & Navigation -->
    <div class="p-3.5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
      <!-- App Header -->
      <div class="flex items-center gap-2.5 px-2 pt-1">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-500/20">
          TH
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-sm text-zinc-100 tracking-tight truncate">Task Hub</div>
          <div class="text-[10px] text-zinc-400 font-mono truncate">
            {{ credential?.workspaceName || 'Không gian làm việc' }}
          </div>
        </div>
        <div
          class="w-2 h-2 rounded-full shrink-0"
          :class="isOnline ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-amber-400'"
          :title="isOnline ? 'Đã kết nối trực tuyến' : 'Ngoại tuyến (Lưu bộ nhớ tạm)'"
        ></div>
      </div>

      <!-- Smart Lists -->
      <nav class="space-y-1">
        <!-- Today -->
        <button
          @click="emit('select-list', 'today'); emit('select-project', null); emit('select-epic', null);"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
            activeList === 'today' && selectedProjectId === null && selectedEpicId === null
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25 shadow-xs'
              : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Sun class="w-4 h-4 text-amber-400 shrink-0" />
            <span class="truncate">Hôm nay</span>
          </div>
          <span v-if="counts.today" class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300">
            {{ counts.today }}
          </span>
        </button>

        <!-- Important -->
        <button
          @click="emit('select-list', 'important'); emit('select-project', null); emit('select-epic', null);"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
            activeList === 'important' && selectedProjectId === null && selectedEpicId === null
              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25 shadow-xs'
              : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Star class="w-4 h-4 text-rose-400 shrink-0" />
            <span class="truncate">Quan trọng</span>
          </div>
          <span v-if="counts.important" class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300">
            {{ counts.important }}
          </span>
        </button>

        <!-- Planned -->
        <button
          @click="emit('select-list', 'planned'); emit('select-project', null); emit('select-epic', null);"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
            activeList === 'planned' && selectedProjectId === null && selectedEpicId === null
              ? 'bg-sky-500/10 text-sky-300 border border-sky-500/25 shadow-xs'
              : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Calendar class="w-4 h-4 text-sky-400 shrink-0" />
            <span class="truncate">Có kế hoạch</span>
          </div>
          <span v-if="counts.planned" class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-sky-500/20 text-sky-300">
            {{ counts.planned }}
          </span>
        </button>

        <!-- All Tasks -->
        <button
          @click="emit('select-list', 'all'); emit('select-project', null); emit('select-epic', null);"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
            activeList === 'all' && selectedProjectId === null && selectedEpicId === null
              ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 shadow-xs'
              : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <ListTodo class="w-4 h-4 text-indigo-400 shrink-0" />
            <span class="truncate">Tất cả việc</span>
          </div>
          <span v-if="counts.all" class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#18181b] text-zinc-300 border border-[#27272a]">
            {{ counts.all }}
          </span>
        </button>

        <!-- Completed -->
        <button
          @click="emit('select-list', 'completed'); emit('select-project', null); emit('select-epic', null);"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
            activeList === 'completed' && selectedProjectId === null && selectedEpicId === null
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1d27] border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
            <span class="truncate">Đã xong</span>
          </div>
          <span v-if="counts.completed" class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#18181b] text-zinc-400 border border-[#27272a]">
            {{ counts.completed }}
          </span>
        </button>
      </nav>

      <!-- Projects Group -->
      <div v-if="projects.length" class="space-y-1.5 pt-2 border-t border-[#232430]">
        <div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
          <Folder class="w-3 h-3 text-zinc-400" />
          <span>Dự án ({{ projects.length }})</span>
        </div>
        <div class="space-y-0.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          <button
            v-for="p in projects"
            :key="p.id"
            @click="emit('select-project', p.id); emit('select-epic', null);"
            :class="[
              'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left',
              selectedProjectId === p.id && selectedEpicId === null
                ? 'bg-indigo-500/10 text-indigo-200 font-bold border border-indigo-500/20'
                : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
            ]"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: p.color || '#6366f1' }"></span>
              <span class="truncate">{{ p.title }}</span>
            </div>
            <span v-if="getProjectCount(p.id)" class="text-[10px] font-mono text-zinc-400">
              {{ getProjectCount(p.id) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Epics Group -->
      <div v-if="epics.length" class="space-y-1.5 pt-2 border-t border-[#232430]">
        <div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono flex items-center gap-1.5">
          <Layers class="w-3 h-3 text-purple-400" />
          <span>Lộ trình & Epics ({{ epics.length }})</span>
        </div>
        <div class="space-y-0.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          <button
            v-for="e in epics"
            :key="e.id"
            @click="emit('select-epic', e.id)"
            :class="[
              'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left',
              selectedEpicId === e.id
                ? 'bg-purple-500/20 text-purple-200 font-bold border border-purple-500/40 shadow-xs'
                : 'text-zinc-300 hover:text-white hover:bg-[#1c1d27] border border-transparent'
            ]"
            :title="e.rawTitle"
          >
            <div class="flex items-center gap-2 min-w-0">
              <FolderKanban class="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span class="truncate">{{ e.title }}</span>
            </div>
            <span v-if="e.count" class="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              {{ e.count }}
            </span>
            <span v-else-if="e.totalCount > 0" class="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
              <Check class="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom User Bar & Mode Switcher -->
    <div class="p-3 border-t border-[#232430] space-y-2 bg-[#090a0f]">
      <!-- Developer Mode Switcher Pill -->
      <button
        @click="emit('switch-mode', 'developer')"
        class="w-full px-2.5 py-1.5 rounded-xl border border-[#232430] hover:border-[#323444] bg-[#14151c] hover:bg-[#1c1d27] text-zinc-400 hover:text-indigo-300 text-[11px] font-mono flex items-center justify-between transition-colors cursor-pointer"
        title="Chuyển sang Bảng điều khiển Kỹ thuật / Developer Mode"
      >
        <div class="flex items-center gap-1.5">
          <Code2 class="w-3.5 h-3.5 text-indigo-400" />
          <span>Chế độ: Đơn giản</span>
        </div>
        <span class="text-[10px] text-zinc-500 hover:text-indigo-400 underline">Đổi sang Dev →</span>
      </button>

      <!-- User Info & Settings Button -->
      <div class="flex items-center justify-between gap-2 px-1">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
            {{ credential?.userName?.charAt(0) || 'U' }}
          </div>
          <span class="text-xs font-semibold text-zinc-300 truncate">
            {{ credential?.userName || 'Người dùng' }}
          </span>
        </div>

        <button
          @click="emit('open-settings')"
          class="p-1.5 rounded-lg border border-[#232430] hover:border-[#323444] bg-[#14151c] text-zinc-400 hover:text-white cursor-pointer transition-colors"
          title="Cài đặt ứng dụng"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </aside>
</template>
