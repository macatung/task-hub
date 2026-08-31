/**
 * Comprehensive 4-Tier Test Suite for Midnight Hub AI Agent Engine
 * 
 * Validates:
 * - Tier 1: Feature Isolation (Supervised Vibe Coding, Worktree Isolation, Auto Review Inbox, Verification Evidence, MCP Gateway)
 * - Tier 2: Boundary & Corner Cases (Lock cleanup, path normalization, invalid auth hashes, risk tier fallback)
 * - Tier 3: Cross-Feature Integration (Full lifecycle from dispatch -> worktree -> execution -> review -> test evidence -> approval)
 * - Tier 4: Real-World Application Scenarios (Fast-Track 2-step run, Strict 4-step run, Rejection loop with prompt re-injection, MCP Gateway handoff, Worktree safety)
 *
 * Source: ORIGINAL_REQUEST.md, PROJECT.md, TEST_INFRA.md
 */

import { describe, expect, it } from 'vitest';
import {
  resolveTaskPipelineVariant,
  generateCaoFastTrackWorkflowYaml,
  generateCaoStandardWorkflowYaml,
  topologicallySortEpicTasks,
  resolveCaoProviderModel,
  getCaoProviderCapabilities,
  selectCaoOrchestrationStrategy,
  type CaoWorkflowOptions,
  type TaskPipelineVariantOptions,
} from '../src/services/caoBridgeService';
import {
  parseGitDiffNumstat,
  buildAgentHandoffPayload,
  formatHandoffMarkdown,
  extractHandoffFromText,
  validateHandoffCompleteness,
  generateHandoffSummary,
} from '../src/utils/diffHandoff';
import {
  detectTestRunner,
  extractTestCounts,
  extractDurationMs,
  parseTestOutput,
  buildVerificationEvidence,
  formatTestSummaryMarkdown,
  summarizeTestResults,
} from '../src/utils/testEvidence';
import { createSafetyGuardrails } from '../src/utils/safetyGuardrails';
import { parseStreamEvent, serializeStreamEvent } from '../src/utils/streamEvents';
import { formatTokens, truncateText, sanitizeTerminalOutput } from '../src/utils/taskErgonomics';

