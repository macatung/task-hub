<script setup lang="ts">
import { computed } from "vue";

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

const props = defineProps<{
  agents: FleetAgent[];
  activeSessionId?: string | null;
  sidebar?: boolean;
}>();

const emit = defineEmits<{
  select: [sessionId: string];
  stop?: [sessionId: string];
  reconnect?: [sessionId: string];
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
</script>

<template>
  <section
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
