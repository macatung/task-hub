<script setup lang="ts">
import { ref, computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import TheravadaLayout from '@/Layouts/TheravadaLayout.vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';
import { PALI_GLOSSARY, PaliGlossaryEntry } from '@/data/paliGlossary';

defineProps<{
  title?: string;
}>();

const searchQuery = ref('');
const selectedLetter = ref<string>('ALL');

const alphabet = ['ALL', 'A', 'B', 'C', 'D', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'U', 'V', 'Y'];

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return PALI_GLOSSARY.filter(item => {
    const firstLetter = item.term.charAt(0).toUpperCase();
    const matchesLetter = selectedLetter.value === 'ALL' || firstLetter === selectedLetter.value;
    const matchesQuery =
      !q ||
      item.term.toLowerCase().includes(q) ||
      (item.pali && item.pali.toLowerCase().includes(q)) ||
      (item.vietnamese && item.vietnamese.toLowerCase().includes(q)) ||
      item.definition.toLowerCase().includes(q);
    return matchesLetter && matchesQuery;
  });
});

const selectLetter = (letter: string) => {
  selectedLetter.value = letter;
  mindfulBell.ringBell(528, 2.0);
};

const strikeBell = () => {
  mindfulBell.ringBell(528, 2.0);
};

const glossaryJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  'name': 'Từ Điển Thuật Ngữ Pāḷi — Phật Học Nguyên Thủy Theravāda',
  'description': 'Tra cứu chính xác hơn 40+ thuật ngữ Pāḷi cốt lõi: Anattā, Anicca, Dukkha, Nibbāna, Vipassanā, Sati kèm định nghĩa Phật học uyên áo.',
  'url': 'https://theravada.macatung.dev/tu-dien-pali',
  'inLanguage': ['vi', 'pi'],
  'hasDefinedTerm': PALI_GLOSSARY.map(item => ({
    '@type': 'DefinedTerm',
    'name': item.term,
    'alternateName': item.vietnamese,
    'description': item.definition,
    'inDefinedTermSet': 'https://theravada.macatung.dev/tu-dien-pali'
  }))
};
</script>

<template>
  <TheravadaLayout
    :title="title || 'Từ Điển Pāḷi — Thuật Ngữ Phật Học Nguyên Thủy'"
    description="Tra cứu chính xác các thuật ngữ Pāḷi kinh điển Phật giáo Theravāda: Vô ngã, Vô thường, Niết-bàn, Chánh niệm, Minh sát tuệ, Tứ Diệu Đế."
    keywords="Từ điển Pali, Pāḷi Dictionary, Thuật ngữ Phật học, Pali Theravada, Anatta, Anicca, Vipassana, Nibbana"
    canonical="https://theravada.macatung.dev/tu-dien-pali"
    :json-ld="glossaryJsonLd"
  >
    <div class="max-w-5xl mx-auto py-4 sm:py-10">
      <!-- Breadcrumb -->
      <nav class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-serif text-stone-300 mb-4 sm:mb-6">
        <Link href="/theravada" class="hover:text-amber-300">Theravāda</Link>
        <span>/</span>
        <span class="text-amber-400 font-bold">Từ Điển Pāḷi</span>
      </nav>

      <!-- Header -->
      <header class="mb-6 sm:mb-10 text-left border-b border-stone-800 pb-5 sm:pb-8">
        <div class="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-serif font-bold mb-2 sm:mb-3 shadow-sm">
          <span>📖</span>
          <span>Bách Khoa Thuật Ngữ Pāḷi</span>
        </div>
        <h1 class="text-2xl sm:text-4xl font-serif font-bold text-amber-100">
          Từ Điển Thuật Ngữ Phật Học Pāḷi
        </h1>
        <p class="text-xs sm:text-sm text-stone-300 font-serif mt-1.5 sm:mt-2 max-w-3xl leading-relaxed">
          Tra cứu ngữ nghĩa chuẩn xác của các thuật ngữ cốt lõi trong Tam Tạng Pāḷi Tipiṭaka và truyền thống thiền định Theravāda.
        </p>

        <!-- Search Bar -->
        <div class="mt-4 sm:mt-6 relative max-w-xl">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm thuật ngữ (Anicca, Sati, Nibbāna...)"
            class="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl bg-stone-900 border-2 border-stone-700 text-xs sm:text-base text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 shadow-inner"
          />
          <span class="absolute left-3.5 sm:left-4 top-3.5 sm:top-4 text-amber-400 text-sm">🔍</span>
        </div>

        <!-- A-Z Alphabet Strip -->
        <div class="flex flex-wrap gap-1 sm:gap-1.5 mt-4 sm:mt-5">
          <button
            v-for="letter in alphabet"
            :key="letter"
            @click="selectLetter(letter)"
            :class="[
              'px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer min-w-[32px] text-center min-h-[34px] flex items-center justify-center',
              selectedLetter === letter
                ? 'bg-amber-500 text-stone-950 shadow-md scale-105'
                : 'bg-stone-900 text-stone-300 hover:text-amber-200 hover:bg-stone-800 border border-stone-800'
            ]"
          >
            {{ letter }}
          </button>
        </div>
      </header>

      <!-- Terms Grid -->
      <div class="space-y-3 sm:space-y-4">
        <div
          v-for="item in filteredList"
          :key="item.term"
          class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/60 transition-all group cursor-pointer shadow-md text-left"
          @click="strikeBell"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2 mb-2 sm:mb-3 pb-2 border-b border-stone-800/80">
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <h3 class="text-lg sm:text-2xl font-serif font-bold text-amber-300 group-hover:text-amber-200">
                {{ item.term }}
              </h3>
              <span v-if="item.vietnamese && item.vietnamese !== item.term" class="text-sm sm:text-base font-serif italic text-amber-100">
                ({{ item.vietnamese }})
              </span>
            </div>
            <span class="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-serif font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              ☸️ {{ item.category }}
            </span>
          </div>

          <p class="text-xs sm:text-base text-stone-200 font-serif leading-relaxed">
            {{ item.definition }}
          </p>
        </div>

        <div v-if="filteredList.length === 0" class="py-12 sm:py-16 text-center text-stone-400 font-serif">
          Không tìm thấy thuật ngữ Pāḷi phù hợp với "{{ searchQuery }}".
        </div>
      </div>
    </div>
  </TheravadaLayout>
</template>
