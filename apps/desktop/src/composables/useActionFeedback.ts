import { reactive, ref, computed } from 'vue';
import { sfx } from '../audio/soundEffects';

export interface ActionFeedbackItem {
  id: string;
  type: 'loading' | 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  progress?: number | null;
  actor?: string;
  timestamp: string;
  persistent?: boolean;
  link?: string;
}

export interface ActivityLogEntry {
  id: string;
  label: string;
  detail: string;
  tone: 'ok' | 'passed' | 'failed' | 'error' | 'warning' | 'active' | 'tool' | 'muted';
  time: string;
  actor?: {
    type?: string;
    name?: string;
    role?: string;
    details?: string;
  };
  link?: string;
}

const activeFeedbacks = reactive<ActionFeedbackItem[]>([]);
const activityTimeline = ref<ActivityLogEntry[]>([]);
const dismissTimers = new Map<string, number>();

export function useActionFeedback() {
  const notify = (opts: {
    id?: string;
    type?: 'loading' | 'success' | 'info' | 'warning' | 'error';
    title: string;
    message?: string;
    durationMs?: number;
    persistent?: boolean;
    sound?: boolean;
    link?: string;
  }): string => {
    const id = opts.id || `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const type = opts.type || 'info';
    const timestamp = new Date().toLocaleTimeString();

    // Play subtle sound
    if (opts.sound !== false) {
      if (type === 'success') sfx.playSuccess();
      else if (type === 'error' || type === 'warning') sfx.playDing();
      else sfx.playClick();
    }

    // Check existing
    const existingIndex = activeFeedbacks.findIndex(f => f.id === id);
    const item: ActionFeedbackItem = {
      id,
      type,
      title: opts.title,
      message: opts.message,
      actor: 'User',
      timestamp,
      persistent: opts.persistent ?? (type === 'loading'),
      link: opts.link,
    };

    if (existingIndex >= 0) {
      activeFeedbacks[existingIndex] = item;
    } else {
      activeFeedbacks.unshift(item);
      // Keep max 5 active toasts
      if (activeFeedbacks.length > 5) {
        activeFeedbacks.pop();
      }
    }

    // Log to audit activity timeline
    logTimeline({
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: opts.title,
      detail: opts.message || opts.title,
      tone: type === 'success' ? 'ok' : type === 'warning' ? 'warning' : type === 'error' ? 'error' : type === 'loading' ? 'active' : 'tool',
      time: timestamp,
      actor: {
        type: 'user',
        name: 'Developer (Desktop User)',
        role: 'Local Operator',
      },
      link: opts.link,
    });

    // Auto dismiss non-persistent feedbacks
    if (dismissTimers.has(id)) {
      globalThis.clearTimeout(dismissTimers.get(id));
      dismissTimers.delete(id);
    }

    if (!item.persistent) {
      const timeout = opts.durationMs || (type === 'error' ? 5000 : 3200);
      const timer = Number(globalThis.setTimeout(() => {
        dismiss(id);
      }, timeout));
      dismissTimers.set(id, timer);
    }

    return id;
  };

  const startOperation = (id: string, title: string, message?: string): string => {
    return notify({
      id,
      type: 'loading',
      title,
      message,
      persistent: true,
    });
  };

  const updateOperation = (id: string, message: string, progress?: number): void => {
    const item = activeFeedbacks.find(f => f.id === id);
    if (item) {
      item.message = message;
      if (typeof progress === 'number') item.progress = progress;
    }
  };

  const finishOperation = (
    id: string,
    outcome: 'success' | 'warning' | 'error' | 'info',
    titleOrMessage: string,
    detailMessage?: string,
    link?: string
  ): void => {
    const title = detailMessage ? titleOrMessage : (outcome === 'success' ? '✓ Đã hoàn tất' : 'Thông báo');
    const message = detailMessage || titleOrMessage;

    notify({
      id,
      type: outcome,
      title,
      message,
      persistent: false,
      durationMs: 3500,
      link,
    });
  };

  const dismiss = (id: string) => {
    const idx = activeFeedbacks.findIndex(f => f.id === id);
    if (idx >= 0) {
      activeFeedbacks.splice(idx, 1);
    }
    if (dismissTimers.has(id)) {
      globalThis.clearTimeout(dismissTimers.get(id));
      dismissTimers.delete(id);
    }
  };

  const logTimeline = (entry: ActivityLogEntry) => {
    activityTimeline.value.unshift(entry);
    if (activityTimeline.value.length > 200) {
      activityTimeline.value.pop();
    }
  };

  const clearTimeline = () => {
    activityTimeline.value = [];
  };

  return {
    activeFeedbacks: computed(() => activeFeedbacks),
    activityTimeline: computed(() => activityTimeline.value),
    rawActivityTimeline: activityTimeline,
    notify,
    startOperation,
    updateOperation,
    finishOperation,
    dismiss,
    logTimeline,
    clearTimeline,
  };
}
