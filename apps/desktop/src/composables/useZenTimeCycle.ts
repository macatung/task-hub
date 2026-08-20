import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue';

export interface ZenPhaseInfo {
  id: 'midnight' | 'dawn' | 'afternoon' | 'twilight';
  paliName: string;
  vietnameseName: string;
  timeRange: string;
  icon: string;
  accentHex: string;
  secondaryHex: string;
  accentGlow: string;
  haloColor: string;
  lotusGlow: string;
  stardustColor: string;
}

export const ZEN_PHASES: Record<string, ZenPhaseInfo> = {
  midnight: {
    id: 'midnight',
    paliName: 'Rātribhāga',
    vietnameseName: 'Canh Khuya Tịch Mịch',
    timeRange: '00:00 – 05:59',
    icon: '🌌',
    accentHex: '#8b5cf6',
    secondaryHex: '#a855f7',
    accentGlow: 'rgba(139, 92, 246, 0.45)',
    haloColor: '#c084fc',
    lotusGlow: 'rgba(168, 85, 247, 0.4)',
    stardustColor: '#e9d5ff',
  },
  dawn: {
    id: 'dawn',
    paliName: 'Pubbaṇhasamaya',
    vietnameseName: 'Bình Minh Thanh Tịnh',
    timeRange: '06:00 – 11:59',
    icon: '🌅',
    accentHex: '#f59e0b',
    secondaryHex: '#fbbf24',
    accentGlow: 'rgba(245, 158, 11, 0.45)',
    haloColor: '#fde047',
    lotusGlow: 'rgba(251, 191, 36, 0.4)',
    stardustColor: '#fef08a',
  },
  afternoon: {
    id: 'afternoon',
    paliName: 'Majjhanhikasamaya',
    vietnameseName: 'Quá Ngọ Tỉnh Giác',
    timeRange: '12:00 – 17:59',
    icon: '☀️',
    accentHex: '#10b981',
    secondaryHex: '#34d399',
    accentGlow: 'rgba(16, 185, 129, 0.45)',
    haloColor: '#6ee7b7',
    lotusGlow: 'rgba(52, 211, 153, 0.4)',
    stardustColor: '#a7f3d0',
  },
  twilight: {
    id: 'twilight',
    paliName: 'Sāyanhasamaya',
    vietnameseName: 'Hoàng Hôn Tịch Chiếu',
    timeRange: '18:00 – 23:59',
    icon: '🕯️',
    accentHex: '#f43f5e',
    secondaryHex: '#fb7185',
    accentGlow: 'rgba(244, 63, 94, 0.45)',
    haloColor: '#fda4af',
    lotusGlow: 'rgba(251, 113, 133, 0.4)',
    stardustColor: '#fecdd3',
  },
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

  if (getCurrentInstance()) {
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
  }

  return {
    currentHour,
    isRealTime,
    activeZenPhase,
    setSimulatedHour,
    resetToRealTime,
    updateRealHour,
    ZEN_PHASES,
  };
}
