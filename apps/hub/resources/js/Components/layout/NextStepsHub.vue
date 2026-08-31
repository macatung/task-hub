<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { sound } from '@/audio/soundEffects';

interface Props {
  currentPath: string;
}

const props = defineProps<Props>();

const allPortals = [
  {
    path: '/projects',
    title: 'Architecture & Systems',
    desc: '6+ production projects in high-throughput distributed systems & AI swarms.',
    icon: '💼',
    badge: 'ENTERPRISE',
    color: 'border-phantom-mint/30 hover:border-phantom-mint text-phantom-mint',
  },
  {
    path: '/desktop',
    title: 'Desktop Studio Companion',
    desc: 'Supervised Vibe Coding & Git Worktree sandboxing for Windows 10/11.',
    icon: '💻',
    badge: 'STUDIO',
    color: 'border-cyan-400/30 hover:border-cyan-400 text-cyan-400',
  },
  {
    path: '/pricing',
    title: 'Pricing & Service Plans',
    desc: 'Community, Pro Developer, and Engineering Team subscription tiers.',
    icon: '🏷️',
    badge: 'PLANS',
    color: 'border-emerald-400/30 hover:border-emerald-400 text-emerald-400',
  },
  {
    path: '/blog',
    title: 'Midnight Tech Chronicle',
    desc: 'Deep-dive architectural essays on multi-agent workflows and telemetry.',
    icon: '📜',
    badge: 'TECH NOTES',
    color: 'border-talisman-gold/30 hover:border-talisman-gold text-talisman-gold',
  },
  {
    path: '/game',
    title: 'Typing Benchmark (Rune Typer)',
    desc: 'Interactive speed-typing testing terminal with mechanical sound synthesis.',
    icon: '🎮',
    badge: 'BENCHMARK',
    color: 'border-amber-400/30 hover:border-amber-400 text-amber-400',
  },
  {
    path: '/contact',
    title: 'Contact Engineering Team',
    desc: 'Inquire regarding enterprise architecture consulting, advisory, or integration.',
    icon: '✉️',
    badge: 'CONTACT',
    color: 'border-purple-400/30 hover:border-purple-400 text-purple-400',
  },
];

// Filter out current page and take 3 items
const portals = allPortals.filter(p => !props.currentPath.startsWith(p.path)).slice(0, 3);
</script>

<template>
  <section class="w-full pt-16 pb-6 border-t border-white/10 mt-16 text-left">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <span class="text-xs font-mono text-slate-400 flex items-center gap-1.5 uppercase tracking-wider mb-1">
          <span>⚡</span>
          <span>Explore Ecosystem & Tools</span>
        </span>
        <h3 class="text-2xl sm:text-3xl font-display font-bold text-white">
          Continue Exploring
        </h3>
      </div>
      <Link
        href="/contact"
        class="text-xs font-mono text-phantom-mint hover:underline flex items-center gap-1"
        @click="sound.playTalisman()"
      >
        <span>Or initiate project consultation</span>
        <span>→</span>
      </Link>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Link
        v-for="portal in portals"
        :key="portal.path"
        :href="portal.path"
        class="glass-panel p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 bg-midnight-900/60"
        :class="portal.color"
        @click="sound.playClick()"
      >
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-3xl">{{ portal.icon }}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-slate-300">
              {{ portal.badge }}
            </span>
          </div>

          <h4 class="font-display font-bold text-lg text-white group-hover:text-current transition-colors mb-2">
            {{ portal.title }}
          </h4>

          <p class="text-xs text-slate-300 leading-relaxed font-sans">
            {{ portal.desc }}
          </p>
        </div>

        <div class="text-xs font-mono mt-6 flex items-center gap-1.5 font-bold group-hover:translate-x-1 transition-transform">
          <span>Explore Section</span>
          <span>→</span>
        </div>
      </Link>
    </div>
  </section>
</template>
