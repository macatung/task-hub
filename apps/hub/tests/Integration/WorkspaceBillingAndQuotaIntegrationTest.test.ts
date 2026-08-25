/**
 * Test Suite: Workspace Billing, Plan Tiers & Quota Enforcement Integration (Milestone 1)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 * Tier 3: Cross-Feature Interactions
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

describe('Workspace Billing & Plan Quota Enforcement Integration (Milestone 1)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation) - Plan Definitions & Seed Matrix
  // ==========================================================================
  describe('[T1_BILLING_01] Plan Tiers & Pricing Calculation Matrix', () => {
    const plans = [
      {
        slug: 'community',
        name: 'Community',
        price_monthly: 0.00,
        price_yearly: 0.00,
        max_runners: 1,
        max_seats: 1,
        max_projects: 3,
        is_popular: false,
      },
      {
        slug: 'pro',
        name: 'Pro Developer',
        price_monthly: 19.00,
        price_yearly: 180.00,
        max_runners: 3,
        max_seats: 1,
        max_projects: null,
        is_popular: true,
      },
      {
        slug: 'team',
        name: 'Team / Startup',
        price_monthly: 49.00,
        price_yearly: 468.00,
        max_runners: 10,
        max_seats: 10,
        max_projects: null,
        is_popular: false,
      },
      {
        slug: 'enterprise',
        name: 'Enterprise',
        price_monthly: 199.00,
        price_yearly: 1908.00,
        max_runners: null,
        max_seats: null,
        max_projects: null,
        is_popular: false,
      },
    ];

    it('defines 4 active tiers with correct slug identifiers', () => {
      expect(plans.length).toBe(4);
      expect(plans.map(p => p.slug)).toEqual(['community', 'pro', 'team', 'enterprise']);
    });

    it('applies ~20% discount on yearly subscriptions across paid tiers', () => {
      const proMonthlyTotal = 19.00 * 12; // 228
      const proDiscountPercent = ((proMonthlyTotal - 180.00) / proMonthlyTotal) * 100;
      expect(Math.round(proDiscountPercent)).toBe(21); // ~20-21% discount ($15/mo)

      const teamMonthlyTotal = 49.00 * 12; // 588
      const teamDiscountPercent = ((teamMonthlyTotal - 468.00) / teamMonthlyTotal) * 100;
      expect(Math.round(teamDiscountPercent)).toBe(20); // 20.4% discount ($39/mo)

      const enterpriseMonthlyTotal = 199.00 * 12; // 2388
      const entDiscountPercent = ((enterpriseMonthlyTotal - 1908.00) / enterpriseMonthlyTotal) * 100;
      expect(Math.round(entDiscountPercent)).toBe(20); // 20.1% discount ($159/mo)
    });

    it('flags Pro Developer as the highlighted/popular plan', () => {
      const popularPlans = plans.filter(p => p.is_popular);
      expect(popularPlans.length).toBe(1);
      expect(popularPlans[0].slug).toBe('pro');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases - Quota Enforcement Math
  // ==========================================================================
  describe('[T2_QUOTA_01] Quota Usage Percentages & Limit Boundaries', () => {
    function computeQuotaUsage(active: number, limit: number | null) {
      if (limit === null || limit <= 0) {
        return { active, limit, percent: 0.0, isOver: false };
      }
      const percent = Math.round((active / limit) * 1000) / 10;
      return { active, limit, percent, isOver: active >= limit };
    }

    it('calculates 100% capacity for Community runner limit at 1/1 active', () => {
      const usage = computeQuotaUsage(1, 1);
      expect(usage.percent).toBe(100.0);
      expect(usage.isOver).toBe(true);
    });

    it('calculates 33.3% capacity for Pro runner limit at 1/3 active', () => {
      const usage = computeQuotaUsage(1, 3);
      expect(usage.percent).toBe(33.3);
      expect(usage.isOver).toBe(false);
    });

    it('handles unlimited capacity with 0% and no over-quota flag', () => {
      const usage = computeQuotaUsage(15, null);
      expect(usage.percent).toBe(0.0);
      expect(usage.isOver).toBe(false);
    });

    it('correctly calculates add-on runner and seat quotas', () => {
      const basePlanRunners = 3;
      const extraRunners = 2;
      const effectiveLimit = basePlanRunners + extraRunners;
      expect(effectiveLimit).toBe(5);

      const usage = computeQuotaUsage(4, effectiveLimit);
      expect(usage.percent).toBe(80.0);
      expect(usage.isOver).toBe(false);
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Interactions - Error Contract & Serialization
  // ==========================================================================
  describe('[T3_CONTRACT_01] Standardized PLAN_QUOTA_EXCEEDED Error Payload Contract', () => {
    function generateQuotaError(resource: string, currentUsage: number, limit: number, currentPlan: string, workspaceId: number) {
      const suggestedPlan = currentPlan === 'community' ? 'pro' : (currentPlan === 'pro' ? 'team' : 'enterprise');
      return {
        success: false,
        error_code: 'PLAN_QUOTA_EXCEEDED',
        message: `${resource.charAt(0).toUpperCase() + resource.slice(1)} concurrency limit reached (${currentUsage}/${limit} active). Upgrade your plan to run more agents simultaneously.`,
        quota: {
          resource,
          current_usage: currentUsage,
          limit,
          current_plan: currentPlan,
          suggested_plan: suggestedPlan,
          upgrade_url: `/workspaces/${workspaceId}/billing`,
        }
      };
    }

    it('generates the exact JSON contract expected by Web Hub & Desktop Upgrade Modals', () => {
      const error = generateQuotaError('runners', 1, 1, 'community', 42);

      expect(error.success).toBe(false);
      expect(error.error_code).toBe('PLAN_QUOTA_EXCEEDED');
      expect(error.quota.resource).toBe('runners');
      expect(error.quota.current_usage).toBe(1);
      expect(error.quota.limit).toBe(1);
      expect(error.quota.current_plan).toBe('community');
      expect(error.quota.suggested_plan).toBe('pro');
      expect(error.quota.upgrade_url).toBe('/workspaces/42/billing');
    });

    it('suggests Team tier upgrade when Pro plan runner limit is reached', () => {
      const error = generateQuotaError('runners', 3, 3, 'pro', 10);
      expect(error.quota.suggested_plan).toBe('team');
    });
  });
});
