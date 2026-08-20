#!/usr/bin/env node

/**
 * Unified CLI Test Runner for macatung.dev Full-Stack E2E Test Suite
 * Discovers and executes all test suites across Unit, Components, Integration, Feature, and E2E tiers.
 *
 * Usage:
 *   node tests/run_all_tests.js [options]
 *
 * Options:
 *   --tier=<1|2|3|4|all>     Filter by test tier
 *   --dir=<dirName>          Filter by directory (Unit, Components, Integration, E2E)
 *   --filter=<pattern>       Filter test file names or test case names
 *   --json                   Output machine-readable JSON format
 *   --report-file=<path>     Save JSON summary to specified path
 *   --verbose                Print extra debugging and timing information
 *   --help                   Show help manual
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globalRunner, registerGlobals } from './Harness/test_runner.js';
import { setupTestEnvironment } from './Harness/mock_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TESTS_ROOT = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// ANSI Styling Helpers
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m'
};

function color(text, colorName) {
  return `${colors[colorName] || ''}${text}${colors.reset}`;
}

// ============================================================================
// CLI Arguments Parsing
// ============================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tier: 'all',
    dir: null,
    filter: null,
    json: false,
    reportFile: null,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      options.tier = arg.split('=')[1].toLowerCase();
    } else if (arg === '-t' && i + 1 < args.length) {
      options.tier = args[++i].toLowerCase();
    } else if (arg.startsWith('--dir=')) {
      options.dir = arg.split('=')[1];
    } else if (arg === '-d' && i + 1 < args.length) {
      options.dir = args[++i];
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '-f' && i + 1 < args.length) {
      options.filter = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--report-file=')) {
      options.reportFile = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${color('🌙 MA CÀ TƯNG (macatung.dev) — UNIFIED E2E TEST RUNNER', 'bold')}

${color('Usage:', 'cyan')}
  node tests/run_all_tests.js [options]

${color('Options:', 'cyan')}
  --tier=<1|2|3|4|all>     Filter by test tier (Tier 1: Features, Tier 2: Boundary, Tier 3: Pairwise, Tier 4: Scenarios)
  --dir=<dirName>          Filter by directory (Unit, Components, Integration, E2E, Harness)
  --filter=<pattern>       Filter test file names or test titles matching pattern
  --json                   Output results as clean JSON
  --report-file=<path>     Save JSON summary to specified path
  --verbose                Show detailed assertion stacks and timing
  --help                   Display this help message
`);
}

// ============================================================================
// Test File Discovery
// ============================================================================
function findTestFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTestFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      if (
        (entry.name.endsWith('.test.ts') ||
          entry.name.endsWith('.test.js') ||
          entry.name.endsWith('.spec.ts') ||
          entry.name.endsWith('.spec.js'))
      ) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// ============================================================================
// Main Test Runner Pipeline
// ============================================================================
async function run() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();

  // Register globals for seamless describe / it / test / expect usage
  registerGlobals();

  // Discover all test files
  const allDiscoveredFiles = findTestFiles(TESTS_ROOT);

  // Filter test files according to options
  const targetFiles = allDiscoveredFiles.filter((filePath) => {
    const rel = path.relative(TESTS_ROOT, filePath).replace(/\\/g, '/');

    // Filter by directory
    if (options.dir && !rel.toLowerCase().startsWith(options.dir.toLowerCase())) {
      return false;
    }

    // Filter by pattern
    if (options.filter && !rel.toLowerCase().includes(options.filter.toLowerCase())) {
      return false;
    }

    return true;
  });

  if (!options.json) {
    console.log(color('═'.repeat(74), 'cyan'));
    console.log(
      color(' 🌙 MA CÀ TƯNG (macatung.dev) — UNIFIED E2E TEST SUITE RUNNER 🌙', 'bold')
    );
    console.log(color('═'.repeat(74), 'cyan'));
    console.log(
      ` ${color('Found:', 'gray')} ${allDiscoveredFiles.length} test files  |  ${color('Targeted:', 'gray')} ${targetFiles.length} files  |  ${color('Tier Filter:', 'gray')} ${options.tier}`
    );
    console.log(color('─'.repeat(74), 'gray'));
  }

  const allSuiteResults = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Breakdown metrics by Tier
  const tierBreakdown = {
    tier1: { name: 'Tier 1: Feature Coverage (Isolation)', total: 0, passed: 0, failed: 0, skipped: 0 },
    tier2: { name: 'Tier 2: Boundary & Corner Cases', total: 0, passed: 0, failed: 0, skipped: 0 },
    tier3: { name: 'Tier 3: Cross-Feature Interactions', total: 0, passed: 0, failed: 0, skipped: 0 },
    tier4: { name: 'Tier 4: Real-World E2E Scenarios', total: 0, passed: 0, failed: 0, skipped: 0 },
    other: { name: 'Harness & Infrastructure Checks', total: 0, passed: 0, failed: 0, skipped: 0 }
  };

  function categorizeTest(testName, relPath) {
    const s = `${relPath} ${testName}`;
    if (/\[T1_|T1_F\d+|Tier\s*1/i.test(s) || relPath.includes('Unit') || relPath.includes('Components')) {
      if (/\[T2_|T2_F\d+|boundary|corner|edge|overflow|stress/i.test(s)) {
        return 'tier2';
      }
      return 'tier1';
    }
    if (/\[T2_|T2_F\d+|Tier\s*2/i.test(s)) {
      return 'tier2';
    }
    if (/\[T3_|T3_\d+|Tier\s*3|pairwise|cross-feature|CrossFeature/i.test(s) || relPath.includes('Integration')) {
      return 'tier3';
    }
    if (/\[T4_|T4_\d+|Tier\s*4|Scenario|E2E/i.test(s) || relPath.includes('E2E')) {
      return 'tier4';
    }
    return 'other';
  }

  // Execute each test suite
  for (const filePath of targetFiles) {
    const relPath = path.relative(TESTS_ROOT, filePath).replace(/\\/g, '/');
    const env = setupTestEnvironment();

    globalRunner.reset();

    const suiteStartTime = Date.now();
    let importError = null;

    try {
      const fileUrl = pathToFileURL(filePath).href;
      // Add timestamp query to bypass ESM cache on subsequent runs if needed
      await import(`${fileUrl}?t=${Date.now()}`);
      await globalRunner.run();
    } catch (err) {
      importError = err;
    } finally {
      env.teardown();
    }

    const suiteDuration = Date.now() - suiteStartTime;
    const summary = globalRunner.getSummary();

    if (importError) {
      totalFailed++;
      totalTests++;
      allSuiteResults.push({
        file: relPath,
        duration: suiteDuration,
        success: false,
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        tests: [
          {
            fullName: `${relPath} > Import Execution`,
            name: 'Import Execution',
            status: 'failed',
            duration: suiteDuration,
            error: {
              message: importError.message,
              stack: importError.stack
            }
          }
        ]
      });

      if (!options.json) {
        console.log(
          `  ${color('✖', 'red')} ${color(relPath, 'bold')} ${color(`(${suiteDuration}ms)`, 'gray')}`
        );
        console.log(`    ${color('Import Error:', 'red')} ${importError.message}`);
        if (importError.stack) {
          console.log(`    ${color(importError.stack.split('\n').slice(0, 3).join('\n    '), 'gray')}`);
        }
      }
      continue;
    }

    // Filter tests by tier option if specified
    const filteredResults = summary.results.filter((res) => {
      const tierKey = categorizeTest(res.fullName, relPath);
      if (options.tier === '1' && tierKey !== 'tier1') return false;
      if (options.tier === '2' && tierKey !== 'tier2') return false;
      if (options.tier === '3' && tierKey !== 'tier3') return false;
      if (options.tier === '4' && tierKey !== 'tier4') return false;
      return true;
    });

    let suitePassed = 0;
    let suiteFailed = 0;
    let suiteSkipped = 0;

    for (const res of filteredResults) {
      const tierKey = categorizeTest(res.fullName, relPath);
      tierBreakdown[tierKey].total++;
      if (res.status === 'passed') {
        tierBreakdown[tierKey].passed++;
        suitePassed++;
      } else if (res.status === 'failed') {
        tierBreakdown[tierKey].failed++;
        suiteFailed++;
      } else {
        tierBreakdown[tierKey].skipped++;
        suiteSkipped++;
      }
    }

    totalTests += filteredResults.length;
    totalPassed += suitePassed;
    totalFailed += suiteFailed;
    totalSkipped += suiteSkipped;

    allSuiteResults.push({
      file: relPath,
      duration: suiteDuration,
      success: suiteFailed === 0,
      total: filteredResults.length,
      passed: suitePassed,
      failed: suiteFailed,
      skipped: suiteSkipped,
      tests: filteredResults
    });

    if (!options.json && filteredResults.length > 0) {
      const icon = suiteFailed === 0 ? color('✔', 'green') : color('✖', 'red');
      const passText = color(`${suitePassed} passed`, 'green');
      const failText = suiteFailed > 0 ? color(`, ${suiteFailed} failed`, 'red') : '';
      const skipText = suiteSkipped > 0 ? color(`, ${suiteSkipped} skipped`, 'yellow') : '';
      console.log(
        `  ${icon} ${color(relPath, 'bold')} ${color(`[${passText}${failText}${skipText}]`, 'gray')} ${color(`(${suiteDuration}ms)`, 'gray')}`
      );

      if (suiteFailed > 0 || options.verbose) {
        for (const test of filteredResults) {
          if (test.status === 'failed') {
            console.log(`    ${color('✖', 'red')} ${test.fullName}`);
            if (test.error) {
              console.log(`      ${color('Error:', 'red')} ${test.error.message}`);
              if (test.error.expected !== undefined || test.error.actual !== undefined) {
                console.log(`      ${color('- Expected:', 'green')} ${JSON.stringify(test.error.expected)}`);
                console.log(`      ${color('+ Received:', 'red')} ${JSON.stringify(test.error.actual)}`);
              }
            }
          } else if (options.verbose && test.status === 'passed') {
            console.log(`    ${color('✔', 'green')} ${test.fullName}`);
          }
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const overallSuccess = totalFailed === 0;

  const outputSummary = {
    timestamp: new Date().toISOString(),
    success: overallSuccess,
    durationMs: totalDuration,
    metrics: {
      totalSuites: targetFiles.length,
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped
    },
    tierBreakdown,
    suites: allSuiteResults
  };

  if (options.reportFile) {
    const reportPath = path.isAbsolute(options.reportFile)
      ? options.reportFile
      : path.resolve(PROJECT_ROOT, options.reportFile);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(outputSummary, null, 2), 'utf8');
    if (!options.json) {
      console.log(color(`\nSaved test report to: ${reportPath}`, 'cyan'));
    }
  }

  if (options.json) {
    console.log(JSON.stringify(outputSummary, null, 2));
  } else {
    console.log(color('─'.repeat(74), 'gray'));
    console.log(color(' 📊 4-TIER TEST COVERAGE & EXECUTION BREAKDOWN', 'bold'));
    console.log(color('─'.repeat(74), 'gray'));

    for (const [key, tb] of Object.entries(tierBreakdown)) {
      if (tb.total > 0 || !['other'].includes(key)) {
        const passBadge = color(`${tb.passed} pass`, tb.passed > 0 ? 'green' : 'gray');
        const failBadge = tb.failed > 0 ? color(`${tb.failed} fail`, 'red') : color('0 fail', 'gray');
        console.log(
          `  • ${tb.name.padEnd(42, ' ')} : ${String(tb.total).padStart(4, ' ')} tests [${passBadge}, ${failBadge}]`
        );
      }
    }

    console.log(color('═'.repeat(74), 'gray'));
    const finalBadge = overallSuccess
      ? color(' ✔ ALL TESTS PASSED ', 'bgGreen')
      : color(' ✖ SOME TESTS FAILED ', 'bgRed');

    console.log(
      `${finalBadge} ${color('Total:', 'bold')} ${color(String(totalPassed) + ' passed', 'green')}, ${totalFailed > 0 ? color(String(totalFailed) + ' failed', 'red') : '0 failed'}, ${totalSkipped > 0 ? color(String(totalSkipped) + ' skipped', 'yellow') : '0 skipped'}, ${totalTests} total in ${totalDuration}ms`
    );
    console.log(color('═'.repeat(74), 'gray') + '\n');
  }

  process.exit(overallSuccess ? 0 : 1);
}

run().catch((err) => {
  console.error(color('FATAL RUNNER ERROR:', 'bgRed'), err);
  process.exit(1);
});
