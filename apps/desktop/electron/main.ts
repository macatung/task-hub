import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog, clipboard, shell, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn, execFileSync } from 'node:child_process';
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
};
const agentProcesses = new Map<string, AgentSession>();
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
let updateState: { status: UpdateStatus; version?: string; percent?: number; message?: string } = { status: 'idle' };
let updateTimer: NodeJS.Timeout | undefined;

const AGENT_COMMANDS: Record<Exclude<AgentProvider, 'antigravity'>, { command: string; args: string[]; capabilities: string[] }> = {
  codex: { command: 'codex', args: ['--dangerously-bypass-approvals-and-sandbox', '--no-alt-screen'], capabilities: ['interactive', 'stream', 'resume', 'full_access', 'handoff'] },
  claude_code: { command: 'claude', args: ['--dangerously-skip-permissions'], capabilities: ['interactive', 'stream', 'resume', 'full_access', 'handoff'] },
};
const PROVIDER_CAPABILITIES: Record<AgentProvider, string[]> = {
  codex: AGENT_COMMANDS.codex.capabilities,
  claude_code: AGENT_COMMANDS.claude_code.capabilities,
  antigravity: ['external_session', 'handoff'],
};

type DesktopCredential = { taskHubUrl: string; token: string; projectId: string; projectTitle?: string };

function desktopCredentialPath() { return path.join(app.getPath('userData'), 'task-hub-credential.bin'); }
function savedAgentWorkspacesPath() { return path.join(app.getPath('userData'), 'agent-workspaces.json'); }
function savedSessionsPath() { return path.join(app.getPath('userData'), 'agent-saved-sessions.json'); }

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
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS secure storage is unavailable.');
  fs.mkdirSync(path.dirname(desktopCredentialPath()), { recursive: true });
  fs.writeFileSync(desktopCredentialPath(), safeStorage.encryptString(JSON.stringify(credential)));
  return true;
}
function loadDesktopCredential(): DesktopCredential | null {
  const file = desktopCredentialPath();
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(file))) as DesktopCredential; } catch { return null; }
}
function clearDesktopCredential() { const file = desktopCredentialPath(); if (fs.existsSync(file)) fs.rmSync(file, { force: true }); return true; }

function findAntigravityExecutable() {
  const candidates = [
    process.env.ANTIGRAVITY_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveCli(command: string) {
  try {
    const result = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], { encoding: 'utf8' });
    return result.split(/\r?\n/).map((value) => value.trim()).find(Boolean) || command;
  } catch {
    return null;
  }
}

async function taskHubRequest(taskHubUrl: string, pathName: string, options: RequestInit = {}) {
  const response = await fetch(`${taskHubUrl.replace(/\/$/, '')}${pathName}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Task Hub request failed (${response.status}).`);
  return body;
}

async function taskHubMcpCall(taskHubUrl: string, token: string, projectId: string, method: string, params: Record<string, any> = {}) {
  return taskHubRequest(taskHubUrl, '/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Task-Hub-Project': projectId },
    body: JSON.stringify({ jsonrpc: '2.0', id: `${Date.now()}-${Math.random()}`, method, params }),
  });
}

function broadcastUpdateState() {
  win?.webContents.send('updater-state', updateState);
}

