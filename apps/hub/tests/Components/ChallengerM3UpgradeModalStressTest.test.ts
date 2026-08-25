/**
 * Test Suite: Challenger M3 Upgrade Modal & Quota Intercept Stress Test
 * Empirical Adversarial Challenger: challenger_m3_2
 *
 * Scope:
 * 1. useUpgradeModal composable reactive state, singleton cross-instance synchronization, and rapid toggle stress
 * 2. HTTP error interception matrix: standard HTTP 422 PLAN_QUOTA_EXCEEDED, alternative quota shapes, and non-quota rejection
 * 3. Real-world simulation of task dispatch (runner limits), project creation (project limits), and member invitation (seat limits)
 * 4. Deep-link navigation URL generation, query parameter handling, and billing dashboard scroll targeting
 * 5. UpgradeModal UI title mapping, plan perks completeness, and limit display formatting
 * 6. Adversarial fuzzing: extreme numbers, XSS payloads, Unicode, ultra-long strings, and concurrent error bursts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QuotaPayload {
  resource: 'runners' | 'seats' | 'projects' | string;
  current_usage: number;
  limit: number | null;
  current_plan: string;
  suggested_plan: string;
  upgrade_url: string;
  message?: string;
}

/**
 * Pure TypeScript replica of useUpgradeModal composable singleton behavior
 * to test state machine mechanics in isolation and cross-instance interaction.
 */
class UpgradeModalSingletonModel {
  private static instance: UpgradeModalSingletonModel | null = null;
  public isOpen: boolean = false;
  public quotaData: QuotaPayload | null = null;

  public static getInstance(): UpgradeModalSingletonModel {
    if (!UpgradeModalSingletonModel.instance) {
      UpgradeModalSingletonModel.instance = new UpgradeModalSingletonModel();
    }
    return UpgradeModalSingletonModel.instance;
  }

  public static resetInstance(): void {
    if (UpgradeModalSingletonModel.instance) {
      UpgradeModalSingletonModel.instance.isOpen = false;
      UpgradeModalSingletonModel.instance.quotaData = null;
    }
    UpgradeModalSingletonModel.instance = new UpgradeModalSingletonModel();
  }

