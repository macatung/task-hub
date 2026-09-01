<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePage, Link } from '@inertiajs/vue3';
import Icons from '@/Components/ui/Icons.vue';
import SeoHead from '@/Components/common/SeoHead.vue';

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

// Interactive Pipeline Simulator State
const activePipelineTab = ref<'ingest' | 'isolate' | 'verify' | 'handoff'>('verify');

const pipelineStages = [
  {
    id: 'ingest',
    num: '01',
    name: 'Ingest',
    tag: 'Context Pack',
    icon: 'Sparkles',
    desc: 'Transforms user prompts into structured Epics, Stories, and Tasks linked with verified architectural specifications.',
    codeTitle: 'discovery_output.json',
    codeLang: 'json',
    codeContent: `{
  "discovery_id": "disc_8f902a11",
  "source_prompt": "Build MCP Gateway for Antigravity & Claude",
  "context_docs": ["docs/ARCHITECTURE-CURRENT.md (Fresh: 2d ago)"],
  "generated_backlog": {
    "epic": "EPIC-14: Model Context Protocol Gateway",
    "tasks": [
      {
        "issue_key": "HUB-108",
        "title": "Implement JSON-RPC 2.0 MCP Transport over SSE",
        "acceptance_criteria": ["tools/list, tools/call support", "Workspace token auth"],
        "definition_of_done": ["Coverage >= 95%", "OpenAPI schema valid"]
      }
    ]
  }
}`
  },
  {
    id: 'isolate',
    num: '02',
    name: 'Isolate',
    tag: 'Git Worktree',
    icon: 'GitBranch',
    desc: 'Spawns dedicated Git worktrees for AI agents (Antigravity 2.0, Codex, Claude Code), eliminating main branch conflicts.',
    codeTitle: 'worktree_dispatch.sh',
    codeLang: 'bash',
    codeContent: `[10:44:02] $ cao workflow run --task HUB-108 --profile supervisor
[10:44:03] 🌿 Git Worktree: .worktrees/task-HUB-108-mcp-transport
[10:44:04] 🤖 Dispatching to: Antigravity 2.0 (Gemini 3.7 Pro)
[10:44:06] 📦 Context Loaded: 4 files (Contract: task-hub.openapi.yaml)
[10:44:08] ✍️ Modified 3 files in isolated worktree:
             + TaskHubMcpController.php (+84 lines)
             + routes/web.php (+12 lines)
             + mcp-schema.json (+45 lines)
[10:44:10] 🛡️ Sandbox Check: Zero destructive shell calls. All edits isolated.`
  },
  {
    id: 'verify',
    num: '03',
    name: 'Verify',
    tag: 'Test Evidence',
    icon: 'CheckCircle',
    desc: 'Executes automated test suites and captures machine-readable logs, pass/fail counts, and risk scores before handoff.',
    codeTitle: 'verification_evidence.json',
    codeLang: 'json',
    codeContent: `{
  "task_id": "HUB-108",
  "actor": { "type": "agent_runner", "model": "antigravity/gemini-3.7-pro" },
  "execution_pipeline": "strict_v1 (implement -> review -> evidence -> handoff)",
  "review_stage": {
    "verdict": "APPROVED",
    "risk_score": 0.04,
    "static_analysis": "Passed PSR-12 & TypeScript Strict"
  },
  "evidence_stage": {
    "test_command": "npm test -- tests/Unit/UserInTheLoopE2ETest.test.ts",
    "total_tests": 14,
    "passed": 14,
    "failed": 0,
    "status": "PASSED"
  },
  "handoff_state": "needs_review"
}`
  },
  {
    id: 'handoff',
    num: '04',
    name: 'Handoff',
    tag: 'Human Sign-off',
    icon: 'Shield',
    desc: 'Tech leads inspect AST diffs and verified evidence with 100% actor attribution; 1-click approve and merge into main.',
    codeTitle: 'human_audit_trail.log',
    codeLang: 'log',
    codeContent: `[10:44:22] 🔔 Notification: HUB-108 submitted for Human Review.
[10:44:23] 👤 Reviewer: Lead Architect (Workspace Owner)
[10:44:25] 🔍 Diff Inspector: 3 files changed (+141, -0). 14/14 Tests Passed.
[10:44:28] 🛡️ Actor Attribution: [Agent: Antigravity 2.0] & [Supervisor: CAO].
[10:44:30] ✅ Action: HUMAN APPROVE (Zero Unsupervised Mutation Enforced)
[10:44:31] 🚀 Merged branch 'task/HUB-108' to 'main'. Task completed.`
  }
];

