import { describe, expect, it } from 'vitest';
import controlCenter from './ControlCenter.vue?raw';
import runWorkspace from '../components/control-center/RunWorkspace.vue?raw';

describe('Control Center Epic sequence orchestration', () => {
  it('collects every child task and advances one dependency-ready task at a time', () => {
    expect(controlCenter).toContain(".filter(task => task.epic_id === epic.id && task.issue_type !== 'epic')");
    expect(controlCenter).toContain('const nextEpicTask = (sequence: EpicSequence)');
    expect(controlCenter).toContain("void advanceEpicSequence(handoffTaskId, 'handoff')");
    expect(controlCenter).toContain('Starting ${next.issue_key || `#${next.id}`} in Epic sequence (${sequence.completedIds.length + 1}/${sequence.tasks.length})');
    expect(controlCenter).toContain('run_type: "epic"');
    expect(controlCenter).toContain('local_cao: true');
    expect(controlCenter).toContain('parentRunId');
    expect(controlCenter).toContain('finalizeEpicHandoff');
  });

  it('automatically completes verified children and continues the Epic sequence', () => {
    expect(controlCenter).toContain("localStorage.getItem('task-hub-auto-continue-epic') !== 'false'");
    expect(controlCenter).toContain('autoContinue: autoContinueEpic.value');
    expect(controlCenter).toContain('const epicAutoSubmit = runIntent.value === \'epic\'');
    expect(controlCenter).toContain("(runIntent.value === 'epic' && epicSequence.value?.autoContinue)");
    expect(controlCenter).toContain("complete_auto_approved_handoff");
    expect(runWorkspace).toContain('starts the next task after each automatic verification.');
    expect(runWorkspace).toContain('pauses only if a human decision is required.');
  });

  it('reports completion for the whole Epic instead of only the first child', () => {
    expect(controlCenter).toContain('All ${sequence.tasks.length} tasks have run. Preparing one final Epic handoff for Hub review.');
    expect(runWorkspace).toContain('epicCompletedCount');
    expect(runWorkspace).toContain('{{ epicCompletedCount || 0 }}/{{ epicChildCount || 0 }} tasks completed');
    expect(runWorkspace).toContain('CAO đang chạy xuyên Epic');
    expect(controlCenter).toContain('complete_auto_approved_handoff');
  });

  it('keeps one aggregate handoff for the local CAO Epic sequence', () => {
    expect(controlCenter).toContain('recordEpicChildResult');
    expect(controlCenter).toContain('finalizeEpicHandoff');
    expect(controlCenter).toContain('Epic completed automatically');
  });

  it('fails closed on duplicate exits, dependency dead-ends, and CAO/reviewer failures', () => {
    expect(controlCenter).toContain('processingChildId');
    expect(controlCenter).toContain('if (sequence.finalizing || sequence.completedIds.includes(task.id)) return false;');
    expect(controlCenter).toContain('await failEpicSequence(error.value);');
    expect(controlCenter).toContain('Automatic review failed for an Epic child');
  });
});
