import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';
import workflowPanelSource from '../components/control-center/WorkflowPanel.vue?raw';

describe('Project Documentation Lifecycle & Freshness Workflow - Desktop', () => {
  describe('1. Documentation Scanning & AI Generation', () => {
    it('provides repo documentation scanning in isolated worktree', () => {
      expect(workflowPanelSource).toContain('Scan & generate docs');
      expect(workflowPanelSource).toContain("emit('runDocs'");
      expect(controlCenterSource).toContain("openTool('docs')");
      expect(controlCenterSource).toContain("const runDocs = async (projectId: number)");
      expect(controlCenterSource).toContain("startOperation('docs-scan', 'Đang quét tài liệu'");
    });

    it('generates the 7 standard document artifacts including FUNCTIONAL_SPECIFICATION', () => {
      // ControlCenter contains prompt requesting the 7 standard docs
      expect(controlCenterSource).toContain('docs/PROJECT_DOCUMENTS.md');
      expect(controlCenterSource).toContain('docs/PROJECT_BRIEF.md');
      expect(controlCenterSource).toContain('docs/PRD.md');
      expect(controlCenterSource).toContain('docs/FUNCTIONAL_SPECIFICATION.md');
      expect(controlCenterSource).toContain('docs/ARCHITECTURE.md');
      expect(controlCenterSource).toContain('docs/QA_PLAN.md');
      expect(controlCenterSource).toContain('docs/RELEASE_RUNBOOK.md');
    });
  });

  describe('2. Human Review & Selective Application', () => {
    it('allows previewing, saving to repository disk, and syncing to Hub', () => {
      expect(workflowPanelSource).toContain('Documentation ready for review');
      expect(workflowPanelSource).toContain('Save to repository');
      expect(workflowPanelSource).toContain('Sync docs to Hub');
      expect(workflowPanelSource).toContain("emit('saveDocs'");
      expect(workflowPanelSource).toContain("emit('syncDocs'");

      // ControlCenter handlers
      expect(controlCenterSource).toContain('applyDocsToWorkspace');
      expect(controlCenterSource).toContain('readGeneratedDocuments');
      expect(controlCenterSource).toContain('importGeneratedDocuments');
    });
  });

  describe('3. Synchronization with Task Hub Knowledge Base', () => {
    it('transmits manifest and document contents to Hub via importGeneratedDocuments', () => {
      expect(controlCenterSource).toContain('window.desktopApi.taskHub.importGeneratedDocuments');
      expect(controlCenterSource).toContain("finishOperation('sync-docs', 'success'");
    });
  });
});
