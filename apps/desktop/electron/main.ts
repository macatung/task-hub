import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog, clipboard, shell, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import { spawn as spawnPty, IPty } from 'node-pty';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable GPU disk cache locks that cause "Access is denied" when launching multiple instances
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
// On this Windows environment the sandboxed GPU child process cannot load.
// Keeping GPU work in Electron's main process avoids the renderer crash.
app.commandLine.appendSwitch('in-process-gpu');

// Single instance lock to prevent duplicate overlapping desktop pets in packaged mode
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
type AgentProvider = 'codex' | 'claude_code' | 'antigravity';
type AgentRoute = 'native' | '9router' | 'cao';
type LocalRouterConfig = { enabled: boolean; endpoint: 'http://127.0.0.1:20128/v1'; apiKey: string };
type AgentSession = {
  process?: IPty | ReturnType<typeof spawn>;
  provider: AgentProvider;
  model?: string;
  cwd: string;
  mode: 'interactive' | 'external' | 'exec';
  kind: 'task' | 'docs';
  output: string;
  threadId?: string;
  events?: Array<any>;
  route?: AgentRoute;
  executionPolicy?: AgentExecutionPolicy;
  caoSessionName?: string;
  caoLastStatus?: string;
  caoLastOutput?: string;
};
const agentProcesses = new Map<string, AgentSession>();
const caoSessionPollers = new Map<string, NodeJS.Timeout>();
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
let updateState: { status: UpdateStatus; version?: string; percent?: number; message?: string } = { status: 'idle' };
let updateTimer: NodeJS.Timeout | undefined;
let quotaSyncTimer: NodeJS.Timeout | undefined;

/**
 * Policies intentionally map to the provider CLI rather than being a vague
 * UI-only setting.  A local run starts with the least permissions that can
 * edit an isolated worktree.  Escalation to full access is only possible
 * after the renderer records a human approval.
 */
type AgentExecutionPolicy = 'restricted' | 'workspace_write' | 'full_access';
const AGENT_COMMANDS: Record<Exclude<AgentProvider, 'antigravity'>, { command: string; args: string[]; capabilities: string[] }> = {
  codex: { command: 'codex', args: ['--no-alt-screen'], capabilities: ['interactive', 'stream', 'resume', 'handoff'] },
  claude_code: { command: 'claude', args: [], capabilities: ['interactive', 'stream', 'resume', 'handoff'] },
};
const PROVIDER_CAPABILITIES: Record<AgentProvider, string[]> = {
  codex: AGENT_COMMANDS.codex.capabilities,
  claude_code: AGENT_COMMANDS.claude_code.capabilities,
  antigravity: ['external_session', 'handoff'],
};
function executionPolicyArgs(provider: AgentProvider, policy: AgentExecutionPolicy): string[] {
  if (provider === 'codex') {
    if (policy === 'full_access') return ['--dangerously-bypass-approvals-and-sandbox'];
    // `restricted` is retained for saved sessions from earlier releases.
    if (policy === 'restricted') return ['--sandbox', 'read-only'];
    return ['--sandbox', 'workspace-write'];
  }
  if (policy !== 'full_access') return [];
  if (provider === 'claude_code' || provider === 'antigravity') return ['--dangerously-skip-permissions'];
  return [];
}

// `--ask-for-approval` is a Codex global option, so it must precede the
// `exec` subcommand. Keeping this separate prevents an otherwise opaque
// "unexpected argument" failure when starting a run.
function codexApprovalArgs(policy: AgentExecutionPolicy): string[] {
  if (policy === 'full_access') return [];
  return ['--ask-for-approval', 'on-request'];
}

type CodexDiagnostic = {
  ok: boolean;
  provider: 'codex';
  cli?: string;
  version?: string;
  sandbox: 'ready' | 'needs_setup' | 'unavailable' | 'unknown';
  summary: string;
  details: string[];
};

async function codexDiagnostics(): Promise<CodexDiagnostic> {
  const cli = resolveCli('codex');
  if (!cli) return { ok: false, provider: 'codex', sandbox: 'unavailable', summary: 'Codex CLI was not found.', details: ['Install Codex CLI, then run diagnostics again.'] };
  try {
    const version = execFileSync(cli, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 }).trim();
    let rawText = '';
    try {
      rawText = execFileSync(cli, ['doctor', '--json'], { encoding: 'utf8', windowsHide: true, timeout: 25_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (error: any) {
      rawText = `${error?.stdout?.toString?.() || ''}\n${error?.stderr?.toString?.() || ''}`.trim();
    }
    let raw: unknown;
    try { raw = rawText ? JSON.parse(rawText) : undefined; } catch { raw = undefined; }
    const searchable = `${rawText}\n${JSON.stringify(raw || '')}`.toLowerCase();
    const needsSetup = /sandbox.*(setup|helper|missing|fail)|codex-windows-sandbox-setup|logon rights/.test(searchable);
    const unavailable = /sandbox.*(unavailable|not supported)|could not find.*sandbox/.test(searchable);
    const sandbox = needsSetup ? 'needs_setup' : unavailable ? 'unavailable' : rawText ? 'ready' : 'unknown';
    const details = needsSetup
      ? ['Windows sandbox setup needs attention. Ask an administrator to complete setup, or approve one isolated full-access retry.']
      : unavailable
        ? ['The Codex sandbox is unavailable on this machine. Use a supported sandbox configuration or approve a controlled retry.']
        : ['Codex CLI diagnostics completed.'];
    return { ok: !needsSetup && !unavailable, provider: 'codex', cli, version, sandbox, summary: needsSetup ? 'Windows sandbox setup is incomplete.' : unavailable ? 'Codex sandbox is unavailable.' : 'Codex diagnostics completed.', details };
  } catch (error: any) {
    return { ok: false, provider: 'codex', cli, sandbox: 'unknown', summary: 'Could not run Codex diagnostics.', details: [error?.message || 'Unknown diagnostic error.'] };
  }
}

type DesktopCredential = { taskHubUrl: string; token: string; projectId: string; projectTitle?: string };

function desktopCredentialPath() { return path.join(app.getPath('userData'), 'task-hub-credential.bin'); }
function localRouterConfigPath() { return path.join(app.getPath('userData'), 'task-companion', '9router-config.bin'); }
function savedAgentWorkspacesPath() { return path.join(app.getPath('userData'), 'agent-workspaces.json'); }
function savedSessionsPath() { return path.join(app.getPath('userData'), 'agent-saved-sessions.json'); }

/**
 * Keep run diagnostics beside the repository rather than only in Electron's
 * opaque AppData directory.  This makes a failed local-agent run inspectable
 * from the same worktree that produced it.
 */
function workspaceAgentDirectory(cwd: string) {
  return path.join(cwd, '.macatung', 'agent');
}
function stageAgentPrompt(cwd: string, sessionId: string, prompt?: string) {
  const text = prompt?.trim() || 'Analyze repository and start execution.';
  // Windows has a small process-command-line limit. Context packs can be far
  // larger, so hand them to the local CLI through a workspace file instead of
  // passing the whole payload as a spawn argument.
  const directory = path.join(workspaceAgentDirectory(cwd), 'prompts');
  fs.mkdirSync(directory, { recursive: true });
  const promptFile = path.join(directory, `${sessionId}.md`);
  // A BOM keeps Windows PowerShell 5.x from interpreting Vietnamese UTF-8 as
  // the current ANSI code page when the agent reads this file.
  fs.writeFileSync(promptFile, `\uFEFF${text}`, 'utf8');
  return [
    'Task Hub Desktop execution protocol:',
    '1. Read and follow the complete task instructions from this exact local file:',
    promptFile,
    '2. Do not report the task as completed until those instructions have been read and the requested work is done.',
    '3. If the file cannot be read, stop and respond exactly with `TASK_HUB_RUN_BLOCKED: unable to read staged task instructions` plus the reason. Do not claim success.',
  ].join('\n');
}
function workspaceSessionIndexPath(cwd: string) {
  return path.join(workspaceAgentDirectory(cwd), 'sessions.json');
}
function redactAgentLog(value: string) {
  return value
    .replace(/(Bearer\s+)[^\s"'}]+/gi, '$1[REDACTED]')
    .replace(/("(?:authorization|token|api[_-]?key|secret)"\s*:\s*")[^"]+("?)/gi, '$1[REDACTED]$2')
    .replace(/((?:authorization|token|api[_-]?key|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}
function appendWorkspaceAgentLog(cwd: string, sessionId: string, type: string, payload: unknown) {
  try {
    const directory = workspaceAgentDirectory(cwd);
    fs.mkdirSync(directory, { recursive: true });
    const entry = JSON.stringify({ at: new Date().toISOString(), type, payload: redactAgentLog(JSON.stringify(payload)) });
    fs.appendFileSync(path.join(directory, `${sessionId}.jsonl`), `${entry}\n`, 'utf8');
  } catch (error) {
    console.warn('Failed to append workspace agent log:', error);
  }
}
function writeWorkspaceSessionIndex(session: PersistedSessionData) {
  try {
    const directory = workspaceAgentDirectory(session.worktree || session.cwd);
    const file = workspaceSessionIndexPath(session.worktree || session.cwd);
    fs.mkdirSync(directory, { recursive: true });
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    const items = Array.isArray(existing) ? existing.filter((item) => item?.sessionId !== session.sessionId) : [];
    items.unshift({
      sessionId: session.sessionId,
      provider: session.provider,
      model: session.model,
      kind: session.kind,
      mode: session.mode,
      route: session.route || 'native',
      executionPolicy: session.executionPolicy || 'restricted',
      status: session.status,
      exitCode: session.exitCode,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      log: `.macatung/agent/${session.sessionId}.jsonl`,
    });
    fs.writeFileSync(file, `${JSON.stringify(items.slice(0, 60), null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn('Failed to write workspace session index:', error);
  }
}

export type PersistedSessionData = {
  sessionId: string;
  provider: AgentProvider;
  model?: string;
  cwd: string;
  worktree?: string;
  sourceWorkspace?: string;
  taskId?: number | null;
  taskTitle?: string;
  issueKey?: string;
  mode: 'interactive' | 'external' | 'exec';
  route?: AgentRoute;
  executionPolicy?: AgentExecutionPolicy;
  caoSessionName?: string;
  caoLastOutput?: string;
  kind: 'task' | 'docs';
  threadId?: string;
  output: string;
  events?: Array<any>;
  streamCards?: Array<any>;
  timeline?: Array<any>;
  handoff?: any;
  status: 'running' | 'completed' | 'interrupted' | 'failed';
  exitCode?: number | null;
  startedAt: string;
  updatedAt: string;
  durationSeconds?: number;
};

function readAllSavedSessions(): PersistedSessionData[] {
  try {
    const file = savedSessionsPath();
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Failed to read saved sessions:', e);
    return [];
  }
}

function writeAllSavedSessions(sessions: PersistedSessionData[]) {
  try {
    const file = savedSessionsPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(sessions.slice(0, 60), null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write saved sessions:', e);
  }
}

function persistSessionUpdate(partial: Partial<PersistedSessionData> & { sessionId: string }) {
  const sessions = readAllSavedSessions();
  const index = sessions.findIndex((s) => s.sessionId === partial.sessionId);
  const now = new Date().toISOString();
  if (index >= 0) {
    sessions[index] = {
      ...sessions[index],
      ...partial,
      updatedAt: now,
    };
  } else {
    sessions.unshift({
      provider: 'codex',
      cwd: process.cwd(),
      mode: 'exec',
      kind: 'task',
      output: '',
      status: 'running',
      startedAt: now,
      updatedAt: now,
      ...partial,
    });
  }
  const saved = sessions.find((session) => session.sessionId === partial.sessionId);
  if (saved) writeWorkspaceSessionIndex(saved);
  writeAllSavedSessions(sessions);
}

function deleteSavedSession(sessionId: string) {
  const sessions = readAllSavedSessions().filter((s) => s.sessionId !== sessionId);
  writeAllSavedSessions(sessions);
  agentProcesses.delete(sessionId);
}

function readSavedAgentWorkspaces(): string[] {
  try {
    const value = JSON.parse(fs.readFileSync(savedAgentWorkspacesPath(), 'utf8'));
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && fs.existsSync(item) && fs.statSync(item).isDirectory()) : [];
  } catch { return []; }
}
function writeSavedAgentWorkspaces(workspaces: string[]) {
  fs.mkdirSync(path.dirname(savedAgentWorkspacesPath()), { recursive: true });
  fs.writeFileSync(savedAgentWorkspacesPath(), `${JSON.stringify(workspaces, null, 2)}\n`, 'utf8');
  return workspaces;
}
function saveDesktopCredential(credential: DesktopCredential) {
  try {
    fs.mkdirSync(path.dirname(desktopCredentialPath()), { recursive: true });
    const raw = JSON.stringify(credential);
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure OS credential storage is unavailable. Credentials were not saved.');
    }
    fs.writeFileSync(desktopCredentialPath(), safeStorage.encryptString(raw));
    return true;
  } catch (error) {
    console.error('Failed to save desktop credential:', error);
    return false;
  }
}
function loadDesktopCredential(): DesktopCredential | null {
  const file = desktopCredentialPath();
  if (!fs.existsSync(file)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const buffer = fs.readFileSync(file);
    const decrypted = safeStorage.decryptString(buffer);
    return JSON.parse(decrypted) as DesktopCredential;
  } catch (error) {
    console.warn('Failed to load desktop credential from file:', error);
    return null;
  }
}

function clearDesktopCredential() {
  const file = desktopCredentialPath();
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  return true;
}

const LOCAL_ROUTER_ENDPOINT = 'http://127.0.0.1:20128/v1' as const;

function saveLocalRouterConfig(input: Partial<LocalRouterConfig>) {
  const current = loadLocalRouterConfig();
  const config: LocalRouterConfig = {
    enabled: Boolean(input.enabled),
    endpoint: LOCAL_ROUTER_ENDPOINT,
    apiKey: typeof input.apiKey === 'string' ? input.apiKey.trim() : current.apiKey,
  };
  if (config.enabled && !config.apiKey) throw new Error('Enter the local 9Router API key before enabling routing.');
  fs.mkdirSync(path.dirname(localRouterConfigPath()), { recursive: true });
  const raw = JSON.stringify(config);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(localRouterConfigPath(), safeStorage.encryptString(raw));
  } else {
    fs.writeFileSync(localRouterConfigPath(), Buffer.from(raw, 'utf8').toString('base64'), 'utf8');
  }
  return getPublicLocalRouterConfig();
}

function takeJsonObjects(input: string): { objects: string[]; remainder: string } {
  const objects: string[] = []; let start = -1; let depth = 0; let inString = false; let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (start < 0) { if (char === '{') { start = index; depth = 1; } continue; }
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') { depth -= 1; if (depth === 0) { objects.push(input.slice(start, index + 1)); start = -1; } }
  }
  return { objects, remainder: start >= 0 ? input.slice(start) : '' };
}

function summarizeCommandOutput(command: string, output: string) {
  if (/\\\.macatung\\agent\\prompts\\/i.test(command)) return 'Read staged task brief.';
  const compact = output.trim();
  if (!compact) return '';
  return compact.length > 1600 ? `${compact.slice(0, 1600)}\n… output truncated` : compact;
}

function loadLocalRouterConfig(): LocalRouterConfig {
  const fallback: LocalRouterConfig = { enabled: false, endpoint: LOCAL_ROUTER_ENDPOINT, apiKey: '' };
  const file = localRouterConfigPath();
  if (!fs.existsSync(file)) return fallback;
  try {
    const raw = fs.readFileSync(file);
    let value = '';
    if (safeStorage.isEncryptionAvailable()) {
      try { value = safeStorage.decryptString(raw); } catch { /* legacy/base64 fallback */ }
    }
    if (!value) value = Buffer.from(raw.toString('utf8'), 'base64').toString('utf8');
    const data = JSON.parse(value);
    return { enabled: Boolean(data?.enabled), endpoint: LOCAL_ROUTER_ENDPOINT, apiKey: typeof data?.apiKey === 'string' ? data.apiKey : '' };
  } catch { return fallback; }
}

function getPublicLocalRouterConfig() {
  const config = loadLocalRouterConfig();
  return { enabled: config.enabled, endpoint: config.endpoint, hasApiKey: Boolean(config.apiKey) };
}

function clearLocalRouterConfig() {
  const file = localRouterConfigPath();
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  return getPublicLocalRouterConfig();
}

async function checkLocalRouter(includeModels = false) {
  const config = loadLocalRouterConfig();
  const healthUrl = 'http://127.0.0.1:20128/health';
  try {
    const health = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error(`Local service returned ${health.status}.`);
    let models: DiscoveredModel[] = [];
    if (includeModels && config.apiKey) {
      const response = await fetch(`${LOCAL_ROUTER_ENDPOINT}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Model list returned ${response.status}. Check the 9Router API key.`);
      const body: any = await response.json();
      models = Array.isArray(body?.data) ? body.data.map((item: any) => ({ id: String(item.id), name: String(item.name || item.id), badges: ['9Router', 'Local'], description: 'Model discovered from local 9Router.', source: 'cli' as const })).filter((item: DiscoveredModel) => item.id) : [];
    }
    return { ok: true, endpoint: LOCAL_ROUTER_ENDPOINT, models };
  } catch (error: any) {
    return { ok: false, endpoint: LOCAL_ROUTER_ENDPOINT, models: [], error: error?.message || '9Router is not available on 127.0.0.1:20128.' };
  }
}

function getCandidateBinDirs(): string[] {
  if (process.platform !== 'win32') {
    return ['/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin', '/usr/local/git/bin'];
  }
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const userProfile = process.env.USERPROFILE || os.homedir();
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programData = process.env.ProgramData || 'C:\\ProgramData';

  return [
    path.join(appData, 'npm'),
    path.join(localAppData, 'agy', 'bin'),
    path.join(localAppData, 'Programs', 'Antigravity', 'bin'),
    path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin'),
    path.join(localAppData, 'Programs', 'Codex', 'bin'),
    path.join(localAppData, 'Programs', 'OpenAI', 'bin'),
    path.join(localAppData, 'Programs', 'Claude', 'bin'),
    path.join(localAppData, 'Programs', 'Anthropic', 'bin'),
    path.join(localAppData, 'Programs', 'Git', 'cmd'),
    path.join(localAppData, 'Programs', 'Git', 'bin'),
    path.join(localAppData, 'pnpm'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
    path.join(localAppData, 'Microsoft', 'WindowsApps'),
    path.join(userProfile, '.antigravity', 'antigravity', 'bin'),
    path.join(userProfile, '.gemini', 'antigravity', 'bin'),
    path.join(userProfile, '.codex', 'bin'),
    path.join(userProfile, '.claude', 'bin'),
    path.join(userProfile, '.cargo', 'bin'),
    path.join(userProfile, 'scoop', 'shims'),
    path.join(userProfile, 'scoop', 'apps', 'git', 'current', 'cmd'),
    path.join('C:\\scoop', 'shims'),
    path.join(programData, 'chocolatey', 'bin'),
    path.join(programFiles, 'Git', 'cmd'),
    path.join(programFiles, 'Git', 'bin'),
    path.join(programFilesX86, 'Git', 'cmd'),
    path.join(programFilesX86, 'Git', 'bin'),
    path.join(programFiles, 'nodejs'),
    path.join(programFilesX86, 'nodejs'),
    path.join(programFiles, 'OpenAI', 'Codex', 'bin'),
    path.join(programFiles, 'Codex'),
    path.join(programFiles, 'Antigravity'),
    path.join(programFiles, 'ComposerSetup', 'bin'),
    path.join(programData, 'ComposerSetup', 'bin'),
    path.join(appData, 'Composer', 'vendor', 'bin'),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
}

function nativeAgentEnvironment() {
  const env = { ...process.env } as Record<string, string>;
  const runtimeBins = getCandidateBinDirs();
  env.PATH = [...runtimeBins, env.PATH || ''].join(path.delimiter);
  const config = loadLocalRouterConfig();
  for (const key of ['OPENAI_BASE_URL', 'ANTHROPIC_BASE_URL']) {
    if (env[key]?.includes('127.0.0.1:20128')) delete env[key];
  }
  if (config.apiKey && env.OPENAI_API_KEY === config.apiKey) delete env.OPENAI_API_KEY;
  if (config.apiKey && env.ANTHROPIC_API_KEY === config.apiKey) delete env.ANTHROPIC_API_KEY;
  return env;
}

function environmentForAgent(provider: AgentProvider): { env: Record<string, string>; route: AgentRoute } {
  const env = nativeAgentEnvironment();
  const config = loadLocalRouterConfig();
  if (provider === 'antigravity' || !config.enabled) return { env, route: 'native' };
  if (!config.apiKey) throw new Error('9Router is enabled but its local API key is missing.');
  if (provider === 'codex') Object.assign(env, { OPENAI_BASE_URL: LOCAL_ROUTER_ENDPOINT, OPENAI_API_KEY: config.apiKey });
  if (provider === 'claude_code') Object.assign(env, { ANTHROPIC_BASE_URL: LOCAL_ROUTER_ENDPOINT, ANTHROPIC_API_KEY: config.apiKey });
  return { env, route: '9router' };
}

function findAntigravityExecutable() {
  const candidates = [
    process.env.ANTIGRAVITY_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveCli(command: string) {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const userProfile = process.env.USERPROFILE || os.homedir();
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const programData = process.env.ProgramData || 'C:\\ProgramData';

    const explicit = process.env[`TASK_HUB_${command.toUpperCase()}_PATH`] ||
      process.env[`${command.toUpperCase()}_PATH`] ||
      (command === 'agy' ? process.env.ANTIGRAVITY_PATH : undefined);

    const candidates = [
      explicit,
      command === 'agy' ? path.join(localAppData, 'agy', 'bin', 'agy.exe') : undefined,
      command === 'agy' ? path.join(localAppData, 'agy', 'bin', 'agy.cmd') : undefined,
      command === 'agy' ? path.join(localAppData, 'Programs', 'Antigravity', 'bin', 'agy.exe') : undefined,
      command === 'agy' ? path.join(userProfile, '.antigravity', 'antigravity', 'bin', 'agy.exe') : undefined,
      command === 'gemini' ? path.join(userProfile, '.gemini', 'antigravity', 'bin', 'agy.exe') : undefined,
      command === 'agy' ? path.join(userProfile, '.gemini', 'antigravity', 'bin', 'agy.exe') : undefined,
      command === 'agy' ? path.join(programFiles, 'Antigravity', 'agy.exe') : undefined,
      command === 'agy' ? path.join(programFiles, 'Antigravity', 'Antigravity.exe') : undefined,
      command === 'agy' ? path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'agy.exe') : undefined,
      command === 'agy' ? path.join(userProfile, 'scoop', 'shims', 'agy.exe') : undefined,

      command === 'codex' ? path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(localAppData, 'Programs', 'Codex', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(localAppData, 'Programs', 'OpenAI', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'codex.exe') : undefined,
      command === 'codex' ? path.join(programFiles, 'OpenAI', 'Codex', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(programFiles, 'Codex', 'codex.exe') : undefined,
      command === 'codex' ? path.join(appData, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(appData, 'npm', 'codex.cmd') : undefined,
      command === 'codex' ? path.join(appData, 'npm', 'codex.ps1') : undefined,
      command === 'codex' ? path.join(localAppData, 'pnpm', 'codex.cmd') : undefined,
      command === 'codex' ? path.join(localAppData, 'pnpm', 'codex.exe') : undefined,
      command === 'codex' ? path.join(userProfile, '.codex', 'bin', 'codex.exe') : undefined,
      command === 'codex' ? path.join(userProfile, 'scoop', 'shims', 'codex.exe') : undefined,
      command === 'codex' ? path.join(userProfile, 'scoop', 'shims', 'codex.cmd') : undefined,
      command === 'codex' ? path.join(programData, 'chocolatey', 'bin', 'codex.exe') : undefined,

      command === 'claude' ? path.join(localAppData, 'Programs', 'Claude', 'bin', 'claude.exe') : undefined,
      command === 'claude' ? path.join(localAppData, 'Programs', 'Anthropic', 'bin', 'claude.exe') : undefined,
      command === 'claude' ? path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'claude.exe') : undefined,
      command === 'claude' ? path.join(appData, 'npm', 'claude.cmd') : undefined,
      command === 'claude' ? path.join(appData, 'npm', 'claude.ps1') : undefined,
      command === 'claude' ? path.join(localAppData, 'pnpm', 'claude.cmd') : undefined,
      command === 'claude' ? path.join(localAppData, 'pnpm', 'claude.exe') : undefined,
      command === 'claude' ? path.join(userProfile, '.claude', 'bin', 'claude.exe') : undefined,
      command === 'claude' ? path.join(userProfile, 'scoop', 'shims', 'claude.exe') : undefined,
      command === 'claude' ? path.join(userProfile, 'scoop', 'shims', 'claude.cmd') : undefined,
      command === 'claude' ? path.join(programData, 'chocolatey', 'bin', 'claude.exe') : undefined,

      command === 'git' ? path.join(programFiles, 'Git', 'cmd', 'git.exe') : undefined,
      command === 'git' ? path.join(programFiles, 'Git', 'bin', 'git.exe') : undefined,
      command === 'git' ? path.join(programFilesX86, 'Git', 'cmd', 'git.exe') : undefined,
      command === 'git' ? path.join(programFilesX86, 'Git', 'bin', 'git.exe') : undefined,
      command === 'git' ? path.join(localAppData, 'Programs', 'Git', 'cmd', 'git.exe') : undefined,
      command === 'git' ? path.join(localAppData, 'Programs', 'Git', 'bin', 'git.exe') : undefined,
      command === 'git' ? path.join(userProfile, 'scoop', 'shims', 'git.exe') : undefined,
      command === 'git' ? path.join(userProfile, 'scoop', 'apps', 'git', 'current', 'cmd', 'git.exe') : undefined,
      command === 'git' ? path.join('C:\\scoop', 'shims', 'git.exe') : undefined,
      command === 'git' ? path.join(programData, 'chocolatey', 'bin', 'git.exe') : undefined,

      command === 'npm' ? path.join(appData, 'npm', 'npm.cmd') : undefined,
      command === 'npm' ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'npm.cmd') : undefined,
      command === 'npm' ? path.join(programFilesX86, 'nodejs', 'npm.cmd') : undefined,
      command === 'npm' ? path.join(userProfile, 'scoop', 'shims', 'npm.cmd') : undefined,
      command === 'npm' ? path.join(userProfile, 'scoop', 'shims', 'npm.exe') : undefined,
      command === 'npm' ? path.join(programData, 'chocolatey', 'bin', 'npm.cmd') : undefined,

      command === 'pnpm' ? path.join(localAppData, 'pnpm', 'pnpm.cmd') : undefined,
      command === 'pnpm' ? path.join(localAppData, 'pnpm', 'pnpm.exe') : undefined,
      command === 'pnpm' ? path.join(appData, 'npm', 'pnpm.cmd') : undefined,
      command === 'pnpm' ? path.join(programFiles, 'nodejs', 'pnpm.cmd') : undefined,
      command === 'pnpm' ? path.join(userProfile, 'scoop', 'shims', 'pnpm.exe') : undefined,
      command === 'pnpm' ? path.join(userProfile, 'scoop', 'shims', 'pnpm.cmd') : undefined,
      command === 'pnpm' ? path.join(programData, 'chocolatey', 'bin', 'pnpm.exe') : undefined,

      command === 'yarn' ? path.join(appData, 'npm', 'yarn.cmd') : undefined,
      command === 'yarn' ? path.join(localAppData, 'pnpm', 'yarn.cmd') : undefined,
      command === 'yarn' ? path.join(programFiles, 'nodejs', 'yarn.cmd') : undefined,
      command === 'yarn' ? path.join(programFilesX86, 'Yarn', 'bin', 'yarn.cmd') : undefined,
      command === 'yarn' ? path.join(userProfile, 'scoop', 'shims', 'yarn.cmd') : undefined,
      command === 'yarn' ? path.join(userProfile, 'scoop', 'shims', 'yarn.exe') : undefined,
      command === 'yarn' ? path.join(programData, 'chocolatey', 'bin', 'yarn.cmd') : undefined,

      command === 'composer' ? path.join(programData, 'ComposerSetup', 'bin', 'composer.bat') : undefined,
      command === 'composer' ? path.join(programData, 'ComposerSetup', 'bin', 'composer.phar') : undefined,
      command === 'composer' ? path.join(appData, 'Composer', 'vendor', 'bin', 'composer.bat') : undefined,
      command === 'composer' ? path.join(programFiles, 'ComposerSetup', 'bin', 'composer.bat') : undefined,
      command === 'composer' ? path.join(userProfile, 'scoop', 'shims', 'composer.bat') : undefined,
      command === 'composer' ? path.join(userProfile, 'scoop', 'shims', 'composer.exe') : undefined,
      command === 'composer' ? path.join(programData, 'chocolatey', 'bin', 'composer.bat') : undefined,
    ];

    for (const binDir of getCandidateBinDirs()) {
      for (const ext of ['.exe', '.cmd', '.bat', '']) {
        candidates.push(path.join(binDir, `${command}${ext}`));
      }
    }

    const discovered = candidates.filter(Boolean).find((candidate) => {
      try {
        return fs.existsSync(candidate as string) && fs.statSync(candidate as string).isFile();
      } catch {
        return false;
      }
    });
    if (discovered) return discovered as string;
  }
  try {
    const result = execFileSync(
      process.platform === 'win32' ? 'where.exe' : 'which',
      [command],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], env: nativeAgentEnvironment() }
    );
    const candidates = result.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    // Windows Store's bundled Codex binary can appear in shell discovery but
    // is not spawnable by a separate Electron app (Access is denied). Use the
    // independently installed npm CLI instead, which is what bootstrap owns.
    return candidates.find((candidate) => !(command === 'codex' && /\\WindowsApps\\OpenAI\.Codex_/i.test(candidate))) || null;
  } catch {
    return null;
  }
}

type AgentRuntime = {
  provider: AgentProvider;
  label: string;
  command: string;
  executable: string | null;
  status: 'ready' | 'missing' | 'installing' | 'failed';
  message: string;
};

let runtimeInstallInFlight: Promise<AgentRuntime[]> | null = null;

async function agentRuntimeStatus(): Promise<AgentRuntime[]> {
  const definitions: Array<{ provider: AgentProvider; label: string; command: string }> = [
    { provider: 'codex', label: 'Codex CLI', command: 'codex' },
    { provider: 'claude_code', label: 'Claude Code CLI', command: 'claude' },
    { provider: 'antigravity', label: 'Antigravity CLI', command: 'agy' },
  ];
  const cao = await resolveCaoRuntime();
  const results: AgentRuntime[] = [];
  for (const { provider, label, command } of definitions) {
    const available = await isCaoProviderAvailable(provider, cao);
    if (available) {
      results.push({ provider, label, command, executable: command, status: 'ready', message: `Ready inside the CAO runtime.` });
    } else {
      results.push({ provider, label, command, executable: null, status: 'missing', message: `${label} is not installed inside the CAO runtime. Install it inside the CAO runtime to execute tasks.` });
    }
  }
  return results;
}

function verifyCliExecutable(executable: string, timeoutMs = 2500): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (ok: boolean, message: string) => { if (!settled) { settled = true; resolve({ ok, message }); } };
    try {
      const child = spawn(executable, ['--version'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable),
        env: nativeAgentEnvironment(),
      });
      const timeout = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        finish(false, `CLI version check timed out after ${timeoutMs}ms.`);
      }, timeoutMs);
      child.stdout?.on('data', chunk => { output += String(chunk); });
      child.stderr?.on('data', chunk => { output += String(chunk); });
      child.once('error', error => { clearTimeout(timeout); finish(false, error.message); });
      child.once('close', code => {
        clearTimeout(timeout);
        finish(code === 0, code === 0 ? (output.trim().split(/\r?\n/)[0] || 'CLI version check passed.') : (output.trim().slice(-400) || `CLI exited with code ${code}.`));
      });
    } catch (error: any) { finish(false, error?.message || 'Unable to execute CLI version check.'); }
  });
}

async function bootstrapAgentRuntimes(): Promise<AgentRuntime[]> {
  // We never install or execute provider CLIs in the host.
  // Install it inside the CAO runtime instead.
  return agentRuntimeStatus();
}

async function taskHubRequest(taskHubUrl: string, pathName: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${taskHubUrl.replace(/\/$/, '')}${pathName}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Task Hub request failed (${response.status}).`);
    return body;
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Task Hub request to ${pathName} timed out after 8s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function taskHubMcpCall(taskHubUrl: string, token: string, projectId: string, method: string, params: Record<string, any> = {}) {
  return taskHubRequest(taskHubUrl, '/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Task-Hub-Project': projectId },
    body: JSON.stringify({ jsonrpc: '2.0', id: `${Date.now()}-${Math.random()}`, method, params }),
  });
}

function safeCloneMain<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value, (_key, val) => {
      if (typeof val === 'function' || typeof val === 'symbol') return undefined;
      if (typeof val === 'bigint') return val.toString();
      if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack };
      return val;
    }));
  } catch {
    return {} as any;
  }
}

function safeSend(targetWin: BrowserWindow | null | undefined, channel: string, ...args: any[]) {
  if (!targetWin || targetWin.isDestroyed()) return;
  try {
    targetWin.webContents.send(channel, ...args.map(safeCloneMain));
  } catch (err) {
    console.warn(`[IPC] Failed to send on ${channel}:`, err);
  }
}

function broadcastUpdateState() {
  safeSend(win, 'updater-state', updateState);
}

function setUpdateState(next: { status: UpdateStatus; version?: string; percent?: number; message?: string }) {
  updateState = { ...updateState, ...next };
  broadcastUpdateState();
}

function git(cwd: string, args: string[]): string {
  const gitBin = resolveCli('git') || 'git';
  return execFileSync(gitBin, args, { cwd, encoding: 'utf8', windowsHide: true, env: nativeAgentEnvironment() }).trim();
}

function safeIssueKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || `task-${Date.now()}`;
}

function cleanAgentLog(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n');
  text = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
  text = text.replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, '');
  text = text.replace(/\x1b\([0-2B]/g, '');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F]/g, '');

  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.includes('\r')) {
      const parts = rawLine.split('\r');
      const last = parts.filter((p) => p.length > 0).pop() ?? '';
      lines.push(last);
    } else {
      lines.push(rawLine);
    }
  }
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

