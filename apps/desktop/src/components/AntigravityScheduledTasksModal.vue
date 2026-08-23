<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'task-triggered', prompt: string): void;
}>();

interface ScheduledItem {
  id: string;
  type: 'timer' | 'cron';
  prompt: string;
  durationSeconds?: number;
  cronExpression?: string;
  maxIterations?: number;
  condition?: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

const scheduledTasks = ref<ScheduledItem[]>([]);
const isLoading = ref(false);

const newPrompt = ref('');
const scheduleType = ref<'timer' | 'cron'>('timer');
const durationSeconds = ref(300);
const cronExpression = ref('*/15 * * * *');
const condition = ref<'never' | 'any'>('never');

const loadScheduledTasks = async () => {
  isLoading.value = true;
  try {
    const list = await (window as any).desktopApi?.agent?.listScheduledTasks?.();
    if (Array.isArray(list)) scheduledTasks.value = list;
  } catch (err) {
    console.warn('Failed to load scheduled tasks:', err);
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async () => {
  if (!newPrompt.value.trim()) return;
  try {
    const payload = scheduleType.value === 'timer'
      ? { prompt: newPrompt.value.trim(), durationSeconds: durationSeconds.value, timerCondition: condition.value }
      : { prompt: newPrompt.value.trim(), cronExpression: cronExpression.value.trim(), timerCondition: condition.value };

    await (window as any).desktopApi?.agent?.createSchedule?.(payload);
    newPrompt.value = '';
    await loadScheduledTasks();
  } catch (err) {
    console.warn('Failed to create schedule:', err);
  }
};

const handleCancel = async (id: string) => {
  try {
    await (window as any).desktopApi?.agent?.cancelSchedule?.(id);
    await loadScheduledTasks();
  } catch (err) {
    console.warn('Failed to cancel schedule:', err);
  }
};

onMounted(() => {
  void loadScheduledTasks();
});
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none" @click.self="emit('close')">
    <div class="w-full max-w-3xl bg-[#1e1e1e] border border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[75vh]">
      <!-- Header -->
      <div class="h-12 px-4 bg-[#252526] border-b border-[#333333] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <i class="codicon codicon-history text-amber-400 text-lg" />
          <h2 class="text-sm font-bold text-zinc-100 uppercase tracking-wide">Antigravity 2.0 · Scheduled Tasks & Background Timers</h2>
        </div>

        <button
          class="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-colors text-xs cursor-pointer"
          @click="emit('close')"
        >
          ✕ Close
        </button>
      </div>

      <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <!-- Create Schedule Form -->
        <div class="w-full md:w-80 p-4 border-r border-[#2d2d2d] bg-[#181818] flex flex-col gap-3 shrink-0 overflow-y-auto">
          <h3 class="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-1.5">
            <i class="codicon codicon-add" />
            <span>Create New Schedule</span>
          </h3>

          <div class="flex items-center bg-[#252526] p-1 rounded-lg border border-[#3e3e42] gap-1">
            <button
              class="flex-1 py-1 text-xs rounded font-semibold transition-colors cursor-pointer"
              :class="scheduleType === 'timer' ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:text-white'"
              @click="scheduleType = 'timer'"
            >
              ⏱ Timer (One-shot)
            </button>
            <button
              class="flex-1 py-1 text-xs rounded font-semibold transition-colors cursor-pointer"
              :class="scheduleType === 'cron' ? 'bg-[#007acc] text-white' : 'text-zinc-400 hover:text-white'"
              @click="scheduleType = 'cron'"
            >
              🔄 Cron (Recurring)
            </button>
          </div>

          <div>
            <label class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">Agent Action / Prompt</label>
            <textarea
              v-model="newPrompt"
              rows="3"
              placeholder="E.g., Verify build and execute test suite..."
              class="w-full text-xs bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-2 text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#007acc] resize-none"
            />
          </div>

          <div v-if="scheduleType === 'timer'">
            <label class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">Wait duration (seconds)</label>
            <input
              v-model.number="durationSeconds"
              type="number"
              min="10"
              step="30"
              class="w-full text-xs bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-2 text-zinc-100 outline-none focus:border-[#007acc]"
            />
          </div>

          <div v-else>
            <label class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">Cron Expression (5 fields)</label>
            <input
              v-model="cronExpression"
              type="text"
              placeholder="*/15 * * * *"
              class="w-full text-xs font-mono bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-2 text-zinc-100 outline-none focus:border-[#007acc]"
            />
            <p class="text-[10px] text-zinc-500 mt-1">E.g., `*/5 * * * *` (every 5m), `0 * * * *` (hourly)</p>
          </div>

          <button
            class="w-full mt-2 py-2 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            @click="handleCreate"
          >
            Create Schedule
          </button>
        </div>

        <!-- Scheduled Tasks List -->
        <div class="flex-1 p-4 overflow-y-auto bg-[#1e1e1e] space-y-3">
          <div class="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
            <h3 class="text-xs font-bold text-zinc-300">Active Schedules ({{ scheduledTasks.length }})</h3>
            <button
              class="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#333333] cursor-pointer"
              @click="loadScheduledTasks"
            >
              <i class="codicon codicon-refresh" /> Refresh
            </button>
          </div>

          <div v-if="scheduledTasks.length === 0" class="text-xs text-zinc-500 p-8 text-center bg-[#252526] rounded-xl border border-[#333333]">
            <i class="codicon codicon-history text-2xl text-zinc-600 mb-2 block" />
            No scheduled tasks currently active.
          </div>

          <div
            v-for="task in scheduledTasks"
            :key="task.id"
            class="p-3 rounded-xl bg-[#252526] border border-[#3e3e42] flex items-center justify-between gap-3 group"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase"
                  :class="task.type === 'cron' ? 'bg-amber-950 text-amber-300' : 'bg-cyan-950 text-cyan-300'"
                >
                  {{ task.type === 'cron' ? `CRON: ${task.cronExpression}` : `TIMER: ${task.durationSeconds}s` }}
                </span>
                <span class="text-[10px] text-zinc-500 font-mono">{{ new Date(task.createdAt).toLocaleTimeString() }}</span>
              </div>
              <p class="text-xs text-zinc-200 font-medium truncate">{{ task.prompt }}</p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                class="px-2 py-1 rounded bg-[#333333] hover:bg-rose-900 text-zinc-300 hover:text-white text-xs cursor-pointer transition-colors"
                title="Cancel this schedule"
                @click="handleCancel(task.id)"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