const currentPipelineData = computed(() => {
  return pipelineStages.find(s => s.id === activePipelineTab.value) || pipelineStages[2];
});

const hubJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      'name': 'Midnight Hub',
      'alternateName': 'Midnight AI Orchestrator',
      'applicationCategory': 'DeveloperApplication',
      'operatingSystem': 'Web, Windows, Linux, macOS',
      'description': 'Supervised Vibe Coding Platform & Autonomous AI Agent Orchestrator for Antigravity 2.0, Codex, Claude Code.',
      'url': 'https://midnight.macatung.dev',
      'publisher': {
        '@type': 'Person',
        'name': 'MacaTung',
        'url': 'https://macatung.dev'
      }
    },
    {
      '@type': 'WebSite',
      'url': 'https://midnight.macatung.dev/',
      'name': 'Midnight Hub',
      'description': 'Supervised Vibe Coding & Autonomous AI Orchestration Studio'
    }
  ]
};
</script>

<template>
  <SeoHead
    title="Supervised Vibe Coding & AI Agent Orchestration — Midnight Hub"
    description="Transform Vibe Coding into a rigorous engineering workflow. Orchestrate Antigravity 2.0, Codex, Claude Code in isolated Git worktrees with Verification Evidence."
    keywords="Midnight Hub, Supervised Vibe Coding, AI Coding Agents, Antigravity 2.0, Claude Code, Verification Evidence, MCP Gateway, Git Worktree, Agile Backlog"
    canonical="https://midnight.macatung.dev"
    :json-ld="hubJsonLd"
  />

  <div class="hub-landing min-h-screen bg-midnight-950 text-slate-100 font-sans selection:bg-emerald-400 selection:text-midnight-950 overflow-x-hidden">
    <!-- Ambient Background Glows -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-teal-500/10 to-transparent blur-[140px]" />
      <div class="absolute top-[600px] -left-40 h-[450px] w-[600px] rounded-full bg-gradient-to-br from-cyan-600/10 via-purple-600/10 to-transparent blur-[130px]" />
      <div class="absolute bottom-10 -right-40 h-[500px] w-[700px] rounded-full bg-gradient-to-tl from-emerald-600/10 via-teal-500/10 to-transparent blur-[150px]" />
    </div>

    <!-- Sticky Navigation Header (Page-Based Navigation) -->
    <header class="sticky top-0 z-50 border-b border-slate-800/80 bg-midnight-950/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <!-- Logo -->
        <Link href="/" class="flex items-center gap-3 group">
          <div class="relative inline-flex h-9 w-9 items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/40 p-1 shadow-sm group-hover:border-emerald-400 transition-all">
            <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-full w-full object-contain" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors font-['Space_Grotesk']">Midnight Hub</span>
            <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">MDNT</span>
          </div>
        </Link>

        <!-- Page-Based Navigation Links -->
        <nav class="hidden lg:flex items-center gap-1.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1 text-xs font-medium text-slate-300">
          <Link
            href="/"
            class="px-3 py-1.5 rounded-xl transition-all"
            :class="$page.url === '/' ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'hover:text-white hover:bg-white/5'"
          >
            Overview
          </Link>
          <Link
            href="/tasks"
            class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            :class="$page.url.startsWith('/tasks') || $page.url.startsWith('/workspace') ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'hover:text-white hover:bg-white/5'"
          >
            <span>Workspace</span>
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </Link>
          <Link
            href="/projects"
            class="px-3 py-1.5 rounded-xl transition-all"
            :class="$page.url.startsWith('/projects') ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'hover:text-white hover:bg-white/5'"
          >
            Projects
          </Link>
          <Link
            href="/desktop"
            class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            :class="$page.url.startsWith('/desktop') ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'hover:text-white hover:bg-white/5'"
          >
            <span>Desktop</span>
            <span class="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-mono text-emerald-400 font-bold">v2.0</span>
          </Link>
          <Link
            href="/pricing"
            class="px-3 py-1.5 rounded-xl transition-all"
            :class="$page.url.startsWith('/pricing') ? 'text-emerald-400 bg-emerald-500/10 font-bold' : 'hover:text-white hover:bg-white/5'"
          >
            Pricing
          </Link>
        </nav>

        <!-- Action / Auth -->
        <div class="flex items-center gap-3">
          <a
            href="https://github.com/macatung/task-hub"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-all shrink-0"
          >
            <Icons name="Github" :size="14" />
            <span>GitHub</span>
          </a>

          <template v-if="user">
            <Link
              href="/tasks"
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all shrink-0"
            >
              <span>Workspace</span>
              <span>→</span>
            </Link>
          </template>
          <template v-else>
            <a
              href="/auth/github"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all shrink-0"
            >
              <Icons name="Github" :size="14" />
              <span>Sign In</span>
            </a>
          </template>

          <!-- Mobile Toggle Button -->
          <button
            type="button"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="inline-flex lg:hidden items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white shrink-0"
            aria-label="Toggle Menu"
          >
            <Icons :name="mobileMenuOpen ? 'X' : 'Menu'" :size="18" />
          </button>
        </div>
      </div>

      <!-- Mobile Nav Drawer -->
      <div v-if="mobileMenuOpen" class="lg:hidden border-t border-slate-800 bg-slate-950 px-6 py-4 space-y-2">
        <Link href="/" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Overview</Link>
        <Link href="/tasks" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white flex items-center justify-between">
          <span>Workspace</span>
          <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">Live</span>
        </Link>
        <Link href="/projects" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white">Projects</Link>
        <Link href="/desktop" @click="mobileMenuOpen = false" class="block py-2 text-sm text-slate-300 hover:text-white flex items-center justify-between">
          <span>Desktop Companion</span>
          <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">v2.0</span>
        </Link>
        <Link href="/pricing" @click="mobileMenuOpen = false" class="block py-2 text-sm text-emerald-400 font-bold">Pricing</Link>
        <div class="pt-3 border-t border-slate-800">
          <template v-if="user">
            <Link href="/tasks" class="block rounded-xl bg-emerald-500 py-2 text-center text-xs font-bold text-slate-950">Enter Workspace</Link>
          </template>
          <template v-else>
            <a href="/auth/github" class="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-center text-xs font-bold text-slate-950">
              <Icons name="Github" :size="14" />
              <span>Sign In with GitHub</span>
            </a>
          </template>
        </div>
      </div>
    </header>

    <!-- Flash Alerts -->
    <div v-if="flash.error" class="relative z-10 mx-auto max-w-5xl px-6 pt-4">
      <div class="rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200">
        ⚠️ {{ flash.error }}
      </div>
    </div>

    <!-- HERO SECTION (Streamlined & High-Impact) -->
    <section class="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-16 text-center">
      <!-- Announcement Pill -->
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300 shadow-inner">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="font-mono uppercase tracking-wider text-[11px]">Supervised Vibe Coding 2.0</span>
      </div>

      <!-- Main Headline -->
      <h1 class="mt-6 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
        Vibe Code at High Velocity.<br />
        <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
          Zero Regressions & Strict Verification.
        </span>
      </h1>

      <!-- Condensed Punchy Subtitle -->
      <p class="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
        Orchestrate <strong class="text-white">Antigravity 2.0</strong>, <strong class="text-white">Codex</strong>, and <strong class="text-white">Claude Code</strong> in isolated Git worktrees with automated test evidence and human sign-off gates.
      </p>

      <!-- CTA Buttons -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3.5">
        <template v-if="user">
          <Link
            href="/tasks"
            class="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
          >
            <Icons name="Sparkles" :size="16" />
            <span>Open Workspace</span>
            <span>→</span>
          </Link>
        </template>
        <template v-else>
          <a
            href="/auth/github"
            class="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
          >
            <Icons name="Github" :size="16" />
            <span>Start Free with GitHub</span>
            <span>→</span>
          </a>
        </template>
        <Link
          href="/desktop"
          class="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3.5 text-xs sm:text-sm font-semibold text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all"
        >
          <Icons name="Desktop" :size="16" />
          <span>Desktop Companion</span>
        </Link>
        <Link
          href="/projects"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-3.5 text-xs sm:text-sm font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-all"
        >
          <span>Projects</span>
          <span>→</span>
        </Link>
      </div>

      <!-- Guarantee Badges Strip -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400 font-mono">
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> Git Worktree Isolation</span>
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> Automated Test Evidence</span>
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> 100% Actor Attribution</span>
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> Zero Unsupervised Mutations</span>
      </div>

      <!-- INTERACTIVE PIPELINE SIMULATOR -->
      <div class="mt-12 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/80 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 text-left">
        <!-- Top Bar -->
        <div class="flex items-center justify-between border-b border-slate-800/80 bg-slate-950 px-4 py-2.5">
          <div class="flex items-center gap-2.5">
            <div class="flex items-center gap-1.5">
              <div class="h-2.5 w-2.5 rounded-full bg-red-500/80"></div>
              <div class="h-2.5 w-2.5 rounded-full bg-yellow-500/80"></div>
              <div class="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></div>
            </div>
            <span class="text-xs font-mono text-slate-400 font-semibold">Supervised Pipeline Simulator</span>
          </div>
          <span class="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold">
            ● STRICT_V1
          </span>
        </div>

        <!-- 4 Pipeline Stage Tabs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-800/80 bg-slate-900/40">
          <button
            v-for="stage in pipelineStages"
            :key="stage.id"
            @click="activePipelineTab = stage.id as any"
            type="button"
            class="flex items-center gap-2 px-3 py-2.5 text-left transition-all border-b-2 text-xs font-mono cursor-pointer"
            :class="[
              activePipelineTab === stage.id
                ? 'border-emerald-400 bg-emerald-500/10 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            ]"
          >
            <span
              class="inline-flex h-4 w-4 items-center justify-center shrink-0 rounded text-[9px] font-bold"
              :class="activePipelineTab === stage.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'"
            >
              {{ stage.num }}
            </span>
            <div class="truncate">
              <span class="font-semibold">{{ stage.name }}</span>
              <span class="text-[10px] text-slate-400 ml-1 hidden sm:inline">({{ stage.tag }})</span>
            </div>
          </button>
        </div>

        <!-- Stage Content Body -->
        <div class="p-4 sm:p-5 grid lg:grid-cols-12 gap-5 items-start">
          <div class="lg:col-span-4 space-y-3">
            <div class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono text-emerald-400 border border-slate-800">
              <Icons :name="currentPipelineData.icon" :size="13" />
              <span>Stage {{ currentPipelineData.num }}: {{ currentPipelineData.name }}</span>
            </div>

            <h3 class="text-base font-bold text-white leading-snug">
              {{ currentPipelineData.name }} — {{ currentPipelineData.tag }}
            </h3>

            <p class="text-xs text-slate-300 leading-relaxed">
              {{ currentPipelineData.desc }}
            </p>

            <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5 text-[11px] font-mono">
              <div class="flex items-center justify-between text-slate-400">
                <span>Sandbox:</span>
                <span class="text-emerald-400 font-bold">● Active Worktree</span>
              </div>
              <div class="flex items-center justify-between text-slate-400">
                <span>Guardrails:</span>
                <span class="text-cyan-400 font-bold">100% Enforced</span>
              </div>
              <div class="flex items-center justify-between text-slate-400">
                <span>Context:</span>
                <span class="text-purple-400 font-bold">Living Docs v1</span>
              </div>
            </div>
          </div>

          <div class="lg:col-span-8">
            <div class="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-[11px] shadow-inner overflow-x-auto">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2.5 text-slate-400 text-[10px]">
                <span class="text-emerald-400 font-semibold">{{ currentPipelineData.codeTitle }}</span>
                <span class="text-slate-400 uppercase">{{ currentPipelineData.codeLang }}</span>
              </div>
              <pre class="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap selection:bg-emerald-500 selection:text-slate-950">{{ currentPipelineData.codeContent }}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: CHAOTIC VS SUPERVISED COMPARISON (Concise & Scannable) -->
    <section class="relative z-10 border-t border-slate-800/80 bg-slate-900/30 py-16">
      <div class="mx-auto max-w-5xl px-6">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Paradigm Shift</p>
          <h2 class="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Chaotic Prompting vs. Supervised Vibe Coding
          </h2>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <!-- Chaotic Column -->
          <div class="rounded-2xl border border-red-500/20 bg-red-950/10 p-6 backdrop-blur space-y-4">
            <div class="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-0.5 text-xs font-mono text-red-400 font-bold">
              <span>✕ CHAOTIC VIBE CODING</span>
            </div>
            <ul class="space-y-3 text-xs sm:text-sm text-slate-300">
              <li class="flex items-start gap-2.5">
                <span class="text-red-400 font-bold mt-0.5">✕</span>
                <span><strong>Hallucinations:</strong> Missing architectural context causes broken APIs and invalid dependencies.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-red-400 font-bold mt-0.5">✕</span>
                <span><strong>Direct Mutations on Main:</strong> Unsandboxed agents cause Git conflicts and overwrite teammate code.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-red-400 font-bold mt-0.5">✕</span>
                <span><strong>No Test Verification:</strong> Untested AI code slips silent regressions into production.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-red-400 font-bold mt-0.5">✕</span>
                <span><strong>Zero Audit Trail:</strong> Untracked prompt history with unknown model provenance.</span>
              </li>
            </ul>
          </div>

          <!-- Supervised Column -->
          <div class="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 to-slate-950/80 p-6 backdrop-blur shadow-xl ring-1 ring-emerald-500/30 space-y-4">
            <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-mono text-emerald-400 font-bold">
              <span>✓ SUPERVISED VIBE CODING</span>
            </div>
            <ul class="space-y-3 text-xs sm:text-sm text-slate-200">
              <li class="flex items-start gap-2.5">
                <span class="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Living Context Pack:</strong> Ingests verified system architecture docs with freshness governance.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Git Worktree Isolation:</strong> Swarms run in sandboxed branches with zero main branch locks.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>Mandatory Test Evidence:</strong> 100% test pass proof, risk scoring, and verified diffs before handoff.</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-emerald-400 font-bold mt-0.5">✓</span>
                <span><strong>100% Actor Attribution:</strong> Human vs. AI author attribution with immutable review gates.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: 3 CORE PILLARS (Compact Bento Grid) -->
    <section class="relative z-10 py-16">
      <div class="mx-auto max-w-5xl px-6">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Foundational Architecture</p>
          <h2 class="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Velocity, Verification & Governance
          </h2>
        </div>

        <div class="grid gap-6 md:grid-cols-3">
          <!-- Pillar 1: Velocity -->
          <div class="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-emerald-500/50 transition-all space-y-3">
            <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Icons name="Zap" :size="20" />
            </div>
            <h3 class="text-base font-bold text-white">1. High Velocity</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Decompose prompts into Epics, Stories, and Tasks in seconds. Concurrently dispatch Antigravity 2.0, Codex, and Claude Code across isolated Git worktrees.
            </p>
          </div>

          <!-- Pillar 2: Verification -->
          <div class="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-cyan-500/50 transition-all space-y-3">
            <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Icons name="Shield" :size="20" />
            </div>
            <h3 class="text-base font-bold text-white">2. Strict Verification</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Deterministic 4-step pipeline: <code>Implement ➔ Review ➔ Evidence ➔ Handoff</code>. Automated test runner captures logs and blocks failing code.
            </p>
          </div>

          <!-- Pillar 3: Governance -->
          <div class="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 hover:border-purple-500/50 transition-all space-y-3">
            <div class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Icons name="BookOpen" :size="20" />
            </div>
            <h3 class="text-base font-bold text-white">3. Standard Governance</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Living Context Pack under <code>task-hub-docs-v1</code>, 9 standardized MCP 2024-11-05 tools, and transparent human vs. AI actor attribution.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: DESKTOP COMPANION CALLOUT -->
    <section class="relative z-10 border-t border-slate-800/80 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-950 py-14">
      <div class="mx-auto max-w-5xl px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <div class="space-y-3 text-left max-w-xl">
          <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-mono text-emerald-400 font-bold">
            <Icons name="Desktop" :size="13" />
            <span>DESKTOP COMPANION</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Run Autonomous Agents Locally
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Windows Electron app with built-in CAO daemon, automatic MCP config, audio cues, and sub-second log streaming.
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <Link
            href="/desktop"
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-md hover:bg-emerald-300 transition"
          >
            <Icons name="Desktop" :size="16" />
            <span>Download for Windows</span>
            <span>→</span>
          </Link>
          <Link
            href="/projects"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition"
          >
            <span>Explore Projects</span>
          </Link>
        </div>
      </div>
    </section>

    <!-- SECTION: PRICING TEASER -->
    <section class="relative z-10 border-t border-slate-800/80 bg-slate-950 py-16">
      <div class="mx-auto max-w-5xl px-6 text-center">
        <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Commercial Plans</p>
        <h2 class="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Start Free, Scale with Your Team
        </h2>

        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-left">
          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Community</div>
              <div class="mt-1 text-2xl font-extrabold text-white">$0</div>
              <p class="mt-2 text-xs text-slate-400">1 local runner, 3 projects, 7-day retention.</p>
            </div>
            <Link href="/pricing" class="mt-5 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              Get Started →
            </Link>
          </div>

          <div class="rounded-2xl border border-emerald-500/50 bg-emerald-950/20 p-5 flex flex-col justify-between relative shadow-md">
            <div class="absolute -top-2.5 right-3 rounded-full bg-emerald-500 px-2 py-0.2 text-[9px] font-bold text-slate-950 uppercase">
              Popular
            </div>
            <div>
              <div class="text-sm font-bold text-white">Pro Developer</div>
              <div class="mt-1 text-2xl font-extrabold text-emerald-400">$19<span class="text-xs text-slate-400 font-normal">/mo</span></div>
              <p class="mt-2 text-xs text-slate-300">3 runners, unlimited projects, 90-day retention.</p>
            </div>
            <Link href="/pricing" class="mt-5 block text-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition">
              Upgrade to Pro →
            </Link>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Team / Startup</div>
              <div class="mt-1 text-2xl font-extrabold text-white">$49<span class="text-xs text-slate-400 font-normal">/mo</span></div>
              <p class="mt-2 text-xs text-slate-400">10 runners, 10 seats, shared secret vaults.</p>
            </div>
            <Link href="/pricing" class="mt-5 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              View Team Plan →
            </Link>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Enterprise</div>
              <div class="mt-1 text-2xl font-extrabold text-white">Custom</div>
              <p class="mt-2 text-xs text-slate-400">Unlimited scale, SAML SSO, 99.99% SLA.</p>
            </div>
            <Link href="/pricing" class="mt-5 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              Contact Sales →
            </Link>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER (Page-Based Navigation) -->
    <footer class="border-t border-slate-800/80 bg-slate-950 px-6 py-10 text-xs text-slate-400">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-5 w-5 rounded-md object-contain" />
          <span class="font-bold text-slate-200">Midnight Hub</span>
          <span>· Supervised Vibe Coding & AI Orchestrator</span>
        </div>
        <div class="flex items-center gap-5 text-slate-300">
          <Link href="/tasks" class="hover:text-emerald-400 transition-colors">Workspace</Link>
          <Link href="/projects" class="hover:text-emerald-400 transition-colors">Projects</Link>
          <Link href="/desktop" class="hover:text-emerald-400 transition-colors">Desktop</Link>
          <Link href="/pricing" class="hover:text-emerald-400 transition-colors">Pricing</Link>
          <a href="https://github.com/macatung/task-hub" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">GitHub</a>
        </div>
        <p>© 2026 Macatung Dev. Released under the MIT License.</p>
      </div>
    </footer>
  </div>
</template>
