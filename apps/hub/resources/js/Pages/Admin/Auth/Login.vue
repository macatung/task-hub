<script setup lang="ts">
import { Head, useForm, Link } from '@inertiajs/vue3';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import { sound } from '@/audio/soundEffects';

const form = useForm({
  password: '',
});

const submitLogin = () => {
  if (form.processing) return;
  sound.playTalisman();

  form.post('/admin/login', {
    onSuccess: () => {
      sound.playSuccess();
    },
    onError: () => {
      sound.playClick();
    },
  });
};
</script>

<template>
  <div class="min-h-screen bg-midnight-950 flex flex-col items-center justify-center p-4 selection:bg-phantom-mint selection:text-midnight-950 font-sans text-left">
    <Head title="Admin Login Shield — macatung.dev" />

    <!-- Ambient Glow Background -->
    <div class="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <div class="w-[500px] h-[500px] rounded-full bg-phantom-mint/5 blur-[120px]" />
    </div>

    <!-- Login Card -->
    <div class="w-full max-w-md bg-midnight-900/90 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center space-y-6">
      <!-- Mascot Logo -->
      <div class="flex flex-col items-center justify-center">
        <MiniMascotLogo size="lg" :animated="true" class="mb-3" />
        <h1 class="font-display font-bold text-2xl text-white">
          macatung<span class="text-phantom-mint">.admin</span>
        </h1>
        <p class="text-xs font-mono text-slate-400 mt-1">
          Khu Vực Quản Trị CMS & Traffic Analytics
        </p>
      </div>

      <!-- Login Form -->
      <form class="space-y-4 text-left" @submit.prevent="submitLogin">
        <div>
          <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2">
            Mật Khẩu Quản Trị Viên (Admin Shield Key)
          </label>
          <input
            v-model="form.password"
            type="password"
            required
            autofocus
            placeholder="Nhập mật khẩu admin..."
            class="w-full px-4 py-3.5 rounded-2xl bg-midnight-950 border text-white font-mono text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none transition-colors"
            :class="form.errors.password ? 'border-rose-500/80' : 'border-white/10'"
          />
          <span v-if="form.errors.password" class="text-xs font-mono text-rose-400 mt-1.5 block">
            {{ form.errors.password }}
          </span>
        </div>

        <button
          type="submit"
          class="w-full py-4 rounded-2xl font-display font-extrabold text-sm transition-all shadow-glow-mint flex items-center justify-center gap-2 min-h-[48px]"
          :class="form.processing
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-phantom-mint text-midnight-950 hover:brightness-110 active:scale-[0.99]'"
          :disabled="form.processing"
        >
          <span v-if="form.processing">Đang xác thực...</span>
          <span v-else>Mở Khóa Quản Trị CMS ⚡</span>
        </button>
      </form>

      <!-- Footer Help & Default Credentials Hint -->
      <div class="pt-4 border-t border-white/5 flex flex-col items-center gap-2 text-xs font-mono text-slate-500">
        <div>Mật khẩu mặc định: <span class="text-slate-300 font-bold">macatung@midnight2026</span></div>
        <Link href="/" class="text-phantom-mint hover:underline">
          ← Quay lại Trang Chủ Portfolio
        </Link>
      </div>
    </div>
  </div>
</template>
