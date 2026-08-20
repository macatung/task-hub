<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Link, usePage } from '@inertiajs/vue3';
import MidnightClock from '@/Components/mascot/MidnightClock.vue';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import FloatingMascotCompanion from '@/Components/mascot/FloatingMascotCompanion.vue';
import SoundToggle from '@/Components/layout/SoundToggle.vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';
import { useTimeCycle } from '@/composables/useTimeCycle';

const { activePhase } = useTimeCycle();
const page = usePage();

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  iconName?: string;
}

const navLinks: NavItem[] = [
  { label: 'Trang Chủ', href: '/', iconName: 'Home' },
  { label: 'Dự Án', href: '/projects', iconName: 'Layers' },
  { label: 'Desktop', href: '/desktop', badge: 'NEW', iconName: 'Monitor' },
  { label: 'Blog', href: '/blog', badge: 'MỚI', iconName: 'BookOpen' },
  { label: 'Game 🎮', href: '/game', badge: 'HOT', iconName: 'Gamepad' },
  { label: 'Bùa Dev', href: '/talisman', iconName: 'Sparkles' },
  { label: 'Tọa Thiền 🧘', href: '/theravada', badge: 'ZEN', iconName: 'Sparkles' },
];

const isScrolled = ref(false);
const isMobileDrawerOpen = ref(false);
const scrollProgress = ref(0);

const isLinkActive = (href: string): boolean => {
  const currentUrl = page.url;
  if (href === '/') return currentUrl === '/';
  return currentUrl.startsWith(href);
};

const handleScroll = () => {
  if (typeof window !== 'undefined') {
    const y = window.scrollY;
    isScrolled.value = y > 40;

    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0) {
      scrollProgress.value = Math.min(100, Math.max(0, (y / totalHeight) * 100));
    }
  }
};

const toggleMobileDrawer = () => {
  isMobileDrawerOpen.value = !isMobileDrawerOpen.value;
  sound.playClick();
};

const closeMobileDrawer = () => {
  isMobileDrawerOpen.value = false;
};

const handleNavClick = () => {
  closeMobileDrawer();
  sound.playClick();
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleScroll);
  }
});
</script>

