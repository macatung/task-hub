/**
 * CAO (CLI Agent Orchestrator) Bridge Service
 * Integrates AWS Labs CLI Agent Orchestrator (CAO) with Task Hub Desktop.
 * 
 * Renderer-safe event normalization for CAO. Process launch, messaging and
 * shutdown are intentionally owned by Electron main through the official
 * `cao` CLI so renderer code never controls local orchestration processes.
 */

export interface CaoAgentSession {
  sessionId: string;
  provider: string;
  model?: string;
  status: 'starting' | 'running' | 'idle' | 'completed' | 'failed';
  workingDirectory: string;
  createdAt: string;
  eventsCount: number;
}

export interface CaoOrchestratorConfig {
  endpoint: string;
  enabled: boolean;
  autoStartDaemon: boolean;
  supervisorProvider: string;
  workerProviders: string[];
}

export interface CaoChildTaskInfo {
  id: number;
  issueKey?: string | null;
  issue_key?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  dependencies?: Array<{ depends_on_task_id: number; depends_on?: { issue_key?: string | null; status?: string | null } }>;
}

export interface CaoTaskOrchestrationOptions {
  task: { id: number; issue_key?: string | null; issueKey?: string | null; title: string; description?: string | null };
  context?: any;
  epic?: { id: number; issue_key?: string | null; issueKey?: string | null; title: string } | null;
  policy?: string;
}

export interface CaoEpicOrchestrationOptions {
  epic: { id: number; issue_key?: string | null; issueKey?: string | null; title: string; description?: string | null };
  childTasks: CaoChildTaskInfo[];
  context?: any;
  policy?: string;
}

export type CaoProvider = 'antigravity' | 'codex' | 'claude_code';

export function resolveCaoProviderModel(provider: CaoProvider | string, requestedModel?: string): string {
  if (requestedModel && requestedModel !== 'default') {
    return requestedModel.trim();
  }
  if (provider === 'antigravity') return 'gemini-3.7-flash';
  if (provider === 'claude_code') return 'claude-3-7-sonnet';
  return 'gpt-5';
}

export function getCaoProviderCapabilities(provider: CaoProvider | string): string[] {
  if (provider === 'antigravity') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor', 'gemini_multimodal'];
  }
  if (provider === 'codex') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor', 'sandbox_isolation'];
  }
  return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor'];
}

export type CaoOrchestrationStrategy = 'workflow' | 'supervisor';

export type OrchestrationMode = CaoOrchestrationStrategy;
export type WorkflowKind = 'task' | 'epic';
export type WorkflowRunState =
  | 'validating'
  | 'running'
  | 'waiting_input'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'cancelled';

export type WorkflowStepState =
  | 'pending'
  | 'running'
  | 'waiting_input'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped';

