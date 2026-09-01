<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { projectsData } from '@/data/projectsData';
import { skillsData } from '@/data/skillsData';
import { sound } from '@/audio/soundEffects';
import { trackEvent } from '@/utils/analytics';
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

export interface TerminalLog {
  id: string;
  type: 'input' | 'output' | 'system' | 'error';
  text: string;
  timestamp: string;
}

const emit = defineEmits<{
  (e: 'hop-requested'): void;
  (e: 'summon-requested'): void;
  (e: 'command-executed', cmd: string, output: string): void;
}>();

const prompt = ref('macatung:~$');
const currentInput = ref('');
const history = ref<string[]>([]);
const historyIndex = ref(-1);
const isExpanded = ref(false);
const isCopied = ref(false);
const logs = ref<TerminalLog[]>([
  {
    id: 'init-1',
    type: 'system',
    text: '🌙 Midnight Terminal v1.2.0 (Dynamic Time-Cycle Ready) — Type "help" or click quick spell buttons.',
    timestamp: '00:00:00'
  }
]);

const quickSpells = [
  'help',
  'time',
  'cycle',
  'whoami',
  'cv',
  'projects',
  'skills',
  'manifesto',
  'hop',
  'coffee',
  'talisman',
  'game',
  'play',
  'socials',
  'summon',
  'sudo rm -rf bugs',
  'clear'
];

const scrollContainer = ref<HTMLElement | null>(null);
const inputField = ref<HTMLInputElement | null>(null);

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
  sound.playClick();
};

