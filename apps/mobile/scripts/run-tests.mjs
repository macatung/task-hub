import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(mobileRoot, '../..');
const require = createRequire(import.meta.url);

// =========================================================================
// 1. Fake Timers Implementation
// =========================================================================

let useFakes = false;
let fakeCurrentTime = 0;
let nextTimerId = 1;
const scheduledTimers = new Map();

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

function customSetTimeout(fn, ms = 0, ...args) {
  if (!useFakes) {
    return originalSetTimeout(fn, ms, ...args);
  }
  const id = nextTimerId++;
  const due = fakeCurrentTime + ms;
  scheduledTimers.set(id, { id, fn, due, args });
  return id;
}

function customClearTimeout(id) {
  if (!useFakes) {
    return originalClearTimeout(id);
  }
  scheduledTimers.delete(id);
}

global.setTimeout = customSetTimeout;
global.clearTimeout = customClearTimeout;

// =========================================================================
// 2. React & React Native Virtual Component Engine
// =========================================================================

let activeComponentInstance = null;

class VNode {
  constructor(type, props = {}, children = []) {
    this.type = type;
    this.props = { ...(props || {}) };
    this.children = Array.isArray(children) ? children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false) : [children];
    for (const ch of this.children) {
      try {
        if (ch && typeof ch === 'object' && Object.isExtensible(ch)) {
          ch._parent = this;
        }
      } catch {}
    }
    if (this.children.length === 1) {
      this.props.children = this.children[0];
    } else if (this.children.length > 1) {
      this.props.children = this.children;
    }
  }
}

class ComponentInstance {
  constructor(element) {
    this.element = element;
    this.hooks = [];
    this.hookIndex = 0;
    this.tree = null;
    this.render();
  }

  render() {
    activeComponentInstance = this;
    this.hookIndex = 0;
    try {
      if (typeof this.element?.type === 'function') {
        const props = { ...(this.element.props || {}) };
        this.tree = this.element.type(props);
      } else {
        this.tree = this.element;
      }
    } finally {
      activeComponentInstance = null;
    }
    return this.tree;
  }
}

const React = {
  createElement(type, props, ...children) {
    const flatChildren = children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false);
    return new VNode(type, props || {}, flatChildren);
  },
  useState(initial) {
    if (!activeComponentInstance) {
      let val = typeof initial === 'function' ? initial() : initial;
      return [val, (newVal) => { val = typeof newVal === 'function' ? newVal(val) : newVal; }];
    }

    const instance = activeComponentInstance;
    const idx = instance.hookIndex++;
    if (instance.hooks.length <= idx) {
      const val = typeof initial === 'function' ? initial() : initial;
      instance.hooks.push(val);
    }

    const stateVal = instance.hooks[idx];
    const setState = (newVal) => {
      const nextVal = typeof newVal === 'function' ? newVal(instance.hooks[idx]) : newVal;
      instance.hooks[idx] = nextVal;
      instance.render();
    };

    return [stateVal, setState];
  },
  useEffect(fn, deps) {
    if (!activeComponentInstance) {
      try { fn(); } catch {}
      return;
    }
    const instance = activeComponentInstance;
    const idx = instance.hookIndex++;
    if (instance.hooks.length <= idx) {
      const hookData = { deps, cleanup: undefined };
      instance.hooks.push(hookData);
      try {
        const cleanup = fn();
        hookData.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      } catch {}
      return;
    }

    const prev = instance.hooks[idx];
    const hasChanged = !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, i) => d !== prev.deps[i]);
    if (hasChanged) {
      if (prev.cleanup) {
        try { prev.cleanup(); } catch {}
      }
      prev.deps = deps;
      try {
        const cleanup = fn();
        prev.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      } catch {}
    }
  },
  useRef(initial) {
    if (!activeComponentInstance) return { current: initial };
    const instance = activeComponentInstance;
    const idx = instance.hookIndex++;
    if (instance.hooks.length <= idx) {
      instance.hooks.push({ current: initial });
    }
    return instance.hooks[idx];
  },
  useCallback(fn, deps) {
    if (!activeComponentInstance) return fn;
    const instance = activeComponentInstance;
    const idx = instance.hookIndex++;
    if (instance.hooks.length <= idx) {
      instance.hooks.push({ fn, deps });
      return fn;
    }
    const prev = instance.hooks[idx];
    const hasChanged = !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, i) => d !== prev.deps[i]);
    if (hasChanged) {
      prev.fn = fn;
      prev.deps = deps;
      return fn;
    }
    return prev.fn;
  },
  useMemo(fn, deps) {
    if (!activeComponentInstance) return fn();
    const instance = activeComponentInstance;
    const idx = instance.hookIndex++;
    if (instance.hooks.length <= idx) {
      const val = fn();
      instance.hooks.push({ val, deps });
      return val;
    }
    const prev = instance.hooks[idx];
    const hasChanged = !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, i) => d !== prev.deps[i]);
    if (hasChanged) {
      prev.val = fn();
      prev.deps = deps;
      return prev.val;
    }
    return prev.val;
  },
  Fragment: 'Fragment',
};

