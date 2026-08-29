<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { Head, usePage } from '@inertiajs/vue3';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';
import WorkspaceBrand from '@/Components/layout/WorkspaceBrand.vue';
import UpgradeModal from '@/Components/billing/UpgradeModal.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';
import type {
  WorkspaceProps,
  WorkspaceOption,
  WorkspaceCredential,
  WorkspaceProjectOption,
  WorkspaceSecretsPageProps,
  CredentialProvider,
} from '@/types/workspace';

const props = withDefaults(
  defineProps<{
    workspace: WorkspaceProps;
    credentials: WorkspaceCredential[];
    canAccessVault: boolean;
    projects: WorkspaceProjectOption[];
    workspaces?: WorkspaceOption[];
    currentWorkspaceId?: number;
  }>(),
  {
    credentials: () => [],
    projects: () => [],
    workspaces: () => [],
    canAccessVault: false,
  }
);

const page = usePage<WorkspaceSecretsPageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const { openUpgradeModal, handleQuotaError } = useUpgradeModal();

// Theme State
const isDarkMode = ref(true);
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

// UI States
const isWorkspaceMenuOpen = ref(false);
const localCredentials = ref<WorkspaceCredential[]>([...props.credentials]);
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const activeFilter = ref<string>('all');
const searchQuery = ref('');
const selectedProjectFilter = ref<string>('all');

// Role helpers
const currentUserRole = computed(() => (props.workspace.user_role || 'developer').toLowerCase());
const isOwnerOrAdmin = computed(() => ['owner', 'admin'].includes(currentUserRole.value));
const canCreateSecret = computed(() => ['owner', 'admin', 'developer'].includes(currentUserRole.value));

// Reveal & Auto-hide Timer State
const revealedSecrets = ref<Record<number, { value: string; timer: any; secondsRemaining: number }>>({});
const revealingId = ref<number | null>(null);
const copiedSecretId = ref<number | null>(null);

// Add Secret Modal State
const isAddModalOpen = ref(false);
const isSaving = ref(false);
const showSecretInModal = ref(false);
const modalError = ref<string | null>(null);
const newSecretForm = ref({
  provider: 'openai' as CredentialProvider,
  name: '',
  secret_value: '',
  project_id: null as number | null,
});

// Delete State
const deletingSecretId = ref<number | null>(null);

// Clear active intervals on unmount
onUnmounted(() => {
  Object.values(revealedSecrets.value).forEach((item) => {
    if (item.timer) {
      clearInterval(item.timer);
    }
  });
});

// Provider color styling helper
const getProviderBadge = (provider: string) => {
  const p = provider.toLowerCase();
  if (p === 'openai') {
    return {
      name: 'OpenAI',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      tagBg: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
      icon: 'Cpu',
    };
  }
  if (p === 'anthropic') {
    return {
      name: 'Anthropic',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      tagBg: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
      icon: 'Sparkles',
    };
  }
  if (p === 'gemini') {
    return {
      name: 'Gemini',
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      tagBg: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
      icon: 'Zap',
    };
  }
  if (p === 'github') {
    return {
      name: 'GitHub',
      bg: 'bg-slate-800 text-slate-200 border-slate-700',
      tagBg: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: 'Code',
    };
  }
  return {
    name: provider.toUpperCase(),
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    tagBg: 'bg-purple-950/80 text-purple-400 border-purple-800/60',
    icon: 'Key',
  };
};

// Filtered credentials list
const filteredCredentials = computed(() => {
  return localCredentials.value.filter((cred) => {
    // Provider filter
    if (activeFilter.value !== 'all') {
      if (cred.provider.toLowerCase() !== activeFilter.value.toLowerCase()) {
        return false;
      }
    }

    // Project scope filter
    if (selectedProjectFilter.value === 'workspace_wide') {
      if (cred.project_id !== null && cred.project_id !== undefined) return false;
    } else if (selectedProjectFilter.value !== 'all') {
      const pid = parseInt(selectedProjectFilter.value, 10);
      if (cred.project_id !== pid) return false;
    }

    // Search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      const matchName = cred.name?.toLowerCase().includes(query);
      const matchProvider = cred.provider?.toLowerCase().includes(query);
      const matchFingerprint = cred.fingerprint?.toLowerCase().includes(query);
      const matchProject = cred.project_name?.toLowerCase().includes(query);
      return matchName || matchProvider || matchFingerprint || matchProject;
    }

    return true;
  });
});

