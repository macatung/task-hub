import { describe, it, expect } from 'vitest';
import controlCenterSource from './ControlCenter.vue?raw';
import workflowPanelSource from '../components/control-center/WorkflowPanel.vue?raw';

describe('Living Functional Specification (FSD) AI Workflow - Desktop Control Center', () => {
  describe('1. Continuous AI Documentation Prompting', () => {
    it('instructs local AI agent to maintain FUNCTIONAL_SPECIFICATION with FR/NFR structure and Mermaid diagrams', () => {
      expect(controlCenterSource).toContain('docs/FUNCTIONAL_SPECIFICATION.md (structured with explicit Functional vs Non-Functional requirements, per-function specifications, and embedded Mermaid diagrams)');
    });
  });

  describe('2. AI Requirement Discovery Living Spec Evolution', () => {
    it('guides AI to inspect existing repository context and generate structured backlog proposals', () => {
      expect(controlCenterSource).toContain('You are Task Hub\'s Requirement Discovery agent.');
      expect(controlCenterSource).toContain('Inspect the repository and its docs.');
      expect(controlCenterSource).toContain('Return a concise Vietnamese plan with one Epic, Stories and implementation Tasks');
    });

    it('enables seamless review, editing, and 1-click sync to Hub', () => {
      expect(workflowPanelSource).toContain('Approve & create backlog');
      expect(workflowPanelSource).toContain('Edit draft');
      expect(workflowPanelSource).toContain('Request revision');
      expect(controlCenterSource).toContain('mcp(\'create_requirement_backlog\'');
    });
  });
});
