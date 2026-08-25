<script setup lang="ts">
import { computed, ref } from 'vue';

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
const toneFor = (status: Status) => ({ todo: 'bg-slate-500', in_progress: 'bg-blue-600', review: 'bg-amber-500', done: 'bg-emerald-600' }[status]);
const unscheduledItems = computed(() => [...props.epics, ...props.tasks].filter(item => !item.start_date || !item.due_date));
</script>

<template>
  <section :class="['rounded-2xl border p-4', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white']" aria-label="Project Gantt timeline">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h3 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Timeline</h3><p :class="['mt-0.5 text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Epic milestones and their scheduled work</p></div><div class="flex flex-wrap gap-2 text-[10px]"><span v-for="item in [{ label: 'To do', tone: 'bg-slate-500' }, { label: 'In progress', tone: 'bg-blue-600' }, { label: 'Review', tone: 'bg-amber-500' }, { label: 'Done', tone: 'bg-emerald-600' }]" :key="item.label" class="flex items-center gap-1"><i :class="['h-2 w-2 rounded-sm', item.tone]"></i>{{ item.label }}</span></div></div>
    <div v-if="timeline" class="mt-5 overflow-x-auto pb-2"><div class="min-w-[720px]"><div class="grid grid-cols-[230px_1fr] border-b pb-2" :class="isDarkMode ? 'border-slate-800' : 'border-slate-200'"><span :class="['text-[10px] font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-500' : 'text-slate-500']">Work item</span><div class="relative h-4"><span v-for="(label, index) in timeline.labels" :key="label.key" class="absolute -translate-x-1/2 text-[10px] whitespace-nowrap" :class="isDarkMode ? 'text-slate-500' : 'text-slate-500'" :style="{ left: `${index / Math.max(1, timeline.labels.length - 1) * 100}%` }">{{ label.label }}</span></div></div>
      <template v-for="epic in epics" :key="epic.id"><div class="grid grid-cols-[230px_1fr] items-center gap-3 border-b py-2" :class="isDarkMode ? 'border-slate-900' : 'border-slate-100'"><div class="flex min-w-0 items-center gap-1.5"><button @click="toggleExpanded(epic.id)" class="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800" :aria-label="`${isExpanded(epic.id) ? 'Collapse' : 'Expand'} ${epic.title}`">{{ isExpanded(epic.id) ? '⌄' : '›' }}</button><button @click="emit('openTask', epic)" class="truncate text-left text-xs font-bold hover:text-blue-600 dark:hover:text-blue-300" :class="isDarkMode ? 'text-slate-100' : 'text-slate-900'" :title="epic.title">{{ epic.issue_key }} · {{ epic.title }}</button></div><div class="relative h-7 rounded" :class="isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'"><button @click="emit('openTask', epic)" :class="['absolute top-1 h-5 min-w-[6px] rounded px-1 text-left text-[9px] font-bold text-white shadow-sm', toneFor(epic.status)]" :style="styleFor(epic)" :title="`${epic.title}: ${epic.start_date} to ${epic.due_date}`"><span class="block truncate">{{ epic.story_points || 0 }} pts</span></button></div></div>
        <div v-for="task in isExpanded(epic.id) ? childrenFor(epic.id) : []" :key="task.id" class="grid grid-cols-[230px_1fr] items-center gap-3 border-b py-2" :class="isDarkMode ? 'border-slate-900' : 'border-slate-100'"><button @click="emit('openTask', task)" class="truncate pl-7 text-left text-xs hover:text-blue-600 dark:hover:text-blue-300" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'" :title="task.title">{{ task.issue_key }} · {{ task.title }}</button><div class="relative h-6 rounded" :class="isDarkMode ? 'bg-slate-900/40' : 'bg-slate-50'"><button v-if="task.start_date && task.due_date" @click="emit('openTask', task)" :class="['absolute top-1 h-4 min-w-[5px] rounded', toneFor(task.status)]" :style="styleFor(task)" :title="`${task.title}: ${task.start_date} to ${task.due_date}`"></button><span v-else :class="['pl-2 text-[10px]', isDarkMode ? 'text-slate-500' : 'text-slate-400']">Unscheduled</span></div></div></template></div></div>
    <div v-else :class="['mt-5 rounded-xl border border-dashed p-6 text-center text-xs', isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500']">Add both a start date and due date to an Epic or task to create the project timeline.</div>
    <div v-if="unscheduledItems.length" :class="['mt-4 rounded-xl border p-3', isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50']"><p :class="['text-[10px] font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Unscheduled ({{ unscheduledItems.length }})</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="item in unscheduledItems" :key="item.id" @click="emit('openTask', item)" :class="['max-w-full truncate rounded-lg border px-2 py-1 text-[11px] hover:border-blue-400 hover:text-blue-600', isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700']" :title="item.title">{{ item.issue_key }} · {{ item.title }}</button></div></div>
  </section>
</template>
