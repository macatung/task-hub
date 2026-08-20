<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mindfulBell } from '@/audio/mindfulBellAudio';
import Icons from '@/Components/ui/Icons.vue';

const emit = defineEmits<{
  (e: 'switch-to-timer'): void;
}>();

interface Aggregate {
  id: string;
  number: string;
  paliName: string;
  vietnameseName: string;
  icon: string;
  nature: string;
  paliScripture: string;
  viScripture: string;
  contemplationPrompt: string;
  dissolutionRefrain: string;
  accentHex: string;
  glowColor: string;
}

const aggregates: Aggregate[] = [
  {
    id: 'rupa',
    number: '01',
    paliName: 'Rūpakkhandha',
    vietnameseName: 'Sắc Uẩn (Thân Tứ Đại & Vật Chất)',
    icon: '🪷',
    nature: 'Thân xác, hơi thở và bốn đại chủng (Đất, Nước, Gió, Lửa)',
    paliScripture: 'Rūpaṃ, bhikkhave, anattā. Yañca kho rūpaṃ anattā, taṃ: "N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"ti evametaṃ yathābhūtaṃ sammappaññāya daṭṭhabbaṃ.',
    viScripture: 'Này các Tỳ-kheo, Sắc là vô ngã. Cái gì là vô ngã, cái ấy cần phải được như thật quán sát với chánh trí tuệ: "Cái này không phải của tôi, cái này không phải là tôi, cái này không phải tự ngã của tôi."',
    contemplationPrompt: 'Hãy quan sát thân thể này: Hơi thở vào ra từng giây, tim đập không ngừng, tế bào sinh diệt không ngừng. Thân này già yếu, bệnh tật và biến hoại theo thời gian mà ý chí không thể cưỡng cầu.',
    dissolutionRefrain: 'Sắc uẩn biến hoại vô thường — Thân này KHÔNG PHẢI LÀ TA.',
    accentHex: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.3)'
  },
  {
    id: 'vedana',
    number: '02',
    paliName: 'Vedanākkhandha',
    vietnameseName: 'Thọ Uẩn (Cảm Thọ Vui, Buồn, Xả)',
    icon: '🌊',
    nature: 'Cảm giác lạc thọ, khổ thọ và bất khổ bất lạc thọ',
    paliScripture: 'Vedanā anattā. Yāpi vedanā anattā, taṃ: "N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"ti evametaṃ yathābhūtaṃ sammappaññāya daṭṭhabbaṃ.',
    viScripture: 'Cảm thọ là vô ngã. Cái gì là vô ngã, cái ấy cần phải được quán sát: "Cái này không phải của tôi, cái này không phải là tôi, cái này không phải tự ngã của tôi."',
    contemplationPrompt: 'Hãy nhận diện các cảm giác: Niềm vui thoảng qua, nỗi đau nhói lên, sự bình lặng lướt tới. Chúng khởi lên khi có căn trần tiếp xúc, rồi tự tan biến như bọt nước trên mặt sông.',
    dissolutionRefrain: 'Cảm thọ trôi lăn sinh diệt — Cảm giác này KHÔNG PHẢI LÀ TA.',
    accentHex: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.3)'
  },
  {
    id: 'sanna',
    number: '03',
    paliName: 'Saññākkhandha',
    vietnameseName: 'Tưởng Uẩn (Tri Giác & Dán Nhãn)',
    icon: '💭',
    nature: 'Sự nhận thức, ghi nhớ hình ảnh, phân biệt đẹp xấu, đúng sai',
    paliScripture: 'Saññā anattā. Yāpi saññā anattā, taṃ: "N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"ti evametaṃ yathābhūtaṃ sammappaññāya daṭṭhabbaṃ.',
    viScripture: 'Tri giác là vô ngã. Cái gì là vô ngã, cái ấy cần phải được quán sát: "Cái này không phải của tôi, cái này không phải là tôi, cái này không phải tự ngã của tôi."',
    contemplationPrompt: 'Hãy quan sát tâm trí dán nhãn mọi thứ: Ký ức quá khứ ùa về, tưởng tượng tương lai dấy khởi. Tưởng uẩn chỉ là sự ghi nhận ước lệ do thói quen huân tập, như ảo ảnh giữa trưa hè.',
    dissolutionRefrain: 'Tri giác chỉ là ảo ảnh dán nhãn — Tưởng uẩn KHÔNG PHẢI LÀ TA.',
    accentHex: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.3)'
  },
  {
    id: 'sankhara',
    number: '04',
    paliName: 'Saṅkhārakkhandha',
    vietnameseName: 'Hành Uẩn (Tâm Hành & Ý Muốn)',
    icon: '⚡',
    nature: 'Các ý định, mong cầu, sân giận, tham ái, lo âu và ý chí tác tạo nghiệp',
    paliScripture: 'Saṅkhārā anattā. Yepi saṅkhārā anattā, taṃ: "N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"ti evametaṃ yathābhūtaṃ sammappaññāya daṭṭhabbaṃ.',
    viScripture: 'Các hành là vô ngã. Cái gì là vô ngã, cái ấy cần phải được quán sát: "Cái này không phải của tôi, cái này không phải là tôi, cái này không phải tự ngã của tôi."',
    contemplationPrompt: 'Hãy nhận diện dòng suy nghĩ: Cơn giận muốn phản kháng, lòng tham muốn sở hữu, sự bồn chồn muốn hành động. Tất cả đều do các duyên tụ hợp mà thành, không có người chủ mưu độc lập.',
    dissolutionRefrain: 'Tâm hành do duyên khởi diệt — Suy nghĩ này KHÔNG PHẢI LÀ TA.',
    accentHex: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.3)'
  },
  {
    id: 'vinnana',
    number: '05',
    paliName: 'Viññāṇakkhandha',
    vietnameseName: 'Thức Uẩn (Cái Biết Phân Biệt)',
    icon: '👁️',
    nature: 'Cái biết qua 6 giác quan (Nhãn, Nhĩ, Tỷ, Thiệt, Thân, Ý thức)',
    paliScripture: 'Viññāṇaṃ anattā. Yampi viññāṇaṃ anattā, taṃ: "N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"ti evametaṃ yathābhūtaṃ sammappaññāya daṭṭhabbaṃ.',
    viScripture: 'Thức là vô ngã. Cái gì là vô ngã, cái ấy cần phải được quán sát: "Cái này không phải của tôi, cái này không phải là tôi, cái này không phải tự ngã của tôi."',
    contemplationPrompt: 'Hãy quán sát cái biết rõ ràng lúc này: Mắt thấy cảnh, tai nghe tiếng chuông, ý nhận biết pháp. Thức khởi lên do căn tiếp trần rồi biến mất, không có một "Linh hồn bất biến" nào ẩn giấu.',
    dissolutionRefrain: 'Cái biết nương duyên sinh diệt — Thức uẩn KHÔNG PHẢI LÀ TA.',
    accentHex: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.3)'
  }
];

