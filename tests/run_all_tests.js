#!/usr/bin/env node

/**
 * Unified Monorepo Test Runner (Task Hub)
 * Discovers and executes test suites across Web Hub and Desktop Studio.
 *
 * Usage:
 *   node tests/run_all_tests.js [options]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const HUB_ROOT = path.resolve(PROJECT_ROOT, 'apps/hub');

// Ensure working directory is set to apps/hub so relative model/doc references resolve cleanly
process.chdir(HUB_ROOT);

// Dynamically import the Web Hub test runner
await import('../apps/hub/tests/run_all_tests.js');