const execute = (rawCmd: string): string => {
  const trimmed = rawCmd.trim();
  const now = formattedTime.value || '00:00:00';

  if (!trimmed) {
    logs.value.push({
      id: `log-${Date.now()}`,
      type: 'input',
      text: `${prompt.value} `,
      timestamp: now
    });
    nextTick(scrollToBottom);
    return '';
  }

  history.value.push(trimmed);
  historyIndex.value = -1;
  logs.value.push({
    id: `log-${Date.now()}-in`,
    type: 'input',
    text: `${prompt.value} ${trimmed}`,
    timestamp: now
  });

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Track analytics event
  trackEvent('cli_executed', { command });

  let output = '';
  let outType: 'output' | 'error' | 'system' = 'output';

  switch (command) {
    case 'help':
      output = `Available commands:
• time / clock   : Display current time & circadian phase
• cycle / phase  : Inspect the 4-phase diurnal matrix
• travel <phase> : Warp to phase (midnight|dawn|noon|dusk)
• reset-time     : Resynchronize with local system clock
• whoami / bio   : View architect bio & platform positioning
• manifesto      : Display Humanistic Engineering Manifesto
• cv / resume    : Display technical credentials summary
• projects / ls  : List production systems & architectures
• skills         : List technical arsenal (18 competencies)
• game / play    : Launch Rune Typer typing benchmark
• socials        : Display contact & repository channels
• summon / hire  : Open contact & project advisory dialog
• hop            : Trigger mascot animation
• coffee         : Refuel coffee telemetry to 100%
• talisman       : Generate 0-bug deployment verification seal
• sudo rm -rf bugs : Clean all production regressions
• clear          : Clear terminal logs`;
      sound.playClick();
      break;
    case 'time':
    case 'clock':
      output = `══════════════════════════════════════════════════════════
 ⏰ MIDNIGHT CHRONOS — DYNAMIC CIRCADIAN ENGINE
══════════════════════════════════════════════════════════
 • Current Time       : ${formattedTime.value} (GMT+7)
 • Active Phase       : ${activePhase.value.name}
 • Time Window        : ${activePhase.value.timeRange}
 • Operating Mode     : ${isTimeTravelActive.value ? '🔮 Time Travel Simulation' : '🟢 Real-time Synchronized'}
 • Caffeine Level     : ${activePhase.value.caffeineLevel}% Coffee Flow
 • Phase Tagline      : "${activePhase.value.tagline}"
 💡 Type "cycle" to view all 4 phases or "travel <phase>" to simulate!`;
      sound.playCelestialChime(activePhase.value.id);
      break;
    case 'cycle':
    case 'phase':
    case 'phases':
      output = `══════════════════════════════════════════════════════════════════
 🌌 4-PHASE DIURNAL MATRIX (CIRCADIAN ENGINEERING ENGINE)
══════════════════════════════════════════════════════════════════
 1. 🌙 Midnight Void  [00:00 - 05:59] : Deep night, 100% focus, zero regressions ${activePhaseId.value === 'midnight' ? '👈 [ACTIVE]' : ''}
 2. 🌅 Golden Dawn    [06:00 - 11:59] : Morning clarity, fresh brew & planning ${activePhaseId.value === 'dawn' ? '👈 [ACTIVE]' : ''}
 3. ☀️ High-Noon      [12:00 - 17:59] : Peak execution, shipping features ${activePhaseId.value === 'afternoon' ? '👈 [ACTIVE]' : ''}
 4. 🌆 Twilight Dusk  [18:00 - 23:59] : Evening review, staging deployment cycle ${activePhaseId.value === 'twilight' ? '👈 [ACTIVE]' : ''}
──────────────────────────────────────────────────────────────────
 🔮 Use "travel midnight", "travel dawn", "travel noon", "travel dusk"
    or "reset-time" to simulate!`;
      sound.playClick();
      break;
    case 'travel':
    case 'timetravel': {
      const target = (args[0] || '').toLowerCase();
      let targetPhase: TimePhaseId | null = null;
      if (target === 'midnight' || target === 'night' || target === '0' || target === 'dem') targetPhase = 'midnight';
      else if (target === 'dawn' || target === 'morning' || target === 'sang') targetPhase = 'dawn';
      else if (target === 'noon' || target === 'afternoon' || target === 'chieu') targetPhase = 'afternoon';
      else if (target === 'dusk' || target === 'twilight' || target === 'evening' || target === 'toi') targetPhase = 'twilight';

      if (targetPhase) {
        setPhaseOverride(targetPhase);
        const phaseInfo = TIME_PHASES[targetPhase];
        output = `✨ [TIME TRAVEL SUCCESS] Warp jump to phase: ${phaseInfo.name}!\nDynamic lighting, accent colors, and mascot states have adapted.`;
      } else {
        output = `travel: Invalid phase. Choose from: "midnight", "dawn", "noon", or "dusk".`;
        outType = 'error';
        sound.playClick();
      }
      break;
    }
    case 'reset-time':
    case 'realtime':
      resetToRealTime();
      output = `⚡ [TIME SYNC] Time travel override cleared. Resynced 100% with local system clock.`;
      break;
    case 'whoami':
    case 'bio':
      output = `🧙‍♂️ Lead Systems Architect & Creative Full-Stack Engineer.\nPositioning: "Code at midnight" — Transforming caffeine into resilient distributed architectures.\nCircadian Phase: [${activePhase.value.name}] | Caffeine: ${activePhase.value.caffeineLevel}% | Mascot: ${activePhase.value.mascotState}`;
      sound.playClick();
      break;
    case 'cv':
    case 'resume':
      output = `══════════════════════════════════════════════════════════
 📄 TECHNICAL DOSSIER — MACATUNG.DEV (LEAD SYSTEMS ARCHITECT)
══════════════════════════════════════════════════════════
 • Role        : Lead Full-Stack Architect / Senior AI Engineer
 • Experience  : > 8 Years Designing High-Scale Distributed Systems
 • Core Stack  : Laravel, Vue 3, TypeScript, Go, Microservices, Web Audio, Multi-Agent AI
 • Key Metrics : +300% Throughput, 99.99% Uptime SLA, Zero Production Regressions
 • Status      : 🟢 Available for Architecture Advisory & Keynote Projects
 🔗 Navigate to "Contact Engineering" to download full technical CV!`;
      sound.playSuccess();
      break;
    case 'projects':
    case 'ls':
      output = `Production Grimoire (${projectsData.length} Systems):\n` + projectsData.map((p) => `  [${p.category.toUpperCase()}] ${p.title} — ${p.tagline} (Metrics: ${p.metrics.map(m => m.value).join(' | ')})`).join('\n');
      sound.playClick();
      break;
    case 'skills': {
      const total = skillsData.reduce((acc, cat) => acc + cat.skills.length, 0);
      output = `Skills Arsenal (${total} runes):\n` + skillsData.map((c) => `  ⚡ ${c.title}: ${c.skills.map((s) => `${s.name} (${s.level}%)`).join(', ')}`).join('\n');
      sound.playClick();
      break;
    }
    case 'socials':
    case 'contact':
      output = `📡 Spectral Communication Channels:\n  • Email   : dev@macatung.dev\n  • GitHub  : https://github.com/macatung\n  • Telegram: @macatung_dev\n  • Realm   : GMT+7 (Midnight Zone)`;
      sound.playClick();
      break;
    case 'manifesto':
    case 'philosophy':
    case 'nhansinh':
      output = `══════════════════════════════════════════════════════════════════════════
 🌿 HUMANISTIC SOFTWARE ENGINEERING MANIFESTO
══════════════════════════════════════════════════════════════════════════
 "Mindful Code — Resilient Systems Serving Humanity"
 
 1. 🌿 HUMAN-FIRST DESIGN (Empathy & User-First):
    • Reject gratuitous complexity; deeply empathize with user pain points.
    • Say NO to manipulative dark patterns; fiercely protect privacy & user focus.

 2. ⚡ SUSTAINABLE SYSTEM ECOLOGY (Resilient & Green Computing):
    • Harmonize decoupled services; minimize server carbon footprint & waste.
    • High fault-tolerance architecture adaptable to rapid technology shifts.

 3. 🛡️ ZERO-DEBT CRAFTSMANSHIP (Discipline & Absolute Quality):
    • Technical debt is the root of fragility; 100% strict type-safety & zero debt.
    • Relentless attention to detail forged during deep midnight flow (00:00 AM).

 4. ✨ LIBERATING HUMAN CREATIVITY (AI for Human Empowerment):
    • Autonomous Multi-Agent swarms handle repetitive 24/7 operations.
    • Restores time and creative bandwidth for human strategic insight.
──────────────────────────────────────────────────────────────────────────`;
      sound.playCelestialChime(activePhase.value.id);
      break;
    case 'admin':
      output = '⚙️ [CMS PORTAL] Opening Admin Dashboard at /admin ... Direct link: https://macatung.dev/admin';
      sound.playSuccess();
      if (typeof window !== 'undefined') {
        window.location.href = '/admin';
      }
      break;
    case 'hop':
      output = '🧛‍♂️ *HOP!* Mascot hops gracefully over production bugs! (+1 Hop)';
      sound.playHop(1.5);
      emit('hop-requested');
      break;
    case 'coffee':
      output = '☕ Poured 1 cup of Vietnamese Robusta! Caffeine level = 100%. Ready for 4 AM deploy.';
      sound.playSuccess();
      break;
    case 'talisman':
      output = '📜 [0-BUG VERIFICATION SEAL] try { deploy(); } catch { /* PEACE */ } — Verified successfully!';
      sound.playTalisman();
      break;
    case 'game':
    case 'play':
      output = '🎮 [RUNE TYPER ARCADE] Launching Rune Typer Dev Game... Scrolling to #game section!';
      sound.playSuccess();
      if (typeof document !== 'undefined') {
        const gameEl = document.getElementById('game');
        if (gameEl) {
          gameEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
      break;
    case 'slogan':
      output = '✨ "Mindful Code — Resilient Systems Serving Humanity. Code at midnight, deploy with peace."';
      sound.playClick();
      break;
    case 'summon':
    case 'hire':
      output = '🔮 Invoking Advisory Request... Scroll down to initiate project contract!';
      sound.playClick();
      emit('summon-requested');
      break;
    case 'sudo': {
      const sudoArg = args.join(' ');
      if (sudoArg === 'rm -rf bugs' || sudoArg === 'rm -rf /bugs') {
        output = '🔥 [PURGE IN PROGRESS] Cleared all bugs from production... 0 bugs remaining. Verified 100%!';
        sound.playSuccess();
      } else {
        output = `sudo: ${sudoArg}: command not permitted by system policy`;
        outType = 'error';
        sound.playClick();
      }
      break;
    }
    case 'clear':
      logs.value = [];
      currentInput.value = '';
      return '';
    default:
      output = `macatung-cli: command not found: "${command}". Type "help" to see available commands.`;
      outType = 'error';
      sound.playClick();
      break;
  }

  logs.value.push({
    id: `log-${Date.now()}-out`,
    type: outType,
    text: output,
    timestamp: now
  });

  emit('command-executed', trimmed, output);
  currentInput.value = '';
  nextTick(scrollToBottom);
  return output;
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (history.value.length === 0) return;
    if (historyIndex.value === -1) {
      historyIndex.value = history.value.length - 1;
    } else if (historyIndex.value > 0) {
      historyIndex.value--;
    }
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      currentInput.value = history.value[historyIndex.value];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex.value < history.value.length - 1 && historyIndex.value !== -1) {
      historyIndex.value++;
      currentInput.value = history.value[historyIndex.value];
    } else {
      historyIndex.value = -1;
      currentInput.value = '';
    }
  } else if (e.key === 'Enter') {
    execute(currentInput.value);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    sound.playTerminalKey();
  }
};

