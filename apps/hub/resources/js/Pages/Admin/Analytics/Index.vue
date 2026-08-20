<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { computed } from 'vue';
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Icons from '@/Components/ui/Icons.vue';

interface Overview {
  total_pageviews: number;
  unique_visitors: number;
  today_pageviews: number;
  midnight_ratio: number;
}

interface DailyTrendItem {
  date: string;
  label: string;
  views: number;
  uniques: number;
}

interface HourlyItem {
  hour: string;
  count: number;
  is_midnight: boolean;
}

interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

interface ReferrerItem {
  source: string;
  url: string;
  count: number;
}

interface EventCounters {
  hop_mascot: number;
  cv_download: number;
  cli_executed: number;
  talisman_blessed: number;
}

interface RecentHit {
  id: number;
  url: string;
  device_type: string;
  browser: string;
  is_midnight: boolean;
  referrer?: string;
  created_at: string;
}

const props = defineProps<{
  overview: Overview;
  daily_trend: DailyTrendItem[];
  hourly_stats: HourlyItem[];
  device_breakdown: DeviceBreakdown;
  top_referrers: ReferrerItem[];
  event_counters: EventCounters;
  recent_pageviews: RecentHit[];
}>();

// Max values for chart scaling
const maxViews = computed(() => {
  const max = Math.max(...props.daily_trend.map((d) => d.views), 10);
  return Math.ceil(max * 1.15);
});

const maxHourlyCount = computed(() => {
  const max = Math.max(...props.hourly_stats.map((h) => h.count), 5);
  return Math.ceil(max * 1.15);
});

// SVG Path Calculation for 7-Day Line Chart
const chartPoints = computed(() => {
  const width = 600;
  const height = 180;
  const paddingX = 30;
  const paddingY = 20;

  const count = props.daily_trend.length;
  if (count <= 1) return { pathViews: '', pathUniques: '', pointsViews: [], pointsUniques: [] };

  const stepX = (width - paddingX * 2) / (count - 1);

  const pointsViews = props.daily_trend.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = height - paddingY - (d.views / maxViews.value) * (height - paddingY * 2);
    return { x, y, val: d.views, label: d.label };
  });

  const pointsUniques = props.daily_trend.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = height - paddingY - (d.uniques / maxViews.value) * (height - paddingY * 2);
    return { x, y, val: d.uniques, label: d.label };
  });

  const makePath = (pts: typeof pointsViews) => {
    return pts.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`;
    }, '');
  };

  const makeAreaPath = (pts: typeof pointsViews) => {
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const bottomY = height - paddingY;
    return `${makePath(pts)} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  };

  return {
    pathViews: makePath(pointsViews),
    areaViews: makeAreaPath(pointsViews),
    pathUniques: makePath(pointsUniques),
    pointsViews,
    pointsUniques,
  };
});

// Device calculation percentages
const totalDevices = computed(() => {
  const d = props.device_breakdown;
  return (d.desktop + d.mobile + d.tablet) || 1;
});

const devicePct = computed(() => ({
  desktop: Math.round((props.device_breakdown.desktop / totalDevices.value) * 100),
  mobile: Math.round((props.device_breakdown.mobile / totalDevices.value) * 100),
  tablet: Math.round((props.device_breakdown.tablet / totalDevices.value) * 100),
}));

const refreshAnalytics = () => {
  router.reload({ only: ['overview', 'daily_trend', 'hourly_stats', 'device_breakdown', 'top_referrers', 'event_counters', 'recent_pageviews'] });
};
</script>

