import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../desktop');
const mainSource = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'src/components/AgentConsoleModal.vue'), 'utf8');

describe('Desktop agent execution workspace', () => {
  it('uses a PTY-backed adapter for interactive coding CLIs', () => {
    expect(mainSource).toContain("from 'node-pty'");
    expect(mainSource).toContain("ipcMain.handle('agent-start-interactive'");
    expect(mainSource).toContain("codex: { command: 'codex'");
    expect(mainSource).toContain("claude_code: { command: 'claude'");
  });

  it('exposes preflight and isolated worktree IPC actions', () => {
    for (const action of ['agent-preflight', 'agent-create-worktree', 'agent-open-workspace', 'agent-cleanup-worktree']) expect(mainSource).toContain(action);
    expect(mainSource).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(mainSource).toContain('--dangerously-skip-permissions');
    expect(mainSource).toContain('disableAgentGuardrails');
    expect(mainSource).not.toContain('Task Companion: push requires human approval');
  });

  it('requires a structured handoff after execution', () => {
    expect(uiSource.toLowerCase()).toContain('structured');
    expect(uiSource.toLowerCase()).toContain('handoff');
    expect(uiSource).toContain('complete_agent_handoff');
    expect(uiSource).toContain('submitHandoff');
  });

  it('keeps the agent stream readable and restores initial output', () => {
    expect(uiSource).toContain('syncSessionOutput');
    expect(uiSource).toContain('ansiToHtml');
    expect(uiSource).toContain('terminalContainer');
    expect(mainSource).toContain('cleanAgentLog');
    expect(mainSource).toContain('agent-output');
  });

  it('persists session history and supports multi-turn resume across restarts', () => {
    expect(mainSource).toContain('agent-save-session-state');
    expect(mainSource).toContain('agent-list-saved-sessions');
    expect(mainSource).toContain('agent-delete-session');
    expect(mainSource).toContain('persistSessionUpdate');
    expect(uiSource).toContain('openSessionHistory');
    expect(uiSource).toContain('switchSession');
    expect(uiSource).toContain('savedSessions');
    expect(mainSource).toContain('--conversation');
  });
});
