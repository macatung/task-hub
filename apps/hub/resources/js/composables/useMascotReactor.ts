import { ref, onMounted, onUnmounted, computed } from 'vue';
import { sound } from '@/audio/soundEffects';

export type MascotReactionType =
  | 'normal'
  | 'copy_blessed'
  | 'fast_scroll'
  | 'sleeping'
  | 'wake_up'
  | 'tab_returned'
  | 'pet_loved'
  | 'caffeine_boost'
  | 'talisman_glow';

export interface MascotReaction {
  type: MascotReactionType;
  message: string;
  emoji: string;
  mood: 'normal' | 'caffeine' | 'sleepy' | 'rage';
  durationMs: number;
}

// Global Shared State so all Mascot instances sync reactions
const currentReaction = ref<MascotReaction | null>(null);
const isIdleSleeping = ref(false);
const totalHops = ref(0);
const caffeineLevel = ref(50);
const talismanCount = ref(0);

// Load persisted stats
if (typeof window !== 'undefined') {
  try {
    const savedHops = localStorage.getItem('macatung_hop_count');
    if (savedHops) totalHops.value = parseInt(savedHops, 10) || 0;

    const savedTalisman = localStorage.getItem('macatung_talisman_count');
    if (savedTalisman) talismanCount.value = parseInt(savedTalisman, 10) || 0;
  } catch {}
}

let reactionTimer: number | undefined;
let idleTimer: number | undefined;
let lastScrollY = 0;
let lastScrollTime = 0;
let attachedListeners = false;

export function useMascotReactor() {
  function triggerReaction(
    type: MascotReactionType,
    message: string,
    emoji: string = '✨',
    mood: 'normal' | 'caffeine' | 'sleepy' | 'rage' = 'normal',
    durationMs: number = 4000
  ) {
    if (reactionTimer) clearTimeout(reactionTimer);
    
    currentReaction.value = {
      type,
      message,
      emoji,
      mood,
      durationMs
    };

    reactionTimer = window.setTimeout(() => {
      if (currentReaction.value?.type === type) {
        currentReaction.value = null;
      }
    }, durationMs);
  }

  function clearReaction() {
    if (reactionTimer) clearTimeout(reactionTimer);
    currentReaction.value = null;
  }

  // Interactive Pet Actions
  function feedCoffee() {
    caffeineLevel.value = Math.min(100, caffeineLevel.value + 25);
    try {
      sound.playSuccess?.();
    } catch {}

    triggerReaction(
      'caffeine_boost',
      '☕ Đã nạp 1 ly Robusta đặc quánh! Năng lượng gõ phím +200%!',
      '⚡',
      'caffeine',
      4500
    );
  }

  function applyTalisman() {
    talismanCount.value++;
    try {
      localStorage.setItem('macatung_talisman_count', String(talismanCount.value));
      sound.playTalisman?.();
    } catch {}

    triggerReaction(
      'talisman_glow',
      '📜 Sắc lệnh Khai Quang! Yểm bùa 0 Bug cho toàn bộ codebase!',
      '✨',
      'caffeine',
      5000
    );
  }

  function petMascot() {
    try {
      sound.playHop?.();
    } catch {}

    triggerReaction(
      'pet_loved',
      '💖 Cảm ơn lữ khách đã xoa đầu! Ma Cà Tưng đang rất phấn khởi~',
      '🥰',
      'normal',
      3500
    );
  }

  function incrementHop() {
    totalHops.value++;
    try {
      localStorage.setItem('macatung_hop_count', String(totalHops.value));
      sound.playHop?.();
    } catch {}

    if (totalHops.value % 50 === 0) {
      triggerReaction(
        'caffeine_boost',
        `🎉 ĐỈNH CAO! Bạn đã cùng Ma Cà Tưng nhảy ${totalHops.value} bước!`,
        '🏆',
        'caffeine',
        6000
      );
    } else if (totalHops.value % 10 === 0) {
      triggerReaction(
        'caffeine_boost',
        `✨ Cột mốc ${totalHops.value} bước nhảy! Đom đóm chúc mừng!`,
        '🌟',
        'caffeine',
        4000
      );
    }
  }

  // Event Handlers for Context Reactor
  const handleCopy = (e: ClipboardEvent) => {
    // Don't interrupt manual pet actions immediately if high priority
    if (currentReaction.value?.type === 'caffeine_boost') return;

    triggerReaction(
      'copy_blessed',
      '⚡ Đã copy mã! Bùa 0-Bug của Ma Cà Tưng đã được yểm vào Clipboard!',
      '📋',
      'caffeine',
      4000
    );
  };

  const resetIdleTimer = () => {
    if (isIdleSleeping.value) {
      isIdleSleeping.value = false;
      triggerReaction(
        'wake_up',
        '⚡ Oáp! Cảm nhận được chuyển động của lữ khách, Ma Cà Tưng tỉnh giấc!',
        '👀',
        'caffeine',
        3000
      );
    }

    if (idleTimer) clearTimeout(idleTimer);
    // 35s of inactivity triggers sleeping state
    idleTimer = window.setTimeout(() => {
      isIdleSleeping.value = true;
      triggerReaction(
        'sleeping',
        '😴 Zzz... Lữ khách đi đâu rồi? Ma Cà Tưng chợp mắt dưỡng linh khí xíu...',
        '💤',
        'sleepy',
        15000
      );
    }, 35000);
  };

  const handleScroll = () => {
    resetIdleTimer();
    const now = Date.now();
    const currentY = window.scrollY;
    const timeDelta = now - lastScrollTime;
    const distanceDelta = Math.abs(currentY - lastScrollY);

    if (timeDelta > 50 && timeDelta < 300) {
      const speed = (distanceDelta / timeDelta) * 1000; // px per second
      if (speed > 3500 && currentReaction.value?.type !== 'fast_scroll') {
        triggerReaction(
          'fast_scroll',
          '🌀 Ôi lướt nhanh thế! Ma Cà Tưng bay theo chóng cả mặt @_@',
          '💫',
          'rage',
          3000
        );
      }
    }

    lastScrollY = currentY;
    lastScrollTime = now;
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      resetIdleTimer();
      triggerReaction(
        'tab_returned',
        '🌙 Lữ khách bóng đêm đã quay lại! Tiếp tục hành trình nào!',
        '👋',
        'normal',
        4000
      );
    }
  };

  onMounted(() => {
    if (!attachedListeners && typeof window !== 'undefined') {
      attachedListeners = true;
      window.addEventListener('copy', handleCopy);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('mousemove', resetIdleTimer, { passive: true });
      window.addEventListener('keydown', resetIdleTimer, { passive: true });
      window.addEventListener('touchstart', resetIdleTimer, { passive: true });
      document.addEventListener('visibilitychange', handleVisibility);
      resetIdleTimer();
    }
  });

  onUnmounted(() => {
    // Shared singleton listeners keep running during app session
  });

  return {
    currentReaction,
    isIdleSleeping,
    totalHops,
    caffeineLevel,
    talismanCount,
    triggerReaction,
    clearReaction,
    feedCoffee,
    applyTalisman,
    petMascot,
    incrementHop
  };
}
