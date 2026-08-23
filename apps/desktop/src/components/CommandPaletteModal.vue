<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { sfx } from '../audio/soundEffects';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  category: string;
  keywords: string[];
  action: () => void;
}

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create-task', title: string): void;
  (e: 'start-pomodoro', mode?: string): void;
  (e: 'open-duck'): void;
  (e: 'open-notes'): void;
  (e: 'open-dispatch'): void;
  (e: 'open-review'): void;
  (e: 'check-updates'): void;
  (e: 'install-update'): void;
}>();

const searchInput = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const selectedIndex = ref(0);

const allCommands: CommandItem[] = [
  {
    id: 'pomodoro-25',
    title: 'Start 25-minute Pomodoro',
    subtitle: 'Deep distraction-free focus session',
    icon: '🍅',
    category: 'Productivity',
    keywords: ['pomodoro', 'pom', 'focus', 'timer', 'countdown', '25'],
    action: () => emit('start-pomodoro', 'focus25'),
  },
  {
    id: 'pomodoro-50',
    title: 'Start 50-minute Deep Work',
    subtitle: 'Complex problem-solving focus',
    icon: '⚡',
    category: 'Productivity',
    keywords: ['deep work', '50', 'pomodoro', 'code', 'focus', 'productivity'],
    action: () => emit('start-pomodoro', 'deep50'),
  },
  {
    id: 'open-tasks',
    title: "View today's work items",
    subtitle: 'Direct sync with task-hub.macatung.dev',
    icon: '📋',
    category: 'Productivity',
    keywords: ['task', 'tasks', 'todo', 'work item', 'dispatch', 'hub'],
    action: () => emit('open-dispatch'),
  },
  {
    id: 'open-duck',
    title: 'Debug with Rubber Duck',
    subtitle: 'Explain issue to uncover solutions',
    icon: '🦆',
    category: 'Dev Tools',
    keywords: ['duck', 'rubber duck', 'debug', 'bug'],
    action: () => emit('open-duck'),
  },
  {
    id: 'open-notes',
    title: 'Top Tasks & Scratchpad',
    subtitle: 'Capture quick notes and snippets',
    icon: '📝',
    category: 'Dev Tools',
    keywords: ['notes', 'scratchpad', 'memo', 'quick notes', 'todos'],
    action: () => emit('open-notes'),
  },
  {
    id: 'open-review',
    title: 'Evening Daily Review',
    subtitle: 'Review accomplishments and next priorities',
    icon: '🌙',
    category: 'Productivity',
    keywords: ['review', 'summary', 'daily review', 'evening', 'productivity'],
    action: () => emit('open-review'),
  },
  {
    id: 'open-web',
    title: 'Open Task Hub on Web',
    subtitle: 'Manage full Kanban board (task-hub.macatung.dev)',
    icon: '🌐',
    category: 'Links',
    keywords: ['web', 'kanban', 'browser', 'macatung', 'link'],
    action: () => {
      const url = `${(import.meta as any).env?.VITE_TASK_HUB_URL || 'https://task-hub.macatung.dev'}/tasks`;
      if ((window as any).desktopApi?.openExternal) (window as any).desktopApi.openExternal(url);
      else window.open(url, '_blank');
    },
  },
  {
    id: 'check-updates',
    title: 'Check for Updates',
    subtitle: 'Scan for latest Desktop release',
    icon: '🔄',
    category: 'System',
    keywords: ['update', 'updates', 'version', 'check updates'],
    action: () => emit('check-updates'),
  },
  {
    id: 'install-update',
    title: 'Restart to Update',
    subtitle: 'Install downloaded update package',
    icon: '⬆️',
    category: 'System',
    keywords: ['install', 'restart', 'update', 'upgrade'],
    action: () => emit('install-update'),
  },
];

const filteredCommands = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allCommands;

  // If query starts with 'task ' or 't ', suggest quick task creation as first item
  const results: CommandItem[] = [];

  if (q.startsWith('task ') || q.startsWith('task:') || q.startsWith('t ') || q.startsWith('todo ')) {
    const taskName = q.replace(/^(task:|task|t|todo)\s*/i, '').trim();
    if (taskName) {
      results.push({
        id: 'create-dynamic-task',
        title: `Create new task: "${taskName}"`,
        subtitle: 'Press Enter to create in Task Hub',
        icon: '✨',
        category: 'Quick Action',
        keywords: ['task'],
        action: () => emit('create-task', taskName),
      });
    }
  }

  const matches = allCommands.filter(cmd => {
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.keywords.some(k => k.includes(q))
    );
  });

  return [...results, ...matches];
});

const executeCommand = (cmd: CommandItem) => {
  sfx.playSuccess();
  cmd.action();
  emit('close');
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length;
    sfx.playClick();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length;
    sfx.playClick();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredCommands.value[selectedIndex.value]) {
      executeCommand(filteredCommands.value[selectedIndex.value]);
    } else if (searchQuery.value.trim()) {
      // Fallback: create task directly
      emit('create-task', searchQuery.value.trim());
      sfx.playSuccess();
      emit('close');
    }
  } else if (e.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus();
  });
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="w-80 sm:w-96 rounded-2xl bg-slate-950/98 text-slate-100 border border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl no-drag select-none text-left font-sans animate-fadeIn overflow-hidden flex flex-col">
    <!-- Top Search Input Bar (Spotlight Raycast Style) -->
    <div class="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/60">
      <span class="text-slate-400 text-xs font-mono">⌘</span>
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        placeholder="Type command or 'task <name>'... (Esc to close)"
        class="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 outline-none font-sans"
      />
      <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
        Esc
      </span>
    </div>

    <!-- Commands List -->
    <div class="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
      <div
        v-for="(cmd, idx) in filteredCommands"
        :key="cmd.id"
        @click="executeCommand(cmd)"
        @mouseenter="selectedIndex = idx"
        :class="[
          'px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer text-xs',
          selectedIndex === idx
            ? 'bg-slate-800 text-white shadow-sm font-semibold'
            : 'text-slate-300 hover:bg-slate-900'
        ]"
      >
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="text-base shrink-0">{{ cmd.icon }}</span>
          <div class="truncate">
            <div class="truncate text-xs leading-snug">{{ cmd.title }}</div>
            <div v-if="cmd.subtitle" class="text-[10px] text-slate-400 font-normal truncate">
              {{ cmd.subtitle }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[9px] font-mono text-slate-500 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
            {{ cmd.category }}
          </span>
          <span v-if="selectedIndex === idx" class="text-emerald-400 text-[10px] font-mono font-bold">⏎</span>
        </div>
      </div>

      <div v-if="filteredCommands.length === 0" class="text-center py-6 text-xs text-slate-500 italic">
        No matching command found. Press Enter to create task with this name! ✨
      </div>
    </div>

    <!-- Footer Shortcuts Tip -->
    <div class="p-2 px-3 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[10px] text-slate-500 font-mono">
      <div class="flex items-center gap-2">
        <span>↑↓ Navigate</span>
        <span>•</span>
        <span>⏎ Execute</span>
      </div>
      <span class="text-emerald-400">Raycast Mode</span>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateX(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
