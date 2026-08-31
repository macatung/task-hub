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

export type CaoProvider = 'antigravity' | 'codex' | 'claude_code' | 'ollama' | 'vllm';

export function resolveCaoProviderModel(provider: CaoProvider | string, requestedModel?: string): string {
  if (requestedModel && requestedModel !== 'default') {
    return requestedModel.trim();
  }
  if (provider === 'antigravity') return 'gemini-3.7-flash';
  if (provider === 'claude_code') return 'claude-3-7-sonnet';
  if (provider === 'ollama') return 'qwen2.5-coder:32b';
  if (provider === 'vllm') return 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct';
  return 'gpt-5';
}

export function getCaoProviderCapabilities(provider: CaoProvider | string): string[] {
  if (provider === 'antigravity') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor', 'gemini_multimodal'];
  }
  if (provider === 'codex') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor', 'sandbox_isolation'];
  }
  if (provider === 'ollama') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'local_execution', 'offline_mode'];
  }
  if (provider === 'vllm') {
    return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'local_execution', 'high_throughput'];
  }
  return ['interactive', 'stream', 'resume', 'handoff', 'assign', 'cao_supervisor'];
}

export type CaoOrchestrationStrategy = 'workflow' | 'supervisor';

export type OrchestrationMode = CaoOrchestrationStrategy;
export type TaskPipelineVariant = 'fast-track' | 'strict';

export interface TaskPipelineVariantOptions {
  risk_level?: string | null;
  risk_tier?: string | null;
  complexity?: string | null;
  issue_type?: string | null;
  labels?: string[] | null;
  tags?: string[] | null;
  title?: string | null;
  description?: string | null;
}

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
  pipelineVariant?: TaskPipelineVariant;
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

/**
 * Resolves whether a task executes via the lean 2-step Fast-Track pipeline
 * (`implement -> evidence`) or the full 4-step Strict pipeline (`implement -> review -> evidence -> handoff`).
 */
export function resolveTaskPipelineVariant(task?: TaskPipelineVariantOptions | null): TaskPipelineVariant {
  if (!task) return 'strict';

  const riskTier = String(task.risk_tier || '').trim().toLowerCase();
  const riskLevel = String(task.risk_level || '').trim().toLowerCase();
  const complexity = String(task.complexity || '').trim().toLowerCase();
  const issueType = String(task.issue_type || '').trim().toLowerCase();
  const rawLabels = [...(Array.isArray(task.labels) ? task.labels : []), ...(Array.isArray(task.tags) ? task.tags : [])];
  const labels = rawLabels.map((l) => String(l || '').trim().toLowerCase()).filter(Boolean);
  const title = String(task.title || '').toLowerCase();

  // 1. Explicit risk_tier override takes highest precedence
  if (['fast-track', 'fast_track'].includes(riskTier)) {
    return 'fast-track';
  }
  if (['strict'].includes(riskTier)) {
    return 'strict';
  }

  // 2. Strict labels / security / critical domains
  const strictLabels = ['strict', 'security', 'core', 'core-backend', 'database', 'migration', 'auth', 'breaking-change', 'high-risk', 'critical'];
  if (labels.some((l) => strictLabels.some((sl) => l === sl || l.startsWith(sl) || l.includes(sl)))) {
    return 'strict';
  }
  if (['critical', 'high'].includes(riskTier) || ['critical', 'high', 'medium'].includes(riskLevel)) {
    return 'strict';
  }
  if (issueType === 'epic') {
    return 'strict';
  }

  // 3. Explicit low risk tier or level
  const fastTrackTiers = ['low', 'minor', 'trivial'];
  if (fastTrackTiers.includes(riskTier) || fastTrackTiers.includes(riskLevel)) {
    return 'fast-track';
  }

  // 4. Fast-track labels
  const fastTrackLabels = ['fast-track', 'fast_track', 'quick-fix', 'minor', 'trivial', 'low-risk', 'docs', 'documentation', 'style', 'styling', 'css', 'chore', 'refactor-minor'];
  if (labels.some((l) => fastTrackLabels.some((fl) => l === fl || l.includes(fl)))) {
    return 'fast-track';
  }

  // 5. Complexity cues
  if (['high', 'complex', 'critical', 'l', 'xl'].includes(complexity)) {
    return 'strict';
  }
  if (['low', 'trivial', 'simple', 'xs', 's'].includes(complexity)) {
    return 'fast-track';
  }

  // 6. Issue type cues
  if (['doc', 'docs', 'documentation', 'style', 'styling', 'chore', 'refactor', 'refactor-minor'].includes(issueType)) {
    return 'fast-track';
  }
  if (['bug', 'feature', 'story'].includes(issueType)) {
    return 'strict';
  }

  // 7. Title heuristic analysis for minor updates (when risk is undefined)
  const isMinorTitle = /\b(?:typo|readme|update\s+docs|docstring|fix\s+style|formatting|css\s+fix|cleanup\s+comments)\b/i.test(title);
  const isStrictTitle = /\b(?:auth|authentication|authorization|api|database|db|migration|security|crypto|payment|payments|billing|endpoint|endpoints|api\s+endpoints?|core\s+logic|breaking)\b/i.test(title);
  if (isMinorTitle && !isStrictTitle) {
    return 'fast-track';
  }

  // 8. Safe default fallback
  return 'strict';
}

