<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import {
  CheckCircle2,
  Sparkles,
  Cloud,
  Link2,
  ArrowRight,
} from 'lucide-vue-next';
import type { DesktopCredential } from '../composables/useTaskSync';

const emit = defineEmits<{
  (e: 'connected', credential: DesktopCredential): void;
  (e: 'skip-offline'): void;
}>();

const taskHubUrl = 'https://midnight.macatung.dev';
const status = ref<'idle' | 'pairing' | 'connected' | 'error'>('idle');
const message = ref('');
let pollTimer: ReturnType<typeof setInterval> | undefined;

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
};

const startPairing = async () => {
  stopPolling();
  message.value = '';
  status.value = 'pairing';
  try {
    const pairing = await window.desktopApi.taskHub.startPairing(taskHubUrl, null);
    await window.desktopApi.openExternal(pairing.approval_url);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      try {
        if (Date.now() - started > 600000) {
          throw new Error('Yêu cầu kết nối đã hết hạn. Vui lòng thử lại.');
        }
        const result = await window.desktopApi.taskHub.pollPairing(taskHubUrl, pairing.pairing_id, pairing.device_secret);
        if (result.status === 'approved') {
          stopPolling();
          const credential: DesktopCredential = {
            taskHubUrl,
            token: result.mcp_token,
            projectId: 'all',
            projectTitle: result.project_title,
            workspaceId: result.workspace_id ? String(result.workspace_id) : undefined,
            workspaceName: result.workspace_name,
            userEmail: result.user_email,
            userName: result.user_name,
          };
          status.value = 'connected';
          message.value = 'Kết nối thành công! Đang chuyển vào không gian làm việc...';
          setTimeout(() => emit('connected', credential), 500);
        } else if (['denied', 'expired', 'rejected', 'consumed'].includes(result.status)) {
          throw new Error(`Yêu cầu kết nối đã bị ${result.status === 'denied' ? 'từ chối' : 'hết hạn'}.`);
        }
      } catch (error: any) {
        stopPolling();
        status.value = 'error';
        message.value = error?.message || 'Không thể xác thực với Task Hub.';
      }
    }, 1800);
  } catch (error: any) {
    status.value = 'error';
    message.value = error?.message || 'Không thể khởi tạo liên kết xác thực an toàn.';
  }
};

onUnmounted(stopPolling);
</script>

<template>
  <div class="welcome-shell min-h-screen w-full bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
    <!-- Ambient Glows -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <div class="max-w-xl w-full text-center space-y-8 relative z-10">
      <!-- Brand Avatar -->
      <div class="inline-flex items-center justify-center p-3 rounded-3xl bg-[#14151c] border border-[#232430] shadow-2xl shadow-indigo-500/5">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/20">
          TH
        </div>
      </div>

      <!-- Welcome Headings -->
      <div class="space-y-2.5">
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display">
          Chào mừng đến với <span class="bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">Task Hub</span>
        </h1>
        <p class="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
          Ứng dụng quản lý công việc và trợ lý năng suất thông minh ngay trên máy tính của bạn.
        </p>
      </div>

      <!-- 3 Key Highlights for Non-Tech Users -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
        <div class="p-4 rounded-2xl bg-[#14151c] border border-[#232430] space-y-2 backdrop-blur-md">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
            <CheckCircle2 class="w-4 h-4" />
          </div>
          <h3 class="font-bold text-xs text-zinc-200">Ghi việc dễ dàng</h3>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Danh sách To-Do tinh gọn, rõ ràng, sắp xếp việc hôm nay và việc quan trọng trong nháy mắt.
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-[#14151c] border border-[#232430] space-y-2 backdrop-blur-md">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
            <Sparkles class="w-4 h-4" />
          </div>
          <h3 class="font-bold text-xs text-zinc-200">Trợ lý AI 1-Click</h3>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Tự động chia nhỏ công việc phức tạp thành checklist các bước thực hiện chỉ với một chạm.
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-[#14151c] border border-[#232430] space-y-2 backdrop-blur-md">
          <div class="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-sm">
            <Cloud class="w-4 h-4" />
          </div>
          <h3 class="font-bold text-xs text-zinc-200">Đồng bộ tự động</h3>
          <p class="text-[11px] text-zinc-400 leading-relaxed">
            Mọi công việc luôn được đồng bộ an toàn theo thời gian thực giữa máy tính và nền tảng web.
          </p>
        </div>
      </div>

      <!-- Pairing Call to Action -->
      <div class="pt-2 space-y-3.5">
        <button
          @click="startPairing"
          :disabled="status === 'pairing'"
          class="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 transition-all cursor-pointer inline-flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-98"
        >
          <span v-if="status === 'pairing'" class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
          <Link2 v-else class="w-4 h-4" />
          <span>{{ status === 'pairing' ? 'Đang chờ bạn xác nhận trên trình duyệt…' : 'Kết nối với tài khoản Task Hub' }}</span>
        </button>

        <p v-if="message" :class="['text-xs font-medium', status === 'error' ? 'text-rose-400' : 'text-emerald-400']">
          {{ message }}
        </p>

        <p class="text-[11px] text-zinc-500 font-mono">
          Nhấn nút để mở trình duyệt, đăng nhập 1 lần là hoàn tất.
        </p>

        <div class="pt-2">
          <button
            @click="emit('skip-offline')"
            class="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors cursor-pointer hover:underline"
          >
            <span>Hoặc tiếp tục ở chế độ ngoại tuyến trên máy này</span>
            <ArrowRight class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
