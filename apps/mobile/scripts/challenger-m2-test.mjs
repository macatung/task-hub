import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');

// Setup in-memory mock environment
const secureStoreMap = new Map();
const mockSecureStore = {
  setItemAsync: async (key, val) => { secureStoreMap.set(key, String(val)); },
  getItemAsync: async (key) => secureStoreMap.has(key) ? secureStoreMap.get(key) : null,
  deleteItemAsync: async (key) => { secureStoreMap.delete(key); },
  isAvailableAsync: async () => true,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  __reset: () => secureStoreMap.clear(),
  __getStore: () => new Map(secureStoreMap),
};

let mockHardwareAvailable = true;
let mockEnrolled = true;
let mockAuthTypes = [1, 2];
let mockAuthResult = { success: true };
let authenticateAsyncCalls = [];

const mockLocalAuth = {
  hasHardwareAsync: async () => {
    if (typeof mockHardwareAvailable === 'function') return mockHardwareAvailable();
    return mockHardwareAvailable;
  },
  isEnrolledAsync: async () => {
    if (typeof mockEnrolled === 'function') return mockEnrolled();
    return mockEnrolled;
  },
  supportedAuthenticationTypesAsync: async () => {
    if (typeof mockAuthTypes === 'function') return mockAuthTypes();
    return mockAuthTypes;
  },
  authenticateAsync: async (options) => {
    authenticateAsyncCalls.push(options);
    if (typeof mockAuthResult === 'function') return mockAuthResult(options);
    return mockAuthResult;
  },
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
  __reset: () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthTypes = [1, 2];
    mockAuthResult = { success: true };
    authenticateAsyncCalls = [];
  },
};

const moduleCache = new Map();

function customRequire(modulePath, fromDir = mobileRoot) {
  if (modulePath === 'expo-secure-store') return mockSecureStore;
  if (modulePath === 'expo-local-authentication') return mockLocalAuth;
  if (modulePath === '@/services/secureStorage') {
    return loadFile(path.resolve(mobileRoot, 'src/services/secureStorage.ts'));
  }
  if (modulePath === '@/services/biometrics') {
    return loadFile(path.resolve(mobileRoot, 'src/services/biometrics.ts'));
  }
  if (modulePath === '@/services/devicePairing') {
    return loadFile(path.resolve(mobileRoot, 'src/services/devicePairing.ts'));
  }
  if (modulePath === '@/config/env') {
    return loadFile(path.resolve(mobileRoot, 'src/config/env.ts'));
  }
  if (modulePath === '@/api/types') {
    return loadFile(path.resolve(mobileRoot, 'src/api/types.ts'));
  }
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    const full = path.resolve(fromDir, modulePath);
    return loadFile(full);
  }
  try {
    return require(modulePath);
  } catch (e) {
    throw new Error('Cannot resolve ' + modulePath + ': ' + e.message);
  }
}

function loadFile(filePath) {
  const extensions = ['', '.ts', '.tsx', '.js', '.json'];
  let resolved = null;
  for (const ext of extensions) {
    if (fs.existsSync(filePath + ext) && fs.statSync(filePath + ext).isFile()) {
      resolved = filePath + ext;
      break;
    }
  }
  if (!resolved) throw new Error('File not found: ' + filePath);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

  const code = fs.readFileSync(resolved, 'utf-8');
  const transformed = esbuild.transformSync(code, {
    loader: resolved.endsWith('.ts') ? 'ts' : resolved.endsWith('.tsx') ? 'tsx' : 'js',
    format: 'cjs',
    target: 'node20',
  });

  const mod = { exports: {} };
  moduleCache.set(resolved, mod);
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', transformed.code);
  fn((p) => customRequire(p, path.dirname(resolved)), mod, mod.exports, resolved, path.dirname(resolved));
  return mod.exports;
}

// Load services
const { BiometricsService } = customRequire('@/services/biometrics');
const { DevicePairingService } = customRequire('@/services/devicePairing');
const { SecureStorageService } = customRequire('@/services/secureStorage');