export interface CaoWorkflowOptions {
  taskKey?: string;
  taskTitle: string;
  taskDescription?: string;
  implementProvider?: string;
  reviewProvider?: string;
  evidenceProvider?: string;
  handoffProvider?: string;
  implementModel?: string;
  reviewModel?: string;
  evidenceModel?: string;
  handoffModel?: string;
  providerEndpoints?: Record<string, string>;
  contextPack?: any;
  testInstruction?: string;
  customSteps?: CaoWorkflowStep[];
}

export function formatCaoStepProviderLines(
  provider: string,
  options?: {
    model?: string;
    endpoint?: string;
  }
): string[] {
  const lines = [`    provider: ${provider}`];
  const isLocal = provider === 'ollama' || provider === 'vllm';
  const model = options?.model || (isLocal ? resolveCaoProviderModel(provider as CaoProvider) : undefined);
  const endpoint = options?.endpoint || (isLocal ? (provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'http://127.0.0.1:8000/v1') : undefined);

  if (model) {
    lines.push(`    model: ${model}`);
  }

  if (endpoint || (isLocal && model)) {
    lines.push('    env:');
    if (endpoint) {
      lines.push(`      OPENAI_BASE_URL: ${endpoint}`);
    }
    if (model) {
      lines.push(`      MODEL: ${model}`);
    }
  }

  return lines;
}