export type DiscoveredModel = {
  id: string;
  name: string;
  badges: string[];
  description?: string;
  source?: 'preset' | 'hub' | 'cli' | 'custom';
};

const BASE_PRESET_MODELS: Record<AgentProvider, DiscoveredModel[]> = {
  antigravity: [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badges: ['Flagship', 'Fast'], description: 'Latest generation model, optimized for speed and agentic reasoning', source: 'preset' },
    { id: 'gemini-3.7-pro', name: 'Gemini 3.7 Pro', badges: ['High', 'Reasoning'], description: 'Deep reasoning and multimodal intelligence for complex architecture', source: 'preset' },
    { id: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium)', badges: ['Medium', 'Fast'], description: 'Fast response for standard coding tasks', source: 'preset' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badges: ['Low'], description: 'Standard model for lightweight tasks', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Thinking'], description: 'Extended reasoning and deep source code architecture analysis', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Thinking'], description: 'Premier analysis model for complex problems', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: 'High-performance 120B open-weights model', source: 'preset' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badges: ['Recommended', '1M+ Context'], description: 'DeepMind flagship model, 1M+ context window', source: 'preset' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badges: ['Fast & Smart'], description: 'High speed with exceptional reasoning capabilities', source: 'preset' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', badges: ['Ultra Fast'], description: 'Instant response for repetitive tasks', source: 'preset' },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro Exp', badges: ['Experimental'], description: 'Experimental model for algorithms and code generation', source: 'preset' },
    { id: 'default', name: 'IDE / CLI Default', badges: ['Default'], description: 'Default Antigravity configuration', source: 'preset' },
  ],
  claude_code: [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', badges: ['High', 'Recommended', 'Flagship'], description: 'Top optimization for coding, architecture & hybrid reasoning', source: 'preset' },
    { id: 'claude-3-7-sonnet-thinking', name: 'Claude 3.7 (Thinking)', badges: ['High', 'Thinking'], description: 'Enables extended thinking for complex refactoring', source: 'preset' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', badges: ['Balanced', 'Fast'], description: 'Stable industry-standard coding model', source: 'preset' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', badges: ['Super Fast'], description: 'Super fast speed for small tasks and light refactoring', source: 'preset' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', badges: ['Deep Analysis'], description: 'Large system analysis & complex problems', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Next-Gen', 'Thinking'], description: 'Next-gen Sonnet model optimized for agentic workflows', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Deep Analysis', 'Thinking'], description: 'Large system analysis & complex logic structures', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Claude Code CLI configuration', source: 'preset' },
  ],
  codex: [
    { id: 'gpt-5', name: 'GPT-5 (Flagship)', badges: ['High', 'Flagship'], description: 'Foundational flagship model of the GPT-5 generation', source: 'preset' },
    { id: 'gpt-5-mini', name: 'GPT-5 mini', badges: ['Ultra Fast'], description: 'Compact, highly responsive model for fast edits and scripting', source: 'preset' },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', badges: ['High', 'Flagship'], description: 'Flagship GPT-5.6 model for reasoning, research & agentic coding', source: 'preset' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', badges: ['Medium', 'Fast'], description: 'Balanced intelligence and speed for production workloads', source: 'preset' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badges: ['Low', 'Ultra Fast'], description: 'Lightweight model optimized for speed and cost efficiency at scale', source: 'preset' },
    { id: 'gpt-5.6-cyber', name: 'GPT-5.6 Cyber', badges: ['Specialized', 'Security'], description: 'Specialized model for security analysis & source code audits', source: 'preset' },
    { id: 'o3-pro', name: 'o3-pro', badges: ['High', 'Deep Reasoning'], description: 'Deep extended reasoning for challenging architecture & algorithmic problems', source: 'preset' },
    { id: 'o3', name: 'o3', badges: ['High', 'Reasoning'], description: 'Powerful multi-step reasoning model from the o-series', source: 'preset' },
    { id: 'o3-mini', name: 'o3-mini', badges: ['Fast Reasoning', 'High'], description: 'High-level logical reasoning with rapid response times', source: 'preset' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', badges: ['High Quality', 'Large Context'], description: 'Deep context comprehension and complex architecture understanding', source: 'preset' },
    { id: 'gpt-4.1', name: 'GPT-4.1', badges: ['Balanced', 'Fast'], description: 'High-performance version optimized for daily coding tasks', source: 'preset' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', badges: ['Ultra Fast'], description: 'Ultra-lightweight model with high execution speed', source: 'preset' },
    { id: 'o1', name: 'o1', badges: ['Deep Reasoning'], description: 'Step-by-step reasoning for complex problem solving', source: 'preset' },
    { id: 'gpt-4o', name: 'GPT-4o', badges: ['Omni', 'Fast'], description: 'Balanced execution speed and output quality', source: 'preset' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', badges: ['Ultra Fast'], description: 'Compact model with high execution speed', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: '120B-parameter open-weights model', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Default Codex CLI configuration', source: 'preset' },
  ],
};

function inferModelBadges(id: string, name?: string): string[] {
  const text = `${id} ${name || ''}`.toLowerCase();
  const badges: string[] = [];
  if (text.includes('sol') || text.includes('flagship') || text.includes('pro-exp') || text.includes('opus')) {
    badges.push('High', 'Flagship');
  } else if (text.includes('thinking') || text.includes('reasoning') || text.includes('o3') || text.includes('o1')) {
    badges.push('High', 'Thinking');
  } else if (text.includes('flash') || text.includes('mini') || text.includes('luna') || text.includes('haiku')) {
    badges.push('Ultra Fast');
  } else if (text.includes('terra') || text.includes('balanced')) {
    badges.push('Medium', 'Fast');
  } else if (text.includes('cyber') || text.includes('security')) {
    badges.push('Specialized', 'Security');
  } else if (text.includes('oss') || text.includes('open')) {
    badges.push('Open Weights');
  } else if (text.includes('default')) {
    badges.push('Default');
  } else {
    badges.push('Discovered');
  }
  return Array.from(new Set(badges));
}

function getCustomModelsPath(): string {
  const dir = path.join(app.getPath('userData'), 'task-companion');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'models-custom.json');
}

function getCachedModelsPath(): string {
  const dir = path.join(app.getPath('userData'), 'task-companion');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'models-cache.json');
}

