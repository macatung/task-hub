<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import { Link } from '@inertiajs/vue3';

const downloadUrl = 'https://github.com/macatung/code-at-midnight/releases/latest/download/Task-Companion-Setup.exe';
const releaseUrl = 'https://github.com/macatung/code-at-midnight/releases/latest';

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Task Companion',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Windows 10, Windows 11',
  description: 'Mascot desktop hỗ trợ quản lý Task Hub và kết nối Codex, Antigravity, Claude Code.',
  downloadUrl,
  softwareVersion: '1.0.1',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};
</script>

<template>
  <SeoHead
    title="Task Companion — Mascot Desktop cho Task Hub"
    description="Tải Task Companion cho Windows: quản lý task, chọn task cho AI agent, tự cấu hình MCP và đồng bộ lifecycle với Task Hub."
    keywords="Task Companion, Macatung Desktop, Task Hub, Codex, Antigravity, Claude Code, MCP"
    canonical="https://macatung.dev/desktop"
    :json-ld="productJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col relative overflow-x-hidden bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1">
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div class="grid lg:grid-cols-[1.15fr_.85fr] gap-12 items-center">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-phantom-mint/30 bg-phantom-mint/10 px-3 py-1 text-xs font-mono text-phantom-mint">
              <span class="h-2 w-2 rounded-full bg-phantom-mint shadow-glow-mint" /> WINDOWS DESKTOP COMPANION
            </div>
            <h1 class="mt-6 text-4xl sm:text-6xl font-display font-black tracking-tight text-white">
              Giải quyết task nhanh hơn,<br /><span class="text-phantom-mint">ngay trên desktop.</span>
            </h1>
            <p class="mt-6 max-w-2xl text-base sm:text-lg leading-8 text-slate-300">
              Task Companion là mascot desktop kết nối trực tiếp với Task Hub. Chọn một task, mở đúng workspace và giao context pack cho Codex, Antigravity hoặc Claude Code.
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <a :href="downloadUrl" class="inline-flex items-center gap-2 rounded-xl bg-phantom-mint px-5 py-3 font-bold text-midnight-950 shadow-glow-mint transition hover:-translate-y-0.5">
                ⬇ Tải cho Windows
              </a>
              <Link href="/tasks" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white transition hover:border-phantom-mint/50 hover:bg-white/10">
                Mở Task Hub →
              </Link>
            </div>
            <p class="mt-4 text-xs text-slate-500">Windows 10/11 · Miễn phí · Cập nhật tự động qua GitHub Releases</p>
          </div>

          <div class="relative rounded-3xl border border-phantom-mint/20 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div class="absolute -inset-8 -z-10 rounded-full bg-phantom-mint/10 blur-3xl" />
            <div class="rounded-2xl border border-white/10 bg-midnight-950/90 p-5 font-mono text-sm shadow-inner">
              <div class="flex items-center justify-between border-b border-white/10 pb-4 text-slate-400"><span>AGENT WORKSPACE</span><span class="text-phantom-mint">● CONNECTED</span></div>
              <div class="mt-5 space-y-4">
                <div><div class="text-[10px] uppercase tracking-widest text-slate-500">Selected task</div><div class="mt-1 text-white">MCP auto-auth &amp; agent lifecycle</div></div>
                <div class="grid grid-cols-2 gap-3"><div class="rounded-lg border border-white/10 bg-white/5 p-3"><div class="text-[10px] text-slate-500">Provider</div><div class="mt-1 text-amber-300">Codex</div></div><div class="rounded-lg border border-white/10 bg-white/5 p-3"><div class="text-[10px] text-slate-500">Run</div><div class="mt-1 text-emerald-300">needs_review</div></div></div>
                <div class="rounded-lg border border-phantom-mint/20 bg-phantom-mint/5 p-3 text-xs leading-6 text-slate-300">✓ Context pack loaded<br />✓ MCP authenticated<br />✓ Verification evidence attached</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-white/5 bg-black/20">
        <div class="max-w-7xl mx-auto grid gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6 lg:px-8">
          <article v-for="item in [
            { icon: '🎯', title: 'Task-bound', text: 'Agent luôn làm đúng task bạn chọn từ Task Hub.' },
            { icon: '🔐', title: 'MCP auto-auth', text: 'Device pairing và GitHub approval, không nhập token thủ công.' },
            { icon: '🧠', title: 'Context đầy đủ', text: 'Acceptance criteria, DoD, risk, repo và sprint được truyền vào agent.' },
            { icon: '✅', title: 'Có kiểm chứng', text: 'Lifecycle, test và evidence được ghi lại để review.' },
          ]" :key="item.title" class="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div class="text-2xl">{{ item.icon }}</div><h2 class="mt-4 font-bold text-white">{{ item.title }}</h2><p class="mt-2 text-sm leading-6 text-slate-400">{{ item.text }}</p>
          </article>
        </div>
      </section>

      <section class="max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div class="text-center"><p class="font-mono text-xs uppercase tracking-[.25em] text-phantom-mint">Workflow</p><h2 class="mt-3 text-3xl font-display font-bold text-white">Từ task đến kết quả review</h2></div>
        <div class="mt-10 grid gap-4 md:grid-cols-4">
          <div v-for="(step, index) in ['Chọn task chưa hoàn tất', 'Approve project bằng GitHub', 'Agent nhận context + MCP', 'Chạy test và gửi review']" :key="step" class="relative rounded-2xl border border-white/10 p-5"><span class="font-mono text-phantom-mint">0{{ index + 1 }}</span><p class="mt-4 text-sm leading-6 text-slate-300">{{ step }}</p></div>
        </div>
        <div class="mt-10 text-center"><a :href="releaseUrl" class="text-sm text-slate-400 underline decoration-phantom-mint/50 underline-offset-4 hover:text-phantom-mint">Xem changelog và các bản phát hành trên GitHub →</a></div>
      </section>
    </main>
    <Footer />
  </div>
</template>
