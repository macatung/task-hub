import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';
import runWorkspaceSource from '../components/control-center/RunWorkspace.vue?raw';
import workflowPanelSource from '../components/control-center/WorkflowPanel.vue?raw';
import { useActionFeedback } from '../composables/useActionFeedback';

describe('User-In-The-Loop (HITL) Complete Workflow Audit - Desktop', () => {
  describe('1. Live Interactive Follow-up Loop', () => {
    it('allows live user input during agent execution and preserves history turns', () => {
      // RunWorkspace has follow-up input and send emission
      expect(runWorkspaceSource).toContain('v-model="followUp"');
      expect(runWorkspaceSource).toContain("$emit('send', followUp)");
      expect(runWorkspaceSource).toContain('@keyup.enter');
      
      // ControlCenter handles send and notifies user
      expect(controlCenterSource).toContain('const send = (message: string) => {');
      expect(controlCenterSource).toContain('window.desktopApi.agent.send(sessionId.value, message.trim())');
      expect(controlCenterSource).toContain("notify({ type: 'info', title: 'Đã gửi tin nhắn đến Agent'");
    });
  });

  describe('2. Human Approval & Security Escalation Loop', () => {
    it('intercepts sandbox failures and requires explicit human approval before retry', () => {
      // Detection of sandbox failure
      expect(controlCenterSource).toContain('isSandboxFailure');
      expect(controlCenterSource).toContain("phase.value = 'Sandbox blocked — approval required'");
      expect(controlCenterSource).toContain('requestHumanApproval');

      // Diagnostics are triggered
      expect(controlCenterSource).toContain('runDiagnostics');
      expect(controlCenterSource).toContain('codexDiagnostics()');

      // Approval options: workspace_write, full_access, decline
      expect(controlCenterSource).toContain("const approveRetry = async (policy: 'workspace_write' | 'full_access')");
      expect(controlCenterSource).toContain('window.confirm(warning)');
      expect(controlCenterSource).toContain("const dismissApproval = () => {");
      expect(controlCenterSource).toContain("phase.value = 'Approval declined — run remains stopped'");

      // UI presents approval actions in RunWorkspace
      expect(runWorkspaceSource).toContain("v-if=\"approvalRequest\"");
      expect(runWorkspaceSource).toContain("approveRetry', 'workspace_write'");
      expect(runWorkspaceSource).toContain("approveRetry', 'full_access'");
      expect(runWorkspaceSource).toContain("dismissApproval'");
    });

    it('retains human review flow even after repeated full_access failures', () => {
      expect(controlCenterSource).toContain("alreadyFullAccess");
      expect(controlCenterSource).toContain("Full-access run failed — human review required before retrying");
      expect(controlCenterSource).toContain("preserveOutput");
    });
  });

  describe('3. Requirement Discovery Proposal Review & Approval Loop', () => {
    it('guarantees AI proposals remain strictly local until human reviews, edits, or approves', () => {
      // 3-step wizard (Brief -> Run -> Review)
      expect(workflowPanelSource).toContain('AI workflow');
      expect(workflowPanelSource).toContain('Brief');
      expect(workflowPanelSource).toContain('Review');

      // Proposal stays local until explicit approval
      expect(workflowPanelSource).toContain('Nothing is synced yet. Review, edit or request changes');
      expect(workflowPanelSource).toContain('Edit draft');
      expect(workflowPanelSource).toContain('Save draft');
      expect(workflowPanelSource).toContain('Request changes from AI');
      expect(workflowPanelSource).toContain('Request revision');
      expect(workflowPanelSource).toContain('Approve & create backlog');

      // ControlCenter executes validated creation only upon confirmation
      expect(controlCenterSource).toContain('parseDiscoveryPlan');
      expect(controlCenterSource).toContain('window.confirm(`Approve and sync this proposal to Hub?');
      expect(controlCenterSource).toContain("mcp('create_requirement_backlog'");
    });
  });

  describe('4. Repository Documentation Review & Selective Sync Loop', () => {
    it('generates documentation in an isolated worktree and awaits user decision to save or sync', () => {
      expect(workflowPanelSource).toContain('Documentation ready for review');
      expect(workflowPanelSource).toContain('Save to repository');
      expect(workflowPanelSource).toContain('Sync docs to Hub');

      // Handlers in ControlCenter
      expect(controlCenterSource).toContain('applyDocsToWorkspace');
      expect(controlCenterSource).toContain('importGeneratedDocuments');
    });
  });

  describe('5. Structured Handoff & Human Review Flow', () => {
    it('provides structured handoff form and manual or verified auto-submission', () => {
      // Form fields for handoff in RunWorkspace
      expect(runWorkspaceSource).toContain('Review & submit handoff');
      expect(runWorkspaceSource).toContain('v-model="summary"');
      expect(runWorkspaceSource).toContain('v-model="changedFiles"');
      expect(runWorkspaceSource).toContain('v-model="tests"');
      expect(runWorkspaceSource).toContain('v-model="commitSha"');
      expect(runWorkspaceSource).toContain('v-model="pullRequestUrl"');

      // Auto handoff detection & execution
      expect(controlCenterSource).toContain('autoHandoffPayload');
      expect(controlCenterSource).toContain('tryAutoSubmitHandoff');
      expect(controlCenterSource).toContain("complete_agent_handoff'");
      expect(controlCenterSource).toContain("phase.value = 'Submitted for Hub review'");
    });
  });

  describe('6. User Cancellation & Stop Control', () => {
    it('allows immediate user stop with process teardown and state cleanup', () => {
      expect(runWorkspaceSource).toContain("$emit('cancel')");
      expect(controlCenterSource).toContain("const cancel = async () => {");
      expect(controlCenterSource).toContain("window.desktopApi.agent.stop(sessionId.value)");
      expect(controlCenterSource).toContain("updateRun('cancelled', 'Stopped by user.')");
    });
  });

  describe('7. Actor Attribution in Action Feedback & Timeline', () => {
    it('records user interactions with correct actor attribution in timeline', () => {
      const { notify, activityTimeline, clearTimeline } = useActionFeedback();
      clearTimeline();

      notify({
        type: 'success',
        title: 'Phê duyệt nghiệm thu',
        message: 'Chấp thuận bàn giao task',
        sound: false,
      });

      expect(activityTimeline.value.length).toBe(1);
      expect(activityTimeline.value[0].actor?.type).toBe('user');
      expect(activityTimeline.value[0].actor?.role).toBe('Local Operator');
      expect(activityTimeline.value[0].label).toBe('Phê duyệt nghiệm thu');
    });
  });
});
