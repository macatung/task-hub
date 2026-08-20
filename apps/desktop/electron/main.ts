import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog, clipboard, shell } from 'electron';
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
type AgentSession = { process?: IPty; provider: AgentProvider; cwd: string; mode: 'interactive' | 'external' };
const agentProcesses = new Map<string, AgentSession>();
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
let updateState: { status: UpdateStatus; version?: string; percent?: number; message?: string } = { status: 'idle' };
let updateTimer: NodeJS.Timeout | undefined;

const AGENT_COMMANDS: Record<Exclude<AgentProvider, 'antigravity'>, { command: string; args: string[]; capabilities: string[] }> = {
  codex: { command: 'codex', args: [], capabilities: ['interactive', 'stream', 'resume', 'handoff'] },
  claude_code: { command: 'claude', args: [], capabilities: ['interactive', 'stream', 'resume', 'handoff'] },
};
const PROVIDER_CAPABILITIES: Record<AgentProvider, string[]> = {
  codex: AGENT_COMMANDS.codex.capabilities,
  claude_code: AGENT_COMMANDS.claude_code.capabilities,
  antigravity: ['external_session', 'handoff'],
};

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

function installGuardrailHooks(worktree: string) {
  const hooks = path.join(worktree, '.task-companion', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const prePush = path.join(hooks, 'pre-push');
  fs.writeFileSync(prePush, '#!/bin/sh\necho "Task Companion: push requires human approval outside the agent workspace." >&2\nexit 1\n', 'utf8');
  try { fs.chmodSync(prePush, 0o755); } catch { /* Windows does not need an executable bit. */ }
  git(worktree, ['config', 'core.hooksPath', hooks]);
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
    checks.push({ id: 'working_tree', status: dirty ? 'warning' : 'passed', message: dirty ? 'Workspace có thay đổi chưa commit; worktree riêng sẽ dùng base commit hiện tại.' : 'Workspace sạch.' });
    return { ok: Boolean(cli), provider, capabilities: PROVIDER_CAPABILITIES[provider], repository: root, baseCommit: git(root, ['rev-parse', 'HEAD']), checks };
  } catch {
    checks.push({ id: 'repository', status: 'failed', message: 'Workspace phải là Git repository.' });
    return { ok: false, provider, capabilities: PROVIDER_CAPABILITIES[provider], checks };
  }
}

function createAgentWorktree(repository: string, issueKey: string) {
  const root = git(repository, ['rev-parse', '--show-toplevel']);
  const key = safeIssueKey(issueKey);
  const branch = `codex/${key}`;
  const target = path.join(path.dirname(root), '.task-companion-worktrees', key);
  if (fs.existsSync(target)) return { path: target, branch, reused: true, baseCommit: git(target, ['rev-parse', 'HEAD']) };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { git(root, ['worktree', 'add', '-b', branch, target, 'HEAD']); }
  catch { git(root, ['worktree', 'add', target, branch]); }
  installGuardrailHooks(target);
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

  ipcMain.handle('taskhub-pairing-start', async (_event, { taskHubUrl, projectId }: { taskHubUrl: string; projectId: number }) => {
    return taskHubRequest(taskHubUrl, '/api/v1/desktop/pairing/start', { method: 'POST', body: JSON.stringify({ project_id: projectId }) });
  });

  ipcMain.handle('taskhub-pairing-status', async (_event, { taskHubUrl, pairingId, deviceSecret }: { taskHubUrl: string; pairingId: string; deviceSecret: string }) => {
    return taskHubRequest(taskHubUrl, `/api/v1/desktop/pairing/${encodeURIComponent(pairingId)}/status`, { headers: { 'X-Desktop-Pairing-Secret': deviceSecret } });
  });

  ipcMain.handle('taskhub-mcp-call', async (_event, { taskHubUrl, token, projectId, method, params }: { taskHubUrl: string; token: string; projectId: string; method: string; params?: Record<string, any> }) => {
    return taskHubMcpCall(taskHubUrl, token, projectId, method, params || {});
  });
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

  const startInteractiveAgent = (_event: Electron.IpcMainInvokeEvent, { provider, cwd, prompt }: { provider: AgentProvider; cwd: string; prompt?: string }) => {
    if (provider === 'antigravity') {
      const agy = resolveCli('agy');
      if (agy) {
        const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const pty = spawnPty(agy, [], { cwd, name: 'xterm-256color', cols: 100, rows: 30, env: { ...process.env, FORCE_COLOR: '0' } as Record<string, string> });
        agentProcesses.set(sessionId, { process: pty, provider, cwd, mode: 'interactive' });
        pty.onData((text) => win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text }));
        pty.onExit(({ exitCode, signal }) => {
          agentProcesses.delete(sessionId);
          win?.webContents.send('agent-exit', { sessionId, code: exitCode, signal: String(signal) });
        });
        if (prompt?.trim()) pty.write(`${prompt.trim()}\r`);
        return { mode: 'interactive', sessionId, provider, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
      }
      const executable = findAntigravityExecutable();
      if (!executable) throw new Error('Không tìm thấy Antigravity.exe. Hãy cài Antigravity hoặc đặt biến môi trường ANTIGRAVITY_PATH.');
      const child = spawn(executable, [cwd], { cwd, detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      if (prompt?.trim()) {
        clipboard.writeText(prompt.trim());
      }
      const sessionId = `antigravity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      agentProcesses.set(sessionId, { provider, cwd, mode: 'external' });
      return { mode: 'external', sessionId, provider, cwd, executable, promptCopied: Boolean(prompt?.trim()), capabilities: PROVIDER_CAPABILITIES[provider] };
    }
    const definition = AGENT_COMMANDS[provider];
    if (!definition) throw new Error('Agent không được hỗ trợ.');
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Workspace không hợp lệ.');

    const sessionId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const command = resolveCli(definition.command) || definition.command;
    const pty = spawnPty(command, definition.args, { cwd, name: 'xterm-256color', cols: 100, rows: 30, env: { ...process.env, FORCE_COLOR: '0' } as Record<string, string> });
    agentProcesses.set(sessionId, { process: pty, provider, cwd, mode: 'interactive' });
    pty.onData((text) => win?.webContents.send('agent-output', { sessionId, stream: 'stdout', text }));
    pty.onExit(({ exitCode, signal }) => {
      agentProcesses.delete(sessionId);
      win?.webContents.send('agent-exit', { sessionId, code: exitCode, signal: String(signal) });
    });
    if (prompt?.trim()) pty.write(`${prompt.trim()}\r`);
    return { mode: 'interactive', sessionId, provider, cwd, capabilities: PROVIDER_CAPABILITIES[provider] };
  };
  ipcMain.handle('agent-start', startInteractiveAgent);
  ipcMain.handle('agent-start-interactive', startInteractiveAgent);

  ipcMain.on('agent-input', (_event, { sessionId, input }: { sessionId: string; input: string }) => {
    const session = agentProcesses.get(sessionId);
    if (session?.process) session.process.write(input.endsWith('\r') ? input : `${input}\r`);
  });

  ipcMain.handle('agent-stop', (_event, sessionId: string) => {
    const session = agentProcesses.get(sessionId);
    if (!session) return false;
    session.process?.kill();
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
      label: '🌐 Mở Tasks Hub (tasks.macatung.dev)',
      click: () => {
        import('electron').then(({ shell }) => {
          shell.openExternal(process.env.TASK_HUB_URL || 'https://tasks.macatung.dev/tasks');
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
