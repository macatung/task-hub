import { describe, expect, it } from 'vitest';
import panelSource from './CaoWorkflowRunPanel.vue?raw';
import runWorkspaceSource from './RunWorkspace.vue?raw';
import controlCenterSource from '../../views/ControlCenter.vue?raw';

describe('Strict CAO workflow UI', () => {
  it('has a dedicated panel with recovery controls and dynamic step state', () => {
    expect(panelSource).toContain('STRICT WORKFLOW');
    expect(panelSource).toContain('Resume');
    expect(panelSource).toContain('Retry from step');
    expect(panelSource).toContain('Cancel');
    expect(panelSource).toContain('Current step / total');
    expect(panelSource).toContain('status?.error');
  });

  it('passes dynamic workflow steps to FlowStepper and does not show legacy cards as CAO stages', () => {
    expect(runWorkspaceSource).toContain(':steps="orchestrationMode === \'workflow\' ? workflowSteps : undefined"');
    expect(runWorkspaceSource).toContain('Strict CAO Workflow đang được theo dõi');
    expect(controlCenterSource).toContain('<CaoWorkflowRunPanel');
    expect(controlCenterSource).toContain('onWorkflowEvent');
    expect(controlCenterSource).toContain("finishOperation('workflow-run', 'error'");
    expect(controlCenterSource).toContain("state: 'failed'");
  });
});
