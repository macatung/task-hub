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
    expect(runWorkspaceSource).toContain('Auto-review reached its limit');
    expect(controlCenterSource).not.toContain('reviewerProvider.value !== provider.value');
    expect(controlCenterSource).toContain('separate independent reviewer session');
    expect(runWorkspaceSource).toContain('it never bypasses dependencies');
  });

  it('automatically completes a passed review and exposes human choices only at the limit', () => {
    expect(controlCenterSource).toContain('complete_auto_approved_handoff');
    expect(controlCenterSource).toContain('approveAfterManualReview');
    expect(controlCenterSource).toContain('increaseTaskReviewLimit');
    expect(runWorkspaceSource).toContain('Approve &amp; mark Done');
    expect(runWorkspaceSource).toContain('Request changes');
  });

  it('does not turn an approved review note into an Epic handoff blocker', () => {
    expect(controlCenterSource).toContain('payload.summary = [');
    expect(controlCenterSource).not.toContain('payload.blockers = [\n        payload.blockers,');
  });

  it('offers recovery of a live CAO session instead of sending a false failure to human approval', () => {
    expect(controlCenterSource).toContain('const reconnectCaoSession = async');
    expect(controlCenterSource).toContain('reconnectableCaoSession');
    expect(runWorkspaceSource).toContain('Reconnect CAO session');
    expect(runWorkspaceSource).toContain("@click=\"$emit('reconnectCao')\"");
    expect(controlCenterSource).toContain("phase.value = 'CAO session failed'");
    expect(controlCenterSource).toContain('sandbox approval cannot repair this failure');
    expect(controlCenterSource).toContain('const isCaoRuntimeFailure');
    expect(controlCenterSource).toContain("phase.value = 'CAO runtime needs repair'");
  });
});
