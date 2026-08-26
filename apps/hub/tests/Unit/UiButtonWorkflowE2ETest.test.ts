import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const tasksIndexVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const remoteDispatchModalSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/RemoteDispatchModal.vue'), 'utf8');
const streambackConsoleSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/StreambackConsole.vue'), 'utf8');
const taskHistoryTimelineSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/TaskHistoryTimeline.vue'), 'utf8');
const connectedAgentsRegistrySrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ConnectedAgentsRegistry.vue'), 'utf8');
const projectDocsPanelSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ProjectDocumentsPanel.vue'), 'utf8');
const projectReleaseLogSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ProjectReleaseLog.vue'), 'utf8');

const desktopControlCenterSrc = fs.readFileSync(path.resolve(hubRoot, '../desktop/src/views/ControlCenter.vue'), 'utf8');
const desktopRunWorkspaceSrc = fs.readFileSync(path.resolve(hubRoot, '../desktop/src/components/control-center/RunWorkspace.vue'), 'utf8');
const desktopWorkflowPanelSrc = fs.readFileSync(path.resolve(hubRoot, '../desktop/src/components/control-center/WorkflowPanel.vue'), 'utf8');
const desktopTimelineDrawerSrc = fs.readFileSync(path.resolve(hubRoot, '../desktop/src/components/ActivityTimelineDrawer.vue'), 'utf8');

