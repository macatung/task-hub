<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';

const props = defineProps<{ projectId: number | null; dark?: boolean }>();
const releases = ref<any[]>([]); const loading = ref(false); const error = ref('');
const form = ref({ version: '', environment: 'production', summary: '', changes: '', commit_sha: '', release_url: '' });
const load = async () => { releases.value = []; if (!props.projectId) return; loading.value = true; try { releases.value = (await axios.get(`/api/projects/${props.projectId}/releases`)).data.data || []; } catch { error.value = 'Unable to load release history.'; } finally { loading.value = false; } };
const create = async () => { if (!props.projectId || !form.value.version || !form.value.summary) return; loading.value = true; error.value = ''; try { await axios.post(`/api/projects/${props.projectId}/releases`, { ...form.value, changes: form.value.changes.split('\n').map(value => value.trim()).filter(Boolean) }); form.value = { version: '', environment: 'production', summary: '', changes: '', commit_sha: '', release_url: '' }; await load(); } catch (exception: any) { error.value = exception.response?.data?.message || 'Unable to save the release.'; } finally { loading.value = false; } };
watch(() => props.projectId, load); onMounted(load);
</script>

<template>
  <section v-if="projectId" :class="['rounded-2xl border p-4 shadow-xs', dark ? 'border-midnight-800/80 bg-midnight-900/90 text-slate-100' : 'border-slate-200 bg-white text-slate-900']">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg border border-midnight-800 bg-midnight-850 inline-flex items-center justify-center shrink-0 text-amber-400">
          <Icons name="Rocket" :size="14" />
        </div>
        <div>
          <h2 class="text-xs font-bold font-display">Release Log</h2>
          <p class="mt-0.5 text-[10px] text-slate-400 font-mono">Track each deployment.</p>
        </div>
      </div>
      <span class="text-[10px] font-mono text-slate-400">{{ releases.length }} releases</span>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 font-mono">
      <input v-model="form.version" class="rounded-xl border border-midnight-800 bg-midnight-950 px-2.5 py-1 text-xs outline-none focus:border-phantom-mint/60" placeholder="v1.2.0" />
      <select v-model="form.environment" class="rounded-xl border border-midnight-800 bg-midnight-950 px-2.5 py-1 text-xs outline-none focus:border-phantom-mint/60">
        <option>production</option>
        <option>staging</option>
        <option>development</option>
      </select>
    </div>

    <input v-model="form.summary" class="mt-2 w-full rounded-xl border border-midnight-800 bg-midnight-950 px-2.5 py-1 text-xs font-mono outline-none focus:border-phantom-mint/60" placeholder="Release summary" />
    <textarea v-model="form.changes" class="mt-2 w-full rounded-xl border border-midnight-800 bg-midnight-950 px-2.5 py-1 text-xs font-mono outline-none focus:border-phantom-mint/60" rows="2" placeholder="One change per line" />

    <div class="mt-2 flex gap-2 font-mono">
      <input v-model="form.commit_sha" class="min-w-0 flex-1 rounded-xl border border-midnight-800 bg-midnight-950 px-2.5 py-1 text-xs outline-none focus:border-phantom-mint/60" placeholder="Commit SHA (optional)" />
      <button class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-phantom-mint hover:bg-emerald-400 px-3.5 py-1 text-xs font-bold text-midnight-950 transition disabled:opacity-50 shrink-0" :disabled="loading" @click="create">
        <span class="leading-none">Save release</span>
      </button>
    </div>

    <p v-if="error" class="mt-2 text-[10px] text-rose-400 font-mono">{{ error }}</p>

    <div class="mt-3 max-h-36 space-y-2 overflow-auto font-mono">
      <article v-for="release in releases" :key="release.id" class="rounded-xl border border-midnight-800 bg-midnight-950 p-2.5 text-[10px]">
        <div class="flex justify-between">
          <b class="text-slate-100">{{ release.version }}</b>
          <span class="text-slate-400">{{ release.environment }} · {{ release.status }}</span>
        </div>
        <p class="mt-1 text-slate-300">{{ release.summary }}</p>
        <p v-for="change in release.changes" :key="change" class="mt-1 text-slate-500">• {{ change }}</p>
      </article>
      <p v-if="!loading && !releases.length" class="text-[10px] text-slate-500 italic">No releases recorded yet.</p>
    </div>
  </section>
</template>
