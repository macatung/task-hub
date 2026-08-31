<script setup lang="ts">
import SeoHead from '@/Components/common/SeoHead.vue';
import Navbar from '@/Components/layout/Navbar.vue';
import Footer from '@/Components/layout/Footer.vue';
import TalismanCanvas from '@/Components/mascot/TalismanCanvas.vue';
import ContactSection from '@/Components/contact/ContactSection.vue';
import NextStepsHub from '@/Components/layout/NextStepsHub.vue';

import { Link } from '@inertiajs/vue3';

defineProps<{
  settings?: Record<string, string>;
}>();

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  'name': 'Contact Engineering & Technical Advisory',
  'description': 'Connect with lead architects for systems architecture consulting, full-stack application engineering, and autonomous AI agents.',
  'url': 'https://macatung.dev/contact',
  'mainEntity': {
    '@type': 'Person',
    'name': 'Macatung Dev',
    'url': 'https://macatung.dev'
  }
};
</script>

<template>
  <SeoHead
    title="Contact Engineering & Technical Advisory — The Midnight Architect"
    description="Initiate direct engineering inquiries, architecture consulting, full-stack platform development, or technical partnerships."
    keywords="Contact Architect, Hire Full-Stack Developer, Architecture Consulting, Software Advisory"
    canonical="https://macatung.dev/contact"
    :json-ld="contactJsonLd"
  />

  <div class="min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-x-hidden w-full bg-grid-pattern">
    <TalismanCanvas />
    <Navbar />

    <main class="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 text-left">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6" aria-label="Breadcrumb">
        <Link href="/" class="hover:text-phantom-mint transition-colors">Home</Link>
        <span>/</span>
        <span class="text-phantom-mint font-bold">Contact Engineering</span>
      </nav>

      <!-- Contact Section Form & SLA Pledge -->
      <ContactSection />

      <!-- Next Steps Continuation Hub -->
      <NextStepsHub current-path="/contact" />
    </main>

    <Footer />
  </div>
</template>
