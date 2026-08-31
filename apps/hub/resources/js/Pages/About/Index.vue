<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import SkillsSection from '@/Components/skills/SkillsSection.vue';
import ExperienceSection from '@/Components/experience/ExperienceSection.vue';
import AboutSection from '@/Components/about/AboutSection.vue';
import MidnightTerminal from '@/Components/terminal/MidnightTerminal.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';

import { Link } from '@inertiajs/vue3';

defineProps<{
  skills?: any[];
  experiences?: any[];
  stats?: Record<string, any>;
  settings?: Record<string, string>;
}>();

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  'name': 'Technical Dossier & Engineering Manifesto (Macatung Dev)',
  'description': 'Professional credentials, high-concurrency systems architecture experience, and Full-Stack technology competencies of Macatung Dev.',
  'url': 'https://macatung.dev/about',
  'mainEntity': {
    '@type': 'Person',
    'name': 'Macatung Dev',
    'jobTitle': 'Lead Systems Architect & Full-Stack Engineer',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Engineering Competencies & Technical Dossier — The Midnight Architect"
    description="Discover our systems architecture journey, full-stack competencies, high-concurrency production milestones, and engineering manifesto."
    keywords="Systems Architecture, Developer Profile, Full-Stack Architect, Laravel, Vue 3, High-Throughput Distributed Systems"
    canonical="https://macatung.dev/about"
    :json-ld="aboutJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Home</Link>
        <span>/</span>
        <span class="text-phantom-mint font-bold">Architecture & Manifesto</span>
      </nav>

      <!-- 1. Developer Manifesto & Stats -->
      <AboutSection :stats="stats" />

      <!-- 2. Interactive Terminal CLI Section -->
      <section id="terminal" class="scroll-mt-24 w-full py-16 sm:py-20 text-left">
        <div class="flex flex-col items-start mb-8">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-3 shadow-glow-mint">
            ⚡ Interactive REPL Shell
          </span>
          <h2 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
            Midnight <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">Terminal CLI</span>
          </h2>
          <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
            Virtual command-line environment simulating a zsh shell with real-time telemetry, history navigation, and circadian clock synchronization.
          </p>
        </div>
        <MidnightTerminal />
      </section>

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/about" />
    </main>

    <Footer />
  </div>
</template>