export function generateCaoStandardWorkflowYaml(options: CaoWorkflowOptions): string {
  const key = options.taskKey || 'task';
  const implProvider = options.implementProvider || 'antigravity';
  const revProvider = options.reviewProvider || 'codex';
  const evProvider = options.evidenceProvider || 'antigravity';
  const hoProvider = options.handoffProvider || 'antigravity';

  const implLines = formatCaoStepProviderLines(implProvider, { model: options.implementModel, endpoint: options.providerEndpoints?.[implProvider] }).join('\n');
  const revLines = formatCaoStepProviderLines(revProvider, { model: options.reviewModel, endpoint: options.providerEndpoints?.[revProvider] }).join('\n');
  const evLines = formatCaoStepProviderLines(evProvider, { model: options.evidenceModel, endpoint: options.providerEndpoints?.[evProvider] }).join('\n');
  const hoLines = formatCaoStepProviderLines(hoProvider, { model: options.handoffModel, endpoint: options.providerEndpoints?.[hoProvider] }).join('\n');

  return `name: task-${key}-pipeline
description: ${yamlScalar(`Strict Task Hub workflow (Implement -> Review -> Evidence -> Handoff) for ${options.taskTitle}`)}
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
${implLines}
    agent: developer
    prompt: |
      Implement the solution for task: {{workflow.inputs.task_title}}
      Task title (literal fallback for CAO retry): ${yamlScalar(options.taskTitle)}
      Task details (literal fallback for CAO retry): ${yamlScalar(options.taskDescription || '')}
      Details: {{workflow.inputs.task_description}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and verify the working directory. All edits and commands must stay there.
      Follow clean code architecture, apply required modifications to the workspace, and list all changed files.
      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.
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
${revLines}
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
      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.
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
${evLines}
    agent: developer
    prompt: |
      Execute test verification and capture evidence for: {{workflow.inputs.task_title}}
      Review feedback: {{steps.review.output.feedback}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and run all tests from that directory.
      Run workspace test commands and verify that all test suites pass with zero regressions.
      Do not modify files or delegate. You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid.
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
${hoLines}
    agent: reviewer
    prompt: |
      Synthesize the final handoff summary for Task Hub:
      Task: {{workflow.inputs.task_title}}
      Implementation Summary: {{steps.implement.output.change_summary}}
      Review Verdict: {{steps.review.output.verdict}} (Risk Score: {{steps.review.output.risk_score}})
      Test Evidence: {{steps.evidence.output.test_pass_count}} passed, {{steps.evidence.output.test_fail_count}} failed.
      Output the structured marker <TASK_HUB_HANDOFF> with summary, changed files, and verified evidence.
      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.
`;
}

