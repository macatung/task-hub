<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import RuneTyperGame from '@/Components/game/RuneTyperGame.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';
import { beginnerSpells, normalSpells, bossSpells } from '@/data/spellsData';

import { Link } from '@inertiajs/vue3';

defineProps<{
  settings?: Record<string, string>;
}>();

const gameJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  'name': 'Rune Typer Arcade Chamber — Midnight Typing Simulator',
  'description': 'Retro-cyberpunk mechanical keyboard typing game to test typing speed, accuracy, and eliminate software bugs.',
  'genre': ['Arcade', 'Typing Game', 'Interactive Web Game'],
  'gamePlatform': 'Web Browser',
  'url': 'https://macatung.dev/game',
  'author': {
    '@type': 'Person',
    'name': 'MacaTung',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Rune Typer Arcade Chamber — Midnight Typing Simulator"
    description="Test typing velocity and code accuracy with Rune Typer, an interactive retro-cyberpunk typing game for developers."
    keywords="Rune Typer, Web Game, Typing Game, Developer Arcade, Creative Coding, Keyboard Reflexes"
    canonical="https://macatung.dev/game"
    :json-ld="gameJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Top Title Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2" aria-label="Breadcrumb">
            <Link href="/" class="hover:text-phantom-mint transition-colors">Home</Link>
            <span>/</span>
            <span class="text-talisman-gold font-bold">Arcade Chamber</span>
          </nav>
          <h1 class="text-3xl sm:text-4xl font-display font-extrabold text-white">
            Arcade Chamber: <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-phantom-mint to-phantom-cyan">Rune Typer</span>
          </h1>
        </div>

        <div class="flex items-center gap-3">
          <Link
            href="/#terminal"
            class="px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-white/30 text-slate-300 text-xs font-mono transition-all flex items-center gap-1.5"
          >
            <span>>_ Open Terminal</span>
          </Link>
          <Link
            href="/projects"
            class="px-4 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-display font-bold text-xs hover:brightness-110 shadow-glow-mint transition-all flex items-center gap-1.5"
          >
            <span>Explore Projects</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      <!-- Main Game Arena -->
      <RuneTyperGame />

      <!-- Spellbook Reference Guide Accordion -->
      <div class="mt-14 p-6 sm:p-8 rounded-3xl glass-panel border border-white/10 text-left">
        <div class="flex items-center gap-2 mb-6">
          <span class="text-2xl">📖</span>
          <div>
            <h3 class="font-display font-bold text-lg sm:text-xl text-white">Spellbook & Keyword Reference</h3>
            <p class="text-xs font-mono text-slate-400">Built-in command dictionary and code spells loaded into the arcade engine for pre-game reflex training.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Beginner Spells -->
          <div class="p-4 rounded-2xl bg-midnight-950/80 border border-white/5">
            <div class="text-xs font-mono font-bold text-phantom-mint mb-3 flex items-center gap-1.5">
              <span>🟢</span>
              <span>Apprentice Keywords</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="spell in beginnerSpells.slice(0, 16)"
                :key="spell"
                class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/5"
              >
                {{ spell }}
              </span>
            </div>
          </div>

          <!-- Normal Spells -->
          <div class="p-4 rounded-2xl bg-midnight-950/80 border border-white/5">
            <div class="text-xs font-mono font-bold text-talisman-gold mb-3 flex items-center gap-1.5">
              <span>🟡</span>
              <span>Midnight Code Spells</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="spell in normalSpells.slice(0, 8)"
                :key="spell"
                class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/5"
              >
                {{ spell }}
              </span>
            </div>
          </div>

          <!-- Boss Bugs -->
          <div class="p-4 rounded-2xl bg-midnight-950/80 border border-rose-500/20">
            <div class="text-xs font-mono font-bold text-rose-400 mb-3 flex items-center gap-1.5">
              <span>🔴</span>
              <span>Boss Bug Patterns (3 HP)</span>
            </div>
            <div class="space-y-2">
              <div
                v-for="boss in bossSpells.slice(0, 3)"
                :key="boss.name"
                class="text-[11px] font-mono text-slate-300"
              >
                <div class="text-rose-300 font-bold">👹 {{ boss.name }}</div>
                <div class="text-[10px] text-slate-400 pl-4">{{ boss.spells.join(' ➔ ') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/game" />
    </main>

    <Footer />
  </div>
</template>
