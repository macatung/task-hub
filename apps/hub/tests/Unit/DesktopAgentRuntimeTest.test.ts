import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mainSource = fs.readFileSync(path.join(root, 'desktop/electron/main.ts'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'desktop/src/components/AgentConsoleModal.vue'), 'utf8');

describe('Desktop agent execution workspace', () => {
  it('uses a PTY-backed adapter for interactive coding CLIs', () => {
    expect(mainSource).toContain("from 'node-pty'");
    expect(mainSource).toContain("ipcMain.handle('agent-start-interactive'");
    expect(mainSource).toContain("codex: { command: 'codex'");
    expect(mainSource).toContain("claude_code: { command: 'claude'");
  });

  it('exposes preflight and isolated worktree IPC actions', () => {
    for (const action of ['agent-preflight', 'agent-create-worktree', 'agent-open-workspace', 'agent-cleanup-worktree']) expect(mainSource).toContain(action);
    expect(mainSource).toContain('Task Companion: push requires human approval');
  });

  it('requires a structured handoff after execution', () => {
    expect(uiSource).toContain('Structured handoff');
    expect(uiSource).toContain('complete_agent_handoff');
    expect(uiSource).toContain('Submit for review');
  });
});
