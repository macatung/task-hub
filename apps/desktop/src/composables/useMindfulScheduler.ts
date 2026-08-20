import { ref, onMounted, onUnmounted } from 'vue';
import { DHAMMAPADA_VERSES, DhammapadaVerse, HEALTH_REMINDERS, HealthReminder } from '../data/dhammapadaVerses';
import { mindfulBell } from '../audio/mindfulBellAudio';

export interface SchedulerSettings {
  intervalMinutes: number; // 15, 30, 45, 60, 90
  enableBellSound: boolean;
  enableDhammapada: boolean;
  enableHealthReminders: boolean;
  volume: number; // 0 - 100
  persona: 'zen' | 'coder';
}

const DEFAULT_SETTINGS: SchedulerSettings = {
  intervalMinutes: 30,
  enableBellSound: true,
  enableDhammapada: true,
  enableHealthReminders: true,
  volume: 80,
  persona: 'coder', // 👉 Mặc định mở Ma Cà Tưng Developer
};

export function useMindfulScheduler() {
  const settings = ref<SchedulerSettings>(loadSettings());
  const activeBubbleType = ref<'verse' | 'health' | 'breathing' | null>(null);
  const currentVerse = ref<DhammapadaVerse>(DHAMMAPADA_VERSES[0]);
  const currentHealthReminder = ref<HealthReminder>(HEALTH_REMINDERS[0]);
  const nextReminderInSeconds = ref<number>(settings.value.intervalMinutes * 60);

  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  function loadSettings(): SchedulerSettings {
    try {
      const saved = localStorage.getItem('macatung_desktop_settings_v2');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(newSettings: SchedulerSettings) {
    settings.value = { ...newSettings };
    try {
      localStorage.setItem('macatung_desktop_settings_v2', JSON.stringify(settings.value));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    resetTimer();
  }

  function resetTimer() {
    nextReminderInSeconds.value = settings.value.intervalMinutes * 60;
  }

  function drawRandomVerse(): DhammapadaVerse {
    const randomIndex = Math.floor(Math.random() * DHAMMAPADA_VERSES.length);
    currentVerse.value = DHAMMAPADA_VERSES[randomIndex];
    activeBubbleType.value = 'verse';
    if (settings.value.enableBellSound) {
      mindfulBell.ringBell(settings.value.persona === 'zen' ? 432 : 528, 5.0);
    }
    return currentVerse.value;
  }

  function drawRandomHealthReminder(): HealthReminder {
    const randomIndex = Math.floor(Math.random() * HEALTH_REMINDERS.length);
    currentHealthReminder.value = HEALTH_REMINDERS[randomIndex];
    activeBubbleType.value = 'health';
    if (settings.value.enableBellSound) {
      mindfulBell.ringBell(528, 3.5);
    }
    return currentHealthReminder.value;
  }

  function triggerScheduledEvent() {
    if (settings.value.enableDhammapada && settings.value.enableHealthReminders) {
      if (Math.random() > 0.4) {
        drawRandomVerse();
      } else {
        drawRandomHealthReminder();
      }
    } else if (settings.value.enableDhammapada) {
      drawRandomVerse();
    } else if (settings.value.enableHealthReminders) {
      drawRandomHealthReminder();
    } else if (settings.value.enableBellSound) {
      mindfulBell.ringBell(432, 6.0);
    }
  }

  function startScheduler() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      if (nextReminderInSeconds.value > 0) {
        nextReminderInSeconds.value--;
      } else {
        triggerScheduledEvent();
        resetTimer();
      }
    }, 1000);
  }

  function stopScheduler() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function togglePersona() {
    settings.value.persona = settings.value.persona === 'zen' ? 'coder' : 'zen';
    saveSettings(settings.value);
    mindfulBell.ringBell(settings.value.persona === 'zen' ? 432 : 528, 2.0);
  }

  function closeBubble() {
    activeBubbleType.value = null;
  }

  onMounted(() => {
    startScheduler();
  });

  onUnmounted(() => {
    stopScheduler();
  });

  return {
    settings,
    saveSettings,
    activeBubbleType,
    currentVerse,
    currentHealthReminder,
    nextReminderInSeconds,
    drawRandomVerse,
    drawRandomHealthReminder,
    togglePersona,
    closeBubble,
  };
}