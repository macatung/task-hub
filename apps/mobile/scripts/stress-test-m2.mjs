import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Mock SecureStore
const store = new Map();
const secureOptionsLog = [];
const mockSecureStore = {
  setItemAsync: async (k, v, opt) => {
    secureOptionsLog.push({ action: 'setItem', key: k, opt });
    store.set(k, String(v));
  },
  getItemAsync: async (k, opt) => {
    secureOptionsLog.push({ action: 'getItem', key: k, opt });
    return store.has(k) ? store.get(k) : null;
  },
  deleteItemAsync: async (k, opt) => {
    secureOptionsLog.push({ action: 'deleteItem', key: k, opt });
    store.delete(k);
  },
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
};

// Loader
function loadModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const transformed = esbuild.transformSync(code, { loader: 'ts', format: 'cjs', target: 'node20' });
  const mod = { exports: {} };
  const customRequire = (name) => {
    if (name === 'expo-secure-store') return mockSecureStore;
    if (name === 'zod') return require('zod');
    if (name === '@/api/types') return {};
    return require(name);
  };
  const fn = new Function('require', 'module', 'exports', transformed.code);
  fn(customRequire, mod, mod.exports);
  return mod.exports;
}

const qrMod = loadModule(path.join(mobileRoot, 'src/services/qrScanner.ts'));
const secMod = loadModule(path.join(mobileRoot, 'src/services/secureStorage.ts'));

const QRScannerService = qrMod.QRScannerService;
const SecureStorageService = secMod.SecureStorageService;

const results = [];
function testCase(category, name, fn) {
  try {
    fn();
    results.push({ category, name, pass: true });
  } catch (err) {
    results.push({ category, name, pass: false, error: err.message });
  }
}

async function runAsyncTestCase(category, name, fn) {
  try {
    await fn();
    results.push({ category, name, pass: true });
  } catch (err) {
    results.push({ category, name, pass: false, error: err.message });
  }
}

// -------------------------------------------------------------
// 1. QR SCANNER ADVERSARIAL CHALLENGES
// -------------------------------------------------------------

// Corrupted JSON & Malformed Payloads
testCase('QRScanner', 'Corrupted JSON - trailing comma', () => {
  const res = QRScannerService.parseAndValidateQrPayload('{"type":"taskhub_pairing",}');
  if (res.success || res.error !== 'Malformed JSON payload in QR code') throw new Error('Expected Malformed JSON error, got: ' + JSON.stringify(res));
});

testCase('QRScanner', 'Corrupted JSON - unclosed bracket', () => {
  const res = QRScannerService.parseAndValidateQrPayload('{"type":"taskhub_pairing"');
  if (res.success || res.error !== 'Malformed JSON payload in QR code') throw new Error('Expected Malformed JSON error');
});

testCase('QRScanner', 'Corrupted JSON - empty string', () => {
  const res = QRScannerService.parseAndValidateQrPayload('');
  if (res.success || res.error !== 'Empty or invalid QR code data') throw new Error('Expected empty data error');
});

testCase('QRScanner', 'Corrupted JSON - whitespace only', () => {
  const res = QRScannerService.parseAndValidateQrPayload('   \n\t  ');
  if (res.success || res.error !== 'Empty or invalid QR code data') throw new Error('Expected empty data error');
});

testCase('QRScanner', 'Corrupted JSON - primitive number', () => {
  const res = QRScannerService.parseAndValidateQrPayload('12345');
  if (res.success || res.error !== 'QR payload must be a JSON object') throw new Error('Expected JSON object error');
});

testCase('QRScanner', 'Corrupted JSON - primitive boolean', () => {
  const res = QRScannerService.parseAndValidateQrPayload('true');
  if (res.success || res.error !== 'QR payload must be a JSON object') throw new Error('Expected JSON object error');
});

testCase('QRScanner', 'Corrupted JSON - JSON null literal', () => {
  const res = QRScannerService.parseAndValidateQrPayload('null');
  if (res.success || res.error !== 'QR payload must be a JSON object') throw new Error('Expected JSON object error');
});

// Missing Fields
testCase('QRScanner', 'Missing fields - missing type', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || !res.error.includes('Invalid payload type')) throw new Error('Expected invalid payload type error');
});

testCase('QRScanner', 'Missing fields - missing version', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || !res.error.includes('Unsupported payload version')) throw new Error('Expected unsupported version error');
});

testCase('QRScanner', 'Missing fields - missing task_hub_url', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'Missing or invalid task_hub_url') throw new Error('Expected missing task_hub_url error');
});

