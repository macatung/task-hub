import { describe, expect, it } from 'vitest';
import mainSource from '../../electron/main.ts?raw';
import preloadSource from '../../electron/preload.ts?raw';
import settingsSource from '../components/control-center/SettingsPanel.vue?raw';
import controlCenterSource from '../views/ControlCenter.vue?raw';

describe('agent CLI bootstrap and recovery', () => {
  it('discovers package-manager CLI locations and rejects the protected Windows Store binary', () => {
    expect(mainSource).toContain("'npm', 'codex.cmd'");
    expect(mainSource).toContain("'codex-win32-x64'");
    expect(mainSource).toContain("'npm', 'claude.cmd'");
    expect(mainSource).toContain("'agy', 'bin', 'agy.exe'");
    expect(mainSource).toContain("/\\\\WindowsApps\\\\OpenAI\\.Codex_/i");
  });

  it('refreshes CAO provider status and exposes a repair endpoint', () => {
    expect(mainSource).toContain("ipcMain.handle('agent-bootstrap-runtimes'");
    expect(mainSource).toContain('function verifyCliExecutable');
    expect(mainSource).toContain("spawn(executable, ['--version']");
    expect(mainSource).toContain('never install or execute provider CLIs in the host');
    expect(mainSource).toContain('void bootstrapAgentRuntimes()');
    expect(preloadSource).toContain("bootstrapRuntimes: () => ipcRenderer.invoke('agent-bootstrap-runtimes')");
    expect(settingsSource).toContain('Refresh CAO runtime');
    expect(mainSource).toContain('never install or execute provider CLIs in the host');
  });

  it('turns a failed Codex spawn into a normal failed run instead of leaving the UI working', () => {
    expect(mainSource).toContain("child.once('error', (error) =>");
    expect(mainSource).toContain('Unable to launch Codex CLI:');
    expect(mainSource).toContain('Unable to launch Antigravity CLI:');
    expect(mainSource).toContain('Unable to resume Codex CLI:');
    expect(mainSource).toContain("const resumeEnvironment = environmentForAgent('codex')");
    expect(mainSource).toContain("signal: 'SPAWN_ERROR'");
    expect(controlCenterSource).toContain('isEnvironmentLaunchFailure');
    expect(controlCenterSource).toContain("'Environment needs repair'");
    expect(controlCenterSource).toContain('This is not a sandbox approval issue.');
  });

  it('uses supported Codex approval values and prepares isolated worktree dependencies', () => {
    expect(mainSource).toContain("return ['--ask-for-approval', 'on-request'];");
    expect(mainSource).not.toContain("policy === 'restricted' ? 'untrusted'");
    expect(mainSource).toContain('const setup = quickSetupEnvironment(target, true);');
    expect(mainSource).toContain('Worktree environment setup failed.');
    expect(mainSource).toContain("['install', '--frozen-lockfile']");
    expect(mainSource).toContain('shell: isBatchShim');
    expect(controlCenterSource).toContain('Worktree environment setup failed');
  });

  it('preflights the independent reviewer and preserves actionable process diagnostics', () => {
    expect(controlCenterSource).toContain('const reviewerPreflight = await window.desktopApi.agent.preflight');
    expect(controlCenterSource).toContain('reviewer cannot start:');
    expect(controlCenterSource).toContain('Reviewer process ended with exit code');
    expect(controlCenterSource).toContain('/\\b(error|enoent|invalid|not found|failed)\\b/i');
  });
});
