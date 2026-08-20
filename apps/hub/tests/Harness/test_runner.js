/**
 * Lightweight, Zero-Dependency, Robust Test Runner Framework for macatung.dev
 * Supports describe, it, test, expect with rich matchers, spies, async execution, hooks, and ANSI/JSON reporting.
 */

// ============================================================================
// ANSI Terminal Colors & Styling
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m'
};

function colorize(text, colorName) {
  const code = colors[colorName] || '';
  return `${code}${text}${colors.reset}`;
}

// ============================================================================
// Deep Equality Comparison
// ============================================================================
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  if (a.constructor !== b.constructor) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a.entries()) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a.values()) {
      let found = false;
      for (const bv of b.values()) {
        if (deepEqual(v, bv)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

// ============================================================================
// Mock / Spy Functions (fn, spyOn)
// ============================================================================
export function fn(implementation) {
  let currentImpl = typeof implementation === 'function' ? implementation : () => undefined;

  const mock = function (...args) {
    mock.calls.push(args);
    try {
      const result = currentImpl.apply(this, args);
      mock.results.push({ type: 'return', value: result });
      return result;
    } catch (error) {
      mock.results.push({ type: 'throw', value: error });
      throw error;
    }
  };

  mock.calls = [];
  mock.results = [];
  mock._isMock = true;

  mock.mockReturnValue = function (val) {
    currentImpl = () => val;
    return mock;
  };

  mock.mockResolvedValue = function (val) {
    currentImpl = () => Promise.resolve(val);
    return mock;
  };

  mock.mockRejectedValue = function (val) {
    currentImpl = () => Promise.reject(val);
    return mock;
  };

  mock.mockImplementation = function (newImpl) {
    currentImpl = typeof newImpl === 'function' ? newImpl : () => undefined;
    return mock;
  };

  mock.mockClear = function () {
    mock.calls.length = 0;
    mock.results.length = 0;
    return mock;
  };

  mock.mockReset = function () {
    mock.mockClear();
    currentImpl = () => undefined;
    return mock;
  };

  mock.mockRestore = function () {
    return mock.mockReset();
  };

  return mock;
}

export const mockFn = fn;

export function spyOn(object, methodName) {
  if (!object || typeof object[methodName] !== 'function') {
    throw new Error(`Cannot spy on non-function property "${String(methodName)}"`);
  }
  const original = object[methodName];
  const spy = fn(original.bind(object));
  spy.mockRestore = function () {
    object[methodName] = original;
    spy.mockClear();
  };
  object[methodName] = spy;
  return spy;
}

// ============================================================================
// Assertion Matchers (expect)
// ============================================================================
export class AssertionError extends Error {
  constructor(message, expected, actual) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
  }
}

function formatValue(v) {
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'symbol') return v.toString();
  if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
  if (v instanceof Error) return `[${v.name}: ${v.message}]`;
  if (typeof v === 'object' && v !== null) {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export class MatcherContext {
  constructor(actual, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not() {
    return new MatcherContext(this.actual, !this.isNot);
  }

  _assert(condition, messageGenerator, expected) {
    const passed = this.isNot ? !condition : condition;
    if (!passed) {
      const msg = messageGenerator();
      throw new AssertionError(msg, expected, this.actual);
    }
  }

  toBe(expected) {
    const pass = Object.is(this.actual, expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toEqual(expected) {
    const pass = deepEqual(this.actual, expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to equal' : 'to equal'} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toBeTruthy() {
    const pass = Boolean(this.actual);
    this._assert(
      pass,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be truthy' : 'to be truthy'}`,
      true
    );
    return this;
  }

  toBeFalsy() {
    const pass = !this.actual;
    this._assert(
      pass,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be falsy' : 'to be falsy'}`,
      false
    );
    return this;
  }

  toBeNull() {
    const pass = this.actual === null;
    this._assert(
      pass,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be null' : 'to be null'}`,
      null
    );
    return this;
  }

  toBeUndefined() {
    const pass = this.actual === undefined;
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be undefined' : 'to be undefined'}`,
      undefined
    );
    return this;
  }

  toBeDefined() {
    const pass = this.actual !== undefined;
    this._assert(
      pass,
      () =>
        `Expected value ${this.isNot ? 'to be undefined' : 'to be defined'}, but got ${formatValue(this.actual)}`,
      undefined
    );
    return this;
  }

  toBeNaN() {
    const pass = Number.isNaN(this.actual);
    this._assert(
      pass,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be NaN' : 'to be NaN'}`,
      NaN
    );
    return this;
  }

  toBeGreaterThan(expected) {
    const pass = Number(this.actual) > Number(expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be >' : 'to be >'} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toBeGreaterThanOrEqual(expected) {
    const pass = Number(this.actual) >= Number(expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be >=' : 'to be >='} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toBeLessThan(expected) {
    const pass = Number(this.actual) < Number(expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be <' : 'to be <'} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toBeLessThanOrEqual(expected) {
    const pass = Number(this.actual) <= Number(expected);
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be <=' : 'to be <='} ${formatValue(expected)}`,
      expected
    );
    return this;
  }

  toBeCloseTo(expected, numDigits = 2) {
    const delta = Math.pow(10, -numDigits) / 2;
    const pass = Math.abs(Number(this.actual) - Number(expected)) < delta;
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be close to' : 'to be close to'} ${formatValue(expected)} (delta: ${delta})`,
      expected
    );
    return this;
  }

  toContain(itemOrSubstr) {
    let pass = false;
    if (typeof this.actual === 'string') {
      pass = this.actual.includes(String(itemOrSubstr));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.some((el) => deepEqual(el, itemOrSubstr));
    } else if (this.actual instanceof Set) {
      pass = Array.from(this.actual).some((el) => deepEqual(el, itemOrSubstr));
    } else if (this.actual instanceof Map) {
      pass = this.actual.has(itemOrSubstr);
    }
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to contain' : 'to contain'} ${formatValue(itemOrSubstr)}`,
      itemOrSubstr
    );
    return this;
  }

  toHaveLength(length) {
    const actualLen = this.actual?.length ?? this.actual?.size;
    const pass = actualLen === length;
    this._assert(
      pass,
      () =>
        `Expected length ${this.isNot ? 'NOT to be' : 'to be'} ${length}, but got ${actualLen}`,
      length
    );
    return this;
  }

  toMatch(pattern) {
    let pass = false;
    if (pattern instanceof RegExp) {
      pass = pattern.test(String(this.actual));
    } else {
      pass = String(this.actual).includes(String(pattern));
    }
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to match' : 'to match'} ${pattern}`,
      pattern
    );
    return this;
  }

  toHaveProperty(propPath, expectedValue) {
    const parts = String(propPath).split('.');
    let curr = this.actual;
    let found = true;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        found = false;
        break;
      }
    }
    let pass = found;
    if (found && expectedValue !== undefined) {
      pass = deepEqual(curr, expectedValue);
    }
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to have property' : 'to have property'} "${propPath}"${expectedValue !== undefined ? ` with value ${formatValue(expectedValue)}` : ''}`,
      expectedValue
    );
    return this;
  }

  toBeInstanceOf(constructor) {
    const pass = this.actual instanceof constructor;
    this._assert(
      pass,
      () =>
        `Expected ${formatValue(this.actual)} ${this.isNot ? 'NOT to be instance of' : 'to be instance of'} ${constructor.name || 'Constructor'}`,
      constructor
    );
    return this;
  }

  toThrow(expectedError) {
    let didThrow = false;
    let thrownError = null;
    if (typeof this.actual !== 'function') {
      throw new Error(`expect(actual).toThrow() requires actual to be a function`);
    }
    try {
      this.actual();
    } catch (err) {
      didThrow = true;
      thrownError = err;
    }

    let matches = didThrow;
    if (didThrow && expectedError) {
      if (typeof expectedError === 'string') {
        matches = thrownError.message.includes(expectedError);
      } else if (expectedError instanceof RegExp) {
        matches = expectedError.test(thrownError.message);
      } else if (typeof expectedError === 'function') {
        matches = thrownError instanceof expectedError;
      }
    }

    this._assert(
      matches,
      () =>
        `Expected function ${this.isNot ? 'NOT to throw' : 'to throw'}${expectedError ? ` ${expectedError}` : ''}${didThrow ? `, but it threw: ${thrownError.message}` : ', but it did not throw'}`,
      expectedError
    );
    return this;
  }

  // Mock-specific matchers
  toHaveBeenCalled() {
    if (!this.actual || !this.actual._isMock) {
      throw new Error(`expect(actual).toHaveBeenCalled() requires actual to be a mock function`);
    }
    const pass = this.actual.calls.length > 0;
    this._assert(
      pass,
      () =>
        `Expected mock ${this.isNot ? 'NOT to have been called' : 'to have been called'}, but call count was ${this.actual.calls.length}`,
      '> 0'
    );
    return this;
  }

  toHaveBeenCalledTimes(count) {
    if (!this.actual || !this.actual._isMock) {
      throw new Error(
        `expect(actual).toHaveBeenCalledTimes() requires actual to be a mock function`
      );
    }
    const pass = this.actual.calls.length === count;
    this._assert(
      pass,
      () =>
        `Expected mock ${this.isNot ? 'NOT to have been called' : 'to have been called'} ${count} times, but was called ${this.actual.calls.length} times`,
      count
    );
    return this;
  }

  toHaveBeenCalledWith(...args) {
    if (!this.actual || !this.actual._isMock) {
      throw new Error(
        `expect(actual).toHaveBeenCalledWith() requires actual to be a mock function`
      );
    }
    const pass = this.actual.calls.some((callArgs) => deepEqual(callArgs, args));
    this._assert(
      pass,
      () =>
        `Expected mock ${this.isNot ? 'NOT to have been called with' : 'to have been called with'} ${formatValue(args)}, actual calls: ${formatValue(this.actual.calls)}`,
      args
    );
    return this;
  }

  toHaveBeenLastCalledWith(...args) {
    if (!this.actual || !this.actual._isMock) {
      throw new Error(
        `expect(actual).toHaveBeenLastCalledWith() requires actual to be a mock function`
      );
    }
    const lastCall = this.actual.calls[this.actual.calls.length - 1];
    const pass = deepEqual(lastCall, args);
    this._assert(
      pass,
      () =>
        `Expected mock last call ${this.isNot ? 'NOT to be' : 'to be'} ${formatValue(args)}, but got ${formatValue(lastCall)}`,
      args
    );
    return this;
  }

  get resolves() {
    return {
      toBe: async (expected) => {
        const val = await this.actual;
        return new MatcherContext(val, this.isNot).toBe(expected);
      },
      toEqual: async (expected) => {
        const val = await this.actual;
        return new MatcherContext(val, this.isNot).toEqual(expected);
      },
      toBeTruthy: async () => {
        const val = await this.actual;
        return new MatcherContext(val, this.isNot).toBeTruthy();
      },
      toBeFalsy: async () => {
        const val = await this.actual;
        return new MatcherContext(val, this.isNot).toBeFalsy();
      }
    };
  }

  get rejects() {
    return {
      toThrow: async (expectedError) => {
        let threw = false;
        let thrownError = null;
        try {
          await this.actual;
        } catch (err) {
          threw = true;
          thrownError = err;
        }
        let matches = threw;
        if (threw && expectedError) {
          if (typeof expectedError === 'string') {
            matches = thrownError.message.includes(expectedError);
          } else if (expectedError instanceof RegExp) {
            matches = expectedError.test(thrownError.message);
          } else if (typeof expectedError === 'function') {
            matches = thrownError instanceof expectedError;
          }
        }
        this._assert(
          matches,
          () =>
            `Expected promise ${this.isNot ? 'NOT to reject' : 'to reject'}${expectedError ? ` with ${expectedError}` : ''}${threw ? `, but rejected with: ${thrownError.message}` : ', but it resolved'}`,
          expectedError
        );
      }
    };
  }
}

export function expect(actual) {
  return new MatcherContext(actual, false);
}

// ============================================================================
// Test Suite & Execution Architecture
// ============================================================================

export class TestCase {
  constructor(name, fn, options = {}) {
    this.name = name;
    this.fn = fn;
    this.skip = Boolean(options.skip);
    this.only = Boolean(options.only);
    this.timeout = options.timeout || 10000;
    this.status = 'pending'; // 'passed' | 'failed' | 'skipped'
    this.duration = 0;
    this.error = null;
    this.suite = null;
  }

  get fullName() {
    const parentNames = [];
    let curr = this.suite;
    while (curr && curr.name) {
      parentNames.unshift(curr.name);
      curr = curr.parent;
    }
    return [...parentNames, this.name].join(' > ');
  }
}

export class TestSuite {
  constructor(name = '', parent = null, options = {}) {
    this.name = name;
    this.parent = parent;
    this.skip = Boolean(options.skip) || (parent ? parent.skip : false);
    this.only = Boolean(options.only);
    this.suites = [];
    this.tests = [];
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
  }

  addSuite(suite) {
    suite.parent = this;
    this.suites.push(suite);
    return suite;
  }

  addTest(test) {
    test.suite = this;
    if (this.skip) test.skip = true;
    this.tests.push(test);
    return test;
  }

  get allBeforeEach() {
    const hooks = this.parent ? [...this.parent.allBeforeEach] : [];
    hooks.push(...this.beforeEachHooks);
    return hooks;
  }

  get allAfterEach() {
    const hooks = [...this.afterEachHooks];
    if (this.parent) {
      hooks.push(...this.parent.allAfterEach);
    }
    return hooks;
  }
}

export class TestRunner {
  constructor() {
    this.rootSuite = new TestSuite('Root');
    this.currentSuite = this.rootSuite;
    this.results = [];
    this.startTime = 0;
    this.endTime = 0;
    this.hasOnly = false;
  }

  reset() {
    this.rootSuite = new TestSuite('Root');
    this.currentSuite = this.rootSuite;
    this.results = [];
    this.startTime = 0;
    this.endTime = 0;
    this.hasOnly = false;
  }

  describe(name, fn) {
    const parent = this.currentSuite;
    const suite = new TestSuite(name, parent);
    parent.addSuite(suite);
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parent;
    }
    return suite;
  }

  describeSkip(name, fn) {
    const parent = this.currentSuite;
    const suite = new TestSuite(name, parent, { skip: true });
    parent.addSuite(suite);
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parent;
    }
    return suite;
  }

  describeOnly(name, fn) {
    this.hasOnly = true;
    const parent = this.currentSuite;
    const suite = new TestSuite(name, parent, { only: true });
    parent.addSuite(suite);
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parent;
    }
    return suite;
  }

  test(name, fn, options = {}) {
    const t = new TestCase(name, fn, options);
    if (options.only) this.hasOnly = true;
    this.currentSuite.addTest(t);
    return t;
  }

  testSkip(name, fn) {
    return this.test(name, fn, { skip: true });
  }

  testOnly(name, fn) {
    this.hasOnly = true;
    return this.test(name, fn, { only: true });
  }

  beforeAll(fn) {
    this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    this.currentSuite.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    this.currentSuite.afterEachHooks.push(fn);
  }

  async runSuite(suite) {
    // Check if suite has tests or child suites to run
    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    for (const test of suite.tests) {
      if (this.hasOnly && !test.only && !suite.only) {
        test.status = 'skipped';
        this.results.push(test);
        continue;
      }
      if (test.skip) {
        test.status = 'skipped';
        this.results.push(test);
        continue;
      }

      // Run beforeEach hooks
      for (const hook of suite.allBeforeEach) {
        await hook();
      }

      const start = Date.now();
      try {
        if (typeof test.fn === 'function') {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Test timed out after ${test.timeout}ms`)),
              test.timeout
            )
          );
          const executionPromise = Promise.resolve(test.fn());
          await Promise.race([executionPromise, timeoutPromise]);
        }
        test.status = 'passed';
      } catch (err) {
        test.status = 'failed';
        test.error = err;
      } finally {
        test.duration = Date.now() - start;
      }

      // Run afterEach hooks
      for (const hook of suite.allAfterEach) {
        try {
          await hook();
        } catch (hookErr) {
          console.error('Error in afterEach hook:', hookErr);
        }
      }

      this.results.push(test);
    }

    for (const childSuite of suite.suites) {
      await this.runSuite(childSuite);
    }

    for (const hook of suite.afterAllHooks) {
      try {
        await hook();
      } catch (hookErr) {
        console.error('Error in afterAll hook:', hookErr);
      }
    }
  }

  async run() {
    this.startTime = Date.now();
    this.results = [];
    await this.runSuite(this.rootSuite);
    this.endTime = Date.now();
    return this.getSummary();
  }

  getSummary() {
    const passed = this.results.filter((r) => r.status === 'passed').length;
    const failed = this.results.filter((r) => r.status === 'failed').length;
    const skipped = this.results.filter((r) => r.status === 'skipped').length;
    const total = this.results.length;
    const duration = this.endTime - this.startTime;

    return {
      total,
      passed,
      failed,
      skipped,
      duration,
      success: failed === 0,
      results: this.results.map((r) => ({
        fullName: r.fullName,
        name: r.name,
        status: r.status,
        duration: r.duration,
        error: r.error
          ? {
              message: r.error.message,
              stack: r.error.stack,
              expected: r.error.expected,
              actual: r.error.actual
            }
          : null
      }))
    };
  }

  printConsoleReport(suiteName = '') {
    const summary = this.getSummary();
    console.log('');
    if (suiteName) {
      console.log(
        colorize(`📦 SUITE: ${suiteName}`, 'bold') +
          colorize(` (${summary.total} tests, ${summary.duration}ms)`, 'gray')
      );
      console.log(colorize('─'.repeat(70), 'gray'));
    }

    for (const r of this.results) {
      const durationStr = colorize(`(${r.duration}ms)`, 'gray');
      if (r.status === 'passed') {
        console.log(`  ${colorize('✔', 'green')} ${r.fullName} ${durationStr}`);
      } else if (r.status === 'failed') {
        console.log(`  ${colorize('✖', 'red')} ${colorize(r.fullName, 'bold')} ${durationStr}`);
        if (r.error) {
          const errMsg = r.error.message || String(r.error);
          console.log(`    ${colorize('Error:', 'red')} ${errMsg}`);
          if (r.error.expected !== undefined || r.error.actual !== undefined) {
            console.log(
              `    ${colorize('- Expected:', 'green')} ${formatValue(r.error.expected)}`
            );
            console.log(`    ${colorize('+ Received:', 'red')} ${formatValue(r.error.actual)}`);
          }
          if (r.error.stack) {
            const stackLines = r.error.stack
              .split('\n')
              .slice(1, 4)
              .map((line) => `      ${colorize(line.trim(), 'gray')}`)
              .join('\n');
            console.log(stackLines);
          }
        }
      } else if (r.status === 'skipped') {
        console.log(`  ${colorize('↷', 'yellow')} ${colorize(r.fullName, 'dim')} (skipped)`);
      }
    }

    console.log(colorize('─'.repeat(70), 'gray'));
    const statusText = summary.success
      ? colorize(' PASSED ', 'bgGreen')
      : colorize(' FAILED ', 'bgRed');
    console.log(
      `${statusText} ${colorize(`Tests:`, 'bold')} ${colorize(String(summary.passed) + ' passed', 'green')}, ${summary.failed > 0 ? colorize(String(summary.failed) + ' failed', 'red') : '0 failed'}, ${summary.skipped > 0 ? colorize(String(summary.skipped) + ' skipped', 'yellow') : '0 skipped'}, ${summary.total} total  ${colorize(`Time: ${summary.duration}ms`, 'cyan')}`
    );
    console.log('');
  }
}

// Global Singleton Instance
export const globalRunner = new TestRunner();

// Exported standard DSL functions
export const describe = (name, fn) => globalRunner.describe(name, fn);
describe.skip = (name, fn) => globalRunner.describeSkip(name, fn);
describe.only = (name, fn) => globalRunner.describeOnly(name, fn);

export const it = (name, fn) => globalRunner.test(name, fn);
it.skip = (name, fn) => globalRunner.testSkip(name, fn);
it.only = (name, fn) => globalRunner.testOnly(name, fn);

export const test = (name, fn) => globalRunner.test(name, fn);
test.skip = (name, fn) => globalRunner.testSkip(name, fn);
test.only = (name, fn) => globalRunner.testOnly(name, fn);

export const beforeAll = (fn) => globalRunner.beforeAll(fn);
export const afterAll = (fn) => globalRunner.afterAll(fn);
export const beforeEach = (fn) => globalRunner.beforeEach(fn);
export const afterEach = (fn) => globalRunner.afterEach(fn);

// Helper to register globals if desired
export function registerGlobals() {
  globalThis.describe = describe;
  globalThis.it = it;
  globalThis.test = test;
  globalThis.expect = expect;
  globalThis.beforeAll = beforeAll;
  globalThis.afterAll = afterAll;
  globalThis.beforeEach = beforeEach;
  globalThis.afterEach = afterEach;
  globalThis.fn = fn;
  globalThis.mockFn = mockFn;
  globalThis.spyOn = spyOn;
}
