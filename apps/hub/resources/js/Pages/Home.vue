<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { ref } from 'vue';
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import HeroSection from '@/Components/hero/HeroSection.vue';
import ProjectsSection from '@/Components/projects/ProjectsSection.vue';
import SkillsSection from '@/Components/skills/SkillsSection.vue';
import ExperienceSection from '@/Components/experience/ExperienceSection.vue';
import AboutSection from '@/Components/about/AboutSection.vue';
import HumanisticPhilosophySection from '@/Components/philosophy/HumanisticPhilosophySection.vue';
import MidnightTerminal from '@/Components/terminal/MidnightTerminal.vue';
import ContactSection from '@/Components/contact/ContactSection.vue';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';
import { useTimeCycle } from '@/composables/useTimeCycle';

defineProps<{
  title?: string;
  projects?: any[];
  skills?: any[];
  experiences?: any[];
  latestArticles?: any[];
  settings?: Record<string, string>;
  stats?: Record<string, any>;
}>();

const { activePhase, transitionToast } = useTimeCycle();
const globalHopCount = ref(0);

const handleHop = (count: number) => {
  globalHopCount.value = count;
};

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://macatung.dev/#website',
      'url': 'https://macatung.dev',
      'name': 'Ma Cà Tưng • Code at midnight',
      'description': 'Portfolio of macatung.dev — Full-Stack Developer & Creative Engineer crafting supernatural web applications under the midnight moon.',
      'publisher': {
        '@id': 'https://macatung.dev/#person'
      },
      'inLanguage': 'vi'
    },
    {
      '@type': 'Person',
      '@id': 'https://macatung.dev/#person',
      'name': 'Ma Cà Tưng',
      'alternateName': ['macatung', 'Midnight Architect'],
      'url': 'https://macatung.dev',
      'jobTitle': 'Senior Full-Stack Engineer & Creative Coder',
      'knowsAbout': ['Laravel', 'Vue.js', 'Inertia.js', 'Tailwind CSS', 'TypeScript', 'Docker', 'Google Cloud Platform', 'AI Multi-Agent Systems'],
      'sameAs': [
        'https://github.com/macatung'
      ]
    }
  ]
};
</script>

