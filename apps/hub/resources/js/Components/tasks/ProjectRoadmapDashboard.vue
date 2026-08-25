<script setup lang="ts">
import { computed } from 'vue';

type Status = 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'urgent' | 'high' | 'medium' | 'low';

interface RoadmapTask {
  id: number;
  status: Status;
  priority: Priority;
  story_points: number | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
}

const props = defineProps<{
  projectName: string;
  tasks: RoadmapTask[];
  isDarkMode?: boolean;
}>();

const statuses: Array<{ key: Status; label: string; color: string }> = [
  { key: 'todo', label: 'To do', color: '#64748b' },
  { key: 'in_progress', label: 'In progress', color: '#2563eb' },
  { key: 'review', label: 'Review', color: '#d97706' },
  { key: 'done', label: 'Done', color: '#059669' },
];
const priorities: Array<{ key: Priority; label: string; color: string }> = [
  { key: 'urgent', label: 'Urgent', color: '#dc2626' },
  { key: 'high', label: 'High', color: '#ea580c' },
  { key: 'medium', label: 'Medium', color: '#2563eb' },
  { key: 'low', label: 'Low', color: '#64748b' },
];

const today = new Date().toISOString().slice(0, 10);
const totalPoints = computed(() => props.tasks.reduce((sum, task) => sum + (task.story_points || 0), 0));
const completedTasks = computed(() => props.tasks.filter(task => task.status === 'done').length);
const completedPoints = computed(() => props.tasks.filter(task => task.status === 'done').reduce((sum, task) => sum + (task.story_points || 0), 0));
const progress = computed(() => props.tasks.length ? Math.round((completedTasks.value / props.tasks.length) * 100) : 0);
const overdueTasks = computed(() => props.tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date < today).length);
const unscheduledTasks = computed(() => props.tasks.filter(task => !task.start_date || !task.due_date).length);

const statusData = computed(() => statuses.map(item => ({ ...item, count: props.tasks.filter(task => task.status === item.key).length })));
const priorityData = computed(() => priorities.map(item => ({
  ...item,
  count: props.tasks.filter(task => task.priority === item.key).length,
  points: props.tasks.filter(task => task.priority === item.key).reduce((sum, task) => sum + (task.story_points || 0), 0),
})));
const maxPriorityValue = computed(() => Math.max(1, ...priorityData.value.map(item => Math.max(item.count, item.points))));

const startOfUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const dateLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
const deliveryTrend = computed(() => {
  const end = startOfUtcDay(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - 6 + index);
    const key = dayKey(date);
    return {
      key,
      label: dateLabel(date),
      completed: props.tasks.filter(task => task.completed_at?.slice(0, 10) === key).reduce((sum, task) => sum + (task.story_points || 1), 0),
      planned: props.tasks.filter(task => task.due_date === key).reduce((sum, task) => sum + (task.story_points || 1), 0),
    };
  });
  const max = Math.max(1, ...days.flatMap(day => [day.completed, day.planned]));
  return { days, max };
});

const segmentStyle = (count: number) => ({ width: `${props.tasks.length ? (count / props.tasks.length) * 100 : 0}%` });
</script>

