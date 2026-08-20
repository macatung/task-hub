<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTimeCycle } from '@/composables/useTimeCycle';
import Icons from '@/Components/ui/Icons.vue';

const { activePhase } = useTimeCycle();

const codeLinesByPhase = computed(() => {
  switch (activePhase.value.id) {
    case 'dawn':
      return [
        { num: 1, tokens: [{ text: 'import', color: '#c084fc' }, { text: ' { brewRobusta, reviewPR } ', color: '#e2e8f0' }, { text: 'from', color: '#c084fc' }, { text: " '@macatung/dawn';", color: '#ffd166' }] },
        { num: 2, tokens: [] },
        { num: 3, tokens: [{ text: '// 🌅 Golden Dawn: Nạp cafe sáng & Daily Standup', color: '#64748b' }] },
        { num: 4, tokens: [{ text: 'export async function', color: '#38bdf8' }, { text: ' startMorningRoutine() {', color: '#e2e8f0' }] },
        { num: 5, tokens: [{ text: '  const', color: '#c084fc' }, { text: ' coffee = ', color: '#e2e8f0' }, { text: 'await', color: '#c084fc' }, { text: ' brewRobusta({ sugar: 0 });', color: '#38bdf8' }] },
        { num: 6, tokens: [{ text: '  return', color: '#c084fc' }, { text: ' reviewPR({ zeroBug: true, quality: 100 });', color: '#00f5a0' }] },
        { num: 7, tokens: [{ text: '}', color: '#e2e8f0' }] }
      ];
    case 'afternoon':
      return [
        { num: 1, tokens: [{ text: 'import', color: '#c084fc' }, { text: ' { shipFeature, scaleCluster } ', color: '#e2e8f0' }, { text: 'from', color: '#c084fc' }, { text: " '@macatung/deployer';", color: '#00d2ff' }] },
        { num: 2, tokens: [] },
        { num: 3, tokens: [{ text: '// ☀️ High-Noon Forge: Tốc độ ánh sáng & Zero Downtime', color: '#64748b' }] },
        { num: 4, tokens: [{ text: 'export async function', color: '#38bdf8' }, { text: ' shipToProduction() {', color: '#e2e8f0' }] },
        { num: 5, tokens: [{ text: '  await', color: '#c084fc' }, { text: ' scaleCluster({ pods: 32, latencyMs: 14 });', color: '#00d2ff' }] },
        { num: 6, tokens: [{ text: '  return', color: '#c084fc' }, { text: " shipFeature('RELEASE_V2.0', { status: 'LIVE' });", color: '#00f5a0' }] },
        { num: 7, tokens: [{ text: '}', color: '#e2e8f0' }] }
      ];
    case 'twilight':
      return [
        { num: 1, tokens: [{ text: 'import', color: '#c084fc' }, { text: ' { refactorCodebase, cleanseRepo } ', color: '#e2e8f0' }, { text: 'from', color: '#c084fc' }, { text: " '@macatung/alchemist';", color: '#c084fc' }] },
        { num: 2, tokens: [] },
        { num: 3, tokens: [{ text: '// 🌆 Twilight Dusk: Dọn dẹp code & Khởi động ca đêm', color: '#64748b' }] },
        { num: 4, tokens: [{ text: 'export function', color: '#38bdf8' }, { text: ' warmUpForNightShift() {', color: '#e2e8f0' }] },
        { num: 5, tokens: [{ text: '  const', color: '#c084fc' }, { text: ' clean = ', color: '#e2e8f0' }, { text: 'cleanseRepo({ techDebt: 0 });', color: '#c084fc' }] },
        { num: 6, tokens: [{ text: '  return', color: '#c084fc' }, { text: ' refactorCodebase({ aesthetics: 100 });', color: '#00f5a0' }] },
        { num: 7, tokens: [{ text: '}', color: '#e2e8f0' }] }
      ];
    case 'midnight':
    default:
      return [
        { num: 1, tokens: [{ text: 'import', color: '#c084fc' }, { text: ' { exorciseBugs, invokeSorcery } ', color: '#e2e8f0' }, { text: 'from', color: '#c084fc' }, { text: " '@macatung/midnight';", color: '#00f5a0' }] },
        { num: 2, tokens: [] },
        { num: 3, tokens: [{ text: '// 🌙 Midnight Void: Code lúc nửa đêm — Vạn vật say ngủ', color: '#64748b' }] },
        { num: 4, tokens: [{ text: 'export async function', color: '#38bdf8' }, { text: ' codeAtMidnight(): ', color: '#e2e8f0' }, { text: 'Promise', color: '#ffd166' }, { text: '<Uptime> {', color: '#e2e8f0' }] },
        { num: 5, tokens: [{ text: '  await', color: '#c084fc' }, { text: ' exorciseBugs({ target: ', color: '#e2e8f0' }, { text: "'production'", color: '#00f5a0' }, { text: ', bugs: 0 });', color: '#e2e8f0' }] },
        { num: 6, tokens: [{ text: '  return', color: '#c084fc' }, { text: ' invokeSorcery({ focus: 100, flowState: ', color: '#e2e8f0' }, { text: 'true', color: '#ffd166' }, { text: ' });', color: '#e2e8f0' }] },
        { num: 7, tokens: [{ text: '}', color: '#e2e8f0' }] }
      ];
  }
});

