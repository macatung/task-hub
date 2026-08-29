<script setup lang="ts">
import { computed } from 'vue';
import Icons from './Icons.vue';

export type StatusType =
  | 'todo'
  | 'backlog'
  | 'in_progress'
  | 'running'
  | 'executing'
  | 'review'
  | 'testing'
  | 'handoff'
  | 'done'
  | 'completed'
  | 'approved'
  | 'failed'
  | 'error'
  | 'blocked'
  | 'overdue'
  | 'waiting_input'
  | 'idle'
  | 'busy'
  | 'offline'
  | 'urgent'
  | 'high'
  | 'medium'
  | 'low'
  | 'story'
  | 'task'
  | 'bug'
  | 'epic';

const props = withDefaults(
  defineProps<{
    status?: string | null;
    label?: string;
    variant?: 'status' | 'priority' | 'agent' | 'issueType';
    size?: 'xs' | 'sm' | 'md';
    showIcon?: boolean;
    pulse?: boolean;
    dark?: boolean;
  }>(),
  {
    status: 'todo',
    label: '',
    variant: 'status',
    size: 'sm',
    showIcon: true,
    pulse: false,
    dark: true,
  }
);

interface StatusConfig {
  label: string;
  icon: string;
  badgeClass: string;
  iconClass: string;
  dotColor?: string;
  isPulsing?: boolean;
}

const statusNormalized = computed(() => (props.status || '').toLowerCase().trim());

