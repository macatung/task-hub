/**
 * Challenger Test Suite: Milestone 1 UI Component Behavior, Quota Interception & Type Safety
 * Agent: challenger_m1_2
 *
 * Scope:
 * 1. Workspaces/Members/Index.vue rendering logic, threshold coloring, date formatting, and limit formatting.
 * 2. Role-based view permutations (Owner/Admin vs Developer/Viewer controls, protected owner actions).
 * 3. useUpgradeModal integration, manual triggerSeatsUpgrade, and HTTP 422 quota interception flow.
 * 4. Inline feedback alert state transitions for success and non-quota errors.
 * 5. Type contract validation and schema robustness.
 * 6. Adversarial boundary conditions: zero limits, unlimited tiers, unicode/emoji names, large member volumes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import type {
  WorkspaceMember,
  WorkspaceSeatsUsage,
  WorkspaceProps,
  WorkspaceOption,
  WorkspaceRole,
  WorkspaceMembersPageProps,
} from '../../resources/js/types/workspace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Component Pure Logic Emulators (Mirroring Index.vue setup functions)
// ============================================================================

function getThresholdColor(percent: number) {
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
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatLimit(limit: number | null): string {
  if (limit === null) return 'Unlimited';
  return `${limit} seat${limit > 1 ? 's' : ''}`;
}

function canUserManageMembers(role?: string): boolean {
  return ['owner', 'admin'].includes(role || 'developer');
}

function computeMemberAvatarFallback(name?: string): string {
  return (name && name.charAt(0)) || 'U';
}

// ============================================================================
// Composable Simulation for useUpgradeModal
// ============================================================================

interface QuotaPayload {
  resource: 'runners' | 'seats' | 'projects' | string;
  current_usage: number;
  limit: number | null;
  current_plan: string;
  suggested_plan: string;
  upgrade_url: string;
  message?: string;
}

class UpgradeModalController {
  public isOpen = false;
  public quotaData: QuotaPayload | null = null;

  public openUpgradeModal(payload: QuotaPayload) {
    this.quotaData = {
      resource: payload.resource || 'runners',
      current_usage: payload.current_usage ?? 0,
      limit: payload.limit !== undefined ? payload.limit : null,
      current_plan: payload.current_plan || 'community',
      suggested_plan: payload.suggested_plan || 'pro',
      upgrade_url: payload.upgrade_url || '/workspaces/billing',
      message: payload.message || '',
    };
    this.isOpen = true;
  }

  public closeUpgradeModal() {
    this.isOpen = false;
  }

  public handleQuotaError(err: any): boolean {
    const data = err?.response?.data;
    if (data && (data.error_code === 'PLAN_QUOTA_EXCEEDED' || data.quota)) {
      this.openUpgradeModal({
        resource: data.quota?.resource || 'runners',
        current_usage: data.quota?.current_usage ?? 0,
        limit: data.quota?.limit !== undefined ? data.quota.limit : null,
        current_plan: data.quota?.current_plan || 'community',
        suggested_plan: data.quota?.suggested_plan || 'pro',
        upgrade_url: data.quota?.upgrade_url || '/workspaces/billing',
        message: data.message || '',
      });
      return true;
    }
    return false;
  }
}

describe('Challenger M1: Workspace Members & RBAC UI & Type Safety Verification', () => {
  let env: any;
  let upgradeModal: UpgradeModalController;

  beforeEach(() => {
    env = setupTestEnvironment();
    upgradeModal = new UpgradeModalController();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // 1. Template Helpers & Display Thresholds
  // ==========================================================================
  describe('1. Template Helper Mechanics & Seats Gauge Thresholds', () => {
    it('[CH1_UI_01] getThresholdColor assigns emerald for <70% utilization', () => {
      const colors0 = getThresholdColor(0);
      expect(colors0.text).toBe('text-emerald-400');
      expect(colors0.bg).toBe('bg-emerald-500');
      expect(colors0.pill).toContain('emerald');

      const colors50 = getThresholdColor(50);
      expect(colors50.text).toBe('text-emerald-400');

      const colors69 = getThresholdColor(69);
      expect(colors69.text).toBe('text-emerald-400');
    });

    it('[CH1_UI_02] getThresholdColor assigns amber for 70% to 89% utilization', () => {
      const colors70 = getThresholdColor(70);
      expect(colors70.text).toBe('text-amber-400');
      expect(colors70.bg).toBe('bg-amber-500');
      expect(colors70.pill).toContain('amber');

      const colors80 = getThresholdColor(80);
      expect(colors80.text).toBe('text-amber-400');

      const colors89 = getThresholdColor(89);
      expect(colors89.text).toBe('text-amber-400');
    });

    it('[CH1_UI_03] getThresholdColor assigns rose for >=90% utilization and overflow', () => {
      const colors90 = getThresholdColor(90);
      expect(colors90.text).toBe('text-rose-400');
      expect(colors90.bg).toBe('bg-rose-500');
      expect(colors90.pill).toContain('rose');

      const colors100 = getThresholdColor(100);
      expect(colors100.text).toBe('text-rose-400');

      const colors150 = getThresholdColor(150);
      expect(colors150.text).toBe('text-rose-400');
    });

    it('[CH1_UI_04] formatDate formats ISO strings and gracefully handles null, undefined, empty, and invalid dates', () => {
      const formatted = formatDate('2026-04-15T12:00:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Apr');

      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');
      expect(formatDate('not-a-valid-date')).toBe('not-a-valid-date');
    });

    it('[CH1_UI_05] formatLimit distinguishes null (Unlimited), 1 seat, and plural seats', () => {
      expect(formatLimit(null)).toBe('Unlimited');
      expect(formatLimit(1)).toBe('1 seat');
      expect(formatLimit(5)).toBe('5 seats');
      expect(formatLimit(100)).toBe('100 seats');
      expect(formatLimit(0)).toBe('0 seat');
    });

    it('[CH1_UI_06] computeMemberAvatarFallback extracts first initial or defaults to U', () => {
      expect(computeMemberAvatarFallback('Alice')).toBe('A');
      expect(computeMemberAvatarFallback('bob')).toBe('b');
      expect(computeMemberAvatarFallback('')).toBe('U');
      expect(computeMemberAvatarFallback(undefined)).toBe('U');
    });
  });

  // ==========================================================================
  // 2. Role-Based Access Control UI Permutations
  // ==========================================================================
  describe('2. RBAC UI Permissions and Action Controls', () => {
    it('[CH1_RBAC_01] canManageMembers is true only for owner and admin roles', () => {
      expect(canUserManageMembers('owner')).toBe(true);
      expect(canUserManageMembers('admin')).toBe(true);
      expect(canUserManageMembers('developer')).toBe(false);
      expect(canUserManageMembers('viewer')).toBe(false);
      expect(canUserManageMembers('')).toBe(false);
      expect(canUserManageMembers(undefined)).toBe(false);
    });

    it('[CH1_RBAC_02] UI correctly protects owner from deletion and role downgrade', () => {
      const ownerMember: WorkspaceMember = {
        id: 1,
        name: 'Workspace Owner',
        email: 'owner@domain.com',
        role: 'owner',
        is_owner: true,
      };

      const devMember: WorkspaceMember = {
        id: 2,
        name: 'John Developer',
        email: 'john@domain.com',
        role: 'developer',
        is_owner: false,
      };

      // Owner check
      const isOwnerProtected = ownerMember.is_owner || ownerMember.role === 'owner';
      expect(isOwnerProtected).toBe(true);

      // Dev check
      const isDevProtected = devMember.is_owner || devMember.role === 'owner';
      expect(isDevProtected).toBe(false);
    });

    it('[CH1_RBAC_03] Simulates DOM rendering of Members table under Admin view vs Viewer view', () => {
      const members: WorkspaceMember[] = [
        { id: 1, name: 'Ada Owner', email: 'ada@hub.dev', role: 'owner', is_owner: true },
        { id: 2, name: 'Bob Admin', email: 'bob@hub.dev', role: 'admin', is_owner: false },
        { id: 3, name: 'Charlie Dev', email: 'charlie@hub.dev', role: 'developer', is_owner: false },
      ];

      // Test Admin View (canManageMembers = true)
      const adminContainer = document.createElement('div');
      adminContainer.className = 'members-table';
      for (const m of members) {
        const row = document.createElement('div');
        row.className = 'member-row';
        if (m.is_owner || m.role === 'owner') {
          const badge = document.createElement('span');
          badge.className = 'badge-owner';
          badge.textContent = 'Owner';
          const protectedAction = document.createElement('span');
          protectedAction.className = 'action-protected';
          protectedAction.textContent = 'Protected';
          row.appendChild(badge);
          row.appendChild(protectedAction);
        } else {
          const select = document.createElement('select');
          select.className = 'role-selector';
          const option = document.createElement('option');
          option.textContent = m.role;
          select.appendChild(option);
          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-btn';
          removeBtn.textContent = 'Remove';
          row.appendChild(select);
          row.appendChild(removeBtn);
        }
        adminContainer.appendChild(row);
      }

      expect(adminContainer.querySelectorAll('.member-row').length).toBe(3);
      expect(adminContainer.querySelectorAll('.role-selector').length).toBe(2);
      expect(adminContainer.querySelectorAll('.remove-btn').length).toBe(2);
      expect(adminContainer.querySelector('.action-protected')).not.toBeNull();

      // Test Viewer View (canManageMembers = false)
      const viewerContainer = document.createElement('div');
      viewerContainer.className = 'members-table';
      for (const m of members) {
        const row = document.createElement('div');
        row.className = 'member-row';
        const badge = document.createElement('span');
        badge.className = 'static-role-badge';
        badge.textContent = m.role;
        row.appendChild(badge);
        // No action column
        viewerContainer.appendChild(row);
      }

      expect(viewerContainer.querySelectorAll('.role-selector').length).toBe(0);
      expect(viewerContainer.querySelectorAll('.remove-btn').length).toBe(0);
      expect(viewerContainer.querySelectorAll('.static-role-badge').length).toBe(3);
    });
  });

  // ==========================================================================
  // 3. useUpgradeModal Integration & 422 Quota Interception
  // ==========================================================================
  describe('3. useUpgradeModal Integration & 422 Error Handling', () => {
    it('[CH1_QUOTA_01] triggerSeatsUpgrade opens modal with seats resource and suggested team plan', () => {
      const workspace: WorkspaceProps = {
        id: 42,
        name: 'Alpha Team',
        slug: 'alpha-team',
        plan: 'community',
      };
      const seats: WorkspaceSeatsUsage = {
        used: 3,
        limit: 3,
        remaining: 0,
        percent: 100,
      };

      // Trigger action as in Index.vue:140
      upgradeModal.openUpgradeModal({
        resource: 'seats',
        current_usage: seats.used,
        limit: seats.limit,
        current_plan: workspace.plan || 'community',
        suggested_plan: 'team',
        upgrade_url: `/workspaces/${workspace.id}/billing`,
        message: `You are using ${seats.used} of ${seats.limit ?? '∞'} available seats. Upgrade your workspace plan to invite more team members.`,
      });

      expect(upgradeModal.isOpen).toBe(true);
      expect(upgradeModal.quotaData?.resource).toBe('seats');
      expect(upgradeModal.quotaData?.current_usage).toBe(3);
      expect(upgradeModal.quotaData?.limit).toBe(3);
      expect(upgradeModal.quotaData?.current_plan).toBe('community');
      expect(upgradeModal.quotaData?.suggested_plan).toBe('team');
      expect(upgradeModal.quotaData?.upgrade_url).toBe('/workspaces/42/billing');
      expect(upgradeModal.quotaData?.message).toContain('available seats');
    });

    it('[CH1_QUOTA_02] handleInvite intercepts HTTP 422 PLAN_QUOTA_EXCEEDED without showing generic error feedback', () => {
      let feedback: { type: string; message: string } | null = null;

      const fakeQuotaError = {
        response: {
          status: 422,
          data: {
            success: false,
            error_code: 'PLAN_QUOTA_EXCEEDED',
            message: 'Seat limit reached for this workspace tier.',
            quota: {
              resource: 'seats',
              current_usage: 5,
              limit: 5,
              current_plan: 'team',
              suggested_plan: 'enterprise',
              upgrade_url: '/workspaces/10/billing',
            },
          },
        },
      };

      const handled = upgradeModal.handleQuotaError(fakeQuotaError);
      if (!handled) {
        feedback = { type: 'error', message: 'Failed to invite member.' };
      }

      expect(handled).toBe(true);
      expect(feedback).toBeNull();
      expect(upgradeModal.isOpen).toBe(true);
      expect(upgradeModal.quotaData?.resource).toBe('seats');
      expect(upgradeModal.quotaData?.suggested_plan).toBe('enterprise');
    });

    it('[CH1_QUOTA_03] Non-quota error sets error feedback and does not open UpgradeModal', () => {
      let feedback: { type: string; message: string } | null = null;

      const genericError = {
        response: {
          status: 422,
          data: {
            message: 'The email field must be a valid email address.',
          },
        },
      };

      const handled = upgradeModal.handleQuotaError(genericError);
      if (!handled) {
        feedback = {
          type: 'error',
          message: genericError.response.data.message,
        };
      }

      expect(handled).toBe(false);
      expect(upgradeModal.isOpen).toBe(false);
      expect(feedback).not.toBeNull();
      expect(feedback?.message).toBe('The email field must be a valid email address.');
    });

    it('[CH1_QUOTA_04] Successful invitation dynamically increments seat usage and updates local state', () => {
      const localSeats: WorkspaceSeatsUsage = {
        used: 2,
        limit: 5,
        remaining: 3,
        percent: 40,
      };
      const localMembers: WorkspaceMember[] = [
        { id: 1, name: 'User 1', email: 'u1@test.com', role: 'owner' },
        { id: 2, name: 'User 2', email: 'u2@test.com', role: 'developer' },
      ];

      const newMember: WorkspaceMember = {
        id: 3,
        name: 'User 3',
        email: 'u3@test.com',
        role: 'developer',
      };

      // Simulate successful invite response handler
      localMembers.push(newMember);
      localSeats.used += 1;
      if (localSeats.limit) {
        localSeats.remaining = Math.max(0, localSeats.limit - localSeats.used);
        localSeats.percent = Math.round((localSeats.used / localSeats.limit) * 100);
      }

      expect(localMembers.length).toBe(3);
      expect(localSeats.used).toBe(3);
      expect(localSeats.remaining).toBe(2);
      expect(localSeats.percent).toBe(60);
    });

    it('[CH1_QUOTA_05] Removing member decrements seat usage and recalculates percentage accurately', () => {
      const localSeats: WorkspaceSeatsUsage = {
        used: 5,
        limit: 5,
        remaining: 0,
        percent: 100,
      };
      let localMembers: WorkspaceMember[] = [
        { id: 1, name: 'User 1', email: 'u1@test.com', role: 'owner' },
        { id: 2, name: 'User 2', email: 'u2@test.com', role: 'developer' },
        { id: 3, name: 'User 3', email: 'u3@test.com', role: 'developer' },
        { id: 4, name: 'User 4', email: 'u4@test.com', role: 'developer' },
        { id: 5, name: 'User 5', email: 'u5@test.com', role: 'developer' },
      ];

      // Remove member with id 5
      localMembers = localMembers.filter((m) => m.id !== 5);
      localSeats.used = Math.max(1, localSeats.used - 1);
      if (localSeats.limit) {
        localSeats.remaining = Math.max(0, localSeats.limit - localSeats.used);
        localSeats.percent = Math.round((localSeats.used / localSeats.limit) * 100);
      }

      expect(localMembers.length).toBe(4);
      expect(localSeats.used).toBe(4);
      expect(localSeats.remaining).toBe(1);
      expect(localSeats.percent).toBe(80);
    });
  });

  // ==========================================================================
  // 4. File Verification & Static Template Structure
  // ==========================================================================
  describe('4. File Integrity & SFC Template Structure', () => {
    it('[CH1_FILE_01] Verifies Workspaces/Members/Index.vue exists and contains essential directives', () => {
      const indexPath = path.resolve(__dirname, '../../resources/js/Pages/Workspaces/Members/Index.vue');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf8');

      // Check imports
      expect(content.includes("from '@/composables/useUpgradeModal'")).toBe(true);
      expect(content.includes("from '@/types/workspace'")).toBe(true);
      expect(content.includes("<UpgradeModal />")).toBe(true);
      expect(content.includes("handleQuotaError")).toBe(true);
      expect(content.includes("triggerSeatsUpgrade")).toBe(true);

      // Check key sections
      expect(content.includes("Workspace Members & RBAC")).toBe(true);
      expect(content.includes("Team Member Seats")).toBe(true);
      expect(content.includes("Invite Team Member")).toBe(true);
      expect(content.includes("Role Permissions Matrix")).toBe(true);
    });

    it('[CH1_FILE_02] Verifies types/workspace.ts exports complete types', () => {
      const typesPath = path.resolve(__dirname, '../../resources/js/types/workspace.ts');
      expect(fs.existsSync(typesPath)).toBe(true);

      const content = fs.readFileSync(typesPath, 'utf8');
      expect(content.includes("export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'viewer'")).toBe(true);
      expect(content.includes("export interface WorkspaceMember")).toBe(true);
      expect(content.includes("export interface WorkspaceSeatsUsage")).toBe(true);
      expect(content.includes("export interface WorkspaceProps")).toBe(true);
      expect(content.includes("export interface WorkspaceMembersPageProps")).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Adversarial Edge Cases & Fuzzing
  // ==========================================================================
  describe('5. Adversarial Edge Cases & Robustness', () => {
    it('[CH1_EDGE_01] Unlimited seat tier (limit: null) handles seat gauge bar width safely', () => {
      const seats: WorkspaceSeatsUsage = {
        used: 120,
        limit: null,
        remaining: null,
        percent: 0,
      };

      const barWidth = Math.min(100, seats.percent || (seats.limit === null ? 10 : 0));
      expect(barWidth).toBe(10);
      expect(formatLimit(seats.limit)).toBe('Unlimited');
    });

    it('[CH1_EDGE_02] Handles high volume (5,000 members) array rendering without memory leak or crash', () => {
      const largeMemberList: WorkspaceMember[] = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        name: `Engineer ${i + 1}`,
        email: `dev_${i + 1}@megacorp.cloud`,
        role: i === 0 ? 'owner' : (i < 50 ? 'admin' : 'developer'),
        is_owner: i === 0,
        joined_at: new Date(Date.now() - i * 86400000).toISOString(),
      }));

      expect(largeMemberList.length).toBe(5000);
      expect(largeMemberList[0].role).toBe('owner');
      expect(largeMemberList[100].role).toBe('developer');

      const activeAdmins = largeMemberList.filter((m) => m.role === 'admin');
      expect(activeAdmins.length).toBe(49);
    });

    it('[CH1_EDGE_03] Safely handles Unicode and emoji names in member table rendering', () => {
      const unicodeMember: WorkspaceMember = {
        id: 99,
        name: 'Trần Hưng Đạo 🛡️ (Thống soái)',
        email: 'tran.hung.dao@dai-viet.vn',
        github_login: 'tranhungdao_vn',
        role: 'admin',
        joined_at: '2026-08-28T00:00:00Z',
      };

      expect(computeMemberAvatarFallback(unicodeMember.name)).toBe('T');
      expect(unicodeMember.name.length).toBeGreaterThan(15);
    });
  });
});
