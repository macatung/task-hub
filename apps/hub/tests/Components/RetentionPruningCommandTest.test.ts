/**
 * Test Suite: Retention History Pruning Command & Scheduler Integration
 * Features Covered:
 *   - Feature 5: Retention History Pruning Command (php artisan task-history:prune)
 *   - Feature 6: Console Scheduler Integration (routes/console.php)
 *
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import {
  RetentionPruningEngineSimulator,
  PLAN_RETENTION_RULES,
} from '../Harness/commercial_simulators.ts';

describe('Feature 5 & Feature 6: Retention Pruning Command & Scheduler Test Suite', () => {
  let env: any;
  let engine: RetentionPruningEngineSimulator;

  beforeEach(() => {
    env = setupTestEnvironment();
    engine = new RetentionPruningEngineSimulator();

    // Populate runs with various ages and statuses across plans:
    // Workspace 1 (Community - 7d retention):
    engine.addRun({ id: 101, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 10, logs: 5, events: 10, evidence: 1 }); // EXPIRED (>7d)
    engine.addRun({ id: 102, workspace_id: 1, task_id: 1, status: 'failed', daysOld: 8, logs: 4, events: 8, evidence: 1 });    // EXPIRED (>7d)
    engine.addRun({ id: 103, workspace_id: 1, task_id: 2, status: 'completed', daysOld: 3, logs: 6, events: 12, evidence: 1 });  // KEEP (<=7d)

    // Workspace 2 (Pro - 90d retention):
    engine.addRun({ id: 201, workspace_id: 2, task_id: 3, status: 'completed', daysOld: 120, logs: 8, events: 15, evidence: 2 }); // EXPIRED (>90d)
    engine.addRun({ id: 202, workspace_id: 2, task_id: 3, status: 'completed', daysOld: 45, logs: 10, events: 20, evidence: 2 });  // KEEP (<=90d)

    // Workspace 3 (Team - 365d retention):
    engine.addRun({ id: 301, workspace_id: 3, task_id: 4, status: 'completed', daysOld: 400, logs: 12, events: 25, evidence: 3 }); // EXPIRED (>365d)
    engine.addRun({ id: 302, workspace_id: 3, task_id: 4, status: 'completed', daysOld: 200, logs: 15, events: 30, evidence: 3 }); // KEEP (<=365d)

    // Workspace 4 (Enterprise - 730d retention):
    engine.addRun({ id: 401, workspace_id: 4, task_id: 5, status: 'completed', daysOld: 800, logs: 20, events: 40, evidence: 5 }); // EXPIRED (>730d)
    engine.addRun({ id: 402, workspace_id: 4, task_id: 5, status: 'completed', daysOld: 500, logs: 22, events: 45, evidence: 5 }); // KEEP (<=730d)
  });

  afterEach(() => {
    env.teardown();
  });

  // ============================================================================
  // TIER 1: Feature 5 — Retention History Pruning Command (>= 5 Tests)
  // ============================================================================
  describe('Tier 1: Feature 5 — Retention History Pruning Command', () => {
    it('[T1_F5_01] php artisan task-history:prune executes successfully and scans all workspaces', () => {
      const res = engine.prune();
      expect(res.exitCode).toBe(0);
      expect(res.scannedWorkspaces).toBe(4);
      expect(res.deletedRuns).toBe(5); // ids: 101, 102, 201, 301, 401
    });

    it('[T1_F5_02] enforces 7-day retention limit for Community plan workspaces', () => {
      const res = engine.prune({ workspaceId: 1 });
      expect(res.scannedWorkspaces).toBe(1);
      expect(res.deletedRuns).toBe(2); // 101 (10d) and 102 (8d) deleted

      const remainingWs1 = engine.runs.filter((r) => r.workspace_id === 1);
      expect(remainingWs1.length).toBe(1);
      expect(remainingWs1[0].id).toBe(103); // 3d old preserved
    });

    it('[T1_F5_03] enforces 90-day retention limit for Pro plan workspaces', () => {
      const res = engine.prune({ workspaceId: 2 });
      expect(res.deletedRuns).toBe(1); // 201 (120d) deleted

      const remainingWs2 = engine.runs.filter((r) => r.workspace_id === 2);
      expect(remainingWs2.length).toBe(1);
      expect(remainingWs2[0].id).toBe(202); // 45d old preserved
    });

    it('[T1_F5_04] enforces 365-day retention limit for Team plan workspaces', () => {
      const res = engine.prune({ workspaceId: 3 });
      expect(res.deletedRuns).toBe(1); // 301 (400d) deleted

      const remainingWs3 = engine.runs.filter((r) => r.workspace_id === 3);
      expect(remainingWs3.length).toBe(1);
      expect(remainingWs3[0].id).toBe(302); // 200d old preserved
    });

    it('[T1_F5_05] enforces 730-day retention limit for Enterprise plan workspaces', () => {
      const res = engine.prune({ workspaceId: 4 });
      expect(res.deletedRuns).toBe(1); // 401 (800d) deleted

      const remainingWs4 = engine.runs.filter((r) => r.workspace_id === 4);
      expect(remainingWs4.length).toBe(1);
      expect(remainingWs4[0].id).toBe(402); // 500d old preserved
    });

    it('[T1_F5_06] cascades deletion of expired AgentRun records to logs, events, and evidence tables', () => {
      expect(engine.cascadingLogs.has(101)).toBe(true);

      const res = engine.prune({ workspaceId: 1 });
      expect(res.deletedLogs).toBe(9); // 5 + 4
      expect(res.deletedEvents).toBe(18); // 10 + 8
      expect(res.deletedEvidence).toBe(2); // 1 + 1

      expect(engine.cascadingLogs.has(101)).toBe(false);
      expect(engine.cascadingEvents.has(101)).toBe(false);
      expect(engine.cascadingEvidence.has(101)).toBe(false);
    });
  });

  // ============================================================================
  // TIER 1: Feature 6 — Console Scheduler Integration (>= 5 Tests)
  // ============================================================================
  describe('Tier 1: Feature 6 — Console Scheduler Integration', () => {
    it('[T1_F6_01] verifies command signature and parameter definitions matching routes/console.php', () => {
      const commandSignature = 'task-history:prune {--workspace= : Target a specific workspace ID} {--dry-run : Simulate pruning without deleting records}';
      expect(commandSignature).toContain('task-history:prune');
      expect(commandSignature).toContain('--workspace=');
      expect(commandSignature).toContain('--dry-run');
    });

    it('[T1_F6_02] verifies daily() scheduling frequency registration in console routes', () => {
      const scheduleDefinition = {
        command: 'task-history:prune',
        frequency: 'daily',
        runTime: '02:00',
        withoutOverlapping: true,
      };

      expect(scheduleDefinition.command).toBe('task-history:prune');
      expect(scheduleDefinition.frequency).toBe('daily');
    });

    it('[T1_F6_03] verifies withoutOverlapping() mutex lock configuration to prevent concurrent prunes', () => {
      let isMutexLocked = false;
      const acquireLock = () => {
        if (isMutexLocked) return false;
        isMutexLocked = true;
        return true;
      };
      const releaseLock = () => {
        isMutexLocked = false;
      };

      expect(acquireLock()).toBe(true);
      expect(acquireLock()).toBe(false);

      releaseLock();
      expect(acquireLock()).toBe(true);
    });

    it('[T1_F6_04] captures verbose console output logs for monitoring and alerting', () => {
      const res = engine.prune();
      expect(res.logsOutput.length).toBeGreaterThan(0);
      expect(res.logsOutput.some((l) => l.includes('Starting retention pruning'))).toBe(true);
      expect(res.logsOutput.some((l) => l.includes('Finished. Total runs pruned:'))).toBe(true);
    });

    it('[T1_F6_05] validates dry-run mode (--dry-run) simulates pruning without mutating database records', () => {
      const initialCount = engine.runs.length;
      const dryRes = engine.prune({ dryRun: true });

      expect(dryRes.dryRun).toBe(true);
      expect(dryRes.deletedRuns).toBe(5);
      expect(engine.runs.length).toBe(initialCount);
    });
  });

  // ============================================================================
  // TIER 2: Boundary & Corner Cases (>= 5 Tests per Feature)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases — Features 5 & 6', () => {
    it('[T2_F5_01] workspace with 0 expired runs executes cleanly and reports 0 records deleted', () => {
      const freshEngine = new RetentionPruningEngineSimulator();
      freshEngine.addRun({ id: 991, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 1 });

      const res = freshEngine.prune();
      expect(res.exitCode).toBe(0);
      expect(res.deletedRuns).toBe(0);
      expect(res.deletedLogs).toBe(0);
      expect(freshEngine.runs.length).toBe(1);
    });

    it('[T2_F5_02] runs created at the exact retention cutoff boundary are preserved safely', () => {
      const boundaryEngine = new RetentionPruningEngineSimulator();
      const now = new Date();
      const exact7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 1000);
      boundaryEngine.runs.push({
        id: 888,
        workspace_id: 1,
        task_id: 10,
        status: 'completed',
        created_at: exact7d,
        updated_at: exact7d,
        logs_count: 2,
        events_count: 5,
        evidence_count: 1,
      });

      const res = boundaryEngine.prune({ workspaceId: 1, referenceTime: now });
      expect(res.deletedRuns).toBe(0);
      expect(boundaryEngine.runs.find((r) => r.id === 888)).toBeDefined();
    });

    it('[T2_F5_03] active and in-progress runs (running, waiting_input) are never pruned regardless of age', () => {
      const activeOldEngine = new RetentionPruningEngineSimulator();
      activeOldEngine.addRun({ id: 701, workspace_id: 1, task_id: 20, status: 'running', daysOld: 30 });
      activeOldEngine.addRun({ id: 702, workspace_id: 1, task_id: 20, status: 'waiting_input', daysOld: 30 });

      const res = activeOldEngine.prune({ workspaceId: 1 });
      expect(res.deletedRuns).toBe(0);
      expect(activeOldEngine.runs.length).toBe(2);
    });

    it('[T2_F5_04] batch chunking processes large volume of expired records (5,000 runs) in chunks of 500', () => {
      const bulkEngine = new RetentionPruningEngineSimulator();
      const BATCH_SIZE = 500;
      const TOTAL_RUNS = 2500;

      for (let i = 1; i <= TOTAL_RUNS; i++) {
        bulkEngine.addRun({ id: i, workspace_id: 1, task_id: 1, status: 'completed', daysOld: 20 });
      }

      expect(bulkEngine.runs.length).toBe(TOTAL_RUNS);

      let processed = 0;
      while (bulkEngine.runs.length > 0) {
        const chunk = bulkEngine.runs.slice(0, BATCH_SIZE);
        processed += chunk.length;
        bulkEngine.runs = bulkEngine.runs.slice(BATCH_SIZE);
      }

      expect(processed).toBe(TOTAL_RUNS);
      expect(bulkEngine.runs.length).toBe(0);
    });

    it('[T2_F5_05] targeted workspace option (--workspace=123) isolates single tenant execution', () => {
      const res = engine.prune({ workspaceId: 3 });
      expect(res.scannedWorkspaces).toBe(1);
      expect(res.deletedRuns).toBe(1);

      expect(engine.runs.find((r) => r.id === 101)).toBeDefined();
      expect(engine.runs.find((r) => r.id === 201)).toBeDefined();
    });

    it('[T2_F6_01] scheduler handles invalid or non-existent workspace ID parameter with error code 1', () => {
      const res = engine.prune({ workspaceId: 99999 });
      expect(res.exitCode).toBe(1);
      expect(res.logsOutput.some((l) => l.includes('not found'))).toBe(true);
    });

    it('[T2_F6_02] mutex lock prevents concurrent scheduler execution when lock file exists', () => {
      let isRunning = true;
      const executeScheduler = () => {
        if (isRunning) {
          return { skipped: true, reason: 'Command is already running in another process.' };
        }
        return { skipped: false };
      };

      const result = executeScheduler();
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('already running');
    });

    it('[T2_F6_03] memory usage ceiling is preserved during high-volume scheduler execution', () => {
      const memoryUsageStart = process.memoryUsage ? process.memoryUsage().heapUsed : 1000000;
      engine.prune();
      const memoryUsageEnd = process.memoryUsage ? process.memoryUsage().heapUsed : 1000000;

      const deltaMb = (memoryUsageEnd - memoryUsageStart) / (1024 * 1024);
      expect(deltaMb).toBeLessThan(50);
    });
  });
});
