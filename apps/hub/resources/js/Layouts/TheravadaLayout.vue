<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Link, usePage } from '@inertiajs/vue3';
import SeoHead from '@/Components/common/SeoHead.vue';
import ZenMascotLogo from '@/Components/theravada/ZenMascotLogo.vue';
import ZenBackgroundCanvas from '@/Components/theravada/ZenBackgroundCanvas.vue';
import PaliGlossaryModal from '@/Components/theravada/PaliGlossaryModal.vue';
import Icons from '@/Components/ui/Icons.vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';
import { useZenTimeCycle } from '@/composables/useZenTimeCycle';

defineProps<{
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'profile';
  ogImage?: string;
  article?: any;
  jsonLd?: any;
}>();

const page = usePage();
const isGlossaryOpen = ref(false);
const isMobileMenuOpen = ref(false);
const { activeZenPhase } = useZenTimeCycle();

const navItems = [
  { label: 'Trang Chủ', href: '/theravada', icon: 'Home' },
  { label: 'Pháp Học', href: '/theravada/danh-muc/phap-hoc', icon: 'BookOpen' },
  { label: 'Pháp Hành (Vipassanā)', href: '/theravada/danh-muc/phap-hanh', icon: 'Sparkles' },
  { label: 'Kinh Tụng', href: '/theravada/danh-muc/kinh-tung', icon: 'Scroll' },
  { label: 'Từ Điển Pāḷi', href: '/theravada/tu-dien-pali', icon: 'Compass' },
];

const isLinkActive = (href: string): boolean => {
  const currentUrl = page.url;
  if (href === '/theravada') return currentUrl === '/theravada';
  return currentUrl.startsWith(href);
};

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
  mindfulBell.strikeWoodenFish();
};

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};

const handleNavClick = () => {
  closeMobileMenu();
  mindfulBell.strikeWoodenFish();
};

// Close on escape key
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isMobileMenuOpen.value) {
    closeMobileMenu();
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }
});
</script>