const ReactNative = {
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Alert: {
    alert: (title, message, buttons) => {},
  },
  Linking: {
    openURL: (url) => Promise.resolve(true),
    canOpenURL: (url) => Promise.resolve(true),
  },
  AppState: {
    currentState: 'active',
    addEventListener: (event, handler) => ({
      remove: () => {},
    }),
  },
  FlatList: (props) => {
    const data = props.data || [];
    if (data.length === 0 && props.ListEmptyComponent) {
      const empty =
        typeof props.ListEmptyComponent === 'function'
          ? React.createElement(props.ListEmptyComponent)
          : props.ListEmptyComponent;
      return React.createElement('View', { testID: props.testID }, empty);
    }
    const children = data.map((item, index) => {
      const key = props.keyExtractor ? props.keyExtractor(item, index) : String(index);
      return props.renderItem ? props.renderItem({ item, index, separators: {} }) : null;
    });
    return React.createElement('View', { testID: props.testID }, ...children);
  },
  StyleSheet: {
    create: (styles) => styles,
  },
};

// =========================================================================
// 3. React Native Testing Library
// =========================================================================

function expandAndFindNodes(vnode, predicate, results = []) {
  if (!vnode) return results;
  if (typeof vnode !== 'object') return results;

  let current = vnode;
  while (typeof current?.type === 'function') {
    try {
      const props = { ...(current.props || {}) };
      if (current.children && current.children.length > 0) {
        props.children = current.children.length === 1 ? current.children[0] : current.children;
      }
      current = current.type(props);
    } catch {
      break;
    }
  }

  if (!current || typeof current !== 'object') return results;

  if (predicate(current)) {
    results.push(current);
  }

  const explore = (ch) => {
    if (!ch) return;
    if (Array.isArray(ch)) {
      for (const item of ch) explore(item);
    } else if (typeof ch === 'object') {
      expandAndFindNodes(ch, predicate, results);
    }
  };

  explore(current.children);
  if (current.props?.children && current.props.children !== current.children) {
    explore(current.props.children);
  }

  return results;
}

function getNodeText(vnode) {
  if (vnode === null || vnode === undefined) return '';
  if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
  if (typeof vnode !== 'object') return '';

  let current = vnode;
  while (typeof current?.type === 'function') {
    try {
      const props = { ...(current.props || {}) };
      if (current.children && current.children.length > 0) {
        props.children = current.children.length === 1 ? current.children[0] : current.children;
      }
      current = current.type(props);
    } catch {
      break;
    }
  }

  let txt = '';
  const explore = (ch) => {
    if (ch === null || ch === undefined || ch === false) return;
    if (typeof ch === 'string' || typeof ch === 'number') {
      txt += String(ch);
    } else if (Array.isArray(ch)) {
      for (const item of ch) explore(item);
    } else if (typeof ch === 'object') {
      txt += getNodeText(ch);
    }
  };

  explore(current.children);
  if (current.props?.children && current.props.children !== current.children) {
    explore(current.props.children);
  }
  return txt;
}

