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
  fleetCount?: number;
  activeFleetCount?: number;
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
  agentRoom: [];
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
        <div class="relative h-8 w-8 shrink-0 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center bg-[#0c1220]">
          <img src="/midnight-hub-mark.svg" alt="Midnight Hub" class="h-full w-full object-cover shrink-0" />
        </div>
        <div class="flex flex-col">
          <span class="text-xs font-bold tracking-wider uppercase text-zinc-100 flex items-center gap-1.5 font-['Space_Grotesk'] leading-none">
            Midnight Hub
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 tracking-widest font-mono inline-flex items-center justify-center shrink-0">MDNT</span>
          </span>
          <span class="text-[10px] text-zinc-400 truncate max-w-[140px] mt-1" :title="credential?.workspaceName || 'Không gian làm việc cục bộ'">
            {{ credential?.workspaceName || 'Local Workspace' }}
          </span>
        </div>
      </div>

      <!-- Real Projects Quick Switcher Chips (AgentsRoom style) -->
      <div v-if="projects && projects.length" class="cc-connectionbar__projects no-drag hidden sm:flex items-center gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] p-1">
        <button
          v-for="p in projects.slice(0, 3)"
          :key="p.id"
          class="inline-flex items-center justify-center shrink-0 h-6 px-2.5 rounded-full bg-[#11182c] text-[10px] font-bold font-mono text-zinc-300 border border-[#141b2d] hover:border-zinc-500 hover:text-white transition"
          :title="p.title"
          @click="emit('sync')"
        >
          {{ p.key || p.title.slice(0, 3).toUpperCase() }}
        </button>
        <button
          class="inline-flex items-center justify-center shrink-0 h-5 w-5 rounded-full border border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 text-xs transition"
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
        class="cc-connectionbar__attention hidden md:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-amber-950/30 border border-amber-600/40 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-900/40 transition"
        title="Các yêu cầu phê duyệt hoặc phản hồi đang chờ bạn xử lý"
        @click="emit('timeline')"
      >
        <span class="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
        <span class="leading-none">{{ attentionCount }} cần phản hồi</span>
      </button>

      <!-- Agent Room Drawer Trigger Button -->
      <button 
        class="cc-connectionbar__fleet inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-3 py-1 text-xs font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition"
        title="Mở phòng trực chiến Agent (Agent Room Local Fleet)"
        @click="emit('agentRoom')"
      >
        <span class="relative flex h-2 w-2 shrink-0">
          <span v-if="activeFleetCount && activeFleetCount > 0" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2" :class="activeFleetCount && activeFleetCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500'"></span>
        </span>
        <span class="leading-none">Agent Room</span>
        <span v-if="fleetCount !== undefined && fleetCount > 0" class="rounded-full bg-[#11182c] border border-[#141b2d] px-1.5 py-0.2 text-[10px] font-mono text-zinc-300 inline-flex items-center justify-center shrink-0">{{ fleetCount }}</span>
      </button>

      <!-- AI Requirement Wizard Action Pill -->
      <button 
        class="cc-connectionbar__requirement hidden lg:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-600 transition"
        title="Khám phá và tạo backlog yêu cầu bằng AI"
        @click="emit('requirement')"
      >
        <i class="codicon codicon-sparkle text-xs text-indigo-400 shrink-0"></i>
        <span class="leading-none">Yêu cầu mới</span>
      </button>

      <!-- Repo Docs Scanner Pill -->
      <button 
        class="cc-connectionbar__docs hidden xl:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-600 transition"
        title="Quét mã nguồn và cập nhật tài liệu kiến trúc docs/"
        @click="emit('docs')"
      >
        <i class="codicon codicon-book text-xs text-zinc-400 shrink-0"></i>
        <span class="leading-none">Quét tài liệu</span>
      </button>

      <!-- Activity Timeline Pill -->
      <button 
        class="cc-connectionbar__timeline hidden sm:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition"
        title="Xem dòng thời gian và nhật ký tương tác"
        @click="emit('timeline')"
      >
        <i class="codicon codicon-history text-xs opacity-70 shrink-0"></i>
        <span class="leading-none">Dòng thời gian</span>
      </button>

      <!-- Settings Pill -->
      <button 
        class="inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full bg-[#0c1220] border border-[#141b2d] px-2.5 py-1 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition"
        title="Mở bảng cài đặt hệ thống"
        @click="emit('settings')"
      >
        <i class="codicon codicon-settings-gear text-xs opacity-70 shrink-0"></i>
        <span class="hidden sm:inline leading-none">Cài đặt</span>
      </button>

      <!-- Real User Profile Pill -->
      <div class="cc-connectionbar__profile flex items-center gap-2 rounded-full bg-[#0c1220] border border-[#141b2d] pl-1 pr-2.5 py-1 shrink-0">
        <span class="grid h-5 w-5 place-items-center rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-200 shrink-0">
          {{ (credential?.userName || 'OP').slice(0, 2).toUpperCase() }}
        </span>
        <span class="cc-connectionbar__profile-name text-xs font-semibold text-zinc-200 truncate max-w-[90px] leading-none">
          {{ credential?.userName || 'Operator' }}
        </span>
        <span
          class="rounded px-1.5 py-0.2 text-[9px] font-bold tracking-wider font-mono inline-flex items-center justify-center shrink-0"
          :class="credential ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'"
        >
          {{ credential ? 'PRO' : 'LOCAL' }}
        </span>
      </div>

      <!-- Real Sync Status Badge -->
      <button 
        class="cc-connectionbar__sync hidden xl:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
        :class="online ? 'bg-emerald-950/40 border border-emerald-600/40 text-emerald-300' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400'"
        :disabled="syncing"
        :title="online ? 'Đã kết nối với Midnight Hub API' : 'Đang ở chế độ ngoại tuyến'"
        @click="emit('sync')"
      >
        <i class="h-1.5 w-1.5 rounded-full shrink-0" :class="online ? 'bg-emerald-400' : 'bg-zinc-500'" />
        <span class="leading-none">{{ syncing ? 'Đang đồng bộ…' : online ? 'Đã kết nối' : 'Ngoại tuyến' }}</span>
      </button>

      <!-- Pending Offline Outbox Sync Badge -->
      <button
        v-if="pendingOutboxCount && pendingOutboxCount > 0"
        class="cc-connectionbar__outbox hidden md:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-1 text-xs bg-amber-950/50 border border-amber-500/50 text-amber-300 hover:bg-amber-900/50 transition cursor-pointer"
        :title="`${pendingOutboxCount} mục đã lưu offline đang chờ sync lên server. Bấm để đồng bộ ngay.`"
        @click="emit('sync')"
      >
        <span class="text-amber-400 shrink-0">⚡</span>
        <span class="font-medium leading-none">{{ pendingOutboxCount }} chờ sync</span>
      </button>

      <!-- CAO Daemon Status Badge -->
      <button
        class="cc-connectionbar__cao hidden lg:inline-flex items-center justify-center shrink-0 gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
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
          class="h-1.5 w-1.5 rounded-full shrink-0"
          :class="
            (caoReconnecting || caoStatus?.reconnecting)
              ? 'bg-amber-400 animate-pulse'
              : caoStatus?.available
                ? 'bg-emerald-400'
                : 'bg-rose-400'
          "
        ></span>
        <span class="leading-none">
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
      <details ref="overflowMenu" class="cc-overflow-menu shrink-0">
        <summary class="grid h-7 w-7 place-items-center rounded-full bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-white hover:border-zinc-500 transition shrink-0" aria-label="More actions">
          <i class="codicon codicon-kebab-vertical text-xs shrink-0"></i>
        </summary>
        <div class="cc-overflow-menu__panel bg-[#070b14] border border-[#141b2d]">
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
      <div class="flex items-center pl-1 shrink-0">
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#11182c] hover:text-white transition shrink-0" aria-label="Minimize" @click="$emit('minimize')">
          <i class="codicon codicon-chrome-minimize text-xs shrink-0" />
        </button>
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-[#11182c] hover:text-white transition shrink-0" :aria-label="isMaximized ? 'Restore window' : 'Maximize window'" @click="$emit('maximize')">
          <i class="codicon text-xs shrink-0" :class="isMaximized ? 'codicon-chrome-restore' : 'codicon-chrome-maximize'" />
        </button>
        <button class="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-rose-900/80 hover:text-white transition shrink-0" aria-label="Close" @click="$emit('close')">
          <i class="codicon codicon-chrome-close text-xs shrink-0" />
        </button>
      </div>
    </div>
  </header>
</template>
