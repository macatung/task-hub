<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import TalismanGenerator from '@/Components/talisman/TalismanGenerator.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';

import { Link } from '@inertiajs/vue3';

defineProps<{
  settings?: Record<string, string>;
}>();

const talismanJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  'name': 'Developer Verification Seal & Talisman Forge',
  'description': 'Custom developer verification seal and digital talisman forge combining cryptographic hashing aesthetics with zero-defect deployment directives.',
  'applicationCategory': 'UtilitiesApplication',
  'operatingSystem': 'Any',
  'url': 'https://macatung.dev/talisman',
  'author': {
    '@type': 'Person',
    'name': 'MacaTung',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Developer Verification Seal & Talisman Forge — The Midnight Architect"
    description="Customize and generate cryptographic developer verification seals, zero-defect release talismans, and high-resolution ASCII canvas cards."
    keywords="Developer Talisman, Verification Seal, Code Quality Seal, Zero Defect Seal, Creative Canvas Tool"
    canonical="https://macatung.dev/talisman"
    :json-ld="talismanJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Home</Link>
        <span>/</span>
        <span class="text-talisman-gold font-bold">Developer Seal Forge</span>
      </nav>

      <div class="flex flex-col items-start mb-8">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-talisman-gold/10 border border-talisman-gold/30 text-talisman-gold text-xs font-mono mb-3 shadow-glow-talisman">
          📜 Dev Artifact Creator
        </span>
        <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
          Developer <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-phantom-mint to-phantom-cyan">Verification Seal Forge</span>
        </h1>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
          Customize and generate cryptographic developer verification seals, zero-defect release talismans, and high-resolution ASCII canvas cards for your workflow.
        </p>
      </div>

      <!-- Talisman Forge Tool -->
      <TalismanGenerator />

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/talisman" />
    </main>

    <Footer />
  </div>
</template>
