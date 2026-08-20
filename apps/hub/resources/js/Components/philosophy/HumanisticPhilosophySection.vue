<script setup lang="ts">
import { ref } from 'vue';
import Icons from '@/Components/ui/Icons.vue';
import { sound } from '@/audio/soundEffects';

interface Pillar {
  id: string;
  number: string;
  icon: string;
  subtitle: string;
  title: string;
  shortDesc: string;
  philosophy: string;
  technicalPractice: string;
  badge: string;
  accentColor: string;
  glowColor: string;
}

const activePillarId = ref<string>('empathy');

const pillars: Pillar[] = [
  {
    id: 'empathy',
    number: '01',
    icon: 'Heart',
    subtitle: 'Empathy & User-Centric Design',
    title: 'Thiết Kế Vị Nhân Sinh',
    shortDesc: 'Code không phải để phô diễn sự phức tạp, mà để thấu hiểu và giải quyết nỗi đau thực tế của người dùng.',
    philosophy: 'Phần mềm tốt nhất là phần mềm phục vụ con người một cách thầm lặng và tinh tế. Khi gạt bỏ sự tự tôn kỹ thuật cá nhân (over-engineering), lập trình viên viết ra những dòng code khiêm nhường, sáng rõ và dễ hiểu nhất cho cộng sự kế thừa.',
    technicalPractice: 'Đơn giản hóa logic phức tạp thành trải nghiệm trực quan thuần khiết. Tuyệt đối nói KHÔNG với các bẫy Dark Patterns thao túng hành vi; tôn trọng tối đa quyền riêng tư, sự an tâm và thời gian quý báu của người dùng.',
    badge: 'Human-First UX',
    accentColor: '#00f5a0',
    glowColor: 'rgba(0, 245, 160, 0.25)'
  },
  {
    id: 'resilience',
    number: '02',
    icon: 'Layers',
    subtitle: 'Resilient & Green Computing',
    title: 'Kiến Trúc Sinh Thái Bền Vững',
    shortDesc: 'Mọi service, API và cấu trúc dữ liệu đều tương hỗ trong một chỉnh thể sinh thái hài hòa, tiết kiệm tài nguyên.',
    philosophy: 'Trong một hệ thống phân tán, một biến đổi nhỏ ở tầng dữ liệu có thể tạo sóng lan truyền đến toàn bộ trải nghiệm. Hệ thống phần mềm bền vững là hệ thống vận hành tối ưu năng lượng máy chủ, mượt mà và linh hoạt thích ứng trước mọi thay đổi.',
    technicalPractice: 'Kiến trúc phân tán Microservices & Event-Driven tối ưu Green Computing, giảm thiểu tiêu thụ CPU/RAM máy chủ. Thiết kế module độc lập (Decoupled) để thích ứng linh hoạt trước biến chuyển của công nghệ mà không gãy đổ.',
    badge: 'Resilient Ecology',
    accentColor: '#ffd166',
    glowColor: 'rgba(255, 209, 102, 0.25)'
  },
  {
    id: 'craftsmanship',
    number: '03',
    icon: 'Shield',
    subtitle: 'Zero-Debt Craftsmanship',
    title: 'Kỷ Luật & Chất Lượng Tuyệt Đối',
    shortDesc: 'Nợ kỹ thuật và sự cẩu thả là nguồn gốc của bất an. Tỉ mỉ trong từng dòng mã mang lại sự tin cậy dài lâu.',
    philosophy: 'Mỗi dòng code viết ra trong vội vã, thiếu trách nhiệm sẽ gieo rắc khủng hoảng cho tương lai. Sự nghiêm cẩn trong kỹ nghệ lập trình (Software Craftsmanship) là thước đo danh dự và trách nhiệm của người kỹ sư đối với sản phẩm.',
    technicalPractice: 'Cam kết 100% Strict Type-safety với TypeScript, tự động hóa kiểm thử hồi quy toàn diện (E2E & Unit), kiến trúc phòng vệ Zero-Crash và bảo mật đa lớp trước khi đưa lên Production.',
    badge: 'Zero-Debt Flow',
    accentColor: '#00f5ff',
    glowColor: 'rgba(0, 245, 255, 0.25)'
  },
  {
    id: 'flourishing',
    number: '04',
    icon: 'Sparkles',
    subtitle: 'AI for Human Empowerment',
    title: 'Giải Phóng Sức Lao Động',
    shortDesc: 'Công nghệ đích thực là công nghệ trả lại tự do, thời gian và sự sáng tạo cho con người.',
    philosophy: 'Mục đích tối thượng của trí tuệ nhân tạo và tự động hóa không phải là thay thế con người, mà là gánh vác những tác vụ lặp lại nặng nhọc, để con người có thêm thời gian phát triển tư duy chiến lược và nuôi dưỡng giá trị sống.',
    technicalPractice: 'Thiết kế hệ sinh thái Multi-Agent AI tự trị hoạt động 24/7 với độ chính xác cao, tự động hóa quy trình nghiệp vụ phức tạp, giúp người dùng tiết kiệm hàng ngàn giờ thao tác thủ công.',
    badge: 'Human Flourishing',
    accentColor: '#9d4edd',
    glowColor: 'rgba(157, 78, 221, 0.25)'
  }
];

