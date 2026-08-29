import { describe, expect, it } from 'vitest';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import conversationSource from './ConversationThread.vue?raw';
import streamCardsSource from './StreamCardsView.vue?raw';

describe('response-first presentation', () => {
  it('keeps raw output behind an explicit technical-details control', () => {
    expect(runWorkspaceSource).toContain('Chi tiết kỹ thuật');
    expect(runWorkspaceSource).toContain('copyTechnicalOutput');
    expect(runWorkspaceSource).toContain('downloadTechnicalOutput');
    expect(runWorkspaceSource).toContain(':streaming-text="displayResponse"');
  });

  it('normalizes persisted agent messages before rendering markdown', () => {
    expect(conversationSource).toContain('agentMessageText');
    expect(conversationSource).toContain('responseOutputForDisplay');
    expect(conversationSource).toContain('renderMarkdown(agentMessageText(msg))');
  });

  it('starts pipeline terminal logs collapsed and exposes a compact progress preview', () => {
    expect(streamCardsSource).toContain('architect: false');
    expect(streamCardsSource).toContain('latestStageProgress');
    expect(streamCardsSource).toContain('Cập nhật:');
  });
});
