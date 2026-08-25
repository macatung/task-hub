import { Task } from '@/api/types';

export interface SprintStats {
  totalPoints: number;
  donePoints: number;
  inProgressPoints: number;
  todoPoints: number;
  totalTasks: number;
  doneTasks: number;
  completionPercentage: number;
}

/**
 * Calculates sprint statistics strictly excluding Epics to prevent double-counting.
 * Invariant: Epics (issue_type === 'epic') are NOT execution work items and have 0 points in sprint rollup.
 */
export function calculateSprintStats(tasks: Task[]): SprintStats {
  if (!tasks || !Array.isArray(tasks)) {
    return {
      totalPoints: 0,
      donePoints: 0,
      inProgressPoints: 0,
      todoPoints: 0,
      totalTasks: 0,
      doneTasks: 0,
      completionPercentage: 0,
    };
  }

  // Filter out Epics strictly
  const actionableTasks = tasks.filter((t) => t && t.issue_type !== 'epic');

  let totalPoints = 0;
  let donePoints = 0;
  let inProgressPoints = 0;
  let todoPoints = 0;
  let doneTasks = 0;

  for (const task of actionableTasks) {
    const points = typeof task.story_points === 'number' && !isNaN(task.story_points) ? task.story_points : 0;
    totalPoints += points;

    if (task.status === 'done' || task.status === 'verified' as any) {
      donePoints += points;
      doneTasks += 1;
    } else if (task.status === 'in_progress' || task.status === 'review' || task.status === 'running' as any) {
      inProgressPoints += points;
    } else {
      // todo, blocked, etc.
      todoPoints += points;
    }
  }

  const completionPercentage = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : (actionableTasks.length > 0 && doneTasks === actionableTasks.length ? 100 : 0);

  return {
    totalPoints,
    donePoints,
    inProgressPoints,
    todoPoints,
    totalTasks: actionableTasks.length,
    doneTasks,
    completionPercentage,
  };
}
