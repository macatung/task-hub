<script setup lang="ts">
import { ref, computed } from 'vue';
import { experienceData } from '@/data/experienceData';
import { sound } from '@/audio/soundEffects';

interface ExperienceRecord {
  id: number | string;
  role: string;
  company: string;
  period: string;
  type: string;
  location: string;
  summary: string;
  achievements?: string[];
  technologies?: string[];
  midnightQuest?: string;
}

interface Props {
  experiences?: ExperienceRecord[];
}

const props = withDefaults(defineProps<Props>(), {
  experiences: () => [],
});

const activeType = ref<string>('all');

const types = [
  { id: 'all', label: 'Tất Cả Mốc Thời Gian' },
  { id: 'Full-time', label: 'Full-Time' },
  { id: 'Contract', label: 'Contract & Creative' },
  { id: 'Open Source', label: 'Indie & Open Source' },
];

const allExperiences = computed(() => {
  if (props.experiences && props.experiences.length > 0) {
    return props.experiences;
  }
  return experienceData;
});

const displayExperiences = computed(() => {
  if (activeType.value === 'all') return allExperiences.value;
  return allExperiences.value.filter((e) => e.type.toLowerCase().includes(activeType.value.toLowerCase()));
});

const setType = (typeId: string) => {
  activeType.value = typeId;
  sound.playClick();
};
</script>

<template>
  <section id="experience" class="scroll-mt-24 w-full py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
      <div class="flex flex-col items-start">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-phantom-mint text-xs font-mono mb-3 whitespace-nowrap select-none shadow-glow-mint">
          📜 The Career Chronicles
        </span>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight">
          Kinh Nghiệm & <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">Biên Niên Sử</span>
        </h2>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
          Dấu chân qua các dự án thực chiến tải cao, hành trình phát triển từ Indie Hacker sang Lead Systems Architect.
        </p>
      </div>

      <!-- Filter Types -->
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          v-for="t in types"
          :key="t.id"
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-mono transition-all min-h-[38px] shrink-0 border select-none whitespace-nowrap"
          :class="activeType === t.id
            ? 'bg-phantom-mint text-midnight-950 border-phantom-mint font-bold shadow-glow-mint'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          @click="setType(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Timeline Container -->
    <div class="relative pl-6 sm:pl-8 space-y-8">
      <!-- Continuous Vertical Connector Line with Gradient -->
      <div class="absolute top-3 bottom-3 left-3 w-[2px] bg-gradient-to-b from-phantom-mint via-phantom-cyan/40 to-transparent" />

      <!-- Timeline Items -->
      <div
        v-for="item in displayExperiences"
        :key="item.id"
        class="relative flex flex-col items-start group"
      >
        <!-- Node Dot Indicator -->
        <div class="absolute -left-[27px] sm:-left-[31px] top-2 w-5 h-5 rounded-full bg-midnight-950 border-2 border-phantom-mint flex items-center justify-center text-phantom-mint shadow-glow-mint z-10 select-none group-hover:scale-125 transition-transform">
          <span class="w-1.5 h-1.5 rounded-full bg-phantom-mint" />
        </div>

        <!-- Experience Card -->
        <div class="w-full glass-panel p-6 sm:p-7 rounded-2xl border border-white/[0.08] hover:border-phantom-mint/30 transition-all duration-300 hover:shadow-xl hover:shadow-black/40 text-left">
          <!-- Period & Type Badges -->
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-full bg-phantom-mint/10 text-phantom-mint font-mono text-xs font-bold border border-phantom-mint/30 shadow-glow-mint whitespace-nowrap">
                {{ item.period }}
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 font-mono text-[11px] border border-white/10 whitespace-nowrap">
                {{ item.type }}
              </span>
            </div>
            <span class="text-xs font-mono text-slate-400 whitespace-nowrap flex items-center gap-1">
              <span>📍</span>
              <span>{{ item.location }}</span>
            </span>
          </div>

          <!-- Role & Company -->
          <h3 class="text-lg sm:text-xl font-display font-bold text-white group-hover:text-phantom-mint transition-colors">
            {{ item.role }}
          </h3>
          <div class="text-xs sm:text-sm font-mono text-phantom-mint mt-0.5 font-semibold">
            {{ item.company }}
          </div>

          <!-- Summary -->
          <p class="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed font-sans">
            {{ item.summary }}
          </p>

          <!-- Key Achievements -->
          <div v-if="item.achievements && item.achievements.length > 0" class="mt-4">
            <ul class="space-y-2 text-xs sm:text-sm text-slate-300 font-sans">
              <li v-for="(ach, i) in item.achievements" :key="i" class="flex items-start gap-2.5">
                <span class="text-phantom-mint mt-0.5 select-none shrink-0 text-xs font-bold">✦</span>
                <span class="leading-relaxed">{{ ach }}</span>
              </li>
            </ul>
          </div>

          <!-- Midnight Quest Story (Lore) -->
          <div
            v-if="item.midnightQuest"
            class="mt-4 p-3.5 rounded-xl bg-amber-950/20 border border-talisman-gold/25 text-xs text-amber-200/90 flex items-start gap-2.5"
          >
            <span class="text-base shrink-0">🌙</span>
            <div>
              <span class="font-mono text-[10px] text-talisman-gold font-bold uppercase tracking-wider block mb-0.5">Midnight Quest</span>
              <p class="leading-relaxed">{{ item.midnightQuest }}</p>
            </div>
          </div>

          <!-- Tech Stack Badges -->
          <div v-if="item.technologies && item.technologies.length > 0" class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-white/5">
            <span
              v-for="tech in item.technologies"
              :key="tech"
              class="px-2.5 py-0.5 rounded text-[11px] font-mono bg-white/5 text-slate-300 border border-white/5 whitespace-nowrap hover:border-white/15 transition-colors"
            >
              {{ tech }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
