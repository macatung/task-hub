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
  error?: string;
  details?: string[];
  autoRepairAvailable?: boolean;
}

export interface DesktopEnvironmentStatus {
  git: boolean;
  agy: boolean;
  codex: boolean;
  claude: boolean;
  issues: string[];
}

declare global {
  interface Window {
    desktopApi?: {
      openExternal?: (url: string) => Promise<void>;
      toggleFullscreen?: (flag?: boolean) => Promise<boolean>;
      taskHub?: {
        getCredential?: () => Promise<any>;
        saveCredential?: (cred: any) => Promise<any>;
        startPairing?: (taskHubUrl: string, projectId: string) => Promise<any>;
        pollPairing?: (taskHubUrl: string, pairingId: string, secret: string) => Promise<any>;
        getCapabilities?: (taskHubUrl: string) => Promise<any>;
        mcpCall?: (taskHubUrl: string, token: string, projectId: string, method: string, params: any) => Promise<any>;
        importGeneratedDocuments?: (url: string, token: string, projectId: string, payload: any) => Promise<any>;
      };
      environment?: {
        repair?: (provider: AgentProvider, cwd: string) => Promise<any>;
        preflight?: (provider: AgentProvider, cwd: string) => Promise<AgentPreflightResult>;
        quickSetup?: (cwd: string, installDependencies?: boolean) => Promise<any>;
      };
      agent?: {
        codexDiagnostics?: () => Promise<CodexDiagnostic>;
        runtimeStatus?: () => Promise<any>;
        bootstrapRuntimes?: () => Promise<any>;
        pickWorkspace?: () => Promise<string | null>;
        listWorkspaces?: () => Promise<string[]>;
        saveWorkspace?: (cwd: string) => Promise<string[]>;
        removeWorkspace?: (cwd: string) => Promise<string[]>;
        preflight?: (provider: AgentProvider, cwd: string) => Promise<AgentPreflightResult>;
        quickSetup?: (cwd: string, installDependencies?: boolean) => Promise<any>;
        repairEnvironment?: (provider: AgentProvider, cwd: string) => Promise<any>;
        createWorktree?: (repository: string, issueKey: string) => Promise<string>;
        openWorkspace?: (cwd: string) => Promise<void>;
        cleanupWorktree?: (repository: string, worktree: string) => Promise<any>;
        runTest?: (options: { cwd: string; command?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>;
        readGeneratedDocuments?: (worktree: string) => Promise<any>;
        applyDocsToWorkspace?: (worktree: string, destinationWorkspace: string) => Promise<any>;
        configureMcp?: (options: { cwd: string; provider: string; taskHubUrl: string; projectId: string; token: string }) => Promise<any>;
        start?: (provider: string, cwd: string, prompt?: string, model?: string) => Promise<{ sessionId: string; route?: 'cao' }>;
        startInteractive?: (
          provider: string,
          cwd: string,
          prompt?: string,
          kind?: 'task' | 'docs',
          model?: string,
          executionPolicy?: AgentExecutionPolicy
        ) => Promise<{ sessionId: string; route?: 'cao' }>;
        listAvailableModels?: (provider?: string, options?: { forceRefresh?: boolean; taskHubUrl?: string }) => Promise<any[]>;
        saveCustomModel?: (provider: string, model: { id: string; name?: string; badges?: string[]; description?: string }) => Promise<any>;
        deleteCustomModel?: (provider: string, modelId: string) => Promise<any>;
        getQuotaUsage?: () => Promise<any>;
        syncQuotaUsage?: (taskHubUrl?: string) => Promise<any>;
        updateQuotaSettings?: (settings: { enableCreditOverages?: boolean; plan?: string }) => Promise<any>;
        listSessions?: () => Promise<any[]>;
        reconnectCaoSession?: (sessionId: string) => Promise<{ sessionId: string; route: 'cao'; status: string; workers: any[] }>;
        saveSessionState?: (state: any) => Promise<any>;
        listSavedSessions?: () => Promise<any[]>;
        getSessionState?: (sessionId: string) => Promise<any>;
        deleteSavedSession?: (sessionId: string) => Promise<any>;
        openSessionLog?: (sessionId: string) => Promise<void>;
        logActivity?: (cwd: string, sessionId: string | null, activity: { label: string; detail: string; tone: string }) => Promise<void>;
        readFile?: (cwd: string, relativePath: string) => Promise<string>;
        listFiles?: (cwd: string, maxFiles?: number) => Promise<string[]>;
        getGitDiff?: (cwd: string) => Promise<string>;
        revertFile?: (cwd: string, relativePath: string) => Promise<any>;
        stageFile?: (cwd: string, relativePath: string) => Promise<any>;
        listSkills?: (workspacePath?: string) => Promise<any[]>;
        readSkill?: (skillPath: string) => Promise<any>;
        listMcpServers?: () => Promise<any[]>;
        listRules?: (workspacePath?: string) => Promise<any[]>;
        listScheduledTasks?: () => Promise<any[]>;
        createSchedule?: (task: any) => Promise<any>;
        cancelSchedule?: (id: string) => Promise<any>;
        getPermissions?: () => Promise<any>;
        savePermissions?: (perms: any) => Promise<any>;
        send?: (sessionId: string, input: string) => void;
        stop?: (sessionId: string) => Promise<void>;
        onOutput?: (callback: (event: { sessionId: string; stream: string; text: string }) => void) => () => void;
        onExit?: (callback: (event: { sessionId: string; code: number | null; signal: string | null }) => void) => () => void;
        onQuotaUpdated?: (callback: (quota: any) => void) => () => void;
      };
      cao?: {
        getStatus?: () => Promise<{ running: boolean; available: boolean; port: number; cli: string | null; embeddedBinary: string | null; source: 'embedded' | 'external' | 'offline' }>;
        restartDaemon?: () => Promise<{ status: string; source?: string; executable?: string; message?: string }>;
      };
    };
  }
}
