import { describe, expect, it } from 'vitest';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import conversationSource from './ConversationThread.vue?raw';
import streamCardsSource from './StreamCardsView.vue?raw';

describe('response-first presentation', () => {
  it('keeps raw output behind the unified debug drawer', () => {
    expect(runWorkspaceSource).toContain('Debug events');
    expect(runWorkspaceSource).toContain('<ExecutionDetailDrawer');
    expect(runWorkspaceSource).toContain('selectedStreamEvent');
    expect(runWorkspaceSource).toContain(':streaming-text="displayResponse"');
  });

  it('does not render an action row beneath the prompt input', () => {
    expect(runWorkspaceSource).not.toContain('Open Hub for review');
    expect(runWorkspaceSource).not.toContain('Footer Actions: Handoff & Hub Link');
    expect(runWorkspaceSource).toContain('Review & submit handoff');
    expect(runWorkspaceSource).toContain('cc-run-header-control');
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
