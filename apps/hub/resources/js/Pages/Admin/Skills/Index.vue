<script setup lang="ts">
import { Head, useForm, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface SkillItem {
  id: number;
  name: string;
  category: 'frontend' | 'backend' | 'cloud' | 'ai';
  level: number;
  rune: string;
  tag: string;
  order: number;
}

defineProps<{
  skills: SkillItem[];
}>();

const isModalOpen = ref(false);
const editingSkill = ref<SkillItem | null>(null);

const form = useForm({
  name: '',
  category: 'frontend' as 'frontend' | 'backend' | 'cloud' | 'ai',
  level: 90,
  rune: '⚡',
  tag: 'Core',
  order: 0,
});

const openCreateModal = () => {
  editingSkill.value = null;
  form.reset();
  form.clearErrors();
  isModalOpen.value = true;
};

const openEditModal = (skill: SkillItem) => {
  editingSkill.value = skill;
  form.name = skill.name;
  form.category = skill.category;
  form.level = skill.level;
  form.rune = skill.rune;
  form.tag = skill.tag;
  form.order = skill.order || 0;
  form.clearErrors();
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  editingSkill.value = null;
};

const submitSkill = () => {
  const payload = {
    name: form.name,
    category: form.category,
    level: Number(form.level),
    rune: form.rune,
    tag: form.tag,
    order: Number(form.order) || 0,
  };

  if (editingSkill.value) {
    router.put(`/admin/skills/${editingSkill.value.id}`, payload, {
      onSuccess: () => closeModal(),
    });
  } else {
    router.post('/admin/skills', payload, {
      onSuccess: () => closeModal(),
    });
  }
};

const deleteSkill = (skill: SkillItem) => {
  if (confirm(`Bạn có chắc chắn muốn xóa kỹ năng "${skill.name}" không?`)) {
    router.delete(`/admin/skills/${skill.id}`, {
      preserveScroll: true,
    });
  }
};
</script>

<template>
  <AdminLayout title="Quản Lý Kỹ Năng">
    <Head title="Quản Lý Kỹ Năng — Admin CMS" />

    <!-- Header & Create Action -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Quản Lý Kỹ Năng & Pháp Bảo (Skills CMS)
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Thêm, chỉnh sửa mức độ thành thạo (%) và phân loại các kỹ năng trong Tech Arsenal.
        </p>
      </div>

      <button
        type="button"
        class="px-4 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 transition-all shadow-glow-mint flex items-center gap-1.5"
        @click="openCreateModal"
      >
        <span>+ Thêm Kỹ Năng Mới</span>
      </button>
    </div>

    <!-- Skills Table -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div class="overflow-x-auto no-scrollbar">
        <table class="w-full text-left text-xs font-sans">
          <thead class="bg-midnight-900/60 border-b border-white/5 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th class="p-3">Thứ Tự</th>
              <th class="p-3">Rune & Kỹ Năng</th>
              <th class="p-3">Phân Nhóm</th>
              <th class="p-3">Nhãn (Tag)</th>
              <th class="p-3">Độ Thành Thạo</th>
              <th class="p-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr v-for="s in skills" :key="s.id" class="hover:bg-white/5 transition-colors">
              <td class="p-3 font-mono text-slate-400">#{{ s.order }}</td>
              <td class="p-3 font-bold text-white flex items-center gap-2">
                <span class="text-base">{{ s.rune }}</span>
                <span>{{ s.name }}</span>
              </td>
              <td class="p-3">
                <span class="px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 font-mono text-[10px] uppercase border border-white/5">
                  {{ s.category }}
                </span>
              </td>
              <td class="p-3 font-mono text-slate-400">{{ s.tag }}</td>
              <td class="p-3">
                <div class="flex items-center gap-2 max-w-[140px]">
                  <div class="flex-1 h-1.5 bg-midnight-950 rounded-full overflow-hidden border border-white/5">
                    <div class="bg-phantom-mint h-full" :style="{ width: `${s.level}%` }" />
                  </div>
                  <span class="font-mono text-phantom-mint font-bold text-[11px]">{{ s.level }}%</span>
                </div>
              </td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all"
                    @click="openEditModal(s)"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-mono transition-all border border-rose-500/20"
                    @click="deleteSkill(s)"
                  >
                    Xóa
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
      <div class="w-full max-w-lg bg-midnight-900 border border-white/10 rounded-3xl p-6 sm:p-8 text-left shadow-2xl space-y-5">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 class="text-xl font-display font-bold text-white">
            {{ editingSkill ? 'Chỉnh Sửa Kỹ Năng' : 'Thêm Kỹ Năng Mới' }}
          </h2>
          <button type="button" class="p-1 rounded-lg text-slate-400 hover:text-white" @click="closeModal">
            <Icons name="X" :size="20" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitSkill">
          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tên Kỹ Năng *</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              placeholder="e.g. Vue 3 & Inertia.js"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Phân Nhóm *</label>
              <select
                v-model="form.category"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              >
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="cloud">Cloud & DevOps</option>
                <option value="ai">AI & Automation</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Icon Rune (Emoji) *</label>
              <input
                v-model="form.rune"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="⚡ / 🛡️ / 🎨 / 🏰"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Nhãn / Tag *</label>
              <input
                v-model="form.tag"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
                placeholder="Core / Type-Safe / Audio"
              />
            </div>

            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Thứ Tự Sắp Xếp</label>
              <input
                v-model.number="form.order"
                type="number"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-mono text-slate-300 uppercase">Độ Thành Thạo (%) *</label>
              <span class="text-xs font-mono font-bold text-phantom-mint">{{ form.level }}%</span>
            </div>
            <input
              v-model.number="form.level"
              type="range"
              min="1"
              max="100"
              class="w-full accent-phantom-mint cursor-pointer"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono" @click="closeModal">
              Hủy Bỏ
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 shadow-glow-mint">
              {{ editingSkill ? 'Lưu Thay Đổi' : 'Tạo Kỹ Năng' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminLayout>
</template>
