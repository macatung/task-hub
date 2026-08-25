/**
 * Task Hub OpenAPI v1 TypeScript Domain Types & Request/Response Schemas
 * Corresponds to packages/contracts/task-hub.openapi.yaml & backend Eloquent models.
 */

export type IssueType = 'epic' | 'story' | 'task' | 'bug';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked' | 'failed';
export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type SprintStatus = 'future' | 'active' | 'completed' | 'planned';
export type AgentRunStatus =
  | 'queued'
  | 'claimed'
  | 'preparing'
  | 'running'
  | 'waiting_input'
  | 'needs_review'
  | 'verified'
  | 'failed'
  | 'cancelled';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type EvidenceStatus = 'passed' | 'failed' | 'skipped' | 'pending';
export type ExecutionMode = 'auto_pilot' | 'supervised' | 'desktop';
export type AgentProvider = 'antigravity' | 'claude_code' | 'codex';

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  owner_id?: number;
  plan?: string;
  agent_concurrency_limit?: number;
  is_system?: boolean;
  members_count?: number;
  projects_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  workspace_id: number;
  name?: string;
  title?: string;
  slug: string;
  key?: string;
  description?: string | null;
  tagline?: string | null;
  category?: string | null;
  color?: string | null;
  tags?: string[] | null;
  status?: 'active' | 'archived';
  tasks_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: number;
  project_id: number;
  workspace_id?: number;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SprintWithRollup extends Sprint {
  total_points: number;
  done_points: number;
  total_tasks: number;
  done_tasks: number;
  in_progress_points?: number;
  todo_points?: number;
  tasks?: Task[];
}

export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type?: string;
  depends_on?: {
    id: number;
    issue_key?: string | null;
    title: string;
    status: TaskStatus;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  workspace_id: number;
  project_id: number;
  issue_key?: string | null;
  sprint_id?: number | null;
  epic_id?: number | null;
  title: string;
  description?: string | null;
  issue_type: IssueType;
  status: TaskStatus;
  priority: Priority;
  category?: string | null;
  story_points?: number | null;
  estimated_pomodoros?: number | null;
  completed_pomodoros?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  risk_level?: 'low' | 'medium' | 'high' | 'critical' | null;
  parent_epic?: {
    id: number;
    title: string;
    issue_key?: string;
  } | null;
  child_tasks?: Task[];
  dependencies?: TaskDependency[];
  documents?: any[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface VerificationEvidence {
  id?: number;
  task_id?: number;
  agent_run_id?: number;
  evidence_type?: string;
  status?: EvidenceStatus;
  command?: string;
  summary?: string;
  artifact_url?: string;
  commit_sha?: string;
  pr_url?: string;
  pull_request_url?: string;
  changed_files?: string[];
  diff?: string;
  tests_passed: number;
  tests_failed: number;
  tests_total: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface AgentRun {
  id: number;
  task_id?: number | null;
  workspace_id?: number | null;
  runner_id?: number | null;
  provider: AgentProvider;
  model?: string;
  status: AgentRunStatus;
  execution_mode: ExecutionMode;
  repository?: string | null;
  branch?: string | null;
  run_type?: string | null;
  summary?: string | null;
  failure_reason?: string | null;
  commit_sha?: string | null;
  pull_request_url?: string | null;
  evidence?: VerificationEvidence[] | VerificationEvidence | null;
  events?: AgentRunEvent[];
  logs?: AgentRunLog[];
  task?: Task | null;
  runner?: {
    id: number;
    name: string;
    hostname?: string;
  } | null;
  metadata?: Record<string, any> | null;
  queued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunEvent {
  id: number;
  run_id: number;
  agent_run_id?: number;
  type: string;
  event_type?: string;
  status: AgentRunStatus;
  payload?: any;
  event_id?: string;
  occurred_at: string;
}

export interface AgentRunLog {
  id: number;
  run_id: number;
  agent_run_id?: number;
  stream: 'stdout' | 'stderr' | 'system';
  content: string;
  occurred_at: string;
}

export interface HandoffTestItem {
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  summary?: string;
}

export interface HandoffPayload {
  summary: string;
  changed_files?: string[];
  tests: HandoffTestItem[];
  commit_sha?: string;
  pull_request_url?: string;
  blockers?: string;
  idempotency_key?: string;
}

export interface CreateTaskPayload {
  workspace_id?: number;
  project_id: number;
  title: string;
  description?: string;
  issue_type?: IssueType;
  priority?: Priority;
  status?: TaskStatus;
  category?: string;
  story_points?: number | null;
  sprint_id?: number | null;
  epic_id?: number | null;
  estimated_pomodoros?: number | null;
  start_date?: string;
  due_date?: string;
  notes?: string;
  acceptance_criteria?: string;
  definition_of_done?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  depends_on_task_ids?: number[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  issue_type?: IssueType;
  status?: TaskStatus;
  priority?: Priority;
  category?: string;
  story_points?: number | null;
  sprint_id?: number | null;
  epic_id?: number | null;
  estimated_pomodoros?: number | null;
  completed_pomodoros?: number;
  start_date?: string;
  due_date?: string;
  notes?: string;
  acceptance_criteria?: string;
  definition_of_done?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  depends_on_task_ids?: number[];
}

export interface DispatchEpicPayload {
  runner_id: number;
  provider?: AgentProvider;
  model?: string;
  execution_mode?: ExecutionMode;
  custom_instruction?: string;
}

export interface DispatchTaskPayload {
  runner_id?: number;
  provider?: AgentProvider;
  model?: string;
  execution_mode?: ExecutionMode;
  custom_instruction?: string;
  epic_sequence?: any;
}

export interface CreateSprintPayload {
  project_id: number;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status?: 'future' | 'active' | 'completed' | 'planned';
}

export interface UpdateSprintPayload {
  name?: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status?: 'future' | 'active' | 'completed' | 'planned';
}

export interface StartSprintPayload {
  start_date?: string;
  end_date?: string;
  duration_weeks?: number;
}

export interface CompleteSprintPayload {
  move_incomplete_to?: 'backlog' | number;
}

export interface MoveTasksPayload {
  task_ids: number[];
  sprint_id?: number | null;
}

export interface CreateProjectPayload {
  title: string;
  color?: string;
  description?: string;
  tags?: string[];
}

export interface CreateWorkspacePayload {
  name: string;
}

export interface TaskQueryParams {
  workspace_id?: number;
  project_id?: number;
  sprint_id?: number | 'backlog' | 'all';
  status?: TaskStatus;
  priority?: Priority;
  issue_type?: IssueType | 'all';
  epic_id?: number;
  today?: boolean;
}

export interface AgentRunQueryParams {
  task_id?: number;
  runner_id?: number;
  status?: AgentRunStatus;
}

export interface ApiResponse<T> {
  success?: boolean;
  data: T;
  meta?: Record<string, any>;
  message?: string;
}

export interface ApiError extends Error {
  status?: number;
  errors?: Record<string, string[]>;
  error_code?: string;
  response?: {
    status: number;
    data: any;
  };
}

export interface PairingQrPayload {
  type: 'taskhub_pairing';
  version: '1';
  task_hub_url: string;
  pairing_id: string;
  device_secret: string;
  code?: string;
  workspace_id?: number;
  token?: string;
}
