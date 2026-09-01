<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePage, Head, Link } from '@inertiajs/vue3';
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
const activePipelineTab = ref<'discovery' | 'implement' | 'evidence' | 'review'>('evidence');

const pipelineStages = [
  {
    id: 'discovery',
    num: '01',
    name: 'AI Discovery',
    tag: 'Context Pack',
    icon: 'Sparkles',
    desc: 'Transform natural language prompts into structured Agile Backlogs (Epics, Stories, Tasks) with precise Acceptance Criteria and Definitions of Done.',
    codeTitle: 'discovery_output.json',
    codeLang: 'json',
    codeContent: `{
  "discovery_id": "disc_8f902a11",
  "source_prompt": "Build MCP Gateway connecting Claude & Antigravity",
  "living_context_docs": [
    "docs/ARCHITECTURE-CURRENT.md (Fresh, modified 2d ago)",
    "docs/FUNCTIONAL_SPECIFICATION.md (task-hub-docs-v1)"
  ],
  "stale_docs_detected": 0,
  "generated_backlog": {
    "epic": "EPIC-14: Model Context Protocol Gateway v2024-11-05",
    "tasks": [
      {
        "issue_key": "HUB-108",
        "title": "Implement JSON-RPC 2.0 MCP Transport over SSE",
        "acceptance_criteria": ["Handle initialize, tools/list, tools/call", "Auth via workspace pairing token"],
        "definition_of_done": ["Unit tests >= 95% branch coverage", "Passing OpenAPI contract validation"]
      }
    ]
  }
}`
  },
  {
    id: 'implement',
    num: '02',
    name: 'Git Worktree',
    tag: 'Multi-Agent',
    icon: 'GitBranch',
    desc: 'AI agents (Antigravity, Codex, Claude Code) operate in isolated Git worktrees, protecting the main branch and eliminating merge conflicts.',
    codeTitle: 'runner_worktree_spawn.sh',
    codeLang: 'bash',
    codeContent: `[10:44:02] $ cao workflow run --profile code_supervisor --task HUB-108
[10:44:03] 🌿 Git Worktree initialized at: .worktrees/task-HUB-108-mcp-transport
[10:44:04] 🤖 Dispatched to Agent Provider: Google Antigravity 2.0 (Gemini 3.7 Pro)
[10:44:06] 📦 Loaded Context Pack: 4 files (Contract: task-hub.openapi.yaml)
[10:44:08] ✍️ Modified 3 files in sandbox:
             - apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php (+84 lines)
             - apps/hub/routes/web.php (+12 lines)
             - packages/contracts/openapi/mcp-schema.json (+45 lines)
[10:44:10] 🛡️ Sandbox Check: Zero destructive shell calls. All edits inside worktree.`
  },
  {
    id: 'evidence',
    num: '03',
    name: 'Test Evidence',
    tag: 'Zero Defects',
    icon: 'CheckCircle',
    desc: 'Automated test execution with mandatory reproducible evidence (logs, pass/fail counts, risk scores) prior to handoff.',
    codeTitle: 'verification_evidence.json',
    codeLang: 'json',
    codeContent: `{
  "task_id": "HUB-108",
  "actor": {
    "type": "agent_runner",
    "model": "antigravity/gemini-3.7-pro",
    "runner_id": "runner-desktop-win11-01"
  },
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
    "duration_ms": 348,
    "status": "PASSED"
  },
  "handoff_state": "needs_review"
}`
  },
  {
    id: 'review',
    num: '04',
    name: 'Human Approval',
    tag: 'Zero Mutation',
    icon: 'Shield',
    desc: 'Tech leads inspect AST diffs, actor attribution, and test logs; 1-click approve or request refinements.',
    codeTitle: 'tech_lead_audit_trail.log',
    codeLang: 'log',
    codeContent: `[10:44:22] 🔔 Notification: Task HUB-108 submitted for Human Review.
[10:44:23] 👤 Reviewer: Lead Architect (Tech Lead / Workspace Owner)
[10:44:25] 🔍 Diff Inspector: 3 files changed (+141, -0). 14/14 Automated Tests Verified.
[10:44:28] 🛡️ Actor Attribution: Commits tagged with [Agent: Antigravity 2.0] & [Supervisor: CAO].
[10:44:30] ✅ Action: HUMAN APPROVE (Zero Unsupervised Mutation Policy Enforced)
[10:44:31] 🚀 Merged branch 'task/HUB-108' to 'main'. Task marked as COMPLETED.`
  }
];

