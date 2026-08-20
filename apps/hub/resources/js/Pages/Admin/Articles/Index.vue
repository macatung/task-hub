<script setup lang="ts">
import { Head, useForm, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface ArticleItem {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  tags?: string[];
  reading_time_min: number;
  is_published: boolean;
  published_at?: string;
  created_at: string;
}

defineProps<{
  articles: ArticleItem[];
}>();

const isModalOpen = ref(false);
const editingArticle = ref<ArticleItem | null>(null);

const form = useForm({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  tags_input: '',
  reading_time_min: 5,
  is_published: true,
});

const openCreateModal = () => {
  editingArticle.value = null;
  form.reset();
  form.clearErrors();
  isModalOpen.value = true;
};

const openEditModal = (article: ArticleItem) => {
  editingArticle.value = article;
  form.title = article.title;
  form.slug = article.slug;
  form.excerpt = article.excerpt || '';
  form.content = article.content;
  form.tags_input = (article.tags || []).join(', ');
  form.reading_time_min = article.reading_time_min || 5;
  form.is_published = article.is_published;
  form.clearErrors();
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  editingArticle.value = null;
};

const submitArticle = () => {
  const tags = form.tags_input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const payload = {
    title: form.title,
    slug: form.slug || undefined,
    excerpt: form.excerpt,
    content: form.content,
    tags,
    reading_time_min: Number(form.reading_time_min) || 5,
    is_published: form.is_published,
  };

  if (editingArticle.value) {
    router.put(`/admin/articles/${editingArticle.value.id}`, payload, {
      onSuccess: () => closeModal(),
    });
  } else {
    router.post('/admin/articles', payload, {
      onSuccess: () => closeModal(),
    });
  }
};

const deleteArticle = (article: ArticleItem) => {
  if (confirm(`Bạn có chắc muốn xóa bài viết "${article.title}" không?`)) {
    router.delete(`/admin/articles/${article.id}`, {
      preserveScroll: true,
    });
  }
};
</script>

<template>
  <AdminLayout title="Quản Lý Ghi Chú & Bài Viết">
    <Head title="Ghi Chú & Bài Viết — Admin CMS" />

    <!-- Header & Create Action -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Ghi Chú & Bài Viết (Midnight Tech Notes CMS)
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Soạn thảo và xuất bản các bài chia sẻ kỹ thuật, kinh nghiệm kiến trúc chuẩn định dạng Markdown.
        </p>
      </div>

      <button
        type="button"
        class="px-4 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 transition-all shadow-glow-mint flex items-center gap-1.5"
        @click="openCreateModal"
      >
        <span>+ Soạn Bài Viết Mới</span>
      </button>
    </div>

    <!-- Articles List Table -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div v-if="articles.length === 0" class="p-12 text-center text-slate-500 font-mono text-xs">
        Chưa có bài viết nào. Hãy bấm "Soạn Bài Viết Mới" để tạo bài viết đầu tiên!
      </div>

      <div v-else class="overflow-x-auto no-scrollbar">
        <table class="w-full text-left text-xs font-sans">
          <thead class="bg-midnight-900/60 border-b border-white/5 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th class="p-3">Tiêu Đề Bài Viết</th>
              <th class="p-3">Tags</th>
              <th class="p-3">Thời Lượng</th>
              <th class="p-3 text-center">Trạng Thái</th>
              <th class="p-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr v-for="a in articles" :key="a.id" class="hover:bg-white/5 transition-colors">
              <td class="p-3">
                <div class="font-bold text-white text-sm sm:text-base">{{ a.title }}</div>
                <div class="text-[11px] font-mono text-slate-400">/articles/{{ a.slug }}</div>
              </td>
              <td class="p-3">
                <div class="flex flex-wrap gap-1 max-w-xs">
                  <span
                    v-for="t in a.tags || []"
                    :key="t"
                    class="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300 border border-white/5"
                  >
                    {{ t }}
                  </span>
                </div>
              </td>
              <td class="p-3 font-mono text-slate-400">
                ⏱️ {{ a.reading_time_min }} phút đọc
              </td>
              <td class="p-3 text-center">
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                  :class="a.is_published ? 'bg-phantom-mint/10 text-phantom-mint border border-phantom-mint/30' : 'bg-white/5 text-slate-500'"
                >
                  {{ a.is_published ? '✓ Đã Xuất Bản' : 'Draft Bản Nháp' }}
                </span>
              </td>
              <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all"
                    @click="openEditModal(a)"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-mono transition-all border border-rose-500/20"
                    @click="deleteArticle(a)"
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
      <div class="w-full max-w-3xl bg-midnight-900 border border-white/10 rounded-3xl p-6 sm:p-8 text-left shadow-2xl space-y-5">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 class="text-xl font-display font-bold text-white">
            {{ editingArticle ? 'Chỉnh Sửa Bài Viết' : 'Soạn Bài Viết Mới' }}
          </h2>
          <button type="button" class="p-1 rounded-lg text-slate-400 hover:text-white" @click="closeModal">
            <Icons name="X" :size="20" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitArticle">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tiêu Đề Bài Viết *</label>
              <input
                v-model="form.title"
                type="text"
                required
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
                placeholder="e.g. Tối Ưu Cổng Thanh Toán Flash Sale Với Redis"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Slug URL</label>
              <input
                v-model="form.slug"
                type="text"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
                placeholder="toi-uu-flash-sale-redis"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tóm Tắt Ngắn (Excerpt)</label>
            <input
              v-model="form.excerpt"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none"
              placeholder="Tóm tắt nội dung chính trong 1-2 câu..."
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Tags (Phân cách bằng dấu phẩy)</label>
              <input
                v-model="form.tags_input"
                type="text"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
                placeholder="Laravel, Redis, Architecture"
              />
            </div>
            <div>
              <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Thời Lượng Đọc (Phút)</label>
              <input
                v-model.number="form.reading_time_min"
                type="number"
                min="1"
                class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono text-slate-300 uppercase mb-1">Nội Dung Bài Viết (Markdown Format) *</label>
            <textarea
              v-model="form.content"
              rows="8"
              required
              class="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-white text-sm focus:border-phantom-mint focus:outline-none font-mono text-xs leading-relaxed"
              placeholder="## Tiêu đề phụ&#10;&#10;Nội dung bài viết hỗ trợ cú pháp **Markdown**..."
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input
              id="publish-checkbox"
              v-model="form.is_published"
              type="checkbox"
              class="rounded bg-midnight-950 border-white/10 text-phantom-mint focus:ring-0 w-4 h-4"
            />
            <label for="publish-checkbox" class="text-xs font-mono text-slate-300">
              Xuất bản bài viết ngay (Publicly Available)
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono" @click="closeModal">
              Hủy Bỏ
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 shadow-glow-mint">
              {{ editingArticle ? 'Lưu Thay Đổi' : 'Tạo Bài Viết' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminLayout>
</template>
