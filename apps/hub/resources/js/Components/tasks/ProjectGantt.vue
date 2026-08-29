<script setup lang="ts">
import { computed, ref } from 'vue';
import Icons from '@/Components/ui/Icons.vue';

type Status = 'todo' | 'in_progress' | 'review' | 'done';
interface GanttTask { id: number; issue_key?: string; title: string; epic_id: number | null; status: Status; story_points: number | null; start_date: string | null; due_date: string | null; }
type GanttEpic = GanttTask;

const props = defineProps<{ epics: GanttEpic[]; tasks: GanttTask[]; isDarkMode?: boolean }>();
const emit = defineEmits<{ openTask: [task: any] }>();
const expandedEpicIds = ref<number[]>([]);
const dateFromString = (value: string) => new Date(`${value}T00:00:00Z`);
const dayDiff = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000);
const datedItems = computed(() => [...props.epics, ...props.tasks].filter(item => item.start_date && item.due_date));
const timeline = computed(() => {
  if (!datedItems.value.length) return null;
  const starts = datedItems.value.map(item => dateFromString(item.start_date!));
  const ends = datedItems.value.map(item => dateFromString(item.due_date!));
  const start = new Date(Math.min(...starts.map(date => date.getTime())));
  const end = new Date(Math.max(...ends.map(date => date.getTime())));
  const totalDays = Math.max(1, dayDiff(start, end) + 1);
  const labels = Array.from({ length: Math.min(6, totalDays + 1) }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + Math.round((totalDays - 1) * index / Math.max(1, Math.min(5, totalDays))));
    return { key: date.toISOString(), label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date) };
  });
  return { start, totalDays, labels };
});
const childrenFor = (epicId: number) => props.tasks.filter(task => task.epic_id === epicId);
const isExpanded = (epicId: number) => expandedEpicIds.value.includes(epicId);
const toggleExpanded = (epicId: number) => { expandedEpicIds.value = isExpanded(epicId) ? expandedEpicIds.value.filter(id => id !== epicId) : [...expandedEpicIds.value, epicId]; };
const styleFor = (item: GanttTask) => {
  if (!timeline.value || !item.start_date || !item.due_date) return { display: 'none' };
  const start = dateFromString(item.start_date); const end = dateFromString(item.due_date);
  const left = Math.max(0, dayDiff(timeline.value.start, start) / timeline.value.totalDays * 100);
  const width = Math.max(2, (dayDiff(start, end) + 1) / timeline.value.totalDays * 100);
  return { left: `${left}%`, width: `${Math.min(100 - left, width)}%` };
};
const toneFor = (status: Status) => ({
  todo: 'bg-slate-600 text-slate-200',
  in_progress: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_8px_rgba(0,245,212,0.3)]',
  review: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-[0_0_8px_rgba(157,78,221,0.3)]',
  done: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 font-extrabold shadow-[0_0_8px_rgba(0,245,160,0.3)]',
}[status]);
const unscheduledItems = computed(() => [...props.epics, ...props.tasks].filter(item => !item.start_date || !item.due_date));
</script>

