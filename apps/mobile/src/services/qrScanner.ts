import { z } from 'zod';
import { PairingQrPayload } from '@/api/types';

/**
 * Zod schema for strictly validating taskhub_pairing QR payloads.
 */
export const PairingQrPayloadSchema = z.object({
  type: z.literal('taskhub_pairing'),
  version: z.literal('1'),
  task_hub_url: z
    .string()
    .min(1, 'Missing or invalid task_hub_url')
    .refine((url) => /^https?:\/\/.+/i.test(url.trim()), {
      message: 'task_hub_url must be a valid HTTP or HTTPS URL',
    }),
  pairing_id: z.string().min(1, 'Missing or invalid pairing_id'),
  device_secret: z
    .string()
    .min(16, 'Missing or insecure device_secret (must be at least 16 characters)'),
  code: z.string().optional(),
  workspace_id: z.number().int().positive().optional(),
  token: z.string().optional(),
});

export type ValidatedPairingQrPayload = z.infer<typeof PairingQrPayloadSchema>;

export type ParseQrResult =
  | { success: true; payload: PairingQrPayload }
  | { success: false; error: string };

export class QRScannerService {
  /**
   * Parses and validates raw QR data from camera scans, deep links, or web approval URLs.
   * Supports:
   * 1. JSON string: {"type":"taskhub_pairing", "version":"1", ...}
   * 2. Deep links: taskhub://pair?... or taskhub://pairing?...
   * 3. Web approval URLs: https://hub.example.com/desktop/pairing/{pairingId}/approve?code=...
   */
  static parseAndValidateQrPayload(raw: string): ParseQrResult {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return { success: false, error: 'Empty or invalid QR code data' };
    }

    const trimmed = raw.trim();

    // 1. Check if raw string is a deep link (taskhub://...)
    if (trimmed.startsWith('taskhub://')) {
      return this.parseDeepLink(trimmed);
    }

    // 2. Check if raw string is a Web Approval URL (https://.../desktop/pairing/.../approve)
    const approvalUrlMatch = trimmed.match(
      /^(https?:\/\/[^\/]+)\/desktop\/pairing\/([a-zA-Z0-9_-]+)\/approve(?:\?(.*))?$/i
    );
    if (approvalUrlMatch) {
      return this.parseApprovalUrl(approvalUrlMatch[1], approvalUrlMatch[2], approvalUrlMatch[3]);
    }

    // 3. Attempt JSON parse
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { success: false, error: 'Malformed JSON payload in QR code' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'QR payload must be a JSON object' };
    }

    if (parsed.type !== 'taskhub_pairing') {
      return {
        success: false,
        error: `Invalid payload type: expected 'taskhub_pairing', received '${parsed.type}'`,
      };
    }

    if (parsed.version !== '1') {
      return {
        success: false,
        error: `Unsupported payload version: '${parsed.version}'`,
      };
    }

    if (!parsed.task_hub_url || typeof parsed.task_hub_url !== 'string') {
      return { success: false, error: 'Missing or invalid task_hub_url' };
    }

    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(parsed.task_hub_url.trim())) {
      return { success: false, error: 'task_hub_url must be a valid HTTP or HTTPS URL' };
    }

    if (
      !parsed.pairing_id ||
      typeof parsed.pairing_id !== 'string' ||
      parsed.pairing_id.trim().length === 0
    ) {
      return { success: false, error: 'Missing or invalid pairing_id' };
    }

    if (
      !parsed.device_secret ||
      typeof parsed.device_secret !== 'string' ||
      parsed.device_secret.trim().length < 16
    ) {
      return {
        success: false,
        error: 'Missing or insecure device_secret (must be at least 16 characters)',
      };
    }

    const payload: PairingQrPayload = {
      type: 'taskhub_pairing',
      version: '1',
      task_hub_url: parsed.task_hub_url.trim().replace(/\/+$/, ''),
      pairing_id: parsed.pairing_id.trim(),
      device_secret: parsed.device_secret.trim(),
      code: parsed.code ? String(parsed.code).trim() : undefined,
      workspace_id: typeof parsed.workspace_id === 'number' ? parsed.workspace_id : undefined,
      token: parsed.token ? String(parsed.token).trim() : undefined,
    };

    return { success: true, payload };
  }

  /**
   * Parses deep links with query parameters e.g. taskhub://pair?task_hub_url=...&pairing_id=...&device_secret=...
   */
  private static parseDeepLink(urlStr: string): ParseQrResult {
    try {
      const queryIdx = urlStr.indexOf('?');
      if (queryIdx === -1) {
        return { success: false, error: 'Deep link missing query parameters' };
      }

      const queryString = urlStr.slice(queryIdx + 1);
      const params = new URLSearchParams(queryString);

      // Check if wrapped in data param
      const dataParam = params.get('data');
      if (dataParam) {
        try {
          const decoded = decodeURIComponent(dataParam);
          return this.parseAndValidateQrPayload(decoded);
        } catch {
          // Fall through
        }
      }

      const taskHubUrl = params.get('task_hub_url') || params.get('url') || params.get('hub_url');
      const pairingId = params.get('pairing_id') || params.get('id');
      const deviceSecret = params.get('device_secret') || params.get('secret');
      const code = params.get('code') || undefined;
      const wsStr = params.get('workspace_id') || params.get('ws');
      const token = params.get('token') || undefined;

      const syntheticJson = {
        type: 'taskhub_pairing',
        version: '1',
        task_hub_url: taskHubUrl,
        pairing_id: pairingId,
        device_secret: deviceSecret,
        code,
        workspace_id: wsStr ? parseInt(wsStr, 10) : undefined,
        token,
      };

      return this.parseAndValidateQrPayload(JSON.stringify(syntheticJson));
    } catch {
      return { success: false, error: 'Failed to parse deep link URL parameters' };
    }
  }

  /**
   * Parses web approval URLs e.g. https://hub.example.com/desktop/pairing/UUID/approve?code=XXXX&secret=YYYY
   */
  private static parseApprovalUrl(
    baseUrl: string,
    pairingId: string,
    queryString?: string
  ): ParseQrResult {
    try {
      const params = new URLSearchParams(queryString || '');
      const code = params.get('code') || undefined;
      const secret = params.get('secret') || params.get('device_secret');

      if (!secret || secret.length < 16) {
        return {
          success: false,
          error: 'Approval URL is missing required device secret (minimum 16 characters)',
        };
      }

      const payload: PairingQrPayload = {
        type: 'taskhub_pairing',
        version: '1',
        task_hub_url: baseUrl.replace(/\/+$/, ''),
        pairing_id: pairingId,
        device_secret: secret,
        code,
      };

      return { success: true, payload };
    } catch {
      return { success: false, error: 'Invalid web approval URL format' };
    }
  }
}
