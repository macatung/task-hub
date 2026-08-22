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

  it('supports model selection for Codex, Claude Code, and Antigravity', () => {
    // UI state and presets
    expect(uiSource).toContain('PROVIDER_MODELS');
    expect(uiSource).toContain('selectedModels');
    expect(uiSource).toContain('activeModel');
    expect(uiSource).toContain('selectModel');
    expect(uiSource).toContain('customModelInput');
    expect(uiSource).toContain('isCustomModel');
    expect(uiSource).toContain('filteredProviderModels');
    expect(uiSource).toContain('gpt-5.6-sol');
    expect(uiSource).toContain('gpt-5.6-terra');
    expect(uiSource).toContain('o3-pro');
    expect(uiSource).toContain('gpt-4.1');
    expect(uiSource).toContain('claude-3-7-sonnet-20250219');
    expect(uiSource).toContain('gemini-3.7-flash');
    expect(uiSource).toContain('claude-sonnet-4.6-thinking');
    expect(uiSource).toContain('gemini-2.5-pro');

    // Desktop main process CLI execution with model flags
    expect(mainSource).toContain("'-m', selectedModel");
    expect(mainSource).toContain("'--model', selectedModel");
    expect(mainSource).toContain('model?: string');
  });

  it('supports automatic model discovery, sync from Hub/CLI, and custom model persistence', () => {
    // Main process discovery and persistence
    expect(mainSource).toContain('agent-list-available-models');
    expect(mainSource).toContain('agent-save-custom-model');
    expect(mainSource).toContain('agent-delete-custom-model');
    expect(mainSource).toContain('getAvailableModels');
    expect(mainSource).toContain('inferModelBadges');
    expect(mainSource).toContain('models-cache.json');
    expect(mainSource).toContain('models-custom.json');

    // UI dynamic state and triggers
    expect(uiSource).toContain('modelsState');
    expect(uiSource).toContain('syncAvailableModels');
    expect(uiSource).toContain('saveCustomModelOption');
    expect(uiSource).toContain('deleteCustomModelOption');
    expect(uiSource).toContain('isSyncingModels');
  });

  it('supports Models & Usage Quota Bridge, rolling limit calculation, and UI modal', () => {
    // Main process Quota storage and IPC
    expect(mainSource).toContain('agent-get-quota-usage');
    expect(mainSource).toContain('agent-sync-quota-usage');
    expect(mainSource).toContain('agent-update-quota-settings');
    expect(mainSource).toContain('readQuotaState');
    expect(mainSource).toContain('quota-usage.json');
    expect(mainSource).toContain('recordTokenUsageToQuota');

    // UI state & Modal matching screenshot
    expect(uiSource).toContain('Models & Usage');
    expect(uiSource).toContain('quotaUsageState');
    expect(uiSource).toContain('Weekly Limit Remaining');
    expect(uiSource).toContain('Five Hour Limit Remaining');
    expect(uiSource).toContain('Enable AI Credit Overages');
    expect(uiSource).toContain('Your Plan:');
  });

  it('supports VS Code Core shell architecture, Monaco Editor & Diff engine, and Activity Bar', () => {
    // Main process workspace and diff IPCs
    expect(mainSource).toContain('workspace-read-file');
    expect(mainSource).toContain('workspace-list-files');
    expect(mainSource).toContain('workspace-get-git-diff');

    // UI VS Code Core Components & Status Bar
    expect(uiSource).toContain('MonacoEditorView');
    expect(uiSource).toContain('activeActivity');
    expect(uiSource).toContain('activeEditorTab');
    expect(uiSource).toContain('EXPLORER');
    expect(uiSource).toContain('SOURCE CONTROL');
    expect(uiSource).toContain('VS Code Core');
    expect(uiSource).toContain('#007acc');
  });

  it('supports post-change diff inspector, line addition/deletion statistics, file reverting, and auto-handoff sync', () => {
    // Main process diff stats & revert IPCs
    expect(mainSource).toContain('workspace-revert-file');
    expect(mainSource).toContain('workspace-stage-file');
    expect(mainSource).toContain('numstat');
    expect(mainSource).toContain('totalAdditions');
    expect(mainSource).toContain('totalDeletions');

    // UI Post-change Diff Banner, Inspector & Revert Button
    expect(uiSource).toContain('totalAdditions');
    expect(uiSource).toContain('totalDeletions');
    expect(uiSource).toContain('revertDiffFile');
    expect(uiSource).toContain('populateHandoffFromDiff');
    expect(uiSource).toContain('Diff sau thay đổi');
    expect(uiSource).toContain('Xem Diff ngay');
  });

  it('implements authentic Antigravity 2.0 Studio layout, auxiliary pane, slash commands, skills & scheduling', () => {
    // Backend Skills, MCP, Scheduling, Permissions IPCs
    expect(mainSource).toContain('agent-list-skills');
    expect(mainSource).toContain('agent-read-skill');
    expect(mainSource).toContain('agent-list-mcp-servers');
    expect(mainSource).toContain('agent-list-rules');
    expect(mainSource).toContain('agent-list-scheduled-tasks');
    expect(mainSource).toContain('agent-create-schedule');
    expect(mainSource).toContain('agent-get-permissions');
    expect(mainSource).toContain('agent-save-permissions');

    // UI Antigravity 2.0 Navigation, Auxiliary Tabs & Modals
    expect(uiSource).toContain('startNewConversation');
    expect(uiSource).toContain('AntigravitySkillsModal');
    expect(uiSource).toContain('AntigravityScheduledTasksModal');
    expect(uiSource).toContain('AntigravitySettingsPermissionsModal');
    expect(uiSource).toContain('activeSubagents');
    expect(uiSource).toContain('slashCommands');
    expect(uiSource).toContain('/goal');
    expect(uiSource).toContain('/schedule');
    expect(uiSource).toContain('/grill-me');
    expect(uiSource).toContain('/teamwork-preview');
    expect(uiSource).toContain('/learn');
  });
});