export function generateCaoFastTrackWorkflowYaml(options: CaoWorkflowOptions): string {
  const key = options.taskKey || 'task';
  const implProvider = options.implementProvider || 'antigravity';
  const evProvider = options.evidenceProvider || options.implementProvider || 'antigravity';
  let contextPackText = '';
  if (options.contextPack) {
    if (typeof options.contextPack === 'string') {
      const indented = options.contextPack
        .split('\n')
        .map((line, i) => (i === 0 ? line : `      ${line}`))
        .join('\n');
      contextPackText = `\n      Context pack: ${indented}`;
    } else {
      contextPackText = `\n      Context pack: ${JSON.stringify(options.contextPack)}`;
    }
  }
  const testCmdInstruction = options.testInstruction
    ? `Run test suite: ${options.testInstruction}. `
    : 'Run workspace test commands (e.g. npm test, vitest, pytest, cargo test) and verify all pass. ';

  const implLines = formatCaoStepProviderLines(implProvider, { model: options.implementModel, endpoint: options.providerEndpoints?.[implProvider] }).join('\n');
  const evLines = formatCaoStepProviderLines(evProvider, { model: options.evidenceModel, endpoint: options.providerEndpoints?.[evProvider] }).join('\n');

  return `name: task-${key}-pipeline
description: ${yamlScalar(`Fast-Track Task Hub workflow (Implement -> Evidence & Handoff) for ${options.taskTitle}`)}
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
${implLines}
    agent: developer
    prompt: |
      Implement the solution for fast-track task: {{workflow.inputs.task_title}}
      Task title (literal fallback for CAO retry): ${yamlScalar(options.taskTitle)}
      Task details (literal fallback for CAO retry): ${yamlScalar(options.taskDescription || '')}
      Details: {{workflow.inputs.task_description}}${contextPackText}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and verify the working directory. All edits and commands must stay there.
      Apply required modifications to the workspace with clean code architecture and list all changed files.
      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.
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

  - id: evidence
${evLines}
    agent: developer
    prompt: |
      Execute test verification, capture evidence, and synthesize final handoff for fast-track task: {{workflow.inputs.task_title}}
      Task title (literal fallback for CAO retry): ${yamlScalar(options.taskTitle)}
      Implementation Summary: {{steps.implement.output.change_summary}}
      Modified files: {{steps.implement.output.modified_files}}
      Workspace: {{workflow.inputs.workspace_path}}
      First run \`cd -- "{{workflow.inputs.workspace_path}}"\` and run all tests from that directory.
      ${testCmdInstruction}Verify that all test suites pass with zero regressions.
      Synthesize verification evidence and emit structured handoff markers:
      <!-- HANDOFF:START -->
      {
        "summary": {{steps.implement.output.change_summary}},
        "changed_files": {{steps.implement.output.modified_files}},
        "tests": "automated test suite verification",
        "test_pass_count": <number>,
        "test_fail_count": <number>,
        "status": "passed"
      }
      <!-- HANDOFF:END -->
      Also output the structured marker <TASK_HUB_HANDOFF> with summary, changed files, and verified evidence.
      Do not delegate. You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.
    output_schema:
      type: object
      required:
        - test_pass_count
        - test_fail_count
        - status
        - summary
        - changed_files
      properties:
        test_pass_count:
          type: number
        test_fail_count:
          type: number
        status:
          type: string
          enum: [passed, failed, skipped]
        summary:
          type: string
        changed_files:
          type: array
          items:
            type: string
        handoff_payload:
          type: object
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
    model?: string;
    endpoint?: string;
  },
) {
  const inputPrefix = `task_${step.taskId}`;
  const stepProviderLines = formatCaoStepProviderLines(step.provider, { model: step.model, endpoint: step.endpoint });
  lines.push(
    `  - id: ${step.id}-implement`,
    ...stepProviderLines,
    '    agent: developer',
    '    prompt: |',
    `      Implement only ${step.taskKey}: {{workflow.inputs.${inputPrefix}_title}}`,
    `      Task title (literal fallback for CAO retry): ${yamlScalar(step.title)}`,
    `      Task description (literal fallback for CAO retry): ${yamlScalar(step.description || '')}`,
    `      Description: {{workflow.inputs.${inputPrefix}_description}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      First run `cd -- "{{workflow.inputs.workspace_path}}"` and verify the working directory. All edits and commands must stay there.',
    '      Work in the supplied isolated workspace. Do not delegate to another agent.',
    '      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.',
    '    output_schema:',
    '      type: object',
    '      required: [task_id, modified_files, change_summary]',
    '      properties:',
    '        task_id: {type: integer}',
    '        modified_files: {type: array, items: {type: string}}',
    '        change_summary: {type: string}',
    '',
    `  - id: ${step.id}-review`,
    ...stepProviderLines,
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
    '      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.',
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
    ...stepProviderLines,
    '    agent: developer',
    '    prompt: |',
    `      Run the relevant tests for ${step.taskKey} in the isolated workspace.`,
    `      Review verdict: {{steps.${step.id}-review.output.verdict}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      First run `cd -- "{{workflow.inputs.workspace_path}}"` and run all tests from that directory.',
    '      Do not delegate. You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid.',
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
    ...stepProviderLines,
    '    agent: reviewer',
    '    prompt: |',
    `      Prepare the strict Task Hub handoff for ${step.taskKey}.`,
    `      Summary: {{steps.${step.id}-implement.output.change_summary}}`,
    `      Review: {{steps.${step.id}-review.output.feedback}}`,
    `      Evidence: {{steps.${step.id}-evidence.output.status}}`,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      Do not modify files or delegate. You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.',
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
  model?: string;
  endpoint?: string;
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
      model: options.model,
      endpoint: options.endpoint,
    });
  }
  const finalStepRefs = order.ordered.map((task, index) => {
    const stepId = `child-${index + 1}-${task.id}-handoff`;
    return `      ${stepId}: {{steps.${stepId}.output}}`;
  });
  const finalizeLines = formatCaoStepProviderLines(provider, { model: options.model, endpoint: options.endpoint });
  lines.push(
    '  - id: epic-finalize',
    ...finalizeLines,
    '    agent: reviewer',
    '    prompt: |',
    `      Aggregate the verified handoffs for Epic ${epicKey}.`,
    ...finalStepRefs,
    '      Workspace: {{workflow.inputs.workspace_path}}',
    '      Return one aggregate Task Hub handoff. Do not modify files or delegate.',
    '      You MUST call the workflow_return MCP tool exactly once with one output argument whose value matches output_schema: workflow_return({"output": {...}}). A prose response alone is invalid; do not finish until the tool call succeeds.',
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
