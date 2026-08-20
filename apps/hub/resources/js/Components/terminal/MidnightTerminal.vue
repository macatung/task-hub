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
      output = `Available spells:\n• time / clock   : Xem thời gian thực & phân kỳ nhịp sống\n• cycle / phase  : Xem bảng ma trận 4 phân kỳ trong ngày\n• travel <phase> : Du hành thời gian (midnight|dawn|noon|dusk)\n• reset-time     : Đồng bộ lại theo giờ thực tế của máy\n• whoami / bio   : Giới thiệu bản thân & định vị kiến trúc\n• manifesto / nhansinh : Tuyên ngôn Triết Lý Kiến Tạo Phần Mềm Vị Nhân Sinh\n• cv / resume    : Xem tóm tắt hồ sơ năng lực & CV\n• projects / ls  : Danh sách Grimoire dự án thực chiến\n• skills         : Toàn bộ kho vũ khí kỹ thuật (18 runes)\n• game / play    : Bật Dev Mini-Game Rune Typer luyện phím\n• socials        : Các kênh liên lạc (Email, Telegram, GitHub)\n• summon / hire  : Mở bàn thờ triệu hồi / gửi yêu cầu dự án\n• hop            : Cho Ma Cà Tưng nhảy 1 cú cực cao\n• coffee         : Nạp 1 ly Robusta 100% không đường\n• talisman       : Nhận đạo bùa code 0 bug đã khai quang\n• sudo rm -rf bugs : Trừ tà diệt sạch bug trên production\n• clear          : Xóa sạch màn hình terminal`;
      sound.playClick();
      break;
    case 'time':
    case 'clock':
      output = `══════════════════════════════════════════════════════════
 ⏰ MACATUNG CHRONOS — DYNAMIC TIME-CYCLE ENGINE
══════════════════════════════════════════════════════════
 • Thời Gian Hiện Tại : ${formattedTime.value} (GMT+7)
 • Phân Kỳ Hoạt Động  : ${activePhase.value.name} (${activePhase.value.vietnameseName})
 • Khung Giờ          : ${activePhase.value.timeRange}
 • Trạng Thái Mode    : ${isTimeTravelActive.value ? '🔮 Time Travel Preview' : '🟢 Đồng Bộ Giờ Thực Tế'}
 • Mức Độ Caffeine    : ${activePhase.value.caffeineLevel}% Robusta Flow
 • Thông Điệp Phân Kỳ : "${activePhase.value.tagline}"
 💡 Gõ "cycle" để xem toàn bộ 4 phân kỳ hoặc "travel <phase>" để du hành!`;
      sound.playCelestialChime(activePhase.value.id);
      break;
    case 'cycle':
    case 'phase':
    case 'phases':
      output = `══════════════════════════════════════════════════════════════════
 🌌 BẢNG MA TRẬN 4 PHÂN KỲ NHỊP SỐNG DEVELOPER (DIURNAL MATRIX)
══════════════════════════════════════════════════════════════════
 1. 🌙 Midnight Void  [00:00 - 05:59] : Đêm sâu, tập trung 100%, 0 bug ${activePhaseId.value === 'midnight' ? '👈 [ACTIVE]' : ''}
 2. 🌅 Golden Dawn    [06:00 - 11:59] : Rạng đông hổ phách, nạp cafe sáng ${activePhaseId.value === 'dawn' ? '👈 [ACTIVE]' : ''}
 3. ☀️ High-Noon      [12:00 - 17:59] : Chính ngọ Cyber, ship tính năng ${activePhaseId.value === 'afternoon' ? '👈 [ACTIVE]' : ''}
 4. 🌆 Twilight Dusk  [18:00 - 23:59] : Hoàng hôn tím, khởi động ca đêm ${activePhaseId.value === 'twilight' ? '👈 [ACTIVE]' : ''}
──────────────────────────────────────────────────────────────────
 🔮 Dùng lệnh "travel midnight", "travel dawn", "travel noon", "travel dusk"
    hoặc "reset-time" để kiểm tra phản xạ của hệ thống!`;
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
        output = `✨ [TIME TRAVEL SUCCESS] Warp nhảy đến phân kỳ: ${phaseInfo.name} (${phaseInfo.vietnameseName})!\nToàn bộ ánh sáng, hạt bùa chú, linh vật và giao diện đã chuyển sắc.`;
      } else {
        output = `travel: Phân kỳ không hợp lệ. Hãy chọn: "midnight", "dawn", "noon", hoặc "dusk".`;
        outType = 'error';
        sound.playClick();
      }
      break;
    }
    case 'reset-time':
    case 'realtime':
      resetToRealTime();
      output = `⚡ [TIME SYNC] Đã hủy Time Travel và đồng bộ lại 100% theo đồng hồ thực tế của thiết bị.`;
      break;
    case 'whoami':
    case 'bio':
      output = `🧙‍♂️ Ma Cà Tưng — Lead Systems Architect & Creative Full-Stack Engineer.\nĐịnh vị: "Code at midnight" — Chuyển hóa cà phê Robusta thành kiến trúc phân tán siêu tải.\nNhịp sinh học hiện tại: [${activePhase.value.name}] | Caffeine: ${activePhase.value.caffeineLevel}% | Linh vật: ${activePhase.value.mascotState}`;
      sound.playClick();
      break;
    case 'cv':
    case 'resume':
      output = `══════════════════════════════════════════════════════════
 📄 HỒ SƠ NĂNG LỰC — MACATUNG.DEV (LEAD SYSTEMS ARCHITECT)
══════════════════════════════════════════════════════════
 • Vị Trí    : Lead Full-Stack Architect / Senior Engineer
 • Kinh Nghiệm: > 8 Năm Chinh Chiến Hệ Thống Tải Cao
 • Thế Mạnh  : Laravel, Vue 3, TypeScript, Microservices, Web Audio, High-Concurrency
 • Thành Tựu : +300% Throughput, 99.99% Uptime SLA, Zero Production Crash
 • Trạng Thái: 🟢 Sẵn Sàng Nhận Quest / Hợp Tác Dự Án Mới
 🔗 Kéo xuống mục "Bàn Thờ Triệu Hồi" để tải bản CV chi tiết!`;
      sound.playSuccess();
      break;
    case 'projects':
    case 'ls':
      output = `Grimoire Projects (${projectsData.length} Spells):\n` + projectsData.map((p) => `  [${p.category.toUpperCase()}] ${p.title} — ${p.tagline} (Metrics: ${p.metrics.map(m => m.value).join(' | ')})`).join('\n');
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
 🌿 TUYÊN NGÔN KỸ NGHỆ PHẦN MỀM VỊ NHÂN SINH (HUMANISTIC MANIFESTO)