// Provider counts for tabs
const providerCounts = computed(() => {
  const counts: Record<string, number> = {
    all: localCredentials.value.length,
    openai: 0,
    anthropic: 0,
    gemini: 0,
    github: 0,
    custom: 0,
  };

  localCredentials.value.forEach((cred) => {
    const p = cred.provider.toLowerCase();
    if (p in counts) {
      counts[p] += 1;
    } else {
      counts.custom += 1;
    }
  });

  return counts;
});

// Format date helper
const formatDate = (isoString?: string | null) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
};

// Trigger Upgrade Modal
const triggerUpgrade = () => {
  openUpgradeModal({
    resource: 'secrets',
    current_usage: localCredentials.value.length,
    limit: 0,
    current_plan: props.workspace.plan || 'community',
    suggested_plan: 'team',
    upgrade_url: `/workspaces/${props.workspace.id}/billing`,
    message: 'Team Credential Vault is only available on Team and Enterprise plans. Upgrade your plan to securely store and share API keys with autonomous AI agents.',
  });
};

// Toggle Reveal with 15-second auto-hide
const toggleReveal = async (cred: WorkspaceCredential) => {
  if (!isOwnerOrAdmin.value) {
    feedback.value = {
      type: 'error',
      message: 'Only workspace owners and admins are authorized to reveal secret values.',
    };
    return;
  }

  // If already revealed, hide immediately
  if (revealedSecrets.value[cred.id]) {
    if (revealedSecrets.value[cred.id].timer) {
      clearInterval(revealedSecrets.value[cred.id].timer);
    }
    delete revealedSecrets.value[cred.id];
    return;
  }

  revealingId.value = cred.id;
  feedback.value = null;

  try {
    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/credentials/${cred.id}/reveal`);
    if (res.data?.success && res.data.secret_value) {
      const rawSecret = res.data.secret_value;
      let seconds = 15;

      const intervalId = setInterval(() => {
        seconds -= 1;
        if (revealedSecrets.value[cred.id]) {
          revealedSecrets.value[cred.id].secondsRemaining = seconds;
        }
        if (seconds <= 0) {
          clearInterval(intervalId);
          delete revealedSecrets.value[cred.id];
        }
      }, 1000);

      revealedSecrets.value[cred.id] = {
        value: rawSecret,
        timer: intervalId,
        secondsRemaining: 15,
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || 'Unable to decrypt secret payload.',
    };
  } finally {
    revealingId.value = null;
  }
};

// Copy secret to clipboard
const copySecret = async (cred: WorkspaceCredential) => {
  try {
    let textToCopy = '';

    if (revealedSecrets.value[cred.id]) {
      textToCopy = revealedSecrets.value[cred.id].value;
    } else if (isOwnerOrAdmin.value) {
      const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/credentials/${cred.id}/reveal`);
      if (res.data?.success && res.data.secret_value) {
        textToCopy = res.data.secret_value;
      }
    }

    if (textToCopy && navigator.clipboard) {
      await navigator.clipboard.writeText(textToCopy);
      copiedSecretId.value = cred.id;
      setTimeout(() => {
        if (copiedSecretId.value === cred.id) {
          copiedSecretId.value = null;
        }
      }, 2500);
    } else {
      feedback.value = {
        type: 'error',
        message: 'Only workspace owners and admins can copy decrypted secret values.',
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: 'Failed to copy secret to clipboard.',
    };
  }
};

// Open Add Secret Modal
const openAddModal = () => {
  if (!props.canAccessVault) {
    triggerUpgrade();
    return;
  }
  if (!canCreateSecret.value) {
    feedback.value = {
      type: 'error',
      message: 'Viewers cannot create credentials in the Team Vault.',
    };
    return;
  }
  modalError.value = null;
  newSecretForm.value = {
    provider: 'openai',
    name: '',
    secret_value: '',
    project_id: null,
  };
  showSecretInModal.value = false;
  isAddModalOpen.value = true;
};

