import { ref, computed, onMounted, onUnmounted } from 'vue';

export interface ZenPhaseInfo {
  id: 'midnight' | 'dawn' | 'afternoon' | 'twilight';
  paliName: string;
  vietnameseName: string;
  timeRange: string;
  icon: string;
  accentHex: string;
  accentGlow: string;
  bgGradient: string;
  mascotQuote: string;
  practiceTitle: string;
  practiceDesc: string;
}

export const ZEN_PHASES: Record<string, ZenPhaseInfo> = {
  midnight: {
    id: 'midnight',
    paliName: 'Rātribhāga (Dạ Khuya)',
    vietnameseName: 'Thời Canh Khuya • Tọa Thiền Tịch Mịch',
    timeRange: '00:00 – 05:59',
    icon: '🌌',
    accentHex: '#f59e0b',
    accentGlow: 'rgba(245, 158, 11, 0.25)',
    bgGradient: 'from-stone-950 via-amber-950/20 to-stone-950',
    mascotQuote: 'Canh khuya vắng lặng, buông bỏ muôn duyên để an trú vào hơi thở trong chánh định.',
    practiceTitle: 'Thiền Tứ Niệm Xứ & Quán Thân Nơi Thân',
    practiceDesc: 'Thời khắc thanh tịnh nhất để lắng nghe tiếng thở và thấu triệt bản chất Vô Thường của vạn pháp.'
  },
  dawn: {
    id: 'dawn',
    paliName: 'Pubbaṇhasamaya (Bình Minh)',
    vietnameseName: 'Thời Bình Minh • Tảo Khởi & Rải Tâm Từ',
    timeRange: '06:00 – 11:59',
    icon: '🌅',
    accentHex: '#fbbf24',
    accentGlow: 'rgba(251, 191, 36, 0.3)',
    bgGradient: 'from-amber-950/30 via-stone-900/90 to-stone-950',
    mascotQuote: 'Bình minh rạng ngời, hãy khởi đầu ngày mới bằng tâm từ Mettā vô lượng đến muôn loài chúng sinh.',
    practiceTitle: 'Tụng Kinh Từ Bi & Chánh Niệm Tỉnh Giác',
    practiceDesc: 'Khởi sinh năng lượng an lành, bước đi trong sự tỉnh thức trước khi bắt đầu công việc.'
  },
  afternoon: {
    id: 'afternoon',
    paliName: 'Majjhanhikasamaya (Quá Ngọ)',
    vietnameseName: 'Thời Quá Ngọ • Khảo Cứu Tam Tạng Pariyatti',
    timeRange: '12:00 – 17:59',
    icon: '☀️',
    accentHex: '#d97706',
    accentGlow: 'rgba(217, 119, 6, 0.3)',
    bgGradient: 'from-stone-950 via-amber-900/20 to-stone-950',
    mascotQuote: 'Trưa chiều bận rộn giữa đời thường, hãy giữ tâm bình thản như nước đầu nguồn.',
    practiceTitle: 'Khảo Cứu Tứ Thánh Đế & Bát Chánh Đạo',
    practiceDesc: 'Chiêm nghiệm lời Phật dạy để soi sáng mọi hành động và quyết định trong đời sống công nghệ.'
  },
  twilight: {
    id: 'twilight',
    paliName: 'Sāyanhasamaya (Hoàng Hôn)',
    vietnameseName: 'Thời Hoàng Hôn • Tịnh Lự & Hồi Hướng Phước Báu',
    timeRange: '18:00 – 23:59',
    icon: '🕯️',
    accentHex: '#f43f5e',
    accentGlow: 'rgba(244, 63, 94, 0.25)',
    bgGradient: 'from-rose-950/20 via-stone-900/90 to-stone-950',
    mascotQuote: 'Hoàng hôn buông xuống, lắng đọng tâm tư sau một ngày, hồi hướng công đức an lành.',
    practiceTitle: 'Kinh Hộ Trì Paritta & Quán Chiếu Buông Xả',
    practiceDesc: 'Gột rửa những mệt mỏi, buông bỏ lo âu, chuẩn bị tâm thế an nhiên cho giấc ngủ an lạc.'
  }
};

const simulatedHour = ref<number | null>(null);
const realHour = ref<number>(new Date().getHours());
let timerInterval: ReturnType<typeof setInterval> | null = null;

export function useZenTimeCycle() {
  const currentHour = computed(() => {
    return simulatedHour.value !== null ? simulatedHour.value : realHour.value;
  });

  const isRealTime = computed(() => simulatedHour.value === null);

  const activeZenPhase = computed<ZenPhaseInfo>(() => {
    const h = currentHour.value;
    if (h >= 0 && h < 6) return ZEN_PHASES.midnight;
    if (h >= 6 && h < 12) return ZEN_PHASES.dawn;
    if (h >= 12 && h < 18) return ZEN_PHASES.afternoon;
    return ZEN_PHASES.twilight;
  });

  const setSimulatedHour = (hour: number) => {
    simulatedHour.value = Math.max(0, Math.min(23, hour));
  };

  const resetToRealTime = () => {
    simulatedHour.value = null;
    realHour.value = new Date().getHours();
  };

  const updateRealHour = () => {
    realHour.value = new Date().getHours();
  };

  onMounted(() => {
    updateRealHour();
    if (!timerInterval) {
      timerInterval = setInterval(updateRealHour, 60000);
    }
  });

  onUnmounted(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  });

  return {
    currentHour,
    isRealTime,
    activeZenPhase,
    ZEN_PHASES,
    setSimulatedHour,
    resetToRealTime
  };
}