const copyLogs = async () => {
  const plainText = logs.value.map((l) => `${l.type === 'input' ? '' : '  '}${l.text}`).join('\n');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(plainText);
    }
    isCopied.value = true;
    sound.playClick();
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {
    // Fallback
  }
};

const runSpell = (cmd: string) => {
  execute(cmd);
};

const focusInput = () => {
  if (inputField.value) {
    inputField.value.focus();
  }
};
</script>

<template>
  <div
    class="w-full rounded-2xl border border-white/10 glass-panel overflow-hidden flex flex-col font-mono text-left shadow-2xl transition-all duration-300"
    :class="isExpanded ? 'h-[540px]' : 'h-[420px]'"
    @click="focusInput"
  >
    <!-- Terminal Header / Title Bar -->
    <div class="h-10 bg-midnight-900/90 border-b border-white/10 px-4 flex items-center justify-between select-none shrink-0">
      <!-- Window Controls & Status -->
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
        <span class="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
        <span class="w-3 h-3 rounded-full bg-phantom-mint/80 inline-block" />
        <span class="text-xs text-slate-400 font-bold ml-2 hidden sm:inline truncate">
          macatung@midnight-node: ~ (zsh)
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="p-1 rounded text-slate-400 hover:text-white text-xs transition-colors min-h-[32px] px-2 flex items-center gap-1"
          :title="isCopied ? 'Copied' : 'Copy log'"
          @click.stop="copyLogs"
        >
          <span>{{ isCopied ? '✓ Copied' : '📋 Copy' }}</span>
        </button>
        <button
          type="button"
          class="p-1 rounded text-slate-400 hover:text-white text-xs transition-colors min-h-[32px] px-2"
          :title="isExpanded ? 'Restore' : 'Maximize'"
          @click.stop="toggleExpand"
        >
          <span>{{ isExpanded ? '🗗' : '🗖' }}</span>
        </button>
      </div>
    </div>

    <!-- Quick Spells Pill Bar -->
    <div class="bg-midnight-950/80 border-b border-white/5 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none shrink-0">
      <span class="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 mr-1 whitespace-nowrap">Commands:</span>
      <button
        v-for="spell in quickSpells"
        :key="spell"
        type="button"
        class="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white/5 hover:bg-phantom-mint hover:text-midnight-950 text-slate-300 transition-all shrink-0 border border-white/5 whitespace-nowrap"
        @click.stop="runSpell(spell)"
      >
        {{ spell }}
      </button>
    </div>

    <!-- Log Output Container -->
    <div
      ref="scrollContainer"
      class="flex-1 p-4 overflow-y-auto space-y-2 text-xs sm:text-sm font-mono leading-relaxed"
    >
      <div
        v-for="log in logs"
        :key="log.id"
        class="break-words whitespace-pre-wrap"
        :class="{
          'text-phantom-mint font-semibold': log.type === 'input',
          'text-slate-300': log.type === 'output',
          'text-amber-300 font-semibold': log.type === 'system',
          'text-rose-400': log.type === 'error'
        }"
      >
        {{ log.text }}
      </div>

      <!-- Live Input Line -->
      <div class="flex items-center gap-2 pt-1 text-xs sm:text-sm">
        <span class="text-phantom-mint font-bold shrink-0">{{ prompt }}</span>
        <input
          ref="inputField"
          v-model="currentInput"
          type="text"
          class="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-xs sm:text-sm p-0 focus:ring-0"
          placeholder="Type command (e.g. help, cv, projects)..."
          autofocus
          @keydown="handleKeyDown"
        />
      </div>
    </div>
  </div>
</template>
