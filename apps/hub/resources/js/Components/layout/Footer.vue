<script setup lang="ts">
import { ref } from 'vue';
import confetti from 'canvas-confetti';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';

const heartClicks = ref(0);
const props = withDefaults(defineProps<{ variant?: 'portfolio' | 'midnight' }>(), {
  variant: 'portfolio',
});
const isMidnightVariant = props.variant === 'midnight';

const scrollToTop = () => {
  sound.playHop(1.2);
  if (typeof window !== 'undefined') {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
};

const triggerHeartEasterEgg = (e: MouseEvent) => {
  heartClicks.value++;
  sound.playSuccess();

  try {
    if (typeof window !== 'undefined') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 45,
        spread: 60,
        origin: { x, y },
        colors: ['#00f5a0', '#ffd166', '#ff0054', '#9d4edd'],
        disableForReducedMotion: true,
      });
    }
  } catch {
    // Fallback
  }
};
</script>

<template>
  <footer class="footer relative z-10 border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left select-none">
    <!-- Top Bar with Hop-to-Top Trigger -->
    <div class="flex flex-col sm:flex-row items-center justify-between pb-8 border-b border-white/5 gap-4">
      <div class="flex items-center gap-3">
        <img
          v-if="isMidnightVariant"
          src="/brand/midnight-hub-mark.svg?v=20260829"
          alt="Midnight Hub"
          class="h-8 w-8 rounded-lg object-contain shadow-glow-mint"
        />
        <MiniMascotLogo v-else size="sm" :animated="true" />
        <span class="font-display font-bold text-base sm:text-lg text-white">
          <template v-if="isMidnightVariant">Midnight Hub</template>
          <template v-else>macatung<span class="text-phantom-mint">.dev</span></template>
        </span>
        <span class="text-xs font-mono text-slate-500 hidden sm:inline">— {{ isMidnightVariant ? 'Code at midnight. Deploy at dawn.' : 'Code at midnight.' }}</span>
      </div>

      <!-- Hop-to-Top Button -->
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 text-slate-300 hover:text-phantom-mint hover:border-phantom-mint/40 transition-all text-xs font-mono group min-h-[44px]"
        @click="scrollToTop"
      >
        <span>Back to Top</span>
        <Icons name="ChevronUp" :size="16" class="group-hover:-translate-y-1 transition-transform" />
      </button>
    </div>

    <!-- Navigation Columns Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-white/5 text-xs font-sans">
      <!-- Col 1: Platform & Architecture -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Platform & Architecture</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="#hero" class="hover:text-phantom-mint transition-colors">Platform Overview</a></li>
          <li><a href="#philosophy" class="hover:text-phantom-mint transition-colors">Engineering Philosophy</a></li>
          <li><a href="#about" class="hover:text-phantom-mint transition-colors">Engineering Manifesto</a></li>
          <li><a href="#projects" class="hover:text-phantom-mint transition-colors">Architecture Showcase</a></li>
        </ul>
      </div>

      <!-- Col 2: Developer Labs -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Developer Labs & Tools</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="/projects" class="hover:text-phantom-mint transition-colors">Projects Grimoire</a></li>
          <li><a href="/game" class="hover:text-phantom-mint transition-colors">Typing Benchmark (Rune Typer)</a></li>
          <li><a href="/talisman" class="hover:text-phantom-mint transition-colors">Dev Talisman Forge</a></li>
          <li><a href="/theravada" class="hover:text-amber-300 transition-colors flex items-center gap-1"><span>Theravāda Dhamma</span> <span>🧘</span></a></li>
        </ul>
      </div>

      <!-- Col 3: Ecosystem & Connect -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Ecosystem & Connect</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="#terminal" class="hover:text-phantom-mint transition-colors">Interactive Terminal CLI</a></li>
          <li><a href="/contact" class="hover:text-phantom-mint transition-colors">Contact Engineering</a></li>
          <li><a href="/desktop" class="hover:text-phantom-mint transition-colors">Desktop Studio Companion</a></li>
          <li><a href="https://github.com/macatung" target="_blank" rel="noopener noreferrer" class="hover:text-phantom-mint transition-colors">GitHub Repository</a></li>
        </ul>
      </div>

      <!-- Col 4: Telemetry & SLA -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">System Telemetry & SLA</h4>
        <div class="space-y-1.5 text-slate-400 font-mono text-[11px]">
          <div class="flex items-center gap-1.5 text-phantom-mint">
            <span class="w-1.5 h-1.5 rounded-full bg-phantom-mint animate-pulse" />
            <span>100% SLA Commitment</span>
          </div>
          <div>Audio: Web Audio Synth (0 assets)</div>
          <div>Engine: Vue 3 + Laravel 12 + CAO</div>
          <div class="pt-1">
            <a href="/admin" class="text-slate-400 hover:text-phantom-mint transition-colors flex items-center gap-1">
              <span>⚙️ Admin & CMS Console</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Attribution & Heart Easter Egg Bar -->
    <div class="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
      <p class="text-center sm:text-left">
        © 2026 macatung.dev — Autonomous Multi-Agent Engineering Platform.
      </p>

      <!-- Easter Egg Heart Button -->
      <div class="flex items-center gap-1.5 text-slate-400 select-none">
        <span>Crafted with</span>
        <button
          type="button"
          class="text-rose-400 hover:scale-125 active:scale-95 transition-transform cursor-pointer p-1 min-h-[32px] min-w-[32px] flex items-center justify-center focus:outline-none"
          title="Click to activate Midnight Love Easter Egg"
          @click="triggerHeartEasterEgg"
        >
          ❤️
        </button>
        <span>& Midnight Focus</span>
        <span v-if="heartClicks > 0" class="text-phantom-mint font-bold ml-1">({{ heartClicks }})</span>
      </div>
    </div>
  </footer>
</template>
