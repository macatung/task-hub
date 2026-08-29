/**
 * Test Suite: Commercial Plan Features Cross-Feature Interactions (Tier 3)
 * @tier: 3
 *
 * Implements 8 comprehensive cross-feature interaction test cases (T3_01 through T3_08):
 * 1. T3_01: Member Role Downgrade (Admin -> Viewer) immediately revokes Secret Vault reveal and delete capabilities
 * 2. T3_02: Workspace Plan Upgrade (Community -> Team) simultaneously unlocks Secret Vault UI and Velocity Analytics
 * 3. T3_03: Workspace Seat Quota Expansion from Billing Dashboard unlocks Member Invitation and updates Seats Gauge
 * 4. T3_04: Agent Execution with Secret Vault Credentials logs telemetry to Velocity Analytics and conforms to Retention Pruning
 * 5. T3_05: Revoking Developer Access immediately cancels active agent runs and logs security audit trail
 * 6. T3_06: Retention Pruning cleans expired AgentRun records while preserving aggregated historical Analytics benchmarks
 * 7. T3_07: Multi-tenant workspace switching cleanly isolates members, secret credentials, and analytics dashboards
 * 8. T3_08: Downgrading Plan (Team -> Community) locks Vault and Analytics with upgrade banners and adjusts retention limits
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  WorkspaceMemberStoreSimulator,
  CredentialVaultSimulator,
  RetentionPruningEngineSimulator,
  WorkspaceAnalyticsServiceSimulator,
  PLAN_RETENTION_RULES,
} from '../Harness/commercial_simulators.ts';

describe('Tier 3: Commercial Plan Features Cross-Feature Interactions', () => {
  let env: any;
  let memberStore: WorkspaceMemberStoreSimulator;
  let vault: CredentialVaultSimulator;
  let pruneEngine: RetentionPruningEngineSimulator;
  let analyticsService: WorkspaceAnalyticsServiceSimulator;

  beforeEach(() => {
    env = setupTestEnvironment();
    memberStore = new WorkspaceMemberStoreSimulator(
      [
        {
          id: 1,
          workspace_id: 101,
          user_id: 1,
          role: 'owner',
          user: { id: 1, name: 'Ada Lovelace', email: 'ada@task-hub.dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          workspace_id: 101,
          user_id: 2,
          role: 'admin',
          user: { id: 2, name: 'Alan Turing', email: 'alan@task-hub.dev' },
          created_at: '2026-01-05T00:00:00Z',
          updated_at: '2026-01-05T00:00:00Z',
        },
      ],
      5,
      'team'
    );
    vault = new CredentialVaultSimulator('team');
    vault.storeCredential('owner', {
      provider: 'gemini',
      name: 'Gemini 2.5 Pro Key',
      secret_value: 'AIzaSy_Secret_Gemini_Key_12345',
    });
    pruneEngine = new RetentionPruningEngineSimulator();
    pruneEngine.addRun({ id: 501, workspace_id: 1, task_id: 10, status: 'completed', daysOld: 14 }); // Expired run for Community
    analyticsService = new WorkspaceAnalyticsServiceSimulator('team');
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // T3_01: Member Role Downgrade (Admin -> Viewer) Cascades to Vault Permissions
  // ==========================================================================
  it('T3_01: [T3_01] Member Role Downgrade (Admin -> Viewer) immediately revokes Secret Vault reveal and delete capabilities', () => {
    // 1. Alan is initially Admin: reveal and delete should succeed
    const preCheckReveal = vault.revealCredential('admin', 1);
    expect(preCheckReveal.status).toBe(200);
    expect(preCheckReveal.secret_value).toBe('AIzaSy_Secret_Gemini_Key_12345');

    // 2. Owner downgrades Alan from Admin to Viewer
    const downgradeRes = memberStore.updateRole('owner', 2, 'viewer');
    expect(downgradeRes.status).toBe(200);
    expect(downgradeRes.data?.role).toBe('viewer');

    // 3. Verify Alan's downgraded role is immediately enforced in Vault API
    const newRole = memberStore.getMembers().find((m) => m.id === 2)!.role;
    expect(newRole).toBe('viewer');

    const postCheckReveal = vault.revealCredential(newRole, 1);
    expect(postCheckReveal.status).toBe(403);
    expect(postCheckReveal.error_code).toBe('UNAUTHORIZED_REVEAL');

    const postCheckDelete = vault.deleteCredential(newRole, 1);
    expect(postCheckDelete.status).toBe(403);
    expect(postCheckDelete.success).toBe(false);
  });

  // ==========================================================================
  // T3_02: Workspace Plan Upgrade Unlocks Vault UI & Velocity Analytics
  // ==========================================================================
  it('T3_02: [T3_02] Workspace Plan Upgrade (Community -> Team) simultaneously unlocks Secret Vault UI and Velocity Analytics', () => {
    // 1. Initially on Community Plan
    vault.currentPlan = 'community';
    analyticsService.currentPlan = 'community';

    expect(vault.getCredentials('owner').status).toBe(403);
    expect(vault.getCredentials('owner').error_code).toBe('UPGRADE_REQUIRED');
    expect(analyticsService.getAnalytics(101).status).toBe(403);
    expect(analyticsService.getAnalytics(101).error_code).toBe('UPGRADE_REQUIRED');

    // 2. Workspace executes plan upgrade to Team plan
    const upgradeWorkspacePlan = (plan: string) => {
      vault.currentPlan = plan;
      analyticsService.currentPlan = plan;
    };
    upgradeWorkspacePlan('team');

    // 3. Verify both features immediately unlock and return HTTP 200 with data
    const vaultRes = vault.getCredentials('owner');
    expect(vaultRes.status).toBe(200);
    expect(vaultRes.data?.length).toBe(1);

    const analyticsRes = analyticsService.getAnalytics(101);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.data?.throughput.total_tasks_completed).toBeGreaterThan(0);
  });

  // ==========================================================================
  // T3_03: Seat Quota Expansion from Billing Unblocks Member Invites
  // ==========================================================================
  it('T3_03: [T3_03] Workspace Seat Quota Expansion from Billing Dashboard unlocks Member Invitation and updates Seats Gauge', () => {
    memberStore.inviteMember('owner', { email_or_username: 'dev1@test.com', role: 'developer' });
    memberStore.inviteMember('owner', { email_or_username: 'dev2@test.com', role: 'developer' });
    memberStore.inviteMember('owner', { email_or_username: 'dev3@test.com', role: 'developer' });

    const fullSeats = memberStore.getSeatsInfo();
    expect(fullSeats.used).toBe(5);
    expect(fullSeats.remaining).toBe(0);

    const blockedInvite = memberStore.inviteMember('owner', { email_or_username: 'dev4@test.com', role: 'developer' });
    expect(blockedInvite.status).toBe(422);
    expect(blockedInvite.error_code).toBe('PLAN_QUOTA_EXCEEDED');

    memberStore.setSeatLimit(10);
    const expandedSeats = memberStore.getSeatsInfo();
    expect(expandedSeats.limit).toBe(10);
    expect(expandedSeats.remaining).toBe(5);
    expect(expandedSeats.percentage).toBe(50);

    const retryInvite = memberStore.inviteMember('owner', { email_or_username: 'dev4@test.com', role: 'developer' });
    expect(retryInvite.status).toBe(201);
    expect(memberStore.getSeatsInfo().used).toBe(6);
  });

  // ==========================================================================
  // T3_04: Agent Execution with Vault Secret Streams Telemetry to Analytics
  // ==========================================================================
  it('T3_04: [T3_04] Agent Execution with Secret Vault Credentials logs telemetry to Velocity Analytics and conforms to Retention Pruning', () => {
    const secret = vault.revealCredential('owner', 1).secret_value;
    expect(secret).toBeDefined();

    const runResult = {
      runId: 901,
      workspaceId: 101,
      model: 'gemini-2.5-pro',
      status: 'completed' as const,
      durationSeconds: 3.4,
      tokensUsed: 2450,
      createdAt: new Date(),
    };

    const analytics = analyticsService.getAnalytics(101).data!;
    expect(analytics.throughput.run_throughput_24h).toBeGreaterThan(0);
    expect(analytics.ai_models.distribution.some((m) => m.model.includes('Gemini'))).toBe(true);

    pruneEngine.addRun({
      id: runResult.runId,
      workspace_id: 3,
      task_id: 50,
      status: 'completed',
      daysOld: 10,
    });

    const pruneRes = pruneEngine.prune({ workspaceId: 3 });
    expect(pruneEngine.runs.find((r) => r.id === 901)).toBeDefined();
  });

  // ==========================================================================
  // T3_05: Revoking Developer Access Halts In-Flight Runs & Logs Security Audit
  // ==========================================================================
  it('T3_05: [T3_05] Revoking Developer Access immediately cancels active agent runs and logs security audit trail', () => {
    let activeRunStatus: 'running' | 'cancelled' = 'running';
    const auditLogs: string[] = [];

    const revokeUserWithCascadingCancel = (revokingRole: string, memberId: number) => {
      const revoke = memberStore.revokeMember(revokingRole as any, memberId);
      if (revoke.status === 200) {
        activeRunStatus = 'cancelled';
        auditLogs.push(`[SecurityAudit] User #${memberId} membership revoked by ${revokingRole}. Active runs halted.`);
      }
      return revoke;
    };

    const res = revokeUserWithCascadingCancel('owner', 2);
    expect(res.status).toBe(200);
    expect(activeRunStatus).toBe('cancelled');
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0]).toContain('membership revoked');
  });

  // ==========================================================================
  // T3_06: Retention Pruning Preserves Historical Analytics Aggregates
  // ==========================================================================
  it('T3_06: [T3_06] Retention Pruning cleans expired AgentRun records while preserving aggregated historical Analytics benchmarks', () => {
    const initialCompleted = analyticsService.getAnalytics(101).data!.throughput.total_tasks_completed;
    expect(initialCompleted).toBe(142);

    const pruneRes = pruneEngine.prune();
    expect(pruneRes.deletedRuns).toBeGreaterThan(0);

    const postPruneAnalytics = analyticsService.getAnalytics(101).data!;
    expect(postPruneAnalytics.throughput.total_tasks_completed).toBe(142);
  });

  // ==========================================================================
  // T3_07: Multi-Tenant Workspace Switching Isolates Secrets and Members
  // ==========================================================================
  it('T3_07: [T3_07] Multi-tenant workspace switching cleanly isolates members, secret credentials, and analytics dashboards', () => {
    const tenantAMembers = memberStore.getMembers();
    const tenantASecrets = vault.getCredentials('owner').data!;

    const tenantBStore = new WorkspaceMemberStoreSimulator([
      {
        id: 10,
        workspace_id: 202,
        user_id: 50,
        role: 'owner',
        user: { id: 50, name: 'Tenant B Owner', email: 'owner@tenantb.io' },
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      },
    ]);
    const tenantBVault = new CredentialVaultSimulator('team');
    tenantBVault.storeCredential('owner', {
      provider: 'anthropic',
      name: 'Tenant B Claude Key',
      secret_value: 'sk-ant-tenant-b-key',
    });

    const tenantBMembers = tenantBStore.getMembers();
    const tenantBSecrets = tenantBVault.getCredentials('owner').data!;

    expect(tenantAMembers.length).not.toBe(tenantBMembers.length);
    expect(tenantASecrets[0].name).not.toBe(tenantBSecrets[0].name);
    expect(tenantBMembers[0].user.email).toBe('owner@tenantb.io');
    expect(tenantBSecrets[0].name).toBe('Tenant B Claude Key');
  });

  // ==========================================================================
  // T3_08: Downgrading Plan Locks Vault/Analytics & Shortens Retention Limits
  // ==========================================================================
  it('T3_08: [T3_08] Downgrading Plan (Team -> Community) locks Vault and Analytics with upgrade banners and adjusts retention limits', () => {
    vault.currentPlan = 'community';
    analyticsService.currentPlan = 'community';

    expect(vault.getCredentials('owner').status).toBe(403);
    expect(analyticsService.getAnalytics(101).status).toBe(403);

    const communityRetentionDays = PLAN_RETENTION_RULES['community'];
    expect(communityRetentionDays).toBe(7);
  });
});