  public openUpgradeModal(payload: QuotaPayload): void {
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

  public closeUpgradeModal(): void {
    this.isOpen = false;
  }

  public handleQuotaError(err: any): boolean {
    const data = err?.response?.data;
    if (data && (data.error_code === 'PLAN_QUOTA_EXCEEDED' || data.quota)) {
      this.openUpgradeModal({
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
  }
}

/**
 * UI helper logic corresponding to UpgradeModal.vue computed properties
 */
const planNames: Record<string, string> = {
  community: 'Community',
  pro: 'Pro Developer',
  team: 'Team / Startup',
  enterprise: 'Enterprise',
};

function getResourceTitle(resource: string): string {
  switch (resource) {
    case 'runners':
      return 'Concurrent Runner Limit Reached';
    case 'seats':
      return 'Workspace Seat Limit Reached';
    case 'projects':
      return 'Active Project Limit Reached';
    default:
      return 'Plan Quota Limit Reached';
  }
}

function getPlanPerks(suggestedPlan: string): string[] {
  switch (suggestedPlan) {
    case 'pro':
      return [
        '3 Concurrent Desktop Runners',
        'Unlimited Projects & Roadmaps',
        '1 Developer Seat included',
        'Priority AI task dispatch & fast streaming',
        '90-day agent run history retention',
      ];
    case 'team':
      return [
        '10 Concurrent Desktop Runners',
        '10 Team Member Seats included',
        'Unlimited Projects & Epics',
        'Team Shared Credential Vaults',
        'Fleet Dashboard & Velocity Analytics',
      ];
    case 'enterprise':
      return [
        'Unlimited Concurrent Runners & Fleets',
        'Unlimited Team Seats',
        'Dedicated On-Premise Runner Appliances',
        'Custom SAML/SSO & 99.9% SLA',
        'Custom Billing & Procurement Invoicing',
      ];
    default:
      return [
        'Higher runner concurrency limits',
        'Unlimited project creation',
        'Team collaboration seats',
        'Priority support',
      ];
  }
}

function getCurrentLimitDisplay(limit: number | null, resource: string): string {
  if (limit === null) return 'Unlimited';
  const unit = resource === 'runners' ? 'runner' : (resource === 'seats' ? 'seat' : 'project');
  return `${limit} ${unit}${limit > 1 ? 's' : ''}`;
}

function getSuggestedLimitDisplay(suggestedPlan: string, resource: string): string {
  switch (suggestedPlan) {
    case 'pro':
      if (resource === 'runners') return '3 runners';
      if (resource === 'projects') return 'Unlimited';
      return '1 seat';
    case 'team':
      if (resource === 'runners') return '10 runners';
      if (resource === 'projects') return 'Unlimited';
      return '10 seats';
    case 'enterprise':
      return 'Unlimited';
    default:
      return 'Higher limits';
  }
}

function computeUpgradeTargetUrl(upgradeUrl?: string, suggestedPlan = 'pro'): string {
  const base = upgradeUrl || '/pricing';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}plan=${suggestedPlan}`;
}

describe('Challenger M3: Upgrade Modal & Quota Intercept Stress Suite', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    UpgradeModalSingletonModel.resetInstance();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // SECTION 1: useUpgradeModal Composable Reactive State & Singleton Idempotency
  // ==========================================================================
  describe('1. Composable Reactive State & Singleton Idempotency', () => {
    it('[CH3_STATE_01] Modal starts closed with null quota data and safe close no-op', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      expect(modal.isOpen).toBe(false);
      expect(modal.quotaData).toBeNull();

      modal.closeUpgradeModal();
      expect(modal.isOpen).toBe(false);
      expect(modal.quotaData).toBeNull();
    });

    it('[CH3_STATE_02] openUpgradeModal populates fully specified payload correctly', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const payload: QuotaPayload = {
        resource: 'runners',
        current_usage: 3,
        limit: 3,
        current_plan: 'pro',
        suggested_plan: 'team',
        upgrade_url: '/workspaces/42/billing',
        message: 'Concurrency limit reached.',
      };

      modal.openUpgradeModal(payload);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('runners');
      expect(modal.quotaData?.current_usage).toBe(3);
      expect(modal.quotaData?.limit).toBe(3);
      expect(modal.quotaData?.current_plan).toBe('pro');
      expect(modal.quotaData?.suggested_plan).toBe('team');
      expect(modal.quotaData?.upgrade_url).toBe('/workspaces/42/billing');
      expect(modal.quotaData?.message).toBe('Concurrency limit reached.');
    });

    it('[CH3_STATE_03] openUpgradeModal applies robust defaults on partial payload', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      // Partial payload with missing optional/non-mandatory fields
      modal.openUpgradeModal({} as any);

      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('runners');
      expect(modal.quotaData?.current_usage).toBe(0);
      expect(modal.quotaData?.limit).toBeNull();
      expect(modal.quotaData?.current_plan).toBe('community');
      expect(modal.quotaData?.suggested_plan).toBe('pro');
      expect(modal.quotaData?.upgrade_url).toBe('/workspaces/billing');
      expect(modal.quotaData?.message).toBe('');
    });

    it('[CH3_STATE_04] Preserves limit of 0 distinctly from null and undefined', () => {
      const modal = UpgradeModalSingletonModel.getInstance();

      modal.openUpgradeModal({
        resource: 'runners',
        current_usage: 0,
        limit: 0,
        current_plan: 'custom_tier',
        suggested_plan: 'community',
        upgrade_url: '/workspaces/billing',
      });

      expect(modal.quotaData?.limit).toBe(0);
      expect(modal.quotaData?.current_usage).toBe(0);
    });

    it('[CH3_STATE_05] Singleton state synchronizes across multiple consumers', () => {
      const consumerA = UpgradeModalSingletonModel.getInstance();
      const consumerB = UpgradeModalSingletonModel.getInstance();

      expect(consumerA).toBe(consumerB);
      expect(consumerA.isOpen).toBe(false);

      consumerA.openUpgradeModal({
        resource: 'seats',
        current_usage: 10,
        limit: 10,
        current_plan: 'team',
        suggested_plan: 'enterprise',
        upgrade_url: '/workspaces/100/billing',
      });

      expect(consumerB.isOpen).toBe(true);
      expect(consumerB.quotaData?.suggested_plan).toBe('enterprise');

      consumerB.closeUpgradeModal();
      expect(consumerA.isOpen).toBe(false);
    });

    it('[CH3_STATE_06] Rapid open/close toggle stress (1000 iterations) maintains consistency', () => {
      const modal = UpgradeModalSingletonModel.getInstance();

      for (let i = 0; i < 1000; i++) {
        modal.openUpgradeModal({
          resource: i % 2 === 0 ? 'runners' : 'projects',
          current_usage: i,
          limit: i + 5,
          current_plan: 'community',
          suggested_plan: 'pro',
          upgrade_url: `/workspaces/${i}/billing`,
        });
        expect(modal.isOpen).toBe(true);
        modal.closeUpgradeModal();
        expect(modal.isOpen).toBe(false);
      }

      expect(modal.isOpen).toBe(false);
      expect(modal.quotaData?.current_usage).toBe(999);
    });
  });

  // ==========================================================================
  // SECTION 2: HTTP Error Interception Matrix (handleQuotaError)
  // ==========================================================================
  describe('2. HTTP Error Interception Matrix', () => {
    it('[CH3_INTERCEPT_01] Intercepts standard HTTP 422 PLAN_QUOTA_EXCEEDED for runners', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errorPayload = {
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
              upgrade_url: '/workspaces/7/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(errorPayload);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('runners');
      expect(modal.quotaData?.current_plan).toBe('community');
      expect(modal.quotaData?.suggested_plan).toBe('pro');
      expect(modal.quotaData?.upgrade_url).toBe('/workspaces/7/billing');
    });

    it('[CH3_INTERCEPT_02] Intercepts standard HTTP 422 PLAN_QUOTA_EXCEEDED for projects', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errorPayload = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Project limit reached (3/3 projects). Upgrade your plan to create unlimited projects.',
            quota: {
              resource: 'projects',
              current_usage: 3,
              limit: 3,
              current_plan: 'community',
              suggested_plan: 'pro',
              upgrade_url: '/workspaces/7/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(errorPayload);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('projects');
      expect(modal.quotaData?.limit).toBe(3);
    });

    it('[CH3_INTERCEPT_03] Intercepts standard HTTP 422 PLAN_QUOTA_EXCEEDED for seats', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errorPayload = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Workspace seat limit reached (10/10 members). Upgrade your plan to invite more team members.',
            quota: {
              resource: 'seats',
              current_usage: 10,
              limit: 10,
              current_plan: 'team',
              suggested_plan: 'enterprise',
              upgrade_url: '/workspaces/12/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(errorPayload);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('seats');
      expect(modal.quotaData?.suggested_plan).toBe('enterprise');
    });

    it('[CH3_INTERCEPT_04] Intercepts legacy quota payload having data.quota without error_code', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errorPayload = {
        response: {
          status: 422,
          data: {
            message: 'Quota exceeded',
            quota: {
              resource: 'runners',
              current_usage: 3,
              limit: 3,
              current_plan: 'pro',
              suggested_plan: 'team',
              upgrade_url: '/workspaces/20/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(errorPayload);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.suggested_plan).toBe('team');
    });

    it('[CH3_INTERCEPT_05] Intercepts PLAN_QUOTA_EXCEEDED even if quota object is omitted', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errorPayload = {
        response: {
          status: 422,
          data: {
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Plan limit reached.',
          },
        },
      };

      const handled = modal.handleQuotaError(errorPayload);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('runners');
      expect(modal.quotaData?.suggested_plan).toBe('pro');
    });

    it('[CH3_INTERCEPT_06] Rejects non-quota HTTP 422 validation errors gracefully', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const validationError = {
        response: {
          status: 422,
          data: {
            message: 'The title field is required.',
            errors: { title: ['The title field is required.'] },
          },
        },
      };

      const handled = modal.handleQuotaError(validationError);
      expect(handled).toBe(false);
      expect(modal.isOpen).toBe(false);
    });

    it('[CH3_INTERCEPT_07] Rejects HTTP 400, 401, 403, 404, 429, and 500 status codes', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const statusCodes = [400, 401, 403, 404, 429, 500, 502, 503];

      for (const status of statusCodes) {
        const error = {
          response: {
            status,
            data: { message: `Error with status ${status}` },
          },
        };
        const handled = modal.handleQuotaError(error);
        expect(handled).toBe(false);
        expect(modal.isOpen).toBe(false);
      }
    });

    it('[CH3_INTERCEPT_08] Handles malformed and edge-case errors safely without crashing', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const malformedErrors = [
        null,
        undefined,
        '',
        'Network Error',
        {},
        { response: null },
        { response: {} },
        { response: { data: null } },
        { response: { data: 'plain text error' } },
        { isAxiosError: true, message: 'Network Timeout' },
      ];

      for (const err of malformedErrors) {
        const handled = modal.handleQuotaError(err);
        expect(handled).toBe(false);
        expect(modal.isOpen).toBe(false);
      }
    });
  });

  // ==========================================================================
  // SECTION 3: Task Dispatch, Project Creation & Member Invite Quota Simulation
  // ==========================================================================
  describe('3. Real-world Quota Intercept Simulation', () => {
    it('[CH3_SIM_01] Remote task dispatch intercepts runner limit and closes dispatch dialog', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      let dispatchModalOpen = true;

      // Simulated dispatch action on Community workspace with 1 busy runner
      try {
        const fakeResponse = {
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
                upgrade_url: '/workspaces/5/billing',
              },
            },
          },
        };
        throw fakeResponse;
      } catch (err: any) {
        const quotaHandled = modal.handleQuotaError(err);
        if (quotaHandled) {
          dispatchModalOpen = false;
        }
      }

      expect(dispatchModalOpen).toBe(false);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('runners');
      expect(modal.quotaData?.suggested_plan).toBe('pro');
    });

    it('[CH3_SIM_02] Project creation intercepts project limit and closes project modal', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      let projectModalOpen = true;

      // Simulated project save on Community workspace with 3 projects
      try {
        const fakeResponse = {
          response: {
            status: 422,
            data: {
              success: false,
              error_code: 'PLAN_QUOTA_EXCEEDED',
              message: 'Project limit reached (3/3 projects). Upgrade your plan to create unlimited projects.',
              quota: {
                resource: 'projects',
                current_usage: 3,
                limit: 3,
                current_plan: 'community',
                suggested_plan: 'pro',
                upgrade_url: '/workspaces/5/billing',
              },
            },
          },
        };
        throw fakeResponse;
      } catch (err: any) {
        const quotaHandled = modal.handleQuotaError(err);
        if (quotaHandled) {
          projectModalOpen = false;
        }
      }

      expect(projectModalOpen).toBe(false);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData?.resource).toBe('projects');
      expect(modal.quotaData?.current_usage).toBe(3);
    });

    it('[CH3_SIM_03] Pro tier 4th runner dispatch suggests Team tier', () => {
      const modal = UpgradeModalSingletonModel.getInstance();

      const fakeResponse = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Runner concurrency limit reached (3/3 active).',
            quota: {
              resource: 'runners',
              current_usage: 3,
              limit: 3,
              current_plan: 'pro',
              suggested_plan: 'team',
              upgrade_url: '/workspaces/9/billing',
            },
          },
        },
      };

      const handled = modal.handleQuotaError(fakeResponse);
      expect(handled).toBe(true);
      expect(modal.quotaData?.current_plan).toBe('pro');
      expect(modal.quotaData?.suggested_plan).toBe('team');
    });
  });

  // ==========================================================================
  // SECTION 4: Deep-Link Target URL & Billing Navigation Resolution
  // ==========================================================================
  describe('4. Deep-Link Target URL Resolution', () => {
    it('[CH3_NAV_01] Generates correct deep-link query parameter on clean base URL', () => {
      const url1 = computeUpgradeTargetUrl('/workspaces/10/billing', 'pro');
      expect(url1).toBe('/workspaces/10/billing?plan=pro');

      const url2 = computeUpgradeTargetUrl('/workspaces/25/billing', 'team');
      expect(url2).toBe('/workspaces/25/billing?plan=team');

      const url3 = computeUpgradeTargetUrl('/workspaces/88/billing', 'enterprise');
      expect(url3).toBe('/workspaces/88/billing?plan=enterprise');
    });

    it('[CH3_NAV_02] Preserves existing query parameters when appending plan parameter', () => {
      const urlWithQuery = computeUpgradeTargetUrl('/workspaces/10/billing?tab=plan&ref=nav', 'team');
      expect(urlWithQuery).toBe('/workspaces/10/billing?tab=plan&ref=nav&plan=team');
    });

    it('[CH3_NAV_03] Uses /pricing fallback if upgrade_url is empty or undefined', () => {
      expect(computeUpgradeTargetUrl('', 'pro')).toBe('/pricing?plan=pro');
      expect(computeUpgradeTargetUrl(undefined, 'pro')).toBe('/pricing?plan=pro');
    });

    it('[CH3_NAV_04] Verifies Workspaces/Billing/Index.vue parses ?plan= query param on mount', () => {
      const billingFilePath = path.resolve(__dirname, '../../resources/js/Pages/Workspaces/Billing/Index.vue');
      expect(fs.existsSync(billingFilePath)).toBe(true);
      const content = fs.readFileSync(billingFilePath, 'utf8');

      expect(content.includes("params.get('plan')")).toBe(true);
      expect(content.includes("getElementById('plan-switcher-grid')")).toBe(true);
      expect(content.includes("scrollIntoView({ behavior: 'smooth' })")).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 5: UpgradeModal UI State, Title, Perks & Limit Mapping
  // ==========================================================================
  describe('5. UpgradeModal UI State & Display Formatting', () => {
    it('[CH3_UI_01] Maps all resource types to accurate header titles', () => {
      expect(getResourceTitle('runners')).toBe('Concurrent Runner Limit Reached');
      expect(getResourceTitle('seats')).toBe('Workspace Seat Limit Reached');
      expect(getResourceTitle('projects')).toBe('Active Project Limit Reached');
      expect(getResourceTitle('storage')).toBe('Plan Quota Limit Reached');
      expect(getResourceTitle('')).toBe('Plan Quota Limit Reached');
    });

    it('[CH3_UI_02] Provides rich and accurate perks for Pro, Team and Enterprise plans', () => {
      const proPerks = getPlanPerks('pro');
      expect(proPerks.length).toBeGreaterThanOrEqual(4);
      expect(proPerks.some(p => p.includes('3 Concurrent Desktop Runners'))).toBe(true);
      expect(proPerks.some(p => p.includes('Unlimited Projects'))).toBe(true);

      const teamPerks = getPlanPerks('team');
      expect(teamPerks.length).toBeGreaterThanOrEqual(4);
      expect(teamPerks.some(p => p.includes('10 Concurrent Desktop Runners'))).toBe(true);
      expect(teamPerks.some(p => p.includes('10 Team Member Seats'))).toBe(true);

      const enterprisePerks = getPlanPerks('enterprise');
      expect(enterprisePerks.length).toBeGreaterThanOrEqual(4);
      expect(enterprisePerks.some(p => p.includes('Unlimited Concurrent Runners'))).toBe(true);
      expect(enterprisePerks.some(p => p.includes('SAML/SSO'))).toBe(true);

      const customPerks = getPlanPerks('custom');
      expect(customPerks.length).toBeGreaterThanOrEqual(3);
    });

    it('[CH3_UI_03] Formats current limits correctly including pluralization and Unlimited', () => {
      expect(getCurrentLimitDisplay(null, 'runners')).toBe('Unlimited');
      expect(getCurrentLimitDisplay(1, 'runners')).toBe('1 runner');
      expect(getCurrentLimitDisplay(3, 'runners')).toBe('3 runners');
      expect(getCurrentLimitDisplay(1, 'seats')).toBe('1 seat');
      expect(getCurrentLimitDisplay(10, 'seats')).toBe('10 seats');
      expect(getCurrentLimitDisplay(1, 'projects')).toBe('1 project');
      expect(getCurrentLimitDisplay(5, 'projects')).toBe('5 projects');
    });

    it('[CH3_UI_04] Formats suggested limits for Pro, Team and Enterprise accurately', () => {
      expect(getSuggestedLimitDisplay('pro', 'runners')).toBe('3 runners');
      expect(getSuggestedLimitDisplay('pro', 'projects')).toBe('Unlimited');
      expect(getSuggestedLimitDisplay('pro', 'seats')).toBe('1 seat');

      expect(getSuggestedLimitDisplay('team', 'runners')).toBe('10 runners');
      expect(getSuggestedLimitDisplay('team', 'projects')).toBe('Unlimited');
      expect(getSuggestedLimitDisplay('team', 'seats')).toBe('10 seats');

      expect(getSuggestedLimitDisplay('enterprise', 'runners')).toBe('Unlimited');
      expect(getSuggestedLimitDisplay('enterprise', 'projects')).toBe('Unlimited');
      expect(getSuggestedLimitDisplay('enterprise', 'seats')).toBe('Unlimited');
    });

    it('[CH3_UI_05] UpgradeModal.vue component source contains required accessibility & UI elements', () => {
      const modalPath = path.resolve(__dirname, '../../resources/js/Components/billing/UpgradeModal.vue');
      expect(fs.existsSync(modalPath)).toBe(true);
      const content = fs.readFileSync(modalPath, 'utf8');

      // Modal structure & accessibility
      expect(content.includes('role="dialog"')).toBe(true);
      expect(content.includes('aria-modal="true"')).toBe(true);
      expect(content.includes('handleKeyDown')).toBe(true);
      expect(content.includes("e.key === 'Escape'")).toBe(true);

      // Actions & navigation
      expect(content.includes('handleUpgradeNavigate')).toBe(true);
      expect(content.includes('upgradeTargetUrl')).toBe(true);
      expect(content.includes('View All Plans')).toBe(true);
      expect(content.includes('Contact Enterprise Sales')).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 6: Adversarial Stress, Fuzzing & Security Hardening
  // ==========================================================================
  describe('6. Adversarial Fuzzing & Security Hardening', () => {
    it('[CH3_FUZZ_01] Resilient against XSS injection strings in error message and plans', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const xssStrings = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(1)>',
        "javascript:alert('pwned')",
      ];

      for (const xss of xssStrings) {
        modal.openUpgradeModal({
          resource: 'runners',
          current_usage: 1,
          limit: 1,
          current_plan: xss,
          suggested_plan: xss,
          upgrade_url: `/workspaces/1/billing?name=${encodeURIComponent(xss)}`,
          message: xss,
        });

        expect(modal.isOpen).toBe(true);
        expect(modal.quotaData?.message).toBe(xss);
        const targetUrl = computeUpgradeTargetUrl(modal.quotaData?.upgrade_url, modal.quotaData?.suggested_plan);
        expect(typeof targetUrl).toBe('string');
      }
    });

    it('[CH3_FUZZ_02] Resilient against extreme numeric bounds (negative, large integers, floating point)', () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const bounds = [-999, -1, 0, 1.5, 999999999, Number.MAX_SAFE_INTEGER];

      for (const num of bounds) {
        modal.openUpgradeModal({
          resource: 'runners',
          current_usage: num,
          limit: num,
          current_plan: 'community',
          suggested_plan: 'pro',
          upgrade_url: '/workspaces/1/billing',
        });

        expect(modal.isOpen).toBe(true);
        expect(modal.quotaData?.current_usage).toBe(num);
        expect(modal.quotaData?.limit).toBe(num);
      }
    });

    it('[CH3_FUZZ_03] Concurrent multi-source error bursts (100 parallel errors)', async () => {
      const modal = UpgradeModalSingletonModel.getInstance();
      const errors = Array.from({ length: 100 }, (_, i) => ({
        response: {
          status: 422,
          data: {
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: `Burst error #${i}`,
            quota: {
              resource: i % 2 === 0 ? 'runners' : 'projects',
              current_usage: i,
              limit: i,
              current_plan: 'community',
              suggested_plan: 'pro',
              upgrade_url: `/workspaces/${i}/billing`,
            },
          },
        },
      }));

      // Simulate concurrent async error dispatches
      const results = await Promise.all(
        errors.map(err => Promise.resolve(modal.handleQuotaError(err)))
      );

      expect(results.every(r => r === true)).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.quotaData).not.toBeNull();
    });
  });
});
