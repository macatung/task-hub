import { describe, expect, it } from 'vitest';
import {
  selectCaoOrchestrationStrategy,
  generateCaoStandardWorkflowYaml,
  buildCaoWorkflowCommand,
  parseCaoWorkflowRunStatus,
  evaluateCaoUserPrompt,
} from '../caoBridgeService';
import electronMainSource from '../../../electron/main.ts?raw';
import preloadSource from '../../../electron/preload.ts?raw';

describe('CAO Advanced Workflow vs Supervisor Hybrid Orchestration', () => {
  describe('Strategy Selection (Workflow vs Supervisor)', () => {
    it('selects workflow for standard coding and bugfix tasks', () => {
      const strategy = selectCaoOrchestrationStrategy({
        title: 'Fix authentication token refresh bug',
        description: 'Refresh token expires prematurely in Production',
      });
      expect(strategy).toBe('workflow');
    });

    it('selects supervisor for open-ended research, investigation, or exploratory tasks', () => {
      const strategy = selectCaoOrchestrationStrategy({
        title: 'Explore possible architectures for new microservice',
        description: 'Investigate performance and compare alternatives',
      });
      expect(strategy).toBe('supervisor');
    });

    it('honors explicit strategy overrides', () => {
      expect(selectCaoOrchestrationStrategy({ title: 'Task' }, { strategy: 'supervisor' })).toBe('supervisor');
      expect(selectCaoOrchestrationStrategy({ title: 'Explore solution' }, { strategy: 'workflow' })).toBe('workflow');
    });
  });

  describe('4-Step Declarative Workflow Yaml Generation', () => {
    it('generates a structured 4-step pipeline with strict JSON Schemas', () => {
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: 'TM-42',
        taskTitle: 'Payment Gateway Integration',
        taskDescription: 'Add Stripe support for workspaces',
      });

      expect(yaml).toContain('name: task-TM-42-pipeline');
      expect(yaml).toContain('- id: implement');
      expect(yaml).toContain('- id: review');
      expect(yaml).toContain('- id: evidence');
      expect(yaml).toContain('- id: handoff');

      // Data flow bindings across steps
      expect(yaml).toContain('{{steps.implement.output.change_summary}}');
      expect(yaml).toContain('{{steps.review.output.feedback}}');
      expect(yaml).toContain('<TASK_HUB_HANDOFF>');

      // Schema validations
      expect(yaml).toContain('required:');
      expect(yaml).toContain('- modified_files');
      expect(yaml).toContain('- verdict');
      expect(yaml).toContain('- test_pass_count');
    });
  });

  describe('Workflow Command Builder & Crash-Resumption', () => {
    it('builds validate, run, status, and resume CLI arguments', () => {
      expect(buildCaoWorkflowCommand('validate', 'pipeline.yaml')).toEqual(['workflow', 'validate', 'pipeline.yaml']);
      expect(buildCaoWorkflowCommand('run', 'pipeline.yaml', { inputs: { pr_url: 'https://github.com/example' } })).toEqual(['workflow', 'run', 'pipeline.yaml', '--input', 'pr_url=https://github.com/example']);
      expect(buildCaoWorkflowCommand('resume', 'run-a1b2c3d4')).toEqual(['workflow', 'resume', 'run-a1b2c3d4']);
    });

    it('parses run status and journaled step progress', () => {
      const statusOutput = `
        Run ID: run-98765
        Step: implement completed
        Step: review completed
        Executing step: evidence
        Status: RUNNING
      `;
      const parsed = parseCaoWorkflowRunStatus(statusOutput);
      expect(parsed.runId).toBe('run-98765');
      expect(parsed.state).toBe('RUNNING');
      expect(parsed.completedSteps).toEqual(['implement', 'review']);
      expect(parsed.currentStep).toBe('evidence');
    });
  });

  describe('Smart WAITING_USER_ANSWER evaluation', () => {
    it('auto-approves safe workspace prompts under workspace_write policy', () => {
      const res = evaluateCaoUserPrompt('Do you want to create src/auth.ts and run tests? (y/n)', 'workspace_write');
      expect(res.autoAnswer).toBe(true);
      expect(res.answer).toBe('y');
      expect(res.risk).toBe('low');
    });

    it('blocks dangerous destructive actions and requires human operator review', () => {
      const res = evaluateCaoUserPrompt('Do you want to run rm -rf / data?', 'full_access');
      expect(res.autoAnswer).toBe(false);
      expect(res.risk).toBe('high');
    });
  });

  describe('Electron IPC & Preload Integration', () => {
    it('exposes workflow run, resume, status, and answerPrompt in main and preload', () => {
      expect(electronMainSource).toContain("'cao-workflow-run'");
      expect(electronMainSource).toContain("'cao-workflow-resume'");
      expect(electronMainSource).toContain("'cao-workflow-status'");
      expect(electronMainSource).toContain("'cao-answer-user-prompt'");

      expect(preloadSource).toContain('runWorkflow:');
      expect(preloadSource).toContain('resumeWorkflow:');
      expect(preloadSource).toContain('getWorkflowStatus:');
      expect(preloadSource).toContain('answerUserPrompt:');
    });
  });
});
