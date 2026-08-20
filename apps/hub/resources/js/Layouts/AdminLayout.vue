<script setup lang="ts">
import { Link, usePage, router } from '@inertiajs/vue3';
import { computed, ref, onMounted } from 'vue';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import Icons from '@/Components/ui/Icons.vue';

defineProps<{
  title?: string;
}>();

const page = usePage();
const flash = computed(() => page.props.flash as any);

const isCollapsed = ref(false);
const isMobileOpen = ref(false);

onMounted(() => {
  try {
    const saved = localStorage.getItem('macatung_admin_sidebar_collapsed');
    if (saved !== null) {
      isCollapsed.value = saved === 'true';
    }
  } catch {
    // Fallback
  }
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  try {
    localStorage.setItem('macatung_admin_sidebar_collapsed', String(isCollapsed.value));
  } catch {
    // Fallback
  }
};

const navItems = [
  { label: 'Tổng Quan', href: '/admin', icon: 'Terminal', exact: true, badge: null },
  { label: 'Lưu Lượng (Analytics)', href: '/admin/analytics', icon: 'Activity', exact: false, badge: 'Live' },
  { label: 'Quản Lý Dự Án', href: '/admin/projects', icon: 'Sparkles', exact: false, badge: null },
  { label: 'Kỹ Năng & Pháp Bảo', href: '/admin/skills', icon: 'Zap', exact: false, badge: null },
  { label: 'Biên Niên Sử', href: '/admin/experiences', icon: 'Clock', exact: false, badge: null },
  { label: 'Ghi Chú & Bài Viết', href: '/admin/articles', icon: 'FileText', exact: false, badge: null },
  { label: 'Hộp Thư Triệu Hồi', href: '/admin/contacts', icon: 'Mail', exact: false, badge: null },
  { label: 'Cài Đặt & Profile', href: '/admin/settings', icon: 'Shield', exact: false, badge: null },
];

const isCurrentRoute = (href: string, exact: boolean) => {
  const currentUrl = page.url;
  if (exact) {
    return currentUrl === href || currentUrl === '/admin/dashboard';
  }
  return currentUrl.startsWith(href);
};

const handleLogout = () => {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi Admin CMS?')) {
    router.post('/admin/logout');
  }
};
</script>

