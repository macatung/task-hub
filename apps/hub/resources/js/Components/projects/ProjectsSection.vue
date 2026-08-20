<script setup lang="ts">
import { ref, computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import { projectsData } from '@/data/projectsData';
import type { Project } from '@/types/portfolio';
import ProjectModal from './ProjectModal.vue';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';

interface Props {
  projects?: Project[];
  featuredOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  projects: () => [],
  featuredOnly: false,
});

type CategoryFilter = 'all' | 'fullstack' | 'creative' | 'ai-web3' | 'tools';

const activeCategory = ref<CategoryFilter>('all');
const searchQuery = ref('');
const selectedProject = ref<Project | null>(null);
const isModalOpen = ref(false);

const categories = [
  { id: 'all', label: 'Tất Cả Dự Án' },
  { id: 'fullstack', label: 'Full-Stack' },
  { id: 'creative', label: 'Creative UI & Audio' },
  { id: 'ai-web3', label: 'AI & Microservices' },
  { id: 'tools', label: 'Developer Tools' }
] as const;

const allProjects = computed(() => {
  return props.projects && props.projects.length > 0 ? props.projects : projectsData;
});

const getCategoryCount = (catId: string): number => {
  if (catId === 'all') return allProjects.value.length;
  return allProjects.value.filter((p) => p.category === catId).length;
};

const displayProjects = computed(() => {
  let list = allProjects.value;

  if (props.featuredOnly) {
    return list.slice(0, 3);
  }

  if (activeCategory.value !== 'all') {
    list = list.filter((p) => p.category === activeCategory.value);
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter((p) => {
      const matchTitle = p.title.toLowerCase().includes(query);
      const matchDesc = p.description.toLowerCase().includes(query);
      const matchTag = p.tags && p.tags.some((t) => t.toLowerCase().includes(query));
      const matchTech = p.techStack && p.techStack.some((t) => t.toLowerCase().includes(query));
      return matchTitle || matchDesc || matchTag || matchTech;
    });
  }

  return list;
});

const setCategory = (cat: CategoryFilter) => {
  activeCategory.value = cat;
  sound.playClick();
};

const openProject = (project: Project) => {
  selectedProject.value = project;
  isModalOpen.value = true;
  sound.playClick();
};

const closeModal = () => {
  isModalOpen.value = false;
  selectedProject.value = null;
  sound.playClick();
};
</script>

