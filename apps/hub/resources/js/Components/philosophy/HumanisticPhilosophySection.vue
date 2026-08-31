<script setup lang="ts">
import { ref } from 'vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';

interface Pillar {
  id: string;
  number: string;
  icon: string;
  subtitle: string;
  title: string;
  shortDesc: string;
  philosophy: string;
  technicalPractice: string;
  badge: string;
  accentColor: string;
  glowColor: string;
}

const activePillarId = ref<string>('empathy');

const pillars: Pillar[] = [
  {
    id: 'empathy',
    number: '01',
    icon: 'Heart',
    subtitle: 'Empathy & User-Centric Design',
    title: 'Human-First Design',
    shortDesc: 'Code is not for displaying gratuitous complexity, but to understand and resolve genuine human pain points.',
    philosophy: 'The best software serves people quietly, seamlessly, and unobtrusively. By discarding technical ego and avoiding over-engineering, engineers write humble, clear, and easily maintainable code for collaborators and future maintainers.',
    technicalPractice: 'Transforming complex domain logic into intuitive, distraction-free user experiences. Strictly rejecting manipulative Dark Patterns; fiercely respecting user privacy, security, and time.',
    badge: 'Human-First UX',
    accentColor: '#00f5a0',
    glowColor: 'rgba(0, 245, 160, 0.25)'
  },
  {
    id: 'resilience',
    number: '02',
    icon: 'Layers',
    subtitle: 'Resilient & Green Computing',
    title: 'Sustainable System Ecology',
    shortDesc: 'Every microservice, API, and data structure harmonizes in a resilient, resource-efficient ecosystem.',
    philosophy: 'In a distributed system, a ripple at the database layer propagates across the entire user experience. Sustainable software minimizes server carbon footprint and computational waste while gracefully handling network partitions.',
    technicalPractice: 'Event-driven and containerized microservices optimized for minimal CPU/RAM footprint. Decoupled architecture engineered for high fault-tolerance and modular evolution without cascading failures.',
    badge: 'Resilient Ecology',
    accentColor: '#ffd166',
    glowColor: 'rgba(255, 209, 102, 0.25)'
  },
  {
    id: 'craftsmanship',
    number: '03',
    icon: 'Shield',
    subtitle: 'Zero-Debt Craftsmanship',
    title: 'Discipline & Absolute Quality',
    shortDesc: 'Technical debt and negligence breed instability. Relentless attention to detail ensures long-term reliability.',
    philosophy: 'Rushed, undisciplined code seeds crises for future engineering teams. Rigorous craftsmanship is the engineer\'s commitment to excellence and professional integrity.',
    technicalPractice: '100% Strict Type-safety in TypeScript, automated end-to-end regression testing, defensive zero-crash design patterns, and multi-tiered defense-in-depth security before production deployment.',
    badge: 'Zero-Debt Flow',
    accentColor: '#00f5ff',
    glowColor: 'rgba(0, 245, 255, 0.25)'
  },
  {
    id: 'flourishing',
    number: '04',
    icon: 'Sparkles',
    subtitle: 'AI for Human Empowerment',
    title: 'Liberating Human Creativity',
    shortDesc: 'True technology restores autonomy, focus, and creative bandwidth to human beings.',
    philosophy: 'The ultimate objective of artificial intelligence and workflow automation is not to replace human insight, but to shoulder tedious, repetitive operational burdens, allowing humans to focus on strategic vision and meaningful living.',
    technicalPractice: 'Architecting autonomous multi-agent AI ecosystems executing 24/7 with high accuracy, automating complex workflows and saving teams thousands of hours of manual labor.',
    badge: 'Human Flourishing',
    accentColor: '#9d4edd',
    glowColor: 'rgba(157, 78, 221, 0.25)'
  }
];

const selectPillar = (id: string) => {
  activePillarId.value = id;
  sound.playClick();
};
</script>

