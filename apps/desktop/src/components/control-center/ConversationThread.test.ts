import { describe, expect, it } from 'vitest';
import threadComponentSource from './ConversationThread.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import { useConversationThread } from '../../composables/useConversationThread';

describe('ConversationThread and useConversationThread', () => {
  it('defines structured thread messages and allows adding user and agent messages', () => {
    const thread = useConversationThread();
    thread.clearThread('test-task-1');

    const userMsg = thread.addUserMessage('Kiểm tra quota agent');
    expect(userMsg.sender).toBe('user');
    expect(userMsg.text).toBe('Kiểm tra quota agent');
    expect(thread.messages.value.length).toBe(1);

    const agentMsg = thread.addAgentMessage({
      text: 'Đã tìm thấy 3 endpoint quota.',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      role: 'worker',
    });
    expect(agentMsg.sender).toBe('agent');
    expect(agentMsg.provider).toBe('codex');
    expect(thread.messages.value.length).toBe(2);
  });

  it('handles streaming updates and finalization for live agent responses', () => {
    const thread = useConversationThread();
    thread.clearThread('test-task-2');

    thread.updateStreamingAgentTurn('Đang thực thi', {
      provider: 'codex',
      status: 'stream',
    });
    expect(thread.messages.value[0].status).toBe('stream');
    expect(thread.messages.value[0].text).toBe('Đang thực thi');

    thread.updateStreamingAgentTurn('Đang thực thi... hoàn tất!', {
      provider: 'codex',
      status: 'stream',
    });
    expect(thread.messages.value[0].text).toBe('Đang thực thi... hoàn tất!');

    thread.finalizeStreamingTurn('completed');
    expect(thread.messages.value[0].status).toBe('completed');
  });

  it('renders rich user bubbles and markdown agent turns in ConversationThread.vue', () => {
    expect(threadComponentSource).toContain('cc-conversation-thread');
    expect(threadComponentSource).toContain("msg.sender === 'user'");
    expect(threadComponentSource).toContain('renderMarkdown(msg.text)');
    expect(threadComponentSource).toContain('msg.thought');
    expect(threadComponentSource).toContain('msg.toolCalls');
    expect(threadComponentSource).toContain('quickPrompts');
    expect(threadComponentSource).toContain('scrollToBottom');
  });

  it('embeds ConversationThread as default tab in RunWorkspace.vue', () => {
    expect(runWorkspaceSource).toContain('<ConversationThread');
    expect(runWorkspaceSource).toContain("activeSubTab = ref<\"conversation\" | \"terminal\" | \"turns\" | \"handoff\">(\"conversation\")");
    expect(runWorkspaceSource).toContain('💬 Cuộc trò chuyện');
    expect(runWorkspaceSource).toContain('>_ Terminal');
  });
});
