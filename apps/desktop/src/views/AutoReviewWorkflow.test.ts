import { describe, expect, it } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';
import settingsSource from '../components/control-center/SettingsPanel.vue?raw';
import runWorkspaceSource from '../components/control-center/RunWorkspace.vue?raw';

describe('automatic independent review workflow', () => {
  it('exposes a local reviewer setting with a bounded iteration limit', () => {
    expect(settingsSource).toContain('Automatic independent review loop');
    expect(settingsSource).toContain('Reviewer session provider');
    expect(settingsSource).toContain('Max review rounds');
    expect(controlCenterSource).toContain('task-hub-auto-review-enabled');
    expect(controlCenterSource).toContain('autoReviewMaxIterations');
  });

  it('starts a second auditable reviewer run and feeds structured feedback back to implementation', () => {
    expect(controlCenterSource).toContain("run_type: 'review'");
    expect(controlCenterSource).toContain('<TASK_HUB_REVIEW>');
    expect(controlCenterSource).toContain("const launchProvider = role === 'reviewer' ? reviewerProvider.value : provider.value");
    expect(controlCenterSource).toContain('implementationIntent');
    expect(controlCenterSource).toContain('continueAfterReview');
    expect(controlCenterSource).toContain('Applying independent review feedback');
    expect(controlCenterSource).toContain('Automatic review loop cancelled by user.');
    expect(controlCenterSource).toContain('complete_agent_handoff');
    expect(runWorkspaceSource).toContain('Independent review');
    expect(controlCenterSource).not.toContain('reviewerProvider.value !== provider.value');
    expect(controlCenterSource).toContain('separate independent reviewer session');
    expect(runWorkspaceSource).toContain('it never bypasses dependencies');
  });

  it('keeps final Hub approval human-controlled', () => {
    expect(controlCenterSource).toContain('Human Hub approval is still required.');
    expect(runWorkspaceSource).toContain('Review & submit handoff');
  });
});
