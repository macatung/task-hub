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
  pendingOutboxCount?: number;
  projects?: ProjectItem[];
  caoStatus?: {
    running: boolean;
    available: boolean;
    reconnecting?: boolean;
    port?: number;
    source?: 'embedded' | 'external' | 'offline';
    cli?: string | null;
  } | null;
  caoReconnecting?: boolean;
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
  restartCao: [];
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
  <header class="cc-connectionbar drag-region flex min-h-[3.75rem] items-center justify-between border-b border-[#141b2d] bg-[#070b14] px-3.5 py-1.5 text-zinc-100 select-none">
    <!-- Brand & Workspace Identity -->
    <div class="cc-connectionbar__identity flex items-center gap-3 min-w-0 flex-1">
      <!-- Logo & Workspace Name -->
      <div class="flex items-center gap-2.5 pr-1">
        <div class="relative h-8 w-8 shrink-0 rounded-xl overflow-hidden shadow-[0_0_14px_rgba(0,245,160,0.35)]">
          <img src="/midnight-hub-mark.svg" alt="Midnight Hub" class="h-full w-full object-cover" />
        </div>
        <div class="flex flex-col">
          <span class="text-xs font-black tracking-wider uppercase text-zinc-100 flex items-center gap-1.5 font-['Space_Grotesk']">
            Midnight Hub
            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-[#00f5a0] border border-emerald-500/30 tracking-widest font-mono">MDNT</span>
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

      <!-- Pending Offline Outbox Sync Badge -->
      <button
        v-if="pendingOutboxCount && pendingOutboxCount > 0"
        class="cc-connectionbar__outbox hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-amber-950/50 border border-amber-500/50 text-amber-300 hover:bg-amber-900/50 transition cursor-pointer"
        :title="`${pendingOutboxCount} mục đã lưu offline đang chờ sync lên server. Bấm để đồng bộ ngay.`"
        @click="emit('sync')"
      >
        <span class="text-amber-400">⚡</span>
        <span class="font-medium">{{ pendingOutboxCount }} chờ sync</span>
      </button>

      <!-- CAO Daemon Status Badge -->
      <button
        class="cc-connectionbar__cao hidden lg:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
        :class="
          (caoReconnecting || caoStatus?.reconnecting)
            ? 'bg-amber-950/40 border border-amber-600/40 text-amber-300'
            : caoStatus?.available
              ? 'bg-emerald-950/40 border border-emerald-600/40 text-emerald-300'
              : 'bg-rose-950/30 border border-rose-800/40 text-rose-300'
        "
        :title="
          (caoReconnecting || caoStatus?.reconnecting)
            ? 'CAO Daemon đang kết nối lại...'
            : caoStatus?.available
              ? `CAO Orchestrator hoạt động trên cổng ${caoStatus.port || 9889}`
              : 'CAO Orchestrator chưa khả dụng. Nhấp để mở cài đặt.'
        "
        @click="emit('settings')"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="
            (caoReconnecting || caoStatus?.reconnecting)
              ? 'bg-amber-400 animate-pulse'
              : caoStatus?.available
                ? 'bg-emerald-400'
                : 'bg-rose-400'
          "
        ></span>
        <span>
          {{
            (caoReconnecting || caoStatus?.reconnecting)
              ? 'CAO Reconnecting…'
              : caoStatus?.available
                ? `CAO ${caoStatus.port || 9889}`
                : 'CAO Offline'
          }}
        </span>
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
