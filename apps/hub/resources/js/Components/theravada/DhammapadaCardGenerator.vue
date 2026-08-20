<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { DHAMMAPADA_VERSES, DhammapadaVerse } from '@/data/dhammapadaCollection';
import { mindfulBell } from '@/audio/mindfulBellAudio';

export interface CardTheme {
  id: 'hoang-kim' | 'da-nguyet' | 'tram-huong' | 'bach-lien';
  name: string;
  badge: string;
  icon: string;
  bgDark: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  glowColor: string;
  borderColor: string;
  borderInner: string;
  titleColor: string;
  paliColor: string;
  viColor: string;
  accentColor: string;
  insightBg: string;
}

const CARD_THEMES: CardTheme[] = [
  {
    id: 'hoang-kim',
    name: 'Hoàng Kim Thiền Quang',
    badge: 'Vàng Kim',
    icon: '✨',
    bgDark: '#0c0a09',
    bgGradStart: '#1c1917',
    bgGradMid: '#0c0a09',
    bgGradEnd: '#050505',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#f59e0b',
    borderInner: '#fbbf24',
    titleColor: '#f59e0b',
    paliColor: '#fde68a',
    viColor: '#ffffff',
    accentColor: '#fbbf24',
    insightBg: 'rgba(41, 37, 36, 0.85)',
  },
  {
    id: 'da-nguyet',
    name: 'Dạ Nguyệt Ánh Trăng',
    badge: 'Lam Ngọc',
    icon: '🌙',
    bgDark: '#030712',
    bgGradStart: '#0f172a',
    bgGradMid: '#020617',
    bgGradEnd: '#000000',
    glowColor: 'rgba(96, 165, 250, 0.22)',
    borderColor: '#38bdf8',
    borderInner: '#7dd3fc',
    titleColor: '#38bdf8',
    paliColor: '#bae6fd',
    viColor: '#f8fafc',
    accentColor: '#67e8f9',
    insightBg: 'rgba(15, 23, 42, 0.85)',
  },
  {
    id: 'tram-huong',
    name: 'Trầm Hương Cổ Kính',
    badge: 'Nâu Trầm',
    icon: '🪵',
    bgDark: '#1c110a',
    bgGradStart: '#2d1b11',
    bgGradMid: '#1a0e08',
    bgGradEnd: '#0c0603',
    glowColor: 'rgba(217, 119, 6, 0.22)',
    borderColor: '#d97706',
    borderInner: '#f59e0b',
    titleColor: '#f59e0b',
    paliColor: '#fed7aa',
    viColor: '#fffbeb',
    accentColor: '#fb923c',
    insightBg: 'rgba(45, 27, 17, 0.85)',
  },
  {
    id: 'bach-lien',
    name: 'Bạch Liên Thanh Tịnh',
    badge: 'Ngọc Bích',
    icon: '🪷',
    bgDark: '#022c22',
    bgGradStart: '#064e3b',
    bgGradMid: '#022c22',
    bgGradEnd: '#021a14',
    glowColor: 'rgba(52, 211, 153, 0.22)',
    borderColor: '#34d399',
    borderInner: '#6ee7b7',
    titleColor: '#34d399',
    paliColor: '#a7f3d0',
    viColor: '#f0fdf4',
    accentColor: '#10b981',
    insightBg: 'rgba(6, 78, 59, 0.85)',
  },
];

const currentVerse = ref<DhammapadaVerse>(DHAMMAPADA_VERSES[0]);
const selectedTheme = ref<CardTheme>(CARD_THEMES[0]);
const aspectRatio = ref<'story' | 'square'>('story'); // 'story' (9:16) or 'square' (1:1)
const isDrawing = ref(false);
const isSharing = ref(false);
const copied = ref(false);
const showSocialModal = ref(false);