const selectPillar = (id: string) => {
  activePillarId.value = id;
  sound.playClick();
};
</script>

<template>
  <section id="philosophy" class="scroll-mt-24 w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-left relative">
    <!-- Ambient Background Lighting -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-phantom-mint/5 via-talisman-gold/5 to-phantom-purple/5 rounded-full blur-[140px] pointer-events-none" />

    <!-- Section Header -->
    <div class="flex flex-col items-start mb-12 relative z-10">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono mb-3 shadow-glow-mint select-none">
        <span class="text-phantom-mint">🌿</span>
        <span class="text-slate-200 font-semibold tracking-wide">Humanistic Software Engineering Manifesto</span>
      </div>
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-tight">
        Triết Lý Nhân Sinh Trong <br class="hidden sm:inline" />
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-talisman-gold to-phantom-cyan">
          Kiến Tạo Ứng Dụng & Kỹ Nghệ Phần Mềm
        </span>
      </h2>
      <p class="text-sm sm:text-base text-slate-300 mt-3 max-w-3xl font-sans leading-relaxed">
        Phần mềm không chỉ là những dòng lệnh nhị phân lạnh lùng, mà là sự phản chiếu của tư duy người lập trình. Kiến tạo ứng dụng là hành trình phụng sự và hoàn thiện kỹ nghệ, lấy con người và sự bình an làm gốc rễ.
      </p>
    </div>

    <!-- Core Philosophy Manifesto Callout Banner -->
    <div class="mb-12 p-6 sm:p-8 rounded-3xl glass-panel border border-white/15 relative overflow-hidden bg-gradient-to-r from-midnight-900/90 via-midnight-950 to-midnight-900 shadow-2xl relative z-10">
      <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div class="space-y-2 max-w-4xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-talisman-gold/10 text-talisman-gold border border-talisman-gold/30 text-xs font-mono font-bold">
            <span>✨ Tôn Chỉ Kỹ Nghệ</span>
            <span>·</span>
            <span>Code Khởi Tâm Thiện — Ứng Dụng Phụng Sự Nhân Sinh</span>
          </div>
          <blockquote class="text-base sm:text-lg lg:text-xl font-sans italic text-slate-100 leading-relaxed pt-1">
            "Mỗi dòng code gõ xuống trong tĩnh lặng của đêm đen (00:00 AM) đều mang theo một trách nhiệm. Viết code với sự tỉnh thức và lòng trắc ẩn để giải trừ nỗi đau của người dùng, mang lại sự giản đơn, minh bạch và giải phóng thời gian cho cuộc sống đích thực."
          </blockquote>
        </div>

        <div class="shrink-0 flex items-center gap-3 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 text-xs font-mono text-slate-400">
          <div class="text-left">
            <p class="text-phantom-mint font-bold uppercase tracking-wider">The Midnight Architect</p>
            <p class="text-slate-400 text-[11px] mt-0.5">Kỹ nghệ phần mềm vị nhân sinh</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 Core Pillars Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 relative z-10">
      <div
        v-for="pillar in pillars"
        :key="pillar.id"
        class="rounded-3xl glass-panel p-6 border transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
        :class="activePillarId === pillar.id
          ? 'bg-midnight-900/90 shadow-2xl'
          : 'bg-midnight-950/60 hover:bg-midnight-900/60'"
        :style="{
          borderColor: activePillarId === pillar.id ? pillar.accentColor : 'rgba(255, 255, 255, 0.08)',
          boxShadow: activePillarId === pillar.id ? `0 12px 30px -8px ${pillar.glowColor}` : 'none'
        }"
        @click="selectPillar(pillar.id)"
      >
        <!-- Top Status & Number -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
              :style="{
                backgroundColor: `${pillar.accentColor}15`,
                color: pillar.accentColor,
                border: `1px solid ${pillar.accentColor}40`
              }"
            >
              <Icons :name="pillar.icon" :size="20" />
            </div>
            <span class="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300 transition-colors">
              {{ pillar.number }}
            </span>
          </div>

          <!-- Badges & Terms -->
          <div class="mb-2">
            <span
              class="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold"
              :style="{
                backgroundColor: `${pillar.accentColor}15`,
                color: pillar.accentColor
              }"
            >
              {{ pillar.badge }}
            </span>
          </div>

          <h3 class="text-lg font-display font-extrabold text-white group-hover:text-phantom-mint transition-colors mb-1 leading-snug">
            {{ pillar.title }}
          </h3>
          <p class="text-xs font-mono text-slate-400 mb-3">
            {{ pillar.subtitle }}
          </p>

          <p class="text-xs text-slate-300 font-sans leading-relaxed line-clamp-3">
            {{ pillar.shortDesc }}
          </p>
        </div>

        <!-- Pillar Expansion Trigger -->
        <div class="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
          <span
            class="text-[11px] font-bold transition-colors"
            :style="{ color: activePillarId === pillar.id ? pillar.accentColor : '#94a3b8' }"
          >
            {{ activePillarId === pillar.id ? '● Đang xem chi tiết' : '○ Xem chi tiết' }}
          </span>
          <span
            class="text-xs transition-transform group-hover:translate-x-1"
            :style="{ color: pillar.accentColor }"
          >
            →
          </span>
        </div>
      </div>
    </div>

    <!-- Active Pillar Deep-Dive Detail Card -->
    <div
      v-if="activePillarId"
      class="rounded-3xl glass-panel p-6 sm:p-8 border border-white/15 bg-gradient-to-b from-midnight-900/95 to-midnight-950 relative z-10 shadow-2xl transition-all duration-500"
    >
      <div
        v-for="pillar in pillars"
        :key="`detail-${pillar.id}`"
        v-show="activePillarId === pillar.id"
        class="space-y-6"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center"
              :style="{
                backgroundColor: `${pillar.accentColor}20`,
                color: pillar.accentColor,
                border: `1px solid ${pillar.accentColor}50`
              }"
            >
              <Icons :name="pillar.icon" :size="24" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-400">TRỤ CỘT {{ pillar.number }}</span>
                <span class="text-xs font-mono text-talisman-gold">({{ pillar.subtitle }})</span>
              </div>
              <h4 class="text-xl sm:text-2xl font-display font-extrabold text-white">
                {{ pillar.title }}
              </h4>
            </div>
          </div>

          <span
            class="self-start sm:self-auto text-xs font-mono px-3 py-1 rounded-full border"
            :style="{
              borderColor: `${pillar.accentColor}40`,
              backgroundColor: `${pillar.accentColor}10`,
              color: pillar.accentColor
            }"
          >
            {{ pillar.badge }}
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Philosophy Dimension -->
          <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div class="flex items-center gap-2 text-xs font-mono text-slate-300 font-bold uppercase tracking-wider">
              <span class="text-base">💭</span>
              <span>Tư Duy Kiến Tạo & Chiêm Nghiệm</span>
            </div>
            <p class="text-sm text-slate-200 font-sans leading-relaxed pt-1">
              {{ pillar.philosophy }}
            </p>
          </div>

          <!-- Technical Practice Dimension -->
          <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div class="flex items-center gap-2 text-xs font-mono text-phantom-mint font-bold uppercase tracking-wider">
              <span class="text-base">⚙️</span>
              <span>Kỹ Nghệ & Thực Hành Kỹ Thuật</span>
            </div>
            <p class="text-sm text-slate-300 font-sans leading-relaxed pt-1">
              {{ pillar.technicalPractice }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
