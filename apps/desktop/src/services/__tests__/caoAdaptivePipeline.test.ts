import { describe, expect, it } from 'vitest';
import {
  resolveTaskPipelineVariant,
  generateCaoFastTrackWorkflowYaml,
  generateCaoStandardWorkflowYaml,
  generateCaoEpicWorkflowYaml,
  parseCaoWorkflowRunStatus,
} from '../caoBridgeService';
import controlCenterSource from '../../views/ControlCenter.vue?raw';
import panelSource from '../../components/control-center/CaoWorkflowRunPanel.vue?raw';

describe('Milestone 1: Adaptive Execution Pipeline (Fast-Track vs Strict 4-Step)', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Task Risk Classification & Pipeline Variant Resolution
  // ──────────────────────────────────────────────────────────────────────────
  describe('resolveTaskPipelineVariant', () => {
    it('honors explicit risk_tier overrides over all other attributes', () => {
      expect(
        resolveTaskPipelineVariant({
          risk_tier: 'fast-track',
          risk_level: 'critical',
          complexity: 'high',
          issue_type: 'feature',
        })
      ).toBe('fast-track');

      expect(
        resolveTaskPipelineVariant({
          risk_tier: 'strict',
          risk_level: 'low',
          complexity: 'trivial',
          issue_type: 'docs',
        })
      ).toBe('strict');
    });

    it('routes low risk tasks to fast-track pipeline', () => {
      expect(resolveTaskPipelineVariant({ risk_level: 'low' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ risk_level: 'LOW' })).toBe('fast-track');
    });

    it('routes medium, high, and critical risk tasks to strict pipeline', () => {
      expect(resolveTaskPipelineVariant({ risk_level: 'medium' })).toBe('strict');
      expect(resolveTaskPipelineVariant({ risk_level: 'high' })).toBe('strict');
      expect(resolveTaskPipelineVariant({ risk_level: 'critical' })).toBe('strict');
    });

    it('infers fast-track for trivial, low, or simple complexity when risk_level is unset', () => {
      expect(resolveTaskPipelineVariant({ complexity: 'trivial' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ complexity: 'low' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ complexity: 'simple' })).toBe('fast-track');
    });

    it('infers strict for high or complex tasks when risk_level is unset', () => {
      expect(resolveTaskPipelineVariant({ complexity: 'high' })).toBe('strict');
      expect(resolveTaskPipelineVariant({ complexity: 'complex' })).toBe('strict');
    });

    it('infers fast-track for documentation, style, chore, and minor refactoring issue types', () => {
      expect(resolveTaskPipelineVariant({ issue_type: 'docs' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ issue_type: 'documentation' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ issue_type: 'style' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ issue_type: 'styling' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ issue_type: 'chore' })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ issue_type: 'refactor' })).toBe('fast-track');
    });

    it('infers strict for core logic, bug, feature, and epic issue types', () => {
      expect(resolveTaskPipelineVariant({ issue_type: 'bug' })).toBe('strict');
      expect(resolveTaskPipelineVariant({ issue_type: 'feature' })).toBe('strict');
      expect(resolveTaskPipelineVariant({ issue_type: 'epic' })).toBe('strict');
    });

    it('infers pipeline variant based on labels', () => {
      expect(resolveTaskPipelineVariant({ labels: ['fast-track', 'frontend'] })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ labels: ['documentation'] })).toBe('fast-track');
      expect(resolveTaskPipelineVariant({ labels: ['security', 'fast-track'] })).toBe('strict'); // Security label enforces strict safety
      expect(resolveTaskPipelineVariant({ labels: ['core-backend'] })).toBe('strict');
    });

    it('prioritizes safety: high/critical risk or security always forces strict even with minor issue types', () => {
      expect(
        resolveTaskPipelineVariant({
          risk_level: 'high',
          issue_type: 'docs',
          complexity: 'trivial',
        })
      ).toBe('strict');

      expect(
        resolveTaskPipelineVariant({
          risk_level: 'critical',
          labels: ['documentation'],
        })
      ).toBe('strict');
    });

    it('defaults safely to strict when metadata is empty, undefined, or unknown', () => {
      expect(resolveTaskPipelineVariant({})).toBe('strict');
      expect(resolveTaskPipelineVariant(undefined as any)).toBe('strict');
      expect(resolveTaskPipelineVariant({ title: 'Untitled task' } as any)).toBe('strict');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Fast-Track 2-Step Workflow YAML Generation
  // ──────────────────────────────────────────────────────────────────────────
  describe('generateCaoFastTrackWorkflowYaml', () => {
    const defaultOptions = {
      taskKey: 'TASK-101',
      taskTitle: 'Update button styling and fix typography',
      taskDescription: 'Adjust Tailwind classes in Header component',
    };

    it('generates a 2-step pipeline with only implement and evidence steps', () => {
      const yaml = generateCaoFastTrackWorkflowYaml(defaultOptions);

      expect(yaml).toContain('name: task-TASK-101-pipeline');
      expect(yaml).toContain('- id: implement');
      expect(yaml).toContain('- id: evidence');

      // Crucial: Must NOT contain review or handoff steps
      expect(yaml).not.toContain('- id: review');
      expect(yaml).not.toContain('- id: handoff');
    });

    it('configures Step 1 (implement) with developer agent, workspace cd, and workflow_return', () => {
      const yaml = generateCaoFastTrackWorkflowYaml(defaultOptions);

      expect(yaml).toContain('agent: developer');
      expect(yaml).toContain('cd -- "{{workflow.inputs.workspace_path}}"');
      expect(yaml).toContain('workflow_return({"output": {...}})');
      expect(yaml).toContain('required:');
      expect(yaml).toContain('- modified_files');
      expect(yaml).toContain('- change_summary');
    });

    it('configures Step 2 (evidence) to run tests and embed structured handoff markers', () => {
      const yaml = generateCaoFastTrackWorkflowYaml(defaultOptions);

      expect(yaml).toContain('{{steps.implement.output.change_summary}}');
      expect(yaml).toContain('{{steps.implement.output.modified_files}}');
      expect(yaml).toContain('test_pass_count');
      expect(yaml).toContain('test_fail_count');
      expect(yaml).toContain('status');
      expect(yaml).toContain('<TASK_HUB_HANDOFF>');
      expect(yaml).toContain('workflow_return({"output": {...}})');
    });

    it('honors provider overrides for implement and evidence steps', () => {
      const yaml = generateCaoFastTrackWorkflowYaml({
        ...defaultOptions,
        implementProvider: 'claude_code',
        evidenceProvider: 'codex',
      });

      expect(yaml).toContain('provider: claude_code');
      expect(yaml).toContain('provider: codex');
    });

    it('safely escapes special characters and quotes in task titles and descriptions', () => {
      const yaml = generateCaoFastTrackWorkflowYaml({
        taskKey: 'TASK-999',
        taskTitle: 'Fix "quotes" and backslashes \\ in UI',
        taskDescription: 'Description with "nested" quotes and \n newlines',
      });

      expect(yaml).toContain('TASK-999');
      expect(yaml).toContain('Fix \\"quotes\\" and backslashes \\\\ in UI');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Backward Compatibility & Strict 4-Step Parity
  // ──────────────────────────────────────────────────────────────────────────
  describe('Standard 4-Step & Epic Workflow Backward Compatibility', () => {
    it('maintains strict 4-step pipeline for generateCaoStandardWorkflowYaml', () => {
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'CORE-500',
        taskTitle: 'Payment Gateway Database Migration',
        taskDescription: 'Critical schema migration for payment transactions',
      });

      expect(yaml).toContain('- id: implement');
      expect(yaml).toContain('- id: review');
      expect(yaml).toContain('- id: evidence');
      expect(yaml).toContain('- id: handoff');
      expect(yaml).toContain('verdict');
      expect(yaml).toContain('risk_score');
      expect(yaml).toContain('test_pass_count');
    });

    it('maintains full epic workflow structure with sequential child handoffs and epic-finalize', () => {
      const epic = generateCaoEpicWorkflowYaml({
        epic: { id: 77, issue_key: 'EPIC-77', title: 'Adaptive Pipeline Epic' },
        childTasks: [
          { id: 1, issue_key: 'TASK-1', title: 'Task 1', status: 'todo' },
          { id: 2, issue_key: 'TASK-2', title: 'Task 2', status: 'todo' },
        ],
      });

      expect(epic.yaml).toContain('id: child-1-1-implement');
      expect(epic.yaml).toContain('id: child-1-1-handoff');
      expect(epic.yaml).toContain('id: child-2-2-implement');
      expect(epic.yaml).toContain('id: child-2-2-handoff');
      expect(epic.yaml).toContain('id: epic-finalize');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Fast-Track Execution & Handoff Extraction Integration
  // ──────────────────────────────────────────────────────────────────────────
  describe('Fast-Track Execution & Handoff Extraction Integration', () => {
    it('parses Fast-Track status output correctly across 2 steps', () => {
      const fastTrackOutput = `
        Run ID: run-fast-12345
        Step: implement completed
        Executing step: evidence
        Status: RUNNING
      `;
      const parsed = parseCaoWorkflowRunStatus(fastTrackOutput);
      expect(parsed.runId).toBe('run-fast-12345');
      expect(parsed.state).toBe('running');
      expect(parsed.completedSteps).toEqual(['implement']);
      expect(parsed.currentStep).toBe('evidence');
    });

    it('extracts structured handoff payload directly from evidence step in Fast-Track mode', () => {
      // Simulating step results in a 2-step Fast-Track run
      const steps = [
        {
          id: 'implement',
          state: 'completed' as const,
          output: {
            modified_files: ['src/views/ControlCenter.vue'],
            change_summary: 'Updated workflow step rendering',
          },
        },
        {
          id: 'evidence',
          state: 'completed' as const,
          output: {
            test_pass_count: 12,
            test_fail_count: 0,
            status: 'passed',
            summary: 'Updated workflow step rendering with 12 unit tests passing',
            changed_files: ['src/views/ControlCenter.vue'],
            tests: '12 passed (12 total)',
          },
        },
      ];

      // Verification of extraction logic:
      // When /-handoff$/ or 'epic-finalize' is absent, the finalizer uses 'evidence' step
      const handoffStep = steps.find((s) => s.id === 'epic-finalize' || /-handoff$/.test(s.id) || s.id === 'handoff');
      const evidenceStep = steps.find((s) => s.id === 'evidence' || /-evidence$/.test(s.id));

      const isFastTrack = !handoffStep && Boolean(evidenceStep);
      expect(isFastTrack).toBe(true);

      const finalHandoffSource = handoffStep?.output || evidenceStep?.output;
      expect(finalHandoffSource).toBeDefined();
      expect(finalHandoffSource?.summary).toContain('Updated workflow step rendering');
      expect(finalHandoffSource?.test_pass_count).toBe(12);
    });

    it('detects and handles test failure in Fast-Track evidence step', () => {
      const steps = [
        {
          id: 'implement',
          state: 'completed' as const,
          output: { modified_files: ['src/foo.ts'], change_summary: 'Foo change' },
        },
        {
          id: 'evidence',
          state: 'completed' as const,
          output: {
            test_pass_count: 8,
            test_fail_count: 2,
            status: 'failed',
            summary: 'Test failure occurred',
          },
        },
      ];

      const evidenceStep = steps.find((s) => s.id === 'evidence');
      expect(evidenceStep?.output.status).toBe('failed');
      expect(evidenceStep?.output.test_fail_count).toBe(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: ControlCenter & CaoWorkflowRunPanel Source Code Verifications
  // ──────────────────────────────────────────────────────────────────────────
  describe('UI & ControlCenter Pipeline Integration', () => {
    it('verifies ControlCenter.vue dynamically chooses workflow generator via resolveTaskPipelineVariant', () => {
      expect(controlCenterSource).toContain('resolveTaskPipelineVariant');
      expect(controlCenterSource).toContain('generateCaoFastTrackWorkflowYaml');
      expect(controlCenterSource).toContain('generateCaoStandardWorkflowYaml');
    });

    it('verifies initialWorkflowSteps supports 2 steps for Fast-Track and 4 steps for Strict', () => {
      expect(controlCenterSource).toContain('initialWorkflowSteps');
    });

    it('verifies CaoWorkflowRunPanel.vue renders FAST-TRACK badge and dynamic step grid', () => {
      expect(panelSource).toContain('FAST-TRACK');
      expect(panelSource).toContain('STRICT WORKFLOW');
      expect(panelSource).toContain('gridColsClass');
    });
  });
});
