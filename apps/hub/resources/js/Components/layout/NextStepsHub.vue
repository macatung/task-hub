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
    title: 'Kho Grimoire Dự Án',
    desc: '6+ Dự án thực chiến chịu tải cao, AI Agent & viễn thông GIS.',
    icon: '💼',
    badge: 'ENTERPRISE',
    color: 'border-phantom-mint/30 hover:border-phantom-mint text-phantom-mint',
  },
  {
    path: '/blog',
    title: 'Midnight Tech Chronicle',
    desc: 'Ghi chép chuyên sâu về kiến trúc Multi-Agent & tối ưu hóa hệ thống.',
    icon: '📜',
    badge: 'TECH NOTES',
    color: 'border-talisman-gold/30 hover:border-talisman-gold text-talisman-gold',
  },
  {
    path: '/game',
    title: 'Phòng Máy Rune Typer',
    desc: 'Sàn đấu gõ phím trừ tà, âm thanh phím cơ thock & săn Boss Bug.',
    icon: '🎮',
    badge: 'ARCADE',
    color: 'border-amber-400/30 hover:border-amber-400 text-amber-400',
  },
  {
    path: '/talisman',
    title: 'Lò Rèn Bùa Hộ Mệnh',
    desc: 'Tùy biến bùa hộ mệnh nhà phát triển và xuất file ảnh sắc nét.',
    icon: '✨',
    badge: 'DEV FORGE',
    color: 'border-emerald-400/30 hover:border-emerald-400 text-emerald-400',
  },
  {
    path: '/contact',
    title: 'Điện Thờ Triệu Hồi',
    desc: 'Gửi yêu cầu tư vấn giải pháp kỹ thuật, kết nối cùng kiến trúc sư.',
    icon: '📜',
    badge: 'CONSULTING',
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
          <span>🔮</span>
          <span>Khám Phá Các Cõi Tiếp Theo</span>
        </span>
        <h3 class="text-2xl sm:text-3xl font-display font-bold text-white">
          Tiếp Tục Hành Trình
        </h3>
      </div>
      <Link
        href="/contact"
        class="text-xs font-mono text-phantom-mint hover:underline flex items-center gap-1"
        @click="sound.playTalisman()"
      >
        <span>Hoặc triệu hồi tư vấn giải pháp ngay</span>
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
          <span>Bước vào cõi này</span>
          <span>→</span>
        </div>
      </Link>
    </div>
  </section>
</template>
