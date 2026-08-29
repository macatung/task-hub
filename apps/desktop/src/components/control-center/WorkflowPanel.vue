<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ProjectItem } from '../../composables/useTaskSync';
import type { Provider } from './RunWorkspace.vue';
const props = defineProps<{ mode: 'requirement' | 'docs' | null; projects: ProjectItem[]; provider: Provider; busy: boolean; requirementPlan: string; docsReady: boolean; message: string; output: string; phase: string; error: string }>();
const emit = defineEmits<{ close: []; runRequirement: [data: { projectId: number; requirement: string }]; reviseRequirement: [data: { projectId: number; requirement: string; feedback: string }]; updateProposal: [proposal: string]; createBacklog: []; runDocs: [projectId: number]; saveDocs: []; syncDocs: [] }>();
const projectId = ref<number | null>(null); const requirement = ref(''); const revisionFeedback = ref(''); const editingProposal = ref(false); const editableProposal = ref('');
watch(() => props.mode, () => { if (!projectId.value && props.projects[0]) projectId.value = props.projects[0].id; });
watch(() => props.requirementPlan, value => { if (!editingProposal.value) editableProposal.value = value; }, { immediate: true });
const canRun = computed(() => Boolean(projectId.value && (props.mode === 'docs' || requirement.value.trim()) && !props.busy));
const liveLines = computed(() => props.output.split(/\r?\n/).filter(Boolean).slice(-10));
const isRequirement = computed(() => props.mode === 'requirement');
const title = computed(() => isRequirement.value ? 'New backlog from requirement' : 'Scan repository documentation');
const subtitle = computed(() => isRequirement.value ? 'Draft work items with AI, then review before anything is created.' : 'Generate a documentation set in an isolated worktree, then review it here.');
</script>
<template>
  <div v-if="mode" class="fixed inset-0 z-[80] flex justify-end bg-black/60 backdrop-blur-xs" @click.self="emit('close')">
    <aside class="flex h-full w-full max-w-[680px] flex-col border-l border-[#141b2d] bg-[#070b14] text-zinc-100 shadow-2xl">
      <!-- Header -->
      <header class="flex items-start justify-between gap-4 border-b border-[#141b2d] px-6 py-5 bg-[#0c1220]">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00f5a0] font-mono">AI workflow</p>
          <h2 class="mt-1 text-lg font-bold text-white font-['Space_Grotesk']">{{ title }}</h2>
          <p class="mt-1 max-w-xl text-xs leading-5 text-zinc-400">{{ subtitle }}</p>
        </div>
        <button class="cc-button text-xs" @click="emit('close')">Close</button>
      </header>

      <!-- Stepper Header -->
      <div class="grid grid-cols-3 gap-2 border-b border-[#141b2d] px-6 py-3.5 bg-[#070b14]">
        <div class="flex items-center gap-2 text-xs">
          <span class="inline-flex items-center justify-center shrink-0 h-6 w-6 rounded-full bg-[#00f5a0] font-bold text-black font-mono">1</span>
          <span><b class="block text-zinc-100 font-['Space_Grotesk']">Brief</b><span class="text-zinc-500 text-[11px]">Scope work</span></span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="inline-flex items-center justify-center shrink-0 h-6 w-6 rounded-full font-mono" :class="busy ? 'bg-[#00f5a0] text-black font-bold' : 'bg-[#11182c] text-zinc-400 border border-[#141b2d]'">2</span>
          <span><b class="block text-zinc-100 font-['Space_Grotesk']">Run</b><span class="text-zinc-500 text-[11px]">Local agent</span></span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="inline-flex items-center justify-center shrink-0 h-6 w-6 rounded-full font-mono" :class="requirementPlan || docsReady ? 'bg-[#00f5d4] text-black font-bold' : 'bg-[#11182c] text-zinc-400 border border-[#141b2d]'">3</span>
          <span><b class="block text-zinc-100 font-['Space_Grotesk']">Review</b><span class="text-zinc-500 text-[11px]">Approve result</span></span>
        </div>
      </div>

      <!-- Main Body -->
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div class="space-y-5">
          <label class="block text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Hub project
            <select v-model="projectId" class="cc-select mt-2 font-sans font-normal">
              <option :value="null" disabled>Select Hub project</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.title }}</option>
            </select>
          </label>

          <label v-if="isRequirement" class="block text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Requirement
            <textarea v-model="requirement" class="cc-input mt-2 min-h-36 resize-y font-sans font-normal" placeholder="Describe the user need, expected outcome, constraints and acceptance criteria."></textarea>
            <span class="mt-2 block text-xs font-normal leading-5 text-zinc-400 normal-case">AI will propose an Epic, Stories and implementation tasks. Nothing is created or synced until you explicitly approve the reviewed draft.</span>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button class="cc-primary" :disabled="!canRun" @click="isRequirement ? emit('runRequirement', { projectId: projectId!, requirement }) : emit('runDocs', projectId!)">
              {{ busy ? 'AI is working…' : isRequirement ? 'Analyze requirement' : 'Scan & generate docs' }}
            </button>
            <span v-if="message" class="text-xs text-zinc-400 font-mono">{{ message }}</span>
          </div>

          <p v-if="error" class="rounded-lg border border-rose-600/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300 font-mono">{{ error }}</p>

          <!-- Live Activity Stream -->
          <section v-if="busy || liveLines.length" class="overflow-hidden rounded-lg border border-[#141b2d] bg-[#04070d]">
            <div class="flex items-center justify-between border-b border-[#141b2d] px-4 py-2 text-xs bg-[#0c1220]">
              <span class="font-semibold text-zinc-200">Live agent activity</span>
              <span class="text-[#00f5a0] font-mono text-[11px]">{{ phase }}</span>
            </div>
            <pre class="max-h-44 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-5 text-zinc-300">{{ liveLines.join('\n') || 'Preparing isolated workspace…' }}</pre>
          </section>

          <!-- Backlog proposal ready -->
          <section v-if="isRequirement && requirementPlan" class="overflow-hidden rounded-xl border border-[#141b2d] bg-[#0c1220]">
            <header class="flex items-center justify-between gap-4 border-b border-[#141b2d] px-4 py-3 bg-[#11182c]">
              <div>
                <p class="text-xs font-bold text-white font-['Space_Grotesk']">Backlog proposal ready</p>
                <p class="mt-0.5 text-[11px] text-zinc-400">Nothing is synced yet. Review, edit or request changes, then explicitly approve creation.</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button class="cc-button text-xs" :disabled="busy" @click="editingProposal = !editingProposal; editableProposal = requirementPlan">
                  {{ editingProposal ? 'Cancel edit' : 'Edit draft' }}
                </button>
                <button class="cc-primary text-xs" :disabled="busy || editingProposal" @click="emit('createBacklog')">
                  Approve & create backlog
                </button>
              </div>
            </header>

            <textarea v-if="editingProposal" v-model="editableProposal" class="cc-input m-4 min-h-80 w-[calc(100%-2rem)] resize-y font-mono text-xs leading-5" aria-label="Edit backlog proposal"></textarea>
            <pre v-else class="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-zinc-300">{{ requirementPlan }}</pre>

            <div v-if="editingProposal" class="flex items-center gap-3 border-t border-[#141b2d] px-4 py-3 bg-[#070b14]">
              <button class="cc-primary text-xs" :disabled="busy || !editableProposal.trim()" @click="emit('updateProposal', editableProposal.trim()); editingProposal = false">
                Save draft
              </button>
              <span class="text-xs text-zinc-500">The draft is validated when you approve it; malformed plans are never synced.</span>
            </div>

            <div class="border-t border-[#141b2d] p-4 bg-[#070b14]">
              <label class="block text-xs font-semibold text-zinc-200">
                Request changes from AI
                <textarea v-model="revisionFeedback" class="cc-input mt-2 min-h-24 resize-y font-sans font-normal" placeholder="Example: split Story 2, add a migration task and make acceptance criteria measurable."></textarea>
              </label>
              <div class="mt-3 flex items-center gap-3">
                <button class="cc-button text-xs" :disabled="busy || !revisionFeedback.trim()" @click="emit('reviseRequirement', { projectId: projectId!, requirement, feedback: revisionFeedback }); revisionFeedback = ''">
                  Request revision
                </button>
                <span class="text-xs text-zinc-500">The revised proposal replaces this draft; it still will not sync until approval.</span>
              </div>
            </div>
          </section>

          <!-- Docs ready -->
          <section v-if="!isRequirement && docsReady" class="rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-4">
            <p class="font-bold text-emerald-300 font-['Space_Grotesk']">Documentation ready for review</p>
            <p class="mt-1 text-xs leading-5 text-emerald-100/80">Save the reviewed documents to the repository or sync them to Task Hub.</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="cc-button text-xs" @click="emit('saveDocs')">Save to repository</button>
              <button class="cc-primary text-xs" @click="emit('syncDocs')">Sync docs to Hub</button>
            </div>
          </section>
        </div>
      </div>

      <footer class="border-t border-[#141b2d] px-6 py-3 text-xs text-zinc-500 font-mono">
        Runs locally in an isolated worktree. No repository changes are applied until you choose an action.
      </footer>
    </aside>
  </div>
</template>
