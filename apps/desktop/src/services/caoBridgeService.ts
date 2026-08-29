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

export interface CaoWorkflowRunStatus {
  runId: string;
  state: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';
  currentStep?: string;
  totalSteps?: number;
  completedSteps: string[];
  error?: string;
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
description: "Standard 4-step workflow (Implement -> Review -> Evidence -> Handoff) for ${options.taskTitle.replace(/"/g, '\\"')}"
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
    prompt: |
      Implement the solution for task: {{workflow.inputs.task_title}}
      Details: {{workflow.inputs.task_description}}
      Follow clean code architecture, apply required modifications to the workspace, and list all changed files.
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
    prompt: |
      Perform automated code review for: {{workflow.inputs.task_title}}
      Change summary: {{steps.implement.output.change_summary}}
      Modified files: {{steps.implement.output.modified_files}}
      Review for logic bugs, performance, security, and edge cases. Provide clear verdict.
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
    prompt: |
      Execute test verification and capture evidence for: {{workflow.inputs.task_title}}
      Review feedback: {{steps.review.output.feedback}}
      Run workspace test commands and verify that all test suites pass with zero regressions.
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
    prompt: |
      Synthesize the final handoff summary for Task Hub:
      Task: {{workflow.inputs.task_title}}
      Implementation Summary: {{steps.implement.output.change_summary}}
      Review Verdict: {{steps.review.output.verdict}} (Risk Score: {{steps.review.output.risk_score}})
      Test Evidence: {{steps.evidence.output.test_pass_count}} passed, {{steps.evidence.output.test_fail_count}} failed.
      Output the structured marker <TASK_HUB_HANDOFF> with summary, changed files, and verified evidence.
`;
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
    state: 'RUNNING',
    completedSteps: [],
  };

  if (!output) return result;

  const runIdMatch = output.match(/run[-_ ]?(?:id)?[:= ]+([a-zA-Z0-9_-]+)/i);
  if (runIdMatch) result.runId = runIdMatch[1];

  const statusLineMatch = output.match(/(?:overall\s+)?status[:=\s]+(RUNNING|COMPLETED|SUCCESS|INTERRUPTED|ABORTED|FAILED|ERROR)/i);
  if (statusLineMatch) {
    const raw = statusLineMatch[1].toUpperCase();
    if (raw === 'COMPLETED' || raw === 'SUCCESS') result.state = 'COMPLETED';
    else if (raw === 'INTERRUPTED' || raw === 'ABORTED') result.state = 'INTERRUPTED';
    else if (raw === 'FAILED' || raw === 'ERROR') result.state = 'FAILED';
    else result.state = 'RUNNING';
  } else if (/run\s+completed|workflow\s+completed/i.test(output)) {
    result.state = 'COMPLETED';
  } else if (/run\s+interrupted|workflow\s+interrupted/i.test(output)) {
    result.state = 'INTERRUPTED';
  } else if (/run\s+failed|workflow\s+failed/i.test(output)) {
    result.state = 'FAILED';
  } else {
    result.state = 'RUNNING';
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
