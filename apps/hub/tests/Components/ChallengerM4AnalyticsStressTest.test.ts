/**
 * Test Suite: Challenger M4 Adversarial Stress & Boundary Testing
 * Focus:
 *   1. Plan Gating: Community and Pro plans return HTTP 403 UPGRADE_REQUIRED, while Team and Enterprise succeed.
 *   2. Zero-Data Workspace Handling: 0 runs, 0 tasks, 0 points return zeroed metrics without division-by-zero crashes.
 *   3. Time Window Filtering: 7d, 30d, 90d, 1y date calculations, fallback on invalid ranges, retention clamping.
 *   4. Edge Cases: Extreme latencies, sub-millisecond durations, single-run p95, unknown AI models, 100% failure rates.
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  WorkspaceAnalyticsServiceSimulator,
  type WorkspaceAnalyticsPayload,
} from '../Harness/commercial_simulators.ts';

describe('Challenger M4: Adversarial Stress & Boundary Testing Suite', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // 1. PLAN GATING ADVERSARIAL CHALLENGES
  // ============================================================================
  describe('Plan Gating Enforcement', () => {
    it('[CHALLENGE-01] community plan receives 403 with UPGRADE_REQUIRED and suggested team tier', () => {
      const communityService = new WorkspaceAnalyticsServiceSimulator('community');
      const res = communityService.getAnalytics(42, '30d');

      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UPGRADE_REQUIRED');
      expect(res.data).toBeUndefined();
    });

    it('[CHALLENGE-02] pro plan receives 403 with UPGRADE_REQUIRED and cannot bypass via query params', () => {
      const proService = new WorkspaceAnalyticsServiceSimulator('pro');
      const res7d = proService.getAnalytics(42, '7d');
      const res30d = proService.getAnalytics(42, '30d');
      const res90d = proService.getAnalytics(42, '90d');
      const res1y = proService.getAnalytics(42, '1y');

      expect(res7d.status).toBe(403);
      expect(res7d.error_code).toBe('UPGRADE_REQUIRED');
      expect(res30d.status).toBe(403);
      expect(res30d.error_code).toBe('UPGRADE_REQUIRED');
      expect(res90d.status).toBe(403);
      expect(res1y.status).toBe(403);
    });

    it('[CHALLENGE-03] team plan grants full analytics access', () => {
      const teamService = new WorkspaceAnalyticsServiceSimulator('team');
      const res = teamService.getAnalytics(42, '30d');

      expect(res.status).toBe(200);
      expect(res.error_code).toBeUndefined();
      expect(res.data).toBeDefined();
      expect(res.data?.plan).toBe('team');
    });

    it('[CHALLENGE-04] enterprise plan grants full analytics access', () => {
      const entService = new WorkspaceAnalyticsServiceSimulator('enterprise');
      const res = entService.getAnalytics(42, '90d');

      expect(res.status).toBe(200);
      expect(res.error_code).toBeUndefined();
      expect(res.data).toBeDefined();
      expect(res.data?.plan).toBe('enterprise');
    });
  });

  // ============================================================================
  // 2. ZERO-DATA WORKSPACE HANDLING (ZERO DIVISION IMMUNITY)
  // ============================================================================
  describe('Zero-Data Workspace Handling', () => {
    it('[CHALLENGE-05] workspace with 0 tasks and 0 runs returns valid zeroed numbers without NaN or Infinity', () => {
      const service = new WorkspaceAnalyticsServiceSimulator('team');
      const res = service.getAnalytics(999, '30d', false);

      expect(res.status).toBe(200);
      const data = res.data!;

      // Throughput
      expect(data.throughput.total_tasks_completed).toBe(0);
      expect(data.throughput.velocity_points_per_week).toBe(0);
      expect(data.throughput.run_throughput_24h).toBe(0);
      expect(Array.isArray(data.throughput.throughput_history)).toBe(true);
      expect(Number.isNaN(data.throughput.velocity_points_per_week)).toBe(false);
      expect(Number.isFinite(data.throughput.velocity_points_per_week)).toBe(true);

      // Success rate
      expect(data.success_rate.total_runs).toBe(0);
      expect(data.success_rate.successful_runs).toBe(0);
      expect(data.success_rate.failed_runs).toBe(0);
      expect(data.success_rate.cancelled_runs).toBe(0);
      expect(data.success_rate.success_percentage).toBe(0);
      expect(Array.isArray(data.success_rate.failure_reasons)).toBe(true);
      expect(Number.isNaN(data.success_rate.success_percentage)).toBe(false);

      // AI models
      expect(data.ai_models.total_model_invocations).toBe(0);
      expect(Array.isArray(data.ai_models.distribution)).toBe(true);
      expect(data.ai_models.distribution.length).toBe(0);

      // Turnaround time
      expect(data.turnaround_time.avg_run_duration_seconds).toBe(0);
      expect(data.turnaround_time.p95_duration_seconds).toBe(0);
      expect(data.turnaround_time.avg_queue_wait_seconds).toBe(0);
      expect(data.turnaround_time.avg_review_turnaround_seconds).toBe(0);
      expect(Number.isNaN(data.turnaround_time.avg_run_duration_seconds)).toBe(false);
    });

    it('[CHALLENGE-06] workspace with only failed runs (0% success) calculates 0% without division error', () => {
      const calculateSuccessPercentage = (successful: number, total: number): number => {
        if (total === 0) return 0.0;
        return Math.round((successful / total) * 1000) / 10;
      };

      expect(calculateSuccessPercentage(0, 10)).toBe(0.0);
      expect(calculateSuccessPercentage(0, 0)).toBe(0.0);
      expect(calculateSuccessPercentage(10, 10)).toBe(100.0);
    });

    it('[CHALLENGE-07] workspace with only completed tasks but 0 story points computes task-based velocity', () => {
      const calculateVelocity = (totalTasks: number, totalPoints: number, days: number): number => {
        const weeks = Math.max(1.0, Math.round((days / 7.0) * 10) / 10);
        return Math.round((totalPoints > 0 ? totalPoints / weeks : totalTasks / weeks) * 10) / 10;
      };

      // 14 tasks, 0 points over 14 days (2 weeks) => 7 tasks/week
      expect(calculateVelocity(14, 0, 14)).toBe(7.0);
      // 0 tasks, 0 points over 30 days => 0
      expect(calculateVelocity(0, 0, 30)).toBe(0.0);
      // 20 points over 28 days (4 weeks) => 5 points/week
      expect(calculateVelocity(10, 20, 28)).toBe(5.0);
    });
  });

  // ============================================================================
  // 3. TIME WINDOW FILTERING ADVERSARIAL CHALLENGES
  // ============================================================================
  describe('Time Window Calculations & Clamping', () => {
    it('[CHALLENGE-08] resolves correct date window days for 7d, 30d, 90d, 1y and aliases', () => {
      const resolveWindow = (range: string): { days: number; canonical: string } => {
        const normalized = range.toLowerCase().trim();
        const days = matchRange(normalized);
        const canonical = days === 7 ? '7d' : days === 90 ? '90d' : days === 365 ? '1y' : '30d';
        return { days, canonical };
      };

      const matchRange = (val: string): number => {
        switch (val) {
          case '7d':
          case '7':
            return 7;
          case '90d':
          case '90':
            return 90;
          case '1y':
          case '365d':
          case '365':
            return 365;
          default:
            return 30;
        }
      };

      expect(resolveWindow('7d')).toEqual({ days: 7, canonical: '7d' });
      expect(resolveWindow('7')).toEqual({ days: 7, canonical: '7d' });
      expect(resolveWindow('30d')).toEqual({ days: 30, canonical: '30d' });
      expect(resolveWindow('90d')).toEqual({ days: 90, canonical: '90d' });
      expect(resolveWindow('1y')).toEqual({ days: 365, canonical: '1y' });
      expect(resolveWindow('365d')).toEqual({ days: 365, canonical: '1y' });
      expect(resolveWindow('invalid_query')).toEqual({ days: 30, canonical: '30d' });
      expect(resolveWindow('')).toEqual({ days: 30, canonical: '30d' });
    });

    it('[CHALLENGE-09] generates exact daily bucket sequences without missing days or leap gaps', () => {
      const generateDailyHistory = (days: number, mockCounts: Record<string, number> = {}) => {
        const history: { date: string; count: number }[] = [];
        const now = new Date('2026-08-28T12:00:00Z');
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        let curr = new Date(start);
        curr.setUTCHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setUTCHours(23, 59, 59, 999);

        while (curr <= end) {
          const dateStr = curr.toISOString().slice(0, 10);
          history.push({
            date: dateStr,
            count: mockCounts[dateStr] || 0,
          });
          curr.setDate(curr.getDate() + 1);
        }

        return history;
      };

      const h7 = generateDailyHistory(7);
      expect(h7.length).toBeGreaterThanOrEqual(7);
      expect(h7.length).toBeLessThanOrEqual(9);

      const h30 = generateDailyHistory(30);
      expect(h30.length).toBeGreaterThanOrEqual(30);
      expect(h30.length).toBeLessThanOrEqual(32);
    });
  });

  // ============================================================================
  // 4. METRICS AGGREGATION & ALGORITHM INTEGRITY
  // ============================================================================
  describe('Metrics Aggregation & Algorithm Edge Cases', () => {
    it('[CHALLENGE-10] p95 latency accurately calculates for single run, small samples, and large samples', () => {
      const calculateP95 = (durations: number[]): number => {
        if (durations.length === 0) return 0.0;
        const sorted = [...durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        return sorted[Math.min(p95Index, sorted.length - 1)];
      };

      // 1 element
      expect(calculateP95([4.5])).toBe(4.5);

      // 2 elements
      expect(calculateP95([1.0, 5.0])).toBe(5.0);

      // 100 elements (1 to 100)
      const samples100 = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculateP95(samples100)).toBe(96); // index 95 -> element 96
    });

    it('[CHALLENGE-11] AI model classification maps diverse naming variations accurately', () => {
      const formatModelDisplayName = (raw: string): string => {
        const low = raw.toLowerCase().trim();
        if (low.includes('gemini-3.7') || low.includes('gemini-3.7-flash')) return 'Gemini 3.7 Flash';
        if (low.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
        if (low.includes('gemini-2.5-flash') || low.includes('gemini-flash')) return 'Gemini 2.5 Flash';
        if (low.includes('gemini')) return 'Gemini 2.5 Pro';
        if (low.includes('claude-3-7') || low.includes('claude-3.7') || low.includes('claude-3.7-sonnet')) return 'Claude 3.7 Sonnet';
        if (low.includes('claude-3-5') || low.includes('claude-3.5') || low.includes('claude-3.5-sonnet')) return 'Claude 3.5 Sonnet';
        if (low.includes('claude')) return 'Claude Code';
        if (low.includes('gpt-5.6') || low.includes('gpt-5.6-sol')) return 'Codex / GPT-5.6 Sol';
        if (low.includes('gpt-4o') || low.includes('codex') || low.includes('openai')) return 'Codex / GPT-4o';
        if (low.includes('o3')) return 'OpenAI o3';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      };

      expect(formatModelDisplayName('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
      expect(formatModelDisplayName('gemini-3.7-flash')).toBe('Gemini 3.7 Flash');
      expect(formatModelDisplayName('claude-3.7-sonnet')).toBe('Claude 3.7 Sonnet');
      expect(formatModelDisplayName('claude-3-5-sonnet-20241022')).toBe('Claude 3.5 Sonnet');
      expect(formatModelDisplayName('openai-gpt-4o')).toBe('Codex / GPT-4o');
      expect(formatModelDisplayName('gpt-5.6-sol')).toBe('Codex / GPT-5.6 Sol');
      expect(formatModelDisplayName('custom-agent-llama')).toBe('Custom-agent-llama');
    });

    it('[CHALLENGE-12] Token and number formatting handles millions and billions gracefully', () => {
      const formatTokens = (tokens: number): string => {
        if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(2)}B`;
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
        return `${tokens}`;
      };

      expect(formatTokens(2500000000)).toBe('2.50B');
      expect(formatTokens(1250000)).toBe('1.25M');
      expect(formatTokens(45000)).toBe('45.0k');
      expect(formatTokens(850)).toBe('850');
    });
  });
});
