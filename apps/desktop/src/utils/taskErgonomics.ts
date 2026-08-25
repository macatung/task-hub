export interface TaskLike {
  id: number;
  title: string;
  issue_key?: string | null;
  status?: string | null;
  priority?: string | null;
  project?: { id?: number; title?: string } | null;
  epic?: { id?: number; title?: string } | null;
  estimated_pomodoros?: number;
  completed_pomodoros?: number;
  subtasks?: Array<{ id: number; title: string; completed: boolean }>;
  acceptance_criteria?: Array<{ id: number; text: string; completed: boolean }>;
}

export interface TaskFilterOptions {
  query?: string;
  status?: string;
  priority?: string;
}

/**
 * Calculates a weighted priority score for a task to support ergonomic sorting.
 */
export function getTaskSortWeight(task: TaskLike): number {
  let score = 0;
  const s = (task.status || 'todo').toLowerCase();
  const p = (task.priority || 'medium').toLowerCase();

  // Status weight (In Progress > Todo > Review > Done)
  if (['in_progress', 'doing'].includes(s)) score += 1000;
  else if (['todo', 'backlog'].includes(s)) score += 800;
  else if (['review', 'in_review', 'testing'].includes(s)) score += 400;
  else if (['done', 'completed'].includes(s)) score += 100;

  // Priority weight (Urgent > High > Medium > Low)
  if (p === 'urgent') score += 400;
  else if (p === 'high') score += 300;
  else if (p === 'medium') score += 200;
  else if (p === 'low') score += 100;

  // Tie breaker by ID (max 99 * 0.01)
  score += Math.min(task.id || 0, 99) * 0.01;
  return score;
}

/**
 * Filters and sorts tasks ergonomically by status, priority, and text search.
 */
export function filterAndSortTasks(tasks: TaskLike[], options: TaskFilterOptions = {}): TaskLike[] {
  const query = (options.query || '').trim().toLowerCase();
  const statusFilter = options.status || 'all';
  const priorityFilter = options.priority || 'all';

  const filtered = tasks.filter((task) => {
    // Text search
    if (query) {
      const searchTokens = [
        task.title,
        task.issue_key,
        task.project?.title,
        task.epic?.title,
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchTokens.includes(query)) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const s = (task.status || 'todo').toLowerCase();
      if (statusFilter === 'todo' && !['todo', 'backlog'].includes(s)) return false;
      if (statusFilter === 'in_progress' && !['in_progress', 'doing'].includes(s)) return false;
      if (statusFilter === 'review' && !['review', 'in_review', 'testing'].includes(s)) return false;
      if (statusFilter === 'done' && !['done', 'completed'].includes(s)) return false;
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      const p = (task.priority || 'medium').toLowerCase();
      if (p !== priorityFilter.toLowerCase()) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => getTaskSortWeight(b) - getTaskSortWeight(a));
}

/**
 * Recommends the Next-Up task for the developer.
 */
export function findNextUpTask(tasks: TaskLike[]): TaskLike | null {
  const candidate = tasks.find((t) => {
    const s = (t.status || 'todo').toLowerCase();
    return !['done', 'completed', 'review', 'in_review'].includes(s);
  });
  return candidate || null;
}

/**
 * Formats chronological activity timeline events into markdown.
 */
export function formatTimelineToMarkdown(
  events: Array<{ id: string; label: string; detail: string; tone: string; time: string; actor?: { name?: string; role?: string; type?: string } }>,
  activeTask?: TaskLike | null
): string {
  const taskHeader = activeTask
    ? `**Task**: ${activeTask.issue_key || `#${activeTask.id}`} - ${activeTask.title}\n`
    : '';

  const header = `### Task Hub Activity Timeline\n${taskHeader}---\n`;
  const items = events.map((e) => {
    const actorStr = e.actor?.name ? ` *(Actor: ${e.actor.name}${e.actor.role ? ` · ${e.actor.role}` : ''})*` : '';
    return `- **[${e.time}]** \`[${e.tone.toUpperCase()}]\` **${e.label}**${actorStr}: ${e.detail}`;
  }).join('\n');
  return `${header}${items}\n`;
}

/**
 * Evaluates overall environment health from diagnostics checks.
 */
export function evaluateRepairHealth(checks: Array<{ id: string; status: 'passed' | 'warning' | 'failed'; message: string }>): {
  ok: boolean;
  passedCount: number;
  warningCount: number;
  failedCount: number;
} {
  let passedCount = 0;
  let warningCount = 0;
  let failedCount = 0;

  for (const c of checks) {
    if (c.status === 'passed') passedCount++;
    else if (c.status === 'warning') warningCount++;
    else if (c.status === 'failed') failedCount++;
  }

  return {
    ok: failedCount === 0,
    passedCount,
    warningCount,
    failedCount,
  };
}