testCase('QRScanner', 'Missing fields - missing pairing_id', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'Missing or invalid pairing_id') throw new Error('Expected missing pairing_id error');
});

testCase('QRScanner', 'Missing fields - empty pairing_id', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: '   ',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'Missing or invalid pairing_id') throw new Error('Expected missing pairing_id error');
});

testCase('QRScanner', 'Missing fields - missing device_secret', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1'
  }));
  if (res.success || !res.error.includes('Missing or insecure device_secret')) throw new Error('Expected missing device_secret error');
});

// Device Secret Constraints (< 16 characters)
testCase('QRScanner', 'Secret length - 0 chars', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: ''
  }));
  if (res.success || !res.error.includes('must be at least 16 characters')) throw new Error('Expected secret length error');
});

testCase('QRScanner', 'Secret length - 15 chars (boundary)', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: '123456789012345'
  }));
  if (res.success || !res.error.includes('must be at least 16 characters')) throw new Error('Expected secret length error');
});

testCase('QRScanner', 'Secret length - exactly 16 chars (boundary)', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (!res.success || res.payload.device_secret !== '1234567890123456') throw new Error('Expected success for 16 chars secret');
});

testCase('QRScanner', 'Secret length - padded whitespace 15 chars', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p1',
    device_secret: '  1234567890123  '
  }));
  if (res.success) throw new Error('Expected rejection for trimmed secret < 16 chars');
});

// URL Protocol Validation
testCase('QRScanner', 'Invalid protocol - ftp://', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'ftp://ftp.example.com/api',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'task_hub_url must be a valid HTTP or HTTPS URL') throw new Error('Expected URL protocol error');
});

testCase('QRScanner', 'Invalid protocol - javascript:', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'javascript:alert(document.cookie)',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'task_hub_url must be a valid HTTP or HTTPS URL') throw new Error('Expected URL protocol error');
});

testCase('QRScanner', 'Invalid protocol - data:', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'task_hub_url must be a valid HTTP or HTTPS URL') throw new Error('Expected URL protocol error');
});

testCase('QRScanner', 'Invalid protocol - file://', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'file:///etc/passwd',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'task_hub_url must be a valid HTTP or HTTPS URL') throw new Error('Expected URL protocol error');
});

testCase('QRScanner', 'Invalid protocol - ws://', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'ws://stream.taskhub.dev',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (res.success || res.error !== 'task_hub_url must be a valid HTTP or HTTPS URL') throw new Error('Expected URL protocol error');
});

testCase('QRScanner', 'Valid protocol - http:// with custom port', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'http://192.168.1.100:8000',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (!res.success || res.payload.task_hub_url !== 'http://192.168.1.100:8000') throw new Error('Expected success for http:// with port');
});

testCase('QRScanner', 'Valid protocol - https:// with subpaths and trailing slashes stripped', () => {
  const res = QRScannerService.parseAndValidateQrPayload(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.example.com:8443/custom/hub/root///',
    pairing_id: 'p1',
    device_secret: '1234567890123456'
  }));
  if (!res.success || res.payload.task_hub_url !== 'https://hub.example.com:8443/custom/hub/root') throw new Error('Expected stripped trailing slashes');
});

// Deep Links
testCase('QRScanner', 'Deep link - missing query string (taskhub://pair)', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pair');
  if (res.success || res.error !== 'Deep link missing query parameters') throw new Error('Expected missing query params error');
});

testCase('QRScanner', 'Deep link - missing query string (taskhub://pairing)', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pairing');
  if (res.success || res.error !== 'Deep link missing query parameters') throw new Error('Expected missing query params error');
});

testCase('QRScanner', 'Deep link - empty query string (taskhub://pair?)', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pair?');
  if (res.success || res.error !== 'Missing or invalid task_hub_url') throw new Error('Expected error for empty query params in deep link');
});

testCase('QRScanner', 'Deep link - missing secret parameter', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pair?task_hub_url=https://hub.dev&pairing_id=p-123');
  if (res.success || !res.error.includes('Missing or insecure device_secret')) throw new Error('Expected missing secret error');
});

testCase('QRScanner', 'Deep link - valid query parameters', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pair?task_hub_url=https://hub.dev&pairing_id=p-abc&device_secret=1234567890123456&code=123-456&workspace_id=2');
  if (!res.success) throw new Error('Expected valid deep link parse, got: ' + JSON.stringify(res));
  if (res.payload.task_hub_url !== 'https://hub.dev' || res.payload.pairing_id !== 'p-abc' || res.payload.code !== '123-456' || res.payload.workspace_id !== 2) {
    throw new Error('Mismatched payload fields: ' + JSON.stringify(res.payload));
  }
});

