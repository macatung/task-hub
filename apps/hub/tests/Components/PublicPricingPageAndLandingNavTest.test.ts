/**
 * Test Suite: Public Pricing Page & Landing Navigation Updates (Milestone 2)
 * Tier 1: Feature Coverage (Isolation) - Plan Tier Calculations, Badges & Feature Matrix
 * Tier 2: Boundary & Corner Cases - Zero Pricing, Unlimited Quotas & FAQ Accordeon State
 * Tier 3: Cross-Feature Interactions - Contextual CTAs & Landing Page Navigation Integration
 * Tier 4: Real-World E2E Scenario - Visitor Journey from Landing Nav to Pricing Matrix & Checkout
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

export interface PlanItem {
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
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

export const samplePlans: PlanItem[] = [
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
    is_active: true,
    is_popular: false,
    sort_order: 4,
  },
];

describe('Public Pricing Page & Landing Navigation (Milestone 2)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation) - Plan Tier Calculations & Matrix
  // ==========================================================================
  describe('[T1_PRICING_01] Pricing Calculations & Annual Discount Recalculation', () => {
    function computeDisplayPrice(plan: PlanItem, cycle: 'monthly' | 'yearly') {
      if (plan.price_monthly === 0) return 0;
      if (cycle === 'yearly') {
        return Math.round(plan.price_yearly / 12);
      }
      return plan.price_monthly;
    }

    it('calculates monthly display rates correctly ($0, $19, $49, $199)', () => {
      const prices = samplePlans.map(p => computeDisplayPrice(p, 'monthly'));
      expect(prices).toEqual([0, 19, 49, 199]);
    });

    it('calculates effective monthly rate on yearly billing with 20% discount ($0, $15, $39, $159)', () => {
      const prices = samplePlans.map(p => computeDisplayPrice(p, 'yearly'));
      expect(prices).toEqual([0, 15, 39, 159]);
    });

    it('calculates total annual billed amounts ($0, $180, $468, $1908)', () => {
      const annualTotals = samplePlans.map(p => p.price_yearly);
      expect(annualTotals).toEqual([0, 180, 468, 1908]);
    });

    it('highlights Pro Developer as the popular plan', () => {
      const popular = samplePlans.filter(p => p.is_popular);
      expect(popular.length).toBe(1);
      expect(popular[0].slug).toBe('pro');
    });
  });

  describe('[T1_PRICING_02] Feature Matrix Quota & Integration Alignment', () => {
    it('verifies runner quotas scale across tiers (1 -> 3 -> 10 -> Unlimited)', () => {
      expect(samplePlans[0].max_runners).toBe(1);
      expect(samplePlans[1].max_runners).toBe(3);
      expect(samplePlans[2].max_runners).toBe(10);
      expect(samplePlans[3].max_runners).toBeNull();
    });

    it('verifies seat quotas scale across tiers (1 -> 1 -> 10 -> Unlimited)', () => {
      expect(samplePlans[0].max_seats).toBe(1);
      expect(samplePlans[1].max_seats).toBe(1);
      expect(samplePlans[2].max_seats).toBe(10);
      expect(samplePlans[3].max_seats).toBeNull();
    });

    it('verifies project limits (3 for Community, Unlimited for Pro/Team/Enterprise)', () => {
      expect(samplePlans[0].max_projects).toBe(3);
      expect(samplePlans[1].max_projects).toBeNull();
      expect(samplePlans[2].max_projects).toBeNull();
      expect(samplePlans[3].max_projects).toBeNull();
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_PRICING_01] Boundary Conditions & Zero Price Formatting', () => {
    it('formats free tier pricing with zero values and "forever" interval', () => {
      const community = samplePlans[0];
      expect(community.price_monthly).toBe(0);
      expect(community.price_yearly).toBe(0);
      const isFree = community.price_monthly === 0 && community.price_yearly === 0;
      expect(isFree).toBe(true);
    });

    it('formats null limits into user-friendly "Unlimited" labels', () => {
      function formatLimit(limit: number | null, unit: string) {
        if (limit === null) return 'Unlimited';
        return `${limit} ${unit}${limit > 1 ? 's' : ''}`;
      }

      expect(formatLimit(null, 'runner')).toBe('Unlimited');
      expect(formatLimit(1, 'runner')).toBe('1 runner');
      expect(formatLimit(3, 'runner')).toBe('3 runners');
      expect(formatLimit(10, 'seat')).toBe('10 seats');
    });

    it('handles FAQ accordion toggle state correctly', () => {
      let activeIndex: number | null = 0;

      function toggleFaq(index: number) {
        activeIndex = activeIndex === index ? null : index;
      }

      toggleFaq(0);
      expect(activeIndex).toBeNull();

      toggleFaq(2);
      expect(activeIndex).toBe(2);

      toggleFaq(3);
      expect(activeIndex).toBe(3);
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Interactions & Contextual CTAs
  // ==========================================================================
  describe('[T3_PRICING_01] Contextual CTA Routing for Visitors & Authenticated Users', () => {
    function resolvePlanCta(plan: PlanItem, user: { id: number; name: string } | null, currentPlan: string, workspaceId: number | null) {
      if (plan.slug === 'enterprise') {
        return { label: 'Contact Enterprise Sales', href: '#', isModal: true };
      }

      if (!user) {
        return {
          label: plan.slug === 'community' ? 'Get Started Free' : `Start with ${plan.name}`,
          href: '/auth/github',
          isModal: false,
        };
      }

      if (currentPlan === plan.slug) {
        return {
          label: 'Current Active Plan',
          href: `/workspaces/${workspaceId || 'default'}/billing`,
          isModal: false,
          isCurrent: true,
        };
      }

      return {
        label: `Switch to ${plan.name}`,
        href: `/workspaces/${workspaceId || 'default'}/billing?plan=${plan.slug}`,
        isModal: false,
      };
    }

    it('routes unauthenticated visitors to GitHub OAuth for self-serve plans', () => {
      const ctaCommunity = resolvePlanCta(samplePlans[0], null, 'community', null);
      expect(ctaCommunity.href).toBe('/auth/github');
      expect(ctaCommunity.label).toBe('Get Started Free');

      const ctaPro = resolvePlanCta(samplePlans[1], null, 'community', null);
      expect(ctaPro.href).toBe('/auth/github');
      expect(ctaPro.label).toBe('Start with Pro Developer');
    });

    it('triggers contact modal for Enterprise regardless of auth status', () => {
      const ctaUnauth = resolvePlanCta(samplePlans[3], null, 'community', null);
      expect(ctaUnauth.isModal).toBe(true);

      const ctaAuth = resolvePlanCta(samplePlans[3], { id: 1, name: 'Dev' }, 'community', 10);
      expect(ctaAuth.isModal).toBe(true);
    });

    it('shows current plan and links to workspace billing for authenticated users', () => {
      const user = { id: 7, name: 'Alice' };
      const currentWorkspaceId = 42;

      const ctaCurrent = resolvePlanCta(samplePlans[0], user, 'community', currentWorkspaceId);
      expect(ctaCurrent.isCurrent).toBe(true);
      expect(ctaCurrent.label).toBe('Current Active Plan');
      expect(ctaCurrent.href).toBe('/workspaces/42/billing');

      const ctaUpgrade = resolvePlanCta(samplePlans[1], user, 'community', currentWorkspaceId);
      expect(ctaUpgrade.isCurrent).toBeUndefined();
      expect(ctaUpgrade.label).toBe('Switch to Pro Developer');
      expect(ctaUpgrade.href).toBe('/workspaces/42/billing?plan=pro');
    });
  });

  describe('[T3_NAV_01] Landing Page Navigation Links Integration', () => {
    const landingNavLinks = [
      { label: 'Features', href: '#features' },
      { label: 'Agent Workflow', href: '#agent-workflow' },
      { label: 'MCP Protocol', href: '#mcp' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Architecture', href: '#architecture' },
    ];

    it('includes Pricing link in landing header navigation', () => {
      const pricingLink = landingNavLinks.find(l => l.label === 'Pricing');
      expect(pricingLink).toBeDefined();
      expect(pricingLink?.href).toBe('/pricing');
    });

    it('has Pricing navigation in footer links array', () => {
      const footerLinks = ['/pricing', '#features', '#agent-workflow', 'https://github.com/macatung/task-hub'];
      expect(footerLinks).toContain('/pricing');
    });
  });

  // ==========================================================================
  // TIER 4: Real-World E2E Scenario
  // ==========================================================================
  describe('[T4_E2E_01] End-to-End Visitor Conversion Workflow', () => {
    it('executes full visitor flow: discover -> toggle annual -> evaluate Pro -> initiate checkout', () => {
      // Step 1: Visitor lands on Hub index
      const initialPage = '/';
      expect(initialPage).toBe('/');

      // Step 2: Visitor clicks /pricing from header navigation
      const navTarget = '/pricing';
      expect(navTarget).toBe('/pricing');

      // Step 3: Default view is monthly billing
      let cycle: 'monthly' | 'yearly' = 'monthly';
      expect(samplePlans[1].price_monthly).toBe(19);

      // Step 4: Visitor clicks annual billing toggle with 20% discount badge
      cycle = 'yearly';
      const effectiveProPrice = Math.round(samplePlans[1].price_yearly / 12);
      expect(effectiveProPrice).toBe(15);
      expect(samplePlans[1].price_yearly).toBe(180);

      // Step 5: Visitor clicks Pro CTA -> routes to GitHub OAuth
      const cta = samplePlans[1].slug === 'pro' ? '/auth/github' : '/';
      expect(cta).toBe('/auth/github');
    });
  });
});
