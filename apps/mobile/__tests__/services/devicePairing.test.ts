import { DevicePairingService } from '@/services/devicePairing';
import { SecureStorageService } from '@/services/secureStorage';
import * as SecureStore from 'expo-secure-store';

describe('DevicePairingService (Tier 1 & 2)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    (SecureStore as any).__resetStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Tier 1: Device Pairing Protocol Lifecycle', () => {
    it('starts pairing session via POST endpoint', async () => {
      const mockStartRes = {
        success: true,
        pairing_id: 'pair-uuid-456',
        device_secret: 'sec_abcdef1234567890abcdef1234567890',
        code: '123-456',
        expires_at: '2026-08-25T18:00:00Z',
        approval_url: 'http://localhost:8000/desktop/pairing/pair-uuid-456/approve',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStartRes,
      });

      const res = await DevicePairingService.startPairing('http://localhost:8000', 10);
      expect(res.pairing_id).toBe('pair-uuid-456');
      expect(res.device_secret).toBe('sec_abcdef1234567890abcdef1234567890');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/desktop/pairing/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ project_id: 10 }),
        })
      );
    });

    it('queries single pairing status with X-Desktop-Pairing-Secret header', async () => {
      const mockStatusRes = {
        success: true,
        status: 'pending' as const,
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStatusRes,
      });

      const res = await DevicePairingService.checkPairingStatus(
        'http://localhost:8000',
        'pair-uuid-456',
        'sec_abcdef1234567890abcdef1234567890'
      );

      expect(res.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/desktop/pairing/pair-uuid-456/status',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Desktop-Pairing-Secret': 'sec_abcdef1234567890abcdef1234567890',
          }),
        })
      );
    });

    it('completes pairing by storing tokens and session details in hardware SecureStore', async () => {
      const approvedPayload = {
        success: true,
        status: 'approved' as const,
        mcp_token: 'th_mcp_auth_token_999',
        task_hub_url: 'http://localhost:8000',
        workspace_id: 1,
        workspace_name: 'Core Engineering',
        project_id: 10,
        project_title: 'Task Hub Mobile',
        user_email: 'lead@taskhub.dev',
        user_name: 'Lead Developer',
      };

      const session = await DevicePairingService.completePairing(approvedPayload);

      expect(session.token).toBe('th_mcp_auth_token_999');
      expect(session.apiUrl).toBe('http://localhost:8000');
      expect(session.workspaceId).toBe(1);
      expect(session.workspaceName).toBe('Core Engineering');

      expect(await SecureStorageService.getToken()).toBe('th_mcp_auth_token_999');
      expect(await SecureStorageService.getConfig('workspace_id')).toBe('1');
      expect(await SecureStorageService.getConfig('workspace_name')).toBe('Core Engineering');
      expect(await SecureStorageService.getConfig('project_id')).toBe('10');
      expect(await SecureStorageService.getConfig('user_email')).toBe('lead@taskhub.dev');
    });
  });

  describe('Tier 2: Error Paths & Edge Cases', () => {
    it('returns denied status when server responds with 401 unauthorized', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const res = await DevicePairingService.checkPairingStatus(
        'http://localhost:8000',
        'pair-uuid-456',
        'invalid_secret'
      );

      expect(res.status).toBe('denied');
    });

    it('throws descriptive error on HTTP 500 when starting pairing', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Database unavailable',
      });

      await expect(
        DevicePairingService.startPairing('http://localhost:8000')
      ).rejects.toThrow('Failed to start pairing (500): Database unavailable');
    });

    it('throws error when completing pairing without token', async () => {
      await expect(
        DevicePairingService.completePairing({ success: true, status: 'approved' })
      ).rejects.toThrow('No authentication token available to complete pairing');
    });
  });
});
