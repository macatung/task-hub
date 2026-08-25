import { BiometricsService } from '@/services/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';

describe('BiometricsService (Tier 1 & 2)', () => {
  beforeEach(() => {
    (LocalAuthentication as any).__resetMock();
  });

  describe('Tier 1: Hardware Readiness & Authentication', () => {
    it('detects available biometric hardware', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      const isAvailable = await BiometricsService.isHardwareAvailable();
      expect(isAvailable).toBe(true);
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });

    it('detects enrolled biometrics when hardware is available', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);

      const isEnrolled = await BiometricsService.isEnrolled();
      expect(isEnrolled).toBe(true);
      expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalled();
    });

    it('authenticates user successfully with custom reason prompt', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({ success: true });

      const result = await BiometricsService.authenticate('Approve code changes');
      expect(result.success).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          promptMessage: 'Approve code changes',
          cancelLabel: 'Cancel',
        })
      );
    });

    it('executes sensitive action successfully when biometric authentication passes', async () => {
      (LocalAuthentication as any).__setMockResult({ success: true });
      const sensitiveAction = jest.fn(async () => ({ status: 'APPROVED', runId: 101 }));

      const output = await BiometricsService.guardSensitiveAction(
        sensitiveAction,
        'Confirm Handoff Approval'
      );

      expect(output).toEqual({ status: 'APPROVED', runId: 101 });
      expect(sensitiveAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tier 2: Error Paths, Cancellations & Hardware Edge Cases', () => {
    it('returns false for isEnrolled when hardware is unavailable', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(false);
      (LocalAuthentication as any).__setEnrolled(true);

      const isEnrolled = await BiometricsService.isEnrolled();
      expect(isEnrolled).toBe(false);
      expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled();
    });

    it('returns error result when hardware is not available during authenticate()', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(false);

      const result = await BiometricsService.authenticate('Sensitive operation');
      expect(result.success).toBe(false);
      expect(result.error).toBe('BIOMETRIC_HARDWARE_UNAVAILABLE');
    });

    it('returns error result when biometrics are not enrolled during authenticate()', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(false);

      const result = await BiometricsService.authenticate('Sensitive operation');
      expect(result.success).toBe(false);
      expect(result.error).toBe('BIOMETRIC_NOT_ENROLLED');
    });

    it('handles user cancellation gracefully', async () => {
      (LocalAuthentication as any).__setHardwareAvailable(true);
      (LocalAuthentication as any).__setEnrolled(true);
      (LocalAuthentication as any).__setMockResult({
        success: false,
        error: 'user_cancel',
      });

      const result = await BiometricsService.authenticate('Handoff Review');
      expect(result.success).toBe(false);
      expect(result.error).toBe('user_cancel');
    });

    it('throws error and does not execute sensitive action when biometrics fail', async () => {
      (LocalAuthentication as any).__setMockResult({
        success: false,
        error: 'biometric_failed',
      });
      const sensitiveAction = jest.fn(async () => 'SHOULD_NOT_RUN');

      await expect(
        BiometricsService.guardSensitiveAction(sensitiveAction, 'Test Prompt')
      ).rejects.toThrow('Biometric verification failed: biometric_failed');

      expect(sensitiveAction).not.toHaveBeenCalled();
    });

    it('catches unexpected native exceptions and maps to error object', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Native sensor timeout')
      );

      const result = await BiometricsService.authenticate('Test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Native sensor timeout');
    });
  });
});
