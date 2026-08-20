<script setup lang="ts">
import { ref } from 'vue';
import confetti from 'canvas-confetti';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';

const heartClicks = ref(0);

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
        <MiniMascotLogo size="sm" :animated="true" />
        <span class="font-display font-bold text-base sm:text-lg text-white">
          macatung<span class="text-phantom-mint">.dev</span>
        </span>
        <span class="text-xs font-mono text-slate-500 hidden sm:inline">— Code at midnight.</span>
      </div>

      <!-- Hop-to-Top Button -->
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 text-slate-300 hover:text-phantom-mint hover:border-phantom-mint/40 transition-all text-xs font-mono group min-h-[44px]"
        @click="scrollToTop"
      >
        <span>Về Đầu Trang</span>
        <Icons name="ChevronUp" :size="16" class="group-hover:-translate-y-1 transition-transform" />
      </button>
    </div>

    <!-- Navigation Columns Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-white/5 text-xs font-sans">
      <!-- Col 1: Grimoire & Lore -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Grimoire & Lore</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="#hero" class="hover:text-phantom-mint transition-colors">Vương Quốc Đêm</a></li>
          <li><a href="#philosophy" class="hover:text-phantom-mint transition-colors">Triết Lý Vị Nhân Sinh</a></li>
          <li><a href="#about" class="hover:text-phantom-mint transition-colors">Bản Lĩnh Đêm & Manifesto</a></li>
          <li><a href="#projects" class="hover:text-phantom-mint transition-colors">Hệ Thống Grimoire</a></li>
        </ul>
      </div>

      <!-- Col 2: Interactive Labs -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Thí Nghiệm & Pháp Bảo</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="/projects" class="hover:text-phantom-mint transition-colors">Kho Dự Án Grimoire</a></li>
          <li><a href="/game" class="hover:text-phantom-mint transition-colors">Phòng Máy Rune Typer</a></li>
          <li><a href="/talisman" class="hover:text-phantom-mint transition-colors">Lò Luyện Bùa Chú</a></li>
          <li><a href="/theravada" class="hover:text-amber-300 transition-colors flex items-center gap-1"><span>Ma Tọa Thiền (Theravāda)</span> <span>🧘</span></a></li>
        </ul>
      </div>

      <!-- Col 3: Terminal & Altar -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Công Cụ & Tương Tác</h4>
        <ul class="space-y-2 text-slate-400">
          <li><a href="#terminal" class="hover:text-phantom-mint transition-colors">Midnight Terminal CLI</a></li>
          <li><a href="#contact" class="hover:text-phantom-mint transition-colors">Bàn Thờ Triệu Hồi</a></li>
          <li><a href="https://github.com/macatung" target="_blank" rel="noopener noreferrer" class="hover:text-phantom-mint transition-colors">GitHub Repository</a></li>
        </ul>
      </div>

      <!-- Col 4: Status -->
      <div>
        <h4 class="font-mono text-slate-400 uppercase tracking-wider mb-3 text-[11px]">Trạng Thái Hệ Thống</h4>
        <div class="space-y-1.5 text-slate-400 font-mono text-[11px]">
          <div class="flex items-center gap-1.5 text-phantom-mint">
            <span class="w-1.5 h-1.5 rounded-full bg-phantom-mint animate-pulse" />
            <span>100% Uptime Pledge</span>
          </div>
          <div>Audio: Web Audio API (0 asset)</div>
          <div>Framework: Vue 3 + Laravel 11</div>
          <div class="pt-1">
            <a href="/admin" class="text-slate-400 hover:text-phantom-mint transition-colors flex items-center gap-1">
              <span>⚙️ Quản Trị CMS</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Attribution & Heart Easter Egg Bar -->
    <div class="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
      <p class="text-center sm:text-left">
        © 2026 macatung.dev — Crafted with Laravel 11, Inertia.js, Vue 3 & Midnight Magic.
      </p>

      <!-- Easter Egg Heart Button -->
      <div class="flex items-center gap-1.5 text-slate-400 select-none">
        <span>Crafted with</span>
        <button
          type="button"
          class="text-rose-400 hover:scale-125 active:scale-95 transition-transform cursor-pointer p-1 min-h-[32px] min-w-[32px] flex items-center justify-center focus:outline-none"
          title="Bấm để kích hoạt Midnight Love Easter Egg"
          @click="triggerHeartEasterEgg"
        >
          ❤️
        </button>
        <span>& Midnight Robusta</span>
        <span v-if="heartClicks > 0" class="text-phantom-mint font-bold ml-1">({{ heartClicks }})</span>
      </div>
    </div>
  </footer>
</template>
