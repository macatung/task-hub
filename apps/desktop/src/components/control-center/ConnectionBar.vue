<script setup lang="ts">
import { ref } from 'vue';
import type { DesktopCredential, ProjectItem } from '../../composables/useTaskSync';

const props = defineProps<{
  credential: DesktopCredential | null;
  online: boolean;
  syncing: boolean;
  lastSynced: string | null;
  isMaximized: boolean;
  attentionCount?: number;
  projects?: ProjectItem[];
}>();

const emit = defineEmits<{
  sync: [];
  connect: [];
  disconnect: [];
  settings: [];
  requirement: [];
  docs: [];
  openHub: [];
  timeline: [];
  minimize: [];
  maximize: [];
  close: [];
}>();

const overflowMenu = ref<HTMLDetailsElement | null>(null);
const triggerOverflowAction = (action: 'connect' | 'disconnect' | 'docs' | 'timeline' | 'settings' | 'openHub' | 'sync' | 'requirement') => {
  overflowMenu.value?.removeAttribute('open');
  if (action === 'connect') emit('connect');
  else if (action === 'disconnect') emit('disconnect');
  else if (action === 'docs') emit('docs');
  else if (action === 'timeline') emit('timeline');
  else if (action === 'settings') emit('settings');
  else if (action === 'sync') emit('sync');
  else if (action === 'requirement') emit('requirement');
  else emit('openHub');
};
</script>

