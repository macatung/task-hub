<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';

interface ArticleItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image?: string;
  tags: string[];
  reading_time_min: number;
  published_at: string;
  views_count: number;
}

const props = defineProps<{
  articles: ArticleItem[];
  allTags: string[];
  currentTag?: string;
  currentSearch?: string;
  settings?: Record<string, string>;
}>();

const searchQuery = ref(props.currentSearch || '');
const activeTag = ref(props.currentTag || '');

const handleTagClick = (tag: string) => {
  activeTag.value = activeTag.value === tag ? '' : tag;
  sound.playClick();
  router.get('/blog', {
    tag: activeTag.value || undefined,
    q: searchQuery.value || undefined,
  }, { preserveState: true, replace: true });
};

const handleSearch = () => {
  sound.playClick();
  router.get('/blog', {
    tag: activeTag.value || undefined,
    q: searchQuery.value || undefined,
  }, { preserveState: true, replace: true });
};

const blogIndexJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  'name': 'Midnight Tech Chronicle — Blog Kiến Trúc & Kỹ Thuật Đêm',
  'description': 'Các bài viết chuyên sâu về kiến trúc phần mềm, Laravel, Vue.js, Cloud Run, DevSecOps và trải nghiệm lập trình đêm của Ma Cà Tưng.',
  'url': 'https://macatung.dev/blog',
  'publisher': {
    '@type': 'Person',
    'name': 'Ma Cà Tưng',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Midnight Tech Chronicle — Ghi Chép Kiến Trúc & Kỹ Thuật Đêm"
    description="Kho bài viết chuyên sâu về kỹ thuật phần mềm, Laravel, Vue.js, Cloud Architecture, tối ưu hiệu năng và những trải nghiệm lập trình kỳ thú đêm khuya."
    keywords="Blog Lập Trình, Laravel Architecture, Vue 3, Inertia.js, Full-Stack Tips, Cloud Run Deployment, Kỹ Thuật Phần Mềm"
    canonical="https://macatung.dev/blog"
    :json-ld="blogIndexJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Trang Chủ</Link>
        <span>/</span>
        <span class="text-phantom-mint font-bold">Midnight Tech Chronicle</span>
      </nav>

      <!-- Header Banner -->
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 border-b border-white/10 pb-8">
        <div class="flex flex-col items-start">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-3 shadow-glow-mint">
            📜 Midnight Tech Chronicle
          </span>
          <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
            Ghi Chép Kiến Trúc & <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold">Kỹ Thuật Đêm</span>
          </h1>
          <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans leading-relaxed">
            Các bài viết chuyên sâu về Multi-Agent AI tự trị, tối ưu backend chịu tải hàng triệu requests, giải thuật địa lý GIS và kinh nghiệm thiết kế hệ thống thực chiến.
          </p>
        </div>

        <!-- Search Input -->
        <div class="w-full sm:w-80 relative">
          <Icons name="Search" :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm bài viết, công nghệ..."
            class="w-full pl-10 pr-10 py-3 rounded-2xl bg-midnight-900/90 border border-white/10 text-slate-200 placeholder-slate-500 text-xs sm:text-sm font-sans focus:outline-none focus:border-phantom-mint transition-colors shadow-lg"
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            @click="searchQuery = ''; handleSearch()"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Tag Filter Pills -->
      <div class="flex items-center gap-2 mb-10 overflow-x-auto no-scrollbar pb-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs sm:text-sm font-mono transition-all border select-none whitespace-nowrap cursor-pointer"
          :class="!activeTag
            ? 'bg-phantom-mint text-midnight-950 border-phantom-mint font-bold shadow-glow-mint'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          @click="handleTagClick('')"
        >
          Tất Cả Chủ Đề (All)
        </button>

        <button
          v-for="tag in allTags"
          :key="tag"
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-mono transition-all border select-none whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="activeTag === tag
            ? 'bg-talisman-gold text-midnight-950 border-talisman-gold font-bold shadow-glow-talisman'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          @click="handleTagClick(tag)"
        >
          <span>#</span>
          <span>{{ tag }}</span>
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-if="articles.length === 0"
        class="p-16 text-center rounded-3xl glass-panel border border-white/10 text-slate-400"
      >
        <div class="text-4xl mb-3">🕯️</div>
        <h3 class="text-white font-display font-bold text-xl mb-1">Chưa có bài viết phù hợp</h3>
        <p class="text-xs sm:text-sm">Hãy thử tìm với từ khóa khác như "AI", "Laravel", "GIS" hoặc chọn "Tất Cả Chủ Đề".</p>
      </div>

      <!-- Articles Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <article
          v-for="article in articles"
          :key="article.id"
          class="glass-panel rounded-3xl border border-white/10 overflow-hidden flex flex-col justify-between hover:border-phantom-mint/40 hover:shadow-2xl transition-all duration-300 group"
        >
          <div class="p-6 sm:p-8">
            <!-- Meta Bar -->
            <div class="flex items-center justify-between gap-4 text-xs font-mono text-slate-400 mb-4 pb-3 border-b border-white/5">
              <span class="flex items-center gap-1.5 text-phantom-mint">
                <span>⏱</span>
                <span>{{ article.reading_time_min }} phút đọc</span>
              </span>
              <span class="text-slate-400">{{ article.published_at }}</span>
            </div>

            <!-- Title & Excerpt -->
            <h2 class="text-xl sm:text-2xl font-display font-bold text-white group-hover:text-phantom-mint transition-colors leading-snug mb-3">
              <Link :href="`/blog/${article.slug}`" class="focus:outline-none">
                {{ article.title }}
              </Link>
            </h2>

            <p class="text-slate-300 text-sm leading-relaxed font-sans line-clamp-3 mb-6">
              {{ article.excerpt }}
            </p>

            <!-- Tags -->
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in article.tags"
                :key="tag"
                class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300 text-xs font-mono group-hover:border-white/15 transition-colors"
              >
                #{{ tag }}
              </span>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="px-6 sm:px-8 py-4 bg-midnight-950/80 border-t border-white/5 flex items-center justify-between">
            <span class="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <span>👁</span>
              <span>{{ article.views_count.toLocaleString() }} lượt đọc</span>
            </span>

            <Link
              :href="`/blog/${article.slug}`"
              class="px-4 py-2 rounded-xl bg-white/5 hover:bg-phantom-mint text-slate-200 hover:text-midnight-950 font-display font-bold text-xs transition-all flex items-center gap-1.5 border border-white/10 hover:border-phantom-mint shadow-sm"
              @click="sound.playClick()"
            >
              <span>Đọc Bài Viết</span>
              <span>→</span>
            </Link>
          </div>
        </article>
      </div>

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/blog" />
    </main>

    <Footer />
  </div>
</template>
