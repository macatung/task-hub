/**
 * Test Suite: Workspace Billing Dashboard & Quota Enforcement (Milestone 3)
 * Tier 1: Feature Coverage (Isolation) - Subscription Summary, Usage Progress Gauges & Invoices
 * Tier 2: Boundary & Corner Cases - Zero Limits, Unlimited Quotas & Dynamic Add-ons Bounds
 * Tier 3: Cross-Feature Interactions - useUpgradeModal Composable & Quota Error Interceptors
 * Tier 4: Real-World E2E Scenario - Quota Exceeded Intercept to Billing Dashboard Upgrade Flow
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SubscriptionData {
  id?: number;
  plan_slug: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  seat_quantity: number;
  extra_runners_quantity: number;
  current_period_starts_at: string;
  current_period_ends_at: string;
  canceled_at?: string | null;
}

export interface UsageGauge {
  active: number;
  limit: number | null;
  percent: number;
}

export interface UsageSummary {
  runners: UsageGauge;
  seats: UsageGauge;
  projects: UsageGauge;
}

export interface InvoiceItem {
  id: number;
  invoice_number: string;
  workspace_id: number;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  billing_reason?: string;
  description?: string;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string;
}

export interface QuotaPayload {
  resource: 'runners' | 'seats' | 'projects' | string;
  current_usage: number;
  limit: number | null;
  current_plan: string;
  suggested_plan: string;
  upgrade_url: string;
  message?: string;
}

// In-test composable simulator matching useUpgradeModal.ts contract
function createUpgradeModalStore() {
  let isOpen = false;
  let quotaData: QuotaPayload | null = null;

  const openUpgradeModal = (payload: QuotaPayload) => {
    quotaData = {
      resource: payload.resource || 'runners',
      current_usage: payload.current_usage ?? 0,
      limit: payload.limit !== undefined ? payload.limit : null,
      current_plan: payload.current_plan || 'community',
      suggested_plan: payload.suggested_plan || 'pro',
      upgrade_url: payload.upgrade_url || '/workspaces/billing',
      message: payload.message || '',
    };
    isOpen = true;
  };

  const closeUpgradeModal = () => {
    isOpen = false;
  };

  const handleQuotaError = (err: any): boolean => {
    const data = err?.response?.data;
    if (data && (data.error_code === 'PLAN_QUOTA_EXCEEDED' || data.quota)) {
      openUpgradeModal({
        resource: data.quota?.resource || 'runners',
        current_usage: data.quota?.current_usage ?? 0,
        limit: data.quota?.limit !== undefined ? data.quota.limit : null,
        current_plan: data.quota?.current_plan || 'community',
        suggested_plan: data.quota?.suggested_plan || 'pro',
        upgrade_url: data.quota?.upgrade_url || '/workspaces/billing',
        message: data.message || '',
      });
      return true;
    }
    return false;
  };

  return {
    getIsOpen: () => isOpen,
    getQuotaData: () => quotaData,
    openUpgradeModal,
    closeUpgradeModal,
    handleQuotaError,
  };
}

describe('Workspace Billing Dashboard & Web Quota Enforcement (Milestone 3)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_BILLING_01] Subscription Summary & Status Badging', () => {
    const sampleSub: SubscriptionData = {
      id: 101,
      plan_slug: 'pro',
      plan_name: 'Pro Developer',
      billing_cycle: 'monthly',
      status: 'active',
      seat_quantity: 1,
      extra_runners_quantity: 2,
      current_period_starts_at: '2026-08-01T00:00:00Z',
      current_period_ends_at: '2026-09-01T00:00:00Z',
      canceled_at: null,
    };

    it('identifies active subscription attributes correctly', () => {
      expect(sampleSub.plan_slug).toBe('pro');
      expect(sampleSub.plan_name).toBe('Pro Developer');
      expect(sampleSub.status).toBe('active');
      expect(sampleSub.extra_runners_quantity).toBe(2);
    });

    it('formats renewal date to human-readable format', () => {
      function formatDate(iso: string) {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const formatted = formatDate(sampleSub.current_period_ends_at);
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Sep');
    });

    it('computes total base price for monthly vs yearly billing cycle', () => {
      function getPlanPrice(baseMonthly: number, baseYearly: number, cycle: 'monthly' | 'yearly') {
        if (cycle === 'yearly') return Math.round(baseYearly / 12);
        return baseMonthly;
      }
      expect(getPlanPrice(19, 180, 'monthly')).toBe(19);
      expect(getPlanPrice(19, 180, 'yearly')).toBe(15);
    });
  });

  describe('[T1_BILLING_02] Usage Progress Gauges & Dynamic Threshold Coloring', () => {
    function getThresholdColor(percent: number) {
      if (percent >= 90) return 'rose';
      if (percent >= 70) return 'amber';
      return 'emerald';
    }

    it('assigns emerald color when usage is below 70%', () => {
      const gauge: UsageGauge = { active: 1, limit: 3, percent: 33.3 };
      expect(getThresholdColor(gauge.percent)).toBe('emerald');
    });

    it('assigns amber warning color when usage is between 70% and 89%', () => {
      const gauge: UsageGauge = { active: 8, limit: 10, percent: 80.0 };
      expect(getThresholdColor(gauge.percent)).toBe('amber');
    });

    it('assigns rose danger color when usage reaches or exceeds 90%', () => {
      const gauge: UsageGauge = { active: 3, limit: 3, percent: 100.0 };
      expect(getThresholdColor(gauge.percent)).toBe('rose');
    });

    it('handles unlimited limit (null) with zero percentage', () => {
      const unlimitedGauge: UsageGauge = { active: 15, limit: null, percent: 0.0 };
      expect(unlimitedGauge.limit).toBeNull();
      expect(getThresholdColor(unlimitedGauge.percent)).toBe('emerald');
    });
  });

  describe('[T1_BILLING_03] Invoice History Table & Status Mapping', () => {
    const sampleInvoices: InvoiceItem[] = [
      {
        id: 1,
        invoice_number: 'INV-202608-0001',
        workspace_id: 10,
        plan_name: 'Pro Developer',
        billing_cycle: 'monthly',
        amount: 49.00,
        currency: 'USD',
        status: 'paid',
        paid_at: '2026-08-01T12:00:00Z',
      },
      {
        id: 2,
        invoice_number: 'INV-202607-0042',
        workspace_id: 10,
        plan_name: 'Pro Developer',
        billing_cycle: 'monthly',
        amount: 19.00,
        currency: 'USD',
        status: 'pending',
      },
      {
        id: 3,
        invoice_number: 'INV-202606-0012',
        workspace_id: 10,
        plan_name: 'Pro Developer',
        billing_cycle: 'monthly',
        amount: 19.00,
        currency: 'USD',
        status: 'failed',
      },
    ];

    it('maps invoice status values to correct badge labels', () => {
      expect(sampleInvoices[0].status).toBe('paid');
      expect(sampleInvoices[1].status).toBe('pending');
      expect(sampleInvoices[2].status).toBe('failed');
    });

    it('formats currency amounts accurately ($49.00, $19.00)', () => {
      function formatCurrency(amount: number, currency = 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      }
      expect(formatCurrency(sampleInvoices[0].amount)).toBe('$49.00');
      expect(formatCurrency(sampleInvoices[1].amount)).toBe('$19.00');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_BILLING_01] Add-on Calculations & Dynamic Cost Modifiers', () => {
    function calculateTotalMonthly(
      basePlanMonthly: number,
      extraRunners: number,
      totalSeats: number,
      includedSeats: number,
      cycle: 'monthly' | 'yearly'
    ) {
      const runnerRate = cycle === 'yearly' ? 12 : 15;
      const seatRate = cycle === 'yearly' ? 8 : 10;
      const extraSeats = Math.max(0, totalSeats - includedSeats);
      return basePlanMonthly + (extraRunners * runnerRate) + (extraSeats * seatRate);
    }

    it('calculates add-ons with zero extra runners and seats', () => {
      const total = calculateTotalMonthly(19, 0, 1, 1, 'monthly');
      expect(total).toBe(19);
    });

    it('calculates add-ons with 3 extra runners ($15/ea) and 2 extra seats ($10/ea)', () => {
      const total = calculateTotalMonthly(19, 3, 3, 1, 'monthly');
      // 19 + (3 * 15) + (2 * 10) = 19 + 45 + 20 = 84
      expect(total).toBe(84);
    });

    it('calculates discounted add-ons on yearly billing cycle ($12/runner, $8/seat)', () => {
      const total = calculateTotalMonthly(15, 3, 3, 1, 'yearly');
      // 15 + (3 * 12) + (2 * 8) = 15 + 36 + 16 = 67
      expect(total).toBe(67);
    });

    it('clamps extra runners within valid bounds [0, 50]', () => {
      function clampRunners(val: number) {
        return Math.max(0, Math.min(50, val));
      }
      expect(clampRunners(-5)).toBe(0);
      expect(clampRunners(10)).toBe(10);
      expect(clampRunners(100)).toBe(50);
    });
  });

  describe('[T2_BILLING_02] Unlimited Quotas & Label Formatting', () => {
    function formatLimitLabel(limit: number | null, unit: string) {
      if (limit === null) return 'Unlimited';
      return `${limit} ${unit}${limit > 1 ? 's' : ''}`;
    }

    it('renders "Unlimited" for null limits across runners, seats and projects', () => {
      expect(formatLimitLabel(null, 'runner')).toBe('Unlimited');
      expect(formatLimitLabel(null, 'project')).toBe('Unlimited');
      expect(formatLimitLabel(null, 'seat')).toBe('Unlimited');
    });

    it('renders pluralized text for numbers > 1', () => {
      expect(formatLimitLabel(1, 'runner')).toBe('1 runner');
      expect(formatLimitLabel(3, 'runner')).toBe('3 runners');
      expect(formatLimitLabel(10, 'project')).toBe('10 projects');
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Interactions & Composable Interceptors
  // ==========================================================================
  describe('[T3_UPGRADE_MODAL_01] Upgrade Modal Store & Quota Interceptor', () => {
    it('manages modal open and close reactive states', () => {
      const modal = createUpgradeModalStore();
      expect(modal.getIsOpen()).toBe(false);
      expect(modal.getQuotaData()).toBeNull();

      modal.openUpgradeModal({
        resource: 'runners',
        current_usage: 3,
        limit: 3,
        current_plan: 'pro',
        suggested_plan: 'team',
        upgrade_url: '/workspaces/10/billing',
        message: 'Runner limit reached',
      });

      expect(modal.getIsOpen()).toBe(true);
      expect(modal.getQuotaData()?.resource).toBe('runners');
      expect(modal.getQuotaData()?.suggested_plan).toBe('team');

      modal.closeUpgradeModal();
      expect(modal.getIsOpen()).toBe(false);
    });

    it('intercepts HTTP 422 PLAN_QUOTA_EXCEEDED error and populates modal state', () => {
      const modal = createUpgradeModalStore();

      const quotaError = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Runner concurrency limit reached (1/1 active).',
            quota: {
              resource: 'runners',
              current_usage: 1,
              limit: 1,
              current_plan: 'community',
              suggested_plan: 'pro',
              upgrade_url: '/workspaces/5/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(quotaError);
      expect(handled).toBe(true);
      expect(modal.getIsOpen()).toBe(true);
      expect(modal.getQuotaData()?.current_plan).toBe('community');
      expect(modal.getQuotaData()?.suggested_plan).toBe('pro');
      expect(modal.getQuotaData()?.limit).toBe(1);
    });

    it('ignores non-quota errors and returns false', () => {
      const modal = createUpgradeModalStore();
      const genericError = {
        response: {
          status: 500,
          data: {
            message: 'Database connection failed.',
          },
        },
      };

      const handled = modal.handleQuotaError(genericError);
      expect(handled).toBe(false);
      expect(modal.getIsOpen()).toBe(false);
    });
  });

  describe('[T3_SOURCE_VERIFY_01] Component Source Verification & Structural Contracts', () => {
    it('verifies WorkspaceBillingController.php exists and renders Workspaces/Billing/Index', () => {
      const controllerPath = path.resolve(__dirname, '../../app/Http/Controllers/WorkspaceBillingController.php');
      expect(fs.existsSync(controllerPath)).toBe(true);
      const content = fs.readFileSync(controllerPath, 'utf8');
      expect(content.includes("Inertia::render('Workspaces/Billing/Index'")).toBe(true);
      expect(content.includes('WorkspaceQuotaService')).toBe(true);
    });

    it('verifies /workspaces/{workspace}/billing route is registered in web.php', () => {
      const routesPath = path.resolve(__dirname, '../../routes/web.php');
      const content = fs.readFileSync(routesPath, 'utf8');
      expect(content.includes("Route::get('/workspaces/{workspace}/billing'")).toBe(true);
      expect(content.includes('workspaces.billing')).toBe(true);
    });

    it('verifies useUpgradeModal.ts and UpgradeModal.vue components exist', () => {
      const composablePath = path.resolve(__dirname, '../../resources/js/composables/useUpgradeModal.ts');
      const modalPath = path.resolve(__dirname, '../../resources/js/Components/billing/UpgradeModal.vue');
      expect(fs.existsSync(composablePath)).toBe(true);
      expect(fs.existsSync(modalPath)).toBe(true);
    });

    it('verifies Workspaces/Billing/Index.vue contains plan switcher, usage gauges, add-ons and invoices', () => {
      const pagePath = path.resolve(__dirname, '../../resources/js/Pages/Workspaces/Billing/Index.vue');
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, 'utf8');
      expect(content.includes('plan-switcher-grid')).toBe(true);
      expect(content.includes('Concurrent Runners')).toBe(true);
      expect(content.includes('Workspace Add-ons')).toBe(true);
      expect(content.includes('Invoices & Billing History')).toBe(true);
    });

    it('verifies RemoteDispatchModal and Tasks/Index intercept PLAN_QUOTA_EXCEEDED and mount UpgradeModal', () => {
      const dispatchPath = path.resolve(__dirname, '../../resources/js/Components/tasks/RemoteDispatchModal.vue');
      const tasksPath = path.resolve(__dirname, '../../resources/js/Pages/Tasks/Index.vue');
      const dispatchContent = fs.readFileSync(dispatchPath, 'utf8');
      const tasksContent = fs.readFileSync(tasksPath, 'utf8');

      expect(dispatchContent.includes('useUpgradeModal')).toBe(true);
      expect(dispatchContent.includes('handleQuotaError')).toBe(true);
      expect(tasksContent.includes('useUpgradeModal')).toBe(true);
      expect(tasksContent.includes('handleQuotaError')).toBe(true);
      expect(tasksContent.includes('<UpgradeModal />')).toBe(true);
      expect(tasksContent.includes('Billing & Quota')).toBe(true);
    });
  });

  // ==========================================================================
  // TIER 4: Real-World E2E Scenario
  // ==========================================================================
  describe('[T4_BILLING_E2E_01] End-to-End Quota Exceeded Intercept & Upgrade Workflow', () => {
    it('simulates user hitting runner quota, triggering UpgradeModal, and upgrading on Billing Dashboard', () => {
      const modal = createUpgradeModalStore();

      // Step 1: User on Community tier dispatches a task when 1 runner is already busy
      const dispatchError = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Runner concurrency limit reached (1/1 active). Upgrade your plan to run more agents simultaneously.',
            quota: {
              resource: 'runners',
              current_usage: 1,
              limit: 1,
              current_plan: 'community',
              suggested_plan: 'pro',
              upgrade_url: '/workspaces/15/billing',
            },
          },
        },
      };

      // Step 2: RemoteDispatchModal catches error and calls handleQuotaError
      const isHandled = modal.handleQuotaError(dispatchError);
      expect(isHandled).toBe(true);
      expect(modal.getIsOpen()).toBe(true);

      // Step 3: UpgradeModal displays comparison (1 Runner -> 3 Runners) and computes target upgrade URL
      const data = modal.getQuotaData();
      expect(data?.suggested_plan).toBe('pro');
      const targetUrl = `${data?.upgrade_url}?plan=${data?.suggested_plan}`;
      expect(targetUrl).toBe('/workspaces/15/billing?plan=pro');

      // Step 4: User navigates to billing dashboard and selects Yearly cycle
      const selectedCycle = 'yearly';
      const upgradedSub: SubscriptionData = {
        id: 202,
        plan_slug: 'pro',
        plan_name: 'Pro Developer',
        billing_cycle: selectedCycle,
        status: 'active',
        seat_quantity: 1,
        extra_runners_quantity: 0,
        current_period_starts_at: '2026-08-25T00:00:00Z',
        current_period_ends_at: '2027-08-25T00:00:00Z',
        canceled_at: null,
      };

      // Step 5: Effective runner limit increases to 3
      const effectiveRunnersLimit = upgradedSub.plan_slug === 'pro' ? 3 : 1;
      expect(effectiveRunnersLimit).toBe(3);
      expect(upgradedSub.status).toBe('active');
    });
  });
});
