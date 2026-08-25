import { describe, expect, it } from 'vitest';
import controlCenter from './ControlCenter.vue?raw';
import runWorkspace from '../components/control-center/RunWorkspace.vue?raw';

describe('Control Center Epic sequence orchestration', () => {
  it('collects every child task and advances one dependency-ready task at a time', () => {
    expect(controlCenter).toContain(".filter(task => task.epic_id === epic.id && task.issue_type !== 'epic')");
    expect(controlCenter).toContain('const nextEpicTask = (sequence: EpicSequence)');
    expect(controlCenter).toContain("void advanceEpicSequence(handoffTaskId, 'handoff')");
    expect(controlCenter).toContain('Starting ${next.issue_key || `#${next.id}`} in Epic sequence (${sequence.completedIds.length + 1}/${sequence.tasks.length})');
  });

  it('keeps Hub review as the approval boundary while allowing local auto-continue', () => {
    expect(controlCenter).toContain("localStorage.getItem('task-hub-auto-continue-epic') !== 'false'");
    expect(controlCenter).toContain('autoContinue: autoContinueEpic.value');
    expect(controlCenter).toContain('const epicAutoSubmit = runIntent.value === \'epic\'');
    expect(controlCenter).toContain("(runIntent.value === 'epic' && epicSequence.value?.autoContinue)");
    expect(controlCenter).toContain("void waitForEpicApproval(handoffTaskId)");
    expect(runWorkspace).toContain('starts the next task after each handoff; Hub review remains required.');
    expect(runWorkspace).toContain('waits for Hub approval before continuing.');
  });

  it('reports completion for the whole Epic instead of only the first child', () => {
    expect(controlCenter).toContain('All ${sequence.tasks.length} tasks have run. Handoffs remain available for Hub review.');
    expect(controlCenter).toContain('All ${sequence.tasks.length} task handoffs were approved on Hub.');
    expect(runWorkspace).toContain('epicCompletedCount');
    expect(runWorkspace).toContain('{{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks completed');
  });
});
