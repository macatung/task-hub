<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import TheravadaLayout from '@/Layouts/TheravadaLayout.vue';

const props = defineProps<{
  categorySlug: string;
  categoryName: string;
  articles: any[];
  title?: string;
}>();

const categoryJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  'name': `${props.categoryName} — Phật Giáo Nguyên Thủy Theravāda`,
  'description': `Tuyển tập các bài giảng, kinh điển Pāḷi và hướng dẫn thực hành thuộc chuyên mục ${props.categoryName}.`,
  'url': `https://theravada.macatung.dev/danh-muc/${props.categorySlug}`,
  'inLanguage': ['vi', 'pi']
}));
</script>

<template>
  <TheravadaLayout
    :title="`${categoryName} — Giáo Lý & Kinh Điển Pāḷi`"
    :description="`Khám phá tuyển tập kinh điển và hướng dẫn tu học nguyên thủy thuộc chuyên mục ${categoryName}: Tứ Thánh Đế, Bát Chánh Đạo, Vipassanā.`"
    :keywords="`${categoryName}, Theravada, Pāḷi, Giáo lý Phật giáo nguyên thủy`"
    :canonical="`https://theravada.macatung.dev/danh-muc/${categorySlug}`"
    :json-ld="categoryJsonLd"
  >
    <div class="max-w-6xl mx-auto py-4 sm:py-10">
      <!-- Breadcrumb -->
      <nav class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-serif text-stone-300 mb-4 sm:mb-6" aria-label="Breadcrumb">
        <Link href="/theravada" class="hover:text-amber-300">Theravāda</Link>
        <span>/</span>
        <span class="text-amber-400 font-bold truncate max-w-[200px] sm:max-w-none">{{ categoryName }}</span>
      </nav>

      <!-- Header -->
      <header class="mb-6 sm:mb-10 text-left border-b border-stone-800 pb-5 sm:pb-8">
        <div class="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-serif font-bold mb-2 sm:mb-3 shadow-sm">
          <span>{{ categorySlug === 'phap-hoc' ? '📖' : categorySlug === 'phap-hanh' ? '🧘' : '📜' }}</span>
          <span>Chuyên Mục Theravāda</span>
        </div>
        <h1 class="text-2xl sm:text-4xl font-serif font-bold text-amber-100">
          {{ categoryName }}
        </h1>
        <p class="text-xs sm:text-sm text-stone-300 font-serif mt-1.5 sm:mt-2 leading-relaxed max-w-3xl">
          Tuyển tập các kinh văn, giáo lý và hướng dẫn thực hành thuộc chuyên mục {{ categoryName }}.
        </p>
      </header>

      <!-- Articles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <article
          v-for="item in articles"
          :key="item.id"
          class="group relative overflow-hidden flex flex-col justify-between rounded-3xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/60 p-5 sm:p-7 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-12px_rgba(245,158,11,0.3)] text-left backdrop-blur-md"
        >
          <!-- Shimmering Golden Rim Highlight -->
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

          <div>
            <div class="flex items-center justify-between text-xs font-serif text-stone-300 mb-3">
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-serif font-bold">
                {{ categorySlug === 'phap-hoc' ? 'Pháp Học' : categorySlug === 'phap-hanh' ? 'Pháp Hành' : 'Kinh Tụng' }}
              </span>
              <span class="text-stone-300 font-medium">⏱️ {{ item.reading_time_min }} phút đọc</span>
            </div>

            <h3 class="text-lg font-serif font-bold text-stone-100 group-hover:text-amber-300 transition-colors leading-snug mb-2">
              <Link :href="`/theravada/kinh/${item.slug}`">
                {{ item.title }}
              </Link>
            </h3>

            <p v-if="item.pali_title" class="text-xs font-serif text-amber-400/90 italic font-medium mb-3">
              Pāḷi: {{ item.pali_title }}
            </p>

            <p class="text-xs sm:text-sm text-stone-300 font-serif leading-relaxed line-clamp-3 mb-4">
              {{ item.excerpt }}
            </p>
          </div>

          <div class="pt-4 border-t border-stone-800 flex items-center justify-between text-xs font-serif text-stone-400">
            <span class="truncate max-w-[160px] italic text-stone-300">
              {{ item.author || 'Pāḷi Canon' }}
            </span>
            <Link
              :href="`/theravada/kinh/${item.slug}`"
              class="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
            >
              <span>Đọc kinh</span>
              <span>➔</span>
            </Link>
          </div>
        </article>

        <div v-if="articles.length === 0" class="col-span-full py-16 text-center text-stone-400 font-serif">
          Chuyên mục đang được cập nhật kinh văn và giáo lý mới...
        </div>
      </div>
    </div>
  </TheravadaLayout>
</template>
