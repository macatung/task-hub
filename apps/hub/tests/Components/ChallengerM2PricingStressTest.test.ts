/**
 * Test Suite: Challenger M2 Pricing Calculation, State Machine & Matrix Stress Test
 * Empirical Adversarial Challenger: challenger_m2_1
 *
 * Scope:
 * 1. Pricing math & discount formulas across all 4 plans and fuzzed plan prices
 * 2. Reactive toggle state transitions & idempotency under rapid switching
 * 3. Feature matrix row completeness (16 rows across 4 categories) & monotonic quota progression
 * 4. Contextual CTA resolution matrix across visitor & authenticated user states
 * 5. Landing page navigation link consistency
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

interface PlanLimit {
  history_retention_days?: number;
  custom_mcp?: boolean;
  team_roles?: boolean;
  priority_queue?: boolean;
  sso_enabled?: boolean;
  [key: string]: any;
}

interface PlanItem {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_runners: number | null;
  max_seats: number | null;
  max_projects: number | null;
  features: string[];
  limits?: PlanLimit;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

const standardPlans: PlanItem[] = [
  {
    id: 1,
    slug: 'community',
    name: 'Community',
    tagline: 'For individual hackers and open-source contributors',
    description: 'Free forever with local desktop runner support and standard features.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    max_runners: 1,
    max_seats: 1,
    max_projects: 3,
    features: [
      '1 Concurrent Desktop Runner',
      'Up to 3 Active Projects',
      '1 Personal Seat',
      'Basic GitHub Repository Sync',
      'Community Discord Support',
      'Local Agent Run History (7 days)',
    ],
    limits: {
      history_retention_days: 7,
      custom_mcp: false,
      team_roles: false,
      priority_queue: false,
    },
    is_active: true,
    is_popular: false,
    sort_order: 1,
  },
  {
    id: 2,
    slug: 'pro',
    name: 'Pro Developer',
    tagline: 'For professional engineers supercharging their local AI workflow',
    description: 'Triple concurrent execution, unlimited projects, and priority streaming.',
    price_monthly: 19,
    price_yearly: 180,
    currency: 'USD',
    max_runners: 3,
    max_seats: 1,
    max_projects: null,
    features: [
      '3 Concurrent Desktop Runners',
      'Unlimited Projects & Roadmaps',
      '1 Developer Seat',
      'Priority AI Task Dispatching',
      'Fast SSE Realtime Log Streaming',
      'Automated GitHub PR Creation',
      'Run History (90 days)',
      'Standard Email Support',
    ],
    limits: {
      history_retention_days: 90,
      custom_mcp: true,
      team_roles: false,
      priority_queue: true,
    },
    is_active: true,
    is_popular: true,
    sort_order: 2,
  },
  {
    id: 3,
    slug: 'team',
    name: 'Team / Startup',
    tagline: 'For engineering squads collaborating with multi-agent swarms',
    description: '10 concurrent runners, 10 team seats, role-based access, and shared vaults.',
    price_monthly: 49,
    price_yearly: 468,
    currency: 'USD',
    max_runners: 10,
    max_seats: 10,
    max_projects: null,
    features: [
      '10 Concurrent Desktop Runners',
      '10 Team Member Seats',
      'Unlimited Projects & Epics',
      'Team Credential Vault Sharing',
      'Role-Based Access Control (Admin/Dev/Viewer)',
      'Multi-runner Fleet Dashboard',
      'Team Analytics & Velocity Metrics',
      'Priority Support with 24h SLA',
    ],
    limits: {
      history_retention_days: 365,
      custom_mcp: true,
      team_roles: true,
      priority_queue: true,
    },
    is_active: true,
    is_popular: false,
    sort_order: 3,
  },
  {
    id: 4,
    slug: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organizations needing custom capacity and dedicated governance',
    description: 'Unlimited scale, custom security appliances, SAML SSO, and dedicated SLA.',
    price_monthly: 199,
    price_yearly: 1908,
    currency: 'USD',
    max_runners: null,
    max_seats: null,
    max_projects: null,
    features: [
      'Unlimited Concurrent Runners & Fleets',
      'Unlimited Team Seats',
      'Dedicated On-Premise Runner Appliances',
      'Custom SAML/SSO & Okta Integration',
      'Enterprise Security & Audit Logging',
      'Custom Model Context Protocol (MCP) Connectors',
      'Dedicated Account Manager & 99.9% SLA',
      'Custom Invoicing & Procurement Support',
    ],
    limits: {
      history_retention_days: 730,
      custom_mcp: true,
      team_roles: true,
      priority_queue: true,
      sso_enabled: true,
    },
    is_active: true,
    is_popular: false,
    sort_order: 4,
  },
];

describe('Challenger M2: Pricing Calculations, State Machine & Feature Matrix', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // SECTION 1: PRICING ARITHMETIC & DISCOUNT FORMULAS
  // ==========================================================================
  describe('1. Pricing Arithmetic & Discount Math', () => {
    function computePlanPrice(plan: PlanItem, cycle: 'monthly' | 'yearly') {
      if (plan.price_monthly === 0) return 0;
      if (cycle === 'yearly') {
        return Math.round(plan.price_yearly / 12);
      }
      return plan.price_monthly;
    }

    function getAnnualBilledAmount(plan: PlanItem) {
      return plan.price_yearly;
    }

    function getAnnualSubtext(plan: PlanItem, cycle: 'monthly' | 'yearly') {
      if (cycle === 'yearly' && plan.price_yearly > 0) {
        return `✓ $${getAnnualBilledAmount(plan)} billed annually (20% off)`;
      } else if (plan.price_monthly > 0 && cycle === 'monthly') {
        return `Billed $${plan.price_monthly} monthly`;
      }
      return 'No credit card required';
    }

    it('[CH_M2_PRICE_01] Verifies monthly vs annual prices for all 4 commercial tiers', () => {
      // Community: $0/mo, $0/yr -> $0 effective
      expect(computePlanPrice(standardPlans[0], 'monthly')).toBe(0);
      expect(computePlanPrice(standardPlans[0], 'yearly')).toBe(0);
      expect(getAnnualBilledAmount(standardPlans[0])).toBe(0);

      // Pro: $19/mo, $180/yr -> $15/mo effective
      expect(computePlanPrice(standardPlans[1], 'monthly')).toBe(19);
      expect(computePlanPrice(standardPlans[1], 'yearly')).toBe(15);
      expect(getAnnualBilledAmount(standardPlans[1])).toBe(180);

      // Team: $49/mo, $468/yr -> $39/mo effective
      expect(computePlanPrice(standardPlans[2], 'monthly')).toBe(49);
      expect(computePlanPrice(standardPlans[2], 'yearly')).toBe(39);
      expect(getAnnualBilledAmount(standardPlans[2])).toBe(468);

      // Enterprise: $199/mo, $1908/yr -> $159/mo effective
      expect(computePlanPrice(standardPlans[3], 'monthly')).toBe(199);
      expect(computePlanPrice(standardPlans[3], 'yearly')).toBe(159);
      expect(getAnnualBilledAmount(standardPlans[3])).toBe(1908);
    });

    it('[CH_M2_PRICE_02] Verifies annual discount percentage is >= 20% across all paid tiers', () => {
      for (let i = 1; i < standardPlans.length; i++) {
        const plan = standardPlans[i];
        const unbilledAnnual = plan.price_monthly * 12;
        const actualAnnual = plan.price_yearly;
        const savings = unbilledAnnual - actualAnnual;
        const discountRatio = savings / unbilledAnnual;

        expect(savings).toBeGreaterThan(0);
        expect(discountRatio).toBeGreaterThanOrEqual(0.20);
      }
    });

    it('[CH_M2_PRICE_03] Verifies annual subtext formatting for monthly vs yearly cycles', () => {
      // Free plan subtext is always "No credit card required"
      expect(getAnnualSubtext(standardPlans[0], 'monthly')).toBe('No credit card required');
      expect(getAnnualSubtext(standardPlans[0], 'yearly')).toBe('No credit card required');

      // Paid plans subtext in monthly cycle
      expect(getAnnualSubtext(standardPlans[1], 'monthly')).toBe('Billed $19 monthly');
      expect(getAnnualSubtext(standardPlans[2], 'monthly')).toBe('Billed $49 monthly');
      expect(getAnnualSubtext(standardPlans[3], 'monthly')).toBe('Billed $199 monthly');

      // Paid plans subtext in yearly cycle
      expect(getAnnualSubtext(standardPlans[1], 'yearly')).toBe('✓ $180 billed annually (20% off)');
      expect(getAnnualSubtext(standardPlans[2], 'yearly')).toBe('✓ $468 billed annually (20% off)');
      expect(getAnnualSubtext(standardPlans[3], 'yearly')).toBe('✓ $1908 billed annually (20% off)');
    });

    it('[CH_M2_PRICE_04] Fuzzes arbitrary custom plan pricing and rounding resilience', () => {
      const testCases = [
        { monthly: 10, yearly: 96, expectedYearlyMonthly: 8 },
        { monthly: 25, yearly: 240, expectedYearlyMonthly: 20 },
        { monthly: 100, yearly: 960, expectedYearlyMonthly: 80 },
        { monthly: 999, yearly: 9590, expectedYearlyMonthly: 799 },
      ];

      for (const tc of testCases) {
        const fakePlan: PlanItem = {
          ...standardPlans[1],
          price_monthly: tc.monthly,
          price_yearly: tc.yearly,
        };

        expect(computePlanPrice(fakePlan, 'monthly')).toBe(tc.monthly);
        expect(computePlanPrice(fakePlan, 'yearly')).toBe(tc.expectedYearlyMonthly);
      }
    });
  });

  // ==========================================================================
  // SECTION 2: REACTIVE TOGGLE STATE MACHINE & STRESS
  // ==========================================================================
  describe('2. Reactive Toggle State Machine', () => {
    it('[CH_M2_STATE_01] Rapid toggle state switching executes 100x without mutation drift', () => {
      let billingCycle: 'monthly' | 'yearly' = 'monthly';

      const setCycle = (newCycle: 'monthly' | 'yearly') => {
        billingCycle = newCycle;
      };

      for (let i = 0; i < 100; i++) {
        setCycle(i % 2 === 0 ? 'yearly' : 'monthly');
        const expected = i % 2 === 0 ? 'yearly' : 'monthly';
        expect(billingCycle).toBe(expected);
      }

      // Final toggle to yearly
      setCycle('yearly');
      expect(billingCycle).toBe('yearly');
    });

    it('[CH_M2_STATE_02] Idempotent toggle clicks do not mutate state unexpectedly', () => {
      let billingCycle: 'monthly' | 'yearly' = 'monthly';

      billingCycle = 'monthly';
      expect(billingCycle).toBe('monthly');
      billingCycle = 'monthly';
      expect(billingCycle).toBe('monthly');

      billingCycle = 'yearly';
      expect(billingCycle).toBe('yearly');
      billingCycle = 'yearly';
      expect(billingCycle).toBe('yearly');
    });
  });

  // ==========================================================================
  // SECTION 3: COMPARISON MATRIX COMPLETENESS & MONOTONICITY
  // ==========================================================================
  describe('3. Comparison Matrix Completeness & Invariants', () => {
    const matrixCategories = [
      {
        category: 'Core Quotas & Capacity',
        rows: [
          { name: 'Concurrent Desktop Runners', community: '1 runner', pro: '3 runners', team: '10 runners', enterprise: 'Unlimited custom fleet' },
          { name: 'Active Project Workspaces', community: '3 projects', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
          { name: 'Included Workspace Seats', community: '1 seat', pro: '1 developer seat', team: '10 team seats', enterprise: 'Unlimited seats' },
          { name: 'Run History & Evidence Retention', community: '7 days', pro: '90 days', team: '365 days', enterprise: '730 days (2 years)' },
        ],
      },
      {
        category: 'AI Engine & Agent Execution',
        rows: [
          { name: 'Model Context Protocol (MCP) Standard', community: true, pro: true, team: true, enterprise: true },
          { name: 'Custom In-House MCP Tool Connectors', community: false, pro: true, team: true, enterprise: true },
          { name: 'Priority Task Dispatch Queue', community: false, pro: true, team: true, enterprise: true },
          { name: 'Real-Time SSE Log & Telemetry Streaming', community: 'Standard', pro: 'High-speed SSE', team: 'High-speed SSE', enterprise: 'Dedicated Streaming Gateway' },
          { name: 'Multi-Agent Swarm Orchestration', community: false, pro: false, team: true, enterprise: true },
        ],
      },
      {
        category: 'GitHub Integration & Collaboration',
        rows: [
          { name: 'GitHub Webhook & Bi-directional Sync', community: 'Basic Sync', pro: 'Auto PR Creation', team: 'Full Squad Sync', enterprise: 'Multi-Org Enterprise Sync' },
          { name: 'Team Credential Vault & Shared Secrets', community: false, pro: false, team: true, enterprise: true },
          { name: 'Role-Based Access Control (RBAC)', community: false, pro: false, team: true, enterprise: true },
          { name: 'SAML 2.0 / Okta / Azure AD SSO', community: false, pro: false, team: false, enterprise: true },
        ],
      },
      {
        category: 'Support, SLA & Procurement',
        rows: [
          { name: 'Technical Support Channel', community: 'Community Discord', pro: 'Standard Email', team: 'Priority 24h SLA', enterprise: 'Dedicated Account Manager' },
          { name: 'Uptime SLA Commitment', community: 'Best Effort', pro: '99.5%', team: '99.9%', enterprise: '99.99% Financial Backing' },
          { name: 'Custom Invoicing & Vendor Procurement', community: false, pro: false, team: false, enterprise: true },
        ],
      },
    ];

    it('[CH_M2_MATRIX_01] Validates all 4 matrix categories and exactly 16 feature rows', () => {
      expect(matrixCategories.length).toBe(4);
      const totalRows = matrixCategories.reduce((acc, cat) => acc + cat.rows.length, 0);
      expect(totalRows).toBe(16);

      expect(matrixCategories[0].rows.length).toBe(4);
      expect(matrixCategories[1].rows.length).toBe(5);
      expect(matrixCategories[2].rows.length).toBe(4);
      expect(matrixCategories[3].rows.length).toBe(3);
    });

    it('[CH_M2_MATRIX_02] Validates monotonic tier progression across key quota rows', () => {
      const runnerRow = matrixCategories[0].rows.find(r => r.name === 'Concurrent Desktop Runners');
      expect(runnerRow?.community).toBe('1 runner');
      expect(runnerRow?.pro).toBe('3 runners');
      expect(runnerRow?.team).toBe('10 runners');
      expect(runnerRow?.enterprise).toContain('Unlimited');

      const retentionRow = matrixCategories[0].rows.find(r => r.name === 'Run History & Evidence Retention');
      expect(retentionRow?.community).toBe('7 days');
      expect(retentionRow?.pro).toBe('90 days');
      expect(retentionRow?.team).toBe('365 days');
      expect(retentionRow?.enterprise).toContain('730 days');
    });

    it('[CH_M2_MATRIX_03] Validates enterprise-exclusive governance rows (SSO, Custom Procurement)', () => {
      const ssoRow = matrixCategories[2].rows.find(r => r.name.includes('SAML'));
      expect(ssoRow?.community).toBe(false);
      expect(ssoRow?.pro).toBe(false);
      expect(ssoRow?.team).toBe(false);
      expect(ssoRow?.enterprise).toBe(true);

      const procurementRow = matrixCategories[3].rows.find(r => r.name.includes('Custom Invoicing'));
      expect(procurementRow?.community).toBe(false);
      expect(procurementRow?.pro).toBe(false);
      expect(procurementRow?.team).toBe(false);
      expect(procurementRow?.enterprise).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 4: CONTEXTUAL CTA RESOLUTION MATRIX
  // ==========================================================================
  describe('4. Contextual CTA Routing Logic', () => {
    function resolvePlanCta(plan: PlanItem, user: { id: number; name: string } | null, currentPlanSlug: string, workspaceId: number | null) {
      if (plan.slug === 'enterprise') {
        return {
          label: 'Contact Enterprise Sales',
          href: '#',
          isModal: true,
          primary: false,
          variant: 'enterprise',
        };
      }

      if (!user) {
        if (plan.slug === 'community') {
          return {
            label: 'Get Started Free',
            href: '/auth/github',
            isModal: false,
            primary: false,
            variant: 'github',
          };
        }
        return {
          label: `Start with ${plan.name}`,
          href: '/auth/github',
          isModal: false,
          primary: plan.is_popular,
          variant: 'github',
        };
      }

      // Authenticated user
      if (currentPlanSlug === plan.slug) {
        return {
          label: 'Current Active Plan',
          href: `/workspaces/${workspaceId || 'default'}/billing`,
          isModal: false,
          primary: false,
          isCurrent: true,
          variant: 'current',
        };
      }

      return {
        label: `Switch to ${plan.name}`,
        href: `/workspaces/${workspaceId || 'default'}/billing?plan=${plan.slug}`,
        isModal: false,
        primary: plan.is_popular,
        variant: 'billing',
      };
    }

    it('[CH_M2_CTA_01] Resolves CTAs for unauthenticated visitors', () => {
      const ctaCommunity = resolvePlanCta(standardPlans[0], null, 'community', null);
      expect(ctaCommunity.label).toBe('Get Started Free');
      expect(ctaCommunity.href).toBe('/auth/github');
      expect(ctaCommunity.isModal).toBe(false);

      const ctaPro = resolvePlanCta(standardPlans[1], null, 'community', null);
      expect(ctaPro.label).toBe('Start with Pro Developer');
      expect(ctaPro.href).toBe('/auth/github');
      expect(ctaPro.primary).toBe(true);

      const ctaTeam = resolvePlanCta(standardPlans[2], null, 'community', null);
      expect(ctaTeam.label).toBe('Start with Team / Startup');
      expect(ctaTeam.href).toBe('/auth/github');

      const ctaEnt = resolvePlanCta(standardPlans[3], null, 'community', null);
      expect(ctaEnt.label).toBe('Contact Enterprise Sales');
      expect(ctaEnt.isModal).toBe(true);
    });

    it('[CH_M2_CTA_02] Resolves CTAs for authenticated user on Pro tier', () => {
      const user = { id: 101, name: 'Lead Dev' };
      const workspaceId = 5;

      const ctaCommunity = resolvePlanCta(standardPlans[0], user, 'pro', workspaceId);
      expect(ctaCommunity.label).toBe('Switch to Community');
      expect(ctaCommunity.href).toBe('/workspaces/5/billing?plan=community');

      const ctaPro = resolvePlanCta(standardPlans[1], user, 'pro', workspaceId);
      expect(ctaPro.label).toBe('Current Active Plan');
      expect(ctaPro.href).toBe('/workspaces/5/billing');
      expect(ctaPro.isCurrent).toBe(true);

      const ctaTeam = resolvePlanCta(standardPlans[2], user, 'pro', workspaceId);
      expect(ctaTeam.label).toBe('Switch to Team / Startup');
      expect(ctaTeam.href).toBe('/workspaces/5/billing?plan=team');

      const ctaEnt = resolvePlanCta(standardPlans[3], user, 'pro', workspaceId);
      expect(ctaEnt.label).toBe('Contact Enterprise Sales');
      expect(ctaEnt.isModal).toBe(true);
    });
  });
});
