<script setup lang="ts">
import { ref, computed } from 'vue';
import { Head, usePage } from '@inertiajs/vue3';
import axios from 'axios';
import Icons from '@/Components/ui/Icons.vue';
import WorkspaceBrand from '@/Components/layout/WorkspaceBrand.vue';
import UpgradeModal from '@/Components/billing/UpgradeModal.vue';
import { useUpgradeModal } from '@/composables/useUpgradeModal';
import type { WorkspaceMember, WorkspaceSeatsUsage, WorkspaceProps, WorkspaceOption, WorkspaceRole, WorkspaceMembersPageProps } from '@/types/workspace';

const props = withDefaults(
  defineProps<{
    workspace: WorkspaceProps;
    members: WorkspaceMember[];
    seats: WorkspaceSeatsUsage;
    workspaces?: WorkspaceOption[];
    currentWorkspaceId?: number;
  }>(),
  {
    members: () => [],
    workspaces: () => [],
  }
);

const page = usePage<WorkspaceMembersPageProps>();
const user = computed(() => page.props.auth?.user ?? null);
const { openUpgradeModal, handleQuotaError } = useUpgradeModal();

// Theme State
const isDarkMode = ref(true);
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
};

// UI States
const isWorkspaceMenuOpen = ref(false);
const localMembers = ref<WorkspaceMember[]>([...props.members]);
const localSeats = ref<WorkspaceSeatsUsage>({ ...props.seats });
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Invite Form State
const inviteInput = ref('');
const inviteRole = ref<WorkspaceRole>('developer');
const isInviting = ref(false);

// Active updating states
const updatingMemberId = ref<number | null>(null);
const deletingMemberId = ref<number | null>(null);

// Current User Role in Workspace
const currentUserRole = computed(() => props.workspace.user_role || 'developer');
const canManageMembers = computed(() => ['owner', 'admin'].includes(currentUserRole.value));

// Threshold coloring helper for Seats Gauge
const getThresholdColor = (percent: number) => {
  if (percent >= 90) {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500',
      border: 'border-rose-500/40',
      pill: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
  }
  if (percent >= 70) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500',
      border: 'border-amber-500/40',
      pill: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };
  }
  return {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    border: 'border-emerald-500/40',
    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
};

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

const formatLimit = (limit: number | null) => {
  if (limit === null) return 'Unlimited';
  return `${limit} seat${limit > 1 ? 's' : ''}`;
};

// Handle Member Invitation
const handleInvite = async () => {
  if (!inviteInput.value.trim() || isInviting.value) return;
  isInviting.value = true;
  feedback.value = null;

  try {
    const res = await axios.post(`/api/v1/workspaces/${props.workspace.id}/members`, {
      email_or_username: inviteInput.value.trim(),
      role: inviteRole.value,
    });

    if (res.data?.success) {
      if (res.data.data) {
        localMembers.value.push(res.data.data);
      }
      localSeats.value.used += 1;
      if (localSeats.value.limit) {
        localSeats.value.remaining = Math.max(0, localSeats.value.limit - localSeats.value.used);
        localSeats.value.percent = Math.round((localSeats.value.used / localSeats.value.limit) * 100);
      }
      inviteInput.value = '';
      feedback.value = {
        type: 'success',
        message: res.data.message || '✓ Member invited successfully.',
      };
    }
  } catch (err: any) {
    const handled = handleQuotaError(err);
    if (!handled) {
      feedback.value = {
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to invite member.',
      };
    }
  } finally {
    isInviting.value = false;
  }
};

// Trigger Upgrade Modal from seats card
const triggerSeatsUpgrade = () => {
  openUpgradeModal({
    resource: 'seats',
    current_usage: localSeats.value.used,
    limit: localSeats.value.limit,
    current_plan: props.workspace.plan || 'community',
    suggested_plan: 'team',
    upgrade_url: `/workspaces/${props.workspace.id}/billing`,
    message: `You are using ${localSeats.value.used} of ${localSeats.value.limit ?? '∞'} available seats. Upgrade your workspace plan to invite more team members.`,
  });
};

