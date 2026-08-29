<script setup lang="ts">
import { ref, watch } from 'vue';
import type { DesktopCredential } from '../../composables/useTaskSync';

const props = defineProps<{
  open: boolean;
  credential: DesktopCredential | null;
  workspace: string;
  executionPolicy: 'restricted' | 'workspace_write' | 'full_access';
  diagnostics: { ok: boolean; sandbox: string; summary: string; details: string[]; version?: string } | null;
  diagnosticsLoading: boolean;
  updater: { status: string; version?: string; percent?: number; message?: string };
  agentRuntimes: Array<{ provider: 'codex' | 'claude_code' | 'antigravity'; label: string; executable: string | null; status: 'ready' | 'missing' | 'installing' | 'failed'; message: string }>;
  runtimeRepairing: boolean;
  autoSubmitHandoff: boolean;
  autoContinueEpic: boolean;
  autoReviewEnabled: boolean;
  reviewerProvider: 'codex' | 'claude_code' | 'antigravity';
  autoReviewMaxIterations: number;
  caoStatus: {
    running: boolean;
    available: boolean;
    port: number;
    cli: string | null;
    source: 'embedded' | 'external' | 'offline';
    reconnecting?: boolean;
    error?: string;
    runtimeHome?: string;
    serverPid?: number;
    health?: 'unknown' | 'ok' | 'failed';
    sessionApi?: 'unknown' | 'ok' | 'failed';
    provider?: 'unknown' | 'ok' | 'failed';
    fifo?: 'unknown' | 'ok' | 'failed';
    lastError?: string;
  } | null;
  caoReconnecting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  chooseWorkspace: [];
  updateExecutionPolicy: [value: 'restricted' | 'workspace_write' | 'full_access'];
  runDiagnostics: [];
  repairRuntimes: [];
  checkAppUpdate: [];
  installAppUpdate: [];
  openHub: [];
  updateAutoSubmitHandoff: [value: boolean];
  updateAutoContinueEpic: [value: boolean];
  updateAutoReview: [payload: { enabled: boolean; reviewer: 'codex' | 'claude_code' | 'antigravity'; maxIterations: number }];
  restartCao: [];
}>();