const TestingLibraryReactNative = {
  render: (element) => {
    const instance = new ComponentInstance(element);

    const wrapNode = (node) => {
      if (!node) return null;
      return {
        ...node,
        _parent: node._parent,
        props: {
          ...node.props,
          accessibilityState: {
            disabled: !!node.props?.disabled,
            ...(node.props?.accessibilityState || {}),
          },
        },
      };
    };

    return {
      getByTestId: (testID) => {
        const matches = expandAndFindNodes(instance.tree, (n) => n.props?.testID === testID);
        if (matches.length === 0) {
          throw new Error(`Unable to find element with testID: ${testID}`);
        }
        return wrapNode(matches[0]);
      },
      queryByTestId: (testID) => {
        const matches = expandAndFindNodes(instance.tree, (n) => n.props?.testID === testID);
        return matches.length > 0 ? wrapNode(matches[0]) : null;
      },
      getByText: (textOrRegex) => {
        const matches = expandAndFindNodes(instance.tree, (n) => {
          const content = getNodeText(n);
          if (typeof textOrRegex === 'string') {
            return content.includes(textOrRegex);
          }
          return textOrRegex.test(content);
        });
        if (matches.length === 0) {
          throw new Error(`Unable to find element with text: ${textOrRegex}`);
        }
        return wrapNode(matches[matches.length - 1]);
      },
      queryByText: (textOrRegex) => {
        const matches = expandAndFindNodes(instance.tree, (n) => {
          const content = getNodeText(n);
          if (typeof textOrRegex === 'string') {
            return content.includes(textOrRegex);
          }
          return textOrRegex.test(content);
        });
        return matches.length > 0 ? wrapNode(matches[matches.length - 1]) : null;
      },
      getByPlaceholderText: (textOrRegex) => {
        const matches = expandAndFindNodes(instance.tree, (n) => {
          const ph = n.props?.placeholder;
          if (!ph) return false;
          if (typeof textOrRegex === 'string') return ph.includes(textOrRegex);
          return textOrRegex.test(ph);
        });
        if (matches.length === 0) {
          throw new Error(`Unable to find element with placeholder: ${textOrRegex}`);
        }
        return wrapNode(matches[0]);
      },
      queryByPlaceholderText: (textOrRegex) => {
        const matches = expandAndFindNodes(instance.tree, (n) => {
          const ph = n.props?.placeholder;
          if (!ph) return false;
          if (typeof textOrRegex === 'string') return ph.includes(textOrRegex);
          return textOrRegex.test(ph);
        });
        return matches.length > 0 ? wrapNode(matches[0]) : null;
      },
      rerender: (newElement) => {
        instance.element = newElement;
        instance.render();
      },
      toJSON: () => instance.tree,
      debug: () => console.log(JSON.stringify(instance.tree, null, 2)),
    };
  },
  fireEvent: {
    press: (node) => {
      let current = node;
      while (current) {
        if (current?.props?.onPress && !current.props.disabled) {
          current.props.onPress();
          return;
        }
        current = current._parent;
      }
    },
    changeText: (node, text) => {
      let current = node;
      while (current) {
        if (current?.props?.onChangeText) {
          current.props.onChangeText(text);
          return;
        }
        current = current._parent;
      }
    },
  },
  waitFor: async (fn, { timeout = 1000, interval = 10 } = {}) => {
    const start = Date.now();
    while (true) {
      try {
        await fn();
        return;
      } catch (err) {
        if (Date.now() - start > timeout) {
          throw err;
        }
        await new Promise((r) => originalSetTimeout(r, interval));
      }
    }
  },
  act: async (fn) => {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return await res;
    }
    return res;
  },
  renderHook: (hookFn, options = {}) => {
    const result = { current: null };
    function HookConsumer(props) {
      result.current = hookFn(props);
      return null;
    }
    const instance = new ComponentInstance(React.createElement(HookConsumer, options.initialProps));
    return {
      result,
      rerender: (newProps) => {
        instance.element = React.createElement(HookConsumer, newProps);
        instance.render();
      },
      unmount: () => {},
    };
  },
};

