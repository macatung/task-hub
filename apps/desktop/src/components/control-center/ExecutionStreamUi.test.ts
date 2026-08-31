import { describe, expect, it } from 'vitest';
import timelineSource from './ExecutionTimeline.vue?raw';
import drawerSource from './ExecutionDetailDrawer.vue?raw';
import epicSource from './EpicTaskAccordion.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';

describe('unified execution stream UI', () => {
  it('renders normalized chronological filters and live-follow controls', () => {
    expect(timelineSource).toContain('Execution stream');
    expect(timelineSource).toContain('eventMatchesFilter');
    expect(timelineSource).toContain('groupExecutionStreamEvents');
    expect(timelineSource).toContain('groupDuplicates');
    expect(timelineSource).toContain('execution-repeat-badge');
    expect(timelineSource).toContain('Follow live');
    expect(timelineSource).toContain('Latest');
    expect(timelineSource).toContain('execution-event');
  });

  it('keeps technical payload and terminal data behind a detail drawer', () => {
    expect(drawerSource).toContain('Execution details');
    expect(drawerSource).toContain('Raw terminal');
    expect(drawerSource).toContain('JSON.stringify');
  });

  it('uses compact Epic task accordions and dynamic Supervisor workers', () => {
    expect(epicSource).toContain('epic-task-accordion');
    expect(epicSource).toContain('Depends on');
    expect(runWorkspaceSource).toContain('Supervisor workers');
    expect(runWorkspaceSource).toContain('Workers sẽ xuất hiện khi CAO phát event assign/handoff.');
    expect(runWorkspaceSource).toContain('StreamCardsView');
  });
});