testCase('QRScanner', 'Deep link - valid with parameter aliases (url, id, secret)', () => {
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pairing?url=https://hub.dev&id=p-abc&secret=1234567890123456');
  if (!res.success || res.payload.task_hub_url !== 'https://hub.dev' || res.payload.pairing_id !== 'p-abc') {
    throw new Error('Expected valid deep link alias parse');
  }
});

testCase('QRScanner', 'Deep link - encoded data payload', () => {
  const data = encodeURIComponent(JSON.stringify({
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://hub.dev',
    pairing_id: 'p-encoded',
    device_secret: '1234567890123456'
  }));
  const res = QRScannerService.parseAndValidateQrPayload('taskhub://pair?data=' + data);
  if (!res.success || res.payload.pairing_id !== 'p-encoded') {
    throw new Error('Expected valid encoded data payload in deep link');
  }
});

// Web Approval URLs
testCase('QRScanner', 'Web approval URL - valid format', () => {
  const res = QRScannerService.parseAndValidateQrPayload('https://hub.example.com/desktop/pairing/pair-uuid-1234/approve?code=789-012&secret=1234567890123456');
  if (!res.success || res.payload.task_hub_url !== 'https://hub.example.com' || res.payload.pairing_id !== 'pair-uuid-1234' || res.payload.device_secret !== '1234567890123456' || res.payload.code !== '789-012') {
    throw new Error('Expected valid approval URL parse, got: ' + JSON.stringify(res));
  }
});

testCase('QRScanner', 'Web approval URL - short secret (<16 chars)', () => {
  const res = QRScannerService.parseAndValidateQrPayload('https://hub.example.com/desktop/pairing/pair-uuid-1234/approve?secret=short_sec');
  if (res.success || !res.error.includes('minimum 16 characters')) {
    throw new Error('Expected short secret rejection on approval URL');
  }
});

testCase('QRScanner', 'Web approval URL - missing secret', () => {
  const res = QRScannerService.parseAndValidateQrPayload('https://hub.example.com/desktop/pairing/pair-uuid-1234/approve?code=123-456');
  if (res.success || !res.error.includes('minimum 16 characters')) {
    throw new Error('Expected missing secret rejection on approval URL');
  }
});


// -------------------------------------------------------------
// 2. SECURE STORAGE ADVERSARIAL CHALLENGES
// -------------------------------------------------------------