const reviewEnabled = ref(false);
const reviewProvider = ref<'codex' | 'claude_code' | 'antigravity'>('claude_code');
const reviewMaxIterations = ref(3);
watch(() => [props.open, props.autoReviewEnabled, props.reviewerProvider, props.autoReviewMaxIterations] as const, () => {
  reviewEnabled.value = props.autoReviewEnabled;
  reviewProvider.value = props.reviewerProvider;
  reviewMaxIterations.value = props.autoReviewMaxIterations;
}, { immediate: true });
const saveAutoReview = () => emit('updateAutoReview', { enabled: reviewEnabled.value, reviewer: reviewProvider.value, maxIterations: reviewMaxIterations.value });
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs select-none" @click.self="emit('close')">
    <aside class="flex h-full w-full max-w-xl flex-col border-l border-[#141b2d] bg-[#070b14] text-zinc-100 shadow-2xl">
      <header class="flex items-start justify-between gap-4 border-b border-[#141b2d] px-6 py-5 bg-[#0c1220]">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00f5a0] font-mono">Control Center</p>
          <h2 class="mt-1 text-lg font-bold text-white font-['Space_Grotesk']">Settings & approvals</h2>
          <p class="mt-1 text-xs leading-5 text-zinc-400">Configure the local runtime. Sensitive changes stay on this device.</p>
        </div>
        <button class="cc-button text-xs" @click="emit('close')">Close</button>
      </header>

      <main class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section class="space-y-3">
          <div>
            <h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">Connection</h3>
            <p class="mt-1 text-xs text-zinc-400 font-mono">{{ credential ? `${credential.workspaceName || credential.projectTitle || 'Task Hub workspace'} · ${credential.taskHubUrl}` : 'No Hub workspace connected.' }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="cc-button text-xs" @click="emit('openHub')">Open Hub</button>
            <button v-if="!credential" class="cc-button text-xs" @click="emit('openHub')">Pair a workspace in Hub</button>
          </div>
        </section>

        <section class="border-t border-[#141b2d] pt-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">Desktop update</h3>
              <p class="mt-1 text-xs leading-5 text-zinc-400">{{ updater.message || 'Check the installed desktop release for an available update.' }}</p>
            </div>
            <button class="cc-button shrink-0 text-xs" :disabled="updater.status === 'checking' || updater.status === 'downloading'" @click="emit('checkAppUpdate')">{{ updater.status === 'checking' || updater.status === 'downloading' ? (updater.percent ? `Downloading ${updater.percent}%` : 'Checking…') : 'Check for updates' }}</button>
          </div>
          <div v-if="updater.status === 'downloaded'" class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-600/40 bg-emerald-950/30 px-3.5 py-2">
            <span class="text-xs text-emerald-300 font-mono">Version {{ updater.version }} is ready.</span>
            <button class="cc-primary shrink-0 text-xs" @click="emit('installAppUpdate')">Restart & install</button>
          </div>
          <p v-else-if="updater.status === 'error'" class="mt-3 rounded-xl border border-rose-600/40 bg-rose-950/30 px-3.5 py-2 text-xs text-rose-300 font-mono">Update check failed. Install the latest signed Task Companion setup package, then restart the app.</p>
        </section>

        <section class="border-t border-[#141b2d] pt-5">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">Local repository</h3>
          <p class="mt-1 text-xs leading-5 text-zinc-400">Task Hub creates isolated worktrees from this repository before starting an agent.</p>
          <div class="mt-3 flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate rounded-xl bg-[#0c1220] border border-[#141b2d] px-3 py-2 font-mono text-xs text-[#00f5a0]">{{ workspace || 'No repository selected' }}</code>
            <button class="cc-button shrink-0 text-xs" @click="emit('chooseWorkspace')">{{ workspace ? 'Change repo' : 'Choose repo' }}</button>
          </div>
        </section>

        <section class="border-t border-[#141b2d] pt-5">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">Run & handoff</h3>
          <p class="mt-1 text-xs leading-5 text-zinc-400">Choose the default execution policy and decide whether a verified local run should be sent to Hub automatically.</p>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <button class="rounded-xl border px-3 py-3 text-left text-xs transition" :class="executionPolicy === 'restricted' ? 'border-[#00f5a0]/80 bg-[#11182c] text-white shadow-sm' : 'border-[#141b2d] bg-[#0c1220] text-zinc-400 hover:border-zinc-600'" @click="emit('updateExecutionPolicy', 'restricted')"><b class="block font-['Space_Grotesk']">Read only</b><span class="mt-1 block text-[11px] text-zinc-400">No repository edits.</span></button>
            <button class="rounded-xl border px-3 py-3 text-left text-xs transition" :class="executionPolicy === 'workspace_write' ? 'border-[#00f5a0]/80 bg-[#11182c] text-white shadow-sm' : 'border-[#141b2d] bg-[#0c1220] text-zinc-400 hover:border-zinc-600'" @click="emit('updateExecutionPolicy', 'workspace_write')"><b class="block font-['Space_Grotesk']">Workspace write</b><span class="mt-1 block text-[11px] text-zinc-400">Default for tasks.</span></button>
            <button class="rounded-xl border px-3 py-3 text-left text-xs transition" :class="executionPolicy === 'full_access' ? 'border-amber-500/80 bg-amber-950/40 text-white shadow-sm' : 'border-[#141b2d] bg-[#0c1220] text-zinc-400 hover:border-zinc-600'" @click="emit('updateExecutionPolicy', 'full_access')"><b class="block font-['Space_Grotesk']">Full access</b><span class="mt-1 block text-[11px] text-zinc-400">Human-approved only.</span></button>
          </div>
          <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#141b2d] bg-[#0c1220] p-3">
            <input class="mt-0.5" type="checkbox" :checked="autoSubmitHandoff" @change="emit('updateAutoSubmitHandoff', ($event.target as HTMLInputElement).checked)">
            <span>
              <span class="flex items-center gap-2"><b class="text-xs text-white font-['Space_Grotesk']">Auto-submit completed handoffs</b><span class="rounded-full bg-[#00f5a0]/20 border border-[#00f5a0]/30 px-2 py-0.2 text-[10px] font-bold text-[#00f5a0] font-mono inline-flex items-center justify-center">{{ autoSubmitHandoff ? 'Enabled' : 'Disabled' }}</span></span>
              <span class="mt-1 block text-xs leading-5 text-zinc-400">When enabled, a standalone task run that exits successfully is sent to Hub automatically. Epic runs can also auto-submit each child when the Epic continuation setting below is enabled. Hub review is still required and this never auto-approves or merges work.</span>
            </span>
          </label>
          <label class="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#141b2d] bg-[#0c1220] p-3">
            <input class="mt-0.5" type="checkbox" :checked="autoContinueEpic" @change="emit('updateAutoContinueEpic', ($event.target as HTMLInputElement).checked)">
            <span>
              <span class="flex items-center gap-2"><b class="text-xs text-white font-['Space_Grotesk']">Continue Epic after each handoff</b><span class="rounded-full bg-purple-950/60 border border-purple-500/40 px-2 py-0.2 text-[10px] font-bold text-purple-300 font-mono inline-flex items-center justify-center">{{ autoContinueEpic ? 'Enabled' : 'Disabled' }}</span></span>
              <span class="mt-1 block text-xs leading-5 text-zinc-400">When enabled, an Epic starts the next dependency-ready task after the current local handoff is saved. Hub review/approval remains required; this setting never auto-approves or merges work.</span>
            </span>
          </label>
          <section class="mt-3 rounded-xl border border-[#141b2d] bg-[#0c1220] p-3">
            <div class="flex items-start gap-3">
              <input class="mt-0.5" type="checkbox" v-model="reviewEnabled" @change="saveAutoReview">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2"><b class="text-xs text-white font-['Space_Grotesk']">Automatic independent review loop</b><span class="rounded-full bg-amber-950/60 border border-amber-500/40 px-2 py-0.2 text-[10px] font-bold text-amber-300 font-mono inline-flex items-center justify-center">{{ reviewEnabled ? 'Enabled' : 'Disabled' }}</span></div>
                <p class="mt-1 text-xs leading-5 text-zinc-400">After the implementation agent finishes, Task Hub starts a separate reviewer session for the diff. You may use the same provider as implementation; it still runs as an isolated read-only review session. Requested changes are sent back automatically until the review passes or the limit is reached. Hub still requires human approval; nothing is auto-merged.</p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <label class="text-[11px] font-medium text-zinc-300">Reviewer session provider<select v-model="reviewProvider" class="cc-select mt-1 font-mono" @change="saveAutoReview"><option value="codex">Codex</option><option value="claude_code">Claude Code</option><option value="antigravity">Antigravity</option></select></label>
                  <label class="text-[11px] font-medium text-zinc-300">Max review rounds<select v-model.number="reviewMaxIterations" class="cc-select mt-1 font-mono" @change="saveAutoReview"><option :value="1">1 round</option><option :value="2">2 rounds</option><option :value="3">3 rounds</option><option :value="4">4 rounds</option><option :value="5">5 rounds</option></select></label>
                </div>
              </div>
            </div>
          </section>
          <div class="mt-4 rounded-xl border border-[#141b2d] bg-[#0c1220] p-3">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-bold text-white font-['Space_Grotesk']">Codex diagnostics via CAO</p><p class="mt-1 text-xs text-zinc-400">Kiểm tra Codex trong runtime CAO; Windows sandbox native không áp dụng cho phiên CAO.</p></div>
              <button class="cc-button shrink-0 text-xs" :disabled="diagnosticsLoading" @click="emit('runDiagnostics')">{{ diagnosticsLoading ? 'Checking…' : 'Run diagnostics' }}</button>
            </div>
            <div v-if="diagnostics" class="mt-3 text-xs">
              <p :class="diagnostics.ok ? 'text-[#00f5a0]' : 'text-amber-300'" class="font-mono">{{ diagnostics.summary }}{{ diagnostics.version ? ` · ${diagnostics.version}` : '' }}</p>
              <ul v-if="diagnostics.details?.length" class="mt-2 list-disc space-y-1 pl-4 text-zinc-400 font-mono text-[11px]"><li v-for="detail in diagnostics.details" :key="detail">{{ detail }}</li></ul>
            </div>
          </div>
        </section>

        <section class="border-t border-[#141b2d] pt-5">
          <div class="flex items-start justify-between gap-4">
            <div><h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">CAO provider runtime</h3><p class="mt-1 text-xs leading-5 text-zinc-400">Provider CLI được kiểm tra trong đúng runtime CAO (WSL hoặc native CAO). Task Hub không cài hay chạy provider native ngoài CAO.</p></div>
            <button class="cc-primary shrink-0 text-xs" :disabled="runtimeRepairing" @click="emit('repairRuntimes')">{{ runtimeRepairing ? 'Checking…' : 'Refresh CAO runtime' }}</button>
          </div>
          <div class="mt-3 space-y-2">
            <div v-for="runtime in agentRuntimes" :key="runtime.provider" class="flex items-start justify-between gap-3 rounded-xl border border-[#141b2d] bg-[#0c1220] px-3 py-2 text-xs">
              <div class="min-w-0"><p class="font-bold text-white font-mono">{{ runtime.label }}</p><p class="mt-1 truncate text-[11px] text-zinc-400 font-mono" :title="runtime.message">{{ runtime.message }}</p></div>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono inline-flex items-center justify-center" :class="runtime.status === 'ready' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : runtime.status === 'installing' ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300' : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'">{{ runtime.status === 'ready' ? 'Ready' : runtime.status === 'installing' ? 'Installing' : 'Needs fix' }}</span>
            </div>
            <p v-if="!agentRuntimes.length" class="rounded-xl border border-[#141b2d] bg-[#0c1220] px-3 py-2 text-xs text-zinc-500 font-mono">Checking local CLI availability…</p>
          </div>
        </section>

        <section class="border-t border-[#141b2d] pt-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">CAO Multi-Agent Orchestrator</h3>
              <p class="mt-1 text-xs leading-5 text-zinc-400">Điều phối tác nhân đa luồng (Supervisor - Worker) qua AWS Labs CLI Agent Orchestrator. Mọi phiên agent đều bắt buộc chạy qua CAO.</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono inline-flex items-center justify-center"
              :class="
                (caoReconnecting || caoStatus?.reconnecting)
                  ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                  : caoStatus?.available
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
              "
            >
              {{
                (caoReconnecting || caoStatus?.reconnecting)
                  ? 'Reconnecting…'
                  : caoStatus?.available
                    ? 'Active (CAO required)'
                    : 'Blocked (CAO unavailable)'
              }}
            </span>
          </div>
          <div class="mt-3 rounded-xl border border-[#141b2d] bg-[#0c1220] px-3.5 py-3 text-xs space-y-2.5">
            <div class="flex items-center justify-between text-zinc-300">
              <span class="font-medium text-white">Orchestrator Backend:</span>
              <span class="font-mono" :class="caoStatus?.available ? 'text-[#00f5a0]' : 'text-amber-300'">
                {{ (caoReconnecting || caoStatus?.reconnecting) ? 'Reconnecting to CAO daemon…' : caoStatus?.available ? `CAO CLI + daemon / Port ${caoStatus.port || 9889}` : 'CAO CLI or daemon unavailable' }}
              </span>
            </div>
            <div v-if="caoStatus?.source" class="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Daemon Source:</span>
              <span class="font-mono uppercase text-[#00f5d4]">{{ caoStatus.source }}</span>
            </div>
            <div v-if="caoStatus?.cli" class="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>CLI Executable:</span>
              <span class="font-mono truncate max-w-xs text-zinc-300" :title="caoStatus.cli">{{ caoStatus.cli }}</span>
            </div>
            <div v-if="caoStatus" class="grid grid-cols-2 gap-1.5 text-[11px]">
              <span v-for="check in [
                ['Health', caoStatus.health],
                ['Session API', caoStatus.sessionApi],
                ['Provider', caoStatus.provider],
                ['FIFO', caoStatus.fifo],
              ]" :key="check[0]" class="flex items-center justify-between rounded-lg bg-[#070b14] border border-[#141b2d] px-2.5 py-1 text-zinc-400 font-mono">
                <span>{{ check[0] }}</span>
                <b :class="check[1] === 'ok' ? 'text-[#00f5a0]' : check[1] === 'failed' ? 'text-rose-300' : 'text-amber-300'">{{ check[1] || 'unknown' }}</b>
              </span>
            </div>
            <p v-if="caoStatus?.lastError" class="text-[11px] text-rose-300/90 font-mono">{{ caoStatus.lastError }}</p>
            <div v-if="!caoStatus?.available && !(caoReconnecting || caoStatus?.reconnecting)" class="rounded-xl bg-rose-950/30 border border-rose-900/50 p-3 text-[11px] text-rose-200 space-y-1">
              <p class="font-bold text-rose-300 font-['Space_Grotesk']">Hướng dẫn khắc phục sự cố CAO (Troubleshooting):</p>
              <ul class="list-disc pl-4 space-y-0.5 text-zinc-400">
                <li>Đảm bảo WSL2 hoặc môi trường Python của CAO đã được cài đặt và kích hoạt.</li>
                <li>Khởi động daemon thủ công nếu cần: <code class="font-mono text-zinc-200">cao-server --port 9889</code></li>
                <li>Nhấn nút <b>Restart CAO daemon</b> bên dưới để tự động khởi tạo lại tiến trình.</li>
              </ul>
            </div>
            <button
              class="cc-button mt-3 text-xs"
              :disabled="caoReconnecting || caoStatus?.reconnecting"
              @click="emit('restartCao')"
            >
              {{ (caoReconnecting || caoStatus?.reconnecting) ? 'Restarting…' : 'Restart CAO daemon' }}
            </button>
          </div>
        </section>

      </main>
    </aside>
  </div>
</template>
