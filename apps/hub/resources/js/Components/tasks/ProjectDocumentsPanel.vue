<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';

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
  <section v-if="projectId" :class="['rounded-2xl border overflow-hidden shadow-xs', dark ? 'border-midnight-800/80 bg-midnight-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900']">
    <header :class="['flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between', dark ? 'border-midnight-800/80 bg-midnight-900/60' : 'border-slate-200 bg-slate-50']">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl border border-midnight-800 bg-midnight-850 inline-flex items-center justify-center shrink-0 text-emerald-400">
          <Icons name="FileText" :size="16" />
        </div>
        <div>
          <h2 class="text-sm font-bold font-display">Project documents</h2>
          <p class="mt-0.5 text-xs text-slate-400 font-mono">Shared context for developers and agents.</p>
        </div>
      </div>
      <dl class="flex divide-x divide-midnight-800 text-xs text-slate-400 font-mono">
        <div class="pr-3"><dt class="sr-only">Total documents</dt><dd><strong class="text-slate-100">{{ summary?.total ?? '—' }}</strong> total</dd></div>
        <div class="px-3"><dt class="sr-only">Active documents</dt><dd><strong class="text-emerald-400 dark:text-phantom-mint">{{ summary?.active ?? '—' }}</strong> ready</dd></div>
        <div class="pl-3"><dt class="sr-only">Documents needing review</dt><dd><strong class="text-amber-400">{{ summary?.stale ?? '—' }}</strong> review</dd></div>
      </dl>
    </header>

    <div class="space-y-3 p-4">
      <div v-if="summary?.missing_core?.length" :class="['border-l-2 px-3 py-2 text-xs leading-5 rounded-r-xl font-mono', dark ? 'border-amber-500 bg-amber-950/20 text-amber-200' : 'border-amber-400 bg-amber-50 text-amber-900']"><span class="font-bold">Missing core documents.</span> {{ summary.missing_core.join(', ') }}</div>

      <div :class="['flex flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center', dark ? 'border-midnight-800 bg-midnight-900/60' : 'border-slate-200 bg-slate-50']">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <Icons name="FolderSync" :size="16" class="shrink-0 text-slate-400" />
          <label class="sr-only" for="manifest-path">Document manifest path</label>
          <input id="manifest-path" v-model="path" class="min-w-0 flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-slate-500" placeholder="docs/PROJECT_DOCUMENTS.md" />
        </div>
        <button class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-phantom-mint bg-phantom-mint px-3 py-1.5 text-xs font-bold text-midnight-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 shrink-0" :disabled="syncing || loading" @click="sync">
          <Icons v-if="syncing" name="LoaderCircle" :size="14" class="animate-spin text-midnight-950" />
          <Icons v-else name="FolderSync" :size="14" class="text-midnight-950" />
          <span class="leading-none">{{ syncing ? 'Syncing' : 'Sync from GitHub' }}</span>
        </button>
      </div>

      <p v-if="error" class="flex items-center justify-between gap-3 rounded-xl border border-rose-700/80 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
        <span class="flex items-center gap-2"><Icons name="AlertCircle" :size="14" class="shrink-0 text-rose-400" />{{ error }}</span>
        <button class="font-bold underline underline-offset-2 hover:text-white" @click="load">Try again</button>
      </p>

      <div class="flex flex-col gap-2 sm:flex-row">
        <label class="relative flex-1">
          <Icons name="Search" :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <span class="sr-only">Search documents</span>
          <input v-model="query" class="w-full rounded-xl border border-midnight-800 bg-midnight-900/60 py-1.5 pl-8 pr-3 text-xs font-mono outline-none placeholder:text-slate-500 focus:border-phantom-mint/60" placeholder="Search documents" />
        </label>
        <select v-model="statusFilter" aria-label="Filter documents by status" class="rounded-xl border border-midnight-800 bg-midnight-900/60 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-phantom-mint/60">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="stale">Stale</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div class="max-h-[42vh] overflow-y-auto rounded-xl border border-midnight-800/80" aria-live="polite">
        <div v-if="loading" v-for="index in 3" :key="index" class="animate-pulse border-b border-midnight-800/80 px-3 py-4 last:border-0"><div class="h-3 w-1/3 rounded bg-midnight-800"></div><div class="mt-2 h-2 w-1/2 rounded bg-midnight-900"></div></div>
        <template v-else-if="filteredDocuments.length">
          <article v-for="document in filteredDocuments" :key="document.id" class="group flex flex-col gap-3 border-b border-midnight-800/80 px-3 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-midnight-900/40">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-sm font-bold">{{ document.title }}</h3>
                <span class="rounded border border-midnight-700 bg-midnight-900 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">{{ displayStatus(document) }}</span>
              </div>
              <p class="mt-1 truncate font-mono text-[11px] text-slate-500">{{ document.repository_path || 'No repository path' }}</p>
              <p class="mt-1.5 flex flex-wrap gap-x-3 text-[11px] font-mono text-slate-500">
                <span>{{ displayType(document.type) }}</span>
                <span v-if="document.version">v{{ document.version }}</span>
                <span v-if="document.owner">{{ document.owner }}</span>
                <span v-if="document.tags?.length">{{ document.tags.join(' · ') }}</span>
              </p>
            </div>
            <a v-if="documentUrl(document)" :href="documentUrl(document) || undefined" target="_blank" rel="noreferrer" class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-midnight-700 bg-midnight-850 px-2.5 py-1 text-xs font-bold text-slate-200 transition hover:border-phantom-mint hover:text-white">
              <span class="leading-none">Open</span>
              <Icons name="ExternalLink" :size="12" />
            </a>
            <span v-else class="shrink-0 text-xs text-slate-500" title="This document has no external URL or connected repository">No link</span>
          </article>
        </template>
        <div v-else class="px-4 py-10 text-center">
          <h3 class="text-sm font-bold">{{ documents.length ? 'No matching documents' : 'No document registry yet' }}</h3>
          <p class="mt-1 text-xs text-slate-500">{{ documents.length ? 'Try another search term or filter.' : 'Create docs/PROJECT_DOCUMENTS.md, then sync from GitHub.' }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
