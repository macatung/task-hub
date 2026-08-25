<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ProjectItem, TaskItem } from '../../composables/useTaskSync';
const props = defineProps<{ tasks: TaskItem[]; projects: ProjectItem[]; selectedId: number | null; loading: boolean }>();
const emit = defineEmits<{ select: [task: TaskItem]; requirement: []; openHub: [] }>();
const project = ref('all'); const status = ref('all'); const priority = ref('all');
const dependencyState = (task: TaskItem) => {
  const dependencies = task.dependencies || [];
  const targetFor = (dependency: NonNullable<TaskItem['dependencies']>[number]) => dependency.depends_on || props.tasks.find(candidate => candidate.id === dependency.depends_on_task_id) || null;
  const pending = dependencies.filter(dependency => targetFor(dependency)?.status !== 'done');
  const dependents = props.tasks
    .filter(candidate => candidate.id !== task.id)
    .filter(candidate => (candidate.dependencies || []).some(dependency => dependency.depends_on_task_id === task.id))
    .map(candidate => candidate.issue_key || `#${candidate.id}`);
  return {
    total: dependencies.length,
    labels: dependencies.map(dependency => targetFor(dependency)?.issue_key || `#${dependency.depends_on_task_id}`),
    pendingLabels: pending.map(dependency => targetFor(dependency)?.issue_key || `#${dependency.depends_on_task_id}`),
    dependents,
  };
};
const executionOrder = computed(() => {
  const tasks = props.tasks.filter(task => task.issue_type !== 'epic' && task.status !== 'done');
  const openIds = new Set(tasks.map(task => task.id));
  const completedIds = new Set(props.tasks.filter(task => task.status === 'done').map(task => task.id));
  const remaining = [...tasks];
  const ordered: TaskItem[] = [];
  while (remaining.length) {
    const ready = remaining.filter(task => (task.dependencies || []).every(dependency => {
      const target = dependency.depends_on || props.tasks.find(candidate => candidate.id === dependency.depends_on_task_id);
      return completedIds.has(dependency.depends_on_task_id) || target?.status === 'done' || !openIds.has(dependency.depends_on_task_id);
    }));
    const candidates = ready.length ? ready : remaining;
    candidates.sort((a, b) => {
      if (!ready.length) return a.id - b.id;
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      const priority = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (priority[b.priority] || 0) - (priority[a.priority] || 0) || a.id - b.id;
    });
    const next = candidates[0];
    ordered.push(next);
    completedIds.add(next.id);
    remaining.splice(remaining.findIndex(task => task.id === next.id), 1);
  }
  return ordered;
});
const executionRank = computed(() => new Map(executionOrder.value.map((task, index) => [task.id, index + 1])));
const taskMeta = (task: TaskItem) => ({ rank: executionRank.value.get(task.id) || null, blocked: dependencyState(task).pendingLabels.length > 0 });
const executionPreview = computed(() => executionOrder.value.slice(0, 5));
const visibleTasks = computed(() => props.tasks
  .filter(task => (project.value === 'all' || String(task.project_id) === project.value) && (status.value === 'all' || task.status === status.value) && (priority.value === 'all' || task.priority === priority.value))
  .sort((a, b) => {
    if (a.issue_type === 'epic' && b.issue_type !== 'epic') return -1;
    if (b.issue_type === 'epic' && a.issue_type !== 'epic') return 1;
    const aMeta = taskMeta(a); const bMeta = taskMeta(b);
    if (aMeta.blocked !== bMeta.blocked) return Number(aMeta.blocked) - Number(bMeta.blocked);
    if (aMeta.rank && bMeta.rank && aMeta.rank !== bMeta.rank) return aMeta.rank - bMeta.rank;
    return a.id - b.id;
  }));