<template>
  <header
    class="sticky top-0 z-40 transition-all duration-300 border-b relative"
    :class="isScrolled
      ? 'bg-midnight-950/95 backdrop-blur-xl border-white/10 shadow-xl shadow-black/50 py-2.5'
      : 'bg-midnight-950/80 backdrop-blur-md border-white/5 py-3.5'"
  >
    <!-- Top Glowing Scroll Progress Indicator with Dynamic Phase Accent -->
    <div
      class="absolute top-0 left-0 h-[2px] transition-all duration-300 z-50 pointer-events-none"
      :style="{
        width: `${scrollProgress}%`,
        backgroundColor: activePhase.accentHex,
        boxShadow: `0 0 12px ${activePhase.accentHex}`
      }"
    />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      
      <!-- Brand Logo with Animated Hopping Mascot -->
      <Link
        href="/"
        class="flex items-center gap-3 select-none group focus:outline-none flex-shrink-0"
        title="Về Trang Chủ Macatung"
        @click="sound.playHop(1.3)"
      >
        <!-- Animated Mini Vector Mascot Badge -->
        <MiniMascotLogo size="md" :animated="true" />

        <div class="flex flex-col">
          <span class="font-display font-bold text-base sm:text-lg tracking-tight text-white flex items-center group-hover:text-phantom-mint transition-colors">
            macatung<span class="text-phantom-mint">.dev</span>
          </span>
          <span class="text-[10px] font-mono text-slate-400 -mt-0.5 tracking-wider hidden sm:inline-block">
            Code at midnight
          </span>
        </div>
      </Link>

      <!-- Desktop Nav Items (100% Consistent Page Navigation Links) -->
      <nav class="hidden lg:flex items-center gap-1 xl:gap-1.5 px-3 py-1.5 rounded-2xl glass-panel border border-white/5" aria-label="Main Navigation">
        <Link
          v-for="item in navLinks"
          :key="item.href"
          :href="item.href"
          class="px-3.5 py-1.5 rounded-xl text-xs xl:text-sm font-sans font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap focus:outline-none"
          :class="isLinkActive(item.href)
            ? 'text-phantom-mint bg-phantom-mint/10 font-bold border border-phantom-mint/20 shadow-glow-mint'
            : 'text-slate-300 hover:text-white hover:bg-white/5'"
          @click="sound.playClick()"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-tight"
            :class="item.badge === 'HOT' ? 'bg-amber-500/20 text-talisman-gold border border-talisman-gold/40' : 'bg-phantom-mint/20 text-phantom-mint border border-phantom-mint/30'"
          >
            {{ item.badge }}
          </span>
        </Link>
      </nav>

      <!-- Right Action Controls (Time Clock, Sound Toggle, CTA Button & Mobile Toggle) -->
      <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <!-- Dynamic Midnight Chronos Clock Pill -->
        <MidnightClock />

        <!-- Web Audio Procedural Sound Toggle Button -->
        <SoundToggle />

        <!-- Desktop Direct CTA Page Link (Contact Summoning Altar) -->
        <Link
          href="/contact"
          class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold text-midnight-950 transition-all hover:brightness-110 active:scale-95 shadow-md flex-shrink-0"
          :style="{
            backgroundColor: activePhase.accentHex,
            boxShadow: `0 4px 16px -2px ${activePhase.accentGlow}`
          }"
          @click="sound.playTalisman()"
        >
          <span>Triệu Hồi</span>
          <span>📜</span>
        </Link>

        <!-- Mobile Hamburger Toggle Button -->
        <button
          type="button"
          class="lg:hidden p-2 rounded-xl bg-midnight-900 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-phantom-mint"
          :aria-expanded="isMobileDrawerOpen"
          aria-label="Toggle Mobile Menu"
          @click="toggleMobileDrawer"
        >
          <Icons :name="isMobileDrawerOpen ? 'X' : 'Menu'" :size="20" />
        </button>
      </div>

    </div>

    <!-- Dimmed Background Backdrop Overlay for Mobile Menu -->
    <transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileDrawerOpen"
        class="fixed inset-0 top-[62px] sm:top-[70px] bg-black/80 backdrop-blur-sm z-30 lg:hidden"
        @click="isMobileDrawerOpen = false"
      />
    </transition>

    <!-- Mobile Slide-down Navigation Drawer (Solid Opaque Dark Background) -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div
        v-if="isMobileDrawerOpen"
        class="lg:hidden border-t border-b border-white/10 bg-midnight-950 px-5 sm:px-6 py-6 space-y-3 absolute top-full left-0 w-full shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-50 text-left max-h-[calc(100vh-75px)] overflow-y-auto"
        style="background-color: #030712;"
      >
        <div class="grid grid-cols-1 gap-1.5">
          <Link
            v-for="item in navLinks"
            :key="item.href"
            :href="item.href"
            class="flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all border border-transparent"
            :class="isLinkActive(item.href)
              ? 'text-phantom-mint bg-phantom-mint/15 font-bold border-phantom-mint/30 shadow-glow-mint'
              : 'text-slate-200 bg-midnight-900/90 border-white/5 hover:text-white hover:bg-white/10 hover:border-white/15'"
            @click="handleNavClick"
          >
            <div class="flex items-center gap-3">
              <Icons :name="item.iconName || 'Code'" :size="18" class="text-slate-400" />
              <span>{{ item.label }}</span>
            </div>
            <span
              v-if="item.badge"
              class="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold"
              :class="item.badge === 'HOT' ? 'bg-amber-500/20 text-talisman-gold border border-talisman-gold/40' : item.badge === 'ZEN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-phantom-mint/20 text-phantom-mint border border-phantom-mint/30'"
            >
              {{ item.badge }}
            </span>
          </Link>
        </div>

        <div class="pt-4 border-t border-white/10 flex flex-col gap-3">
          <Link
            href="/contact"
            class="w-full py-3.5 rounded-2xl font-display font-bold text-center text-midnight-950 transition-all flex items-center justify-center gap-2"
            :style="{
              backgroundColor: activePhase.accentHex,
              boxShadow: `0 4px 16px -2px ${activePhase.accentGlow}`
            }"
            @click="handleNavClick(); sound.playTalisman()"
          >
            <span>Triệu Hồi Lập Trình Viên</span>
            <span>📜</span>
          </Link>
        </div>
      </div>
    </transition>
  </header>

  <!-- Global Floating Interactive Screen Pet Companion -->
  <FloatingMascotCompanion />
</template>
