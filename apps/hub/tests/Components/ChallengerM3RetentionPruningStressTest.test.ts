/**
 * Adversarial Challenger Stress Test Suite: Retention History Pruning Command & Scheduler
 *
 * Target: Milestone 3 (Automated Retention History Pruning Command)
 * Objectives:
 *   1. Verify plan retention cutoff accuracy across all tiers (Community: 7d, Pro: 90d, Team: 365d, Enterprise: 730d, Custom: N days).
 *   2. Verify in-flight & active run protection for all 5 statuses: ['queued', 'claimed', 'preparing', 'running', 'waiting_input'] regardless of age (up to 5,000 days).
 *   3. Verify terminal status pruning: ['completed', 'failed', 'cancelled', 'timeout', 'needs_review', 'rejected'].
 *   4. Verify --dry-run safety: exact calculation of expired runs, logs, events, evidence with 0 database mutations.
 *   5. Verify single workspace isolation (--workspace={id}) and exit code 1 on non-existent workspaces.
 *   6. Verify --days override flag across individual or multiple workspaces.
 *   7. Verify cascading deletion integrity for agent_run_logs, agent_run_events, and verification_evidence.
 *   8. Verify high-volume batch chunking scalability and zero-state edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  RetentionPruningEngineSimulator,
  PLAN_RETENTION_RULES,
  PROTECTED_AGENT_STATUSES,
} from '../Harness/commercial_simulators.ts';

describe('Adversarial Challenger M3: Retention Pruning Command & Scheduler Stress Test', () => {
  let env: any;
  let engine: RetentionPruningEngineSimulator;

  beforeEach(() => {
    env = setupTestEnvironment();
    engine = new RetentionPruningEngineSimulator();
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // 1. Retention Cutoff Accuracy Across All Plan Tiers & Sub-Second Boundaries
  // ============================================================================
  describe('1. Plan Retention Cutoff Accuracy & Sub-Second Boundary Tests', () => {
    it('[CHALLENGE-01] Community plan enforces exact 7-day (604,800s) retention boundary', () => {
      const now = new Date('2026-08-29T12:00:00Z');
      const wsId = 1; // Community

      // Run 1: 6 days, 23 hours, 59 minutes, 59 seconds old (1s before cutoff) -> KEEP
      const keepDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 - 1000));
      // Run 2: Exactly 7 days old -> KEEP (created_at < cutoffDate is false)
      const exactDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      // Run 3: 7 days + 1 millisecond old -> EXPIRED
      const expireDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 + 1));

      engine.runs.push({
        id: 1001,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: keepDate,
        updated_at: keepDate,
        logs_count: 5,
        events_count: 10,
        evidence_count: 1,
      });
      engine.runs.push({
        id: 1002,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: exactDate,
        updated_at: exactDate,
        logs_count: 5,
        events_count: 10,
        evidence_count: 1,
      });
      engine.runs.push({
        id: 1003,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: expireDate,
        updated_at: expireDate,
        logs_count: 5,
        events_count: 10,
        evidence_count: 1,
      });

      const res = engine.prune({ workspaceId: wsId, referenceTime: now });
      expect(res.deletedRuns).toBe(1);

      const remainingIds = engine.runs.filter((r) => r.workspace_id === wsId).map((r) => r.id);
      expect(remainingIds).toContain(1001);
      expect(remainingIds).toContain(1002);
      expect(remainingIds).not.toContain(1003);
    });

    it('[CHALLENGE-02] Pro plan enforces exact 90-day (7,776,000s) retention boundary', () => {
      const now = new Date('2026-08-29T12:00:00Z');
      const wsId = 2; // Pro

      const keepDate = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
      const expireDate = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);

      engine.runs.push({
        id: 2001,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: keepDate,
        updated_at: keepDate,
        logs_count: 3,
        events_count: 5,
        evidence_count: 1,
      });
      engine.runs.push({
        id: 2002,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: expireDate,
        updated_at: expireDate,
        logs_count: 3,
        events_count: 5,
        evidence_count: 1,
      });

      const res = engine.prune({ workspaceId: wsId, referenceTime: now });
      expect(res.deletedRuns).toBe(1);
      expect(engine.runs.map((r) => r.id)).toEqual([2001]);
    });

    it('[CHALLENGE-03] Team plan enforces exact 365-day (31,536,000s) retention boundary', () => {
      const now = new Date('2026-08-29T12:00:00Z');
      const wsId = 3; // Team

      const keepDate = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000);
      const expireDate = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);

      engine.runs.push({
        id: 3001,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: keepDate,
        updated_at: keepDate,
        logs_count: 4,
        events_count: 8,
        evidence_count: 2,
      });
      engine.runs.push({
        id: 3002,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: expireDate,
        updated_at: expireDate,
        logs_count: 4,
        events_count: 8,
        evidence_count: 2,
      });

      const res = engine.prune({ workspaceId: wsId, referenceTime: now });
      expect(res.deletedRuns).toBe(1);
      expect(engine.runs.map((r) => r.id)).toEqual([3001]);
    });

    it('[CHALLENGE-04] Enterprise plan enforces exact 730-day (63,072,000s) retention boundary', () => {
      const now = new Date('2026-08-29T12:00:00Z');
      const wsId = 4; // Enterprise

      const keepDate = new Date(now.getTime() - 729 * 24 * 60 * 60 * 1000);
      const expireDate = new Date(now.getTime() - 731 * 24 * 60 * 60 * 1000);

      engine.runs.push({
        id: 4001,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: keepDate,
        updated_at: keepDate,
        logs_count: 10,
        events_count: 20,
        evidence_count: 5,
      });
      engine.runs.push({
        id: 4002,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: expireDate,
        updated_at: expireDate,
        logs_count: 10,
        events_count: 20,
        evidence_count: 5,
      });

      const res = engine.prune({ workspaceId: wsId, referenceTime: now });
      expect(res.deletedRuns).toBe(1);
      expect(engine.runs.map((r) => r.id)).toEqual([4001]);
    });

    it('[CHALLENGE-05] Custom plan retention overrides work accurately via --days option', () => {
      const now = new Date('2026-08-29T12:00:00Z');
      const wsId = 3; // Team workspace (normally 365d)

      // Test with custom --days=14
      engine.runs.push({
        id: 5001,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10d old -> KEEP
        updated_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        logs_count: 2,
        events_count: 2,
        evidence_count: 1,
      });
      engine.runs.push({
        id: 5002,
        workspace_id: wsId,
        task_id: 1,
        status: 'completed',
        created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20d old -> EXPIRED under 14d
        updated_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        logs_count: 2,
        events_count: 2,
        evidence_count: 1,
      });

      const res = engine.prune({ workspaceId: wsId, days: 14, referenceTime: now });
      expect(res.deletedRuns).toBe(1);
      expect(engine.runs.map((r) => r.id)).toEqual([5001]);
    });
  });

  // ============================================================================
  // 2. Active and In-Flight Run Protection (All 5 Protected Statuses)
  // ============================================================================
  describe('2. In-Flight & Active Run Protection Across All 5 Protected Statuses', () => {
    it('[CHALLENGE-06] Never prunes in-flight runs with status in PROTECTED_STATUSES regardless of extreme age', () => {
      const wsId = 1; // Community (7d)
      const extremeDaysOld = 2000; // ~5.5 years old

      const protectedStatuses: Array<'queued' | 'claimed' | 'preparing' | 'running' | 'waiting_input'> = [
        'queued',
        'claimed',
        'preparing',
        'running',
        'waiting_input',
      ];

      expect(PROTECTED_AGENT_STATUSES).toEqual(['queued', 'claimed', 'preparing', 'running', 'waiting_input']);

      protectedStatuses.forEach((status, idx) => {
        engine.addRun({
          id: 6000 + idx,
          workspace_id: wsId,
          task_id: 100 + idx,
          status: status,
          daysOld: extremeDaysOld,
          logs: 10,
          events: 20,
          evidence: 2,
        });
      });

      // Also add 1 terminal expired run
      engine.addRun({
        id: 6999,
        workspace_id: wsId,
        task_id: 999,
        status: 'completed',
        daysOld: 30,
        logs: 5,
        events: 10,
        evidence: 1,
      });

      expect(engine.runs.length).toBe(6);

      const res = engine.prune({ workspaceId: wsId });
      expect(res.deletedRuns).toBe(1); // Only 6999 was deleted

      const remainingRuns = engine.runs.filter((r) => r.workspace_id === wsId);
      expect(remainingRuns.length).toBe(5);

      const remainingStatuses = remainingRuns.map((r) => r.status);
      expect(remainingStatuses).toContain('queued');
      expect(remainingStatuses).toContain('claimed');
      expect(remainingStatuses).toContain('preparing');
      expect(remainingStatuses).toContain('running');
      expect(remainingStatuses).toContain('waiting_input');
    });

    it('[CHALLENGE-07] Prunes all terminal statuses when older than cutoff', () => {
      const wsId = 1;
      const terminalStatuses: Array<'completed' | 'failed' | 'cancelled' | 'timeout' | 'needs_review' | 'rejected'> = [
        'completed',
        'failed',
        'cancelled',
        'timeout',
        'needs_review',
        'rejected',
      ];

      terminalStatuses.forEach((status, idx) => {
        engine.addRun({
          id: 7000 + idx,
          workspace_id: wsId,
          task_id: 200 + idx,
          status: status,
          daysOld: 15, // Expired under 7d
          logs: 2,
          events: 4,
          evidence: 1,
        });
      });

      expect(engine.runs.length).toBe(6);

      const res = engine.prune({ workspaceId: wsId });
      expect(res.deletedRuns).toBe(6);
      expect(engine.runs.length).toBe(0);
    });
  });

  // ============================================================================
  // 3. Dry Run Safety & Non-Destructive Simulation
  // ============================================================================
  describe('3. Dry-Run Mode Safety & Mutation Invariance', () => {
    it('[CHALLENGE-08] --dry-run accurately tallies runs, logs, events, evidence with zero database mutations', () => {
      engine.addRun({ id: 801, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 15, logs: 10, events: 25, evidence: 3 });
      engine.addRun({ id: 802, workspace_id: 1, task_id: 1, status: 'failed', daysOld: 20, logs: 8, events: 15, evidence: 2 });
      engine.addRun({ id: 803, workspace_id: 1, task_id: 2, status: 'completed', daysOld: 2, logs: 5, events: 10, evidence: 1 }); // KEEP

      const initialRunCount = engine.runs.length;
      const initialLogsMapSize = engine.cascadingLogs.size;
      const initialEventsMapSize = engine.cascadingEvents.size;
      const initialEvidenceMapSize = engine.cascadingEvidence.size;

      const dryRunRes = engine.prune({ workspaceId: 1, dryRun: true });

      expect(dryRunRes.dryRun).toBe(true);
      expect(dryRunRes.deletedRuns).toBe(2);
      expect(dryRunRes.deletedLogs).toBe(18); // 10 + 8
      expect(dryRunRes.deletedEvents).toBe(40); // 25 + 15
      expect(dryRunRes.deletedEvidence).toBe(5); // 3 + 2

      // Verify ZERO mutation
      expect(engine.runs.length).toBe(initialRunCount);
      expect(engine.cascadingLogs.size).toBe(initialLogsMapSize);
      expect(engine.cascadingEvents.size).toBe(initialEventsMapSize);
      expect(engine.cascadingEvidence.size).toBe(initialEvidenceMapSize);
      expect(engine.cascadingLogs.has(801)).toBe(true);
      expect(engine.cascadingLogs.has(802)).toBe(true);
      expect(engine.cascadingLogs.has(803)).toBe(true);
    });

    it('[CHALLENGE-09] Consecutive dry-run executions are strictly idempotent and deterministic', () => {
      engine.addRun({ id: 901, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 30, logs: 5, events: 10, evidence: 1 });

      const res1 = engine.prune({ workspaceId: 1, dryRun: true });
      const res2 = engine.prune({ workspaceId: 1, dryRun: true });
      const res3 = engine.prune({ workspaceId: 1, dryRun: true });

      expect(res1.deletedRuns).toBe(res2.deletedRuns);
      expect(res2.deletedRuns).toBe(res3.deletedRuns);
      expect(res1.deletedLogs).toBe(res3.deletedLogs);
      expect(engine.runs.length).toBe(1);

      // Now live run
      const liveRes = engine.prune({ workspaceId: 1, dryRun: false });
      expect(liveRes.deletedRuns).toBe(1);
      expect(engine.runs.length).toBe(0);
    });
  });

  // ============================================================================
  // 4. Single Workspace Isolation & Error Handling
  // ============================================================================
  describe('4. Workspace Isolation & Error Handling', () => {
    it('[CHALLENGE-10] --workspace={id} strictly isolates operations to target workspace', () => {
      engine.addRun({ id: 1001, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 20 });
      engine.addRun({ id: 2001, workspace_id: 2, task_id: 2, status: 'completed', daysOld: 150 });
      engine.addRun({ id: 3001, workspace_id: 3, task_id: 3, status: 'completed', daysOld: 400 });
      engine.addRun({ id: 4001, workspace_id: 4, task_id: 4, status: 'completed', daysOld: 800 });

      const res = engine.prune({ workspaceId: 2 }); // Target Pro only
      expect(res.scannedWorkspaces).toBe(1);
      expect(res.deletedRuns).toBe(1);

      const remainingIds = engine.runs.map((r) => r.id);
      expect(remainingIds).toContain(1001); // WS 1 untouched
      expect(remainingIds).not.toContain(2001); // WS 2 deleted
      expect(remainingIds).toContain(3001); // WS 3 untouched
      expect(remainingIds).toContain(4001); // WS 4 untouched
    });

    it('[CHALLENGE-11] Non-existent workspace ID returns exit code 1 with error logging', () => {
      const res = engine.prune({ workspaceId: 99999 });
      expect(res.exitCode).toBe(1);
      expect(res.scannedWorkspaces).toBe(0);
      expect(res.deletedRuns).toBe(0);
      expect(res.logsOutput.some((log) => log.includes('Workspace with ID 99999 not found'))).toBe(true);
    });
  });

  // ============================================================================
  // 5. Cascading Deletion Completeness & Tenant Boundary Safety
  // ============================================================================
  describe('5. Cascading Deletions Integrity', () => {
    it('[CHALLENGE-12] Cascading deletion purges child records of expired runs while preserving child records of active runs', () => {
      // Expired run in WS 1
      engine.addRun({ id: 1101, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 15, logs: 6, events: 12, evidence: 2 });
      // Active run in WS 1
      engine.addRun({ id: 1102, workspace_id: 1, task_id: 1, status: 'running', daysOld: 15, logs: 8, events: 16, evidence: 3 });

      expect(engine.cascadingLogs.get(1101)).toBe(6);
      expect(engine.cascadingLogs.get(1102)).toBe(8);

      const res = engine.prune({ workspaceId: 1 });
      expect(res.deletedRuns).toBe(1);
      expect(res.deletedLogs).toBe(6);
      expect(res.deletedEvents).toBe(12);
      expect(res.deletedEvidence).toBe(2);

      // Verify expired run child records deleted
      expect(engine.cascadingLogs.has(1101)).toBe(false);
      expect(engine.cascadingEvents.has(1101)).toBe(false);
      expect(engine.cascadingEvidence.has(1101)).toBe(false);

      // Verify active run child records PRESERVED
      expect(engine.cascadingLogs.has(1102)).toBe(true);
      expect(engine.cascadingEvents.has(1102)).toBe(true);
      expect(engine.cascadingEvidence.has(1102)).toBe(true);
    });
  });

  // ============================================================================
  // 6. High-Volume Scalability & Edge Cases
  // ============================================================================
  describe('6. High-Volume Scalability & Zero-State Edge Cases', () => {
    it('[CHALLENGE-13] High volume stress test: prunes 5,000 expired runs across multiple workspaces seamlessly', () => {
      const TOTAL_RUNS = 5000;
      for (let i = 1; i <= TOTAL_RUNS; i++) {
        const wsId = (i % 4) + 1;
        engine.addRun({
          id: i,
          workspace_id: wsId,
          task_id: i,
          status: 'completed',
          daysOld: 1000, // Expired for all plans
          logs: 2,
          events: 3,
          evidence: 1,
        });
      }

      expect(engine.runs.length).toBe(TOTAL_RUNS);

      const start = Date.now();
      const res = engine.prune();
      const elapsed = Date.now() - start;

      expect(res.deletedRuns).toBe(TOTAL_RUNS);
      expect(res.deletedLogs).toBe(TOTAL_RUNS * 2);
      expect(res.deletedEvents).toBe(TOTAL_RUNS * 3);
      expect(res.deletedEvidence).toBe(TOTAL_RUNS * 1);
      expect(engine.runs.length).toBe(0);
      expect(elapsed).toBeLessThan(1000); // Fast execution in <1s
    });

    it('[CHALLENGE-14] Zero-state workspace with 0 runs executes cleanly with 0 deletions', () => {
      const emptyEngine = new RetentionPruningEngineSimulator();
      const res = emptyEngine.prune();

      expect(res.exitCode).toBe(0);
      expect(res.scannedWorkspaces).toBe(4);
      expect(res.deletedRuns).toBe(0);
      expect(res.deletedLogs).toBe(0);
      expect(res.deletedEvents).toBe(0);
      expect(res.deletedEvidence).toBe(0);
    });
  });
});