<template>
  <section id="projects" class="scroll-mt-24 w-full py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
      <div class="flex flex-col items-start">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-phantom-mint text-xs font-mono mb-3 whitespace-nowrap select-none shadow-glow-mint">
          📜 The Grimoire Portfolio
        </span>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight">
          {{ featuredOnly ? 'Dự Án Kiến Trúc' : 'Tác Phẩm &' }} <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">{{ featuredOnly ? 'Tiêu Biểu' : 'Thực Chiến' }}</span>
        </h2>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
          Những hệ thống phân tán, web app tải cao và công cụ sáng tạo được kiến tạo trong những phiên lập trình tĩnh lặng.
        </p>
      </div>

      <!-- Search Input (Only on Full Projects page) -->
      <div v-if="!featuredOnly" class="w-full sm:w-72 relative">
        <Icons name="Search" :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm kiếm công nghệ, tên..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-midnight-900/90 border border-white/10 text-slate-200 placeholder-slate-500 text-xs sm:text-sm font-sans focus:outline-none focus:border-phantom-mint transition-colors"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
          @click="searchQuery = ''"
        >
          ✕
        </button>
      </div>

      <!-- Direct Link to Projects if on Home -->
      <Link
        v-else
        href="/projects"
        class="px-5 py-3 rounded-2xl bg-white/5 hover:bg-phantom-mint text-slate-200 hover:text-midnight-950 font-display font-bold text-xs sm:text-sm transition-all flex items-center gap-2 border border-white/10 hover:border-phantom-mint shadow-sm hover:shadow-glow-mint whitespace-nowrap"
      >
        <span>Xem Toàn Bộ 6+ Dự Án</span>
        <span>→</span>
      </Link>
    </div>

    <!-- Category Filter Tabs (Only on full projects page) -->
    <div v-if="!featuredOnly" class="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-mono font-medium transition-all min-h-[40px] shrink-0 border select-none whitespace-nowrap flex items-center gap-2"
        :class="activeCategory === cat.id
          ? 'bg-phantom-mint text-midnight-950 border-phantom-mint font-bold shadow-glow-mint'
          : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
        @click="setCategory(cat.id as CategoryFilter)"
      >
        <span>{{ cat.label }}</span>
        <span
          class="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
          :class="activeCategory === cat.id ? 'bg-midnight-950/20 text-midnight-950' : 'bg-white/10 text-slate-400'"
        >
          {{ getCategoryCount(cat.id) }}
        </span>
      </button>
    </div>

    <!-- No Results State -->
    <div
      v-if="displayProjects.length === 0"
      class="p-12 text-center rounded-2xl glass-panel border border-white/10 text-slate-400"
    >
      <div class="text-3xl mb-3">🔍</div>
      <h3 class="text-white font-display font-bold text-lg mb-1">Không tìm thấy dự án phù hợp</h3>
      <p class="text-xs sm:text-sm">Hãy thử tìm với từ khóa khác như "Laravel", "Vue", "Audio" hoặc chọn "Tất Cả Dự Án".</p>
    </div>

    <!-- Project Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="project in displayProjects"
        :key="project.id"
        class="rounded-2xl border border-white/[0.08] glass-panel overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:border-phantom-mint/40 hover:shadow-xl hover:shadow-black/40 group"
      >
        <!-- Card Cover Banner -->
        <div class="p-5 pb-3 border-b border-white/5 flex flex-col justify-between bg-midnight-900/60 relative overflow-hidden">
          <!-- Subtle Accent Background Glow -->
          <div class="absolute top-0 right-0 w-32 h-32 bg-phantom-mint/5 rounded-full blur-2xl pointer-events-none group-hover:bg-phantom-mint/10 transition-colors" />

          <div class="flex items-center justify-between mb-3 relative z-10">
            <span class="px-2.5 py-0.5 rounded-full bg-white/5 text-[10px] font-mono uppercase tracking-wider text-slate-300 border border-white/10 whitespace-nowrap">
              {{ project.category }}
            </span>
            <span v-if="project.featured" class="text-[11px] font-mono text-talisman-gold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-talisman-gold/30 whitespace-nowrap flex items-center gap-1 font-bold">
              <span>★</span>
              <span>Featured</span>
            </span>
          </div>
          <h3 class="font-display font-bold text-lg text-white group-hover:text-phantom-mint transition-colors relative z-10">
            {{ project.title }}
          </h3>
          <p class="text-xs font-mono text-phantom-mint mt-1 truncate relative z-10">{{ project.tagline }}</p>
        </div>

        <!-- Card Content -->
        <div class="p-5 flex-1 flex flex-col justify-between text-left">
          <div>
            <p class="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed font-sans">{{ project.description }}</p>

            <!-- Metrics Preview Matrix -->
            <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-midnight-950/80 border border-white/5 mb-4">
              <div v-for="m in project.metrics" :key="m.label" class="text-center">
                <div class="text-[10px] font-mono text-slate-400 truncate">{{ m.label }}</div>
                <div class="text-xs font-display font-bold text-slate-100 mt-0.5 whitespace-nowrap">{{ m.value }}</div>
              </div>
            </div>

            <!-- Tech Stack Badges -->
            <div class="flex flex-wrap gap-1.5 mb-5">
              <span
                v-for="tech in project.tags.slice(0, 4)"
                :key="tech"
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300 border border-white/5 whitespace-nowrap group-hover:border-white/10 transition-colors"
              >
                {{ tech }}
              </span>
              <span
                v-if="project.tags.length > 4"
                class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-400 border border-white/5"
              >
                +{{ project.tags.length - 4 }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
            <button
              type="button"
              class="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-phantom-mint text-slate-200 hover:text-midnight-950 font-display font-bold text-xs transition-all min-h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap border border-white/10 hover:border-phantom-mint shadow-sm hover:shadow-glow-mint cursor-pointer"
              @click="openProject(project)"
            >
              <span>Xem Chi Tiết Kiến Trúc</span>
              <span>→</span>
            </button>
            <div class="px-2.5 py-1.5 rounded-lg bg-midnight-950 border border-white/5 text-[10px] font-mono text-slate-400 flex items-center gap-1 select-none" title="Dự án doanh nghiệp bảo mật NDA">
              <span>🔒</span>
              <span class="hidden sm:inline">NDA</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Featured Showcase CTA Banner (Only on Home Page) -->
    <div
      v-if="featuredOnly"
      class="mt-12 p-6 sm:p-8 rounded-3xl glass-panel border border-phantom-mint/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-r from-phantom-mint/5 via-midnight-900/50 to-talisman-gold/5 shadow-glow-mint"
    >
      <div>
        <span class="text-xs font-mono text-phantom-mint font-bold uppercase tracking-wider">📜 Kho Lưu Trữ Kiến Trúc</span>
        <h3 class="text-xl sm:text-2xl font-display font-extrabold text-white mt-1">Khám Phá Toàn Bộ 6+ Dự Án Chuyên Sâu</h3>
        <p class="text-xs sm:text-sm text-slate-400 mt-1 font-sans">Xem chi tiết các hệ thống viễn thông GIS 500k điểm nút, giải pháp Multi-Agent AI tự trị và nền tảng xử lý dữ liệu lớn.</p>
      </div>
      <Link
        href="/projects"
        class="px-6 py-3.5 rounded-2xl bg-phantom-mint text-midnight-950 font-display font-bold text-xs sm:text-sm hover:brightness-110 shadow-glow-mint transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
        @click="sound.playClick()"
      >
        <span>Vào Kho Grimoire Đầy Đủ</span>
        <span>→</span>
      </Link>
    </div>

    <!-- Project Modal Dialog -->
    <ProjectModal
      :is-open="isModalOpen"
      :project="selectedProject"
      @close="closeModal"
    />
  </section>
</template>
