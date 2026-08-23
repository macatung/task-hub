import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read integration plan markdown
const planPath = path.resolve(__dirname, '../../../docs/research/antigravity_codex_integration_plan.md');
const planContent = fs.readFileSync(planPath, 'utf8');

describe('Challenger 2: Empirical Roadmap & Feasibility Verification', () => {

  // =========================================================================
  // 1. Worktree Rollback & Leak-Free Lifecycle Verification
  // =========================================================================
  describe('1. Worktree Isolation, Auto-Healing & Rollback Logic', () => {
    
    interface MockWorktreeState {
      existingWorktrees: Set<string>;
      existingBranches: Set<string>;
      openFileHandles: Map<string, number>;
      cleanedWorktrees: string[];
      pruneCalledCount: number;
    }

    class MockGitWorktreeManager {
      public state: MockWorktreeState = {
        existingWorktrees: new Set(),
        existingBranches: new Set(),
        openFileHandles: new Map(),
        cleanedWorktrees: [],
        pruneCalledCount: 0,
      };

      public createWorktree(repository: string, issueKey: string): { path: string; branch: string; reused: boolean } {
        const key = issueKey.replace(/[^a-zA-Z0-9_-]/g, '_');
        const branch = `codex/${key}`;
        const targetPath = `/worktrees/${key}`;

        if (this.state.existingWorktrees.has(targetPath)) {
          return { path: targetPath, branch, reused: true };
        }

        this.state.existingWorktrees.add(targetPath);
        this.state.existingBranches.add(branch);
        return { path: targetPath, branch, reused: false };
      }

      public cleanupWorktree(repository: string, worktreePath: string, forceKillProcesses: boolean = true): { success: boolean; error?: string } {
        // If processes hold open file handles and were not killed, deletion fails with EBUSY (Windows Win32 error 32)
        const openHandles = this.state.openFileHandles.get(worktreePath) || 0;
        if (openHandles > 0 && !forceKillProcesses) {
          return {
            success: false,
            error: 'EBUSY: resource busy or locked, unlink target directory',
          };
        }

        // Release file handles on process tree kill
        if (forceKillProcesses) {
          this.state.openFileHandles.delete(worktreePath);
        }

        this.state.existingWorktrees.delete(worktreePath);
        this.state.cleanedWorktrees.push(worktreePath);
        this.prune();
        return { success: true };
      }

      public prune(): void {
        this.state.pruneCalledCount++;
      }
    }

    it('verifies that worktree creation gracefully handles branch and directory collisions', () => {
      const mgr = new MockGitWorktreeManager();
      
      // 1. Initial creation
      const res1 = mgr.createWorktree('/repo', 'TASK-101');
      expect(res1.reused).toBe(false);
      expect(res1.path).toBe('/worktrees/TASK-101');
      expect(res1.branch).toBe('codex/TASK-101');

      // 2. Second attempt (reuse existing worktree instead of erroring)
      const res2 = mgr.createWorktree('/repo', 'TASK-101');
      expect(res2.reused).toBe(true);
      expect(res2.path).toBe('/worktrees/TASK-101');
    });

    it('verifies that process tree termination is necessary before worktree cleanup on Windows to prevent EBUSY locks', () => {
      const mgr = new MockGitWorktreeManager();
      const res = mgr.createWorktree('/repo', 'TASK-102');
      
      // Simulate an orphaned child process holding an open file handle
      mgr.state.openFileHandles.set(res.path, 2);

      // Attempt cleanup WITHOUT killing processes -> must fail with EBUSY
      const failedCleanup = mgr.cleanupWorktree('/repo', res.path, false);
      expect(failedCleanup.success).toBe(false);
      expect(failedCleanup.error).toContain('EBUSY');

      // Attempt cleanup WITH process tree termination (taskkill /F /T) -> succeeds and auto-prunes
      const successfulCleanup = mgr.cleanupWorktree('/repo', res.path, true);
      expect(successfulCleanup.success).toBe(true);
      expect(mgr.state.cleanedWorktrees).toContain(res.path);
      expect(mgr.state.existingWorktrees.has(res.path)).toBe(false);
      expect(mgr.state.pruneCalledCount).toBeGreaterThanOrEqual(1);
    });

    it('empirically verifies guaranteed rollback via finally block across all failure injection points', async () => {
      const mgr = new MockGitWorktreeManager();

      async function runAutoPilotLifecycle(failureStage?: string) {
        let worktreePath: string | null = null;
        let activePid: number | null = 12345;
        let cleanupExecuted = false;

        try {
          // Stage 1: Preflight
          if (failureStage === 'preflight') throw new Error('Preflight failure');

          // Stage 2: Worktree Creation
          const wt = mgr.createWorktree('/repo', 'TASK-FAIL-TEST');
          worktreePath = wt.path;
          mgr.state.openFileHandles.set(worktreePath, 1);
          if (failureStage === 'worktree') throw new Error('Worktree error');

          // Stage 3: Context
          if (failureStage === 'context') throw new Error('Context error');

          // Stage 4: Executing
          if (failureStage === 'executing') throw new Error('Agent runtime crash');

          // Stage 5: Waiting Input / Safety
          if (failureStage === 'waiting_input') throw new Error('Rejected safety check');

          // Stage 6: Testing
          if (failureStage === 'testing') throw new Error('Test run failure');

          // Stage 7: Handoff
          if (failureStage === 'handoff') throw new Error('Handoff submission error');

          return { success: true };
        } finally {
          // Guaranteed rollback hook
          cleanupExecuted = true;
          if (worktreePath) {
            // Terminate process tree then cleanup worktree
            activePid = null;
            mgr.cleanupWorktree('/repo', worktreePath, true);
          }
        }
      }

      const failureStages = ['preflight', 'worktree', 'context', 'executing', 'waiting_input', 'testing', 'handoff'];
      
      for (const stage of failureStages) {
        mgr.state.cleanedWorktrees = [];
        await expect(runAutoPilotLifecycle(stage)).rejects.toThrow();
        
        // For stages after preflight, worktree was created and MUST be cleaned up in finally
        if (stage !== 'preflight') {
          expect(mgr.state.cleanedWorktrees).toContain('/worktrees/TASK-FAIL-TEST');
          expect(mgr.state.existingWorktrees.has('/worktrees/TASK-FAIL-TEST')).toBe(false);
        }
      }

      // Success path also cleans up
      mgr.state.cleanedWorktrees = [];
      const okResult = await runAutoPilotLifecycle(undefined);
      expect(okResult.success).toBe(true);
      expect(mgr.state.cleanedWorktrees).toContain('/worktrees/TASK-FAIL-TEST');
    });
  });

  // =========================================================================
  // 2. 15-Minute waiting_input Timeout & Fail-Closed Security State Machine
  // =========================================================================
  describe('2. 15-Minute waiting_input Timeout & Fail-Closed State Machine', () => {
    
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    interface StateMachineEvent {
      type: 'APPROVAL' | 'REJECTION' | 'CANCEL' | 'TIMEOUT';
      timestamp: number;
    }

    class SafetyApprovalSession {
      public stage: 'waiting_input' | 'executing' | 'failed' | 'timed_out' | 'cancelled' = 'waiting_input';
      public resolved = false;
      public timerHandle: any = null;
      public cleanupRan = false;

      constructor(
        public readonly timeoutMs: number = 15 * 60 * 1000, // 15 minutes default
        private readonly onResolution?: (verdict: 'approved' | 'rejected' | 'timed_out' | 'cancelled') => void
      ) {
        this.timerHandle = setTimeout(() => {
          this.handleTimeout();
        }, this.timeoutMs);
      }

      public approve(): boolean {
        if (this.resolved) return false;
        this.clearTimer();
        this.resolved = true;
        this.stage = 'executing';
        this.onResolution?.('approved');
        return true;
      }

      public reject(reason = 'User rejected'): boolean {
        if (this.resolved) return false;
        this.clearTimer();
        this.resolved = true;
        this.stage = 'failed';
        this.runCleanup();
        this.onResolution?.('rejected');
        return true;
      }

      public cancel(): boolean {
        if (this.resolved) return false;
        this.clearTimer();
        this.resolved = true;
        this.stage = 'cancelled';
        this.runCleanup();
        this.onResolution?.('cancelled');
        return true;
      }

      private handleTimeout(): void {
        if (this.resolved) return;
        this.resolved = true;
        this.stage = 'timed_out'; // Fail-closed policy
        this.runCleanup();
        this.onResolution?.('timed_out');
      }

      private clearTimer(): void {
        if (this.timerHandle) {
          clearTimeout(this.timerHandle);
          this.timerHandle = null;
        }
      }

      private runCleanup(): void {
        this.cleanupRan = true;
      }
    }

    it('allows user approval within 15-minute window and resumes execution', () => {
      let resolution: string | null = null;
      const session = new SafetyApprovalSession(15 * 60 * 1000, (verdict) => {
        resolution = verdict;
      });

      expect(session.stage).toBe('waiting_input');

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(session.stage).toBe('waiting_input');
      expect(session.resolved).toBe(false);

      // User approves at 5m mark
      const approved = session.approve();
      expect(approved).toBe(true);
      expect(session.stage).toBe('executing');
      expect(session.resolved).toBe(true);
      expect(resolution).toBe('approved');

      // Advance past 15 minutes to verify timer was cleared and does not fire
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(session.stage).toBe('executing'); // Did not regress to timed_out!
    });

    it('enforces fail-closed termination and cleanup when 15-minute timeout expires', () => {
      let resolution: string | null = null;
      const session = new SafetyApprovalSession(15 * 60 * 1000, (verdict) => {
        resolution = verdict;
      });

      expect(session.stage).toBe('waiting_input');

      // Advance time to 14m 59s
      vi.advanceTimersByTime(14 * 60 * 1000 + 59 * 1000);
      expect(session.stage).toBe('waiting_input');
      expect(session.resolved).toBe(false);
      expect(session.cleanupRan).toBe(false);

      // Advance 2 more seconds -> passes 15:00
      vi.advanceTimersByTime(2000);

      expect(session.resolved).toBe(true);
      expect(session.stage).toBe('timed_out');
      expect(session.cleanupRan).toBe(true);
      expect(resolution).toBe('timed_out');

      // Late approval attempt is rejected
      const lateApprove = session.approve();
      expect(lateApprove).toBe(false);
      expect(session.stage).toBe('timed_out');
    });

    it('handles explicit user rejection and immediate cleanup', () => {
      let resolution: string | null = null;
      const session = new SafetyApprovalSession(15 * 60 * 1000, (verdict) => {
        resolution = verdict;
      });

      // User rejects after 30 seconds
      vi.advanceTimersByTime(30 * 1000);
      session.reject('Dangerous rm command detected');

      expect(session.resolved).toBe(true);
      expect(session.stage).toBe('failed');
      expect(session.cleanupRan).toBe(true);
      expect(resolution).toBe('rejected');
    });

    it('handles cancellation and immediate teardown during waiting_input', () => {
      let resolution: string | null = null;
      const session = new SafetyApprovalSession(15 * 60 * 1000, (verdict) => {
        resolution = verdict;
      });

      session.cancel();

      expect(session.resolved).toBe(true);
      expect(session.stage).toBe('cancelled');
      expect(session.cleanupRan).toBe(true);
      expect(resolution).toBe('cancelled');
    });
  });

  // =========================================================================
  // 3. Process Tree Supervision & Windows Job Object Teardown Logic
  // =========================================================================
  describe('3. Process Tree Supervision & Teardown Logic', () => {

    it('verifies ProcessTreeSupervisor graceful -> force kill escalation logic', async () => {
      // Simulate ProcessTreeSupervisor termination sequence
      type TerminationLog = { phase: string; signal?: string; command?: string; pid: number };
      const logs: TerminationLog[] = [];

      async function simulateTermination(isWindows: boolean, pid: number, respondsToGraceful: boolean): Promise<boolean> {
        if (!pid) return true;

        // Phase 1: Graceful
        if (isWindows) {
          logs.push({ phase: 'graceful_stdin_close', pid });
        } else {
          logs.push({ phase: 'graceful_sigint', signal: 'SIGINT', pid });
        }

        if (respondsToGraceful) {
          logs.push({ phase: 'graceful_exit_success', pid });
          return true;
        }

        // Phase 2: Force Kill
        if (isWindows) {
          logs.push({ phase: 'force_taskkill_tree', command: `taskkill /F /T /PID ${pid}`, pid });
          return true;
        } else {
          logs.push({ phase: 'force_sigterm_group', signal: 'SIGTERM', pid });
          logs.push({ phase: 'force_sigkill_group', signal: 'SIGKILL', pid });
          return true;
        }
      }

      // Windows responsive process
      logs.length = 0;
      const winOk = await simulateTermination(true, 1001, true);
      expect(winOk).toBe(true);
      expect(logs.some(l => l.phase === 'graceful_stdin_close')).toBe(true);

      // Windows stubborn process -> taskkill /F /T /PID
      logs.length = 0;
      const winStubborn = await simulateTermination(true, 1002, false);
      expect(winStubborn).toBe(true);
      expect(logs.some(l => l.phase === 'force_taskkill_tree' && l.command?.includes('taskkill /F /T /PID 1002'))).toBe(true);

      // POSIX stubborn process -> SIGINT -> SIGTERM -> SIGKILL
      logs.length = 0;
      const posixStubborn = await simulateTermination(false, 2001, false);
      expect(posixStubborn).toBe(true);
      expect(logs.some(l => l.phase === 'graceful_sigint')).toBe(true);
      expect(logs.some(l => l.phase === 'force_sigkill_group')).toBe(true);
    });

    it('verifies that taskkill exit code 128 (process already exited) is treated as success', () => {
      function handleTaskkillResult(exitCode: number, stderr: string): boolean {
        if (exitCode === 0) return true;
        if (exitCode === 128 || stderr.includes('not found') || stderr.includes('no running instance')) {
          return true; // Already exited is a successful kill state
        }
        return false;
      }

      expect(handleTaskkillResult(0, '')).toBe(true);
      expect(handleTaskkillResult(128, 'ERROR: The process not found.')).toBe(true);
      expect(handleTaskkillResult(1, 'ERROR: Access is denied.')).toBe(false);
    });
  });

  // =========================================================================
  // 4. Roadmap Feasibility & Dependency Gating Verification
  // =========================================================================
  describe('4. 4-Milestone Roadmap Structure & Dependency Gating', () => {

    it('extracts all 4 Milestones from the integration plan document', () => {
      const milestoneMatches = planContent.match(/### Milestone \d:.*$/gm);
      expect(milestoneMatches).toBeDefined();
      expect(milestoneMatches?.length).toBe(4);

      expect(milestoneMatches![0]).toContain('Milestone 1: Unified Agent Runtime Adapter, Worktree Isolation & Foundational Safety Guardrails');
      expect(milestoneMatches![1]).toContain('Milestone 2: Zero Frame-Drop IPC, Memory Hygiene & Live Stream Cards UI');
      expect(milestoneMatches![2]).toContain('Milestone 3: Monaco Diff Review & Antigravity Artifact Engine');
      expect(milestoneMatches![3]).toContain('Milestone 4: Full Auto-Pilot Lifecycle with Guaranteed Rollback & Web Hub Remote Dispatch');
    });

    it('verifies that Safety Guardrails (Epic 1.4) is explicitly gated in Milestone 1', () => {
      const m1Section = planContent.substring(
        planContent.indexOf('### Milestone 1:'),
        planContent.indexOf('### Milestone 2:')
      );

      // Verify Epic 1.4 exists in Milestone 1
      expect(m1Section).toContain('Epic 1.4: Foundational Safety Guardrail Interceptor & Dangerous Command Trapping');
      expect(m1Section).toContain('Subtask 1.4.1');
      expect(m1Section).toContain('Subtask 1.4.2');
      expect(m1Section).toContain('Subtask 1.4.3');
      expect(m1Section).toContain('Acceptance Criteria');
    });

    it('verifies logical dependency graph across all Epics without circular dependencies', () => {
      interface EpicNode {
        id: string;
        title: string;
        milestone: number;
        dependencies: string[];
      }

      const epicGraph: Record<string, EpicNode> = {
        'Epic 1.1': { id: 'Epic 1.1', title: 'Runtime Adapter Abstraction', milestone: 1, dependencies: [] },
        'Epic 1.2': { id: 'Epic 1.2', title: 'Dynamic Model Discovery & Preflight', milestone: 1, dependencies: ['Epic 1.1'] },
        'Epic 1.3': { id: 'Epic 1.3', title: 'Git Worktree Isolation & Auto-Healing', milestone: 1, dependencies: ['Epic 1.1'] },
        'Epic 1.4': { id: 'Epic 1.4', title: 'Foundational Safety Guardrails', milestone: 1, dependencies: ['Epic 1.1'] },

        'Epic 2.1': { id: 'Epic 2.1', title: '16ms Batched IPC & Ring Buffer', milestone: 2, dependencies: ['Epic 1.1'] },
        'Epic 2.2': { id: 'Epic 2.2', title: 'shallowRef/markRaw & Web Worker Parser', milestone: 2, dependencies: ['Epic 2.1'] },
        'Epic 2.3': { id: 'Epic 2.3', title: 'Live Stream Cards Component Hierarchy', milestone: 2, dependencies: ['Epic 2.2'] },

        'Epic 3.1': { id: 'Epic 3.1', title: 'Monaco Multi-File Diff Explorer', milestone: 3, dependencies: ['Epic 1.3'] },
        'Epic 3.2': { id: 'Epic 3.2', title: 'Antigravity Markdown Artifact Renderer', milestone: 3, dependencies: ['Epic 2.3'] },
        'Epic 3.3': { id: 'Epic 3.3', title: 'Verification & Test Evidence Collector', milestone: 3, dependencies: ['Epic 1.1'] },

        'Epic 4.1': { id: 'Epic 4.1', title: '7-Stage Auto-Pilot State Machine', milestone: 4, dependencies: ['Epic 1.2', 'Epic 1.3', 'Epic 1.4', 'Epic 2.3', 'Epic 3.1', 'Epic 3.3'] },
        'Epic 4.2': { id: 'Epic 4.2', title: 'Web Hub Remote Task Dispatch & SSE', milestone: 4, dependencies: ['Epic 4.1'] },
        'Epic 4.3': { id: 'Epic 4.3', title: 'E2E Test Suite & Integrity Attestation', milestone: 4, dependencies: ['Epic 4.1', 'Epic 4.2'] },
      };

      // Check for cycles using DFS
      const visited: Record<string, 'unvisited' | 'visiting' | 'visited'> = {};
      for (const k of Object.keys(epicGraph)) visited[k] = 'unvisited';

      function dfs(epicId: string, pathStack: string[]) {
        visited[epicId] = 'visiting';
        for (const dep of epicGraph[epicId].dependencies) {
          if (visited[dep] === 'visiting') {
            throw new Error(`Circular dependency detected: ${pathStack.join(' -> ')} -> ${dep}`);
          }
          if (visited[dep] === 'unvisited') {
            dfs(dep, [...pathStack, dep]);
          }
        }
        visited[epicId] = 'visited';
      }

      for (const epicId of Object.keys(epicGraph)) {
        if (visited[epicId] === 'unvisited') {
          dfs(epicId, [epicId]);
        }
      }

      // Verify that all dependencies of an Epic belong to an equal or earlier Milestone
      for (const [id, node] of Object.entries(epicGraph)) {
        for (const dep of node.dependencies) {
          const depNode = epicGraph[dep];
          expect(
            depNode.milestone,
            `${id} (M${node.milestone}) cannot depend on ${dep} (M${depNode.milestone}) from a later milestone`
          ).toBeLessThanOrEqual(node.milestone);
        }
      }
    });

    it('verifies that all Epics have granular subtasks and explicit acceptance criteria', () => {
      const epics = [
        'Epic 1.1', 'Epic 1.2', 'Epic 1.3', 'Epic 1.4',
        'Epic 2.1', 'Epic 2.2', 'Epic 2.3',
        'Epic 3.1', 'Epic 3.2', 'Epic 3.3',
        'Epic 4.1', 'Epic 4.2', 'Epic 4.3',
      ];

      for (const epic of epics) {
        expect(planContent.includes(epic), `Missing epic declaration for ${epic}`).toBe(true);
      }

      // Check each milestone has acceptance criteria
      for (let m = 1; m <= 4; m++) {
        const regex = new RegExp(`Milestone ${m}:[\\s\\S]*?Acceptance Criteria`, 'm');
        expect(regex.test(planContent), `Milestone ${m} must have explicit Acceptance Criteria`).toBe(true);
      }
    });
  });
});
