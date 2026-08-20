/**
 * TypeScript Type Definitions for macatung.dev Test Runner Framework
 */

export * from './test_runner.js';

export type TestFunction = () => void | Promise<void>;
export type HookFunction = () => void | Promise<void>;

export interface ITestResult {
  fullName: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error: {
    message: string;
    stack?: string;
    expected?: any;
    actual?: any;
  } | null;
}

export interface ITestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  success: boolean;
  results: ITestResult[];
}
