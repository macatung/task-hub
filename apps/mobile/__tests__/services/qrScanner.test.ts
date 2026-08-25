import { QRScannerService } from '@/services/qrScanner';

describe('QRScannerService (Tier 1 & 2)', () => {
  const validPayload = {
    type: 'taskhub_pairing',
    version: '1',
    task_hub_url: 'https://app.taskhub.dev',
    pairing_id: '123e4567-e89b-12d3-a456-426614174000',
    device_secret: 'sec_abcdef1234567890abcdef1234567890',
    code: '984-123',
    workspace_id: 1,
  };

  describe('Tier 1: Valid Pairing Payloads', () => {
    it('parses valid full QR pairing payload successfully', () => {
      const raw = JSON.stringify(validPayload);
      const result = QRScannerService.parseAndValidateQrPayload(raw);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.task_hub_url).toBe('https://app.taskhub.dev');
        expect(result.payload.pairing_id).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.payload.device_secret).toBe('sec_abcdef1234567890abcdef1234567890');
        expect(result.payload.code).toBe('984-123');
        expect(result.payload.workspace_id).toBe(1);
      }
    });

    it('parses valid minimal QR payload (without optional code and workspace_id)', () => {
      const minimal = {
        type: 'taskhub_pairing',
        version: '1',
        task_hub_url: 'http://localhost:8000',
        pairing_id: 'pairing_998877',
        device_secret: 'secret_with_more_than_16_chars',
      };
      const raw = JSON.stringify(minimal);
      const result = QRScannerService.parseAndValidateQrPayload(raw);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.task_hub_url).toBe('http://localhost:8000');
        expect(result.payload.code).toBeUndefined();
      }
    });

    it('strips trailing slashes from task_hub_url', () => {
      const payload = {
        ...validPayload,
        task_hub_url: 'https://staging.taskhub.dev///',
      };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.task_hub_url).toBe('https://staging.taskhub.dev');
      }
    });

    it('handles payload with pre-issued direct bearer token', () => {
      const payload = {
        ...validPayload,
        token: 'th_ws_direct_token_abc',
      };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(payload));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.token).toBe('th_ws_direct_token_abc');
      }
    });
  });

  describe('Tier 2: Malformed Inputs, Missing Fields & Adversarial Payloads', () => {
    it('rejects empty or null string input', () => {
      expect(QRScannerService.parseAndValidateQrPayload('')).toEqual({
        success: false,
        error: 'Empty or invalid QR code data',
      });
      expect(QRScannerService.parseAndValidateQrPayload(null as any)).toEqual({
        success: false,
        error: 'Empty or invalid QR code data',
      });
    });

    it('rejects malformed non-JSON strings', () => {
      const result = QRScannerService.parseAndValidateQrPayload('not-a-json-payload');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Malformed JSON payload in QR code');
      }
    });

    it('rejects invalid payload type', () => {
      const invalidType = { ...validPayload, type: 'unknown_app_payload' };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(invalidType));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid payload type: expected 'taskhub_pairing'");
      }
    });

    it('rejects unsupported schema versions', () => {
      const invalidVer = { ...validPayload, version: '2' };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(invalidVer));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unsupported payload version: '2'");
      }
    });

    it('rejects non-HTTP/HTTPS URL formats', () => {
      const ftpUrl = { ...validPayload, task_hub_url: 'ftp://fileserver.local' };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(ftpUrl));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('task_hub_url must be a valid HTTP or HTTPS URL');
      }
    });

    it('rejects missing or empty pairing_id', () => {
      const missingPairing = { ...validPayload, pairing_id: '   ' };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(missingPairing));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Missing or invalid pairing_id');
      }
    });

    it('rejects weak device secrets under 16 characters', () => {
      const weakSecret = { ...validPayload, device_secret: 'short_secret' };
      const result = QRScannerService.parseAndValidateQrPayload(JSON.stringify(weakSecret));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Missing or insecure device_secret');
      }
    });
  });
});
