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
      expect(yaml).toContain('{{workflow.inputs.workspace_path}}');
      expect(yaml).toContain('cd -- "{{workflow.inputs.workspace_path}}"');
      expect(yaml).toContain('Task title (literal fallback for CAO retry): "Payment Gateway Integration"');
      expect(yaml).toContain('Task details (literal fallback for CAO retry): "Add Stripe support for workspaces"');
      expect(yaml).toContain('workflow_return({"output": {...}})');
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
      expect(electronMainSource).toContain('required="2.5.0"');
      expect(electronMainSource).toContain('uv tool upgrade cli-agent-orchestrator');
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
      expect(parsed.state).toBe('running');
      expect(parsed.completedSteps).toEqual(['implement', 'review']);
      expect(parsed.currentStep).toBe('evidence');
    });

    it('parses CAO 2.5 status snapshots used by desktop recovery', () => {
      const statusOutput = `
        Run:     cao-workflow-123
        State:   completed
        Current: handoff
          - implement: completed (attempts=1)
          - review: completed (attempts=1)
          - evidence: completed (attempts=1)
          - handoff: completed (attempts=1)
      `;
      const parsed = parseCaoWorkflowRunStatus(statusOutput);
      expect(parsed.runId).toBe('cao-workflow-123');
      expect(parsed.state).toBe('completed');
      expect(parsed.currentStep).toBe('handoff');
      expect(parsed.completedSteps).toEqual(['implement', 'review', 'evidence', 'handoff']);
    });

    it('reconciles persisted running workflows with authoritative CAO status', () => {
      expect(electronMainSource).toContain('const parsed = parseCaoWorkflowRuntimeStatus(status.output, runId)');
      expect(electronMainSource).toContain("parsed.state === 'running' && !caoWorkflowProcesses.has(runId)");
      expect(electronMainSource).toContain('state: reconciledState');
      expect(electronMainSource).toContain('completedSteps: parsed.completedSteps');
      expect(electronMainSource).toContain("const suspiciousCompleted = saved.state === 'completed'");
      expect(electronMainSource).toContain("['workflow', 'status', run.runId]");
      expect(electronMainSource).toContain("authoritative.error || 'CAO exited before a terminal workflow status was confirmed.'");
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
      expect(electronMainSource).toContain("'cao-workflow-start'");
      expect(electronMainSource).toContain("'cao-workflow-resume'");
      expect(electronMainSource).toContain("'cao-workflow-status'");
      expect(electronMainSource).toContain("'cao-workflow-cancel'");
      expect(electronMainSource).toContain("'cao-workflow-list'");
      expect(electronMainSource).toContain("['workflow', 'resume', run.runId]");
      expect(electronMainSource).toContain('cao-workflow-event');
      expect(electronMainSource).toContain("'cao-answer-user-prompt'");
      expect(electronMainSource).toContain('mirrorWorkflowSpec');
      expect(electronMainSource).toContain('runWslShellWithStdin');
      expect(electronMainSource).toContain('canonicalPath');
      expect(electronMainSource).toContain('cp -- ${shellQuote(wslSourcePath)} ${shellQuote(runtimePath)}');
      expect(electronMainSource).toContain('sed -i ${shellQuote');
      expect(electronMainSource).toContain('child.stdin?.end(input, \'utf8\')');
      expect(electronMainSource).toContain('script=/tmp/task-hub-stdin-$$.sh');
      expect(electronMainSource).toContain('bash "$script"');
      expect(electronMainSource).toContain('cat > ${shellQuote(runtimePath)}');
      expect(electronMainSource).toContain('test -s ${shellQuote(runtimePath)}');
      expect(electronMainSource).toContain('runtimeWorkflowPath');
      expect(electronMainSource).toContain('mapWorkflowInputsToRuntime');
      expect(electronMainSource).toContain('Agent worktree is not ready');
      expect(electronMainSource).toContain('childExited');
      expect(electronMainSource).toContain('CAO workflow status failed');
      expect(electronMainSource).toContain('isCaoUnknownRunFailure');
      expect(electronMainSource).toContain('no longer exists');
      expect(electronMainSource).toContain('Do not overwrite that terminal state with `running` below.');
      expect(electronMainSource).toContain("errorCode: 'workflow_validation_failed'");
      expect(electronMainSource).toContain('canonicalSpecPath');
      expect(electronMainSource).toContain('runtimeSpecPath');
      expect(electronMainSource).toContain('runtimeCwd');
      expect(electronMainSource).toContain('removeRuntimeWorkflowSpec');
      expect(electronMainSource).toContain('Metadata normalization deferred');
      expect(electronMainSource).toContain('parseCaoSessionNames');
      expect(electronMainSource).toContain("['session', 'list', '--json']");
      expect(electronMainSource).toContain('cao_saved_session_not_live');
      expect(electronMainSource).toContain('CAO Supervisor stale terminal');

      expect(preloadSource).toContain('runWorkflow:');
      expect(preloadSource).toContain('resumeWorkflow:');
      expect(preloadSource).toContain('getWorkflowStatus:');
      expect(preloadSource).toContain('listWorkflowRuns:');
      expect(preloadSource).toContain('onWorkflowEvent:');
      expect(preloadSource).toContain('answerUserPrompt:');
    });
  });
});
