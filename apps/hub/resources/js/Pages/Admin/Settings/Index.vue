<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { sound } from '@/audio/soundEffects';

const props = defineProps<{
  settings: Record<string, string>;
}>();

const form = useForm({
  site_name: props.settings.site_name || 'macatung.dev',
  site_title: props.settings.site_title || 'macatung.dev — Code at midnight',
  slogan: props.settings.slogan || 'Code at midnight',
  hero_subtitle: props.settings.hero_subtitle || '',
  contact_email: props.settings.contact_email || 'dev@macatung.dev',
  telegram_username: props.settings.telegram_username || '@macatung_dev',
  github_url: props.settings.github_url || 'https://github.com/macatung',
  linkedin_url: props.settings.linkedin_url || 'https://linkedin.com',
  resume_download_url: props.settings.resume_download_url || '',
  seo_description: props.settings.seo_description || '',
  admin_password: '',
});

const submitSettings = () => {
  sound.playTalisman();
  form.put('/admin/settings', {
    preserveScroll: true,
    onSuccess: () => {
      sound.playSuccess();
      form.admin_password = '';
    },
  });
};
</script>

<template>
  <AdminLayout title="Cài Đặt & Profile">
    <Head title="Cài Đặt & Profile — Admin CMS" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Cài Đặt Hệ Thống & Profile CMS
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Tùy chỉnh thông tin thương hiệu cá nhân, đường dẫn mạng xã hội, link tải CV và mật khẩu quản trị.
        </p>
      </div>
    </div>

    <!-- Settings Form Card -->
    <form class="space-y-6 text-left" @submit.prevent="submitSettings">
      <!-- Section 1: Brand & Slogan -->
      <div class="p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
        <h2 class="text-lg font-display font-bold text-white flex items-center gap-2">
          <span>👑 Thương Hiệu & Định Vị Portfolio</span>
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tên Thương Hiệu (Site Name)</label>
            <input
              v-model="form.site_name"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Slogan</label>
            <input
              v-model="form.slogan"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tiêu Đề Trang (Site Title SEO)</label>
          <input
            v-model="form.site_title"
            type="text"
            class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Mô Tả Hero Subtitle</label>
          <textarea
            v-model="form.hero_subtitle"
            rows="2"
            class="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
          />
        </div>
      </div>

      <!-- Section 2: Contact & Socials -->
      <div class="p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
        <h2 class="text-lg font-display font-bold text-white flex items-center gap-2">
          <span>📡 Kênh Liên Lạc & Mạng Xã Hội</span>
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Email Nhận Lời Triệu Hồi</label>
            <input
              v-model="form.contact_email"
              type="email"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Telegram Username</label>
            <input
              v-model="form.telegram_username"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
              placeholder="@macatung_dev"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">GitHub URL</label>
            <input
              v-model="form.github_url"
              type="url"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">LinkedIn URL</label>
            <input
              v-model="form.linkedin_url"
              type="url"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Đường Dẫn Tải File CV (PDF / Drive URL)</label>
          <input
            v-model="form.resume_download_url"
            type="text"
            class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
            placeholder="/brand/macatung-logo-horizontal.png"
          />
        </div>
      </div>

      <!-- Section 3: Security & Password Shield -->
      <div class="p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
        <h2 class="text-lg font-display font-bold text-white flex items-center gap-2">
          <span>🛡️ Mật Khẩu Quản Trị Viên (Admin Password Shield)</span>
        </h2>

        <div>
          <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Đổi Mật Khẩu Admin (Để trống nếu không đổi)</label>
          <input
            v-model="form.admin_password"
            type="password"
            class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
            placeholder="Nhập mật khẩu mới..."
          />
        </div>
      </div>

      <!-- Submit Action -->
      <div class="flex items-center justify-end">
        <button
          type="submit"
          class="px-8 py-3 rounded-2xl bg-phantom-mint text-midnight-950 font-display font-extrabold text-sm hover:brightness-110 shadow-glow-mint flex items-center gap-2"
          :disabled="form.processing"
        >
          <span v-if="form.processing">Đang Lưu Cài Đặt...</span>
          <span v-else>Lưu Toàn Bộ Cấu Hình CMS 💾</span>
        </button>
      </div>
    </form>
  </AdminLayout>
</template>