<template>
  <section id="philosophy" class="scroll-mt-24 w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left relative">
    <!-- Ambient Background Lighting -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-phantom-mint/5 via-talisman-gold/5 to-phantom-purple/5 rounded-full blur-[140px] pointer-events-none" />

    <!-- Section Header -->
    <div class="flex flex-col items-start mb-12 relative z-10">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono mb-3 shadow-glow-mint select-none">
        <span class="text-phantom-mint">🌿</span>
        <span class="text-slate-200 font-semibold tracking-wide">Humanistic Software Engineering Manifesto</span>
      </div>
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-tight">
        Engineering Philosophy & <br class="hidden sm:inline" />
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-talisman-gold to-phantom-cyan">
          System Design Disciplines
        </span>
      </h2>
      <p class="text-sm sm:text-base text-slate-300 mt-3 max-w-3xl font-sans leading-relaxed">
        Software is more than binary execution; it is a direct reflection of engineering thought. System design is a service-driven craft rooted in human clarity, safety, and reliability.
      </p>
    </div>

    <!-- Core Philosophy Manifesto Callout Banner -->
    <div class="mb-12 p-6 sm:p-8 rounded-3xl glass-panel border border-white/15 relative overflow-hidden bg-gradient-to-r from-midnight-900/90 via-midnight-950 to-midnight-900 shadow-2xl relative z-10">
      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div class="space-y-2 max-w-4xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-talisman-gold/10 text-talisman-gold border border-talisman-gold/30 text-xs font-mono font-bold">
            <span>✨ Engineering Tenet</span>
            <span>·</span>
            <span>Mindful Code — Resilient Systems Serving Humanity</span>
          </div>
          <blockquote class="text-base sm:text-lg lg:text-xl font-sans italic text-slate-100 leading-relaxed pt-1">
            "Every line of code written in the quiet focus of midnight carries accountability. We write software with mindfulness and discipline to solve real challenges, bringing clarity, reliability, and liberating time for what matters most."
          </blockquote>
        </div>

        <div class="shrink-0 flex items-center gap-3 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 text-xs font-mono text-slate-400">
          <div class="text-left">
            <p class="text-phantom-mint font-bold uppercase tracking-wider">The Midnight Architect</p>
            <p class="text-slate-400 text-[11px] mt-0.5">Human-Centric Software Engineering</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 Core Pillars Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 relative z-10">
      <div
        v-for="pillar in pillars"
        :key="pillar.id"
        class="rounded-3xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
        :class="activePillarId === pillar.id
          ? 'bg-midnight-900/90 shadow-2xl'
          : 'bg-midnight-950/60 hover:bg-midnight-900/60'"
        :style="{
          borderColor: activePillarId === pillar.id ? pillar.accentColor : 'rgba(255, 255, 255, 0.08)',
          boxShadow: activePillarId === pillar.id ? `0 12px 30px -8px ${pillar.glowColor}` : 'none'
        }"
        @click="selectPillar(pillar.id)"
      >
        <!-- Top Status & Number -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
              :style="{
                backgroundColor: `${pillar.accentColor}15`,
                color: pillar.accentColor,
                border: `1px solid ${pillar.accentColor}40`
              }"
            >
              <Icons :name="pillar.icon" :size="20" />
            </div>
            <span class="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300 transition-colors">
              {{ pillar.number }}
            </span>
          </div>

          <!-- Badges & Terms -->
          <div class="mb-2">
            <span
              class="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold"
              :style="{
                backgroundColor: `${pillar.accentColor}15`,
                color: pillar.accentColor
              }"
            >
              {{ pillar.badge }}
            </span>
          </div>

          <h3 class="text-lg font-display font-extrabold text-white group-hover:text-phantom-mint transition-colors mb-1 leading-snug">
            {{ pillar.title }}
          </h3>
          <p class="text-xs font-mono text-slate-400 mb-3">
            {{ pillar.subtitle }}
          </p>

          <p class="text-xs text-slate-300 font-sans leading-relaxed line-clamp-3">
            {{ pillar.shortDesc }}
          </p>
        </div>

        <!-- Pillar Expansion Trigger -->
        <div class="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
          <span
            class="text-[11px] font-bold transition-colors"
            :style="{ color: activePillarId === pillar.id ? pillar.accentColor : '#94a3b8' }"
          >
            {{ activePillarId === pillar.id ? '● Active Spec' : '○ View Details' }}
          </span>
          <span
            class="text-xs transition-transform group-hover:translate-x-1"
            :style="{ color: pillar.accentColor }"
          >
            →
          </span>
        </div>
      </div>
    </div>

    <!-- Active Pillar Deep-Dive Detail Card -->
    <div
      v-if="activePillarId"
      class="rounded-3xl glass-panel p-6 sm:p-8 border border-white/15 bg-gradient-to-b from-midnight-900/95 to-midnight-950 relative z-10 shadow-2xl transition-all duration-500"
    >
      <div
        v-for="pillar in pillars"
        :key="`detail-${pillar.id}`"
        v-show="activePillarId === pillar.id"
        class="space-y-6"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center"
              :style="{
                backgroundColor: `${pillar.accentColor}20`,
                color: pillar.accentColor,
                border: `1px solid ${pillar.accentColor}50`
              }"
            >
              <Icons :name="pillar.icon" :size="24" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-400">PILLAR {{ pillar.number }}</span>
                <span class="text-xs font-mono text-talisman-gold">({{ pillar.subtitle }})</span>
              </div>
              <h4 class="text-xl sm:text-2xl font-display font-extrabold text-white">
                {{ pillar.title }}
              </h4>
            </div>
          </div>

          <span
            class="self-start sm:self-auto text-xs font-mono px-3 py-1 rounded-full border"
            :style="{
              borderColor: `${pillar.accentColor}40`,
              backgroundColor: `${pillar.accentColor}10`,
              color: pillar.accentColor
            }"
          >
            {{ pillar.badge }}
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Philosophy Dimension -->
          <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-300 font-bold uppercase tracking-wider">
              <span class="text-base">💭</span>
              <span>Architectural Philosophy & Thought</span>
            </div>
            <p class="text-sm text-slate-200 font-sans leading-relaxed pt-1">
              {{ pillar.philosophy }}
            </p>
          </div>

          <!-- Technical Practice Dimension -->
          <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div class="flex items-center gap-2 text-xs font-mono text-phantom-mint font-bold uppercase tracking-wider">
              <span class="text-base">⚙️</span>
              <span>Engineering Standards & Implementation</span>
            </div>
            <p class="text-sm text-slate-300 font-sans leading-relaxed pt-1">
              {{ pillar.technicalPractice }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