<template>
  <section class="space-y-4" aria-label="Project delivery dashboard">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Project dashboard</p>
        <h3 :class="['mt-0.5 text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">{{ projectName }}</h3>
      </div>
      <p :class="['text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Live totals from the current project</p>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="metric in [
        { label: 'Work items', value: tasks.length, detail: 'Tasks excluding epics' },
        { label: 'Completion', value: `${progress}%`, detail: `${completedTasks} completed` },
        { label: 'At risk', value: overdueTasks, detail: overdueTasks ? 'Past due and open' : 'Nothing overdue' },
        { label: 'Story points', value: totalPoints, detail: `${completedPoints} completed` },
      ]" :key="metric.label" :class="['rounded-xl border p-3', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white']">
        <p :class="['text-[10px] font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ metric.label }}</p>
        <p :class="['mt-1 text-xl font-bold tabular-nums', metric.label === 'At risk' && overdueTasks ? 'text-rose-600 dark:text-rose-400' : (isDarkMode ? 'text-white' : 'text-slate-950')]">{{ metric.value }}</p>
        <p :class="['mt-1 text-[11px]', isDarkMode ? 'text-slate-500' : 'text-slate-500']">{{ metric.detail }}</p>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <article :class="['rounded-2xl border p-4', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white']">
        <div class="flex items-start justify-between gap-3">
          <div><h4 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Status distribution</h4><p :class="['mt-0.5 text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">How work is moving through delivery</p></div>
          <span :class="['text-xs font-semibold', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ tasks.length }} items</span>
        </div>
        <div class="mt-5 flex items-center gap-5">
          <div class="relative h-28 w-28 shrink-0 rounded-full" :style="{ background: tasks.length ? `conic-gradient(${statusData.map((item, index) => `${item.color} ${statusData.slice(0, index).reduce((sum, part) => sum + part.count, 0) / tasks.length * 100}% ${(statusData.slice(0, index + 1).reduce((sum, part) => sum + part.count, 0) / tasks.length) * 100}%`).join(', ')})` : (isDarkMode ? '#1e293b' : '#e2e8f0') }" role="img" :aria-label="`Status distribution for ${tasks.length} tasks`">
            <div :class="['absolute inset-4 flex flex-col items-center justify-center rounded-full', isDarkMode ? 'bg-slate-950' : 'bg-white']"><strong :class="['text-lg', isDarkMode ? 'text-white' : 'text-slate-950']">{{ progress }}%</strong><span :class="['text-[9px] uppercase tracking-wider', isDarkMode ? 'text-slate-500' : 'text-slate-500']">done</span></div>
          </div>
          <ul class="min-w-0 flex-1 space-y-2">
            <li v-for="item in statusData" :key="item.key" class="flex items-center justify-between gap-3 text-xs"><span class="flex items-center gap-2"><i class="h-2 w-2 rounded-full" :style="{ backgroundColor: item.color }"></i><span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">{{ item.label }}</span></span><strong :class="isDarkMode ? 'text-white' : 'text-slate-950'">{{ item.count }}</strong></li>
          </ul>
        </div>
      </article>

      <article :class="['rounded-2xl border p-4', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white']">
        <div><h4 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Priority load</h4><p :class="['mt-0.5 text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Items and story points requiring attention</p></div>
        <div class="mt-5 space-y-3">
          <div v-for="item in priorityData" :key="item.key">
            <div class="mb-1 flex justify-between text-[11px]"><span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">{{ item.label }}</span><span :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">{{ item.count }} items · {{ item.points }} pts</span></div>
            <div :class="['h-2 overflow-hidden rounded-full', isDarkMode ? 'bg-slate-800' : 'bg-slate-100']"><div class="h-full rounded-full" :style="{ width: `${(Math.max(item.count, item.points) / maxPriorityValue) * 100}%`, backgroundColor: item.color }"></div></div>
          </div>
        </div>
      </article>
    </div>

    <article :class="['rounded-2xl border p-4', isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white']">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h4 :class="['text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-950']">Delivery trend</h4><p :class="['mt-0.5 text-xs', isDarkMode ? 'text-slate-400' : 'text-slate-500']">Completed and planned points over the last seven days</p></div><div class="flex gap-3 text-[11px]"><span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-emerald-500"></i>Completed</span><span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-blue-400"></i>Planned</span></div></div>
      <div class="mt-5 grid h-36 grid-cols-7 items-end gap-2" role="img" aria-label="Delivery trend chart">
        <div v-for="day in deliveryTrend.days" :key="day.key" class="flex h-full min-w-0 flex-col items-center justify-end gap-1">
          <div class="flex h-28 w-full items-end justify-center gap-1"><span class="w-2 max-w-[45%] rounded-t bg-emerald-500" :style="{ height: `${(day.completed / deliveryTrend.max) * 100}%` }" :title="`${day.completed} completed points`"></span><span class="w-2 max-w-[45%] rounded-t bg-blue-400" :style="{ height: `${(day.planned / deliveryTrend.max) * 100}%` }" :title="`${day.planned} planned points`"></span></div><span :class="['truncate text-[9px]', isDarkMode ? 'text-slate-500' : 'text-slate-500']">{{ day.label }}</span>
        </div>
      </div>
      <p :class="['mt-3 text-[11px]', isDarkMode ? 'text-slate-500' : 'text-slate-500']">{{ unscheduledTasks ? `${unscheduledTasks} task${unscheduledTasks === 1 ? '' : 's'} missing a start or due date are excluded from the scheduled view.` : 'All project tasks have a delivery schedule.' }}</p>
    </article>
  </section>
</template>