const drawRandomVerse = () => {
  mindfulBell.ringBell(432, 5.0);
  const randomIndex = Math.floor(Math.random() * DHAMMAPADA_VERSES.length);
  currentVerse.value = DHAMMAPADA_VERSES[randomIndex];
};

const selectTheme = (theme: CardTheme) => {
  selectedTheme.value = theme;
  mindfulBell.ringBell(528, 2.5);
};

const copyVerseText = async () => {
  const text = `☸️ KINH PHÁP CÚ (DHAMMAPADA) — KỆ SỐ ${currentVerse.value.verse_number}\n${currentVerse.value.chapter_vi} (${currentVerse.value.chapter_pali})\n\n📜 NGUYÊN VĂN PĀḶI:\n${currentVerse.value.pali}\n\n🌸 BẢN DỊCH VIỆT:\n${currentVerse.value.vietnamese}\n\n💡 TUỆ GIÁC CHIÊM NGHIỆM:\n${currentVerse.value.insight}\n\n— Ma Tọa Thiền (https://theravada.macatung.dev)`;
  
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 3000);
  } catch (err) {
    console.error('Clipboard copy error:', err);
  }
};

// Generate HTML5 Canvas for Exporting & Sharing
const generateCanvas = (): HTMLCanvasElement | null => {
  const width = 1080;
  const height = aspectRatio.value === 'story' ? 1440 : 1080;
  const theme = selectedTheme.value;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Deep Radial Background
  const bgGrad = ctx.createRadialGradient(width / 2, height * 0.4, 100, width / 2, height / 2, width * 0.85);
  bgGrad.addColorStop(0, theme.bgGradStart);
  bgGrad.addColorStop(0.55, theme.bgGradMid);
  bgGrad.addColorStop(1, theme.bgGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Center Glow
  const glowGrad = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height * 0.35, 480);
  glowGrad.addColorStop(0, theme.glowColor);
  glowGrad.addColorStop(0.7, 'rgba(0,0,0,0.02)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Ornate Double Border
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.strokeStyle = theme.borderInner;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(55, 55, width - 110, height - 110);
  ctx.setLineDash([]); // Reset line dash

  // 4. Corner Golden Ornaments
  const drawCorner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawCorner(40, 40, 0);
  drawCorner(width - 40, 40, Math.PI / 2);
  drawCorner(width - 40, height - 40, Math.PI);
  drawCorner(40, height - 40, -Math.PI / 2);

  // 5. Header Emblem & Title
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.titleColor;
  ctx.font = 'bold 36px serif';
  ctx.fillText('☸️   MA TỌA THIỀN   ☸️', width / 2, 120);

  ctx.fillStyle = '#d6d3d1';
  ctx.font = 'italic 23px serif';
  ctx.fillText('Thánh Điển Kinh Pháp Cú (Dhammapada)', width / 2, 160);

  // Divider with Golden Lotus
  ctx.strokeStyle = theme.borderColor + '66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 180, 195);
  ctx.lineTo(width / 2 - 30, 195);
  ctx.moveTo(width / 2 + 30, 195);
  ctx.lineTo(width / 2 + 180, 195);
  ctx.stroke();
  ctx.fillStyle = theme.accentColor;
  ctx.fillText('🌸', width / 2, 202);

  // 6. Verse Badge
  ctx.fillStyle = theme.insightBg;
  ctx.fillRect(width / 2 - 210, 230, 420, 48);
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(width / 2 - 210, 230, 420, 48);

  ctx.fillStyle = theme.accentColor;
  ctx.font = 'bold 22px serif';
  ctx.fillText(`KỆ SỐ ${currentVerse.value.verse_number} • ${currentVerse.value.chapter_vi.toUpperCase()}`, width / 2, 262);

  // 7. Pali Original Verse
  ctx.fillStyle = theme.paliColor;
  ctx.font = 'italic 24px "Lora", serif';
  const paliLines = currentVerse.value.pali.split('\n');
  let currentY = 340;
  paliLines.forEach(line => {
    ctx.fillText(`"${line}"`, width / 2, currentY);
    currentY += 34;
  });

  // Middle Lotus divider
  currentY += 20;
  ctx.strokeStyle = theme.borderColor + '44';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, currentY);
  ctx.lineTo(width / 2 + 120, currentY);
  ctx.stroke();

  // 8. Vietnamese Translation Verse (Large, Clear & Pure)
  currentY += 50;
  ctx.fillStyle = theme.viColor;
  ctx.font = 'bold 30px "Lora", serif';
  const viLines = currentVerse.value.vietnamese.split('\n');
  viLines.forEach(line => {
    ctx.fillText(line, width / 2, currentY);
    currentY += 46;
  });

  // 9. Insight Note Box
  currentY += 40;
  ctx.fillStyle = theme.insightBg;
  ctx.fillRect(100, currentY, width - 200, 100);
  ctx.strokeStyle = theme.borderColor + '66';
  ctx.strokeRect(100, currentY, width - 200, 100);

  ctx.fillStyle = theme.accentColor;
  ctx.font = 'bold 20px serif';
  ctx.fillText('💡 TUỆ GIÁC CHIÊM NGHIỆM', width / 2, currentY + 36);

  ctx.fillStyle = '#e7e5e4';
  ctx.font = 'italic 20px serif';
  ctx.fillText(currentVerse.value.insight, width / 2, currentY + 72);

  // 10. Footer Watermark
  ctx.fillStyle = '#a8a29e';
  ctx.font = '18px serif';
  ctx.fillText('Gieo Duyên Lành • Chia Sẻ Chánh Pháp • theravada.macatung.dev', width / 2, height - 75);

  return canvas;
};

