<script setup lang="ts">
import { ref, computed } from 'vue';

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'tool' | 'muted';
  time: string;
}

const props = defineProps<{
  show: boolean;
  timeline: TimelineEvent[];
  activeTask?: any | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'clear-timeline'): void;
}>();

const searchQuery = ref('');
const selectedToneFilter = ref<'all' | 'ok' | 'warning' | 'error' | 'active' | 'tool'>('all');
const copyFeedback = ref(false);

const filteredTimeline = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return props.timeline.filter((event) => {
    // Tone filter
    if (selectedToneFilter.value !== 'all') {
      if (selectedToneFilter.value === 'ok' && !['ok', 'passed'].includes(event.tone)) return false;
      if (selectedToneFilter.value === 'warning' && event.tone !== 'warning') return false;
      if (selectedToneFilter.value === 'error' && !['error', 'failed'].includes(event.tone)) return false;
      if (selectedToneFilter.value === 'active' && event.tone !== 'active') return false;
      if (selectedToneFilter.value === 'tool' && event.tone !== 'tool') return false;
    }
    // Search query
    if (q) {
      const matchLabel = event.label.toLowerCase().includes(q);
      const matchDetail = event.detail.toLowerCase().includes(q);
      if (!matchLabel && !matchDetail) return false;
    }
    return true;
  });
});

const getToneConfig = (tone: TimelineEvent['tone']) => {
  switch (tone) {
    case 'ok':
    case 'passed':
      return {
        icon: 'codicon-check',
        bg: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        label: 'Success',
      };
    case 'error':
    case 'failed':
      return {
        icon: 'codicon-error',
        bg: 'bg-rose-950/60 border-rose-800/80 text-rose-300',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        label: 'Error',
      };
    case 'warning':
      return {
        icon: 'codicon-warning',
        bg: 'bg-amber-950/60 border-amber-800/80 text-amber-300',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        label: 'Warning',
      };
    case 'active':
      return {
        icon: 'codicon-loading animate-spin',
        bg: 'bg-sky-950/60 border-sky-800/80 text-sky-300',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        label: 'Running',
      };
    case 'tool':
      return {
        icon: 'codicon-tools',
        bg: 'bg-purple-950/60 border-purple-800/80 text-purple-300',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        label: 'Tool Call',
      };
    case 'muted':
    default:
      return {
        icon: 'codicon-info',
        bg: 'bg-zinc-900 border-zinc-800 text-zinc-300',
        badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        label: 'Info',
      };
  }
};

const formatTimelineSummary = (): string => {
  const header = `### Task Hub Desktop Activity Timeline Report\n**Generated**: ${new Date().toISOString()}\n${props.activeTask ? `**Task**: ${props.activeTask.issue_key || `#${props.activeTask.id}`} - ${props.activeTask.title}\n` : ''}\n---\n`;
  const rows = filteredTimeline.value.map((e) => {
    return `- **[${e.time}]** \`[${e.tone.toUpperCase()}]\` **${e.label}**: ${e.detail}`;
  }).join('\n');
  return `${header}${rows}\n`;
};

const copyTimelineSummary = async () => {
  const text = formatTimelineSummary();
  try {
    await navigator.clipboard.writeText(text);
    copyFeedback.value = true;
    setTimeout(() => {
      copyFeedback.value = false;
    }, 2000);
  } catch (err) {
    console.warn('Failed to copy timeline summary:', err);
  }
};
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-xl bg-[#1e1e1e] border-l border-[#333333] shadow-2xl flex flex-col h-full text-zinc-200 select-none animate-slide-left"
    >
      <!-- Header -->
      <div class="h-12 px-4 border-b border-[#2d2d2d] bg-[#252526] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <i class="codicon codicon-history text-[#007acc] text-base" />
          <h2 class="text-sm font-semibold text-zinc-100">Activity Timeline</h2>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
            {{ filteredTimeline.length }} events
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-7 px-2.5 rounded text-xs font-medium bg-[#2d2d2d] hover:bg-[#383838] border border-[#3e3e42] text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            :class="copyFeedback ? 'border-emerald-500 text-emerald-300' : ''"
            @click="copyTimelineSummary"
            title="Copy formatted markdown report"
          >
            <i class="codicon" :class="copyFeedback ? 'codicon-check' : 'codicon-copy'" />
            <span>{{ copyFeedback ? 'Copied Markdown' : 'Copy Summary' }}</span>
          </button>

          <button
            v-if="timeline.length > 0"
            class="h-7 px-2 rounded text-xs text-zinc-400 hover:text-rose-400 hover:bg-[#333333] transition-colors cursor-pointer"
            @click="emit('clear-timeline')"
            title="Clear all events"
          >
            <i class="codicon codicon-trash" />
          </button>

          <button
            class="w-7 h-7 rounded hover:bg-[#333333] text-zinc-400 hover:text-white grid place-items-center transition-colors cursor-pointer"
            @click="emit('close')"
            title="Close drawer"
          >
            <i class="codicon codicon-close text-sm" />
          </button>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="p-3 border-b border-[#2d2d2d] bg-[#222222] flex flex-col gap-2.5 shrink-0">
        <!-- Search Input -->
        <div class="relative">
          <i class="codicon codicon-search absolute left-2.5 top-2 text-zinc-500 text-xs pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search timeline events..."
            class="w-full h-8 pl-8 pr-3 bg-[#1e1e1e] border border-[#3e3e42] rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#007acc]"
          />
        </div>

        <!-- Tone Filter Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <button
            class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
            :class="selectedToneFilter === 'all' ? 'bg-[#007acc] text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'all'"
          >
            All
          </button>
          <button
            class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
            :class="selectedToneFilter === 'ok' ? 'bg-emerald-700 text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'ok'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Success
          </button>
          <button
            class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
            :class="selectedToneFilter === 'warning' ? 'bg-amber-700 text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'warning'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Warning
          </button>
          <button
            class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
            :class="selectedToneFilter === 'error' ? 'bg-rose-700 text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'error'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Error
          </button>
          <button
            class="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
            :class="selectedToneFilter === 'active' ? 'bg-sky-700 text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'active'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Running
          </button>
        </div>
      </div>

      <!-- Events List (Chronological) -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="filteredTimeline.length === 0" class="py-12 text-center text-zinc-500 text-xs">
          <i class="codicon codicon-inbox text-3xl mb-2 block text-zinc-600" />
          <span>No activity events found.</span>
        </div>

        <div
          v-for="event in filteredTimeline"
          :key="event.id"
          class="p-3 rounded-lg border flex gap-3 transition-all duration-150"
          :class="getToneConfig(event.tone).bg"
        >
          <!-- Left Icon Beacon -->
          <div class="pt-0.5 shrink-0">
            <i class="codicon text-sm" :class="getToneConfig(event.tone).icon" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-medium text-xs text-zinc-100 truncate">{{ event.label }}</span>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="px-1.5 py-0.2 text-[10px] font-mono rounded border font-semibold uppercase" :class="getToneConfig(event.tone).badge">
                  {{ getToneConfig(event.tone).label }}
                </span>
                <span class="text-[10px] font-mono text-zinc-400">{{ event.time }}</span>
              </div>
            </div>
            <p class="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
              {{ event.detail }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slideLeft {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
.animate-slide-left {
  animation: slideLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
