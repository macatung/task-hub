<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import axios from 'axios';
const props = defineProps<{ projectId: number | null; repository?: string | null; branch?: string | null; dark?: boolean }>();
const loading = ref(false); const documents = ref<any[]>([]); const summary = ref<any>(null); const error = ref(''); const path = ref('');
const load = async () => { documents.value = []; summary.value = null; error.value = ''; if (!props.projectId) return; loading.value = true; try { const response = await axios.get(`/api/projects/${props.projectId}/documents`); documents.value = response.data.data.documents || []; summary.value = response.data.data.summary; } catch (exception: any) { error.value = exception.response?.data?.message || 'Không thể tải Project Documents.'; } finally { loading.value = false; } };
const sync = async () => { if (!props.projectId) return; loading.value = true; try { await axios.post(`/api/projects/${props.projectId}/documents/import-manifest`, { path: path.value || 'docs/PROJECT_DOCUMENTS.md' }); await load(); } catch (exception: any) { error.value = exception.response?.data?.message || 'Không thể đồng bộ manifest từ GitHub.'; } finally { loading.value = false; } };
watch(() => props.projectId, load); onMounted(load);
const documentUrl = (document: any) => document.url || (document.repository_path && props.repository ? `https://github.com/${props.repository}/blob/${props.branch || 'main'}/${document.repository_path}` : '#');
</script>
<template>
  <section v-if="projectId" :class="['rounded-2xl border p-3', dark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white']">
    <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xs font-bold">📚 Project Documents</h2><p class="mt-0.5 text-[10px] text-slate-500">Nguồn tham chiếu dùng chung cho PM, dev và agent.</p></div><span v-if="summary" class="rounded-full px-2 py-1 text-[10px]" :class="summary.stale ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'">{{ summary.active }}/{{ summary.total }} active · {{ summary.stale }} stale</span></div>
    <div v-if="summary?.missing_core?.length" class="mt-2 text-[10px] text-amber-700 dark:text-amber-300">Thiếu core docs: {{ summary.missing_core.join(', ') }}</div>
    <div class="mt-2 flex gap-2"><input v-model="path" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" placeholder="docs/PROJECT_DOCUMENTS.md" /><button class="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50" :disabled="loading" @click="sync">Sync GitHub</button></div>
    <p v-if="error" class="mt-2 text-[10px] text-rose-600">{{ error }}</p>
    <div class="mt-3 max-h-28 space-y-1 overflow-auto"><a v-for="document in documents" :key="document.id" :href="documentUrl(document)" target="_blank" rel="noreferrer" class="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-900"><span class="truncate"><b>{{ document.type }}</b> · {{ document.title }}</span><span :class="document.is_stale ? 'text-amber-500' : 'text-emerald-500'">{{ document.is_stale ? 'stale' : document.version || 'active' }}</span></a><p v-if="!loading && !documents.length" class="text-[10px] text-slate-500">Chưa có registry. Tạo `docs/PROJECT_DOCUMENTS.md`, rồi Sync GitHub.</p></div>
  </section>
</template>