let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function test(name, fn) {
  try {
    mockSecureStore.__reset();
    mockLocalAuth.__reset();
    await fn();
    passedTests++;
    results.push({ name, pass: true });
    console.log('\x1b[32m✔ PASS\x1b[0m ' + name);
  } catch (err) {
    failedTests++;
    results.push({ name, pass: false, error: err.message });
    console.error('\x1b[31m✖ FAIL\x1b[0m ' + name);
    console.error('    ' + (err.stack || err.message));
  }
}

async function runAllEmpiricalChallenges() {
  console.log('\n======================================================');
  console.log('CHALLENGER 2: EMPIRICAL STRESS TEST SUITE (M2)');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // Group 1: BiometricsService Challenges
  // -------------------------------------------------------------------------
  console.log('\n--- Group 1: BiometricsService Challenges ---');

  await test('Biometrics: isHardwareAvailable returns false when hardware is missing', async () => {
    mockHardwareAvailable = false;
    const avail = await BiometricsService.isHardwareAvailable();
    assert(avail === false, 'Expected false, got ' + avail);
  });

  await test('Biometrics: isHardwareAvailable catches throws and returns false', async () => {
    mockHardwareAvailable = () => { throw new Error('Hardware probe crashed'); };
    const avail = await BiometricsService.isHardwareAvailable();
    assert(avail === false, 'Expected false on throw, got ' + avail);
  });

  await test('Biometrics: isEnrolled returns false when hardware is missing without calling isEnrolledAsync', async () => {
    mockHardwareAvailable = false;
    let enrolledCalled = false;
    mockEnrolled = () => { enrolledCalled = true; return true; };
    const enrolled = await BiometricsService.isEnrolled();
    assert(enrolled === false, 'Expected false, got ' + enrolled);
    assert(enrolledCalled === false, 'isEnrolledAsync should NOT be called when hardware is missing');
  });

  await test('Biometrics: isEnrolled catches throws and returns false', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = () => { throw new Error('Enrollment probe crashed'); };
    const enrolled = await BiometricsService.isEnrolled();
    assert(enrolled === false, 'Expected false on throw, got ' + enrolled);
  });

  await test('Biometrics: getBiometryName resolves FaceID, TouchID, Iris, Biometrics, and None', async () => {
    mockAuthTypes = [2]; // FACIAL_RECOGNITION
    assert(await BiometricsService.getBiometryName() === 'FaceID', 'Expected FaceID');

    mockAuthTypes = [1]; // FINGERPRINT
    assert(await BiometricsService.getBiometryName() === 'TouchID', 'Expected TouchID');

    mockAuthTypes = [3]; // IRIS
    assert(await BiometricsService.getBiometryName() === 'Iris', 'Expected Iris');

    mockAuthTypes = [99]; // Unknown type
    assert(await BiometricsService.getBiometryName() === 'Biometrics', 'Expected Biometrics');

    mockAuthTypes = []; // Empty
    assert(await BiometricsService.getBiometryName() === 'None', 'Expected None');

    mockAuthTypes = () => { throw new Error('Types crashed'); };
    assert(await BiometricsService.getBiometryName() === 'None', 'Expected None on throw');
  });

  await test('Biometrics: authenticate fails with BIOMETRIC_HARDWARE_UNAVAILABLE when hardware is false', async () => {
    mockHardwareAvailable = false;
    const res = await BiometricsService.authenticate('Prompt');
    assert(res.success === false, 'Expected success === false');
    assert(res.error === 'BIOMETRIC_HARDWARE_UNAVAILABLE', 'Expected BIOMETRIC_HARDWARE_UNAVAILABLE, got ' + res.error);
  });

  await test('Biometrics: authenticate fails with BIOMETRIC_NOT_ENROLLED when not enrolled', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = false;
    const res = await BiometricsService.authenticate('Prompt');
    assert(res.success === false, 'Expected success === false');
    assert(res.error === 'BIOMETRIC_NOT_ENROLLED', 'Expected BIOMETRIC_NOT_ENROLLED, got ' + res.error);
  });

  await test('Biometrics: authenticate handles user cancellation and defaults to USER_CANCELLED if error omitted', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthResult = { success: false, error: 'user_cancel' };
    const res1 = await BiometricsService.authenticate('Prompt');
    assert(res1.success === false && res1.error === 'user_cancel', 'Expected user_cancel, got ' + res1.error);

    mockAuthResult = { success: false }; // No error field provided
    const res2 = await BiometricsService.authenticate('Prompt');
    assert(res2.success === false && res2.error === 'USER_CANCELLED', 'Expected USER_CANCELLED, got ' + res2.error);
  });

  await test('Biometrics: authenticate catches native rejection exception', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthResult = () => { throw new Error('Sensor hardware error'); };
    const res = await BiometricsService.authenticate('Prompt');
    assert(res.success === false, 'Expected success === false');
    assert(res.error === 'Sensor hardware error', 'Expected "Sensor hardware error", got ' + res.error);
  });

  await test('Biometrics: guardSensitiveAction executes action when authenticated', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthResult = { success: true };
    let actionExecuted = false;
    const result = await BiometricsService.guardSensitiveAction(async () => {
      actionExecuted = true;
      return { approved: true, id: 42 };
    }, 'Sensitive Action');

    assert(actionExecuted === true, 'Action should have been executed');
    assert(result.approved === true && result.id === 42, 'Expected action return value');
  });

  await test('Biometrics: guardSensitiveAction throws and NEVER executes action on auth failure', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthResult = { success: false, error: 'user_fallback' };
    let actionExecuted = false;

    let threw = false;
    try {
      await BiometricsService.guardSensitiveAction(async () => {
        actionExecuted = true;
        return 'MUST_NOT_RETURN';
      }, 'Sensitive Action');
    } catch (err) {
      threw = true;
      assert(err.message.includes('user_fallback'), 'Expected error to contain user_fallback, got: ' + err.message);
    }

    assert(threw === true, 'guardSensitiveAction should have thrown');
    assert(actionExecuted === false, 'Action MUST NOT have executed');
  });

  await test('Biometrics: guardSensitiveAction propagates exceptions thrown from action itself', async () => {
    mockHardwareAvailable = true;
    mockEnrolled = true;
    mockAuthResult = { success: true };

    let threw = false;
    try {
      await BiometricsService.guardSensitiveAction(async () => {
        throw new Error('Action internal failure');
      }, 'Sensitive Action');
    } catch (err) {
      threw = true;
      assert(err.message === 'Action internal failure', 'Expected Action internal failure, got: ' + err.message);
    }
    assert(threw === true, 'Expected throw from action');
  });

  // -------------------------------------------------------------------------
  // Group 2: DevicePairingService Challenges
  // -------------------------------------------------------------------------
  console.log('\n--- Group 2: DevicePairingService Challenges ---');

  const originalFetch = global.fetch;

  await test('DevicePairing: startPairing constructs correct URL, method, headers and body', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          pairing_id: 'pair-777',
          device_secret: 'sec_12345678901234567890',
          code: '999-000',
          expires_at: '2026-08-25T20:00:00Z',
          approval_url: 'http://localhost:8000/desktop/pairing/pair-777/approve',
        }),
      };
    };

    const res = await DevicePairingService.startPairing('http://localhost:8000/', 123);
    assert(capturedUrl === 'http://localhost:8000/api/v1/desktop/pairing/start', 'URL mismatch: ' + capturedUrl);
    assert(capturedOptions.method === 'POST', 'Expected method POST');
    assert(capturedOptions.headers['Content-Type'] === 'application/json', 'Expected Content-Type application/json');
    assert(JSON.parse(capturedOptions.body).project_id === 123, 'Expected project_id === 123 in body');
    assert(res.pairing_id === 'pair-777', 'Expected pairing_id pair-777');
    assert(res.code === '999-000', 'Expected code 999-000');
  });

  await test('DevicePairing: startPairing throws descriptive error on non-ok HTTP status', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Database server down',
    });

    let threw = false;
    try {
      await DevicePairingService.startPairing('http://localhost:8000');
    } catch (err) {
      threw = true;
      assert(err.message.includes('Failed to start pairing (500): Database server down'), 'Got: ' + err.message);
    }
    assert(threw, 'startPairing should have thrown on 500');
  });

  await test('DevicePairing: checkPairingStatus sends X-Desktop-Pairing-Secret and returns data on 200', async () => {
    let capturedHeaders = null;
    let capturedUrl = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: 'pending',
        }),
      };
    };

    const res = await DevicePairingService.checkPairingStatus('http://localhost:8000', 'pair/123 with spaces', 'my_secret_token');
    assert(capturedUrl === 'http://localhost:8000/api/v1/desktop/pairing/pair%2F123%20with%20spaces/status', 'URL encoding check failed: ' + capturedUrl);
    assert(capturedHeaders['X-Desktop-Pairing-Secret'] === 'my_secret_token', 'Secret header missing or incorrect');
    assert(res.status === 'pending', 'Expected status pending');
  });

  await test('DevicePairing: checkPairingStatus returns status: denied on HTTP 401', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    const res = await DevicePairingService.checkPairingStatus('http://localhost:8000', 'pair-123', 'wrong_secret');
    assert(res.success === false, 'Expected success: false');
    assert(res.status === 'denied', 'Expected status: denied, got ' + res.status);
    assert(res.message.includes('Invalid pairing secret'), 'Message unexpected: ' + res.message);
  });

  await test('DevicePairing: checkPairingStatus throws on other error status (e.g. 503)', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });

    let threw = false;
    try {
      await DevicePairingService.checkPairingStatus('http://localhost:8000', 'pair-123', 'secret');
    } catch (err) {
      threw = true;
      assert(err.message.includes('Status check failed (503): Service Unavailable'), 'Got: ' + err.message);
    }
    assert(threw, 'checkPairingStatus should have thrown on 503');
  });

  await test('DevicePairing: pollPairingStatus polls until approved and invokes onStatusChange', async () => {
    let callCount = 0;
    const observedStatuses = [];

    global.fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, status: 'pending' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: 'approved',
          mcp_token: 'auth_token_xyz_123',
          workspace_id: 5,
        }),
      };
    };

    const res = await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
      intervalMs: 1,
      maxAttempts: 10,
      onStatusChange: (s) => observedStatuses.push(s),
    });

    assert(callCount === 3, 'Expected 3 calls, got ' + callCount);
    assert(observedStatuses.length === 3, 'Expected 3 status callbacks, got ' + observedStatuses.length);
    assert(observedStatuses[0] === 'pending' && observedStatuses[1] === 'pending' && observedStatuses[2] === 'approved', 'Statuses callback sequence mismatch');
    assert(res.status === 'approved', 'Expected approved status');
    assert(res.mcp_token === 'auth_token_xyz_123', 'Expected mcp_token');
  });

  await test('DevicePairing: pollPairingStatus handles expired/denied/rejected terminal statuses', async () => {
    for (const termStatus of ['expired', 'denied', 'rejected']) {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: false, status: termStatus }),
      });

      const res = await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
        intervalMs: 1,
        maxAttempts: 5,
      });
      assert(res.status === termStatus, 'Expected terminal status ' + termStatus + ', got ' + res.status);
    }
  });

  await test('DevicePairing: pollPairingStatus throws when session status is consumed', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, status: 'consumed' }),
    });

    let threw = false;
    try {
      await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
        intervalMs: 1,
        maxAttempts: 5,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('already consumed by another client'), 'Got: ' + err.message);
    }
    assert(threw, 'Expected throw on consumed');
  });

  await test('DevicePairing: pollPairingStatus throws on timeout when maxAttempts exceeded', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: 'pending' }),
    });

    let threw = false;
    try {
      await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
        intervalMs: 1,
        maxAttempts: 3,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('Pairing timed out waiting for approval'), 'Got: ' + err.message);
    }
    assert(threw, 'Expected throw on timeout');
  });

  await test('DevicePairing: pollPairingStatus respects AbortSignal (pre-aborted and during polling)', async () => {
    const controller1 = new AbortController();
    controller1.abort();

    let threw1 = false;
    try {
      await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
        intervalMs: 1,
        maxAttempts: 5,
        signal: controller1.signal,
      });
    } catch (err) {
      threw1 = true;
      assert(err.message.includes('Pairing status polling aborted'), 'Got: ' + err.message);
    }
    assert(threw1, 'Expected throw when signal pre-aborted');

    // Abort after 1st poll
    const controller2 = new AbortController();
    let pollCount = 0;
    global.fetch = async () => {
      pollCount++;
      controller2.abort();
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'pending' }),
      };
    };

    let threw2 = false;
    try {
      await DevicePairingService.pollPairingStatus('http://localhost:8000', 'pair-123', 'secret', {
        intervalMs: 5,
        maxAttempts: 5,
        signal: controller2.signal,
      });
    } catch (err) {
      threw2 = true;
      assert(err.message.includes('Pairing status polling aborted'), 'Got: ' + err.message);
    }
    assert(threw2, 'Expected throw when aborted during polling');
  });

  await test('DevicePairing: completePairing persists token and session config in SecureStorage (approved payload)', async () => {
    mockSecureStore.__reset();

    const payload = {
      success: true,
      status: 'approved',
      mcp_token: 'auth_jwt_token_secret_998877',
      task_hub_url: 'http://hub.example.com/',
      workspace_id: 42,
      workspace_name: 'Product Development',
      project_id: 101,
      project_title: 'Mobile Companion',
      user_email: 'tester@taskhub.dev',
      user_name: 'Lead Tester',
    };

    const session = await DevicePairingService.completePairing(payload);

    assert(session.token === 'auth_jwt_token_secret_998877', 'Token mismatch');
    assert(session.apiUrl === 'http://hub.example.com', 'Normalized URL mismatch');
    assert(session.workspaceId === 42, 'Workspace ID mismatch');
    assert(session.projectId === 101, 'Project ID mismatch');

    // Verify empirical persistence in hardware SecureStorage
    const storedToken = await SecureStorageService.getToken();
    assert(storedToken === 'auth_jwt_token_secret_998877', 'Stored token mismatch: ' + storedToken);

    const storedApiUrl = await SecureStorageService.getConfig('api_url');
    assert(storedApiUrl === 'http://hub.example.com', 'Stored api_url mismatch: ' + storedApiUrl);

    const storedWsId = await SecureStorageService.getConfig('workspace_id');
    assert(storedWsId === '42', 'Stored workspace_id mismatch: ' + storedWsId);

    const storedWsName = await SecureStorageService.getConfig('workspace_name');
    assert(storedWsName === 'Product Development', 'Stored workspace_name mismatch: ' + storedWsName);

    const storedProjId = await SecureStorageService.getConfig('project_id');
    assert(storedProjId === '101', 'Stored project_id mismatch: ' + storedProjId);

    const storedProjTitle = await SecureStorageService.getConfig('project_title');
    assert(storedProjTitle === 'Mobile Companion', 'Stored project_title mismatch: ' + storedProjTitle);

    const storedUserEmail = await SecureStorageService.getConfig('user_email');
    assert(storedUserEmail === 'tester@taskhub.dev', 'Stored user_email mismatch: ' + storedUserEmail);

    const storedUserName = await SecureStorageService.getConfig('user_name');
    assert(storedUserName === 'Lead Tester', 'Stored user_name mismatch: ' + storedUserName);
  });

  await test('DevicePairing: completePairing persists QR Pairing payload correctly', async () => {
    mockSecureStore.__reset();

    const qrPayload = {
      type: 'taskhub_pairing',
      version: 1,
      pairing_id: 'pair-qr-123',
      device_secret: 'sec_12345678901234567890',
      token: 'direct_token_qr_abc_123',
      task_hub_url: 'http://192.168.1.50:8000',
      workspace_id: 7,
    };

    const session = await DevicePairingService.completePairing(qrPayload);
    assert(session.token === 'direct_token_qr_abc_123', 'Expected token');
    assert(session.apiUrl === 'http://192.168.1.50:8000', 'Expected URL');
    assert(session.workspaceId === 7, 'Expected workspaceId');

    const storedToken = await SecureStorageService.getToken();
    assert(storedToken === 'direct_token_qr_abc_123', 'Stored token mismatch: ' + storedToken);
  });

  await test('DevicePairing: completePairing throws when token is missing', async () => {
    let threw = false;
    try {
      await DevicePairingService.completePairing({
        success: true,
        status: 'approved',
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('No authentication token available to complete pairing'), 'Got: ' + err.message);
    }
    assert(threw, 'completePairing should throw when token is missing');
  });

  global.fetch = originalFetch;

  console.log('\n======================================================');
  console.log('TEST SUMMARY: ' + passedTests + ' passed, ' + failedTests + ' failed, ' + (passedTests + failedTests) + ' total');
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllEmpiricalChallenges().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