export interface CaoWorkflowStepStatus {
  id: string;
  taskId?: number;
  taskKey?: string;
  label?: string;
  state: WorkflowStepState;
  output?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CaoWorkflowRunStatus {
  runId: string;
  state: WorkflowRunState;
  kind?: WorkflowKind;
  parentRunId?: number;
  workflowName?: string;
  currentStep?: string;
  totalSteps?: number;
  completedSteps: string[];
  steps?: CaoWorkflowStepStatus[];
  error?: string;
}

export type WorkflowRunStatus = CaoWorkflowRunStatus;

export interface WorkflowRunHandle {
  runId: string;
  state: WorkflowRunState;
  specPath?: string;
  canonicalSpecPath?: string;
  runtimeSpecPath?: string;
  workflowName?: string;
  errorCode?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
}

export type CaoWorkflowEventType =
  | 'workflow.validated'
  | 'workflow.started'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.step.failed'
  | 'workflow.waiting_input'
  | 'workflow.interrupted'
  | 'workflow.completed'
  | 'workflow.cancelled';

export interface CaoWorkflowEvent {
  type: CaoWorkflowEventType;
  runId: string;
  stepId?: string;
  status?: CaoWorkflowRunStatus;
  output?: Record<string, any>;
  error?: string;
  timestamp: string;
}

export interface CaoWorkflowStep {
  id: string;
  provider?: string;
  agent?: string;
  prompt: string;
  output_schema?: {
    type: string;
    required?: string[];
    properties?: Record<string, any>;
  };
}

export interface CaoWorkflowSpec {
  name: string;
  description: string;
  inputs: Record<string, { type: string; required?: boolean }>;
  steps: CaoWorkflowStep[];
}

export interface CaoEpicWorkflowTask extends CaoChildTaskInfo {
  sort_order?: number | null;
}

export interface CaoEpicWorkflowOrder {
  ok: boolean;
  ordered: CaoEpicWorkflowTask[];
  cycleIds: number[];
  missingDependencyIds: number[];
  error?: string;
}

/**
 * Deterministically order open Epic children. Dependencies that are outside
 * the open-child set are only considered satisfied when Hub reports them done.
 */
export function topologicallySortEpicTasks(tasks: CaoEpicWorkflowTask[]): CaoEpicWorkflowOrder {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const missingDependencyIds = new Set<number>();
  const indegree = new Map<number, number>();
  const outgoing = new Map<number, number[]>();

  for (const task of tasks) {
    indegree.set(task.id, 0);
    outgoing.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dependency of task.dependencies || []) {
      const dependencyId = Number(dependency.depends_on_task_id);
      if (!dependencyId || dependency.depends_on?.status === 'done') continue;
      if (!byId.has(dependencyId)) {
        missingDependencyIds.add(dependencyId);
        continue;
      }
      indegree.set(task.id, (indegree.get(task.id) || 0) + 1);
      outgoing.get(dependencyId)?.push(task.id);
    }
  }

