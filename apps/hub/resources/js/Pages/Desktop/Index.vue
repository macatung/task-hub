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
  description: 'Ứng dụng desktop điều phối Supervised Vibe Coding và AI Coding Agents (Antigravity 2.0, Codex, Claude Code, CAO) trong môi trường Git Worktree cô lập.',
  downloadUrl,
  softwareVersion: '2.0.0',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};
</script>

<template>
  <SeoHead
    title="Midnight Hub Desktop — Supervised Vibe Coding & Local AI Agent Studio"
    description="Tải Midnight Hub Desktop Companion cho Windows: Vibe coding thần tốc, cô lập Git worktree, tự động nạp Context Pack, chạy test xuất Verification Evidence và kết nối Antigravity 2.0, Codex, Claude Code."
    keywords="Midnight Hub Desktop, Vibe Coding, Antigravity 2.0, Codex, Claude Code, AWS Labs CAO, Git Worktree, Verification Evidence, MCP"
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
              Vibe Code Cục Bộ.<br />
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-teal-300">
                An Toàn Tuyệt Đối, Ít Lỗi & Chuẩn Xác.
              </span>
            </h1>

            <p class="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
              Midnight Hub Desktop kết nối trực tiếp kho tác vụ web với máy tính của bạn. Khởi chạy <strong>Antigravity 2.0</strong>, <strong>Codex</strong>, <strong>Claude Code</strong> và <strong>AWS Labs CAO</strong> trong môi trường <strong>Git Worktree cô lập</strong>—tự động chạy test, xuất bằng chứng kiểm thử (<span class="text-cyan-300 font-semibold">Verification Evidence</span>) và loại bỏ hoàn toàn nguy cơ xung đột mã nguồn.
            </p>

            <div class="mt-8 flex flex-wrap gap-4 items-center">
              <a
                :href="downloadUrl"
                class="inline-flex items-center gap-2.5 rounded-xl bg-phantom-mint px-6 py-3.5 font-bold text-midnight-950 shadow-glow-mint transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                <Icons name="Desktop" :size="18" />
                <span>Tải Cho Windows (64-bit)</span>
              </a>
              <Link
                href="/tasks"
                class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-bold text-white transition hover:border-phantom-mint/50 hover:bg-white/10"
              >
                <span>Mở Web Workspace →</span>
              </Link>
            </div>

            <div class="mt-5 flex items-center gap-6 text-xs text-slate-400 font-mono">
              <span>Windows 10/11 x64</span>
              <span>·</span>
              <span>Miễn phí 100%</span>
              <span>·</span>
              <span>Tự động cập nhật qua GitHub Releases</span>
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
            <p class="font-mono text-xs uppercase tracking-[.25em] text-phantom-mint">Tính Năng Cốt Lõi</p>
            <h2 class="mt-2 text-3xl font-display font-bold text-white">
              Tại sao lập trình viên chọn Midnight Hub Desktop cho Vibe Coding?
            </h2>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-phantom-mint/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-emerald-500/10 text-emerald-400 text-2xl mb-4">
                <Icons name="GitBranch" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Git Worktree Cô Lập</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Agent chỉ sửa code trong nhánh worktree độc lập. Bạn có thể tiếp tục code trên nhánh chính mà không bị xung đột hay gián đoạn.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-cyan-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-cyan-500/10 text-cyan-400 text-2xl mb-4">
                <Icons name="CheckCircle" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Test Evidence Tự Động</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Bắt buộc chạy test tự động cục bộ, ghi nhận log và kiểm tra risk score trước khi chuyển giao handoff cho con người.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-purple-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-purple-500/10 text-purple-400 text-2xl mb-4">
                <Icons name="Cpu" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Điều Phối Đa Agent</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Tích hợp sẵn AWS Labs CAO, Antigravity 2.0, Codex và Claude Code. Quản lý luồng thực thi và token thời gian thực.
              </p>
            </article>

            <article class="rounded-2xl border border-white/10 bg-white/[.03] p-6 hover:border-amber-500/40 transition-all">
              <div class="inline-flex h-12 w-12 items-center justify-center shrink-0 rounded-xl bg-amber-500/10 text-amber-400 text-2xl mb-4">
                <Icons name="Shield" :size="24" />
              </div>
              <h3 class="text-base font-bold text-white">Bảo Mật Zero-Leak</h3>
              <p class="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Mã nguồn của bạn lưu 100% trên ổ cứng cục bộ. Không gửi source code nhạy cảm lên cloud, bảo vệ tuyệt đối IP của doanh nghiệp.
              </p>
            </article>
          </div>
        </div>
      </section>

      <!-- 4-STEP DESKTOP EXECUTION FLOW -->
      <section class="max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div class="text-center">
          <p class="font-mono text-xs uppercase tracking-[.25em] text-phantom-mint">Deterministic Workflow</p>
          <h2 class="mt-3 text-3xl font-display font-bold text-white">Từ Task Đến Kết Quả Review Chuẩn Mực</h2>
          <p class="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
            Quy trình khép kín giúp bạn phát triển thần tốc mà vẫn đảm bảo độ tin cậy tuyệt đối.
          </p>
        </div>

        <div class="mt-12 grid gap-4 md:grid-cols-4">
          <div
            v-for="(step, index) in [
              { title: '1. Chọn Task & Nạp Context', desc: 'Chọn task từ Hub, tự động nạp Context Pack và chuẩn kiến trúc docs/.' },
              { title: '2. Khởi Tạo Git Worktree', desc: 'Tạo worktree cô lập và điều phối Agent (Antigravity/Codex/Claude) thực thi.' },
              { title: '3. Chạy Test & Xuất Evidence', desc: 'Chạy toàn bộ test suite, kiểm tra lint, static analysis và risk score.' },
              { title: '4. Human Review & Merge', desc: 'Tech Lead kiểm duyệt diff và bằng chứng trước khi 1-click merge vào main.' }
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
            <span>Xem changelog và các bản phát hành trên GitHub</span>
            <span>→</span>
          </a>
        </div>
      </section>
    </main>

    <Footer variant="midnight" />
  </div>
</template>