<template>
  <header class="cc-connectionbar drag-region flex min-h-[3.75rem] items-center justify-between border-b border-[#2a241f] bg-[#141210] px-3.5 py-1.5 text-zinc-100 select-none">
    <!-- Brand & Workspace Identity -->
    <div class="cc-connectionbar__identity flex items-center gap-3 min-w-0 flex-1">
      <!-- Logo & Workspace Name -->
      <div class="flex items-center gap-2 pr-1">
        <div class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]">
          <svg class="h-4.5 w-4.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="19" cy="5" r="2"></circle>
            <circle cx="5" cy="19" r="2"></circle>
            <path d="M10.5 10.5 6.5 17.5"></path>
            <path d="m13.5 13.5 4-7"></path>
          </svg>
        </div>
        <div class="flex flex-col">
          <span class="text-xs font-black tracking-wider uppercase text-zinc-100 flex items-center gap-1.5">
            Task Hub
            <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">DESKTOP</span>
          </span>
          <span class="text-[10px] text-zinc-400 truncate max-w-[140px]" :title="credential?.workspaceName || 'Không gian làm việc cục bộ'">
            {{ credential?.workspaceName || 'Local Workspace' }}
          </span>
        </div>
      </div>

      <!-- Real Projects Quick Switcher Chips (AgentsRoom style) -->
      <div v-if="projects && projects.length" class="cc-connectionbar__projects no-drag hidden sm:flex items-center gap-1.5 rounded-full bg-[#1c1815] border border-[#2d2620] p-1">
        <button
          v-for="p in projects.slice(0, 3)"
          :key="p.id"
          class="grid h-6 px-2 place-items-center rounded-full bg-gradient-to-br from-[#29221b] to-[#1c1713] text-[10px] font-bold text-zinc-200 border border-[#3d3226] hover:border-orange-500/60 hover:text-orange-400 transition"
          :title="p.title"
          @click="emit('sync')"
        >
          {{ p.key || p.title.slice(0, 3).toUpperCase() }}
        </button>
        <button
          class="grid h-5 w-5 place-items-center rounded-full border border-dashed border-zinc-600 text-zinc-400 hover:text-orange-400 hover:border-orange-500 text-xs transition"
          title="Tạo yêu cầu mới vào dự án (New requirement)"
          @click="emit('requirement')"
        >
          +
        </button>
      </div>
    </div>

    <!-- Center / Right Action Pills -->
    <div class="cc-connectionbar__actions no-drag flex items-center gap-2 min-w-0">
      <!-- Attention / Need Input Pill (Only shown if real attention items exist) -->
      <button 
        v-if="attentionCount && attentionCount > 0" 
        class="cc-connectionbar__attention hidden md:inline-flex items-center gap-1.5 rounded-full bg-amber-950/40 border border-amber-600/40 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-900/50 transition shadow-[0_0_10px_rgba(245,158,11,0.15)]"
        title="Các yêu cầu phê duyệt hoặc phản hồi đang chờ bạn xử lý"
        @click="emit('timeline')"
      >
        <span class="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span>{{ attentionCount }} cần phản hồi</span>
      </button>

      <!-- AI Requirement Wizard Action Pill -->
      <button 
        class="cc-connectionbar__requirement hidden lg:inline-flex items-center gap-1.5 rounded-full bg-[#1d1916] border border-[#2e2721] px-2.5 py-1 text-xs text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 transition"
        title="Khám phá và tạo backlog yêu cầu bằng AI"
        @click="emit('requirement')"
      >
        <i class="codicon codicon-sparkle text-xs text-orange-400"></i>
        <span>Yêu cầu mới</span>
      </button>

      <!-- Repo Docs Scanner Pill -->
      <button 
        class="cc-connectionbar__docs hidden xl:inline-flex items-center gap-1.5 rounded-full bg-[#1d1916] border border-[#2e2721] px-2.5 py-1 text-xs text-zinc-300 hover:text-sky-400 hover:border-sky-500/40 transition"
        title="Quét mã nguồn và cập nhật tài liệu kiến trúc docs/"
        @click="emit('docs')"
      >
        <i class="codicon codicon-book text-xs text-sky-400"></i>
        <span>Quét tài liệu</span>
      </button>

      <!-- Activity Timeline Pill -->
      <button 
        class="cc-connectionbar__timeline hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#1d1916] border border-[#2e2721] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition"
        title="Xem dòng thời gian và nhật ký tương tác"
        @click="emit('timeline')"
      >
        <i class="codicon codicon-history text-xs opacity-70"></i>
        <span>Dòng thời gian</span>
      </button>

      <!-- Settings Pill -->
      <button 
        class="inline-flex items-center gap-1.5 rounded-full bg-[#1d1916] border border-[#2e2721] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition"
        title="Mở bảng cài đặt hệ thống"
        @click="emit('settings')"
      >
        <i class="codicon codicon-settings-gear text-xs opacity-70"></i>
        <span class="hidden sm:inline">Cài đặt</span>
      </button>

      <!-- Real User Profile Pill -->
      <div class="cc-connectionbar__profile flex items-center gap-2 rounded-full bg-[#201b17] border border-[#332b23] pl-1 pr-2.5 py-1">
        <span class="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-[9px] font-black text-black">
          {{ (credential?.userName || 'OP').slice(0, 2).toUpperCase() }}
        </span>
        <span class="cc-connectionbar__profile-name text-xs font-semibold text-zinc-200 truncate max-w-[90px]">
          {{ credential?.userName || 'Operator' }}
        </span>
        <span
          class="rounded px-1.5 py-0.2 text-[9px] font-black tracking-wider"
          :class="credential ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black' : 'bg-zinc-700 text-zinc-300'"
        >
          {{ credential ? 'PRO' : 'LOCAL' }}
        </span>
      </div>

      <!-- Real Sync Status Badge -->
      <button 
        class="cc-connectionbar__sync hidden xl:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
        :class="online ? 'bg-emerald-950/40 border border-emerald-600/40 text-emerald-300' : 'bg-[#1c1815] border border-[#2d2620] text-zinc-400'"
        :disabled="syncing"
        :title="online ? 'Đã kết nối với Task Hub API' : 'Đang ở chế độ ngoại tuyến'"
        @click="emit('sync')"
      >
        <i class="h-1.5 w-1.5 rounded-full" :class="online ? 'bg-emerald-400' : 'bg-zinc-500'" />
        <span>{{ syncing ? 'Đang đồng bộ…' : online ? 'Đã kết nối' : 'Ngoại tuyến' }}</span>
      </button>

      <!-- Overflow Menu -->
      <details ref="overflowMenu" class="cc-overflow-menu">
        <summary class="grid h-7 w-7 place-items-center rounded-full bg-[#1d1916] border border-[#2e2721] text-zinc-400 hover:text-white hover:border-zinc-500 transition" aria-label="More actions">
          <i class="codicon codicon-kebab-vertical text-xs"></i>
        </summary>
        <div class="cc-overflow-menu__panel">
          <button @click="triggerOverflowAction('sync')">Đồng bộ / Sync now</button>
          <button @click="triggerOverflowAction('requirement')">New requirement</button>
          <button @click="triggerOverflowAction('docs')">Scan repo docs</button>
          <button @click="triggerOverflowAction('timeline')">Dòng thời gian hoạt động / Timeline</button>
          <button @click="triggerOverflowAction('settings')">Cài đặt / Settings</button>
          <button v-if="credential" @click="triggerOverflowAction('openHub')">Open Hub</button>
          <button @click="triggerOverflowAction(credential ? 'disconnect' : 'connect')">
            {{ credential ? 'Disconnect' : 'Connect Hub' }}
          </button>
        </div>
      </details>

      <!-- Window Controls -->
      <div class="flex items-center pl-1">
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#25201b] hover:text-white transition" aria-label="Minimize" @click="$emit('minimize')">
          <i class="codicon codicon-chrome-minimize text-xs" />
        </button>
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#25201b] hover:text-white transition" :aria-label="isMaximized ? 'Restore window' : 'Maximize window'" @click="$emit('maximize')">
          <i class="codicon text-xs" :class="isMaximized ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'" />
        </button>
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-rose-900/80 hover:text-white transition" aria-label="Close" @click="$emit('close')">
          <i class="codicon codicon-chrome-close text-xs" />
        </button>
      </div>
    </div>
  </header>
</template>