  const compare = (a: CaoEpicWorkflowTask, b: CaoEpicWorkflowTask) =>
    Number(a.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
  const ready = tasks.filter((task) => indegree.get(task.id) === 0).sort(compare);
  const ordered: CaoEpicWorkflowTask[] = [];

  while (ready.length) {
    const next = ready.shift()!;
    ordered.push(next);
    for (const dependentId of outgoing.get(next.id) || []) {
      const nextDegree = (indegree.get(dependentId) || 0) - 1;
      indegree.set(dependentId, nextDegree);
      if (nextDegree === 0) {
        const dependent = byId.get(dependentId);
        if (dependent) {
          ready.push(dependent);
          ready.sort(compare);
        }
      }
    }
  }

  const cycleIds = tasks.filter((task) => !ordered.some((candidate) => candidate.id === task.id)).map((task) => task.id);
  if (missingDependencyIds.size || cycleIds.length) {
    const reasons = [
      missingDependencyIds.size ? `missing dependencies: ${[...missingDependencyIds].join(', ')}` : '',
      cycleIds.length ? `dependency cycle: ${cycleIds.join(', ')}` : '',
    ].filter(Boolean);
    return {
      ok: false,
      ordered,
      cycleIds,
      missingDependencyIds: [...missingDependencyIds],
      error: `Epic workflow cannot be built (${reasons.join('; ')}).`,
    };
  }

  return { ok: true, ordered, cycleIds: [], missingDependencyIds: [] };
}

export function selectCaoOrchestrationStrategy(
  task: { id?: number; title?: string; issue_type?: string; description?: string | null },
  options?: { strategy?: CaoOrchestrationStrategy; isExploratory?: boolean; hasChildTasks?: boolean }
): CaoOrchestrationStrategy {
  if (options?.strategy) return options.strategy;
  if (options?.isExploratory) return 'supervisor';
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  if (text.includes('explore') || text.includes('investigate') || text.includes('spike') || text.includes('research') || text.includes('r&d')) {
    return 'supervisor';
  }
  // Standard coding, bugfix, epic execution with structured pipeline benefit from declarative workflow
  return 'workflow';
}

export function generateCaoStandardWorkflowYaml(options: {
  taskKey?: string;
  taskTitle: string;
  taskDescription?: string;
  implementProvider?: string;
  reviewProvider?: string;
  evidenceProvider?: string;
  handoffProvider?: string;
}): string {
  const key = options.taskKey || 'task';
  const implProvider = options.implementProvider || 'antigravity';
  const revProvider = options.reviewProvider || 'codex';
  const evProvider = options.evidenceProvider || 'antigravity';
  const hoProvider = options.handoffProvider || 'antigravity';

  return `name: task-${key}-pipeline
description: "Strict Task Hub workflow (Implement -> Review -> Evidence -> Handoff) for ${options.taskTitle.replace(/"/g, '\\"')}"
inputs:
  task_title:
    type: string
    required: true
  task_description:
    type: string
    required: true
  workspace_path:
    type: path
    required: true

steps:
  - id: implement
    provider: ${implProvider}
    agent: developer
    prompt: |
      Implement the solution for task: {{workflow.inputs.task_title}}
      Task title (literal fallback for CAO retry): ${yamlScalar(options.taskTitle)}
      Task details (literal fallback for CAO retry): ${yamlScalar(options.taskDescription || '')}
      Details: {{workflow.inputs.task_description}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and verify the working directory. All edits and commands must stay there.
      Follow clean code architecture, apply required modifications to the workspace, and list all changed files.
      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.
    output_schema:
      type: object
      required:
        - modified_files
        - change_summary
      properties:
        modified_files:
          type: array
          items:
            type: string
        change_summary:
          type: string

  - id: review
    provider: ${revProvider}
    agent: reviewer
    prompt: |
      Perform automated code review for: {{workflow.inputs.task_title}}
      Task title (literal fallback for CAO retry): ${yamlScalar(options.taskTitle)}
      Task details (literal fallback for CAO retry): ${yamlScalar(options.taskDescription || '')}
      Change summary: {{steps.implement.output.change_summary}}
      Modified files: {{steps.implement.output.modified_files}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` before reading files or running commands.
      Review for logic bugs, performance, security, and edge cases. Provide clear verdict.
      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.
    output_schema:
      type: object
      required:
        - verdict
        - feedback
        - risk_score
      properties:
        verdict:
          type: string
          enum: [APPROVED, REJECTED]
        feedback:
          type: string
        risk_score:
          type: number

  - id: evidence
    provider: ${evProvider}
    agent: developer
    prompt: |
      Execute test verification and capture evidence for: {{workflow.inputs.task_title}}
      Review feedback: {{steps.review.output.feedback}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and run all tests from that directory.
      Run workspace test commands and verify that all test suites pass with zero regressions.
      Do not modify files or delegate. You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid.
    output_schema:
      type: object
      required:
        - test_pass_count
        - test_fail_count
        - status
      properties:
        test_pass_count:
          type: number
        test_fail_count:
          type: number
        status:
          type: string

  - id: handoff
    provider: ${hoProvider}
    agent: reviewer
    prompt: |
      Synthesize the final handoff summary for Task Hub:
      Task: {{workflow.inputs.task_title}}
      Implementation Summary: {{steps.implement.output.change_summary}}
      Review Verdict: {{steps.review.output.verdict}} (Risk Score: {{steps.review.output.risk_score}})
      Test Evidence: {{steps.evidence.output.test_pass_count}} passed, {{steps.evidence.output.test_fail_count}} failed.
      Output the structured marker <TASK_HUB_HANDOFF> with summary, changed files, and verified evidence.
      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.
`;
}

function yamlScalar(value: string): string {
  return JSON.stringify(String(value ?? ''));
}

function appendWorkflowStep(
  lines: string[],
  step: {
    id: string;
    label: string;
    taskId: number;
    taskKey: string;
    title: string;
    description?: string | null;
    provider: string;
  },
) {
  const inputPrefix = `task_${step.taskId}`;
  lines.push(
    `  - id: ${step.id}-implement`,
    `    provider: ${step.provider}`,
    '    agent: developer',
    '    prompt: |',
    `      Implement only ${step.taskKey}: {{workflow.inputs.${inputPrefix}_title}}`,
    `      Task title (literal fallback for CAO retry): ${yamlScalar(step.title)}`,
    `      Task description (literal fallback for CAO retry): ${yamlScalar(step.description || '')}`,
    `      Description: {{workflow.inputs.${inputPrefix}_description}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      First run `cd -- "{{workflow.inputs.workspace_path}}"` and verify the working directory. All edits and commands must stay there.',
    '      Work in the supplied isolated workspace. Do not delegate to another agent.',
    '      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.',
    '    output_schema:',
    '      type: object',
    '      required: [task_id, modified_files, change_summary]',
    '      properties:',
    '        task_id: {type: integer}',
    '        modified_files: {type: array, items: {type: string}}',
    '        change_summary: {type: string}',
    '',
    `  - id: ${step.id}-review`,
    `    provider: ${step.provider}`,
    '    agent: reviewer',
    '    prompt: |',
    `      Review ${step.taskKey} for correctness and security.`,
    `      Task title (literal fallback for CAO retry): ${yamlScalar(step.title)}`,
    `      Task description (literal fallback for CAO retry): ${yamlScalar(step.description || '')}`,
    `      Implementation: {{steps.${step.id}-implement.output.change_summary}}`,
    `      Files: {{steps.${step.id}-implement.output.modified_files}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      First run `cd -- "{{workflow.inputs.workspace_path}}"` before reading files or running commands.',
    '      Do not modify files and do not delegate. Return APPROVED or REJECTED.',
    '      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.',
    '    output_schema:',
    '      type: object',
    '      required: [task_id, verdict, feedback, risk_score]',
    '      properties:',
    '        task_id: {type: integer}',
    '        verdict: {type: string, enum: [APPROVED, REJECTED]}',
    '        feedback: {type: string}',
    '        risk_score: {type: number}',
    '',
    `  - id: ${step.id}-evidence`,
    `    provider: ${step.provider}`,
    '    agent: developer',
    '    prompt: |',
    `      Run the relevant tests for ${step.taskKey} in the isolated workspace.`,
    `      Review verdict: {{steps.${step.id}-review.output.verdict}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      First run `cd -- "{{workflow.inputs.workspace_path}}"` and run all tests from that directory.',
    '      Do not delegate. You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid.',
    '    output_schema:',
    '      type: object',
    '      required: [task_id, tests, test_pass_count, test_fail_count, status]',
    '      properties:',
    '        task_id: {type: integer}',
    '        tests: {type: array}',
    '        test_pass_count: {type: integer}',
    '        test_fail_count: {type: integer}',
    '        status: {type: string, enum: [passed, failed]}',
    '',
    `  - id: ${step.id}-handoff`,
    `    provider: ${step.provider}`,
    '    agent: reviewer',
    '    prompt: |',
    `      Prepare the strict Task Hub handoff for ${step.taskKey}.`,
    `      Summary: {{steps.${step.id}-implement.output.change_summary}}`,
    `      Review: {{steps.${step.id}-review.output.feedback}}`,
    `      Evidence: {{steps.${step.id}-evidence.output.status}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      Do not modify files or delegate. You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.',
    '    output_schema:',
    '      type: object',
    '      required: [task_id, summary, changed_files, tests, blockers]',
    '      properties:',
    '        task_id: {type: integer}',
    '        summary: {type: string}',
    '        changed_files: {type: array}',
    '        tests: {type: array}',
    '        blockers: {type: string}',
    '',
  );
}

export function generateCaoEpicWorkflowYaml(options: {
  epic: { id: number; issue_key?: string | null; title: string; description?: string | null };
  childTasks: CaoEpicWorkflowTask[];
  provider?: string;
}): { yaml?: string; order: CaoEpicWorkflowOrder } {
  const order = topologicallySortEpicTasks(options.childTasks);
  if (!order.ok) return { order };
  const provider = options.provider || 'codex';
  const epicKey = options.epic.issue_key || `EPIC-${options.epic.id}`;
  const lines = [
    `name: epic-${options.epic.id}-pipeline`,
    `description: ${yamlScalar(`Strict Epic workflow for ${epicKey}: ${options.epic.title}`)}`,
    'inputs:',
    '  epic_title:',
    '    type: string',
    '    required: true',
    '  workspace_path:',
    '    type: path',
    '    required: true',
  ];
  for (const task of order.ordered) {
    lines.push(`  task_${task.id}_title:`, '    type: string', '    required: true');
    lines.push(`  task_${task.id}_description:`, '    type: string', '    required: true');
  }
  lines.push('', 'steps:');
  for (const [index, task] of order.ordered.entries()) {
    appendWorkflowStep(lines, {
      id: `child-${index + 1}-${task.id}`,
      label: task.title,
      taskId: task.id,
      taskKey: task.issue_key || `#${task.id}`,
      title: task.title,
      description: task.description,
      provider,
    });
  }
  const finalStepRefs = order.ordered.map((task, index) => {
    const stepId = `child-${index + 1}-${task.id}-handoff`;
    return `      ${stepId}: {{steps.${stepId}.output}}`;
  });
  lines.push(
    '  - id: epic-finalize',
    `    provider: ${provider}`,
    '    agent: reviewer',
    '    prompt: |',
    `      Aggregate the verified handoffs for Epic ${epicKey}.`,
    ...finalStepRefs,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      Return one aggregate Task Hub handoff. Do not modify files or delegate.',
    '      You MUST call the workflow_return MCP tool exactly once with a JSON object matching output_schema. A prose response alone is invalid; do not finish until the tool call succeeds.',
    '    output_schema:',
    '      type: object',
    '      required: [epic_id, summary, child_results, changed_files, tests, blockers]',
    '      properties:',
    `        epic_id: {type: integer, const: ${options.epic.id}}`,
    '        summary: {type: string}',
    '        child_results: {type: array}',
    '        changed_files: {type: array}',
    '        tests: {type: array}',
    '        blockers: {type: string}',
    '',
  );
  return { yaml: lines.join('\n'), order };
}

export function buildCaoWorkflowCommand(
  action: 'validate' | 'run' | 'status' | 'resume',
  target: string,
  options?: { inputs?: Record<string, any>; runId?: string }
): string[] {
  switch (action) {
    case 'validate':
      return ['workflow', 'validate', target];
    case 'run': {
      const args = ['workflow', 'run', target];
      if (options?.inputs) {
        for (const [k, v] of Object.entries(options.inputs)) {
          args.push('--input', `${k}=${v}`);
        }
      }
      if (options?.runId) {
        args.push('--run-id', options.runId);
      }
      return args;
    }
    case 'status':
      return ['workflow', 'status', target];
    case 'resume':
      return ['workflow', 'resume', target];
  }
}

export function parseCaoWorkflowRunStatus(output: string): CaoWorkflowRunStatus {
  const result: CaoWorkflowRunStatus = {
    runId: '',
    state: 'running',
    completedSteps: [],
  };

  if (!output) return result;

  const runIdMatch = output.match(/run[-_ ]?(?:id)?[:= ]+([a-zA-Z0-9_-]+)/i);
  if (runIdMatch) result.runId = runIdMatch[1];

  const statusLineMatch = output.match(/(?:overall\s+)?status[:=\s]+(RUNNING|COMPLETED|SUCCESS|INTERRUPTED|ABORTED|FAILED|ERROR)/i);
  if (statusLineMatch) {
    const raw = statusLineMatch[1].toUpperCase();
    if (raw === 'COMPLETED' || raw === 'SUCCESS') result.state = 'completed';
    else if (raw === 'INTERRUPTED' || raw === 'ABORTED') result.state = 'interrupted';
    else if (raw === 'FAILED' || raw === 'ERROR') result.state = 'failed';
    else result.state = 'running';
  } else if (/run\s+completed|workflow\s+completed/i.test(output)) {
    result.state = 'completed';
  } else if (/run\s+interrupted|workflow\s+interrupted/i.test(output)) {
    result.state = 'interrupted';
  } else if (/run\s+failed|workflow\s+failed/i.test(output)) {
    result.state = 'failed';
  } else {
    result.state = 'running';
  }

  const stepMatches = output.matchAll(/step[:\s]+([a-zA-Z0-9_-]+)\s+completed/gi);
  for (const match of stepMatches) {
    if (match[1] && !result.completedSteps.includes(match[1])) {
      result.completedSteps.push(match[1]);
    }
  }

  const currentMatch = output.match(/executing step[:\s]+([a-zA-Z0-9_-]+)/i);
  if (currentMatch) result.currentStep = currentMatch[1];

  return result;
}

export function evaluateCaoUserPrompt(
  promptText: string,
  policy: 'restricted' | 'workspace_write' | 'full_access' = 'workspace_write'
): { autoAnswer: boolean; answer?: string; risk: 'low' | 'medium' | 'high'; reason: string } {
  const normalized = (promptText || '').toLowerCase();

  const dangerousKeywords = [
    'rm -rf /',
    'drop database',
    'drop table',
    'delete from',
    'kill -9',
    'format disk',
    'curl | bash',
    'chmod 777 /',
    'destroy',
  ];
  for (const keyword of dangerousKeywords) {
    if (normalized.includes(keyword)) {
      return {
        autoAnswer: false,
        risk: 'high',
        reason: `Yêu cầu xác nhận cho thao tác có rủi ro cao: ${keyword}`,
      };
    }
  }

  if (policy === 'full_access') {
    return {
      autoAnswer: true,
      answer: 'y',
      risk: 'low',
      reason: 'Auto-approved under full_access policy',
    };
  }

  if (policy === 'workspace_write') {
    // Safe standard prompt questions (e.g. create file, run test, install local package)
    if (
      normalized.includes('continue?') ||
      normalized.includes('proceed?') ||
      normalized.includes('do you want to') ||
      normalized.includes('overwrite') ||
      normalized.includes('run test') ||
      normalized.includes('create file') ||
      normalized.includes('(y/n)')
    ) {
      return {
        autoAnswer: true,
        answer: 'y',
        risk: 'low',
        reason: 'Auto-approved standard workspace question under workspace_write policy',
      };
    }
  }

  return {
    autoAnswer: false,
    risk: 'medium',
    reason: 'Question requires manual operator confirmation',
  };
}

export type CaoCollaborationStyle = 'sync_handoff' | 'async_assign' | 'direct_message';

export const CAO_THREE_STYLES_GUIDELINES = [
  '## CAO Collaboration Styles & Protocol (Three Tools, Three Styles):',
  '- `handoff(task, role)` (Sync / Blocked): Use when you need the result RIGHT NOW before determining the next step (e.g. Code Review before merging, or strict sequential dependencies). Supervisor waits until worker finishes.',
  '- `assign(task, role)` (Async / Free): Use when work is INDEPENDENT. Returns immediately in an isolated tmux window. Fire multiple assigns back-to-back for parallel tasks.',
  '- `send_message(recipient, message)` (Direct): Use when target is ALREADY RUNNING. Delivers directly to existing agent inbox or conductor terminal ($CAO_TERMINAL_ID) without opening a new terminal.',
  '',
  '### Rule of Thumb:',
  '> Need the result now? Use `handoff`.',
  '> Work is independent? Use `assign`.',
  '> Target already running? Use `send_message`.',
].join('\n');

export function buildCaoTaskOrchestrationPrompt(options: CaoTaskOrchestrationOptions): string {
  const { task, context, epic } = options;
  const taskKey = task.issue_key || task.issueKey;
  const taskLabel = taskKey ? `${taskKey} (${task.title})` : task.title;
  const epicKey = epic ? (epic.issue_key || epic.issueKey) : null;
  const epicNotice = epic ? `This task is part of Epic ${epicKey || epic.title}. Focus strictly on this task; do not modify sibling tasks.` : '';
  const contextStr = context ? `\n\nTask Context & Specifications:\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}` : '';

  return [
    `# CAO Multi-Agent Task Orchestration: ${taskLabel}`,
    '',
    'You are operating as the CAO Conductor/Supervisor agent orchestrating this task within AWS Labs CLI Agent Orchestrator.',
    '',
    CAO_THREE_STYLES_GUIDELINES,
    '',
    '## Orchestration Directives:',
    '1. Analyze the requirements and worktree files to form an execution plan.',
    '2. For independent subtasks, use `assign()` to dispatch workers in parallel.',
    '3. For verification & code review before merging, use `handoff()` to block until the review completes.',
    '4. Workers report progress, diffs, and test evidence back to conductor via `send_message()`.',
    '5. Execute required code changes and run automated test suites (e.g. `npm test`, `pytest`, `cargo test`, `vitest`) to verify that all tests pass.',
    '6. Conclude the task with a concise summary and emit the structured handoff marker `<TASK_HUB_HANDOFF>` with changed files and test evidence.',
    epicNotice ? `\n> Note: ${epicNotice}` : '',
    contextStr,
  ].filter(Boolean).join('\n');
}

export function buildCaoRequirementSupervisorPrompt(requirement: string, context?: any): string {
  const contextStr = context ? `\n\nRepository and Task Hub context:\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}` : '';
  return [
    '# CAO Requirement Discovery Supervisor',
    '',
    'You are the CAO Supervisor. Do not edit files or run implementation commands directly.',
    'Analyze the requirement, inspect the repository and project documents, and delegate independent investigations to workers.',
    '',
    CAO_THREE_STYLES_GUIDELINES,
    '',
    'Use assign() for independent research, handoff() when the next decision depends on a worker result, and send_message() to communicate with already-running agents.',
    'Synthesize the worker findings into a Vietnamese discovery proposal with one Epic, Stories, Tasks, acceptance criteria, Fibonacci points, dependencies and risks.',
    'Do not create or modify Task Hub records. End with the structured discovery contract and wait for human approval.',
    '',
    `Requirement:\n${requirement}`,
    contextStr,
  ].filter(Boolean).join('\n');
}

export function buildCaoEpicOrchestrationPrompt(options: CaoEpicOrchestrationOptions): string {
  const { epic, childTasks, context } = options;
  const epicKey = epic.issue_key || epic.issueKey;
  const epicLabel = epicKey ? `${epicKey}: ${epic.title}` : epic.title;
  
  const tasksBreakdown = childTasks.map((t, idx) => {
    const taskKey = t.issue_key || t.issueKey;
    const deps = (t.dependencies || []).map(d => d.depends_on?.issue_key || `#${d.depends_on_task_id}`).join(', ');
    return `${idx + 1}. [${taskKey || `#${t.id}`}] ${t.title} (Status: ${t.status}${deps ? `, Depends on: ${deps}` : ''})\n   ${t.description || 'No description'}`;
  }).join('\n\n');

  const contextStr = context ? `\n\nEpic Context & Specifications:\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}` : '';

  return [
    `# CAO Multi-Agent Epic Orchestration: ${epicLabel}`,
    '',
    'You are operating as the CAO Conductor/Supervisor agent orchestrating the entire Epic across specialist worker agents.',
    '',
    '## Epic Objectives:',
    epic.description || epic.title,
    '',
    '## Child Tasks Breakdown & DAG:',
    tasksBreakdown,
    '',
    CAO_THREE_STYLES_GUIDELINES,
    '',
    '## CAO Orchestration Instructions:',
    '1. Analyze the Epic dependency graph (DAG) to determine task execution order.',
    '2. Dispatch all independent/unblocked child tasks in parallel using `assign(task, ...)`.',
    '3. Dispatch sequential/dependent child tasks using `handoff(task, ...)`.',
    '4. Workers report completion and evidence back to supervisor via `send_message()` to `$CAO_TERMINAL_ID`.',
    '5. Run a code review / quality audit using `handoff()` before final handoff.',
    '6. Execute workspace integration and regression tests across the worktree.',
    '7. Generate the aggregate Epic handoff with `<TASK_HUB_HANDOFF>` detailing all verified child results, modified files, and test status.',
    contextStr,
  ].filter(Boolean).join('\n');
}

export interface CaoNormalizedEvent {
  type: 'init' | 'tool_call' | 'tool_result' | 'text' | 'turn_complete' | 'error';
  sessionId: string;
  agentRole?: 'supervisor' | 'worker' | 'reviewer';
  collaborationStyle?: CaoCollaborationStyle;
  provider: string;
  content: string;
  timestamp: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class CaoBridgeService {
  private endpoint: string;
  private isConnected: boolean = false;
  private activeSessions: Map<string, CaoAgentSession> = new Map();

  constructor(endpoint = 'http://127.0.0.1:9889') {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  /**
   * Health check for local cao-server daemon
   */
  public async checkHealth(): Promise<{ ok: boolean; version?: string; message: string }> {
    try {
      if (typeof fetch === 'undefined') {
        return { ok: false, message: 'Fetch API not available' };
      }
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        this.isConnected = true;
        return {
          ok: true,
          version: data.version || '0.1.0',
          message: 'Connected to local CAO Orchestrator daemon.',
        };
      }
      this.isConnected = false;
      return {
        ok: false,
        message: `CAO server responded with HTTP ${response.status}`,
      };
    } catch {
      this.isConnected = false;
      return {
        ok: false,
        message: 'CAO Orchestrator daemon is not running on ' + this.endpoint,
      };
    }
  }

  /**
   * Spawns an agent session using CAO multi-agent orchestration
   */
  public async createSession(payload: {
    taskKey: string;
    taskTitle: string;
    instructions: string;
    provider: string;
    model?: string;
    workingDirectory: string;
    role?: 'supervisor' | 'worker' | 'reviewer';
  }): Promise<{ ok: boolean; session?: CaoAgentSession; error?: string }> {
    const sessionId = `cao-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const session: CaoAgentSession = {
      sessionId,
      provider: payload.provider,
      model: payload.model,
      status: 'starting',
      workingDirectory: payload.workingDirectory,
      createdAt: new Date().toISOString(),
      eventsCount: 0,
    };

    // This renderer service must never synthesize a CAO session. The official
    // CAO lifecycle is CLI-owned (`cao launch`, `cao session send`, and
    // `cao shutdown`), and Electron main is the only process allowed to run
    // those commands. Keeping this boundary explicit avoids a false-positive
    // "running" session when the daemon merely answers /health.
    if (!this.isConnected) {
      return { ok: false, error: 'CAO daemon is unavailable. Electron main must launch CAO before creating a session.' };
    }
    return { ok: false, error: 'CAO session creation is owned by Electron main; use desktopApi.agent.start().' };
  }

  /**
   * Normalizes raw event text from CAO or agent CLI stream into Task Hub standard format
   */
  public normalizeStreamEvent(rawEvent: any, sessionId: string): CaoNormalizedEvent {
    if (typeof rawEvent === 'string' || !rawEvent || typeof rawEvent !== 'object') {
      return {
        type: 'text',
        sessionId,
        provider: 'cao',
        content: rawEvent != null ? String(rawEvent) : '',
        timestamp: new Date().toISOString(),
      };
    }

    const type = rawEvent.event === 'init'
      ? 'init'
      : rawEvent.event === 'tool_call'
        ? 'tool_call'
        : rawEvent.event === 'result'
          ? 'turn_complete'
          : rawEvent.type === 'error'
            ? 'error'
            : 'text';

    const content = rawEvent.text || rawEvent.content || rawEvent.message || JSON.stringify(rawEvent);
    const tokenUsage = rawEvent.usage?.total_tokens
      ? {
          promptTokens: rawEvent.usage.prompt_tokens || 0,
          completionTokens: rawEvent.usage.completion_tokens || 0,
          totalTokens: rawEvent.usage.total_tokens || 0,
        }
      : undefined;

    let collaborationStyle: CaoCollaborationStyle | undefined;
    const searchable = `${content}\n${JSON.stringify(rawEvent)}`.toLowerCase();
    if (searchable.includes('handoff(') || (searchable.includes('handoff') && type === 'tool_call')) {
      collaborationStyle = 'sync_handoff';
    } else if (searchable.includes('assign(') || (searchable.includes('assign') && type === 'tool_call')) {
      collaborationStyle = 'async_assign';
    } else if (searchable.includes('send_message(') || (searchable.includes('send_message') && type === 'tool_call')) {
      collaborationStyle = 'direct_message';
    }

    return {
      type,
      sessionId,
      agentRole: rawEvent.role || 'worker',
      collaborationStyle,
      provider: rawEvent.provider || 'cao',
      content,
      timestamp: rawEvent.timestamp || new Date().toISOString(),
      tokenUsage,
    };
  }

  /**
   * Terminates an active CAO session
   */
  public async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    session.status = 'completed';
    // Actual CAO shutdown is deliberately handled by Electron main through
    // `cao shutdown --session`; this method only clears a renderer-side
    // compatibility mirror and never calls an undocumented REST endpoint.
    this.activeSessions.delete(sessionId);
    return true;
  }

  /**
   * Lists all tracked CAO sessions
   */
  public getActiveSessions(): CaoAgentSession[] {
    return Array.from(this.activeSessions.values());
  }
}

export const caoBridge = new CaoBridgeService();