// Handle Role Change
const handleRoleChange = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
  if (member.role === newRole || updatingMemberId.value === member.id) return;
  updatingMemberId.value = member.id;
  feedback.value = null;

  try {
    const res = await axios.patch(`/api/v1/workspaces/${props.workspace.id}/members/${member.id}`, {
      role: newRole,
    });

    if (res.data?.success) {
      member.role = newRole;
      feedback.value = {
        type: 'success',
        message: `✓ Updated ${member.name}'s role to ${newRole}.`,
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || 'Unable to update role.',
    };
  } finally {
    updatingMemberId.value = null;
  }
};

// Handle Remove Member
const handleRemoveMember = async (member: WorkspaceMember) => {
  if (member.is_owner || member.role === 'owner') return;
  const confirmed = window.confirm(`Are you sure you want to remove ${member.name} from this workspace?`);
  if (!confirmed) return;

  deletingMemberId.value = member.id;
  feedback.value = null;

  try {
    const res = await axios.delete(`/api/v1/workspaces/${props.workspace.id}/members/${member.id}`);
    if (res.data?.success) {
      localMembers.value = localMembers.value.filter((m) => m.id !== member.id);
      localSeats.value.used = Math.max(1, localSeats.value.used - 1);
      if (localSeats.value.limit) {
        localSeats.value.remaining = Math.max(0, localSeats.value.limit - localSeats.value.used);
        localSeats.value.percent = Math.round((localSeats.value.used / localSeats.value.limit) * 100);
      }
      feedback.value = {
        type: 'success',
        message: `✓ Removed ${member.name} from workspace.`,
      };
    }
  } catch (err: any) {
    feedback.value = {
      type: 'error',
      message: err.response?.data?.message || 'Unable to remove member.',
    };
  } finally {
    deletingMemberId.value = null;
  }
};
</script>

