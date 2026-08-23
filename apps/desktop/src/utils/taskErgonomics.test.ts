import { describe, expect, it } from 'vitest';
import {
  evaluateRepairHealth,
  filterAndSortTasks,
  findNextUpTask,
  formatTimelineToMarkdown,
  getTaskSortWeight,
  TaskLike,
} from './taskErgonomics';

describe('taskErgonomics', () => {
  const sampleTasks: TaskLike[] = [
    { id: 1, title: 'Fix CSS Bug', status: 'done', priority: 'low' },
    { id: 2, title: 'Implement OAuth Flow', status: 'todo', priority: 'urgent', issue_key: 'TH-102' },
    { id: 3, title: 'Write API Tests', status: 'in_progress', priority: 'high', issue_key: 'TH-103' },
    { id: 4, title: 'Refactor Models', status: 'todo', priority: 'medium', issue_key: 'TH-104' },
    { id: 5, title: 'Code Review PR', status: 'review', priority: 'high', issue_key: 'TH-105' },
  ];

  it('calculates weighted priority scores correctly', () => {
    // in_progress (1000) + high (300) + id tiebreaker (0.03) = 1300.03
    const scoreProgressHigh = getTaskSortWeight(sampleTasks[2]);
    expect(scoreProgressHigh).toBeCloseTo(1300.03);

    // todo (800) + urgent (400) + id tiebreaker (0.02) = 1200.02
    const scoreTodoUrgent = getTaskSortWeight(sampleTasks[1]);
    expect(scoreTodoUrgent).toBeCloseTo(1200.02);

    // done (100) + low (100) = 200.01
    const scoreDoneLow = getTaskSortWeight(sampleTasks[0]);
    expect(scoreDoneLow).toBeCloseTo(200.01);

    expect(scoreProgressHigh).toBeGreaterThan(scoreTodoUrgent);
    expect(scoreTodoUrgent).toBeGreaterThan(scoreDoneLow);
  });

  it('filters and sorts tasks by status and priority', () => {
    const sorted = filterAndSortTasks(sampleTasks);
    // In progress (TH-103) should come first, followed by Urgent Todo (TH-102), Medium Todo (TH-104), Review (TH-105), Done (ID 1)
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 4, 5, 1]);

    const onlyTodo = filterAndSortTasks(sampleTasks, { status: 'todo' });
    expect(onlyTodo.map((t) => t.id)).toEqual([2, 4]);

    const onlyUrgent = filterAndSortTasks(sampleTasks, { priority: 'urgent' });
    expect(onlyUrgent.map((t) => t.id)).toEqual([2]);

    const textSearch = filterAndSortTasks(sampleTasks, { query: 'OAuth' });
    expect(textSearch.length).toBe(1);
    expect(textSearch[0].issue_key).toBe('TH-102');
  });

  it('recommends the correct next-up task', () => {
    const sorted = filterAndSortTasks(sampleTasks);
    const nextUp = findNextUpTask(sorted);
    expect(nextUp).not.toBeNull();
    expect(nextUp?.id).toBe(3); // In progress task is top priority next-up
  });

  it('formats activity timeline to markdown', () => {
    const events = [
      { id: '1', label: 'Worktree Created', detail: 'Created branch codex/TH-102', tone: 'ok', time: '14:30:00' },
      { id: '2', label: 'Preflight Check', detail: 'All 5 checks passed', tone: 'passed', time: '14:30:05' },
    ];
    const md = formatTimelineToMarkdown(events, sampleTasks[1]);
    expect(md).toContain('### Task Hub Activity Timeline');
    expect(md).toContain('TH-102');
    expect(md).toContain('Worktree Created');
    expect(md).toContain('[OK]');
  });

  it('evaluates repair health checks accurately', () => {
    const checks: Array<{ id: string; status: 'passed' | 'warning' | 'failed'; message: string }> = [
      { id: 'repo', status: 'passed', message: 'Git OK' },
      { id: 'env', status: 'passed', message: '.env OK' },
      { id: 'deps', status: 'warning', message: 'Stale lock' },
    ];
    const result = evaluateRepairHealth(checks);
    expect(result.ok).toBe(true);
    expect(result.passedCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const failingChecks = [...checks, { id: 'cli', status: 'failed' as const, message: 'CLI not found' }];
    const failResult = evaluateRepairHealth(failingChecks);
    expect(failResult.ok).toBe(false);
    expect(failResult.failedCount).toBe(1);
  });
});
