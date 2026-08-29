<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';

export interface HistoryActor {
  type: 'user' | 'agent_runner' | 'agent_model' | 'github_ci' | 'system' | string;
  name: string;
  email?: string | null;
  role?: string | null;
  details?: string | null;
  avatar_icon?: string;
}

export interface HistoryEvidence {
  id: number;
  type: string;
  status: string;
  command?: string | null;
  summary?: string | null;
  commit_sha?: string | null;
  artifact_url?: string | null;
}

export interface HistoryEventItem {
  id: string;
  event_type: string;
  title: string;
  description: string;
  from_status?: string | null;
  to_status?: string | null;
  tone: 'ok' | 'active' | 'warning' | 'error' | 'tool' | 'muted';
  actor: HistoryActor;
  evidence: HistoryEvidence[];
  metadata: Record<string, any>;
  occurred_at: string;
}

export interface TaskHistoryPayload {
  success: boolean;
  task: {
    id: number;
    issue_key: string;
    title: string;
    status: string;
    priority?: string;
    story_points?: number | null;
    created_at?: string;
    completed_at?: string;
  };
  summary: {
    total_events: number;
    total_transitions: number;
    current_handler: string;
    actors_involved: string[];
    agent_runs_count: number;
    verification_count: number;
  };
  timeline: HistoryEventItem[];
}

const props = defineProps<{
  taskId: number;
  isDarkMode?: boolean;
}>();

const historyData = ref<TaskHistoryPayload | null>(null);
const isLoading = ref(false);
const errorMsg = ref<string | null>(null);
const searchQuery = ref('');
const selectedFilter = ref<'all' | 'transitions' | 'agents' | 'reviews'>('all');
const copiedSummary = ref(false);

const loadHistory = async () => {
  if (!props.taskId) return;
  isLoading.value = true;
  errorMsg.value = null;
  try {
    const res = await axios.get(`/api/v1/tasks/${props.taskId}/history`);
    historyData.value = res.data;
  } catch {
    try {
      const fallback = await axios.get(`/api/tasks/${props.taskId}/history`);
      historyData.value = fallback.data;
    } catch (e: any) {
      errorMsg.value = e.response?.data?.message || 'Unable to load task transition history.';
    }
  } finally {
    isLoading.value = false;
  }
};

watch(() => props.taskId, () => {
  void loadHistory();
}, { immediate: true });

const filteredTimeline = computed(() => {
  if (!historyData.value?.timeline) return [];
  const q = searchQuery.value.trim().toLowerCase();
  return historyData.value.timeline.filter((item) => {
    // Filter categories
    if (selectedFilter.value === 'transitions') {
      if (!item.from_status && !item.to_status) return false;
    } else if (selectedFilter.value === 'agents') {
      if (!['task_dispatched', 'run_claimed', 'handoff_submitted', 'agent_progress', 'agent_failed'].includes(item.event_type)) return false;
    } else if (selectedFilter.value === 'reviews') {
      if (!['task_approved', 'task_rejected', 'evidence_verified'].includes(item.event_type)) return false;
    }

    if (q) {
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchActor = item.actor?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchActor) return false;
    }
    return true;
  });
});

const getToneBadge = (tone: string) => {
  switch (tone) {
    case 'ok':
      return props.isDarkMode ? 'bg-emerald-950/60 text-phantom-mint border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'error':
      return props.isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
    case 'warning':
      return props.isDarkMode ? 'bg-amber-950/60 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200';
    case 'active':
      return props.isDarkMode ? 'bg-cyan-950/60 text-cyber-cyan border-cyan-800' : 'bg-sky-50 text-sky-700 border-sky-200';
    case 'tool':
      return props.isDarkMode ? 'bg-purple-950/60 text-phantom-purple border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return props.isDarkMode ? 'bg-midnight-900 text-slate-300 border-midnight-800' : 'bg-slate-100 text-slate-700 border-slate-300';
  }
};

const getActorTypeLabel = (type: string) => {
  switch (type) {
    case 'user':
      return 'Human Developer';
    case 'agent_runner':
      return 'Runner / Local Agent';
    case 'agent_model':
      return 'AI Model';
    case 'github_ci':
    case 'github':
      return 'GitHub Actions / Webhook';
    default:
      return 'System';
  }
};

const getActorIcon = (type: string) => {
  switch (type) {
    case 'user':
      return 'User';
    case 'agent_runner':
      return 'Agent';
    case 'agent_model':
      return 'Cpu';
    case 'github_ci':
    case 'github':
      return 'Github';
    default:
      return 'Settings';
  }
};

