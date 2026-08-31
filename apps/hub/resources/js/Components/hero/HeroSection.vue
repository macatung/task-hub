<script setup lang="ts">
import { ref } from 'vue';
import { Link } from '@inertiajs/vue3';
import MacatungMascot from '@/Components/mascot/MacatungMascot.vue';
import MidnightCodeStream from '@/Components/hero/MidnightCodeStream.vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';
import { trackEvent } from '@/utils/analytics';
import { useTimeCycle } from '@/composables/useTimeCycle';

const {
  activePhaseId,
  activePhase,
  isTimeTravelActive,
  TIME_PHASES,
  setPhaseOverride,
  resetToRealTime
} = useTimeCycle();

const emit = defineEmits<{
  (e: 'hop', count: number): void;
}>();

const heroHopCount = ref(0);

const handleMascotHop = (count: number) => {
  heroHopCount.value = count;
  emit('hop', count);
};

const handleCtaClick = (soundType: 'click' | 'talisman', eventName?: string) => {
  if (soundType === 'talisman') sound.playTalisman();
  else sound.playClick();

  if (eventName) {
    trackEvent(eventName);
  }
};
</script>

<template>
  <section id="hero" class="relative min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 lg:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full">
      <!-- Left Content Column (7 Columns) -->
      <div class="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
        
        <!-- Live Status Pill with Dynamic Phase Accent & Radar Ping -->
        <div
          class="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-midnight-900/90 border text-xs font-mono mb-4 select-none whitespace-nowrap transition-all duration-300"
          :style="{
            borderColor: activePhase.accentBorder,
            boxShadow: `0 0 16px -2px ${activePhase.accentGlow}`
          }"
        >
          <!-- Dual Radar Ping Bullets -->
          <div class="relative flex h-2.5 w-2.5">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              :style="{ backgroundColor: activePhase.accentHex }"
            />
            <span
              class="relative inline-flex rounded-full h-2.5 w-2.5"
              :style="{ backgroundColor: activePhase.accentHex }"
            />
          </div>

          <span class="text-slate-100 font-bold uppercase tracking-wider">
            AUTONOMOUS FLEET ONLINE · 24/7 ORCHESTRATION
          </span>
          <span
            class="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase"
            :style="{
              backgroundColor: `${activePhase.accentHex}25`,
              color: activePhase.accentHex
            }"
          >
            {{ activePhase.badgeText }}
          </span>
        </div>

        <!-- Dynamic Contextual Greeting Pill -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-xs font-mono text-slate-300 mb-6 select-none">
          <Icons :name="activePhase.icon" :size="13" :style="{ color: activePhase.accentHex }" />
          <span>{{ activePhase.greeting }}</span>
        </div>

        <!-- Headline Typography with Fluid Tracking & Gradient -->
        <h1 class="text-4xl sm:text-6xl xl:text-7xl font-display font-extrabold text-white tracking-tight leading-[1.08] mb-6">
          Code at <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">midnight.</span>
        </h1>

        <!-- Authoritative Persona Subtitle -->
        <p class="text-base sm:text-lg text-slate-300 max-w-2xl font-sans font-normal leading-relaxed mb-8">
          Autonomous Multi-Agent Engineering Platform & Supervised Vibe Coding. Orchestrate Antigravity 2.0, Codex, and Claude Code in isolated Git Worktrees with deterministic verification gates.
        </p>

        <!-- CTA Action Array -->
        <div class="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 mb-10 w-full">
          <Link
            href="/projects"
            class="px-6 py-3.5 rounded-2xl bg-phantom-mint text-midnight-950 font-display font-bold text-sm sm:text-base hover:brightness-110 shadow-glow-mint transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap active:scale-95 cursor-pointer"
            @click="handleCtaClick('click', 'projects')"
          >
            <span>Explore Platform</span>
            <span>✨</span>
          </Link>
          <Link
            href="/desktop"
            class="px-5 py-3.5 rounded-2xl bg-midnight-900 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 font-display font-bold text-xs sm:text-sm transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap active:scale-95 shadow-glow-mint cursor-pointer"
            @click="handleCtaClick('click', 'desktop')"
          >
            <span>Desktop Studio</span>
            <span>💻</span>
          </Link>
          <Link
            href="/pricing"
            class="px-4 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/20 font-display font-bold text-xs sm:text-sm transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap cursor-pointer"
            @click="handleCtaClick('click', 'pricing')"
          >
            <span>🏷️</span>
            <span>Pricing & Plans</span>
          </Link>
          <Link
            href="/about"
            class="px-4 py-3.5 rounded-2xl bg-midnight-900/80 border border-white/10 hover:border-phantom-mint/40 text-slate-300 hover:text-white font-mono text-xs sm:text-sm transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap cursor-pointer"
            @click="handleCtaClick('click', 'about')"
          >
            <Icons name="Zap" :size="16" class="text-phantom-mint" />
            <span>Architecture & Manifesto</span>
          </Link>
          <Link
            href="/contact"
            class="px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-talisman-gold/40 text-slate-300 hover:text-talisman-gold font-mono text-xs sm:text-sm transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap cursor-pointer"
            @click="handleCtaClick('talisman', 'contact')"
          >
            <Icons name="FileText" :size="16" />
            <span>Contact Us</span>
          </Link>
        </div>

        <!-- Trust Badges with Subtle Glow -->
        <div class="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 text-xs font-mono text-slate-300">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-midnight-900/60 border border-white/5 whitespace-nowrap">
            <Icons name="Zap" :size="14" class="text-phantom-mint" />
            <span>&gt; 8 Years Engineering</span>
          </div>
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-midnight-900/60 border border-white/5 whitespace-nowrap">
            <Icons name="Activity" :size="14" class="text-phantom-mint" />
            <span>&lt; 18ms Latency SLA</span>
          </div>
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-midnight-900/60 border border-white/5 whitespace-nowrap">
            <Icons name="Coffee" :size="14" class="text-amber-400" />
            <span>100% Verification Gates</span>
          </div>
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-midnight-900/60 border border-white/5 whitespace-nowrap">
            <Icons name="Bug" :size="14" class="text-rose-400" />
            <span>0 Bug Regression Policy</span>
          </div>
        </div>

        <!-- Interactive Quick Phân Kỳ / Time Travel Bar -->
        <div class="mt-8 p-3 rounded-2xl glass-panel border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 w-full bg-midnight-900/80 backdrop-blur-md shadow-xl">
          <div class="flex items-center gap-2 text-xs font-mono text-slate-200">
            <span class="p-1 rounded-lg bg-white/5 border border-white/10">
              <Icons name="Compass" :size="14" :style="{ color: activePhase.accentHex }" />
            </span>
            <span class="font-bold whitespace-nowrap">Phân Kỳ Nhịp Sống:</span>
          </div>
          
          <div class="flex flex-wrap items-center justify-center gap-1.5 w-full sm:w-auto">
            <button
              v-for="(phase, id) in TIME_PHASES"
              :key="id"
              type="button"
              @click="setPhaseOverride(id)"
              class="px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
              :class="activePhaseId === id
                ? 'bg-white/15 text-white font-bold border shadow-lg scale-105'
                : 'bg-white/[0.03] text-slate-400 hover:text-slate-100 hover:bg-white/10 border border-white/5'"
              :style="activePhaseId === id ? {
                borderColor: phase.accentBorder,
                color: phase.accentHex,
                boxShadow: `0 0 12px -2px ${phase.accentGlow}`
              } : {}"
            >
              <Icons :name="phase.icon" :size="12" />
              <span>{{ phase.name }}</span>
            </button>
            <button
              v-if="isTimeTravelActive"
              type="button"
              @click="resetToRealTime"
              class="px-2.5 py-1.5 rounded-xl text-xs font-mono bg-phantom-mint/20 text-phantom-mint border border-phantom-mint/40 hover:bg-phantom-mint/30 transition-all cursor-pointer font-bold flex items-center gap-1"
              title="Quay lại giờ thực tế của hệ thống"
            >
              <Icons name="RotateCcw" :size="11" />
              <span>Giờ Thực</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Mascot & Code Stream (5 Columns) -->
      <div class="lg:col-span-5 flex flex-col items-center gap-6 w-full">
        <!-- Interactive Hopping Mascot Component -->
        <MacatungMascot @hop="handleMascotHop" />

        <!-- Live Code Stream Box -->
        <MidnightCodeStream />
      </div>
    </div>
  </section>
</template>