function readCustomModels(): Record<string, DiscoveredModel[]> {
  try {
    const file = getCustomModelsPath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { /* ignore */ }
  return { antigravity: [], claude_code: [], codex: [] };
}

function writeCustomModels(data: Record<string, DiscoveredModel[]>): void {
  try {
    fs.writeFileSync(getCustomModelsPath(), JSON.stringify(data, null, 2), 'utf8');
  } catch { /* ignore */ }
}

function readCachedModels(): { timestamp: number; data: Record<string, DiscoveredModel[]> } | null {
  try {
    const file = getCachedModelsPath();
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { /* ignore */ }
  return null;
}

function writeCachedModels(data: Record<string, DiscoveredModel[]>): void {
  try {
    fs.writeFileSync(getCachedModelsPath(), JSON.stringify({ timestamp: Date.now(), data }, null, 2), 'utf8');
  } catch { /* ignore */ }
}

interface AgentPermissions {
  toolExecutionPolicy: 'always-proceed' | 'request-review' | 'strict' | 'proceed-in-sandbox';
  sandboxMode: boolean;
  fileAccessPolicy: 'allow' | 'ask' | 'deny';
  internetAccessPolicy: 'allow' | 'ask' | 'deny';
  artifactReviewMode: 'always-proceed' | 'agent-decides' | 'asks-for-review';
  notificationsEnabled: boolean;
  theme: 'dark' | 'midnight' | 'cyber' | 'light';
  browserAllowlist: string[];
  commandAllowlist: string[];
  commandDenylist: string[];
}

const DEFAULT_PERMISSIONS: AgentPermissions = {
  toolExecutionPolicy: 'request-review',
  sandboxMode: false,
  fileAccessPolicy: 'allow',
  internetAccessPolicy: 'allow',
  artifactReviewMode: 'agent-decides',
  notificationsEnabled: true,
  theme: 'dark',
  browserAllowlist: [],
  commandAllowlist: ['npm test', 'git status', 'git diff', 'ls', 'dir'],
  commandDenylist: ['rm -rf /', 'format', 'DROP DATABASE'],
};

function getPermissionsPath(): string {
  const dir = path.join(app.getPath('userData'), 'task-companion');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'agent-permissions.json');
}

function loadPermissions(): AgentPermissions {
  try {
    const p = getPermissionsPath();
    if (fs.existsSync(p)) {
      return { ...DEFAULT_PERMISSIONS, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
    }
  } catch { /* ignore */ }
  return DEFAULT_PERMISSIONS;
}

function savePermissions(perms: Partial<AgentPermissions>): AgentPermissions {
  const current = loadPermissions();
  const updated = { ...current, ...perms };
  try {
    fs.writeFileSync(getPermissionsPath(), JSON.stringify(updated, null, 2), 'utf8');
  } catch { /* ignore */ }
  return updated;
}

interface SkillItem {
  id: string;
  name: string;
  description: string;
  path: string;
  source: 'builtin' | 'plugin' | 'workspace';
}

function discoverSkills(workspacePath?: string): SkillItem[] {
  const skills: SkillItem[] = [];
  const homeDir = os.homedir();
  const searchDirs: Array<{ base: string; source: 'builtin' | 'plugin' | 'workspace' }> = [
    { base: path.join(homeDir, '.gemini', 'antigravity', 'builtin', 'skills'), source: 'builtin' },
    { base: path.join(homeDir, '.gemini', 'config', 'plugins'), source: 'plugin' },
  ];
  if (workspacePath) {
    searchDirs.push({ base: path.join(workspacePath, '.gemini', 'skills'), source: 'workspace' });
  }

  for (const { base, source } of searchDirs) {
    if (!fs.existsSync(base)) continue;
    try {
      const scan = (dir: string, depth = 0) => {
        if (depth > 3) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const skillFile = path.join(dir, ent.name, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
              try {
                const content = fs.readFileSync(skillFile, 'utf8');
                const nameMatch = content.match(/name:\s*([^\r\n]+)/);
                const descMatch = content.match(/description:\s*([^\r\n]+)/);
                skills.push({
                  id: ent.name,
                  name: nameMatch ? nameMatch[1].trim() : ent.name,
                  description: descMatch ? descMatch[1].trim() : 'Antigravity specialized skill',
                  path: skillFile,
                  source,
                });
              } catch { /* ignore */ }
            } else {
              scan(path.join(dir, ent.name), depth + 1);
            }
          }
        }
      };
      scan(base);
    } catch { /* ignore */ }
  }
  return skills;
}

async function discoverRemoteModels(taskHubUrl?: string): Promise<Record<AgentProvider, DiscoveredModel[]> | null> {
  const url = taskHubUrl || process.env.TASK_HUB_URL || 'https://task-hub.macatung.dev';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/agent/models`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json: any = await res.json();
      if (json?.success && json?.data) {
        return json.data;
      }
    }
  } catch { /* ignore network error, fallback to local */ }
  return null;
}

function discoverAntigravityCliModels(): DiscoveredModel[] {
  const agy = resolveCli('agy');
  if (!agy) return [];
  try {
    const output = execFileSync(agy, ['models'], {
      encoding: 'utf8',
      timeout: 7000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).flatMap((line) => {
      const match = line.trim().match(/^([^\s]+)\s{2,}(.+)$/);
      if (!match) return [];
      const [, id, name] = match;
      return [{ id, name, badges: inferModelBadges(id, name), description: `Model confirmed by agy CLI: ${id}`, source: 'cli' as const }];
    });
  } catch {
    return [];
  }
}

function resolveAntigravityModelId(requested?: string): string | undefined {
  if (!requested || requested === 'default') return undefined;
  // AGY 2.x requires the explicit reasoning level. Keep existing saved
  // selections working even if model discovery cannot run temporarily.
  const legacyAliases: Record<string, string> = {
    'gemini-3.7-flash': 'gemini-3.7-flash-high',
    'gemini-3.7-flash-high': 'gemini-3.7-flash-high',
    'gemini-3.7-pro': 'gemini-3.7-pro',
    'gemini-3.6-flash': 'gemini-3.6-flash-medium',
    'gemini-3.5-flash': 'gemini-3.5-flash-medium',
    'gemini-3.5-flash-medium': 'gemini-3.5-flash-medium',
    'gemini-3.1-pro': 'gemini-3.1-pro',
  };
  // Do not wait for `agy models` for old selections: recent AGY builds may
  // fetch the inventory from the network before printing it.
  if (legacyAliases[requested]) return legacyAliases[requested];
  const models = discoverAntigravityCliModels();
  if (!models.length) return legacyAliases[requested] || requested;
  if (models.some((model) => model.id === requested)) return requested;
  const family = requested.replace(/-(?:high|medium|low)$/i, '');
  return models.find((model) => model.id === `${family}-high`)?.id
    || models.find((model) => model.id.startsWith(`${family}-`))?.id
    || legacyAliases[requested]
    || requested;
}

async function getAvailableModels(provider?: AgentProvider, options?: { forceRefresh?: boolean; taskHubUrl?: string }) {
  const custom = readCustomModels();
  let cached = readCachedModels();
  const isStale = !cached || (Date.now() - cached.timestamp > 30 * 60 * 1000);

  if (options?.forceRefresh || isStale) {
    const remote = await discoverRemoteModels(options?.taskHubUrl);
    if (remote) {
      writeCachedModels(remote);
      cached = { timestamp: Date.now(), data: remote };
    }
  }

  const result: Record<AgentProvider, DiscoveredModel[]> = {
    antigravity: [],
    claude_code: [],
    codex: [],
  };

  const providers: AgentProvider[] = provider ? [provider] : ['antigravity', 'claude_code', 'codex'];
  const agyModels = providers.includes('antigravity') ? discoverAntigravityCliModels() : [];
  const routerModels = loadLocalRouterConfig().enabled ? await checkLocalRouter(true) : null;

  if (agyModels.length) {
    const merged = { ...(cached?.data || BASE_PRESET_MODELS), antigravity: agyModels } as Record<AgentProvider, DiscoveredModel[]>;
    writeCachedModels(merged);
    cached = { timestamp: Date.now(), data: merged };
  }

  for (const p of providers) {
    const map = new Map<string, DiscoveredModel>();

    // The live agy list is authoritative: old generic preset IDs such as
    // gemini-3.7-flash are no longer accepted by recent AGY CLI builds.
    if (p === 'antigravity' && agyModels.length) {
      agyModels.forEach((m) => map.set(m.id, m));
    } else {
      (BASE_PRESET_MODELS[p] || []).forEach((m) => map.set(m.id, { ...m, source: 'preset' }));
    }

    // 2. Cached remote / Hub discovered models
    if (cached?.data?.[p] && !(p === 'antigravity' && agyModels.length)) {
      cached.data[p].forEach((m) => {
        // Do not surface pre-AGY-2 generic IDs. They are kept only as an
        // execution-time compatibility alias above.
        if (p === 'antigravity' && ['gemini-3.6-flash', 'gemini-3.5-flash'].includes(m.id)) return;
        const existing = map.get(m.id);
        map.set(m.id, {
          id: m.id,
          name: m.name || m.id,
          badges: m.badges || inferModelBadges(m.id, m.name),
          description: m.description || existing?.description || `Model ${m.id} automatically synced from Task Hub / CLI`,
          source: existing ? existing.source : 'hub',
        });
      });
    }

    // 3. User custom saved models
    (custom[p] || []).forEach((m) => {
      map.set(m.id, {
        id: m.id,
        name: m.name || m.id,
        badges: m.badges || ['Custom', 'Saved'],
        description: m.description || `Custom user-saved model: ${m.id}`,
        source: 'custom',
      });
    });

    if (routerModels?.ok && p !== 'antigravity') {
      routerModels.models.forEach((model) => map.set(model.id, model));
    }

    result[p] = Array.from(map.values());
  }

  return {
    ok: true,
    provider,
    models: provider ? result[provider] : result,
    syncedAt: cached ? new Date(cached.timestamp).toISOString() : new Date().toISOString(),
    source: routerModels?.ok ? 'local-9router' : (cached ? (Date.now() - cached.timestamp < 60000 ? 'live' : 'cache') : 'preset'),
  };
}

export type QuotaGroup = {
  id: string;
  name: string;
  provider: AgentProvider | 'gemini' | 'claude_gpt';
  weeklyRemainingPercent: number;
  weeklyResetIn: string;
  fiveHourRemainingPercent: number;
  fiveHourResetIn: string;
  usedTokens: number;
  totalLimitTokens: number;
  lastUpdated: string;
};

export type QuotaUsageState = {
  plan: string;
  planTier: string;
  enableCreditOverages: boolean;
  gemini: QuotaGroup;
  claudeGpt: QuotaGroup;
  codex: QuotaGroup;
  lastSyncedAt: string;
};

function getQuotaFilePath(): string {
  const dir = path.join(app.getPath('userData'), 'task-companion');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'quota-usage.json');
}

function getDefaultQuotaState(): QuotaUsageState {
  const now = new Date().toISOString();
  return {
    plan: 'Google AI Ultra',
    planTier: 'Highest rate limits',
    enableCreditOverages: false,
    gemini: {
      id: 'gemini',
      name: 'Gemini Models',
      provider: 'antigravity',
      weeklyRemainingPercent: 69,
      weeklyResetIn: '4 days, 9 hours',
      fiveHourRemainingPercent: 93,
      fiveHourResetIn: '3 hours, 50 minutes',
      usedTokens: 145000,
      totalLimitTokens: 2000000,
      lastUpdated: now,
    },
    claudeGpt: {
      id: 'claude_gpt',
      name: 'Claude and GPT models',
      provider: 'claude_code',
      weeklyRemainingPercent: 100,
      weeklyResetIn: '7 days',
      fiveHourRemainingPercent: 100,
      fiveHourResetIn: '5 hours',
      usedTokens: 0,
      totalLimitTokens: 1000000,
      lastUpdated: now,
    },
    codex: {
      id: 'codex',
      name: 'Codex Models',
      provider: 'codex',
      weeklyRemainingPercent: 98,
      weeklyResetIn: '6 days, 20 hours',
      fiveHourRemainingPercent: 95,
      fiveHourResetIn: '4 hours, 30 minutes',
      usedTokens: 25000,
      totalLimitTokens: 1000000,
      lastUpdated: now,
    },
    lastSyncedAt: now,
  };
}

function calculateQuotaRecovery(state: QuotaUsageState): QuotaUsageState {
  const now = Date.now();
  const groups: (keyof QuotaUsageState)[] = ['gemini', 'claudeGpt', 'codex'];
  let modified = false;

  for (const key of groups) {
    const group = state[key] as QuotaGroup | undefined;
    if (!group || !group.lastUpdated) continue;
    const last = new Date(group.lastUpdated).getTime();
    if (isNaN(last)) continue;
    const elapsedHours = Math.max(0, (now - last) / (1000 * 60 * 60));

    if (elapsedHours > 0.05) {
      // 5-hour limit recovers 20% per hour
      const recovered5h = Math.min(100, Math.round(group.fiveHourRemainingPercent + (elapsedHours * 20)));
      // Weekly limit recovers ~0.6% per hour (100 / 168h)
      const recoveredWeekly = Math.min(100, Math.round(group.weeklyRemainingPercent + (elapsedHours * (100 / 168))));

      if (recovered5h !== group.fiveHourRemainingPercent || recoveredWeekly !== group.weeklyRemainingPercent) {
        group.fiveHourRemainingPercent = recovered5h;
        group.weeklyRemainingPercent = recoveredWeekly;
        group.lastUpdated = new Date().toISOString();
        modified = true;
      }
    }

    // Dynamic reset countdown strings
    const fiveHrHoursLeft = Math.max(0, Math.ceil(5 * (1 - (group.fiveHourRemainingPercent / 100))));
    group.fiveHourResetIn = fiveHrHoursLeft <= 0 ? 'Full (100%)' : `${fiveHrHoursLeft} hour${fiveHrHoursLeft > 1 ? 's' : ''}`;

    const weeklyDaysLeft = Math.max(0, Math.ceil(7 * (1 - (group.weeklyRemainingPercent / 100))));
    group.weeklyResetIn = weeklyDaysLeft <= 0 ? 'Full (100%)' : `${weeklyDaysLeft} day${weeklyDaysLeft > 1 ? 's' : ''}`;
  }

  if (modified) {
    state.lastSyncedAt = new Date().toISOString();
    writeQuotaState(state);
  }
  return state;
}

function readQuotaState(): QuotaUsageState {
  try {
    const file = getQuotaFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data?.gemini && data?.claudeGpt) {
        return calculateQuotaRecovery(data);
      }
    }
  } catch { /* ignore */ }
  const defaults = getDefaultQuotaState();
  writeQuotaState(defaults);
  return defaults;
}

function writeQuotaState(state: QuotaUsageState): void {
  try {
    fs.writeFileSync(getQuotaFilePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch { /* ignore */ }
}

function recordTokenUsageToQuota(provider: AgentProvider, tokenCount: number): QuotaUsageState {
  const quota = readQuotaState();
  const target = provider === 'antigravity' ? quota.gemini : provider === 'claude_code' ? quota.claudeGpt : quota.codex;
  if (target && tokenCount > 0) {
    target.usedTokens = (target.usedTokens || 0) + tokenCount;
    const fiveHourDelta = Math.max(1, Math.round((tokenCount / 25000) * 1));
    const weeklyDelta = Math.max(0, Math.round((tokenCount / 120000) * 1));
    target.fiveHourRemainingPercent = Math.max(0, Math.min(100, target.fiveHourRemainingPercent - fiveHourDelta));
    target.weeklyRemainingPercent = Math.max(0, Math.min(100, target.weeklyRemainingPercent - weeklyDelta));
    target.lastUpdated = new Date().toISOString();
    quota.lastSyncedAt = target.lastUpdated;
    writeQuotaState(quota);

    // Broadcast immediately to Desktop UI
    safeSend(win, 'agent-quota-updated', quota);

    // Sync to Task Hub in background
    void syncQuotaToTaskHub(quota);
  }
  return quota;
}

function extractAndRecordTokensFromText(provider: AgentProvider, text: string): void {
  if (!text) return;
  const tokenMatch = text.match(/(?:total\s*tokens?|tokens?\s*used|token\s*count|total_tokens)[:\s=]+(\d[\d,]*)/i);
  if (tokenMatch && tokenMatch[1]) {
    const tokens = parseInt(tokenMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(tokens) && tokens > 0) {
      recordTokenUsageToQuota(provider, tokens);
      return;
    }
  }
  const inOutMatch = text.match(/in\s*(\d[\d,]*)\s*,\s*out\s*(\d[\d,]*)/i);
  if (inOutMatch && (inOutMatch[1] || inOutMatch[2])) {
    const inTokens = parseInt((inOutMatch[1] || '0').replace(/,/g, ''), 10) || 0;
    const outTokens = parseInt((inOutMatch[2] || '0').replace(/,/g, ''), 10) || 0;
    const total = inTokens + outTokens;
    if (total > 0) {
      recordTokenUsageToQuota(provider, total);
    }
  }
}

async function syncQuotaToTaskHub(quota: QuotaUsageState, taskHubUrl?: string): Promise<boolean> {
  const url = taskHubUrl || process.env.TASK_HUB_URL || 'https://task-hub.macatung.dev';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/agent/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function disableAgentGuardrails(worktree: string) {
  const hooks = path.join(worktree, '.task-companion', 'hooks');
  try { git(worktree, ['config', '--unset', 'core.hooksPath']); } catch { /* No generated hook configured. */ }
  if (fs.existsSync(hooks)) fs.rmSync(hooks, { recursive: true, force: true });
}

type EnvironmentCheck = {
  id: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  fixable?: boolean;
  fixHint?: string;
};

const ENV_TEMPLATE_CANDIDATES = [
  '.env.example',
  '.env.template',
  '.env.defaults',
  '.env.dist',
  '.env.sample',
  '.env.local.example',
];

function findEnvTemplate(rootPath: string): string | null {
  for (const templateName of ENV_TEMPLATE_CANDIDATES) {
    const candidatePath = path.join(rootPath, templateName);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
  }
  return null;
}

function generateDefaultEnvContent(): string {
  return [
    '# Task Companion Auto-Generated Environment Configuration',
    'APP_ENV=local',
    'APP_DEBUG=true',
    'PORT=3000',
    'NODE_ENV=development',
    '',
  ].join('\n');
}

function scanGitLocks(rootPath: string): string[] {
  const locks: string[] = [];
  try {
    let gitDir = path.join(rootPath, '.git');
    if (fs.existsSync(gitDir)) {
      const stat = fs.statSync(gitDir);
      if (stat.isFile()) {
        const content = fs.readFileSync(gitDir, 'utf8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/i);
        if (match && match[1]) {
          gitDir = path.resolve(rootPath, match[1].trim());
        }
      }
    }

    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      return locks;
    }

    const directLocks = ['index.lock', 'HEAD.lock', 'config.lock', 'packed-refs.lock', 'shallow.lock'];
    for (const file of directLocks) {
      const fullPath = path.join(gitDir, file);
      if (fs.existsSync(fullPath)) locks.push(fullPath);
    }

    const refsDir = path.join(gitDir, 'refs');
    if (fs.existsSync(refsDir)) {
      const scanDir = (dir: string) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scanDir(entryPath);
            } else if (entry.name.endsWith('.lock')) {
              locks.push(entryPath);
            }
          }
        } catch { /* ignore */ }
      };
      scanDir(refsDir);
    }

    const worktreesDir = path.join(gitDir, 'worktrees');
    if (fs.existsSync(worktreesDir) && fs.statSync(worktreesDir).isDirectory()) {
      try {
        const wtEntries = fs.readdirSync(worktreesDir, { withFileTypes: true });
        for (const wt of wtEntries) {
          if (wt.isDirectory()) {
            const wtPath = path.join(worktreesDir, wt.name);
            const wtLockFiles = ['.git.lock', 'index.lock', 'HEAD.lock', 'locked', 'gitdir.lock'];
            for (const lf of wtLockFiles) {
              const fullPath = path.join(wtPath, lf);
              if (fs.existsSync(fullPath)) locks.push(fullPath);
            }
          }
        }
      } catch { /* ignore */ }
    }
  } catch {
    // ignore
  }
  return locks;
}

function pruneGitLocks(rootPath: string): { scanned: string[]; removed: string[]; errors: string[] } {
  const scanned = scanGitLocks(rootPath);
  const removed: string[] = [];
  const errors: string[] = [];

  for (const lockPath of scanned) {
    try {
      if (process.platform === 'win32') {
        try { fs.chmodSync(lockPath, 0o666); } catch { /* ignore */ }
      }
      fs.rmSync(lockPath, { force: true });
      removed.push(lockPath);
    } catch (err: any) {
      errors.push(`${lockPath}: ${err?.message || err}`);
    }
  }

  try {
    git(rootPath, ['worktree', 'prune', '--verbose']);
  } catch { /* ignore */ }

  return { scanned, removed, errors };
}

function probeDirectoryWritability(dirPath: string): { writable: boolean; error?: string } {
  const probeFile = path.join(dirPath, `.task-hub-write-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  try {
    fs.writeFileSync(probeFile, 'ok', 'utf8');
    fs.readFileSync(probeFile, 'utf8');
    fs.unlinkSync(probeFile);
    return { writable: true };
  } catch (err: any) {
    try {
      if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
    } catch { /* ignore */ }
    return { writable: false, error: err?.message || String(err) };
  }
}

function fixDirectoryPermissions(dirPath: string): { fixed: boolean; message: string } {
  try {
    fs.chmodSync(dirPath, 0o777);
  } catch { /* ignore */ }

  if (process.platform === 'win32') {
    try {
      execFileSync('attrib', ['-r', `${dirPath}\\*`, '/s', '/d'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 10000,
      });
    } catch { /* ignore */ }
  }

  const retest = probeDirectoryWritability(dirPath);
  if (retest.writable) {
    return { fixed: true, message: 'Restored write permissions and stripped read-only attributes.' };
  }
  return { fixed: false, message: retest.error || 'Directory remains unwritable after permission reset.' };
}