const formatRelativeTime = (isoString: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const copyMarkdownAudit = async () => {
  if (!historyData.value) return;
  const task = historyData.value.task;
  const summary = historyData.value.summary;
  let md = `# E2E History & Actor Audit Trail — #${task.issue_key}\n`;
  md += `**Task**: ${task.title}\n`;
  md += `**Status**: ${task.status.toUpperCase()}\n`;
  md += `**Handler**: ${summary.current_handler}\n`;
  md += `**Total Events**: ${summary.total_events} | **Transitions**: ${summary.total_transitions}\n`;
  md += `**Actors**: ${summary.actors_involved.join(', ')}\n\n`;
  md += `## Timeline Details\n\n`;

  for (const item of historyData.value.timeline) {
    md += `### [${item.occurred_at}] ${item.title}\n`;
    md += `- **Actor**: ${item.actor.name} (${getActorTypeLabel(item.actor.type)})\n`;
    if (item.from_status || item.to_status) {
      md += `- **Transition**: \`${item.from_status || 'INIT'}\` -> \`${item.to_status || 'CURRENT'}\`\n`;
    }
    md += `- **Description**: ${item.description}\n`;
    if (item.evidence && item.evidence.length > 0) {
      md += `- **Evidence**: ${item.evidence.map(e => `[${e.type.toUpperCase()}] ${e.status.toUpperCase()} (${e.summary || e.command})`).join('; ')}\n`;
    }
    md += `\n`;
  }

  try {
    await navigator.clipboard.writeText(md);
    copiedSummary.value = true;
    setTimeout(() => {
      copiedSummary.value = false;
    }, 2000);
  } catch (e) {
    console.warn('Failed to copy audit report', e);
  }
};
</script>

<template>
  <div class="task-history-audit space-y-4">
    <!-- Header & Summary Card -->
    <div :class="['rounded-2xl border p-4 shadow-xs transition-all', isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900']">
      <div class="flex items-center justify-between gap-3 pb-3 border-b" :class="isDarkMode ? 'border-midnight-800' : 'border-slate-200'">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl border border-midnight-800 bg-midnight-850 inline-flex items-center justify-center shrink-0 text-cyan-400">
            <Icons name="ListChecks" :size="16" />
          </div>
          <div>
            <h4 class="font-bold text-xs uppercase tracking-wider font-display flex items-center gap-2">
              <span>E2E History & Actor Audit Trail (Lịch sử E2E & Ai là người xử lý)</span>
              <span v-if="historyData" class="px-2 py-0.2 rounded-full font-mono text-[10px] font-semibold border" :class="isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' : 'bg-blue-50 text-blue-700 border-blue-200'">
                {{ historyData.summary.total_events }} events
              </span>
            </h4>
            <p v-if="historyData" class="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
              Current handler: <span class="font-bold text-cyber-cyan">{{ historyData.summary.current_handler }}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            @click="copyMarkdownAudit"
            class="h-7 px-2.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
            :class="copiedSummary ? 'bg-emerald-600 border-emerald-500 text-white' : (isDarkMode ? 'bg-midnight-850 hover:bg-midnight-800 border-midnight-700 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800')"
            title="Sao chép toàn bộ lịch sử dạng Markdown (Copy audit report in Markdown format)"
          >
            <Icons :name="copiedSummary ? 'Check' : 'Copy'" :size="12" />
            <span class="leading-none">{{ copiedSummary ? 'Copied' : 'Copy Report' }}</span>
          </button>

          <button
            @click="loadHistory"
            :disabled="isLoading"
            class="w-7 h-7 rounded-xl border inline-flex items-center justify-center transition-all cursor-pointer shrink-0"
            :class="isDarkMode ? 'bg-midnight-850 hover:bg-midnight-800 border-midnight-700 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'"
            title="Refresh history"
          >
            <Icons name="Refresh" :size="12" :class="isLoading ? 'animate-spin text-phantom-mint' : ''" />
          </button>
        </div>
      </div>

      <!-- Actors Involved Pills -->
      <div v-if="historyData && historyData.summary.actors_involved.length" class="pt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
        <span class="text-[10px] uppercase font-bold text-slate-400 mr-1">Nhân sự & Agent tham gia:</span>
        <span
          v-for="actor in historyData.summary.actors_involved"
          :key="actor"
          class="px-2 py-0.5 rounded-lg font-medium border"
          :class="isDarkMode ? 'bg-midnight-950 text-slate-200 border-midnight-800' : 'bg-white text-slate-800 border-slate-300 shadow-2xs'"
        >
          {{ actor }}
        </span>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex items-center gap-2 font-mono">
      <div class="relative flex-1">
        <Icons name="Search" :size="13" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search events, actors, transitions..."
          class="w-full h-8 pl-8 pr-3 rounded-xl border text-xs focus:outline-none focus:border-phantom-mint/60"
          :class="isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'"
        />
      </div>

      <div class="flex items-center gap-1 text-[11px]">
        <button
          v-for="f in [{ id: 'all', label: 'Tất cả' }, { id: 'transitions', label: 'Chuyển trạng thái' }, { id: 'agents', label: 'Agent Runs' }, { id: 'reviews', label: 'Review / Phê duyệt' }]"
          :key="f.id"
          @click="selectedFilter = (f.id as any)"
          class="px-2.5 py-1 rounded-xl font-bold border transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
          :class="selectedFilter === f.id ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-midnight-950 border-emerald-400 shadow-sm' : (isDarkMode ? 'bg-midnight-900 border-midnight-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200')"
        >
          <span class="leading-none">{{ f.label }}</span>
        </button>
      </div>
    </div>

    <!-- Timeline List -->
    <div v-if="isLoading && !historyData" class="py-12 text-center text-xs text-slate-500 font-mono">
      <span class="animate-pulse">Loading E2E audit trail...</span>
    </div>

    <div v-else-if="errorMsg" class="p-4 rounded-2xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs font-mono">
      {{ errorMsg }}
    </div>

    <div v-else-if="filteredTimeline.length === 0" class="py-10 text-center text-xs text-slate-400 italic font-mono">
      No history events matching the current filter.
    </div>

    <div v-else class="space-y-3 relative before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-midnight-800">
      <div
        v-for="item in filteredTimeline"
        :key="item.id"
        class="relative pl-9 transition-all"
      >
        <!-- Left Beacon Icon Node -->
        <div
          class="absolute left-2 top-3.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 grid place-items-center text-[9px] shadow-sm z-10 shrink-0"
          :class="getToneBadge(item.tone)"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
        </div>

        <!-- Event Box -->
        <div
          class="rounded-2xl border p-3.5 space-y-2 shadow-xs transition-all"
          :class="[
            isDarkMode ? 'bg-midnight-900/90 border-midnight-800/80 text-slate-200 hover:border-midnight-700' : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300',
            item.tone === 'ok' ? 'border-l-4 border-l-phantom-mint' : '',
            item.tone === 'error' ? 'border-l-4 border-l-rose-500' : '',
            item.tone === 'active' ? 'border-l-4 border-l-cyber-cyan' : '',
          ]"
        >
          <!-- Top Row: Title + Time -->
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-0.5">
              <h5 class="font-bold text-xs text-slate-100 flex items-center gap-2 flex-wrap">
                <span>{{ item.title }}</span>
                <span
                  v-if="item.from_status || item.to_status"
                  class="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold uppercase border inline-flex items-center justify-center shrink-0"
                  :class="getToneBadge(item.tone)"
                >
                  <span class="leading-none">{{ item.from_status ? item.from_status.toUpperCase() : 'START' }} -> {{ item.to_status ? item.to_status.toUpperCase() : 'CURRENT' }}</span>
                </span>
              </h5>
            </div>

            <div class="text-right shrink-0">
              <span class="text-[10px] font-mono text-slate-400 block" :title="item.occurred_at">{{ formatRelativeTime(item.occurred_at) }}</span>
              <span class="text-[9px] font-mono text-slate-500 block">{{ new Date(item.occurred_at).toLocaleTimeString() }}</span>
            </div>
          </div>

          <!-- Actor Attribution Card -->
          <div
            class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border text-xs"
            :class="isDarkMode ? 'bg-midnight-950/80 border-midnight-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'"
          >
            <div class="w-6 h-6 rounded-lg grid place-items-center font-bold text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
              <Icons :name="getActorIcon(item.actor.type)" :size="12" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-[11px] text-slate-100 truncate">{{ item.actor.name }}</span>
                <span class="text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase bg-midnight-900 text-slate-400 border border-midnight-800">
                  {{ item.actor.role || item.actor.type }}
                </span>
              </div>
              <p v-if="item.actor.details || item.actor.email" class="text-[10px] text-slate-400 truncate font-mono">
                {{ item.actor.details || item.actor.email }}
              </p>
            </div>
          </div>

          <!-- Narrative Description -->
          <p v-if="item.description" class="text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
            {{ item.description }}
          </p>

          <!-- Evidence List -->
          <div v-if="item.evidence && item.evidence.length > 0" class="space-y-1.5 pt-1 font-mono">
            <span class="text-[10px] font-bold uppercase text-slate-400">Bằng chứng xác thực (Evidence):</span>
            <div
              v-for="evi in item.evidence"
              :key="evi.id"
              class="p-2 rounded-xl border text-xs flex items-center justify-between gap-2"
              :class="evi.status === 'passed' ? (isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-phantom-mint' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : (isDarkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800')"
            >
              <div class="min-w-0 flex items-center gap-2">
                <Icons :name="evi.status === 'passed' ? 'Check' : 'X'" :size="12" class="shrink-0" />
                <span class="font-bold text-[11px] uppercase">{{ evi.type }}:</span>
                <span class="truncate text-[11px]">{{ evi.summary || evi.command }}</span>
              </div>
              <span v-if="evi.commit_sha" class="text-[10px] opacity-75 shrink-0">{{ evi.commit_sha.slice(0, 7) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
