<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import TalismanGenerator from '@/Components/talisman/TalismanGenerator.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';

defineProps<{
  settings?: Record<string, string>;
}>();

const talismanJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  'name': 'Lò Rèn Bùa Hộ Mệnh Dev (Talisman Forge)',
  'description': 'Ứng dụng tạo và tùy biến bùa hộ mệnh phong cách Đạo gia kết hợp thuật toán công nghệ bảo trợ deploy không lỗi.',
  'applicationCategory': 'UtilitiesApplication',
  'operatingSystem': 'Any',
  'url': 'https://macatung.dev/talisman',
  'author': {
    '@type': 'Person',
    'name': 'Ma Cà Tưng',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Lò Rèn Bùa Dev (Talisman Forge) — The Midnight Architect"
    description="Tùy biến và thỉnh các đạo bùa trừ Bug, bảo trợ deploy lúc 00:00 AM và xuất file ảnh chất lượng cao để dán laptop hoặc chia sẻ lên mạng xã hội."
    keywords="Bùa Lập Trình, Dev Talisman, Bùa Trừ Bug, No Bug Charm, Creative Tool, Canvas Exporter"
    canonical="https://macatung.dev/talisman"
    :json-ld="talismanJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Trang Chủ</Link>
        <span>/</span>
        <span class="text-talisman-gold font-bold">Lò Rèn Bùa Hộ Mệnh</span>
      </nav>

      <div class="flex flex-col items-start mb-8">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-talisman-gold/10 border border-talisman-gold/30 text-talisman-gold text-xs font-mono mb-3 shadow-glow-talisman">
          📜 Dev Artifact Creator
        </span>
        <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
          Lò Rèn <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-phantom-mint to-phantom-cyan">Bùa Hộ Mệnh</span>
        </h1>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
          Tùy biến và thỉnh các đạo bùa trừ Bug, bảo trợ deploy lúc 00:00 AM và xuất file ảnh chất lượng cao để dán laptop hoặc chia sẻ lên mạng xã hội.
        </p>
      </div>

      <!-- Talisman Forge Tool -->
      <TalismanGenerator />

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/talisman" />
    </main>

    <Footer />
  </div>
</template>