const displayConfig = computed<StatusConfig>(() => {
  const s = statusNormalized.value;

  // Priority Styles
  if (props.variant === 'priority' || s === 'urgent' || s === 'high' || s === 'medium' || s === 'low') {
    switch (s) {
      case 'urgent':
        return {
          label: props.label || 'Urgent',
          icon: 'Flame',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/60',
          iconClass: 'text-rose-600 dark:text-rose-400',
          dotColor: 'bg-rose-500',
          isPulsing: true,
        };
      case 'high':
        return {
          label: props.label || 'High',
          icon: 'ChevronsUp',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/60',
          iconClass: 'text-amber-600 dark:text-amber-400',
          dotColor: 'bg-amber-500',
        };
      case 'medium':
        return {
          label: props.label || 'Medium',
          icon: 'ChevronUp',
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-500/50',
          iconClass: 'text-sky-600 dark:text-cyan-400',
          dotColor: 'bg-sky-500 dark:bg-cyan-400',
        };
      case 'low':
      default:
        return {
          label: props.label || 'Low',
          icon: 'Minus',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-midnight-900/90 dark:text-slate-400 dark:border-midnight-800/80',
          iconClass: 'text-slate-500',
          dotColor: 'bg-slate-400 dark:bg-slate-600',
        };
    }
  }

  // Issue Type Styles
  if (props.variant === 'issueType' || s === 'story' || s === 'task' || s === 'bug' || s === 'epic') {
    switch (s) {
      case 'story':
        return {
          label: props.label || 'Story',
          icon: 'BookOpen',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/60',
          iconClass: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'bug':
        return {
          label: props.label || 'Bug',
          icon: 'Bug',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/60',
          iconClass: 'text-rose-600 dark:text-rose-400',
        };
      case 'epic':
        return {
          label: props.label || 'Epic',
          icon: 'Zap',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-500/60',
          iconClass: 'text-purple-600 dark:text-purple-400',
        };
      case 'task':
      default:
        return {
          label: props.label || 'Task',
          icon: 'CheckSquare',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-600/60',
          iconClass: 'text-blue-600 dark:text-cyan-400',
        };
    }
  }

  // Agent / Machine Runner Styles
  if (props.variant === 'agent' || s === 'idle' || s === 'busy' || s === 'offline') {
    switch (s) {
      case 'idle':
        return {
          label: props.label || 'Idle',
          icon: 'CheckCircle',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/60 shadow-[0_0_10px_rgba(0,245,160,0.2)]',
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          dotColor: 'bg-emerald-500 dark:bg-emerald-400',
          isPulsing: true,
        };
      case 'busy':
        return {
          label: props.label || 'Busy',
          icon: 'Cpu',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
          iconClass: 'text-amber-600 dark:text-amber-400 animate-spin',
          dotColor: 'bg-amber-500 dark:bg-amber-400',
          isPulsing: true,
        };
      case 'offline':
      default:
        return {
          label: props.label || 'Offline',
          icon: 'WifiOff',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-midnight-900/80 dark:text-slate-400 dark:border-midnight-800/60',
          iconClass: 'text-slate-400 dark:text-slate-500',
          dotColor: 'bg-slate-400 dark:bg-slate-600',
        };
    }
  }

  // Task Status Styles
  switch (s) {
    case 'in_progress':
    case 'running':
    case 'executing':
      return {
        label: props.label || 'In Progress',
        icon: 'Play',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        iconClass: 'text-amber-600 dark:text-amber-400',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
        isPulsing: true,
      };
    case 'review':
    case 'testing':
    case 'handoff':
      return {
        label: props.label || 'Review',
        icon: 'Eye',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-500/60 shadow-[0_0_12px_rgba(157,78,221,0.25)]',
        iconClass: 'text-purple-600 dark:text-purple-400',
        dotColor: 'bg-purple-500 dark:bg-purple-400',
        isPulsing: true,
      };
    case 'done':
    case 'completed':
    case 'approved':
      return {
        label: props.label || 'Done',
        icon: 'CheckCircle',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/60 shadow-[0_0_10px_rgba(0,245,160,0.2)]',
        iconClass: 'text-emerald-600 dark:text-emerald-400',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
      };
    case 'failed':
    case 'error':
    case 'blocked':
    case 'overdue':
      return {
        label: props.label || (s === 'overdue' ? 'Overdue' : 'Blocked'),
        icon: 'AlertCircle',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
        iconClass: 'text-rose-600 dark:text-rose-400',
        dotColor: 'bg-rose-500',
        isPulsing: true,
      };
    case 'waiting_input':
      return {
        label: props.label || 'Waiting Input',
        icon: 'HelpCircle',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-500/60 shadow-[0_0_10px_rgba(0,245,212,0.2)]',
        iconClass: 'text-cyan-600 dark:text-cyan-400',
        dotColor: 'bg-cyan-500 dark:bg-cyan-400',
        isPulsing: true,
      };
    case 'todo':
    case 'backlog':
    default:
      return {
        label: props.label || (s === 'backlog' ? 'Backlog' : 'To Do'),
        icon: 'Clock',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-midnight-900/90 dark:text-slate-300 dark:border-midnight-800/80 shadow-xs',
        iconClass: 'text-sky-600 dark:text-cyan-400',
        dotColor: 'bg-sky-500 dark:bg-cyan-400',
      };
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'px-1.5 py-0.5 text-[9px] gap-1';
    case 'md':
      return 'px-3 py-1 text-xs gap-1.5 font-bold';
    case 'sm':
    default:
      return 'px-2 py-0.5 text-[10px] gap-1.2 font-semibold';
  }
});

const iconSize = computed(() => {
  switch (props.size) {
    case 'xs':
      return 10;
    case 'md':
      return 14;
    case 'sm':
    default:
      return 12;
  }
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center justify-center shrink-0 rounded-lg border font-mono uppercase tracking-wider transition-all duration-150',
      displayConfig.badgeClass,
      sizeClasses,
    ]"
  >
    <!-- Pulsing Dot -->
    <span
      v-if="displayConfig.dotColor"
      :class="[
        'w-1.5 h-1.5 rounded-full shrink-0',
        displayConfig.dotColor,
        (props.pulse || displayConfig.isPulsing) ? 'animate-pulse' : '',
      ]"
    />

    <!-- Vector Icon -->
    <Icons
      v-if="showIcon"
      :name="displayConfig.icon"
      :size="iconSize"
      :class="[displayConfig.iconClass, 'shrink-0']"
    />

    <!-- Text Label -->
    <span class="truncate leading-none">{{ displayConfig.label }}</span>
  </span>
</template>
