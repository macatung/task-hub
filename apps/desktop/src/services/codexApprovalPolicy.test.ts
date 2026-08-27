import { describe, expect, it } from 'vitest';
import main from '../../electron/main.ts?raw';
import preload from '../../electron/preload.ts?raw';

describe('Codex approval policy bridge', () => {
  it('uses explicit least-privilege sandbox flags before a human escalation', () => {
    expect(main).toContain("return ['--sandbox', 'workspace-write']");
    expect(main).toContain("return ['--sandbox', 'read-only']");
    // Codex CLI no longer accepts `untrusted`; sandbox selection above keeps
    // restricted runs read-only while approval uses a supported CLI value.
    expect(main).toContain("return ['--ask-for-approval', 'on-request'];");
    expect(main).toContain("return ['--dangerously-bypass-approvals-and-sandbox']");
  });

  it('exposes a local diagnostic IPC and keeps full access an explicit policy', () => {
    expect(main).toContain("ipcMain.handle('agent-codex-diagnostics'");
    expect(main).toContain('async function codexDiagnostics()');
    expect(preload).toContain("codexDiagnostics: () => ipcRenderer.invoke('agent-codex-diagnostics')");
    expect(preload).toContain("'restricted' | 'workspace_write' | 'full_access'");
  });
});
