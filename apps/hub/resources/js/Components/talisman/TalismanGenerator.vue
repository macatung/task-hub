<script setup lang="ts">
import { ref, computed } from 'vue';
import confetti from 'canvas-confetti';
import { talismanPresets } from '@/data/talismanData';
import type { TalismanPreset } from '@/types/portfolio';
import { sound } from '@/audio/soundEffects';

const selectedPreset = ref<TalismanPreset>(talismanPresets[0]);
const developerName = ref('');
const customWish = ref('');
const colorPalette = ref<'yellow' | 'crimson' | 'cyan' | 'purple'>(talismanPresets[0].colorScheme);
const isBlessed = ref(false);
const isBlessingAnimation = ref(false);
const copiedToast = ref(false);

const palettes = [
  { id: 'yellow', label: 'Talisman Gold', border: 'border-talisman-yellow/80', glow: 'shadow-[0_0_35px_rgba(255,209,102,0.35)]', badge: 'bg-amber-950/80 text-talisman-yellow', dot: 'bg-talisman-yellow' },
  { id: 'crimson', label: 'Cinnabar Red', border: 'border-phantom-blood/80', glow: 'shadow-[0_0_35px_rgba(255,0,84,0.35)]', badge: 'bg-rose-950/80 text-rose-300', dot: 'bg-phantom-blood' },
  { id: 'cyan', label: 'Neon Mint', border: 'border-phantom-mint/80', glow: 'shadow-[0_0_35px_rgba(0,245,160,0.35)]', badge: 'bg-emerald-950/80 text-phantom-mint', dot: 'bg-phantom-mint' },
  { id: 'purple', label: 'Phantom Violet', border: 'border-phantom-purple/80', glow: 'shadow-[0_0_35px_rgba(157,78,221,0.35)]', badge: 'bg-purple-950/80 text-purple-300', dot: 'bg-phantom-purple' }
] as const;

const activePaletteConfig = computed(() => {
  return palettes.find((p) => p.id === colorPalette.value) || palettes[0];
});

const displayName = computed(() => developerName.value.trim() || 'Midnight Engineer');
const displayWish = computed(() => customWish.value.trim() || selectedPreset.value.meaning);

const selectPreset = (preset: TalismanPreset) => {
  selectedPreset.value = preset;
  colorPalette.value = preset.colorScheme;
  isBlessed.value = false;
  sound.playClick();
};

const triggerKhaiQuang = () => {
  if (isBlessingAnimation.value) return;

  isBlessingAnimation.value = true;
  sound.playTalisman();

  try {
    confetti({
      particleCount: 65,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#00f5a0', '#ffd166', '#ff0054', '#9d4edd'],
    });
  } catch {
    // Fallback if canvas context issue
  }

  setTimeout(() => {
    isBlessed.value = true;
    isBlessingAnimation.value = false;
  }, 800);
};

const generateAsciiTalisman = (): string => {
  const name = displayName.value;
  const wish = displayWish.value;
  const title = selectedPreset.value.title;
  const seal = isBlessed.value ? '[✓ ĐÃ KHAI QUANG]' : '[CHƯA KHAI QUANG]';

  return `
+------------------------------------------+
|  ⚡ MACATUNG.DEV DEV TALISMAN FORGE ⚡  |
+------------------------------------------+
|  SPELL:  ${title.padEnd(30, ' ')} |
|  OWNER:  ${name.padEnd(30, ' ')} |
|  WISH:   ${wish.slice(0, 30).padEnd(30, ' ')} |
|  STATUS: ${seal.padEnd(30, ' ')} |
+------------------------------------------+
|  try { deploy(); } catch { /* PEACE */ } |
+------------------------------------------+
`.trim();
};

const copyAscii = async () => {
  const ascii = generateAsciiTalisman();
  sound.playClick();
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(ascii);
    }
  } catch {
    // Headless fallback
  }
  copiedToast.value = true;
  setTimeout(() => {
    copiedToast.value = false;
  }, 2500);
};
</script>

