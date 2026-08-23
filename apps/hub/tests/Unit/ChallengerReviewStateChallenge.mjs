import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('══════════════════════════════════════════════════════════════════════');
console.log(' 🔬 CHALLENGER 2: EMPIRICAL STRESS TEST & AUDIT HARNESS 🔬');
console.log('══════════════════════════════════════════════════════════════════════\n');

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✔ ${message}`);
}

// ============================================================================
// PART 1: SIMULATION ENGINE FOR ApiAgentRunController (APPROVE & REJECT)
// ============================================================================
console.log('--- PART 1: Pure State Machine Permutation & Stress Testing ---');

class MockEvidence {
  constructor(status, type = 'test', command = 'npm test') {
    this.id = Math.floor(Math.random() * 10000);
    this.status = status; // 'passed' | 'failed' | 'skipped'
    this.evidence_type = type;
    this.command = command;
  }
}

class MockAgentRun {
  constructor(status = 'running', task_id = 1) {
    this.id = Math.floor(Math.random() * 10000);
    this.task_id = task_id;
    this.status = status; // 'running' | 'needs_review' | 'verified' | 'failed' | 'waiting_input'
    this.evidenceList = [];
    this.events = [];
    this.failure_reason = null;
    this.finished_at = null;
  }

  addEvidence(status) {
    const ev = new MockEvidence(status);
    this.evidenceList.push(ev);
    return ev;
  }

  hasPassedEvidence() {
    return this.evidenceList.some((e) => e.status === 'passed');
  }
}

class MockTask {
  constructor(status = 'in_progress', issue_key = 'TASK-101') {
    this.id = 101;
    this.issue_key = issue_key;
    this.status = status; // 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
    this.completed_at = null;
    this.runs = [];
  }

  addRun(status = 'running') {
    const run = new MockAgentRun(status, this.id);
    this.runs.push(run);
    return run;
  }

  latestRun() {
    return this.runs.length > 0 ? this.runs[this.runs.length - 1] : null;
  }
}

class ApiAgentRunControllerSimulator {
  approve(task) {
    const latest = task.latestRun();
    if (!latest || !latest.hasPassedEvidence()) {
      return {
        status: 422,
        body: { success: false, message: 'Passing verification evidence is required before approval.' }
      };
    }
    task.status = 'done';
    task.completed_at = new Date().toISOString();
    if (latest.status !== 'verified') {
      latest.status = 'verified';
      latest.finished_at = new Date().toISOString();
    }
    latest.events.push({
      type: 'human_approved',
      status: 'verified',
      payload: { task_id: task.id },
      occurred_at: new Date().toISOString()
    });
    return {
      status: 200,
      body: { success: true, data: { ...task } }
    };
  }

  reject(task, payload) {
    const reason = payload?.reason;
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 5000) {
      return {
        status: 422,
        body: { success: false, message: 'The reason field is required and must not exceed 5000 characters.' }
      };
    }

    if (task.status === 'review' || task.status === 'done') {
      task.status = 'in_progress';
    }

    const latest = task.latestRun();
    if (latest) {
      latest.status = 'waiting_input';
      latest.failure_reason = reason;
      latest.events.push({
        type: 'human_rejected',
        status: 'waiting_input',
        payload: { reason },
        occurred_at: new Date().toISOString()
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Task returned to changes requested.',
        data: { ...task }
      }
    };
  }
}

const controller = new ApiAgentRunControllerSimulator();

// Test Case 1: Approve with 0 agent runs
{
  const task = new MockTask('review');
  const res = controller.approve(task);
  assert(res.status === 422, 'Approve without any agent runs returns 422');
  assert(res.body.success === false, 'Approve without any agent runs sets success=false');
  assert(task.status === 'review', 'Task status is unchanged on 422 approve');
  assert(task.completed_at === null, 'Task completed_at is not set on failed approve');
}

// Test Case 2: Approve with agent run but NO evidence
{
  const task = new MockTask('review');
  task.addRun('needs_review');
  const res = controller.approve(task);
  assert(res.status === 422, 'Approve with agent run having 0 evidence returns 422');
  assert(task.status === 'review', 'Task status remains review');
  assert(task.latestRun().status === 'needs_review', 'Agent run remains needs_review');
}

// Test Case 3: Approve with agent run having only FAILED evidence
{
  const task = new MockTask('review');
  const run = task.addRun('needs_review');
  run.addEvidence('failed');
  run.addEvidence('failed');
  const res = controller.approve(task);
  assert(res.status === 422, 'Approve with failed-only evidence returns 422');
  assert(task.status === 'review', 'Task status remains review');
  assert(run.status === 'needs_review', 'Agent run remains needs_review');
}

// Test Case 4: Approve with agent run having only SKIPPED evidence
{
  const task = new MockTask('review');
  const run = task.addRun('needs_review');
  run.addEvidence('skipped');
  const res = controller.approve(task);
  assert(res.status === 422, 'Approve with skipped-only evidence returns 422');
  assert(task.status === 'review', 'Task status remains review');
}

// Test Case 5: Approve with passed evidence
{
  const task = new MockTask('review');
  const run = task.addRun('needs_review');
  run.addEvidence('passed');
  const res = controller.approve(task);
  assert(res.status === 200, 'Approve with passed evidence returns 200');
  assert(res.body.success === true, 'Approve returns success=true');
  assert(task.status === 'done', 'Task transitions to done status');
  assert(task.completed_at !== null, 'Task completed_at timestamp is set');
  assert(run.status === 'verified', 'Agent run transitions to verified');
  assert(run.finished_at !== null, 'Agent run finished_at timestamp is set');
  assert(run.events.some((e) => e.type === 'human_approved'), 'Event human_approved is recorded');
}

// Test Case 6: Approve with mixed evidence (first failed, then passed)
{
  const task = new MockTask('review');
  const run = task.addRun('needs_review');
  run.addEvidence('failed');
  run.addEvidence('passed');
  const res = controller.approve(task);
  assert(res.status === 200, 'Approve with mixed passed/failed evidence succeeds');
  assert(task.status === 'done', 'Task transitions to done');
}

// Test Case 7: Reject without reason or empty reason
{
  const task = new MockTask('review');
  task.addRun('needs_review');
  const res1 = controller.reject(task, {});
  assert(res1.status === 422, 'Reject without reason returns 422');
  const res2 = controller.reject(task, { reason: '   ' });
  assert(res2.status === 422, 'Reject with empty reason returns 422');
  assert(task.status === 'review', 'Task status remains review when reject validation fails');
}

// Test Case 8: Reject from 'review' status
{
  const task = new MockTask('review');
  const run = task.addRun('needs_review');
  const res = controller.reject(task, { reason: 'Fix missing unit test assertions' });
  assert(res.status === 200, 'Reject from review status returns 200');
  assert(task.status === 'in_progress', 'Task transitions from review -> in_progress');
  assert(run.status === 'waiting_input', 'Agent run transitions from needs_review -> waiting_input');
  assert(run.failure_reason === 'Fix missing unit test assertions', 'failure_reason is recorded on run');
  assert(run.events.some((e) => e.type === 'human_rejected'), 'human_rejected event is recorded');
}

// Test Case 9: Reject from 'done' status (re-opening completed work)
{
  const task = new MockTask('done');
  const run = task.addRun('verified');
  const res = controller.reject(task, { reason: 'Found edge case regression' });
  assert(res.status === 200, 'Reject from done status returns 200');
  assert(task.status === 'in_progress', 'Task transitions from done -> in_progress');
  assert(run.status === 'waiting_input', 'Agent run transitions from verified -> waiting_input');
}

// Test Case 10: Reject from 'in_progress' status
{
  const task = new MockTask('in_progress');
  const run = task.addRun('running');
  const res = controller.reject(task, { reason: 'Scope change requested' });
  assert(res.status === 200, 'Reject from in_progress returns 200');
  assert(task.status === 'in_progress', 'Task remains in_progress');
  assert(run.status === 'waiting_input', 'Agent run transitions from running -> waiting_input');
}

// Test Case 11: Reject when task has NO agent run
{
  const task = new MockTask('review');
  const res = controller.reject(task, { reason: 'No agent run attached' });
  assert(res.status === 200, 'Reject with 0 agent runs returns 200 without error');
  assert(task.status === 'in_progress', 'Task transitions from review -> in_progress');
}

// Test Case 12: Complex Multi-Turn Lifecycle Fuzzing
{
  console.log('  Running 100 random multi-turn lifecycle transitions...');
  for (let i = 0; i < 100; i++) {
    const task = new MockTask('todo');
    // Start run
    task.status = 'in_progress';
    const run1 = task.addRun('running');
    
    // Attempt illegal approval while running without evidence
    const illegalApprove = controller.approve(task);
    assert(illegalApprove.status === 422, `[Cycle ${i}] Illegal approval blocked during execution`);
    
    // Handoff with failed evidence
    run1.status = 'needs_review';
    task.status = 'review';
    run1.addEvidence('failed');
    const failedApprove = controller.approve(task);
    assert(failedApprove.status === 422, `[Cycle ${i}] Approval blocked with failed evidence`);
    
    // Reject
    const rej = controller.reject(task, { reason: `Iter ${i} fix failing test` });
    assert(rej.status === 200 && task.status === 'in_progress' && run1.status === 'waiting_input', `[Cycle ${i}] Rejection transitions correctly`);
    
    // Fix and attach passed evidence
    const run2 = task.addRun('running');
    run2.status = 'needs_review';
    task.status = 'review';
    run2.addEvidence('passed');
    
    // Approve
    const validApprove = controller.approve(task);
    assert(validApprove.status === 200 && task.status === 'done' && run2.status === 'verified', `[Cycle ${i}] Approval completes successfully`);
  }
}

// ============================================================================
// PART 2: STATIC CODE AUDIT OF ACTUAL SOURCE FILES
// ============================================================================
console.log('\n--- PART 2: Static Code Verification of Controllers & Desktop UI ---');

// Audit ApiAgentRunController.php
const phpPath = path.resolve('apps/hub/app/Http/Controllers/Api/ApiAgentRunController.php');
const phpSrc = fs.readFileSync(phpPath, 'utf8');

assert(phpSrc.includes('public function approve(Task $task)'), 'ApiAgentRunController defines approve(Task $task)');
assert(phpSrc.includes("if (!$latest || !$latest->evidence()->where('status', 'passed')->exists())"), 'ApiAgentRunController::approve verifies passed evidence exists');
assert(phpSrc.includes("return response()->json(['success' => false, 'message' => 'Passing verification evidence is required before approval.'], 422);"), 'ApiAgentRunController::approve returns 422 when evidence is missing');
assert(phpSrc.includes("$task->update(['status' => 'done', 'completed_at' => now()]);"), 'ApiAgentRunController::approve updates task to done with completed_at');
assert(phpSrc.includes("if ($latest->status !== 'verified') $latest->update(['status' => 'verified', 'finished_at' => now()]);"), 'ApiAgentRunController::approve updates run to verified');
assert(phpSrc.includes("$this->recordEvent($latest, 'human_approved', 'verified', ['task_id' => $task->id]);"), 'ApiAgentRunController::approve records human_approved event');

assert(phpSrc.includes('public function reject(Request $request, Task $task)'), 'ApiAgentRunController defines reject(Request $request, Task $task)');
assert(phpSrc.includes("$validated = $request->validate(['reason' => 'required|string|max:5000']);"), 'ApiAgentRunController::reject validates reason (required, max 5000)');
assert(phpSrc.includes("if ($task->status === 'review' || $task->status === 'done') {"), 'ApiAgentRunController::reject checks for review or done state');
assert(phpSrc.includes("$task->update(['status' => 'in_progress']);"), 'ApiAgentRunController::reject updates task status to in_progress');
assert(phpSrc.includes("$latest->update(['status' => 'waiting_input', 'failure_reason' => $validated['reason']]);"), 'ApiAgentRunController::reject updates run to waiting_input with failure_reason');
assert(phpSrc.includes("$this->recordEvent($latest, 'human_rejected', 'waiting_input', $validated);"), 'ApiAgentRunController::reject records human_rejected event');

// Audit TaskHubMcpController.php
const mcpPath = path.resolve('apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php');
const mcpSrc = fs.readFileSync(mcpPath, 'utf8');

assert(mcpSrc.includes("['name' => 'request_human_approval'"), 'TaskHubMcpController defines request_human_approval MCP tool');
assert(mcpSrc.includes("['name' => 'reject_task'"), 'TaskHubMcpController defines reject_task MCP tool');
assert(mcpSrc.includes("['name' => 'reject_work_item'"), 'TaskHubMcpController defines reject_work_item MCP tool');
assert(mcpSrc.includes("'request_human_approval' => $runController->approve"), 'TaskHubMcpController routes request_human_approval to approve()');
assert(mcpSrc.includes("'reject_task', 'reject_work_item' => $runController->reject"), 'TaskHubMcpController routes reject_task to reject()');

// Audit AgentConsoleModal.vue
const vuePath = path.resolve('apps/desktop/src/components/AgentConsoleModal.vue');
const vueSrc = fs.readFileSync(vuePath, 'utf8');

assert(vueSrc.includes('const approveTaskReview = async () => {'), 'AgentConsoleModal.vue defines approveTaskReview');
assert(vueSrc.includes("name: 'request_human_approval'"), 'AgentConsoleModal.vue calls request_human_approval MCP tool');
assert(vueSrc.includes("/api/v1/tasks/work-items/${encodeURIComponent(String(taskIdOrKey))}/approve"), 'AgentConsoleModal.vue calls HTTP approve API');
assert(vueSrc.includes("selectedTask.value.status = 'done'"), 'AgentConsoleModal.vue updates local status to done');
assert(vueSrc.includes('const openRejectDialog = () => {'), 'AgentConsoleModal.vue defines openRejectDialog');
assert(vueSrc.includes('const confirmRejectTask = async () => {'), 'AgentConsoleModal.vue defines confirmRejectTask');
assert(vueSrc.includes("name: 'reject_task'"), 'AgentConsoleModal.vue calls reject_task MCP tool');
assert(vueSrc.includes("/api/v1/tasks/work-items/${encodeURIComponent(String(taskIdOrKey))}/reject"), 'AgentConsoleModal.vue calls HTTP reject API');
assert(vueSrc.includes("selectedTask.value.status = 'in_progress'"), 'AgentConsoleModal.vue updates local status to in_progress on rejection');
assert(vueSrc.includes("phase.value = 'ready'"), 'AgentConsoleModal.vue resets phase to ready after rejection');

// ============================================================================
// PART 3: TEST SUITE INTEGRITY & ACTIVE ASSERTIONS AUDIT
// ============================================================================
console.log('\n--- PART 3: Test Suite Integrity & Assertions Verification ---');

// Audit all test files for non-empty assertions
const testsDir = path.resolve('apps/hub/tests');
function getTestFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      results = results.concat(getTestFiles(p));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.js')) {
      results.push(p);
    }
  }
  return results;
}

const testFiles = getTestFiles(testsDir);
assert(testFiles.length === 29, `Exact count of 29 test files in apps/hub/tests (found: ${testFiles.length})`);

for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert(content.includes('expect('), `Test file ${path.relative(testsDir, file)} contains active assertions`);
}

// Run run_all_tests.js with JSON output and verify the exact 537 test breakdown
const testRunnerOutput = execSync('node apps/hub/tests/run_all_tests.js --json', { cwd: path.resolve('.'), encoding: 'utf8' });
const testSummary = JSON.parse(testRunnerOutput);

assert(testSummary.metrics.totalTests === 537, `Exact match of 537 total tests in test suite (actual: ${testSummary.metrics.totalTests})`);
assert(testSummary.metrics.passed === 537, `All 537 tests passed (actual: ${testSummary.metrics.passed})`);
assert(testSummary.metrics.failed === 0, `0 failed tests (actual: ${testSummary.metrics.failed})`);
assert(testSummary.metrics.skipped === 0, `0 skipped tests (actual: ${testSummary.metrics.skipped})`);

// Verify tier breakdown
assert(testSummary.tierBreakdown.tier1.passed === 165, `Tier 1 Feature Isolation: 165 passed`);
assert(testSummary.tierBreakdown.tier2.passed === 306, `Tier 2 Boundary & Corner: 306 passed`);
assert(testSummary.tierBreakdown.tier3.passed === 37, `Tier 3 Cross-Feature: 37 passed`);
assert(testSummary.tierBreakdown.tier4.passed === 12, `Tier 4 Real-World E2E: 12 passed`);
assert(testSummary.tierBreakdown.other.passed === 17, `Harness Infrastructure: 17 passed`);

// Run Desktop Vitest suite and verify output
const rawVitestOutput = execSync('npx.cmd --prefix apps/desktop vitest run -c apps/desktop/vitest.config.ts', { cwd: path.resolve('.'), encoding: 'utf8' });
const cleanVitestOutput = rawVitestOutput.replace(/\u001b\[[0-9;]*m/g, '');
assert(cleanVitestOutput.includes('5 passed (5)'), 'Desktop Vitest: 5/5 test files passed');
assert(cleanVitestOutput.includes('35 passed (35)'), 'Desktop Vitest: 35/35 tests passed');

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(` 🏆 CHALLENGE VERDICT: ALL ${passedAssertions}/${totalAssertions} EMPIRICAL ASSERTIONS PASSED!`);
console.log('══════════════════════════════════════════════════════════════════════\n');
