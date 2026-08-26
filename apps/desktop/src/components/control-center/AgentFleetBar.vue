<script setup lang="ts">
import { computed } from "vue";

type FleetAgent = {
  sessionId: string;
  provider?: string;
  model?: string;
  cwd?: string;
  status?: string;
  kind?: string;
  updatedAt?: string;
};
const props = defineProps<{
  agents: FleetAgent[];
  activeSessionId?: string | null;
  sidebar?: boolean;
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
  label(agent.provider).slice(0, 2).toUpperCase();
const role = (agent: FleetAgent) =>
  agent.kind === "saved"
    ? "Saved session"
    : agent.status === "running"
      ? "Implementation agent"
      : "Local agent";
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
        class="min-w-60 rounded-xl border px-3 py-3 text-xs transition"
        :class="[
          sidebar ? 'min-w-0' : '',
          agent.sessionId === activeSessionId
            ? 'border-orange-400/70 bg-orange-950/20 shadow-[0_0_0_1px_rgba(251,146,60,.15)]'
            : 'border-white/10 bg-[#1a1a18] hover:border-white/20',
        ]"
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
            <p class="mt-0.5 text-[10px] text-zinc-500">{{ role(agent) }}</p>
          </div>
        </div>
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
