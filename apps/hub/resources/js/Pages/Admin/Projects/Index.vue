<script setup lang="ts">
import { Head, useForm, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface ProjectItem {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: 'fullstack' | 'creative' | 'ai-web3' | 'tools';
  tags?: string[];
  metrics?: { label: string; value: string }[];
  live_url?: string;
  github_url?: string;
  featured: boolean;
  order: number;
}

const props = defineProps<{
  projects: ProjectItem[];
}>();

const isModalOpen = ref(false);
const editingProject = ref<ProjectItem | null>(null);

const form = useForm({
  title: '',
  slug: '',
  tagline: '',
  description: '',
  category: 'fullstack' as 'fullstack' | 'creative' | 'ai-web3' | 'tools',
  tags_input: '',
  live_url: '',
  github_url: '',
  featured: false,
  order: 0,
});

const openCreateModal = () => {
  editingProject.value = null;
  form.reset();
  form.clearErrors();
  isModalOpen.value = true;
};

const openEditModal = (project: ProjectItem) => {
  editingProject.value = project;
  form.title = project.title;
  form.slug = project.slug;
  form.tagline = project.tagline;
  form.description = project.description;
  form.category = project.category;
  form.tags_input = (project.tags || []).join(', ');
  form.live_url = project.live_url || '';
  form.github_url = project.github_url || '';
  form.featured = project.featured;
  form.order = project.order || 0;
  form.clearErrors();
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  editingProject.value = null;
};

const submitProject = () => {
  const tagsArray = form.tags_input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const payload: any = {
    title: form.title,
    slug: form.slug || undefined,
    tagline: form.tagline,
    description: form.description,
    category: form.category,
    tags: tagsArray,
    live_url: form.live_url || null,
    github_url: form.github_url || null,
    featured: form.featured,
    order: Number(form.order) || 0,
  };

  if (editingProject.value) {
    router.put(`/admin/projects/${editingProject.value.id}`, payload, {
      onSuccess: () => closeModal(),
    });
  } else {
    router.post('/admin/projects', payload, {
      onSuccess: () => closeModal(),
    });
  }
};

const toggleFeatured = (project: ProjectItem) => {
  router.patch(`/admin/projects/${project.id}/toggle-featured`, {}, {
    preserveScroll: true,
  });
};

const deleteProject = (project: ProjectItem) => {
  if (confirm(`Are you sure you want to delete project "${project.title}"?`)) {
    router.delete(`/admin/projects/${project.id}`, {
      preserveScroll: true,
    });
  }
};
</script>

<template>
  <AdminLayout title="Project Management">
    <Head title="Project Management — Admin CMS" />

    <!-- Header & Create Action -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Projects & Grimoire CMS
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Create, edit, feature, and manage production architectures and applications.
        </p>
      </div>

      <button
        type="button"
        class="px-4 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 transition-all shadow-glow-mint flex items-center gap-1.5"
        @click="openCreateModal"
      >
        <span>+ Add New Project</span>
      </button>
    </div>

    <!-- Projects Table Card -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div class="overflow-x-auto no-scrollbar">
        <table class="w-full text-left text-xs font-sans">
          <thead class="bg-midnight-900/60 border-b border-white/5 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th class="p-3">Order</th>
              <th class="p-3">Project Title</th>
              <th class="p-3">Category</th>
              <th class="p-3">Tech Stack</th>
              <th class="p-3 text-center">Featured</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr v-for="p in projects" :key="p.id" class="hover:bg-white/5 transition-colors">
              <td class="p-3 font-mono text-slate-400">#{{ p.order }}</td>
              <td class="p-3">
                <div class="font-bold text-white text-sm">{{ p.title }}</div>
                <div class="text-[11px] text-slate-400 truncate max-w-sm">{{ p.tagline }}</div>
              </td>
              <td class="p-3">
                <span class="px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 font-mono text-[10px] border border-white/5 uppercase">
                  {{ p.category }}
                </span>
              </td>
              <td class="p-3">
                <div class="flex flex-wrap gap-1 max-w-xs">
                  <span
                    v-for="tag in (p.tags || []).slice(0, 3)"
                    :key="tag"
                    class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/5 text-slate-300"
                  >
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td class="p-3 text-center">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition-all border"
                  :class="p.featured
                    ? 'bg-amber-500/20 text-talisman-gold border-talisman-gold/40'
                    : 'bg-white/5 text-slate-500 border-white/5'"
                  @click="toggleFeatured(p)"
                >
                  {{ p.featured ? '★ Featured' : '☆ Hidden' }}
                </button>
              </td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all"
                    @click="openEditModal(p)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-mono transition-all border border-rose-500/20"
                    @click="deleteProject(p)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
            {{ editingProject ? 'Edit Project' : 'Add New Project' }}
          </h2>
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-white"
            @click="closeModal"
          >
            <Icons name="X" :size="20" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitProject">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Project Title *</label>
              <input
                v-model="form.title"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="e.g. FlashPay Checkout"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Slug (Auto-generated if empty)</label>
              <input
                v-model="form.slug"
                type="text"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
                placeholder="e.g. flashpay-checkout"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Concise Tagline *</label>
            <input
              v-model="form.tagline"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              placeholder="e.g. High-throughput automated payment gateway processing 10,000 req/s"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Category *</label>
              <select
                v-model="form.category"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              >
                <option value="fullstack">Full-Stack</option>
                <option value="creative">Creative & Audio</option>
                <option value="ai-web3">AI & Microservices</option>
                <option value="tools">Developer Tools</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Display Order</label>
              <input
                v-model.number="form.order"
                type="number"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Project Description *</label>
            <textarea
              v-model="form.description"
              rows="3"
              required
              class="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              placeholder="Describe the problem statement, architecture highlights, and business impact..."
            />
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Technology Tags (Comma-separated)</label>
            <input
              v-model="form.tags_input"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
              placeholder="Laravel 11, Vue 3, Redis, TailwindCSS"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Live URL (Optional)</label>
              <input
                v-model="form.live_url"
                type="url"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="https://macatung.dev"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">GitHub URL (Optional)</label>
              <input
                v-model="form.github_url"
                type="url"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="https://github.com/macatung/..."
              />
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input
              id="featured-checkbox"
              v-model="form.featured"
              type="checkbox"
              class="rounded bg-midnight-950 border-white/10 text-phantom-mint focus:ring-0 w-4 h-4"
            />
            <label for="featured-checkbox" class="text-xs font-mono text-slate-300">
              Mark as Featured Project
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono"
              @click="closeModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-6 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 shadow-glow-mint"
            >
              {{ editingProject ? 'Save Changes' : 'Create Project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminLayout>
</template>
