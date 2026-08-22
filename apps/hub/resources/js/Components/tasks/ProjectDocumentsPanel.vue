<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { ExternalLink, FileText, FolderSync, LoaderCircle, Search, XCircle } from 'lucide-vue-next';

type DocumentStatus = 'all' | 'active' | 'stale' | 'draft' | 'archived';
type ProjectDocument = { id: number; type: string; title: string; url?: string | null; repository_path?: string | null; version?: string | null; status?: string | null; is_stale?: boolean; owner?: string | null; tags?: string[] | null };
type ProjectDocumentSummary = { total: number; active: number; stale: number; missing_core?: string[] };

const props = defineProps<{ projectId: number | null; repository?: string | null; branch?: string | null; dark?: boolean }>();
const loading = ref(false); const syncing = ref(false); const documents = ref<ProjectDocument[]>([]); const summary = ref<ProjectDocumentSummary | null>(null); const error = ref(''); const path = ref(''); const query = ref(''); const statusFilter = ref<DocumentStatus>('all');

const load = async () => { documents.value = []; summary.value = null; error.value = ''; if (!props.projectId) return; loading.value = true; try { const response = await axios.get(`/api/projects/${props.projectId}/documents`); documents.value = response.data.data.documents || []; summary.value = response.data.data.summary || null; } catch (exception: any) { error.value = exception.response?.data?.message || 'Unable to load project documents.'; } finally { loading.value = false; } };
const sync = async () => { if (!props.projectId) return; error.value = ''; syncing.value = true; try { await axios.post(`/api/projects/${props.projectId}/documents/import-manifest`, { path: path.value || 'docs/PROJECT_DOCUMENTS.md' }); await load(); } catch (exception: any) { error.value = exception.response?.data?.message || 'Unable to sync the GitHub manifest.'; } finally { syncing.value = false; } };
watch(() => props.projectId, load); onMounted(load);

const documentUrl = (document: ProjectDocument) => document.url || (document.repository_path && props.repository ? `https://github.com/${props.repository}/blob/${props.branch || 'main'}/${document.repository_path}` : null);
const displayStatus = (document: ProjectDocument): Exclude<DocumentStatus, 'all'> => document.status === 'draft' || document.status === 'archived' ? document.status : document.is_stale ? 'stale' : 'active';
const displayType = (type: string) => type.replaceAll('_', ' ');
const filteredDocuments = computed(() => { const normalizedQuery = query.value.trim().toLowerCase(); return documents.value.filter((document) => { const haystack = [document.title, document.type, document.repository_path].filter(Boolean).join(' ').toLowerCase(); return (!normalizedQuery || haystack.includes(normalizedQuery)) && (statusFilter.value === 'all' || displayStatus(document) === statusFilter.value); }).sort((left, right) => Number(displayStatus(right) === 'stale') - Number(displayStatus(left) === 'stale') || `${left.type} ${left.title}`.localeCompare(`${right.type} ${right.title}`)); });
</script>

