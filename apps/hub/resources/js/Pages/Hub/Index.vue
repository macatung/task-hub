<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePage, Head } from '@inertiajs/vue3';

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

defineProps<{
  stats?: Record<string, number>;
  selectedDate?: string;
}>();

const page = usePage<PageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const flash = computed(() => page.props.flash ?? {});
const mobileMenuOpen = ref(false);
</script>

<template>
  <Head title="Midnight Hub — Autonomous AI Agent Orchestrator & Developer Studio" />

  <div class="hub-landing min-h-screen bg-midnight-950 text-slate-100 font-sans selection:bg-phantom-mint selection:text-midnight-950 overflow-x-hidden">
    <!-- Ambient Background Glows -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[1000px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-phantom-cyan/15 to-phantom-purple/10 blur-[140px]" />
      <div class="absolute top-[600px] -left-40 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-phantom-blue/10 via-phantom-purple/15 to-transparent blur-[130px]" />
      <div class="absolute bottom-10 -right-40 h-[600px] w-[800px] rounded-full bg-gradient-to-tl from-talisman-gold/10 via-emerald-600/15 to-transparent blur-[150px]" />
    </div>

    <!-- Sticky Navigation Header -->
    <header class="sticky top-0 z-50 border-b border-midnight-800/80 bg-midnight-950/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" class="flex items-center gap-3 group">
          <div class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/40 p-1 shadow-md shadow-emerald-500/10 group-hover:border-emerald-400 group-hover:scale-105 transition-all">
            <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-full w-full object-contain drop-shadow-sm" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors font-['Space_Grotesk']">Midnight Hub</span>
            <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">MDNT</span>
          </div>
        </a>

        <!-- Nav Links -->
        <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" class="hover:text-white transition-colors">Features</a>
          <a href="#agent-workflow" class="hover:text-white transition-colors">Agent Workflow</a>
          <a href="#mcp" class="hover:text-white transition-colors">MCP Protocol</a>
          <a href="/pricing" class="hover:text-emerald-400 font-semibold transition-colors">Pricing</a>
          <a href="#architecture" class="hover:text-white transition-colors">Architecture</a>
        </nav>

        <!-- Action / Auth -->
        <div class="flex items-center gap-4">
          <a
            href="https://github.com/macatung/task-hub"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-all"
          >
            <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
          </a>

          <template v-if="user">
            <a
              href="/tasks"
              class="hidden sm:flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
            >
              <span>Enter Workspace</span>
              <span>→</span>
            </a>
          </template>
          <template v-else>
            <a
              href="/auth/github"
              class="hidden sm:flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
            >
              <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign in with GitHub</span>
            </a>
          </template>

          <!-- Mobile Hamburger Toggle Button -->
          <button
            type="button"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="flex md:hidden items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            <svg v-if="!mobileMenuOpen" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Nav Drawer -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-slate-800 bg-slate-950 px-6 py-4 space-y-3">
        <a href="#features" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Features</a>
        <a href="#agent-workflow" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Agent Workflow</a>
        <a href="#mcp" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">MCP Protocol</a>
        <a href="/pricing" @click="mobileMenuOpen = false" class="block text-sm text-emerald-400 font-bold">Pricing & Plans</a>
        <a href="#architecture" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Architecture</a>
        <div class="pt-3 border-t border-slate-800 flex flex-col gap-2">
          <template v-if="user">
            <a href="/tasks" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-slate-950">Enter Workspace</a>
          </template>
          <template v-else>
            <a href="/auth/github" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-slate-950 flex items-center justify-center gap-2">
              <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign in with GitHub</span>
            </a>
          </template>
        </div>
      </div>
    </header>

    <!-- Flash message alerts if present -->
    <div v-if="flash.error" class="relative z-10 mx-auto max-w-5xl px-6 pt-4">
      <div class="rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-xs text-red-200 backdrop-blur">
        ⚠️ {{ flash.error }}
      </div>
    </div>

    <!-- HERO SECTION -->
    <section class="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
      <!-- Top Announcement Pill -->
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-inner">
        <span>🚀</span>
        <span>Midnight Hub — Supervised AI-Native Execution Engine</span>
      </div>

      <!-- Main Headline -->
      <h1 class="mt-8 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
        Build with Context.<br />
        <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
          Ship with Evidence.
        </span>
      </h1>

      <!-- Subtitle -->
      <p class="mx-auto mt-6 max-w-3xl text-base sm:text-lg md:text-xl text-slate-400 leading-relaxed font-normal">
        The SaaS task management platform built specifically for engineering teams working alongside autonomous AI coding agents. Link GitHub repositories, groom backlogs, deliver rich context packs, and enforce supervised handoffs with auditable test evidence.
      </p>

      <!-- CTA Button Group -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="/auth/github"
          class="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span>Start Free with GitHub</span>
        </a>
        <a
          href="/pricing"
          class="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-sm font-semibold text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all"
        >
          <span>View Pricing & Plans</span>
          <span>→</span>
        </a>
        <a
          href="/tasks"
          class="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white transition-all"
        >
          <span>Explore Workspace</span>
          <span>→</span>
        </a>
      </div>

      <p class="mt-4 text-xs text-slate-500 font-medium">
        Free forever for open source & developers · 1-click GitHub OAuth authorization
      </p>

      <!-- Interactive SaaS Workspace Preview Mockup -->
      <div class="mt-16 overflow-hidden rounded-2xl border border-midnight-800/80 bg-midnight-900/60 p-2 sm:p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <!-- Mockup Header Bar -->
        <div class="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/80 px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="h-3 w-3 rounded-full bg-red-500/80"></div>
            <div class="h-3 w-3 rounded-full bg-yellow-500/80"></div>
            <div class="h-3 w-3 rounded-full bg-emerald-500/80"></div>
            <span class="ml-2 text-xs font-mono text-slate-500">midnight.macatung.dev/tasks</span>
          </div>
          <div class="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Agent Run Active: Antigravity IDE</span>
          </div>
        </div>

        <!-- Mockup Kanban Grid -->
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <!-- Column 1: Backlog / To Do -->
          <div class="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3.5">
            <div class="flex items-center justify-between text-xs font-bold text-slate-400 pb-2 border-b border-slate-800/60">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-slate-500"></span>
                <span>TO DO</span>
              </span>
              <span class="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">3</span>
            </div>
            <div class="mt-3 space-y-2">
              <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-3 shadow-xs">
                <p class="text-xs font-semibold text-slate-200">Refactor OAuth state handler</p>
                <div class="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">HUB-102</span>
                  <span class="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-400 font-semibold">3 SP</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 2: In Progress -->
          <div class="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3.5">
            <div class="flex items-center justify-between text-xs font-bold text-blue-400 pb-2 border-b border-slate-800/60">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>IN PROGRESS</span>
              </span>
              <span class="rounded bg-blue-950/60 px-1.5 py-0.5 text-[10px] text-blue-300">1</span>
            </div>
            <div class="mt-3 space-y-2">
              <div class="rounded-lg border border-blue-500/40 bg-blue-950/20 p-3 shadow-md shadow-blue-950/30 ring-1 ring-blue-500/20">
                <p class="text-xs font-semibold text-white">Bi-directional GitHub Webhook Sync</p>
                <div class="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span class="font-mono text-cyan-400">🤖 Agent: Claude / Antigravity</span>
                </div>
                <div class="mt-2.5 flex items-center justify-between text-[10px]">
                  <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">HUB-88</span>
                  <span class="text-xs text-amber-400 font-bold">⚡ Branch: feat/sync</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 3: In Review -->
          <div class="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3.5">
            <div class="flex items-center justify-between text-xs font-bold text-purple-400 pb-2 border-b border-slate-800/60">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-purple-500"></span>
                <span>IN REVIEW</span>
              </span>
              <span class="rounded bg-purple-950/60 px-1.5 py-0.5 text-[10px] text-purple-300">1</span>
            </div>
            <div class="mt-3 space-y-2">
              <div class="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3 shadow-xs">
                <p class="text-xs font-semibold text-slate-200">MCP Protocol 2024-11-05 Tool Support</p>
                <div class="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span>✓ 14/14 Tests Passed</span>
                </div>
                <div class="mt-2 flex items-center justify-between text-[10px]">
                  <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">HUB-94</span>
                  <span class="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300 font-semibold">Evidence Attached</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 4: Done -->
          <div class="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3.5">
            <div class="flex items-center justify-between text-xs font-bold text-emerald-400 pb-2 border-b border-slate-800/60">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>COMPLETED</span>
              </span>
              <span class="rounded bg-emerald-950/60 px-1.5 py-0.5 text-[10px] text-emerald-300">12</span>
            </div>
            <div class="mt-3 space-y-2">
              <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-3 opacity-80">
                <p class="text-xs font-semibold text-slate-300 line-through">Docker Multi-Stage Cloud Run Deployment</p>
                <div class="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span class="font-mono">HUB-79</span>
                  <span class="text-emerald-400 font-bold">✓ Merged</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CORE FEATURES BENTO GRID -->
    <section id="features" class="relative z-10 border-t border-slate-800/80 bg-slate-900/30 py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400">Supercharged Architecture</p>
          <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Everything your team needs to supervise AI coding agents
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
            Eliminate loose prompts and unverified PRs. Midnight Hub provides the deterministic contract between humans and autonomous coding agents.
          </p>
        </div>

        <div class="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- Feature 1 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-emerald-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-2xl text-emerald-400 group-hover:scale-110 transition-transform">
              🤖
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Supervised Agent Execution</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Enforce strict handoff contracts. Agents receive structured context packs and must attach verifiable test logs before requesting human review.
            </p>
          </div>

          <!-- Feature 2 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-teal-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-2xl text-teal-400 group-hover:scale-110 transition-transform">
              🔄
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Bi-Directional GitHub Sync</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              1-click connect your GitHub repositories. Automatically sync branches, commits, pull requests, issues, and real-time webhook status updates.
            </p>
          </div>

          <!-- Feature 3 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-2xl text-cyan-400 group-hover:scale-110 transition-transform">
              🔌
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Native MCP Server Endpoint</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Seamlessly integrates with Google Antigravity, Claude Code, Cursor, and Codex via standard JSON-RPC 2.0 Model Context Protocol.
            </p>
          </div>

          <!-- Feature 4 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-blue-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-2xl text-blue-400 group-hover:scale-110 transition-transform">
              📊
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Agile Scrum & Kanban Board</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Backlog grooming, Story Points estimation, sprint velocity calculation, and smooth drag-and-drop state transitions.
            </p>
          </div>

          <!-- Feature 5 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-purple-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-2xl text-purple-400 group-hover:scale-110 transition-transform">
              📄
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Project Knowledge Registry</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Manage specifications, architecture RFCs, and release logs. Automatically deliver required documents to agents on task dispatch.
            </p>
          </div>

          <!-- Feature 6 -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-amber-500/50 hover:bg-slate-900/60 transition-all">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-2xl text-amber-400 group-hover:scale-110 transition-transform">
              🧘
            </div>
            <h3 class="mt-5 text-lg font-bold text-white">Mindful Focus & Pomodoro</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Built-in Pomodoro cycles, breathing pacers, and Theravāda mindfulness reflections to maintain peak engineering focus during long coding sprints.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- WORKFLOW 3-STEP SECTION -->
    <section id="agent-workflow" class="relative z-10 py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400">Deterministic Pipeline</p>
          <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How Midnight Hub coordinates human intent & AI execution
          </h2>
        </div>

        <div class="mt-16 grid gap-8 md:grid-cols-3 text-left">
          <div class="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 relative">
            <span class="text-3xl font-black text-emerald-500/40">01</span>
            <h3 class="mt-4 text-base font-bold text-white">Connect & Plan</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Sign in with GitHub and link your project repositories. Define clear Acceptance Criteria and Definition of Done for each task.
            </p>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 relative">
            <span class="text-3xl font-black text-blue-500/40">02</span>
            <h3 class="mt-4 text-base font-bold text-white">Dispatch to Agent</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              AI agents connect via native MCP. They fetch the exact task context pack, git branch constraints, and test execution rules.
            </p>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 relative">
            <span class="text-3xl font-black text-purple-500/40">03</span>
            <h3 class="mt-4 text-base font-bold text-white">Review Evidence & Merge</h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Agents submit structured handoffs with automated test results. Humans review the evidence and approve deterministic merges.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- BOTTOM CTA BANNER -->
    <section class="relative z-10 border-t border-slate-800/80 bg-gradient-to-b from-slate-950 to-slate-900 py-20 text-center">
      <div class="mx-auto max-w-4xl px-6">
        <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Ready to supervise AI coding agents with total confidence?
        </h2>
        <p class="mt-4 text-base sm:text-lg text-slate-400">
          Join engineers using Midnight Hub to coordinate AI agent handoffs and ship clean, verified code.
        </p>

        <div class="mt-8 flex justify-center">
          <a
            href="/auth/github"
            class="flex items-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
          >
            <svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Get Started with GitHub OAuth</span>
          </a>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="border-t border-slate-800/80 bg-slate-950 px-6 py-12 text-xs text-slate-500">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
        <div class="flex items-center gap-2.5">
          <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-6 w-6 rounded-lg object-contain" />
          <span class="font-bold text-slate-300">Midnight Hub</span>
          <span>· Open Source & Supervised AI Workspace</span>
        </div>
        <div class="flex items-center gap-6 text-slate-400">
          <a href="/pricing" class="hover:text-emerald-400 transition-colors font-medium">Pricing</a>
          <a href="#features" class="hover:text-white transition-colors">Features</a>
          <a href="#agent-workflow" class="hover:text-white transition-colors">Workflow</a>
          <a href="https://github.com/macatung/task-hub" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">GitHub</a>
        </div>
        <p>© 2026 Macatung Dev. Released under the MIT License.</p>
      </div>
    </footer>
  </div>
</template>