<template>
  <section :class="['rounded-2xl border p-4 shadow-xs', isDarkMode ? 'border-midnight-800/80 bg-midnight-900/90' : 'border-slate-200 bg-white']" aria-label="Project Gantt timeline">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 :class="['text-sm font-bold font-display', isDarkMode ? 'text-white' : 'text-slate-950']">Timeline & Milestones</h3>
        <p :class="['mt-0.5 text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Epic milestones and scheduled execution paths</p>
      </div>
      <div class="flex flex-wrap gap-2 text-[10px] font-mono">
        <span v-for="item in [{ label: 'To do', tone: 'bg-slate-600' }, { label: 'In progress', tone: 'bg-cyan-500' }, { label: 'Review', tone: 'bg-purple-500' }, { label: 'Done', tone: 'bg-phantom-mint' }]" :key="item.label" class="flex items-center gap-1">
          <i :class="['h-2 w-2 rounded-sm shrink-0', item.tone]"></i>
          <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">{{ item.label }}</span>
        </span>
      </div>
    </div>
    <div v-if="timeline" class="mt-5 overflow-x-auto pb-2">
      <div class="min-w-[720px]">
        <div class="grid grid-cols-[230px_1fr] border-b pb-2" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
          <span :class="['text-[10px] font-bold uppercase tracking-wider font-mono', isDarkMode ? 'text-slate-500' : 'text-slate-500']">Work item</span>
          <div class="relative h-4 font-mono">
            <span v-for="(label, index) in timeline.labels" :key="label.key" class="absolute -translate-x-1/2 text-[10px] whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'" :style="{ left: `${index / Math.max(1, timeline.labels.length - 1) * 100}%` }">{{ label.label }}</span>
          </div>
        </div>
        <template v-for="epic in epics" :key="epic.id">
          <div class="grid grid-cols-[230px_1fr] items-center gap-3 border-b py-2" :class="isDarkMode ? 'border-midnight-800/60' : 'border-slate-100'">
            <div class="flex min-w-0 items-center gap-1.5">
              <button @click="toggleExpanded(epic.id)" class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors" :class="isDarkMode ? 'border-midnight-800 bg-midnight-850 text-slate-300 hover:text-white' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'" :aria-label="`${isExpanded(epic.id) ? 'Collapse' : 'Expand'} ${epic.title}`">
                <Icons :name="isExpanded(epic.id) ? 'ChevronDown' : 'ChevronRight'" :size="12" />
              </button>
              <button @click="emit('openTask', epic)" class="truncate text-left text-xs font-bold font-mono transition-colors" :class="isDarkMode ? 'text-slate-100 hover:text-phantom-mint' : 'text-slate-900 hover:text-emerald-700'" :title="epic.title">
                {{ epic.issue_key }} · {{ epic.title }}
              </button>
            </div>
            <div class="relative h-7 rounded" :class="isDarkMode ? 'bg-midnight-950/80 border border-midnight-800/40' : 'bg-slate-50'">
              <button @click="emit('openTask', epic)" :class="['absolute top-1 h-5 min-w-[6px] rounded px-1.5 text-left text-[9px] font-bold font-mono shadow-sm transition-all', toneFor(epic.status)]" :style="styleFor(epic)" :title="`${epic.title}: ${epic.start_date} to ${epic.due_date}`">
                <span class="block truncate leading-none pt-0.5">{{ epic.story_points || 0 }} pts</span>
              </button>
            </div>
          </div>
          <div v-for="task in isExpanded(epic.id) ? childrenFor(epic.id) : []" :key="task.id" class="grid grid-cols-[230px_1fr] items-center gap-3 border-b py-2" :class="isDarkMode ? 'border-midnight-800/40' : 'border-slate-100'">
            <button @click="emit('openTask', task)" class="truncate pl-7 text-left text-xs font-mono transition-colors" :class="isDarkMode ? 'text-slate-300 hover:text-cyan-300' : 'text-slate-700 hover:text-blue-600'" :title="task.title">
              {{ task.issue_key }} · {{ task.title }}
            </button>
            <div class="relative h-6 rounded" :class="isDarkMode ? 'bg-midnight-950/50' : 'bg-slate-50'">
              <button v-if="task.start_date && task.due_date" @click="emit('openTask', task)" :class="['absolute top-1 h-4 min-w-[5px] rounded font-mono', toneFor(task.status)]" :style="styleFor(task)" :title="`${task.title}: ${task.start_date} to ${task.due_date}`"></button>
              <span v-else :class="['pl-2 text-[10px] font-mono', isDarkMode ? 'text-slate-500' : 'text-slate-400']">Unscheduled</span>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div v-else :class="['mt-5 rounded-xl border border-dashed p-6 text-center text-xs', isDarkMode ? 'border-midnight-800 text-slate-400 bg-midnight-950/30' : 'border-slate-200 text-slate-500']">Add both a start date and due date to an Epic or task to create the project timeline.</div>
    <div v-if="unscheduledItems.length" :class="['mt-4 rounded-xl border p-3', isDarkMode ? 'border-midnight-800/80 bg-midnight-950/60' : 'border-slate-200 bg-slate-50']">
      <p :class="['text-[10px] font-bold uppercase tracking-wider font-mono', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Unscheduled ({{ unscheduledItems.length }})</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button v-for="item in unscheduledItems" :key="item.id" @click="emit('openTask', item)" :class="['max-w-full truncate rounded-lg border px-2 py-1 text-[11px] font-mono transition-colors', isDarkMode ? 'border-midnight-800 bg-midnight-850 text-slate-300 hover:border-phantom-mint/60 hover:text-white' : 'border-slate-200 text-slate-700 hover:border-emerald-500']" :title="item.title">
          {{ item.issue_key }} · {{ item.title }}
        </button>
      </div>
    </div>
  </section>
</template>