const isCopied = ref(false);

function copyCode() {
  const text = codeLinesByPhase.value.map(l => l.tokens.map(t => t.text).join('')).join('\n');
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }
}
</script>

<template>
  <div
    class="w-full rounded-2xl bg-midnight-950/90 backdrop-blur-xl border shadow-2xl overflow-hidden font-mono text-xs select-none transition-all duration-300"
    :style="{
      borderColor: activePhase.accentBorder,
      boxShadow: `0 16px 32px -8px ${activePhase.accentGlow}`
    }"
  >
    <!-- IDE Header Bar with Window Controls & Tab -->
    <div class="px-3.5 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-2">
      <div class="flex items-center gap-3">
        <!-- Window Traffic Lights -->
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>

        <!-- Active Tab File -->
        <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-midnight-900 border border-white/10 text-[11px] text-slate-200">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: activePhase.accentHex }" />
          <span class="font-bold">midnight_engine.ts</span>
        </div>
      </div>

      <!-- Copy Code Button -->
      <button
        type="button"
        @click="copyCode"
        class="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-white/5 flex items-center gap-1 text-[10px]"
        title="Sao chép code"
      >
        <Icons :name="isCopied ? 'Check' : 'Copy'" :size="12" :class="isCopied ? 'text-emerald-400' : ''" />
        <span>{{ isCopied ? 'Đã chép' : 'Chép' }}</span>
      </button>
    </div>

    <!-- Live Code Content Area -->
    <div class="p-3 sm:p-4 overflow-x-auto text-[11px] sm:text-xs leading-relaxed font-mono">
      <div
        v-for="line in codeLinesByPhase"
        :key="line.num"
        class="flex items-start gap-3 hover:bg-white/[0.02] rounded px-1 -mx-1"
      >
        <!-- Line Number -->
        <span class="text-slate-600 select-none w-4 text-right flex-shrink-0 font-normal">
          {{ line.num }}
        </span>

        <!-- Line Code Tokens -->
        <div class="flex-1 whitespace-pre">
          <span
            v-for="(token, idx) in line.tokens"
            :key="idx"
            :style="{ color: token.color }"
          >
            {{ token.text }}
          </span>
          <!-- Live Cursor on Last Non-Empty Line -->
          <span
            v-if="line.num === 6"
            class="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle"
            :style="{ backgroundColor: activePhase.accentHex }"
          />
        </div>
      </div>
    </div>

    <!-- IDE Status Bar Footer -->
    <div
      class="px-3.5 py-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono"
      :style="{ backgroundColor: `${activePhase.accentHex}08` }"
    >
      <div class="flex items-center gap-2">
        <span class="flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full animate-ping" :style="{ backgroundColor: activePhase.accentHex }" />
          <span :style="{ color: activePhase.accentHex }">Live Code Stream</span>
        </span>
        <span class="text-slate-600">|</span>
        <span>TypeScript 5.4</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-emerald-400 font-semibold">0 Errors</span>
        <span class="text-slate-600">|</span>
        <span>UTF-8</span>
      </div>
    </div>
  </div>
</template>