<template>
  <!-- Full Screen (100vh) Zero Outer Scroll Layout -->
  <div class="h-screen w-screen max-h-screen overflow-hidden bg-midnight-950 text-slate-100 flex flex-col font-sans selection:bg-phantom-mint selection:text-midnight-950 antialiased">
    <!-- Top Header Bar (Fixed Height: h-14, Zero Shrink) -->
    <header class="h-14 shrink-0 z-40 bg-midnight-900/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between w-full">
      <!-- Left Logo & Collapse Trigger -->
      <div class="flex items-center gap-3 sm:gap-4">
        <!-- Sidebar Collapse Toggle Button (Desktop) -->
        <button
          type="button"
          class="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-phantom-mint transition-all border border-white/5"
          :title="isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'"
          @click="toggleCollapse"
        >
          <Icons :name="isCollapsed ? 'ChevronRight' : 'ChevronLeft'" :size="18" />
        </button>

        <!-- Mobile Drawer Toggle Button -->
        <button
          type="button"
          class="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
          @click="isMobileOpen = !isMobileOpen"
        >
          <Icons name="Terminal" :size="18" />
        </button>

        <Link href="/admin" class="flex items-center gap-2.5 group">
          <MiniMascotLogo size="sm" :animated="true" />
          <div class="flex flex-col text-left">
            <span class="font-display font-bold text-sm text-white flex items-center gap-1">
              macatung<span class="text-phantom-mint">.admin</span>
            </span>
            <span class="text-[10px] font-mono text-slate-400 -mt-0.5">Portfolio CMS & Traffic Analytics</span>
          </div>
        </Link>
      </div>

      <!-- Right Actions (Portfolio link, Live node, Logout) -->
      <div class="flex items-center gap-2.5 sm:gap-3">
        <Link
          href="/"
          target="_blank"
          class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5 border border-white/5"
        >
          <span>👁️ Xem Portfolio</span>
        </Link>

        <button
          type="button"
          class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-mono transition-all border border-rose-500/20"
          title="Đăng xuất khỏi Admin"
          @click="handleLogout"
        >
          <span>🚪 Đăng Xuất</span>
        </button>

        <span class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-[11px] font-mono whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-phantom-mint animate-pulse" />
          <span>Live Node</span>
        </span>
      </div>
    </header>

    <!-- Body Workspace (Fills Remaining Height, Overflow Hidden) -->
    <div class="flex-1 flex overflow-hidden w-full relative">
      <!-- Mobile Drawer Backdrop -->
      <div
        v-if="isMobileOpen"
        class="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
        @click="isMobileOpen = false"
      />

      <!-- Left Navigation Sidebar: Fixed in Place (No scroll with page) -->
      <aside
        class="h-full shrink-0 bg-midnight-900/95 md:bg-midnight-900/60 border-r border-white/10 flex flex-col justify-between transition-all duration-300 ease-in-out z-30 md:static fixed top-14 bottom-0 left-0"
        :class="[
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        ]"
      >
        <!-- Nav Items (Scrolls internally only if menu exceeds screen height) -->
        <div class="p-3 space-y-1 overflow-y-auto no-scrollbar flex-1">
          <div
            v-if="!isCollapsed"
            class="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 py-2 text-left"
          >
            Quản Trị Hệ Thống
          </div>

          <Link
            v-for="item in navItems"
            :key="item.href"
            :href="item.href"
            class="rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center group relative text-left"
            :class="[
              isCollapsed ? 'p-3 justify-center' : 'px-3.5 py-2.5 gap-3 justify-between',
              isCurrentRoute(item.href, item.exact)
                ? 'bg-phantom-mint text-midnight-950 font-bold shadow-glow-mint'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            ]"
            @click="isMobileOpen = false"
          >
            <div class="flex items-center gap-3 min-w-0">
              <Icons :name="item.icon" :size="18" class="shrink-0" />
              <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
            </div>

            <!-- Badge when expanded -->
            <span
              v-if="!isCollapsed && item.badge"
              class="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase"
              :class="isCurrentRoute(item.href, item.exact) ? 'bg-midnight-950 text-phantom-mint' : 'bg-phantom-mint/20 text-phantom-mint'"
            >
              {{ item.badge }}
            </span>

            <!-- Tooltip when collapsed (Desktop) -->
            <div
              v-if="isCollapsed"
              class="absolute left-full ml-3 px-2.5 py-1 bg-midnight-900 border border-white/10 text-white text-xs rounded-lg whitespace-nowrap hidden group-hover:block z-50 shadow-2xl font-sans pointer-events-none"
            >
              {{ item.label }}
            </div>
          </Link>
        </div>

        <!-- Sidebar Footer Status Card -->
        <div class="p-3 border-t border-white/5 shrink-0">
          <!-- Expanded Card -->
          <div v-if="!isCollapsed" class="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5 text-xs font-mono space-y-1.5 text-left">
            <div class="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Hạ Tầng Live</div>
            <div class="flex justify-between text-slate-300">
              <span>Framework:</span>
              <span class="text-phantom-mint font-semibold">Laravel 11</span>
            </div>
            <div class="flex justify-between text-slate-300">
              <span>Analytics:</span>
              <span class="text-phantom-cyan font-semibold">Self-Hosted</span>
            </div>
          </div>

          <!-- Collapsed Icon Indicator -->
          <div v-else class="flex justify-center p-1" title="Hệ thống Live 100%">
            <span class="w-2.5 h-2.5 rounded-full bg-phantom-mint animate-pulse" />
          </div>
        </div>
      </aside>

      <!-- Right Main Content Area: Independently Scrollable (100% Full Width) -->
      <main class="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 text-left w-full custom-scrollbar">
        <!-- Flash Message Notification Banner -->
        <div
          v-if="flash?.success || flash?.status"
          class="p-4 rounded-2xl bg-phantom-mint/10 border border-phantom-mint/40 text-phantom-mint text-xs sm:text-sm font-mono flex items-center gap-2.5 animate-fadeIn"
        >
          <span>✓</span>
          <span>{{ flash.success || flash.status }}</span>
        </div>

        <div
          v-if="flash?.warning"
          class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs sm:text-sm font-mono flex items-center gap-2.5 animate-fadeIn"
        >
          <span>⚠️</span>
          <span>{{ flash.warning }}</span>
        </div>

        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(4, 7, 13, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 245, 160, 0.3);
}
</style>
