import { describe, expect, it } from 'vitest';
import { eventMatchesFilter, groupExecutionStreamEvents, mergeExecutionEvents, normalizeExecutionEvent } from './executionStream';

describe('normalized execution stream', () => {
  it('normalizes workflow, actor and task metadata', () => {
    const event = normalizeExecutionEvent({
      event_id: 'cao-1', type: 'workflow.step.completed', step_id: 'child-1-62-implement',
      task_id: 62, role: 'worker', provider: 'codex', output: { changed_files: ['src/a.ts'] },
      timestamp: '2026-08-31T10:00:00.000Z',
    }, { runId: 'cao-run-1', mode: 'workflow', source: 'cao' });
    expect(event).toMatchObject({ id: 'cao-1', type: 'step.completed', stepId: 'child-1-62-implement', taskId: 62, source: 'cao' });
    expect(event.actor).toMatchObject({ role: 'worker', provider: 'codex' });
  });

  it('deduplicates and sorts reconnect events', () => {
    const make = (id: string, time: string) => normalizeExecutionEvent({ id, type: 'output', text: id, timestamp: time }, { runId: 1, mode: 'supervisor', source: 'hub' });
    const result = mergeExecutionEvents([make('b', '2026-08-31T10:02:00Z')], [make('a', '2026-08-31T10:01:00Z'), make('b', '2026-08-31T10:02:00Z')]);
    expect(result.map((event) => event.id)).toEqual(['a', 'b']);
  });

  it('filters tools and errors without changing event identity', () => {
    const tool = normalizeExecutionEvent({ id: 'tool', type: 'tool.started' }, { runId: 1, mode: 'workflow', source: 'cao' });
    const error = normalizeExecutionEvent({ id: 'error', type: 'step.failed', error: 'failed' }, { runId: 1, mode: 'workflow', source: 'cao' });
    expect(eventMatchesFilter(tool, 'tools')).toBe(true);
    expect(eventMatchesFilter(error, 'errors')).toBe(true);
    expect(eventMatchesFilter(tool, 'errors')).toBe(false);
  });

  it('deduplicates multiple step.started polling events for the same step without explicit id', () => {
    const event1 = normalizeExecutionEvent(
      { type: 'workflow.step.started', step_id: 'task-101-implement', timestamp: '2026-08-31T10:00:01.000Z' },
      { runId: 'run-99', mode: 'workflow', source: 'cao' }
    );
    const event2 = normalizeExecutionEvent(
      { type: 'workflow.step.started', step_id: 'task-101-implement', timestamp: '2026-08-31T10:00:02.000Z' },
      { runId: 'run-99', mode: 'workflow', source: 'cao' }
    );
    expect(event1.id).toBe(event2.id);
    const merged = mergeExecutionEvents([event1], [event2]);
    expect(merged).toHaveLength(1);
    expect(merged[0].stepId).toBe('task-101-implement');
  });

  it('groups duplicate or consecutive step execution events with repeatCount and duration', () => {
    const e1 = normalizeExecutionEvent(
      { id: 'ev-1', type: 'step.started', step_id: 'task-1-implement', timestamp: '2026-08-31T10:00:00.000Z' },
      { runId: 'run-1', mode: 'workflow', source: 'cao' }
    );
    const e2 = normalizeExecutionEvent(
      { id: 'ev-2', type: 'step.started', step_id: 'task-1-implement', timestamp: '2026-08-31T10:00:02.000Z' },
      { runId: 'run-1', mode: 'workflow', source: 'cao' }
    );
    const e3 = normalizeExecutionEvent(
      { id: 'ev-3', type: 'step.completed', step_id: 'task-1-implement', timestamp: '2026-08-31T10:00:05.000Z' },
      { runId: 'run-1', mode: 'workflow', source: 'cao' }
    );

    const grouped = groupExecutionStreamEvents([e1, e2, e3]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].stepId).toBe('task-1-implement');
    expect(grouped[0].repeatCount).toBe(3);
    expect(grouped[0].isGrouped).toBe(true);
    expect(grouped[0].durationMs).toBe(5000);
    expect(grouped[0].lifecycleState).toBe('completed');
  });
});
