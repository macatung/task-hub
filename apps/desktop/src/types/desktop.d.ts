/**
 * TypeScript Type Definitions for Task Companion Desktop Studio
 */

export type AgentProvider = 'codex' | 'claude_code' | 'antigravity';

export type AgentExecutionPolicy = 'restricted' | 'workspace_write' | 'full_access';

export type AgentRoute = 'native' | 'cao';

export type CodexSandboxStatus = 'ready' | 'needs_setup' | 'unavailable' | 'unknown';

export interface CodexDiagnostic {
  ok: boolean;
  provider: 'codex';
  cli?: string;
  version?: string;
  sandbox: CodexSandboxStatus;
  summary: string;
  details: string[];
}

export interface AgentPreflightResult {
  ok: boolean;
  provider: AgentProvider;
  cli?: string;
  version?: string;
  repository?: string;
  summary?: string;
  error?: string;
  checks?: any[];
  details?: string[];
  autoRepairAvailable?: boolean;
  [key: string]: any;
}

export interface DesktopEnvironmentStatus {
  git: boolean;
  agy: boolean;
  codex: boolean;
  claude: boolean;
  issues: string[];
}

export type AgentRoleType = 'architect' | 'implementer' | 'tester' | 'auditor';

export interface AgentStageExecution {
  role: AgentRoleType;
  title: string;
  avatar: string;
  badge: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  terminalLogs: string[];
  toolCalls: Array<{
    id: string;
    toolName: string;
    args?: Record<string, any>;
    result?: string;
    status: 'running' | 'completed' | 'failed';
    expanded?: boolean;
  }>;
  outputArtifact?: string;
  evidence?: Record<string, any>;
}

export interface InterAgentContextPackage {
  sourceRole: AgentRoleType;
  targetRole: AgentRoleType;
  taskId: string;
  runId: string;
  planContent?: string;
  worktreePath?: string;
  gitDiffStat?: string;
  modifiedFiles?: string[];
  testOutput?: string;
  testPassRatio?: number;
  evidenceSummary?: string;
  timestamp: string;
}

declare global {
  interface Window {
    desktopApi?: any;
  }
}