<template>
  <Head :title="`${props.workspace.name} — Team Members & Access Control`" />

  <div
    :class="[
      'min-h-screen font-sans transition-colors duration-150 selection:bg-emerald-500 selection:text-slate-950',
      isDarkMode ? 'dark bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900'
    ]"
  >
    <!-- Top Navigation Bar -->
    <header
      :class="[
        'sticky top-0 z-40 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4',
        isDarkMode ? 'bg-[#0c1220]/90 border-slate-800/80 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
      ]"
    >
      <div class="flex items-center gap-3 min-w-0">
        <WorkspaceBrand :dark="isDarkMode" />
        <div class="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60 text-xs min-w-0 font-medium">
          <a href="/tasks" class="text-slate-400 hover:text-emerald-400 transition-colors">Workspace</a>
          <span class="text-slate-500">/</span>
          <span class="font-bold text-slate-200 truncate">{{ props.workspace.name }}</span>
          <span class="text-slate-500">/</span>
          <span class="text-emerald-400 font-bold">Team Members & RBAC</span>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Workspace Switcher -->
        <div v-if="props.workspaces && props.workspaces.length > 1" class="relative">
          <button
            @click="isWorkspaceMenuOpen = !isWorkspaceMenuOpen"
            :class="[
              'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
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
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            ]"
          >
            <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Workspace</div>
            <div class="mt-1 space-y-1">
              <a
                v-for="w in props.workspaces"
                :key="w.id"
                :href="`/workspaces/${w.id}/members`"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                  w.id === props.workspace.id
                    ? (isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-800 border border-emerald-200')
                    : (isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                ]"
              >
                <span class="truncate">{{ w.name }}</span>
                <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{{ w.plan || 'community' }}</span>
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
          :href="`/workspaces/${props.workspace.id}/secrets`"
          class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Icons name="Key" :size="14" class="text-cyan-400" />
          <span class="hidden md:inline">Team Secrets</span>
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
            isDarkMode ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
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
            class="h-7 w-7 rounded-full border border-emerald-500/40 shadow-xs"
          />
          <span class="text-xs font-bold hidden lg:inline text-slate-300">@{{ user.github_login || user.name }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <!-- Title & Feedback Alert -->
      <div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-display font-black tracking-tight text-white flex items-center gap-3">
              <span>Workspace Members & RBAC</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                {{ props.workspace.name }}
              </span>
            </h1>
            <p class="mt-1 text-sm text-slate-400">
              Manage member seats, invite developers or reviewers, and control role-based workspace permissions.
            </p>
          </div>

          <a
            :href="`/workspaces/${props.workspace.id}/billing`"
            class="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Plan: {{ props.workspace.plan_name || props.workspace.plan }}</span>
            <Icons name="ArrowRight" :size="14" />
          </a>
        </div>

        <div
          v-if="feedback"
          :class="[
            'mt-4 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-md transition-all',
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
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

      <!-- 1. Seat Capacity Gauge & Quick Stats -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <!-- Seat Gauge -->
        <div
          :class="[
            'rounded-3xl border bg-[#0c1220] p-6 relative overflow-hidden transition-all shadow-xl lg:col-span-2 flex flex-col justify-between',
            getThresholdColor(localSeats.percent).border
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Icons name="Sparkles" :size="20" />
              </div>
              <div>
                <h3 class="text-base font-bold font-display text-white">Team Member Seats</h3>
                <p class="text-xs text-slate-400">Enforced by your workspace's {{ props.workspace.plan || 'community' }} tier</p>
              </div>
            </div>

            <span
              :class="[
                'px-3 py-1 rounded-full text-xs font-bold border font-mono',
                getThresholdColor(localSeats.percent).pill
              ]"
            >
              {{ localSeats.percent }}% Used
            </span>
          </div>

          <div class="my-5">
            <div class="flex items-baseline justify-between mb-2">
              <span class="text-3xl font-display font-black text-white font-mono">
                {{ localSeats.used }}
                <span class="text-sm font-normal text-slate-400">/ {{ formatLimit(localSeats.limit) }}</span>
              </span>
              <span v-if="localSeats.remaining !== null" class="text-xs font-semibold text-slate-300">
                {{ localSeats.remaining }} seat{{ localSeats.remaining === 1 ? '' : 's' }} remaining
              </span>
            </div>

            <div class="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                :class="['h-full transition-all duration-500 rounded-full', getThresholdColor(localSeats.percent).bg]"
                :style="{ width: `${Math.min(100, localSeats.percent || (localSeats.limit === null ? 10 : 0))}%` }"
              />
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span>Need more collaboration seats for your team?</span>
            <button
              type="button"
              @click="triggerSeatsUpgrade"
              class="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
            >
              <span>Upgrade Plan</span>
              <Icons name="Zap" :size="13" />
            </button>
          </div>
        </div>

        <!-- Quick Summary Card -->
        <div class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Your Workspace Access</span>
            <div class="mt-2 flex items-center gap-2.5">
              <span class="px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {{ currentUserRole }}
              </span>
              <span class="text-xs text-slate-300 font-semibold">
                {{ canManageMembers ? 'Full Member Management' : 'Standard Contributor' }}
              </span>
            </div>
          </div>

          <p class="text-xs text-slate-400 leading-relaxed">
            Members can collaborate on tasks, dispatch AI coding sessions, and access connected project repositories based on their assigned role.
          </p>

          <div class="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Total Active Members</span>
            <span class="font-bold text-white font-mono">{{ localMembers.length }}</span>
          </div>
        </div>
      </section>

      <!-- 2. Invite New Member Section -->
      <section
        v-if="canManageMembers"
        class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 relative overflow-hidden shadow-xl"
      >
        <div class="flex items-center gap-3 mb-4">
          <div class="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Icons name="Mail" :size="18" />
          </div>
          <div>
            <h2 class="text-lg font-bold font-display text-white">Invite Team Member</h2>
            <p class="text-xs text-slate-400">Invite a collaborator by email address or GitHub username</p>
          </div>
        </div>

        <form @submit.prevent="handleInvite" class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div class="sm:col-span-6">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Email or GitHub Username
            </label>
            <div class="relative">
              <input
                v-model="inviteInput"
                type="text"
                placeholder="colleague@company.com or octocat"
                required
                class="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div class="sm:col-span-3">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Assigned Role
            </label>
            <select
              v-model="inviteRole"
              class="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-sm text-slate-100 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="developer">Developer (Run Agents & Edit)</option>
              <option value="admin">Admin (Manage Members & Settings)</option>
              <option value="viewer">Viewer (Read-Only Access)</option>
            </select>
          </div>

          <div class="sm:col-span-3">
            <button
              type="submit"
              :disabled="isInviting || !inviteInput.trim()"
              class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icons v-if="isInviting" name="Loader" :size="16" class="animate-spin" />
              <Icons v-else name="Send" :size="16" />
              <span>{{ isInviting ? 'Inviting...' : 'Send Invitation' }}</span>
            </button>
          </div>
        </form>
      </section>

      <!-- 3. Members List Table -->
      <section class="rounded-3xl border border-slate-800 bg-[#0c1220] overflow-hidden shadow-xl">
        <div class="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 class="text-base font-bold font-display text-white flex items-center gap-2.5">
            <Icons name="Users" :size="18" class="text-emerald-400" />
            <span>Workspace Members ({{ localMembers.length }})</span>
          </h2>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th class="py-3.5 px-6">Member</th>
                <th class="py-3.5 px-6">Role</th>
                <th class="py-3.5 px-6">Joined Date</th>
                <th class="py-3.5 px-6 text-right" v-if="canManageMembers">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80 text-sm">
              <tr
                v-for="member in localMembers"
                :key="member.id"
                class="hover:bg-slate-900/30 transition-colors"
              >
                <!-- Member Column -->
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="member.github_avatar_url"
                      :src="member.github_avatar_url"
                      :alt="member.name"
                      class="h-9 w-9 rounded-full border border-slate-700 object-cover"
                    />
                    <div
                      v-else
                      class="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs uppercase"
                    >
                      {{ (member.name && member.name.charAt(0)) || 'U' }}
                    </div>

                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-white">{{ member.name }}</span>
                        <span
                          v-if="user && user.id === member.id"
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        >
                          You
                        </span>
                      </div>
                      <div class="text-xs text-slate-400 flex items-center gap-2">
                        <span>{{ member.email }}</span>
                        <span v-if="member.github_login" class="text-slate-500 font-mono">@{{ member.github_login }}</span>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Role Column -->
                <td class="py-4 px-6">
                  <div v-if="member.is_owner || member.role === 'owner'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    <Icons name="Crown" :size="13" class="text-amber-400" />
                    <span>Owner</span>
                  </div>

                  <div v-else-if="!canManageMembers">
                    <span
                      :class="[
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold font-mono uppercase border',
                        member.role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                        member.role === 'developer' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      ]"
                    >
                      {{ member.role }}
                    </span>
                  </div>

                  <div v-else class="max-w-[150px]">
                    <select
                      :value="member.role"
                      @change="(e: any) => handleRoleChange(member, e.target.value as WorkspaceRole)"
                      :disabled="updatingMemberId === member.id"
                      class="px-2.5 py-1 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </td>

                <!-- Joined Date -->
                <td class="py-4 px-6 text-xs text-slate-400 font-mono">
                  {{ formatDate(member.joined_at) }}
                </td>

                <!-- Actions Column -->
                <td class="py-4 px-6 text-right" v-if="canManageMembers">
                  <button
                    v-if="!member.is_owner && member.role !== 'owner'"
                    type="button"
                    @click="handleRemoveMember(member)"
                    :disabled="deletingMemberId === member.id"
                    class="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove member"
                  >
                    <Icons v-if="deletingMemberId === member.id" name="Loader" :size="16" class="animate-spin" />
                    <Icons v-else name="X" :size="16" />
                  </button>
                  <span v-else class="text-xs text-slate-600 font-mono italic">Protected</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 4. Role Permissions Breakdown -->
      <section class="rounded-3xl border border-slate-800 bg-[#0c1220] p-6 sm:p-8 shadow-xl">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Icons name="Shield" :size="16" class="text-emerald-400" />
          <span>Role Permissions Matrix</span>
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-4">
            <span class="text-xs font-extrabold uppercase font-mono text-amber-400 block">Owner</span>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              Full control of the workspace. Only the Owner can delete the workspace, transfer ownership, and manage commercial invoices.
            </p>
          </div>

          <div class="rounded-2xl border border-purple-500/20 bg-slate-900/60 p-4">
            <span class="text-xs font-extrabold uppercase font-mono text-purple-400 block">Admin</span>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              Can invite new members, change member roles, revoke access, manage shared vault secrets, and update billing plans.
            </p>
          </div>

          <div class="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4">
            <span class="text-xs font-extrabold uppercase font-mono text-cyan-400 block">Developer</span>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              Can dispatch AI coding tasks, create and manage projects/sprints, attach PRDs, and pair desktop runner agents.
            </p>
          </div>

          <div class="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
            <span class="text-xs font-extrabold uppercase font-mono text-slate-400 block">Viewer</span>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              Read-only visibility across task boards, Gantt charts, agent run logs, and execution evidence. Cannot dispatch or edit.
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- Global Upgrade Modal Teleport -->
    <UpgradeModal />
  </div>
</template>
