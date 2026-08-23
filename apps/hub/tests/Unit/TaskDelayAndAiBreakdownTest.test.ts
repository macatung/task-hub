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
      label: 'Completed',
      reason: 'Task is already completed',
      badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      cardBorderClass: '',
    };
  }

  if (!task.due_date) {
    return {
      isOverdue: false,
      isDelayed: false,
      daysDiff: 0,
      label: 'No due date',
      reason: 'No due date assigned',
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

  // 1. OVERDUE (Past due date)
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      isOverdue: true,
      isDelayed: false,
      daysDiff: diffDays,
      label: `🚨 ${overdueDays} days overdue`,
      reason: `${overdueDays} days past due date (${task.due_date})`,
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
      delayReason = 'Due today but task is not completed yet!';
    }
  } else if (diffDays <= 2) {
    if (task.status === 'todo') {
      isDelayed = true;
      delayReason = `${diffDays} days left until due date but still in To Do status`;
    } else if (totalSubtasks > 0 && doneSubtasks / totalSubtasks < 0.5) {
      isDelayed = true;
      delayReason = `${diffDays} days remaining but subtask progress is only ${doneSubtasks}/${totalSubtasks}`;
    }
  } else if (diffDays <= 4 && (task.priority === 'urgent' || task.priority === 'high') && task.status === 'todo') {
    isDelayed = true;
    delayReason = `High-priority task due soon (${diffDays} days) but has not started`;
  }

  if (isDelayed) {
    return {
      isOverdue: false,
      isDelayed: true,
      daysDiff: diffDays,
      label: diffDays === 0 ? '⚠️ Due today' : `⚠️ Behind schedule (${diffDays}d)`,
      reason: delayReason,
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold',
      cardBorderClass: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
    };
  }

  return {
    isOverdue: false,
    isDelayed: false,
    daysDiff: diffDays,
    label: `📅 ${diffDays} days left`,
    reason: `On track (${diffDays} days remaining)`,
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
    expect(status.label).toContain('🚨 2 days overdue');
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
    expect(status.label).toBe('Completed');
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
    expect(status.label).toContain('⚠️ Due today');
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
    expect(status.reason).toContain('subtask progress is only 1/4');
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
    expect(status.label).toContain('10 days left');
  });
});