// Current State: 0..4 (Aggregates), 5 (Realization / Suññatā Void State)
const currentStep = ref<number>(0);
const isCompleted = computed(() => currentStep.value >= aggregates.length);
const currentAggregate = computed(() => aggregates[Math.min(currentStep.value, aggregates.length - 1)]);

// Dissolution Particle Canvas
const particleCanvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

let particles: Particle[] = [];

const initCanvas = () => {
  if (!particleCanvas.value) return;
  const canvas = particleCanvas.value;
  canvas.width = canvas.parentElement?.clientWidth || 600;
  canvas.height = canvas.parentElement?.clientHeight || 400;

  particles = [];
  const count = isCompleted.value ? 70 : 45;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -Math.random() * 0.6 - 0.2,
      radius: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      color: isCompleted.value ? '#fbbf24' : currentAggregate.value.accentHex
    });
  }
};

const renderParticles = () => {
  if (!particleCanvas.value) return;
  const canvas = particleCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.0015;

    if (p.alpha <= 0 || p.y < 0 || p.x < 0 || p.x > canvas.width) {
      p.x = Math.random() * canvas.width;
      p.y = canvas.height + 10;
      p.alpha = Math.random() * 0.6 + 0.2;
      p.color = isCompleted.value ? '#fbbf24' : currentAggregate.value.accentHex;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fill();
  });

  animationFrameId = requestAnimationFrame(renderParticles);
};

