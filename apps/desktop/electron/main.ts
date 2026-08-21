import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog, clipboard, shell, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn, execFileSync } from 'node:child_process';
import { spawn as spawnPty, IPty } from 'node-pty';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable GPU disk cache locks that cause "Access is denied" when launching multiple instances
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');

// Single instance lock to prevent duplicate overlapping desktop pets
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
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

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const appIcon = getIconImage();
  const preloadFile = getPreloadPath();

  win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: screenWidth - DEFAULT_WIDTH - 20,
    y: screenHeight - DEFAULT_HEIGHT - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: false,
    icon: appIcon,
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

  ipcMain.handle('agent-list-sessions', () => Array.from(agentProcesses.entries()).map(([sessionId, session]) => ({ sessionId, provider: session.provider, cwd: session.cwd, mode: session.mode, kind: session.kind, output: session.output.slice(-250000), threadId: session.threadId, events: session.events || [] })));
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
    let mode = session?.mode;
    let kind = session?.kind;
    let cwd = session?.cwd;

    if (!session) {
      const saved = readAllSavedSessions().find((s) => s.sessionId === sessionId);
      if (saved) {
        output = saved.output;
        provider = saved.provider;
        mode = saved.mode;
        kind = saved.kind;
        cwd = saved.worktree || saved.cwd;
      }
    }

    if (!output && output !== '') throw new Error('Session agent không tồn tại hoặc đã bị xóa.');
    const logDirectory = path.join(app.getPath('logs'), 'task-companion');
    fs.mkdirSync(logDirectory, { recursive: true });
    const logPath = path.join(logDirectory, `agent-${sessionId.replace(/[^a-z0-9_-]/gi, '-')}.log`);
    fs.writeFileSync(logPath, `Provider: ${provider}\nMode: ${mode}\nKind: ${kind}\nWorkspace: ${cwd}\n\n${cleanAgentLog(output)}`, 'utf8');
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

  const startInteractiveAgent = (_event: Electron.IpcMainInvokeEvent, { provider, cwd, prompt, kind = 'task' }: { provider: AgentProvider; cwd: string; prompt?: string; kind?: 'task' | 'docs' }) => {
    if (provider === 'antigravity') {
      const agy = resolveCli('agy');
      if (agy) {
        const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const initialPrompt = prompt?.trim() || 'Analyze repository and start execution.';
        const spawnArgs = ['--output-format', 'stream-json', '--dangerously-skip-permissions', '--print', initialPrompt];

        const child = spawn(agy, spawnArgs, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
        });

        const session: AgentSession = {
          process: child as any,
          provider,
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

        return { mode: 'interactive', sessionId, provider, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
      }
      const executable = findAntigravityExecutable();
      if (!executable) throw new Error('Không tìm thấy Antigravity.exe hoặc agy CLI.');
      const child = spawn(executable, [cwd], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      if (prompt?.trim()) {
        clipboard.writeText(prompt.trim());
      }
      const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      agentProcesses.set(sessionId, { provider, cwd, mode: 'external', kind, output: '' });
      persistSessionUpdate({
        sessionId,
        provider,
        cwd,
        mode: 'external',
        kind,
        status: 'running',
        startedAt: new Date().toISOString(),
        output: ''
      });
      return { mode: 'external', sessionId, provider, cwd, executable, promptCopied: Boolean(prompt?.trim()), capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    if (provider === 'codex') {
      const sessionId = `codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const command = resolveCli('codex') || 'codex';
      const initialPrompt = prompt?.trim() || 'Analyze repository and start execution.';
      const spawnArgs = ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', initialPrompt];

      const child = spawn(command, spawnArgs, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', PYTHONUNBUFFERED: '1' }
      });

      const session: AgentSession = {
        process: child as any,
        provider,
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

      return { mode: 'interactive', sessionId, provider, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
    }

    const definition = AGENT_COMMANDS[provider];
    if (!definition) throw new Error('Agent không được hỗ trợ.');
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace không hợp lệ.');

    const sessionId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const command = resolveCli(definition.command) || definition.command;
    const spawnArgs = [...definition.args];
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
    agentProcesses.set(sessionId, { process: pty, provider, cwd, mode: 'interactive', kind, output: '' });
    persistSessionUpdate({
      sessionId,
      provider,
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
    return { mode: 'interactive', sessionId, provider, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
  };
  ipcMain.handle('agent-start', startInteractiveAgent);
  ipcMain.handle('agent-start-interactive', startInteractiveAgent);

  ipcMain.on('agent-input', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    let session = agentProcesses.get(sessionId);
    if (!session) {
      const saved = readAllSavedSessions().find((s) => s.sessionId === sessionId);
      if (saved) {
        session = {
          provider: saved.provider,
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
      const resumeArgs = ['exec', 'resume', session.threadId, '--dangerously-bypass-approvals-and-sandbox', '--json', input.trim()];
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
      const resumeArgs = ['--output-format', 'stream-json', '--dangerously-skip-permissions', '--conversation', session.threadId, '--print', input.trim()];
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
  tray.setToolTip('Ma Tọa Thiền — Task Companion');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🧙‍♂️ Hiển thị / Ẩn Mascot',
      click: () => {
        if (win) {
          if (win.isVisible()) win.hide();
          else win.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '📋 Mở Task Dispatch',
      click: () => {
        if (win) { win.show(); win.webContents.send('tray-action', 'open-dispatch'); }
      },
    },
    {
      label: '🤖 Mở Agent Workspace',
      click: () => {
        if (win) { win.show(); win.webContents.send('tray-action', 'open-agent'); }
      },
    },
    {
      label: '🍅 Bật Đồng Hồ Pomodoro Deep Work',
      click: () => {
        if (win) {
          win.show();
          win.webContents.send('tray-action', 'open-pomodoro');
        }
      },
    },
    {
      label: '🦆 Debug cùng Rubber Duck',
      click: () => {
        if (win) {
          win.show();
          win.webContents.send('tray-action', 'open-duck');
        }
      },
    },
    {
      label: '📋 Task Notes & Scratchpad',
      click: () => {
        if (win) {
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
      else win.show();
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

  app.on('second-instance', () => {
    if (win) {
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