// Download HD PNG
const downloadCardImage = () => {
  isDrawing.value = true;
  const canvas = generateCanvas();
  if (!canvas) {
    isDrawing.value = false;
    return;
  }

  setTimeout(() => {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Phap-Cu-Ke-${currentVerse.value.verse_number}-${selectedTheme.value.id}.png`;
    link.href = dataUrl;
    link.click();
    isDrawing.value = false;
  }, 150);
};

// 1-Click Multi-Platform Web Share API
const handleNativeShare = async () => {
  const canvas = generateCanvas();
  if (!canvas) return;

  isSharing.value = true;
  const shareTitle = `Kinh Pháp Cú — Kệ số ${currentVerse.value.verse_number} | Ma Tọa Thiền`;
  const shareText = `☸️ Lời Phật Dạy:\n"${currentVerse.value.vietnamese}"\n\nTuệ giác: ${currentVerse.value.insight}\nKhám phá thêm tại:`;
  const shareUrl = 'https://theravada.macatung.dev/ung-dung-tu-hoc';

  try {
    // Check if Web Share API with File sharing is supported (Mobile Browsers)
    if (navigator.canShare && canvas.toBlob) {
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `Phap-Cu-Ke-${currentVerse.value.verse_number}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl,
              files: [file],
            });
            isSharing.value = false;
            return;
          }
        }

        // Fallback to text & URL share
        if (navigator.share) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
          });
        } else {
          showSocialModal.value = true;
        }
        isSharing.value = false;
      }, 'image/png');
    } else if (navigator.share) {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      isSharing.value = false;
    } else {
      showSocialModal.value = true;
      isSharing.value = false;
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Share error:', err);
      showSocialModal.value = true;
    }
    isSharing.value = false;
  }
};

// Social Share Link Openers
const shareToFacebook = () => {
  const url = encodeURIComponent('https://theravada.macatung.dev/ung-dung-tu-hoc');
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
};

const shareToTelegram = () => {
  const url = encodeURIComponent('https://theravada.macatung.dev/ung-dung-tu-hoc');
  const text = encodeURIComponent(`☸️ KINH PHÁP CÚ — KỆ SỐ ${currentVerse.value.verse_number}\n\n${currentVerse.value.vietnamese}\n\n💡 ${currentVerse.value.insight}`);
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
};

