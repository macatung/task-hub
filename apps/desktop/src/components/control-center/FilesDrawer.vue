<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TaskItem } from '../../composables/useTaskSync';

const props = defineProps<{
  workspace: string;
  worktree?: string;
  task?: TaskItem | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  close: [];
}>();

const selectedFile = ref<string | null>(null);

export interface ModifiedFile {
  path: string;
  additions: number;
  deletions: number;
}

const activeLocation = computed(() => props.worktree || props.workspace || 'Chưa chọn thư mục');
const modifiedFiles = computed<ModifiedFile[]>(() => {
  if (!props.task) return [];
  return [];
});
</script>

<template>
  <div class="relative flex min-h-0 shrink-0 z-30 select-none">
    <!-- Vertical Trigger Strip (AgentsRoom Right Edge) -->
    <button
      class="flex flex-col items-center justify-center border-l border-[#26201a] bg-[#14110f] px-1.5 py-4 text-zinc-400 hover:text-orange-400 hover:bg-[#1c1713] transition cursor-pointer"
      title="Mở bảng Tệp và Không gian làm việc"
      @click="emit('toggle')"
    >
      <i class="codicon codicon-files text-xs mb-2"></i>
      <span class="text-[10px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180 text-orange-400/90">
        TỆP VÀ WORKTREE
      </span>
      <span class="mt-2 grid h-4 w-4 place-items-center rounded-full bg-orange-500/20 text-[9px] font-bold text-orange-400">
        {{ modifiedFiles.length }}
      </span>
    </button>

    <!-- Slide-out Drawer Panel -->
    <div
      v-if="isOpen"
      class="w-72 border-l border-[#28211b] bg-[#13100e] flex flex-col min-h-0 shadow-2xl transition-all"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-[#251e18] p-3.5 bg-[#171310]">
        <div class="flex items-center gap-2">
          <i class="codicon codicon-git-compare text-orange-400"></i>
          <span class="text-xs font-bold text-zinc-100">Tệp & Thay đổi</span>
        </div>
        <div class="flex items-center gap-1">
          <button class="grid h-6 w-6 place-items-center rounded hover:bg-[#251e18] text-zinc-400 hover:text-zinc-200 transition" title="Làm mới">
            <i class="codicon codicon-refresh text-xs"></i>
          </button>
          <button class="grid h-6 w-6 place-items-center rounded hover:bg-[#251e18] text-zinc-400 hover:text-zinc-200 transition" title="Đóng" @click="emit('close')">
            <i class="codicon codicon-close text-xs"></i>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
            <span>Tệp trong phiên</span>
            <span>{{ modifiedFiles.length }} tệp</span>
          </div>

          <div v-if="modifiedFiles.length" class="space-y-1">
            <button
              v-for="file in modifiedFiles"
              :key="file.path"
              class="w-full text-left rounded-xl p-2 transition flex items-center justify-between gap-2 cursor-pointer"
              :class="selectedFile === file.path ? 'bg-[#241d18] border border-orange-500/50 text-orange-300' : 'bg-[#181411] border border-[#261f19] text-zinc-300 hover:border-zinc-600'"
              @click="selectedFile = file.path"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-mono text-[11px]">{{ file.path.split('/').pop() }}</p>
                <p class="truncate text-[9px] text-zinc-500">{{ file.path }}</p>
              </div>
              <div class="flex items-center gap-1 font-mono text-[10px] shrink-0">
                <span class="text-emerald-400">+{{ file.additions }}</span>
                <span v-if="file.deletions" class="text-rose-400">-{{ file.deletions }}</span>
              </div>
            </button>
          </div>

          <div v-else class="rounded-xl border border-[#261f19] bg-[#16120f] p-3 text-center text-zinc-500">
            <i class="codicon codicon-check text-base text-emerald-400 mb-1"></i>
            <p class="text-[11px] text-zinc-400 font-medium">Worktree sạch</p>
            <p class="text-[10px] mt-0.5">Chưa có tệp nào bị thay đổi trong tác vụ hiện tại.</p>
          </div>
        </div>

        <div class="rounded-xl border border-[#261f19] bg-[#16120f] p-3 text-[11px] text-zinc-400 space-y-2">
          <div class="font-bold text-zinc-200 flex items-center gap-1.5">
            <i class="codicon codicon-source-control text-orange-400"></i>
            <span>Không gian làm việc</span>
          </div>
          <p class="text-zinc-400 break-all text-[10px] font-mono">{{ activeLocation }}</p>
          <p class="text-zinc-500 text-[10px]">Tất cả thay đổi được tự động ghi nhận khi tác nhân chạy.</p>
        </div>
      </div>
    </div>
  </div>
</template>
