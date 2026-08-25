<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ProjectItem, TaskItem } from '../../composables/useTaskSync';
const props = defineProps<{ tasks: TaskItem[]; projects: ProjectItem[]; selectedId: number | null; loading: boolean }>();
const emit = defineEmits<{ select: [task: TaskItem]; requirement: []; openHub: [] }>();
const project = ref('all'); const status = ref('all'); const priority = ref('all');
const dependencyState = (task: TaskItem) => {
  const dependencies = (task.dependencies || []).filter(dependency => dependency.depends_on);
  const pending = dependencies.filter(dependency => dependency.depends_on?.status !== 'done');
  return {
    total: dependencies.length,
    labels: dependencies.map(dependency => dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`),
    pendingLabels: pending.map(dependency => dependency.depends_on?.issue_key || `#${dependency.depends_on_task_id}`),
  };
};
const visibleTasks = computed(() => props.tasks
  .filter(task => (project.value === 'all' || String(task.project_id) === project.value) && (status.value === 'all' || task.status === status.value) && (priority.value === 'all' || task.priority === priority.value))
  .sort((a, b) => Number(dependencyState(a).pendingLabels.length > 0) - Number(dependencyState(b).pendingLabels.length > 0)));
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
          <span class="truncate text-xs font-medium text-slate-900">{{ task.issue_key || `#${task.id}` }}</span>
          <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="tone(task.status)">{{ task.status.replace('_', ' ') }}</span>
        </div>
        <p class="line-clamp-2 text-sm text-slate-700">{{ task.title }}</p>
        <p v-if="task.issue_type === 'epic'" class="mt-1 text-[11px] font-semibold text-violet-700">Epic sequence · {{ childCount(task.id) }} task{{ childCount(task.id) === 1 ? '' : 's' }}</p>
        <div v-if="dependencyState(task).total" class="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4">
          <p class="text-slate-500">Depends on {{ dependencyState(task).labels.join(', ') }}</p>
          <p v-if="dependencyState(task).pendingLabels.length" class="font-semibold text-amber-700">Blocked by {{ dependencyState(task).pendingLabels.join(', ') }}</p>
        </div>
        <div class="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span :class="['rounded px-1.5 py-0.5', tone(task.priority)]">{{ task.priority }}</span><span v-if="task.project?.title" class="truncate">{{ task.project.title }}</span></div>
      </button>
    </div>
  </aside>
</template>
