/**
 * Automated Test Evidence Generator
 * 
 * Executes test suites and parses test runner outputs (Vitest, Jest, PHPUnit, pytest, etc.)
 * to produce structured VerificationEvidence payloads compliant with Task Hub contracts.
 */

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'error';
export type TestRunnerType = 'vitest' | 'jest' | 'phpunit' | 'pytest' | 'cargo' | 'generic';

export interface TestEvidencePayload {
  status: 'passed' | 'failed';
  command: string;
  summary: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  rawOutput: string;
  runner: TestRunnerType;
  timestamp: string;
  exitCode?: number;
  coverage?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
}

export interface VerificationEvidence {
  evidence_type: 'automated_test';
  status: 'passed' | 'failed';
  command: string;
  summary: string;
  commit_sha?: string;
  metadata: {
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
    runner: string;
    timestamp: string;
    exit_code?: number;
  };
}

/**
 * Detect the runner type from output strings and command names.
 */
export function detectTestRunner(output = '', command = ''): TestRunnerType {
  const normCmd = (command || '').toLowerCase();
  const normOut = (output || '').toLowerCase();
  const combined = `${normCmd} ${normOut}`;

  if (combined.includes('vitest') || normOut.includes('test files  ')) {
    return 'vitest';
  }
  if (combined.includes('jest') || normOut.includes('test suites:')) {
    return 'jest';
  }
  if (
    combined.includes('phpunit') ||
    combined.includes('artisan test') ||
    combined.includes('run_all_tests') ||
    normOut.includes('tests/run_all_tests.js') ||
    normOut.includes('unified e2e test suite') ||
    normOut.includes('all tests passed')
  ) {
    return 'phpunit';
  }
  if (
    combined.includes('pytest') ||
    (normOut.includes('collected ') && normOut.includes('items')) ||
    /={3,}.*passed.*in.*={3,}/i.test(normOut) ||
    /={3,}\s*\d+\s*passed/i.test(normOut)
  ) {
    return 'pytest';
  }
  if (
    combined.includes('cargo test') ||
    (normOut.includes('running ') && normOut.includes('test result:')) ||
    normOut.includes('test result: ok') ||
    normOut.includes('test result: failed')
  ) {
    return 'cargo';
  }
  return 'generic';
}

/**
 * Extract test counts (total, passed, failed, skipped) from runner output.
 */
export function extractTestCounts(output: string): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  if (!output) {
    return { total: 0, passed: 0, failed: 0, skipped: 0 };
  }

  // 1. Vitest pattern: "Tests  35 passed (35)" or "Tests  3 failed | 32 passed (35)"
  const vitestMatch = output.match(/Tests\s+(?:(\d+)\s+failed\s*\|?\s*)?(?:(\d+)\s+skipped\s*\|?\s*)?(\d+)\s+passed\s*\(?(\d+)?\)?/i);
  if (vitestMatch) {
    const failed = parseInt(vitestMatch[1] || '0', 10);
    const skipped = parseInt(vitestMatch[2] || '0', 10);
    const passed = parseInt(vitestMatch[3] || '0', 10);
    const total = parseInt(vitestMatch[4] || String(passed + failed + skipped), 10);
    return { total, passed, failed, skipped };
  }

  // 2. Ma Ca Tung Unified Runner pattern: "Total: 537 passed, 0 failed, 0 skipped, 537 total"
  const mctMatch = output.match(/Total:\s*(\d+)\s*passed,\s*(\d+)\s*failed(?:,\s*(\d+)\s*skipped)?(?:,\s*(\d+)\s*total)?/i);
  if (mctMatch) {
    const passed = parseInt(mctMatch[1] || '0', 10);
    const failed = parseInt(mctMatch[2] || '0', 10);
    const skipped = parseInt(mctMatch[3] || '0', 10);
    const total = parseInt(mctMatch[4] || String(passed + failed + skipped), 10);
    return { total, passed, failed, skipped };
  }

  // 3. Jest pattern: "Tests:       1 failed, 2 skipped, 12 passed, 15 total"
  const jestMatch = output.match(/Tests:\s*(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(\d+)\s+passed,\s+(\d+)\s+total/i);
  if (jestMatch) {
    const failed = parseInt(jestMatch[1] || '0', 10);
    const skipped = parseInt(jestMatch[2] || '0', 10);
    const passed = parseInt(jestMatch[3] || '0', 10);
    const total = parseInt(jestMatch[4] || String(passed + failed + skipped), 10);
    return { total, passed, failed, skipped };
  }

  // 4. Pytest pattern: "=== 35 passed, 2 skipped, 1 failed in 2.34s ==="
  const pytestMatch = output.match(/=+\s*(?:(\d+)\s+passed)?(?:,\s*(\d+)\s+skipped)?(?:,\s*(\d+)\s+failed)?.*in\s+([\d.]+)s\s*={3,}/i);
  if (pytestMatch) {
    const passed = parseInt(pytestMatch[1] || '0', 10);
    const skipped = parseInt(pytestMatch[2] || '0', 10);
    const failed = parseInt(pytestMatch[3] || '0', 10);
    return { total: passed + failed + skipped, passed, failed, skipped };
  }

  // 5. Cargo test pattern: "test result: ok. 42 passed; 0 failed; 0 ignored"
  const cargoMatch = output.match(/test result:\s*(?:ok|FAILED)\.\s*(\d+)\s*passed;\s*(\d+)\s*failed;\s*(\d+)\s*ignored/i);
  if (cargoMatch) {
    const passed = parseInt(cargoMatch[1] || '0', 10);
    const failed = parseInt(cargoMatch[2] || '0', 10);
    const skipped = parseInt(cargoMatch[3] || '0', 10);
    return { total: passed + failed + skipped, passed, failed, skipped };
  }

  // 6. Generic checkmarks: count ✓ or ✔ lines vs ✕ or ✖ lines
  const checkmarks = (output.match(/[✓✔]\s+[^\r\n]+/g) || []).length;
  const crossmarks = (output.match(/[✕✖]\s+[^\r\n]+/g) || []).length;
  if (checkmarks > 0 || crossmarks > 0) {
    return {
      total: checkmarks + crossmarks,
      passed: checkmarks,
      failed: crossmarks,
      skipped: 0,
    };
  }

  return { total: 0, passed: 0, failed: 0, skipped: 0 };
}

