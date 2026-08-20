<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Icons from '@/Components/ui/Icons.vue';
import { useTimeCycle, TimePhaseId } from '@/composables/useTimeCycle';

const {
  formattedTime,
  activePhaseId,
  activePhase,
  isTimeTravelActive,
  TIME_PHASES,
  setPhaseOverride,
  resetToRealTime
} = useTimeCycle();

const isMenuOpen = ref(false);
const pingMs = ref(14);
const clockContainerRef = ref<HTMLElement | null>(null);

let pingInterval: number | undefined;

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function selectPhase(phaseId: TimePhaseId) {
  setPhaseOverride(phaseId);
  isMenuOpen.value = false;
}

function handleReset() {
  resetToRealTime();
  isMenuOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  if (clockContainerRef.value && !clockContainerRef.value.contains(event.target as Node)) {
    isMenuOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  
  pingInterval = window.setInterval(() => {
    pingMs.value = Math.max(8, Math.min(28, Math.floor(12 + Math.random() * 6)));
  }, 3000);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
  if (pingInterval) clearInterval(pingInterval);
});
</script>

<template>
  <div ref="clockContainerRef" class="relative inline-block text-left select-none">
    <!-- Main Interactive Clock Trigger -->
    <button
      type="button"
      @click.stop="toggleMenu"
      class="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel border shadow-inner text-xs font-mono transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-1 cursor-pointer"
      :style="{
        borderColor: activePhase.accentBorder,
        boxShadow: `0 0 16px -4px ${activePhase.accentGlow}`
      }"
      :title="`Nhấp để mở Time Travel Preview | ${activePhase.name} (${activePhase.vietnameseName})`"
    >
      <!-- Phase Indicator Dot -->
      <span
        class="w-2 h-2 rounded-full transition-all duration-500 animate-pulse flex-shrink-0"
        :style="{
          backgroundColor: activePhase.accentHex,
          boxShadow: `0 0 8px ${activePhase.accentHex}`
        }"
      />

      <!-- Phase Icon & Live Clock -->
      <div class="flex items-center gap-1.5 whitespace-nowrap text-slate-100 font-bold tracking-wider tabular-nums text-[11px] sm:text-xs">
        <Icons :name="activePhase.icon" :size="13" :style="{ color: activePhase.accentHex }" />
        <span>{{ formattedTime }}</span>
      </div>

      <!-- Time Travel Tag if active -->
      <span
        v-if="isTimeTravelActive"
        class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse"
      >
        Travel
      </span>

      <!-- Mode Label (Medium to Large Screens) -->
      <div class="hidden xl:flex items-center gap-1.5 text-[11px] border-l border-white/10 pl-2 whitespace-nowrap">
        <span class="font-semibold" :style="{ color: activePhase.accentHex }">
          {{ activePhase.name }}
        </span>
      </div>

      <!-- Caffeine Level -->
      <div class="hidden 2xl:flex items-center gap-1 text-[11px] border-l border-white/10 pl-2 whitespace-nowrap">
        <Icons name="Coffee" :size="12" class="text-amber-400" />
        <span class="text-amber-300 font-bold tabular-nums">{{ activePhase.caffeineLevel }}%</span>
      </div>

      <!-- Chevron trigger icon -->
      <Icons
        name="ChevronDown"
        :size="12"
        class="text-slate-400 transition-transform duration-200 group-hover:text-slate-200"
        :class="{ 'rotate-180': isMenuOpen }"
      />
    </button>

    <!-- Time Travel Dropdown Modal -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-2"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-2"
    >
      <div
        v-if="isMenuOpen"
        class="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-midnight-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 z-50 overflow-hidden font-sans"
        :style="{
          boxShadow: `0 20px 40px -15px ${activePhase.accentGlow}`
        }"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center border"
              :style="{
                backgroundColor: `${activePhase.accentHex}15`,
                borderColor: activePhase.accentBorder,
                color: activePhase.accentHex
              }"
            >
              <Icons name="Compass" :size="15" />
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Time Travel & Phân Kỳ Nhịp Sống
              </h4>
              <p class="text-[10px] text-slate-400">
                Trải nghiệm 4 khung giờ trong ngày của Developer
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="isMenuOpen = false"
            class="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Icons name="X" :size="14" />
          </button>
        </div>

        <!-- 4 Phase Cards Grid -->
        <div class="grid grid-cols-1 gap-2 my-3">
          <button
            v-for="(phase, id) in TIME_PHASES"
            :key="id"
            type="button"
            @click="selectPhase(id)"
            class="group relative flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all duration-200"
            :class="[
              activePhaseId === id
                ? 'bg-white/10 border-white/30 shadow-lg'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
            ]"
          >
            <!-- Phase Icon Circle -->
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
              :style="{
                backgroundColor: `${phase.accentHex}20`,
                color: phase.accentHex,
                border: `1px solid ${phase.accentHex}40`
              }"
            >
              <Icons :name="phase.icon" :size="16" />
            </div>

            <!-- Phase Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  {{ phase.name }}
                  <span class="text-[10px] text-slate-400 font-normal">({{ phase.timeRange }})</span>
                </span>
                <!-- Active Checkmark Indicator -->
                <span
                  v-if="activePhaseId === id"
                  class="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  :style="{
                    backgroundColor: `${phase.accentHex}25`,
                    color: phase.accentHex
                  }"
                >
                  <Icons name="Check" :size="10" />
                  Active
                </span>
              </div>
              <p class="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                {{ phase.vietnameseName }} — {{ phase.tagline }}
              </p>
              <div class="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                <span class="flex items-center gap-1">
                  <Icons name="Coffee" :size="10" class="text-amber-400" />
                  {{ phase.caffeineLevel }}% Cafe
                </span>
                <span class="truncate">
                  {{ phase.mascotAccessory === 'coffee' ? '☕ Ly cafe sáng' : phase.mascotAccessory === 'sunglasses' ? '🕶️ Kính râm' : '📜 Bùa chú' }}
                </span>
              </div>
            </div>
          </button>
        </div>

        <!-- Footer Control Bar -->
        <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 text-[11px]">
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="isTimeTravelActive ? 'bg-purple-400 animate-ping' : 'bg-emerald-400'"
            />
            <span class="text-slate-400 font-mono text-[10px]">
              {{ isTimeTravelActive ? 'Chế độ: Time Travel Preview' : 'Chế độ: Đồng bộ thời gian thực' }}
            </span>
          </div>

          <!-- Reset to Real Time Button -->
          <button
            v-if="isTimeTravelActive"
            type="button"
            @click="handleReset"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
          >
            <Icons name="RotateCcw" :size="11" />
            Giờ Thực
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