async function runSecureStoreTests() {
  // Empty & Invalid Tokens
  await runAsyncTestCase('SecureStorage', 'Empty token - rejects empty string', async () => {
    let threw = false;
    try { await SecureStorageService.saveToken(''); } catch { threw = true; }
    if (!threw) throw new Error('Should throw on empty string token');
  });

  await runAsyncTestCase('SecureStorage', 'Empty token - rejects whitespace string', async () => {
    let threw = false;
    try { await SecureStorageService.saveToken('   \n\t  '); } catch { threw = true; }
    if (!threw) throw new Error('Should throw on whitespace token');
  });

  await runAsyncTestCase('SecureStorage', 'Empty token - rejects null', async () => {
    let threw = false;
    try { await SecureStorageService.saveToken(null); } catch { threw = true; }
    if (!threw) throw new Error('Should throw on null token');
  });

  await runAsyncTestCase('SecureStorage', 'Empty token - rejects undefined', async () => {
    let threw = false;
    try { await SecureStorageService.saveToken(undefined); } catch { threw = true; }
    if (!threw) throw new Error('Should throw on undefined token');
  });

  // Valid Token Operations
  await runAsyncTestCase('SecureStorage', 'Valid token - saves and retrieves trimmed token', async () => {
    await SecureStorageService.saveToken('   th_token_abc_123   \n');
    const token = await SecureStorageService.getToken();
    if (token !== 'th_token_abc_123') throw new Error('Token mismatch: ' + token);
    const has = await SecureStorageService.hasToken();
    if (!has) throw new Error('hasToken should return true');
  });

  await runAsyncTestCase('SecureStorage', 'Token deletion - deletes cleanly', async () => {
    await SecureStorageService.saveToken('th_token_to_del');
    await SecureStorageService.removeToken();
    const token = await SecureStorageService.getToken();
    if (token !== null) throw new Error('Token should be null after removeToken');
    const has = await SecureStorageService.hasToken();
    if (has) throw new Error('hasToken should return false');
  });

  // Special Characters in Config Keys
  await runAsyncTestCase('SecureStorage', 'Config keys - special characters in keys', async () => {
    const specialKeys = [
      'user_id',
      'api.endpoint.v1',
      'key-with-dashes',
      'complex:key/with#symbols?query=1',
      'key_!@$%^*()_+=',
      'unicode_key_🔑_test',
      'kê_tiếng_việt',
    ];
    for (const k of specialKeys) {
      await SecureStorageService.saveConfig(k, 'value_for_' + k);
      const val = await SecureStorageService.getConfig(k);
      if (val !== 'value_for_' + k) throw new Error('Config value mismatch for key: ' + k + ' got: ' + val);
    }
  });

  // Empty / Invalid Config Keys
  await runAsyncTestCase('SecureStorage', 'Config keys - empty / whitespace key throws on save', async () => {
    let threw = false;
    try { await SecureStorageService.saveConfig('', 'val'); } catch { threw = true; }
    if (!threw) throw new Error('Should throw on empty key');

    let threw2 = false;
    try { await SecureStorageService.saveConfig('   ', 'val'); } catch { threw2 = true; }
    if (!threw2) throw new Error('Should throw on whitespace key');
  });

  await runAsyncTestCase('SecureStorage', 'Config keys - empty / invalid key returns null on get', async () => {
    const v1 = await SecureStorageService.getConfig('');
    const v2 = await SecureStorageService.getConfig('   ');
    const v3 = await SecureStorageService.getConfig(null);
    if (v1 !== null || v2 !== null || v3 !== null) throw new Error('Should return null for invalid get key');
  });

  await runAsyncTestCase('SecureStorage', 'Config keys - removeConfig deletes specific key', async () => {
    await SecureStorageService.saveConfig('k1', 'v1');
    await SecureStorageService.saveConfig('k2', 'v2');
    await SecureStorageService.removeConfig('k1');
    const v1 = await SecureStorageService.getConfig('k1');
    const v2 = await SecureStorageService.getConfig('k2');
    if (v1 !== null || v2 !== 'v2') throw new Error('removeConfig failed: v1=' + v1 + ' v2=' + v2);
  });

  // clearAll Behavior
  await runAsyncTestCase('SecureStorage', 'clearAll behavior - clears token and all 10 common config keys', async () => {
    await SecureStorageService.saveToken('token_for_clearall');
    const commonKeys = [
      'api_url',
      'workspace_id',
      'workspace_name',
      'project_id',
      'project_title',
      'user_email',
      'user_name',
      'pairing_id',
      'theme_mode',
      'active_workspace',
    ];
    for (const k of commonKeys) {
      await SecureStorageService.saveConfig(k, 'val_' + k);
    }
    // Also save a custom non-common key
    await SecureStorageService.saveConfig('custom_key', 'custom_val');

    await SecureStorageService.clearAll();

    const tok = await SecureStorageService.getToken();
    if (tok !== null) throw new Error('Token not cleared');

    for (const k of commonKeys) {
      const v = await SecureStorageService.getConfig(k);
      if (v !== null) throw new Error('Common key not cleared: ' + k);
    }

    const customV = await SecureStorageService.getConfig('custom_key');
    if (customV !== 'custom_val') throw new Error('Custom key should remain preserved');
  });

  // Keychain Accessible Policy Enforcement
  await runAsyncTestCase('SecureStorage', 'Keychain accessible policy - AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY enforced', async () => {
    secureOptionsLog.length = 0;
    await SecureStorageService.saveToken('test_policy_tok');
    await SecureStorageService.getToken();
    await SecureStorageService.saveConfig('pol_key', 'pol_val');
    await SecureStorageService.getConfig('pol_key');
    await SecureStorageService.deleteConfig('pol_key');
    await SecureStorageService.deleteToken();

    if (secureOptionsLog.length === 0) throw new Error('No calls logged to SecureStore');

    for (const call of secureOptionsLog) {
      if (!call.opt || call.opt.keychainAccessible !== 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY') {
        throw new Error('Keychain option missing or invalid in call: ' + JSON.stringify(call));
      }
    }
  });

  // Print Summary
  console.log('\n============================================================');
  console.log('M2 EMPIRICAL CHALLENGE RESULTS');
  console.log('============================================================');
  let passedCount = 0;
  let failedCount = 0;
  for (const r of results) {
    if (r.pass) {
      passedCount++;
      console.log(`PASS [${r.category.padEnd(14)}] ${r.name}`);
    } else {
      failedCount++;
      console.log(`FAIL [${r.category.padEnd(14)}] ${r.name}: ${r.error}`);
    }
  }
  console.log('------------------------------------------------------------');
  console.log(`Total Challenges: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('============================================================\n');
  if (failedCount > 0) process.exit(1);
}

runSecureStoreTests();
