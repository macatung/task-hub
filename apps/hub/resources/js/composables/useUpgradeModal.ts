import { ref, computed } from 'vue';

export interface QuotaPayload {
  resource: 'runners' | 'seats' | 'projects' | string;
  current_usage: number;
  limit: number | null;
  current_plan: string;
  suggested_plan: string;
  upgrade_url: string;
  message?: string;
}

const isOpen = ref(false);
const quotaData = ref<QuotaPayload | null>(null);

export function useUpgradeModal() {
  const openUpgradeModal = (payload: QuotaPayload) => {
    quotaData.value = {
      resource: payload.resource || 'runners',
      current_usage: payload.current_usage ?? 0,
      limit: payload.limit !== undefined ? payload.limit : null,
      current_plan: payload.current_plan || 'community',
      suggested_plan: payload.suggested_plan || 'pro',
      upgrade_url: payload.upgrade_url || '/workspaces/billing',
      message: payload.message || '',
    };
    isOpen.value = true;
  };

  const closeUpgradeModal = () => {
    isOpen.value = false;
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
    isOpen: computed(() => isOpen.value),
    quotaData: computed(() => quotaData.value),
    openUpgradeModal,
    closeUpgradeModal,
    handleQuotaError,
  };
}
