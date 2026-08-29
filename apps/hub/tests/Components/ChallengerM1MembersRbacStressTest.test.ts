/**
 * Test Suite: Challenger 1 Empirical Adversarial Stress & Boundary Challenge Suite
 * Milestone: M1 (Workspace Members & RBAC Management)
 *
 * Scope:
 * 1. Owner Removal & Role Modification Prevention (422 / 403 protection)
 * 2. Seat Quota Enforcement & Multi-Tier Quota Boundaries (422 PLAN_QUOTA_EXCEEDED)
 * 3. Non-Admin/Non-Owner Authorization Rejection (403 Forbidden)
 * 4. Boundary Fuzzing, Race Conditions, Case-Insensitivity & Re-Invitation Cycles
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  WorkspaceMemberStoreSimulator,
  type WorkspaceMember,
} from '../Harness/commercial_simulators.ts';

describe('Challenger M1: Empirical Adversarial & Boundary Stress Test Suite', () => {
  let env: any;
  let ownerMember: WorkspaceMember;
  let adminMember: WorkspaceMember;
  let devMember: WorkspaceMember;
  let viewerMember: WorkspaceMember;

  beforeEach(() => {
    env = setupTestEnvironment();

    ownerMember = {
      id: 1001,
      workspace_id: 501,
      user_id: 1,
      role: 'owner',
      user: {
        id: 1,
        name: 'Workspace Owner',
        email: 'owner@task-hub.cloud',
        github_username: 'taskhub-owner',
        avatar_url: 'https://avatars.example.com/owner',
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    adminMember = {
      id: 1002,
      workspace_id: 501,
      user_id: 2,
      role: 'admin',
      user: {
        id: 2,
        name: 'Admin User',
        email: 'admin@task-hub.cloud',
        github_username: 'taskhub-admin',
        avatar_url: 'https://avatars.example.com/admin',
      },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    devMember = {
      id: 1003,
      workspace_id: 501,
      user_id: 3,
      role: 'developer',
      user: {
        id: 3,
        name: 'Dev User',
        email: 'dev@task-hub.cloud',
        github_username: 'taskhub-dev',
        avatar_url: 'https://avatars.example.com/dev',
      },
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    };

    viewerMember = {
      id: 1004,
      workspace_id: 501,
      user_id: 4,
      role: 'viewer',
      user: {
        id: 4,
        name: 'Viewer User',
        email: 'viewer@task-hub.cloud',
        github_username: 'taskhub-viewer',
        avatar_url: 'https://avatars.example.com/viewer',
      },
      created_at: '2026-01-04T00:00:00Z',
      updated_at: '2026-01-04T00:00:00Z',
    };
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // 1. OWNER IMMUTABILITY & REMOVAL SHIELD
  // ============================================================================
  describe('1. Owner Immutability & Removal Shield', () => {
    it('[CH1_OWNER_01] Owner removal attempt by Admin is rejected and leaves owner intact', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember], 10, 'team');

      const res = store.revokeMember('admin', ownerMember.id);
      expect(res.status === 403 || res.status === 422).toBe(true);
      expect(res.success).toBe(false);

      const remainingMembers = store.getMembers();
      expect(remainingMembers.some((m) => m.id === ownerMember.id)).toBe(true);
      expect(remainingMembers.length).toBe(2);
    });

    it('[CH1_OWNER_02] Owner self-removal attempt is strictly rejected', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember], 10, 'team');

      const res = store.revokeMember('owner', ownerMember.id);
      expect(res.status === 403 || res.status === 422).toBe(true);
      expect(res.success).toBe(false);
      expect(store.getMembers().length).toBe(2);
    });

    it('[CH1_OWNER_03] Owner role demotion attempt to admin, developer, or viewer is strictly rejected', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember], 10, 'team');

      const targetRoles: ('admin' | 'developer' | 'viewer')[] = ['admin', 'developer', 'viewer'];

      for (const targetRole of targetRoles) {
        const adminAttempt = store.updateRole('admin', ownerMember.id, targetRole);
        expect(adminAttempt.status === 403 || adminAttempt.status === 422).toBe(true);

        const ownerSelfAttempt = store.updateRole('owner', ownerMember.id, targetRole);
        expect(ownerSelfAttempt.status === 403 || ownerSelfAttempt.status === 422).toBe(true);

        // Verify owner role remains unchanged
        const currentOwner = store.getMembers().find((m) => m.id === ownerMember.id);
        expect(currentOwner?.role).toBe('owner');
      }
    });

    it('[CH1_OWNER_04] In a single-member workspace, owner removal and demotion are impossible', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember], 1, 'community');

      expect(store.revokeMember('owner', ownerMember.id).success).toBe(false);
      expect(store.updateRole('owner', ownerMember.id, 'developer').status).toBeGreaterThanOrEqual(400);

      const members = store.getMembers();
      expect(members.length).toBe(1);
      expect(members[0].role).toBe('owner');
    });
  });

  // ============================================================================
  // 2. SEAT QUOTA ENFORCEMENT & MULTI-TIER BOUNDARIES
  // ============================================================================
  describe('2. Seat Quota Enforcement & Multi-Tier Boundaries', () => {
    it('[CH1_QUOTA_01] Community plan (1 seat limit) blocks 2nd member invite with PLAN_QUOTA_EXCEEDED', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember], 1, 'community');
      const seats = store.getSeatsInfo();
      expect(seats.used).toBe(1);
      expect(seats.limit).toBe(1);
      expect(seats.remaining).toBe(0);

      const inviteRes = store.inviteMember('owner', {
        email_or_username: 'newcollaborator@task-hub.dev',
        role: 'developer',
      });

      expect(inviteRes.status).toBe(422);
      expect(inviteRes.error_code).toBe('PLAN_QUOTA_EXCEEDED');
      expect(inviteRes.quota.resource).toBe('seats');
      expect(inviteRes.quota.current_usage).toBe(1);
      expect(inviteRes.quota.limit).toBe(1);
      expect(store.upgradeModalOpened).toBe(true);
    });

    it('[CH1_QUOTA_02] Pro plan (5 seats limit) accepts 4 invitations and rejects 5th invite', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember], 5, 'pro');

      // Invite 4 developers
      for (let i = 1; i <= 4; i++) {
        const res = store.inviteMember('owner', {
          email_or_username: `pro_dev_${i}@company.com`,
          role: 'developer',
        });
        expect(res.status).toBe(201);
      }

      const seatsFull = store.getSeatsInfo();
      expect(seatsFull.used).toBe(5);
      expect(seatsFull.limit).toBe(5);
      expect(seatsFull.remaining).toBe(0);
      expect(seatsFull.percentage).toBe(100);

      // Attempt 6th member (5th invite)
      const overflow = store.inviteMember('owner', {
        email_or_username: 'overflow_user@company.com',
        role: 'viewer',
      });

      expect(overflow.status).toBe(422);
      expect(overflow.error_code).toBe('PLAN_QUOTA_EXCEEDED');
      expect(store.getMembers().length).toBe(5);
    });

    it('[CH1_QUOTA_03] Team plan (10 seats limit) enforces capacity boundary at 10', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember], 10, 'team');

      for (let i = 1; i <= 9; i++) {
        const res = store.inviteMember('owner', {
          email_or_username: `team_member_${i}@task-hub.dev`,
          role: 'developer',
        });
        expect(res.status).toBe(201);
      }

      expect(store.getSeatsInfo().used).toBe(10);
      expect(store.getSeatsInfo().remaining).toBe(0);

      const blocked = store.inviteMember('owner', {
        email_or_username: 'eleventh_member@task-hub.dev',
        role: 'developer',
      });
      expect(blocked.status).toBe(422);
      expect(blocked.error_code).toBe('PLAN_QUOTA_EXCEEDED');
    });

    it('[CH1_QUOTA_04] Revoking a member unblocks subsequent invitation', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember, devMember], 3, 'team');
      expect(store.getSeatsInfo().remaining).toBe(0);

      // Attempt invite at capacity -> fails
      const blocked = store.inviteMember('owner', {
        email_or_username: 'candidate@company.com',
        role: 'developer',
      });
      expect(blocked.status).toBe(422);

      // Revoke devMember -> frees 1 seat
      const revokeRes = store.revokeMember('owner', devMember.id);
      expect(revokeRes.success).toBe(true);
      expect(store.getSeatsInfo().used).toBe(2);
      expect(store.getSeatsInfo().remaining).toBe(1);

      // Retry invite -> succeeds
      const retried = store.inviteMember('owner', {
        email_or_username: 'candidate@company.com',
        role: 'developer',
      });
      expect(retried.status).toBe(201);
      expect(store.getSeatsInfo().used).toBe(3);
    });

    it('[CH1_QUOTA_05] Burst simulation: 30 concurrent invitations with 3 available slots yields exactly 3 successes', () => {
      const store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember], 5, 'team');
      expect(store.getSeatsInfo().remaining).toBe(3);

      const results = [];
      for (let i = 1; i <= 30; i++) {
        const res = store.inviteMember('owner', {
          email_or_username: `burst_candidate_${i}@test.com`,
          role: 'developer',
        });
        results.push(res);
      }

      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status === 422 && r.error_code === 'PLAN_QUOTA_EXCEEDED');

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(27);
      expect(store.getMembers().length).toBe(5);
    });
  });

  // ============================================================================
  // 3. NON-ADMIN/NON-OWNER AUTHORIZATION REJECTION (RBAC GUARD)
  // ============================================================================
  describe('3. Non-Admin/Non-Owner Authorization Rejection', () => {
    let store: WorkspaceMemberStoreSimulator;

    beforeEach(() => {
      store = new WorkspaceMemberStoreSimulator(
        [ownerMember, adminMember, devMember, viewerMember],
        10,
        'team'
      );
    });

    it('[CH1_RBAC_01] Developer role cannot invite new members (returns 403)', () => {
      const res = store.inviteMember('developer', {
        email_or_username: 'unauthorized_invite@task-hub.dev',
        role: 'developer',
      });

      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UNAUTHORIZED_ACTION');
      expect(store.getMembers().length).toBe(4);
    });

    it('[CH1_RBAC_02] Developer role cannot update member roles (returns 403)', () => {
      const res = store.updateRole('developer', viewerMember.id, 'admin');
      expect(res.status).toBe(403);

      const viewer = store.getMembers().find((m) => m.id === viewerMember.id);
      expect(viewer?.role).toBe('viewer');
    });

    it('[CH1_RBAC_03] Developer role cannot revoke/remove members (returns 403)', () => {
      const res = store.revokeMember('developer', viewerMember.id);
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
      expect(store.getMembers().length).toBe(4);
    });

    it('[CH1_RBAC_04] Viewer role cannot invite new members (returns 403)', () => {
      const res = store.inviteMember('viewer', {
        email_or_username: 'viewer_invite@task-hub.dev',
        role: 'viewer',
      });

      expect(res.status).toBe(403);
      expect(res.error_code).toBe('UNAUTHORIZED_ACTION');
    });

    it('[CH1_RBAC_05] Viewer role cannot update member roles (returns 403)', () => {
      const res = store.updateRole('viewer', devMember.id, 'developer');
      expect(res.status).toBe(403);
    });

    it('[CH1_RBAC_06] Viewer role cannot revoke/remove members (returns 403)', () => {
      const res = store.revokeMember('viewer', devMember.id);
      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
    });

    it('[CH1_RBAC_07] Admin role can successfully invite, update non-owner roles, and remove non-owners', () => {
      // 1. Admin invites new dev
      const inviteRes = store.inviteMember('admin', {
        email_or_username: 'admindev@task-hub.dev',
        role: 'developer',
      });
      expect(inviteRes.status).toBe(201);
      const newDevId = inviteRes.data!.id;

      // 2. Admin promotes new dev to admin
      const updateRes = store.updateRole('admin', newDevId, 'admin');
      expect(updateRes.status).toBe(200);
      expect(updateRes.data?.role).toBe('admin');

      // 3. Admin removes new dev
      const removeRes = store.revokeMember('admin', newDevId);
      expect(removeRes.status).toBe(200);
      expect(removeRes.success).toBe(true);
    });
  });

  // ============================================================================
  // 4. BOUNDARY FUZZING, RACE CONDITIONS & RE-INVITATION
  // ============================================================================
  describe('4. Boundary Fuzzing, Race Conditions & Re-Invitation', () => {
    let store: WorkspaceMemberStoreSimulator;

    beforeEach(() => {
      store = new WorkspaceMemberStoreSimulator([ownerMember, adminMember], 10, 'team');
    });

    it('[CH1_BOUND_01] Duplicate email invite is rejected with USER_ALREADY_MEMBER (case-insensitive)', () => {
      const duplicateEmails = [
        'admin@task-hub.cloud',
        'ADMIN@TASK-HUB.CLOUD',
        'Admin@Task-Hub.Cloud',
        'owner@task-hub.cloud',
      ];

      for (const email of duplicateEmails) {
        const res = store.inviteMember('owner', {
          email_or_username: email,
          role: 'developer',
        });
        expect(res.status).toBe(422);
        expect(res.error_code).toBe('USER_ALREADY_MEMBER');
      }
    });

    it('[CH1_BOUND_02] Duplicate GitHub handle invite is rejected with USER_ALREADY_MEMBER', () => {
      const duplicateHandles = ['taskhub-admin', 'TASKHUB-ADMIN', 'taskhub-owner'];

      for (const handle of duplicateHandles) {
        const res = store.inviteMember('owner', {
          email_or_username: handle,
          role: 'viewer',
        });
        expect(res.status).toBe(422);
        expect(res.error_code).toBe('USER_ALREADY_MEMBER');
      }
    });

    it('[CH1_BOUND_03] Malformed identifiers return HTTP 422 with validation errors', () => {
      const invalidIdentifiers = [
        '',
        '   ',
        'a',
        'ab',
        'invalid email with spaces@domain.com',
        'missing-at-sign.com',
        'user@nodot',
        'github with spaces',
        'special$$$chars!!!',
      ];

      for (const invalid of invalidIdentifiers) {
        const res = store.inviteMember('owner', {
          email_or_username: invalid,
          role: 'developer',
        });
        expect(res.status).toBe(422);
      }
    });

    it('[CH1_BOUND_04] Updating or revoking non-existent member returns 404 NOT_FOUND', () => {
      const nonExistentId = 999999;

      const updateRes = store.updateRole('owner', nonExistentId, 'admin');
      expect(updateRes.status).toBe(404);

      const revokeRes = store.revokeMember('owner', nonExistentId);
      expect(revokeRes.status).toBe(404);
      expect(revokeRes.success).toBe(false);
    });

    it('[CH1_BOUND_05] Member search and role filtering withstand fuzz queries and empty matches', () => {
      const members = store.getMembers({ search: 'owner' });
      expect(members.length).toBe(1);
      expect(members[0].role).toBe('owner');

      const adminFilter = store.getMembers({ role: 'admin' });
      expect(adminFilter.length).toBe(1);
      expect(adminFilter[0].role).toBe('admin');

      const noMatch = store.getMembers({ search: 'non_existent_query_string_12345' });
      expect(noMatch.length).toBe(0);
    });

    it('[CH1_BOUND_06] Rapid revoke and re-invite cycle safely regenerates valid membership record', () => {
      // 1. Invite user
      const invite1 = store.inviteMember('owner', {
        email_or_username: 'cyclical.dev@task-hub.dev',
        role: 'developer',
      });
      expect(invite1.status).toBe(201);
      const memberId = invite1.data!.id;

      // 2. Revoke user
      const revoke = store.revokeMember('owner', memberId);
      expect(revoke.success).toBe(true);

      // 3. Re-invite user
      const invite2 = store.inviteMember('owner', {
        email_or_username: 'cyclical.dev@task-hub.dev',
        role: 'admin',
      });
      expect(invite2.status).toBe(201);
      expect(invite2.data?.role).toBe('admin');
      expect(store.getMembers().length).toBe(3);
    });
  });
});