import SeoHead from '@/Components/common/SeoHead.vue';

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
      'description': 'Supervised Vibe Coding Engine & Autonomous AI Agent Orchestrator for Antigravity 2.0, Codex, Claude Code.',
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
    description="Transform Vibe Coding into a rigorous, professional software engineering workflow. Orchestrate Antigravity 2.0, Codex, Claude Code in isolated Git worktrees with Verification Evidence."
    keywords="Midnight Hub, Supervised Vibe Coding, AI Coding Agents, Antigravity 2.0, Claude Code, Verification Evidence, MCP Gateway, Git Worktree, Agile Backlog"
    canonical="https://midnight.macatung.dev"
    :json-ld="hubJsonLd"
  />

  <div class="hub-landing min-h-screen bg-midnight-950 text-slate-100 font-sans selection:bg-phantom-mint selection:text-midnight-950 overflow-x-hidden">
    <!-- Ambient Background Glows -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[1000px] rounded-full bg-gradient-to-tr from-emerald-600/15 via-phantom-cyan/15 to-phantom-purple/10 blur-[140px]" />
      <div class="absolute top-[700px] -left-40 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-phantom-blue/10 via-phantom-purple/15 to-transparent blur-[130px]" />
      <div class="absolute bottom-10 -right-40 h-[600px] w-[800px] rounded-full bg-gradient-to-tl from-talisman-gold/10 via-emerald-600/15 to-transparent blur-[150px]" />
    </div>

    <!-- Sticky Navigation Header -->
    <header class="sticky top-0 z-50 border-b border-midnight-800/80 bg-midnight-950/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" class="flex items-center gap-3 group">
          <div class="relative inline-flex h-10 w-10 items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/40 p-1 shadow-md shadow-emerald-500/10 group-hover:border-emerald-400 group-hover:scale-105 transition-all">
            <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-full w-full object-contain drop-shadow-sm" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors font-['Space_Grotesk']">Midnight Hub</span>
            <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">MDNT</span>
          </div>
        </a>

        <!-- Nav Links -->
        <nav class="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#vibe-coding" class="hover:text-phantom-mint transition-colors">Vibe Coding Hub</a>
          <a href="#comparison" class="hover:text-phantom-mint transition-colors">Comparison</a>
          <a href="#features" class="hover:text-phantom-mint transition-colors">3 Pillars</a>
          <a href="#pipeline" class="hover:text-phantom-mint transition-colors">Strict 4-Step Flow</a>
          <Link href="/desktop" class="hover:text-phantom-mint transition-colors flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Desktop App</span>
          </Link>
          <Link href="/pricing" class="hover:text-emerald-400 font-semibold transition-colors">Pricing</Link>
        </nav>

        <!-- Action / Auth -->
        <div class="flex items-center gap-3">
          <a
            href="https://github.com/macatung/task-hub"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-all shrink-0"
          >
            <Icons name="Github" :size="15" />
            <span>GitHub</span>
          </a>

          <template v-if="user">
            <Link
              href="/tasks"
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shrink-0"
            >
              <span>Open Workspace</span>
              <span>→</span>
            </Link>
          </template>
          <template v-else>
            <a
              href="/auth/github"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Icons name="Github" :size="15" />
              <span>Sign in with GitHub</span>
            </a>
          </template>

          <!-- Mobile Hamburger Toggle Button -->
          <button
            type="button"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="inline-flex lg:hidden items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white shrink-0 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <Icons :name="mobileMenuOpen ? 'X' : 'Menu'" :size="20" />
          </button>
        </div>
      </div>

      <!-- Mobile Nav Drawer -->
      <div v-if="mobileMenuOpen" class="lg:hidden border-t border-slate-800 bg-slate-950 px-6 py-4 space-y-3">
        <a href="#vibe-coding" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Vibe Coding Hub</a>
        <a href="#comparison" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Comparison</a>
        <a href="#features" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">3 Pillars</a>
        <a href="#pipeline" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Strict 4-Step Flow</a>
        <Link href="/desktop" @click="mobileMenuOpen = false" class="block text-sm text-slate-300 hover:text-white">Desktop App</Link>
        <Link href="/pricing" @click="mobileMenuOpen = false" class="block text-sm text-emerald-400 font-bold">Pricing</Link>
        <div class="pt-3 border-t border-slate-800 flex flex-col gap-2">
          <template v-if="user">
            <Link href="/tasks" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-slate-950">Open Workspace</Link>
          </template>
          <template v-else>
            <a href="/auth/github" class="rounded-xl bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-slate-950 flex items-center justify-center gap-2">
              <Icons name="Github" :size="15" />
              <span>Sign in with GitHub</span>
            </a>
          </template>
        </div>
      </div>
    </header>

    <!-- Flash Alerts -->
    <div v-if="flash.error" class="relative z-10 mx-auto max-w-5xl px-6 pt-4">
      <div class="rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-xs text-red-200 backdrop-blur">
        ⚠️ {{ flash.error }}
      </div>
    </div>

    <!-- HERO SECTION -->
    <section id="vibe-coding" class="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-20 text-center">
      <!-- Top Announcement Pill -->
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-inner">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="font-mono uppercase tracking-wider">Supervised Vibe Coding Engine 2.0</span>
      </div>

      <!-- Main Headline -->
      <h1 class="mt-8 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
        Vibe Code at High Velocity.<br />
        <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
          Zero Regressions, Strict Standards & Verification Evidence.
        </span>
      </h1>

      <!-- Subtitle -->
      <p class="mx-auto mt-6 max-w-3xl text-base sm:text-lg md:text-xl text-slate-300 leading-relaxed font-normal">
        Elevate <strong class="text-white">Vibe Coding</strong> from ad-hoc prompting into a <strong class="text-phantom-mint">rigorous engineering discipline</strong>. Automatically synthesize Agile Backlogs from codebase context, orchestrate Antigravity 2.0, Codex, Claude Code across isolated Git worktrees, and enforce quality via a mandatory 4-step lifecycle with reproducible <strong class="text-cyan-300">Verification Evidence</strong>.
      </p>

      <!-- CTA Button Group -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="/auth/github"
          class="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Icons name="Sparkles" :size="18" />
          <span>Start Vibe Coding Free</span>
          <span>→</span>
        </a>
        <Link
          href="/desktop"
          class="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-sm font-semibold text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
        >
          <Icons name="Desktop" :size="18" />
          <span>Download Desktop Companion</span>
        </Link>
        <Link
          href="/tasks"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          <span>Explore Workspace</span>
          <span>→</span>
        </Link>
      </div>

      <div class="mt-5 flex items-center justify-center gap-6 text-xs text-slate-400 font-mono">
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> Zero Unsupervised Mutations</span>
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> Git Worktree Isolation</span>
        <span class="flex items-center gap-1.5"><Icons name="Check" :size="14" class="text-emerald-400" /> 100% Actor Attribution</span>
      </div>

      <!-- INTERACTIVE PIPELINE SIMULATOR MOCKUP -->
      <div class="mt-14 overflow-hidden rounded-2xl border border-midnight-800/90 bg-midnight-900/80 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 text-left">
        <!-- Mockup Top Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <div class="h-3 w-3 rounded-full bg-red-500/80"></div>
              <div class="h-3 w-3 rounded-full bg-yellow-500/80"></div>
              <div class="h-3 w-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <span class="text-xs font-mono text-slate-400 font-semibold">Midnight Hub Supervised Pipeline Engine</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400 font-bold">
              ● WORKFLOW: STRICT_V1
            </span>
          </div>
        </div>

        <!-- 4 Pipeline Tabs -->
        <div class="grid grid-cols-2 md:grid-cols-4 border-b border-slate-800/80 bg-slate-950/40">
          <button
            v-for="stage in pipelineStages"
            :key="stage.id"
            @click="activePipelineTab = stage.id as any"
            type="button"
            class="flex items-center gap-2.5 px-4 py-3 text-left transition-all border-b-2 text-xs font-mono cursor-pointer"
            :class="[
              activePipelineTab === stage.id
                ? 'border-emerald-400 bg-emerald-500/10 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            ]"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded text-[10px] font-bold"
              :class="activePipelineTab === stage.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'"
            >
              {{ stage.num }}
            </span>
            <div class="truncate">
              <div class="truncate font-semibold">{{ stage.name }}</div>
              <div class="text-[10px] text-slate-400 truncate">{{ stage.tag }}</div>
            </div>
          </button>
        </div>

        <!-- Stage Content Body -->
        <div class="p-4 sm:p-6 grid lg:grid-cols-12 gap-6 items-start">
          <div class="lg:col-span-5 space-y-4">
            <div class="inline-flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1 text-xs font-mono text-emerald-400 border border-slate-700">
              <Icons :name="currentPipelineData.icon" :size="14" />
              <span>Stage {{ currentPipelineData.num }}: {{ currentPipelineData.name }}</span>
            </div>

            <h3 class="text-xl font-bold text-white leading-snug">
              {{ currentPipelineData.name }} — {{ currentPipelineData.tag }}
            </h3>

            <p class="text-sm text-slate-300 leading-relaxed">
              {{ currentPipelineData.desc }}
            </p>

            <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2 text-xs font-mono">
              <div class="flex items-center justify-between text-slate-400">
                <span>Status:</span>
                <span class="text-emerald-400 font-bold">● Active Sandbox</span>
              </div>
              <div class="flex items-center justify-between text-slate-400">
                <span>Guardrails:</span>
                <span class="text-cyan-400 font-bold">100% Enforced</span>
              </div>
              <div class="flex items-center justify-between text-slate-400">
                <span>Reference Context:</span>
                <span class="text-purple-400 font-bold">task-hub-docs-v1</span>
              </div>
            </div>
          </div>

          <div class="lg:col-span-7">
            <div class="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs shadow-inner overflow-x-auto">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3 text-slate-400 text-[11px]">
                <span class="text-emerald-400">{{ currentPipelineData.codeTitle }}</span>
                <span class="text-slate-400 uppercase">{{ currentPipelineData.codeLang }}</span>
              </div>
              <pre class="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap selection:bg-emerald-500 selection:text-slate-950">{{ currentPipelineData.codeContent }}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: CHAOTIC VIBE CODING VS MIDNIGHT HUB -->
    <section id="comparison" class="relative z-10 border-t border-slate-800/80 bg-slate-900/40 py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Revolutionary Paradigm</p>
          <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Chaotic Vibe Coding vs. Supervised Vibe Coding on Midnight Hub
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Vibe coding enables rapid ideation, but a lack of discipline produces code bloat and subtle regressions. Midnight Hub preserves full speed while adding enterprise-grade engineering standards.
          </p>
        </div>

        <div class="mt-16 grid gap-8 md:grid-cols-2">
          <!-- Column 1: Chaotic Vibe Coding -->
          <div class="rounded-2xl border border-red-500/20 bg-red-950/10 p-6 sm:p-8 backdrop-blur relative">
            <div class="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-mono text-red-400 font-bold">
              <span>✕ CHAOTIC VIBE CODING (CHAT / COPY-PASTE)</span>
            </div>
            <h3 class="mt-4 text-xl font-bold text-white">Fast initial velocity, unmaintainable aftermath</h3>
            
            <ul class="mt-6 space-y-4 text-sm text-slate-300">
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">✕</span>
                <div>
                  <strong class="text-red-200">AI Hallucinations:</strong> Without structured architectural context, models fabricate functions, call invalid APIs, and break existing patterns.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">✕</span>
                <div>
                  <strong class="text-red-200">Direct Mutations on Main:</strong> Lack of isolated worktrees causes constant Git conflicts and overwrites active teammate work.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">✕</span>
                <div>
                  <strong class="text-red-200">No Verification Gates:</strong> Code looks plausible on the surface, but slips critical logic flaws and security vulnerabilities into production.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">✕</span>
                <div>
                  <strong class="text-red-200">Zero Attribution & Audit:</strong> Impossible to trace which commit was authored by which model, lacking handoff documentation for maintainability.
                </div>
              </li>
            </ul>
          </div>

          <!-- Column 2: Midnight Hub Supervised Vibe Coding -->
          <div class="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 to-slate-950/80 p-6 sm:p-8 backdrop-blur relative shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/30">
            <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400 font-bold">
              <span>✓ MIDNIGHT HUB SUPERVISED VIBE CODING</span>
            </div>
            <h3 class="mt-4 text-xl font-bold text-white">Maximum velocity, absolute engineering rigor</h3>
            
            <ul class="mt-6 space-y-4 text-sm text-slate-200">
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-0.5">✓</span>
                <div>
                  <strong class="text-emerald-300">Living Context Pack:</strong> Ingests verified architecture specifications with freshness alerts (&gt;30d), eliminating hallucinations.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-0.5">✓</span>
                <div>
                  <strong class="text-emerald-300">Git Worktree Sandbox:</strong> Runs concurrent agent swarms in isolated worktrees, guaranteeing main branch safety.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-0.5">✓</span>
                <div>
                  <strong class="text-emerald-300">Mandatory Verification Evidence:</strong> Requires 100% passing test suites and machine-readable logs before allowing task handoff.
                </div>
              </li>
              <li class="flex items-start gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-0.5">✓</span>
                <div>
                  <strong class="text-emerald-300">Actor Attribution & Human Gate:</strong> Full human vs. model attribution per commit; final approval authority remains strictly with engineering leads.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: 3 CORE PILLARS BENTO GRID -->
    <section id="features" class="relative z-10 py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Foundational Architecture</p>
          <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Faster Velocity — Fewer Regressions — Strict Standards
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Every capability in Midnight Hub is engineered around the modern software engineering quality triangle.
          </p>
        </div>

        <div class="mt-16 grid gap-6 md:grid-cols-3">
          <!-- Pillar 1: Faster Velocity -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-7 hover:border-emerald-500/50 hover:bg-slate-900/60 transition-all">
            <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Icons name="Zap" :size="24" />
            </div>
            <h3 class="mt-5 text-lg font-bold text-white flex items-center gap-2">
              <span>1. Faster Velocity</span>
            </h3>
            <p class="mt-1 text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">Velocity & Flow State</p>
            <ul class="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <li class="flex items-start gap-2">
                <span class="text-emerald-400 mt-0.5 font-bold">▸</span>
                <span><strong>AI Requirement Discovery:</strong> Decompose user prompts into Epics, User Stories, Tasks, and Bugs in seconds.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-emerald-400 mt-0.5 font-bold">▸</span>
                <span><strong>Multi-Agent Swarm:</strong> Concurrently orchestrate Antigravity 2.0, Codex, Claude Code, and AWS Labs CAO.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-emerald-400 mt-0.5 font-bold">▸</span>
                <span><strong>Git Worktree Multitasking:</strong> Test multiple features in parallel without repository lock-in.</span>
              </li>
            </ul>
          </div>

          <!-- Pillar 2: Fewer Regressions -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-7 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all">
            <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
              <Icons name="Shield" :size="24" />
            </div>
            <h3 class="mt-5 text-lg font-bold text-white flex items-center gap-2">
              <span>2. Fewer Regressions</span>
            </h3>
            <p class="mt-1 text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">Verification & Absolute Safety</p>
            <ul class="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <li class="flex items-start gap-2">
                <span class="text-cyan-400 mt-0.5 font-bold">▸</span>
                <span><strong>Strict 4-Step Pipeline:</strong> Deterministic lifecycle: <code>Implement ➔ Review ➔ Evidence ➔ Handoff</code>.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-cyan-400 mt-0.5 font-bold">▸</span>
                <span><strong>Verification Evidence Schema:</strong> Enforce test suite passes and persist reproducible audit logs.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-cyan-400 mt-0.5 font-bold">▸</span>
                <span><strong>Sandbox Execution Policies:</strong> Block destructive shell commands and unapproved merges.</span>
              </li>
            </ul>
          </div>

          <!-- Pillar 3: Strict Standards -->
          <div class="group rounded-2xl border border-slate-800 bg-slate-950/80 p-7 hover:border-purple-500/50 hover:bg-slate-900/60 transition-all">
            <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
              <Icons name="BookOpen" :size="24" />
            </div>
            <h3 class="mt-5 text-lg font-bold text-white flex items-center gap-2">
              <span>3. Strict Standards</span>
            </h3>
            <p class="mt-1 text-xs font-mono text-purple-400 uppercase tracking-wider font-semibold">Standardized Knowledge & Architecture</p>
            <ul class="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <li class="flex items-start gap-2">
                <span class="text-purple-400 mt-0.5 font-bold">▸</span>
                <span><strong>Living Context Pack:</strong> Documentation governance under <code>task-hub-docs-v1</code> with stale doc detection.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-purple-400 mt-0.5 font-bold">▸</span>
                <span><strong>MCP 2024-11-05 Standard:</strong> 9 standardized MCP tools powering two-way communication across AI IDEs.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-purple-400 mt-0.5 font-bold">▸</span>
                <span><strong>Actor Attribution Audit:</strong> 100% transparency on human vs. AI author identity with ISO 8601 timestamps.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: STRICT 4-STEP PIPELINE -->
    <section id="pipeline" class="relative z-10 border-t border-slate-800/80 bg-slate-900/30 py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Deterministic Execution Lifecycle</p>
          <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Mandatory 4-Step Execution Workflow (Strict Pipeline)
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Every agent run must satisfy strict JSON Schema contracts before advancing to human review.
          </p>
        </div>

        <div class="mt-16 grid gap-6 md:grid-cols-4 text-left">
          <div class="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 relative">
            <span class="text-3xl font-black text-emerald-500/40 font-mono">01</span>
            <h3 class="mt-3 text-base font-bold text-white flex items-center gap-2">
              <span>Implement</span>
            </h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Agent consumes Context Pack, analyzes Acceptance Criteria, and generates code in an isolated Git worktree.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400">
              Contract: modified_files, change_summary
            </div>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 relative">
            <span class="text-3xl font-black text-blue-500/40 font-mono">02</span>
            <h3 class="mt-3 text-base font-bold text-white flex items-center gap-2">
              <span>Review</span>
            </h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Automated risk scoring, static analysis, linting, and structural design violation checks.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-blue-400">
              Contract: verdict, feedback, risk_score
            </div>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 relative">
            <span class="text-3xl font-black text-purple-500/40 font-mono">03</span>
            <h3 class="mt-3 text-base font-bold text-white flex items-center gap-2">
              <span>Evidence</span>
            </h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Executes test suites. If tests fail or review is rejected, the pipeline blocks immediately and requests remediation.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-purple-400">
              Contract: tests, pass/fail counts, status
            </div>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 relative">
            <span class="text-3xl font-black text-cyan-500/40 font-mono">04</span>
            <h3 class="mt-3 text-base font-bold text-white flex items-center gap-2">
              <span>Handoff</span>
            </h3>
            <p class="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Packages changes with reproducible evidence. Advances state to <code>needs_review</code> for human sign-off.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-cyan-400">
              Contract: summary, tests, human_approve
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: DESKTOP CONTROL CENTER BANNER -->
    <section class="relative z-10 py-20 bg-gradient-to-r from-emerald-950/40 via-midnight-900 to-slate-950 border-t border-slate-800/80">
      <div class="mx-auto max-w-6xl px-6 grid md:grid-cols-12 gap-8 items-center">
        <div class="md:col-span-7 space-y-4">
          <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400 font-bold">
            <Icons name="Desktop" :size="14" />
            <span>MIDNIGHT HUB DESKTOP COMPANION</span>
          </div>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Orchestrate Autonomous AI Agents Directly on Your Machine
          </h2>
          <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
            Electron desktop app for Windows with built-in AWS Labs CAO, automatic MCP configuration, instant audio feedback, and low-latency real-time log streaming.
          </p>
          <div class="pt-2 flex flex-wrap gap-3">
            <Link
              href="/desktop"
              class="inline-flex items-center gap-2 rounded-xl bg-phantom-mint px-5 py-3 font-bold text-midnight-950 shadow-glow-mint hover:bg-emerald-300 transition cursor-pointer"
            >
              <Icons name="Desktop" :size="16" />
              <span>Download for Windows (Free)</span>
              <span>→</span>
            </Link>
            <a
              href="https://github.com/macatung/code-at-midnight/releases"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-slate-200 hover:border-slate-600 hover:text-white transition"
            >
              <span>View Changelog</span>
            </a>
          </div>
        </div>

        <div class="md:col-span-5">
          <div class="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 font-mono text-xs shadow-2xl space-y-3">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400">
              <span class="text-emerald-400 font-bold">● DESKTOP CONTROL CENTER</span>
              <span class="text-[10px]">ELECTRON 34.2</span>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between text-slate-300">
                <span>CAO Daemon Status:</span>
                <span class="text-emerald-400 font-bold">Active in WSL</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Connected Agent:</span>
                <span class="text-cyan-400 font-bold">Antigravity 2.0</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Active Worktree:</span>
                <span class="text-purple-400 font-mono">.worktrees/task-108</span>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Sandbox Security:</span>
                <span class="text-emerald-400 font-bold">Strict (0 Leaks)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: PRICING TEASER -->
    <section class="relative z-10 border-t border-slate-800/80 bg-slate-950 py-20">
      <div class="mx-auto max-w-6xl px-6 text-center">
        <p class="text-xs font-bold tracking-wider uppercase text-emerald-400 font-mono">Flexible Plans</p>
        <h2 class="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Start Free, Scale with Your Engineering Squad
        </h2>
        <p class="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
          From solo open-source vibe coders to enterprise engineering teams coordinating autonomous multi-agent swarms.
        </p>

        <div class="mt-12 grid gap-6 md:grid-cols-4 text-left">
          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Community</div>
              <div class="mt-2 text-2xl font-extrabold text-white">$0</div>
              <p class="mt-2 text-xs text-slate-400">For individuals & open source. 1 local runner, 3 active projects.</p>
            </div>
            <Link href="/pricing" class="mt-6 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              Details →
            </Link>
          </div>

          <div class="rounded-2xl border border-emerald-500/50 bg-emerald-950/20 p-5 flex flex-col justify-between relative shadow-lg shadow-emerald-950/20">
            <div class="absolute -top-3 right-4 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 uppercase">
              Popular
            </div>
            <div>
              <div class="text-sm font-bold text-white">Pro Developer</div>
              <div class="mt-2 text-2xl font-extrabold text-emerald-400">$19<span class="text-xs text-slate-400 font-normal">/month</span></div>
              <p class="mt-2 text-xs text-slate-300">3 concurrent runners, unlimited projects, 90-day evidence retention.</p>
            </div>
            <Link href="/pricing" class="mt-6 block text-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition">
              Upgrade to Pro →
            </Link>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Team / Startup</div>
              <div class="mt-2 text-2xl font-extrabold text-white">$49<span class="text-xs text-slate-400 font-normal">/month</span></div>
              <p class="mt-2 text-xs text-slate-400">10 concurrent runners, 10 team seats, RBAC and shared secret vault.</p>
            </div>
            <Link href="/pricing" class="mt-6 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              Details →
            </Link>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between">
            <div>
              <div class="text-sm font-bold text-white">Enterprise</div>
              <div class="mt-2 text-2xl font-extrabold text-white">Custom</div>
              <p class="mt-2 text-xs text-slate-400">Unlimited runners, SAML SSO, dedicated security policies, and 99.99% SLA.</p>
            </div>
            <Link href="/pricing" class="mt-6 block text-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              Contact Enterprise →
            </Link>
          </div>
        </div>
      </div>
    </section>

    <!-- BOTTOM CTA BANNER -->
    <section class="relative z-10 border-t border-slate-800/80 bg-gradient-to-b from-slate-950 to-slate-900 py-20 text-center">
      <div class="mx-auto max-w-4xl px-6">
        <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Ready to Bring Rigor to Vibe Coding?
        </h2>
        <p class="mt-4 text-base sm:text-lg text-slate-300">
          Join top engineers using Midnight Hub to build faster, eliminate regressions, and maintain complete quality control.
        </p>

        <div class="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="/auth/github"
            class="inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
          >
            <Icons name="Github" :size="18" />
            <span>Sign In with GitHub</span>
            <span>→</span>
          </a>
          <Link
            href="/desktop"
            class="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Icons name="Desktop" :size="18" />
            <span>Download Desktop Companion</span>
          </Link>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="border-t border-slate-800/80 bg-slate-950 px-6 py-12 text-xs text-slate-400">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
        <div class="flex items-center gap-2.5">
          <img src="/brand/midnight-hub-mark.svg?v=20260829" alt="Midnight Hub" class="h-6 w-6 rounded-lg object-contain" />
          <span class="font-bold text-slate-200">Midnight Hub</span>
          <span>· Supervised Vibe Coding & AI Orchestrator</span>
        </div>
        <div class="flex items-center gap-6 text-slate-300">
          <Link href="/pricing" class="hover:text-emerald-400 transition-colors font-medium">Pricing</Link>
          <Link href="/desktop" class="hover:text-emerald-400 transition-colors font-medium">Desktop App</Link>
          <a href="#vibe-coding" class="hover:text-white transition-colors">Vibe Coding</a>
          <a href="#comparison" class="hover:text-white transition-colors">Comparison</a>
          <a href="https://github.com/macatung/task-hub" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">GitHub</a>
        </div>
        <p>© 2026 Macatung Dev. Released under the MIT License.</p>
      </div>
    </footer>
  </div>
</template>