function setUpdateState(next: { status: UpdateStatus; version?: string; percent?: number; message?: string }) {
  updateState = { ...updateState, ...next };
  broadcastUpdateState();
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
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
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badges: ['High', 'Fast'], description: 'Mô hình thế hệ mới nhất, tối ưu tốc độ và agentic reasoning', source: 'preset' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badges: ['Medium', 'Fast'], description: 'Cân bằng tốc độ cao và năng lực suy luận', source: 'preset' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', badges: ['Medium', 'Fast'], description: 'Phản hồi nhanh cho các tác vụ lập trình phổ biến', source: 'preset' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badges: ['Low'], description: 'Mô hình tiêu chuẩn cho tác vụ nhẹ', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Thinking'], description: 'Suy luận mở rộng và phân tích kiến trúc mã nguồn chuyên sâu', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Thinking'], description: 'Mô hình phân tích cấp cao nhất cho bài toán phức tạp', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: 'Mô hình mã nguồn mở 120B hiệu năng cao', source: 'preset' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badges: ['Recommended', '1M+ Context'], description: 'Mô hình mạnh nhất của DeepMind, context 1M+', source: 'preset' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badges: ['Fast & Smart'], description: 'Tốc độ cao kèm khả năng suy luận xuất sắc', source: 'preset' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', badges: ['Ultra Fast'], description: 'Phản hồi tức thì cho các tác vụ lặp lại', source: 'preset' },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro Exp', badges: ['Experimental'], description: 'Bản thử nghiệm năng lực giải thuật và code gen', source: 'preset' },
    { id: 'default', name: 'IDE / CLI Default', badges: ['Default'], description: 'Cấu hình mặc định của Antigravity', source: 'preset' },
  ],
  claude_code: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', badges: ['High', 'Recommended'], description: 'Tối ưu hoá cao nhất cho coding, kiến trúc & hybrid reasoning', source: 'preset' },
    { id: 'claude-3-7-sonnet-thinking', name: 'Claude 3.7 (Thinking)', badges: ['High', 'Thinking'], description: 'Kích hoạt extended thinking cho các refactor phức tạp', source: 'preset' },
    { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', badges: ['Next-Gen', 'Thinking'], description: 'Mô hình Sonnet thế hệ mới tối ưu agentic workflow', source: 'preset' },
    { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', badges: ['Deep Analysis', 'Thinking'], description: 'Phân tích hệ thống lớn & cấu trúc logic phức tạp', source: 'preset' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (v2)', badges: ['Balanced', 'Fast'], description: 'Mô hình lập trình tiêu chuẩn ổn định', source: 'preset' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', badges: ['Super Fast'], description: 'Tốc độ cực nhanh cho tasks nhỏ và refactor nhẹ', source: 'preset' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', badges: ['Deep Analysis'], description: 'Phân tích hệ thống lớn & bài toán phức tạp', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Cấu hình mặc định của Claude Code CLI', source: 'preset' },
  ],
  codex: [
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', badges: ['High', 'Flagship'], description: 'Mô hình flagship mạnh nhất thế hệ GPT-5.6 cho reasoning, research & agentic coding', source: 'preset' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', badges: ['Medium', 'Fast'], description: 'Mô hình cân bằng hoàn hảo giữa trí tuệ và tốc độ cho tác vụ production', source: 'preset' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', badges: ['Low', 'Ultra Fast'], description: 'Mô hình nhẹ tối ưu tốc độ và chi phí cho khối lượng công việc lớn', source: 'preset' },
    { id: 'gpt-5.6-cyber', name: 'GPT-5.6 Cyber', badges: ['Specialized', 'Security'], description: 'Mô hình chuyên biệt phân tích an toàn thông tin & audit bảo mật mã nguồn', source: 'preset' },
    { id: 'o3-pro', name: 'o3-pro', badges: ['High', 'Deep Reasoning'], description: 'Suy luận chuyên sâu mở rộng cho các bài toán kiến trúc & giải thuật khó', source: 'preset' },
    { id: 'o3', name: 'o3', badges: ['High', 'Reasoning'], description: 'Mô hình suy luận logic đa bước mạnh mẽ thế hệ o-series', source: 'preset' },
    { id: 'o3-mini', name: 'o3-mini', badges: ['Fast Reasoning', 'High'], description: 'Suy luận logic cao cấp với tốc độ phản hồi nhanh chóng', source: 'preset' },
    { id: 'gpt-5', name: 'GPT-5 (Foundational)', badges: ['High', 'Foundational'], description: 'Mô hình nền tảng thế hệ GPT-5', source: 'preset' },
    { id: 'gpt-4.1', name: 'GPT-4.1', badges: ['Balanced', 'Fast'], description: 'Phiên bản tối ưu hiệu năng cao cho tasks coding hàng ngày', source: 'preset' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', badges: ['Ultra Fast'], description: 'Mô hình siêu nhẹ tốc độ cao', source: 'preset' },
    { id: 'o1', name: 'o1', badges: ['Deep Reasoning'], description: 'Suy luận từng bước giải quyết bài toán khó', source: 'preset' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', badges: ['High Quality', 'Large Context'], description: 'Khả năng hiểu ngữ cảnh sâu và kiến trúc phức tạp', source: 'preset' },
    { id: 'gpt-4o', name: 'GPT-4o', badges: ['Omni', 'Fast'], description: 'Cân bằng tốc độ và chất lượng thực thi', source: 'preset' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', badges: ['Ultra Fast'], description: 'Mô hình nhỏ gọn tốc độ cao', source: 'preset' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Medium)', badges: ['Open Weights', 'Medium'], description: 'Mô hình mã nguồn mở 120B tham số', source: 'preset' },
    { id: 'default', name: 'CLI Default', badges: ['Default'], description: 'Cấu hình mặc định của Codex CLI', source: 'preset' },
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

  for (const p of providers) {
    const map = new Map<string, DiscoveredModel>();

    // 1. Base presets
    (BASE_PRESET_MODELS[p] || []).forEach((m) => map.set(m.id, { ...m, source: 'preset' }));

    // 2. Cached remote / Hub discovered models
    if (cached?.data?.[p]) {
      cached.data[p].forEach((m) => {
        const existing = map.get(m.id);
        map.set(m.id, {
          id: m.id,
          name: m.name || m.id,
          badges: m.badges || inferModelBadges(m.id, m.name),
          description: m.description || existing?.description || `Model ${m.id} tự động đồng bộ từ Task Hub / CLI`,
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
        description: m.description || `Model tùy chỉnh người dùng đã lưu: ${m.id}`,
        source: 'custom',
      });
    });

    result[p] = Array.from(map.values());
  }

  return {
    ok: true,
    provider,
    models: provider ? result[provider] : result,
    syncedAt: cached ? new Date(cached.timestamp).toISOString() : new Date().toISOString(),
    source: cached ? (Date.now() - cached.timestamp < 60000 ? 'live' : 'cache') : 'preset',
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

function readQuotaState(): QuotaUsageState {
  try {
    const file = getQuotaFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data?.gemini && data?.claudeGpt) return data;
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
  }
  return quota;
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

function preflightAgent(provider: AgentProvider, cwd: string) {
  const checks: Array<{ id: string; status: 'passed' | 'failed' | 'warning'; message: string }> = [];
  const cli = provider === 'antigravity' ? (resolveCli('agy') || findAntigravityExecutable()) : resolveCli(AGENT_COMMANDS[provider].command);
  checks.push({ id: 'provider', status: cli ? 'passed' : 'failed', message: cli ? `${provider} đã sẵn sàng.` : `Không tìm thấy ${provider}. Hãy cài CLI hoặc cấu hình đường dẫn.` });
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) return { ok: false, provider, capabilities: PROVIDER_CAPABILITIES[provider], checks: [...checks, { id: 'workspace', status: 'failed' as const, message: 'Chọn thư mục repository hợp lệ.' }] };
  try {
    const root = git(cwd, ['rev-parse', '--show-toplevel']);
    const dirty = git(cwd, ['status', '--porcelain']);
    checks.push({ id: 'repository', status: 'passed', message: `Git repository: ${root}` });
    let remote = ''; let upstream = ''; let divergence = '';
    try { remote = git(root, ['remote', 'get-url', 'origin']); } catch { /* Local-only repository. */ }
    try { upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { /* No upstream configured. */ }
    if (upstream) { try { divergence = git(root, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]); } catch { /* Ignore unavailable comparison. */ } }
    checks.push({ id: 'remote', status: remote ? (upstream && divergence !== '0\t0' ? 'warning' : 'passed') : 'warning', message: remote ? `origin: ${remote}${upstream ? ` · ${upstream}${divergence ? ` · behind/ahead ${divergence}` : ''}` : ' · chưa có upstream tracking branch.'}` : 'Chưa cấu hình remote origin; local repo chưa được xác nhận đồng bộ với Task Hub/GitHub.' });
    checks.push({ id: 'working_tree', status: dirty ? 'warning' : 'passed', message: dirty ? 'Workspace có thay đổi chưa commit; worktree riêng sẽ dùng base commit hiện tại.' : 'Workspace sạch.' });
    return { ok: Boolean(cli), provider, capabilities: PROVIDER_CAPABILITIES[provider], repository: root, baseCommit: git(root, ['rev-parse', 'HEAD']), remote, upstream, divergence, checks };
  } catch {
    checks.push({ id: 'repository', status: 'failed', message: 'Workspace phải là Git repository.' });
    return { ok: false, provider, capabilities: PROVIDER_CAPABILITIES[provider], checks };
  }
}

function quickSetupEnvironment(cwd: string, installDependencies = true) {
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace phải là thư mục hợp lệ.');
  const checks: Array<{ id: string; status: 'passed' | 'failed' | 'warning'; message: string }> = [];
  const run = (id: string, command: string, args: string[], message: string) => {
    const executable = resolveCli(command);
    if (!executable) { checks.push({ id, status: 'warning', message: `${command} chưa được cài; bỏ qua.` }); return; }
    try { execFileSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 300000, stdio: 'ignore' }); checks.push({ id, status: 'passed', message }); }
    catch { checks.push({ id, status: 'failed', message: `${command} không chạy thành công.` }); }
  };
  const repository = git(cwd, ['rev-parse', '--show-toplevel']);
  checks.push({ id: 'repository', status: 'passed', message: `Git repository: ${repository}` });
  const envExample = path.join(repository, '.env.example');
  const envFile = path.join(repository, '.env');
  if (fs.existsSync(envExample) && !fs.existsSync(envFile)) { fs.copyFileSync(envExample, envFile); checks.push({ id: 'env', status: 'passed', message: 'Created .env from .env.example.' }); }
  else if (fs.existsSync(envFile)) checks.push({ id: 'env', status: 'passed', message: '.env already exists; kept local values.' });
  else checks.push({ id: 'env', status: 'warning', message: 'No .env.example found; skipped environment file setup.' });
  if (installDependencies && fs.existsSync(path.join(repository, 'package-lock.json'))) run('node_dependencies', 'npm', ['ci'], 'Installed Node dependencies with npm ci.');
  if (installDependencies && fs.existsSync(path.join(repository, 'composer.lock'))) run('php_dependencies', 'composer', ['install', '--no-interaction', '--prefer-dist'], 'Installed PHP dependencies with Composer.');
  return { ok: checks.every((check) => check.status !== 'failed'), repository, checks };
}

function createAgentWorktree(repository: string, issueKey: string) {
  const root = git(repository, ['rev-parse', '--show-toplevel']);
  const key = safeIssueKey(issueKey);
  const branch = `codex/${key}`;
  const target = path.join(path.dirname(root), '.task-companion-worktrees', key);
  if (fs.existsSync(target)) {
    disableAgentGuardrails(target);
    return { path: target, branch, reused: true, baseCommit: git(target, ['rev-parse', 'HEAD']) };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { git(root, ['worktree', 'add', '-b', branch, target, 'HEAD']); }
  catch { git(root, ['worktree', 'add', target, branch]); }
  disableAgentGuardrails(target);
  return { path: target, branch, reused: false, baseCommit: git(target, ['rev-parse', 'HEAD']) };
}

async function checkForUpdates(): Promise<typeof updateState> {
  if (!app.isPackaged) {
    setUpdateState({ status: 'not-available', message: 'Auto-update chỉ hoạt động ở bản Task Companion đã cài đặt.' });
    return updateState;
  }
  if (updateState.status === 'checking' || updateState.status === 'downloading') return updateState;
  setUpdateState({ status: 'checking', message: 'Đang kiểm tra cập nhật...' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error: any) {
    setUpdateState({ status: 'error', message: error?.message?.slice(0, 240) || 'Không thể kiểm tra cập nhật.' });
  }
  return updateState;
}

function installDownloadedUpdate(): typeof updateState {
  if (!app.isPackaged) {
    setUpdateState({ status: 'not-available', message: 'Hãy cài bản desktop release để dùng auto-update.' });
  } else if (updateState.status !== 'downloaded') {
    setUpdateState({ status: 'not-available', message: 'Chưa có bản cập nhật đã tải. Hãy chọn “Kiểm tra cập nhật” trước.' });
  } else {
    autoUpdater.quitAndInstall(false, true);
  }
  return updateState;
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', message: 'Đang kiểm tra cập nhật...' }));
  autoUpdater.on('update-available', (info) => setUpdateState({ status: 'available', version: info.version, percent: 0, message: `Đang tải bản ${info.version}...` }));
  autoUpdater.on('update-not-available', (info) => setUpdateState({ status: 'not-available', version: info.version, percent: 100, message: 'App đang ở phiên bản mới nhất.' }));
  autoUpdater.on('download-progress', (progress) => setUpdateState({ status: 'downloading', percent: Math.round(progress.percent), message: `Đang tải cập nhật ${Math.round(progress.percent)}%...` }));
  autoUpdater.on('update-downloaded', (info) => setUpdateState({ status: 'downloaded', version: info.version, percent: 100, message: `Bản ${info.version} đã sẵn sàng cài đặt.` }));
  autoUpdater.on('error', (error) => setUpdateState({ status: 'error', message: error.message.slice(0, 240) || 'Không thể kiểm tra cập nhật.' }));
  updateTimer = setInterval(() => {
    void checkForUpdates();
  }, 6 * 60 * 60 * 1000);
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 520;

function getIconImage() {
  const possiblePaths = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../../public/brand/macatung-mascot-icon.png'),
    path.join(process.cwd(), 'public/brand/macatung-mascot-icon.png'),
    path.join(process.cwd(), 'desktop/public/icon.png'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }

  // Fallback programmatic green/gold circle
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#0c0a09" stroke="#00f5a0" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#ffd166"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
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
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  if (mode === 'ide') {
    const ideWidth = Math.min(1360, Math.max(1024, screenWidth - 100));
    const ideHeight = Math.min(880, Math.max(700, screenHeight - 60));
    const x = Math.max(0, Math.round((screenWidth - ideWidth) / 2));
    const y = Math.max(0, Math.round((screenHeight - ideHeight) / 2));

    win.setAlwaysOnTop(false);
    win.setMinimumSize(960, 600);
    win.setBounds({ x, y, width: ideWidth, height: ideHeight });
    win.show();
    win.focus();
  } else {
    const mascotWidth = 640;
    const mascotHeight = 520;
    const x = Math.max(0, screenWidth - mascotWidth - 20);
    const y = Math.max(0, screenHeight - mascotHeight - 20);

    win.setAlwaysOnTop(true);
    win.setMinimumSize(320, 240);
    win.setBounds({ x, y, width: mascotWidth, height: mascotHeight });
    win.show();
  }

  win.webContents.send('app-mode-changed', currentMode);
  return currentMode;
}

function createWindow() {
  currentMode = readSavedAppMode();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const appIcon = getIconImage();
  const preloadFile = getPreloadPath();

  const isIde = currentMode === 'ide';
  const initialWidth = isIde ? Math.min(1360, Math.max(1024, screenWidth - 100)) : DEFAULT_WIDTH;
  const initialHeight = isIde ? Math.min(880, Math.max(700, screenHeight - 60)) : DEFAULT_HEIGHT;
  const initialX = isIde ? Math.max(0, Math.round((screenWidth - initialWidth) / 2)) : screenWidth - DEFAULT_WIDTH - 20;
  const initialY = isIde ? Math.max(0, Math.round((screenHeight - initialHeight) / 2)) : screenHeight - DEFAULT_HEIGHT - 20;

  win = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
    minWidth: isIde ? 960 : 320,
    minHeight: isIde ? 600 : 240,
    transparent: !isIde,
    frame: false,
    alwaysOnTop: !isIde,
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

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || path.join(__dirname, '../dist'), 'index.html'));
  }

  win.show();
  win.focus();

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page finished loading. App mode:', currentMode);
    win?.webContents.send('app-mode-changed', currentMode);
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = level === 0 ? 'INFO' : level === 1 ? 'WARN' : 'ERROR';
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Load Error] Code: ${errorCode}, Description: ${errorDescription}, URL: ${validatedURL}`);
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

  ipcMain.on('window-close', () => {
    if (win) win.hide();
  });

  ipcMain.on('window-minimize', () => {
    if (win) win.minimize();
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
      const [currentX, currentY] = win.getPosition();
      const [currentW, currentH] = win.getSize();
      const newX = currentX - (width - currentW);
      const newY = currentY - (height - currentH);
      win.setBounds({
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        width,
        height,
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
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error('Workspace phải là thư mục hợp lệ.');
    const workspaces = [resolved, ...readSavedAgentWorkspaces().filter((item) => item !== resolved)].slice(0, 12);
    return writeSavedAgentWorkspaces(workspaces);
  });
  ipcMain.handle('agent-remove-workspace', (_event, cwd: string) => writeSavedAgentWorkspaces(readSavedAgentWorkspaces().filter((item) => item !== path.resolve(cwd || ''))));

  ipcMain.handle('window-toggle-fullscreen', (_event, fullscreen: boolean) => {
    win?.setFullScreen(Boolean(fullscreen));
    return Boolean(fullscreen);
  });

  ipcMain.handle('agent-read-generated-documents', (_event, worktree: string) => {
    const resolved = path.resolve(worktree || '');
    const marker = `${path.sep}.task-companion-worktrees${path.sep}`;
    if (!resolved.includes(marker)) throw new Error('Chỉ có thể đọc docs từ worktree do Task Companion tạo.');
    const paths = ['docs/PROJECT_DOCUMENTS.md', 'docs/PROJECT_BRIEF.md', 'docs/PRD.md', 'docs/ARCHITECTURE.md', 'docs/QA_PLAN.md', 'docs/RELEASE_RUNBOOK.md'];
    const documents = paths.filter((relative) => fs.existsSync(path.join(resolved, relative))).map((relative) => ({ path: relative, content: fs.readFileSync(path.join(resolved, relative), 'utf8') }));
    const manifest = documents.find((document) => document.path === 'docs/PROJECT_DOCUMENTS.md')?.content;
    if (!manifest) throw new Error('Agent chưa tạo docs/PROJECT_DOCUMENTS.md.');
    return { manifest, documents: documents.filter((document) => document.path !== 'docs/PROJECT_DOCUMENTS.md') };
  });

  ipcMain.handle('agent-apply-docs-to-workspace', (_event, { worktree, destinationWorkspace }: { worktree: string; destinationWorkspace: string }) => {
    const resolvedWorktree = path.resolve(worktree || '');
    const resolvedDest = path.resolve(destinationWorkspace || '');
    if (!fs.existsSync(resolvedWorktree) || !fs.existsSync(resolvedDest)) {
      throw new Error('Thư mục nguồn hoặc đích không tồn tại.');
    }
    const docsDirSrc = path.join(resolvedWorktree, 'docs');
    const docsDirDest = path.join(resolvedDest, 'docs');
    if (!fs.existsSync(docsDirSrc)) {
      throw new Error('Không tìm thấy thư mục docs trong worktree.');
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
    if (!/^https?:\/\//i.test(url)) throw new Error('Chỉ cho phép mở URL HTTP/HTTPS.');
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('updater-get-state', () => updateState);
  ipcMain.handle('updater-check', async () => {
    return checkForUpdates();
  });
  ipcMain.handle('agent-preflight', (_event, { provider, cwd }: { provider: AgentProvider; cwd: string }) => preflightAgent(provider, cwd));
  ipcMain.handle('agent-quick-setup', (_event, { cwd, installDependencies }: { cwd: string; installDependencies?: boolean }) => quickSetupEnvironment(cwd, installDependencies !== false));
  ipcMain.handle('agent-create-worktree', (_event, { repository, issueKey }: { repository: string; issueKey: string }) => createAgentWorktree(repository, issueKey));
  ipcMain.handle('agent-open-workspace', async (_event, cwd: string) => shell.openPath(cwd));
  ipcMain.handle('agent-cleanup-worktree', (_event, { repository, worktree }: { repository: string; worktree: string }) => {
    const root = git(repository, ['rev-parse', '--show-toplevel']);
    const allowedRoot = path.join(path.dirname(root), '.task-companion-worktrees') + path.sep;
    if (!path.resolve(worktree).startsWith(path.resolve(allowedRoot))) throw new Error('Chỉ có thể dọn worktree do Task Companion tạo.');
    git(root, ['worktree', 'remove', '--force', worktree]);
    return true;
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
  ipcMain.handle('taskhub-documents-import-generated', async (_event, { taskHubUrl, token, projectId, payload }: { taskHubUrl: string; token: string; projectId: string; payload: Record<string, any> }) => taskHubRequest(taskHubUrl, `/api/v1/projects/${encodeURIComponent(projectId)}/documents/import-generated`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Task-Hub-Project': projectId }, body: JSON.stringify(payload) }));
  ipcMain.handle('taskhub-capabilities', async (_event, taskHubUrl: string) => taskHubRequest(taskHubUrl, '/api/v1/capabilities'));

  ipcMain.handle('agent-configure-mcp', (_event, { cwd, provider, taskHubUrl, projectId, token }: { cwd: string; provider: string; taskHubUrl: string; projectId: string; token: string }) => {
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace không hợp lệ.');
    if (!/^https?:\/\//i.test(taskHubUrl)) throw new Error('Task Hub URL phải bắt đầu bằng http:// hoặc https://.');
    if (!/^\d+$/.test(String(projectId))) throw new Error('Project ID phải là số.');
    if (!token || token.length < 12) throw new Error('Project MCP token không hợp lệ.');

    const useAntigravityFormat = provider === 'antigravity' || provider === 'agy';
    const configDirectory = useAntigravityFormat ? path.join(cwd, '.agents') : cwd;
    const configPath = useAntigravityFormat ? path.join(configDirectory, 'mcp_config.json') : path.join(cwd, '.mcp.json');
    let config: Record<string, any> = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { throw new Error('Không đọc được MCP config hiện tại.'); }
      fs.copyFileSync(configPath, `${configPath}.bak.${Date.now()}`);
    }
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['task-hub'] = {
      ...(useAntigravityFormat ? { serverUrl: `${taskHubUrl.replace(/\/$/, '')}/mcp` } : { type: 'http', url: `${taskHubUrl.replace(/\/$/, '')}/mcp` }),
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Task-Hub-Project': String(projectId),
      },
    };
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    const gitExclude = path.join(cwd, '.git', 'info', 'exclude');
    if (fs.existsSync(path.join(cwd, '.git'))) {
      fs.mkdirSync(path.dirname(gitExclude), { recursive: true });
      const existing = fs.existsSync(gitExclude) ? fs.readFileSync(gitExclude, 'utf8') : '';
      const relative = path.relative(cwd, configPath).replace(/\\/g, '/');
      if (!existing.split(/\r?\n/).includes(relative)) fs.appendFileSync(gitExclude, `${existing && !existing.endsWith('\n') ? '\n' : ''}${relative}\n`, 'utf8');
    }
    return { path: configPath, server: 'task-hub' };
  });

  ipcMain.handle('agent-list-sessions', () => Array.from(agentProcesses.entries()).map(([sessionId, session]) => ({ sessionId, provider: session.provider, model: session.model, cwd: session.cwd, mode: session.mode, kind: session.kind, output: session.output.slice(-250000), threadId: session.threadId, events: session.events || [] })));
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

    if (!output && output !== '') throw new Error('Session agent không tồn tại hoặc đã bị xóa.');
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
    } else if (su.step_type === 'agent_response' && su.text_delta) {
      return su.text_delta;
    }
  } else if (event.event === 'result') {
    const res = event.result;
    const resp = res?.response ? `\n💬 ${res.response}\n` : '';
    const tokens = res?.usage?.total_tokens ? `✓ Hoàn tất · Total tokens: ${res.usage.total_tokens.toLocaleString()}\n` : '';
    return `${resp}${tokens}`;
  }
  return '';
}

  const startInteractiveAgent = (_event: Electron.IpcMainInvokeEvent, { provider, cwd, prompt, kind = 'task', model }: { provider: AgentProvider; cwd: string; prompt?: string; kind?: 'task' | 'docs'; model?: string }) => {
    const selectedModel = model && model !== 'default' ? String(model).trim() : undefined;

    if (provider === 'antigravity') {
      const agy = resolveCli('agy');
      if (agy) {
        const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const initialPrompt = prompt?.trim() || 'Analyze repository and start execution.';
        const spawnArgs = ['--output-format', 'stream-json', '--dangerously-skip-permissions'];
        if (selectedModel) {
          spawnArgs.push('--model', selectedModel);
        }
        spawnArgs.push('--print', initialPrompt);

        const child = spawn(agy, spawnArgs, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
        });

        const session: AgentSession = {
          process: child as any,
          provider,
          model: selectedModel,
          cwd,
          mode: 'exec',
          kind,
          output: '',
          events: []
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
          events: []
        });

        let buffer = '';
        child.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              session.events = (session.events || []).concat(event);
              if (event.event === 'init' && event.conversation_id) {
                session.threadId = event.conversation_id;
                persistSessionUpdate({ sessionId, threadId: event.conversation_id });
              }
              const formattedLine = formatAgyEvent(event);
              if (formattedLine) {
                session.output = `${session.output}${formattedLine}`.slice(-250000);
              }
              win?.webContents.send('agent-output', { sessionId, stream: 'event', event, text: formattedLine || '' });
            } catch {
              session.output = `${session.output}\n${line}`.slice(-250000);
              win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text: line });
            }
          }
        });

        child.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          session.output = `${session.output}\n${text}`.slice(-250000);
          win?.webContents.send('agent-output', { sessionId, stream: 'stderr', text });
        });

        child.on('close', (code, signal) => {
          persistSessionUpdate({
            sessionId,
            status: code === 0 ? 'completed' : 'failed',
            exitCode: code,
            output: session.output,
            events: session.events
          });
          win?.webContents.send('agent-exit', { sessionId, code, signal: String(signal || '') });
        });

        return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
      }
      const executable = findAntigravityExecutable();
      if (!executable) throw new Error('Không tìm thấy Antigravity.exe hoặc agy CLI.');
      const child = spawn(executable, [cwd], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      if (prompt?.trim()) {
        const modelHeader = selectedModel ? `[Model: ${selectedModel}]\n\n` : '';
        clipboard.writeText(`${modelHeader}${prompt.trim()}`);
      }
      const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      agentProcesses.set(sessionId, { provider, model: selectedModel, cwd, mode: 'external', kind, output: '' });
      persistSessionUpdate({
        sessionId,
        provider,
        model: selectedModel,
        cwd,
        mode: 'external',
        kind,
        status: 'running',
        startedAt: new Date().toISOString(),
        output: ''
      });
      return { mode: 'external', sessionId, provider, model: selectedModel, cwd, executable, promptCopied: Boolean(prompt?.trim()), capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    if (provider === 'codex') {
      const sessionId = `codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const command = resolveCli('codex') || 'codex';
      const initialPrompt = prompt?.trim() || 'Analyze repository and start execution.';
      const spawnArgs = ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json'];
      if (selectedModel) {
        spawnArgs.push('-m', selectedModel);
      }
      spawnArgs.push(initialPrompt);

      const child = spawn(command, spawnArgs, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });

      const session: AgentSession = {
        process: child as any,
        provider,
        model: selectedModel,
        cwd,
        mode: 'exec',
        kind,
        output: '',
        events: []
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
        events: []
      });

      let buffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            session.events = (session.events || []).concat(event);
            if (event.type === 'thread.started' && event.thread_id) {
              session.threadId = event.thread_id;
              persistSessionUpdate({ sessionId, threadId: event.thread_id });
            }
            let formattedLine = '';
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
              formattedLine = `\n💬 ${event.item.text}\n`;
            } else if (event.type === 'item.started' && event.item?.type === 'command_execution') {
              formattedLine = `\n⚡ [Chạy lệnh] $ ${event.item.command}\n`;
            } else if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
              formattedLine = `\n✓ [Hoàn tất lệnh] exit code: ${event.item.exit_code ?? 0}\n${event.item.aggregated_output || ''}\n`;
            } else if (event.type === 'turn.completed') {
              formattedLine = `\n✓ Turn hoàn thành · Tokens: in ${event.usage?.input_tokens || 0}, out ${event.usage?.output_tokens || 0}\n`;
            }
            if (formattedLine) {
              session.output = `${session.output}${formattedLine}`.slice(-250000);
            }
            win?.webContents.send('agent-output', { sessionId, stream: 'event', event, text: formattedLine || line });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (!text.includes('Reading additional input from stdin')) {
          session.output = `${session.output}\n${text}`.slice(-250000);
          win?.webContents.send('agent-output', { sessionId, stream: 'stderr', text });
        }
      });

      child.on('close', (code, signal) => {
        persistSessionUpdate({
          sessionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output: session.output,
          events: session.events
        });
        win?.webContents.send('agent-exit', { sessionId, code, signal: String(signal || '') });
      });

      return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    const definition = AGENT_COMMANDS[provider];
    if (!definition) throw new Error('Agent không được hỗ trợ.');
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace không hợp lệ.');

    const sessionId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const command = resolveCli(definition.command) || definition.command;
    const spawnArgs = [...definition.args];
    if (selectedModel && selectedModel !== 'default') {
      spawnArgs.push('--model', selectedModel);
    }
    if (prompt?.trim()) {
      spawnArgs.push(prompt.trim());
    }

    const pty = spawnPty(command, spawnArgs, {
      cwd,
      name: 'xterm-256color',
      cols: 120,
      rows: 35,
      env: { ...process.env, FORCE_COLOR: '1', COLORTERM: 'truecolor', TERM: 'xterm-256color' } as Record<string, string>
    });
    agentProcesses.set(sessionId, { process: pty, provider, model: selectedModel, cwd, mode: 'interactive', kind, output: '' });
    persistSessionUpdate({
      sessionId,
      provider,
      model: selectedModel,
      cwd,
      mode: 'interactive',
      kind,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: ''
    });
    pty.onData((text) => {
      const session = agentProcesses.get(sessionId);
      if (session) session.output = `${session.output}${text}`.slice(-250000);
      win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text });
    });
    pty.onExit(({ exitCode, signal }) => {
      persistSessionUpdate({
        sessionId,
        status: exitCode === 0 ? 'completed' : 'failed',
        exitCode,
      });
      agentProcesses.delete(sessionId);
      win?.webContents.send('agent-exit', { sessionId, code: exitCode, signal: String(signal) });
    });
    return { mode: 'interactive', sessionId, provider, model: selectedModel, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
  };
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
      description: payload.model.description || `Model tùy chỉnh đã lưu: ${payload.model.id}`,
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

  ipcMain.on('agent-input', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
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
          events: saved.events || []
        };
        agentProcesses.set(sessionId, session);
      }
    }
    if (!session || !input?.trim()) return;

    if (session.provider === 'codex' && session.threadId) {
      const command = resolveCli('codex') || 'codex';
      const resumeArgs = ['exec', 'resume', session.threadId, '--dangerously-bypass-approvals-and-sandbox', '--json'];
      if (session.model && session.model !== 'default') {
        resumeArgs.push('-m', session.model);
      }
      resumeArgs.push(input.trim());
      const resumeChild = spawn(command, resumeArgs, {
        cwd: session.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });
      session.process = resumeChild as any;
      persistSessionUpdate({ sessionId, status: 'running' });

      win?.webContents.send('agent-output', {
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
            let formattedLine = '';
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
              formattedLine = `\n💬 ${event.item.text}\n`;
            } else if (event.type === 'item.started' && event.item?.type === 'command_execution') {
              formattedLine = `\n⚡ [Chạy lệnh] $ ${event.item.command}\n`;
            } else if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
              formattedLine = `\n✓ [Hoàn tất lệnh] exit code: ${event.item.exit_code ?? 0}\n${event.item.aggregated_output || ''}\n`;
            } else if (event.type === 'turn.completed') {
              formattedLine = `\n✓ Turn hoàn thành · Tokens: in ${event.usage?.input_tokens || 0}, out ${event.usage?.output_tokens || 0}\n`;
            }
            if (formattedLine) {
              session.output = `${session.output}${formattedLine}`.slice(-250000);
            }
            win?.webContents.send('agent-output', { sessionId, stream: 'event', event, text: formattedLine || line });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      resumeChild.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (!text.includes('Reading additional input from stdin')) {
          session.output = `${session.output}\n${text}`.slice(-250000);
          win?.webContents.send('agent-output', { sessionId, stream: 'stderr', text });
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
        win?.webContents.send('agent-exit', { sessionId, code, signal: String(signal || '') });
      });
      return;
    }

    if (session.provider === 'antigravity' && session.threadId) {
      const agy = resolveCli('agy') || 'agy';
      const resumeArgs = ['--output-format', 'stream-json', '--dangerously-skip-permissions', '--conversation', session.threadId];
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
      persistSessionUpdate({ sessionId, status: 'running' });

      win?.webContents.send('agent-output', {
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
            win?.webContents.send('agent-output', { sessionId, stream: 'event', event, text: formattedLine || '' });
          } catch {
            session.output = `${session.output}\n${line}`.slice(-250000);
            win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text: line });
          }
        }
      });

      resumeChild.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        session.output = `${session.output}\n${text}`.slice(-250000);
        win?.webContents.send('agent-output', { sessionId, stream: 'stderr', text });
      });

      resumeChild.on('close', (code, signal) => {
        persistSessionUpdate({
          sessionId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output: session.output,
          events: session.events
        });
        win?.webContents.send('agent-exit', { sessionId, code, signal: String(signal || '') });
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
    if (session.process) {
      if ('kill' in session.process) session.process.kill();
    }
    agentProcesses.delete(sessionId);
    return true;
  });
}

