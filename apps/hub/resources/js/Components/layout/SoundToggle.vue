<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { sound } from '@/audio/soundEffects';
import Icons from '@/Components/ui/Icons.vue';

const isMuted = ref(false);

onMounted(() => {
  isMuted.value = sound.isMuted();
});

const handleToggle = () => {
  isMuted.value = sound.toggleMute();
};
</script>

<template>
  <button
    type="button"
    class="px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 transition-all select-none min-h-[44px] min-w-[44px] justify-center focus:outline-none focus:ring-2 focus:ring-phantom-mint/50"
    :class="!isMuted
      ? 'border-phantom-mint/40 bg-phantom-mint/10 text-phantom-mint hover:bg-phantom-mint/20 shadow-glow-mint'
      : 'border-white/10 bg-midnight-900/80 text-slate-400 hover:text-slate-200 hover:border-white/20'"
    :aria-label="isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'"
    :title="isMuted ? 'Bật hiệu ứng âm thanh' : 'Tắt hiệu ứng âm thanh'"
    @click="handleToggle"
  >
    <!-- Equalizer animation when audio is active -->
    <div v-if="!isMuted" class="flex items-center gap-0.5 h-3.5">
      <span class="w-0.5 bg-phantom-mint rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
      <span class="w-0.5 bg-phantom-mint rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.2s] h-3.5" />
      <span class="w-0.5 bg-phantom-mint rounded-full animate-[pulse_1.0s_ease-in-out_infinite_0.4s] h-2" />
    </div>

    <!-- Muted icon when audio is disabled -->
    <Icons v-else name="VolumeX" :size="15" class="text-slate-400" />

    <span class="font-bold hidden sm:inline">{{ isMuted ? 'SFX: TẮT' : 'SFX: BẬT' }}</span>
  </button>
</template>
