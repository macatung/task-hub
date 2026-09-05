<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  X,
  Trash2,
  Sparkles,
  Wand2,
  FileText,
  Mail,
  Calendar,
  Flag,
  Folder,
  FolderKanban,
  Plus,
  Check,
} from 'lucide-vue-next';
import type { TaskItem, ProjectItem } from '../../composables/useTaskSync';

const props = defineProps<{
  task: TaskItem;
  projects: ProjectItem[];
  epics?: TaskItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update-task', updated: Partial<TaskItem>): void;
  (e: 'open-ai', action: 'breakdown' | 'summary' | 'draft', task: TaskItem): void;
  (e: 'delete-task', task: TaskItem): void;
}>();

// Local editable state
const title = ref(props.task.title);
const description = ref(props.task.description || '');
const priority = ref(props.task.priority);
const dueDate = ref(props.task.due_date || '');
const projectId = ref(props.task.project_id || null);
const epicId = ref<number | null>(props.task.epic_id || null);

// Subtasks parsed from description or notes if formatted as markdown checklist,
// or stored locally
export interface SubtaskItem {
  id: string;
  text: string;
  done: boolean;
}

const subtasks = ref<SubtaskItem[]>([]);
const newSubtaskText = ref('');

// Parse subtasks from markdown checklist in description (e.g. - [x] or - [ ])
const parseSubtasks = (desc: string | null) => {
  if (!desc) return [];
  const lines = desc.split('\n');
  const items: SubtaskItem[] = [];
  lines.forEach((line, idx) => {
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        id: `step-${idx}`,
        done: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
      });
    }
  });
  return items;
};

// Serialize subtasks back to markdown checklist
const syncSubtasksToDescription = () => {
  const currentNotes = description.value
    .split('\n')
    .filter((line) => !line.match(/^[-*]\s+\[([ xX])\]/))
    .join('\n')
    .trim();

  const checklistMarkdown = subtasks.value
    .map((s) => `- [${s.done ? 'x' : ' '}] ${s.text}`)
    .join('\n');

  const fullDesc = currentNotes
    ? `${currentNotes}\n\n### Các bước thực hiện:\n${checklistMarkdown}`
    : checklistMarkdown;

  description.value = fullDesc;
  emit('update-task', { description: fullDesc });
};

watch(() => props.task, (next) => {
  title.value = next.title;
  description.value = next.description || '';
  priority.value = next.priority;
  dueDate.value = next.due_date || '';
  projectId.value = next.project_id || null;
  epicId.value = next.epic_id || null;
  subtasks.value = parseSubtasks(next.description);
}, { immediate: true });

const saveField = (field: keyof TaskItem, val: any) => {
  emit('update-task', { [field]: val });
};

const addSubtask = () => {
  if (!newSubtaskText.value.trim()) return;
  subtasks.value.push({
    id: `step-${Date.now()}`,
    text: newSubtaskText.value.trim(),
    done: false,
  });
  newSubtaskText.value = '';
  syncSubtasksToDescription();
};

const toggleSubtask = (idx: number) => {
  subtasks.value[idx].done = !subtasks.value[idx].done;
  syncSubtasksToDescription();
};

const removeSubtask = (idx: number) => {
  subtasks.value.splice(idx, 1);
  syncSubtasksToDescription();
};

