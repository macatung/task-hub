<script setup lang="ts">
type Message = {
  id: number;
  subject: string;
  body: string;
  status: string;
  created_at?: string;
  sender?: { name?: string; role?: string } | null;
};
defineProps<{ messages: Message[]; loading?: boolean; compact?: boolean }>();
const emit = defineEmits<{
  acknowledge: [id: number, status: "accepted" | "declined" | "done"];
  refresh: [];
}>();
</script>

<template>
  <aside
    class="border-b border-white/10 bg-[#0d0d0d] px-4 py-3"
    :class="{ 'max-h-40 overflow-y-auto': compact }"
  >
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-semibold text-zinc-200">
        Agent inbox
        <span
          v-if="messages.length"
          class="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200"
          >{{ messages.length }}</span
        >
      </div>
      <button
        class="text-[11px] text-zinc-400 hover:text-white"
        :disabled="loading"
        @click="emit('refresh')"
      >
        Refresh
      </button>
    </div>
    <div
      v-if="messages.length"
      class="flex gap-2 overflow-x-auto"
      :class="{ 'flex-col overflow-visible': compact }"
    >
      <article
        v-for="message in messages"
        :key="message.id"
        class="min-w-64 max-w-80 rounded-md border border-white/10 bg-black/20 p-3 text-xs"
        :class="{ 'min-w-0 max-w-none': compact }"
      >
        <div class="flex justify-between gap-2">
          <b class="truncate text-zinc-100">{{ message.subject }}</b
          ><span class="capitalize text-zinc-500">{{ message.status }}</span>
        </div>
        <p class="mt-1 text-[11px] text-sky-300">
          {{ message.sender?.name || "Agent"
          }}<span v-if="message.sender?.role">
            · {{ message.sender.role }}</span
          >
        </p>
        <p class="mt-2 line-clamp-3 whitespace-pre-wrap text-zinc-400">
          {{ message.body }}
        </p>
        <div
          v-if="!['accepted', 'declined', 'done'].includes(message.status)"
          class="mt-3 flex gap-2"
        >
          <button
            class="text-emerald-300 hover:text-emerald-100"
            @click="emit('acknowledge', message.id, 'accepted')"
          >
            Accept</button
          ><button
            class="text-rose-300 hover:text-rose-100"
            @click="emit('acknowledge', message.id, 'declined')"
          >
            Decline</button
          ><button
            class="text-sky-300 hover:text-sky-100"
            @click="emit('acknowledge', message.id, 'done')"
          >
            Done
          </button>
        </div>
      </article>
    </div>
    <p v-else class="text-xs text-zinc-500">
      No agent messages. Handoffs and blockers will appear here.
    </p>
  </aside>
</template>