// =========================================================================
// 4. Jest Mock Function & Object Mocks
// =========================================================================

class AsymmetricMatcher {
  constructor(name, sample) {
    this.name = name;
    this.sample = sample;
  }
}

function createMockFunction(impl) {
  const calls = [];
  const onceQueue = [];

  const fn = function (...args) {
    calls.push(args);
    if (onceQueue.length > 0) {
      const next = onceQueue.shift();
      return next.apply(this, args);
    }
    if (fn._mockImplementation) {
      return fn._mockImplementation.apply(this, args);
    }
    if (fn._mockReturnValue !== undefined) {
      return fn._mockReturnValue;
    }
    if (fn._mockResolvedValue !== undefined) {
      return Promise.resolve(fn._mockResolvedValue);
    }
    if (fn._mockRejectedValue !== undefined) {
      return Promise.reject(fn._mockRejectedValue);
    }
    if (impl) {
      return impl.apply(this, args);
    }
    return undefined;
  };

  fn.mock = {
    calls,
    get results() {
      return calls.map((c) => ({ type: 'return', value: undefined }));
    },
  };

  fn.mockClear = () => {
    calls.length = 0;
    onceQueue.length = 0;
    return fn;
  };

  fn.mockReset = () => {
    calls.length = 0;
    onceQueue.length = 0;
    fn._mockImplementation = undefined;
    fn._mockReturnValue = undefined;
    fn._mockResolvedValue = undefined;
    fn._mockRejectedValue = undefined;
    return fn;
  };

  fn.mockImplementation = (newImpl) => {
    fn._mockImplementation = newImpl;
    return fn;
  };

  fn.mockResolvedValue = (val) => {
    fn._mockResolvedValue = val;
    return fn;
  };

  fn.mockResolvedValueOnce = (val) => {
    onceQueue.push(() => Promise.resolve(val));
    return fn;
  };

  fn.mockRejectedValue = (err) => {
    fn._mockRejectedValue = err;
    return fn;
  };

  fn.mockRejectedValueOnce = (err) => {
    onceQueue.push(() => Promise.reject(err));
    return fn;
  };

  fn.mockReturnValue = (val) => {
    fn._mockReturnValue = val;
    return fn;
  };

  return fn;
}

const mockModules = new Map();

const jestObject = {
  fn: (impl) => createMockFunction(impl),
  spyOn: (obj, method) => {
    if (!obj) return createMockFunction();
    const descriptor = Object.getOwnPropertyDescriptor(obj, method) || {
      value: obj[method],
      writable: true,
      configurable: true,
    };
    const original = obj[method];
    const mockFn = createMockFunction(original);
    Object.defineProperty(obj, method, {
      value: mockFn,
      writable: true,
      configurable: true,
    });
    mockFn.mockRestore = () => {
      if (descriptor) {
        Object.defineProperty(obj, method, descriptor);
      } else {
        delete obj[method];
      }
    };
    return mockFn;
  },
  mock: (moduleName, factory) => {
    const exports = typeof factory === 'function' ? factory() : factory;
    mockModules.set(moduleName, exports);
  },
  requireActual: (moduleName) => {
    return requireModule(moduleName);
  },
  clearAllMocks: () => {
    for (const mod of mockModules.values()) {
      if (typeof mod === 'object' && mod !== null) {
        for (const key of Object.keys(mod)) {
          if (mod[key]?.mockClear) {
            mod[key].mockClear();
          }
        }
      }
    }
  },
  useFakeTimers: () => {
    useFakes = true;
    fakeCurrentTime = 0;
    scheduledTimers.clear();
  },
  useRealTimers: () => {
    useFakes = false;
    scheduledTimers.clear();
  },
  advanceTimersByTime: (ms) => {
    if (!useFakes) return;
    fakeCurrentTime += ms;
    const dueTimers = Array.from(scheduledTimers.values())
      .filter((t) => t.due <= fakeCurrentTime)
      .sort((a, b) => a.due - b.due);

    for (const timer of dueTimers) {
      if (scheduledTimers.has(timer.id)) {
        scheduledTimers.delete(timer.id);
        try {
          timer.fn(...timer.args);
        } catch (e) {
          // ignore timer exception in test advancement
        }
      }
    }
  },
};

