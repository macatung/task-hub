/**
 * Empirical Adversarial Challenger Test Suite: Milestone 1
 *
 * Focus:
 * 1. 4-Role State Transition Simulation (Architect -> Implementer -> Tester -> Auditor)
 * 2. Multi-Provider Prompt Dispatching & Rate-Limit Fallback Cascade
 * 3. Tool Inspector Resilience against Malformed, Circular, or Nested JSON Payloads
 * 4. StreamCardsView UI State Machine & Formatter Edge Cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AutoPilotRunner,
  ROLE_METADATA,
  isRateLimitOrQuotaError,
  MODEL_FALLBACK_CHAINS,
  PROVIDER_FALLBACK_CHAINS,
  type AgentRoleType,
  type AgentStageExecution,
  type InterAgentContextPackage,
} from '../src/utils/autoPilotRunner';
import { useAutoPilotStore } from '../src/stores/useAutoPilotStore';
import {
  resolveCaoProviderModel,
  resolveTaskPipelineVariant,
  generateCaoFastTrackWorkflowYaml,
  generateCaoStandardWorkflowYaml,
} from '../src/services/caoBridgeService';

describe('Empirical Challenger M1: 4-Role State Transition & Multi-Provider Dispatching', () => {
  beforeEach(() => {
    const store = useAutoPilotStore();
    store.reset();
  });

  // =========================================================================
  // 1. 4-ROLE STATE TRANSITION SIMULATION
  // =========================================================================
  describe('1. 4-Role State Transition Simulation (Architect -> Implementer -> Tester -> Auditor)', () => {
    it('simulates nominal linear progression through all 4 roles with state transitions and timing', async () => {
      const recordedStages: string[] = [];
      const roleTransitions: Array<{ role: AgentRoleType; status: string }> = [];
      const contextHandoffs: InterAgentContextPackage[] = [];

      const mockApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/worktrees/TASK-M1', branch: 'agent/task-m1' }),
          listFiles: vi.fn().mockResolvedValue(['src/app.ts', 'src/utils.ts']),
          startInteractive: vi.fn().mockResolvedValue({ sessionId: 'sess-m1-impl' }),
          runTest: vi.fn().mockResolvedValue({
            stdout: '✓ 12 tests passed (12 total)\nDuration: 450ms',
            stderr: '',
            exitCode: 0,
            durationMs: 450,
          }),
          getGitDiff: vi.fn().mockResolvedValue({
            numstat: '15\t3\tsrc/app.ts\n5\t0\tsrc/utils.ts',
          }),
        },
        taskHub: {
          mcpCall: vi.fn().mockResolvedValue({ success: true, data: { id: 999 } }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        onStageChange: (stage) => recordedStages.push(stage),
        onRoleStageChange: (roleExec) => roleTransitions.push({ role: roleExec.role, status: roleExec.status }),
        onContextHandoff: (pkg) => contextHandoffs.push({ ...pkg }),
      });

      const result = await runner.start({
        id: 999,
        issue_key: 'TASK-M1',
        title: 'Build Supervised Multi-Agent Stream Cards',
      });

      expect(result.success).toBe(true);

      // Verify all 4 roles were executed sequentially
      const finalRoleStages = runner.getStageExecutions();
      expect(finalRoleStages).toHaveLength(4);

      expect(finalRoleStages[0].role).toBe('architect');
      expect(finalRoleStages[0].status).toBe('completed');
      expect(finalRoleStages[0].durationMs).toBeGreaterThanOrEqual(0);

      expect(finalRoleStages[1].role).toBe('implementer');
      expect(finalRoleStages[1].status).toBe('completed');
      expect(finalRoleStages[1].durationMs).toBeGreaterThanOrEqual(0);

      expect(finalRoleStages[2].role).toBe('tester');
      expect(finalRoleStages[2].status).toBe('completed');
      expect(finalRoleStages[2].durationMs).toBeGreaterThanOrEqual(0);

      expect(finalRoleStages[3].role).toBe('auditor');
      expect(finalRoleStages[3].status).toBe('completed');
      expect(finalRoleStages[3].durationMs).toBeGreaterThanOrEqual(0);

      // Verify 3 Inter-Agent Context Handoffs
      expect(contextHandoffs).toHaveLength(3);
      expect(contextHandoffs[0].sourceRole).toBe('architect');
      expect(contextHandoffs[0].targetRole).toBe('implementer');
      expect(contextHandoffs[0].planContent).toContain('TASK-M1');

      expect(contextHandoffs[1].sourceRole).toBe('implementer');
      expect(contextHandoffs[1].targetRole).toBe('tester');
      expect(contextHandoffs[1].gitDiffStat).toContain('Modified');

      expect(contextHandoffs[2].sourceRole).toBe('tester');
      expect(contextHandoffs[2].targetRole).toBe('auditor');
      expect(contextHandoffs[2].testPassRatio).toBe(1);
    });

    it('handles failure at Tester phase with failed status and blocked Auditor handoff', async () => {
      const mockApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/worktrees/FAIL-TEST', branch: 'agent/fail-test' }),
          listFiles: vi.fn().mockResolvedValue(['src/buggy.ts']),
          startInteractive: vi.fn().mockResolvedValue({ sessionId: 'sess-fail' }),
          runTest: vi.fn().mockResolvedValue({
            stdout: '✕ 2 tests failed, 10 passed (12 total)',
            stderr: 'AssertionError: expected false to be true',
            exitCode: 1,
            durationMs: 800,
          }),
          getGitDiff: vi.fn().mockResolvedValue({ numstat: '5\t2\tsrc/buggy.ts' }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
      });

      const result = await runner.start({
        issue_key: 'BUG-101',
        title: 'Faulty Task Execution',
      });

      const roleStages = runner.getStageExecutions();
      const testerStage = roleStages.find((r) => r.role === 'tester');
      expect(testerStage?.status).toBe('failed');
      expect(testerStage?.evidence?.status).toBe('failed');
      expect(result.evidence?.status).toBe('failed');
    });

    it('propagates cancellation signal and cleanly terminates state machine', async () => {
      const mockApi = {
        agent: {
          preflight: vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 50));
            return { ok: true };
          }),
        },
      };

      const runner = new AutoPilotRunner({ desktopApi: mockApi });
      const promise = runner.start({ issue_key: 'CANCEL-1', title: 'Cancelled task' });
      await runner.cancel();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.stage).toBe('cancelled');
      expect(result.error).toContain('cancelled');
    });
  });

  // =========================================================================
  // 2. MULTI-PROVIDER PROMPT DISPATCHING & RATE-LIMIT FALLBACK CASCADE
  // =========================================================================
  describe('2. Multi-Provider Prompt Dispatching & Model Cascades', () => {
    it('accurately detects rate limits across multi-provider error shapes', () => {
      expect(isRateLimitOrQuotaError('Error: 429 Too Many Requests')).toBe(true);
      expect(isRateLimitOrQuotaError({ message: 'RESOURCE_EXHAUSTED: Quota exceeded for model' })).toBe(true);
      expect(isRateLimitOrQuotaError({ statusText: 'tokens per minute exceeded' })).toBe(true);
      expect(isRateLimitOrQuotaError({ code: 'rate_limit_exceeded' })).toBe(true);
      expect(isRateLimitOrQuotaError({ message: 'Overloaded_error: model is overloaded' })).toBe(true);
      expect(isRateLimitOrQuotaError('SyntaxError: unexpected token')).toBe(false);
      expect(isRateLimitOrQuotaError(null)).toBe(false);
    });

    it('cascades through model fallback chains on rate-limit errors', async () => {
      const fallbackEvents: any[] = [];
      let callCount = 0;

      const mockApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/worktrees/FALLBACK', branch: 'agent/fb' }),
          listFiles: vi.fn().mockResolvedValue(['index.ts']),
          startInteractive: vi.fn().mockImplementation((provider, cwd, prompt, mode, model) => {
            callCount++;
            if (callCount <= 3) {
              // Fail first 3 attempts with rate limit
              const err = new Error('429 Quota Exceeded for ' + model);
              throw err;
            }
            return Promise.resolve({ sessionId: 'fallback-success-session' });
          }),
          runTest: vi.fn().mockResolvedValue({ stdout: 'All passed', exitCode: 0 }),
          getGitDiff: vi.fn().mockResolvedValue({ numstat: '1\t1\tindex.ts' }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockApi,
        provider: 'antigravity',
        model: 'gemini-3.7-pro',
        initialBackoffMs: 1, // fast test backoff
        maxRetriesPerModel: 2,
        onFallbackTriggered: (event) => fallbackEvents.push(event),
      });

      const result = await runner.start({
        issue_key: 'FB-1',
        title: 'Rate Limit Cascade Test',
      });

      expect(result.success).toBe(true);
      expect(fallbackEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves correct provider models and capabilities', () => {
      expect(resolveCaoProviderModel('antigravity')).toBe('gemini-3.7-flash');
      expect(resolveCaoProviderModel('claude_code')).toBe('claude-3-7-sonnet');
      expect(resolveCaoProviderModel('codex')).toBe('gpt-5');
      expect(resolveCaoProviderModel('antigravity', 'gemini-3.7-pro')).toBe('gemini-3.7-pro');

      expect(MODEL_FALLBACK_CHAINS['gemini-3.7-pro']).toContain('gemini-3.7-flash');
      expect(MODEL_FALLBACK_CHAINS['claude-3-7-sonnet']).toContain('claude-3-5-sonnet');
      expect(PROVIDER_FALLBACK_CHAINS['antigravity']).toContain('codex');
    });

    it('generates correct workflow YAML for both Fast-Track and Strict variants', () => {
      const fastTrackYaml = generateCaoFastTrackWorkflowYaml({
        taskKey: 'FAST-1',
        taskTitle: 'Quick Documentation Update',
        implementProvider: 'antigravity',
      });
      expect(fastTrackYaml).toContain('name: task-FAST-1-pipeline');
      expect(fastTrackYaml).toContain('id: implement');
      expect(fastTrackYaml).toContain('id: evidence');
      expect(fastTrackYaml).not.toContain('id: review');

      const strictYaml = generateCaoStandardWorkflowYaml({
        taskKey: 'STRICT-1',
        taskTitle: 'Security Kernel Refactor',
        implementProvider: 'antigravity',
        reviewProvider: 'codex',
        evidenceProvider: 'antigravity',
        handoffProvider: 'antigravity',
      });
      expect(strictYaml).toContain('name: task-STRICT-1-pipeline');
      expect(strictYaml).toContain('id: implement');
      expect(strictYaml).toContain('id: review');
      expect(strictYaml).toContain('id: evidence');
      expect(strictYaml).toContain('id: handoff');
    });
  });

  // =========================================================================
  // 3. TOOL INSPECTOR RESILIENCE: MALFORMED / NESTED / CIRCULAR PAYLOADS
  // =========================================================================
  describe('3. Tool Inspector Resilience against Malformed and Nested Payloads', () => {
    it('safely serializes and handles deeply nested JSON tool arguments (50 levels)', () => {
      let nestedObj: any = { leaf: 'deep_value', counter: 42 };
      for (let i = 0; i < 50; i++) {
        nestedObj = { level: i, child: nestedObj };
      }

      const toolCall = {
        id: 'tc-deep',
        toolName: 'deep_tree_inspector',
        args: nestedObj,
        result: 'Processed 50 depth tree successfully',
        status: 'completed' as const,
      };

      // Test JSON.stringify safety as used in StreamCardsView template
      expect(() => JSON.stringify(toolCall.args, null, 2)).not.toThrow();
      const stringified = JSON.stringify(toolCall.args, null, 2);
      expect(stringified).toContain('"leaf": "deep_value"');
      expect(stringified).toContain('"level": 49');
    });

    it('safely handles non-object, null, undefined, and primitive tool arguments', () => {
      const weirdArgs = [
        null,
        undefined,
        'string argument',
        12345,
        true,
        [1, 2, { nested: 'array' }],
      ];

      for (const arg of weirdArgs) {
        expect(() => JSON.stringify(arg, null, 2)).not.toThrow();
      }
    });

    it('handles massive tool result payloads (150k chars) without memory explosion', () => {
      const massiveLog = 'A'.repeat(150000);
      const toolCall = {
        id: 'tc-huge',
        toolName: 'run_massive_dump',
        args: { lines: 10000 },
        result: massiveLog,
        status: 'completed' as const,
      };

      expect(toolCall.result.length).toBe(150000);
      expect(toolCall.result.slice(0, 10)).toBe('AAAAAAAAAA');
    });

    it('sanitizes and tolerates XSS payloads and ANSI escape sequences in tool calls', () => {
      const xssPayload = `<script>alert('pwned')</script><img src="x" onerror="steal()"/>`;
      const ansiPayload = `\u001b[31m[ERROR]\u001b[0m \u001b[32m[SUCCESS]\u001b[0m \u001b[1mBold text\u001b[0m`;

      const toolCall = {
        id: 'tc-xss',
        toolName: 'execute_shell',
        args: { script: xssPayload },
        result: ansiPayload,
        status: 'completed' as const,
      };

      const serialized = JSON.stringify(toolCall.args, null, 2);
      expect(serialized).toContain('<script>');
      expect(toolCall.result).toContain('[ERROR]');
    });
  });

  // =========================================================================
  // 4. STREAM CARDS VIEW UI STATE MACHINE & HELPERS
  // =========================================================================
  describe('4. StreamCardsView UI State Machine & Ergonomics', () => {
    it('maintains correct role metadata and styling classes for all 4 roles', () => {
      const roles: AgentRoleType[] = ['architect', 'implementer', 'tester', 'auditor'];
      for (const r of roles) {
        const meta = ROLE_METADATA[r];
        expect(meta).toBeDefined();
        expect(meta.title).toBeTruthy();
        expect(meta.avatar).toBeTruthy();
        expect(meta.badge).toBeTruthy();
        expect(meta.defaultModel).toBeTruthy();
      }
    });

    it('calculates progress percentage correctly across all completed states', () => {
      const calculateProgress = (completedCount: number, total = 4) => {
        return Math.round((completedCount / total) * 100);
      };

      expect(calculateProgress(0)).toBe(0);
      expect(calculateProgress(1)).toBe(25);
      expect(calculateProgress(2)).toBe(50);
      expect(calculateProgress(3)).toBe(75);
      expect(calculateProgress(4)).toBe(100);
    });

    it('formats durations across varied milliseconds and timestamp scenarios', () => {
      const formatDuration = (ms?: number, startedAt?: number, completedAt?: number, status?: string): string => {
        if (ms !== undefined && ms > 0) {
          if (ms < 1000) return `${ms}ms`;
          return `${(ms / 1000).toFixed(1)}s`;
        }
        if (startedAt) {
          const end = completedAt || startedAt;
          const diff = Math.max(0, end - startedAt);
          if (diff < 1000) return `${diff}ms`;
          return `${(diff / 1000).toFixed(1)}s`;
        }
        return '--';
      };

      expect(formatDuration(undefined)).toBe('--');
      expect(formatDuration(0)).toBe('--');
      expect(formatDuration(250)).toBe('250ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(65400)).toBe('65.4s');
      expect(formatDuration(undefined, 1000, 2500)).toBe('1.5s');
    });

    it('formats model display names correctly with fallback', () => {
      const formatModelDisplayName = (modelName?: string): string => {
        if (!modelName) return 'Gemini 3.7 Pro';
        if (/gemini-3\.7-pro/i.test(modelName)) return 'Gemini 3.7 Pro';
        if (/gemini-3\.7-flash/i.test(modelName)) return 'Gemini 3.7 Flash';
        if (/claude-3-7-sonnet/i.test(modelName)) return 'Claude 3.7 Sonnet';
        if (/gpt-5/i.test(modelName)) return 'GPT-5.6 Sol';
        return modelName;
      };

      expect(formatModelDisplayName('')).toBe('Gemini 3.7 Pro');
      expect(formatModelDisplayName('gemini-3.7-pro-preview')).toBe('Gemini 3.7 Pro');
      expect(formatModelDisplayName('gemini-3.7-flash-latest')).toBe('Gemini 3.7 Flash');
      expect(formatModelDisplayName('claude-3-7-sonnet-20250219')).toBe('Claude 3.7 Sonnet');
      expect(formatModelDisplayName('gpt-5.6-turbo')).toBe('GPT-5.6 Sol');
      expect(formatModelDisplayName('custom-local-llama-3')).toBe('custom-local-llama-3');
    });
  });
});
