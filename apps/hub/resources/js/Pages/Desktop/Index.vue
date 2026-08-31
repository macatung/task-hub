<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import Icons from '@/Components/ui/Icons.vue';
import { Link } from '@inertiajs/vue3';

const downloadUrl = 'https://github.com/macatung/code-at-midnight/releases/latest/download/Task-Companion-Setup.exe';
const releaseUrl = 'https://github.com/macatung/code-at-midnight/releases/latest';

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Midnight Hub Desktop Companion',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows 10, Windows 11',
  description: 'Desktop companion application orchestrating Supervised Vibe Coding and Autonomous AI Coding Agents (Antigravity 2.0, Codex, Claude Code, CAO) in isolated Git worktree environments.',
  downloadUrl,
  softwareVersion: '2.0.0',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};
</script>

<template>
  <SeoHead
    title="Midnight Hub Desktop — Supervised Vibe Coding & Local AI Agent Studio"
    description="Download Midnight Hub Desktop Companion for Windows: High-velocity vibe coding, Git worktree isolation, automated Context Pack ingestion, Verification Evidence generation, and seamless Antigravity 2.0, Codex, Claude Code orchestration."
    keywords="Midnight Hub Desktop, Supervised Vibe Coding, Antigravity 2.0, Codex, Claude Code, AWS Labs CAO, Git Worktree, Verification Evidence, MCP"
    canonical="https://macatung.dev/desktop"
    :json-ld="productJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col relative overflow-x-hidden bg-grid-pattern">
    <TalismanCanvas />
    <Navbar variant="midnight" />

    <main class="relative z-10 flex-1">
      <!-- HERO SECTION -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div class="grid lg:grid-cols-[1.15fr_.85fr] gap-12 items-center">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-phantom-mint/30 bg-phantom-mint/10 px-3.5 py-1 text-xs font-mono text-phantom-mint">
              <span class="h-2 w-2 rounded-full bg-phantom-mint shadow-glow-mint" />
              <span>SUPERVISED VIBE CODING DESKTOP STUDIO</span>
            </div>

            <h1 class="mt-6 text-4xl sm:text-6xl font-display font-black tracking-tight text-white leading-[1.1]">
              Local Vibe Coding.<br />
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-teal-300">
                Absolute Safety, Zero Regressions & Strict Standards.
              </span>
            </h1>

            <p class="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
              Midnight Hub Desktop bridges your web task backlog directly to your workstation. Dispatch <strong>Antigravity 2.0</strong>, <strong>Codex</strong>, <strong>Claude Code</strong>, and <strong>AWS Labs CAO</strong> across <strong>isolated Git worktrees</strong>—automatically executing test suites, generating reproducible <span class="text-cyan-300 font-semibold">Verification Evidence</span>, and completely eliminating merge conflicts.
            </p>

            <div class="mt-8 flex flex-wrap gap-4 items-center">
              <a
                :href="downloadUrl"
                class="inline-flex items-center gap-2.5 rounded-xl bg-phantom-mint px-6 py-3.5 font-bold text-midnight-950 shadow-glow-mint transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                <Icons name="Desktop" :size="18" />
                <span>Download for Windows (64-bit)</span>
              </a>
              <Link
                href="/tasks"
                class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-bold text-white transition hover:border-phantom-mint/50 hover:bg-white/10"
              >
                <span>Open Web Workspace →</span>
              </Link>
            </div>

            <div class="mt-5 flex items-center gap-6 text-xs text-slate-400 font-mono">
              <span>Windows 10/11 x64</span>
              <span>·</span>
              <span>100% Free</span>
              <span>·</span>
              <span>Auto-updated via GitHub Releases</span>
            </div>
          </div>

          <!-- Live Desktop Terminal Simulation Card -->
          <div class="relative rounded-3xl border border-phantom-mint/20 bg-midnight-900/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl ring-1 ring-white/10">
            <div class="absolute -inset-8 -z-10 rounded-full bg-phantom-mint/10 blur-3xl" />
            <div class="rounded-2xl border border-white/10 bg-midnight-950/95 p-5 font-mono text-xs shadow-inner space-y-4">
              <!-- Window Header -->
              <div class="flex items-center justify-between border-b border-white/10 pb-3 text-slate-400">
                <div class="flex items-center gap-2">
                  <div class="h-2.5 w-2.5 rounded-full bg-red-500/80"></div>
                  <div class="h-2.5 w-2.5 rounded-full bg-yellow-500/80"></div>
                  <div class="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></div>
                  <span class="ml-1 text-[11px] text-slate-400">Task Companion v2.0.0</span>
                </div>
                <span class="text-phantom-mint font-bold">● SUPERVISOR ACTIVE</span>
              </div>

              <!-- Task & Worktree Info -->
              <div class="space-y-2">
                <div class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Work Item Active</div>
                <div class="text-sm font-bold text-white flex items-center justify-between">
                  <span>HUB-108: SSE MCP Transport Gate</span>
                  <span class="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 font-mono">IN PROGRESS</span>
                </div>
                <div class="text-[11px] text-purple-300">
                  🌿 Worktree: <code class="text-slate-300">.worktrees/task-HUB-108</code>
                </div>
              </div>

              <!-- Provider Badges Grid -->
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div class="text-[10px] text-slate-400">AI Provider</div>
                  <div class="mt-0.5 text-amber-300 font-bold">Antigravity 2.0</div>
                </div>
                <div class="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div class="text-[10px] text-slate-400">Workflow State</div>
                  <div class="mt-0.5 text-emerald-300 font-bold">evidence_valid</div>
                </div>
              </div>

              <!-- Verification Evidence Proof Box -->
              <div class="rounded-lg border border-phantom-mint/30 bg-phantom-mint/5 p-3 text-[11px] leading-relaxed text-slate-300 space-y-1">
                <div class="text-phantom-mint font-bold">✓ Verification Evidence Summary:</div>
                <div>• Living Context Pack loaded (Freshness: 100%)</div>
                <div>• Unit Tests: 14 passed / 0 failed (348ms)</div>
                <div>• Risk Score: 0.04 (Low) · Actor: agent_runner</div>
                <div>• Sandbox Mutation Check: Passed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4 KEY PILLARS FOR DESKTOP VIBE CODING -->
      <section class="border-y border-white/5 bg-black/30 py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto mb-12">
            <p class="font-mono text-xs uppercase tracking-[.25em] text-phantom-mint">Core Capabilities</p>
            <h2 class="mt-2 text-3xl font-display font-bold text-white">
              Why Engineers Choose Midnight Hub Desktop for Vibe Coding
            </h2>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-phantom-mint/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-emerald-500/10 text-emerald-400 text-2xl mb-4">
                <Icons name="GitBranch" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Isolated Git Worktrees</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Agents mutate code exclusively in independent worktree branches. Continue editing on main without interference or lockouts.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-cyan-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-cyan-500/10 text-cyan-400 text-2xl mb-4">
                <Icons name="CheckCircle" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Automated Test Evidence</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Enforces local automated test execution, capturing machine-readable logs and risk scoring before handoff.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-purple-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-purple-500/10 text-purple-400 text-2xl mb-4">
                <Icons name="Cpu" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Multi-Agent Orchestration</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Native integrations for AWS Labs CAO, Antigravity 2.0, Codex, and Claude Code with real-time execution and token telemetry.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-amber-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-amber-500/10 text-amber-400 text-2xl mb-4">
                <Icons name="Shield" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Zero-Leak Security</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Your source code stays 100% on your local disk. Sensitive proprietary code is never sent to third-party clouds, protecting enterprise IP.
              </p>
            </article>
          </div>
        </div>
      </section>

      <!-- 4-STEP DESKTOP EXECUTION FLOW -->
      <section class="max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div class="text-center">
          <p class="font-mono text-xs uppercase tracking-[.25em] text-phantom-mint">Deterministic Workflow</p>
          <h2 class="mt-3 text-3xl font-display font-bold text-white">From Task Ingestion to Verified Review</h2>
          <p class="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
            A closed-loop lifecycle engineered for velocity without sacrificing architectural integrity.
          </p>
        </div>

        <div class="mt-12 grid gap-4 md:grid-cols-4">
          <div
            v-for="(step, index) in [
              { title: '1. Ingest Task & Context', desc: 'Select work item from Hub; automatically loads Context Pack and docs/ architectural specifications.' },
              { title: '2. Provision Git Worktree', desc: 'Spawns isolated worktree sandbox and dispatches assigned agent (Antigravity/Codex/Claude).' },
              { title: '3. Execute Tests & Evidence', desc: 'Runs full test suite, verifies linting, static analysis, and computes risk scoring.' },
              { title: '4. Human Review & Merge', desc: 'Tech Lead inspects AST diff and test evidence before executing a 1-click merge into main.' }
            ]"
            :key="step.title"
            class="relative rounded-2xl border border-white/10 bg-midnight-900/40 p-5 space-y-2"
          >
            <span class="font-mono text-phantom-mint text-xl font-bold">0{{ index + 1 }}</span>
            <h4 class="font-bold text-white text-sm">{{ step.title }}</h4>
            <p class="text-xs leading-relaxed text-slate-400">{{ step.desc }}</p>
          </div>
        </div>

        <div class="mt-12 text-center">
          <a
            :href="releaseUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-sm text-slate-300 underline decoration-phantom-mint/50 underline-offset-4 hover:text-phantom-mint"
          >
            <span>View release notes and changelog on GitHub</span>
            <span>→</span>
          </a>
        </div>
      </section>
    </main>

    <Footer variant="midnight" />
  </div>
</template>
