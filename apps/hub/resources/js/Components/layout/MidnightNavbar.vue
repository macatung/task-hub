<script setup lang="ts">
import { ref, computed } from 'vue';
import { Link, usePage } from '@inertiajs/vue3';
import Icons from '@/Components/ui/Icons.vue';

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
  [key: string]: any;
}

defineProps<{
  badge?: string;
}>();

const page = usePage<PageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const mobileMenuOpen = ref(false);

interface NavItem {
  label: string;
  href: string;
  badge?: string;
}

const navLinks: NavItem[] = [
  { label: 'Overview', href: '/' },
  { label: 'Workspace', href: '/tasks', badge: 'LIVE' },
  { label: 'Projects', href: '/projects' },
  { label: 'Desktop', href: '/desktop', badge: 'v2.0' },
  { label: 'Pricing', href: '/pricing' },
];

const isLinkActive = (href: string): boolean => {
  const currentUrl = page.url;
  if (href === '/') return currentUrl === '/' || currentUrl === '';
  return currentUrl.startsWith(href);
};
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-slate-800/80 bg-midnight-950/85 backdrop-blur-md">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
      <!-- Brand Logo -->
      <Link href="/" class="flex items-center gap-3 group">
        <div class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-phantom-cyan/20 border border-emerald-500/40 p-1 shadow-md shadow-emerald-500/10 group-hover:border-emerald-400 group-hover:scale-105 transition-all">
          <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-full w-full object-contain drop-shadow-sm" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xl font-bold tracking-tight text-white group-hover:text-phantom-mint transition-colors">Midnight Hub</span>
          <span
            v-if="badge"
            class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider"
          >
            {{ badge }}
          </span>
          <span
            v-else
            class="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider hidden sm:inline-block"
          >
            SaaS
          </span>
        </div>
      </Link>

      <!-- Desktop Navigation Links -->
      <nav class="hidden md:flex items-center gap-1.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1 text-xs font-medium text-slate-300">
        <Link
          v-for="item in navLinks"
          :key="item.href"
          :href="item.href"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all"
          :class="isLinkActive(item.href)
            ? 'text-emerald-400 bg-emerald-500/10 font-bold border border-emerald-500/30 shadow-xs'
            : 'hover:text-white hover:bg-white/5 text-slate-300'"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-tight"
            :class="item.badge === 'LIVE'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
              : 'bg-phantom-cyan/20 text-phantom-cyan border border-phantom-cyan/30'"
          >
            {{ item.badge }}
          </span>
        </Link>
      </nav>

      <!-- Right Side Actions (GitHub + Auth CTA) -->
      <div class="hidden sm:flex items-center gap-3">
        <a
          href="https://github.com/macatung/task-hub"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-all"
        >
          <Icons name="Github" :size="15" />
          <span>GitHub</span>
        </a>

        <template v-if="user">
          <Link
            href="/tasks"
            class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-midnight-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
          >
            <span>Enter Workspace</span>
            <span>→</span>
          </Link>
        </template>
        <template v-else>
          <a
            href="/auth/github"
            class="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-midnight-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
          >
            <Icons name="Github" :size="15" />
            <span>Sign in with GitHub</span>
          </a>
        </template>
      </div>

      <!-- Mobile Hamburger Button -->
      <button
        type="button"
        @click="mobileMenuOpen = !mobileMenuOpen"
        class="flex md:hidden items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white focus:outline-none cursor-pointer"
        aria-label="Toggle navigation menu"
      >
        <Icons :name="mobileMenuOpen ? 'X' : 'Menu'" :size="20" />
      </button>
    </div>

    <!-- Mobile Dropdown Menu -->
    <div
      v-if="mobileMenuOpen"
      class="md:hidden border-t border-slate-800 bg-midnight-950 px-6 py-4 space-y-2 shadow-2xl"
    >
      <Link
        v-for="item in navLinks"
        :key="item.href"
        :href="item.href"
        @click="mobileMenuOpen = false"
        class="flex items-center justify-between py-2 text-sm transition-colors"
        :class="isLinkActive(item.href) ? 'text-emerald-400 font-bold' : 'text-slate-300 hover:text-white'"
      >
        <span>{{ item.label }}</span>
        <span
          v-if="item.badge"
          class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-tight"
          :class="item.badge === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-phantom-cyan/20 text-phantom-cyan border border-phantom-cyan/30'"
        >
          {{ item.badge }}
        </span>
      </Link>

      <div class="pt-3 border-t border-slate-800 flex flex-col gap-2">
        <a
          href="https://github.com/macatung/task-hub"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-slate-300 flex items-center justify-center gap-2"
        >
          <Icons name="Github" :size="15" />
          <span>GitHub</span>
        </a>

        <template v-if="user">
          <Link
            href="/tasks"
            @click="mobileMenuOpen = false"
            class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-midnight-950"
          >
            Enter Workspace
          </Link>
        </template>
        <template v-else>
          <a
            href="/auth/github"
            class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-midnight-950 flex items-center justify-center gap-2"
          >
            <Icons name="Github" :size="15" />
            <span>Sign in with GitHub</span>
          </a>
        </template>
      </div>
    </div>
  </header>
</template>
