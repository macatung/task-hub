import { describe, expect, it } from 'vitest';
import {
  evaluateRepairHealth,
  filterAndSortTasks,
  findNextUpTask,
  formatTimelineToMarkdown,
  getTaskSortWeight,
  TaskLike,
} from './taskErgonomics';

describe('taskErgonomics Empirical Stress & Boundary Tests', () => {
  describe('getTaskSortWeight boundary conditions', () => {
    it('handles minimal task with missing/undefined fields gracefully', () => {
      const minimalTask: TaskLike = {
        id: 0,
        title: '',
      };
      const score = getTaskSortWeight(minimalTask);
      // default status 'todo' -> 800, default priority 'medium' -> 200, id 0 -> 0
      expect(score).toBeCloseTo(1000.0);
    });

    it('handles uppercase and mixed-case status and priority strings', () => {
      const task: TaskLike = {
        id: 10,
        title: 'Mixed case',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
      };
      const score = getTaskSortWeight(task);
      // in_progress (1000) + urgent (400) + id tiebreaker (0.10)
      expect(score).toBeCloseTo(1400.10);
    });

    it('handles unknown / atypical status and priority values without crashing', () => {
      const task: TaskLike = {
        id: 5,
        title: 'Custom Status',
        status: 'blocked',
        priority: 'critical_custom',
      };
      const score = getTaskSortWeight(task);
      // unrecognized status -> 0, unrecognized priority -> 0, id 5 -> 0.05
      expect(score).toBeCloseTo(0.05);
      expect(Number.isFinite(score)).toBe(true);
    });

    it('caps tiebreaker at id 99 correctly', () => {
      const task100: TaskLike = { id: 100, title: 'T100', status: 'todo', priority: 'medium' };
      const task999: TaskLike = { id: 999, title: 'T999', status: 'todo', priority: 'medium' };
      const score100 = getTaskSortWeight(task100);
      const score999 = getTaskSortWeight(task999);
      // Math.min(100, 99) * 0.01 = 0.99
      expect(score100).toBeCloseTo(1000.99);
      expect(score999).toBeCloseTo(1000.99);
      expect(score100).toEqual(score999);
    });

    it('handles negative or zero id without breaking arithmetic', () => {
      const taskNeg: TaskLike = { id: -10, title: 'Negative ID' };
      const score = getTaskSortWeight(taskNeg);
      // Math.min(-10, 99) * 0.01 = -0.10 -> 800 + 200 - 0.10 = 999.90
      expect(score).toBeCloseTo(999.90);
    });
  });

  describe('filterAndSortTasks stress scenarios', () => {
    it('returns empty array when filtering empty input list', () => {
      expect(filterAndSortTasks([])).toEqual([]);
      expect(filterAndSortTasks([], { query: 'test', status: 'todo', priority: 'high' })).toEqual([]);
    });

    it('handles search query with regex special characters and spaces', () => {
      const tasks: TaskLike[] = [
        { id: 1, title: 'Fix [UI] bug (header)?', issue_key: 'TH-01' },
        { id: 2, title: 'Refactor *all* models + db', issue_key: 'TH-02' },
        { id: 3, title: 'Regular task', issue_key: 'TH-03' },
      ];

      const res1 = filterAndSortTasks(tasks, { query: '[UI]' });
      expect(res1.length).toBe(1);
      expect(res1[0].id).toBe(1);

      const res2 = filterAndSortTasks(tasks, { query: '*all*' });
      expect(res2.length).toBe(1);
      expect(res2[0].id).toBe(2);

      const res3 = filterAndSortTasks(tasks, { query: '   th-03   ' });
      expect(res3.length).toBe(1);
      expect(res3[0].id).toBe(3);
    });

    it('searches across project title and epic title correctly', () => {
      const tasks: TaskLike[] = [
        { id: 1, title: 'Task Alpha', project: { id: 1, title: 'Core Engine' }, epic: { id: 1, title: 'V2 Migration' } },
        { id: 2, title: 'Task Beta', project: { id: 2, title: 'Web App' } },
        { id: 3, title: 'Task Gamma', epic: { id: 2, title: 'Security Hardening' } },
      ];

      expect(filterAndSortTasks(tasks, { query: 'Engine' }).map((t) => t.id)).toEqual([1]);
      expect(filterAndSortTasks(tasks, { query: 'Security' }).map((t) => t.id)).toEqual([3]);
      expect(filterAndSortTasks(tasks, { query: 'Web' }).map((t) => t.id)).toEqual([2]);
    });

    it('handles all status filter branches including aliases', () => {
      const tasks: TaskLike[] = [
        { id: 1, title: 'T1', status: 'doing' },
        { id: 2, title: 'T2', status: 'in_progress' },
        { id: 3, title: 'T3', status: 'backlog' },
        { id: 4, title: 'T4', status: 'todo' },
        { id: 5, title: 'T5', status: 'in_review' },
        { id: 6, title: 'T6', status: 'testing' },
        { id: 7, title: 'T7', status: 'completed' },
        { id: 8, title: 'T8', status: 'done' },
      ];

      expect(filterAndSortTasks(tasks, { status: 'in_progress' }).map((t) => t.id)).toEqual([2, 1]);
      expect(filterAndSortTasks(tasks, { status: 'todo' }).map((t) => t.id)).toEqual([4, 3]);
      expect(filterAndSortTasks(tasks, { status: 'review' }).map((t) => t.id)).toEqual([6, 5]);
      expect(filterAndSortTasks(tasks, { status: 'done' }).map((t) => t.id)).toEqual([8, 7]);
    });

    it('correctly ranks 100 heterogeneous tasks deterministically', () => {
      const statuses = ['in_progress', 'todo', 'review', 'done'];
      const priorities = ['urgent', 'high', 'medium', 'low'];
      const largeList: TaskLike[] = [];

      for (let i = 1; i <= 100; i++) {
        largeList.push({
          id: i,
          title: `Task #${i}`,
          status: statuses[i % statuses.length],
          priority: priorities[i % priorities.length],
        });
      }

      const sorted = filterAndSortTasks(largeList);
      expect(sorted.length).toBe(100);

      // Verify strictly non-increasing order of sort weight
      for (let i = 0; i < sorted.length - 1; i++) {
        const weightA = getTaskSortWeight(sorted[i]);
        const weightB = getTaskSortWeight(sorted[i + 1]);
        expect(weightA).toBeGreaterThanOrEqual(weightB);
      }
    });
  });

  describe('findNextUpTask edge cases', () => {
    it('returns null when task list is empty', () => {
      expect(findNextUpTask([])).toBeNull();
    });

    it('returns null when all tasks are completed or in review', () => {
      const tasks: TaskLike[] = [
        { id: 1, title: 'T1', status: 'done' },
        { id: 2, title: 'T2', status: 'completed' },
        { id: 3, title: 'T3', status: 'review' },
        { id: 4, title: 'T4', status: 'in_review' },
      ];
      expect(findNextUpTask(tasks)).toBeNull();
    });

    it('selects the first actionable in_progress or todo task', () => {
      const tasks: TaskLike[] = [
        { id: 1, title: 'T1', status: 'done' },
        { id: 2, title: 'T2', status: 'in_review' },
        { id: 3, title: 'T3', status: 'todo', priority: 'urgent' },
        { id: 4, title: 'T4', status: 'todo', priority: 'low' },
      ];
      const next = findNextUpTask(tasks);
      expect(next?.id).toBe(3);
    });
  });

  describe('formatTimelineToMarkdown formatting verification', () => {
    it('renders header even when event list is empty', () => {
      const md = formatTimelineToMarkdown([]);
      expect(md).toContain('### Task Hub Activity Timeline');
      expect(md.trim().endsWith('---')).toBe(true);
    });

    it('renders task header when activeTask has only id or issue_key', () => {
      const taskWithIdOnly: TaskLike = { id: 42, title: 'Isolated Task' };
      const md1 = formatTimelineToMarkdown([], taskWithIdOnly);
      expect(md1).toContain('**Task**: #42 - Isolated Task');

      const taskWithKey: TaskLike = { id: 42, issue_key: 'TH-999', title: 'Keyed Task' };
      const md2 = formatTimelineToMarkdown([], taskWithKey);
      expect(md2).toContain('**Task**: TH-999 - Keyed Task');
    });

    it('uppercases event tones properly in markdown lines', () => {
      const events = [
        { id: '1', label: 'Command', detail: 'Executed git fetch', tone: 'tool', time: '10:00:00' },
        { id: '2', label: 'Failure', detail: 'Timeout 5000ms', tone: 'error', time: '10:00:05' },
        { id: '3', label: 'Notice', detail: 'Stale cache', tone: 'warning', time: '10:00:10' },
      ];
      const md = formatTimelineToMarkdown(events);
      expect(md).toContain('`[TOOL]` **Command**: Executed git fetch');
      expect(md).toContain('`[ERROR]` **Failure**: Timeout 5000ms');
      expect(md).toContain('`[WARNING]` **Notice**: Stale cache');
    });
  });

  describe('evaluateRepairHealth diagnostic combinations', () => {
    it('handles empty checks array', () => {
      const res = evaluateRepairHealth([]);
      expect(res.ok).toBe(true);
      expect(res.passedCount).toBe(0);
      expect(res.warningCount).toBe(0);
      expect(res.failedCount).toBe(0);
    });

    it('returns ok: true with warnings if no failed checks', () => {
      const res = evaluateRepairHealth([
        { id: 'c1', status: 'passed', message: 'OK' },
        { id: 'c2', status: 'warning', message: 'Minor warning' },
        { id: 'c3', status: 'warning', message: 'Another warning' },
      ]);
      expect(res.ok).toBe(true);
      expect(res.passedCount).toBe(1);
      expect(res.warningCount).toBe(2);
      expect(res.failedCount).toBe(0);
    });

    it('returns ok: false immediately if any check failed', () => {
      const res = evaluateRepairHealth([
        { id: 'c1', status: 'passed', message: 'OK' },
        { id: 'c2', status: 'failed', message: 'Fatal error' },
      ]);
      expect(res.ok).toBe(false);
      expect(res.passedCount).toBe(1);
      expect(res.failedCount).toBe(1);
    });
  });
});
