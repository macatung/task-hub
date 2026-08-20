<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import axios from 'axios';
const props = defineProps<{ projectId: number | null; dark?: boolean }>();
const releases = ref<any[]>([]); const loading = ref(false); const error = ref('');
const form = ref({ version: '', environment: 'production', summary: '', changes: '', commit_sha: '', release_url: '' });
const load = async () => { releases.value = []; if (!props.projectId) return; loading.value = true; try { releases.value = (await axios.get(`/api/projects/${props.projectId}/releases`)).data.data || []; } catch { error.value = 'Không thể tải release log.'; } finally { loading.value = false; } };
const create = async () => { if (!props.projectId || !form.value.version || !form.value.summary) return; loading.value = true; error.value = ''; try { await axios.post(`/api/projects/${props.projectId}/releases`, { ...form.value, changes: form.value.changes.split('\n').map(value => value.trim()).filter(Boolean) }); form.value = { version: '', environment: 'production', summary: '', changes: '', commit_sha: '', release_url: '' }; await load(); } catch (exception: any) { error.value = exception.response?.data?.message || 'Không thể lưu release.'; } finally { loading.value = false; } };
watch(() => props.projectId, load); onMounted(load);
</script>
<template>
  <section v-if="projectId" :class="['rounded-2xl border p-3', dark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white']">
    <div class="flex items-center justify-between"><div><h2 class="text-xs font-bold">🚀 Release log</h2><p class="mt-0.5 text-[10px] text-slate-500">Lưu lại mỗi lần deploy bản mới.</p></div><span class="text-[10px] text-slate-500">{{ releases.length }} releases</span></div>
    <div class="mt-2 grid grid-cols-2 gap-2"><input v-model="form.version" class="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" placeholder="v1.2.0" /><select v-model="form.environment" class="rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700"><option>production</option><option>staging</option><option>development</option></select></div>
    <input v-model="form.summary" class="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" placeholder="Tóm tắt release" />
    <textarea v-model="form.changes" class="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" rows="2" placeholder="Mỗi thay đổi một dòng" />
    <div class="mt-2 flex gap-2"><input v-model="form.commit_sha" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" placeholder="Commit SHA (optional)" /><button class="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white disabled:opacity-50" :disabled="loading" @click="create">Lưu release</button></div>
    <p v-if="error" class="mt-2 text-[10px] text-rose-600">{{ error }}</p>
    <div class="mt-3 max-h-32 space-y-2 overflow-auto"><article v-for="release in releases" :key="release.id" class="rounded-lg bg-slate-100 p-2 text-[10px] dark:bg-slate-900"><div class="flex justify-between"><b>{{ release.version }}</b><span>{{ release.environment }} · {{ release.status }}</span></div><p class="mt-1">{{ release.summary }}</p><p v-for="change in release.changes" :key="change" class="mt-1 text-slate-500">• {{ change }}</p></article><p v-if="!loading && !releases.length" class="text-[10px] text-slate-500">Chưa có bản deploy được ghi nhận.</p></div>
  </section>
</template>