<template>
  <AdminLayout title="Traffic & Event Analytics">
    <Head title="Traffic & Analytics — Admin CMS" />

    <!-- Header & Refresh -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Lưu Lượng Truy Cập (Traffic Analytics)
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
          Theo dõi lượt truy cập thời gian thực, khung giờ Midnight và các sự kiện tương tác trên Portfolio.
        </p>
      </div>

      <button
        type="button"
        class="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all flex items-center gap-1.5 border border-white/5"
        @click="refreshAnalytics"
      >
        <span>🔄 Làm Mới Dữ Liệu</span>
      </button>
    </div>

    <!-- 4 High-Level Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-5 rounded-2xl glass-panel border border-white/10">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Tổng Lượt Xem (Views)</span>
          <Icons name="Activity" :size="16" class="text-phantom-mint" />
        </div>
        <div class="text-3xl font-display font-extrabold text-white">
          {{ overview.total_pageviews.toLocaleString('vi-VN') }}
        </div>
        <span class="text-[11px] font-mono text-phantom-mint mt-1 block">Tất cả thời gian</span>
      </div>

      <div class="p-5 rounded-2xl glass-panel border border-white/10">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Khách Độc Bản (Uniques)</span>
          <Icons name="User" :size="16" class="text-phantom-cyan" />
        </div>
        <div class="text-3xl font-display font-extrabold text-white">
          {{ overview.unique_visitors.toLocaleString('vi-VN') }}
        </div>
        <span class="text-[11px] font-mono text-phantom-cyan mt-1 block">Unique Sessions</span>
      </div>

      <div class="p-5 rounded-2xl glass-panel border border-white/10">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Lưu Lượng Hôm Nay</span>
          <Icons name="Zap" :size="16" class="text-amber-400" />
        </div>
        <div class="text-3xl font-display font-extrabold text-white">
          {{ overview.today_pageviews.toLocaleString('vi-VN') }}
        </div>
        <span class="text-[11px] font-mono text-amber-400 mt-1 block">Live Today</span>
      </div>

      <div class="p-5 rounded-2xl glass-panel border border-white/10">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-mono uppercase tracking-wider">Lưu Lượng Midnight</span>
          <Icons name="Moon" :size="16" class="text-talisman-gold" />
        </div>
        <div class="text-3xl font-display font-extrabold text-white">
          {{ overview.midnight_ratio }}%
        </div>
        <span class="text-[11px] font-mono text-talisman-gold mt-1 block">Khung 00:00 — 05:00 AM</span>
      </div>
    </div>

    <!-- Charts Grid: 2 Columns -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- 7-Day Traffic Trend Line Chart (7 Columns) -->
      <div class="lg:col-span-7 p-6 rounded-2xl glass-panel border border-white/10 text-left">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
          <div>
            <h3 class="font-display font-bold text-base text-white">Xu Hướng Lưu Lượng (7 Ngày)</h3>
            <p class="text-xs text-slate-400 font-sans">Lượt xem (Pageviews) & Khách độc bản (Uniques)</p>
          </div>
          <div class="flex items-center gap-3 text-xs font-mono">
            <span class="flex items-center gap-1 text-phantom-mint">
              <span class="w-2.5 h-2.5 rounded-full bg-phantom-mint inline-block" /> Views
            </span>
            <span class="flex items-center gap-1 text-phantom-cyan">
              <span class="w-2.5 h-2.5 rounded-full bg-phantom-cyan inline-block" /> Uniques
            </span>
          </div>
        </div>

        <!-- SVG Line Chart Component -->
        <div class="w-full overflow-hidden">
          <svg viewBox="0 0 600 180" class="w-full h-44 overflow-visible">
            <defs>
              <linearGradient id="chartAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#00f5a0" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#00f5a0" stop-opacity="0.0" />
              </linearGradient>
            </defs>

            <!-- Grid Lines -->
            <line x1="30" y1="20" x2="570" y2="20" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4,4" />
            <line x1="30" y1="90" x2="570" y2="90" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4,4" />
            <line x1="30" y1="160" x2="570" y2="160" stroke="rgba(255,255,255,0.1)" />

            <!-- Area Fill -->
            <path :d="chartPoints.areaViews" fill="url(#chartAreaGrad)" />

            <!-- Line: Pageviews -->
            <path :d="chartPoints.pathViews" fill="none" stroke="#00f5a0" stroke-width="3" stroke-linecap="round" />

            <!-- Line: Uniques -->
            <path :d="chartPoints.pathUniques" fill="none" stroke="#00f5d4" stroke-width="2" stroke-dasharray="4,3" />

            <!-- Points: Views -->
            <g v-for="pt in chartPoints.pointsViews" :key="pt.label">
              <circle :cx="pt.x" :cy="pt.y" r="4" fill="#04070d" stroke="#00f5a0" stroke-width="2" />
              <text :x="pt.x" :y="pt.y - 8" text-anchor="middle" font-size="10" fill="#00f5a0" font-family="monospace" font-weight="bold">
                {{ pt.val }}
              </text>
              <text :x="pt.x" y="175" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="monospace">
                {{ pt.label }}
              </text>
            </g>
          </svg>
        </div>
      </div>

      <!-- 24-Hour Midnight Heatmap & Distribution (5 Columns) -->
      <div class="lg:col-span-5 p-6 rounded-2xl glass-panel border border-white/10 text-left">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
          <div>
            <h3 class="font-display font-bold text-base text-white">Phân Bổ 24 Giờ</h3>
            <p class="text-xs text-slate-400 font-sans">Lưu lượng truy cập theo từng giờ</p>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-midnight-900 border border-talisman-gold/30 text-talisman-gold">
            🌙 00:00 - 05:00 AM
          </span>
        </div>

        <!-- 24-Hour Bar Chart -->
        <div class="flex items-end justify-between gap-1 h-36 pt-4">
          <div
            v-for="h in hourly_stats"
            :key="h.hour"
            class="flex-1 flex flex-col items-center gap-1 group relative"
          >
            <!-- Tooltip -->
            <div class="absolute -top-7 hidden group-hover:block bg-midnight-900 border border-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-white whitespace-nowrap z-20 shadow-lg">
              {{ h.hour }}: {{ h.count }}
            </div>

            <!-- Bar -->
            <div
              class="w-full rounded-t transition-all duration-300"
              :class="h.is_midnight
                ? 'bg-talisman-gold group-hover:bg-amber-300 shadow-glow-talisman'
                : 'bg-white/10 group-hover:bg-white/30'"
              :style="{ height: `${Math.max((h.count / maxHourlyCount) * 100, 6)}%` }"
            />
            <span v-if="parseInt(h.hour) % 4 === 0" class="text-[8px] font-mono text-slate-500">
              {{ parseInt(h.hour) }}h
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Interaction Events & Devices Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Interaction Events Counters (6 Columns) -->
      <div class="lg:col-span-6 p-6 rounded-2xl glass-panel border border-white/10 text-left">
        <h3 class="font-display font-bold text-base text-white mb-1">Sự Kiện Tương Tác (Event Beacon)</h3>
        <p class="text-xs text-slate-400 font-sans mb-4">Các hành động được kích hoạt trên Portfolio</p>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>🧛‍♂️ Nhảy Mascot</span>
            </div>
            <div class="text-xl font-display font-bold text-phantom-mint mt-1">
              {{ event_counters.hop_mascot.toLocaleString('vi-VN') }}
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>📄 Tải CV</span>
            </div>
            <div class="text-xl font-display font-bold text-phantom-cyan mt-1">
              {{ event_counters.cv_download.toLocaleString('vi-VN') }}
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>⌨️ Gõ Lệnh CLI</span>
            </div>
            <div class="text-xl font-display font-bold text-amber-400 mt-1">
              {{ event_counters.cli_executed.toLocaleString('vi-VN') }}
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>📜 Khai Quang Bùa</span>
            </div>
            <div class="text-xl font-display font-bold text-talisman-gold mt-1">
              {{ event_counters.talisman_blessed.toLocaleString('vi-VN') }}
            </div>
          </div>
        </div>
      </div>

      <!-- Devices & Referrers (6 Columns) -->
      <div class="lg:col-span-6 p-6 rounded-2xl glass-panel border border-white/10 text-left space-y-4">
        <h3 class="font-display font-bold text-base text-white">Thiết Bị & Nguồn Giới Thiệu</h3>

        <!-- Devices Progress -->
        <div class="space-y-2">
          <div class="flex justify-between text-xs font-mono">
            <span class="text-slate-300">💻 Desktop: {{ devicePct.desktop }}%</span>
            <span class="text-slate-300">📱 Mobile: {{ devicePct.mobile }}%</span>
            <span class="text-slate-300">📟 Tablet: {{ devicePct.tablet }}%</span>
          </div>
          <div class="w-full h-2.5 bg-midnight-950 rounded-full overflow-hidden flex border border-white/5">
            <div class="bg-phantom-mint h-full" :style="{ width: `${devicePct.desktop}%` }" />
            <div class="bg-phantom-cyan h-full" :style="{ width: `${devicePct.mobile}%` }" />
            <div class="bg-amber-400 h-full" :style="{ width: `${devicePct.tablet}%` }" />
          </div>
        </div>

        <!-- Top Referrers -->
        <div class="pt-2">
          <div class="text-xs font-mono text-slate-400 mb-2">Nguồn Truy Cập Hàng Đầu (Referrers)</div>
          <div class="space-y-1.5">
            <div
              v-for="r in top_referrers"
              :key="r.source"
              class="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-midnight-950/60 border border-white/5"
            >
              <span class="text-slate-300 truncate max-w-xs">{{ r.source }}</span>
              <span class="text-phantom-mint font-bold">{{ r.count }} hits</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Raw Pageviews Feed -->
    <div class="p-6 rounded-2xl glass-panel border border-white/10 text-left">
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div>
          <h3 class="font-display font-bold text-base text-white">Nhật Ký Truy Cập Gần Đây (Live Feed)</h3>
          <p class="text-xs text-slate-400 font-sans">15 lượt xem mới nhất được ghi nhận qua Middleware</p>
        </div>
      </div>

      <div class="overflow-x-auto no-scrollbar">
        <table class="w-full text-left text-xs font-sans">
          <thead class="bg-midnight-900/60 border-b border-white/5 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th class="p-3">Thời Gian</th>
              <th class="p-3">Đường Dẫn</th>
              <th class="p-3">Thiết Bị</th>
              <th class="p-3">Trình Duyệt</th>
              <th class="p-3">Khung Giờ</th>
              <th class="p-3 text-right">Referrer</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr v-for="hit in recent_pageviews" :key="hit.id" class="hover:bg-white/5 transition-colors">
              <td class="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                {{ new Date(hit.created_at).toLocaleString('vi-VN') }}
              </td>
              <td class="p-3 font-mono font-bold text-phantom-mint">{{ hit.url }}</td>
              <td class="p-3 font-mono text-[11px] capitalize">{{ hit.device_type }}</td>
              <td class="p-3 font-mono text-[11px]">{{ hit.browser }}</td>
              <td class="p-3">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap"
                  :class="hit.is_midnight ? 'bg-amber-500/20 text-talisman-gold' : 'bg-white/5 text-slate-400'"
                >
                  {{ hit.is_midnight ? '🌙 Midnight' : '☀️ Day' }}
                </span>
              </td>
              <td class="p-3 text-right font-mono text-[10px] text-slate-400 truncate max-w-xs">
                {{ hit.referrer || 'Trực tiếp (Direct)' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>
</template>