// Navigation & Actions
const nextStep = () => {
  if (currentStep.value < aggregates.length) {
    currentStep.value++;
    if (currentStep.value === aggregates.length) {
      // Completed all 5 aggregates -> Ring 3 harmonious bells
      mindfulBell.ringBell(528, 8.0);
    } else {
      const frequencies = [384, 432, 480, 512, 528];
      mindfulBell.ringBell(frequencies[currentStep.value] || 432, 6.0);
    }
    initCanvas();
  }
};

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
    mindfulBell.ringBell(432, 5.0);
    initCanvas();
  }
};

const jumpToStep = (index: number) => {
  currentStep.value = index;
  mindfulBell.ringBell(432, 5.0);
  initCanvas();
};

const resetContemplation = () => {
  currentStep.value = 0;
  mindfulBell.ringBell(384, 6.0);
  initCanvas();
};

// Canvas Card Exporter for the Realization State
const isGeneratingCard = ref(false);
const exportCardCanvas = () => {
  isGeneratingCard.value = true;
  mindfulBell.ringBell(528, 5.0);

  setTimeout(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const bgGrad = ctx.createRadialGradient(540, 540, 50, 540, 540, 700);
    bgGrad.addColorStop(0, '#1c1917');
    bgGrad.addColorStop(0.6, '#0c0a09');
    bgGrad.addColorStop(1, '#050505');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Golden Borders
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 1000, 1000);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(52, 52, 976, 976);

    // Corner Ornaments
    ctx.fillStyle = '#f59e0b';
    ctx.font = '24px serif';
    ctx.fillText('☸️', 64, 84);
    ctx.fillText('☸️', 990, 84);
    ctx.fillText('☸️', 64, 1010);
    ctx.fillText('☸️', 990, 1010);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 32px serif';
    ctx.fillText('TAM TẠNG THÁNH ĐIỂN THERAVĀDA', 540, 140);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'italic 26px serif';
    ctx.fillText('Kinh Vô Ngã Tướng (Anattalakkhaṇa Sutta — SN 22.59)', 540, 185);

    // Central Wheel Inscription
    ctx.font = '64px serif';
    ctx.fillText('☸️', 540, 290);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 38px serif';
    ctx.fillText('NGŨ UẨN GIAI KHÔNG', 540, 360);

    // Pāḷi Verse
    ctx.fillStyle = '#fde68a';
    ctx.font = 'italic bold 32px serif';
    ctx.fillText('"N\'etaṃ mama, n\'eso\'hamasmi, na meso attā"', 540, 450);

    // Vietnamese Meaning Lines
    ctx.fillStyle = '#ffffff';
    ctx.font = '30px serif';
    ctx.fillText('Cái này không phải của tôi,', 540, 540);
    ctx.fillText('Cái này không phải là tôi,', 540, 590);
    ctx.fillText('Cái này không phải tự ngã của tôi.', 540, 640);

    // 5 Aggregates Summary Box
    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    ctx.fillRect(140, 710, 800, 160);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.strokeRect(140, 710, 800, 160);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 22px serif';
    ctx.fillText('NĂM UẨN PHÂN LY — TỰ TÁNH TỊCH TỊNH', 540, 755);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px sans-serif';
    ctx.fillText('Sắc • Thọ • Tưởng • Hành • Thức đều do duyên sinh diệt.', 540, 800);
    ctx.fillText('Không có một "Cái Ta thường hằng" làm chủ tể.', 540, 835);

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px monospace';
    ctx.fillText('theravada.macatung.dev • Chánh Niệm Từng Giây', 540, 960);

    // Download PNG
    const link = document.createElement('a');
    link.download = 'the-tue-giac-vo-nga-anatta.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    isGeneratingCard.value = false;
  }, 400);
};

onMounted(() => {
  initCanvas();
  renderParticles();
  window.addEventListener('resize', initCanvas);
});

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', initCanvas);
});
</script>