describe('Sprint Backlog & Story Point Rollup: Epic Separation & Zero Double Counting', () => {
  const sampleTasks: TaskItem[] = [
    {
      id: 101,
      project_id: 1,
      sprint_id: null,
      issue_key: 'PROJ-1',
      issue_type: 'epic',
      title: 'User Authentication Epic',
      status: 'in_progress',
      priority: 'high',
      category: 'backend',
      story_points: 8,
    },
    {
      id: 102,
      project_id: 1,
      sprint_id: 1,
      issue_key: 'PROJ-2',
      issue_type: 'story',
      title: 'Login with OAuth',
      status: 'done',
      priority: 'high',
      category: 'backend',
      story_points: 5,
    },
    {
      id: 103,
      project_id: 1,
      sprint_id: 1,
      issue_key: 'PROJ-3',
      issue_type: 'task',
      title: 'Password reset API',
      status: 'todo',
      priority: 'medium',
      category: 'backend',
      story_points: 3,
    },
    {
      id: 104,
      project_id: 1,
      sprint_id: null,
      issue_key: 'PROJ-4',
      issue_type: 'story',
      title: 'User profile management',
      status: 'todo',
      priority: 'low',
      category: 'frontend',
      story_points: 2,
    },
  ];

  it('filters sprint tasks by excluding epics', () => {
    const sprint1Tasks = sampleTasks.filter(t => t.sprint_id === 1 && t.issue_type !== 'epic');
    expect(sprint1Tasks.length).toBe(2);
    expect(sprint1Tasks.some(t => t.issue_type === 'epic')).toBe(false);
  });

  it('calculates sprint story point rollup without double counting epic points', () => {
    const sprint1Tasks = sampleTasks.filter(t => t.sprint_id === 1 && t.issue_type !== 'epic');
    const totalPts = sprint1Tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const donePts = sprint1Tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);

    // Sum of child work items: 5 + 3 = 8 pts. If epic were included, it would double-count to 16.
    expect(totalPts).toBe(8);
    expect(donePts).toBe(5);
  });

  it('calculates backlog tasks by excluding epics with sprint_id null', () => {
    const backlog = sampleTasks.filter(t => t.sprint_id === null && t.issue_type !== 'epic');
    expect(backlog.length).toBe(1);
    expect(backlog[0].id).toBe(104);
    expect(backlog[0].title).toBe('User profile management');
  });

  it('calculates active project story points excluding epics', () => {
    const projectWorkItems = sampleTasks.filter(t => t.project_id === 1 && t.issue_type !== 'epic');
    const projectStoryPoints = projectWorkItems.reduce((sum, t) => sum + (t.story_points || 0), 0);

    // 5 (PROJ-2) + 3 (PROJ-3) + 2 (PROJ-4) = 10 pts. (Epic 8 pts excluded)
    expect(projectStoryPoints).toBe(10);
  });

  it('clears sprint_id and epic_id when a task is converted to an epic', () => {
    const task: TaskItem = {
      id: 102,
      project_id: 1,
      sprint_id: 1,
      epic_id: 101,
      issue_key: 'PROJ-2',
      issue_type: 'story',
      title: 'Login with OAuth',
      status: 'done',
      priority: 'high',
      category: 'backend',
      story_points: 5,
    };

    // Simulate drawer conversion to epic
    task.issue_type = 'epic';
    if (task.issue_type === 'epic') {
      task.sprint_id = null;
      task.epic_id = null;
    }

    expect(task.sprint_id).toBeNull();
    expect(task.epic_id).toBeNull();
    expect(task.issue_type).toBe('epic');
  });

  it('prevents assigning sprint_id to an epic during drag and drop', () => {
    const epicTask: TaskItem = {
      id: 101,
      project_id: 1,
      sprint_id: null,
      issue_key: 'PROJ-1',
      issue_type: 'epic',
      title: 'User Authentication Epic',
      status: 'in_progress',
      priority: 'high',
      category: 'backend',
      story_points: 8,
    };

    const targetSprintId = 2;
    // Simulate onDropSprint guard
    if (epicTask.issue_type !== 'epic') {
      epicTask.sprint_id = targetSprintId;
    }

    expect(epicTask.sprint_id).toBeNull();
  });

  it('calculates AI plan preview sprint story points excluding epics', () => {
    const aiSprintTasks = [
      { title: 'Core Auth Epic', issue_type: 'epic', story_points: 13 },
      { title: 'Login API', issue_type: 'story', story_points: 5 },
      { title: 'Registration Form', issue_type: 'task', story_points: 3 },
    ];

    const sprintWorkItems = aiSprintTasks.filter(t => t.issue_type !== 'epic');
    const sprintPoints = sprintWorkItems.reduce((acc, t) => acc + Number(t.story_points), 0);

    expect(sprintWorkItems.length).toBe(2);
    expect(sprintPoints).toBe(8);
  });

  it('sanitizes sprint_id and epic_id to null when creating an epic in task modal', () => {
    const newTaskForm = {
      project_id: 1,
      issue_type: 'epic',
      title: 'New Big Feature Epic',
      sprint_id: 1 as number | null,
      epic_id: 99 as number | null,
      story_points: 13,
    };

    if (newTaskForm.issue_type === 'epic') {
      newTaskForm.sprint_id = null;
      newTaskForm.epic_id = null;
    }

    expect(newTaskForm.sprint_id).toBeNull();
    expect(newTaskForm.epic_id).toBeNull();
  });

  it('filters board tasks excluding epics unless filterIssueType is epic', () => {
    const filterIssueTypeAll = 'all';
    const standardBoardTasks = sampleTasks.filter(task => {
      if (task.issue_type === 'epic' && filterIssueTypeAll !== 'epic') {
        return false;
      }
      return true;
    });

    expect(standardBoardTasks.length).toBe(3);
    expect(standardBoardTasks.some(t => t.issue_type === 'epic')).toBe(false);

    const filterIssueTypeEpic = 'epic';
    const epicOnlyBoardTasks = sampleTasks.filter(task => {
      if (task.issue_type === 'epic' && filterIssueTypeEpic !== 'epic') {
        return false;
      }
      if (filterIssueTypeEpic !== 'all' && task.issue_type !== filterIssueTypeEpic) {
        return false;
      }
      return true;
    });

    expect(epicOnlyBoardTasks.length).toBe(1);
    expect(epicOnlyBoardTasks[0].issue_key).toBe('PROJ-1');
  });
});
