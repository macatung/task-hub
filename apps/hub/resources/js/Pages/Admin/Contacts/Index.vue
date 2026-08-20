<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import AdminLayout from '@/Layouts/AdminLayout.vue';

interface ContactItem {
  id: number;
  reference_id: string;
  name: string;
  email: string;
  project_type: string;
  coffee_offering: string;
  message: string;
  created_at: string;
}

interface PaginatedContacts {
  data: ContactItem[];
  current_page: number;
  last_page: number;
  total: number;
}

defineProps<{
  contacts: PaginatedContacts;
  filters?: {
    project_type?: string;
    search?: string;
  };
}>();

const deleteContact = (c: ContactItem) => {
  if (confirm(`Bạn có chắc muốn xóa lời triệu hồi từ "${c.name}" (${c.reference_id}) không?`)) {
    router.delete(`/admin/contacts/${c.id}`, {
      preserveScroll: true,
    });
  }
};
</script>

<template>
  <AdminLayout title="Hộp Thư Triệu Hồi">
    <Head title="Hộp Thư Triệu Hồi — Admin CMS" />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Hộp Thư Triệu Hồi (Summoning Inquiries)
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Danh sách toàn bộ yêu cầu dự án, tin nhắn và lời mời cà phê từ khách truy cập.
        </p>
      </div>

      <span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-phantom-mint font-mono text-xs">
        Tổng số: {{ contacts.total }} lời triệu hồi
      </span>
    </div>

    <!-- Inquiries Cards / Table -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div v-if="contacts.data.length === 0" class="p-12 text-center text-slate-500 font-mono text-xs">
        Hộp thư đang trống. Chưa có lời triệu hồi nào.
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="c in contacts.data"
          :key="c.id"
          class="p-5 rounded-2xl bg-midnight-900/80 border border-white/5 hover:border-white/20 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <!-- Left: Info & Message -->
          <div class="space-y-2 flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs font-bold text-phantom-mint bg-phantom-mint/10 px-2.5 py-0.5 rounded-full border border-phantom-mint/30">
                {{ c.reference_id }}
              </span>
              <span class="font-bold text-white text-sm sm:text-base">{{ c.name }}</span>
              <span class="text-xs font-mono text-slate-400">&lt;{{ c.email }}&gt;</span>
              <span class="px-2 py-0.5 rounded bg-white/5 text-[11px] font-mono text-slate-300">
                {{ c.project_type }}
              </span>
              <span class="px-2 py-0.5 rounded bg-amber-500/10 text-[11px] font-mono text-talisman-gold">
                ☕ {{ c.coffee_offering }}
              </span>
            </div>

            <!-- Message Body -->
            <p class="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed break-words bg-midnight-950/60 p-3 rounded-xl border border-white/5">
              {{ c.message }}
            </p>

            <div class="text-[10px] font-mono text-slate-500">
              Nhận lúc: {{ new Date(c.created_at).toLocaleString('vi-VN') }}
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <a
              :href="`mailto:${c.email}?subject=Re: [macatung.dev] Lời hồi đáp triệu hồi ${c.reference_id}`"
              class="px-3.5 py-2 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 shadow-glow-mint flex items-center gap-1"
            >
              <span>Phản Hồi Email ✉️</span>
            </a>
            <button
              type="button"
              class="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 font-mono text-xs transition-all border border-rose-500/20"
              @click="deleteContact(c)"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