const shareToX = () => {
  const url = encodeURIComponent('https://theravada.macatung.dev/ung-dung-tu-hoc');
  const text = encodeURIComponent(`☸️ Lời Phật Dạy (Pháp Cú ${currentVerse.value.verse_number}):\n"${currentVerse.value.vietnamese}"\n\n#Dhammapada #Theravada`);
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
};

const shareToZalo = () => {
  const url = encodeURIComponent('https://theravada.macatung.dev/ung-dung-tu-hoc');
  window.open(`https://sp.zalo.me/plugins/share?url=${url}`, '_blank', 'width=600,height=400');
};
</script>

<template>
  <div class="w-full max-w-4xl mx-auto p-4 sm:p-8 rounded-3xl bg-gradient-to-br from-stone-900/95 via-stone-950/90 to-stone-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl font-serif text-stone-100 relative overflow-hidden">
    <!-- Ambient Center Warm Aura Dynamically Tinted by Selected Theme -->
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none transition-all duration-700 opacity-30"
      :style="{ backgroundColor: selectedTheme.borderColor }"
    />

    <div class="relative z-10 space-y-5 sm:space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-amber-500/20 pb-4 sm:pb-5 text-left">
        <div>
          <div class="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold mb-2">
            <span>🌸</span>
            <span>ỨNG DỤNG PHÁP BẢO • LAN TỎA CHÁNH PHÁP</span>
          </div>
          <h3 class="text-lg sm:text-2xl font-bold text-amber-100 tracking-tight">
            Trợ Niệm Pháp Cú & Xuất Thẻ Ảnh Chia Sẻ HD
          </h3>
          <p class="text-xs sm:text-sm text-stone-400 mt-1">
            Gieo duyên rút ngẫu nhiên lời dạy vàng ngọc của Đức Phật, chọn phong cách thiền môn và chia sẻ lan tỏa Chánh Pháp.
          </p>
        </div>

        <!-- Action: Random Draw Button -->
        <button
          @click="drawRandomVerse"
          class="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-bold text-xs sm:text-sm shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap min-h-[44px]"
        >
          <span>🎲</span>
          <span>Rút Quẻ Kệ Mới</span>
        </button>
      </div>

      <!-- 🎨 4 Zen Theme Selector Strip -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-stone-950/80 border border-stone-800 text-left">
        <span class="text-xs font-serif text-stone-400 flex items-center gap-1.5 shrink-0">
          <span>🎨</span>
          <span>Chủ đề Thiền Môn:</span>
        </span>

        <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            v-for="th in CARD_THEMES"
            :key="th.id"
            @click="selectTheme(th)"
            :class="[
              'flex items-center justify-center sm:justify-start gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-serif transition-all cursor-pointer border min-h-[38px]',
              selectedTheme.id === th.id
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold shadow-md ring-1 ring-amber-400/50'
                : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:text-white hover:border-stone-700'
            ]"
          >
            <span>{{ th.icon }}</span>
            <span class="truncate">{{ th.name }}</span>
          </button>
        </div>
      </div>

      <!-- Main Live Card Preview Stage (Dynamic Theme Styled) -->
      <div
        class="relative mx-auto rounded-3xl border-2 p-4 sm:p-8 shadow-2xl transition-all duration-500 flex flex-col justify-between text-center overflow-hidden w-full max-w-sm sm:max-w-md"
        :class="aspectRatio === 'story' ? 'aspect-[9/12]' : 'aspect-square'"
        :style="{
          backgroundColor: selectedTheme.bgDark,
          borderColor: selectedTheme.borderColor,
          boxShadow: `0 20px 50px -10px ${selectedTheme.glowColor}`
        }"
      >
        <!-- Ambient Inner Glow -->
        <div
          class="absolute inset-0 pointer-events-none opacity-40 blur-xl"
          :style="{ background: `radial-gradient(circle at 50% 30%, ${selectedTheme.glowColor}, transparent 70%)` }"
        />

        <!-- Card Frame Corner Symbols -->
        <div class="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 text-[10px] sm:text-xs select-none" :style="{ color: selectedTheme.borderColor }">☸️</div>
        <div class="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 text-[10px] sm:text-xs select-none" :style="{ color: selectedTheme.borderColor }">☸️</div>
        <div class="absolute bottom-3 left-3 sm:bottom-3.5 sm:left-3.5 text-[10px] sm:text-xs select-none" :style="{ color: selectedTheme.borderColor }">🌸</div>
        <div class="absolute bottom-3 right-3 sm:bottom-3.5 sm:right-3.5 text-[10px] sm:text-xs select-none" :style="{ color: selectedTheme.borderColor }">🌸</div>

        <!-- Top Card Seal -->
        <div class="relative z-10 px-2">
          <span
            class="text-[10px] sm:text-[11px] font-serif uppercase tracking-wider sm:tracking-widest font-bold block mb-0.5 sm:mb-1"
            :style="{ color: selectedTheme.titleColor }"
          >
            KINH PHÁP CÚ — KỆ SỐ {{ currentVerse.verse_number }}
          </span>
          <span class="text-[11px] sm:text-xs text-stone-400 italic block">
            {{ currentVerse.chapter_vi }} ({{ currentVerse.chapter_pali }})
          </span>
          <div class="my-2 sm:my-3 flex items-center justify-center gap-2 text-xs opacity-60" :style="{ color: selectedTheme.borderColor }">
            <span class="h-px w-8 sm:w-12 bg-current"></span>
            <span>🌸</span>
            <span class="h-px w-8 sm:w-12 bg-current"></span>
          </div>
        </div>

        <!-- Middle: Pali & Vietnamese Verses -->
        <div class="my-auto space-y-2.5 sm:space-y-4 relative z-10 px-2">
          <!-- Pali Original -->
          <p
            class="text-[11px] sm:text-xs md:text-sm font-serif italic leading-relaxed whitespace-pre-line"
            :style="{ color: selectedTheme.paliColor }"
          >
            "{{ currentVerse.pali }}"
          </p>

          <div class="h-px w-14 sm:w-20 mx-auto opacity-30" :style="{ backgroundColor: selectedTheme.borderColor }"></div>

          <!-- Vietnamese Translation -->
          <p
            class="text-xs sm:text-base md:text-lg font-serif font-bold leading-relaxed whitespace-pre-line"
            :style="{ color: selectedTheme.viColor }"
          >
            {{ currentVerse.vietnamese }}
          </p>
        </div>

        <!-- Bottom: Insight Note & Watermark -->
        <div class="pt-2 sm:pt-3 border-t border-stone-800/80 relative z-10 px-1">
          <p
            class="text-[10px] sm:text-[11px] font-serif italic mb-1.5 sm:mb-2 line-clamp-2 sm:line-clamp-none"
            :style="{ color: selectedTheme.accentColor }"
          >
            💡 {{ currentVerse.insight }}
          </p>
          <span class="text-[9px] sm:text-[10px] text-stone-400 font-sans tracking-wide block">
            Ma Tọa Thiền • theravada.macatung.dev
          </span>
        </div>
      </div>

      <!-- Controls, Aspect Ratio & Social Sharing Bar -->
      <div class="space-y-4 pt-4 sm:pt-5 border-t border-stone-800/90 text-left">
        <!-- Row 1: Aspect Ratio & Main Action Buttons -->
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          <!-- Aspect Ratio Segmented Control -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
            <span class="text-xs font-serif text-stone-400 shrink-0 font-medium">Tỷ lệ ảnh:</span>
            <div class="flex items-center p-1 bg-stone-950/90 rounded-2xl border border-stone-800 shadow-inner w-full sm:w-auto">
              <button
                @click="aspectRatio = 'story'"
                :class="[
                  'flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]',
                  aspectRatio === 'story'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                ]"
              >
                <span>📱</span>
                <span>Dọc 9:16</span>
              </button>
              <button
                @click="aspectRatio = 'square'"
                :class="[
                  'flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]',
                  aspectRatio === 'square'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                ]"
              >
                <span>🖼️</span>
                <span>Vuông 1:1</span>
              </button>
            </div>
          </div>

          <!-- Primary Action Buttons Group -->
          <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <!-- Copy Verse Text -->
            <button
              @click="copyVerseText"
              class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-amber-500/40 text-stone-200 text-xs sm:text-sm font-serif font-bold transition-all hover:text-amber-300 cursor-pointer shadow-md active:scale-95 min-h-[42px]"
            >
              <span>{{ copied ? '✅' : '📋' }}</span>
              <span>{{ copied ? 'Đã Sao Chép!' : 'Sao Chép Kệ' }}</span>
            </button>

            <!-- 1-Click Multi-Platform Web Share Button -->
            <button
              @click="handleNativeShare"
              :disabled="isSharing"
              class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-stone-900 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 hover:bg-stone-850 text-xs sm:text-sm font-serif font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              <span>{{ isSharing ? 'Đang Xử Lý...' : 'Chia Sẻ Thẻ' }}</span>
            </button>

            <!-- Download HD PNG Card (Primary CTA) -->
            <button
              @click="downloadCardImage"
              :disabled="isDrawing"
              class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs sm:text-sm font-serif font-bold shadow-xl transition-all hover:scale-[1.03] active:scale-95 cursor-pointer disabled:opacity-50 ring-1 ring-amber-300/40 min-h-[44px]"
            >
              <span>📥</span>
              <span>{{ isDrawing ? 'Đang Tạo Ảnh...' : 'Tải Ảnh Thẻ HD' }}</span>
            </button>
          </div>
        </div>

        <!-- Row 2: Dedicated Social Share Strip with Brand Badges & Crisp Contrast -->
        <div class="p-3 sm:p-3.5 rounded-2xl bg-stone-950/85 border border-stone-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
          <div class="flex items-center gap-2 text-xs font-serif text-amber-300/90 font-medium">
            <span class="text-amber-400">✨</span>
            <span>Lan tỏa Pháp Bảo đến người thân & bạn bè:</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Facebook Button -->
            <button
              @click="shareToFacebook"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1877F2]/15 hover:bg-[#1877F2] text-[#4ea1ff] hover:text-white border border-[#1877F2]/40 transition-all font-sans text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Chia sẻ lên Facebook"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>

            <!-- Zalo Button -->
            <button
              @click="shareToZalo"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0068FF]/15 hover:bg-[#0068FF] text-[#5295ff] hover:text-white border border-[#0068FF]/40 transition-all font-sans text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Chia sẻ qua Zalo"
            >
              <span class="font-bold font-sans text-[11px] px-1 py-0.2 bg-blue-500/30 rounded text-white">Z</span>
              <span>Zalo</span>
            </button>

            <!-- Telegram Button -->
            <button
              @click="shareToTelegram"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24A1DE]/15 hover:bg-[#24A1DE] text-[#55c0f5] hover:text-white border border-[#24A1DE]/40 transition-all font-sans text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Gửi qua Telegram"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>Telegram</span>
            </button>

            <!-- X (Twitter) Button -->
            <button
              @click="shareToX"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-700 transition-all font-sans text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Đăng lên X (Twitter)"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>X (Twitter)</span>
            </button>

            <!-- Copy Direct Link Button -->
            <button
              @click="copyVerseText"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300/90 hover:text-amber-200 border border-amber-500/30 transition-all font-sans text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Sao chép toàn văn lời kệ"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
              <span>{{ copied ? 'Đã chép' : 'Sao chép' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
