<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";

export type FleetAgentRole =
  | "supervisor"
  | "worker"
  | "reviewer"
  | "implementation"
  | "tool"
  | string;

export interface FleetAgent {
  sessionId: string;
  provider?: string;
  model?: string;
  cwd?: string;
  status?:
    | "running"
    | "waiting_input"
    | "blocked"
    | "completed"
    | "failed"
    | "saved"
    | string;
  kind?: string;
  role?: "supervisor" | "worker" | "reviewer" | string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  stepInfo?: string;
  updatedAt?: string;
}

const props = withDefaults(
  defineProps<{
    agents: FleetAgent[];
    activeSessionId?: string | null;
    sidebar?: boolean;
    drawer?: boolean;
    open?: boolean;
  }>(),
  {
    sidebar: false,
    drawer: true,
    open: false,
  }
);

const emit = defineEmits<{
  select: [sessionId: string];
  close: [];
  stop: [sessionId: string];
  reconnect: [sessionId: string];
}>();

const active = computed(
  () => props.agents.filter((agent) => agent.status === "running").length,
);

const waiting = computed(
  () =>
    props.agents.filter((agent) =>
      ["waiting_input", "blocked"].includes(agent.status || ""),
    ).length,
);

const label = (provider?: string) =>
  provider === "claude_code"
    ? "Claude"
    : provider === "antigravity"
      ? "Antigravity"
      : provider === "cao"
        ? "CAO"
        : "Codex";

const tone = (status?: string) =>
  status === "running"
    ? "bg-sky-400"
    : ["waiting_input", "blocked"].includes(status || "")
      ? "bg-amber-400"
      : status === "failed"
        ? "bg-rose-400"
        : "bg-emerald-400";

const initials = (agent: FleetAgent) =>
  agent.role === "supervisor"
    ? "SV"
    : agent.role === "reviewer"
      ? "RV"
      : agent.role === "worker"
        ? "WK"
        : label(agent.provider).slice(0, 2).toUpperCase();

const role = (agent: FleetAgent) => {
  if (agent.role === "supervisor") return "Supervisor";
  if (agent.role === "worker") return "Worker";
  if (agent.role === "reviewer") return "Reviewer";
  if (agent.role) return agent.role;
  return agent.kind === "saved"
    ? "Saved session"
    : agent.status === "running"
      ? "Implementation agent"
      : "Local agent";
};

const roleBadgeClass = (agent: FleetAgent) => {
  if (agent.role === "supervisor")
    return "border-purple-600/40 bg-purple-950/50 text-purple-300";
  if (agent.role === "worker")
    return "border-sky-600/40 bg-sky-950/50 text-sky-300";
  if (agent.role === "reviewer")
    return "border-amber-600/40 bg-amber-950/50 text-amber-300";
  return "border-zinc-700/50 bg-zinc-800/40 text-zinc-400";
};

const formatTokens = (count?: number): string => {
  if (count === undefined || count === null || isNaN(count)) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.open) {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});

const handleCardClick = (sessionId: string) => {
  emit("select", sessionId);
  if (props.drawer) {
    emit("close");
  }
};
</script>