/**
 * Extract test execution duration from output if available.
 */
export function extractDurationMs(output: string): number {
  if (!output) return 0;
  
  // "Duration 943ms" or "Duration 1.23s"
  const durMatch = output.match(/Duration\s+([\d.]+)\s*(ms|s|m)/i);
  if (durMatch) {
    const val = parseFloat(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    if (unit === 's') return Math.round(val * 1000);
    if (unit === 'm') return Math.round(val * 60000);
    return Math.round(val);
  }

  // "in 4683ms" or "in 4.68s"
  const inMatch = output.match(/in\s+([\d.]+)\s*(ms|s)/i);
  if (inMatch) {
    const val = parseFloat(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    if (unit === 's') return Math.round(val * 1000);
    return Math.round(val);
  }

  // "Time: 2.345 s"
  const timeMatch = output.match(/Time:\s*([\d.]+)\s*s/i);
  if (timeMatch) {
    return Math.round(parseFloat(timeMatch[1]) * 1000);
  }

  return 0;
}

/**
 * Parse raw test output into a structured TestEvidencePayload.
 */
export function parseTestOutput(
  output: string,
  command = 'npm test',
  exitCode = 0,
  durationMs?: number
): TestEvidencePayload {
  const runner = detectTestRunner(output, command);
  const counts = extractTestCounts(output);
  const extractedDuration = extractDurationMs(output);
  const finalDuration = durationMs ?? extractedDuration;

  const passed = counts.passed;
  const failed = counts.failed;
  const skipped = counts.skipped;
  const total = counts.total || (passed + failed + skipped);

  const isPassed = exitCode === 0 && failed === 0 && (total === 0 || passed > 0);
  const status: 'passed' | 'failed' = isPassed ? 'passed' : 'failed';

  let summary: string;
  if (total > 0) {
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const durSec = (finalDuration / 1000).toFixed(2);
    summary = `${passed}/${total} tests passed (${passRate}%) in ${durSec}s via ${runner}`;
    if (failed > 0) {
      summary += ` · ${failed} failed`;
    }
  } else if (isPassed) {
    summary = `Command \`${command}\` passed with exit code 0`;
  } else {
    summary = `Command \`${command}\` failed with exit code ${exitCode}`;
  }

  return {
    status,
    command,
    summary,
    totalTests: total,
    passed,
    failed,
    skipped,
    durationMs: finalDuration,
    rawOutput: output,
    runner,
    timestamp: new Date().toISOString(),
    exitCode,
  };
}

/**
 * Build a VerificationEvidence payload matching Task Hub OpenAPI contract.
 */
export function buildVerificationEvidence(
  payload: TestEvidencePayload,
  commitSha?: string
): VerificationEvidence {
  return {
    evidence_type: 'automated_test',
    status: payload.status,
    command: payload.command,
    summary: payload.summary,
    commit_sha: commitSha,
    metadata: {
      total_tests: payload.totalTests,
      passed: payload.passed,
      failed: payload.failed,
      skipped: payload.skipped,
      duration_ms: payload.durationMs,
      runner: payload.runner,
      timestamp: payload.timestamp,
      exit_code: payload.exitCode,
    },
  };
}

/**
 * Format evidence into human-readable Markdown for logs and handoff.
 */
export function formatTestSummaryMarkdown(
  evidence: VerificationEvidence | TestEvidencePayload
): string {
  const isVerification = 'evidence_type' in evidence;
  const passed = isVerification ? evidence.metadata.passed : evidence.passed;
  const total = isVerification ? evidence.metadata.total_tests : evidence.totalTests;
  const failed = isVerification ? evidence.metadata.failed : evidence.failed;
  const skipped = isVerification ? evidence.metadata.skipped : evidence.skipped;
  const durationMs = isVerification ? evidence.metadata.duration_ms : evidence.durationMs;
  const runner = isVerification ? evidence.metadata.runner : evidence.runner;
  const commitSha = isVerification ? evidence.commit_sha : undefined;

  const statusBadge = evidence.status === 'passed' ? '✅ PASSED' : '❌ FAILED';
  const durSec = (durationMs || 0) / 1000;

  return [
    `### Test Evidence: ${statusBadge}`,
    `- **Command**: \`${evidence.command}\``,
    `- **Summary**: ${evidence.summary}`,
    `- **Results**: ${passed} passed / ${total} total (${failed} failed, ${skipped} skipped)`,
    `- **Duration**: ${durSec.toFixed(2)}s`,
    `- **Runner**: ${runner || 'generic'}`,
    commitSha ? `- **Commit SHA**: \`${commitSha}\`` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Summarizes an array of raw test suite results into overall test counts.
 */
export function summarizeTestResults(rawSuiteResults: Array<{ name?: string; total?: number; passed?: number; failed?: number }>) {
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  for (const r of rawSuiteResults) {
    totalTests += r.total || 0;
    totalPassed += r.passed || 0;
    totalFailed += r.failed || 0;
  }
  return {
    totalTests,
    totalPassed,
    totalFailed,
    isSuccess: totalFailed === 0,
  };
}