<template>
  <div class="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-stone-950 font-serif flex flex-col justify-between relative overflow-x-hidden antialiased">
    <SeoHead
      :title="title"
      :description="description"
      :keywords="keywords"
      :canonical="canonical || 'https://theravada.macatung.dev'"
      :og-type="ogType || 'website'"
      :og-image="ogImage"
      :article="article"
      :json-ld="jsonLd"
      :is-theravada="true"
    />

    <!-- Ambient Subtle Warm Light Aura Dynamically Tinted by 24H Monastic Time -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] sm:w-[600px] lg:w-[800px] h-[300px] sm:h-[450px] rounded-full blur-[100px] sm:blur-[160px] opacity-20 transition-all duration-1000"
        :style="{ backgroundColor: activeZenPhase.accentHex }"
      />
      <div
        class="absolute bottom-0 right-0 sm:right-10 w-[300px] sm:w-[500px] lg:w-[600px] h-[300px] sm:h-[600px] rounded-full blur-[120px] sm:blur-[180px] opacity-15 transition-all duration-1000"
        :style="{ backgroundColor: activeZenPhase.accentHex }"
      />
    </div>

    <!-- Multi-Layer Zen Background Canvas (Dhamma Wheel, Petals, Bodhi Leaves & Incense Smoke) -->
    <ZenBackgroundCanvas />

    <!-- 1. Zen Top Navigation Header -->
    <header class="sticky top-0 z-40 w-full border-b border-amber-500/20 bg-stone-950/95 backdrop-blur-xl shadow-xl py-3 sm:py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-6">
        
        <!-- Brand / Zen Mascot Logo + Title: MA TỌA THIỀN -->
        <Link
          href="/theravada"
          class="flex items-center gap-2.5 sm:gap-3.5 group transition-transform duration-300 hover:scale-[1.02] shrink-0 min-w-0"
          @click="closeMobileMenu"
        >
          <!-- Mascot Tọa Thiền Tòa Sen Logo -->
          <ZenMascotLogo :size="42" class="sm:w-12 sm:h-12 shrink-0" />
          
          <div class="flex flex-col text-left justify-center min-w-0">
            <div class="flex items-center gap-1.5 sm:gap-2">
              <span class="text-base sm:text-xl lg:text-2xl font-serif font-bold text-amber-100 tracking-tight sm:tracking-wide truncate">
                Ma Tọa Thiền
              </span>
              <span class="inline-block text-[10px] sm:text-[11px] font-sans px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 font-semibold shrink-0 shadow-sm">
                Theravāda
              </span>
            </div>
            <span class="text-[10px] sm:text-xs font-serif text-stone-400 italic truncate">
              Chánh Niệm Từng Giây • Theravāda
            </span>
          </div>
        </Link>

        <!-- Desktop Navigation Links (hidden on < lg: 1024px) -->
        <nav class="hidden lg:flex items-center gap-1 xl:gap-2 shrink-0" aria-label="Zen Desktop Navigation">
          <Link
            v-for="item in navItems"
            :key="item.href"
            :href="item.href"
            class="px-3 xl:px-4 py-2 rounded-2xl text-xs xl:text-sm font-serif transition-all font-semibold whitespace-nowrap shrink-0 focus:outline-none"
            :class="[
              item.isHighlight
                ? 'text-amber-300 hover:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 font-bold shadow-sm'
                : isLinkActive(item.href)
                  ? 'text-amber-300 bg-stone-900/90 border border-amber-500/40 shadow-inner'
                  : 'text-stone-200 hover:text-amber-300 hover:bg-stone-900/90'
            ]"
            @click="mindfulBell.strikeWoodenFish()"
          >
            <span>{{ item.isHighlight ? '✨ ' : '' }}{{ item.label }}</span>
          </Link>
        </nav>

        <!-- Mobile & Tablet Action Controls -->
        <div class="flex items-center gap-2 lg:hidden shrink-0">
          <!-- Mobile Hamburger Drawer Toggle Button -->
          <button
            type="button"
            class="p-2.5 rounded-2xl bg-stone-900/90 border border-amber-500/30 text-amber-300 hover:text-amber-200 hover:bg-stone-800 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-md"
            :aria-expanded="isMobileMenuOpen"
            aria-label="Toggle Mobile Menu"
            @click="toggleMobileMenu"
          >
            <Icons :name="isMobileMenuOpen ? 'X' : 'Menu'" :size="22" />
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
          v-if="isMobileMenuOpen"
          class="fixed inset-0 top-[62px] sm:top-[70px] bg-black/80 backdrop-blur-sm z-30 lg:hidden"
          @click="closeMobileMenu"
        />
      </transition>

      <!-- Zen Mobile Slide-Down Navigation Drawer (100% Solid Opaque Dark Background) -->
      <transition
        enter-active-class="transition duration-250 ease-out"
        enter-from-class="opacity-0 -translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div
          v-if="isMobileMenuOpen"
          class="lg:hidden border-t border-b border-amber-500/30 bg-[#0c0a09] px-4 sm:px-6 py-5 space-y-3 absolute top-full left-0 w-full shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-50 text-left max-h-[calc(100vh-75px)] overflow-y-auto"
          style="background-color: #0c0a09;"
        >
          <div class="grid grid-cols-1 gap-2">
            <Link
              v-for="item in navItems"
              :key="item.href"
              :href="item.href"
              class="flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-serif font-semibold transition-all min-h-[46px] border"
              :class="[
                item.isHighlight
                  ? 'text-stone-950 bg-gradient-to-r from-amber-400 to-yellow-500 border-amber-400 font-bold shadow-md'
                  : isLinkActive(item.href)
                    ? 'text-amber-300 bg-amber-500/20 font-bold border-amber-500/50'
                    : 'text-stone-200 bg-stone-900/90 border-stone-800/80 hover:text-amber-300 hover:bg-stone-900 hover:border-amber-500/40'
              ]"
              @click="handleNavClick"
            >
              <div class="flex items-center gap-3">
                <span class="text-base">{{ item.isHighlight ? '✨' : item.icon === 'Home' ? '🏠' : item.icon === 'BookOpen' ? '📖' : item.icon === 'Sparkles' ? '🧘' : item.icon === 'Scroll' ? '📜' : '☸️' }}</span>
                <span>{{ item.label }}</span>
              </div>
              <span class="text-xs opacity-60 font-mono">➔</span>
            </Link>
          </div>

          <div class="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-3">
            <Link
              href="/"
              class="w-full py-3 px-4 rounded-2xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-300 hover:bg-stone-800 text-xs font-serif font-semibold text-center flex items-center justify-center gap-2 transition-all min-h-[44px]"
              @click="handleNavClick"
            >
              <span>🌐</span>
              <span>Về Trang Chủ Macatung.dev</span>
            </Link>
          </div>
        </div>
      </transition>
    </header>

    <!-- Main Content Stage -->
    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10">
      <slot />
    </main>

    <!-- 2. Zen Footer -->
    <footer class="relative z-10 border-t border-stone-800/90 bg-stone-950/98 py-10 sm:py-12 px-4 sm:px-6 lg:px-8 text-center font-serif text-stone-300 text-sm">
      <div class="max-w-4xl mx-auto flex flex-col items-center gap-4 sm:gap-5">
        <!-- Dharma Lotus Seal -->
        <div class="flex items-center justify-center gap-2 sm:gap-3 text-amber-400 text-base sm:text-xl">
          <span>🌸</span>
          <span class="h-px w-12 sm:w-20 bg-amber-500/40" />
          <ZenMascotLogo :size="36" class="sm:w-10 sm:h-10 shrink-0" />
          <span class="h-px w-12 sm:w-20 bg-amber-500/40" />
          <span>🌸</span>
        </div>

        <p class="italic text-stone-200 max-w-2xl leading-relaxed text-xs sm:text-base px-2">
          "Sabbapāpassa akaraṇaṃ, kusalassa upasampadā; Sacittapariyodapanaṃ, etaṃ buddhāna sāsanaṃ."<br />
          <span class="text-amber-300 text-[11px] sm:text-sm not-italic mt-1.5 block font-semibold leading-normal">
            (Không làm mọi điều ác, Thành tựu các hạnh lành, Giữ tâm ý trong sạch, Đó lời chư Phật dạy — Kinh Pháp Cú 183)
          </span>
        </p>

        <div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs sm:text-sm text-stone-300 pt-4 border-t border-stone-900 w-full font-serif leading-loose">
          <span class="w-full sm:w-auto font-medium">© 2026 Ma Tọa Thiền • Theravāda Dhamma • macatung.dev</span>
          <span class="hidden sm:inline">•</span>
          <Link href="/theravada/danh-muc/phap-hoc" class="hover:text-amber-300 font-semibold px-1">Pháp Học</Link>
          <span>•</span>
          <Link href="/theravada/danh-muc/phap-hanh" class="hover:text-amber-300 font-semibold px-1">Thiền Vipassanā</Link>
          <span>•</span>
          <Link href="/theravada/danh-muc/kinh-tung" class="hover:text-amber-300 font-semibold px-1">Kinh Tụng</Link>
          <span>•</span>
          <Link href="/theravada/tu-dien-pali" class="hover:text-amber-300 font-semibold px-1">Từ Điển Pāḷi</Link>
          <span>•</span>
          <Link href="/" class="hover:text-amber-300 font-sans font-semibold px-1">macatung.dev</Link>
        </div>
      </div>
    </footer>

    <!-- Interactive Pāḷi Glossary Modal -->
    <PaliGlossaryModal
      :is-open="isGlossaryOpen"
      @close="isGlossaryOpen = false"
    />
  </div>
</template>