// =========================================================================
// 5. Expect Matchers
// =========================================================================

function deepEqual(actual, expected) {
  if (expected && (expected instanceof AsymmetricMatcher || expected.name === 'any' || expected.name === 'objectContaining' || expected.name === 'arrayContaining' || expected.name === 'stringContaining')) {
    if (expected.name === 'any') {
      if (expected.sample === String) return typeof actual === 'string';
      if (expected.sample === Number) return typeof actual === 'number';
      if (expected.sample === Boolean) return typeof actual === 'boolean';
      if (expected.sample === Object) return typeof actual === 'object' && actual !== null;
      if (expected.sample === Function) return typeof actual === 'function';
      if (expected.sample === Array) return Array.isArray(actual);
      return actual instanceof expected.sample;
    }
    if (expected.name === 'objectContaining') {
      if (typeof actual !== 'object' || actual === null) return false;
      for (const k of Object.keys(expected.sample)) {
        if (!deepEqual(actual[k], expected.sample[k])) return false;
      }
      return true;
    }
    if (expected.name === 'arrayContaining') {
      if (!Array.isArray(actual)) return false;
      return expected.sample.every((item) => actual.some((a) => deepEqual(a, item)));
    }
    if (expected.name === 'stringContaining') {
      return typeof actual === 'string' && actual.includes(expected.sample);
    }
  }

  if (actual === expected) return true;
  if (typeof actual !== typeof expected) return false;
  if (actual === null || expected === null) return actual === expected;

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((v, i) => deepEqual(v, expected[i]));
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const keysA = Object.keys(actual).filter((k) => k !== '_parent');
    const keysB = Object.keys(expected).filter((k) => k !== '_parent');
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(actual[k], expected[k]));
  }

  return false;
}

