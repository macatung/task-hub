import { describe, expect, it } from 'vitest';
import source from './WorkflowPanel.vue?raw';

describe('Requirement proposal review', () => {
  it('keeps proposals local until approval and supports a revision request', () => {
    expect(source).toContain('Nothing is synced yet. Review, edit or request changes');
    expect(source).toContain('Approve & create backlog');
    expect(source).toContain('Request changes from AI');
    expect(source).toContain("emit('reviseRequirement'");
    expect(source).toContain('Edit draft');
    expect(source).toContain("emit('updateProposal'");
  });
});
