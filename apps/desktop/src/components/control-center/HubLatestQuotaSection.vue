<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { fetchLatestWorkspaceQuota, type LatestQuotaViewModel } from '../../services/latestQuotaViewModel';

const props = defineProps<{ baseUrl: string; token: string; workspaceId: string | number }>();
const quota = ref<LatestQuotaViewModel | null>(null);
const device = ref('');
const provider = ref('');
const loading = ref(false);
const error = ref('');

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    quota.value = await fetchLatestWorkspaceQuota({
      baseUrl: props.baseUrl,
      token: props.token,
      workspaceId: props.workspaceId,
      device: device.value || undefined,
      provider: provider.value || undefined,
    });
  } catch (cause: any) {
    error.value = cause?.message || 'Could not load latest quota.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
watch(() => props.workspaceId, () => {
  device.value = '';
  provider.value = '';
  void load();
});
</script>

<template>
  <section class="border-b border-[#141b2d] bg-[#080d18] px-4 py-3" aria-labelledby="latest-quota-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="latest-quota-title" class="text-xs font-semibold text-zinc-100">Latest synchronized quota</h2>
        <p class="mt-0.5 text-[10px] text-zinc-500">
          {{ quota?.aggregation.description || 'Quota is scoped to your authorized workspace.' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="device" class="cc-select py-1 text-[11px]" aria-label="Filter quota by device" @change="load">
          <option value="">All devices</option>
          <option v-for="item in quota?.devices || []" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <select v-model="provider" class="cc-select py-1 text-[11px]" aria-label="Filter quota by provider" @change="load">
          <option value="">All providers</option>
          <option v-for="item in quota?.providers || []" :key="item" :value="item">{{ item }}</option>
        </select>
        <button class="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300" :disabled="loading" @click="load">
          {{ loading ? 'Syncing…' : 'Refresh' }}
        </button>
      </div>
    </div>
    <p v-if="error" role="alert" class="mt-2 text-[11px] text-rose-300">{{ error }}</p>
    <div v-else-if="quota" class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-zinc-400">
      <strong class="text-emerald-300">{{ quota.summary.remainingPercent ?? '—' }}% remaining</strong>
      <span>{{ quota.summary.usedTokens.toLocaleString() }} / {{ quota.summary.tokenLimit.toLocaleString() }} tokens</span>
      <span>{{ quota.records.length }} device/provider records</span>
      <span>{{ quota.aggregation.label }}</span>
      <time v-if="quota.syncedAt" :datetime="quota.syncedAt">Synced {{ new Date(quota.syncedAt).toLocaleString() }}</time>
    </div>
  </section>
</template>