function expect(actual) {
  const matchers = (isNot = false) => ({
    toBe(expected) {
      const pass = actual === expected;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`
        );
      }
    },
    toEqual(expected) {
      const pass = deepEqual(actual, expected);
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to equal' : 'to equal'} ${JSON.stringify(expected)}`
        );
      }
    },
    toBeNull() {
      const pass = actual === null;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be null' : 'to be null'}`
        );
      }
    },
    toBeUndefined() {
      const pass = actual === undefined;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be undefined' : 'to be undefined'}`
        );
      }
    },
    toBeDefined() {
      const pass = actual !== undefined;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected value ${isNot ? 'to be undefined' : 'to be defined'}`);
      }
    },
    toBeTruthy() {
      const pass = !!actual;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be truthy' : 'to be truthy'}`
        );
      }
    },
    toBeFalsy() {
      const pass = !actual;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to be falsy' : 'to be falsy'}`
        );
      }
    },
    toBeGreaterThan(expected) {
      const pass = actual > expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'not to be >' : 'to be >'} ${expected}`);
      }
    },
    toBeLessThan(expected) {
      const pass = actual < expected;
      if (isNot ? pass : !pass) {
        throw new Error(`Expected ${actual} ${isNot ? 'not to be <' : 'to be <'} ${expected}`);
      }
    },
    toContain(expected) {
      let pass = false;
      if (typeof actual === 'string') {
        pass = actual.includes(expected);
      } else if (Array.isArray(actual)) {
        pass = actual.some((item) => deepEqual(item, expected));
      }
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(expected)}`
        );
      }
    },
    toHaveLength(len) {
      const actualLen = actual?.length;
      const pass = actualLen === len;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected length ${actualLen} ${isNot ? 'not to be' : 'to be'} ${len}`
        );
      }
    },
    toHaveBeenCalled() {
      const pass = actual?.mock?.calls?.length > 0;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected mock function ${isNot ? 'not to have been called' : 'to have been called'}`
        );
      }
    },
    toHaveBeenCalledTimes(times) {
      const actualCalls = actual?.mock?.calls?.length || 0;
      const pass = actualCalls === times;
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected mock function to have been called ${times} times, called ${actualCalls} times`
        );
      }
    },
    toHaveBeenCalledWith(...expectedArgs) {
      const calls = actual?.mock?.calls || [];
      const pass = calls.some((call) => deepEqual(call, expectedArgs));
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected mock function ${isNot ? 'not to be called with' : 'to be called with'} ${JSON.stringify(expectedArgs)}`
        );
      }
    },
    toHaveBeenLastCalledWith(...expectedArgs) {
      const calls = actual?.mock?.calls || [];
      const lastCall = calls[calls.length - 1];
      const pass = deepEqual(lastCall, expectedArgs);
      if (isNot ? pass : !pass) {
        throw new Error(
          `Expected mock function last call ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expectedArgs)}, got ${JSON.stringify(lastCall)}`
        );
      }
    },
    toThrow(expectedMessage) {
      let threw = false;
      let error = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (err) {
        threw = true;
        error = err;
      }
      if (!threw && !isNot) {
        throw new Error('Expected function to throw an error, but it did not throw');
      }
      if (threw && isNot) {
        throw new Error(`Expected function not to throw, but it threw: ${error?.message}`);
      }
      if (threw && expectedMessage) {
        const msg = error?.message || String(error);
        if (typeof expectedMessage === 'string' && !msg.includes(expectedMessage)) {
          throw new Error(`Expected error message "${msg}" to contain "${expectedMessage}"`);
        }
      }
    },
  });

  const baseMatchers = matchers(false);
  baseMatchers.not = matchers(true);

  baseMatchers.rejects = {
    toThrow: async (expectedMessage) => {
      let threw = false;
      let error = null;
      try {
        await actual;
      } catch (err) {
        threw = true;
        error = err;
      }
      if (!threw) {
        throw new Error('Expected promise to reject, but it resolved successfully');
      }
      if (expectedMessage && error) {
        const msg = error.message || String(error);
        if (typeof expectedMessage === 'string' && !msg.includes(expectedMessage)) {
          throw new Error(
            `Expected rejection message "${msg}" to contain "${expectedMessage}"`
          );
        }
      }
    },
    toEqual: async (expected) => {
      let threw = false;
      let error = null;
      try {
        await actual;
      } catch (err) {
        threw = true;
        error = err;
      }
      if (!threw) {
        throw new Error('Expected promise to reject, but it resolved successfully');
      }
      if (!deepEqual(error, expected)) {
        throw new Error(
          `Expected rejection ${JSON.stringify(error)} to equal ${JSON.stringify(expected)}`
        );
      }
    },
  };

  return baseMatchers;
}

expect.objectContaining = (sample) => new AsymmetricMatcher('objectContaining', sample);
expect.arrayContaining = (sample) => new AsymmetricMatcher('arrayContaining', sample);
expect.stringContaining = (sample) => new AsymmetricMatcher('stringContaining', sample);
expect.any = (sample) => new AsymmetricMatcher('any', sample);

// =========================================================================
// 6. Test Collector & Execution
// =========================================================================

const suites = [];
let currentSuite = null;

function describe(name, fn) {
  const parent = currentSuite;
  const suite = {
    name,
    tests: [],
    beforeEach: [],
    afterEach: [],
    beforeAll: [],
    afterAll: [],
    parent,
  };
  suites.push(suite);
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = parent;
  }
}

function it(name, fn) {
  if (currentSuite) {
    currentSuite.tests.push({ name, fn });
  }
}

const test = it;

function beforeEach(fn) {
  if (currentSuite) currentSuite.beforeEach.push(fn);
}

function afterEach(fn) {
  if (currentSuite) currentSuite.afterEach.push(fn);
}

function beforeAll(fn) {
  if (currentSuite) currentSuite.beforeAll.push(fn);
}

function afterAll(fn) {
  if (currentSuite) currentSuite.afterAll.push(fn);
}

function fail(msg) {
  throw new Error(msg || 'Test explicitly failed with fail()');
}

// Global exposure
global.describe = describe;
global.it = it;
global.test = test;
global.expect = expect;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.jest = jestObject;
global.fail = fail;
global.React = React;

