import { describe, expect, it, vi, beforeEach } from 'vitest';
import planUpgradeModalSource from './PlanUpgradeModal.vue?raw';
import agentConsoleModalSource from './AgentConsoleModal.vue?raw';
import taskDispatchModalSource from './TaskDispatchModal.vue?raw';
import { useUpgradeModal } from '../composables/useUpgradeModal';

describe('Challenger M4.2: Comprehensive Desktop Quota Interception Stress Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. useUpgradeModal Composable — Extreme Payload & Edge Case Matrix', () => {
    it('handles standard Axios HTTP 422 error format with response.data', () => {
      const { handleQuotaError, isOpen, modalState, closeUpgradeModal } = useUpgradeModal();

      const axiosError = {
        name: 'AxiosError',
        message: 'Request failed with status code 422',
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            quota_type: 'concurrent_runners',
            current_plan: 'pro',
            limit: 3,
            active: 3,
            message: 'Active runners (3) reached the maximum limit (3) for plan pro.',
            upgrade_url: '/workspaces/corp-ai/billing',
          },
        },
      };

      const result = handleQuotaError(axiosError, {
        workspaceSlug: 'corp-ai',
        taskHubUrl: 'https://hub.macatung.dev',
      });

      expect(result).toBe(true);
      expect(isOpen.value).toBe(true);
      expect(modalState.value.currentPlan).toBe('pro');
      expect(modalState.value.currentLimit).toBe(3);
      expect(modalState.value.activeCount).toBe(3);
      expect(modalState.value.workspaceSlug).toBe('corp-ai');
      expect(modalState.value.taskHubUrl).toBe('https://hub.macatung.dev');
      expect(modalState.value.reasonMessage).toBe(
        'Active runners (3) reached the maximum limit (3) for plan pro.'
      );

      closeUpgradeModal();
      expect(isOpen.value).toBe(false);
    });

    it('handles flat error payload and alternative key structures (current_usage, plan)', () => {
      const { handleQuotaError, isOpen, modalState, closeUpgradeModal } = useUpgradeModal();

      const flatPayload = {
        error_code: 'PLAN_QUOTA_EXCEEDED',
        plan: 'team',
        limit: 10,
        current_usage: 10,
        message: 'Team plan limit of 10 concurrent runners exceeded.',
      };

      const result = handleQuotaError(flatPayload);

      expect(result).toBe(true);
      expect(isOpen.value).toBe(true);
      expect(modalState.value.currentPlan).toBe('team');
      expect(modalState.value.currentLimit).toBe(10);
      expect(modalState.value.activeCount).toBe(10);
      expect(modalState.value.reasonMessage).toBe(
        'Team plan limit of 10 concurrent runners exceeded.'
      );

      closeUpgradeModal();
    });

    it('coerces string limits and actives to valid numbers', () => {
      const { handleQuotaError, modalState, closeUpgradeModal } = useUpgradeModal();

      const stringValuesError = {
        data: {
          error_code: 'PLAN_QUOTA_EXCEEDED',
          plan: 'enterprise',
          limit: '25',
          active: '25',
        },
      };

      const result = handleQuotaError(stringValuesError);
      expect(result).toBe(true);
      expect(modalState.value.currentLimit).toBe(25);
      expect(modalState.value.activeCount).toBe(25);

      closeUpgradeModal();
    });

    it('falls back safely to default 1 when limit or active are missing, null, or undefined', () => {
      const { handleQuotaError, modalState, closeUpgradeModal } = useUpgradeModal();

      const partialError = {
        error_code: 'PLAN_QUOTA_EXCEEDED',
        plan: 'community',
        limit: null,
        active: null,
      };

      const result = handleQuotaError(partialError);
      expect(result).toBe(true);
      expect(modalState.value.currentLimit).toBe(1);
      expect(modalState.value.activeCount).toBe(1);

      closeUpgradeModal();
    });

    it('intercepts case-insensitive string errors containing runner limit keywords', () => {
      const { handleQuotaError, isOpen, closeUpgradeModal } = useUpgradeModal();

      const testErrors = [
        new Error('Error: PLAN_QUOTA_EXCEEDED occurred in runner dispatch'),
        new Error('Runner limit reached: 1/1 active runners'),
        new Error('Maximum CONCURRENT RUNNER capacity has been reached'),
        new Error('Server responded: concurrent runner quota exceeded'),
        { message: 'Plan runner limit constraint violated' },
      ];

      for (const err of testErrors) {
        const intercepted = handleQuotaError(err);
        expect(intercepted).toBe(true);
        expect(isOpen.value).toBe(true);
        closeUpgradeModal();
        expect(isOpen.value).toBe(false);
      }
    });

    it('rejects unrelated and non-quota errors without opening the modal', () => {
      const { handleQuotaError, isOpen } = useUpgradeModal();

      const nonQuotaErrors = [
        new Error('ECONNRESET: connection lost'),
        new Error('404 Not Found: task id not found'),
        new Error('Authentication failed: token expired'),
        { code: 'ETIMEDOUT', message: 'Socket timed out' },
        { status: 500, message: 'Internal Server Error' },
        null,
        undefined,
        false,
        0,
        '',
        {},
        [],
      ];

      for (const err of nonQuotaErrors) {
        const intercepted = handleQuotaError(err);
        expect(intercepted).toBe(false);
        expect(isOpen.value).toBe(false);
      }
    });

    it('preserves existing workspaceSlug and taskHubUrl if not overridden in context', () => {
      const { openUpgradeModal, handleQuotaError, modalState } = useUpgradeModal();

      openUpgradeModal({
        workspaceSlug: 'initial-workspace',
        taskHubUrl: 'https://initial-hub.dev',
      });

      expect(modalState.value.workspaceSlug).toBe('initial-workspace');
      expect(modalState.value.taskHubUrl).toBe('https://initial-hub.dev');

      // Now trigger quota error without context
      handleQuotaError({
        error_code: 'PLAN_QUOTA_EXCEEDED',
        plan: 'pro',
        limit: 3,
        active: 3,
      });

      expect(modalState.value.workspaceSlug).toBe('initial-workspace');
      expect(modalState.value.taskHubUrl).toBe('https://initial-hub.dev');
      expect(modalState.value.currentPlan).toBe('pro');
    });
  });

  describe('2. AgentConsoleModal Integration & Error Interception', () => {
    it('imports PlanUpgradeModal in AgentConsoleModal.vue', () => {
      expect(agentConsoleModalSource).toMatch(/import\s+PlanUpgradeModal\s+from\s+['"]\.\/PlanUpgradeModal\.vue['"]/);
    });

    it('defines showPlanUpgradeModal ref and upgrade modal state refs', () => {
      expect(agentConsoleModalSource).toContain('const showPlanUpgradeModal = ref(false)');
      expect(agentConsoleModalSource).toContain('const upgradeModalPlan = ref(');
      expect(agentConsoleModalSource).toContain('const upgradeModalLimit = ref(');
      expect(agentConsoleModalSource).toContain('const upgradeModalActiveCount = ref(');
      expect(agentConsoleModalSource).toContain('const upgradeModalReason = ref(');
    });

    it('provides openPlanUpgradeModal helper function', () => {
      expect(agentConsoleModalSource).toContain('const openPlanUpgradeModal = (plan?: string, limit?: number, active?: number, reason?: string) =>');
      expect(agentConsoleModalSource).toContain('showPlanUpgradeModal.value = true');
    });

    it('catches PLAN_QUOTA_EXCEEDED and runner limits in startAgent catch block', () => {
      expect(agentConsoleModalSource).toContain('errStr.includes(\'PLAN_QUOTA_EXCEEDED\')');
      expect(agentConsoleModalSource).toContain('errStr.toLowerCase().includes(\'concurrent runner\')');
      expect(agentConsoleModalSource).toContain('errStr.toLowerCase().includes(\'runner limit\')');
      expect(agentConsoleModalSource).toContain('error?.error_code === \'PLAN_QUOTA_EXCEEDED\'');
      expect(agentConsoleModalSource).toContain('showPlanUpgradeModal.value = true');
    });

    it('mounts <PlanUpgradeModal> with props and event listeners in template', () => {
      expect(agentConsoleModalSource).toContain('<PlanUpgradeModal');
      expect(agentConsoleModalSource).toContain(':show="showPlanUpgradeModal"');
      expect(agentConsoleModalSource).toContain(':current-plan="upgradeModalPlan"');
      expect(agentConsoleModalSource).toContain(':current-limit="upgradeModalLimit"');
      expect(agentConsoleModalSource).toContain(':active-count="upgradeModalActiveCount"');
      expect(agentConsoleModalSource).toContain(':reason-message="upgradeModalReason"');
      expect(agentConsoleModalSource).toContain('@close="showPlanUpgradeModal = false"');
      expect(agentConsoleModalSource).toContain('@upgrade="showPlanUpgradeModal = false"');
    });

    it('binds "Upgrade Plan" button in the Plan & Subscription section to openPlanUpgradeModal', () => {
      expect(agentConsoleModalSource).toContain('@click="openPlanUpgradeModal()"');
      expect(agentConsoleModalSource).toContain('Upgrade Plan');
    });
  });

  describe('3. PlanUpgradeModal.vue Component Verification', () => {
    it('declares PlanUpgradeModalProps interface with show, currentPlan, currentLimit, activeCount, workspaceSlug, taskHubUrl, reasonMessage', () => {
      expect(planUpgradeModalSource).toContain('export interface PlanUpgradeModalProps {');
      expect(planUpgradeModalSource).toContain('show: boolean;');
      expect(planUpgradeModalSource).toContain('currentPlan?: string;');
      expect(planUpgradeModalSource).toContain('currentLimit?: number;');
      expect(planUpgradeModalSource).toContain('activeCount?: number;');
      expect(planUpgradeModalSource).toContain('workspaceSlug?: string;');
      expect(planUpgradeModalSource).toContain('taskHubUrl?: string;');
      expect(planUpgradeModalSource).toContain('reasonMessage?: string;');
    });

    it('handles billing URL construction with URL encoding for complex slugs', () => {
      const getBillingUrl = (slug?: string, url?: string) => {
        const base = (url || 'https://task-hub.macatung.dev').replace(/\/$/, '');
        if (slug && slug.trim()) {
          return `${base}/workspaces/${encodeURIComponent(slug.trim())}/billing`;
        }
        return `${base}/pricing`;
      };

      expect(getBillingUrl('team/production')).toBe(
        'https://task-hub.macatung.dev/workspaces/team%2Fproduction/billing'
      );
      expect(getBillingUrl('my workspace', 'http://127.0.0.1:8000/')).toBe(
        'http://127.0.0.1:8000/workspaces/my%20workspace/billing'
      );
      expect(getBillingUrl('')).toBe('https://task-hub.macatung.dev/pricing');
      expect(getBillingUrl('   ')).toBe('https://task-hub.macatung.dev/pricing');
    });

    it('emits close and upgrade events properly', () => {
      expect(planUpgradeModalSource).toContain('(e: \'close\'): void');
      expect(planUpgradeModalSource).toContain('(e: \'upgrade\', url: string): void');
    });

    it('safely handles desktopApi.openExternal and falls back to window.open', () => {
      expect(planUpgradeModalSource).toContain('(window as any).desktopApi?.openExternal');
      expect(planUpgradeModalSource).toContain('window.open(targetUrl, \'_blank\')');
    });
  });

  describe('4. TaskDispatchModal Integration', () => {
    it('imports and mounts PlanUpgradeModal in TaskDispatchModal.vue', () => {
      expect(taskDispatchModalSource).toMatch(/import\s+PlanUpgradeModal\s+from\s+['"]\.\/PlanUpgradeModal\.vue['"]/);
      expect(taskDispatchModalSource).toContain('const showPlanUpgradeModal = ref(false)');
      expect(taskDispatchModalSource).toContain('<PlanUpgradeModal');
      expect(taskDispatchModalSource).toContain(':show="showPlanUpgradeModal"');
      expect(taskDispatchModalSource).toContain('@close="showPlanUpgradeModal = false"');
    });
  });
});