<template>
  <section v-if="projectId" :class="['border', dark ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900']">
    <header :class="['flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between', dark ? 'border-zinc-800' : 'border-zinc-200']">
      <div class="flex items-center gap-3"><FileText class="h-4 w-4 text-zinc-400" aria-hidden="true" /><div><h2 class="text-sm font-semibold">Project documents</h2><p class="mt-0.5 text-xs text-zinc-500">Shared context for people and agents.</p></div></div>
      <dl class="flex divide-x divide-zinc-700 text-xs text-zinc-400"><div class="pr-3"><dt class="sr-only">Total documents</dt><dd><strong class="text-zinc-100">{{ summary?.total ?? '—' }}</strong> total</dd></div><div class="px-3"><dt class="sr-only">Active documents</dt><dd><strong class="text-zinc-100">{{ summary?.active ?? '—' }}</strong> ready</dd></div><div class="pl-3"><dt class="sr-only">Documents needing review</dt><dd><strong class="text-zinc-100">{{ summary?.stale ?? '—' }}</strong> review</dd></div></dl>
    </header>

    <div class="space-y-3 p-4">
      <div v-if="summary?.missing_core?.length" :class="['border-l-2 px-3 py-2 text-xs leading-5', dark ? 'border-zinc-500 bg-zinc-900 text-zinc-300' : 'border-zinc-400 bg-zinc-50 text-zinc-700']"><span class="font-semibold">Missing core documents.</span> {{ summary.missing_core.join(', ') }}</div>

      <div :class="['flex flex-col gap-2 border p-3 sm:flex-row sm:items-center', dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50']"><div class="flex min-w-0 flex-1 items-center gap-2"><FolderSync class="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" /><label class="sr-only" for="manifest-path">Document manifest path</label><input id="manifest-path" v-model="path" class="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-500" placeholder="docs/PROJECT_DOCUMENTS.md" /></div><button class="inline-flex items-center justify-center gap-1.5 border border-zinc-600 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50" :disabled="syncing || loading" @click="sync"><LoaderCircle v-if="syncing" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" /><FolderSync v-else class="h-3.5 w-3.5" aria-hidden="true" />{{ syncing ? 'Syncing' : 'Sync from GitHub' }}</button></div>

      <p v-if="error" class="flex items-center justify-between gap-3 border border-zinc-700 px-3 py-2 text-xs text-zinc-300"><span class="flex items-center gap-2"><XCircle class="h-4 w-4 shrink-0" aria-hidden="true" />{{ error }}</span><button class="font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-zinc-400" @click="load">Try again</button></p>

      <div class="flex flex-col gap-2 sm:flex-row"><label class="relative flex-1"><Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><span class="sr-only">Search documents</span><input v-model="query" class="w-full border border-zinc-700 bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-zinc-500 focus:border-zinc-400" placeholder="Search documents" /></label><select v-model="statusFilter" aria-label="Filter documents by status" class="border border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400"><option value="all">All statuses</option><option value="active">Active</option><option value="stale">Stale</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>

      <div class="max-h-[42vh] overflow-y-auto border border-zinc-800" aria-live="polite">
        <div v-if="loading" v-for="index in 3" :key="index" class="animate-pulse border-b border-zinc-800 px-3 py-4 last:border-0"><div class="h-3 w-1/3 bg-zinc-800"></div><div class="mt-2 h-2 w-1/2 bg-zinc-900"></div></div>
        <template v-else-if="filteredDocuments.length"><article v-for="document in filteredDocuments" :key="document.id" class="group flex flex-col gap-3 border-b border-zinc-800 px-3 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="truncate text-sm font-medium">{{ document.title }}</h3><span class="border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">{{ displayStatus(document) }}</span></div><p class="mt-1 truncate font-mono text-[11px] text-zinc-500">{{ document.repository_path || 'No repository path' }}</p><p class="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500"><span>{{ displayType(document.type) }}</span><span v-if="document.version">v{{ document.version }}</span><span v-if="document.owner">{{ document.owner }}</span><span v-if="document.tags?.length">{{ document.tags.join(' · ') }}</span></p></div><a v-if="documentUrl(document)" :href="documentUrl(document) || undefined" target="_blank" rel="noreferrer" class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-400"><span>Open</span><ExternalLink class="h-3.5 w-3.5" aria-hidden="true" /></a><span v-else class="shrink-0 text-xs text-zinc-500" title="This document has no external URL or connected repository">No link</span></article></template>
        <div v-else class="px-4 py-10 text-center"><h3 class="text-sm font-medium">{{ documents.length ? 'No matching documents' : 'No document registry yet' }}</h3><p class="mt-1 text-xs text-zinc-500">{{ documents.length ? 'Try another search term or filter.' : 'Create docs/PROJECT_DOCUMENTS.md, then sync from GitHub.' }}</p></div>
      </div>
    </div>
  </section>
</template>
