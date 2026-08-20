<script setup lang="ts">
import { ref } from 'vue';
import { SchedulerSettings } from '../composables/useMindfulScheduler';
import { mindfulBell } from '../audio/mindfulBellAudio';

const props = defineProps<{
  settings: SchedulerSettings;
}>();

const emit = defineEmits<{
  (e: 'save', newSettings: SchedulerSettings): void;
  (e: 'close'): void;
}>();

const localSettings = ref<SchedulerSettings>({ ...props.settings });

const testBell = () => {
  mindfulBell.ringBell(localSettings.value.persona === 'zen' ? 432 : 528, 4.0);
};

const handleSave = () => {
  emit('save', localSettings.value);
  emit('close');
};
</script>

<template>
  <div class="w-80 sm:w-96 rounded-3xl p-5 bg-stone-950/98 text-stone-100 border-2 border-amber-500/80 shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl no-drag select-none text-left font-serif ring-1 ring-amber-400/30">
    <!-- Header -->
    <div class="flex items-center justify-between pb-3 mb-3 border-b border-amber-500/30">
      <div class="flex items-center gap-2 text-sm font-bold text-amber-300">
        <span>⚙️</span>
        <span>CÀI ĐẶT NHẮC NHỞ CHÁNH NIỆM</span>
      </div>
      <button
        @click="$emit('close')"
        class="text-stone-400 hover:text-white p-1 rounded-lg bg-stone-900 cursor-pointer text-xs"
      >
        ✕
      </button>
    </div>

    <div class="space-y-4 text-xs">
      <!-- Persona Mode -->
      <div>
        <label class="font-bold text-amber-200 block mb-1.5">Hình thái Mascot (Persona):</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="localSettings.persona = 'zen'"
            :class="[
              'py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5',
              localSettings.persona === 'zen'
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
            ]"
          >
            <span>🧘</span>
            <span>Ma Tọa Thiền</span>
          </button>

          <button
            @click="localSettings.persona = 'coder'"
            :class="[
              'py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5',
              localSettings.persona === 'coder'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
            ]"
          >
            <span>☕</span>
            <span>Ma Cà Tưng</span>
          </button>
        </div>
      </div>

      <!-- Frequency / Interval -->
      <div>
        <label class="font-bold text-amber-200 block mb-1.5">Tần suất nhắc nhở:</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="mins in [15, 30, 45, 60, 90]"
            :key="mins"
            @click="localSettings.intervalMinutes = mins"
            :class="[
              'px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-sans font-bold',
              localSettings.intervalMinutes === mins
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
            ]"
          >
            {{ mins }}p
          </button>
        </div>
      </div>

      <!-- Feature Toggles -->
      <div class="space-y-2 pt-2 border-t border-stone-800 font-sans">
        <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-stone-900/60 hover:bg-stone-900">
          <span class="flex items-center gap-2">
            <span>🔔</span>
            <span>Tiếng chuông chánh niệm (432Hz)</span>
          </span>
          <input type="checkbox" v-model="localSettings.enableBellSound" class="accent-amber-500 w-4 h-4 cursor-pointer" />
        </label>

        <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-stone-900/60 hover:bg-stone-900">
          <span class="flex items-center gap-2">
            <span>📜</span>
            <span>Rút ngẫu nhiên kệ Kinh Pháp Cú</span>
          </span>
          <input type="checkbox" v-model="localSettings.enableDhammapada" class="accent-amber-500 w-4 h-4 cursor-pointer" />
        </label>

        <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-stone-900/60 hover:bg-stone-900">
          <span class="flex items-center gap-2">
            <span>💧</span>
            <span>Nhắc uống nước & thư giãn mắt</span>
          </span>
          <input type="checkbox" v-model="localSettings.enableHealthReminders" class="accent-amber-500 w-4 h-4 cursor-pointer" />
        </label>
      </div>

      <!-- Actions -->
      <div class="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
        <button
          @click="testBell"
          class="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 border border-stone-800 text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1"
        >
          <span>🔔</span>
          <span>Thử Chuông</span>
        </button>

        <button
          @click="handleSave"
          class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-serif font-bold shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          Lưu Cài Đặt
        </button>
      </div>
    </div>
  </div>
</template>
