<script setup lang="ts">
import { Head, useForm, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface ExperienceItem {
  id: number;
  role: string;
  company: string;
  period: string;
  type: string;
  location: string;
  summary: string;
  achievements?: string[];
  technologies?: string[];
  order: number;
}

defineProps<{
  experiences: ExperienceItem[];
}>();

const isModalOpen = ref(false);
const editingExp = ref<ExperienceItem | null>(null);

const form = useForm({
  role: '',
  company: '',
  period: '',
  type: 'Full-Time',
  location: 'Remote / HCMC',
  summary: '',
  achievements_input: '',
  technologies_input: '',
  order: 0,
});

const openCreateModal = () => {
  editingExp.value = null;
  form.reset();
  form.clearErrors();
  isModalOpen.value = true;
};

const openEditModal = (exp: ExperienceItem) => {
  editingExp.value = exp;
  form.role = exp.role;
  form.company = exp.company;
  form.period = exp.period;
  form.type = exp.type;
  form.location = exp.location;
  form.summary = exp.summary;
  form.achievements_input = (exp.achievements || []).join('\n');
  form.technologies_input = (exp.technologies || []).join(', ');
  form.order = exp.order || 0;
  form.clearErrors();
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  editingExp.value = null;
};

const submitExperience = () => {
  const achievements = form.achievements_input
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  const technologies = form.technologies_input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const payload = {
    role: form.role,
    company: form.company,
    period: form.period,
    type: form.type,
    location: form.location,
    summary: form.summary,
    achievements,
    technologies,
    order: Number(form.order) || 0,
  };

  if (editingExp.value) {
    router.put(`/admin/experiences/${editingExp.value.id}`, payload, {
      onSuccess: () => closeModal(),
    });
  } else {
    router.post('/admin/experiences', payload, {
      onSuccess: () => closeModal(),
    });
  }
};

const deleteExperience = (exp: ExperienceItem) => {
  if (confirm(`Are you sure you want to delete the milestone "${exp.role} at ${exp.company}"?`)) {
    router.delete(`/admin/experiences/${exp.id}`, {
      preserveScroll: true,
    });
  }
};
</script>

<template>
  <AdminLayout title="Career Chronicles Management">
    <Head title="Career Chronicles — Admin CMS" />

    <!-- Header & Create Action -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Career Chronicles & Milestones CMS
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Manage engineering milestones, companies, tenures, and core technical achievements.
        </p>
      </div>

      <button
        type="button"
        class="px-4 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 transition-all shadow-glow-mint flex items-center gap-1.5"
        @click="openCreateModal"
      >
        <span>+ Add New Milestone</span>
      </button>
    </div>

    <!-- Experiences List -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left space-y-4">
      <div
        v-for="exp in experiences"
        :key="exp.id"
        class="p-5 rounded-2xl bg-midnight-900/70 border border-white/5 hover:border-white/20 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div class="space-y-2 flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full bg-phantom-mint/10 text-phantom-mint font-mono text-xs font-bold border border-phantom-mint/30">
              {{ exp.period }}
            </span>
            <span class="text-white font-bold text-base">{{ exp.role }}</span>
            <span class="text-xs font-mono text-phantom-cyan">@ {{ exp.company }}</span>
            <span class="px-2 py-0.5 rounded bg-white/5 text-[11px] font-mono text-slate-400">
              {{ exp.type }}
            </span>
          </div>

          <p class="text-xs text-slate-300 font-sans leading-relaxed">{{ exp.summary }}</p>

          <div class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="t in exp.technologies || []"
              :key="t"
              class="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-400 border border-white/5"
            >
              {{ t }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all"
            @click="openEditModal(exp)"
          >
            Edit
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-mono transition-all border border-rose-500/20"
            @click="deleteExperience(exp)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal Dialog -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="w-full max-w-2xl bg-midnight-900 border border-white/10 rounded-3xl p-6 sm:p-8 text-left shadow-2xl space-y-5">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 class="text-xl font-display font-bold text-white">
            {{ editingExp ? 'Edit Milestone' : 'Add New Career Milestone' }}
          </h2>
          <button type="button" class="p-1 rounded-lg text-slate-400 hover:text-white" @click="closeModal">
            <Icons name="X" :size="20" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitExperience">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Role / Title *</label>
              <input
                v-model="form.role"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="e.g. Lead Systems Architect"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Company / Project *</label>
              <input
                v-model="form.company"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="e.g. Midnight Engineering Lab"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Period *</label>
              <input
                v-model="form.period"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
                placeholder="2024 — Present"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Employment Type</label>
              <input
                v-model="form.type"
                type="text"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="Full-Time / Lead"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Location</label>
              <input
                v-model="form.location"
                type="text"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="Remote / Worldwide"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Role Summary *</label>
            <textarea
              v-model="form.summary"
              rows="2"
              required
              class="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              placeholder="Summary of core responsibilities..."
            />
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Key Achievements (One per line)</label>
            <textarea
              v-model="form.achievements_input"
              rows="3"
              class="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono text-xs"
              placeholder="Architected high-throughput transaction engine handling 10,000+ RPS&#10;Optimized 100/100 Core Web Vitals"
            />
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Technologies Used (Comma-separated)</label>
            <input
              v-model="form.technologies_input"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
              placeholder="Laravel 11, Vue 3, Redis, Docker"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 shadow-glow-mint">
              {{ editingExp ? 'Save Changes' : 'Create Milestone' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminLayout>
</template>
