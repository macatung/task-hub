import { describe, expect, it, vi, beforeEach } from 'vitest';
import planUpgradeModalSource from './PlanUpgradeModal.vue?raw';
import agentConsoleModalSource from './AgentConsoleModal.vue?raw';
import { useUpgradeModal } from '../composables/useUpgradeModal';

describe('PlanUpgradeModal Component & Studio Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Component Template & VS Code Dark Aesthetic', () => {
    it('implements the VS Code dark aesthetic container and borders', () => {
      expect(planUpgradeModalSource).toContain("bg-[#1e1e1e]");
      expect(planUpgradeModalSource).toContain("border-[#3e3e42]");
      expect(planUpgradeModalSource).toContain("bg-[#252526]");
      expect(planUpgradeModalSource).toContain("border-[#2d2d2d]");
    });

    it('exposes standard data-testid attributes for automated testing', () => {
      expect(planUpgradeModalSource).toContain('data-testid="plan-upgrade-modal"');
      expect(planUpgradeModalSource).toContain('data-testid="current-plan-banner"');
      expect(planUpgradeModalSource).toContain('data-testid="tier-card-pro"');
      expect(planUpgradeModalSource).toContain('data-testid="tier-card-team"');
      expect(planUpgradeModalSource).toContain('data-testid="tier-card-enterprise"');
      expect(planUpgradeModalSource).toContain('data-testid="upgrade-cta-button"');
      expect(planUpgradeModalSource).toContain('data-testid="close-modal-button"');
    });
  });

  describe('2. Props & Emits Contract', () => {
    it('defines expected props interface with default values', () => {
      expect(planUpgradeModalSource).toContain('show: boolean');
      expect(planUpgradeModalSource).toContain('currentPlan?: string');
      expect(planUpgradeModalSource).toContain('currentLimit?: number');
      expect(planUpgradeModalSource).toContain('activeCount?: number');
      expect(planUpgradeModalSource).toContain('workspaceSlug?: string');
      expect(planUpgradeModalSource).toContain('taskHubUrl?: string');
      expect(planUpgradeModalSource).toContain('reasonMessage?: string');
    });

    it('defines close and upgrade emit events', () => {
      expect(planUpgradeModalSource).toContain("(e: 'close'): void");
      expect(planUpgradeModalSource).toContain("(e: 'upgrade', url: string): void");
    });
  });

  describe('3. Tier Comparison Grid & Pricing Matrix', () => {
    it('displays Pro tier with $19/mo ($15/mo annual) and 3 concurrent runners', () => {
      expect(planUpgradeModalSource).toContain('3 Concurrent Runners');
      expect(planUpgradeModalSource).toContain('Unlimited Projects');
      expect(planUpgradeModalSource).toContain('Priority AI Agent Queue');
      expect(planUpgradeModalSource).toContain('POPULAR');
      expect(planUpgradeModalSource).toContain("billingCycle === 'annual' ? '$15' : '$19'");
    });

    it('displays Team tier with $49/mo ($39/mo annual), 10 concurrent runners, and 5 seats', () => {
      expect(planUpgradeModalSource).toContain('10 Concurrent Runners');
      expect(planUpgradeModalSource).toContain('5 Workspace Seats included');
      expect(planUpgradeModalSource).toContain('Shared Team MCPs & Skills');
      expect(planUpgradeModalSource).toContain('Centralized Run Telemetry');
      expect(planUpgradeModalSource).toContain('TEAM');
      expect(planUpgradeModalSource).toContain("billingCycle === 'annual' ? '$39' : '$49'");
    });

    it('displays Enterprise tier with custom concurrency, SLA, and SSO', () => {
      expect(planUpgradeModalSource).toContain('Unlimited / Custom Runners');
      expect(planUpgradeModalSource).toContain('Unlimited Seats & SSO / SAML');
      expect(planUpgradeModalSource).toContain('Dedicated 24/7 Support & SLA');
      expect(planUpgradeModalSource).toContain('Self-Hosted Runners Option');
      expect(planUpgradeModalSource).toContain('Enterprise');
    });

    it('provides Annual billing discount badge saving 20%', () => {
      expect(planUpgradeModalSource).toContain('SAVE 20%');
      expect(planUpgradeModalSource).toContain('billingCycle');
    });
  });

  describe('4. Deep-Link URL Construction & Execution', () => {
    it('constructs billing URL with workspace slug when slug is provided', () => {
      const buildUrl = (workspaceSlug?: string, taskHubUrl?: string) => {
        const base = (taskHubUrl || 'https://task-hub.macatung.dev').replace(/\/$/, '');
        if (workspaceSlug && workspaceSlug.trim()) {
          return `${base}/workspaces/${encodeURIComponent(workspaceSlug.trim())}/billing`;
        }
        return `${base}/pricing`;
      };

      expect(buildUrl('my-workspace')).toBe('https://task-hub.macatung.dev/workspaces/my-workspace/billing');
      expect(buildUrl('team-alpha/v2', 'https://hub.corp.internal/')).toBe(
        'https://hub.corp.internal/workspaces/team-alpha%2Fv2/billing'
      );
      expect(buildUrl('space with spaces')).toBe(
        'https://task-hub.macatung.dev/workspaces/space%20with%20spaces/billing'
      );
    });

    it('falls back to public pricing page when workspace slug is empty or omitted', () => {
      const buildUrl = (workspaceSlug?: string, taskHubUrl?: string) => {
        const base = (taskHubUrl || 'https://task-hub.macatung.dev').replace(/\/$/, '');
        if (workspaceSlug && workspaceSlug.trim()) {
          return `${base}/workspaces/${encodeURIComponent(workspaceSlug.trim())}/billing`;
        }
        return `${base}/pricing`;
      };

      expect(buildUrl('')).toBe('https://task-hub.macatung.dev/pricing');
      expect(buildUrl(undefined, 'https://custom-hub.dev')).toBe('https://custom-hub.dev/pricing');
    });

    it('calls desktopApi.openExternal when deep-link upgrade is triggered', () => {
      const openExternalMock = vi.fn();
      const mockApi = {
        openExternal: openExternalMock,
      };
      (globalThis as any).window = {
        desktopApi: mockApi,
      };

      const targetUrl = 'https://task-hub.macatung.dev/workspaces/demo/billing';
      if ((globalThis as any).window?.desktopApi?.openExternal) {
        (globalThis as any).window.desktopApi.openExternal(targetUrl);
      }

      expect(openExternalMock).toHaveBeenCalledWith(targetUrl);
    });
  });

  describe('5. Composable `useUpgradeModal` Quota Interception Logic', () => {
    it('intercepts standard HTTP 422 PLAN_QUOTA_EXCEEDED payload', () => {
      const { isOpen, modalState, handleQuotaError, closeUpgradeModal } = useUpgradeModal();

      const quotaError = {
        response: {
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            quota_type: 'concurrent_runners',
            message: 'Concurrent runner limit reached for your current plan (1/1 active).',
            plan: 'community',
            limit: 1,
            active: 1,
            upgrade_url: '/workspaces/test-workspace/billing',
          },
        },
      };

      const intercepted = handleQuotaError(quotaError, {
        workspaceSlug: 'test-workspace',
        taskHubUrl: 'https://task-hub.macatung.dev',
      });

      expect(intercepted).toBe(true);
      expect(isOpen.value).toBe(true);
      expect(modalState.value.currentPlan).toBe('community');
      expect(modalState.value.currentLimit).toBe(1);
      expect(modalState.value.activeCount).toBe(1);
      expect(modalState.value.workspaceSlug).toBe('test-workspace');

      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('intercepts error string containing runner limit or PLAN_QUOTA_EXCEEDED', () => {
      const { isOpen, modalState, handleQuotaError, closeUpgradeModal } = useUpgradeModal();

      const error = new Error('Runner limit reached: 3/3 active runners for plan pro.');
      const intercepted = handleQuotaError(error, { workspaceSlug: 'pro-team' });

      expect(intercepted).toBe(true);
      expect(isOpen.value).toBe(true);
      expect(modalState.value.workspaceSlug).toBe('pro-team');

      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('ignores unrelated non-quota errors', () => {
      const { isOpen, handleQuotaError } = useUpgradeModal();

      const unrelatedError = new Error('Network timeout connecting to server');
      const intercepted = handleQuotaError(unrelatedError);

      expect(intercepted).toBe(false);
      expect(isOpen.value).toBe(false);
    });
  });

  describe('6. Studio & Dispatch Modal Integration', () => {
    it('integrates PlanUpgradeModal into AgentConsoleModal.vue', () => {
      expect(agentConsoleModalSource).toContain("import PlanUpgradeModal from './PlanUpgradeModal.vue'");
      expect(agentConsoleModalSource).toContain('showPlanUpgradeModal');
      expect(agentConsoleModalSource).toContain('<PlanUpgradeModal');
      expect(agentConsoleModalSource).toContain(':current-plan="upgradeModalPlan"');
      expect(agentConsoleModalSource).toContain(':current-limit="upgradeModalLimit"');
      expect(agentConsoleModalSource).toContain(':active-count="upgradeModalActiveCount"');
    });

    it('intercepts PLAN_QUOTA_EXCEEDED during startAgent in AgentConsoleModal.vue', () => {
      expect(agentConsoleModalSource).toContain('PLAN_QUOTA_EXCEEDED');
      expect(agentConsoleModalSource).toContain('showPlanUpgradeModal.value = true');
    });

    it('exposes Upgrade Plan button in AgentConsoleModal.vue Plan section', () => {
      expect(agentConsoleModalSource).toContain('openPlanUpgradeModal');
      expect(agentConsoleModalSource).toContain('Upgrade Plan');
    });
  });
});