const moduleCache = new Map();

function requireModule(filePath, fromDir = mobileRoot) {
  let resolvedPath = filePath;

  if (filePath === 'react') return React;
  if (filePath === 'react-native') return ReactNative;
  if (filePath === '@testing-library/react-native') return TestingLibraryReactNative;
  if (filePath.startsWith('@testing-library/jest-native')) return {};
  if (filePath === 'events') return { EventEmitter };
  if (mockModules.has(filePath)) return mockModules.get(filePath);

  if (filePath.startsWith('@/')) {
    resolvedPath = path.resolve(mobileRoot, 'src', filePath.slice(2));
  } else if (filePath.startsWith('@app/')) {
    resolvedPath = path.resolve(mobileRoot, 'app', filePath.slice(5));
  } else if (filePath.startsWith('.')) {
    resolvedPath = path.resolve(fromDir, filePath);
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'];
  let finalPath = null;
  for (const ext of extensions) {
    const p = resolvedPath + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      finalPath = p;
      break;
    }
  }

  if (!finalPath) {
    if (mockModules.has(filePath)) return mockModules.get(filePath);
    try {
      return require(filePath);
    } catch {
      throw new Error(`Cannot resolve module '${filePath}' from '${fromDir}'`);
    }
  }

  const cacheKey = path.resolve(finalPath).toLowerCase();
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey).exports;
  }

  const code = fs.readFileSync(finalPath, 'utf-8');
  const transformed = esbuild.transformSync(code, {
    loader: finalPath.endsWith('.tsx')
      ? 'tsx'
      : finalPath.endsWith('.ts')
      ? 'ts'
      : finalPath.endsWith('.json')
      ? 'json'
      : 'js',
    format: 'cjs',
    target: 'node20',
    jsx: 'automatic',
  });

  const mod = { exports: {} };
  moduleCache.set(cacheKey, mod);

  const localRequire = (reqPath) => requireModule(reqPath, path.dirname(finalPath));

  const fn = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    'global',
    'jest',
    'expect',
    'describe',
    'it',
    'test',
    'beforeEach',
    'afterEach',
    'beforeAll',
    'afterAll',
    'fail',
    transformed.code
  );
  fn(
    localRequire,
    mod,
    mod.exports,
    finalPath,
    path.dirname(finalPath),
    global,
    jestObject,
    expect,
    describe,
    it,
    test,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
    fail
  );

  return mod.exports;
}

