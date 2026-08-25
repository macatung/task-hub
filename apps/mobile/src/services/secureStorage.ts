import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'taskhub_auth_token';
const CONFIG_PREFIX = 'taskhub_config_';

/**
 * Hardware-backed secure storage service utilizing iOS Keychain and Android KeyStore via expo-secure-store.
 * Configured with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly on iOS)
 * to ensure maximum cryptographic isolation and prevent extraction during device backups.
 */
export class SecureStorageService {
  private static secureOptions: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };

  /**
   * Securely saves the authentication bearer token to hardware-backed storage.
   * Validates non-empty string and trims whitespace.
   */
  static async saveToken(token: string): Promise<void> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Invalid token provided for secure storage');
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token.trim(), this.secureOptions);
  }

  /**
   * Retrieves the persisted authentication token or null if not found or on read error.
   */
  static async getToken(): Promise<string | null> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY, this.secureOptions);
      return token ? token.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if an authentication token exists in secure storage.
   */
  static async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null && token.length > 0;
  }

  /**
   * Deletes the persisted authentication token from hardware storage.
   */
  static async deleteToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY, this.secureOptions);
    } catch {
      // Ignore deletion failures if already missing
    }
  }

  /**
   * Alias for deleteToken() for interface compatibility.
   */
  static async removeToken(): Promise<void> {
    await this.deleteToken();
  }

  /**
   * Securely persists an arbitrary configuration key-value pair under a namespaced key.
   */
  static async saveConfig(key: string, value: string): Promise<void> {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Invalid key provided for secure config storage');
    }
    const namespacedKey = `${CONFIG_PREFIX}${key.trim()}`;
    await SecureStore.setItemAsync(namespacedKey, String(value), this.secureOptions);
  }

  /**
   * Retrieves a securely persisted configuration value or null if absent/errored.
   */
  static async getConfig(key: string): Promise<string | null> {
    if (!key || typeof key !== 'string' || key.trim().length === 0) return null;
    const namespacedKey = `${CONFIG_PREFIX}${key.trim()}`;
    try {
      const value = await SecureStore.getItemAsync(namespacedKey, this.secureOptions);
      return value ? value : null;
    } catch {
      return null;
    }
  }

  /**
   * Deletes a persisted configuration key.
   */
  static async deleteConfig(key: string): Promise<void> {
    if (!key || typeof key !== 'string') return;
    const namespacedKey = `${CONFIG_PREFIX}${key.trim()}`;
    try {
      await SecureStore.deleteItemAsync(namespacedKey, this.secureOptions);
    } catch {
      // Ignore deletion errors
    }
  }

  /**
   * Alias for deleteConfig() for interface compatibility.
   */
  static async removeConfig(key: string): Promise<void> {
    await this.deleteConfig(key);
  }

  /**
   * Clears token and all common configuration entries from hardware storage.
   */
  static async clearAll(): Promise<void> {
    await this.deleteToken();
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
    await Promise.all(commonKeys.map((key) => this.deleteConfig(key)));
  }
}
