<script setup lang="ts">
import { computed } from 'vue';
import { Head } from '@inertiajs/vue3';

interface ArticleMeta {
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    keywords?: string;
    canonical?: string;
    ogType?: 'website' | 'article' | 'profile';
    ogImage?: string;
    article?: ArticleMeta;
    jsonLd?: Record<string, any> | Array<Record<string, any>>;
    isTheravada?: boolean;
  }>(),
  {
    title: '',
    description: '',
    keywords: '',
    canonical: '',
    ogType: 'website',
    ogImage: '',
    isTheravada: false,
  }
);

// Site Brand Titles
const siteName = computed(() => (props.isTheravada ? 'Ma Tọa Thiền • Theravāda' : 'Ma Cà Tưng • Code at midnight'));
const fullTitle = computed(() => {
  if (!props.title) {
    return props.isTheravada
      ? 'Ma Tọa Thiền — Chánh Niệm Từng Giây • Tam Tạng Kinh Điển Theravāda'
      : 'Ma Cà Tưng — Code at midnight | Full-Stack & Creative Engineering';
  }
  return `${props.title} | ${siteName.value}`;
});

const defaultDescription = computed(() => {
  return props.isTheravada
    ? 'Hệ thống tu học và bảo tồn kinh điển Phật giáo nguyên thủy Theravāda: Tứ Thánh Đế, Bát Chánh Đạo, Thiền Minh Sát Vipassanā, Thẻ ảnh Pháp Cú và Từ điển Pāḷi thuần khiết.'
    : 'Khám phá Portfolio, các dự án Full-Stack, kiến trúc phần mềm, game tương tác và phòng thí nghiệm sáng tạo của Ma Cà Tưng (macatung.dev).';
});

const metaDescription = computed(() => props.description || defaultDescription.value);

const defaultKeywords = computed(() => {
  return props.isTheravada
    ? 'Theravada, Pāḷi Tipiṭaka, Phật giáo nguyên thủy, Kinh Pháp Cú, Dhammapada, Thiền Vipassana, Tứ Niệm Xứ, Bát Chánh Đạo, Tứ Diệu Đế, Ma Tọa Thiền, Tam Tạng Kinh Điển'
    : 'Full-Stack Developer, Creative Engineer, Laravel, Vue.js, Inertia.js, Tailwind CSS, TypeScript, Midnight Coder, Software Architecture, Portfolio, Ma Cà Tưng';
});

const metaKeywords = computed(() => props.keywords || defaultKeywords.value);

const formattedJsonLd = computed(() => {
  if (!props.jsonLd) return null;
  return JSON.stringify(props.jsonLd);
});
</script>

<template>
  <Head :title="fullTitle">
    <!-- Basic Meta -->
    <meta name="description" :content="metaDescription" />
    <meta name="keywords" :content="metaKeywords" />
    <meta name="author" :content="isTheravada ? 'Ma Tọa Thiền • Theravāda' : 'Ma Cà Tưng'" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

    <!-- Canonical URL -->
    <link v-if="canonical" rel="canonical" :href="canonical" />

    <!-- Open Graph (Facebook, Zalo, LinkedIn) -->
    <meta property="og:title" :content="fullTitle" />
    <meta property="og:description" :content="metaDescription" />
    <meta property="og:type" :content="ogType" />
    <meta property="og:site_name" :content="siteName" />
    <meta property="og:locale" content="vi_VN" />
    <meta v-if="canonical" property="og:url" :content="canonical" />
    <meta v-if="ogImage" property="og:image" :content="ogImage" />

    <!-- Article Specific OG -->
    <meta v-if="ogType === 'article' && article?.publishedTime" property="article:published_time" :content="article.publishedTime" />
    <meta v-if="ogType === 'article' && article?.modifiedTime" property="article:modified_time" :content="article.modifiedTime" />
    <meta v-if="ogType === 'article' && article?.author" property="article:author" :content="article.author" />
    <meta v-if="ogType === 'article' && article?.section" property="article:section" :content="article.section" />
    <template v-if="ogType === 'article' && article?.tags">
      <meta v-for="tag in article.tags" :key="tag" property="article:tag" :content="tag" />
    </template>

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" :content="fullTitle" />
    <meta name="twitter:description" :content="metaDescription" />
    <meta v-if="ogImage" name="twitter:image" :content="ogImage" />

    <!-- JSON-LD Structured Data Schema (for Google Rich Results & AI Search Engines) -->
    <component :is="'script'" v-if="formattedJsonLd" type="application/ld+json">
      {{ formattedJsonLd }}
    </component>
  </Head>
</template>
