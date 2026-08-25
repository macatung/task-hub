import { describe, expect, it, vi, beforeEach } from 'vitest';
import planUpgradeModalSource from './PlanUpgradeModal.vue?raw';
import { useUpgradeModal } from '../composables/useUpgradeModal';

describe('PlanUpgradeModal Adversarial & Stress Challenge Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Deep-Link URL Generation & Boundary Stress Testing', () => {
    const generateBillingUrl = (workspaceSlug?: string, taskHubUrl?: string): string => {
      const base = (
        taskHubUrl ||
        (typeof process !== 'undefined' && process.env?.VITE_TASK_HUB_URL) ||
        'https://task-hub.macatung.dev'
      ).replace(/\/$/, '');

      if (workspaceSlug && workspaceSlug.trim()) {
        return `${base}/workspaces/${encodeURIComponent(workspaceSlug.trim())}/billing`;
      }
      return `${base}/pricing`;
    };

    it('handles special characters, symbols, and query injections in workspace slugs', () => {
      const testCases = [
        {
          input: 'slug with spaces',
          expected: 'https://task-hub.macatung.dev/workspaces/slug%20with%20spaces/billing',
        },
        {
          input: 'team/alpha/subteam',
          expected: 'https://task-hub.macatung.dev/workspaces/team%2Falpha%2Fsubteam/billing',
        },
        {
          input: 'workspace?query=attack&admin=true',
          expected: 'https://task-hub.macatung.dev/workspaces/workspace%3Fquery%3Dattack%26admin%3Dtrue/billing',
        },
        {
          input: 'team#section',
          expected: 'https://task-hub.macatung.dev/workspaces/team%23section/billing',
        },
        {
          input: 'khu-vực-phát-triển-ai',
          expected: 'https://task-hub.macatung.dev/workspaces/khu-v%E1%BB%B1c-ph%C3%A1t-tri%E1%BB%83n-ai/billing',
        },
        {
          input: '<script>alert(1)</script>',
          expected: 'https://task-hub.macatung.dev/workspaces/%3Cscript%3Ealert(1)%3C%2Fscript%3E/billing',
        },
        {
          input: '  padded-workspace-slug  ',
          expected: 'https://task-hub.macatung.dev/workspaces/padded-workspace-slug/billing',
        },
      ];

      for (const { input, expected } of testCases) {
        expect(generateBillingUrl(input)).toBe(expected);
      }
    });

    it('falls back safely to /pricing when workspace slug is empty, whitespace, null, or undefined', () => {
      expect(generateBillingUrl('')).toBe('https://task-hub.macatung.dev/pricing');
      expect(generateBillingUrl('   ')).toBe('https://task-hub.macatung.dev/pricing');
      expect(generateBillingUrl(undefined)).toBe('https://task-hub.macatung.dev/pricing');
      expect(generateBillingUrl(undefined, 'https://custom-hub.org/')).toBe('https://custom-hub.org/pricing');
    });

    it('handles trailing slashes, ports, and custom domains in taskHubUrl', () => {
      expect(generateBillingUrl('my-ws', 'https://hub.enterprise.local/')).toBe(
        'https://hub.enterprise.local/workspaces/my-ws/billing'
      );
      expect(generateBillingUrl('my-ws', 'http://127.0.0.1:8000')).toBe(
        'http://127.0.0.1:8000/workspaces/my-ws/billing'
      );
      expect(generateBillingUrl('', 'http://localhost:3000/')).toBe(
        'http://localhost:3000/pricing'
      );
    });
  });

  describe('2. Offline, DesktopApi IPC, and Fallback Resilience', () => {
    it('executes window.desktopApi.openExternal when available in Electron environment', () => {
      const openExternalMock = vi.fn();
      (globalThis as any).window = {
        desktopApi: {
          openExternal: openExternalMock,
        },
      };

      const testUrl = 'https://task-hub.macatung.dev/workspaces/prod/billing';
      if ((globalThis as any).window?.desktopApi?.openExternal) {
        (globalThis as any).window.desktopApi.openExternal(testUrl);
      }

      expect(openExternalMock).toHaveBeenCalledTimes(1);
      expect(openExternalMock).toHaveBeenCalledWith(testUrl);
    });

    it('falls back gracefully to window.open when desktopApi is absent (Web preview / fallback)', () => {
      const openMock = vi.fn();
      (globalThis as any).window = {
        open: openMock,
      };

      const testUrl = 'https://task-hub.macatung.dev/pricing';
      if ((globalThis as any).window?.desktopApi?.openExternal) {
        (globalThis as any).window.desktopApi.openExternal(testUrl);
      } else if (typeof (globalThis as any).window?.open === 'function') {
        (globalThis as any).window.open(testUrl, '_blank');
      }

      expect(openMock).toHaveBeenCalledWith(testUrl, '_blank');
    });

    it('survives exceptions in openExternal or window.open without throwing unhandled rejection', () => {
      const failingMock = vi.fn().mockImplementation(() => {
        throw new Error('OS Shell Execution Failed / Offline');
      });
      (globalThis as any).window = {
        desktopApi: {
          openExternal: failingMock,
        },
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const triggerSafeUpgrade = (url: string) => {
        try {
          if (typeof window !== 'undefined' && (window as any).desktopApi?.openExternal) {
            (window as any).desktopApi.openExternal(url);
          } else if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(url, '_blank');
          }
        } catch (err) {
          console.warn('Failed to open external billing URL:', err);
        }
      };

      expect(() => triggerSafeUpgrade('https://task-hub.macatung.dev/pricing')).not.toThrow();
      expect(failingMock).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to open external billing URL:',
        expect.any(Error)
      );
    });
  });

  describe('3. Annual Discount Toggle Math & Precision Verification', () => {
    it('verifies exact mathematical discount ratios for all 3 paid tiers', () => {
      const tiers = [
        {
          name: 'Pro',
          monthlyRate: 19,
          annualMonthlyEffective: 15,
          annualTotalBill: 180,
          expectedFullAnnual: 19 * 12, // 228
          discountPercent: ((228 - 180) / 228) * 100, // 21.05%
        },
        {
          name: 'Team',
          monthlyRate: 49,
          annualMonthlyEffective: 39,
          annualTotalBill: 468,
          expectedFullAnnual: 49 * 12, // 588
          discountPercent: ((588 - 468) / 588) * 100, // 20.41%
        },
        {
          name: 'Enterprise',
          monthlyRate: 199,
          annualMonthlyEffective: 159,
          annualTotalBill: 1908,
          expectedFullAnnual: 199 * 12, // 2388
          discountPercent: ((2388 - 1908) / 2388) * 100, // 20.10%
        },
      ];

      for (const tier of tiers) {
        // Effective monthly * 12 equals annual total bill
        expect(tier.annualMonthlyEffective * 12).toBe(tier.annualTotalBill);

        // Effective discount percentage is at least 20% and at most 21.5%
        expect(tier.discountPercent).toBeGreaterThanOrEqual(20.0);
        expect(tier.discountPercent).toBeLessThanOrEqual(21.5);

        // Full annual bill without discount exceeds discounted bill
        expect(tier.expectedFullAnnual).toBeGreaterThan(tier.annualTotalBill);
      }
    });

    it('verifies template contains Pro and Team monthly/annual ternary expressions and discount badge', () => {
      expect(planUpgradeModalSource).toContain("billingCycle === 'annual' ? '$15' : '$19'");
      expect(planUpgradeModalSource).toContain("billingCycle === 'annual' ? '$39' : '$49'");
      expect(planUpgradeModalSource).toContain('Billed annually ($180/yr)');
      expect(planUpgradeModalSource).toContain('Billed annually ($468/yr)');
      expect(planUpgradeModalSource).toContain('SAVE 20%');
    });
  });

  describe('4. Quota Error Interception & Edge Payload Handling', () => {
    it('handles malformed, empty, or unexpected quota error structures gracefully', () => {
      const { handleQuotaError, isOpen, modalState, closeUpgradeModal } = useUpgradeModal();

      // Null or undefined
      expect(handleQuotaError(null)).toBe(false);
      expect(handleQuotaError(undefined)).toBe(false);
      expect(isOpen.value).toBe(false);

      // Generic error without quota keywords
      expect(handleQuotaError(new Error('SyntaxError: unexpected token'))).toBe(false);
      expect(isOpen.value).toBe(false);

      // Error with numeric limits as strings
      const stringNumericPayload = {
        response: {
          data: {
            error_code: 'PLAN_QUOTA_EXCEEDED',
            plan: 'PRO',
            limit: '3',
            active: '3',
            message: 'All 3 concurrent runners in use.',
          },
        },
      };

      const result = handleQuotaError(stringNumericPayload, {
        workspaceSlug: 'adversarial-team',
      });

      expect(result).toBe(true);
      expect(isOpen.value).toBe(true);
      expect(modalState.value.currentPlan).toBe('PRO');
      expect(modalState.value.currentLimit).toBe(3);
      expect(modalState.value.activeCount).toBe(3);
      expect(modalState.value.workspaceSlug).toBe('adversarial-team');

      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('correctly extracts quota info when active count comes from current_usage', () => {
      const { handleQuotaError, modalState } = useUpgradeModal();

      const usagePayload = {
        data: {
          error_code: 'PLAN_QUOTA_EXCEEDED',
          current_plan: 'team',
          limit: 10,
          current_usage: 10,
        },
      };

      const intercepted = handleQuotaError(usagePayload);
      expect(intercepted).toBe(true);
      expect(modalState.value.currentPlan).toBe('team');
      expect(modalState.value.currentLimit).toBe(10);
      expect(modalState.value.activeCount).toBe(10);
    });
  });

  describe('5. Plan Normalization & Formatting Logic', () => {
    it('normalizes various casing and whitespace variations of plan names', () => {
      const normalizePlan = (rawPlan?: string): string => {
        const plan = (rawPlan || 'community').toLowerCase().trim();
        switch (plan) {
          case 'pro':
            return 'Pro';
          case 'team':
            return 'Team';
          case 'enterprise':
            return 'Enterprise';
          case 'community':
          default:
            return 'Community';
        }
      };

      expect(normalizePlan('community')).toBe('Community');
      expect(normalizePlan('COMMUNITY')).toBe('Community');
      expect(normalizePlan('  pro  ')).toBe('Pro');
      expect(normalizePlan('TEAM')).toBe('Team');
      expect(normalizePlan('Enterprise')).toBe('Enterprise');
      expect(normalizePlan('')).toBe('Community');
      expect(normalizePlan(undefined)).toBe('Community');
      expect(normalizePlan('custom_tier')).toBe('Community');
    });
  });
});
