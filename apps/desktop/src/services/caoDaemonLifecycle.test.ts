import { describe, expect, it } from 'vitest';
import electronMainSource from '../../electron/main.ts?raw';
import preloadSource from '../../electron/preload.ts?raw';
import builderSource from '../../electron-builder.yml?raw';

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
  });

  it('keeps CAO sessions interactive and forwards conductor output instead of raw JSON', () => {
    expect(electronMainSource).toContain("conductor?.last_output");
    expect(electronMainSource).toContain("status.state");
    expect(electronMainSource).toContain("type: 'cao.session.output'");
    expect(electronMainSource).not.toContain("const normalized = statusText.toLowerCase();");
  });

  it('supports the CAO Unix runtime through WSL on Windows', () => {
    expect(electronMainSource).toContain("type CaoRuntime =");
    expect(electronMainSource).toContain("kind: 'wsl'");
    expect(electronMainSource).toContain('function runWslShell');
    expect(electronMainSource).toContain('async function wslPathFor');
    expect(electronMainSource).toContain('CAO_HOME_DIR');
    expect(electronMainSource).toContain('TASK_HUB_CAO_WSL_HOME');
    expect(electronMainSource).toContain("'--working-directory' ? workingDirectory");
  });

  it('includes OpenAI Codex Desktop installer and WinGet paths in candidate discovery', () => {
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(programFiles, 'OpenAI', 'Codex', 'bin', 'codex.exe')");
    expect(electronMainSource).toContain("path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin')");
  });
});