══════════════════════════════════════════════════════════════════════════
 "Code Khởi Tâm Thiện — Ứng Dụng Phụng Sự Nhân Sinh"
 
 1. 🌿 THIẾT KẾ VỊ NHÂN SINH (Empathy & User-First):
    • Gạt bỏ bản ngã phô trương, thấu cảm sâu sắc nỗi đau người dùng.
    • Nói KHÔNG với Dark Patterns, tôn trọng quyền riêng tư & tự do.

 2. ⚡ KIẾN TRÚC SINH THÁI BỀN VỮNG (Resilient & Green Computing):
    • Mọi module tương hỗ, tối ưu tài nguyên máy chủ và hiệu năng.
    • Kiến trúc Decoupled thích ứng linh hoạt trước biến chuyển công nghệ.

 3. 🛡️ KỶ LUẬT & CHẤT LƯỢNG TUYỆT ĐỐI (Zero-Debt Craftsmanship):
    • Nợ kỹ thuật là gốc rễ của bất an; 100% Strict Type-Safety & Zero Debt.
    • Tỉ mỉ gạn đục khơi trong giữa đêm sâu (Midnight Flow 00:00 AM).

 4. ✨ GIẢI PHÓNG SỨC LAO ĐỘNG (AI for Human Empowerment):
    • Multi-Agent AI tự trị gánh vác tác vụ lặp lại nặng nhọc 24/7.
    • Trao lại thời gian để con người tự do sáng tạo và nâng tầm cuộc sống.
