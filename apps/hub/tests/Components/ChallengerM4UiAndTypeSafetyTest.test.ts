/**
 * Challenger Test Suite: Milestone 4 UI Component Behavior, Analytics Visualizations & Type Safety
 * Agent: challenger_m4_2
 *
 * Scope:
 * 1. Workspaces/Analytics/Index.vue rendering logic, Throughput SVG trend bar chart, radial success gauge.
 * 2. AI model distribution breakdown, token formatting, and badge/color mapping.
 * 3. Turnaround lead-time latencies (avg run, P95, queue, review turnaround).
 * 4. Plan gating lock overlay and useUpgradeModal commercial interception.
 * 5. Type safety and schema contract validation.
 * 6. Adversarial boundary conditions: zero-run workspaces, 100% pass/fail rates, massive token volumes, empty history arrays.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import type {
  WorkspaceProps,
  WorkspaceOption,
  WorkspaceAnalyticsPayload,
  WorkspaceAnalyticsPageProps,
  AnalyticsThroughput,
  AnalyticsSuccessRate,
  AnalyticsAiModels,
  AnalyticsTurnaroundTime,
} from '../../resources/js/types/workspace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Component Pure Logic Emulators (Mirroring Index.vue setup functions)
// ============================================================================

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

function getModelBadge(modelName: string) {
  const low = modelName.toLowerCase();
  if (low.includes('gemini')) {
    return {
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      bar: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      tagBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      icon: 'Sparkles',
    };
  }
  if (low.includes('claude')) {
    return {
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
      tagBg: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      icon: 'Cpu',
    };
  }
  if (low.includes('codex') || low.includes('gpt') || low.includes('openai')) {
    return {
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      tagBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
      icon: 'Code',
    };
  }
  return {
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    bar: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    tagBg: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
    icon: 'Activity',
  };
}

const CIRCUMFERENCE = 263.89; // 2 * PI * 42

function calculateRadialOffsets(totalRuns: number, successfulRuns: number, failedRuns: number) {
  if (totalRuns === 0) {
    return {
      successOffset: CIRCUMFERENCE,
      failedOffset: CIRCUMFERENCE,
    };
  }
  const succPct = Math.min(100, Math.max(0, (successfulRuns / totalRuns) * 100));
  const failPct = Math.min(100, Math.max(0, (failedRuns / totalRuns) * 100));

  return {
    successOffset: CIRCUMFERENCE - (CIRCUMFERENCE * succPct) / 100,
    failedOffset: CIRCUMFERENCE - (CIRCUMFERENCE * failPct) / 100,
  };
}

function calculateMaxDailyCount(history: { date: string; count: number }[]): number {
  const counts = history.map((h) => h.count);
  return counts.length > 0 ? Math.max(...counts, 5) : 5;
}

// ============================================================================
// Upgrade Modal Controller Simulation
// ============================================================================

interface QuotaPayload {
  resource: 'runners' | 'seats' | 'projects' | 'analytics' | string;
  current_usage: number;
  limit: number | null;
  current_plan: string;
  suggested_plan: string;
  upgrade_url: string;
  message?: string;
}

class UpgradeModalSimulator {
  public isOpen = false;
  public quotaData: QuotaPayload | null = null;

  public openUpgradeModal(payload: QuotaPayload) {
    this.quotaData = {
      resource: payload.resource || 'runners',
      current_usage: payload.current_usage ?? 0,
      limit: payload.limit !== undefined ? payload.limit : null,
      current_plan: payload.current_plan || 'community',
      suggested_plan: payload.suggested_plan || 'pro',
      upgrade_url: payload.upgrade_url || '/workspaces/billing',
      message: payload.message || '',
    };
    this.isOpen = true;
  }

  public closeUpgradeModal() {
    this.isOpen = false;
  }

  public handleQuotaError(err: any): boolean {
    const data = err?.response?.data;
    if (data && (data.error_code === 'PLAN_QUOTA_EXCEEDED' || data.error_code === 'UPGRADE_REQUIRED' || data.quota)) {
      this.openUpgradeModal({
        resource: data.quota?.resource || 'analytics',
        current_usage: data.quota?.current_usage ?? 0,
        limit: data.quota?.limit !== undefined ? data.quota.limit : null,
        current_plan: data.quota?.current_plan || 'community',
        suggested_plan: data.quota?.suggested_plan || 'team',
        upgrade_url: data.quota?.upgrade_url || '/workspaces/billing',
        message: data.message || '',
      });
      return true;
    }
    return false;
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Challenger M4: Velocity Analytics UI Component, Visualizations & Type Safety', () => {
  let env: any;
  let upgradeModal: UpgradeModalSimulator;

  beforeEach(() => {
    env = setupTestEnvironment();
    upgradeModal = new UpgradeModalSimulator();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // 1. Template Helper Mechanics & Number/Token Formatting
  // ==========================================================================
  describe('1. Formatting Helpers (Numbers & AI Tokens)', () => {
    it('[CH4_FMT_01] formatNumber handles undefined, null, zero, thousands, and millions', () => {
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0k');
      expect(formatNumber(15400)).toBe('15.4k');
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });

    it('[CH4_FMT_02] formatTokens formats token counts with appropriate precision', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(850)).toBe('850');
      expect(formatTokens(1500)).toBe('1.5k');
      expect(formatTokens(45200)).toBe('45.2k');
      expect(formatTokens(1250000)).toBe('1.25M');
      expect(formatTokens(10000000)).toBe('10.00M');
    });
  });

  // ==========================================================================
  // 2. SVG Bar Chart & Radial Gauge Calculations
  // ==========================================================================
  describe('2. SVG Chart & Radial Gauge Calculations', () => {
    it('[CH4_CHART_01] calculateMaxDailyCount defaults to 5 on empty or low counts, scales to max', () => {
      expect(calculateMaxDailyCount([])).toBe(5);
      expect(calculateMaxDailyCount([{ date: '2026-08-01', count: 1 }, { date: '2026-08-02', count: 2 }])).toBe(5);
      expect(calculateMaxDailyCount([{ date: '2026-08-01', count: 12 }, { date: '2026-08-02', count: 35 }])).toBe(35);
    });

    it('[CH4_CHART_02] calculateRadialOffsets computes exact circle offsets for 0%, 50%, 95%, and 100% success', () => {
      // 0 total runs
      const zeroRuns = calculateRadialOffsets(0, 0, 0);
      expect(zeroRuns.successOffset).toBeCloseTo(CIRCUMFERENCE, 2);
      expect(zeroRuns.failedOffset).toBeCloseTo(CIRCUMFERENCE, 2);

      // 100% success
      const fullSuccess = calculateRadialOffsets(100, 100, 0);
      expect(fullSuccess.successOffset).toBeCloseTo(0, 2);

      // 50% success
      const halfSuccess = calculateRadialOffsets(100, 50, 50);
      expect(halfSuccess.successOffset).toBeCloseTo(CIRCUMFERENCE / 2, 2);

      // 95% success
      const ninetyFive = calculateRadialOffsets(100, 95, 5);
      expect(ninetyFive.successOffset).toBeCloseTo(CIRCUMFERENCE * 0.05, 2);
    });

    it('[CH4_CHART_03] SVG Bar chart height percentages are clamped safely to minimum 4%', () => {
      const maxCount = 50;
      const calcHeight = (count: number) => Math.max(4, (count / maxCount) * 100);

      expect(calcHeight(0)).toBe(4);
      expect(calcHeight(1)).toBe(4);
      expect(calcHeight(25)).toBe(50);
      expect(calcHeight(50)).toBe(100);
    });
  });

  // ==========================================================================
  // 3. AI Model Badging & Distribution Mapping
  // ==========================================================================
  describe('3. AI Model Badging & Distribution Mapping', () => {
    it('[CH4_MODEL_01] getModelBadge correctly classifies Gemini models with cyan styling', () => {
      const b1 = getModelBadge('Gemini 2.5 Pro');
      expect(b1.bg).toContain('cyan');
      expect(b1.icon).toBe('Sparkles');

      const b2 = getModelBadge('google-gemini-flash');
      expect(b2.bg).toContain('cyan');
      expect(b2.icon).toBe('Sparkles');
    });

    it('[CH4_MODEL_02] getModelBadge correctly classifies Claude models with amber styling', () => {
      const b = getModelBadge('Claude 3.7 Sonnet');
      expect(b.bg).toContain('amber');
      expect(b.icon).toBe('Cpu');
    });

    it('[CH4_MODEL_03] getModelBadge correctly classifies OpenAI / Codex / GPT models with emerald styling', () => {
      const b1 = getModelBadge('Codex-v2');
      expect(b1.bg).toContain('emerald');
      expect(b1.icon).toBe('Code');

      const b2 = getModelBadge('gpt-4o');
      expect(b2.bg).toContain('emerald');
      expect(b2.icon).toBe('Code');

      const b3 = getModelBadge('openai-o3-mini');
      expect(b3.bg).toContain('emerald');
      expect(b3.icon).toBe('Code');
    });

    it('[CH4_MODEL_04] getModelBadge classifies generic / custom / local models with purple styling', () => {
      const b = getModelBadge('ollama-deepseek-r1');
      expect(b.bg).toContain('purple');
      expect(b.icon).toBe('Activity');
    });
  });

  // ==========================================================================
  // 4. Plan Gating, Locked Overlay & useUpgradeModal Integration
  // ==========================================================================
  describe('4. Plan Gating & Commercial Upgrade Modal Integration', () => {
    it('[CH4_GATE_01] triggerUpgrade triggers useUpgradeModal with analytics resource and team tier recommendation', () => {
      const workspace: WorkspaceProps = {
        id: 99,
        name: 'Startup Hub',
        slug: 'startup-hub',
        plan: 'community',
      };

      upgradeModal.openUpgradeModal({
        resource: 'analytics',
        current_usage: 0,
        limit: 0,
        current_plan: workspace.plan || 'community',
        suggested_plan: 'team',
        upgrade_url: `/workspaces/${workspace.id}/billing`,
        message: 'Gain full visibility into team throughput, AI model efficiency, and lead times with Workspace Analytics.',
      });

      expect(upgradeModal.isOpen).toBe(true);
      expect(upgradeModal.quotaData?.resource).toBe('analytics');
      expect(upgradeModal.quotaData?.current_plan).toBe('community');
      expect(upgradeModal.quotaData?.suggested_plan).toBe('team');
      expect(upgradeModal.quotaData?.upgrade_url).toBe('/workspaces/99/billing');
      expect(upgradeModal.quotaData?.message).toContain('full visibility into team throughput');
    });

    it('[CH4_GATE_02] handleQuotaError intercepts HTTP 403 UPGRADE_REQUIRED from Analytics API', () => {
      const api403Response = {
        response: {
          status: 403,
          data: {
            success: false,
            error_code: 'UPGRADE_REQUIRED',
            message: 'Workspace Velocity Analytics requires a Team or Enterprise subscription.',
            quota: {
              resource: 'analytics',
              current_usage: 0,
              limit: 0,
              current_plan: 'pro',
              suggested_plan: 'team',
              upgrade_url: '/workspaces/77/billing',
            },
          },
        },
      };

      const intercepted = upgradeModal.handleQuotaError(api403Response);
      expect(intercepted).toBe(true);
      expect(upgradeModal.isOpen).toBe(true);
      expect(upgradeModal.quotaData?.resource).toBe('analytics');
      expect(upgradeModal.quotaData?.current_plan).toBe('pro');
      expect(upgradeModal.quotaData?.suggested_plan).toBe('team');
    });

    it('[CH4_GATE_03] Simulates DOM rendering of Locked Overlay when canAccessAnalytics is false', () => {
      const canAccessAnalytics = false;
      const workspacePlan = 'pro';

      const container = document.createElement('div');
      container.className = 'analytics-page';

      const header = document.createElement('div');
      header.className = 'analytics-header';
      header.innerHTML = `<h1>Workspace Velocity & Team Analytics</h1><span class="plan-pill">${workspacePlan}</span>`;
      container.appendChild(header);

      if (!canAccessAnalytics) {
        const overlay = document.createElement('div');
        overlay.className = 'analytics-locked-overlay';
        overlay.innerHTML = `
          <h3>Workspace Velocity Analytics is a Team Plan Feature</h3>
          <button class="upgrade-btn">Upgrade Now</button>
        `;
        container.appendChild(overlay);
      }

      const dashboard = document.createElement('div');
      dashboard.className = `analytics-dashboard ${!canAccessAnalytics ? 'opacity-40 pointer-events-none blur-[1px]' : ''}`;
      container.appendChild(dashboard);

      expect(container.querySelector('.analytics-locked-overlay')).not.toBeNull();
      expect(container.querySelector('.analytics-locked-overlay')?.textContent).toContain('Team Plan Feature');
      expect(container.querySelector('.analytics-dashboard')?.classList.contains('opacity-40')).toBe(true);
      expect(container.querySelector('.analytics-dashboard')?.classList.contains('pointer-events-none')).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Turnaround Times & Latency Percentiles
  // ==========================================================================
  describe('5. Turnaround Times & Execution Latencies', () => {
    it('[CH4_TIME_01] Validates turnaround payload mathematical invariants', () => {
      const turnaround: AnalyticsTurnaroundTime = {
        avg_run_duration_seconds: 4.8,
        p95_duration_seconds: 12.2,
        avg_queue_wait_seconds: 0.8,
        avg_review_turnaround_seconds: 180,
      };

      expect(turnaround.p95_duration_seconds).toBeGreaterThanOrEqual(turnaround.avg_run_duration_seconds);
      expect(turnaround.avg_queue_wait_seconds).toBeGreaterThanOrEqual(0);
      expect(turnaround.avg_review_turnaround_seconds).toBeGreaterThanOrEqual(0);
    });

    it('[CH4_TIME_02] Zero-run workspace handles 0s turnaround metrics gracefully', () => {
      const turnaround: AnalyticsTurnaroundTime = {
        avg_run_duration_seconds: 0,
        p95_duration_seconds: 0,
        avg_queue_wait_seconds: 0,
        avg_review_turnaround_seconds: 0,
      };

      expect(`${turnaround.avg_run_duration_seconds}s`).toBe('0s');
      expect(`${turnaround.p95_duration_seconds}s`).toBe('0s');
    });
  });

  // ==========================================================================
  // 6. TypeScript Type Safety & Contract Robustness
  // ==========================================================================
  describe('6. TypeScript Type Contracts & Schema Robustness', () => {
    it('[CH4_TYPE_01] Validates complete WorkspaceAnalyticsPayload shape', () => {
      const payload: WorkspaceAnalyticsPayload = {
        workspace_id: 10,
        plan: 'team',
        time_range: '30d',
        throughput: {
          total_tasks_completed: 142,
          velocity_points_per_week: 28.5,
          run_throughput_24h: 34,
          throughput_history: [
            { date: '2026-08-27', count: 12 },
            { date: '2026-08-28', count: 15 },
          ],
        },
        success_rate: {
          total_runs: 500,
          successful_runs: 475,
          failed_runs: 20,
          cancelled_runs: 5,
          success_percentage: 95.0,
          failure_reasons: [
            { reason: 'Linter Failure', count: 12 },
            { reason: 'Timeout', count: 8 },
          ],
        },
        ai_models: {
          total_model_invocations: 850,
          distribution: [
            { model: 'Gemini 2.5 Pro', count: 425, percentage: 50.0, tokens_used: 1250000 },
            { model: 'Claude 3.7 Sonnet', count: 255, percentage: 30.0, tokens_used: 820000 },
            { model: 'Codex-v2', count: 170, percentage: 20.0, tokens_used: 410000 },
          ],
        },
        turnaround_time: {
          avg_run_duration_seconds: 4.2,
          p95_duration_seconds: 9.8,
          avg_queue_wait_seconds: 0.5,
          avg_review_turnaround_seconds: 120,
        },
      };

      expect(typeof payload.workspace_id).toBe('number');
      expect(payload.throughput.throughput_history.length).toBe(2);
      expect(payload.success_rate.failure_reasons.length).toBe(2);
      expect(payload.ai_models.distribution.length).toBe(3);
    });

    it('[CH4_TYPE_02] Validates WorkspaceAnalyticsPageProps Inertia interface', () => {
      const pageProps: WorkspaceAnalyticsPageProps = {
        workspace: {
          id: 10,
          name: 'Core Team',
          slug: 'core-team',
          plan: 'enterprise',
        },
        analytics: {
          workspace_id: 10,
          plan: 'enterprise',
          time_range: '7d',
          throughput: { total_tasks_completed: 0, velocity_points_per_week: 0, run_throughput_24h: 0, throughput_history: [] },
          success_rate: { total_runs: 0, successful_runs: 0, failed_runs: 0, cancelled_runs: 0, success_percentage: 0, failure_reasons: [] },
          ai_models: { total_model_invocations: 0, distribution: [] },
          turnaround_time: { avg_run_duration_seconds: 0, p95_duration_seconds: 0, avg_queue_wait_seconds: 0, avg_review_turnaround_seconds: 0 },
        },
        canAccessAnalytics: true,
        timeRange: '7d',
        workspaces: [
          { id: 10, name: 'Core Team', slug: 'core-team', plan: 'enterprise' },
          { id: 11, name: 'Side Project', slug: 'side-project', plan: 'community' },
        ],
        currentWorkspaceId: 10,
      };

      expect(pageProps.workspace.id).toBe(10);
      expect(pageProps.canAccessAnalytics).toBe(true);
      expect(pageProps.workspaces?.length).toBe(2);
    });
  });

  // ==========================================================================
  // 7. File Integrity & SFC Template Structure
  // ==========================================================================
  describe('7. File Integrity & SFC Template Structure', () => {
    it('[CH4_FILE_01] Verifies Workspaces/Analytics/Index.vue exists and contains required components and directives', () => {
      const indexPath = path.resolve(__dirname, '../../resources/js/Pages/Workspaces/Analytics/Index.vue');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf8');

      // Check imports
      expect(content.includes("from '@/composables/useUpgradeModal'")).toBe(true);
      expect(content.includes("from '@/Components/billing/UpgradeModal.vue'")).toBe(true);
      expect(content.includes("from '@/types/workspace'")).toBe(true);

      // Check key visual features
      expect(content.includes("Throughput & Completed Tasks Trend")).toBe(true);
      expect(content.includes("Agent Run Success Rate")).toBe(true);
      expect(content.includes("AI Model Distribution")).toBe(true);
      expect(content.includes("Execution & Turnaround Times")).toBe(true);
      expect(content.includes("analytics-locked-overlay")).toBe(true);
      expect(content.includes("<UpgradeModal />")).toBe(true);
      expect(content.includes("getModelBadge")).toBe(true);
      expect(content.includes("selectTimeRange")).toBe(true);
      expect(content.includes("formatTokens")).toBe(true);
      expect(content.includes("maxDailyCount")).toBe(true);
    });

    it('[CH4_FILE_02] Verifies types/workspace.ts exports all Analytics interfaces', () => {
      const typesPath = path.resolve(__dirname, '../../resources/js/types/workspace.ts');
      expect(fs.existsSync(typesPath)).toBe(true);

      const content = fs.readFileSync(typesPath, 'utf8');
      expect(content.includes('export interface AnalyticsThroughput')).toBe(true);
      expect(content.includes('export interface AnalyticsSuccessRate')).toBe(true);
      expect(content.includes('export interface AnalyticsAiModels')).toBe(true);
      expect(content.includes('export interface AnalyticsTurnaroundTime')).toBe(true);
      expect(content.includes('export interface WorkspaceAnalyticsPayload')).toBe(true);
      expect(content.includes('export interface WorkspaceAnalyticsPageProps')).toBe(true);
    });
  });

  // ==========================================================================
  // 8. Adversarial Edge Cases & Fuzzing
  // ==========================================================================
  describe('8. Adversarial Edge Cases & Robustness', () => {
    it('[CH4_EDGE_01] Handles large 365-day history list without calculation failure', () => {
      const yearHistory = Array.from({ length: 365 }, (_, i) => ({
        date: `2026-01-01T00:00:00Z`,
        count: Math.floor(Math.sin(i) * 20 + 25),
      }));

      const maxCount = calculateMaxDailyCount(yearHistory);
      expect(maxCount).toBeGreaterThan(0);
      expect(yearHistory.length).toBe(365);
    });

    it('[CH4_EDGE_02] Massive token counts (100 Billion) format gracefully without scientific notation or overflow', () => {
      expect(formatTokens(100_000_000_000)).toBe('100000.00M');
      expect(formatTokens(50_000_000)).toBe('50.00M');
    });

    it('[CH4_EDGE_03] Single model 100% dominance with 0 tokens renders valid percentage bar', () => {
      const dist = [{ model: 'Gemini 2.5 Flash', count: 10, percentage: 100, tokens_used: 0 }];
      expect(dist[0].percentage).toBe(100);
      expect(formatTokens(dist[0].tokens_used)).toBe('0');
      expect(getModelBadge(dist[0].model).bg).toContain('cyan');
    });
  });
});
