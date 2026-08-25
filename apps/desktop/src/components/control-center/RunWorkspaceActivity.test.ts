import { describe, expect, it } from 'vitest';
import source from './RunWorkspace.vue?raw';

describe('RunWorkspace response-first agent activity', () => {
  it('uses response turns as the only top-level activity cards', () => {
    expect(source).toContain('type ResponseTurn');
    expect(source).toContain('v-for="(turn, index) in responseTurns"');
    expect(source).toContain('Agent response');
  });

  it('keeps technical activity beneath nested, Codex-style log disclosures', () => {
    expect(source).toContain('View details');
    expect(source).toContain('turnSummary(turn)');
    expect(source).toContain('activityGroups(turn)');
    expect(source).toContain('v-for="(line, lineIndex) in group.lines"');
  });

  it('keeps a pending working turn, reports final lifecycle states, and only flags explicit runtime failures', () => {
    expect(source).toContain("props.running ? 'Working…'");
    expect(source).toContain("props.runStatus === 'completed' ? 'Run completed.'");
    expect(source).toContain('const statusLabel');
    expect(source).toContain('exit code:');
    expect(source).not.toContain('/error|failed|exception|🛑/i');
  });

  it('does not launch work that is already in review or done', () => {
    expect(source).toContain('const runnableStatus');
    expect(source).toContain('Waiting for Hub review');
    expect(source).toContain('Task already completed');
    expect(source).toContain('!executionBlock.value');
  });

  it('offers a clear Epic-only action to return a reviewed Epic to To do', () => {
    expect(source).toContain("'reopen-todo': []");
    expect(source).toContain("task?.issue_type === 'epic' && task.status === 'review'");
    expect(source).toContain('Reopen as To do');
  });
});
