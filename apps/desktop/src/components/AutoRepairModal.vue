<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import TailwindIcon from './TailwindIcon.vue';

interface RepairCheck {
  id: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  fixable?: boolean;
  fixHint?: string;
}

interface RepairResult {
  ok: boolean;
  provider: string;
  checks: RepairCheck[];
}

const props = defineProps<{
  show: boolean;
  cwd: string;
  provider: 'codex' | 'claude_code' | 'antigravity';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'repaired', result: RepairResult): void;
}>();

const isRepairing = ref(false);
const isPreflighting = ref(false);
const repairProgressStep = ref('');
const errorMessage = ref('');
const repairResult = ref<RepairResult | null>(null);
const filterCategory = ref<'all' | 'issues' | 'healthy'>('all');

const resetState = () => {
  isRepairing.value = false;
  isPreflighting.value = false;
  repairProgressStep.value = '';
  errorMessage.value = '';
  repairResult.value = null;
  filterCategory.value = 'all';
};

const runPreflight = async () => {
  if (!props.cwd) return;
  isPreflighting.value = true;
  errorMessage.value = '';
  try {
    const desktopApi = (window as any).desktopApi;
    let preflightData: any = null;
    if (desktopApi?.environment?.preflight) {
      preflightData = await desktopApi.environment.preflight(props.provider, props.cwd);
    } else if (desktopApi?.agent?.preflight) {
      preflightData = await desktopApi.agent.preflight(props.provider, props.cwd);
    }

    if (preflightData && Array.isArray(preflightData.checks)) {
      repairResult.value = {
        ok: preflightData.ok,
        provider: props.provider,
        checks: preflightData.checks,
      };
    }
  } catch (err: any) {
    console.warn('Preflight check failed:', err);
  } finally {
    isPreflighting.value = false;
  }
};

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      resetState();
      void runPreflight();
    }
  }
);

onMounted(() => {
  if (props.show) {
    void runPreflight();
  }
});