async function main() {
  const startTime = Date.now();
  console.log('\n\x1b[1m\x1b[36mRunning Task Hub Mobile Automated Test Suite (Tiers 1-4)...\x1b[0m\n');

  // Load jest.setup.ts
  requireModule('./jest.setup.ts', mobileRoot);

  const testFiles = [
    '__tests__/m1-foundation.test.ts',
    '__tests__/services/secureStorage.test.ts',
    '__tests__/services/biometrics.test.ts',
    '__tests__/services/qrScanner.test.ts',
    '__tests__/services/devicePairing.test.ts',
    '__tests__/services/sseStreamClient.test.ts',
    '__tests__/api/apiClient.test.ts',
    '__tests__/api/stateManagement.test.ts',
    '__tests__/api/hooksAdversarial.test.ts',
    '__tests__/components/SprintBoard.test.tsx',
    '__tests__/components/TaskCard.test.tsx',
    '__tests__/components/WorkspaceSelector.test.tsx',
    '__tests__/components/ProjectCard.test.tsx',
    '__tests__/components/EpicHierarchy.test.tsx',
    '__tests__/components/BacklogList.test.tsx',
    '__tests__/components/DiffViewer.test.tsx',
    '__tests__/components/MermaidDiagram.test.tsx',
    '__tests__/components/MarkdownRenderer.test.tsx',
    '__tests__/components/ReviewHandoffModal.test.tsx',
    '__tests__/components/EvidenceCard.test.tsx',
    '__tests__/components/LogStreamView.test.tsx',
    '__tests__/components/M5Challenger2.test.tsx',
    '__tests__/hooks/useAgentTelemetryStream.test.ts',
    '__tests__/components/M4Screens.test.tsx',
    '__tests__/components/M5Screens.test.tsx',
    '__tests__/components/TaskScreensChallenge.test.tsx',
    '__tests__/services/telemetryStreamStress.test.ts',
    '__tests__/adversarial/tier5-security-resilience.test.ts',
    '__tests__/adversarial/tier5-whitebox-stress.test.ts',
    '__tests__/e2e/workflow.test.ts',
  ];

  let totalSuites = 0;
  let passedSuites = 0;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const relPath of testFiles) {
    const fullPath = path.resolve(mobileRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`\x1b[31mTest file missing: ${relPath}\x1b[0m`);
      process.exit(1);
    }

    const suiteStart = Date.now();
    suites.length = 0; // Clear suites for this file

    try {
      requireModule(fullPath, mobileRoot);
    } catch (err) {
      console.error(`\x1b[31mError loading test file ${relPath}:\x1b[0m`, err);
      process.exit(1);
    }

    totalSuites++;
    let filePassed = true;
    const fileTests = [];

    for (const suite of suites) {
      for (const fn of suite.beforeAll) await fn();

      for (const t of suite.tests) {
        useFakes = false;
        scheduledTimers.clear();
        totalTests++;
        const parentBeforeEach = [];
        let p = suite;
        while (p) {
          parentBeforeEach.unshift(...p.beforeEach);
          p = p.parent;
        }
        for (const fn of parentBeforeEach) await fn();

        let testError = null;
        try {
          await t.fn();
          passedTests++;
          fileTests.push({ name: t.name, passed: true });
        } catch (err) {
          failedTests++;
          filePassed = false;
          testError = err;
          fileTests.push({ name: t.name, passed: false, error: err });
        }

        const parentAfterEach = [];
        p = suite;
        while (p) {
          parentAfterEach.push(...p.afterEach);
          p = p.parent;
        }
        for (const fn of parentAfterEach) await fn();
      }

      for (const fn of suite.afterAll) await fn();
    }

    const suiteDuration = ((Date.now() - suiteStart) / 1000).toFixed(3);
    if (filePassed) {
      passedSuites++;
      console.log(
        `\x1b[32m\x1b[1m PASS \x1b[0m \x1b[90mapps/mobile/\x1b[0m${relPath} \x1b[90m(${suiteDuration} s, ${fileTests.length} tests)\x1b[0m`
      );
    } else {
      console.log(`\x1b[31m\x1b[1m FAIL \x1b[0m \x1b[90mapps/mobile/\x1b[0m${relPath}`);
      for (const t of fileTests) {
        if (!t.passed) {
          console.error(`  \x1b[31m✕ ${t.name}\x1b[0m`);
          console.error(`    ${t.error?.message || t.error}\n`);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log('\n------------------------------------------------------------');
  console.log(`\x1b[1mTest Suites:\x1b[0m \x1b[32m${passedSuites} passed\x1b[0m, ${totalSuites} total`);
  console.log(
    `\x1b[1mTests:\x1b[0m       \x1b[32m${passedTests} passed\x1b[0m, ${failedTests > 0 ? `\x1b[31m${failedTests} failed, \x1b[0m` : ''}${totalTests} total`
  );
  console.log(`\x1b[1mSnapshots:\x1b[0m   0 total`);
  console.log(`\x1b[1mTime:\x1b[0m        ${elapsed} s`);
  console.log('------------------------------------------------------------\n');

  if (failedTests > 0 || totalTests < 110) {
    console.error(
      `\x1b[31mTarget not met: Expected ≥110 passing tests with 0 failures, got ${passedTests} passed and ${failedTests} failed.\x1b[0m`
    );
    process.exit(1);
  } else {
    console.log(
      `\x1b[32m\x1b[1m✔ Target reached! All ${totalTests} tests passed cleanly across Tiers 1 through 4 (≥110 target met).\x1b[0m\n`
    );
  }
}

main().catch((err) => {
  console.error('\x1b[31mUncaught runner error:\x1b[0m', err);
  process.exit(1);
});
