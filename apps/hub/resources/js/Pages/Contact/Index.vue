<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import ContactSection from '@/Components/contact/ContactSection.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';

defineProps<{
  settings?: Record<string, string>;
}>();

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  'name': 'Triệu Hồi & Liên Hệ Hợp Tác Kỹ Thuật (Ma Cà Tưng)',
  'description': 'Kết nối với Ma Cà Tưng để tư vấn kiến trúc phần mềm, phát triển ứng dụng Full-Stack, hệ thống AI Agents và tối ưu hóa hệ thống.',
  'url': 'https://macatung.dev/contact',
  'mainEntity': {
    '@type': 'Person',
    'name': 'Ma Cà Tưng',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Triệu Hồi & Liên Hệ Tư Vấn — The Midnight Architect"
    description="Gửi tin nhắn triệu hồi hoặc liên hệ hợp tác phát triển phần mềm, tư vấn kiến trúc giải pháp Full-Stack cùng Ma Cà Tưng."
    keywords="Liên hệ Lập trình viên, Hire Full-Stack Developer, Freelance Engineer Vietnam, Tư vấn Phần Mềm"
    canonical="https://macatung.dev/contact"
    :json-ld="contactJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Trang Chủ</Link>
        <span>/</span>
        <span class="text-phantom-mint font-bold">Điện Thờ Triệu Hồi (Contact)</span>
      </nav>

      <!-- Contact Section Form & SLA Pledge -->
      <ContactSection />

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/contact" />
    </main>

    <Footer />
  </div>
</template>
