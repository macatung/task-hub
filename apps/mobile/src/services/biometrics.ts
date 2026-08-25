import * as LocalAuthentication from 'expo-local-authentication';

export type BiometryType = 'FaceID' | 'TouchID' | 'Iris' | 'Biometrics' | 'None';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * BiometricsService handles native biometric authentication (FaceID, TouchID, Iris)
 * via expo-local-authentication to gate high-privilege operations like handoff approval.
 */
export class BiometricsService {
  /**
   * Checks whether the device hardware supports biometric authentication.
   */
  static async isHardwareAvailable(): Promise<boolean> {
    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch {
      return false;
    }
  }

  /**
   * Alias for isHardwareAvailable() conforming to Expo naming.
   */
  static async hasHardwareAsync(): Promise<boolean> {
    return await this.isHardwareAvailable();
  }

  /**
   * Checks whether biometric records (FaceID / Fingerprint / Iris) are enrolled on this device.
   */
  static async isEnrolled(): Promise<boolean> {
    try {
      const hasHardware = await this.isHardwareAvailable();
      if (!hasHardware) return false;
      return await LocalAuthentication.isEnrolledAsync();
    } catch {
      return false;
    }
  }

  /**
   * Alias for isEnrolled() conforming to Expo naming.
   */
  static async isEnrolledAsync(): Promise<boolean> {
    return await this.isEnrolled();
  }

  /**
   * Returns list of supported biometric authentication types.
   */
  static async getSupportedAuthTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch {
      return [];
    }
  }

  /**
   * Returns a friendly name for the primary supported biometric type (e.g. 'FaceID', 'TouchID').
   */
  static async getBiometryName(): Promise<BiometryType> {
    try {
      const types = await this.getSupportedAuthTypes();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'FaceID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'TouchID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
      return types.length > 0 ? 'Biometrics' : 'None';
    } catch {
      return 'None';
    }
  }

  /**
   * Prompts the user with a biometric verification dialog with device passcode fallback.
   */
  static async authenticate(
    reason: string = 'Verify your identity to proceed'
  ): Promise<BiometricAuthResult> {
    try {
      const available = await this.isHardwareAvailable();
      if (!available) {
        return { success: false, error: 'BIOMETRIC_HARDWARE_UNAVAILABLE' };
      }

      const enrolled = await this.isEnrolled();
      if (!enrolled) {
        return { success: false, error: 'BIOMETRIC_NOT_ENROLLED' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: (result as any).error || 'USER_CANCELLED',
        warning: (result as any).warning,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'BIOMETRIC_AUTHENTICATION_FAILED',
      };
    }
  }

  /**
   * Guards a sensitive async operation behind mandatory biometric authentication.
   * Throws an error if authentication is denied, cancelled, or fails.
   */
  static async guardSensitiveAction<T>(action: () => Promise<T>, reason: string): Promise<T> {
    const authResult = await this.authenticate(reason);
    if (!authResult.success) {
      throw new Error(`Biometric verification failed: ${authResult.error || 'UNAUTHORIZED'}`);
    }
    return await action();
  }
}