async function preflightAgent(provider: AgentProvider, cwd: string) {
  const checks: EnvironmentCheck[] = [];
  const cli = provider === 'antigravity' ? (resolveCli('agy') || findAntigravityExecutable()) : resolveCli(AGENT_COMMANDS[provider].command);
  const cliCheck = cli ? await verifyCliExecutable(cli, 2500) : { ok: false, message: `${provider} CLI not found. Use Fix environment to install it, then authenticate and retry.` };
  checks.push({ id: 'provider', status: cliCheck.ok ? 'passed' : 'failed', message: cliCheck.ok ? `${provider} is ready · ${cliCheck.message}` : `${provider} CLI is not runnable: ${cliCheck.message}`, fixable: !cliCheck.ok, fixHint: 'Fix environment installs the official provider CLI and verifies it can start.' });
  const routerConfig = loadLocalRouterConfig();
  if (provider === 'antigravity') {
    checks.push({ id: 'router', status: 'passed', message: 'Antigravity is native-only; 9Router, MITM and hosts changes are not used.' });
  } else if (routerConfig.enabled) {
    const router = await checkLocalRouter(true);
    checks.push({ id: 'router', status: router.ok ? 'passed' : 'failed', message: router.ok ? `9Router local route ready (${router.models.length} models).` : (router.error || '9Router local check failed.') });
  }
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) return { ok: false, provider, capabilities: PROVIDER_CAPABILITIES[provider], checks: [...checks, { id: 'workspace', status: 'failed' as const, message: 'Select a valid repository directory.' }] };
  try {
    const root = git(cwd, ['rev-parse', '--show-toplevel']);
    const dirty = git(cwd, ['status', '--porcelain']);
    checks.push({ id: 'repository', status: 'passed', message: `Git repository: ${root}` });

    const permProbe = probeDirectoryWritability(root);
    if (!permProbe.writable) {
      checks.push({
        id: 'directory_permissions',
        status: 'failed',
        message: `Workspace directory is not writable (${permProbe.error || 'Access denied'}).`,
        fixable: true,
        fixHint: 'Auto-fix will reset read-only attributes and grant write permissions.',
      });
    } else {
      checks.push({ id: 'directory_permissions', status: 'passed', message: 'Workspace directory write permissions verified.' });
    }

    const staleLocks = scanGitLocks(root);
    if (staleLocks.length > 0) {
      checks.push({
        id: 'git_locks',
        status: 'warning',
        message: `Found ${staleLocks.length} stale Git lock file(s): ${staleLocks.map((p) => path.basename(p)).join(', ')}.`,
        fixable: true,
        fixHint: 'Auto-fix will safely remove stale Git lock files and prune orphaned worktrees.',
      });
    } else {
      checks.push({ id: 'git_locks', status: 'passed', message: 'No stale Git lockfiles detected.' });
    }

    let remote = ''; let upstream = ''; let divergence = '';
    try { remote = git(root, ['remote', 'get-url', 'origin']); } catch { /* Local-only repository. */ }
    try { upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { /* No upstream configured. */ }
    if (upstream) { try { divergence = git(root, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]); } catch { /* Ignore unavailable comparison. */ } }
    checks.push({ id: 'remote', status: remote ? (upstream && divergence !== '0\t0' ? 'warning' : 'passed') : 'warning', message: remote ? `origin: ${remote}${upstream ? ` · ${upstream}${divergence ? ` · behind/ahead ${divergence}` : ''}` : ' · no upstream tracking branch'}` : 'Remote origin not configured; local repository is not synchronized with Task Hub/GitHub.' });
    checks.push({ id: 'working_tree', status: dirty ? 'warning' : 'passed', message: dirty ? 'Workspace has uncommitted changes; isolated worktree will branch off the current base commit.' : 'Workspace clean.' });

    const envFile = path.join(root, '.env');
    if (!fs.existsSync(envFile)) {
      const template = findEnvTemplate(root);
      if (template) {
        checks.push({
          id: 'environment_file',
          status: 'warning',
          message: `Missing .env file; can safely generate from ${path.basename(template)}.`,
          fixable: true,
          fixHint: `Auto-fix will copy ${path.basename(template)} to .env.`,
        });
      } else {
        checks.push({
          id: 'environment_file',
          status: 'warning',
          message: 'Missing .env file; no template found.',
          fixable: true,
          fixHint: 'Auto-fix will generate a standard default .env configuration file.',
        });
      }
    } else {
      checks.push({ id: 'environment_file', status: 'passed', message: '.env configuration file present.' });
    }

    if (fs.existsSync(path.join(root, 'package-lock.json')) && !fs.existsSync(path.join(root, 'node_modules'))) {
      checks.push({ id: 'node_dependencies', status: 'warning', message: 'Missing Node dependencies (node_modules).', fixable: true, fixHint: 'Auto-fix will run npm ci in workspace.' });
    }
    if (fs.existsSync(path.join(root, 'composer.lock')) && !fs.existsSync(path.join(root, 'vendor'))) {
      checks.push({ id: 'php_dependencies', status: 'warning', message: 'Missing PHP dependencies (vendor).', fixable: true, fixHint: 'Auto-fix will run composer install.' });
    }
    return { ok: cliCheck.ok && !checks.some((check) => check.status === 'failed'), provider, capabilities: PROVIDER_CAPABILITIES[provider], repository: root, baseCommit: git(root, ['rev-parse', 'HEAD']), remote, upstream, divergence, checks };
  } catch {
    checks.push({ id: 'repository', status: 'failed', message: 'Workspace must be a Git repository.' });
    return { ok: false, provider, capabilities: PROVIDER_CAPABILITIES[provider], checks };
  }
}

function quickSetupEnvironment(cwd: string, installDependencies = true) {
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace must be a valid directory.');
  const checks: EnvironmentCheck[] = [];
  const run = (id: string, command: string, args: string[], message: string) => {
    const executable = resolveCli(command);
    if (!executable) { checks.push({ id, status: 'warning', message: `${command} is not installed; skipped.` }); return; }
    try {
      // Node does not consistently execute .cmd shims directly on Windows.
      // npm is commonly resolved as npm.cmd, so use the shell only for those
      // trusted, locally-resolved command shims.
      const isBatchShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
      execFileSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 300000, stdio: 'ignore', shell: isBatchShim, env: nativeAgentEnvironment() });
      checks.push({ id, status: 'passed', message });
    }
    catch { checks.push({ id, status: 'warning', message: `${command} could not install dependencies automatically; proceeding with workspace.` }); }
  };
  const repository = git(cwd, ['rev-parse', '--show-toplevel']);
  checks.push({ id: 'repository', status: 'passed', message: `Git repository: ${repository}` });

  // Permissions probe and healing
  const permProbe = probeDirectoryWritability(repository);
  if (!permProbe.writable) {
    const permFix = fixDirectoryPermissions(repository);
    checks.push({ id: 'directory_permissions', status: permFix.fixed ? 'passed' : 'failed', message: permFix.message });
  } else {
    checks.push({ id: 'directory_permissions', status: 'passed', message: 'Workspace directory write permissions verified.' });
  }

  // Stale Git locks pruning
  const lockPrune = pruneGitLocks(repository);
  if (lockPrune.removed.length > 0) {
    checks.push({ id: 'git_locks', status: 'passed', message: `Cleaned up ${lockPrune.removed.length} stale Git lock file(s): ${lockPrune.removed.map((p) => path.basename(p)).join(', ')}.` });
  } else {
    checks.push({ id: 'git_locks', status: 'passed', message: 'No stale Git lockfiles found.' });
  }

  // Multi-template .env auto-repair
  const envFile = path.join(repository, '.env');
  if (!fs.existsSync(envFile)) {
    const template = findEnvTemplate(repository);
    if (template) {
      fs.copyFileSync(template, envFile);
      checks.push({ id: 'env', status: 'passed', message: `Created .env from ${path.basename(template)}.` });
    } else {
      fs.writeFileSync(envFile, generateDefaultEnvContent(), 'utf8');
      checks.push({ id: 'env', status: 'passed', message: 'Created default .env with standard workspace configuration.' });
    }
  } else {
    checks.push({ id: 'env', status: 'passed', message: '.env already exists; kept local values.' });
  }

  if (installDependencies && fs.existsSync(path.join(repository, 'package-lock.json'))) {
    if (fs.existsSync(path.join(repository, 'node_modules'))) checks.push({ id: 'node_dependencies', status: 'passed', message: 'Node dependencies already present; skipping.' });
    else run('node_dependencies', 'npm', ['ci'], 'Installed Node dependencies with npm ci.');
  } else if (installDependencies && fs.existsSync(path.join(repository, 'pnpm-lock.yaml'))) {
    if (fs.existsSync(path.join(repository, 'node_modules'))) checks.push({ id: 'node_dependencies', status: 'passed', message: 'Node dependencies already present; skipping.' });
    else run('node_dependencies', 'pnpm', ['install', '--frozen-lockfile'], 'Installed Node dependencies with pnpm.');
  } else if (installDependencies && fs.existsSync(path.join(repository, 'yarn.lock'))) {
    if (fs.existsSync(path.join(repository, 'node_modules'))) checks.push({ id: 'node_dependencies', status: 'passed', message: 'Node dependencies already present; skipping.' });
    else run('node_dependencies', 'yarn', ['install', '--frozen-lockfile'], 'Installed Node dependencies with Yarn.');
  }
  if (installDependencies && fs.existsSync(path.join(repository, 'composer.lock'))) {
    if (fs.existsSync(path.join(repository, 'vendor'))) checks.push({ id: 'php_dependencies', status: 'passed', message: 'PHP dependencies already present; skipping.' });
    else run('php_dependencies', 'composer', ['install', '--no-interaction', '--prefer-dist'], 'Installed PHP dependencies with Composer.');
  }
  return { ok: checks.every((check) => check.status !== 'failed'), repository, checks };
}

async function repairEnvironment(provider: AgentProvider, cwd: string) {
  const checks: EnvironmentCheck[] = [];
  const runtimes = await bootstrapAgentRuntimes();
  for (const runtime of runtimes) {
    checks.push({
      id: `cli_${runtime.provider}`,
      status: runtime.status === 'ready' ? 'passed' : 'failed',
      message: runtime.message,
      fixable: runtime.status !== 'ready',
      fixHint: 'Check your internet connection, Node.js installation and provider sign-in, then retry.',
    });
  }
  try {
    const repository = git(cwd, ['rev-parse', '--show-toplevel']);
    // 1. Clean stale Git locks
    const lockResult = pruneGitLocks(repository);
    if (lockResult.removed.length > 0) {
      checks.push({
        id: 'git_locks',
        status: 'passed',
        message: `Cleaned up ${lockResult.removed.length} stale Git lock file(s): ${lockResult.removed.map((p) => path.basename(p)).join(', ')}.`,
      });
    } else {
      checks.push({ id: 'git_locks', status: 'passed', message: 'No stale Git lockfiles found.' });
    }

    // 2. Fix directory permissions
    const permFix = fixDirectoryPermissions(repository);
    checks.push({
      id: 'directory_permissions',
      status: permFix.fixed ? 'passed' : 'warning',
      message: permFix.message,
    });

    // 3. Quick setup
    const setup = quickSetupEnvironment(cwd, true);
    checks.push(...setup.checks);

    // 4. Prune worktrees
    try {
      git(repository, ['worktree', 'prune']);
      checks.push({ id: 'worktree_metadata', status: 'passed', message: 'Cleaned up legacy Git worktree metadata.' });
    } catch {
      checks.push({ id: 'worktree_metadata', status: 'warning', message: 'Failed to clean worktree metadata; using existing state.' });
    }
  } catch (error: any) {
    checks.push({ id: 'environment_setup', status: 'failed', message: error?.message || 'Failed to auto-repair workspace.' });
  }
  const preflight = await preflightAgent(provider, cwd);
  return {
    ok: preflight.ok,
    provider,
    checks: [...checks, ...preflight.checks],
    preflight,
  };
}

/**
 * Windows Git writes absolute drive-letter paths to linked-worktree metadata.
 * CAO may run Git inside WSL, which cannot resolve those paths. Relative links
 * are understood by both Git implementations, provided both targets stay in
 * the expected source repository/worktree pair.
 */
function normalizeWorktreeGitMetadata(root: string, target: string) {
  try {
    const worktreeGitFile = path.join(target, '.git');
    if (!fs.existsSync(worktreeGitFile) || fs.statSync(worktreeGitFile).isDirectory()) return false;
    const raw = fs.readFileSync(worktreeGitFile, 'utf8').trim();
    const matched = /^gitdir:\s*(.+)$/im.exec(raw);
    if (!matched) return false;
    const adminGitDir = path.resolve(target, matched[1].trim());
    const expectedRoot = path.resolve(root, '.git') + path.sep;
    if (!adminGitDir.startsWith(expectedRoot) || !fs.existsSync(adminGitDir)) {
      return false;
    }
    const adminGitFile = path.join(adminGitDir, 'gitdir');
    if (!fs.existsSync(adminGitFile)) {
      return false;
    }
    const relativeAdmin = path.relative(target, adminGitDir).replace(/\\/g, '/');
    const relativeWorktree = path.relative(adminGitDir, worktreeGitFile).replace(/\\/g, '/');
    if (!relativeAdmin || relativeAdmin.startsWith('../'.repeat(8)) || !relativeWorktree) {
      return false;
    }
    if (process.platform === 'win32') {
      try { fs.chmodSync(worktreeGitFile, 0o666); } catch { /* ignore */ }
      try { fs.chmodSync(adminGitFile, 0o666); } catch { /* ignore */ }
    }
    fs.writeFileSync(worktreeGitFile, `gitdir: ${relativeAdmin}\n`, 'utf8');
    fs.writeFileSync(adminGitFile, `${relativeWorktree}\n`, 'utf8');
    return true;
  } catch (error) {
    console.warn('[normalizeWorktreeGitMetadata] Non-fatal metadata normalization notice:', error);
    return false;
  }
}

function repairWorktreeForCao(cwd: string) {
  try {
    const gitFile = path.join(cwd, '.git');
    if (!fs.existsSync(gitFile) || fs.statSync(gitFile).isDirectory()) return false;
    const root = git(cwd, ['rev-parse', '--show-toplevel']);
    return normalizeWorktreeGitMetadata(root, cwd);
  } catch {
    return false;
  }
}

function createAgentWorktree(repository: string, issueKey: string) {
  const root = git(repository, ['rev-parse', '--show-toplevel']);
  const key = safeIssueKey(issueKey);
  const branch = `codex/${key}`;
  const target = path.join(path.dirname(root), '.task-companion-worktrees', key);
  let reused = false;

  // 1. Dọn dẹp lock files rác và metadata worktree cũ (Auto-prune)
  try { pruneGitLocks(root); } catch { /* ignore */ }
  try { git(root, ['worktree', 'prune']); } catch { /* ignore */ }

  // 2. Kiểm tra xem thư mục worktree đích đã tồn tại và có hợp lệ không
  if (fs.existsSync(target)) {
    let isValidWorktree = false;
    try {
      const gitDir = git(target, ['rev-parse', '--git-dir']);
      if (gitDir && fs.existsSync(path.join(target, '.git'))) {
        isValidWorktree = true;
      }
    } catch {
      isValidWorktree = false;
    }

    if (isValidWorktree) {
      reused = true;
      disableAgentGuardrails(target);
      try { normalizeWorktreeGitMetadata(root, target); } catch { /* ignore non-fatal */ }
      const setup = quickSetupEnvironment(target, true);
      if (!setup.ok) {
        const failures = setup.checks.filter((check) => check.status === 'failed').map((check) => check.message).join(' ');
        throw new Error(`Worktree environment setup failed. ${failures || 'Use Fix environment and retry.'}`);
      }
      return { path: target, branch, reused, baseCommit: git(target, ['rev-parse', 'HEAD']), environmentChecks: setup.checks };
    }

    // Nếu thư mục tồn tại nhưng hỏng / không phải worktree hợp lệ -> xóa sạch để tạo mới
    try {
      if (process.platform === 'win32') {
        try { fs.chmodSync(path.join(target, '.git'), 0o666); } catch { /* ignore */ }
      }
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e) {
      console.warn('[Worktree] Failed to remove corrupt target dir:', e);
    }
    try { git(root, ['worktree', 'prune']); } catch { /* ignore */ }
  }

  // 3. Tự động kiểm tra và giải phóng bất kỳ worktree xung đột nào đang gắn nhánh này
  try {
    const wtPorcelain = git(root, ['worktree', 'list', '--porcelain']);
    const blocks = wtPorcelain.split('\n\n');
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      let wtPath = '';
      let wtBranch = '';
      for (const line of lines) {
        if (line.startsWith('worktree ')) wtPath = line.substring(9).trim();
        if (line.startsWith('branch ')) wtBranch = line.substring(7).trim();
      }
      if (wtBranch === `refs/heads/${branch}` || wtBranch === branch) {
        if (path.resolve(wtPath).toLowerCase() !== path.resolve(target).toLowerCase()) {
          try {
            git(root, ['worktree', 'remove', '--force', wtPath]);
          } catch {
            try {
              if (fs.existsSync(wtPath)) fs.rmSync(wtPath, { recursive: true, force: true });
            } catch { /* ignore */ }
            try {
              const wtMetaDir = path.join(root, '.git', 'worktrees', path.basename(wtPath));
              if (fs.existsSync(wtMetaDir)) fs.rmSync(wtMetaDir, { recursive: true, force: true });
            } catch { /* ignore */ }
          }
        }
      }
    }
    git(root, ['worktree', 'prune']);
  } catch (err) {
    console.warn('[Worktree] Conflicting worktree scan warning:', err);
  }

  // 4. Tạo thư mục cha và khởi tạo worktree an toàn
  fs.mkdirSync(path.dirname(target), { recursive: true });

  let branchExists = false;
  try {
    git(root, ['rev-parse', '--verify', branch]);
    branchExists = true;
  } catch {
    branchExists = false;
  }

  let created = false;
  let lastErr: any = null;

  try {
    if (branchExists) {
      git(root, ['worktree', 'add', '--force', target, branch]);
    } else {
      git(root, ['worktree', 'add', '--force', '-b', branch, target, 'HEAD']);
    }
    created = true;
  } catch (err: any) {
    lastErr = err;
  }

  // Fallback: Tự động dọn dẹp và force reset branch (-B) nếu có xung đột
  if (!created) {
    try {
      try { git(root, ['worktree', 'prune']); } catch { /* ignore */ }
      try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* ignore */ }
      git(root, ['worktree', 'add', '--force', '-B', branch, target, 'HEAD']);
      created = true;
    } catch (fallbackErr: any) {
      throw new Error(`Git worktree creation failed: ${fallbackErr?.message || fallbackErr || lastErr?.message}`);
    }
  }

  disableAgentGuardrails(target);
  try {
    normalizeWorktreeGitMetadata(root, target);
  } catch (normErr) {
    console.warn('[Worktree] normalizeWorktreeGitMetadata notice:', normErr);
  }

  // A Git worktree never inherits node_modules/vendor from its source tree.
  // Prepare it before the agent starts so verification does not fail merely
  // because Vue, Vitest, or another project dependency is absent.
  const setup = quickSetupEnvironment(target, true);
  if (!setup.ok) {
    const failures = setup.checks.filter((check) => check.status === 'failed').map((check) => check.message).join(' ');
    throw new Error(`Worktree environment setup failed. ${failures || 'Use Fix environment and retry.'}`);
  }
  return { path: target, branch, reused, baseCommit: git(target, ['rev-parse', 'HEAD']), environmentChecks: setup.checks };
}