<template>
  <div class="w-full max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-stone-900/95 via-stone-950 to-stone-950 border border-amber-500/40 p-5 sm:p-8 shadow-2xl relative overflow-hidden text-left font-serif backdrop-blur-xl">
    <!-- Particle Dissolution Canvas Layer -->
    <canvas
      ref="particleCanvas"
      class="absolute inset-0 pointer-events-none z-0 opacity-60"
    />

    <!-- Ambient Center Glow -->
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[130px] pointer-events-none opacity-20 transition-all duration-700"
      :style="{ backgroundColor: isCompleted ? '#f59e0b' : currentAggregate.accentHex }"
    />

    <div class="relative z-10 space-y-6">
      <!-- 1. Header Bar with Stepper Indicators -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-1.5">
            <span>☸️</span>
            <span>PHÁP HÀNH QUÁN CHIẾU VÔ NGÃ (ANATTĀ CONTEMPLATION)</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-amber-100">
            {{ isCompleted ? '✨ Thể Nhập Tự Tánh Vô Ngã (Suññatā)' : `Tầng ${currentAggregate.number}: ${currentAggregate.vietnameseName}` }}
          </h2>
        </div>

        <!-- 5-Aggregate Progress Indicators -->
        <div class="flex items-center gap-1.5">
          <button
            v-for="(agg, idx) in aggregates"
            :key="agg.id"
            type="button"
            @click="jumpToStep(idx)"
            class="px-2.5 py-1 rounded-xl text-xs font-sans font-bold transition-all cursor-pointer border flex items-center gap-1"
            :class="currentStep === idx
              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md scale-105'
              : currentStep > idx
                ? 'bg-stone-800/80 text-amber-400 border-amber-500/30'
                : 'bg-stone-900/60 text-stone-500 border-stone-800 hover:border-stone-700'"
            :title="agg.vietnameseName"
          >
            <span>{{ agg.icon }}</span>
            <span class="hidden sm:inline">{{ agg.number }}</span>
          </button>
          
          <button
            type="button"
            @click="jumpToStep(5)"
            class="px-2.5 py-1 rounded-xl text-xs font-sans font-bold transition-all cursor-pointer border flex items-center gap-1"
            :class="isCompleted
              ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-glow-talisman scale-105'
              : 'bg-stone-900/60 text-stone-500 border-stone-800 hover:border-stone-700'"
            title="Đúc Kết Vô Ngã"
          >
            <span>☸️</span>
            <span class="hidden sm:inline">Vô Ngã</span>
          </button>
        </div>
      </div>

      <!-- 2. Main Contemplation Stage -->
      
      <!-- GIAI ĐOẠN 1-5: QUÁN TỪNG UẨN -->
      <div v-if="!isCompleted" class="space-y-6">
        <!-- Aggregate Core Concept Banner -->
        <div class="p-4 sm:p-5 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner"
            :style="{
              backgroundColor: `${currentAggregate.accentHex}20`,
              border: `1px solid ${currentAggregate.accentHex}40`
            }"
          >
            {{ currentAggregate.icon }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                Pāḷi: {{ currentAggregate.paliName }}
              </span>
            </div>
            <p class="text-sm sm:text-base text-stone-200 mt-1 leading-relaxed">
              {{ currentAggregate.nature }}
            </p>
          </div>
        </div>

        <!-- Mindful Meditation Guidance (Lời Dẫn Thiền) -->
        <div class="p-5 sm:p-6 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <span>🧘</span>
            <span>Chỉ Dẫn Quán Chiếu Trực Nghiệm</span>
          </div>
          <p class="text-sm sm:text-base text-stone-100 leading-relaxed font-sans">
            {{ currentAggregate.contemplationPrompt }}
          </p>
        </div>

        <!-- Scripture Quote from Anattalakkhana Sutta -->
        <div class="p-5 rounded-2xl bg-stone-950/70 border border-stone-800 space-y-2">
          <div class="text-[11px] font-sans font-bold text-stone-400 uppercase tracking-wider">
            📜 Trích Lời Phật Dạy (Kinh Vô Ngã Tướng — Anattalakkhaṇa Sutta):
          </div>
          <p class="text-xs sm:text-sm text-amber-200/90 italic pl-3 border-l-2 border-amber-500/50 leading-relaxed">
            "{{ currentAggregate.paliScripture }}"
          </p>
          <p class="text-xs sm:text-sm text-stone-300 font-semibold leading-relaxed pt-1">
            "{{ currentAggregate.viScripture }}"
          </p>
        </div>

        <!-- Dissolution Refrain / Declaration Pill -->
        <div
          class="p-4 rounded-2xl border text-center font-bold text-sm sm:text-base transition-all"
          :style="{
            backgroundColor: `${currentAggregate.accentHex}15`,
            borderColor: `${currentAggregate.accentHex}40`,
            color: currentAggregate.accentHex
          }"
        >
          ✨ {{ currentAggregate.dissolutionRefrain }}
        </div>

        <!-- Step Navigation Controls -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            v-if="currentStep > 0"
            @click="prevStep"
            class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white font-sans text-xs font-bold transition-all border border-stone-800 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <span>←</span>
            <span>Uẩn Trước Đó</span>
          </button>
          <div v-else />

          <button
            type="button"
            @click="nextStep"
            class="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg hover:scale-105 active:scale-95 min-h-[44px]"
            :style="{
              backgroundColor: currentAggregate.accentHex,
              color: '#0c0a09',
              boxShadow: `0 8px 24px -4px ${currentAggregate.glowColor}`
            }"
          >
            <span>{{ currentStep === 4 ? 'Thể Nhập Trạng Thái Vô Ngã' : 'Quán Chiếu & Buông Xả Uẩn Này' }}</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      <!-- GIAI ĐOẠN 6: ĐÚC KẾT VÔ NGÃ (SUÑÑATĀ VOID REALIZATION) -->
      <div v-else class="space-y-6 text-center py-4">
        <!-- Wheel Aura -->
        <div class="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-glow-talisman animate-bounce">
          ☸️
        </div>

        <div class="space-y-2 max-w-2xl mx-auto">
          <h3 class="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
            Năm Uẩn Giai Không — Tự Tánh Tịch Tịnh
          </h3>
          <p class="text-xs sm:text-sm text-stone-300 font-sans leading-relaxed">
            Khi Sắc, Thọ, Tưởng, Hành, Thức được quán chiếu rõ ràng là vô thường và biến hoại, tâm không còn bám víu vào bất kỳ uẩn nào làm "Ta" hay "Của Ta".
          </p>
        </div>

        <!-- Pāḷi Supreme Refrain Card -->
        <div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-950/40 via-stone-900/90 to-stone-950 border border-amber-500/40 shadow-2xl relative overflow-hidden">
          <div class="absolute -right-8 -bottom-8 text-9xl text-amber-500/5 select-none pointer-events-none">
            ☸️
          </div>
          
          <div class="relative z-10 space-y-4">
            <p class="text-base sm:text-xl font-bold text-amber-200 italic">
              "N'etaṃ mama, n'eso'hamasmi, na meso attā"
            </p>
            <div class="space-y-1 text-sm sm:text-base text-stone-100 font-medium">
              <p>• Cái này không phải của tôi</p>
              <p>• Cái này không phải là tôi</p>
              <p>• Cái này không phải tự ngã của tôi</p>
            </div>
            <p class="text-xs text-amber-400/90 italic pt-2 border-t border-amber-500/20">
              — Kinh Vô Ngã Tướng (Anattalakkhaṇa Sutta, Saṃyutta Nikāya)
            </p>
          </div>
        </div>

        <!-- 3 Action CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <!-- Download Insight Card Button -->
          <button
            type="button"
            @click="exportCardCanvas"
            :disabled="isGeneratingCard"
            class="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 text-stone-950 font-bold text-xs sm:text-sm transition-all hover:bg-amber-400 shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>📜</span>
            <span>{{ isGeneratingCard ? 'Đang xuất thẻ...' : 'Tải Thẻ Tuệ Giác Vô Ngã' }}</span>
          </button>

          <!-- Transition to Vipassana Timer Button -->
          <button
            type="button"
            @click="emit('switch-to-timer')"
            class="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-stone-900 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm transition-all hover:bg-stone-800 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>🧘</span>
            <span>Tọa Thiền Vipassanā Ngay</span>
          </button>

          <!-- Reset / Repeat Contemplation -->
          <button
            type="button"
            @click="resetContemplation"
            class="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-400 hover:text-white font-sans text-xs font-bold transition-all hover:bg-stone-900 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>↺</span>
            <span>Quán Chiếu Lại Từ Đầu</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