──────────────────────────────────────────────────────────────────────────`;
      sound.playCelestialChime(activePhase.value.id);
      break;
    case 'admin':
      output = '⚙️ [CMS PORTAL] Opening Admin Dashboard at /admin ... Nhấp để quản lý Projects & Contacts: https://macatung.dev/admin';
      sound.playSuccess();
      if (typeof window !== 'undefined') {
        window.location.href = '/admin';
      }
      break;
    case 'hop':
      output = '🧛‍♂️ *HOP!* Ma Cà Tưng hops gracefully over production bugs! (+1 Hop)';
      sound.playHop(1.5);
      emit('hop-requested');
      break;
    case 'coffee':
      output = '☕ Poured 1 cup of Vietnamese Robusta! Caffeine level = 100%. Ready for 4 AM deploy.';
      sound.playSuccess();
      break;
    case 'talisman':
      output = '📜 [BÙA CODE 0 BUG] try { deploy(); } catch { /* PEACE */ } — Khai Quang thành công!';
      sound.playTalisman();
      break;
    case 'game':
    case 'play':
      output = '🎮 [RUNE TYPER ARCADE] Launching Rune Typer Dev Game... Cuộn tới khu vực #game để gõ code diệt Bug!';
      sound.playSuccess();
      if (typeof document !== 'undefined') {
        const gameEl = document.getElementById('game');
        if (gameEl) {
          gameEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
      break;
    case 'slogan':
      output = '✨ "Code Khởi Tâm Thiện — Ứng Dụng Phụng Sự Nhân Sinh. Code at midnight, deploy with peace."';
      sound.playClick();
      break;
    case 'summon':
    case 'hire':
      output = '🔮 Invoking Summoning Altar... Scroll down to offer coffee and initiate project contract!';
      sound.playClick();
      emit('summon-requested');
      break;
    case 'sudo': {
      const sudoArg = args.join(' ');
      if (sudoArg === 'rm -rf bugs' || sudoArg === 'rm -rf /bugs') {
        output = '🔥 [EXORCISM IN PROGRESS] Purging 4,192 bugs from production... 0 bugs remaining. Realm is peaceful and verified 100%!';
        sound.playSuccess();
      } else {
        output = `sudo: ${sudoArg}: command not permitted by midnight council`;
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
      output = `macatung-cli: command not found: "${command}". Type "help" to see available spells.`;
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
          :title="isCopied ? 'Đã sao chép' : 'Sao chép nhật ký'"
          @click.stop="copyLogs"
        >
          <span>{{ isCopied ? '✓ Đã Copy' : '📋 Copy' }}</span>
        </button>
        <button
          type="button"
          class="p-1 rounded text-slate-400 hover:text-white text-xs transition-colors min-h-[32px] px-2"
          :title="isExpanded ? 'Thu nhỏ' : 'Mở rộng'"
          @click.stop="toggleExpand"
        >
          <span>{{ isExpanded ? '🗗' : '🗖' }}</span>
        </button>
      </div>
    </div>

    <!-- Quick Spells Pill Bar -->
    <div class="bg-midnight-950/80 border-b border-white/5 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none shrink-0">
      <span class="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 mr-1 whitespace-nowrap">Spells:</span>
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
          placeholder="Nhập spell (vd: help, cv, projects)..."
          autofocus
          @keydown="handleKeyDown"
        />
      </div>
    </div>
  </div>
</template>
