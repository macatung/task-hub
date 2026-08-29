import { ref, computed } from 'vue';

export interface ToolCallItem {
  name: string;
  command?: string;
  args?: any;
  status: 'running' | 'passed' | 'failed';
  output?: string;
  durationMs?: number;
}

export type ConversationRole =
  | 'architect'
  | 'implementer'
  | 'tester'
  | 'test_engineer'
  | 'auditor'
  | 'operator'
  | 'supervisor'
  | 'worker'
  | 'reviewer';

export interface ThreadMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  role?: ConversationRole;
  provider?: string;
  model?: string;
  timestamp: string;
  text: string;
  thought?: string;
  toolCalls?: ToolCallItem[];
  status?: 'sending' | 'stream' | 'completed' | 'failed';
}

const STORAGE_PREFIX = 'task_hub_conversation_thread:';

const sharedMessages = ref<ThreadMessage[]>([]);
const sharedCurrentTaskId = ref<string | number | null>(null);

export function useConversationThread() {
  const messages = sharedMessages;
  const currentTaskId = sharedCurrentTaskId;

  const getStorage = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch {}
    return null;
  };

  const storageKey = (taskId: string | number) => `${STORAGE_PREFIX}${taskId}`;

  const loadThread = (taskId: string | number): ThreadMessage[] => {
    currentTaskId.value = taskId;
    try {
      const storage = getStorage();
      const raw = storage?.getItem(storageKey(taskId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          messages.value = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[ConversationThread] Error loading stored thread:', e);
    }
    messages.value = [];
    return [];
  };

  const saveThread = (taskId?: string | number) => {
    const id = taskId || currentTaskId.value;
    if (!id) return;
    try {
      const storage = getStorage();
      storage?.setItem(storageKey(id), JSON.stringify(messages.value));
    } catch (e) {
      console.warn('[ConversationThread] Error saving thread:', e);
    }
  };

  const addUserMessage = (text: string, role: 'operator' = 'operator'): ThreadMessage => {
    const message: ThreadMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'user',
      role,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: text.trim(),
      status: 'completed',
    };
    messages.value.push(message);
    saveThread();
    return message;
  };

  const addAgentMessage = (payload: Partial<ThreadMessage>): ThreadMessage => {
    const message: ThreadMessage = {
      id: payload.id || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: payload.sender || 'agent',
      role: payload.role || 'worker',
      provider: payload.provider || 'codex',
      model: payload.model,
      timestamp: payload.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: payload.text || '',
      thought: payload.thought,
      toolCalls: payload.toolCalls || [],
      status: payload.status || 'completed',
    };
    messages.value.push(message);
    saveThread();
    return message;
  };

  const updateStreamingAgentTurn = (
    text: string,
    options?: {
      provider?: string;
      model?: string;
      role?: ConversationRole;
      toolCalls?: ToolCallItem[];
      thought?: string;
      status?: 'stream' | 'completed' | 'failed';
    }
  ) => {
    const last = messages.value[messages.value.length - 1];
    if (last && last.sender === 'agent' && last.status === 'stream') {
      last.text = text;
      if (options?.provider) last.provider = options.provider;
      if (options?.model) last.model = options.model;
      if (options?.role) last.role = options.role;
      if (options?.toolCalls) last.toolCalls = options.toolCalls;
      if (options?.thought) last.thought = options.thought;
      if (options?.status) last.status = options.status;
      saveThread();
      return last;
    }

    const newAgentMsg: ThreadMessage = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'agent',
      role: options?.role || 'worker',
      provider: options?.provider || 'codex',
      model: options?.model,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
      thought: options?.thought,
      toolCalls: options?.toolCalls || [],
      status: options?.status || 'stream',
    };
    messages.value.push(newAgentMsg);
    saveThread();
    return newAgentMsg;
  };

  const finalizeStreamingTurn = (status: 'completed' | 'failed' = 'completed') => {
    const last = messages.value[messages.value.length - 1];
    if (last && last.sender === 'agent' && last.status === 'stream') {
      last.status = status;
      saveThread();
    }
  };

  const clearThread = (taskId?: string | number) => {
    const id = taskId || currentTaskId.value;
    if (id) {
      try {
        const storage = getStorage();
        storage?.removeItem(storageKey(id));
      } catch {}
    }
    messages.value = [];
  };

  const messageCount = computed(() => messages.value.length);

  return {
    messages,
    currentTaskId,
    loadThread,
    saveThread,
    addUserMessage,
    addAgentMessage,
    updateStreamingAgentTurn,
    finalizeStreamingTurn,
    clearThread,
    messageCount,
  };
}
