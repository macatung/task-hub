import { describe, it, expect } from 'vitest';
import {
  detectTestRunner,
  extractTestCounts,
  extractDurationMs,
  parseTestOutput,
  buildVerificationEvidence,
  formatTestSummaryMarkdown,
} from './testEvidence';

describe('Automated Test Evidence Generator', () => {
  describe('detectTestRunner', () => {
    it('identifies Vitest output and commands', () => {
      expect(detectTestRunner('vitest run', 'npm test')).toBe('vitest');
      expect(detectTestRunner('Test Files  7 passed (7)\nTests  59 passed (59)')).toBe('vitest');
    });

    it('identifies Jest output and commands', () => {
      expect(detectTestRunner('jest --coverage', 'npm test')).toBe('jest');
      expect(detectTestRunner('Test Suites: 5 passed, 5 total\nTests: 25 passed')).toBe('jest');
    });

    it('identifies PHPUnit / Ma Ca Tung test runner', () => {
      expect(detectTestRunner('node tests/run_all_tests.js')).toBe('phpunit');
      expect(detectTestRunner('✔ ALL TESTS PASSED  Total: 537 passed, 0 failed, 537 total')).toBe('phpunit');
    });

    it('identifies Pytest & Cargo runners', () => {
      expect(detectTestRunner('pytest -v')).toBe('pytest');
      expect(detectTestRunner('=== 42 passed in 1.23s ===')).toBe('pytest');
      expect(detectTestRunner('cargo test --all')).toBe('cargo');
      expect(detectTestRunner('test result: ok. 15 passed; 0 failed; 0 ignored')).toBe('cargo');
    });
  });

  describe('extractTestCounts', () => {
    it('parses Vitest output accurately', () => {
      const output = `
 RUN  v3.2.7 D:/Project/task-hub/apps/desktop

 ✓ src/utils/streamEvents.test.ts (13 tests) 41ms
 ✓ src/utils/markdown.test.ts (13 tests) 43ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
   Start at  22:30:15
   Duration  943ms
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(59);
      expect(counts.failed).toBe(0);
      expect(counts.total).toBe(59);
    });

    it('parses failing Vitest output', () => {
      const output = `
 Tests  3 failed | 32 passed (35)
 Test Files  1 failed | 4 passed (5)
 Duration 1.45s
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(32);
      expect(counts.failed).toBe(3);
      expect(counts.total).toBe(35);
    });

    it('parses Ma Ca Tung unified runner output', () => {
      const output = `
 📊 4-TIER TEST COVERAGE & EXECUTION BREAKDOWN
  • Tier 1: 165 pass, 0 fail
  • Tier 2: 306 pass, 0 fail
 ✔ ALL TESTS PASSED  Total: 537 passed, 0 failed, 0 skipped, 537 total in 4683ms
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(537);
      expect(counts.failed).toBe(0);
      expect(counts.total).toBe(537);
    });

    it('parses Jest output', () => {
      const output = `
Tests:       2 failed, 1 skipped, 20 passed, 23 total
Snapshots:   0 total
Time:        3.456 s
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(20);
      expect(counts.failed).toBe(2);
      expect(counts.skipped).toBe(1);
      expect(counts.total).toBe(23);
    });

    it('parses Pytest output with passed tests only', () => {
      const output = `
============================= test session starts =============================
collected 45 items

test_auth.py .............................................               [100%]

============================== 45 passed in 3.12s ==============================
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(45);
      expect(counts.failed).toBe(0);
      expect(counts.skipped).toBe(0);
      expect(counts.total).toBe(45);
    });

    it('parses Pytest output with failures before passed (order-independent)', () => {
      const output = `
============================= test session starts =============================
collected 50 items

test_auth.py FFFFF.............................................          [100%]

========================= 5 failed, 45 passed in 3.12s =========================
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(45);
      expect(counts.failed).toBe(5);
      expect(counts.skipped).toBe(0);
      expect(counts.total).toBe(50);
    });

    it('parses Pytest output with failed, errors, passed, and skipped', () => {
      const output = `
================== 2 failed, 40 passed, 3 skipped, 1 error in 4.56s ==================
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(40);
      expect(counts.failed).toBe(3); // 2 failed + 1 error
      expect(counts.skipped).toBe(3);
      expect(counts.total).toBe(46);
    });

    it('parses Pytest output with only failures', () => {
      const output = `
=================================== FAILURES ===================================
_________________________________ test_failure _________________________________
============================== 3 failed in 0.45s ===============================
`;
      const counts = extractTestCounts(output);
      expect(counts.passed).toBe(0);
      expect(counts.failed).toBe(3);
      expect(counts.skipped).toBe(0);
      expect(counts.total).toBe(3);
    });

    it('detects Pytest runner when only failures exist', () => {
      const output = `=== 3 failed in 0.45s ===`;
      expect(detectTestRunner(output)).toBe('pytest');
    });
  });

  describe('extractDurationMs', () => {
    it('parses millisecond and second duration strings', () => {
      expect(extractDurationMs('Duration  943ms')).toBe(943);
      expect(extractDurationMs('Duration  1.25s')).toBe(1250);
      expect(extractDurationMs('in 4683ms')).toBe(4683);
      expect(extractDurationMs('in 2.5s')).toBe(2500);
      expect(extractDurationMs('Time: 3.456 s')).toBe(3456);
    });
  });

  describe('parseTestOutput & buildVerificationEvidence', () => {
    it('creates compliant VerificationEvidence for passing test run', () => {
      const rawOutput = `
 Test Files  5 passed (5)
      Tests  35 passed (35)
   Duration  1.2s
`;
      const parsed = parseTestOutput(rawOutput, 'npm test', 0, 1200);
      expect(parsed.status).toBe('passed');
      expect(parsed.totalTests).toBe(35);
      expect(parsed.passed).toBe(35);
      expect(parsed.failed).toBe(0);
      expect(parsed.durationMs).toBe(1200);
      expect(parsed.summary).toContain('35/35 tests passed');

      const evidence = buildVerificationEvidence(parsed, 'a1b2c3d4e5f6');
      expect(evidence.evidence_type).toBe('automated_test');
      expect(evidence.status).toBe('passed');
      expect(evidence.command).toBe('npm test');
      expect(evidence.commit_sha).toBe('a1b2c3d4e5f6');
      expect(evidence.metadata.total_tests).toBe(35);
      expect(evidence.metadata.passed).toBe(35);
      expect(evidence.metadata.failed).toBe(0);
      expect(evidence.metadata.duration_ms).toBe(1200);
    });

    it('creates failed VerificationEvidence on non-zero exit code or failed tests', () => {
      const rawOutput = `
 Tests  2 failed | 10 passed (12)
 Duration 800ms
`;
      const parsed = parseTestOutput(rawOutput, 'npm test', 1, 800);
      expect(parsed.status).toBe('failed');
      expect(parsed.failed).toBe(2);
      expect(parsed.summary).toContain('2 failed');

      const evidence = buildVerificationEvidence(parsed);
      expect(evidence.status).toBe('failed');
    });

    it('formats Markdown summary correctly', () => {
      const rawOutput = `Tests  35 passed (35)\nDuration 1.5s`;
      const parsed = parseTestOutput(rawOutput, 'npm test', 0, 1500);
      const evidence = buildVerificationEvidence(parsed, 'c0ffee123');
      const md = formatTestSummaryMarkdown(evidence);

      expect(md).toContain('### Test Evidence: ✅ PASSED');
      expect(md).toContain('`npm test`');
      expect(md).toContain('35 passed / 35 total');
      expect(md).toContain('`c0ffee123`');
    });
  });
});
