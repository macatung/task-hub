import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PROVIDER_MODELS,
  DEFAULT_PROVIDER_MODELS,
  MODEL_FALLBACK_CHAINS,
  PROVIDER_FALLBACK_CHAINS,
  resolveAntigravityModelMapping,
  type Provider,
} from '../constants/models';
import {
  AutoPilotRunner,
  isRateLimitOrQuotaError,
  type FallbackEvent,
} from '../utils/autoPilotRunner';
import {
  DesktopHeartbeatService,
  type DesktopQuotaMetrics,
} from './desktopHeartbeat';
import { formatQuotaTelemetry } from '../composables/useTaskSync';

describe('Milestone 3 (R3): 2026 AI Model Registry, Dynamic Switching & Quota Telemetry Suite', () => {
  describe('1. 2026 AI Model Registry & Presets Parity', () => {
    it('contains authoritative 2026 flagship presets for all three providers', () => {
      const providers: Provider[] = ['antigravity', 'claude_code', 'codex'];
      for (const prov of providers) {
        expect(PROVIDER_MODELS[prov]).toBeDefined();
        expect(PROVIDER_MODELS[prov].length).toBeGreaterThanOrEqual(4);
      }

      // Antigravity 2026 models
      const agyIds = PROVIDER_MODELS.antigravity.map((m) => m.id);
      expect(agyIds).toContain('gemini-3.7-flash');
      expect(agyIds).toContain('gemini-3.7-pro');
      expect(agyIds).toContain('gemini-3.5-flash-medium');
      expect(agyIds).toContain('gemini-3.1-pro');

      // Claude Code 2026 models
      const claudeIds = PROVIDER_MODELS.claude_code.map((m) => m.id);
      expect(claudeIds).toContain('claude-3-7-sonnet');
      expect(claudeIds).toContain('claude-3-5-sonnet');
      expect(claudeIds).toContain('claude-3-5-haiku');
      expect(claudeIds).toContain('claude-3-opus');

      // Codex 2026 models
      const codexIds = PROVIDER_MODELS.codex.map((m) => m.id);
      expect(codexIds).toContain('gpt-5');
      expect(codexIds).toContain('gpt-5-mini');
      expect(codexIds).toContain('gpt-4.5-preview');
      expect(codexIds).toContain('o3-mini');
      expect(codexIds).toContain('o1');
    });

    it('defines authoritative default flagship models per provider', () => {
      expect(DEFAULT_PROVIDER_MODELS.antigravity).toBe('gemini-3.7-flash');
      expect(DEFAULT_PROVIDER_MODELS.claude_code).toBe('claude-3-7-sonnet');
      expect(DEFAULT_PROVIDER_MODELS.codex).toBe('gpt-5');
    });

    it('resolves Antigravity legacy model IDs and mappings accurately', () => {
      expect(resolveAntigravityModelMapping('gemini-3.7-flash')).toBe('gemini-3.7-flash-high');
      expect(resolveAntigravityModelMapping('gemini-3.7-flash-high')).toBe('gemini-3.7-flash-high');
      expect(resolveAntigravityModelMapping('gemini-3.7-pro')).toBe('gemini-3.7-pro');
      expect(resolveAntigravityModelMapping('gemini-3.6-flash')).toBe('gemini-3.6-flash-medium');
      expect(resolveAntigravityModelMapping('gemini-3.5-flash')).toBe('gemini-3.5-flash-medium');
      expect(resolveAntigravityModelMapping('gemini-3.5-flash-medium')).toBe('gemini-3.5-flash-medium');
      expect(resolveAntigravityModelMapping('gemini-3.1-pro')).toBe('gemini-3.1-pro');
      expect(resolveAntigravityModelMapping('default')).toBeUndefined();
      expect(resolveAntigravityModelMapping(undefined)).toBeUndefined();
    });

    it('provides multi-tier fallback chains for resilient agent execution', () => {
      expect(MODEL_FALLBACK_CHAINS['gemini-3.7-flash']).toBeDefined();
      expect(MODEL_FALLBACK_CHAINS['gemini-3.7-flash']).toContain('gemini-3.7-pro');
      expect(MODEL_FALLBACK_CHAINS['gemini-3.7-flash']).toContain('gemini-3.5-flash-medium');

      expect(MODEL_FALLBACK_CHAINS['claude-3-7-sonnet']).toBeDefined();
      expect(MODEL_FALLBACK_CHAINS['claude-3-7-sonnet']).toContain('claude-3-5-sonnet');

      expect(MODEL_FALLBACK_CHAINS['gpt-5']).toBeDefined();
      expect(MODEL_FALLBACK_CHAINS['gpt-5']).toContain('gpt-5-mini');

      expect(PROVIDER_FALLBACK_CHAINS.antigravity).toEqual(['claude_code', 'codex']);
      expect(PROVIDER_FALLBACK_CHAINS.claude_code).toEqual(['antigravity', 'codex']);
      expect(PROVIDER_FALLBACK_CHAINS.codex).toEqual(['antigravity', 'claude_code']);
    });
  });

  describe('2. Rate-Limit & Quota-Exceeded Fallback Cascade in AutoPilotRunner', () => {
    it('detects rate-limit and quota error patterns reliably', () => {
      expect(isRateLimitOrQuotaError('HTTP 429 Too Many Requests')).toBe(true);
      expect(isRateLimitOrQuotaError('RESOURCE_EXHAUSTED: quota exceeded for model')).toBe(true);
      expect(isRateLimitOrQuotaError('rate_limit_exceeded: TPM limit reached')).toBe(true);
      expect(isRateLimitOrQuotaError('insufficient_quota: credit balance too low')).toBe(true);
      expect(isRateLimitOrQuotaError('overloaded_error: The model is overloaded')).toBe(true);
      expect(isRateLimitOrQuotaError(new Error('Rate limit reached (429)'))).toBe(true);
      expect(isRateLimitOrQuotaError({ message: 'rate_limit_exceeded' })).toBe(true);

      expect(isRateLimitOrQuotaError('SyntaxError: unexpected token')).toBe(false);
      expect(isRateLimitOrQuotaError('File not found: package.json')).toBe(false);
      expect(isRateLimitOrQuotaError(null)).toBe(false);
      expect(isRateLimitOrQuotaError(undefined)).toBe(false);
    });

    it('performs retry with exponential backoff on retriable rate limit', async () => {
      let attempts = 0;
      const fallbackEvents: FallbackEvent[] = [];

      const mockDesktopApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/mock/worktree', branch: 'agent/task-1' }),
          configureMcp: vi.fn().mockResolvedValue({ ok: true }),
          startInteractive: vi.fn().mockImplementation(async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('HTTP 429: Rate limit exceeded. Please retry in a moment.');
            }
            return { sessionId: 'sess-success-after-retry' };
          }),
          listFiles: vi.fn().mockResolvedValue([]),
          readFile: vi.fn().mockResolvedValue(''),
          runTest: vi.fn().mockResolvedValue({ stdout: 'All tests passed (10/10)', exitCode: 0 }),
          getGitDiff: vi.fn().mockResolvedValue({ numstat: '5\t2\tsrc/app.ts\n' }),
        },
        taskHub: {
          mcpCall: vi.fn().mockResolvedValue({ data: { id: 100 } }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockDesktopApi,
        provider: 'antigravity',
        model: 'gemini-3.7-flash',
        initialBackoffMs: 10,
        maxRetriesPerModel: 4,
        onFallbackTriggered: (event) => fallbackEvents.push(event),
      });

      const result = await runner.start({
        id: 1,
        issue_key: 'TASK-RATE-LIMIT',
        title: 'Rate Limit Retry Test',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
      expect(attempts).toBe(3);
      expect(fallbackEvents.length).toBe(2);
      expect(fallbackEvents[0].reason.toLowerCase()).toContain('rate limit');
      expect(fallbackEvents[0].attempt).toBe(1);
      expect(fallbackEvents[1].attempt).toBe(2);
    });

    it('cascades to fallback model when current model quota is exhausted', async () => {
      const modelsAttempted: string[] = [];
      const fallbackEvents: FallbackEvent[] = [];

      const mockDesktopApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/mock/worktree', branch: 'agent/task-2' }),
          configureMcp: vi.fn().mockResolvedValue({ ok: true }),
          startInteractive: vi.fn().mockImplementation(async (_prov, _cwd, _prompt, _kind, model) => {
            modelsAttempted.push(model);
            if (model === 'gemini-3.7-flash') {
              throw new Error('RESOURCE_EXHAUSTED: Model gemini-3.7-flash daily quota exceeded.');
            }
            return { sessionId: 'sess-fallback-success' };
          }),
          listFiles: vi.fn().mockResolvedValue([]),
          readFile: vi.fn().mockResolvedValue(''),
          runTest: vi.fn().mockResolvedValue({ stdout: 'PASSED 5/5', exitCode: 0 }),
          getGitDiff: vi.fn().mockResolvedValue({ numstat: '1\t1\tsrc/model.ts\n' }),
        },
        taskHub: {
          mcpCall: vi.fn().mockResolvedValue({ data: { id: 101 } }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockDesktopApi,
        provider: 'antigravity',
        model: 'gemini-3.7-flash',
        initialBackoffMs: 5,
        maxRetriesPerModel: 1, // trigger model step-down immediately
        onFallbackTriggered: (event) => fallbackEvents.push(event),
      });

      const result = await runner.start({
        id: 2,
        issue_key: 'TASK-CASCADE',
        title: 'Model Cascade Test',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
      expect(modelsAttempted).toContain('gemini-3.7-flash');
      expect(modelsAttempted).toContain('gemini-3.7-pro');
      expect(fallbackEvents.some((e) => e.nextModel === 'gemini-3.7-pro')).toBe(true);
    });

    it('cascades cross-provider when all models of primary provider are exhausted', async () => {
      const providersAttempted: string[] = [];
      const fallbackEvents: FallbackEvent[] = [];

      const mockDesktopApi = {
        agent: {
          preflight: vi.fn().mockResolvedValue({ ok: true }),
          createWorktree: vi.fn().mockResolvedValue({ path: '/mock/worktree', branch: 'agent/task-3' }),
          configureMcp: vi.fn().mockResolvedValue({ ok: true }),
          startInteractive: vi.fn().mockImplementation(async (prov) => {
            providersAttempted.push(prov);
            if (prov === 'antigravity') {
              throw new Error('RESOURCE_EXHAUSTED: All Antigravity quota exhausted.');
            }
            return { sessionId: 'sess-claude-success' };
          }),
          listFiles: vi.fn().mockResolvedValue([]),
          readFile: vi.fn().mockResolvedValue(''),
          runTest: vi.fn().mockResolvedValue({ stdout: 'PASSED', exitCode: 0 }),
          getGitDiff: vi.fn().mockResolvedValue({ numstat: '3\t0\tsrc/cross.ts\n' }),
        },
        taskHub: {
          mcpCall: vi.fn().mockResolvedValue({ data: { id: 102 } }),
        },
      };

      const runner = new AutoPilotRunner({
        desktopApi: mockDesktopApi,
        provider: 'antigravity',
        model: 'gemini-3.7-flash',
        initialBackoffMs: 5,
        maxRetriesPerModel: 1,
        onFallbackTriggered: (event) => fallbackEvents.push(event),
      });

      const result = await runner.start({
        id: 3,
        issue_key: 'TASK-CROSS-PROVIDER',
        title: 'Cross Provider Fallback Test',
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('completed');
      expect(providersAttempted).toContain('antigravity');
      expect(providersAttempted).toContain('claude_code');
      expect(fallbackEvents.some((e) => e.nextProvider === 'claude_code')).toBe(true);
    });
  });

  describe('3. Telemetry & Real-Time Quota Sync to Web Hub', () => {
    let fetchMock: any;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          health: 'healthy',
          server_time: new Date().toISOString(),
          commands: [],
        }),
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('formats raw quota into structured telemetry payload', () => {
      const rawQuota = {
        plan: 'Google AI Ultra',
        gemini: {
          usedTokens: 450000,
          totalLimitTokens: 2000000,
          weeklyRemainingPercent: 77,
          fiveHourRemainingPercent: 95,
          weeklyResetIn: '4 days',
          fiveHourResetIn: '3h 20m',
        },
        claudeGpt: {
          usedTokens: 60000,
          totalLimitTokens: 1000000,
          weeklyRemainingPercent: 94,
          fiveHourRemainingPercent: 100,
        },
        codex: {
          usedTokens: 15000,
          totalLimitTokens: 1000000,
          weeklyRemainingPercent: 98,
          fiveHourRemainingPercent: 99,
        },
      };

      const formatted = formatQuotaTelemetry(rawQuota);
      expect(formatted).toBeDefined();
      expect(formatted.plan).toBe('Google AI Ultra');
      expect(formatted.gemini.used_tokens).toBe(450000);
      expect(formatted.gemini.limit).toBe(2000000);
      expect(formatted.gemini.weekly_percent).toBe(77);
      expect(formatted.gemini.five_hour_percent).toBe(95);
      expect(formatted.gemini.weekly_reset_in).toBe('4 days');
      expect(formatted.gemini.five_hour_reset_in).toBe('3h 20m');

      expect(formatted.claude_gpt.used_tokens).toBe(60000);
      expect(formatted.codex.used_tokens).toBe(15000);
    });

    it('includes active_model, quota_metrics, and active_run_ids in heartbeat telemetry', async () => {
      const heartbeatService = new DesktopHeartbeatService({
        baseUrl: 'http://localhost:8000',
        token: 'auth-token-xyz',
        fetchFn: fetchMock,
      });

      heartbeatService.setActiveModel('gemini-3.7-flash');
      heartbeatService.setActiveRunIds([42, 43]);

      const quotaData: DesktopQuotaMetrics = {
        plan: 'Team Enterprise',
        gemini: { used_tokens: 120000, limit: 2000000, weekly_percent: 94, five_hour_percent: 99 },
        claude_gpt: { used_tokens: 35000, limit: 1000000, weekly_percent: 96, five_hour_percent: 100 },
        codex: { used_tokens: 8000, limit: 1000000, weekly_percent: 99, five_hour_percent: 100 },
      };
      heartbeatService.setQuotaMetrics(quotaData);

      const response = await heartbeatService.sendHeartbeat();

      expect(response).toBeDefined();
      expect(response?.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const calledUrl = fetchMock.mock.calls[0][0];
      const calledOpts = fetchMock.mock.calls[0][1];
      expect(calledUrl).toBe('http://localhost:8000/api/v1/desktop/agents/heartbeat');
      expect(calledOpts.headers['Authorization']).toBe('Bearer auth-token-xyz');

      const sentBody = JSON.parse(calledOpts.body);
      expect(sentBody.active_model).toBe('gemini-3.7-flash');
      expect(sentBody.status).toBe('busy');
      expect(sentBody.active_run_ids).toEqual([42, 43]);
      expect(sentBody.quota_metrics.plan).toBe('Team Enterprise');
      expect(sentBody.quota_metrics.gemini.used_tokens).toBe(120000);
    });

    it('dynamically updates heartbeat telemetry when quota or active model changes', async () => {
      const heartbeatService = new DesktopHeartbeatService({
        baseUrl: 'http://localhost:8000',
        fetchFn: fetchMock,
      });

      heartbeatService.setActiveModel('claude-3-7-sonnet');
      let telemetry = heartbeatService.getTelemetry();
      expect(telemetry.active_model).toBe('claude-3-7-sonnet');

      heartbeatService.setActiveModel('gpt-5');
      telemetry = heartbeatService.getTelemetry();
      expect(telemetry.active_model).toBe('gpt-5');

      heartbeatService.addActiveRunId(99);
      expect(heartbeatService.getActiveRunIds()).toContain(99);

      heartbeatService.removeActiveRunId(99);
      expect(heartbeatService.getActiveRunIds()).not.toContain(99);
    });
  });
});