// Handle Save Secret
const handleSaveSecret = async () => {
  if (!newSecretForm.value.secret_value.trim() || !newSecretForm.value.provider) return;

  isSaving.value = true;
  modalError.value = null;
  feedback.value = null;

  try {
    const payload: any = {
      provider: newSecretForm.value.provider,
      name: newSecretForm.value.name.trim() || undefined,
      secret_value: newSecretForm.value.secret_value.trim(),
    };

    if (newSecretForm.value.project_id) {
      payload.project_id = newSecretForm.value.project_id;
    }

    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/credentials`, payload);

    if (res.data?.success && res.data.data) {
      const createdItem: WorkspaceCredential = res.data.data;
      // If an existing item was updated, replace it; otherwise prepend
      const existingIdx = localCredentials.value.findIndex((c) => c.id === createdItem.id);
      if (existingIdx >= 0) {
        localCredentials.value[existingIdx] = createdItem;
      } else {
        localCredentials.value.unshift(createdItem);
      }

      isAddModalOpen.value = false;
      feedback.value = {
        type: 'success',
        message: res.data.message || `✓ Credential '${createdItem.name}' saved securely.`,
      };
    }
  } catch (err: any) {
    const handled = handleQuotaError(err);
    if (!handled) {
      const msg = err.response?.data?.message || err.message || 'Failed to save credential.';
      modalError.value = msg;
    }
  } finally {
    isSaving.value = false;
  }
};

// Handle Delete Secret
const handleDeleteSecret = async (cred: WorkspaceCredential) => {
  if (!isOwnerOrAdmin.value) return;

  const confirmed = window.confirm(`Are you sure you want to permanently revoke and delete '${cred.name}'?`);
  if (!confirmed) return;

  deletingSecretId.value = cred.id;
  feedback.value = null;

  try {
    const res = await axios.delete(`/api/v1/workspaces/${props.workspace.id}/credentials/${cred.id}`);
    if (res.data?.success) {
      // Stop timer if revealed
      if (revealedSecrets.value[cred.id]?.timer) {
        clearInterval(revealedSecrets.value[cred.id].timer);
      }
      delete revealedSecrets.value[cred.id];

      localCredentials.value = localCredentials.value.filter((c) => c.id !== cred.id);
      feedback.value = {
        type: 'success',
        message: `✓ Credential '${cred.name}' removed from vault.`,
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || 'Unable to delete credential.',
    };
  } finally {
    deletingSecretId.value = null;
  }
};
</script>

<template>
  <Head :title="`${props.workspace.name} — Team Credential Vault`" />

  <div
    :class="[
      'min-h-screen font-sans transition-colors duration-150 selection:bg-cyan-500 selection:text-slate-950',
      isDarkMode ? 'dark bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900',
    ]"
  >
    <!-- Top Navigation Bar -->
    <header
      :class="[
        'sticky top-0 z-40 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4',
        isDarkMode ? 'bg-[#0c1220]/90 border-slate-800/80 text-white' : 'bg-white/90 border-slate-200 text-slate-900',
      ]"
    >
      <div class="flex items-center gap-3 min-w-0">
        <WorkspaceBrand :dark="isDarkMode" />
        <div class="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60 text-xs min-w-0 font-medium">
          <a href="/tasks" class="text-slate-400 hover:text-cyan-400 transition-colors">Workspace</a>
          <span class="text-slate-500">/</span>
          <span class="font-bold text-slate-200 truncate">{{ props.workspace.name }}</span>
          <span class="text-slate-500">/</span>
          <span class="text-cyan-400 font-bold">Team Secrets & Vault</span>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Workspace Switcher -->
        <div v-if="props.workspaces && props.workspaces.length > 1" class="relative">
          <button
            @click="isWorkspaceMenuOpen = !isWorkspaceMenuOpen"
            :class="[
              'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100',
            ]"
          >
            <Icons name="Layers" :size="14" />
            <span class="max-w-[120px] truncate">{{ props.workspace.name }}</span>
            <Icons name="ChevronDown" :size="12" />
          </button>

          <div
            v-if="isWorkspaceMenuOpen"
            :class="[
              'absolute right-0 mt-2 w-56 rounded-2xl border p-2 shadow-2xl z-50',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800',
            ]"
          >
            <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Workspace</div>
            <div class="mt-1 space-y-1">
              <a
                v-for="w in props.workspaces"
                :key="w.id"
                :href="`/workspaces/${w.id}/secrets`"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  w.id === props.workspace.id
                    ? isDarkMode
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                      : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                    : isDarkMode
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700',
                ]"
              >
                <span class="truncate">{{ w.name }}</span>
                <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{
                  w.plan || 'community'
                }}</span>
              </a>
            </div>
          </div>
        </div>

        <a
          :href="`/workspaces/${props.workspace.id}/billing`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Zap" :size="14" class="text-amber-400" />
          <span class="hidden md:inline">Billing & Quotas</span>
        </a>

        <a
          :href="`/workspaces/${props.workspace.id}/members`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Users" :size="14" class="text-emerald-400" />
          <span class="hidden md:inline">Members</span>
        </a>

        <a
          :href="`/workspaces/${props.workspace.id}/analytics`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="BarChart" :size="14" class="text-purple-400" />
          <span class="hidden md:inline">Analytics</span>
        </a>

        <a
          href="/tasks"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="LayoutGrid" :size="14" />
          <span class="hidden md:inline">Task Board</span>
        </a>

        <button
          @click="toggleTheme"
          :class="[
            'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs',
            isDarkMode
              ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50',
          ]"
          :title="isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <Icons :name="isDarkMode ? 'Sun' : 'Moon'" :size="15" />
        </button>

        <div v-if="user" class="flex items-center gap-2 pl-2 border-l border-slate-800">
          <img
            v-if="user.github_avatar_url"
            :src="user.github_avatar_url"
            alt="User Avatar"
            class="h-7 w-7 rounded-full border border-cyan-500/40 shadow-xs"
          />
          <span class="text-xs font-bold hidden lg:inline text-slate-300">@{{ user.github_login || user.name }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <!-- Title Header & Action Buttons -->
      <div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-display font-black tracking-tight text-white flex items-center gap-3">
              <span>Team Credential Vault</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
              >
                {{ props.workspace.name }}
              </span>
            </h1>
            <p class="mt-1 text-sm text-slate-400">
              Securely store, scope, and inject encrypted API keys and access tokens for autonomous AI agent runners.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              v-if="canCreateSecret"
              type="button"
              @click="openAddModal"
              class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Icons name="Plus" :size="16" />
              <span>Add New Secret</span>
            </button>

            <a
              :href="`/workspaces/${props.workspace.id}/billing`"
              class="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors py-2 px-3 rounded-xl bg-slate-900 border border-slate-800"
            >
              <span>Plan: {{ props.workspace.plan_name || props.workspace.plan || 'Community' }}</span>
              <Icons name="ArrowRight" :size="13" />
            </a>
          </div>
        </div>

        <!-- Feedback Alert Message -->
        <div
          v-if="feedback"
          :class="[
            'mt-4 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-md transition-all',
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <Icons :name="feedback.type === 'success' ? 'CheckCircle' : 'AlertTriangle'" :size="18" />
            <span>{{ feedback.message }}</span>
          </div>
          <button @click="feedback = null" class="text-slate-400 hover:text-white p-1 cursor-pointer">
            <Icons name="X" :size="14" />
          </button>
        </div>
      </div>

      <!-- Plan Upgrade Banner (When plan does not allow Team Vault) -->
      <section
        v-if="!props.canAccessVault"
        class="vault-upgrade-overlay bg-slate-900/90 backdrop-blur-md p-8 rounded-2xl border border-slate-800 text-center relative overflow-hidden shadow-2xl"
      >
        <div class="max-w-xl mx-auto space-y-4">
          <div class="h-16 w-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Icons name="Lock" :size="32" />
          </div>

          <h3 class="text-xl font-bold text-white mb-2">Team Credential Vault is a Team & Enterprise Feature</h3>

          <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Securely share encrypted API keys with your team, assign granular project scoping, and automate AI agent execution.
          </p>

          <div class="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              @click="triggerUpgrade"
              class="upgrade-btn bg-phantom-mint hover:bg-phantom-cyan text-slate-950 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Icons name="Zap" :size="16" />
              <span>Upgrade to Team Plan</span>
            </button>
            <a
              :href="`/workspaces/${props.workspace.id}/billing`"
              class="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors"
            >
              View Plan Features
            </a>
          </div>
        </div>
      </section>

      <!-- Active Vault Dashboard (When plan allows Team Vault) -->
      <template v-else>
        <!-- Metric Summary Cards -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Active Secrets -->
          <div class="rounded-3xl border border-slate-800 bg-[#0c1220] p-5 shadow-xl flex items-center justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Total Secrets</span>
              <div class="text-2xl font-display font-black text-white font-mono mt-1">{{ localCredentials.length }}</div>
              <span class="text-[11px] text-slate-500">Active in Workspace</span>
            </div>
            <div class="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Icons name="Key" :size="22" />
            </div>
          </div>

          <!-- Encryption Standard -->
          <div class="rounded-3xl border border-slate-800 bg-[#0c1220] p-5 shadow-xl flex items-center justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Encryption</span>
              <div class="text-xl font-display font-bold text-white font-mono mt-1">AES-256-CBC</div>
              <span class="text-[11px] text-emerald-400 font-semibold">Zero-Plaintext Storage</span>
            </div>
            <div class="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Icons name="Shield" :size="22" />
            </div>
          </div>

          <!-- Supported Providers -->
          <div class="rounded-3xl border border-slate-800 bg-[#0c1220] p-5 shadow-xl flex items-center justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">AI Providers</span>
              <div class="text-2xl font-display font-black text-white font-mono mt-1">5+</div>
              <span class="text-[11px] text-slate-500">OpenAI, Claude, Gemini, PATs</span>
            </div>
            <div class="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Icons name="Sparkles" :size="22" />
            </div>
          </div>

          <!-- User Role & Access -->
          <div class="rounded-3xl border border-slate-800 bg-[#0c1220] p-5 shadow-xl flex items-center justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Your Permission</span>
              <div class="text-base font-display font-bold uppercase text-white font-mono mt-1">
                {{ currentUserRole }}
              </div>
              <span class="text-[11px] text-cyan-400 font-semibold">
                {{ isOwnerOrAdmin ? 'Full Reveal & Delete' : canCreateSecret ? 'Write & Dispatch' : 'Read-Only' }}
              </span>
            </div>
            <div class="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Icons name="Lock" :size="22" />
            </div>
          </div>
        </section>

        <!-- Filter & Search Bar -->
        <section class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <!-- Provider Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              v-for="filter in [
                { key: 'all', label: 'All', count: providerCounts.all },
                { key: 'openai', label: 'OpenAI', count: providerCounts.openai },
                { key: 'anthropic', label: 'Anthropic', count: providerCounts.anthropic },
                { key: 'gemini', label: 'Gemini', count: providerCounts.gemini },
                { key: 'github', label: 'GitHub', count: providerCounts.github },
                { key: 'custom', label: 'Custom', count: providerCounts.custom },
              ]"
              :key="filter.key"
              @click="activeFilter = filter.key"
              :class="[
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                activeFilter === filter.key
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
              ]"
            >
              <span>{{ filter.label }}</span>
              <span
                :class="[
                  'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                  activeFilter === filter.key ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400',
                ]"
              >
                {{ filter.count }}
              </span>
            </button>
          </div>

          <!-- Search & Project Scope Filter -->
          <div class="flex items-center gap-2">
            <!-- Project Scope Selector -->
            <select
              v-if="props.projects && props.projects.length > 0"
              v-model="selectedProjectFilter"
              class="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Scopes</option>
              <option value="workspace_wide">Workspace-Wide Only</option>
              <option v-for="proj in props.projects" :key="proj.id" :value="proj.id.toString()">
                Project: {{ proj.title }}
              </option>
            </select>

            <!-- Search input -->
            <div class="relative min-w-[200px]">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search secrets..."
                class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
              <div class="absolute left-2.5 top-2 text-slate-500 pointer-events-none">
                <Icons name="Search" :size="13" />
              </div>
            </div>
          </div>
        </section>

        <!-- Secrets List Table -->
        <section class="rounded-3xl border border-slate-800 bg-[#0c1220] overflow-hidden shadow-xl">
          <div class="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 class="text-base font-bold font-display text-white flex items-center gap-2.5">
              <Icons name="Lock" :size="18" class="text-cyan-400" />
              <span>Configured Vault Secrets ({{ filteredCredentials.length }})</span>
            </h2>

            <span class="text-xs text-slate-400 font-mono">
              Auto-hide on reveal: 15s
            </span>
          </div>

          <!-- Empty Vault State -->
          <div
            v-if="filteredCredentials.length === 0"
            class="empty-vault text-center p-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl m-6"
          >
            <div class="text-3xl mb-3">🔐</div>
            <h4 class="text-lg font-semibold text-white mb-1">No credentials configured yet</h4>
            <p class="text-slate-400 text-sm mb-4 max-w-md mx-auto">
              Add your API keys to securely share with automated AI agents in this workspace.
            </p>
            <button
              v-if="canCreateSecret"
              type="button"
              @click="openAddModal"
              class="add-secret-btn bg-phantom-mint text-slate-950 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer shadow-md hover:bg-phantom-cyan transition-all"
            >
              + Add First Secret
            </button>
          </div>

          <!-- Secrets List / Table -->
          <div v-else class="vault-secrets-list p-6 space-y-3">
            <div
              v-for="cred in filteredCredentials"
              :key="cred.id"
              class="secret-card flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
            >
              <!-- Left side: Provider Badge, Name, Fingerprint, Scope -->
              <div class="flex items-center gap-3.5 min-w-0">
                <span
                  :class="[
                    'provider-tag uppercase font-bold text-xs px-2.5 py-1 rounded-lg border font-mono shrink-0 flex items-center gap-1.5',
                    getProviderBadge(cred.provider).bg,
                  ]"
                >
                  <Icons :name="getProviderBadge(cred.provider).icon" :size="12" />
                  <span>{{ cred.provider }}</span>
                </span>

                <div class="min-w-0">
                  <div class="font-medium text-slate-100 truncate flex items-center gap-2">
                    <span>{{ cred.name }}</span>
                    <span
                      v-if="cred.project_name"
                      class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 truncate"
                    >
                      Project: {{ cred.project_name }}
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/60 text-slate-400 border border-slate-800"
                    >
                      Workspace-Wide
                    </span>
                  </div>

                  <div class="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                    <span>{{ cred.fingerprint }}</span>
                    <span class="text-slate-600">·</span>
                    <span class="text-slate-500">Added {{ formatDate(cred.created_at) }}</span>
                  </div>
                </div>
              </div>

              <!-- Right side: Masked / Plaintext value, Countdown timer, Actions -->
              <div class="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                <!-- Secret Value Display (Masked or Revealed) -->
                <div class="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                  <span
                    v-if="revealedSecrets[cred.id]"
                    class="revealed-value font-mono text-cyan-300 text-xs select-all break-all max-w-[200px] sm:max-w-[280px] truncate"
                  >
                    {{ revealedSecrets[cred.id].value }}
                  </span>
                  <span v-else class="masked-value font-mono text-slate-300 text-sm tracking-wider">
                    {{ cred.masked_value || '••••••••' }}
                  </span>

                  <!-- Active Countdown Indicator -->
                  <span
                    v-if="revealedSecrets[cred.id]"
                    class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 shrink-0"
                    title="Auto-hiding timer"
                  >
                    {{ revealedSecrets[cred.id].secondsRemaining }}s
                  </span>
                </div>

                <!-- Reveal Toggle Button -->
                <button
                  v-if="isOwnerOrAdmin"
                  type="button"
                  @click="toggleReveal(cred)"
                  :disabled="revealingId === cred.id"
                  :class="[
                    'reveal-btn p-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-50',
                    revealedSecrets[cred.id]
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700',
                  ]"
                  :title="revealedSecrets[cred.id] ? 'Hide Secret' : 'Reveal Secret'"
                >
                  <Icons v-if="revealingId === cred.id" name="Loader" :size="15" class="animate-spin" />
                  <Icons v-else :name="revealedSecrets[cred.id] ? 'EyeOff' : 'Eye'" :size="15" />
                </button>

                <!-- Copy to Clipboard Button -->
                <button
                  type="button"
                  @click="copySecret(cred)"
                  :class="[
                    'copy-btn p-2 rounded-lg border transition-colors cursor-pointer relative',
                    copiedSecretId === cred.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700',
                  ]"
                  :title="copiedSecretId === cred.id ? 'Copied!' : 'Copy to Clipboard'"
                >
                  <Icons v-if="copiedSecretId === cred.id" name="Check" :size="15" class="text-emerald-400" />
                  <Icons v-else name="Copy" :size="15" />

                  <!-- Copied tooltip popup -->
                  <span
                    v-if="copiedSecretId === cred.id"
                    class="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 shadow-md whitespace-nowrap"
                  >
                    Copied!
                  </span>
                </button>

                <!-- Delete / Revoke Button -->
                <button
                  v-if="isOwnerOrAdmin"
                  type="button"
                  @click="handleDeleteSecret(cred)"
                  :disabled="deletingSecretId === cred.id"
                  class="delete-btn p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 hover:border-rose-800/40 transition-colors cursor-pointer disabled:opacity-50"
                  title="Revoke & Delete Secret"
                >
                  <Icons v-if="deletingSecretId === cred.id" name="Loader" :size="15" class="animate-spin" />
                  <Icons v-else name="Trash2" :size="15" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Security & Best Practices Informational Card -->
        <section class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 shadow-xl">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Icons name="Shield" :size="16" class="text-cyan-400" />
            <span>Vault Security Architecture</span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span class="text-xs font-extrabold uppercase font-mono text-cyan-400 block">AES-256 Cryptography</span>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                Secrets are encrypted before database insertion using application-level cryptographic keys. Raw tokens are never stored in log files or plaintext.
              </p>
            </div>

            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span class="text-xs font-extrabold uppercase font-mono text-emerald-400 block">SHA-256 Fingerprinting</span>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                Unique cryptographic hashes ensure fast verification and identity validation without ever decrypting keys in transit.
              </p>
            </div>

            <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <span class="text-xs font-extrabold uppercase font-mono text-purple-400 block">Granular Scoping</span>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                Assign secrets workspace-wide or isolate keys to specific project repositories to prevent cross-project credential exposure.
              </p>
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- Add Secret Modal Dialog -->
    <div
      v-if="isAddModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      @click.self="isAddModalOpen = false"
    >
      <div class="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0c1220] p-6 sm:p-8 shadow-2xl space-y-5 relative">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Icons name="Key" :size="18" />
            </div>
            <div>
              <h3 class="text-lg font-bold font-display text-white">Add New Team Secret</h3>
              <p class="text-xs text-slate-400">Store and encrypt an API key for AI task execution</p>
            </div>
          </div>

          <button
            @click="isAddModalOpen = false"
            class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Icons name="X" :size="18" />
          </button>
        </div>

        <div
          v-if="modalError"
          class="p-3.5 rounded-xl border border-rose-500/50 bg-rose-950/60 text-rose-300 text-xs font-semibold flex items-center gap-2"
        >
          <Icons name="AlertTriangle" :size="16" />
          <span>{{ modalError }}</span>
        </div>

        <form @submit.prevent="handleSaveSecret" class="space-y-4">
          <!-- Provider Selector -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Provider / Credential Type
            </label>
            <select
              v-model="newSecretForm.provider"
              required
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              <option value="openai">OpenAI (GPT-4o, o1, o3-mini)</option>
              <option value="anthropic">Anthropic (Claude 3.7 Sonnet, Claude 3.5)</option>
              <option value="gemini">Google Gemini (Gemini 2.5 Flash, Pro)</option>
              <option value="github">GitHub Token (Fine-Grained PAT)</option>
              <option value="custom">Custom API Key / Endpoint Token</option>
            </select>
          </div>

          <!-- Credential Name -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Key Name / Description
            </label>
            <input
              v-model="newSecretForm.name"
              type="text"
              placeholder="e.g. Production Gemini 2.5 Flash Key"
              required
              class="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <!-- Secret Value -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Secret Value / API Key
              </label>
              <button
                type="button"
                @click="showSecretInModal = !showSecretInModal"
                class="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {{ showSecretInModal ? 'Hide Secret' : 'Show Secret' }}
              </button>
            </div>
            <div class="relative">
              <input
                v-if="!showSecretInModal"
                v-model="newSecretForm.secret_value"
                type="password"
                placeholder="sk-proj-..."
                required
                class="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
              <textarea
                v-else
                v-model="newSecretForm.secret_value"
                rows="3"
                placeholder="Paste raw secret token or certificate..."
                required
                class="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          <!-- Project Scope Selector -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Project Scoping
            </label>
            <select
              v-model="newSecretForm.project_id"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              <option :value="null">Workspace Wide (Available to all projects)</option>
              <option v-for="proj in props.projects" :key="proj.id" :value="proj.id">
                Project: {{ proj.title }}
              </option>
            </select>
          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              @click="isAddModalOpen = false"
              class="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="isSaving || !newSecretForm.secret_value.trim()"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons v-if="isSaving" name="Loader" :size="16" class="animate-spin" />
              <Icons v-else name="ShieldCheck" :size="16" />
              <span>{{ isSaving ? 'Encrypting & Saving...' : 'Save Encrypted Secret' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Global Upgrade Modal Teleport -->
    <UpgradeModal />
  </div>
</template>