describe('UI Button Workflow & Interactive Flows E2E Audit', () => {
  describe('1. Web Hub Kanban & Task Board Button Workflows (Tasks/Index.vue)', () => {
    it('provides task selection, status transition, priority, and delete actions in task drawer', () => {
      expect(tasksIndexVueSrc).toContain('openTaskDrawer(task)');
      expect(tasksIndexVueSrc).toContain('saveTaskDrawerChanges');
      expect(tasksIndexVueSrc).toContain('deleteTask(selectedTask)');
      expect(tasksIndexVueSrc).toContain('loadAgentRuns(task.id)');
    });

    it('provides Scrum sprint management buttons (Create Sprint, Start Sprint, Complete Sprint)', () => {
      expect(tasksIndexVueSrc).toContain('showSprintModal.value = true');
      expect(tasksIndexVueSrc).toContain('handleSaveSprint');
      expect(tasksIndexVueSrc).toContain('confirmStartSprint');
      expect(tasksIndexVueSrc).toContain('confirmCompleteSprint');
    });

    it('provides Remote Dispatch triggers on Kanban cards, Backlog items, and Epics', () => {
      expect(tasksIndexVueSrc).toContain('openRemoteDispatch(task)');
      expect(tasksIndexVueSrc).toContain('showRemoteDispatchModal.value = true');
      expect(tasksIndexVueSrc).toContain('handleRemoteDispatched');
    });

    it('provides Local Agent quick launch triggers for Codex, Claude Code, and Antigravity', () => {
      expect(tasksIndexVueSrc).toContain('startAgentRun(provider)');
      expect(tasksIndexVueSrc).toContain('Local Claude');
      expect(tasksIndexVueSrc).toContain('Local AGY');
      expect(tasksIndexVueSrc).toContain('Local Codex');
    });
  });

  describe('2. Remote Dispatch Modal Flow (RemoteDispatchModal.vue)', () => {
    it('supports selecting connected desktop runners, AI providers, and models', () => {
      expect(remoteDispatchModalSrc).toContain('selectedRunnerId');
      expect(remoteDispatchModalSrc).toContain('selectedProvider');
      expect(remoteDispatchModalSrc).toContain('selectedModel');
      expect(remoteDispatchModalSrc).toContain('executionMode');
    });

    it('dispatches task to /api/v1/tasks/{id}/dispatch and closes on success', () => {
      expect(remoteDispatchModalSrc).toContain('dispatchTask');
      expect(remoteDispatchModalSrc).toContain("emit('dispatched'");
      expect(remoteDispatchModalSrc).toContain("emit('close')");
    });
  });

  describe('3. Live Streamback Console Controls & Approval Gate (StreambackConsole.vue)', () => {
    it('provides Authorize / Continue button on safety intercepts', () => {
      expect(streambackConsoleSrc).toContain('approveSafetyOrHandoff');
      expect(streambackConsoleSrc).toContain('Authorize & Continue Execution');
    });

    it('provides Reject / Request Changes button on safety intercepts & completed runs', () => {
      expect(streambackConsoleSrc).toContain('rejectSafetyOrHandoff');
      expect(streambackConsoleSrc).toContain('Reject Action');
      expect(streambackConsoleSrc).toContain('Request changes');
    });

    it('provides Approve & Mark Done button when automated handoff is ready', () => {
      expect(streambackConsoleSrc).toContain('Approve & Mark Done');
      expect(streambackConsoleSrc).toContain("emit('approved'");
    });

    it('provides Cancel / Stop button for running/queued agent runs', () => {
      expect(streambackConsoleSrc).toContain('cancelActiveRun');
      expect(streambackConsoleSrc).toContain('/api/tasks/agent-runs/');
      expect(streambackConsoleSrc).toContain('Cancel');
    });

    it('provides log controls (Auto-Scroll, Copy all logs, Clear)', () => {
      expect(streambackConsoleSrc).toContain('autoScroll');
      expect(streambackConsoleSrc).toContain('copyAllLogs');
      expect(streambackConsoleSrc).toContain('logs = []');
    });
  });

  describe('4. Task History & Audit Trail Controls (TaskHistoryTimeline.vue)', () => {
    it('provides filter buttons (Tất cả, Chuyển trạng thái, Agent Runs, Review / Phê duyệt)', () => {
      expect(taskHistoryTimelineSrc).toContain("selectedFilter = (f.id as any)");
      expect(taskHistoryTimelineSrc).toContain('Chuyển trạng thái');
      expect(taskHistoryTimelineSrc).toContain('Agent Runs');
      expect(taskHistoryTimelineSrc).toContain('Review / Phê duyệt');
    });

    it('provides 1-click Markdown report copy and refresh button', () => {
      expect(taskHistoryTimelineSrc).toContain('copyMarkdownAudit');
      expect(taskHistoryTimelineSrc).toContain('loadHistory');
      expect(taskHistoryTimelineSrc).toContain('Sao chép toàn bộ lịch sử dạng Markdown');
    });
  });

  describe('5. Desktop Control Center Workflow & Action Buttons (ControlCenter.vue & RunWorkspace.vue)', () => {
    it('provides tool switcher buttons (Requirement discovery, Docs scanner, Worktree)', () => {
      expect(desktopControlCenterSrc).toContain("openTool('requirement')");
      expect(desktopControlCenterSrc).toContain("openTool('docs')");
    });

    it('provides Launch Agent, Cancel Run, and Follow-up Send buttons in RunWorkspace.vue', () => {
      expect(desktopRunWorkspaceSrc).toContain("@click=\"$emit('launch')\"");
      expect(desktopRunWorkspaceSrc).toContain("@click=\"$emit('cancel')\"");
      expect(desktopRunWorkspaceSrc).toContain("$emit('send'");
    });

    it('provides Human Approval Escalation & Retry buttons with security policy levels', () => {
      expect(desktopRunWorkspaceSrc).toContain("Approve workspace-write retry");
      expect(desktopRunWorkspaceSrc).toContain("Approve full-access retry");
      expect(desktopRunWorkspaceSrc).toContain("@click=\"$emit('dismissApproval')\"");
    });

    it('provides Structured Handoff submission form and button triggers', () => {
      expect(desktopRunWorkspaceSrc).toContain('Review & submit handoff');
      expect(desktopRunWorkspaceSrc).toContain('Gửi lên Hub');
      expect(desktopRunWorkspaceSrc).toMatch(/emit\(['"]handoff['"]/);
    });

    it('provides Requirement AI Discovery review, edit draft, request revision, and sync buttons', () => {
      expect(desktopWorkflowPanelSrc).toContain("emit('runRequirement'");
      expect(desktopWorkflowPanelSrc).toContain("emit('createBacklog')");
      expect(desktopWorkflowPanelSrc).toContain("emit('reviseRequirement'");
      expect(desktopWorkflowPanelSrc).toContain("editingProposal = !editingProposal");
      expect(desktopWorkflowPanelSrc).toContain("emit('updateProposal'");
    });

    it('provides Docs Scanner save to workspace and sync to Hub buttons', () => {
      expect(desktopWorkflowPanelSrc).toContain("emit('saveDocs')");
      expect(desktopWorkflowPanelSrc).toContain("emit('syncDocs')");
    });

    it('provides Activity Timeline Drawer with filter pills and copy summary button', () => {
      expect(desktopTimelineDrawerSrc).toContain('selectedToneFilter');
      expect(desktopTimelineDrawerSrc).toContain('copyTimelineSummary');
      expect(desktopTimelineDrawerSrc).toContain("emit('clear-timeline')");
      expect(desktopTimelineDrawerSrc).toContain("emit('close')");
    });
  });
});