const childCount = (epicId: number) => props.tasks.filter(task => task.epic_id === epicId && task.issue_type !== 'epic').length;
const tone = (value: string) => ({ todo: 'bg-slate-100 text-slate-600', in_progress: 'bg-blue-50 text-blue-700', review: 'bg-amber-50 text-amber-700', urgent: 'bg-rose-50 text-rose-700', high: 'bg-orange-50 text-orange-700' }[value] || 'bg-slate-100 text-slate-600');
</script>
<template>
  <aside class="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50/70">
    <div class="border-b border-slate-200 p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-900">Task queue</h2>
        <span class="text-xs text-slate-500">{{ visibleTasks.length }}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <select v-model="project" class="cc-select col-span-3"><option value="all">All projects</option><option v-for="item in projects" :key="item.id" :value="String(item.id)">{{ item.title }}</option></select>
        <select v-model="status" class="cc-select"><option value="all">Status</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="review">Review</option></select>
        <select v-model="priority" class="cc-select col-span-2"><option value="all">Priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      </div>
      <div v-if="executionPreview.length" class="mt-3 rounded-lg border border-slate-200 bg-white/70 p-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[10px] font-bold uppercase tracking-wide text-slate-600">Suggested order</p>
          <span class="text-[10px] text-slate-400">dependency-aware</span>
        </div>
        <div class="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
          <template v-for="(task, index) in executionPreview" :key="task.id">
            <button type="button" class="flex min-w-[92px] shrink-0 flex-col rounded-md border px-2 py-1.5 text-left" :class="taskMeta(task).blocked ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'" :title="task.title" @click="emit('select', task)">
              <span class="font-mono text-[9px] font-bold text-slate-500">{{ taskMeta(task).rank }} · {{ task.issue_key || `#${task.id}` }}</span>
              <span class="truncate text-[10px] font-semibold text-slate-800">{{ task.title }}</span>
              <span class="text-[9px] font-bold uppercase" :class="taskMeta(task).blocked ? 'text-amber-700' : 'text-emerald-700'">{{ taskMeta(task).blocked ? 'blocked' : 'ready' }}</span>
            </button>
            <span v-if="index < executionPreview.length - 1" class="shrink-0 text-xs font-bold text-slate-400">→</span>
          </template>
          <span v-if="executionOrder.length > executionPreview.length" class="shrink-0 text-[10px] text-slate-500">+{{ executionOrder.length - executionPreview.length }}</span>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p v-if="loading" class="p-3 text-xs text-slate-500">Refreshing tasks…</p>
      <div v-else-if="!visibleTasks.length" class="p-3 text-xs text-slate-500">
        <p>No runnable tasks or Epics in this workspace.</p>
        <p class="mt-2 leading-5">Create a backlog from a requirement or manage existing tasks in Hub.</p>
        <div class="mt-3 flex gap-2"><button class="cc-button" @click="emit('requirement')">New requirement</button><button class="cc-button" @click="emit('openHub')">Open Hub</button></div>
      </div>

      <button v-for="task in visibleTasks" :key="task.id" class="mb-1 w-full rounded-lg border p-3 text-left transition" :class="selectedId === task.id ? 'border-slate-900 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white'" @click="emit('select', task)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span v-if="taskMeta(task).rank" class="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">Step {{ taskMeta(task).rank }}</span>
            <span class="truncate text-xs font-medium text-slate-900">{{ task.issue_key || `#${task.id}` }}</span>
          </div>
          <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="tone(task.status)">{{ task.status.replace('_', ' ') }}</span>
        </div>
        <p class="line-clamp-2 text-sm text-slate-700">{{ task.title }}</p>
        <p v-if="task.issue_type === 'epic'" class="mt-1 text-[11px] font-semibold text-violet-700">Epic sequence · {{ childCount(task.id) }} task{{ childCount(task.id) === 1 ? '' : 's' }}</p>
        <div v-if="dependencyState(task).total" class="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4">
          <p class="text-slate-500">Depends on {{ dependencyState(task).labels.join(', ') }}</p>
          <p v-if="dependencyState(task).pendingLabels.length" class="font-semibold text-amber-700">Blocked by {{ dependencyState(task).pendingLabels.join(', ') }}</p>
        </div>
        <p v-if="dependencyState(task).dependents.length" class="mt-1 text-[10px] font-semibold text-slate-500">Unlocks {{ dependencyState(task).dependents.join(', ') }}</p>
        <div class="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span :class="['rounded px-1.5 py-0.5', tone(task.priority)]">{{ task.priority }}</span><span v-if="task.project?.title" class="truncate">{{ task.project.title }}</span></div>
      </button>
    </div>
  </aside>
</template>