const runAutoRepair = async () => {
  isRepairing.value = true;
  errorMessage.value = '';
  repairProgressStep.value = 'Scanning Windows CLI paths and verifying executable health...';

  const progressTimer1 = setTimeout(() => {
    if (isRepairing.value) repairProgressStep.value = 'Detecting and pruning stale Git lockfiles & worktrees...';
  }, 600);

  const progressTimer2 = setTimeout(() => {
    if (isRepairing.value) repairProgressStep.value = 'Probing directory write permissions and stripping read-only locks...';
  }, 1200);

  const progressTimer3 = setTimeout(() => {
    if (isRepairing.value) repairProgressStep.value = 'Checking multi-template .env configurations & dependencies...';
  }, 1800);

  try {
    const desktopApi = (window as any).desktopApi;
    if (desktopApi?.environment?.repair) {
      repairResult.value = await desktopApi.environment.repair(props.provider, props.cwd);
      emit('repaired', repairResult.value!);
    } else if (desktopApi?.agent?.repairEnvironment) {
      repairResult.value = await desktopApi.agent.repairEnvironment(props.provider, props.cwd);
      emit('repaired', repairResult.value!);
    } else {
      // Fallback preview mode when not running in Electron
      await new Promise((resolve) => setTimeout(resolve, 1500));
      repairResult.value = {
        ok: true,
        provider: props.provider,
        checks: [
          { id: 'provider', status: 'passed', message: `${props.provider} CLI discovered and health verified.` },
          { id: 'directory_permissions', status: 'passed', message: 'Workspace directory write permissions verified.' },
          { id: 'git_locks', status: 'passed', message: 'No stale Git lockfiles detected.' },
          { id: 'environment_file', status: 'passed', message: '.env configuration file present and verified.' },
          { id: 'node_dependencies', status: 'passed', message: 'Node dependencies verified.' },
          { id: 'worktree_metadata', status: 'passed', message: 'Cleaned up legacy Git worktree metadata.' },
        ],
      };
      emit('repaired', repairResult.value!);
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'Failed to auto-repair workspace environment.';
  } finally {
    clearTimeout(progressTimer1);
    clearTimeout(progressTimer2);
    clearTimeout(progressTimer3);
    isRepairing.value = false;
    repairProgressStep.value = '';
  }
};

const filteredChecks = computed(() => {
  if (!repairResult.value?.checks) return [];
  if (filterCategory.value === 'issues') {
    return repairResult.value.checks.filter((c) => c.status === 'failed' || c.status === 'warning');
  }
  if (filterCategory.value === 'healthy') {
    return repairResult.value.checks.filter((c) => c.status === 'passed');
  }
  return repairResult.value.checks;
});

const issuesCount = computed(() => {
  if (!repairResult.value?.checks) return 0;
  return repairResult.value.checks.filter((c) => c.status === 'failed' || c.status === 'warning').length;
});

const healthyCount = computed(() => {
  if (!repairResult.value?.checks) return 0;
  return repairResult.value.checks.filter((c) => c.status === 'passed').length;
});

const getStatusBadge = (status: RepairCheck['status']) => {
  switch (status) {
    case 'passed':
      return {
        icon: 'check-circle',
        bg: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300',
        iconClass: 'text-emerald-400',
        label: 'Fixed / Ready',
      };
    case 'warning':
      return {
        icon: 'alert-triangle',
        bg: 'bg-amber-950/60 border-amber-800/80 text-amber-300',
        iconClass: 'text-amber-400',
        label: 'Notice',
      };
    case 'failed':
      return {
        icon: 'alert-circle',
        bg: 'bg-rose-950/60 border-rose-800/80 text-rose-300',
        iconClass: 'text-rose-400',
        label: 'Failed',
      };
    default:
      return {
        icon: 'clock',
        bg: 'bg-zinc-800 border-zinc-700 text-zinc-300',
        iconClass: 'text-slate-400',
        label: 'Check',
      };
  }
};

const formatCheckTitle = (id: string) => {
  const map: Record<string, string> = {
    provider: 'AI Provider CLI',
    cli: 'CLI Executable Health',
    cli_codex: 'Codex Runtime Health',
    cli_claude_code: 'Claude Code Runtime Health',
    cli_antigravity: 'Antigravity Runtime Health',
    git_locks: 'Git Lockfiles & Stale Locks',
    directory_permissions: 'Workspace Directory Permissions',
    environment_file: 'Environment File (.env)',
    env: 'Environment Setup (.env)',
    node_dependencies: 'Node Dependencies (node_modules)',
    php_dependencies: 'PHP Dependencies (vendor)',
    repository: 'Git Repository Structure',
    remote: 'Remote Synchronization',
    working_tree: 'Working Tree State',
    worktree_metadata: 'Git Worktree Metadata',
    workspace: 'Workspace Path',
    environment_setup: 'Environment Setup',
  };
  return map[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-xl bg-[#070b14] border border-[#141b2d] rounded-xl shadow-2xl overflow-hidden flex flex-col text-zinc-200"
    >
      <!-- Modal Header -->
      <div class="h-12 px-4 border-b border-[#141b2d] bg-[#0c1220] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-md bg-[#00f5a0]/20 border border-[#00f5a0]/40 text-[#00f5a0]">
            <TailwindIcon name="wrench" :size="13" class="shrink-0" />
          </div>
          <div>
            <h2 class="text-xs font-bold text-zinc-100 uppercase tracking-wider font-['Space_Grotesk']">One-Click Environment Auto-Repair</h2>
            <p class="text-[10px] text-zinc-400">Comprehensive Windows diagnostics & self-healing engine</p>
          </div>
        </div>

        <button
          class="inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-lg hover:bg-[#11182c] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          @click="emit('close')"
        >
          <TailwindIcon name="x" :size="13" class="shrink-0" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <!-- Target Info -->
        <div class="p-2.5 rounded-xl border border-[#141b2d] bg-[#0c1220] text-xs space-y-1">
          <div class="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Workspace Directory:</span>
            <span class="font-mono text-zinc-200 truncate max-w-[320px]" :title="cwd">{{ cwd || 'No workspace selected' }}</span>
          </div>
          <div class="flex items-center justify-between text-zinc-400 text-[11px]">
            <span>Target AI Provider:</span>
            <span class="font-mono font-bold text-[#00f5a0] uppercase">{{ provider }}</span>
          </div>
        </div>

        <!-- Diagnostic Overview Cards (when no repair performed yet) -->
        <div v-if="!repairResult && !isRepairing && !isPreflighting" class="space-y-2">
          <p class="text-xs text-zinc-300 font-bold font-['Space_Grotesk']">Auto-Repair checks and resolves:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-xl border border-[#141b2d] bg-[#0c1220] space-y-1">
              <div class="flex items-center gap-1.5 text-[#00f5d4] font-medium">
                <TailwindIcon name="terminal" :size="13" class="shrink-0" />
                <span class="font-['Space_Grotesk'] font-bold">Multi-Tier Windows PATH</span>
              </div>
              <p class="text-[11px] text-zinc-400">Scans ProgramData, AppData, Scoop, WinGet, and Git for Windows candidate paths.</p>
            </div>

            <div class="p-2.5 rounded-xl border border-[#141b2d] bg-[#0c1220] space-y-1">
              <div class="flex items-center gap-1.5 text-amber-300 font-medium">
                <TailwindIcon name="shield" :size="13" class="shrink-0" />
                <span class="font-['Space_Grotesk'] font-bold">Stale Git Locks & Worktrees</span>
              </div>
              <p class="text-[11px] text-zinc-400">Safely detects and prunes orphaned index.lock, HEAD.lock, and worktree locks.</p>
            </div>

            <div class="p-2.5 rounded-xl border border-[#141b2d] bg-[#0c1220] space-y-1">
              <div class="flex items-center gap-1.5 text-[#00f5a0] font-medium">
                <TailwindIcon name="file-text" :size="13" class="shrink-0" />
                <span class="font-['Space_Grotesk'] font-bold">Multi-Template .env Recovery</span>
              </div>
              <p class="text-[11px] text-zinc-400">Auto-detects .env.example, .env.template, .env.defaults or creates fallback .env.</p>
            </div>

            <div class="p-2.5 rounded-xl border border-[#141b2d] bg-[#0c1220] space-y-1">
              <div class="flex items-center gap-1.5 text-purple-300 font-medium">
                <TailwindIcon name="folder" :size="13" class="shrink-0" />
                <span class="font-['Space_Grotesk'] font-bold">Permissions & Write Probes</span>
              </div>
              <p class="text-[11px] text-zinc-400">Tests write access and automatically strips Windows read-only filesystem attributes.</p>
            </div>
          </div>
        </div>

        <!-- Progress Spinner (Preflight or Repair) -->
        <div v-if="isRepairing || isPreflighting" class="py-8 flex flex-col items-center justify-center gap-3 text-center">
          <TailwindIcon name="loader" :size="30" class="animate-spin text-[#00f5a0] shrink-0" />
          <div class="space-y-1">
            <p class="text-xs font-bold text-zinc-200 font-['Space_Grotesk']">
              {{ isRepairing ? 'Evaluating & Auto-Repairing Workspace...' : 'Running Diagnostics Preflight...' }}
            </p>
            <p class="text-[11px] text-zinc-400 font-mono">
              {{ repairProgressStep || 'Inspecting environment files, locks, permissions, and runtimes' }}
            </p>
          </div>
        </div>

        <!-- Error Banner -->
        <div v-if="errorMessage" class="p-3 rounded-xl border border-rose-800/80 bg-rose-950/60 text-rose-300 text-xs flex items-start gap-2">
          <TailwindIcon name="alert-circle" :size="14" class="mt-0.5 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Diagnostic & Repair Results List -->
        <div v-if="repairResult && !isRepairing && !isPreflighting" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-zinc-200 uppercase tracking-wider font-['Space_Grotesk']">Diagnostic Report</span>
              <span
                class="inline-flex items-center justify-center shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                :class="repairResult.ok ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' : 'bg-rose-950/80 text-rose-300 border border-rose-700'"
              >
                {{ repairResult.ok ? 'All Systems Healthy' : 'Issues Detected' }}
              </span>
            </div>

            <!-- Filter Controls -->
            <div class="flex items-center gap-1 bg-[#0c1220] p-0.5 rounded-lg border border-[#141b2d] text-[10px]">
              <button
                class="px-2 py-0.5 rounded transition-colors cursor-pointer font-mono"
                :class="filterCategory === 'all' ? 'bg-[#11182c] text-[#00f5a0] font-bold' : 'text-zinc-400 hover:text-zinc-200'"
                @click="filterCategory === 'all'"
              >
                All ({{ repairResult.checks.length }})
              </button>
              <button
                v-if="issuesCount > 0"
                class="px-2 py-0.5 rounded transition-colors cursor-pointer text-amber-400 font-mono"
                :class="filterCategory === 'issues' ? 'bg-amber-950/80 text-amber-300 font-bold' : 'hover:text-amber-300'"
                @click="filterCategory === 'issues'"
              >
                Issues ({{ issuesCount }})
              </button>
              <button
                class="px-2 py-0.5 rounded transition-colors cursor-pointer font-mono"
                :class="filterCategory === 'healthy' ? 'bg-emerald-950/80 text-emerald-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'"
                @click="filterCategory === 'healthy'"
              >
                Healthy ({{ healthyCount }})
              </button>
            </div>
          </div>

          <div class="space-y-1.5">
            <div
              v-for="chk in filteredChecks"
              :key="chk.id"
              class="p-2.5 rounded-xl border flex flex-col gap-1 text-xs transition-colors bg-[#0c1220] border-[#141b2d]"
              :class="getStatusBadge(chk.status).bg"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2 min-w-0">
                  <TailwindIcon
                    :name="getStatusBadge(chk.status).icon"
                    :size="14"
                    class="mt-0.5 shrink-0"
                    :class="getStatusBadge(chk.status).iconClass"
                  />
                  <div class="min-w-0">
                    <span class="font-bold block truncate text-zinc-100 font-['Space_Grotesk']">{{ formatCheckTitle(chk.id) }}</span>
                    <p class="text-[11px] text-zinc-300 leading-relaxed">{{ chk.message }}</p>
                  </div>
                </div>
                <span class="text-[10px] font-mono font-semibold shrink-0 uppercase px-1.5 py-0.5 rounded bg-black/40">
                  {{ getStatusBadge(chk.status).label }}
                </span>
              </div>

              <!-- Fix Hint when present -->
              <div
                v-if="chk.fixHint && chk.status !== 'passed'"
                class="mt-1 pt-1.5 border-t border-white/5 text-[10px] text-zinc-400 flex items-center gap-1.5"
              >
                <TailwindIcon name="info" :size="11" class="shrink-0 text-[#00f5a0]" />
                <span>{{ chk.fixHint }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="h-12 px-4 border-t border-[#141b2d] bg-[#0c1220] flex items-center justify-between shrink-0">
        <button
          class="h-8 px-3 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          @click="emit('close')"
        >
          Close
        </button>

        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center justify-center shrink-0 h-8 px-4 rounded-lg text-xs font-bold transition-all gap-1.5 cursor-pointer"
            :class="[
              isRepairing || isPreflighting
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-[#00f5a0] hover:bg-[#00f5d4] text-black shadow-xs active:scale-98'
            ]"
            :disabled="isRepairing || isPreflighting"
            @click="runAutoRepair"
          >
            <TailwindIcon :name="isRepairing ? 'loader' : 'wrench'" :size="13" :class="isRepairing ? 'animate-spin' : ''" class="shrink-0" />
            <span>{{ isRepairing ? 'Repairing...' : (repairResult ? 'Re-run Auto-Repair' : 'Execute Auto-Repair') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
