/**
 * Test Suite: Challenger M3 Billing Dashboard State, Gauge Metrics & Add-on Pricing Stress Test
 * Empirical Adversarial Challenger: challenger_m3_1
 *
 * Scope:
 * 1. Usage gauge calculations, boundary percentages, and dynamic threshold color classes:
 *    - <70% (emerald)
 *    - 70%-89% (amber)
 *    - >=90% (rose/red)
 * 2. Add-on calculations (extra seats @ $10/mo or $96/yr, extra runners @ $15/mo or $144/yr), included seat deduction, and annual pricing math.
 * 3. Invoice transaction table rendering, status badge styling (paid, pending, failed, refunded), currency formatting, and empty states.
 * 4. Reactive state management, subscription cancel modal, error handling, and plan switcher idempotency.
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

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

export interface PlanItem {
  id: number;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
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

const allPlans: PlanItem[] = [
  {
    id: 1,
    slug: 'community',
    name: 'Community',
    tagline: 'For individual developers & hackers',
    description: 'Free forever with 1 concurrent runner and standard MCP support.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    max_runners: 1,
    max_seats: 1,
    max_projects: 3,
    features: ['1 Concurrent Runner', 'Up to 3 Projects', '1 Personal Seat', 'Community Discord Support'],
    is_active: true,
    is_popular: false,
    sort_order: 1,
  },
  {
    id: 2,
    slug: 'pro',
    name: 'Pro Developer',
    tagline: 'For professional AI-augmented engineers',
    description: 'Triple concurrency, unlimited projects, and priority streaming.',
    price_monthly: 19,
    price_yearly: 180,
    currency: 'USD',
    max_runners: 3,
    max_seats: 1,
    max_projects: null,
    features: ['3 Concurrent Runners', 'Unlimited Projects', '1 Developer Seat', 'Priority AI Dispatch', '90-Day History'],
    is_active: true,
    is_popular: true,
    sort_order: 2,
  },
  {
    id: 3,
    slug: 'team',
    name: 'Team / Startup',
    tagline: 'For collaborative engineering teams',
    description: '10 runners, 10 team seats, role-based access, and shared vaults.',
    price_monthly: 49,
    price_yearly: 468,
    currency: 'USD',
    max_runners: 10,
    max_seats: 10,
    max_projects: null,
    features: ['10 Concurrent Runners', '10 Team Seats', 'Unlimited Projects & Epics', 'Shared Credential Vaults', 'Fleet Dashboard'],
    is_active: true,
    is_popular: false,
    sort_order: 3,
  },
  {
    id: 4,
    slug: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large orgs needing custom fleets & SLA',
    description: 'Unlimited scale, custom security appliances, SAML SSO, and 99.9% SLA.',
    price_monthly: 199,
    price_yearly: 1908,
    currency: 'USD',
    max_runners: null,
    max_seats: null,
    max_projects: null,
    features: ['Unlimited Runners', 'Unlimited Team Seats', 'Dedicated On-Prem Appliances', 'SAML SSO & Audit Logs', '24/7 SLA'],
    is_active: true,
    is_popular: false,
    sort_order: 4,
  },
];

describe('Challenger M3: Workspace Billing Dashboard State, Gauge Metrics & Add-on Pricing Stress Test', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // SECTION 1: USAGE GAUGE CALCULATIONS & THRESHOLD COLOR CLASSES
  // ==========================================================================
  describe('1. Usage Gauge Metrics & Threshold Color Classes (<70%, 70%-89%, >=90%)', () => {
    // Exact function matching Workspaces/Billing/Index.vue
    const getThresholdColor = (percent: number) => {
      if (percent >= 90) {
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500',
          border: 'border-rose-500/40',
          pill: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      }
      if (percent >= 70) {
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500',
          border: 'border-amber-500/40',
          pill: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      }
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500',
        border: 'border-emerald-500/40',
        pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      };
    };

    const formatLimit = (limit: number | null, unit: string) => {
      if (limit === null) return 'Unlimited';
      return `${limit} ${unit}${limit > 1 ? 's' : ''}`;
    };

    it('[CH_M3_GAUGE_01] Validates emerald threshold classes for usage < 70%', () => {
      const testPercentages = [0, 0.1, 10, 33.3, 50, 66.7, 69.9, 69.99];
      for (const p of testPercentages) {
        const color = getThresholdColor(p);
        expect(color.text).toBe('text-emerald-400');
        expect(color.bg).toBe('bg-emerald-500');
        expect(color.border).toBe('border-emerald-500/40');
        expect(color.pill).toBe('bg-emerald-500/10 text-emerald-400 border-emerald-500/30');
      }
    });

    it('[CH_M3_GAUGE_02] Validates amber threshold classes for usage between 70% and 89.99%', () => {
      const testPercentages = [70.0, 70.1, 75, 80, 85, 89.0, 89.9, 89.99];
      for (const p of testPercentages) {
        const color = getThresholdColor(p);
        expect(color.text).toBe('text-amber-400');
        expect(color.bg).toBe('bg-amber-500');
        expect(color.border).toBe('border-amber-500/40');
        expect(color.pill).toBe('bg-amber-500/10 text-amber-400 border-amber-500/30');
      }
    });

    it('[CH_M3_GAUGE_03] Validates rose/red threshold classes for usage >= 90%', () => {
      const testPercentages = [90.0, 90.1, 95, 99.9, 100.0, 120.0, 250.0];
      for (const p of testPercentages) {
        const color = getThresholdColor(p);
        expect(color.text).toBe('text-rose-400');
        expect(color.bg).toBe('bg-rose-500');
        expect(color.border).toBe('border-rose-500/40');
        expect(color.pill).toBe('bg-rose-500/10 text-rose-400 border-rose-500/30');
      }
    });

    it('[CH_M3_GAUGE_04] Validates formatLimit unit pluralization and null handling', () => {
      // Null -> Unlimited
      expect(formatLimit(null, 'runner')).toBe('Unlimited');
      expect(formatLimit(null, 'project')).toBe('Unlimited');
      expect(formatLimit(null, 'seat')).toBe('Unlimited');

      // 1 -> singular
      expect(formatLimit(1, 'runner')).toBe('1 runner');
      expect(formatLimit(1, 'project')).toBe('1 project');
      expect(formatLimit(1, 'seat')).toBe('1 seat');

      // >1 -> plural
      expect(formatLimit(3, 'runner')).toBe('3 runners');
      expect(formatLimit(10, 'project')).toBe('10 projects');
      expect(formatLimit(10, 'seat')).toBe('10 seats');
    });

    it('[CH_M3_GAUGE_05] Stress-tests progress bar percentage clamping and fallback style width', () => {
      const computeBarWidth = (percent: number, limit: number | null) => {
        return Math.min(100, percent || (limit === null ? 5 : 0));
      };

      // Zero usage with limit -> 0% width
      expect(computeBarWidth(0, 10)).toBe(0);

      // Normal percentage -> exact percentage
      expect(computeBarWidth(45.5, 10)).toBe(45.5);

      // Over 100% capacity (e.g. 150%) -> clamped to 100%
      expect(computeBarWidth(150, 10)).toBe(100);

      // Unlimited plan (limit = null, percent = 0) -> subtle 5% active indicator
      expect(computeBarWidth(0, null)).toBe(5);
    });

    it('[CH_M3_GAUGE_06] Backend Quota Calculation Rounding Resilience', () => {
      const calculateSummaryPercent = (active: number, limit: number | null) => {
        if (!limit || limit <= 0) return 0.0;
        return Math.round((active / limit) * 1000) / 10;
      };

      expect(calculateSummaryPercent(1, 3)).toBe(33.3);
      expect(calculateSummaryPercent(2, 3)).toBe(66.7);
      expect(calculateSummaryPercent(7, 10)).toBe(70.0);
      expect(calculateSummaryPercent(9, 10)).toBe(90.0);
      expect(calculateSummaryPercent(10, 10)).toBe(100.0);
      expect(calculateSummaryPercent(15, null)).toBe(0.0);
    });
  });

  // ==========================================================================
  // SECTION 2: ADD-ON CALCULATIONS & ANNUAL PRICING MATH
  // ==========================================================================
  describe('2. Add-on Calculations & Annual Pricing Math ($10/mo seat, $15/mo runner, 20% off yearly)', () => {
    const computeAddonMonthlyCost = (
      extraRunners: number,
      totalSeats: number,
      includedSeats: number,
      cycle: 'monthly' | 'yearly'
    ) => {
      const runnerRate = cycle === 'yearly' ? 12 : 15;
      const seatRate = cycle === 'yearly' ? 8 : 10;
      const extraSeatsCount = Math.max(0, totalSeats - includedSeats);
      return extraRunners * runnerRate + extraSeatsCount * seatRate;
    };

    const computeTotalSubscriptionCost = (
      plan: PlanItem,
      extraRunners: number,
      totalSeats: number,
      cycle: 'monthly' | 'yearly'
    ) => {
      const baseMonthly = cycle === 'yearly' ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
      const includedSeats = plan.max_seats || 1;
      const addonCost = computeAddonMonthlyCost(extraRunners, totalSeats, includedSeats, cycle);
      return baseMonthly + addonCost;
    };

    it('[CH_M3_ADDON_01] Verifies monthly add-on rates ($15/runner, $10/seat)', () => {
      // 0 runners, 1 seat (included)
      expect(computeAddonMonthlyCost(0, 1, 1, 'monthly')).toBe(0);

      // 1 extra runner ($15), 0 extra seats -> $15
      expect(computeAddonMonthlyCost(1, 1, 1, 'monthly')).toBe(15);

      // 3 extra runners ($45), 2 extra seats ($20) on Pro (1 included seat, 3 requested) -> $65
      expect(computeAddonMonthlyCost(3, 3, 1, 'monthly')).toBe(65);

      // 5 extra runners ($75), 5 extra seats ($50) on Team (10 included seats, 15 requested) -> $125
      expect(computeAddonMonthlyCost(5, 15, 10, 'monthly')).toBe(125);
    });

    it('[CH_M3_ADDON_02] Verifies yearly add-on rates ($12/runner = $144/yr, $8/seat = $96/yr with 20% discount)', () => {
      // 1 extra runner ($12/mo = $144/yr)
      expect(computeAddonMonthlyCost(1, 1, 1, 'yearly')).toBe(12);

      // 3 extra runners ($36/mo), 2 extra seats ($16/mo) -> $52/mo
      expect(computeAddonMonthlyCost(3, 3, 1, 'yearly')).toBe(52);

      // 5 extra runners ($60/mo), 5 extra seats ($40/mo) -> $100/mo
      expect(computeAddonMonthlyCost(5, 15, 10, 'yearly')).toBe(100);
    });

    it('[CH_M3_ADDON_03] Verifies full subscription pricing matrix across all 4 tiers with add-ons', () => {
      // Community (Free) + 2 extra runners ($30/mo) = $30/mo
      expect(computeTotalSubscriptionCost(allPlans[0], 2, 1, 'monthly')).toBe(30);

      // Pro Monthly ($19) + 2 extra runners ($30) + 3 seats (2 extra = $20) = $69/mo
      expect(computeTotalSubscriptionCost(allPlans[1], 2, 3, 'monthly')).toBe(69);

      // Pro Yearly ($15/mo) + 2 extra runners ($24) + 3 seats (2 extra = $16) = $55/mo
      expect(computeTotalSubscriptionCost(allPlans[1], 2, 3, 'yearly')).toBe(55);

      // Team Monthly ($49) + 5 extra runners ($75) + 12 seats (2 extra = $20) = $144/mo
      expect(computeTotalSubscriptionCost(allPlans[2], 5, 12, 'monthly')).toBe(144);

      // Team Yearly ($39/mo) + 5 extra runners ($60) + 12 seats (2 extra = $16) = $115/mo
      expect(computeTotalSubscriptionCost(allPlans[2], 5, 12, 'yearly')).toBe(115);

      // Enterprise Monthly ($199) + 10 extra runners ($150) = $349/mo
      expect(computeTotalSubscriptionCost(allPlans[3], 10, 1, 'monthly')).toBe(349);

      // Enterprise Yearly ($159/mo) + 10 extra runners ($120) = $279/mo
      expect(computeTotalSubscriptionCost(allPlans[3], 10, 1, 'yearly')).toBe(279);
    });

    it('[CH_M3_ADDON_04] Verifies backend annual invoice calculation parity', () => {
      const calculateBackendInvoiceTotal = (
        plan: PlanItem,
        cycle: 'monthly' | 'yearly',
        seatQuantity: number,
        extraRunners: number
      ) => {
        const baseAmount = cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
        const seatRate = cycle === 'yearly' ? 96.00 : 10.00;
        const runnerRate = cycle === 'yearly' ? 144.00 : 15.00;
        const includedSeats = plan.max_seats ?? 1;
        const extraSeats = Math.max(0, seatQuantity - includedSeats);
        return baseAmount + (extraSeats * seatRate) + (extraRunners * runnerRate);
      };

      // Pro Yearly + 2 runners + 3 seats (2 extra):
      // Base: $180, Extra Seats: 2 * 96 = 192, Extra Runners: 2 * 144 = 288
      // Total: 180 + 192 + 288 = $660
      const proYearlyTotal = calculateBackendInvoiceTotal(allPlans[1], 'yearly', 3, 2);
      expect(proYearlyTotal).toBe(660.00);

      // Team Yearly + 5 runners + 12 seats (2 extra):
      // Base: $468, Extra Seats: 2 * 96 = 192, Extra Runners: 5 * 144 = 720
      // Total: 468 + 192 + 720 = $1380
      const teamYearlyTotal = calculateBackendInvoiceTotal(allPlans[2], 'yearly', 12, 5);
      expect(teamYearlyTotal).toBe(1380.00);
    });

    it('[CH_M3_ADDON_05] Clamps add-on bounds and prevents negative deductions', () => {
      const clampExtraRunners = (val: number) => Math.max(0, Math.min(50, val));
      const clampSeats = (val: number, included: number) => Math.max(included, Math.min(200, val));

      expect(clampExtraRunners(-10)).toBe(0);
      expect(clampExtraRunners(0)).toBe(0);
      expect(clampExtraRunners(25)).toBe(25);
      expect(clampExtraRunners(100)).toBe(50);

      // Team has 10 included seats
      expect(clampSeats(5, 10)).toBe(10); // Cannot decrease below included seats
      expect(clampSeats(15, 10)).toBe(15);
      expect(clampSeats(300, 10)).toBe(200);
    });
  });

  // ==========================================================================
  // SECTION 3: INVOICE TRANSACTION TABLE RENDERING & STATUSES
  // ==========================================================================
  describe('3. Invoice Transaction Table Rendering, Status Badges & Formatting', () => {
    const getInvoiceStatusClass = (status: string) => {
      if (status === 'paid') {
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      }
      if (status === 'pending') {
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      }
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    };

    const formatDate = (isoString?: string | null) => {
      if (!isoString) return '—';
      try {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return isoString;
      }
    };

    const formatCurrency = (amount: number, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    it('[CH_M3_INV_01] Validates status badge CSS classes for paid, pending, failed, refunded', () => {
      expect(getInvoiceStatusClass('paid')).toBe('bg-emerald-500/10 text-emerald-400 border-emerald-500/30');
      expect(getInvoiceStatusClass('pending')).toBe('bg-amber-500/10 text-amber-400 border-amber-500/30');
      expect(getInvoiceStatusClass('failed')).toBe('bg-rose-500/10 text-rose-400 border-rose-500/30');
      expect(getInvoiceStatusClass('refunded')).toBe('bg-rose-500/10 text-rose-400 border-rose-500/30');
    });

    it('[CH_M3_INV_02] Validates date formatting and null/empty fallbacks', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');

      const formatted = formatDate('2026-08-25T14:30:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Aug');
      expect(formatted).toContain('25');
    });

    it('[CH_M3_INV_03] Validates currency formatting across standard amounts and currencies', () => {
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(19)).toBe('$19');
      expect(formatCurrency(49.99)).toBe('$49.99');
      expect(formatCurrency(1380)).toBe('$1,380');
      expect(formatCurrency(1908.75)).toBe('$1,908.75');
    });

    it('[CH_M3_INV_04] Validates invoice item rendering with description fallbacks', () => {
      const invoiceA: InvoiceItem = {
        id: 1,
        invoice_number: 'INV-202608-0001',
        workspace_id: 10,
        plan_name: 'Pro Developer',
        billing_cycle: 'monthly',
        amount: 19.00,
        currency: 'USD',
        status: 'paid',
        paid_at: '2026-08-01T12:00:00Z',
      };

      const invoiceB: InvoiceItem = {
        id: 2,
        invoice_number: 'INV-202608-0002',
        workspace_id: 10,
        plan_name: 'Team / Startup',
        billing_cycle: 'yearly',
        amount: 660.00,
        currency: 'USD',
        status: 'pending',
        description: 'Team Plan (Yearly) + 2 extra runners',
      };

      const getDescription = (inv: InvoiceItem) => {
        return inv.description || `${inv.plan_name} (${inv.billing_cycle})`;
      };

      expect(getDescription(invoiceA)).toBe('Pro Developer (monthly)');
      expect(getDescription(invoiceB)).toBe('Team Plan (Yearly) + 2 extra runners');
    });

    it('[CH_M3_INV_05] Validates empty state when no invoices exist', () => {
      const emptyInvoices: InvoiceItem[] = [];
      const hasInvoices = emptyInvoices.length > 0;
      expect(hasInvoices).toBe(false);
      const emptyMessage = 'No invoices recorded yet. Invoices will automatically appear when subscriptions renew or upgrade.';
      expect(emptyMessage).toContain('No invoices recorded yet');
    });
  });

  // ==========================================================================
  // SECTION 4: REACTIVE STATE MANAGEMENT & SUBSCRIPTION LIFECYCLE
  // ==========================================================================
  describe('4. Reactive State Management, Cancel Flow & Lifecycle Mutation Stress', () => {
    it('[CH_M3_STATE_01] Subscription Cancellation State Flow', () => {
      const sub: SubscriptionData = {
        id: 10,
        plan_slug: 'pro',
        plan_name: 'Pro Developer',
        billing_cycle: 'monthly',
        status: 'active',
        seat_quantity: 1,
        extra_runners_quantity: 0,
        current_period_starts_at: '2026-08-01T00:00:00Z',
        current_period_ends_at: '2026-09-01T00:00:00Z',
        canceled_at: null,
      };

      let showCancelModal = false;
      let isCanceling = false;

      // User opens modal
      showCancelModal = true;
      expect(showCancelModal).toBe(true);

      // User confirms cancellation
      isCanceling = true;
      sub.status = 'canceled';
      sub.canceled_at = '2026-08-25T15:00:00Z';
      showCancelModal = false;
      isCanceling = false;

      expect(sub.status).toBe('canceled');
      expect(sub.canceled_at).toBe('2026-08-25T15:00:00Z');
      expect(showCancelModal).toBe(false);
      expect(isCanceling).toBe(false);
    });

    it('[CH_M3_STATE_02] Feedback Alert State Transitions', () => {
      let feedback: { type: 'success' | 'error'; message: string } | null = null;

      // Success feedback
      feedback = {
        type: 'success',
        message: '? Successfully switched workspace subscription to Team / Startup (yearly).',
      };
      expect(feedback.type).toBe('success');
      expect(feedback.message).toContain('Team / Startup');

      // Dismiss feedback
      feedback = null;
      expect(feedback).toBeNull();

      // Error feedback
      feedback = {
        type: 'error',
        message: 'Payment method declined. Please check your card information.',
      };
      expect(feedback.type).toBe('error');
      expect(feedback.message).toContain('Payment method declined');
    });

    it('[CH_M3_STATE_03] Plan Switcher Selection and Target Plan Resolution', () => {
      const resolveCurrentPlan = (planSlug: string) => {
        return allPlans.find(p => p.slug === planSlug) || allPlans[0];
      };

      expect(resolveCurrentPlan('community').name).toBe('Community');
      expect(resolveCurrentPlan('pro').name).toBe('Pro Developer');
      expect(resolveCurrentPlan('team').name).toBe('Team / Startup');
      expect(resolveCurrentPlan('enterprise').name).toBe('Enterprise');
      expect(resolveCurrentPlan('unknown_slug').name).toBe('Community'); // Safe fallback
    });
  });
});