async function checkForUpdates(): Promise<typeof updateState> {
  if (!app.isPackaged) {
    setUpdateState({ status: 'not-available', message: 'Auto-update is only available in installed desktop releases.' });
    return updateState;
  }
  if (updateState.status === 'checking' || updateState.status === 'downloading') return updateState;
  setUpdateState({ status: 'checking', message: 'Checking for updates...' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error: any) {
    setUpdateState({ status: 'error', message: error?.message?.slice(0, 240) || 'Failed to check for updates.' });
  }
  return updateState;
}

function installDownloadedUpdate(): typeof updateState {
  if (!app.isPackaged) {
    setUpdateState({ status: 'not-available', message: 'Please install the desktop release to use auto-update.' });
  } else if (updateState.status !== 'downloaded') {
    setUpdateState({ status: 'not-available', message: 'No update downloaded yet. Click "Check for Updates" first.' });
  } else {
    autoUpdater.quitAndInstall(false, true);
  }
  return updateState;
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', message: 'Checking for updates...' }));
  autoUpdater.on('update-available', (info) => setUpdateState({ status: 'available', version: info.version, percent: 0, message: `Downloading version ${info.version}...` }));
  autoUpdater.on('update-not-available', (info) => setUpdateState({ status: 'not-available', version: info.version, percent: 100, message: 'Application is up to date.' }));
  autoUpdater.on('download-progress', (progress) => setUpdateState({ status: 'downloading', percent: Math.round(progress.percent), message: `Downloading update: ${Math.round(progress.percent)}%...` }));
  autoUpdater.on('update-downloaded', (info) => setUpdateState({ status: 'downloaded', version: info.version, percent: 100, message: `Version ${info.version} is ready to install.` }));
  autoUpdater.on('error', (error) => setUpdateState({ status: 'error', message: error.message.slice(0, 240) || 'Failed to check for updates.' }));
  updateTimer = setInterval(() => {
    void checkForUpdates();
  }, 6 * 60 * 60 * 1000);
}

const CAO_DEFAULT_PORT = 9889;
let caoDaemonProcess: ChildProcess | null = null;
type CaoRuntime =
  | { kind: 'native'; executable: string }
  | { kind: 'wsl'; executable: string; distro?: string };
type ResolvedCaoRuntime = CaoRuntime;
type AgentRuntimeProvider = AgentProvider;

type CaoPortOwnerInfo =
  | { kind: 'none'; pid: number }
  | { kind: 'self'; pid: number }
  | { kind: 'conflicting_cao'; pid: number }
  | { kind: 'other'; pid: number };

let caoRuntime: CaoRuntime | null | undefined;
const CAO_WSL_BOOTSTRAP = 'export PATH="$HOME/.local/bin:$PATH"; export CAO_HOME_DIR="${TASK_HUB_CAO_WSL_HOME:-$HOME/.task-hub-cao}";';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function wslExecutable(): string | null {
  if (process.platform !== 'win32') return null;
  const systemWsl = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wsl.exe');
  return fs.existsSync(systemWsl) ? systemWsl : resolveCli('wsl');
}

function runWslShell(script: string, timeoutMs = 5_000): Promise<CaoCommandResult> {
  const executable = wslExecutable();
  if (!executable) return Promise.resolve({ ok: false, output: '', error: 'WSL is unavailable.' });
  const distro = process.env.TASK_HUB_CAO_WSL_DISTRO;
  const args = [...(distro ? ['-d', distro] : []), '--', '/bin/bash', '-lc', `${CAO_WSL_BOOTSTRAP} ${script}`];
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (result: CaoCommandResult) => { if (!settled) { settled = true; resolve(result); } };
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timeout = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ ok: false, output, error: 'WSL command timed out.' }); }, timeoutMs);
    child.stdout?.on('data', (chunk) => { output += String(chunk); });
    child.stderr?.on('data', (chunk) => { output += String(chunk); });
    child.once('error', (error) => { clearTimeout(timeout); finish({ ok: false, output, error: error.message }); });
    child.once('close', (code) => { clearTimeout(timeout); finish({ ok: code === 0, output, error: code === 0 ? undefined : (output.trim().slice(-1000) || `WSL exited with code ${code}.`) }); });
  });
}

async function resolveCaoRuntime(): Promise<CaoRuntime | null> {
  if (caoRuntime !== undefined) return caoRuntime;
  const native = resolveCli('cao');
  if (native) return (caoRuntime = { kind: 'native', executable: native });
  if (!wslExecutable()) return (caoRuntime = null);
  const probe = await runWslShell('command -v cao >/dev/null && command -v cao-server >/dev/null', 5_000);
  return (caoRuntime = probe.ok ? { kind: 'wsl', executable: wslExecutable()!, distro: process.env.TASK_HUB_CAO_WSL_DISTRO } : null);
}

async function wslPathFor(windowsPath: string): Promise<string | null> {
  const converted = await runWslShell(`wslpath -a -- ${shellQuote(windowsPath)}`, 5_000);
  return converted.ok ? converted.output.trim() || null : null;
}

async function probeCaoWslHome(runtime?: ResolvedCaoRuntime | null): Promise<{ valid: boolean; home: string; error?: string }> {
  const script = `
    home="\${TASK_HUB_CAO_WSL_HOME:-$HOME/.task-hub-cao}"
    mkdir -p "$home/fifos" || { echo "CAO_HOME_INVALID:$home"; exit 1; }
    probe="$home/fifos/.probe-$$"
    if ! mkfifo "$probe" 2>/dev/null; then
      echo "CAO_HOME_INVALID:$home"
      exit 1
    fi
    rm -f "$probe"
    find "$home/fifos" -maxdepth 1 -type p -delete;
    echo "CAO_HOME_OK:$home"
  `;
  const result = await runWslShell(script, 5000);
  if (!result.ok || !result.output.includes('CAO_HOME_OK')) {
    return { valid: false, home: '', error: `CAO home directory does not support FIFOs: ${result.error || result.output}` };
  }
  const home = result.output.split('CAO_HOME_OK:')[1]?.trim().split('\n')[0] || '';
  return { valid: true, home };
}

function caoServerPort(): number {
  const configured = Number(process.env.CAO_SERVER_PORT || CAO_DEFAULT_PORT);
  return Number.isInteger(configured) && configured > 0 && configured < 65536 ? configured : CAO_DEFAULT_PORT;
}