<template>
  <SeoHead
    :title="title || 'The Midnight Architect — Full-Stack, AI Systems & Triết Lý Vị Nhân Sinh'"
    description="Khám phá Portfolio độc bản của Ma Cà Tưng (macatung.dev) — Lập trình viên Full-Stack & AI Systems Architect với triết lý kiến tạo phần mềm vị nhân sinh, hệ thống phân tán chịu tải cao và trải nghiệm tương tác kỳ ảo."
    keywords="Ma Cà Tưng, macatung.dev, Triết lý xây dựng ứng dụng, Triết lý nhân sinh, Full-Stack Developer, AI Agent Architect, Laravel, Vue.js, Midnight Coder, Software Craftsmanship"
    canonical="https://macatung.dev"
    :json-ld="homeJsonLd"
  />

  <div
    class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern transition-colors duration-1000"
    :style="{
      '--phase-accent': activePhase.accentHex,
      '--phase-glow': activePhase.accentGlow,
      '--phase-border': activePhase.accentBorder
    }"
  >
    <!-- Ambient 2D Canvas Particles Engine -->
    <TalismanCanvas />

    <!-- Ambient Background Glow Blurs with Smooth Phase Shift -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full blur-[140px] transition-all duration-1000 opacity-20"
        :style="{ backgroundColor: activePhase.accentHex }"
      />
      <div
        class="absolute top-2/3 right-10 w-[450px] h-[450px] rounded-full blur-[130px] transition-all duration-1000 opacity-15"
        :style="{ backgroundColor: activePhase.particlePalette[1] || activePhase.accentHex }"
      />
    </div>

    <!-- Phase Transition Alert Toast Pill -->
    <transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 -translate-y-8 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-8 scale-95"
    >
      <div
        v-if="transitionToast.visible"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl glass-panel border shadow-2xl flex items-center gap-3 select-none max-w-md w-full mx-4"
        :style="{
          borderColor: activePhase.accentBorder,
          boxShadow: `0 12px 36px -8px ${activePhase.accentGlow}`
        }"
      >
        <div
          class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          :style="{
            backgroundColor: `${activePhase.accentHex}20`,
            color: activePhase.accentHex,
            border: `1px solid ${activePhase.accentHex}40`
          }"
        >
          <Icons :name="activePhase.icon" :size="16" />
        </div>
        <div class="flex-1 min-w-0">
          <h5 class="text-xs font-bold text-slate-100 tracking-wide">
            {{ transitionToast.message }}
          </h5>
          <p class="text-[11px] text-slate-300 mt-0.5 font-sans truncate">
            {{ transitionToast.subtitle }}
          </p>
        </div>
        <button
          type="button"
          @click="transitionToast.visible = false"
          class="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <Icons name="X" :size="13" />
        </button>
      </div>
    </transition>

    <!-- Sticky Navigation Bar -->
    <Navbar />

    <!-- Master Content Sections -->
    <main class="relative z-10 flex-1 flex flex-col items-center w-full">
      <!-- 1. Hero Section (#hero) -->
      <HeroSection @hop="handleHop" />

      <!-- 2. Featured Grimoire Projects Showcase (Top 3 on Home) -->
      <ProjectsSection :projects="projects" :featured-only="true" />

      <!-- 3. Triết Lý Nhân Sinh Trong Kiến Tạo Ứng Dụng (#philosophy) -->
      <HumanisticPhilosophySection />

      <!-- 4. Developer Manifesto & Stats (#about) -->
      <AboutSection :stats="stats" />

      <!-- 4. Midnight Tech Chronicle / Featured Articles Section -->
      <section v-if="latestArticles && latestArticles.length > 0" class="scroll-mt-24 w-full py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div class="flex flex-col items-start">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-3 shadow-glow-mint">
              📜 Midnight Tech Chronicle
            </span>
            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight">
              Ghi Chép <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">Kiến Trúc & Blog</span>
            </h2>
            <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
              Các bài phân tích chuyên sâu về hệ sinh thái Multi-Agent AI tự trị, giải thuật định tuyến GIS và kỹ thuật chịu tải cao.
            </p>
          </div>

          <Link
            href="/blog"
            class="px-5 py-3 rounded-2xl bg-white/5 hover:bg-phantom-mint text-slate-200 hover:text-midnight-950 font-display font-bold text-xs sm:text-sm transition-all flex items-center gap-2 border border-white/10 hover:border-phantom-mint shadow-sm hover:shadow-glow-mint whitespace-nowrap"
            @click="sound.playClick()"
          >
            <span>Đọc Toàn Bộ Blog</span>
            <span>→</span>
          </Link>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <article
            v-for="article in latestArticles"
            :key="article.id"
            class="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 hover:border-phantom-mint/40 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 shadow-lg bg-midnight-900/60"
          >
            <div>
              <div class="flex items-center justify-between text-xs font-mono text-slate-400 mb-4 pb-3 border-b border-white/5">
                <span class="text-phantom-mint font-bold">⏱ {{ article.reading_time_min }} phút đọc</span>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="tag in (article.tags || []).slice(0, 2)" :key="tag" class="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">
                    #{{ tag }}
                  </span>
                </div>
              </div>
              <h3 class="font-display font-bold text-xl sm:text-2xl text-white group-hover:text-phantom-mint transition-colors leading-snug mb-3">
                <Link :href="`/blog/${article.slug}`">{{ article.title }}</Link>
              </h3>
              <p class="text-sm text-slate-300 line-clamp-3 leading-relaxed mb-6">{{ article.excerpt }}</p>
            </div>

            <Link
              :href="`/blog/${article.slug}`"
              class="text-xs font-mono text-phantom-mint flex items-center gap-1.5 group-hover:translate-x-1 transition-transform font-bold pt-4 border-t border-white/5"
              @click="sound.playClick()"
            >
              <span>Xem chi tiết bài viết</span>
              <span>→</span>
            </Link>
          </article>
        </div>
      </section>

      <!-- 7. Arcade Game Chamber Teaser Box -->
      <section class="scroll-mt-24 w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
        <div class="glass-panel p-8 sm:p-10 rounded-3xl border border-talisman-gold/40 relative overflow-hidden bg-gradient-to-r from-midnight-900 via-midnight-950 to-midnight-900 shadow-2xl">
          <div class="absolute -top-20 -right-20 w-80 h-80 bg-talisman-gold/10 rounded-full blur-3xl pointer-events-none" />

          <div class="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div class="w-24 h-24 rounded-3xl bg-midnight-900 border-2 border-talisman-gold p-2 flex items-center justify-center shadow-glow-talisman shrink-0">
                <MiniMascotLogo size="lg" :animated="true" />
              </div>

              <div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-talisman-gold/10 border border-talisman-gold/30 text-talisman-gold text-xs font-mono mb-2 shadow-glow-talisman">
                  🎮 Dev Arcade Chamber
                </span>
                <h3 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
                  Rune Typer: <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-phantom-mint to-phantom-cyan">Thần Phím Trừ Tà</span>
                </h3>
                <p class="text-xs sm:text-sm text-slate-300 mt-2 max-w-xl font-sans leading-relaxed">
                  Gõ phím diệt Bug, cảm nhận âm thanh phím cơ thock chân thực, chuỗi combo x5 và săn lùng Boss Bug trong phòng máy chơi game chuyên biệt.
                </p>

                <!-- Mini Stats Pill -->
                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4 text-xs font-mono text-slate-400">
                  <span class="flex items-center gap-1">⚡ 150+ Thần Chú</span>
                  <span>·</span>
                  <span class="flex items-center gap-1">🏆 Bảng Phong Thần</span>
                  <span>·</span>
                  <span class="flex items-center gap-1">🔊 Web Audio SFX</span>
                </div>
              </div>
            </div>

            <!-- CTA Play Button -->
            <Link
              href="/game"
              class="px-8 py-4 rounded-2xl bg-talisman-gold text-midnight-950 font-display font-bold text-sm sm:text-base hover:brightness-110 shadow-glow-talisman transition-all flex items-center gap-2.5 whitespace-nowrap shrink-0 hover:scale-105 active:scale-95"
              @click="sound.playTalisman()"
            >
              <span>Vào Chơi Rune Typer</span>
              <span>⚡</span>
            </Link>
          </div>
        </div>
      </section>

      <!-- 8. Developer Talisman Forge Teaser Box -->
      <section class="scroll-mt-24 w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
        <div class="glass-panel p-8 sm:p-10 rounded-3xl border border-phantom-mint/30 relative overflow-hidden bg-gradient-to-r from-midnight-900 via-midnight-950 to-midnight-900 shadow-2xl">
          <div class="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            <div class="flex items-start gap-4">
              <span class="text-4xl">📜</span>
              <div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-2">
                  ✨ Developer Artifacts
                </span>
                <h3 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
                  Lò Rèn Bùa Hộ Mệnh Lập Trình Viên
                </h3>
                <p class="text-xs sm:text-sm text-slate-300 mt-2 max-w-xl font-sans leading-relaxed">
                  Tạo các đạo bùa hộ mệnh dev (Bùa Trừ Bug, Bùa Tăng Lương, Bùa Xuyên Đêm 00:00 AM) và tải file ảnh HD canvas để dán laptop hoặc chia sẻ.
                </p>
              </div>
            </div>

            <Link
              href="/talisman"
              class="px-8 py-4 rounded-2xl bg-phantom-mint text-midnight-950 font-display font-bold text-sm sm:text-base hover:brightness-110 shadow-glow-mint transition-all flex items-center gap-2.5 whitespace-nowrap shrink-0 hover:scale-105 active:scale-95"
              @click="sound.playClick()"
            >
              <span>Mở Lò Rèn Bùa Dev</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      <!-- 9. Midnight Terminal REPL CLI (#terminal) -->
      <section id="terminal" class="scroll-mt-24 w-full py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
        <div class="flex flex-col items-start mb-8">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-3 shadow-glow-mint">
            ⚡ Interactive REPL Shell
          </span>
          <h2 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
            Midnight <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">Terminal CLI</span>
          </h2>
          <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
            Môi trường dòng lệnh ảo mô phỏng zsh shell với 11 câu lệnh ma thuật, lịch sử điều hướng phím mũi tên và âm thanh gõ phím cơ học.
          </p>
        </div>
        <MidnightTerminal />
      </section>

      <!-- 10. Summoning Altar Contact Form (#contact) -->
      <ContactSection />
    </main>

    <!-- Global Footer with Hop-to-Top and Easter Egg -->
    <Footer />
  </div>
</template>
