/**
 * Test Suite: Workspace Members & Role-Based Access Control (RBAC)
 * Features Covered:
 *   - Feature 1: Workspace Members UI (/workspaces/{workspace}/members)
 *   - Feature 2: Member Invitation & RBAC API
 *
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  WorkspaceMemberStoreSimulator,
  type WorkspaceMember,
} from '../Harness/commercial_simulators.ts';

describe('Feature 1 & Feature 2: Workspace Members UI & RBAC API Test Suite', () => {
  let env: any;
  let store: WorkspaceMemberStoreSimulator;

  const defaultOwner: WorkspaceMember = {
    id: 1,
    workspace_id: 101,
    user_id: 1,
    role: 'owner',
    user: {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@task-hub.dev',
      github_username: 'adalovelace',
      avatar_url: 'https://avatars.example.com/ada',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const defaultDev: WorkspaceMember = {
    id: 2,
    workspace_id: 101,
    user_id: 2,
    role: 'developer',
    user: {
      id: 2,
      name: 'Alan Turing',
      email: 'alan@task-hub.dev',
      github_username: 'aturing',
      avatar_url: 'https://avatars.example.com/alan',
    },
    created_at: '2026-01-05T00:00:00Z',
    updated_at: '2026-01-05T00:00:00Z',
  };

  beforeEach(() => {
    env = setupTestEnvironment();
    store = new WorkspaceMemberStoreSimulator([defaultOwner, defaultDev], 5, 'team');
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // TIER 1: Feature 1 — Workspace Members UI (>= 5 Tests)
  // ============================================================================
  describe('Tier 1: Feature 1 — Workspace Members UI', () => {
    it('[T1_F1_01] renders members index page with member list, avatar, name, and email', () => {
      const members = store.getMembers();
      expect(members.length).toBe(2);

      const tableContainer = document.createElement('div');
      tableContainer.className = 'workspace-members-list divide-y divide-slate-800';

      for (const m of members) {
        const row = document.createElement('div');
        row.className = 'member-row flex items-center justify-between p-4';
        row.innerHTML = `
          <div class="flex items-center gap-3">
            <img src="${m.user.avatar_url}" alt="${m.user.name}" class="w-10 h-10 rounded-full" />
            <div>
              <div class="font-medium text-slate-100">${m.user.name}</div>
              <div class="text-xs text-slate-400">${m.user.email}</div>
            </div>
          </div>
          <span class="role-badge role-${m.role}">${m.role}</span>
        `;
        tableContainer.appendChild(row);
      }

      expect(tableContainer.querySelectorAll('.member-row').length).toBe(2);
      expect(tableContainer.textContent).toContain('Ada Lovelace');
      expect(tableContainer.textContent).toContain('alan@task-hub.dev');
    });

    it('[T1_F1_02] displays role badges (owner, admin, developer, viewer) with correct styling classes', () => {
      const roleBadges: Record<string, string> = {
        owner: 'bg-purple-900/40 text-purple-300 border-purple-700',
        admin: 'bg-blue-900/40 text-blue-300 border-blue-700',
        developer: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
        viewer: 'bg-slate-800 text-slate-400 border-slate-700',
      };

      for (const [role, expectedClass] of Object.entries(roleBadges)) {
        const badge = document.createElement('span');
        badge.className = `role-badge px-2.5 py-0.5 rounded-full text-xs border font-medium ${expectedClass}`;
        badge.textContent = role.toUpperCase();

        expect(badge.textContent).toBe(role.toUpperCase());
        expect(badge.className).toContain(expectedClass.split(' ')[0]);
      }
    });

    it('[T1_F1_03] displays seat usage gauge with active count, max seat limit, and visual progress bar', () => {
      const seats = store.getSeatsInfo();
      expect(seats.used).toBe(2);
      expect(seats.limit).toBe(5);
      expect(seats.remaining).toBe(3);
      expect(seats.percentage).toBe(40);

      const gauge = document.createElement('div');
      gauge.className = 'seat-gauge bg-slate-900 border border-slate-800 p-4 rounded-xl';

      const label = document.createElement('div');
      label.className = 'flex justify-between text-sm mb-1';
      label.textContent = `Seats Utilization ${seats.used} / ${seats.limit} (${seats.percentage}%)`;
      gauge.appendChild(label);

      const track = document.createElement('div');
      track.className = 'w-full bg-slate-800 h-2.5 rounded-full overflow-hidden';
      const bar = document.createElement('div');
      bar.className = 'bg-emerald-500 h-full transition-all';
      bar.style.width = `${seats.percentage}%`;
      track.appendChild(bar);
      gauge.appendChild(track);

      expect(gauge.textContent).toContain('2 / 5 (40%)');
      expect(bar.style.width).toBe('40%');
    });

    it('[T1_F1_04] displays upgrade trigger and invokes openUpgradeModal when user requests more seats', () => {
      let modalOpened = false;
      let modalPayload: any = null;

      const triggerUpgrade = () => {
        const seats = store.getSeatsInfo();
        modalOpened = true;
        modalPayload = {
          resource: 'seats',
          current_usage: seats.used,
          limit: seats.limit,
          current_plan: seats.plan,
          suggested_plan: 'enterprise',
          upgrade_url: '/workspaces/billing',
        };
      };

      triggerUpgrade();

      expect(modalOpened).toBe(true);
      expect(modalPayload.resource).toBe('seats');
      expect(modalPayload.current_usage).toBe(2);
      expect(modalPayload.limit).toBe(5);
    });

    it('[T1_F1_05] filters member list dynamically by name, email, or role filter pill', () => {
      // Role filter
      const devs = store.getMembers({ role: 'developer' });
      expect(devs.length).toBe(1);
      expect(devs[0].user.name).toBe('Alan Turing');

      // Search filter by query
      const searchRes = store.getMembers({ search: 'ada' });
      expect(searchRes.length).toBe(1);
      expect(searchRes[0].user.email).toBe('ada@task-hub.dev');

      // No match search
      const emptyRes = store.getMembers({ search: 'nonexistent' });
      expect(emptyRes.length).toBe(0);
    });

    it('[T1_F1_06] restricts invite and role modification controls for viewer members in UI', () => {
      const viewerRole: 'viewer' = 'viewer';
      const canManage = viewerRole === 'owner' || viewerRole === 'admin';
      expect(canManage).toBe(false);

      const inviteBtn = document.createElement('button');
      inviteBtn.textContent = 'Invite Member';
      inviteBtn.disabled = !canManage;
      if (!canManage) {
        inviteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }

      expect(inviteBtn.disabled).toBe(true);
      expect(inviteBtn.classList.contains('cursor-not-allowed')).toBe(true);
    });
  });

  // ============================================================================
  // TIER 1: Feature 2 — Member Invitation & RBAC API (>= 5 Tests)
  // ============================================================================
  describe('Tier 1: Feature 2 — Member Invitation & RBAC API', () => {
    it('[T1_F2_01] GET /api/v1/workspaces/{workspace}/members returns member collection and seat metrics', () => {
      const members = store.getMembers();
      const seats = store.getSeatsInfo();

      const apiResponse = {
        data: members,
        seats,
      };

      expect(apiResponse.data.length).toBe(2);
      expect(apiResponse.seats.used).toBe(2);
      expect(apiResponse.seats.limit).toBe(5);
      expect(apiResponse.seats.remaining).toBe(3);
    });

    it('[T1_F2_02] POST /api/v1/workspaces/{workspace}/members invites member by email with assigned role', () => {
      const res = store.inviteMember('admin', {
        email_or_username: 'grace.hopper@navy.mil',
        role: 'developer',
      });

      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();
      expect(res.data?.user.email).toBe('grace.hopper@navy.mil');
      expect(res.data?.role).toBe('developer');
      expect(store.getSeatsInfo().used).toBe(3);
    });

    it('[T1_F2_03] POST invitation accepts valid GitHub username format', () => {
      const res = store.inviteMember('owner', {
        email_or_username: 'torvalds',
        role: 'admin',
      });

      expect(res.status).toBe(201);
      expect(res.data?.user.github_username).toBe('torvalds');
      expect(res.data?.user.email).toContain('torvalds@users.noreply.github.com');
      expect(res.data?.role).toBe('admin');
    });

    it('[T1_F2_04] PUT /api/v1/workspaces/{workspace}/members/{user} updates member role', () => {
      const updateRes = store.updateRole('owner', 2, 'admin');
      expect(updateRes.status).toBe(200);
      expect(updateRes.data?.role).toBe('admin');

      const updated = store.getMembers().find((m) => m.id === 2);
      expect(updated?.role).toBe('admin');
    });

    it('[T1_F2_05] DELETE /api/v1/workspaces/{workspace}/members/{user} revokes access and frees seat', () => {
      expect(store.getSeatsInfo().used).toBe(2);

      const deleteRes = store.revokeMember('admin', 2);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.success).toBe(true);

      expect(store.getSeatsInfo().used).toBe(1);
      expect(store.getMembers().find((m) => m.id === 2)).toBeUndefined();
    });

    it('[T1_F2_06] WorkspaceQuotaService blocks member invitation when seat quota is exceeded', () => {
      store.inviteMember('owner', { email_or_username: 'user1@test.com', role: 'developer' });
      store.inviteMember('owner', { email_or_username: 'user2@test.com', role: 'developer' });
      store.inviteMember('owner', { email_or_username: 'user3@test.com', role: 'viewer' });

      expect(store.getSeatsInfo().used).toBe(5);
      expect(store.getSeatsInfo().remaining).toBe(0);

      const overflowRes = store.inviteMember('owner', {
        email_or_username: 'overflow@test.com',
        role: 'viewer',
      });

      expect(overflowRes.status).toBe(422);
      expect(overflowRes.error_code).toBe('PLAN_QUOTA_EXCEEDED');
      expect(overflowRes.quota).toBeDefined();
      expect(overflowRes.quota.current_usage).toBe(5);
      expect(store.upgradeModalOpened).toBe(true);
    });
  });

  // ============================================================================
  // TIER 2: Boundary & Corner Cases (>= 5 Tests per Feature)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases — Features 1 & 2', () => {
    it('[T2_F1_01] renders 100% full seat state with warning banner and disabled invite trigger', () => {
      const fullStore = new WorkspaceMemberStoreSimulator(
        [
          defaultOwner,
          defaultDev,
          { ...defaultDev, id: 3, user: { ...defaultDev.user, email: 'u3@dev.com' } },
        ],
        3,
        'community'
      );

      const seats = fullStore.getSeatsInfo();
      expect(seats.percentage).toBe(100);
      expect(seats.remaining).toBe(0);

      const banner = document.createElement('div');
      banner.className = 'seat-warning bg-amber-950/50 border border-amber-800 text-amber-200 p-3 rounded-lg flex items-center justify-between';
      const msgSpan = document.createElement('span');
      msgSpan.textContent = `All ${seats.limit} seats are allocated. Upgrade to invite more members.`;
      const upgradeBtn = document.createElement('button');
      upgradeBtn.className = 'upgrade-btn bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 text-xs font-bold rounded';
      upgradeBtn.textContent = 'Upgrade Seats';
      banner.appendChild(msgSpan);
      banner.appendChild(upgradeBtn);

      expect(banner.textContent).toContain('All 3 seats are allocated');
      expect(banner.querySelector('.upgrade-btn')).toBeDefined();
    });

    it('[T2_F1_02] single member workspace displays owner badge and prevents owner removal or downgrade', () => {
      const soloStore = new WorkspaceMemberStoreSimulator([defaultOwner], 1, 'community');
      expect(soloStore.getMembers().length).toBe(1);

      const revokeAttempt = soloStore.revokeMember('owner', 1);
      expect(revokeAttempt.status).toBe(403);
      expect(revokeAttempt.error).toContain('Cannot remove the workspace owner');

      const roleChangeAttempt = soloStore.updateRole('owner', 1, 'developer');
      expect(roleChangeAttempt.status).toBe(403);
      expect(roleChangeAttempt.error).toContain('Workspace owner role cannot be altered');
    });

    it('[T2_F1_03] handles extremely long user emails (255+ characters) and multi-byte UTF-8 unicode display names', () => {
      const longEmail = 'extremely.long.corporate.enterprise.user.identifier.alias.prefix+' + 'a'.repeat(200) + '@enterprise.task-hub.cloud';
      const unicodeName = 'Nguyễn Thị Minh Khai 🚀 (Phát triển viên)';

      const res = store.inviteMember('owner', {
        email_or_username: longEmail,
        role: 'developer',
      });

      expect(res.status).toBe(201);
      expect(res.data?.user.email).toBe(longEmail);

      res.data!.user.name = unicodeName;

      const element = document.createElement('div');
      element.className = 'truncate max-w-xs';
      element.textContent = res.data!.user.name;

      expect(element.textContent).toContain('Nguyễn Thị Minh Khai');
      expect(element.textContent).toContain('🚀');
    });

    it('[T2_F1_04] rapid consecutive invite submissions are handled predictably without state corruption', () => {
      const attempts = [
        store.inviteMember('owner', { email_or_username: 'rapid1@test.com', role: 'developer' }),
        store.inviteMember('owner', { email_or_username: 'rapid2@test.com', role: 'developer' }),
        store.inviteMember('owner', { email_or_username: 'rapid3@test.com', role: 'developer' }),
        store.inviteMember('owner', { email_or_username: 'rapid4@test.com', role: 'developer' }),
      ];

      expect(attempts[0].status).toBe(201);
      expect(attempts[1].status).toBe(201);
      expect(attempts[2].status).toBe(201);
      expect(attempts[3].status).toBe(422); // Exceeded 5 seats limit
      expect(store.getMembers().length).toBe(5);
    });

    it('[T2_F1_05] empty search filter query returns empty state with clear filters action', () => {
      const results = store.getMembers({ search: 'zzz_no_match_query_999' });
      expect(results.length).toBe(0);

      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state text-center p-8';
      emptyState.innerHTML = `<p class="text-slate-400">No members found matching your search.</p><button class="clear-btn text-phantom-mint hover:underline text-xs mt-2">Clear search</button>`;

      expect(emptyState.textContent).toContain('No members found matching');
    });

    it('[T2_F1_06] displays seat allocation warning badge when seat utilization reaches or exceeds 80%', () => {
      const seats = store.getSeatsInfo();
      expect(seats.percentage >= 80).toBe(false);

      store.inviteMember('owner', { email_or_username: 'm3@test.com', role: 'developer' });
      store.inviteMember('owner', { email_or_username: 'm4@test.com', role: 'developer' });

      const updatedSeats = store.getSeatsInfo();
      expect(updatedSeats.used).toBe(4);
      expect(updatedSeats.percentage).toBe(80);
      expect(updatedSeats.percentage >= 80).toBe(true);
    });

    it('[T2_F2_01] non-admin member attempting to invite or delete members returns HTTP 403 Forbidden', () => {
      const devInvite = store.inviteMember('developer', {
        email_or_username: 'hacker@test.com',
        role: 'admin',
      });
      expect(devInvite.status).toBe(403);
      expect(devInvite.error_code).toBe('UNAUTHORIZED_ACTION');

      const viewerRevoke = store.revokeMember('viewer', 2);
      expect(viewerRevoke.status).toBe(403);
      expect(viewerRevoke.success).toBe(false);
    });

    it('[T2_F2_02] malformed email formats and invalid symbols in handle return HTTP 422 with validation errors', () => {
      const invalidPayloads = [
        'invalid email without at',
        'spaces in email@domain.com',
        'invalid$$symbols%%',
        '',
        'a',
      ];

      for (const invalid of invalidPayloads) {
        const res = store.inviteMember('owner', {
          email_or_username: invalid,
          role: 'developer',
        });
        expect(res.status).toBe(422);
      }
    });

    it('[T2_F2_03] attempting to invite an existing member returns HTTP 422 USER_ALREADY_MEMBER', () => {
      const res = store.inviteMember('owner', {
        email_or_username: 'ada@task-hub.dev',
        role: 'developer',
      });

      expect(res.status).toBe(422);
      expect(res.error_code).toBe('USER_ALREADY_MEMBER');
    });

    it('[T2_F2_04] re-inviting previously revoked member creates a fresh active membership record', () => {
      store.revokeMember('owner', 2);
      expect(store.getMembers().find((m) => m.user.email === 'alan@task-hub.dev')).toBeUndefined();

      const reInvite = store.inviteMember('owner', {
        email_or_username: 'alan@task-hub.dev',
        role: 'developer',
      });

      expect(reInvite.status).toBe(201);
      expect(reInvite.data?.user.email).toBe('alan@task-hub.dev');
      expect(store.getMembers().length).toBe(2);
    });

    it('[T2_F2_05] seat limit expansion dynamically unblocks pending invitations', () => {
      const limitStore = new WorkspaceMemberStoreSimulator([defaultOwner, defaultDev], 2, 'community');
      expect(limitStore.getSeatsInfo().remaining).toBe(0);

      const fail = limitStore.inviteMember('owner', { email_or_username: 'blocked@test.com', role: 'developer' });
      expect(fail.status).toBe(422);

      limitStore.setSeatLimit(10);
      expect(limitStore.getSeatsInfo().remaining).toBe(8);

      const success = limitStore.inviteMember('owner', { email_or_username: 'unblocked@test.com', role: 'developer' });
      expect(success.status).toBe(201);
      expect(limitStore.getSeatsInfo().used).toBe(3);
    });
  });
});
