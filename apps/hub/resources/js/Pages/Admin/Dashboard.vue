<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface Stats {
  total_contacts: number;
  total_projects: number;
  featured_projects: number;
  coffee_offerings_count: number;
  uptime_status: string;
  active_realm: string;
}

interface RecentContact {
  id: number;
  name: string;
  email: string;
  project_type: string;
  coffee_offering: string;
  message: string;
  reference_id: string;
  created_at: string;
}

defineProps<{
  stats: Stats;
  recent_contacts: RecentContact[];
  project_type_stats: { project_type: string; count: number }[];
  coffee_stats: { coffee_offering: string; count: number }[];
}>();
</script>

<template>
  <AdminLayout title="CMS Dashboard">
    <Head title="Admin Dashboard — macatung.dev" />

    <!-- Welcome & Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Trung Tâm Quản Trị CMS & Traffic
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Theo dõi số liệu lưu lượng, quản lý toàn bộ nội dung portfolio và các lời triệu hồi.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Link
          href="/admin/analytics"
          class="px-4 py-2 rounded-xl bg-phantom-mint text-midnight-950 font-mono font-bold text-xs hover:brightness-110 transition-all shadow-glow-mint flex items-center gap-1.5"
        >
          <Icons name="Activity" :size="15" />
          <span>Xem Phân Tích Lưu Lượng</span>
        </Link>
      </div>
    </div>

    <!-- 4 KPI Metrics Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/admin/contacts" class="p-5 rounded-2xl glass-panel border border-white/10 hover:border-phantom-mint/40 transition-all">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Hộp Thư Triệu Hồi</span>
          <Icons name="Mail" :size="16" class="text-phantom-mint" />
        </div>
        <div class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          {{ stats.total_contacts }}
        </div>
        <span class="text-[11px] font-mono text-phantom-mint mt-1 block">Inertia Form Inquiries →</span>
      </Link>

      <Link href="/admin/projects" class="p-5 rounded-2xl glass-panel border border-white/10 hover:border-talisman-gold/40 transition-all">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Dự Án Đang Chạy</span>
          <Icons name="Sparkles" :size="16" class="text-talisman-gold" />
        </div>
        <div class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          {{ stats.total_projects }}
        </div>
        <span class="text-[11px] font-mono text-talisman-gold mt-1 block">{{ stats.featured_projects }} dự án nổi bật →</span>
      </Link>

      <Link href="/admin/analytics" class="p-5 rounded-2xl glass-panel border border-white/10 hover:border-phantom-cyan/40 transition-all">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Lưu Lượng Analytics</span>
          <Icons name="Activity" :size="16" class="text-phantom-cyan" />
        </div>
        <div class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Self-Hosted
        </div>
        <span class="text-[11px] font-mono text-phantom-cyan mt-1 block">Traffic & Midnight Heatmap →</span>
      </Link>

      <div class="p-5 rounded-2xl glass-panel border border-white/10">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Trạng Thái Server</span>
          <Icons name="Zap" :size="16" class="text-emerald-400" />
        </div>
        <div class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          100%
        </div>
        <span class="text-[11px] font-mono text-emerald-400 mt-1 block">{{ stats.uptime_status }}</span>
      </div>
    </div>

    <!-- Quick Navigation Hub -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Link
        href="/admin/skills"
        class="p-4 rounded-xl glass-panel border border-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center text-center gap-1.5"
      >
        <span class="text-xl">⚡</span>
        <span class="font-display font-bold text-xs text-white">Kỹ Năng & Pháp Bảo</span>
        <span class="text-[10px] font-mono text-slate-400">15 Runes</span>
      </Link>

      <Link
        href="/admin/experiences"
        class="p-4 rounded-xl glass-panel border border-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center text-center gap-1.5"
      >
        <span class="text-xl">⏳</span>
        <span class="font-display font-bold text-xs text-white">Biên Niên Sử</span>
        <span class="text-[10px] font-mono text-slate-400">Timeline Cột Mốc</span>
      </Link>

      <Link
        href="/admin/articles"
        class="p-4 rounded-xl glass-panel border border-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center text-center gap-1.5"
      >
        <span class="text-xl">📝</span>
        <span class="font-display font-bold text-xs text-white">Ghi Chú & Bài Viết</span>
        <span class="text-[10px] font-mono text-slate-400">Markdown CMS</span>
      </Link>

      <Link
        href="/admin/settings"
        class="p-4 rounded-xl glass-panel border border-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center text-center gap-1.5"
      >
        <span class="text-xl">⚙️</span>
        <span class="font-display font-bold text-xs text-white">Cài Đặt & Profile</span>
        <span class="text-[10px] font-mono text-slate-400">Slogan, Bio, Password</span>
      </Link>
    </div>

    <!-- Recent Summoning Inquiries Card -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div>
          <h2 class="text-lg font-display font-bold text-white">Lời Triệu Hồi Gần Đây</h2>
          <p class="text-xs text-slate-400">Các yêu cầu dự án và thư liên hệ mới nhất gửi từ homepage</p>
        </div>
        <Link
          href="/admin/contacts"
          class="text-xs font-mono text-phantom-mint hover:underline flex items-center gap-1"
        >
          <span>Xem tất cả ({{ stats.total_contacts }}) →</span>
        </Link>
      </div>

      <div v-if="recent_contacts.length === 0" class="p-8 text-center text-slate-500 font-mono text-xs">
        Chưa có lời triệu hồi nào. Hãy gửi thử 1 yêu cầu tại Bàn Thờ Triệu Hồi ngoài Homepage!
      </div>

      <div v-else class="overflow-x-auto no-scrollbar">
        <table class="w-full text-left text-xs font-sans">
          <thead class="bg-midnight-900/60 border-b border-white/5 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th class="p-3">Mã Ref</th>
              <th class="p-3">Người Gửi</th>
              <th class="p-3">Loại Quest</th>
              <th class="p-3">Lễ Vật</th>
              <th class="p-3">Tin Nhắn</th>
              <th class="p-3 text-right">Thời Gian</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr v-for="c in recent_contacts" :key="c.id" class="hover:bg-white/5 transition-colors">
              <td class="p-3 font-mono font-bold text-phantom-mint">{{ c.reference_id }}</td>
              <td class="p-3">
                <div class="font-semibold text-white">{{ c.name }}</div>
                <div class="text-[11px] text-slate-400 font-mono">{{ c.email }}</div>
              </td>
              <td class="p-3">
                <span class="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[10px] border border-white/5 whitespace-nowrap">
                  {{ c.project_type }}
                </span>
              </td>
              <td class="p-3 font-mono text-[11px] text-amber-400 whitespace-nowrap">
                ☕ {{ c.coffee_offering }}
              </td>
              <td class="p-3 max-w-xs truncate text-slate-300 font-sans" :title="c.message">
                {{ c.message }}
              </td>
              <td class="p-3 text-right font-mono text-[10px] text-slate-500 whitespace-nowrap">
                {{ new Date(c.created_at).toLocaleString('vi-VN') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>
</template>
