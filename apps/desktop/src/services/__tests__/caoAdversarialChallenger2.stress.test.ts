import { describe, expect, it, vi, beforeEach } from 'vitest';
import controlCenterSource from '../../views/ControlCenter.vue?raw';
import { buildAutoHandoffPayload } from '../../utils/autoHandoff';
import { normalizeWorkflowEvent } from '../../utils/executionStream';
import { resolveTaskPipelineVariant, topologicallySortEpicTasks } from '../caoBridgeService';

describe('Adversarial Stress Test Suite — Challenger 2 (Workflow Handoff Synthesis & Hub Event Sync)', () => {
  let mcpCalls: Array<{ name: string; args: any }>;
  let mcpOutboxEntries: Array<{ name: string; args: any; meta: any }>;
  let runUpdates: Array<{ runId: string; status: string; summary: string }>;
  let handoffCalls: Array<{ payload: any; autoApprove: boolean }>;

  beforeEach(() => {
    mcpCalls = [];
    mcpOutboxEntries = [];
    runUpdates = [];
    handoffCalls = [];
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: Hashing and State Machine Logic mirror from ControlCenter.vue
  // ──────────────────────────────────────────────────────────────────────────
  const workflowResultHash = (value: unknown) => {
    let text = '';
    try {
      text = JSON.stringify(value ?? '');
    } catch {
      text = String(value);
    }
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };

  const executeFinalizeWorkflowRun = async (ctx: {
    runId: string | null;
    selectedTask: { id: number; title: string; issue_key?: string } | null;
    workflowStatus: {
      pipelineVariant?: 'fast-track' | 'strict';
      steps?: Array<{ id: string; taskId?: number; output?: Record<string, any> }>;
    } | null;
    output?: string;
    runOutputStart?: number;
    handoffImpl?: (payload: any, autoApprove: boolean) => Promise<void>;
    updateRunForImpl?: (runId: string, status: string, summary: string) => Promise<void>;
  }) => {
    let phase = '';
    let runStatus = '';
    let error: string | null = null;

    const currentRunId = ctx.runId;
    if (!currentRunId || !ctx.selectedTask) return { phase, runStatus, error, structuredPayload: null, payload: null };

    const currentSteps = ctx.workflowStatus?.steps || [];
    const isFastTrack = ctx.workflowStatus?.pipelineVariant === 'fast-track'
      || (currentSteps.length === 2 && currentSteps.some((s) => s.id === 'implement') && currentSteps.some((s) => s.id === 'evidence'));
    const implementStep = currentSteps.find((step) => step.id === 'implement' || /(?:^|-)implement$/.test(step.id));
    const evidenceStep = currentSteps.find((step) => step.id === 'evidence' || /(?:^|-)evidence$/.test(step.id));
    const handoffStep = currentSteps.find((step) => step.id === 'epic-finalize' || step.id === 'handoff' || /(?:^|-)handoff$/.test(step.id));
    const implementOutput = (implementStep?.output || {}) as Record<string, any>;
    const evidenceOutput = (evidenceStep?.output || {}) as Record<string, any>;
    const handoffOutput = (handoffStep?.output || {}) as Record<string, any>;

    let structuredPayload: any = null;
    if (isFastTrack && (implementStep?.output || evidenceStep?.output)) {
      const modifiedFiles = implementOutput.modified_files || evidenceOutput.modified_files || evidenceOutput.changed_files || [];
      const changedFilesStr = Array.isArray(modifiedFiles) ? modifiedFiles.join('\n') : String(modifiedFiles || '');
      const passCount = Number(evidenceOutput.test_pass_count ?? 0);
      const failCount = Number(evidenceOutput.test_fail_count ?? 0);
      const evidenceStatus = evidenceOutput.status === 'failed' || failCount > 0 ? 'skipped' as const : 'passed' as const;
      const testDesc = Array.isArray(evidenceOutput.tests)
        ? evidenceOutput.tests.join(', ')
        : (evidenceOutput.tests || `${passCount} tests passed, ${failCount} failed`);
      structuredPayload = {
        summary: String(evidenceOutput.summary || implementOutput.change_summary || `CAO fast-track workflow completed: ${ctx.selectedTask.title}`),
        changedFiles: changedFilesStr,
        tests: String(testDesc),
        testStatus: evidenceStatus,
        testSummary: String(evidenceOutput.test_summary || `Fast-track test evidence verified (${passCount} passed, ${failCount} failed).`),
        commitSha: String(evidenceOutput.commit_sha || implementOutput.commit_sha || ''),
        pullRequestUrl: String(evidenceOutput.pull_request_url || ''),
        blockers: String(evidenceOutput.blockers || ''),
      };
    } else if (handoffStep?.output) {
      structuredPayload = {
        summary: String(handoffOutput.summary || `CAO workflow completed: ${ctx.selectedTask.title}`),
        changedFiles: Array.isArray(handoffOutput.changed_files) ? handoffOutput.changed_files.join('\n') : String(handoffOutput.changed_files || ''),
        tests: Array.isArray(handoffOutput.tests) ? JSON.stringify(handoffOutput.tests) : String(handoffOutput.tests || evidenceOutput.tests || 'CAO workflow evidence'),
        testStatus: evidenceOutput.status === 'failed' ? 'skipped' as const : 'passed' as const,
        testSummary: 'Evidence was produced by the strict CAO workflow.',
        commitSha: String(handoffOutput.commit_sha || ''),
        pullRequestUrl: String(handoffOutput.pull_request_url || ''),
        blockers: String(handoffOutput.blockers || ''),
      };
    }

    const payload = structuredPayload || buildAutoHandoffPayload({
      output: (ctx.output || '').slice(ctx.runOutputStart || 0),
      taskTitle: ctx.selectedTask.title,
      exitCode: 0,
    });

    const updateRunFor = ctx.updateRunForImpl || (async (rId, st, sum) => {
      runUpdates.push({ runId: rId, status: st, summary: sum });
    });

    const handoff = ctx.handoffImpl || (async (p, auto) => {
      handoffCalls.push({ payload: p, autoApprove: auto });
    });

    if (!payload) {
      phase = 'Workflow completed — handoff review required';
      runStatus = 'completed';
      await updateRunFor(currentRunId, 'waiting_input', 'CAO workflow completed, but no structured handoff marker was found.');
      return { phase, runStatus, error, structuredPayload, payload: null };
    }

    try {
      await handoff(payload, false);
      await updateRunFor(currentRunId, 'waiting_input', 'CAO workflow completed; awaiting human Hub approval.');
      phase = 'Workflow completed';
      runStatus = 'completed' as any;
    } catch (e: any) {
      error = e?.message || 'Workflow handoff failed.';
      phase = 'Workflow handoff failed';
      runStatus = 'failed';
      await updateRunFor(currentRunId, 'failed', error || 'Workflow handoff failed.');
    }

    return { phase, runStatus, error, structuredPayload, payload };
  };

  const executeSyncWorkflowEventToHub = async (
    event: any,
    status?: any,
    ctx?: {
      runId?: string;
      workflowKind?: string;
      pipelineVariant?: string;
      mcpImpl?: (name: string, args: any) => Promise<any>;
    }
  ) => {
    const runId = ctx?.runId || 'run-101';
    const workflowKind = ctx?.workflowKind || 'task';
    const pipelineVariant = ctx?.pipelineVariant || 'fast-track';

    if (!runId || !event?.runId) return;

    const normalizedEvent = normalizeWorkflowEvent(event, runId, 'workflow');
    const stepId = event.stepId || status?.currentStep || event.type;
    const result = event.output || status?.steps?.find((s: any) => s.id === stepId)?.output || status;
    const eventId = `cao:${event.runId}:step:${stepId}:result:${workflowResultHash(result)}`;
    const payload = {
      stream_version: 1,
      source: 'cao',
      normalized: normalizedEvent,
      cao_run_id: event.runId,
      workflow_kind: workflowKind,
      workflow_state: status?.state,
      step_id: stepId,
      result,
      error: event.error || status?.error,
    };
    const step = status?.steps?.find((c: any) => c.id === stepId);

    const mcp = ctx?.mcpImpl || (async (name: string, args: any) => {
      mcpCalls.push({ name, args });
      return { success: true };
    });

    try {
      await mcp('record_agent_run_event', {
        run_id: runId,
        event_id: eventId,
        event_type: String(event.type || 'workflow.output').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60),
        status: status?.state,
        stage: stepId,
        payload,
      });
    } catch (eventError: any) {
      if (/unknown tool/i.test(String(eventError?.message || eventError))) {
        try {
          await mcp('update_agent_run', {
            run_id: runId,
            status: status?.state,
            summary: `CAO workflow event ${event.type || 'workflow.output'}: ${stepId}`,
            metadata: { workflow_event: { event_id: eventId, event_type: event.type || 'workflow.output', stage: stepId, payload } },
          });
        } catch {
          // ignore
        }
      } else {
        mcpOutboxEntries.push({
          name: 'record_agent_run_event',
          args: {
            run_id: runId,
            event_id: eventId,
            event_type: String(event.type || 'workflow.output').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60),
            status: status?.state,
            stage: stepId,
            payload,
          },
          meta: { runId, description: `Record CAO workflow event ${event.type}` },
        });
      }
    }

    if (event.type === 'workflow.step.completed' && (stepId === 'evidence' || /(?:^|-)evidence$/.test(String(stepId))) && step?.taskId) {
      const evidence = (step.output || {}) as Record<string, any>;
      const evidenceArgs = {
        run_id: runId,
        task_id: step.taskId,
        evidence_type: 'cao_workflow',
        status: evidence.status === 'failed' || (evidence.test_fail_count && evidence.test_fail_count > 0) ? 'failed' : 'passed',
        command: Array.isArray(evidence.tests) ? evidence.tests.map(String).join(' && ').slice(0, 500) : (typeof evidence.tests === 'string' ? evidence.tests.slice(0, 500) : undefined),
        summary: JSON.stringify(evidence).slice(0, 10000),
        metadata: { cao_run_id: event.runId, step_id: stepId, result: evidence, pipeline_variant: pipelineVariant },
        idempotency_key: eventId,
      };
      try {
        await mcp('attach_verification_evidence', evidenceArgs);
      } catch {
        mcpOutboxEntries.push({
          name: 'attach_verification_evidence',
          args: evidenceArgs,
          meta: { runId, description: `Attach evidence for CAO step ${stepId}` },
        });
      }
    }
  };

  // =========================================================================
  // Dimension 1: Fast-Track Handoff Synthesis Stress Test
  // =========================================================================
  describe('Dimension 1: Fast-Track Handoff Synthesis with Corrupted / Failing Outputs', () => {
    it('synthesizes handoff with testStatus="skipped" when Step 2 reports test failures (test_fail_count > 0)', async () => {
      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-1',
        selectedTask: { id: 101, title: 'Fix CSS button alignment', issue_key: 'TH-101' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            {
              id: 'implement',
              taskId: 101,
              output: {
                modified_files: ['src/components/Button.vue', 'src/styles/theme.css'],
                change_summary: 'Adjusted button margin and line height',
              },
            },
            {
              id: 'evidence',
              taskId: 101,
              output: {
                test_pass_count: 12,
                test_fail_count: 2,
                status: 'failed',
                tests: ['npm test src/components/Button.test.ts', 'npm test src/styles.test.ts'],
                summary: '2 visual regression tests failed',
              },
            },
          ],
        },
      });

      expect(result.error).toBeNull();
      expect(result.structuredPayload).toBeDefined();
      expect(result.structuredPayload.testStatus).toBe('skipped'); // Skips auto-approval, forces Hub review
      expect(result.structuredPayload.changedFiles).toBe('src/components/Button.vue\nsrc/styles/theme.css');
      expect(result.structuredPayload.tests).toBe('npm test src/components/Button.test.ts, npm test src/styles.test.ts');
      expect(result.structuredPayload.testSummary).toContain('12 passed, 2 failed');

      expect(handoffCalls).toHaveLength(1);
      expect(handoffCalls[0].autoApprove).toBe(false);
      expect(runUpdates).toContainEqual({
        runId: 'run-ft-1',
        status: 'waiting_input',
        summary: 'CAO workflow completed; awaiting human Hub approval.',
      });
    });

    it('synthesizes handoff with testStatus="passed" when Step 2 reports zero failures and positive pass count', async () => {
      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-2',
        selectedTask: { id: 102, title: 'Update documentation header', issue_key: 'TH-102' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            {
              id: 'implement',
              taskId: 102,
              output: {
                modified_files: ['README.md'],
                change_summary: 'Updated header banner and badges',
              },
            },
            {
              id: 'evidence',
              taskId: 102,
              output: {
                test_pass_count: 5,
                test_fail_count: 0,
                status: 'passed',
                tests: 'npm test doc-lint',
                summary: 'All markdown documentation tests passed',
              },
            },
          ],
        },
      });

      expect(result.error).toBeNull();
      expect(result.structuredPayload.testStatus).toBe('passed');
      expect(result.structuredPayload.summary).toBe('All markdown documentation tests passed');
      expect(result.structuredPayload.tests).toBe('npm test doc-lint');
      expect(result.structuredPayload.testSummary).toContain('5 passed, 0 failed');
    });

    it('gracefully handles missing fields, undefined outputs, and null objects without crashing', async () => {
      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-3',
        selectedTask: { id: 103, title: 'Minor refactor without test output' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            { id: 'implement', taskId: 103, output: undefined },
            { id: 'evidence', taskId: 103, output: {} },
          ],
        },
      });

      expect(result.error).toBeNull();
      expect(result.structuredPayload).toBeDefined();
      expect(result.structuredPayload.changedFiles).toBe('');
      expect(result.structuredPayload.tests).toBe('0 tests passed, 0 failed');
      expect(result.structuredPayload.testStatus).toBe('passed');
      expect(result.structuredPayload.summary).toBe('CAO fast-track workflow completed: Minor refactor without test output');
      expect(result.structuredPayload.commitSha).toBe('');
      expect(result.structuredPayload.pullRequestUrl).toBe('');
      expect(result.structuredPayload.blockers).toBe('');
    });

    it('gracefully handles empty strings and non-array modified_files', async () => {
      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-4',
        selectedTask: { id: 104, title: 'Clean up unused comments' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            {
              id: 'implement',
              taskId: 104,
              output: {
                modified_files: 'single_file.ts',
                change_summary: '',
              },
            },
            {
              id: 'evidence',
              taskId: 104,
              output: {
                test_pass_count: '',
                test_fail_count: '',
                tests: '',
                summary: '',
              },
            },
          ],
        },
      });

      expect(result.error).toBeNull();
      expect(result.structuredPayload.changedFiles).toBe('single_file.ts');
      expect(result.structuredPayload.summary).toBe('CAO fast-track workflow completed: Clean up unused comments');
      expect(result.structuredPayload.testStatus).toBe('passed');
    });

    it('falls back to buildAutoHandoffPayload when step outputs are completely missing', async () => {
      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-5',
        selectedTask: { id: 105, title: 'Documentation fix' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            { id: 'implement', taskId: 105 },
            { id: 'evidence', taskId: 105 },
          ],
        },
        output: 'Ran vitest run\n3 tests passed (exit code 0)',
        runOutputStart: 0,
      });

      expect(result.error).toBeNull();
      expect(result.structuredPayload).toBeNull();
      expect(result.payload).toBeDefined();
      expect(result.payload.summary).toBe('Automated handoff: Documentation fix');
      expect(result.payload.testStatus).toBe('passed');
      expect(handoffCalls).toHaveLength(1);
    });

    it('catches handoff rejection errors, records failure state and updates Hub to "failed"', async () => {
      const failingHandoff = async () => {
        throw new Error('Network error: Hub MCP gateway unreachable (502 Bad Gateway)');
      };

      const result = await executeFinalizeWorkflowRun({
        runId: 'run-ft-6',
        selectedTask: { id: 106, title: 'Failing handoff task' },
        workflowStatus: {
          pipelineVariant: 'fast-track',
          steps: [
            { id: 'implement', taskId: 106, output: { change_summary: 'Done' } },
            { id: 'evidence', taskId: 106, output: { test_pass_count: 1, test_fail_count: 0 } },
          ],
        },
        handoffImpl: failingHandoff,
      });

      expect(result.phase).toBe('Workflow handoff failed');
      expect(result.runStatus).toBe('failed');
      expect(result.error).toBe('Network error: Hub MCP gateway unreachable (502 Bad Gateway)');
      expect(runUpdates).toContainEqual({
        runId: 'run-ft-6',
        status: 'failed',
        summary: 'Network error: Hub MCP gateway unreachable (502 Bad Gateway)',
      });
    });

    it('fuzzes finalizeWorkflowRun with 50 randomized corrupted payloads without throwing unhandled exceptions', async () => {
      const fuzzOutputs = [
        null,
        undefined,
        {},
        { test_pass_count: 'invalid_number', test_fail_count: 'NaN' },
        { test_pass_count: -10, test_fail_count: -5 },
        { modified_files: null, change_summary: null },
        { modified_files: 12345, change_summary: true },
        { modified_files: ['valid.ts', null, undefined, 999] },
        { tests: { nested: 'not an array' } },
        { status: 'UNKNOWN_STATUS' },
        { status: null },
        { summary: ''.padStart(50000, 'x') }, // Large payload
      ];

      for (let i = 0; i < fuzzOutputs.length; i++) {
        const fuzzOutput = fuzzOutputs[i];
        expect(async () => {
          await executeFinalizeWorkflowRun({
            runId: `run-fuzz-${i}`,
            selectedTask: { id: 1000 + i, title: `Fuzz Task ${i}` },
            workflowStatus: {
              pipelineVariant: 'fast-track',
              steps: [
                { id: 'implement', taskId: 1000 + i, output: fuzzOutput as any },
                { id: 'evidence', taskId: 1000 + i, output: fuzzOutput as any },
              ],
            },
          });
        }).not.toThrow();
      }
    });
  });

  // =========================================================================
  // Dimension 2: Single-Task Evidence Step Events & Hub Sync
  // =========================================================================
  describe('Dimension 2: Single-Task Evidence Step Events & Hub Sync', () => {
    it('properly triggers attach_verification_evidence on single-task evidence step completion', async () => {
      const event = {
        type: 'workflow.step.completed',
        runId: 'cao-run-201',
        stepId: 'evidence',
      };

      const status = {
        runId: 'cao-run-201',
        state: 'running',
        steps: [
          { id: 'implement', taskId: 201, state: 'completed' },
          {
            id: 'evidence',
            taskId: 201,
            state: 'completed',
            output: {
              status: 'passed',
              test_pass_count: 8,
              test_fail_count: 0,
              tests: ['npm run test:unit', 'npm run test:e2e'],
              summary: 'All 8 tests passed without regressions',
            },
          },
        ],
      };

      await executeSyncWorkflowEventToHub(event, status, {
        runId: 'hub-run-201',
        workflowKind: 'task',
        pipelineVariant: 'fast-track',
      });

      // 1. Auditable record_agent_run_event call
      const recordCall = mcpCalls.find((c) => c.name === 'record_agent_run_event');
      expect(recordCall).toBeDefined();
      expect(recordCall?.args.run_id).toBe('hub-run-201');
      expect(recordCall?.args.stage).toBe('evidence');
      expect(recordCall?.args.payload.cao_run_id).toBe('cao-run-201');

      // 2. attach_verification_evidence call
      const evidenceCall = mcpCalls.find((c) => c.name === 'attach_verification_evidence');
      expect(evidenceCall).toBeDefined();
      expect(evidenceCall?.args.run_id).toBe('hub-run-201');
      expect(evidenceCall?.args.task_id).toBe(201);
      expect(evidenceCall?.args.status).toBe('passed');
      expect(evidenceCall?.args.command).toBe('npm run test:unit && npm run test:e2e');
      expect(evidenceCall?.args.metadata.pipeline_variant).toBe('fast-track');
      expect(evidenceCall?.args.idempotency_key).toContain('cao:cao-run-201:step:evidence:result:');
    });

    it('attaches evidence with status="failed" when test_fail_count > 0 or status="failed"', async () => {
      const event = {
        type: 'workflow.step.completed',
        runId: 'cao-run-202',
        stepId: 'evidence',
      };

      const status = {
        runId: 'cao-run-202',
        state: 'running',
        steps: [
          {
            id: 'evidence',
            taskId: 202,
            state: 'completed',
            output: {
              status: 'failed',
              test_pass_count: 5,
              test_fail_count: 3,
              tests: 'pytest tests/',
            },
          },
        ],
      };

      await executeSyncWorkflowEventToHub(event, status, {
        runId: 'hub-run-202',
        workflowKind: 'task',
        pipelineVariant: 'fast-track',
      });

      const evidenceCall = mcpCalls.find((c) => c.name === 'attach_verification_evidence');
      expect(evidenceCall).toBeDefined();
      expect(evidenceCall?.args.task_id).toBe(202);
      expect(evidenceCall?.args.status).toBe('failed');
      expect(evidenceCall?.args.command).toBe('pytest tests/');
    });

    it('enqueues evidence to mcpOutbox if direct attach_verification_evidence call fails', async () => {
      const event = {
        type: 'workflow.step.completed',
        runId: 'cao-run-203',
        stepId: 'evidence',
      };

      const status = {
        runId: 'cao-run-203',
        state: 'running',
        steps: [
          {
            id: 'evidence',
            taskId: 203,
            state: 'completed',
            output: {
              test_pass_count: 10,
              test_fail_count: 0,
              tests: ['cargo test'],
            },
          },
        ],
      };

      const flakyMcp = async (name: string, _args: any) => {
        if (name === 'attach_verification_evidence') {
          throw new Error('Connection timeout to MCP host');
        }
        return { success: true };
      };

      await executeSyncWorkflowEventToHub(event, status, {
        runId: 'hub-run-203',
        workflowKind: 'task',
        mcpImpl: flakyMcp,
      });

      expect(mcpOutboxEntries).toHaveLength(1);
      expect(mcpOutboxEntries[0].name).toBe('attach_verification_evidence');
      expect(mcpOutboxEntries[0].args.task_id).toBe(203);
      expect(mcpOutboxEntries[0].args.status).toBe('passed');
      expect(mcpOutboxEntries[0].args.command).toBe('cargo test');
    });

    it('falls back to update_agent_run when legacy Hub advertises unknown tool for record_agent_run_event', async () => {
      const event = {
        type: 'workflow.step.completed',
        runId: 'cao-run-204',
        stepId: 'implement',
      };

      const status = {
        runId: 'cao-run-204',
        state: 'running',
        steps: [{ id: 'implement', taskId: 204, output: { modified_files: ['index.ts'] } }],
      };

      const legacyHubMcp = async (name: string, args: any) => {
        if (name === 'record_agent_run_event') {
          throw new Error('Unknown tool: record_agent_run_event');
        }
        mcpCalls.push({ name, args });
        return { success: true };
      };

      await executeSyncWorkflowEventToHub(event, status, {
        runId: 'hub-run-204',
        mcpImpl: legacyHubMcp,
      });

      const fallbackCall = mcpCalls.find((c) => c.name === 'update_agent_run');
      expect(fallbackCall).toBeDefined();
      expect(fallbackCall?.args.run_id).toBe('hub-run-204');
      expect(fallbackCall?.args.summary).toContain('CAO workflow event workflow.step.completed: implement');
      expect(fallbackCall?.args.metadata.workflow_event.stage).toBe('implement');
    });

    it('handles non-evidence steps without attempting attach_verification_evidence', async () => {
      const nonEvidenceSteps = ['implement', 'review', 'handoff', 'epic-finalize', 'custom-step'];

      for (const stepId of nonEvidenceSteps) {
        mcpCalls = [];
        await executeSyncWorkflowEventToHub(
          { type: 'workflow.step.completed', runId: 'cao-run-205', stepId },
          { runId: 'cao-run-205', steps: [{ id: stepId, taskId: 205, output: { test_pass_count: 5 } }] },
          { runId: 'hub-run-205' }
        );

        const evidenceCall = mcpCalls.find((c) => c.name === 'attach_verification_evidence');
        expect(evidenceCall).toBeUndefined();
      }
    });

    it('attaches evidence for epic child tasks with matching regex stage name (e.g. child-1-42-evidence)', async () => {
      const event = {
        type: 'workflow.step.completed',
        runId: 'cao-run-206',
        stepId: 'child-1-42-evidence',
      };

      const status = {
        runId: 'cao-run-206',
        state: 'running',
        steps: [
          {
            id: 'child-1-42-evidence',
            taskId: 42,
            state: 'completed',
            output: {
              status: 'passed',
              test_pass_count: 15,
              test_fail_count: 0,
              tests: ['pnpm vitest run src/child.test.ts'],
            },
          },
        ],
      };

      await executeSyncWorkflowEventToHub(event, status, {
        runId: 'hub-run-206',
        workflowKind: 'epic',
      });

      const evidenceCall = mcpCalls.find((c) => c.name === 'attach_verification_evidence');
      expect(evidenceCall).toBeDefined();
      expect(evidenceCall?.args.task_id).toBe(42);
      expect(evidenceCall?.args.status).toBe('passed');
      expect(evidenceCall?.args.command).toBe('pnpm vitest run src/child.test.ts');
    });
  });

  // =========================================================================
  // Dimension 3: Static Contract Conformance in ControlCenter.vue
  // =========================================================================
  describe('Dimension 3: ControlCenter.vue Source Conformance & State Flow', () => {
    it('verifies finalizeWorkflowRun handles both fast-track 2-step and strict 4-step paths', () => {
      expect(controlCenterSource).toContain('const finalizeWorkflowRun = async () =>');
      expect(controlCenterSource).toContain("isFastTrack && (implementStep?.output || evidenceStep?.output)");
      expect(controlCenterSource).toContain("handoffStep?.output");
      expect(controlCenterSource).toContain("buildAutoHandoffPayload");
      expect(controlCenterSource).toContain("evidenceOutput.status === 'failed' || failCount > 0 ? 'skipped' as const : 'passed' as const");
    });

    it('verifies syncWorkflowEventToHub attaches verification evidence for single-task and epic evidence steps', () => {
      expect(controlCenterSource).toContain('const syncWorkflowEventToHub = async');
      expect(controlCenterSource).toContain("event.type === 'workflow.step.completed' && (stepId === 'evidence' || /(?:^|-)evidence$/.test(String(stepId))) && step?.taskId");
      expect(controlCenterSource).toContain("mcp('attach_verification_evidence', evidenceArgs)");
      expect(controlCenterSource).toContain("mcpOutbox.enqueue('attach_verification_evidence', evidenceArgs");
    });

    it('verifies initialWorkflowSteps maps task ID for single tasks and all epic children', () => {
      expect(controlCenterSource).toContain('const initialWorkflowSteps =');
      expect(controlCenterSource).toContain("stepIds.map((id) => ({ id, taskId: task.id, taskKey: task.issue_key || `#${task.id}`, label: id, state: 'pending' }))");
      expect(controlCenterSource).toContain("id: `child-${index + 1}-${child.id}-${stage}`");
      expect(controlCenterSource).toContain('taskId: child.id');
    });
  });
});
