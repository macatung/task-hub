<script setup lang="ts">
import { computed, ref } from 'vue';

type Project = { id: number; title: string; key?: string | null; tasks_count?: number };
type Task = { id: number; issue_key?: string | null; title: string; status: 'todo' | 'in_progress' | 'review' | 'done'; priority: string; project?: Project | null; due_date?: string | null };
const props = defineProps<{ tasks: Task[]; projects: Project[]; stats: Record<string, number>; selectedDate: string }>();
const filter = ref<'all' | Task['status']>('all');
const visibleTasks = computed(() => filter.value === 'all' ? props.tasks : props.tasks.filter(task => task.status === filter.value));
const statusLabel = (status: Task['status']) => ({ todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' })[status];
const setFilter = (value: 'all' | Task['status']) => { filter.value = value; };
const filterOptions: Array<'all' | Task['status']> = ['all', 'todo', 'in_progress', 'review', 'done'];
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <a href="/" class="text-lg font-semibold tracking-tight">Task Hub</a>
        <div class="flex items-center gap-3 text-sm"><a href="/auth/github" class="rounded-lg bg-blue-500 px-3 py-2 font-medium text-white hover:bg-blue-400">Sign in with GitHub</a></div>
      </div>
    </header>
    <section class="mx-auto max-w-6xl px-6 py-10">
      <p class="text-sm font-medium text-blue-300">Execution workspace</p>
      <div class="mt-2 flex flex-wrap items-end justify-between gap-5"><div><h1 class="text-3xl font-semibold tracking-tight">Build with context. Review with evidence.</h1><p class="mt-2 max-w-2xl text-slate-400">Task Hub connects project planning, GitHub delivery context, and supervised AI-agent handoffs in one auditable workflow.</p></div><p class="text-sm text-slate-500">Updated {{ selectedDate }}</p></div>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><article v-for="item in [{ label: 'All tasks', value: stats.total }, { label: 'To do', value: stats.todo }, { label: 'In progress', value: stats.in_progress }, { label: 'In review', value: stats.review }, { label: 'Completed', value: stats.done }]" :key="item.label" class="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p class="text-sm text-slate-400">{{ item.label }}</p><p class="mt-2 text-2xl font-semibold">{{ item.value || 0 }}</p></article></div>
      <section class="mt-10 grid gap-6 lg:grid-cols-[1fr_2fr]"><aside class="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 class="font-semibold">Projects</h2><p class="mt-1 text-sm text-slate-400">GitHub-linked workspaces and delivery context.</p><ul class="mt-4 divide-y divide-slate-800"><li v-for="project in projects" :key="project.id" class="py-3"><p class="font-medium">{{ project.title }}</p><p class="mt-1 text-xs text-slate-500">{{ project.key || 'No project key' }} · {{ project.tasks_count || 0 }} tasks</p></li><li v-if="!projects.length" class="py-3 text-sm text-slate-500">No projects yet. Connect GitHub to create your first project.</li></ul></aside>
      <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">Work items</h2><p class="mt-1 text-sm text-slate-400">Use the Desktop workspace to start a supervised agent run.</p></div><div class="flex gap-1 rounded-lg bg-slate-950 p-1"><button v-for="option in filterOptions" :key="option" class="rounded px-2 py-1 text-xs capitalize" :class="filter === option ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'" @click="setFilter(option)">{{ option === 'in_progress' ? 'in progress' : option }}</button></div></div><ul class="mt-4 divide-y divide-slate-800"><li v-for="task in visibleTasks" :key="task.id" class="flex flex-wrap items-center justify-between gap-3 py-3"><div><p class="font-medium">{{ task.title }}</p><p class="mt-1 text-xs text-slate-500">{{ task.issue_key || `Task #${task.id}` }} · {{ task.project?.title || 'Unassigned' }} · {{ task.priority }} priority</p></div><span class="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">{{ statusLabel(task.status) }}</span></li><li v-if="!visibleTasks.length" class="py-8 text-center text-sm text-slate-500">No work items in this view.</li></ul></section></section>
    </section>
  </main>
</template>
