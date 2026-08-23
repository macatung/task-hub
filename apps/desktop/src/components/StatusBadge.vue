<script setup lang="ts">
import { computed } from 'vue';
import TailwindIcon from './TailwindIcon.vue';

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
  }>(),
  {
    status: 'todo',
    label: '',
    variant: 'status',
    size: 'sm',
    showIcon: true,
    pulse: false,
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
          icon: 'flame',
          badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-600/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
          iconClass: 'text-rose-400',
          dotColor: 'bg-rose-500',
          isPulsing: true,
        };
      case 'high':
        return {
          label: props.label || 'High',
          icon: 'chevrons-up',
          badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
          iconClass: 'text-amber-400',
          dotColor: 'bg-amber-500',
        };
      case 'medium':
        return {
          label: props.label || 'Medium',
          icon: 'chevron-up',
          badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-600/60',
          iconClass: 'text-sky-400',
          dotColor: 'bg-sky-500',
        };
      case 'low':
      default:
        return {
          label: props.label || 'Low',
          icon: 'minus',
          badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700/60',
          iconClass: 'text-slate-500',
          dotColor: 'bg-slate-500',
        };
    }
  }

  // Issue Type Styles
  if (props.variant === 'issueType' || s === 'story' || s === 'task' || s === 'bug' || s === 'epic') {
    switch (s) {
      case 'story':
        return {
          label: props.label || 'Story',
          icon: 'book-open',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 shadow-[0_0_8px_rgba(16,185,129,0.15)]',
          iconClass: 'text-emerald-400',
        };
      case 'bug':
        return {
          label: props.label || 'Bug',
          icon: 'bug',
          badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/80 shadow-[0_0_8px_rgba(244,63,94,0.2)]',
          iconClass: 'text-rose-400',
        };
      case 'epic':
        return {
          label: props.label || 'Epic',
          icon: 'crown',
          badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-700/80 shadow-[0_0_8px_rgba(168,85,247,0.2)]',
          iconClass: 'text-purple-400',
        };
      case 'task':
      default:
        return {
          label: props.label || 'Task',
          icon: 'check-square',
          badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-700/80',
          iconClass: 'text-blue-400',
        };
    }
  }

  // Agent / Machine Runner Styles
  if (props.variant === 'agent' || s === 'idle' || s === 'busy' || s === 'offline') {
    switch (s) {
      case 'idle':
        return {
          label: props.label || 'Idle',
          icon: 'check-circle',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
          iconClass: 'text-emerald-400',
          dotColor: 'bg-emerald-400',
          isPulsing: true,
        };
      case 'busy':
        return {
          label: props.label || 'Busy',
          icon: 'cpu',
          badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/80 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
          iconClass: 'text-amber-400 animate-spin',
          dotColor: 'bg-amber-400',
          isPulsing: true,
        };
      case 'offline':
      default:
        return {
          label: props.label || 'Offline',
          icon: 'wifi-off',
          badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700/60',
          iconClass: 'text-slate-500',
          dotColor: 'bg-slate-500',
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
        icon: 'play',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        iconClass: 'text-amber-400',
        dotColor: 'bg-amber-400',
        isPulsing: true,
      };
    case 'review':
    case 'testing':
    case 'handoff':
      return {
        label: props.label || 'Review',
        icon: 'eye',
        badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-500/70 shadow-[0_0_12px_rgba(168,85,247,0.25)]',
        iconClass: 'text-purple-400',
        dotColor: 'bg-purple-400',
        isPulsing: true,
      };
    case 'done':
    case 'completed':
    case 'approved':
      return {
        label: props.label || 'Done',
        icon: 'check-circle',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
        iconClass: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
      };
    case 'failed':
    case 'error':
    case 'blocked':
    case 'overdue':
      return {
        label: props.label || (s === 'overdue' ? 'Overdue' : 'Blocked'),
        icon: 'alert-circle',
        badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-500/70 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
        iconClass: 'text-rose-400',
        dotColor: 'bg-rose-500',
        isPulsing: true,
      };
    case 'waiting_input':
      return {
        label: props.label || 'Waiting Input',
        icon: 'help-circle',
        badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/70 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
        iconClass: 'text-cyan-400',
        dotColor: 'bg-cyan-400',
        isPulsing: true,
      };
    case 'todo':
    case 'backlog':
    default:
      return {
        label: props.label || (s === 'backlog' ? 'Backlog' : 'To Do'),
        icon: 'clock',
        badgeClass: 'bg-slate-900/90 text-slate-300 border-slate-700/70 shadow-xs',
        iconClass: 'text-sky-400',
        dotColor: 'bg-sky-400',
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
      'inline-flex items-center rounded-lg border font-mono uppercase tracking-wider transition-all duration-150',
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
    <TailwindIcon
      v-if="showIcon"
      :name="displayConfig.icon"
      :size="iconSize"
      :class="`${displayConfig.iconClass || ''} shrink-0`"
    />

    <!-- Text Label -->
    <span class="truncate">{{ displayConfig.label }}</span>
  </span>
</template>
