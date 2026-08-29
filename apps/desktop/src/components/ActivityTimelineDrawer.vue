<script setup lang="ts">
import { ref, computed } from 'vue';
import TailwindIcon from './TailwindIcon.vue';

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'tool' | 'muted';
  time: string;
  actor?: {
    type?: string;
    name?: string;
    role?: string;
    details?: string;
  };
  link?: string;
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
        icon: 'check-circle',
        bg: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        iconClass: 'text-emerald-400',
        label: 'Success',
      };
    case 'error':
    case 'failed':
      return {
        icon: 'alert-circle',
        bg: 'bg-rose-950/60 border-rose-800/80 text-rose-300',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        iconClass: 'text-rose-400',
        label: 'Error',
      };
    case 'warning':
      return {
        icon: 'alert-triangle',
        bg: 'bg-amber-950/60 border-amber-800/80 text-amber-300',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        iconClass: 'text-amber-400',
        label: 'Warning',
      };
    case 'active':
      return {
        icon: 'loader',
        bg: 'bg-sky-950/60 border-sky-800/80 text-sky-300',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        iconClass: 'text-sky-400 animate-spin',
        label: 'Running',
      };
    case 'tool':
      return {
        icon: 'wrench',
        bg: 'bg-purple-950/60 border-purple-800/80 text-purple-300',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        iconClass: 'text-purple-400',
        label: 'Tool Call',
      };
    case 'muted':
    default:
      return {
        icon: 'clock',
        bg: 'bg-zinc-900 border-zinc-800 text-zinc-300',
        badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        iconClass: 'text-slate-400',
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
      class="cc-timeline-surface w-full max-w-xl bg-[#070b14] border-l border-[#141b2d] shadow-2xl flex flex-col h-full text-zinc-200 select-none animate-slide-left"
    >
      <!-- Header -->
      <div class="h-12 px-4 border-b border-[#141b2d] bg-[#0c1220] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <i class="codicon codicon-history text-[#00f5a0] text-base shrink-0" />
          <h2 class="text-sm font-bold text-zinc-100 font-['Space_Grotesk']">Activity Timeline</h2>
          <span class="inline-flex items-center justify-center shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#11182c] text-[#00f5a0] border border-[#141b2d]">
            {{ filteredTimeline.length }} events
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            class="inline-flex items-center justify-center shrink-0 h-7 px-2.5 rounded-lg text-xs font-medium bg-[#11182c] hover:bg-[#18233f] border border-[#141b2d] text-zinc-200 gap-1.5 transition-colors cursor-pointer"
            :class="copyFeedback ? 'border-[#00f5a0]/80 text-[#00f5a0]' : ''"
            @click="copyTimelineSummary"
            title="Copy formatted markdown report"
          >
            <TailwindIcon :name="copyFeedback ? 'check' : 'copy'" :size="13" class="shrink-0" />
            <span>{{ copyFeedback ? 'Copied Markdown' : 'Copy Summary' }}</span>
          </button>

          <button
            v-if="timeline.length > 0"
            class="inline-flex items-center justify-center shrink-0 h-7 px-2 rounded-lg text-xs text-zinc-400 hover:text-rose-400 hover:bg-[#11182c] transition-colors cursor-pointer"
            @click="emit('clear-timeline')"
            title="Clear all events"
          >
            <TailwindIcon name="x" :size="13" class="shrink-0" />
          </button>

          <button
            class="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-lg hover:bg-[#11182c] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            @click="emit('close')"
            title="Close drawer"
          >
            <TailwindIcon name="x" :size="14" class="shrink-0" />
          </button>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="p-3 border-b border-[#141b2d] bg-[#070b14] flex flex-col gap-2.5 shrink-0">
        <!-- Search Input -->
        <div class="relative flex items-center">
          <TailwindIcon name="search" :size="12" class="absolute left-2.5 text-zinc-500 pointer-events-none shrink-0" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search timeline events..."
            class="w-full h-8 pl-8 pr-3 bg-[#0c1220] border border-[#141b2d] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#00f5a0]/80"
          />
        </div>

        <!-- Tone Filter Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <button
            class="inline-flex items-center justify-center shrink-0 px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer font-mono"
            :class="selectedToneFilter === 'all' ? 'bg-[#00f5a0] text-black font-bold' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'all'"
          >
            All
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer gap-1.5 font-mono"
            :class="selectedToneFilter === 'ok' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'ok'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[#00f5a0] shrink-0" />
            Success
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer gap-1.5 font-mono"
            :class="selectedToneFilter === 'warning' ? 'bg-amber-600 text-white font-bold' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'warning'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            Warning
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer gap-1.5 font-mono"
            :class="selectedToneFilter === 'error' ? 'bg-rose-600 text-white font-bold' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'error'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            Error
          </button>
          <button
            class="inline-flex items-center justify-center shrink-0 px-2.5 py-0.5 rounded-lg font-medium transition-colors cursor-pointer gap-1.5 font-mono"
            :class="selectedToneFilter === 'active' ? 'bg-[#00f5d4] text-black font-bold' : 'bg-[#0c1220] border border-[#141b2d] text-zinc-400 hover:text-zinc-200'"
            @click="selectedToneFilter = 'active'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[#00f5d4] shrink-0" />
            Running
          </button>
        </div>
      </div>

      <!-- Events List (Chronological) -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="filteredTimeline.length === 0" class="py-12 text-center text-zinc-500 text-xs">
          <TailwindIcon name="book-open" :size="32" class="mx-auto mb-2 text-zinc-600 shrink-0" />
          <span>No activity events found.</span>
        </div>

        <div
          v-for="event in filteredTimeline"
          :key="event.id"
          class="p-3 rounded-xl border flex gap-3 transition-all duration-150 bg-[#0c1220] border-[#141b2d]"
          :class="getToneConfig(event.tone).bg"
        >
          <!-- Left Icon Beacon -->
          <div class="pt-0.5 shrink-0 inline-flex items-center justify-center">
            <TailwindIcon :name="getToneConfig(event.tone).icon" :size="15" :class="getToneConfig(event.tone).iconClass" class="shrink-0" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-bold text-xs text-zinc-100 truncate font-['Space_Grotesk']">{{ event.label }}</span>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="inline-flex items-center justify-center shrink-0 px-1.5 py-0.2 text-[10px] font-mono rounded-md border font-semibold uppercase" :class="getToneConfig(event.tone).badge">
                  {{ getToneConfig(event.tone).label }}
                </span>
                <span class="text-[10px] font-mono text-zinc-400">{{ event.time }}</span>
              </div>
            </div>
            <div v-if="event.actor?.name" class="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/5 font-mono">
              <span>👤</span>
              <span class="font-bold text-zinc-200">{{ event.actor.name }}</span>
              <span v-if="event.actor.role" class="text-zinc-500">· {{ event.actor.role }}</span>
            </div>
            <p class="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
              {{ event.detail }}
            </p>
            <a v-if="event.link" :href="event.link" target="_blank" rel="noreferrer" class="mt-2 inline-flex items-center text-xs font-semibold text-[#00f5a0] hover:text-[#00f5d4] underline underline-offset-2">
              Open handoff in Hub ↗
            </a>
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