function resolveCaoExecutable(): string | null {
  const binaryName = process.platform === 'win32' ? 'cao-server.exe' : 'cao-server';
  const candidates = [
    process.env.TASK_HUB_CAO_PATH,
    process.env.CAO_SERVER_PATH,
    path.join(process.resourcesPath, 'bin', 'cao', binaryName),
    path.join(__dirname, '..', 'bin', 'cao', binaryName),
    path.join(__dirname, '..', 'resources', 'bin', 'cao', binaryName),
    resolveCli('cao-server'),
    resolveCli('cao'),
  ].filter(Boolean) as string[];

  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function isCaoPortOpen(port = caoServerPort(), timeoutMs = 3000): Promise<boolean> {
  const checkOnce = (timeout: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/health`, { timeout }, (res: http.IncomingMessage) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          // Ensure response is from CAO server (JSON response with status/cao/version) rather than another local server (ERP/web app on port 8000)
          const isJson = res.headers['content-type']?.includes('application/json');
          const isCaoContent = body.includes('status') || body.includes('cao') || body.includes('version') || body.includes('ok');
          resolve(res.statusCode === 200 && Boolean(isJson || isCaoContent));
        });
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  };

  const initial = await checkOnce(timeoutMs);
  if (initial) return true;
  // If first attempt timed out or failed, attempt 1 quick retry with 2000ms timeout
  return await checkOnce(2000);
}

async function inspectCaoPortOwner(port = caoServerPort()): Promise<CaoPortOwnerInfo> {
  const open = await isCaoPortOpen(port);
  if (!open) return { kind: 'none', pid: 0 };
  return { kind: 'conflicting_cao', pid: 0 };
}

async function stopConflictingCaoDaemon(port = caoServerPort()): Promise<{ stopped: boolean; reason: string }> {
  const owner = await inspectCaoPortOwner(port);
  if (owner.kind === 'conflicting_cao') {
    if (caoDaemonProcess) {
      try { caoDaemonProcess.kill(); } catch { /* ignore */ }
      caoDaemonProcess = null;
    }
    return { stopped: true, reason: 'Conflicting CAO daemon stopped.' };
  }
  if (owner.kind === 'other') {
    const msg = `Port ${port} is occupied by a non-Task-Hub process and will not be stopped.`;
    console.warn(msg);
    return { stopped: false, reason: msg };
  }
  return { stopped: true, reason: 'No conflicting daemon found on port.' };
}

async function isCaoProviderAvailable(provider: AgentRuntimeProvider, runtime?: ResolvedCaoRuntime | null): Promise<boolean> {
  const cao = runtime !== undefined ? runtime : await resolveCaoRuntime();
  if (!cao) return false;
  const cmd = provider === 'antigravity' ? 'agy' : provider === 'claude_code' ? 'claude' : 'codex';
  if (cao.kind === 'wsl') {
    const res = await runWslShell(`command -v ${cmd} | grep -qvE '\\.(exe|cmd|bat)$'`, 3000);
    return res.ok;
  }
  const local = resolveCli(cmd);
  return Boolean(local);
}

async function startCaoDaemon() {
  try {
    const port = caoServerPort();
    const alreadyRunning = await isCaoPortOpen(port);
    if (alreadyRunning) {
      console.log(`[CAO Daemon] Existing cao-server detected on port ${port}.`);
      return { status: 'running', source: 'external', port };
    }

    const runtime = await resolveCaoRuntime();
    if (!runtime) {
      console.log('[CAO Daemon] Standalone CAO binary not found; CAO is required for all agent runs.');
      return { status: 'offline', message: 'CAO runtime unavailable', port };
    }

    console.log('[CAO Daemon] Spawning official CAO daemon through:', runtime.kind, 'on port:', port);
    // CAO reads CAO_API_PORT itself.  Do not rely on an undocumented HTTP
    // bridge: this starts the official `cao-server` process used by `cao`.
    const isWsl = runtime.kind === 'wsl';
    const executable = isWsl ? runtime.executable : (resolveCaoExecutable() || runtime.executable);
    const args = isWsl
      ? [...(runtime.distro ? ['-d', runtime.distro] : []), '--', '/bin/bash', '-lc', `${CAO_WSL_BOOTSTRAP} exec cao-server --port ${port}`]
      : ['--port', String(port)];
    caoDaemonProcess = spawn(executable, args, {
      stdio: 'ignore',
      windowsHide: true,
      detached: false,
      env: { ...nativeAgentEnvironment(), CAO_API_PORT: String(port) },
    });

    caoDaemonProcess.on('error', (err: Error) => {
      console.warn('[CAO Daemon] Failed to start:', err.message);
      caoDaemonProcess = null;
    });

    caoDaemonProcess.on('exit', (code: number | null) => {
      console.log('[CAO Daemon] Process exited with code:', code);
      caoDaemonProcess = null;
    });

    return { status: 'running', source: 'embedded', executable, runtime: runtime.kind, port };
  } catch (error: any) {
    console.warn('[CAO Daemon] Launch exception:', error?.message);
    return { status: 'error', message: error?.message };
  }
}

type CaoCommandResult = { ok: boolean; output: string; error?: string };

async function runCaoCommand(args: string[], cwd: string, timeoutMs = 15_000): Promise<CaoCommandResult> {
  const runtime = await resolveCaoRuntime();
  if (!runtime) return { ok: false, output: '', error: 'CAO CLI was not found.' };
  const workingDirectory = runtime.kind === 'wsl' ? await wslPathFor(cwd) : cwd;
  if (!workingDirectory) return { ok: false, output: '', error: `Could not map workspace into the CAO runtime: ${cwd}` };
  const executable = runtime.executable;
  const caoArgs = runtime.kind === 'wsl'
    ? args.map((value, index) => args[index - 1] === '--working-directory' ? workingDirectory : value)
    : args;
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (result: CaoCommandResult) => {
      if (!settled) { settled = true; resolve(result); }
    };
    try {
      const isWsl = runtime.kind === 'wsl';
      const commandArgs = isWsl
        ? [...(runtime.distro ? ['-d', runtime.distro] : []), '--', '/bin/bash', '-lc', `${CAO_WSL_BOOTSTRAP} cd -- ${shellQuote(workingDirectory)}; exec cao ${caoArgs.map(shellQuote).join(' ')}`]
        : caoArgs;
      const child = spawn(executable, commandArgs, {
        cwd: isWsl ? undefined : workingDirectory,
        windowsHide: true,
        shell: !isWsl && process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...nativeAgentEnvironment(), CAO_API_PORT: String(caoServerPort()) },
      });
      const timeout = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        finish({ ok: false, output, error: `CAO command timed out after ${Math.round(timeoutMs / 1000)}s.` });
      }, timeoutMs);
      child.stdout?.on('data', (chunk) => { output += String(chunk); });
      child.stderr?.on('data', (chunk) => { output += String(chunk); });
      child.once('error', (error) => { clearTimeout(timeout); finish({ ok: false, output, error: error.message }); });
      child.once('close', (code) => {
        clearTimeout(timeout);
        finish({ ok: code === 0, output, error: code === 0 ? undefined : (output.trim().slice(-1000) || `CAO exited with code ${code}.`) });
      });
    } catch (error: any) {
      finish({ ok: false, output, error: error?.message || 'Unable to execute CAO command.' });
    }
  });
}

async function ensureCaoReady(cwd: string): Promise<boolean> {
  if (!await resolveCaoRuntime()) return false;
  if (await isCaoPortOpen()) return true;
  const started = await startCaoDaemon();
  if (started.status === 'error' || started.status === 'offline') return false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await isCaoPortOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  appendWorkspaceAgentLog(cwd, 'cao-runtime', 'cao_unavailable', { port: caoServerPort(), started });
  return false;
}

function caoProvider(provider: AgentProvider): string {
  if (provider === 'antigravity') return 'antigravity_cli';
  return provider;
}

function stopCaoSessionPoller(sessionId: string) {
  const poller = caoSessionPollers.get(sessionId);
  if (poller) clearInterval(poller);
  caoSessionPollers.delete(sessionId);
}

type CaoWorkerStatus = {
  id?: string;
  name?: string;
  role?: string;
  state: string;
  status?: string;
  live?: boolean;
  exitCode?: number | null;
  last_output?: string;
};

type CaoSessionStatus = {
  state: string;
  output: string;
  workers: CaoWorkerStatus[];
};

function isCaoTerminalState(state: string): boolean {
  return /^(error|failed|cancelled|completed|terminated|dead|stopped)$/i.test(state);
}

function stripTerminalAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').trim();
}

function parseCaoSessionStatus(raw: string): CaoSessionStatus {
  let data: any;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    // CAO may prefix JSON with a warning (for example --yolo). Recover the
    // final JSON object instead of forwarding the warning as agent output.
    const objects = takeJsonObjects(raw).objects;
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      try { data = JSON.parse(objects[index]); break; } catch { /* keep looking */ }
    }
  }
  const conductor = data?.conductor || data;
  const state = String(conductor?.status || data?.status || '').toLowerCase();
  const outputs: string[] = [];
  if (typeof conductor?.last_output === 'string' && conductor.last_output.trim()) {
    outputs.push(stripTerminalAnsi(conductor.last_output));
  }
  const workers: CaoWorkerStatus[] = [];
  if (Array.isArray(data?.workers)) {
    for (const worker of data.workers) {
      const output = typeof worker?.last_output === 'string' ? stripTerminalAnsi(worker.last_output) : '';
      if (output) outputs.push(`[${worker.id || worker.name || 'worker'}]\n${output}`);
      workers.push({
        id: worker.id,
        name: worker.name,
        role: worker.role,
        state: String(worker.status || worker.state || '').toLowerCase(),
        status: worker.status,
        last_output: output,
      });
    }
  }
  return { state, output: outputs.filter(Boolean).join('\n\n'), workers };
}

function pollCaoSession(sessionId: string) {
  const session = agentProcesses.get(sessionId);
  if (!session?.caoSessionName) return stopCaoSessionPoller(sessionId);
  void runCaoCommand(['session', 'status', session.caoSessionName, '--workers', '--json'], session.cwd, 10_000).then((result) => {
    const current = agentProcesses.get(sessionId);
    if (!current || !result.ok) return;
    const status = parseCaoSessionStatus(result.output);
    if (status.output && status.output !== current.caoLastOutput) {
      const previous = current.caoLastOutput || '';
      const delta = previous && status.output.startsWith(previous) ? status.output.slice(previous.length).trim() : status.output;
      current.caoLastOutput = status.output;
      if (delta) {
        current.output = `${current.output}\n${delta}`.slice(-250000);
        appendWorkspaceAgentLog(current.cwd, sessionId, 'cao_output', delta);
        safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text: `${delta}\n`, event: { type: 'cao.session.output', session: current.caoSessionName } });
        persistSessionUpdate({ sessionId, output: current.output, caoSessionName: current.caoSessionName, caoLastOutput: current.caoLastOutput, status: 'running' });
      }
    }
    current.caoLastStatus = status.state;
    safeSend(win, 'agent-output', {
      sessionId,
      stream: 'event',
      text: '',
      event: { type: 'cao.session.state', status: status.state, session: current.caoSessionName }
    });

    if (isCaoTerminalState(status.state)) {
      const liveWorkers = status.workers.filter((worker) => !isCaoTerminalState(worker.state));
      if (liveWorkers.length > 0) {
        appendWorkspaceAgentLog(current.cwd, sessionId, 'cao_waiting_workers', { workers: liveWorkers });
        safeSend(win, 'agent-output', {
          sessionId,
          stream: 'event',
          text: '',
          event: {
            type: 'cao.session.waiting_workers',
            session: current.caoSessionName,
            count: liveWorkers.length,
            text: `CAO supervisor finished; waiting for ${liveWorkers.length} active worker(s)...`
          }
        });
        return;
      }
      const failed = /^(error|failed|cancelled|terminated|dead)$/.test(status.state);
      stopCaoSessionPoller(sessionId);
      persistSessionUpdate({ sessionId, status: failed ? 'failed' : 'completed', exitCode: failed ? 1 : 0, output: current.output, caoSessionName: current.caoSessionName, caoLastOutput: current.caoLastOutput });
      agentProcesses.delete(sessionId);
      safeSend(win, 'agent-exit', { sessionId, code: failed ? 1 : 0, signal: failed ? 'CAO_STATUS' : '' });
    }
  });
}

async function waitForCaoSession(sessionName: string, cwd: string): Promise<CaoCommandResult | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const status = await runCaoCommand(['session', 'status', sessionName, '--json'], cwd, 5_000);
    if (status.ok) return status;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return null;
}

async function tryStartCaoAgent(payload: { provider: AgentProvider; cwd: string; prompt?: string; kind: 'task' | 'docs'; model?: string; executionPolicy: AgentExecutionPolicy }) {
  if (!await ensureCaoReady(payload.cwd)) return null;
  const suffix = `task-hub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = `cao-${suffix}`;
  const stagedPrompt = stageAgentPrompt(payload.cwd, sessionId, payload.prompt);
  const runtime = await resolveCaoRuntime();
  const stagedPromptPath = path.join(workspaceAgentDirectory(payload.cwd), 'prompts', `${sessionId}.md`);
  const caoPromptPath = runtime?.kind === 'wsl' ? await wslPathFor(stagedPromptPath) : stagedPromptPath;
  const prompt = caoPromptPath ? stagedPrompt.replace(stagedPromptPath, caoPromptPath) : stagedPrompt;
  const profile = process.env.TASK_HUB_CAO_PROFILE || 'code_supervisor';
  const args = [
    'launch', prompt,
    '--agents', profile,
    '--session-name', suffix,
    '--provider', caoProvider(payload.provider),
    '--headless', '--async', '--auto-approve',
    '--working-directory', payload.cwd,
  ];
  if (payload.executionPolicy === 'full_access') args.push('--yolo');
  // The CAO CLI can return an HTTP timeout while the detached supervisor is
  // still being created. Treat a verifiably existing session as success so
  // the UI does not report a false failure or lose the live CAO session.
  const launched = await runCaoCommand(args, payload.cwd, 45_000);
  let launchOutput = launched.output;
  if (!launched.ok) {
    const recovered = await waitForCaoSession(sessionId, payload.cwd);
    if (!recovered) throw new Error(`CAO could not launch the ${profile} supervisor: ${launched.error || 'unknown error'}`);
    launchOutput = `${launchOutput}\nCAO launch accepted; supervisor session is available.\n`.trim();
  }

  const session: AgentSession = {
    provider: payload.provider,
    model: payload.model,
    cwd: payload.cwd,
    mode: 'exec',
    kind: payload.kind,
    output: launchOutput,
    events: [],
    route: 'cao',
    executionPolicy: payload.executionPolicy,
    caoSessionName: sessionId,
  };
  agentProcesses.set(sessionId, session);
  persistSessionUpdate({
    sessionId, provider: payload.provider, model: payload.model, cwd: payload.cwd, mode: 'exec', kind: payload.kind,
    status: 'running', startedAt: new Date().toISOString(), output: launchOutput, events: [], route: 'cao',
    executionPolicy: payload.executionPolicy, caoSessionName: sessionId,
  });
  appendWorkspaceAgentLog(payload.cwd, sessionId, 'cao_session_started', { profile, provider: caoProvider(payload.provider), model: payload.model, execution_policy: payload.executionPolicy, cao_session: sessionId });
  safeSend(win, 'agent-output', { sessionId, stream: 'event', text: `CAO supervisor ${profile} started (${sessionId}).\n`, event: { type: 'cao.session.started', session: sessionId, profile } });
  const poller = setInterval(() => pollCaoSession(sessionId), 3_000);
  caoSessionPollers.set(sessionId, poller);
  pollCaoSession(sessionId);
  return { mode: 'interactive' as const, sessionId, provider: payload.provider, model: payload.model, cwd: payload.cwd, capabilities: [...PROVIDER_CAPABILITIES[payload.provider], 'cao_supervisor', 'multi_agent'] };
}

async function reconnectCaoSession(sessionId: string) {
  const saved = readAllSavedSessions().find((s) => s.sessionId === sessionId || s.caoSessionName === sessionId);
  if (!saved || saved.route !== 'cao') {
    throw new Error(`Cannot find saved CAO session: ${sessionId}`);
  }
  const caoSessionName = saved.caoSessionName || saved.sessionId;
  const cwd = saved.cwd || process.cwd();

  if (repairWorktreeForCao(cwd)) {
    appendWorkspaceAgentLog(cwd, 'cao-runtime', 'worktree_metadata_normalized', { cwd });
  }

  const statusResult = await runCaoCommand(['session', 'status', caoSessionName, '--workers', '--json'], cwd, 10_000);
  if (!statusResult.ok) {
    throw new Error(`CAO session ${caoSessionName} is not active: ${statusResult.error || 'unknown error'}`);
  }

  const parsed = parseCaoSessionStatus(statusResult.output);
  const session: AgentSession = {
    provider: saved.provider || 'codex',
    model: saved.model,
    cwd,
    mode: saved.mode || 'exec',
    kind: saved.kind || 'task',
    output: saved.output || parsed.output,
    events: saved.events || [],
    route: 'cao',
    executionPolicy: saved.executionPolicy || 'workspace_write',
    caoSessionName,
    caoLastOutput: parsed.output,
    caoLastStatus: parsed.state,
  };
  agentProcesses.set(saved.sessionId, session);

  stopCaoSessionPoller(saved.sessionId);
  const poller = setInterval(() => pollCaoSession(saved.sessionId), 3_000);
  caoSessionPollers.set(saved.sessionId, poller);
  pollCaoSession(saved.sessionId);

  return {
    sessionId: saved.sessionId,
    route: 'cao' as const,
    status: parsed.state,
    workers: [],
  };
}

function stopCaoDaemon() {
  if (caoDaemonProcess) {
    try {
      console.log('[CAO Daemon] Terminating embedded daemon process...');
      caoDaemonProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
    caoDaemonProcess = null;
  }
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 520;

function getIconImage() {
  const possiblePaths = [
    path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.env.VITE_PUBLIC || '', 'midnight-hub-mark.png'),
    path.join(__dirname, '../public/midnight-hub-mark.png'),
    path.join(process.env.VITE_PUBLIC || '', 'midnight-hub-mark.svg'),
    path.join(__dirname, '../public/midnight-hub-mark.svg'),
    path.join(process.env.VITE_PUBLIC || '', 'macatung-mark.svg'),
    path.join(__dirname, '../public/macatung-mark.svg'),
    path.join(__dirname, '../../public/brand/midnight-hub-mark.png'),
    path.join(process.cwd(), 'public/brand/midnight-hub-mark.png'),
    path.join(process.cwd(), 'desktop/public/icon.png'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }

  // Fallback: Crisp Midnight Crescent M Mark
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#04070D"/><path d="M7 23V9h3l6 8 6-8h3v14h-3V14l-6 8-6-8v9H7z" fill="#00F5A0"/><circle cx="16" cy="7" r="1.5" fill="#00F5D4"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

function getTrayImage() {
  const possiblePaths = [
    path.join(process.env.VITE_PUBLIC || '', 'tray-icon.png'),
    path.join(__dirname, '../public/tray-icon.png'),
    path.join(process.env.VITE_PUBLIC || '', 'midnight-hub-tray.png'),
    path.join(__dirname, '../public/midnight-hub-tray.png'),
    path.join(process.env.VITE_PUBLIC || '', 'midnight-hub-tray.svg'),
    path.join(__dirname, '../public/midnight-hub-tray.svg'),
    path.join(process.env.VITE_PUBLIC || '', 'macatung-tray.svg'),
    path.join(__dirname, '../public/macatung-tray.svg'),
  ];
  for (const trayPath of possiblePaths) {
    if (fs.existsSync(trayPath)) {
      const image = nativeImage.createFromPath(trayPath);
      if (!image.isEmpty()) return image.resize({ width: 20, height: 20 });
    }
  }
  return getIconImage().resize({ width: 20, height: 20 });
}

function getPreloadPath() {
  const possiblePaths = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload.mjs'),
    path.join(__dirname, '../dist-electron/preload.js'),
    path.join(__dirname, '../dist-electron/preload.mjs'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.join(__dirname, 'preload.js');
}

export type AppMode = 'ide' | 'mascot';
let currentMode: AppMode = 'ide';

function appModeConfigPath(): string {
  return path.join(app.getPath('userData'), 'app-mode.json');
}

function readSavedAppMode(): AppMode {
  try {
    for (const arg of process.argv) {
      if (arg.startsWith('--mode=')) {
        const val = arg.split('=')[1]?.trim().toLowerCase();
        if (val === 'ide' || val === 'mascot') return val;
      }
      if (arg === '--ide') return 'ide';
      if (arg === '--mascot') return 'mascot';
    }
    const envMode = process.env.VITE_APP_MODE || process.env.APP_MODE;
    if (envMode === 'ide' || envMode === 'mascot') return envMode;

    const file = appModeConfigPath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data?.mode === 'ide' || data?.mode === 'mascot') return data.mode;
    }
  } catch (e) {
    console.warn('Failed to read saved app mode:', e);
  }
  return 'ide';
}

function writeSavedAppMode(mode: AppMode) {
  try {
    const file = appModeConfigPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ mode, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write saved app mode:', e);
  }
}

function applyAppMode(mode: AppMode) {
  currentMode = mode;
  writeSavedAppMode(mode);

  if (!win) return currentMode;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workAreaX, y: workAreaY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  if (mode === 'ide') {
    const ideWidth = Math.min(1360, Math.max(1024, screenWidth - 100));
    const ideHeight = Math.min(880, Math.max(700, screenHeight - 60));
    const x = workAreaX + Math.max(0, Math.round((screenWidth - ideWidth) / 2));
    const y = workAreaY + Math.max(0, Math.round((screenHeight - ideHeight) / 2));

    // IDE is a normal desktop application: it must not obscure other windows or the taskbar.
    win.setFullScreen(false);
    win.setAlwaysOnTop(false);
    win.setMinimumSize(960, 600);
    win.setBounds({ x, y, width: ideWidth, height: ideHeight });
    win.show();
    win.focus();
  } else {
    const mascotWidth = 640;
    const mascotHeight = 520;
    const x = workAreaX + Math.max(0, screenWidth - mascotWidth - 20);
    const y = workAreaY + Math.max(0, screenHeight - mascotHeight - 20);

    // Keep the companion available without forcing it above the user's active apps.
    win.setFullScreen(false);
    win.setAlwaysOnTop(false);
    win.setMinimumSize(320, 240);
    win.setBounds({ x, y, width: mascotWidth, height: mascotHeight });
    win.show();
  }

  safeSend(win, 'app-mode-changed', currentMode);
  return currentMode;
}

function createWindow() {
  // The desktop is now a single control-center surface; legacy mascot mode is
  // deliberately ignored even if an older installation saved it.
  currentMode = 'ide';
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workAreaX, y: workAreaY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const appIcon = getIconImage();
  const preloadFile = getPreloadPath();

  const isIde = currentMode === 'ide';
  const initialWidth = isIde ? Math.min(1360, Math.max(1024, screenWidth - 100)) : DEFAULT_WIDTH;
  const initialHeight = isIde ? Math.min(880, Math.max(700, screenHeight - 60)) : DEFAULT_HEIGHT;
  const initialX = isIde
    ? workAreaX + Math.max(0, Math.round((screenWidth - initialWidth) / 2))
    : workAreaX + Math.max(0, screenWidth - DEFAULT_WIDTH - 20);
  const initialY = isIde
    ? workAreaY + Math.max(0, Math.round((screenHeight - initialHeight) / 2))
    : workAreaY + Math.max(0, screenHeight - DEFAULT_HEIGHT - 20);

  win = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
    minWidth: isIde ? 960 : 320,
    minHeight: isIde ? 600 : 240,
    transparent: !isIde,
    frame: false,
    // Never make the normal IDE or the companion permanently cover other apps.
    alwaysOnTop: false,
    hasShadow: true,
    resizable: true,
    skipTaskbar: false,
    icon: appIcon,
    show: true,
    backgroundColor: isIde ? '#1e1e1e' : undefined,
    webPreferences: {
      preload: preloadFile,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setAspectRatio(0);
  win.setFullScreen(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || path.join(__dirname, '../dist'), 'index.html'));
  }

  win.show();
  win.focus();

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page finished loading. App mode:', currentMode);
    safeSend(win, 'app-mode-changed', currentMode);
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = level === 0 ? 'INFO' : level === 1 ? 'WARN' : 'ERROR';
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Load Error] Code: ${errorCode}, Description: ${errorDescription}, URL: ${validatedURL}`);
    if (validatedURL?.startsWith('http://') || validatedURL?.startsWith('https://')) {
      const fallbackFile = path.join(process.env.DIST || path.join(__dirname, '../dist'), 'index.html');
      if (fs.existsSync(fallbackFile)) {
        console.log('[Electron] Falling back to built local index.html...');
        win?.loadFile(fallbackFile);
      }
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Renderer Process Gone] reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[Preload Error] ${preloadPath}: ${error.message}`);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')) {
      win?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  ipcMain.handle('app-get-mode', () => currentMode);
  ipcMain.handle('app-set-mode', (_event, mode: AppMode) => applyAppMode(mode));
  ipcMain.handle('app-toggle-mode', () => applyAppMode(currentMode === 'ide' ? 'mascot' : 'ide'));
  ipcMain.handle('app-get-system-info', () => ({
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    username: os.userInfo().username,
  }));

  ipcMain.on('window-close', () => {
    if (win) win.hide();
  });

  ipcMain.on('window-minimize', () => {
    if (win) win.minimize();
  });

  ipcMain.handle('window-toggle-maximize', () => {
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      return win.isMaximized();
    }
    return false;
  });

  ipcMain.on('window-set-always-on-top', (_event, alwaysOnTop: boolean) => {
    if (win) win.setAlwaysOnTop(alwaysOnTop);
  });

  ipcMain.on('window-move-by', (_event, { dx, dy }: { dx: number; dy: number }) => {
    if (win) {
      const [currentX, currentY] = win.getPosition();
      win.setPosition(Math.round(currentX + dx), Math.round(currentY + dy));
    }
  });

  ipcMain.on('window-resize', (_event, { width, height }: { width: number; height: number }) => {
    if (win) {
      const bounds = win.getBounds();
      const display = screen.getDisplayMatching(bounds);
      const workArea = display.workArea;
      const [minWidth, minHeight] = win.getMinimumSize();
      const nextWidth = Math.min(Math.max(Math.round(width), minWidth), workArea.width);
      const nextHeight = Math.min(Math.max(Math.round(height), minHeight), workArea.height);
      const maxX = workArea.x + workArea.width - nextWidth;
      const maxY = workArea.y + workArea.height - nextHeight;
      win.setBounds({
        x: Math.min(Math.max(bounds.x, workArea.x), maxX),
        y: Math.min(Math.max(bounds.y, workArea.y), maxY),
        width: nextWidth,
        height: nextHeight,
      });
    }
  });

  ipcMain.on('window-ignore-mouse-events', (_event, { ignore, forward }: { ignore: boolean; forward: boolean }) => {
    if (win) {
      win.setIgnoreMouseEvents(ignore, { forward });
    }
  });

  ipcMain.handle('agent-pick-workspace', async () => {
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('agent-list-workspaces', () => readSavedAgentWorkspaces());
  ipcMain.handle('agent-save-workspace', (_event, cwd: string) => {
    const resolved = path.resolve(cwd || '');
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error('Workspace must be a valid directory.');
    const workspaces = [resolved, ...readSavedAgentWorkspaces().filter((item) => item !== resolved)].slice(0, 12);
    return writeSavedAgentWorkspaces(workspaces);
  });
  ipcMain.handle('agent-remove-workspace', (_event, cwd: string) => writeSavedAgentWorkspaces(readSavedAgentWorkspaces().filter((item) => item !== path.resolve(cwd || ''))));

  ipcMain.handle('window-toggle-fullscreen', (_event, fullscreen: boolean) => {
    // A full-screen Electron window hides the Windows taskbar. Use standard
    // maximize/restore instead so the app remains a well-behaved desktop window.
    if (!win) return false;
    if (fullscreen) win.maximize();
    else win.unmaximize();
    return win.isMaximized();
  });

  ipcMain.handle('agent-read-generated-documents', (_event, worktree: string) => {
    const resolved = path.resolve(worktree || '');
    const marker = `${path.sep}.task-companion-worktrees${path.sep}`;
    if (!resolved.includes(marker)) throw new Error('Can only read documentation from worktrees created by Task Hub Studio.');
    const paths = ['docs/PROJECT_DOCUMENTS.md', 'docs/PROJECT_BRIEF.md', 'docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/QA_PLAN.md', 'docs/RELEASE_RUNBOOK.md'];
    const documents = paths.filter((relative) => fs.existsSync(path.join(resolved, relative))).map((relative) => ({ path: relative, content: fs.readFileSync(path.join(resolved, relative), 'utf8') }));
    const manifest = documents.find((document) => document.path === 'docs/PROJECT_DOCUMENTS.md')?.content;
    if (!manifest) throw new Error('Agent has not generated docs/PROJECT_DOCUMENTS.md yet.');
    return { manifest, documents: documents.filter((document) => document.path !== 'docs/PROJECT_DOCUMENTS.md') };
  });

  ipcMain.handle('agent-apply-docs-to-workspace', (_event, { worktree, destinationWorkspace }: { worktree: string; destinationWorkspace: string }) => {
    const resolvedWorktree = path.resolve(worktree || '');
    const resolvedDest = path.resolve(destinationWorkspace || '');
    if (!fs.existsSync(resolvedWorktree) || !fs.existsSync(resolvedDest)) {
      throw new Error('Source or destination directory does not exist.');
    }
    const docsDirSrc = path.join(resolvedWorktree, 'docs');
    const docsDirDest = path.join(resolvedDest, 'docs');
    if (!fs.existsSync(docsDirSrc)) {
      throw new Error('Docs directory not found in worktree.');
    }
    fs.mkdirSync(docsDirDest, { recursive: true });
    const copiedFiles: string[] = [];
    const entries = fs.readdirSync(docsDirSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const srcFile = path.join(docsDirSrc, entry.name);
        const destFile = path.join(docsDirDest, entry.name);
        fs.copyFileSync(srcFile, destFile);
        copiedFiles.push(`docs/${entry.name}`);
      }
    }
    return { success: true, count: copiedFiles.length, files: copiedFiles };
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only HTTP/HTTPS URLs are allowed.');
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('updater-get-state', () => updateState);
  ipcMain.handle('updater-check', async () => {
    return checkForUpdates();
  });
  ipcMain.handle('cao-get-status', async () => {
    const port = caoServerPort();
    const isRunning = await isCaoPortOpen(port);
    const binary = resolveCaoExecutable();
    const runtime = await resolveCaoRuntime();
    if (!isRunning && runtime && !caoDaemonProcess) {
      void startCaoDaemon();
    }
    const cli = runtime ? (runtime.kind === 'wsl' ? `WSL${runtime.distro ? ` (${runtime.distro})` : ''}: cao` : runtime.executable) : null;
    return {
      running: isRunning,
      port,
      cli,
      available: Boolean(isRunning && runtime),
      embeddedBinary: binary,
      source: isRunning ? (caoDaemonProcess ? 'embedded' : 'external') : 'offline',
    };
  });
  ipcMain.handle('cao-restart-daemon', async () => {
    stopCaoDaemon();
    // Re-probe after an operator installs CAO or changes the WSL distro while
    // the desktop process is still open.
    caoRuntime = undefined;
    return await startCaoDaemon();
  });
  ipcMain.handle('agent-router-get', () => getPublicLocalRouterConfig());
  ipcMain.handle('agent-router-save', (_event, config: { enabled: boolean; apiKey?: string }) => saveLocalRouterConfig(config));
  ipcMain.handle('agent-router-clear', () => clearLocalRouterConfig());
  ipcMain.handle('agent-router-check', (_event, { includeModels = false }: { includeModels?: boolean }) => checkLocalRouter(includeModels));
  ipcMain.handle('agent-router-open-dashboard', async () => shell.openExternal('http://127.0.0.1:20128/dashboard'));
  ipcMain.handle('agent-codex-diagnostics', async () => codexDiagnostics());
  ipcMain.handle('agent-runtime-status', async () => agentRuntimeStatus());
  ipcMain.handle('agent-bootstrap-runtimes', async () => bootstrapAgentRuntimes());
  ipcMain.handle('agent-preflight', async (_event, { provider, cwd }: { provider: AgentProvider; cwd: string }) => preflightAgent(provider, cwd));
  ipcMain.handle('agent-quick-setup', (_event, { cwd, installDependencies }: { cwd: string; installDependencies?: boolean }) => quickSetupEnvironment(cwd, installDependencies !== false));
  ipcMain.handle('agent-repair-environment', async (_event, { provider, cwd }: { provider: AgentProvider; cwd: string }) => repairEnvironment(provider, cwd));
  ipcMain.handle('agent-create-worktree', (_event, { repository, issueKey }: { repository: string; issueKey: string }) => createAgentWorktree(repository, issueKey));
  ipcMain.handle('agent-reconnect-cao-session', (_event, sessionId: string) => reconnectCaoSession(sessionId));
  ipcMain.handle('agent-open-workspace', async (_event, cwd: string) => shell.openPath(cwd));
  ipcMain.handle('agent-cleanup-worktree', (_event, { repository, worktree }: { repository: string; worktree: string }) => {
    try {
      const root = git(repository, ['rev-parse', '--show-toplevel']);
      const allowedRoot = path.join(path.dirname(root), '.task-companion-worktrees') + path.sep;
      if (!path.resolve(worktree).startsWith(path.resolve(allowedRoot))) throw new Error('Can only clean worktrees created by Task Hub Studio.');
      try {
        git(root, ['worktree', 'remove', '--force', worktree]);
      } catch {
        if (fs.existsSync(worktree)) {
          try {
            if (process.platform === 'win32') {
              try { fs.chmodSync(path.join(worktree, '.git'), 0o666); } catch { /* ignore */ }
            }
            fs.rmSync(worktree, { recursive: true, force: true });
          } catch { /* ignore */ }
        }
      }
      try { git(root, ['worktree', 'prune']); } catch { /* ignore */ }
      return true;
    } catch (e: any) {
      console.warn('[Worktree Cleanup] Warning:', e);
      return false;
    }
  });
  ipcMain.handle('agent-run-test', async (_event, { cwd, command = 'npm test' }: { cwd: string; command?: string }) => {
    const startTime = Date.now();
    try {
      const isWin = process.platform === 'win32';
      const shellCmd = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command];
      const result = execFileSync(shellCmd, shellArgs, {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      });
      return {
        success: true,
        exitCode: 0,
        stdout: result,
        stderr: '',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        exitCode: error.status ?? 1,
        stdout: error.stdout ? String(error.stdout) : '',
        stderr: error.stderr ? String(error.stderr) : error.message,
        durationMs: Date.now() - startTime,
      };
    }
  });

  ipcMain.handle('workspace-read-file', async (_event, { cwd, relativePath }: { cwd: string; relativePath: string }) => {
    if (!cwd || !relativePath) throw new Error('Cwd and relativePath required.');
    const fullPath = path.resolve(cwd, relativePath);
    if (!fullPath.startsWith(path.resolve(cwd))) throw new Error('Access denied: outside workspace.');
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) return '';
    return fs.readFileSync(fullPath, 'utf8');
  });

  ipcMain.handle('workspace-list-files', async (_event, { cwd, maxFiles = 300 }: { cwd: string; maxFiles?: number }) => {
    if (!cwd || !fs.existsSync(cwd)) return [];
    const results: Array<{ path: string; isDir: boolean; name: string }> = [];
    function scan(dir: string, rel = '') {
      if (results.length >= maxFiles) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-electron') continue;
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          results.push({ path: relPath, isDir: entry.isDirectory(), name: entry.name });
          if (entry.isDirectory() && results.length < maxFiles) {
            scan(path.join(dir, entry.name), relPath);
          }
        }
      } catch { /* ignore */ }
    }
    scan(cwd);
    return results;
  });

  ipcMain.handle('workspace-get-git-diff', async (_event, { cwd }: { cwd: string }) => {
    if (!cwd || !fs.existsSync(cwd)) {
      return { dirtyFiles: [], diffs: [], totalAdditions: 0, totalDeletions: 0, totalChangedFiles: 0 };
    }
    try {
      const statusRaw = git(cwd, ['status', '--porcelain']);
      const lines = statusRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const dirtyFiles = lines.map((l) => ({
        status: l.slice(0, 2).trim(),
        file: l.slice(3).trim(),
      }));

      // Parse numstat to get line additions & deletions
      const numstatMap = new Map<string, { additions: number; deletions: number }>();
      try {
        const numstatRaw = git(cwd, ['diff', 'HEAD', '--numstat']);
        const numstatLines = numstatRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
        for (const nl of numstatLines) {
          const parts = nl.split(/\t+/);
          if (parts.length >= 3) {
            const add = parseInt(parts[0], 10) || 0;
            const del = parseInt(parts[1], 10) || 0;
            const filePath = parts[2].trim();
            numstatMap.set(filePath, { additions: add, deletions: del });
          }
        }
      } catch { /* ignore */ }

      let totalAdditions = 0;
      let totalDeletions = 0;

      const diffs = dirtyFiles.map((item) => {
        let original = '';
        let modified = '';
        const fullPath = path.join(cwd, item.file);
        if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
          try { modified = fs.readFileSync(fullPath, 'utf8'); } catch { /* ignore */ }
        }
        try { original = git(cwd, ['show', `HEAD:${item.file}`]); } catch { original = ''; }
        let patch = '';
        try { patch = git(cwd, ['diff', 'HEAD', '--', item.file]); } catch { /* ignore */ }

        let additions = 0;
        let deletions = 0;
        if (numstatMap.has(item.file)) {
          const stat = numstatMap.get(item.file)!;
          additions = stat.additions;
          deletions = stat.deletions;
        } else if (item.status.includes('?') || item.status.includes('A')) {
          additions = modified.split(/\r?\n/).length;
          deletions = 0;
        }

        totalAdditions += additions;
        totalDeletions += deletions;

        return {
          file: item.file,
          status: item.status,
          original,
          modified,
          patch,
          additions,
          deletions,
        };
      });

      return {
        dirtyFiles,
        diffs,
        totalAdditions,
        totalDeletions,
        totalChangedFiles: diffs.length,
      };
    } catch {
      return { dirtyFiles: [], diffs: [], totalAdditions: 0, totalDeletions: 0, totalChangedFiles: 0 };
    }
  });

  ipcMain.handle('workspace-revert-file', async (_event, { cwd, relativePath }: { cwd: string; relativePath: string }) => {
    if (!cwd || !relativePath || !fs.existsSync(cwd)) return { success: false, message: 'Invalid workspace or path' };
    try {
      const fullPath = path.join(cwd, relativePath);
      // Check if file is tracked or untracked
      const statusRaw = git(cwd, ['status', '--porcelain', '--', relativePath]);
      if (statusRaw.startsWith('??')) {
        // Untracked file -> delete it
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } else {
        // Tracked file -> checkout HEAD
        git(cwd, ['checkout', 'HEAD', '--', relativePath]);
      }
      return { success: true, file: relativePath };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to revert file' };
    }
  });

  ipcMain.handle('workspace-stage-file', async (_event, { cwd, relativePath }: { cwd: string; relativePath: string }) => {
    if (!cwd || !relativePath || !fs.existsSync(cwd)) return { success: false, message: 'Invalid workspace or path' };
    try {
      git(cwd, ['add', '--', relativePath]);
      return { success: true, file: relativePath };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to stage file' };
    }
  });

  // --- ANTIGRAVITY 2.0 PERMISSIONS & SECURITY POLICIES ---
  ipcMain.handle('agent-get-permissions', () => loadPermissions());
  ipcMain.handle('agent-save-permissions', (_event, perms: any) => savePermissions(perms));

  // --- ANTIGRAVITY 2.0 SKILLS & CUSTOMIZATIONS ---
  ipcMain.handle('agent-list-skills', (_event, { workspacePath }: { workspacePath?: string }) => {
    return discoverSkills(workspacePath);
  });

  ipcMain.handle('agent-read-skill', (_event, { skillPath }: { skillPath: string }) => {
    if (!skillPath || !fs.existsSync(skillPath)) throw new Error('Skill file not found');
    return fs.readFileSync(skillPath, 'utf8');
  });

  ipcMain.handle('agent-list-mcp-servers', () => {
    const homeDir = os.homedir();
    const mcpBase = path.join(homeDir, '.gemini', 'antigravity', 'mcp');
    const servers: Array<{ name: string; tools: string[]; isConfigured: boolean }> = [];
    if (fs.existsSync(mcpBase)) {
      try {
        const dirs = fs.readdirSync(mcpBase, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory()) {
            const serverDir = path.join(mcpBase, d.name);
            const toolFiles = fs.readdirSync(serverDir).filter(f => f.endsWith('.json'));
            servers.push({
              name: d.name,
              tools: toolFiles.map(f => f.replace(/\.json$/, '')),
              isConfigured: true,
            });
          }
        }
      } catch { /* ignore */ }
    }
    // Add default MCP server StitchMCP
    if (!servers.some(s => s.name === 'StitchMCP')) {
      servers.push({
        name: 'StitchMCP',
        tools: ['create_project', 'get_project', 'list_projects', 'list_screens', 'get_screen', 'generate_screen_from_text', 'edit_screens', 'generate_variants', 'upload_design_md', 'create_design_system'],
        isConfigured: true,
      });
    }
    return servers;
  });

  ipcMain.handle('agent-list-rules', (_event, { workspacePath }: { workspacePath?: string }) => {
    const rules: Array<{ name: string; description: string; path: string; source: string }> = [];
    const searchPaths = [
      { dir: path.join(os.homedir(), '.gemini', 'rules'), source: 'global' },
    ];
    if (workspacePath) {
      searchPaths.push({ dir: path.join(workspacePath, '.gemini', 'rules'), source: 'workspace' });
    }
    for (const sp of searchPaths) {
      if (fs.existsSync(sp.dir)) {
        try {
          const files = fs.readdirSync(sp.dir).filter(f => f.endsWith('.md') || f.endsWith('.rule'));
          for (const f of files) {
            rules.push({
              name: f.replace(/\.(md|rule)$/, ''),
              description: `Rule from ${sp.source}`,
              path: path.join(sp.dir, f),
              source: sp.source,
            });
          }
        } catch { /* ignore */ }
      }
    }
    return rules;
  });

  // --- ANTIGRAVITY 2.0 SCHEDULED TASKS & BACKGROUND TIMERS ---
  const activeSchedules: any[] = [];

  ipcMain.handle('agent-list-scheduled-tasks', () => {
    return activeSchedules;
  });

  ipcMain.handle('agent-create-schedule', (_event, task: any) => {
    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: task.cronExpression ? 'cron' : 'timer',
      prompt: task.prompt || 'Execute scheduled agent action',
      durationSeconds: task.durationSeconds,
      cronExpression: task.cronExpression,
      maxIterations: task.maxIterations,
      condition: task.timerCondition || 'never',
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    activeSchedules.push(newTask);
    return newTask;
  });

  ipcMain.handle('agent-cancel-schedule', (_event, { id }: { id: string }) => {
    const idx = activeSchedules.findIndex(t => t.id === id);
    if (idx !== -1) {
      activeSchedules[idx].status = 'cancelled';
      activeSchedules.splice(idx, 1);
      return { success: true };
    }
    return { success: false, message: 'Schedule not found' };
  });

  ipcMain.handle('updater-install', () => installDownloadedUpdate());
  ipcMain.handle('updater-dismiss', () => {
    setUpdateState({ status: 'idle', message: undefined });
    return updateState;
  });

  ipcMain.handle('taskhub-credential-get', () => loadDesktopCredential());
  ipcMain.handle('taskhub-credential-save', (_event, credential: DesktopCredential) => saveDesktopCredential(credential));
  ipcMain.handle('taskhub-credential-clear', () => clearDesktopCredential());

  ipcMain.handle('taskhub-pairing-start', async (_event, { taskHubUrl, projectId }: { taskHubUrl: string; projectId?: number | null }) => {
    return taskHubRequest(taskHubUrl, '/api/v1/desktop/pairing/start', { method: 'POST', body: JSON.stringify({ project_id: projectId }) });
  });

  ipcMain.handle('taskhub-pairing-status', async (_event, { taskHubUrl, pairingId, deviceSecret }: { taskHubUrl: string; pairingId: string; deviceSecret: string }) => {
    return taskHubRequest(taskHubUrl, `/api/v1/desktop/pairing/${encodeURIComponent(pairingId)}/status`, { headers: { 'X-Desktop-Pairing-Secret': deviceSecret } });
  });

  ipcMain.handle('taskhub-mcp-call', async (_event, { taskHubUrl, token, projectId, method, params }: { taskHubUrl: string; token: string; projectId: string; method: string; params?: Record<string, any> }) => {
    return taskHubMcpCall(taskHubUrl, token, projectId, method, params || {});
  });
  ipcMain.handle('taskhub-documents-import-generated', async (_event, { taskHubUrl, token, projectId, payload }: { taskHubUrl: string; token: string; projectId: string; payload: Record<string, any> }) => taskHubRequest(taskHubUrl, `/api/v1/desktop/projects/${encodeURIComponent(projectId)}/documents/import-generated`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Task-Hub-Project': projectId }, body: JSON.stringify(payload) }));
  ipcMain.handle('taskhub-capabilities', async (_event, taskHubUrl: string) => taskHubRequest(taskHubUrl, '/api/v1/capabilities'));

  ipcMain.handle('agent-configure-mcp', (_event, { cwd, provider, taskHubUrl, projectId, token }: { cwd: string; provider: string; taskHubUrl: string; projectId: string | number; token: string }) => {
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Invalid workspace directory.');
    if (projectId === undefined || projectId === null || String(projectId).trim() === '') throw new Error('Project ID is required.');

    const useAntigravityFormat = provider === 'antigravity' || provider === 'agy';
    const configDirectory = useAntigravityFormat ? path.join(cwd, '.agents') : cwd;
    const configPath = useAntigravityFormat ? path.join(configDirectory, 'mcp_config.json') : path.join(cwd, '.mcp.json');
    let config: Record<string, any> = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { throw new Error('Failed to parse existing MCP configuration.'); }
      fs.copyFileSync(configPath, `${configPath}.bak.${Date.now()}`);
    }
    config.mcpServers = config.mcpServers || {};
    // Current Codex builds reject the Task Hub remote MCP server's lifecycle
    // notification shape (rmcp deserialize error). Task context is already
    // staged in the local prompt file, so keep Codex stable until the server
    // endpoint is upgraded to that protocol revision.
    if (provider === 'codex') {
      delete config.mcpServers['task-hub'];
      fs.mkdirSync(configDirectory, { recursive: true });
      fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
      return { path: configPath, server: 'task-hub', disabled: true, reason: 'Codex receives the Task Hub context pack directly for this run.' };
    }
    config.mcpServers['task-hub'] = {
      ...(useAntigravityFormat ? { serverUrl: `${taskHubUrl.replace(/\/$/, '')}/mcp` } : { type: 'http', url: `${taskHubUrl.replace(/\/$/, '')}/mcp` }),
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Task-Hub-Project': String(projectId),
      },
    };
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    // In a Git worktree, .git is a file that points to the real git directory.
    // Resolve the path through Git instead of assuming .git/info is a directory.
    try {
      const gitExcludeOutput = git(cwd, ['rev-parse', '--git-path', 'info/exclude']);
      const gitExclude = path.isAbsolute(gitExcludeOutput) ? gitExcludeOutput : path.resolve(cwd, gitExcludeOutput);
      fs.mkdirSync(path.dirname(gitExclude), { recursive: true });
      const existing = fs.existsSync(gitExclude) ? fs.readFileSync(gitExclude, 'utf8') : '';
      const relative = path.relative(cwd, configPath).replace(/\\/g, '/');
      if (!existing.split(/\r?\n/).includes(relative)) fs.appendFileSync(gitExclude, `${existing && !existing.endsWith('\n') ? '\n' : ''}${relative}\n`, 'utf8');
    } catch {
      // MCP config is still valid; exclusion is only a best-effort convenience for non-Git folders.
    }
    return { path: configPath, server: 'task-hub' };
  });

  ipcMain.handle('agent-list-sessions', () => Array.from(agentProcesses.entries()).map(([sessionId, session]) => ({ sessionId, provider: session.provider, model: session.model, cwd: session.cwd, mode: session.mode, kind: session.kind, executionPolicy: session.executionPolicy || 'restricted', output: session.output.slice(-250000), threadId: session.threadId, events: session.events || [] })));
  ipcMain.handle('agent-save-session-state', (_event, state: Partial<PersistedSessionData> & { sessionId: string }) => {
    persistSessionUpdate(state);
    return true;
  });
  ipcMain.handle('agent-list-saved-sessions', () => readAllSavedSessions());
  ipcMain.handle('agent-get-session-state', (_event, sessionId: string) => readAllSavedSessions().find((s) => s.sessionId === sessionId) || null);
  ipcMain.handle('agent-delete-session', (_event, sessionId: string) => {
    deleteSavedSession(sessionId);
    return true;
  });
  ipcMain.handle('agent-log-activity', (_event, payload: { cwd?: string; sessionId?: string | null; activity?: { label?: string; detail?: string; tone?: string } }) => {
    if (!payload?.cwd) return false;
    appendWorkspaceAgentLog(payload.cwd, payload.sessionId || 'workspace', 'ui_activity', payload.activity || {});
    return true;
  });

  ipcMain.handle('agent-open-session-log', async (_event, sessionId: string) => {
    let session = agentProcesses.get(sessionId);
    let output = session?.output;
    let provider = session?.provider;
    let model = session?.model;
    let mode = session?.mode;
    let kind = session?.kind;
    let cwd = session?.cwd;

    if (!session) {
      const saved = readAllSavedSessions().find((s) => s.sessionId === sessionId);
      if (saved) {
        output = saved.output;
        provider = saved.provider;
        model = saved.model;
        mode = saved.mode;
        kind = saved.kind;
        cwd = saved.worktree || saved.cwd;
      }
    }

    if (!output && output !== '') throw new Error('Agent session does not exist or has been removed.');
    const workspaceLog = cwd ? path.join(cwd, '.macatung', 'agent', `${sessionId}.jsonl`) : '';
    if (workspaceLog && fs.existsSync(workspaceLog)) {
      await shell.openPath(workspaceLog);
      return workspaceLog;
    }
    const logDirectory = path.join(app.getPath('logs'), 'task-companion');
    fs.mkdirSync(logDirectory, { recursive: true });
    const logPath = path.join(logDirectory, `agent-${sessionId.replace(/[^a-z0-9_-]/gi, '-')}.log`);
    fs.writeFileSync(logPath, `Provider: ${provider}\nModel: ${model || 'default'}\nMode: ${mode}\nKind: ${kind}\nWorkspace: ${cwd}\n\n${cleanAgentLog(output)}`, 'utf8');
    await shell.openPath(logPath);
    return logPath;
  });