const setQuickDate = (type: 'today' | 'tomorrow' | 'next_week') => {
  const d = new Date();
  if (type === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (type === 'next_week') d.setDate(d.getDate() + 7);
  const formatted = d.toISOString().split('T')[0];
  dueDate.value = formatted;
  saveField('due_date', formatted);
};
</script>

<template>
  <aside class="simple-task-detail w-80 md:w-96 bg-[#0c0d12] border-l border-[#232430] flex flex-col justify-between shrink-0 h-full select-none text-zinc-200 shadow-2xl">
    <!-- Header: Close + Delete -->
    <div class="p-3.5 border-b border-[#232430] flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2 text-xs font-bold text-zinc-400">
        <span>Chi tiết công việc</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          @click="emit('delete-task', task)"
          class="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
          title="Xóa công việc này"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          @click="emit('close')"
          class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1c1d27] transition-colors cursor-pointer"
          title="Đóng chi tiết"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
      <!-- 1-Click AI Assistant Action Bar -->
      <div class="p-3 rounded-2xl bg-[#14151c] border border-indigo-500/25 space-y-2">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400">
          <Sparkles class="w-3.5 h-3.5" />
          <span>Trợ lý AI 1-Click</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            @click="emit('open-ai', 'breakdown', task)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <Wand2 class="w-3 h-3 text-indigo-300" />
            <span>Chia nhỏ checklist</span>
          </button>
          <button
            @click="emit('open-ai', 'summary', task)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <FileText class="w-3 h-3 text-sky-300" />
            <span>Tóm tắt việc</span>
          </button>
          <button
            @click="emit('open-ai', 'draft', task)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <Mail class="w-3 h-3 text-purple-300" />
            <span>Soạn thảo báo cáo</span>
          </button>
        </div>
      </div>

      <!-- Task Title (Editable) -->
      <div class="space-y-1">
        <label class="text-[10px] font-mono uppercase font-bold text-zinc-400">Tên công việc</label>
        <textarea
          v-model="title"
          @blur="saveField('title', title)"
          rows="2"
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl p-2.5 text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none transition-colors"
        ></textarea>
      </div>

      <!-- Subtasks / Checklist -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-[10px] font-mono uppercase font-bold text-zinc-400">
            Các bước thực hiện ({{ subtasks.filter(s => s.done).length }}/{{ subtasks.length }})
          </label>
        </div>

        <!-- Subtasks List -->
        <div v-if="subtasks.length" class="space-y-1.5">
          <div
            v-for="(subtask, idx) in subtasks"
            :key="subtask.id"
            class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#14151c] border border-[#232430] text-xs"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                @click="toggleSubtask(idx)"
                :class="['linear-checkbox', subtask.done ? 'is-checked' : '']"
              >
                <Check v-if="subtask.done" class="w-2.5 h-2.5 text-zinc-950 stroke-[3]" />
              </button>
              <span :class="['truncate', subtask.done ? 'line-through text-zinc-500' : 'text-zinc-200']">
                {{ subtask.text }}
              </span>
            </div>
            <button
              type="button"
              @click="removeSubtask(idx)"
              class="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Add Step Input -->
        <form @submit.prevent="addSubtask" class="flex items-center gap-2">
          <input
            v-model="newSubtaskText"
            type="text"
            placeholder="+ Thêm bước thực hiện..."
            class="flex-1 bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            :disabled="!newSubtaskText.trim()"
            class="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs text-zinc-200 font-bold rounded-xl disabled:opacity-40 cursor-pointer"
          >
            Thêm
          </button>
        </form>
      </div>

      <!-- Due Date Selector -->
      <div class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
          <Calendar class="w-3 h-3 text-zinc-400" />
          <span>Hạn chót</span>
        </label>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            @click="setQuickDate('today')"
            class="px-2.5 py-1 rounded-lg bg-[#14151c] hover:bg-[#1c1d27] border border-[#232430] text-[11px] font-medium text-zinc-300 cursor-pointer"
          >
            Hôm nay
          </button>
          <button
            type="button"
            @click="setQuickDate('tomorrow')"
            class="px-2.5 py-1 rounded-lg bg-[#14151c] hover:bg-[#1c1d27] border border-[#232430] text-[11px] font-medium text-zinc-300 cursor-pointer"
          >
            Ngày mai
          </button>
          <button
            type="button"
            @click="setQuickDate('next_week')"
            class="px-2.5 py-1 rounded-lg bg-[#14151c] hover:bg-[#1c1d27] border border-[#232430] text-[11px] font-medium text-zinc-300 cursor-pointer"
          >
            Tuần sau
          </button>
        </div>
        <input
          v-model="dueDate"
          @change="saveField('due_date', dueDate)"
          type="date"
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl p-2 text-xs text-zinc-200 focus:outline-none cursor-pointer mt-1"
        />
      </div>

      <!-- Priority Selector -->
      <div class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
          <Flag class="w-3 h-3 text-zinc-400" />
          <span>Mức độ ưu tiên</span>
        </label>
        <select
          v-model="priority"
          @change="saveField('priority', priority)"
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl p-2 text-xs text-zinc-200 focus:outline-none cursor-pointer"
        >
          <option value="low">Thấp</option>
          <option value="medium">Bình thường</option>
          <option value="high">Ưu tiên cao</option>
          <option value="urgent">Khẩn cấp</option>
        </select>
      </div>

      <!-- Project Selector -->
      <div v-if="projects.length" class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
          <Folder class="w-3 h-3 text-indigo-400" />
          <span>Dự án</span>
        </label>
        <select
          v-model="projectId"
          @change="saveField('project_id', projectId)"
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl p-2 text-xs text-zinc-200 focus:outline-none cursor-pointer"
        >
          <option :value="null">Không thuộc dự án</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">
            {{ p.title }}
          </option>
        </select>
      </div>

      <!-- Epic Selector -->
      <div v-if="epics && epics.length" class="space-y-1.5">
        <label class="text-[10px] font-mono uppercase font-bold text-purple-400 flex items-center gap-1.5">
          <FolderKanban class="w-3 h-3 text-purple-400" />
          <span>Thuộc Epic</span>
        </label>
        <select
          v-model="epicId"
          @change="saveField('epic_id', epicId)"
          class="w-full bg-[#14151c] border border-purple-500/30 focus:border-purple-400 rounded-xl p-2 text-xs text-purple-200 focus:outline-none cursor-pointer"
        >
          <option :value="null">Không thuộc Epic nào</option>
          <option v-for="e in epics" :key="e.id" :value="e.id">
            {{ e.title.replace(/^\[.*?\]\s*/, '') }}
          </option>
        </select>
      </div>

      <!-- Notes / Description -->
      <div class="space-y-1">
        <label class="text-[10px] font-mono uppercase font-bold text-zinc-400">Ghi chú chi tiết</label>
        <textarea
          v-model="description"
          @blur="saveField('description', description)"
          rows="4"
          placeholder="Thêm ghi chú, tài liệu hoặc thông tin cần nhớ..."
          class="w-full bg-[#14151c] border border-[#232430] focus:border-indigo-500 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none transition-colors"
        ></textarea>
      </div>
    </div>
  </aside>
</template>
