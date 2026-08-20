<script setup lang="ts">
import { useForm, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';
import confetti from 'canvas-confetti';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';

const projectTypes = [
  'Full-Stack Web App',
  'Creative UI/UX & Web Audio',
  'High-Throughput Microservice',
  'AI Agents & Automation',
  'Tech Lead / Architecture Consulting',
  'Other Quest',
];

const coffeeOfferings = [
  '1 Ly Cà Phê Muối Nửa Đêm',
  'Cold Brew Robusta 100%',
  'Espresso Đậm Đặc Double Shot',
  'Trà Đào Cam Sả',
];

const form = useForm({
  name: '',
  email: '',
  project_type: 'Full-Stack Web App',
  coffee_offering: '1 Ly Cà Phê Muối Nửa Đêm',
  message: '',
});

const page = usePage();
const copySuccess = ref(false);
const submittedReferenceId = ref<string>('');
const isSubmitted = ref(false);

const copyEmail = async () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText('dev@macatung.dev');
    }
    copySuccess.value = true;
    sound.playClick();
    setTimeout(() => {
      copySuccess.value = false;
    }, 2500);
  } catch {
    // Fallback
  }
};

const handleSubmit = () => {
  if (form.processing) return;

  sound.playTalisman();

  form.post('/contact', {
    preserveScroll: true,
    onSuccess: (pageProps: any) => {
      const flash = pageProps?.props?.flash || (page.props as any)?.flash;
      const refId = flash?.reference_id || 'SUMMON-0000';
      submittedReferenceId.value = refId;
      isSubmitted.value = true;

      sound.playSuccess();

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f5a0', '#ffd166', '#ff0054'],
        });
      } catch {
        // Fallback for headless environments
      }

      form.reset();
    },
    onError: () => {
      sound.playClick();
    },
  });
};

const resetForm = () => {
  form.reset();
  form.clearErrors();
  isSubmitted.value = false;
  submittedReferenceId.value = '';
};
</script>