function formatAgyEvent(event: any): string {
  if (!event) return '';
  if (event.event === 'step_update') {
    const su = event.step_update;
    if (su.step_type === 'tool') {
      const toolName = su.tool_name || su.tool_info?.name || 'tool';
      const params = su.tool_info?.parameters || {};
      const target = params.AbsolutePath || params.TargetFile || params.CommandLine || params.Query || (Object.keys(params).length ? JSON.stringify(params) : '');
      if (su.state === 'ACTIVE') {
        return `\n⚙️ [${toolName}] ${target}\n`;
      }
      if (su.state === 'DONE') {
        const dur = su.duration_seconds ? ` (${su.duration_seconds.toFixed(2)}s)` : '';
        const out = su.tool_info?.output ? ` → ${su.tool_info.output}` : '';
        return `✓ [${toolName} done]${dur}${out}\n`;
      }
    } else if (su.step_type === 'thought' || su.step_type === 'reasoning') {
      const thought = su.thought_delta || su.reasoning_content || su.thought || su.text_delta || '';
      return thought;
    } else if (su.step_type === 'agent_response' && su.text_delta) {
      return su.text_delta;
    }
  } else if (event.event === 'thought') {
    const thought = event.thought_delta || event.delta || event.reasoning_content || event.thought || '';
    return thought;
  } else if (event.event === 'result') {
    const res = event.result;
    const resp = res?.response ? `\n💬 ${res.response}\n` : '';
    const tokens = res?.usage?.total_tokens ? `✓ Completed · Total tokens: ${res.usage.total_tokens.toLocaleString()}\n` : '';
    return `${resp}${tokens}`;
  }
  return '';
}

  const startInteractiveAgent = async (_event: Electron.IpcMainInvokeEvent, { provider, cwd, prompt, kind = 'task', model, executionPolicy = 'workspace_write' }: { provider: AgentProvider; cwd: string; prompt?: string; kind?: 'task' | 'docs'; model?: string; executionPolicy?: AgentExecutionPolicy }) => {
    const policy: AgentExecutionPolicy = executionPolicy === 'full_access' ? 'full_access' : executionPolicy === 'restricted' ? 'restricted' : 'workspace_write';
    const requestedModel = model && model !== 'default' ? String(model).trim() : undefined;
    const selectedModel = provider === 'antigravity'
      ? resolveAntigravityModelId(requestedModel)
      : requestedModel;

    // CAO is the mandatory execution and communication layer for all agent runs.
    // CAO-only execution is enforced across the desktop workspace with policy: 'cao_required'.
    const caoSession = await tryStartCaoAgent({ provider, cwd, prompt, kind, model: selectedModel, executionPolicy: policy });
    if (caoSession) return caoSession;

    const caoOnlyError = 'CAO-only execution is enabled; no native fallback is permitted.';
    throw new Error('CAO is required for all agent runs: ' + caoOnlyError);
  };

  // Legacy native agent fallback handlers (retained for diagnostic reference & test assertions)
  function _legacyLaunchNativeAgent(provider: AgentProvider, cwd: string, prompt?: string, selectedModel?: string, policy: AgentExecutionPolicy = 'workspace_write', kind: 'task' | 'docs' = 'task') {
    const agentEnvironment = environmentForAgent(provider);
    if (provider === 'antigravity') {
      const agy = resolveCli('agy');
      if (agy) {
        const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const initialPrompt = stageAgentPrompt(cwd, sessionId, prompt);
        const spawnArgs = ['--output-format', 'stream-json', ...executionPolicyArgs(provider, policy)];
        if (selectedModel) {
          spawnArgs.push('--model', selectedModel);
        }
        spawnArgs.push('--print', initialPrompt);

        const child = spawn(agy, spawnArgs, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...agentEnvironment.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
        });

        const session: AgentSession = {
          process: child as any,
          provider,
          model: selectedModel,
          cwd,
          mode: 'exec',
          kind,
          output: '',
          events: [],
          route: agentEnvironment.route,
          executionPolicy: policy
        };
        agentProcesses.set(sessionId, session);
        persistSessionUpdate({
          sessionId,
          provider,
          model: selectedModel,
          cwd,
          mode: 'exec',
          kind,
          status: 'running',
          startedAt: new Date().toISOString(),
          output: '',
          events: [], route: agentEnvironment.route, executionPolicy: policy
        });
        appendWorkspaceAgentLog(cwd, sessionId, 'session_started', { provider, model: selectedModel, kind, mode: 'exec', execution_policy: policy, route: agentEnvironment.route });

        let buffer = '';
        const processAgyOutputLine = (line: string) => {
          if (!line.trim()) return;
          try {
            const event = JSON.parse(line);
            session.events = (session.events || []).concat(event);
            appendWorkspaceAgentLog(session.cwd, sessionId, 'event', event);
            if (event.event === 'init' && event.conversation_id) {
              session.threadId = event.conversation_id;
              persistSessionUpdate({ sessionId, threadId: event.conversation_id });
            }
            if (event.event === 'result' && event.result?.usage?.total_tokens) {
              const total = Number(event.result.usage.total_tokens);
              if (total > 0) recordTokenUsageToQuota('antigravity', total);
            } else if (event.usage?.total_tokens) {
              const total = Number(event.usage.total_tokens);
              if (total > 0) recordTokenUsageToQuota('antigravity', total);
            }
            const formattedLine = formatAgyEvent(event);
            if (formattedLine) session.output = `${session.output}${formattedLine}`.slice(-250000);
            safeSend(win, 'agent-output', { sessionId, stream: 'event', event, text: formattedLine || '' });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            appendWorkspaceAgentLog(session.cwd, sessionId, 'stdout', line);
            extractAndRecordTokensFromText('antigravity', line);
            safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text: line });
          }
        };
        child.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) processAgyOutputLine(line);
        });

        child.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          session.output = `${session.output}\n${text}`.slice(-250000);
          appendWorkspaceAgentLog(session.cwd, sessionId, 'stderr', text);
          safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        });

        child.once('error', (error: any) => {
          const text = `Unable to launch Antigravity CLI: ${error.message}`;
          session.output = `${session.output}\n${text}`.slice(-250000);
          appendWorkspaceAgentLog(session.cwd, sessionId, 'stderr', text);
          safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
          persistSessionUpdate({ sessionId, status: 'failed', exitCode: 1, output: session.output, events: session.events });
          agentProcesses.delete(sessionId);
          safeSend(win, 'agent-exit', { sessionId, code: 1, signal: 'SPAWN_ERROR' });
        });

        child.on('close', (code: any, signal: any) => {
          processAgyOutputLine(buffer);
          buffer = '';
          appendWorkspaceAgentLog(session.cwd, sessionId, 'session_finished', { code, signal: String(signal || ''), eventCount: session.events?.length || 0 });
          persistSessionUpdate({
            sessionId,
            status: code === 0 ? 'completed' : 'failed',
            exitCode: code,
            output: session.output,
            events: session.events
          });
          agentProcesses.delete(sessionId);
          safeSend(win, 'agent-exit', { sessionId, code, signal: String(signal || '') });
        });

        return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
      }
      const executable = findAntigravityExecutable() || '';
      if (!executable) throw new Error('Antigravity executable or agy CLI not found.');
      const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const child = spawn(executable, [cwd], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      if (prompt?.trim()) {
        const modelHeader = selectedModel ? `[Model: ${selectedModel}]\n\n` : '';
        clipboard.writeText(`${modelHeader}${stageAgentPrompt(cwd, sessionId, prompt)}`);
      }
      agentProcesses.set(sessionId, { provider, model: selectedModel, cwd, mode: 'external', kind, output: '', route: agentEnvironment.route, executionPolicy: policy });
      persistSessionUpdate({
        sessionId,
        provider,
        model: selectedModel,
        cwd,
        mode: 'external',
        kind,
        status: 'running',
        startedAt: new Date().toISOString(),
        output: '', route: agentEnvironment.route, executionPolicy: policy
      });
      appendWorkspaceAgentLog(cwd, sessionId, 'session_started', { provider, model: selectedModel, kind, mode: 'external', execution_policy: policy, route: agentEnvironment.route });
      return { mode: 'external', sessionId, provider, model: selectedModel, cwd, executable, promptCopied: Boolean(prompt?.trim()), capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    if (provider === 'codex') {
      const sessionId = `codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const command = resolveCli('codex') || 'codex';
      const initialPrompt = stageAgentPrompt(cwd, sessionId, prompt);
      const spawnArgs = [...codexApprovalArgs(policy), 'exec', '--json', ...executionPolicyArgs(provider, policy)];
      if (selectedModel) {
        spawnArgs.push('-m', selectedModel);
      }
      spawnArgs.push(initialPrompt);

      const child = spawn(command, spawnArgs, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...agentEnvironment.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });

      const session: AgentSession = {
        process: child as any,
        provider,
        model: selectedModel,
        cwd,
        mode: 'exec',
        kind,
        output: '',
        events: [],
        route: agentEnvironment.route,
        executionPolicy: policy
      };
      agentProcesses.set(sessionId, session);
      persistSessionUpdate({
        sessionId,
        provider,
        model: selectedModel,
        cwd,
        mode: 'exec',
        kind,
        status: 'running',
        startedAt: new Date().toISOString(),
        output: '',
        events: [], route: agentEnvironment.route, executionPolicy: policy
      });
      appendWorkspaceAgentLog(cwd, sessionId, 'session_started', { provider, model: selectedModel, kind, mode: 'exec', execution_policy: policy, route: agentEnvironment.route });

      let buffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const framed = takeJsonObjects(buffer);
        buffer = framed.remainder;

        for (const line of framed.objects) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            session.events = (session.events || []).concat(event);
            appendWorkspaceAgentLog(session.cwd, sessionId, 'event', event);
            if (event.type === 'thread.started' && event.thread_id) {
              session.threadId = event.thread_id;
              persistSessionUpdate({ sessionId, threadId: event.thread_id });
            }
            let formattedLine = '';
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
              formattedLine = `\n💬 ${event.item.text}\n`;
            } else if ((event.type === 'item.delta' || event.type === 'text_delta') && (event.delta?.text || event.text_delta || event.item?.delta?.text)) {
              formattedLine = event.delta?.text || event.text_delta || event.item?.delta?.text || '';
            } else if (event.type === 'item.started' && event.item?.type === 'command_execution') {
              formattedLine = `\n⚡ [Executing command] $ ${event.item.command}\n`;
            } else if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
              const output = summarizeCommandOutput(event.item.command || '', event.item.aggregated_output || '');
              formattedLine = `\n✓ [Command completed] exit code: ${event.item.exit_code ?? 0}${output ? `\n${output}` : ''}\n`;
            } else if (event.type === 'item.completed' && (event.item?.type === 'thought' || event.item?.type === 'reasoning')) {
              formattedLine = event.item?.text ? `\n💭 ${event.item.text}\n` : '';
            } else if (event.type === 'turn.completed') {
              const turnTokens = (event.usage?.input_tokens || 0) + (event.usage?.output_tokens || 0);
              if (turnTokens > 0) recordTokenUsageToQuota('codex', turnTokens);
              formattedLine = `\n✓ Turn completed · Tokens: in ${event.usage?.input_tokens || 0}, out ${event.usage?.output_tokens || 0}\n`;
            } else if (event.type === 'error' || event.error) {
              formattedLine = `\n❌ Error: ${event.error?.message || event.message || JSON.stringify(event.error || event)}\n`;
            } else if (event.text || event.message) {
              formattedLine = event.text || event.message || '';
            }
            if (formattedLine) {
              session.output = `${session.output}${formattedLine}`.slice(-250000);
            }
            if (formattedLine) safeSend(win, 'agent-output', { sessionId, stream: 'event', event, text: formattedLine });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            appendWorkspaceAgentLog(session.cwd, sessionId, 'stdout', line);
            extractAndRecordTokensFromText('codex', line);
            safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (!text.includes('Reading additional input from stdin')) {
          session.output = `${session.output}\n${text}`.slice(-250000);
          appendWorkspaceAgentLog(session.cwd, sessionId, 'stderr', text);
          extractAndRecordTokensFromText('codex', text);
          safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        }
      });

      child.once('error', (error: any) => {
        const text = `Unable to launch Codex CLI: ${error.message}`;
        session.output = `${session.output}\n${text}`.slice(-250000);
        appendWorkspaceAgentLog(session.cwd, sessionId, 'stderr', text);
        safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        persistSessionUpdate({ sessionId, status: 'failed', exitCode: 1, output: session.output, events: session.events });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code: 1, signal: 'SPAWN_ERROR' });
      });

      child.on('close', (code: any, signal: any) => {
        appendWorkspaceAgentLog(session.cwd, sessionId, 'session_finished', { code, signal: String(signal || ''), eventCount: session.events?.length || 0 });
        persistSessionUpdate({
          sessionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output: session.output,
          events: session.events
        });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code, signal: String(signal || '') });
      });

      return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    const definition = AGENT_COMMANDS[provider];
    if (!definition) throw new Error('Unsupported agent provider.');
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Invalid workspace directory.');

    const sessionId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const command = resolveCli(definition.command) || definition.command;
    const spawnArgs = [...definition.args, ...executionPolicyArgs(provider, policy)];
    if (selectedModel && selectedModel !== 'default') {
      spawnArgs.push('--model', selectedModel);
    }
    if (prompt?.trim()) spawnArgs.push(stageAgentPrompt(cwd, sessionId, prompt));

    const pty = spawnPty(command, spawnArgs, {
      cwd,
      name: 'xterm-256color',
      cols: 120,
      rows: 35,
      env: { ...agentEnvironment.env, FORCE_COLOR: '1', COLORTERM: 'truecolor', TERM: 'xterm-256color' } as Record<string, string>
    });
    agentProcesses.set(sessionId, { process: pty, provider, model: selectedModel, cwd, mode: 'interactive', kind, output: '', route: agentEnvironment.route, executionPolicy: policy });
    persistSessionUpdate({
      sessionId,
      provider,
      model: selectedModel,
      cwd,
      mode: 'interactive',
      kind,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: '', route: agentEnvironment.route, executionPolicy: policy
    });
    appendWorkspaceAgentLog(cwd, sessionId, 'session_started', { provider, model: selectedModel, kind, mode: 'interactive', execution_policy: policy, route: agentEnvironment.route });
    pty.onData((text) => {
      const session = agentProcesses.get(sessionId);
      if (session) {
        session.output = `${session.output}${text}`.slice(-250000);
        appendWorkspaceAgentLog(session.cwd, sessionId, 'stdout', text);
      }
      extractAndRecordTokensFromText(provider, text);
      safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text });
    });
    pty.onExit(({ exitCode, signal }) => {
      const session = agentProcesses.get(sessionId);
      if (session) appendWorkspaceAgentLog(session.cwd, sessionId, 'session_finished', { code: exitCode, signal: String(signal) });
      persistSessionUpdate({
        sessionId,
        status: exitCode === 0 ? 'completed' : 'failed',
        exitCode,
      });
      agentProcesses.delete(sessionId);
      safeSend(win, 'agent-exit', { sessionId, code: exitCode, signal: String(signal) });
    });
    return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
  }
  ipcMain.handle('agent-start', startInteractiveAgent);
  ipcMain.handle('agent-start-interactive', startInteractiveAgent);

  ipcMain.handle('agent-list-available-models', async (_event, payload?: { provider?: AgentProvider; options?: { forceRefresh?: boolean; taskHubUrl?: string } }) => {
    return getAvailableModels(payload?.provider, payload?.options);
  });

  ipcMain.handle('agent-save-custom-model', async (_event, payload: { provider: AgentProvider; model: DiscoveredModel }) => {
    if (!payload?.provider || !payload?.model?.id) return false;
    const custom = readCustomModels();
    const list = custom[payload.provider] || [];
    const index = list.findIndex((m) => m.id === payload.model.id);
    const modelToSave: DiscoveredModel = {
      id: payload.model.id,
      name: payload.model.name || payload.model.id,
      badges: payload.model.badges?.length ? payload.model.badges : inferModelBadges(payload.model.id, payload.model.name),
      description: payload.model.description || `Custom user-saved model: ${payload.model.id}`,
      source: 'custom',
    };
    if (index >= 0) {
      list[index] = modelToSave;
    } else {
      list.push(modelToSave);
    }
    custom[payload.provider] = list;
    writeCustomModels(custom);
    return getAvailableModels(payload.provider);
  });

  ipcMain.handle('agent-delete-custom-model', async (_event, payload: { provider: AgentProvider; modelId: string }) => {
    if (!payload?.provider || !payload?.modelId) return false;
    const custom = readCustomModels();
    if (custom[payload.provider]) {
      custom[payload.provider] = custom[payload.provider].filter((m) => m.id !== payload.modelId);
      writeCustomModels(custom);
    }
    return getAvailableModels(payload.provider);
  });

  ipcMain.handle('agent-get-quota-usage', () => {
    return readQuotaState();
  });

  ipcMain.handle('agent-sync-quota-usage', async (_event, payload?: { taskHubUrl?: string }) => {
    const quota = readQuotaState();
    await syncQuotaToTaskHub(quota, payload?.taskHubUrl);
    return quota;
  });

  ipcMain.handle('agent-update-quota-settings', (_event, payload: { enableCreditOverages?: boolean; plan?: string }) => {
    const quota = readQuotaState();
    if (typeof payload?.enableCreditOverages === 'boolean') {
      quota.enableCreditOverages = payload.enableCreditOverages;
    }
    if (payload?.plan) {
      quota.plan = payload.plan;
    }
    quota.lastSyncedAt = new Date().toISOString();
    writeQuotaState(quota);
    return quota;
  });

  ipcMain.on('agent-input', async (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    let session = agentProcesses.get(sessionId);
    if (!session) {
      const saved = readAllSavedSessions().find((s) => s.sessionId === sessionId);
      if (saved) {
        session = {
          provider: saved.provider,
          model: saved.model,
          cwd: saved.worktree || saved.cwd,
          mode: 'exec',
          kind: saved.kind,
          output: saved.output || '',
          threadId: saved.threadId,
          events: saved.events || [],
          executionPolicy: saved.executionPolicy || 'restricted',
          route: saved.route,
          caoSessionName: saved.caoSessionName,
          caoLastOutput: saved.caoLastOutput
        };
        agentProcesses.set(sessionId, session);
      }
    }
    if (!session || !input?.trim()) return;

    if (session.route === 'cao' && session.caoSessionName) {
      const sent = await runCaoCommand(['session', 'send', session.caoSessionName, input.trim(), '--async'], session.cwd, 15_000);
      if (!sent.ok) {
        const text = `CAO could not deliver the message: ${sent.error || 'unknown error'}`;
        session.output = `${session.output}\n${text}`.slice(-250000);
        appendWorkspaceAgentLog(session.cwd, sessionId, 'cao_message_failed', text);
        safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        return;
      }
      const text = `\n> User → CAO supervisor: ${input.trim()}\n`;
      session.output = `${session.output}${text}`.slice(-250000);
      appendWorkspaceAgentLog(session.cwd, sessionId, 'cao_message_sent', { session: session.caoSessionName, input: input.trim() });
      persistSessionUpdate({ sessionId, status: 'running', output: session.output, caoSessionName: session.caoSessionName });
      safeSend(win, 'agent-output', { sessionId, stream: 'user', text, event: { type: 'user_message', text: input.trim() } });
      pollCaoSession(sessionId);
      return;
    }

    if (session.provider === 'codex' && session.threadId) {
      const command = resolveCli('codex') || 'codex';
      const resumePolicy = session.executionPolicy || 'restricted';
      const resumeArgs = [...codexApprovalArgs(resumePolicy), 'exec', 'resume', session.threadId, '--json', ...executionPolicyArgs('codex', resumePolicy)];
      if (session.model && session.model !== 'default') {
        resumeArgs.push('-m', session.model);
      }
      resumeArgs.push(input.trim());
      const resumeEnvironment = environmentForAgent('codex');
      const resumeChild = spawn(command, resumeArgs, {
        cwd: session.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...resumeEnvironment.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });
      session.process = resumeChild as any;
      persistSessionUpdate({ sessionId, status: 'running', executionPolicy: session.executionPolicy || 'restricted' });

      safeSend(win, 'agent-output', {
        sessionId,
        stream: 'user',
        text: `\n> User: ${input.trim()}\n`,
        event: { type: 'user_message', text: input.trim() }
      });

      resumeChild.once('error', (error) => {
        const text = `Unable to resume Codex CLI: ${error.message}`;
        session.output = `${session.output}\n${text}`.slice(-250000);
        safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        persistSessionUpdate({ sessionId, status: 'failed', exitCode: 1, output: session.output, events: session.events });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code: 1, signal: 'SPAWN_ERROR' });
      });

      let buffer = '';
      resumeChild.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            session.events = (session.events || []).concat(event);
            let formattedLine = '';
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
              formattedLine = `\n💬 ${event.item.text}\n`;
            } else if (event.type === 'item.started' && event.item?.type === 'command_execution') {
              formattedLine = `\n⚡ [Executing command] $ ${event.item.command}\n`;
            } else if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
              formattedLine = `\n✓ [Command completed] exit code: ${event.item.exit_code ?? 0}\n${event.item.aggregated_output || ''}\n`;
            } else if (event.type === 'turn.completed') {
              formattedLine = `\n✓ Turn completed · Tokens: in ${event.usage?.input_tokens || 0}, out ${event.usage?.output_tokens || 0}\n`;
            }
            if (formattedLine) {
              session.output = `${session.output}${formattedLine}`.slice(-250000);
            }
            safeSend(win, 'agent-output', { sessionId, stream: 'event', event, text: formattedLine || line });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      resumeChild.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (!text.includes('Reading additional input from stdin')) {
          session.output = `${session.output}\n${text}`.slice(-250000);
          safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        }
      });

      resumeChild.on('close', (code, signal) => {
        persistSessionUpdate({
          sessionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output: session.output,
          events: session.events
        });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code, signal: String(signal || '') });
      });
      return;
    }

    if (session.provider === 'antigravity' && session.threadId) {
      const agy = resolveCli('agy') || 'agy';
      const resumeArgs = ['--output-format', 'stream-json', ...executionPolicyArgs('antigravity', session.executionPolicy || 'restricted'), '--conversation', session.threadId];
      if (session.model && session.model !== 'default') {
        resumeArgs.push('--model', session.model);
      }
      resumeArgs.push('--print', input.trim());
      const resumeChild = spawn(agy, resumeArgs, {
        cwd: session.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });
      session.process = resumeChild as any;
      persistSessionUpdate({ sessionId, status: 'running', executionPolicy: session.executionPolicy || 'restricted' });

      safeSend(win, 'agent-output', {
        sessionId,
        stream: 'user',
        text: `\n> User: ${input.trim()}\n`,
        event: { type: 'user_message', text: input.trim() }
      });

      let buffer = '';
      resumeChild.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            session.events = (session.events || []).concat(event);
            const formattedLine = formatAgyEvent(event);
            if (formattedLine) {
              session.output = `${session.output}${formattedLine}`.slice(-250000);
            }
            safeSend(win, 'agent-output', { sessionId, stream: 'event', event, text: formattedLine || '' });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            safeSend(win, 'agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      resumeChild.once('error', (error) => {
        const text = `Unable to resume Antigravity CLI: ${error.message}`;
        session.output = `${session.output}\n${text}`.slice(-250000);
        safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
        persistSessionUpdate({ sessionId, status: 'failed', exitCode: 1, output: session.output, events: session.events });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code: 1, signal: 'SPAWN_ERROR' });
      });

      resumeChild.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        session.output = `${session.output}\n${text}`.slice(-250000);
        safeSend(win, 'agent-output', { sessionId, stream: 'stderr', text });
      });

      resumeChild.on('close', (code, signal) => {
        persistSessionUpdate({
          sessionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output: session.output,
          events: session.events
        });
        agentProcesses.delete(sessionId);
        safeSend(win, 'agent-exit', { sessionId, code, signal: String(signal || '') });
      });
      return;
    }

    if (session.process && 'write' in session.process) {
      (session.process as IPty).write(input.endsWith('\r') || input.endsWith('\n') ? input : `${input}\r\n`);
    }
  });

  ipcMain.handle('agent-stop', (_event, sessionId: string) => {
    const session = agentProcesses.get(sessionId);
    if (!session) return false;
    if (session.route === 'cao' && session.caoSessionName) {
      stopCaoSessionPoller(sessionId);
      void runCaoCommand(['shutdown', '--session', session.caoSessionName], session.cwd, 15_000).then((result) => {
        appendWorkspaceAgentLog(session.cwd, sessionId, result.ok ? 'cao_session_stopped' : 'cao_session_stop_failed', result.ok ? { session: session.caoSessionName } : { error: result.error });
      });
      persistSessionUpdate({ sessionId, status: 'interrupted', output: session.output, caoSessionName: session.caoSessionName });
      agentProcesses.delete(sessionId);
      safeSend(win, 'agent-exit', { sessionId, code: 0, signal: 'CAO_SHUTDOWN' });
      return true;
    }
    if (session.process) {
      if ('kill' in session.process) session.process.kill();
    }
    agentProcesses.delete(sessionId);
    return true;
  });
}

function createTray() {
  tray = new Tray(getTrayImage());
  tray.setToolTip('Midnight Hub Control Center');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Control Center',
      click: () => {
        if (win) { win.show(); win.focus(); }
      },
    },
    {
      label: 'Midnight Hub Web View',
      click: () => {
        import('electron').then(({ shell }) => {
          shell.openExternal(process.env.TASK_HUB_URL || 'https://task-hub.macatung.dev/tasks');
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (win) { win.show(); win.focus(); }
        void checkForUpdates();
      },
    },
    {
      label: 'Restart to Update',
      click: () => {
        if (win) { win.show(); win.focus(); }
        installDownloadedUpdate();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (win) {
      if (win.isVisible()) win.hide();
      else {
        win.show();
        win.focus();
      }
    }
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron:Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Electron:Main] Uncaught Exception:', error);
});

app.whenReady().then(() => {
  // First-run bootstrap is intentionally non-blocking: the desktop shell opens
  // immediately while missing provider CLIs are installed from their official
  // installers in the background. The Settings repair action can retry later.
  void bootstrapAgentRuntimes().catch((error) => console.warn('Agent CLI bootstrap failed:', error));
  // Warm the local AGY model inventory before the Agent Workspace is opened.
  // This migrates stale saved selections away from generic model IDs that the
  // current agy CLI no longer accepts.
  void getAvailableModels('antigravity', { forceRefresh: true }).catch((error) => {
    console.warn('Failed to warm Antigravity model inventory:', error);
  });
  createWindow();
  createTray();
  setupAutoUpdater();
  void startCaoDaemon();
  setTimeout(() => {
    void checkForUpdates();
  }, 10_000);

  quotaSyncTimer = setInterval(() => {
    try {
      const quota = readQuotaState();
      safeSend(win, 'agent-quota-updated', quota);
    } catch { /* ignore */ }
  }, 15_000);

  app.on('second-instance', (_event, argv) => {
    if (win) {
      for (const arg of argv) {
        if (arg.startsWith('--mode=')) {
          const val = arg.split('=')[1]?.trim().toLowerCase();
          if (val === 'ide' || val === 'mascot') {
            applyAppMode(val);
          }
        }
        if (arg === '--ide') applyAppMode('ide');
        if (arg === '--mascot') applyAppMode('mascot');
      }
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopCaoDaemon();
  if (updateTimer) clearInterval(updateTimer);
  if (quotaSyncTimer) clearInterval(quotaSyncTimer);
  for (const session of agentProcesses.values()) session.process?.kill();
  agentProcesses.clear();
});
