import { describe, expect, it } from 'vitest';
import controlCenter from './ControlCenter.vue?raw';
import settingsPanel from '../components/control-center/SettingsPanel.vue?raw';
import runWorkspace from '../components/control-center/RunWorkspace.vue?raw';

describe('Control Center settings and approval escalation', () => {
  it('opens an in-app settings panel instead of redirecting the Settings action to Hub', () => {
    expect(controlCenter).toContain("import SettingsPanel from '../components/control-center/SettingsPanel.vue'");
    expect(controlCenter).toContain('@settings="settingsOpen = true"');
    expect(controlCenter).toContain('<SettingsPanel');
    expect(settingsPanel).toContain('Settings & approvals');
    expect(settingsPanel).toContain('Local 9Router');
    expect(settingsPanel).toContain('Save configuration');
    expect(settingsPanel).toContain('Auto-submit completed handoffs');
    expect(settingsPanel).toContain('Continue Epic after each handoff');
    expect(controlCenter).toContain('task-hub-auto-submit-handoff');
    expect(controlCenter).toContain('task-hub-auto-continue-epic');
  });

  it('creates a diagnostic-backed human approval request and retries only with an approved policy', () => {
    expect(runWorkspace).toContain('Request human approval');
    expect(runWorkspace).toContain('Approve workspace-write retry');
    expect(runWorkspace).toContain('Approve full-access retry');
    expect(controlCenter).toContain('window.confirm(');
    expect(controlCenter).toContain('codexDiagnostics()');
    expect(controlCenter).toContain('approvalRequest.value');
    expect(controlCenter).toContain('alreadyFullAccess');
    expect(controlCenter).toContain('human review required before retrying');
    expect(controlCenter).toContain('await startLocal(pending.prompt, pending.kind, policy, pending.intent, true)');
    expect(controlCenter).toContain("phase.value = 'Sandbox blocked — approval required'");
    expect(controlCenter).toContain("runStatus.value === 'completed' && isSandboxFailure(output.value.slice(runOutputStart.value))");
    expect(settingsPanel).toContain('Workspace write');
    expect(settingsPanel).toContain('Codex diagnostics');
    expect(settingsPanel).toContain('Check for updates');
    expect(controlCenter).toContain('checkAppUpdate');
    expect(controlCenter).toContain('autoHandoffPayload');
    expect(controlCenter).toContain('runOutputStart');
    expect(controlCenter).toContain('autoHandoffSubmitting');
    expect(controlCenter).toContain('tryAutoSubmitHandoff');
    expect(controlCenter).toContain('watch([autoSubmitHandoff, runStatus]');
    expect(controlCenter).toContain('const reopenEpicAsTodo');
    expect(controlCenter).toContain("sync.updateTaskStatus(epic, 'todo')");
    expect(controlCenter).toContain('@reopen-todo="reopenEpicAsTodo"');
  });
});
