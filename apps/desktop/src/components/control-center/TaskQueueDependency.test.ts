import { describe, expect, it } from 'vitest';
import source from './TaskQueue.vue?raw';

describe('Control Center dependency notes', () => {
  it('does not render a misleading global execution-order strip', () => {
    expect(source).not.toContain('executionPreview');
    expect(source).not.toContain('Suggested order');
    expect(source).not.toContain('Step {{ taskMeta(task).rank }}');
  });

  it('keeps dependency constraints attached to each task and flags regressions', () => {
    expect(source).toContain('Depends on {{ dependencyState(task).labels.join');
    expect(source).toContain('Blocked by {{ dependencyState(task).pendingLabels.join');
    expect(source).toContain('Needs review: a prerequisite moved back from done');
    expect(source).toContain('Reconsider dependent work:');
  });
});
