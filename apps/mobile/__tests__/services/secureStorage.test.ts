import { SecureStorageService } from '@/services/secureStorage';
import * as SecureStore from 'expo-secure-store';

describe('SecureStorageService (Tier 1 & 2)', () => {
  beforeEach(async () => {
    (SecureStore as any).__resetStore();
    jest.clearAllMocks();
  });

  describe('Tier 1: Token Management Happy Paths', () => {
    it('saves authentication token to secure hardware storage', async () => {
      const token = 'th_ws_tok_1234567890abcdef';
      await SecureStorageService.saveToken(token);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'taskhub_auth_token',
        token,
        expect.objectContaining({
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        })
      );
    });

    it('retrieves previously saved token correctly', async () => {
      const token = 'th_ws_tok_test_value_987';
      await SecureStorageService.saveToken(token);

      const retrieved = await SecureStorageService.getToken();
      expect(retrieved).toBe(token);
    });

    it('returns null when no token has been saved', async () => {
      const retrieved = await SecureStorageService.getToken();
      expect(retrieved).toBeNull();
    });

    it('correctly checks token presence with hasToken()', async () => {
      expect(await SecureStorageService.hasToken()).toBe(false);

      await SecureStorageService.saveToken('th_ws_valid_token');
      expect(await SecureStorageService.hasToken()).toBe(true);

      await SecureStorageService.removeToken();
      expect(await SecureStorageService.hasToken()).toBe(false);
    });

    it('deletes token cleanly from secure store', async () => {
      await SecureStorageService.saveToken('th_ws_to_delete');
      expect(await SecureStorageService.getToken()).toBe('th_ws_to_delete');

      await SecureStorageService.removeToken();
      expect(await SecureStorageService.getToken()).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'taskhub_auth_token',
        expect.any(Object)
      );
    });
  });

  describe('Tier 1: Generic Config Management', () => {
    it('persists and retrieves arbitrary config keys with namespacing', async () => {
      await SecureStorageService.saveConfig('active_workspace', '42');
      await SecureStorageService.saveConfig('theme_mode', 'dark');

      expect(await SecureStorageService.getConfig('active_workspace')).toBe('42');
      expect(await SecureStorageService.getConfig('theme_mode')).toBe('dark');
    });

    it('removes specific configuration key without affecting others', async () => {
      await SecureStorageService.saveConfig('key1', 'val1');
      await SecureStorageService.saveConfig('key2', 'val2');

      await SecureStorageService.removeConfig('key1');
      expect(await SecureStorageService.getConfig('key1')).toBeNull();
      expect(await SecureStorageService.getConfig('key2')).toBe('val2');
    });

    it('returns null for unconfigured key', async () => {
      expect(await SecureStorageService.getConfig('non_existent_key')).toBeNull();
    });
  });

  describe('Tier 2: Boundary, Edge Cases & Error Handling', () => {
    it('throws descriptive error when saving empty string token', async () => {
      await expect(SecureStorageService.saveToken('')).rejects.toThrow(
        'Invalid token provided for secure storage'
      );
    });

    it('throws error when saving null or undefined token', async () => {
      await expect(SecureStorageService.saveToken(null as any)).rejects.toThrow(
        'Invalid token provided for secure storage'
      );
      await expect(SecureStorageService.saveToken(undefined as any)).rejects.toThrow(
        'Invalid token provided for secure storage'
      );
    });

    it('trims whitespace around token before saving', async () => {
      const tokenWithWhitespace = '   th_ws_padded_token_123   \n';
      await SecureStorageService.saveToken(tokenWithWhitespace);

      const retrieved = await SecureStorageService.getToken();
      expect(retrieved).toBe('th_ws_padded_token_123');
    });

    it('throws descriptive error when saving config with empty key', async () => {
      await expect(SecureStorageService.saveConfig('', 'value')).rejects.toThrow(
        'Invalid key provided for secure config storage'
      );
    });

    it('handles unexpected exceptions from native secure store gracefully in getConfig and getToken', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Keychain locked'));
      const token = await SecureStorageService.getToken();
      expect(token).toBeNull();

      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Hardware fault'));
      const config = await SecureStorageService.getConfig('test');
      expect(config).toBeNull();
    });
  });
});