function createTray() {
  const appIcon = getIconImage();
  const trayIcon = appIcon.resize({ width: 20, height: 20 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip('Task Hub — VS Code IDE & Mascot Nhắc Việc');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '💻 Bản 1: Mở Task Hub IDE (VS Code Mode)',
      click: () => {
        applyAppMode('ide');
      },
    },
    {
      label: '🧘 Bản 2: Mở Mascot Nhắc Việc (Companion Mode)',
      click: () => {
        applyAppMode('mascot');
      },
    },
    { type: 'separator' },
    {
      label: '📋 Danh sách Task hôm nay',
      click: () => {
        if (win) {
          if (currentMode !== 'mascot') applyAppMode('mascot');
          win.show();
          win.webContents.send('tray-action', 'open-dispatch');
        }
      },
    },
    {
      label: '🍅 Bật Pomodoro tập trung',
      click: () => {
        if (win) {
          if (currentMode !== 'mascot') applyAppMode('mascot');
          win.show();
          win.webContents.send('tray-action', 'open-pomodoro');
        }
      },
    },
    {
      label: '🦆 Debug cùng Rubber Duck',
      click: () => {
        if (win) {
          if (currentMode !== 'mascot') applyAppMode('mascot');
          win.show();
          win.webContents.send('tray-action', 'open-duck');
        }
      },
    },
    {
      label: '📝 Task Notes & Scratchpad',
      click: () => {
        if (win) {
          if (currentMode !== 'mascot') applyAppMode('mascot');
          win.show();
          win.webContents.send('tray-action', 'open-notes');
        }
      },
    },
    {
      label: '🌐 Mở Task Hub (task-hub.macatung.dev)',
      click: () => {
        import('electron').then(({ shell }) => {
          shell.openExternal(process.env.TASK_HUB_URL || 'https://task-hub.macatung.dev/tasks');
        });
      },
    },
    { type: 'separator' },
    {
      label: '🔄 Kiểm tra cập nhật',
      click: () => {
        if (win) { win.show(); win.focus(); }
        void checkForUpdates();
      },
    },
    {
      label: '⬆️ Khởi động lại để cập nhật',
      click: () => {
        if (win) { win.show(); win.focus(); }
        installDownloadedUpdate();
      },
    },
    { type: 'separator' },
    {
      label: '❌ Thoát Hoàn Toàn Ứng Dụng',
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

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();
  setTimeout(() => {
    void checkForUpdates();
  }, 10_000);

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
  if (updateTimer) clearInterval(updateTimer);
  for (const session of agentProcesses.values()) session.process?.kill();
  agentProcesses.clear();
});
