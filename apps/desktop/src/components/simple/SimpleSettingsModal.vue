<script setup lang="ts">
import { ref } from 'vue';
import {
  Settings,
  X,
  ListTodo,
  Code2,
  Keyboard,
  Bell,
  Check,
} from 'lucide-vue-next';
import type { DesktopCredential } from '../../composables/useTaskSync';

const props = defineProps<{
  isOpen: boolean;
  credential: DesktopCredential | null;
  isOnline: boolean;
  appMode: 'simple' | 'developer';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'switch-mode', mode: 'simple' | 'developer'): void;
  (e: 'disconnect'): void;
}>();

const notificationsEnabled = ref(true);
const isConfirmingDisconnect = ref(false);
const updateStatus = ref('');

const checkUpdates = async () => {
  updateStatus.value = 'Đang kiểm tra bản cập nhật mới...';
  try {
    if (window.desktopApi?.updater?.check) {
      await window.desktopApi.updater.check();
      updateStatus.value = 'Bạn đang sử dụng phiên bản mới nhất!';
    } else {
      updateStatus.value = 'Hệ thống cập nhật sẵn sàng.';
    }
  } catch {
    updateStatus.value = 'Không thể kiểm tra cập nhật lúc này.';
  }
  setTimeout(() => {
    updateStatus.value = '';
  }, 4000);
};

const handleDisconnect = () => {
  isConfirmingDisconnect.value = false;
  emit('disconnect');
  emit('close');
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-lg bg-[#0c0d12] border border-[#232430] rounded-2xl shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#232430] flex items-center justify-between bg-[#14151c]/60">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Settings class="w-4 h-4" />
          </div>
          <h3 class="font-bold text-base text-zinc-100">Cài đặt Task Hub</h3>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1c1d27] transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <!-- Account & Sync section -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">Tài khoản & Đồng bộ</h4>
          <div class="p-4 rounded-xl bg-[#14151c] border border-[#232430] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-sm text-white shadow-md shadow-indigo-500/20">
                {{ credential?.userName ? credential.userName[0].toUpperCase() : 'U' }}
              </div>
              <div>
                <div class="font-medium text-sm text-zinc-100">
                  {{ credential?.userName || credential?.userEmail || 'Người dùng Task Hub' }}
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-zinc-400 font-mono">
                  <span class="inline-flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full" :class="isOnline ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    {{ isOnline ? 'Đã kết nối Task Hub Cloud' : 'Đang làm việc ngoại tuyến' }}
                  </span>
                  <span>•</span>
                  <span>{{ credential?.projectTitle || credential?.workspaceName || 'Không gian chính' }}</span>
                </div>
              </div>
            </div>

            <!-- Disconnect button -->
            <button
              v-if="!isConfirmingDisconnect"
              @click="isConfirmingDisconnect = true"
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
            >
              Ngắt kết nối
            </button>
            <div v-else class="flex items-center gap-2">
              <button
                @click="handleDisconnect"
                class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Xác nhận rời
              </button>
              <button
                @click="isConfirmingDisconnect = false"
                class="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>

        <!-- Mode Selection Section -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">Chế độ hoạt động</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Simple Mode Card -->
            <div
              @click="emit('switch-mode', 'simple')"
              class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
              :class="[
                appMode === 'simple'
                  ? 'bg-indigo-950/25 border-indigo-500/70 shadow-lg shadow-indigo-500/10'
                  : 'bg-[#14151c] border-[#232430] hover:border-[#323444] hover:bg-[#1c1d27]'
              ]"
            >
              <div>
                <div class="flex items-center justify-between mb-2">
                  <ListTodo class="w-5 h-5 text-indigo-400" />
                  <span
                    v-if="appMode === 'simple'"
                    class="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500 text-white rounded-full"
                  >
                    Đang dùng
                  </span>
                </div>
                <div class="font-bold text-sm text-zinc-100">Giao diện Văn phòng</div>
                <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Đơn giản, trực quan cho công việc hàng ngày: checklist, ghi chú, hạn chót và Trợ lý AI.
                </p>
              </div>
              <div class="mt-3 text-[11px] text-indigo-400 font-medium">Khuyên dùng cho người bận rộn →</div>
            </div>

            <!-- Developer Mode Card -->
            <div
              @click="emit('switch-mode', 'developer')"
              class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
              :class="[
                appMode === 'developer'
                  ? 'bg-purple-950/25 border-purple-500/70 shadow-lg shadow-purple-500/10'
                  : 'bg-[#14151c] border-[#232430] hover:border-[#323444] hover:bg-[#1c1d27]'
              ]"
            >
              <div>
                <div class="flex items-center justify-between mb-2">
                  <Code2 class="w-5 h-5 text-purple-400" />
                  <span
                    v-if="appMode === 'developer'"
                    class="px-2 py-0.5 text-[10px] font-semibold bg-purple-500 text-white rounded-full"
                  >
                    Đang dùng
                  </span>
                </div>
                <div class="font-bold text-sm text-zinc-100">Chế độ Kỹ thuật (Dev)</div>
                <p class="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Bảng điều khiển AI Agent, CAO workflow, runner terminal, worktree và telemetry.
                </p>
              </div>
              <div class="mt-3 text-[11px] text-purple-400 font-medium">Dành cho lập trình viên →</div>
            </div>
          </div>
        </div>

        <!-- Shortcuts and System -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">Phím tắt & Tiện ích</h4>
          <div class="space-y-2.5">
            <div class="p-3 rounded-xl bg-[#14151c] border border-[#232430] flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-zinc-200">Mở nhanh Task Hub từ mọi nơi</div>
                <p class="text-xs text-zinc-400 mt-0.5">Phím tắt toàn hệ thống Windows</p>
              </div>
              <kbd class="px-2.5 py-1 rounded-lg bg-[#18181b] border border-[#27272a] text-xs font-mono text-indigo-300 shadow-inner">
                Ctrl + Shift + T
              </kbd>
            </div>

            <div class="p-3 rounded-xl bg-[#14151c] border border-[#232430] flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-zinc-200">Thông báo nhắc việc đến hạn</div>
                <p class="text-xs text-zinc-400 mt-0.5">Nhận thông báo góc màn hình khi việc sắp tới giờ</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="notificationsEnabled" class="sr-only peer" />
                <div class="w-10 h-5 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- App Info & Updates -->
        <div class="pt-2 border-t border-[#232430] flex items-center justify-between text-xs text-zinc-500 font-mono">
          <div>
            <span>Task Hub Desktop v1.4.0</span>
            <span class="mx-1.5">•</span>
            <span>Ma Cà Tưng</span>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="updateStatus" class="text-indigo-400">{{ updateStatus }}</span>
            <button
              @click="checkUpdates"
              class="text-zinc-400 hover:text-zinc-200 underline transition-colors cursor-pointer"
            >
              Kiểm tra cập nhật
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
