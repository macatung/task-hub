<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePage, router, Head } from '@inertiajs/vue3';

type Project = { id: number; title: string; key?: string | null; tasks_count?: number };
type Task = {
  id: number;
  issue_key?: string | null;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: string;
  project?: Project | null;
  due_date?: string | null;
};

interface UserAuth {
  id: number;
  name: string;
  email: string;
  github_login?: string | null;
  github_avatar_url?: string | null;
}

interface PageProps {
  appName?: string;
  auth?: { user?: UserAuth | null };
  flash?: { success?: string | null; error?: string | null; reference_id?: string | null };
  [key: string]: any;
}

const props = defineProps<{
  tasks: Task[];
  projects: Project[];
  stats: Record<string, number>;
  selectedDate: string;
}>();

const page = usePage<PageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const flash = computed(() => page.props.flash ?? {});

const dismissedFlash = ref(false);

const filter = ref<'all' | Task['status']>('all');
const visibleTasks = computed(() =>
  filter.value === 'all' ? props.tasks : props.tasks.filter(task => task.status === filter.value)
);

const statusLabel = (status: Task['status']) =>
  ({ todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' }[status] || status);

const setFilter = (value: 'all' | Task['status']) => {
  filter.value = value;
};

const filterOptions: Array<'all' | Task['status']> = ['all', 'todo', 'in_progress', 'review', 'done'];

const logout = () => {
  router.post('/auth/github/logout');
};
</script>

<template>
  <Head title="Task Hub — AI Agent Execution Workspace" />

  <main class="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans">
    <!-- Header -->
    <header class="border-b border-slate-800 bg-slate-950/95 px-6 py-3.5 sticky top-0 z-40 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <a href="/" class="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            ⚡
          </div>
          <span>Task Hub</span>
        </a>

        <!-- User Authentication Header Bar -->
        <div class="flex items-center gap-3 text-sm">
          <template v-if="user">
            <div class="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 shadow-sm">
              <img
                v-if="user.github_avatar_url"
                :src="user.github_avatar_url"
                :alt="user.github_login || user.name"
                class="h-6 w-6 rounded-full ring-1 ring-emerald-400/30"
              />
              <span class="text-xs font-semibold text-slate-200">
                @{{ user.github_login || user.name }}
              </span>
            </div>
            <button
              @click="logout"
              class="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Đăng xuất
            </button>
          </template>

          <template v-else>
            <a
              href="/auth/github"
              class="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-950/50 hover:bg-emerald-500 active:scale-95 transition-all"
            >
              <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign in with GitHub</span>
            </a>
          </template>
        </div>
      </div>
    </header>

    <!-- Flash Messages -->
    <div v-if="!dismissedFlash && (flash.error || flash.success)" class="mx-auto max-w-6xl px-6 pt-6">
      <div
        v-if="flash.error"
        class="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200 backdrop-blur"
      >
        <div class="flex items-center gap-3">
          <span class="text-base">⚠️</span>
          <span>{{ flash.error }}</span>
        </div>
        <button @click="dismissedFlash = true" class="text-xs text-red-400 hover:text-red-200">✕ Đóng</button>
      </div>

      <div
        v-if="flash.success"
        class="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-200 backdrop-blur"
      >
        <div class="flex items-center gap-3">
          <span class="text-base">✓</span>
          <span>{{ flash.success }}</span>
        </div>
        <button @click="dismissedFlash = true" class="text-xs text-emerald-400 hover:text-emerald-200">✕ Đóng</button>
      </div>
    </div>

    <!-- Content Area -->
    <section class="mx-auto max-w-6xl px-6 py-10">
      <p class="text-sm font-medium text-emerald-400 tracking-wide uppercase">Execution workspace</p>
      
      <div class="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Build with context. Review with evidence.</h1>
          <p class="mt-2 max-w-2xl text-slate-400 leading-relaxed">
            Task Hub connects project planning, GitHub delivery context, and supervised AI-agent handoffs in one auditable workflow.
          </p>
        </div>
        <p class="text-sm text-slate-500">Updated {{ selectedDate }}</p>
      </div>

      <!-- Stats Grid -->
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <article
          v-for="item in [
            { label: 'All tasks', value: stats.total },
            { label: 'To do', value: stats.todo },
            { label: 'In progress', value: stats.in_progress },
            { label: 'In review', value: stats.review },
            { label: 'Completed', value: stats.done },
          ]"
          :key="item.label"
          class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-colors"
        >
          <p class="text-sm text-slate-400">{{ item.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-white">{{ item.value || 0 }}</p>
        </article>
      </div>

      <!-- Projects and Tasks Grid -->
      <section class="mt-10 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <!-- Projects Sidebar -->
        <aside class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="font-semibold text-white">Projects</h2>
          <p class="mt-1 text-sm text-slate-400">GitHub-linked workspaces and delivery context.</p>
          
          <ul class="mt-4 divide-y divide-slate-800">
            <li v-for="project in projects" :key="project.id" class="py-3">
              <p class="font-medium text-slate-200">{{ project.title }}</p>
              <p class="mt-1 text-xs text-slate-500">
                {{ project.key || 'No project key' }} · {{ project.tasks_count || 0 }} tasks
              </p>
            </li>
            <li v-if="!projects.length" class="py-4 text-sm text-slate-500">
              No projects yet. Connect GitHub to create your first project.
            </li>
          </ul>
        </aside>

        <!-- Work Items Section -->
        <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-white">Work items</h2>
              <p class="mt-1 text-sm text-slate-400">Use the Desktop workspace to start a supervised agent run.</p>
            </div>
            
            <div class="flex gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                v-for="option in filterOptions"
                :key="option"
                class="rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                :class="filter === option ? 'bg-slate-800 text-emerald-400 shadow-xs' : 'text-slate-400 hover:text-white'"
                @click="setFilter(option)"
              >
                {{ option === 'in_progress' ? 'in progress' : option }}
              </button>
            </div>
          </div>

          <ul class="mt-4 divide-y divide-slate-800">
            <li
              v-for="task in visibleTasks"
              :key="task.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-900/40 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div>
                <p class="font-medium text-slate-200">{{ task.title }}</p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ task.issue_key || `Task #${task.id}` }} · {{ task.project?.title || 'Unassigned' }} · {{ task.priority }} priority
                </p>
              </div>
              <span class="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-300">
                {{ statusLabel(task.status) }}
              </span>
            </li>
            <li v-if="!visibleTasks.length" class="py-8 text-center text-sm text-slate-500">
              No work items in this view.
            </li>
          </ul>
        </section>
      </section>
    </section>
  </main>
</template>