<template>
  <!-- DRAWER MODE (Modal slide-over from right) -->
  <div v-if="drawer && open" class="fixed inset-0 z-50 flex justify-end">
    <!-- Backdrop Overlay -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Drawer Panel Content -->
    <aside
      class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#1a273b] bg-[#070b14] p-5 text-zinc-100 shadow-2xl animate-in slide-in-from-right duration-200"
    >
      <!-- Drawer Header -->
      <div class="flex items-center justify-between border-b border-[#162235] pb-4">
        <div class="flex items-center gap-2.5">
          <div class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-[#00f5a0]/20 to-[#00f5d4]/10 border border-[#00f5a0]/30 text-[#00f5a0]">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div>
            <h2 class="text-sm font-bold text-white font-['Space_Grotesk'] tracking-wide">
              AGENT ROOM
            </h2>
            <p class="text-[11px] text-zinc-400">
              {{ active }} đang chạy · {{ waiting }} cần phản hồi · {{ agents.length }} phiên
            </p>
          </div>
        </div>

        <button
          class="grid h-7 w-7 place-items-center rounded-lg border border-[#1d2d46] bg-[#0c1626] text-zinc-400 hover:text-white hover:border-zinc-500 transition"
          title="Đóng (Escape)"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Agent Cards List -->
      <div class="flex-1 space-y-3 overflow-y-auto pt-4 pr-1">
        <article
          v-for="agent in agents"
          :key="agent.sessionId"
          class="cursor-pointer rounded-xl border p-3.5 text-xs transition space-y-2.5 shadow-sm"
          :class="[
            agent.sessionId === activeSessionId
              ? 'border-[#00f5a0]/70 bg-[#0c1e18] shadow-[0_0_14px_rgba(0,245,160,0.15)]'
              : 'border-[#17253b] bg-[#0a101d] hover:border-[#243a5a] hover:bg-[#0f172a]',
          ]"
          @click="handleCardClick(agent.sessionId)"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-700 text-[11px] font-bold text-black shadow"
            >
              {{ initials(agent) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-bold text-zinc-100">{{ label(agent.provider) }}</span>
                <span class="inline-flex items-center gap-1.5 text-[10px] capitalize text-zinc-400">
                  <i class="h-2 w-2 rounded-full" :class="tone(agent.status)" />
                  {{ agent.status || "saved" }}
                </span>
              </div>
              <div class="mt-1 flex items-center justify-between gap-2">
                <span
                  class="rounded-md border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider"
                  :class="roleBadgeClass(agent)"
                >
                  {{ role(agent) }}
                </span>
                <span
                  v-if="agent.tokenUsage && agent.tokenUsage.totalTokens > 0"
                  class="font-mono text-[10px] text-zinc-400"
                  :title="`Prompt: ${formatTokens(agent.tokenUsage.promptTokens)} · Completion: ${formatTokens(agent.tokenUsage.completionTokens)} · Total: ${formatTokens(agent.tokenUsage.totalTokens)}`"
                >
                  {{ formatTokens(agent.tokenUsage.totalTokens) }} tokens
                </span>
              </div>
            </div>
          </div>

          <p
            v-if="agent.stepInfo"
            class="truncate rounded-md bg-black/30 px-2 py-1 text-[11px] text-zinc-300 font-mono"
            :title="agent.stepInfo"
          >
            {{ agent.stepInfo }}
          </p>

          <p
            class="truncate border-t border-[#162235] pt-2 font-mono text-[10px] text-zinc-500"
            :title="agent.cwd"
          >
            {{ agent.cwd || agent.sessionId }}
          </p>
        </article>

        <div
          v-if="!agents.length"
          class="rounded-xl border border-dashed border-[#1e2f47] bg-[#0a101d] p-8 text-center text-xs text-zinc-500"
        >
          Chưa có phiên agent nào được lưu. Khởi chạy một agent để hiển thị trong phòng trực chiến này.
        </div>
      </div>
    </aside>
  </div>

  <!-- STATIC INLINE BAR MODE (Fallback if drawer is disabled) -->
  <section
    v-else-if="!drawer"
    class="border-b border-white/10 bg-[#11110f] px-4 py-3"
    :class="{ 'max-h-64 overflow-y-auto': sidebar }"
  >
    <div
      class="mb-3 flex items-center justify-between gap-3 text-[11px] text-zinc-400"
    >
      <div>
        <span class="font-semibold uppercase tracking-[0.18em] text-zinc-200"
          >Agent room</span
        ><span class="ml-2 text-zinc-600">Local fleet</span>
      </div>
      <span
        >{{ active }} active · {{ waiting }} attention ·
        {{ agents.length }} sessions</span
      >
    </div>
    <div
      v-if="agents.length"
      class="flex gap-2 overflow-x-auto pb-0.5"
      :class="{ 'flex-col overflow-visible': sidebar }"
    >
      <article
        v-for="agent in agents"
        :key="agent.sessionId"
        class="min-w-64 cursor-pointer rounded-xl border px-3 py-3 text-xs transition"
        :class="[
          sidebar ? 'min-w-0' : '',
          agent.sessionId === activeSessionId
            ? 'border-orange-400/70 bg-orange-950/20 shadow-[0_0_0_1px_rgba(251,146,60,.15)]'
            : 'border-white/10 bg-[#1a1a18] hover:border-white/20',
        ]"
        @click="$emit('select', agent.sessionId)"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-300 to-amber-700 text-[10px] font-bold text-[#20160c]"
            >{{ initials(agent) }}</span
          >
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-semibold text-zinc-100">{{
                label(agent.provider)
              }}</span
              ><span
                class="inline-flex items-center gap-1 text-[10px] capitalize text-zinc-400"
                ><i
                  class="h-1.5 w-1.5 rounded-full"
                  :class="tone(agent.status)"
                />{{ agent.status || "saved" }}</span
              >
            </div>
            <div class="mt-1 flex items-center justify-between gap-2">
              <span
                class="rounded border px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider"
                :class="roleBadgeClass(agent)"
              >
                {{ role(agent) }}
              </span>
              <span
                v-if="agent.tokenUsage && agent.tokenUsage.totalTokens > 0"
                class="font-mono text-[10px] text-zinc-400"
                :title="`Prompt: ${formatTokens(agent.tokenUsage.promptTokens)} · Completion: ${formatTokens(agent.tokenUsage.completionTokens)} · Total: ${formatTokens(agent.tokenUsage.totalTokens)}`"
              >
                {{ formatTokens(agent.tokenUsage.totalTokens) }} tokens
              </span>
            </div>
          </div>
        </div>
        <p
          v-if="agent.stepInfo"
          class="mt-2 truncate text-[10px] text-zinc-400"
          :title="agent.stepInfo"
        >
          {{ agent.stepInfo }}
        </p>
        <p
          class="mt-2 truncate border-t border-white/5 pt-2 font-mono text-[10px] text-zinc-500"
          :title="agent.cwd"
        >
          {{ agent.cwd || agent.sessionId }}
        </p>
      </article>
    </div>
    <p
      v-else
      class="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-xs text-zinc-500"
    >
      No persistent agents yet. Launch an agent to add its session to this room.
    </p>
  </section>
</template>