<template>
  <section id="contact" class="scroll-mt-24 w-full py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left">
    <!-- Header -->
    <div class="flex flex-col items-start mb-10">
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-phantom-mint text-xs font-mono mb-3 whitespace-nowrap select-none">
        🔮 Direct Contact & Quest Inquiry
      </span>
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight">
        Bàn Thờ <span class="text-phantom-mint">Triệu Hồi</span>
      </h2>
      <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
        Gửi tín hiệu qua màn đêm để khởi động dự án mới, hợp tác kiến trúc hoặc tải hồ sơ năng lực.
      </p>
    </div>

    <!-- Altar Grid: 2 Columns -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Left Column: Direct Channels & Ritual Guidelines (5 Columns) -->
      <div class="lg:col-span-5 flex flex-col gap-6">
        <!-- Direct Spectral Channel Card -->
        <div class="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 text-left">
          <h3 class="font-display font-bold text-lg sm:text-xl text-white mb-2">Kênh Thần Giao Cách Cảm</h3>
          <p class="text-xs sm:text-sm text-slate-400 font-sans leading-relaxed mb-6">
            Mọi thông điệp gửi đến đều được xử lý trực tiếp bởi Alchemist trong khung giờ 00:00 - 05:00 AM.
          </p>

          <!-- Email Copy Pill -->
          <div class="p-4 rounded-2xl bg-midnight-950/80 border border-white/10 flex items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-midnight-900 border border-white/10 flex items-center justify-center text-phantom-mint shrink-0">
                <Icons name="Mail" :size="18" />
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider whitespace-nowrap">Email Trực Tiếp</div>
                <div class="font-mono text-xs sm:text-sm font-bold text-white truncate">dev@macatung.dev</div>
              </div>
            </div>
            <button
              type="button"
              class="px-3 py-2 rounded-xl bg-white/5 hover:bg-phantom-mint hover:text-midnight-950 text-slate-300 text-xs font-mono font-semibold transition-all shrink-0 min-h-[38px] flex items-center gap-1.5 whitespace-nowrap"
              @click="copyEmail"
            >
              <Icons v-if="copySuccess" name="Check" :size="14" />
              <Icons v-else name="Copy" :size="14" />
              <span>{{ copySuccess ? 'Đã Copy' : 'Copy' }}</span>
            </button>
          </div>

          <!-- Status & Availability -->
          <div class="space-y-3 text-xs font-mono">
            <div class="flex items-center justify-between p-3 rounded-xl bg-midnight-950/50 border border-white/5">
              <span class="text-slate-400">Múi Giờ Hoạt Động:</span>
              <span class="text-slate-200 font-semibold whitespace-nowrap">GMT+7 (Midnight Realm)</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-midnight-950/50 border border-white/5">
              <span class="text-slate-400">Trạng Thái Quest:</span>
              <span class="text-phantom-mint font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <span class="w-2 h-2 rounded-full bg-phantom-mint animate-pulse" />
                Sẵn Sàng Nhận Dự Án
              </span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-midnight-950/50 border border-white/5">
              <span class="text-slate-400">Thời Gian Hồi Đáp:</span>
              <span class="text-talisman-gold font-semibold whitespace-nowrap">&lt; 24 Giờ Cam Kết</span>
            </div>
          </div>
        </div>

        <!-- Social & CV Card -->
        <div class="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <div class="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Mạng Lưới Kỹ Thuật Số & Hồ Sơ</div>
          
          <div class="flex flex-wrap gap-2.5">
            <a
              href="https://github.com/macatung"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-phantom-mint text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap"
            >
              <Icons name="Github" :size="15" />
              <span>GitHub</span>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-phantom-mint text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap"
            >
              <Icons name="ExternalLink" :size="15" />
              <span>LinkedIn</span>
            </a>
            <a
              href="https://t.me/macatung"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-phantom-cyan text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap"
            >
              <span>✈️</span>
              <span>Telegram</span>
            </a>
          </div>

          <!-- CV Download Badge -->
          <div class="pt-3 border-t border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">📄</span>
              <div class="text-xs font-mono">
                <div class="text-white font-bold">Curriculum Vitae (PDF)</div>
                <div class="text-[10px] text-slate-400">Cập nhật tháng 08/2026</div>
              </div>
            </div>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint hover:bg-phantom-mint hover:text-midnight-950 text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
              @click="sound.playSuccess()"
            >
              <span>Xem / Tải CV</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Summoning Form (7 Columns) -->
      <div class="lg:col-span-7">
        <div class="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 text-left relative">
          <!-- Success Overlay -->
          <div
            v-if="isSubmitted || form.wasSuccessful"
            class="p-8 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]"
          >
            <div class="w-16 h-16 rounded-full bg-phantom-mint/10 border-2 border-phantom-mint flex items-center justify-center text-3xl shadow-glow-mint">
              ✨
            </div>
            <h3 class="text-2xl font-display font-bold text-white">Triệu Hồi Thành Công!</h3>
            <p class="text-sm text-slate-300 max-w-md leading-relaxed font-sans">
              Tín hiệu đã được truyền đi qua màn đêm. Mã biên nhận: <span class="font-mono text-phantom-mint font-bold">{{ submittedReferenceId || ($page.props.flash as any)?.reference_id || 'SUMMON-XXXX' }}</span>. Alchemist sẽ hồi đáp bạn sớm nhất!
            </p>
            <button
              type="button"
              class="mt-4 px-6 py-3 rounded-xl bg-midnight-800 border border-white/10 hover:border-phantom-mint text-white font-mono text-xs font-bold transition-all min-h-[44px]"
              @click="resetForm"
            >
              Gửi Thêm Lời Triệu Hồi Khác
            </button>
          </div>

          <!-- The Form -->
          <form v-else class="space-y-5" @submit.prevent="handleSubmit">
            <!-- Name & Email Inputs -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                  1. Tên Lữ Khách / Kỹ Sư <span class="text-rose-400">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="e.g. Founder Minh / Recruiter Anh"
                  class="w-full px-4 py-3 rounded-xl bg-midnight-900 border border-white/10 text-white font-sans text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none min-h-[44px] transition-colors"
                  :class="{ 'border-rose-500/80': form.errors.name }"
                  @input="form.clearErrors('name')"
                />
                <span v-if="form.errors.name" class="text-[11px] font-mono text-rose-400 mt-1 block">{{ form.errors.name }}</span>
              </div>

              <div>
                <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                  2. Địa Chỉ Thần Giao (Email) <span class="text-rose-400">*</span>
                </label>
                <input
                  v-model="form.email"
                  type="email"
                  placeholder="e.g. partner@company.com"
                  class="w-full px-4 py-3 rounded-xl bg-midnight-900 border border-white/10 text-white font-sans text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none min-h-[44px] transition-colors"
                  :class="{ 'border-rose-500/80': form.errors.email }"
                  @input="form.clearErrors('email')"
                />
                <span v-if="form.errors.email" class="text-[11px] font-mono text-rose-400 mt-1 block">{{ form.errors.email }}</span>
              </div>
            </div>

            <!-- Project Type Selector -->
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 whitespace-nowrap">
                3. Loại Quest / Nhiệm Vụ Hợp Tác
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="type in projectTypes"
                  :key="type"
                  type="button"
                  class="p-2.5 rounded-xl border text-left text-xs font-sans font-medium transition-all min-h-[44px] flex items-center justify-between whitespace-nowrap"
                  :class="form.project_type === type
                    ? 'bg-midnight-800 border-phantom-mint text-phantom-mint shadow-glow-mint font-bold'
                    : 'bg-midnight-950/60 border-white/5 hover:border-white/20 text-slate-400 hover:text-slate-200'"
                  @click="form.project_type = type; form.clearErrors('project_type'); sound.playClick()"
                >
                  <span class="truncate">{{ type }}</span>
                  <span v-if="form.project_type === type" class="text-phantom-mint font-bold">✓</span>
                </button>
              </div>
              <span v-if="form.errors.project_type" class="text-[11px] font-mono text-rose-400 mt-1 block">{{ form.errors.project_type }}</span>
            </div>

            <!-- Coffee Offering -->
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 whitespace-nowrap">
                4. Lễ Vật Cà Phê Tiếp Sức
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="coffee in coffeeOfferings"
                  :key="coffee"
                  type="button"
                  class="p-2.5 rounded-xl border text-left text-xs font-sans transition-all min-h-[44px] flex items-center justify-between whitespace-nowrap"
                  :class="form.coffee_offering === coffee
                    ? 'bg-midnight-800 border-talisman-gold text-talisman-gold shadow-glow-talisman font-bold'
                    : 'bg-midnight-950/60 border-white/5 hover:border-white/20 text-slate-400 hover:text-slate-200'"
                  @click="form.coffee_offering = coffee; form.clearErrors('coffee_offering'); sound.playClick()"
                >
                  <span class="truncate">☕ {{ coffee }}</span>
                  <span v-if="form.coffee_offering === coffee" class="text-talisman-gold font-bold">✓</span>
                </button>
              </div>
              <span v-if="form.errors.coffee_offering" class="text-[11px] font-mono text-rose-400 mt-1 block">{{ form.errors.coffee_offering }}</span>
            </div>

            <!-- Message Detail Input -->
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                5. Chi Tiết Nhiệm Vụ & Kỳ Vọng <span class="text-rose-400">*</span>
              </label>
              <textarea
                v-model="form.message"
                rows="4"
                placeholder="Mô tả mục tiêu dự án, thời gian dự kiến và bất kỳ yêu cầu kiến trúc đặc thù nào..."
                class="w-full p-4 rounded-xl bg-midnight-900 border border-white/10 text-white font-sans text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none transition-colors"
                :class="{ 'border-rose-500/80': form.errors.message }"
                @input="form.clearErrors('message')"
              />
              <span v-if="form.errors.message" class="text-[11px] font-mono text-rose-400 mt-1 block">{{ form.errors.message }}</span>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="w-full py-4 rounded-2xl font-display font-extrabold text-sm sm:text-base transition-all shadow-xl flex items-center justify-center gap-2 min-h-[52px] whitespace-nowrap"
              :class="form.processing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse'
                : 'bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-gold text-midnight-950 hover:brightness-110 active:scale-[0.99] shadow-glow-mint'"
              :disabled="form.processing"
            >
              <span v-if="form.processing">⏳ Đang Truyền Tín Hiệu...</span>
              <span v-else>🚀 Khởi Động Triệu Hồi Ma Cà Tưng</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
