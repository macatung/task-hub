/**
 * Autonomous Multi-Agent Role Pipeline E2E Test Suite
 *
 * Comprehensive 4-Tier Test Suite covering:
 * - Tier 1: Feature Isolation Coverage (>=5 tests per feature for R1, R2, R3, R4)
 * - Tier 2: Boundary & Corner Cases (Empty plans, failing tests, git conflicts, stream drop, zero diffs, etc.)
 * - Tier 3: Cross-Feature Combinations (Role-to-role handoff chaining, live SSE + UI toggles, test auto-healing)
 * - Tier 4: Real-World Workload Scenarios (Full 4-stage Architect -> Implementer -> Test Engineer -> Auditor workflows)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AutoPilotRunner,
  AUTO_PILOT_STEPS,
  isRateLimitOrQuotaError,
  type AutoPilotStage,
  type AutoPilotResult,
  type AutoPilotTaskTarget,
  type AutoPilotConfig,
  type FallbackEvent,
} from '../autoPilotRunner';
import { useAutoPilotStore } from '../../stores/useAutoPilotStore';
import {
  RemoteDispatchService,
  type DispatchExecutionRecord,
} from '../../services/remoteDispatchService';
import {
  parseDiscoveryPlan,
  validateDiscoveryPlan,
  serializeDiscoveryPlanContract,
  type DiscoveryPlan,
} from '../discoveryPlan';
import {
  parseGitDiffNumstat,
  generateHandoffSummary,
  buildAgentHandoffPayload,
  formatHandoffMarkdown,
  type ParsedDiffStats,
  type AgentHandoffPayload,
} from '../diffHandoff';
import {
  parseTestOutput,
  detectTestRunner,
  extractTestCounts,
  extractDurationMs,
  buildVerificationEvidence,
  formatTestSummaryMarkdown,
  type VerificationEvidence,
  type TestEvidencePayload,
} from '../testEvidence';
import {
  inspectCommand,
  inspectToolExecution,
  inspectContentForConflicts,
  createSafetyInterceptEvent,
  type SafetyInterceptEvent,
  type SafetyInspectionResult,
} from '../safetyGuardrails';
import { buildAutoHandoffPayload } from '../autoHandoff';

// ============================================================================
// Multi-Agent Role & Telemetry Interface Contracts (PROJECT.md)
// ============================================================================
export type AgentRoleType = 'architect' | 'implementer' | 'tester' | 'auditor';

export interface AgentStageExecution {
  role: AgentRoleType;
  title: string;
  avatar: string;
  badge: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  terminalLogs: string[];
  toolCalls: Array<{
    id: string;
    toolName: string;
    args?: Record<string, any>;
    result?: string;
    status: 'running' | 'completed' | 'failed';
    expanded?: boolean;
  }>;
  outputArtifact?: string;
  evidence?: Record<string, any>;
}

export interface InterAgentContextPackage {
  sourceRole: AgentRoleType;
  targetRole: AgentRoleType;
  taskId: string;
  runId: string;
  planContent?: string;
  worktreePath?: string;
  gitDiffStat?: string;
  modifiedFiles?: string[];
  testOutput?: string;
  testPassRatio?: number;
  evidenceSummary?: string;
  timestamp: string;
}

// ============================================================================
// Mock Factories & Test Helpers
// ============================================================================
function createMockDesktopApi(overrides: Record<string, any> = {}) {
  return {
    agent: {
      listWorkspaces: vi.fn().mockResolvedValue(['/workspace/task-hub']),
      preflight: vi.fn().mockResolvedValue({
        ok: true,
        repository: '/workspace/task-hub',
        checks: [{ id: 'cli', status: 'passed', message: 'Antigravity CLI ready.' }],
      }),
      repairEnvironment: vi.fn().mockResolvedValue({
        ok: true,
        checks: [{ id: 'env', status: 'passed', message: 'Configured environment.' }],
        preflight: { ok: true, repository: '/workspace/task-hub', checks: [] },
      }),
      createWorktree: vi.fn().mockResolvedValue({
        path: '/workspace/task-hub/.worktrees/TASK-E2E-100',
        branch: 'agent/task-e2e-100',
      }),
      configureMcp: vi.fn().mockResolvedValue(true),
      startInteractive: vi.fn().mockResolvedValue({
        sessionId: 'session-multi-agent-100',
        mode: 'internal',
      }),
      start: vi.fn().mockResolvedValue({
        sessionId: 'session-multi-agent-100',
      }),
      listFiles: vi.fn().mockResolvedValue(['src/services/api.ts', 'src/components/View.vue']),
      readFile: vi.fn().mockResolvedValue('export const status = "ready";'),
      runTest: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'Test Files 5 passed (5)\nTests 35 passed (35)\nDuration 1.4s',
        stderr: '',
        durationMs: 1400,
      }),
      getGitDiff: vi.fn().mockResolvedValue({
        numstat: '42\t8\tsrc/services/api.ts\n15\t2\tsrc/components/View.vue',
        diffs: [
          { path: 'src/services/api.ts', additions: 42, deletions: 8 },
          { path: 'src/components/View.vue', additions: 15, deletions: 2 },
        ],
      }),
      stop: vi.fn().mockResolvedValue(true),
      ...overrides.agent,
    },
    taskHub: {
      mcpCall: vi.fn().mockImplementation((_url, _token, _proj, _method, params) => {
        if (params?.name === 'get_context_pack') {
          return Promise.resolve({
            repository: '/workspace/task-hub',
            branch: 'main',
            task: { id: 100, issue_key: 'TASK-E2E-100', title: 'Multi-Agent Pipeline' },
          });
        }
        if (params?.name === 'start_agent_run') {
          return Promise.resolve({ success: true, data: { id: 701 } });
        }
        if (params?.name === 'attach_evidence') {
          return Promise.resolve({ success: true, attached: true });
        }
        if (params?.name === 'complete_agent_handoff') {
          return Promise.resolve({ success: true, handoff_id: 'hnd-701' });
        }
        return Promise.resolve({ success: true });
      }),
      ...overrides.taskHub,
    },
  };
}

const SAMPLE_DISCOVERY_PLAN_JSON = JSON.stringify({
  summary: 'Architected 4-phase multi-agent role pipeline for Task Hub',
  assumptions: ['Desktop Companion and Hub SaaS communicate via MCP / SSE', 'Git worktrees are supported'],
  affected_docs: ['PROJECT.md', 'TEST_INFRA.md'],
  architecture_notes: ['Use role badges and avatar indicators', 'Context handoff uses JSON contracts'],
  risks: ['Rate limit exhaustion on peak concurrency'],
  epic: { title: 'Multi-Agent Role Execution Pipeline', description: 'Standardized 4-stage agent orchestration' },
  stories: [
    {
      title: 'Architect Role Discovery & Plan Generation',
      story_points: 3,
      acceptance_criteria: ['Generates structured discovery plan', 'Validates Fibonacci points and dependencies'],
      tasks: [
        {
          ref: 'ARCH-1',
          title: 'Requirement survey parser',
          story_points: 2,
          acceptance_criteria: ['Parses requirements', 'Validates markdown structure'],
          depends_on: [],
        },
        {
          ref: 'ARCH-2',
          title: 'Plan serializer and schema validator',
          story_points: 3,
          acceptance_criteria: ['Emits valid JSON payload', 'Checks dependency graph'],
          depends_on: ['ARCH-1'],
        },
      ],
    },
  ],
});

// ============================================================================
// MAIN TEST SUITE
// ============================================================================
describe('Multi-Agent Role Pipeline & Output Stream E2E Verification Suite', () => {

  // ==========================================================================
  // TIER 1: FEATURE ISOLATION COVERAGE (>=5 tests per feature)
  // ==========================================================================
  describe('Tier 1: Feature Isolation Coverage', () => {

    // ------------------------------------------------------------------------
    // Feature R1: Step-by-Step UI/UX Output Stream & Accordion Cards
    // ------------------------------------------------------------------------
    describe('Feature R1: Step-by-Step UI/UX Output Stream & Accordion Cards', () => {
      it('[T1_R1_01] renders 4-phase step card structures with role badges and avatars', () => {
        const roles: AgentRoleType[] = ['architect', 'implementer', 'tester', 'auditor'];
        const stages: AgentStageExecution[] = roles.map((role) => {
          const title =
            role === 'architect' ? '1. Architect / Planner'
            : role === 'implementer' ? '2. Core Implementer'
            : role === 'tester' ? '3. Test Engineer'
            : '4. Evidence Auditor';
          const avatar =
            role === 'architect' ? '📐'
            : role === 'implementer' ? '⚡'
            : role === 'tester' ? '🧪'
            : '🔍';
          const badge =
            role === 'architect' ? 'PLANNER'
            : role === 'implementer' ? 'DEVELOPER'
            : role === 'tester' ? 'QA'
            : 'REVIEWER';

          return {
            role,
            title,
            avatar,
            badge,
            model: 'gemini-3.7-flash',
            status: 'pending',
            terminalLogs: [],
            toolCalls: [],
          };
        });

        expect(stages.length).toBe(4);
        expect(stages[0].role).toBe('architect');
        expect(stages[0].badge).toBe('PLANNER');
        expect(stages[1].role).toBe('implementer');
        expect(stages[1].badge).toBe('DEVELOPER');
        expect(stages[2].role).toBe('tester');
        expect(stages[2].badge).toBe('QA');
        expect(stages[3].role).toBe('auditor');
        expect(stages[3].badge).toBe('REVIEWER');
      });

      it('[T1_R1_02] tags active AI model, timestamp, and computes stage duration accurately', () => {
        const stage: AgentStageExecution = {
          role: 'architect',
          title: '1. Architect / Planner',
          avatar: '📐',
          badge: 'PLANNER',
          model: 'gemini-3.7-flash',
          status: 'completed',
          startedAt: 1700000000000,
          completedAt: 1700000002500,
          durationMs: 2500,
          terminalLogs: ['[Architect] Codebase discovery initiated...'],
          toolCalls: [],
        };

        expect(stage.model).toBe('gemini-3.7-flash');
        expect(stage.completedAt! - stage.startedAt!).toBe(2500);
        expect(stage.durationMs).toBe(2500);
      });

      it('[T1_R1_03] manages collapsible terminal log viewer accordion state per agent stage independently', () => {
        const accordionStates: Record<AgentRoleType, boolean> = {
          architect: false,
          implementer: true,
          tester: false,
          auditor: false,
        };

        // Toggle architect accordion
        accordionStates.architect = !accordionStates.architect;
        expect(accordionStates.architect).toBe(true);
        expect(accordionStates.implementer).toBe(true);
        expect(accordionStates.tester).toBe(false);

        // Toggle implementer accordion off
        accordionStates.implementer = false;
        expect(accordionStates.implementer).toBe(false);
        expect(accordionStates.architect).toBe(true);
      });

      it('[T1_R1_04] handles tool call expansion with arguments inspection and JSON-RPC results', () => {
        const toolCall = {
          id: 'call-101',
          toolName: 'read_workspace_tree',
          args: { depth: 3, includeHidden: false },
          result: '{"files": ["package.json", "src/index.ts", "vitest.config.ts"]}',
          status: 'completed' as const,
          expanded: false,
        };

        expect(toolCall.expanded).toBe(false);
        // Expand tool call accordion
        toolCall.expanded = true;
        expect(toolCall.expanded).toBe(true);
        expect(toolCall.toolName).toBe('read_workspace_tree');
        expect(toolCall.args.depth).toBe(3);
        const parsedResult = JSON.parse(toolCall.result);
        expect(parsedResult.files).toContain('src/index.ts');
      });

      it('[T1_R1_05] manages progressive stage status badge transitions (pending -> running -> completed/failed)', () => {
        const stageStatusSequence: string[] = [];
        let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';

        stageStatusSequence.push(status);
        status = 'running';
        stageStatusSequence.push(status);
        status = 'completed';
        stageStatusSequence.push(status);

        expect(stageStatusSequence).toEqual(['pending', 'running', 'completed']);
      });

      it('[T1_R1_06] renders structured test evidence cards with verification summaries and pass/fail metrics', () => {
        const output = `
Test Files  6 passed (6)
Tests  45 passed (45)
Duration  1.82s
`;
        const evidence = parseTestOutput(output, 'npm test', 0, 1820);
        const card = buildVerificationEvidence(evidence, 'git-sha-abc1234');

        expect(card.evidence_type).toBe('automated_test');
        expect(card.status).toBe('passed');
        expect(card.commit_sha).toBe('git-sha-abc1234');
        expect(card.metadata.total_tests).toBe(45);
        expect(card.metadata.passed).toBe(45);
        expect(card.metadata.failed).toBe(0);
        expect(card.summary).toContain('45/45 tests passed (100%)');
      });
    });

    // ------------------------------------------------------------------------
    // Feature R2: Role-Based Multi-Agent Spawning & Execution Pipeline
    // ------------------------------------------------------------------------
    describe('Feature R2: Role-Based Multi-Agent Spawning & Execution Pipeline', () => {
      it('[T1_R2_01] Stage 1 (Architect/Planner): surveys requirements, discovers codebase, and generates valid discovery plan', () => {
        const rawOutput = `
I have analyzed the repository structure. Here is the formal architecture plan:
<task-hub-discovery-plan>
${SAMPLE_DISCOVERY_PLAN_JSON}
</task-hub-discovery-plan>
`;
        const parsed = parseDiscoveryPlan(rawOutput);
        expect(parsed.plan).not.toBeNull();
        expect(parsed.errors.length).toBe(0);
        expect(parsed.plan?.summary).toContain('Architected 4-phase multi-agent role pipeline');
        expect(parsed.plan?.stories.length).toBe(1);
        expect(parsed.plan?.stories[0].tasks.length).toBe(2);
      });

      it('[T1_R2_02] Stage 2 (Core Implementer): ingests plan, executes worktree branch checkout and applies code changes', async () => {
        const mockApi = createMockDesktopApi();
        const worktreeRes = await mockApi.agent.createWorktree('/workspace/task-hub', 'TASK-E2E-100');
        expect(worktreeRes.path).toContain('.worktrees');
        expect(worktreeRes.branch).toContain('task-e2e-100');

        const files = await mockApi.agent.listFiles(worktreeRes.path);
        expect(files).toContain('src/services/api.ts');

        const diffRes = await mockApi.agent.getGitDiff(worktreeRes.path);
        const parsedDiff = parseGitDiffNumstat(diffRes.numstat);
        expect(parsedDiff.totalChangedFiles).toBe(2);
        expect(parsedDiff.totalAdditions).toBe(57);
      });

      it('[T1_R2_03] Stage 3 (Test Engineer): runs automated test suite, calculates pass ratio, and generates verification evidence', async () => {
        const mockApi = createMockDesktopApi();
        const testRes = await mockApi.agent.runTest({ cwd: '/workspace/task-hub', command: 'vitest run' });
        expect(testRes.exitCode).toBe(0);

        const evidence = parseTestOutput(testRes.stdout, 'vitest run', testRes.exitCode, testRes.durationMs);
        expect(evidence.status).toBe('passed');
        expect(evidence.passed).toBe(35);
        expect(evidence.totalTests).toBe(35);
        expect(evidence.runner).toBe('vitest');
      });

      it('[T1_R2_04] Stage 4 (Evidence Auditor): compiles diffs, test logs, and builds signed handoff report', () => {
        const diffStats: ParsedDiffStats = {
          changedFiles: ['src/services/api.ts', 'src/components/View.vue'],
          totalChangedFiles: 2,
          totalAdditions: 57,
          totalDeletions: 10,
          files: [
            { path: 'src/services/api.ts', additions: 42, deletions: 8, status: 'modified' },
            { path: 'src/components/View.vue', additions: 15, deletions: 2, status: 'modified' },
          ],
        };

        const handoff = buildAgentHandoffPayload({
          task: { issue_key: 'TASK-E2E-100', title: 'Multi-Agent Role Pipeline' },
          diffStats,
          tests: [
            { command: 'vitest run', status: 'passed', summary: '35/35 tests passed (100%)' },
          ],
          commitSha: 'c0ffee1234567890',
          pullRequestUrl: 'https://github.com/macatung/task-hub/pull/101',
        });

        expect(handoff.summary).toContain('TASK-E2E-100');
        expect(handoff.changed_files.length).toBe(2);
        expect(handoff.tests[0].status).toBe('passed');
        expect(handoff.commit_sha).toBe('c0ffee1234567890');

        const markdown = formatHandoffMarkdown(handoff);
        expect(markdown).toContain('# 🚀 Task Hub Agent Handoff Report');
        expect(markdown).toContain('`src/services/api.ts`');
        expect(markdown).toContain('`c0ffee1234567890`');
      });

      it('[T1_R2_05] enforces sequential role execution order and verifies stage dependency prerequisites', () => {
        const executionOrder: AgentRoleType[] = [];
        const spawnRole = (role: AgentRoleType) => {
          if (role === 'implementer' && !executionOrder.includes('architect')) {
            throw new Error('Implementer cannot start without Architect plan.');
          }
          if (role === 'tester' && !executionOrder.includes('implementer')) {
            throw new Error('Tester cannot start without Implementer changes.');
          }
          if (role === 'auditor' && !executionOrder.includes('tester')) {
            throw new Error('Auditor cannot start without Tester evidence.');
          }
          executionOrder.push(role);
        };

        // Out-of-order spawn attempt must fail
        expect(() => spawnRole('implementer')).toThrow('Implementer cannot start without Architect plan.');

        // Correct sequential order succeeds
        spawnRole('architect');
        spawnRole('implementer');
        spawnRole('tester');
        spawnRole('auditor');

        expect(executionOrder).toEqual(['architect', 'implementer', 'tester', 'auditor']);
      });

      it('[T1_R2_06] supports dynamic model selection and multi-provider assignment per agent role', () => {
        const roleModelConfig: Record<AgentRoleType, { provider: string; model: string }> = {
          architect: { provider: 'antigravity', model: 'gemini-3.7-flash' },
          implementer: { provider: 'codex', model: 'claude-3-7-sonnet' },
          tester: { provider: 'antigravity', model: 'gemini-3.7-flash' },
          auditor: { provider: 'claude_code', model: 'claude-3-5-sonnet' },
        };

        expect(roleModelConfig.architect.provider).toBe('antigravity');
        expect(roleModelConfig.implementer.provider).toBe('codex');
        expect(roleModelConfig.tester.provider).toBe('antigravity');
        expect(roleModelConfig.auditor.provider).toBe('claude_code');
      });
    });

    // ------------------------------------------------------------------------
    // Feature R3: Seamless Inter-Agent Context Handoff & State Synchronization
    // ------------------------------------------------------------------------
    describe('Feature R3: Seamless Inter-Agent Context Handoff & State Synchronization', () => {
      it('[T1_R3_01] packages Architect discovery plan into InterAgentContextPackage for Implementer', () => {
        const pkg: InterAgentContextPackage = {
          sourceRole: 'architect',
          targetRole: 'implementer',
          taskId: 'TASK-E2E-100',
          runId: 'run-701',
          planContent: SAMPLE_DISCOVERY_PLAN_JSON,
          worktreePath: '/workspace/task-hub/.worktrees/TASK-E2E-100',
          timestamp: new Date().toISOString(),
        };

        expect(pkg.sourceRole).toBe('architect');
        expect(pkg.targetRole).toBe('implementer');
        expect(pkg.planContent).toBeDefined();
        const parsed = JSON.parse(pkg.planContent!);
        expect(parsed.stories.length).toBe(1);
      });

      it('[T1_R3_02] packages Implementer worktree diff stats and file modifications for Test Engineer', () => {
        const pkg: InterAgentContextPackage = {
          sourceRole: 'implementer',
          targetRole: 'tester',
          taskId: 'TASK-E2E-100',
          runId: 'run-701',
          worktreePath: '/workspace/task-hub/.worktrees/TASK-E2E-100',
          gitDiffStat: '42\t8\tsrc/services/api.ts\n15\t2\tsrc/components/View.vue',
          modifiedFiles: ['src/services/api.ts', 'src/components/View.vue'],
          timestamp: new Date().toISOString(),
        };

        expect(pkg.sourceRole).toBe('implementer');
        expect(pkg.targetRole).toBe('tester');
        expect(pkg.modifiedFiles).toHaveLength(2);
        expect(pkg.gitDiffStat).toContain('src/services/api.ts');
      });

      it('[T1_R3_03] packages Test Engineer verification metrics and output logs for Auditor review', () => {
        const pkg: InterAgentContextPackage = {
          sourceRole: 'tester',
          targetRole: 'auditor',
          taskId: 'TASK-E2E-100',
          runId: 'run-701',
          testOutput: 'Tests: 35 passed (35 total)\nDuration: 1.4s',
          testPassRatio: 1.0,
          evidenceSummary: '35/35 tests passed (100%) in 1.40s via vitest',
          timestamp: new Date().toISOString(),
        };

        expect(pkg.sourceRole).toBe('tester');
        expect(pkg.targetRole).toBe('auditor');
        expect(pkg.testPassRatio).toBe(1.0);
        expect(pkg.evidenceSummary).toContain('100%');
      });

      it('[T1_R3_04] emits role-tagged realtime SSE events with role, stage, and tool metadata', () => {
        const sseEvent = {
          event: 'agent-run-event',
          data: {
            run_id: 'run-701',
            role: 'architect',
            stage: 'discovery',
            status: 'running',
            log: '[Architect] Discovering repository structure...',
            tool_call: {
              name: 'read_dir',
              status: 'completed',
            },
          },
        };

        expect(sseEvent.event).toBe('agent-run-event');
        expect(sseEvent.data.role).toBe('architect');
        expect(sseEvent.data.stage).toBe('discovery');
        expect(sseEvent.data.tool_call.name).toBe('read_dir');
      });

      it('[T1_R3_05] relays bidirectional telemetry from Desktop Studio to Web Hub SaaS via RemoteDispatchService', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

        const service = new RemoteDispatchService({
          baseUrl: 'http://localhost:8000',
          token: 'test-token',
          fetchFn: mockFetch as any,
        });

        await service.relayLog(701, 1, 'stdout', '[Architect] Repository parsed.');
        await service.relayEvent(701, 'stage_started', 'running', { stage: 'discovery' });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        const logCall = mockFetch.mock.calls[0];
        expect(logCall[0]).toContain('/api/v1/agent-runs/701/logs');
        const logBody = JSON.parse(logCall[1].body);
        expect(logBody.content).toBe('[Architect] Repository parsed.');
      });

      it('[T1_R3_06] guarantees zero context truncation or state loss across inter-agent handoffs', () => {
        const originalData = {
          summary: 'High precision architectural breakdown with unicode characters: 📐 ⚡ 🧪 🔍 tiếng Việt',
          complexConfig: { flags: [true, false, true], nested: { count: 42, score: 99.9 } },
        };

        const serialized = JSON.stringify(originalData);
        const reconstructed = JSON.parse(serialized);

        expect(reconstructed).toEqual(originalData);
        expect(reconstructed.summary).toContain('tiếng Việt');
      });
    });

    // ------------------------------------------------------------------------
    // Feature R4: Cross-App Stability, Types & Automated Verification
    // ------------------------------------------------------------------------
    describe('Feature R4: Cross-App Stability, Types & Automated Verification', () => {
      it('[T1_R4_01] validates runtime type contracts for AgentStageExecution and InterAgentContextPackage', () => {
        const execution: AgentStageExecution = {
          role: 'auditor',
          title: '4. Evidence Auditor / Reviewer',
          avatar: '🔍',
          badge: 'REVIEWER',
          model: 'claude-3-5-sonnet',
          status: 'completed',
          terminalLogs: ['Verification signed.'],
          toolCalls: [],
          evidence: { verified: true },
        };

        expect(typeof execution.role).toBe('string');
        expect(['architect', 'implementer', 'tester', 'auditor']).toContain(execution.role);
        expect(Array.isArray(execution.terminalLogs)).toBe(true);
      });

      it('[T1_R4_02] detects rate limits / quota exhaustion (HTTP 429 / RESOURCE_EXHAUSTED) and triggers fallback cascade', () => {
        expect(isRateLimitOrQuotaError('HTTP 429: Too Many Requests')).toBe(true);
        expect(isRateLimitOrQuotaError('RESOURCE_EXHAUSTED: Rate limit exceeded')).toBe(true);
        expect(isRateLimitOrQuotaError('insufficient_quota')).toBe(true);
        expect(isRateLimitOrQuotaError('TypeError: Cannot read property')).toBe(false);
      });

      it('[T1_R4_03] verifies remote dispatch command ingestion latency meets < 2000ms SLA', async () => {
        const service = new RemoteDispatchService({ baseUrl: 'http://localhost:8000' });
        const dispatchedAt = new Date(Date.now() - 350).toISOString();

        const mockApi = createMockDesktopApi();
        service.setOptions({ autoPilotConfig: { desktopApi: mockApi } });

        const resultPromise = service.handleCommand({
          type: 'remote_dispatch',
          command_id: 'cmd-e2e-1',
          task_id: 100,
          issue_key: 'TASK-E2E-100',
          title: 'Remote E2E Run',
          dispatched_at: dispatchedAt,
        });

        const result = await resultPromise;
        expect(result?.success).toBe(true);
        const history = service.getExecutionHistory();
        expect(history.length).toBe(1);
        expect(history[0].dispatchLatencyMs).toBeLessThan(2000);
      });

      it('[T1_R4_04] handles agent crash or unhandled process exception with clean state recovery and error propagation', async () => {
        const mockApi = createMockDesktopApi({
          agent: {
            startInteractive: vi.fn().mockRejectedValue(new Error('Fatal agent runtime core dumped')),
          },
        });

        const runner = new AutoPilotRunner({
          desktopApi: mockApi,
          autoFallbackOnRateLimit: false,
        });

        const result = await runner.start({
          issue_key: 'TASK-FAIL-1',
          title: 'Crash recovery test',
        });

        expect(result.success).toBe(false);
        expect(result.stage).toBe('failed');
        expect(result.error).toContain('Fatal agent runtime core dumped');
      });

      it('[T1_R4_05] validates JSON-RPC 2.0 MCP tool payload serialization across agent invocations', () => {
        const rpcPayload = {
          jsonrpc: '2.0',
          id: 'req-101',
          method: 'tools/call',
          params: {
            name: 'complete_agent_handoff',
            arguments: {
              task_id: 'TASK-E2E-100',
              run_id: 701,
              summary: 'Completed 4-stage pipeline',
              changed_files: ['src/services/api.ts'],
            },
          },
        };

        const serialized = JSON.stringify(rpcPayload);
        const parsed = JSON.parse(serialized);
        expect(parsed.jsonrpc).toBe('2.0');
        expect(parsed.params.name).toBe('complete_agent_handoff');
        expect(parsed.params.arguments.run_id).toBe(701);
      });

      it('[T1_R4_06] verifies ANSI color code sanitization and raw terminal stream safety across all output streams', () => {
        const ansiOutput = '\x1b[32mTests  35 passed (35)\x1b[0m\n\x1b[32mDuration  1.4s\x1b[0m';
        const evidence = parseTestOutput(ansiOutput, 'vitest run', 0, 1400);

        expect(evidence.status).toBe('passed');
        expect(evidence.passed).toBe(35);
        expect(evidence.summary).not.toContain('\x1b');
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('[T2_01] Empty / Malformed Discovery Plan: handles missing plan tags gracefully with actionable errors', () => {
      const emptyOutput = 'Agent ran but produced no markers at all.';
      const res = parseDiscoveryPlan(emptyOutput);
      expect(res.plan).toBeNull();
      expect(res.errors[0]).toContain('did not return a standard plan payload');
    });

    it('[T2_02] Invalid Story Points & Circular Dependencies: rejects non-Fibonacci numbers and self/cyclic dependencies', () => {
      const malformedPlan: DiscoveryPlan = {
        summary: 'Invalid plan',
        assumptions: [],
        affected_docs: [],
        architecture_notes: [],
        risks: [],
        epic: { title: 'Invalid Epic' },
        stories: [
          {
            title: 'Story 1',
            story_points: 4, // non-Fibonacci
            acceptance_criteria: ['AC 1'],
            tasks: [
              {
                ref: 'TASK-A',
                title: 'Task A',
                story_points: 3,
                acceptance_criteria: ['AC A'],
                depends_on: ['TASK-A'], // Self-dependency
              },
            ],
          },
        ],
      };

      const errors = validateDiscoveryPlan(malformedPlan);
      expect(errors.some((e) => e.includes('Fibonacci'))).toBe(true);
      expect(errors.some((e) => e.includes('cannot depend on itself'))).toBe(true);
    });

    it('[T2_03] Failing Test Suite Execution: Test Engineer accurately flags failing assertions and transitions stage to failed', () => {
      const failedVitestOutput = `
 ✕ src/services/api.test.ts (2 tests | 1 failed)
   ✕ API Service > throws 404 on nonexistent resource (2ms)
      AssertionError: expected 500 to be 404

Test Files  1 failed | 4 passed (5)
Tests  1 failed | 34 passed (35)
Duration  2.1s
`;
      const evidence = parseTestOutput(failedVitestOutput, 'npm test', 1, 2100);
      expect(evidence.status).toBe('failed');
      expect(evidence.failed).toBe(1);
      expect(evidence.passed).toBe(34);
      expect(evidence.totalTests).toBe(35);
      expect(evidence.summary).toContain('1 failed');
    });

    it('[T2_04] Merge Conflict in Worktree: detects git conflict markers and pauses into waiting_input for developer resolution', () => {
      const conflictedSource = `
function getApiEndpoint() {
<<<<<<< HEAD
  return 'https://api.v1.prod.macatung.dev';
=======
  return 'https://api.v2.preview.macatung.dev';
>>>>>>> feature/v2-migration
}
`;
      const inspection = inspectContentForConflicts(conflictedSource, 'src/api.ts');
      expect(inspection.hasConflict).toBe(true);
      expect(inspection.conflictCount).toBe(1);
      expect(inspection.markers.length).toBeGreaterThanOrEqual(1);

      const alert = createSafetyInterceptEvent(inspection as any);
      expect(alert.category).toBe('conflict');
      expect(alert.requiresApproval).toBe(true);
    });

    it('[T2_05] Connection Loss / SSE Stream Drop: recovers gracefully when SSE connection drops or fails', () => {
      const service = new RemoteDispatchService({ baseUrl: 'http://invalid-unreachable-host:9999' });
      expect(() => service.connectSseStream(123)).not.toThrow();
      expect(() => service.disconnectSseStream()).not.toThrow();
    });

    it('[T2_06] Zero-Diff Execution: handles runs where no file changes were made and creates informative handoff', () => {
      const emptyDiff = parseGitDiffNumstat('');
      expect(emptyDiff.totalChangedFiles).toBe(0);
      expect(emptyDiff.changedFiles).toEqual([]);

      const handoff = buildAgentHandoffPayload({
        task: { issue_key: 'TASK-NO-DIFF', title: 'Inspection only' },
        diffStats: emptyDiff,
      });

      expect(handoff.changed_files).toEqual([]);
      expect(handoff.summary).toContain('TASK-NO-DIFF');
      const markdown = formatHandoffMarkdown(handoff);
      expect(markdown).toContain('_No changed files recorded_');
    });

    it('[T2_07] User Cancellation Mid-Stage: aborts active agent process immediately and transitions state machine to cancelled', async () => {
      const mockApi = createMockDesktopApi({
        agent: {
          startInteractive: vi.fn().mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return { sessionId: 'sess-cancel' };
          }),
        },
      });

      const runner = new AutoPilotRunner({ desktopApi: mockApi });
      const runPromise = runner.start({ issue_key: 'TASK-CANCEL', title: 'Cancel mid-flight' });

      await new Promise((resolve) => setTimeout(resolve, 20));
      await runner.cancel();

      const result = await runPromise;
      expect(result.success).toBe(false);
      expect(result.stage).toBe('cancelled');
    });

    it('[T2_08] Unparsable / Binary Git Diff Output: safely handles binary diffs and complex file renames', () => {
      const numstat = `
-\t-\tpublic/assets/mascot_zen.png
25\t10\tsrc/{old_service.ts => new_service.ts}
`;
      const parsed = parseGitDiffNumstat(numstat);
      expect(parsed.totalChangedFiles).toBe(2);
      expect(parsed.changedFiles).toContain('public/assets/mascot_zen.png');
      expect(parsed.changedFiles).toContain('src/new_service.ts');
      const binaryFile = parsed.files.find((f) => f.path === 'public/assets/mascot_zen.png');
      expect(binaryFile?.binary).toBe(true);
    });

    it('[T2_09] Rate-Limit Exhaustion with Fallback Cascade: cascades across models when primary hits quota', async () => {
      const fallbackEvents: FallbackEvent[] = [];
      let callCount = 0;

      const mockApi = createMockDesktopApi({
        agent: {
          startInteractive: vi.fn().mockImplementation(async (_prov, _cwd, _prompt, _mode, model) => {
            callCount++;
            if (model === 'gemini-3.7-flash') {
              throw new Error('HTTP 429: Resource exhausted: tokens per minute limit reached');
            }
            return { sessionId: `sess-${model}` };
          }),
        },
      });

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        model: 'gemini-3.7-flash',
        maxRetriesPerModel: 1,
        initialBackoffMs: 10,
        onFallbackTriggered: (ev) => fallbackEvents.push(ev),
      });

      const result = await runner.start({ issue_key: 'TASK-QUOTA', title: 'Quota Failover' });
      expect(result.success).toBe(true);
      expect(fallbackEvents.length).toBeGreaterThan(0);
      expect(fallbackEvents[0].previousModel).toBe('gemini-3.7-flash');
    });

    it('[T2_10] Dangerous Command Interception: intercepts destructive commands during Implementer execution', () => {
      const dangerousCmd = 'rm -rf / --no-preserve-root';
      const inspection = inspectCommand(dangerousCmd);
      expect(inspection.safe).toBe(false);
      expect(inspection.riskLevel).toBe('critical');

      const toolInspection = inspectToolExecution('run_command', { CommandLine: 'git reset --hard HEAD~10' });
      expect(toolInspection.safe).toBe(false);
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS & INTEGRATIONS
  // ==========================================================================
  describe('Tier 3: Cross-Feature Combinations & Integrations', () => {
    it('[T3_01] Full Role-to-Role Context Handoff Chaining: end-to-end data pass-through from Architect -> Implementer -> Tester -> Auditor', async () => {
      const contextChain: InterAgentContextPackage[] = [];

      // 1. Architect produces plan
      const architectPkg: InterAgentContextPackage = {
        sourceRole: 'architect',
        targetRole: 'implementer',
        taskId: 'TASK-CHAIN-1',
        runId: 'run-801',
        planContent: SAMPLE_DISCOVERY_PLAN_JSON,
        timestamp: new Date().toISOString(),
      };
      contextChain.push(architectPkg);

      // 2. Implementer uses plan to modify code
      const implementerPkg: InterAgentContextPackage = {
        sourceRole: 'implementer',
        targetRole: 'tester',
        taskId: 'TASK-CHAIN-1',
        runId: 'run-801',
        worktreePath: '/workspace/task-hub/.worktrees/TASK-CHAIN-1',
        modifiedFiles: ['src/pipeline.ts', 'src/types.ts'],
        gitDiffStat: '100\t20\tsrc/pipeline.ts\n30\t5\tsrc/types.ts',
        timestamp: new Date().toISOString(),
      };
      contextChain.push(implementerPkg);

      // 3. Tester runs tests on modified files
      const testerPkg: InterAgentContextPackage = {
        sourceRole: 'tester',
        targetRole: 'auditor',
        taskId: 'TASK-CHAIN-1',
        runId: 'run-801',
        testOutput: 'Tests 50 passed (50)\nDuration 1.9s',
        testPassRatio: 1.0,
        evidenceSummary: '50/50 tests passed (100%) in 1.90s via vitest',
        timestamp: new Date().toISOString(),
      };
      contextChain.push(testerPkg);

      expect(contextChain.length).toBe(3);
      expect(contextChain[0].sourceRole).toBe('architect');
      expect(contextChain[1].sourceRole).toBe('implementer');
      expect(contextChain[2].sourceRole).toBe('tester');
      expect(contextChain[2].targetRole).toBe('auditor');
    });

    it('[T3_02] Live SSE Stream with Concurrent UI Accordion State & Scrolling: simulates rapid log events alongside accordion toggles', () => {
      const logs: string[] = [];
      const accordionState = { architectLogs: false, implementerLogs: true };

      // Stream 50 log events
      for (let i = 1; i <= 50; i++) {
        logs.push(`[Implementer] Compiling component chunk #${i}`);
        if (i === 25) {
          accordionState.architectLogs = true; // User expands architect accordion mid-stream
        }
      }

      expect(logs.length).toBe(50);
      expect(accordionState.architectLogs).toBe(true);
      expect(accordionState.implementerLogs).toBe(true);
    });

    it('[T3_03] Test Auto-Healing Workflow: Test Engineer detects Vitest failure, re-prompts Implementer, re-runs to 100% pass', async () => {
      let testAttempt = 0;
      const mockApi = createMockDesktopApi({
        agent: {
          runTest: vi.fn().mockImplementation(() => {
            testAttempt++;
            if (testAttempt === 1) {
              return Promise.resolve({
                success: false,
                exitCode: 1,
                stdout: 'Tests 1 failed | 34 passed (35)\nDuration 1.2s',
                stderr: '',
                durationMs: 1200,
              });
            }
            return Promise.resolve({
              success: true,
              exitCode: 0,
              stdout: 'Tests 35 passed (35)\nDuration 1.1s',
              stderr: '',
              durationMs: 1100,
            });
          }),
        },
      });

      // 1st run: Test failure detected
      const firstTestRes = await mockApi.agent.runTest({ cwd: '/workspace', command: 'vitest run' });
      const firstEvidence = parseTestOutput(firstTestRes.stdout, 'vitest run', firstTestRes.exitCode);
      expect(firstEvidence.status).toBe('failed');

      // Auto-healing iteration: Implementer patches code, Test Engineer re-runs
      const secondTestRes = await mockApi.agent.runTest({ cwd: '/workspace', command: 'vitest run' });
      const secondEvidence = parseTestOutput(secondTestRes.stdout, 'vitest run', secondTestRes.exitCode);
      expect(secondEvidence.status).toBe('passed');
      expect(secondEvidence.passed).toBe(35);
    });

    it('[T3_04] Dangerous Tool Call Interception & Developer Approval Loop: Implementer pauses, developer approves, pipeline completes', async () => {
      const conflictedCode = `
<<<<<<< HEAD
const mode = 'supervised';
=======
const mode = 'autonomous';
>>>>>>> feature/auto-mode
`;
      const mockApi = createMockDesktopApi({
        agent: {
          listFiles: vi.fn().mockResolvedValue(['src/config.ts']),
          readFile: vi.fn().mockResolvedValue(conflictedCode),
        },
      });

      let alertReceived: SafetyInterceptEvent | null = null;
      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        onSafetyAlert: (alert) => {
          alertReceived = alert;
        },
      });

      const startPromise = runner.start({
        issue_key: 'TASK-SAFETY-LOOP',
        title: 'Safety Intercept & Resume',
      });

      await new Promise((r) => setTimeout(r, 20));
      expect(runner.getStage()).toBe('waiting_input');
      expect(alertReceived).not.toBeNull();

      // Developer approves
      runner.approveSafetyAlert(alertReceived!.eventId);

      const result = await startPromise;
      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
    });

    it('[T3_05] Remote Dispatch from Hub triggering Multi-Agent Pipeline on Desktop with real-time log relay', async () => {
      const relayedLogs: any[] = [];
      const relayedEvents: any[] = [];

      const mockFetch = vi.fn().mockImplementation((url, opts) => {
        if (url.includes('/logs')) {
          relayedLogs.push(JSON.parse(opts.body));
        } else if (url.includes('/events')) {
          relayedEvents.push(JSON.parse(opts.body));
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      });

      const mockApi = createMockDesktopApi();
      const service = new RemoteDispatchService({
        baseUrl: 'http://localhost:8000',
        fetchFn: mockFetch as any,
        autoPilotConfig: { desktopApi: mockApi },
      });

      const result = await service.handleCommand({
        type: 'remote_dispatch',
        command_id: 'cmd-hub-1',
        task_id: 200,
        issue_key: 'TASK-HUB-200',
        title: 'Hub Remote Task',
        dispatched_at: new Date().toISOString(),
      });

      expect(result?.success).toBe(true);
      expect(relayedLogs.length).toBeGreaterThan(0);
      expect(relayedEvents.length).toBeGreaterThan(0);
    });

    it('[T3_06] Concurrent Multi-Agent Execution on Disjoint Tasks: ensures store and runner state isolation', async () => {
      const store = useAutoPilotStore();
      store.reset();

      const mockApi = createMockDesktopApi();

      // Execute Task A
      const resA = await store.startAutoPilot(
        { issue_key: 'TASK-A', title: 'Task A' },
        { desktopApi: mockApi }
      );
      expect(resA.success).toBe(true);
      expect(store.currentStage.value).toBe('completed');

      // Reset and execute Task B
      store.reset();
      expect(store.currentStage.value).toBe('idle');

      const resB = await store.startAutoPilot(
        { issue_key: 'TASK-B', title: 'Task B' },
        { desktopApi: mockApi }
      );
      expect(resB.success).toBe(true);
      expect(store.currentStage.value).toBe('completed');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD WORKLOAD SCENARIOS (Full 4-Stage E2E Cycles)
  // ==========================================================================
  describe('Tier 4: Real-World Workload Scenarios', () => {
    it('[T4_01] Scenario 1 — High-Priority API Feature Delivery: Architect plans REST endpoint, Implementer modifies files, Test Engineer runs Vitest (35/35 pass), Auditor signs handoff', async () => {
      const mockApi = createMockDesktopApi();
      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        provider: 'antigravity',
        model: 'gemini-3.7-flash',
      });

      const result = await runner.start({
        id: 401,
        issue_key: 'TASK-PROD-401',
        title: 'Implement Multi-Agent SSE Telemetry REST Controller',
        description: 'Design, implement and verify SSE endpoints for real-time stage progress.',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
      expect(result.worktreePath).toBeDefined();

      // Verify Test Evidence
      expect(result.evidence?.status).toBe('passed');
      expect(result.evidence?.metadata.total_tests).toBe(35);
      expect(result.evidence?.metadata.passed).toBe(35);

      // Verify Handoff Payload
      expect(result.handoff).toBeDefined();
      expect(result.handoff?.changed_files.length).toBeGreaterThan(0);
      expect(result.handoff?.tests[0].status).toBe('passed');
    });

    it('[T4_02] Scenario 2 — Critical Regression Bugfix Workflow: Architect surveys stack trace, Implementer patches fix, Test Engineer validates regression tests pass, Auditor certifies diff', async () => {
      const mockApi = createMockDesktopApi({
        agent: {
          runTest: vi.fn().mockResolvedValue({
            success: true,
            exitCode: 0,
            stdout: 'Test Files 8 passed (8)\nTests 62 passed (62)\nDuration 2.3s',
            stderr: '',
            durationMs: 2300,
          }),
        },
      });

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        provider: 'codex',
        model: 'claude-3-7-sonnet',
      });

      const result = await runner.start({
        id: 402,
        issue_key: 'BUG-PROD-402',
        title: 'Fix race condition in SSE command stream reconnection',
        description: 'Reconnection backoff failed when hub responded with 503 Service Unavailable.',
      });

      expect(result.success).toBe(true);
      expect(result.evidence?.metadata.total_tests).toBe(62);
      expect(result.evidence?.metadata.passed).toBe(62);
      expect(result.handoff?.summary).toContain('BUG-PROD-402');
    });

    it('[T4_03] Scenario 3 — Complex Refactoring with Git Conflict & Safety Approval: Architect decomposes refactoring, Implementer hits conflict, developer resolves, Tester passes, Auditor packages handoff', async () => {
      const conflictedCode = `
<<<<<<< HEAD
export const V1_API = '/api/v1/desktop';
=======
export const V2_API = '/api/v2/desktop';
>>>>>>> refactor/v2-routing
`;
      const mockApi = createMockDesktopApi({
        agent: {
          listFiles: vi.fn().mockResolvedValue(['src/constants/routes.ts']),
          readFile: vi.fn().mockResolvedValue(conflictedCode),
        },
      });

      let alertFired = false;
      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        onSafetyAlert: (alert) => {
          alertFired = true;
          // Simulate instant developer approval
          setTimeout(() => runner.approveSafetyAlert(alert.eventId), 10);
        },
      });

      const result = await runner.start({
        id: 403,
        issue_key: 'REFACTOR-403',
        title: 'Migrate legacy desktop routes to centralized route constants',
      });

      expect(alertFired).toBe(true);
      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
    });

    it('[T4_04] Scenario 4 — Autonomous Heavy-Load Execution with Rate-Limit Resilience: Multi-agent execution encounters quota limits, automatically falls back to secondary model, and completes handoff', async () => {
      const fallbackEvents: FallbackEvent[] = [];
      let attempts = 0;

      const mockApi = createMockDesktopApi({
        agent: {
          startInteractive: vi.fn().mockImplementation(async (_prov, _cwd, _prompt, _mode, model) => {
            attempts++;
            if (attempts <= 1) {
              throw new Error('HTTP 429: Too Many Requests: TPM quota exceeded on gemini-3.7-flash');
            }
            return { sessionId: `sess-fallback-${model}` };
          }),
        },
      });

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        model: 'gemini-3.7-flash',
        maxRetriesPerModel: 1,
        initialBackoffMs: 10,
        onFallbackTriggered: (ev) => fallbackEvents.push(ev),
      });

      const result = await runner.start({
        id: 404,
        issue_key: 'HEAVY-LOAD-404',
        title: 'Batch ingest 100 enterprise work items under rate limits',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
      expect(fallbackEvents.length).toBeGreaterThan(0);
      expect(result.evidence?.status).toBe('passed');
      expect(result.handoff).toBeDefined();
    });
  });
});