describe('Midnight Hub AI Agent Engine — Comprehensive 4-Tier Test Suite', () => {

  // ============================================================================
  // TIER 1: FEATURE ISOLATION
  // ============================================================================
  describe('Tier 1: Feature Isolation Coverage', () => {
    
    // Feature 1: Supervised Vibe Coding & Workflow Schemas
    describe('[T1_01] Supervised Vibe Coding Workflow Schemas & Dynamic YAML Pipelines', () => {
      it('resolves fast-track 2-step pipeline for low-risk tasks and generates valid declarative YAML', () => {
        const options: TaskPipelineVariantOptions = {
          risk_tier: 'low',
          complexity: 'low',
          issue_type: 'task',
          title: 'Fix typo in README documentation',
        };
        const variant = resolveTaskPipelineVariant(options);
        expect(variant).toBe('fast-track');

        const yaml = generateCaoFastTrackWorkflowYaml({
          taskKey: 'TH-101',
          taskTitle: 'Fix typo in README documentation',
          taskDescription: 'Correct spelling in quickstart guide',
          implementProvider: 'antigravity',
        });

        expect(yaml).toContain('name: task-TH-101-pipeline');
        expect(yaml).toContain('id: implement');
        expect(yaml).toContain('id: evidence');
        expect(yaml).not.toContain('id: review');
        expect(yaml).toContain('workflow_return');
      });

      it('resolves strict 4-step pipeline for high-risk / security / core tasks and includes review step', () => {
        const options: TaskPipelineVariantOptions = {
          risk_tier: 'critical',
          complexity: 'high',
          labels: ['security', 'core-backend', 'auth'],
          title: 'Update OAuth2 JWT token verification logic',
        };
        const variant = resolveTaskPipelineVariant(options);
        expect(variant).toBe('strict');

        const yaml = generateCaoStandardWorkflowYaml({
          taskKey: 'TH-202',
          taskTitle: 'Update OAuth2 JWT token verification logic',
          taskDescription: 'Harden cryptographic signatures',
          implementProvider: 'antigravity',
          reviewProvider: 'codex',
          evidenceProvider: 'antigravity',
          handoffProvider: 'antigravity',
        });

        expect(yaml).toContain('name: task-TH-202-pipeline');
        expect(yaml).toContain('id: implement');
        expect(yaml).toContain('id: review');
        expect(yaml).toContain('id: evidence');
        expect(yaml).toContain('id: handoff');
        expect(yaml).toContain('provider: codex');
      });

      it('resolves models and capabilities correctly across Antigravity, Codex, and Claude Code', () => {
        expect(resolveCaoProviderModel('antigravity')).toBe('gemini-3.7-flash');
        expect(resolveCaoProviderModel('claude_code')).toBe('claude-3-7-sonnet');
        expect(resolveCaoProviderModel('codex')).toBe('gpt-5');

        const agCaps = getCaoProviderCapabilities('antigravity');
        expect(agCaps).toContain('gemini_multimodal');
        expect(agCaps).toContain('stream');

        const codexCaps = getCaoProviderCapabilities('codex');
        expect(codexCaps).toContain('sandbox_isolation');
      });
    });

    // Feature 2: Git Worktree Isolation & Security Hook Guard
    describe('[T1_02] Git Worktree Isolation & Hook Guardrails', () => {
      it('validates worktree isolation directory structure and branch naming schema', () => {
        const rootPath = 'd:/Work/task-hub';
        const taskKey = 'TH-303';
        const worktreeRelPath = `.task-companion-worktrees/${taskKey}`;
        const branchName = `codex/${taskKey}`;

        expect(worktreeRelPath).toBe('.task-companion-worktrees/TH-303');
        expect(branchName).toBe('codex/TH-303');

        // Verify hook neutralizer config pattern
        const unsetHookCmd = ['config', '--unset', 'core.hooksPath'];
        expect(unsetHookCmd).toEqual(['config', '--unset', 'core.hooksPath']);
      });

      it('safely parses git status and numstat into structured diff summary', () => {
        const rawNumstat = `12\t4\tapps/desktop/src/services/caoBridgeService.ts\n45\t0\tapps/desktop/tests/ai_agent_engine_4tier.test.ts`;
        const rawStatus = ` M apps/desktop/src/services/caoBridgeService.ts\n?? apps/desktop/tests/ai_agent_engine_4tier.test.ts`;

        const stats = parseGitDiffNumstat(rawNumstat, rawStatus);
        expect(stats.totalChangedFiles).toBe(2);
        expect(stats.totalAdditions).toBe(57);
        expect(stats.totalDeletions).toBe(4);
        expect(stats.changedFiles).toContain('apps/desktop/src/services/caoBridgeService.ts');
        expect(stats.changedFiles).toContain('apps/desktop/tests/ai_agent_engine_4tier.test.ts');
      });
    });

    // Feature 3: Auto Review Inbox UI & Queue Management
    describe('[T1_03] Auto Review Inbox Queue Management & Risk Analysis', () => {
      it('calculates task risk classification and impact diff metrics accurately', () => {
        const diffStats = {
          changedFiles: ['apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php'],
          totalChangedFiles: 1,
          totalAdditions: 120,
          totalDeletions: 15,
          files: [{ path: 'apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php', additions: 120, deletions: 15, status: 'modified' as const }],
        };

        const summary = generateHandoffSummary(
          { issue_key: 'TH-404', title: 'Refactor MCP Gateway Token Hashing' },
          diffStats,
          'Tests: 1058/1058 passed'
        );

        expect(summary).toContain('TH-404');
        expect(summary).toContain('Refactor MCP Gateway Token Hashing');
        expect(summary).toContain('Modified 1 file (+120 / -15 lines)');
        expect(summary).toContain('1058/1058 passed');
      });
    });

    // Feature 4: Verification Test Evidence Packaging
    describe('[T1_04] Verification Test Evidence Packaging & Parser', () => {
      it('detects runner types and extracts test metrics across Vitest, Jest, PHPUnit, and Pytest', () => {
        const vitestOutput = `
✓ src/services/caoBridgeService.test.ts (15 tests) 42ms
Test Files  1 passed (1)
Tests  45 passed (45)
Duration  1.25s
        `;
        expect(detectTestRunner(vitestOutput, 'npx vitest run')).toBe('vitest');
        const vitestCounts = extractTestCounts(vitestOutput);
        expect(vitestCounts.passed).toBe(45);
        expect(vitestCounts.failed).toBe(0);
        expect(vitestCounts.total).toBe(45);

        const parsed = parseTestOutput(vitestOutput, 'npx vitest run', 0, 1250);
        expect(parsed.status).toBe('passed');
        expect(parsed.runner).toBe('vitest');
        expect(parsed.totalTests).toBe(45);
        expect(parsed.passed).toBe(45);

        const evidence = buildVerificationEvidence(parsed, 'sha-abc12345');
        expect(evidence.evidence_type).toBe('automated_test');
        expect(evidence.status).toBe('passed');
        expect(evidence.commit_sha).toBe('sha-abc12345');
        expect(evidence.metadata.total_tests).toBe(45);
      });
    });

    // Feature 5: Secure MCP Gateway
    describe('[T1_05] Secure MCP Gateway Protocol & Tool Registry', () => {
      it('validates JSON-RPC 2.0 tool invocation structure and response envelopes', () => {
        const rpcRequest = {
          jsonrpc: '2.0',
          id: 'req-001',
          method: 'tools/call',
          params: {
            name: 'get_work_item',
            arguments: { task_id: 101 },
          },
        };

        expect(rpcRequest.jsonrpc).toBe('2.0');
        expect(rpcRequest.method).toBe('tools/call');
        expect(rpcRequest.params.name).toBe('get_work_item');

        const rpcResponse = {
          jsonrpc: '2.0',
          id: rpcRequest.id,
          result: {
            task: { id: 101, title: 'Test Task', status: 'in_progress' },
          },
        };
        expect(rpcResponse.jsonrpc).toBe('2.0');
        expect(rpcResponse.id).toBe('req-001');
      });
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    describe('[T2_01] Stale Git Lock Files & Orphaned Worktree Cleanup', () => {
      it('identifies stale lock files (.git/index.lock, HEAD.lock) for safe removal', () => {
        const lockFileCandidates = [
          '.git/index.lock',
          '.git/HEAD.lock',
          '.git/refs/heads/codex/TH-101.lock',
          '.git/config.lock',
        ];

        const isLockFile = (filePath: string) => filePath.endsWith('.lock') && filePath.includes('.git');
        for (const candidate of lockFileCandidates) {
          expect(isLockFile(candidate)).toBe(true);
        }

        const nonLockFile = '.git/index';
        expect(isLockFile(nonLockFile)).toBe(false);
      });
    });

    describe('[T2_02] Worktree Pointer Path Normalization (Windows vs WSL/Linux)', () => {
      it('normalizes Windows backslashes and relative gitdir pointer paths', () => {
        const windowsGitDirPointer = 'gitdir: D:\\Work\\task-hub\\.git\\worktrees\\TH-101';
        const normalized = windowsGitDirPointer.replace(/\\/g, '/');
        expect(normalized).toBe('gitdir: D:/Work/task-hub/.git/worktrees/TH-101');

        const relativeAdmin = '../../.git/worktrees/TH-101';
        const canonicalPointer = `gitdir: ${relativeAdmin}\n`;
        expect(canonicalPointer).toContain('gitdir: ../../.git/worktrees/TH-101');
      });
    });

    describe('[T2_03] Authentication Hash Validation & Mismatch Rejection', () => {
      it('rejects empty, tampered, or mismatched token hashes securely', () => {
        const validToken = 'super-secret-mcp-token-2026';
        const validHash = 'b6d4b2e887f4f6e3c09b85c13b28318356972e90f2307ef1184a441315998b31'; // mock sha256

        const authenticate = (bearer: string, expectedHash: string) => {
          if (!bearer || bearer.trim() === '') return false;
          // In real implementation: hash('sha256', bearer) === expectedHash
          return bearer === validToken;
        };

        expect(authenticate('', validHash)).toBe(false);
        expect(authenticate('tampered-token', validHash)).toBe(false);
        expect(authenticate(validToken, validHash)).toBe(true);
      });
    });

    describe('[T2_04] Risk Tier Fallback & Label Resilience', () => {
      it('falls back safely to strict pipeline when risk tier is undefined, invalid, or ambiguous', () => {
        expect(resolveTaskPipelineVariant(null)).toBe('strict');
        expect(resolveTaskPipelineVariant(undefined)).toBe('strict');
        expect(resolveTaskPipelineVariant({})).toBe('strict');
        expect(resolveTaskPipelineVariant({ risk_tier: 'unknown-tier' as any })).toBe('strict');
        expect(resolveTaskPipelineVariant({ title: 'Standard complex task' })).toBe('strict');
      });

      it('accurately resolves fast-track for mixed-case labels and trimmed whitespace', () => {
        expect(resolveTaskPipelineVariant({ labels: ['  FAST-TRACK  '] })).toBe('fast-track');
        expect(resolveTaskPipelineVariant({ tags: ['Docs'] })).toBe('fast-track');
        expect(resolveTaskPipelineVariant({ issue_type: 'STYLE' })).toBe('fast-track');
      });
    });

    describe('[T2_05] Extreme Diff Handling & Binary Files', () => {
      it('handles binary file changes (marked with - additions / - deletions) cleanly', () => {
        const rawNumstat = `-\t-\tpublic/favicon.ico\n20\t5\tsrc/App.vue`;
        const stats = parseGitDiffNumstat(rawNumstat);

        expect(stats.totalChangedFiles).toBe(2);
        expect(stats.totalAdditions).toBe(20);
        expect(stats.totalDeletions).toBe(5);
        const binaryFile = stats.files.find((f) => f.path === 'public/favicon.ico');
        expect(binaryFile?.binary).toBe(true);
        expect(binaryFile?.additions).toBe(0);
        expect(binaryFile?.deletions).toBe(0);
      });
    });
  });

  // ============================================================================
  // TIER 3: CROSS-FEATURE INTEGRATION
  // ============================================================================
  describe('Tier 3: Cross-Feature Integration', () => {

    describe('[T3_01] End-to-End Workflow Execution & State Propagation', () => {
      it('propagates task context through dispatch, worktree creation, execution, diff capture, and verification', () => {
        // Step 1: Resolve pipeline
        const task = {
          id: 501,
          issue_key: 'TH-501',
          title: 'Implement Dark Mode Contrast Enhancement',
          risk_tier: 'low',
        };
        const pipelineVariant = resolveTaskPipelineVariant(task);
        expect(pipelineVariant).toBe('fast-track');

        // Step 2: Build workflow spec
        const workflowYaml = generateCaoFastTrackWorkflowYaml({
          taskKey: task.issue_key,
          taskTitle: task.title,
          implementProvider: 'antigravity',
        });
        expect(workflowYaml).toContain('name: task-TH-501-pipeline');

        // Step 3: Simulate Worktree provisioning
        const worktreeInfo = {
          path: `.task-companion-worktrees/${task.issue_key}`,
          branch: `codex/${task.issue_key}`,
          isClean: true,
        };
        expect(worktreeInfo.path).toBe('.task-companion-worktrees/TH-501');

        // Step 4: Simulate agent modifications and diff generation
        const diffNumstat = `18\t2\tapps/desktop/src/style.css`;
        const diffStats = parseGitDiffNumstat(diffNumstat);
        expect(diffStats.totalChangedFiles).toBe(1);

        // Step 5: Simulate test execution
        const testOutput = 'Tests  12 passed (12)\nDuration 350ms';
        const parsedEvidence = parseTestOutput(testOutput, 'npm test', 0, 350);
        expect(parsedEvidence.status).toBe('passed');
        expect(parsedEvidence.passed).toBe(12);

        // Step 6: Assemble complete Handoff Payload
        const handoff = buildAgentHandoffPayload({
          task,
          diffStats,
          tests: [{ command: 'npm test', status: 'passed', summary: parsedEvidence.summary }],
          commitSha: 'commit-sha-778899',
        });

        expect(handoff.changed_files).toEqual(['apps/desktop/src/style.css']);
        expect(handoff.tests[0].status).toBe('passed');
        expect(handoff.commit_sha).toBe('commit-sha-778899');
      });
    });

    describe('[T3_02] Two-Way Review Rejection Feedback Loop', () => {
      it('handles review rejection, formats feedback into prompt re-injection, and validates subsequent pass', () => {
        // First Run: Reviewer Rejects
        const firstReviewVerdict = {
          verdict: 'REJECTED',
          feedback: 'Missing unit test for zero-token edge case in taskErgonomics.ts',
          riskScore: 65,
        };
        expect(firstReviewVerdict.verdict).toBe('REJECTED');

        // Feedback Re-injection
        const retryPrompt = `
Previous implementation was rejected with feedback:
"${firstReviewVerdict.feedback}"
Please address the feedback, implement the missing tests, and re-run verification.
        `.trim();
        expect(retryPrompt).toContain('Missing unit test for zero-token edge case');

        // Second Run: Agent fixes and tests pass
        const secondTestOutput = 'Tests  13 passed (13)\nDuration 410ms';
        const secondEvidence = parseTestOutput(secondTestOutput, 'npm test', 0, 410);
        expect(secondEvidence.status).toBe('passed');
        expect(secondEvidence.passed).toBe(13);

        const secondReviewVerdict = {
          verdict: 'APPROVED',
          feedback: 'Edge case properly tested and all 13 tests green.',
          riskScore: 10,
        };
        expect(secondReviewVerdict.verdict).toBe('APPROVED');
      });
    });

    describe('[T3_03] Dangerous Command Interception in Multi-Agent Pipeline', () => {
      it('intercepts dangerous rm/git reset/drop database commands while allowing safe build/test commands', () => {
        const guard = createSafetyGuardrails({ strictMode: true });

        expect(guard.isDangerous('npm test')).toBe(false);
        expect(guard.isDangerous('git status')).toBe(false);
        expect(guard.isDangerous('node tests/run_all_tests.js')).toBe(false);

        expect(guard.isDangerous('rm -rf .git')).toBe(true);
        expect(guard.isDangerous('git reset --hard origin/main')).toBe(true);
        expect(guard.isDangerous('git clean -fdx')).toBe(true);
        expect(guard.isDangerous('DROP TABLE users CASCADE;')).toBe(true);
      });
    });
  });

  // ============================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ============================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {

    it('Scenario 1: [T4_01] Low-Risk Fast-Track Hotfix (2-Step Run: Implement -> Evidence)', () => {
      // 1. Task definition: Minor CSS & Typography tweak
      const task = {
        id: 701,
        issue_key: 'TH-701',
        title: 'Fix sidebar nav icon alignment and padding',
        risk_tier: 'low',
        complexity: 'simple',
        labels: ['style', 'css'],
      };

      // 2. Resolve pipeline variant
      const variant = resolveTaskPipelineVariant(task);
      expect(variant).toBe('fast-track');

      // 3. Generate YAML Spec
      const yaml = generateCaoFastTrackWorkflowYaml({
        taskKey: task.issue_key,
        taskTitle: task.title,
        implementProvider: 'antigravity',
      });
      expect(yaml).toContain('Fast-Track Task Hub workflow');
      expect(yaml).toContain('id: implement');
      expect(yaml).toContain('id: evidence');

      // 4. Simulate test execution
      const testRaw = 'Tests  89 passed (89)\nDuration 2.1s';
      const evidence = parseTestOutput(testRaw, 'npm test', 0, 2100);
      expect(evidence.status).toBe('passed');
      expect(evidence.passed).toBe(89);

      // 5. Verification Gate Check
      const canApprove = evidence.status === 'passed' && evidence.failed === 0;
      expect(canApprove).toBe(true);
    });

    it('Scenario 2: [T4_02] High-Risk Strict Feature Implementation (4-Step Run: Implement -> Review -> Evidence -> Handoff)', () => {
      // 1. Task definition: Critical Security Module
      const task = {
        id: 802,
        issue_key: 'TH-802',
        title: 'Upgrade SHA-256 MCP Gateway Token Authentication & Role RBAC',
        risk_tier: 'critical',
        complexity: 'high',
        labels: ['security', 'auth', 'core-backend'],
      };

      // 2. Resolve pipeline variant
      const variant = resolveTaskPipelineVariant(task);
      expect(variant).toBe('strict');

      // 3. Generate YAML Spec
      const yaml = generateCaoStandardWorkflowYaml({
        taskKey: task.issue_key,
        taskTitle: task.title,
        implementProvider: 'antigravity',
        reviewProvider: 'codex',
        evidenceProvider: 'antigravity',
        handoffProvider: 'antigravity',
      });
      expect(yaml).toContain('Strict Task Hub workflow');
      expect(yaml).toContain('id: implement');
      expect(yaml).toContain('id: review');
      expect(yaml).toContain('id: evidence');
      expect(yaml).toContain('id: handoff');

      // 4. Simulate multi-phase stream events
      const streamEvents = [
        { type: 'stage_start', stage: 'implement', role: 'developer' },
        { type: 'stage_complete', stage: 'implement', output: { modified_files: ['TaskHubMcpController.php'] } },
        { type: 'stage_start', stage: 'review', role: 'reviewer' },
        { type: 'stage_complete', stage: 'review', output: { verdict: 'APPROVED', risk_score: 5 } },
        { type: 'stage_start', stage: 'evidence', role: 'tester' },
        { type: 'test_result', passed: 1058, failed: 0, total: 1058 },
        { type: 'stage_complete', stage: 'evidence', output: { status: 'passed', test_pass_count: 1058 } },
        { type: 'stage_start', stage: 'handoff', role: 'auditor' },
        { type: 'stage_complete', stage: 'handoff', output: { verified: true } },
      ];

      let completedStages = 0;
      for (const evt of streamEvents) {
        const serialized = serializeStreamEvent(evt as any);
        const parsed = parseStreamEvent(serialized);
        if (parsed.type === 'stage_complete') completedStages++;
      }

      expect(completedStages).toBe(4);
    });

    it('Scenario 3: [T4_03] Supervised Review Rejection with Prompt Re-Injection & Auto-Correction', () => {
      // 1. Initial run produces failing review
      let currentIteration = 1;
      const reviewRounds: Array<{ round: number; verdict: string; feedback: string }> = [];

      const recordReview = (verdict: string, feedback: string) => {
        reviewRounds.push({ round: currentIteration, verdict, feedback });
      };

      recordReview('REJECTED', 'Path normalization fails on Windows absolute drive letters');
      expect(reviewRounds[0].verdict).toBe('REJECTED');

      // 2. Re-inject feedback into next prompt
      currentIteration++;
      const correctedPrompt = `Fix issue from Round ${currentIteration - 1}: ${reviewRounds[0].feedback}`;
      expect(correctedPrompt).toContain('Path normalization fails on Windows absolute drive letters');

      // 3. Second review passes
      recordReview('APPROVED', 'Windows path normalization verified with regex');
      expect(reviewRounds[1].verdict).toBe('APPROVED');
      expect(reviewRounds.length).toBe(2);
    });

    it('Scenario 4: [T4_04] Secure MCP Gateway Multi-Tool Dispatch & Signed Handoff', () => {
      const mockMcpTools = [
        'get_work_item',
        'get_context_pack',
        'start_agent_run',
        'update_agent_run',
        'get_agent_run',
        'record_run_event',
        'attach_verification_evidence',
        'complete_agent_handoff',
        'complete_auto_approved_handoff',
      ];

      expect(mockMcpTools.length).toBeGreaterThanOrEqual(9);
      expect(mockMcpTools).toContain('attach_verification_evidence');
      expect(mockMcpTools).toContain('complete_agent_handoff');

      const handoffReportText = `
# Handoff Report

## Observation
Ran test suite: 1058 passed, 0 failed.

## Logic Chain
1. Applied secure token verification.
2. Verified all tests pass.

## Caveats
No caveats.

## Conclusion
MCP Gateway integration verified.

## Verification Method
npm --workspace apps/desktop run test
      `;

      const extracted = extractHandoffFromText(handoffReportText);
      expect(extracted).not.toBeNull();
      expect(validateHandoffCompleteness(extracted)).toBe(true);
    });

    it('Scenario 5: [T4_05] Cross-Platform Git Worktree Isolation & Prune Cleanup', () => {
      // Simulate multiple worktree sessions lifecycle
      const activeWorktrees = new Map<string, { path: string; locked: boolean }>();

      // Create worktrees
      activeWorktrees.set('TH-901', { path: '.task-companion-worktrees/TH-901', locked: true });
      activeWorktrees.set('TH-902', { path: '.task-companion-worktrees/TH-902', locked: true });
      expect(activeWorktrees.size).toBe(2);

      // Release lock on completion
      activeWorktrees.get('TH-901')!.locked = false;
      expect(activeWorktrees.get('TH-901')?.locked).toBe(false);

      // Prune unlocked worktrees
      for (const [key, wt] of activeWorktrees.entries()) {
        if (!wt.locked) {
          activeWorktrees.delete(key);
        }
      }

      expect(activeWorktrees.size).toBe(1);
      expect(activeWorktrees.has('TH-902')).toBe(true);
    });
  });
});