<template>
  <div class="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- Left: Forge Controls (7 Columns) -->
    <div class="lg:col-span-7 flex flex-col gap-6 text-left">
      <div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-talisman-gold text-xs font-mono mb-3 whitespace-nowrap select-none shadow-glow-talisman">
          ⚡ Developer Talisman Forge
        </span>
        <h2 class="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          Lò Luyện Bùa <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-amber-400 to-rose-400">Lập Trình</span>
        </h2>
        <p class="text-sm sm:text-base text-slate-400 mt-2 font-sans">
          Chọn thần chú hộ mệnh, điền tên và tâm nguyện, sau đó thực hiện nghi thức Khai Quang để nhận phúc khí 0-bug cho toàn bộ repository.
        </p>
      </div>

      <!-- Preset Spells Grid -->
      <div>
        <label class="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 whitespace-nowrap">1. Chọn Thần Chú Bùa Chú</label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            v-for="preset in talismanPresets"
            :key="preset.id"
            type="button"
            class="p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[72px]"
            :class="selectedPreset.id === preset.id
              ? 'bg-midnight-850 border-talisman-gold shadow-glow-talisman'
              : 'bg-midnight-900/60 border-white/5 hover:border-white/20 text-slate-300'"
            @click="selectPreset(preset)"
          >
            <span class="font-display font-bold text-xs sm:text-sm leading-tight text-white">{{ preset.title }}</span>
            <span class="font-mono text-[10px] text-slate-400 mt-1 truncate">{{ preset.runeTop }}</span>
          </button>
        </div>
      </div>

      <!-- Custom Inputs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 whitespace-nowrap">2. Tên Kỹ Sư (Author)</label>
          <input
            v-model="developerName"
            type="text"
            placeholder="e.g. Alchemist Tưng"
            class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-900 border border-white/10 text-white font-sans text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none min-h-[44px] transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 whitespace-nowrap">3. Nguyện Ước / Lời Chúc</label>
          <input
            v-model="customWish"
            type="text"
            :placeholder="selectedPreset.meaning"
            class="w-full px-3.5 py-2.5 rounded-xl bg-midnight-900 border border-white/10 text-white font-sans text-sm placeholder-slate-600 focus:border-phantom-mint focus:outline-none min-h-[44px] transition-colors"
          />
        </div>
      </div>

      <!-- Palette Selector -->
      <div>
        <label class="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 whitespace-nowrap">4. Khí Sắc Bùa (Color Palette)</label>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            v-for="p in palettes"
            :key="p.id"
            type="button"
            class="px-3 py-2 rounded-xl border text-xs font-mono flex items-center gap-2 transition-all min-h-[44px] whitespace-nowrap"
            :class="colorPalette === p.id ? `${p.border} bg-midnight-800 text-white` : 'border-white/10 text-slate-400 hover:text-white'"
            @click="colorPalette = p.id; sound.playClick()"
          >
            <span class="w-3 h-3 rounded-full shrink-0" :class="p.dot" />
            <span>{{ p.label }}</span>
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="button"
          class="flex-1 px-6 py-3.5 rounded-xl font-display font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 min-h-[48px] whitespace-nowrap"
          :class="isBlessingAnimation
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed animate-pulse'
            : 'bg-gradient-to-r from-talisman-gold via-amber-400 to-rose-400 text-midnight-950 hover:brightness-110 active:scale-95 shadow-glow-talisman'"
          :disabled="isBlessingAnimation"
          @click="triggerKhaiQuang"
        >
          <span>{{ isBlessingAnimation ? '⏳ Đang Niệm Chú Khai Quang...' : isBlessed ? '✨ Khai Quang Lại' : '🔥 Khai Quang Trì Chú' }}</span>
        </button>

        <button
          type="button"
          class="px-5 py-3.5 rounded-xl border border-white/10 hover:border-phantom-mint bg-midnight-900 text-slate-200 hover:text-white font-mono text-xs font-bold transition-all flex items-center gap-2 min-h-[48px] whitespace-nowrap"
          @click="copyAscii"
        >
          <span>{{ copiedToast ? '✓ Đã Copy ASCII!' : '📋 Copy ASCII Card' }}</span>
        </button>
      </div>
    </div>

    <!-- Right: Live Visual Talisman Card (5 Columns) -->
    <div class="lg:col-span-5 flex flex-col items-center">
      <div
        class="w-full max-w-sm rounded-2xl border-2 p-6 transition-all duration-500 relative flex flex-col items-center text-center select-none bg-gradient-to-b from-midnight-900 via-midnight-950 to-midnight-900 shadow-2xl"
        :class="[activePaletteConfig.border, activePaletteConfig.glow, isBlessingAnimation ? 'animate-pulse scale-105' : '']"
      >
        <!-- Top Hanging Ring -->
        <div class="w-8 h-8 rounded-full border-2 border-dashed border-white/30 -mt-10 mb-3 flex items-center justify-center bg-midnight-950">
          <div class="w-3 h-3 rounded-full bg-talisman-gold animate-pulse" />
        </div>

        <!-- Protocol Rune Tag -->
        <div class="text-[11px] font-mono tracking-widest uppercase mb-3 px-3 py-1 rounded-full border border-white/10 whitespace-nowrap font-bold" :class="activePaletteConfig.badge">
          {{ selectedPreset.runeTop }}
        </div>

        <!-- Calligraphic Title -->
        <h3 class="text-2xl font-display font-extrabold text-white tracking-wide mb-4">
          {{ selectedPreset.title }}
        </h3>

        <!-- Mystic Seal Code Box -->
        <div class="w-full p-3 rounded-xl bg-midnight-950/90 border border-white/10 font-mono text-xs text-phantom-mint mb-4 text-left break-words shadow-inner">
          <code>{{ selectedPreset.codeSnippet }}</code>
        </div>

        <!-- Developer Inscriptions -->
        <div class="w-full border-t border-b border-white/10 py-3 mb-4 space-y-1.5 text-left text-xs font-mono">
          <div class="text-slate-400">
            Kỹ Sư: <span class="text-white font-semibold">{{ displayName }}</span>
          </div>
          <div class="text-slate-400 leading-snug">
            Nguyện: <span class="text-amber-200/90 font-sans">{{ displayWish }}</span>
          </div>
        </div>

        <!-- Rotating Khai Quang Seal Badge -->
        <div class="mt-2 flex items-center justify-center h-16">
          <div
            v-if="isBlessed"
            class="px-4 py-2 rounded-full border-2 border-emerald-400 text-emerald-400 font-mono font-extrabold text-xs tracking-wider shadow-glow-mint transform -rotate-6 transition-all duration-300 scale-105 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>✓ ĐÃ KHAI QUANG</span>
          </div>
          <div
            v-else
            class="px-4 py-1.5 rounded-full border border-dashed border-slate-600 text-slate-500 font-mono text-[11px] whitespace-nowrap"
          >
            [CHƯA KHAI QUANG]
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
