import { ref, computed } from 'vue';

export interface QuotaErrorPayload {
  resource?: string;
  quota_type?: string;
  current_usage?: number;
  active?: number;
  limit?: number | null;
  current_plan?: string;
  plan?: string;
  suggested_plan?: string;
  upgrade_url?: string;
  message?: string;
  error_code?: string;
}

export interface UpgradeModalState {
  currentPlan: string;
  currentLimit: number;
  activeCount: number;
  workspaceSlug: string;
  taskHubUrl: string;
  reasonMessage: string;
}

const isOpen = ref(false);
const modalState = ref<UpgradeModalState>({
  currentPlan: 'community',
  currentLimit: 1,
  activeCount: 1,
  workspaceSlug: '',
  taskHubUrl: '',
  reasonMessage: '',
});

export function useUpgradeModal() {
  const openUpgradeModal = (params?: Partial<UpgradeModalState>) => {
    modalState.value = {
      currentPlan: params?.currentPlan || modalState.value.currentPlan || 'community',
      currentLimit: params?.currentLimit ?? modalState.value.currentLimit ?? 1,
      activeCount: params?.activeCount ?? modalState.value.activeCount ?? 1,
      workspaceSlug: params?.workspaceSlug ?? modalState.value.workspaceSlug ?? '',
      taskHubUrl: params?.taskHubUrl ?? modalState.value.taskHubUrl ?? '',
      reasonMessage: params?.reasonMessage ?? modalState.value.reasonMessage ?? '',
    };
    isOpen.value = true;
  };

  const closeUpgradeModal = () => {
    isOpen.value = false;
  };

  const handleQuotaError = (
    error: any,
    context?: { workspaceSlug?: string; taskHubUrl?: string }
  ): boolean => {
    if (!error) return false;

    const data: QuotaErrorPayload = error?.response?.data || error?.data || error;
    const errorStr = (error?.message || data?.message || data?.error_code || '').toString();

    const isQuotaExceeded =
      data?.error_code === 'PLAN_QUOTA_EXCEEDED' ||
      errorStr.includes('PLAN_QUOTA_EXCEEDED') ||
      errorStr.toLowerCase().includes('concurrent runner') ||
      errorStr.toLowerCase().includes('runner limit');

    if (isQuotaExceeded) {
      const plan = data?.plan || data?.current_plan || 'community';
      const limit = data?.limit !== undefined && data?.limit !== null ? Number(data.limit) : 1;
      const active =
        data?.active !== undefined && data?.active !== null
          ? Number(data.active)
          : data?.current_usage !== undefined && data?.current_usage !== null
            ? Number(data.current_usage)
            : 1;
      const message = data?.message || error?.message || 'Concurrent runner limit reached for your current plan.';

      openUpgradeModal({
        currentPlan: plan,
        currentLimit: limit,
        activeCount: active,
        workspaceSlug: context?.workspaceSlug || modalState.value.workspaceSlug,
        taskHubUrl: context?.taskHubUrl || modalState.value.taskHubUrl,
        reasonMessage: message,
      });
      return true;
    }

    return false;
  };

  return {
    isOpen: computed(() => isOpen.value),
    modalState: computed(() => modalState.value),
    openUpgradeModal,
    closeUpgradeModal,
    handleQuotaError,
  };
}
