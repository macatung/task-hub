<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ThreadMessage, ToolCallItem, ConversationRole } from '../../composables/useConversationThread';
import { renderMarkdown } from '../../utils/markdown';

const props = withDefaults(
  defineProps<{
    messages: ThreadMessage[];
    running?: boolean;
    streamingText?: string;
    provider?: string;
    model?: string;
    role?: ConversationRole;
    taskTitle?: string;
    userName?: string;
  }>(),
  {
    running: false,
    provider: 'codex',
    role: 'worker',
  }
);

const emit = defineEmits<{
  sendPrompt: [text: string];
  stop: [];
}>();

const threadContainer = ref<HTMLElement | null>(null);
const userScrolledUp = ref(false);
const expandedTools = ref<Record<string, boolean>>({});
const expandedThoughts = ref<Record<string, boolean>>({});

const scrollToBottom = async (force = false) => {
  await nextTick();
  if (threadContainer.value && (!userScrolledUp.value || force)) {
    threadContainer.value.scrollTop = threadContainer.value.scrollHeight;
  }
};

const onScroll = () => {
  if (!threadContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = threadContainer.value;
  userScrolledUp.value = scrollHeight - (scrollTop + clientHeight) > 80;
};

watch(
  () => [props.messages.length, props.streamingText, props.running],
  () => {
    scrollToBottom();
  },
  { deep: true }
);

onMounted(() => {
  scrollToBottom(true);
});

const toggleTool = (id: string) => {
  expandedTools.value[id] = !expandedTools.value[id];
};

const toggleThought = (id: string) => {
  expandedThoughts.value[id] = !expandedThoughts.value[id];
};

const copyContent = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

const quickPrompts = [
  'Bắt đầu phân tích và thực hiện task này',
  'Chạy kiểm thử và kiểm tra các contract',
  'Review bảo mật và xác nhận handoff',
];

const providerBadgeClass = (p?: string) => {
  switch (p?.toLowerCase()) {
    case 'claude_code':
      return 'bg-purple-950/50 text-purple-300 border-purple-600/40';
    case 'antigravity':
      return 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40';
    default:
      return 'bg-amber-950/50 text-amber-300 border-amber-500/40';
  }
};

const roleBadgeClass = (r?: string) => {
  switch (r) {
    case 'architect':
      return 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40';
    case 'implementer':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
    case 'tester':
    case 'test_engineer':
      return 'bg-amber-950/60 text-amber-300 border-amber-500/40';
    case 'auditor':
      return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40';
    case 'supervisor':
      return 'bg-blue-950/50 text-blue-300 border-blue-600/40';
    case 'reviewer':
      return 'bg-rose-950/50 text-rose-300 border-rose-600/40';
    default:
      return 'bg-emerald-950/50 text-emerald-300 border-emerald-600/40';
  }
};

const formatRole = (r?: string) => {
  switch (r) {
    case 'architect':
      return 'Architect';
    case 'implementer':
      return 'Implementer';
    case 'tester':
    case 'test_engineer':
      return 'Test Engineer';
    case 'auditor':
      return 'Auditor';
    case 'supervisor':
      return 'Supervisor';
    case 'reviewer':
      return 'Reviewer';
    default:
      return 'Implementation';
  }
};

const formatProvider = (p?: string) => {
  switch (p?.toLowerCase()) {
    case 'claude_code':
      return 'Claude Code';
    case 'antigravity':
      return 'Antigravity';
    default:
      return 'Codex';
  }
};
</script>

<template>
  <div class="cc-conversation-thread flex h-full flex-col bg-[#050911] text-zinc-100 select-text overflow-hidden">
    <!-- Thread Scroll Area -->
    <div
      ref="threadContainer"
      class="flex-1 space-y-5 overflow-y-auto px-4 py-4 scroll-smooth md:px-6"
      @scroll="onScroll"
    >
      <!-- Empty Welcome State -->
      <div v-if="!messages.length && !running" class="my-auto flex flex-col items-center justify-center py-12 text-center">
        <div class="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#00f5a0]/20 via-[#00f5d4]/10 to-[#9d4edd]/20 border border-[#00f5a0]/30 shadow-[0_0_24px_rgba(0,245,160,0.2)]">
          <svg class="h-7 w-7 text-[#00f5a0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h3 class="text-base font-bold text-white font-['Space_Grotesk']">
          {{ taskTitle || 'Cuộc trò chuyện với AI Agent' }}
        </h3>
        <p class="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-400">
          Gửi chỉ thị, yêu cầu sửa đổi hoặc bắt đầu phiên làm việc tương tác với Agent. Toàn bộ hội thoại được lưu trữ theo task này.
        </p>

        <!-- Quick Prompts -->
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="rounded-xl border border-[#1e2c40] bg-[#0b1320] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:border-[#00f5a0]/60 hover:bg-[#0f1d30] hover:text-[#00f5a0] transition shadow-sm"
            @click="emit('sendPrompt', prompt)"
          >
            {{ prompt }} →
          </button>
        </div>
      </div>

      <!-- Message Turns -->
      <template v-for="(msg, index) in messages" :key="msg.id || index">
        <!-- USER MESSAGE TURN -->
        <div v-if="msg.sender === 'user'" class="flex flex-col items-end gap-1.5 pl-8 md:pl-20">
          <div class="flex items-center gap-2 text-[11px] text-zinc-400">
            <span class="font-bold text-[#00f5a0]">{{ userName || 'You' }}</span>
            <span>·</span>
            <span>{{ msg.timestamp }}</span>
          </div>
          <div class="group relative max-w-full rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#0c221a] to-[#071610] border border-emerald-500/35 px-4 py-3 text-sm text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <div class="whitespace-pre-wrap leading-relaxed">{{ msg.text }}</div>
            <button
              class="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition text-zinc-500 hover:text-zinc-200 text-xs p-1"
              title="Sao chép tin nhắn"
              @click="copyContent(msg.text)"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- AGENT MESSAGE TURN -->
        <div v-else class="flex flex-col items-start gap-2 pr-4 md:pr-12">
          <!-- Agent Meta Header -->
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <!-- Provider Avatar Squircle -->
            <div class="grid h-5 w-5 place-items-center rounded-md bg-[#121c2e] border border-[#24334d] text-zinc-200 text-[10px] font-black">
              {{ (msg.provider || provider || 'AI').slice(0, 2).toUpperCase() }}
            </div>
            <span class="font-bold text-zinc-200">{{ formatProvider(msg.provider || provider) }}</span>
            <span v-if="msg.model || model" class="text-zinc-500">({{ msg.model || model }})</span>
            <span
              class="rounded-full border px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider"
              :class="roleBadgeClass(msg.role || role)"
            >
              {{ formatRole(msg.role || role) }}
            </span>
            <span>·</span>
            <span>{{ msg.timestamp }}</span>
          </div>

          <!-- Agent Message Container Card -->
          <div class="w-full rounded-2xl rounded-tl-sm bg-[#080e1a] border border-[#17253b] p-4 text-sm text-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.35)] space-y-3">
            <!-- Thought / Reasoning Accordion -->
            <div v-if="msg.thought" class="rounded-xl border border-indigo-950/60 bg-indigo-950/20 overflow-hidden">
              <button
                class="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-indigo-300 hover:bg-indigo-900/30 transition"
                @click="toggleThought(msg.id)"
              >
                <span class="flex items-center gap-2">
                  <svg class="h-3.5 w-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a8 8 0 0 0-8 8c0 3 2 5.5 4 7v3h8v-3c2-1.5 4-4 4-7a8 8 0 0 0-8-8z"/>
                  </svg>
                  Suy nghĩ & Phân tích của Agent
                </span>
                <span class="text-[10px] text-indigo-400">{{ expandedThoughts[msg.id] ? 'Thu gọn ▲' : 'Xem chi tiết ▼' }}</span>
              </button>
              <div v-if="expandedThoughts[msg.id]" class="border-t border-indigo-950/50 p-3 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono">
                {{ msg.thought }}
              </div>
            </div>

            <!-- Tool Calls Execution List -->
            <div v-if="msg.toolCalls && msg.toolCalls.length" class="space-y-1.5">
              <div
                v-for="(tool, tIndex) in msg.toolCalls"
                :key="tIndex"
                class="rounded-xl border border-[#1d2d46] bg-[#0c1626] overflow-hidden"
              >
                <button
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-300 hover:bg-[#122036] transition"
                  @click="toggleTool(`${msg.id}-${tIndex}`)"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="h-2 w-2 rounded-full shrink-0"
                      :class="tool.status === 'running' ? 'bg-amber-400 animate-ping' : tool.status === 'passed' ? 'bg-emerald-400' : 'bg-rose-400'"
                    />
                    <span class="font-mono font-bold text-zinc-200 truncate">{{ tool.name }}</span>
                    <span v-if="tool.command" class="text-[11px] text-zinc-500 font-mono truncate max-w-[200px]">{{ tool.command }}</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 text-[10px] text-zinc-400">
                    <span v-if="tool.durationMs">{{ tool.durationMs }}ms</span>
                    <span>{{ expandedTools[`${msg.id}-${tIndex}`] ? '▲' : '▼' }}</span>
                  </div>
                </button>
                <div
                  v-if="expandedTools[`${msg.id}-${tIndex}`] && tool.output"
                  class="border-t border-[#1a283e] bg-[#060b13] p-3 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto"
                >
                  {{ tool.output }}
                </div>
              </div>
            </div>

            <!-- Rendered Markdown Output -->
            <div
              v-if="msg.text"
              class="cc-markdown-body prose prose-invert max-w-none text-sm leading-relaxed"
              v-html="renderMarkdown(msg.text)"
            />

            <!-- Live Streaming Cursor -->
            <div v-if="msg.status === 'stream'" class="flex items-center gap-2 pt-1 text-xs text-[#00f5a0]">
              <span class="inline-block h-2 w-2 rounded-full bg-[#00f5a0] animate-pulse"></span>
              <span class="font-medium text-[11px]">Đang phản hồi…</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Live Thinking / Streaming Floating Card when running but no turn yet -->
      <div v-if="running && (!messages.length || messages[messages.length - 1]?.sender === 'user')" class="flex items-start gap-2">
        <div class="grid h-5 w-5 place-items-center rounded-md bg-[#121c2e] border border-[#24334d] text-zinc-200 text-[10px] font-black">
          {{ (provider || 'AI').slice(0, 2).toUpperCase() }}
        </div>
        <div class="rounded-2xl rounded-tl-sm bg-[#080e1a] border border-emerald-500/30 p-3.5 text-xs text-zinc-200 shadow-lg flex items-center justify-between gap-4 min-w-[280px]">
          <div class="flex items-center gap-2.5">
            <span class="h-2.5 w-2.5 rounded-full bg-[#00f5a0] animate-ping" />
            <span class="font-semibold text-zinc-100">Agent đang xử lý ngữ cảnh…</span>
          </div>
          <button
            class="rounded-lg border border-rose-600/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-900/50 transition"
            @click="emit('stop')"
          >
            Dừng
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-markdown-body :deep(pre) {
  background-color: #060b13;
  border: 1px solid #1a283e;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  overflow-x: auto;
}

.cc-markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #00f5d4;
}

.cc-markdown-body :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.cc-markdown-body :deep(ul),
.cc-markdown-body :deep(ol) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding-left: 1.25rem;
}

.cc-markdown-body :deep(blockquote) {
  border-left: 3px solid #00f5a0;
  padding-left: 0.875rem;
  color: #94a3b8;
  margin: 0.5rem 0;
}
</style>
