/**
 * Test Suite: Task Overdue / Delay Warning Calculation & Smart AI Breakdown Logic
 * Tests overdue detection, at-risk/delay detection, filter predicates, and plan estimation.
 */

import { describe, it, expect } from '../Harness/index.js';

export interface TaskItem {
  id: number;
  project_id?: number | null;
  sprint_id?: number | null;
  issue_key?: string;
  issue_type: 'task' | 'story' | 'bug' | 'epic';
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'frontend' | 'backend' | 'devops' | 'database' | 'design' | 'general';
  story_points?: number | null;
  estimated_pomodoros?: number;
  completed_pomodoros?: number;
  start_date?: string | null;
  due_date?: string | null;
  subtasks?: Array<{ id: string; text: string; done: boolean }>;
}

export interface TaskDelayStatus {
  isOverdue: boolean;
  isDelayed: boolean;
  daysDiff: number;
  label: string;
  reason: string;
  badgeClass: string;
  cardBorderClass: string;
}

export function computeTaskDelayStatus(task: TaskItem, referenceDate: Date = new Date()): TaskDelayStatus {
  if (task.status === 'done') {
    return {
      isOverdue: false,
      isDelayed: false,
      daysDiff: 0,
      label: 'Đã hoàn tất',
      reason: 'Nhiệm vụ đã hoàn thành',
      badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      cardBorderClass: '',
    };
  }

  if (!task.due_date) {
    return {
      isOverdue: false,
      isDelayed: false,
      daysDiff: 0,
      label: 'Chưa đặt hạn',
      reason: 'Chưa có hạn chót',
      badgeClass: '',
      cardBorderClass: '',
    };
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 1. OVERDUE (Hạn chót đã qua)
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      isOverdue: true,
      isDelayed: false,
      daysDiff: diffDays,
      label: `🚨 Trễ ${overdueDays} ngày`,
      reason: `Đã quá hạn chót ${overdueDays} ngày (${task.due_date})`,
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold animate-pulse',
      cardBorderClass: 'border-l-4 border-l-rose-600 dark:border-l-rose-500 shadow-rose-500/10',
    };
  }

  // 2. AT RISK / DELAYED
  let isDelayed = false;
  let delayReason = '';

  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const doneSubtasks = subtasks.filter(s => s.done).length;

  if (diffDays === 0) {
    if (task.status === 'todo' || (totalSubtasks > 0 && doneSubtasks < totalSubtasks)) {
      isDelayed = true;
      delayReason = 'Hôm nay là hạn chót nhưng task chưa hoàn tất!';
    }
  } else if (diffDays <= 2) {
    if (task.status === 'todo') {
      isDelayed = true;
      delayReason = `Còn ${diffDays} ngày nữa đến hạn nhưng vẫn đang ở trạng thái Cần Làm (To Do)`;
    } else if (totalSubtasks > 0 && doneSubtasks / totalSubtasks < 0.5) {
      isDelayed = true;
      delayReason = `Còn ${diffDays} ngày nhưng tiến độ subtask mới đạt ${doneSubtasks}/${totalSubtasks}`;
    }
  } else if (diffDays <= 4 && (task.priority === 'urgent' || task.priority === 'high') && task.status === 'todo') {
    isDelayed = true;
    delayReason = `Task ưu tiên cao sắp đến hạn (${diffDays} ngày) nhưng chưa bắt đầu`;
  }

  if (isDelayed) {
    return {
      isOverdue: false,
      isDelayed: true,
      daysDiff: diffDays,
      label: diffDays === 0 ? '⚠️ Đến hạn hôm nay' : `⚠️ Chậm tiến độ (${diffDays}d)`,
      reason: delayReason,
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold',
      cardBorderClass: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
    };
  }

  return {
    isOverdue: false,
    isDelayed: false,
    daysDiff: diffDays,
    label: `📅 Còn ${diffDays} ngày`,
    reason: `Đúng tiến độ (còn ${diffDays} ngày)`,
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    cardBorderClass: '',
  };
}

describe('Task Delay and Overdue Warning Engine', () => {
  const refDate = new Date('2026-08-20T00:00:00Z');

  it('detects overdue tasks when due_date is in past and status is not done', () => {
    const task: TaskItem = {
      id: 1,
      title: 'Fix payment webhook bug',
      issue_type: 'bug',
      status: 'in_progress',
      priority: 'urgent',
      category: 'backend',
      due_date: '2026-08-18', // 2 days ago
    };

    const status = computeTaskDelayStatus(task, refDate);
    expect(status.isOverdue).toBe(true);
    expect(status.isDelayed).toBe(false);
    expect(status.daysDiff).toBe(-2);
    expect(status.label).toContain('🚨 Trễ 2 ngày');
    expect(status.cardBorderClass).toContain('border-l-rose-600');
  });

  it('does not mark completed tasks as overdue even if due_date was in past', () => {
    const task: TaskItem = {
      id: 2,
      title: 'Setup PostgreSQL schema',
      issue_type: 'task',
      status: 'done',
      priority: 'high',
      category: 'database',
      due_date: '2026-08-10',
    };

    const status = computeTaskDelayStatus(task, refDate);
    expect(status.isOverdue).toBe(false);
    expect(status.isDelayed).toBe(false);
    expect(status.label).toBe('Đã hoàn tất');
  });

  it('marks task as at-risk if due date is today and status is todo', () => {
    const task: TaskItem = {
      id: 3,
      title: 'Deploy release v2.0',
      issue_type: 'task',
      status: 'todo',
      priority: 'urgent',
      category: 'devops',
      due_date: '2026-08-20', // today
    };

    const status = computeTaskDelayStatus(task, refDate);
    expect(status.isOverdue).toBe(false);
    expect(status.isDelayed).toBe(true);
    expect(status.label).toContain('⚠️ Đến hạn hôm nay');
    expect(status.cardBorderClass).toContain('border-l-amber-500');
  });

  it('detects slow subtask progress near deadline', () => {
    const task: TaskItem = {
      id: 4,
      title: 'Implement Dark Mode Themes',
      issue_type: 'story',
      status: 'in_progress',
      priority: 'high',
      category: 'frontend',
      due_date: '2026-08-21', // 1 day remaining
      subtasks: [
        { id: '1', text: 'Color tokens', done: true },
        { id: '2', text: 'CSS vars', done: false },
        { id: '3', text: 'Testing', done: false },
        { id: '4', text: 'Docs', done: false },
      ],
    };

    const status = computeTaskDelayStatus(task, refDate);
    expect(status.isDelayed).toBe(true);
    expect(status.reason).toContain('tiến độ subtask mới đạt 1/4');
  });

  it('marks task with plenty of time as on-track', () => {
    const task: TaskItem = {
      id: 5,
      title: 'Design Marketing Landing Page',
      issue_type: 'story',
      status: 'todo',
      priority: 'low',
      category: 'design',
      due_date: '2026-08-30', // 10 days remaining
    };

    const status = computeTaskDelayStatus(task, refDate);
    expect(status.isOverdue).toBe(false);
    expect(status.isDelayed).toBe(false);
    expect(status.label).toContain('Còn 10 ngày');
  });
});
