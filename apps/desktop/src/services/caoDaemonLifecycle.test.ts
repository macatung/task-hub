import { describe, expect, it } from 'vitest';
import electronMainSource from '../../electron/main.ts?raw';
import preloadSource from '../../electron/preload.ts?raw';
import builderSource from '../../electron-builder.yml?raw';
import runWorkspaceSource from '../components/control-center/RunWorkspace.vue?raw';
import settingsPanelSource from '../components/control-center/SettingsPanel.vue?raw';

describe('CAO Daemon All-In-One Lifecycle & Packaging', () => {
  it('implements embedded CAO daemon detection and lifecycle hooks in main process', () => {
    expect(electronMainSource).toContain('resolveCaoExecutable');
    expect(electronMainSource).toContain('startCaoDaemon');
    expect(electronMainSource).toContain('stopCaoDaemon');
    expect(electronMainSource).toContain('isCaoPortOpen');
    expect(electronMainSource).toContain("ipcMain.handle('cao-get-status'");
    expect(electronMainSource).toContain("ipcMain.handle('cao-restart-daemon'");
  });

  it('exposes cao getStatus and restartDaemon in preload API', () => {
    expect(preloadSource).toContain('cao: {');
    expect(preloadSource).toContain("ipcRenderer.invoke('cao-get-status')");
    expect(preloadSource).toContain("ipcRenderer.invoke('cao-restart-daemon')");
  });

  it('configures extraResources for embedded CAO binary in electron-builder', () => {
    expect(builderSource).toContain('extraResources:');
    expect(builderSource).toContain('from: resources/bin/cao');
    expect(builderSource).toContain('to: bin/cao');
  });

  it('uses CAO default port 9889 and verifies a local daemon response', () => {
    expect(electronMainSource).toContain('const CAO_DEFAULT_PORT = 9889');
    expect(electronMainSource).toContain('function caoServerPort()');
    expect(electronMainSource).toContain("res.headers['content-type']?.includes('application/json')");
  });

  it('requires an ext4 CAO home with FIFO support and replaces only conflicting CAO servers', () => {
    expect(electronMainSource).toContain('async function probeCaoWslHome');
    expect(electronMainSource).toContain('CAO_HOME_INVALID:$home');
    expect(electronMainSource).toContain('mkfifo "$probe"');
    expect(electronMainSource).toContain('async function inspectCaoPortOwner');
    expect(electronMainSource).toContain('async function stopConflictingCaoDaemon');
    expect(electronMainSource).toContain("owner.kind === 'conflicting_cao'");
    expect(electronMainSource).toContain('Port ${port} is occupied by a non-Task-Hub process and will not be stopped.');
    expect(electronMainSource).toContain('find "$home/fifos" -maxdepth 1 -type p -delete;');
  });

  it('uses the official CAO CLI lifecycle for execution, messaging, and shutdown', () => {
    expect(electronMainSource).toContain("'launch', prompt");
    expect(electronMainSource).toContain("'--agents', profile");
    expect(electronMainSource).toContain("'--headless', '--async', '--auto-approve'");
    expect(electronMainSource).toContain("['session', 'send', session.caoSessionName");
    expect(electronMainSource).toContain("['shutdown', '--session', session.caoSessionName]");
    expect(electronMainSource).toContain('const caoSession = await tryStartCaoAgent');
    expect(electronMainSource).toContain('parseCaoSessionStatus');
    expect(electronMainSource).toContain('caoLastOutput');
    expect(electronMainSource).toContain('waitForCaoSession');
    expect(electronMainSource).toContain("route: 'cao' as const");
  });

  it('enforces CAO-only execution instead of silently starting a native provider', () => {
    expect(electronMainSource).toContain("throw new Error('CAO is required for all agent runs");
    expect(electronMainSource).toContain('return caoSession;');
    expect(electronMainSource).toContain("caoOnlyError = 'CAO-only execution is enabled");
    expect(electronMainSource).toContain('no native fallback is permitted');
    expect(runWorkspaceSource).not.toContain('Native fallback');
    expect(settingsPanelSource).not.toContain('Native fallback');
    expect(settingsPanelSource).toContain('Mọi phiên agent đều bắt buộc chạy qua CAO');
  });

  it('keeps CAO sessions interactive and forwards conductor output instead of raw JSON', () => {
    expect(electronMainSource).toContain("conductor?.last_output");
    expect(electronMainSource).toContain("status.state");
    expect(electronMainSource).toContain("type: 'cao.session.output'");
    expect(electronMainSource).toContain("type: 'cao.session.state'");
    expect(electronMainSource).not.toContain("const normalized = statusText.toLowerCase();");
  });

  it('does not end a session while CAO still reports an initializing or running worker', () => {
    expect(electronMainSource).toContain('type CaoWorkerStatus');
    expect(electronMainSource).toContain('const liveWorkers = status.workers.filter');
    expect(electronMainSource).toContain("CAO supervisor finished; waiting for");
    expect(electronMainSource).toContain("type: 'cao.session.waiting_workers'");
    expect(electronMainSource).toContain('!isCaoTerminalState(worker.state)');
  });

  it('can reconnect a persisted CAO session and uses portable worktree metadata for WSL Git', () => {
    expect(electronMainSource).toContain('async function reconnectCaoSession');
    expect(electronMainSource).toContain("ipcMain.handle('agent-reconnect-cao-session'");
    expect(preloadSource).toContain("reconnectCaoSession: (sessionId: string)");
    expect(electronMainSource).toContain('function normalizeWorktreeGitMetadata');
    expect(electronMainSource).toContain('function repairWorktreeForCao');
    expect(electronMainSource).toContain('worktree_metadata_normalized');
  });

  it('supports the CAO Unix runtime through WSL on Windows', () => {
    expect(electronMainSource).toContain("type CaoRuntime =");
    expect(electronMainSource).toContain("kind: 'wsl'");
    expect(electronMainSource).toContain('function runWslShell');
    expect(electronMainSource).toContain('async function wslPathFor');
    expect(electronMainSource).toContain('CAO_HOME_DIR');
    expect(electronMainSource).toContain('TASK_HUB_CAO_WSL_HOME');
    expect(electronMainSource).toContain("'--working-directory' ? workingDirectory");
    expect(electronMainSource).toContain('isCaoProviderAvailable');
    expect(electronMainSource).toContain("policy: 'cao_required'");
    expect(electronMainSource).toContain('CAO-only execution');
    expect(electronMainSource).not.toContain("fallback: 'native'");
    expect(electronMainSource).toContain("grep -qvE '\\\\.(exe|cmd|bat)$'");
    expect(electronMainSource).not.toContain('test -x "$(command -v');
  });

  it('includes OpenAI Codex Desktop installer and WinGet paths in candidate discovery', () => {
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(programFiles, 'OpenAI', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin')");
  });
});
