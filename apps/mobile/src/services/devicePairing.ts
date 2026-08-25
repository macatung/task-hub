import { SecureStorageService } from './secureStorage';
import { PairingQrPayload } from '@/api/types';
import { normalizeApiUrl } from '@/config/env';

export interface PairingStartResponse {
  success: boolean;
  pairing_id: string;
  device_secret: string;
  code: string;
  expires_at: string;
  approval_url: string;
}

export type PairingStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'consumed'
  | 'rejected';

export interface PairingStatusResponse {
  success: boolean;
  status: PairingStatus;
  project_id?: number;
  project_title?: string;
  workspace_id?: number;
  workspace_name?: string;
  user_email?: string;
  user_name?: string;
  task_hub_url?: string;
  mcp_token?: string;
  message?: string;
}

export interface CompletedPairingSession {
  token: string;
  apiUrl: string;
  workspaceId?: number;
  workspaceName?: string;
  projectId?: number;
  projectTitle?: string;
  userEmail?: string;
  userName?: string;
}

export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  onStatusChange?: (status: PairingStatus) => void;
}

/**
 * DevicePairingService manages desktop companion pairing protocol flow:
 * 1. POST /api/v1/desktop/pairing/start -> generates session, secret & code
 * 2. GET /api/v1/desktop/pairing/{pairingId}/status with X-Desktop-Pairing-Secret -> polls status
 * 3. Token exchange & persistence in hardware SecureStorageService.
 */
export class DevicePairingService {
  /**
   * Starts a new desktop pairing session on the Task Hub server.
   */
  static async startPairing(
    hubUrl: string,
    projectId?: number
  ): Promise<PairingStartResponse> {
    const baseUrl = normalizeApiUrl(hubUrl);
    const endpoint = `${baseUrl}/api/v1/desktop/pairing/start`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(projectId ? { project_id: projectId } : {}),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Failed to start pairing (${response.status}): ${errorBody || 'Server error'}`);
    }

    const data: PairingStartResponse = await response.json();
    return data;
  }

  /**
   * Queries the single status of a pending pairing session.
   */
  static async checkPairingStatus(
    hubUrl: string,
    pairingId: string,
    deviceSecret: string
  ): Promise<PairingStatusResponse> {
    const baseUrl = normalizeApiUrl(hubUrl);
    const endpoint = `${baseUrl}/api/v1/desktop/pairing/${encodeURIComponent(pairingId)}/status`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Desktop-Pairing-Secret': deviceSecret,
      },
    });

    if (response.status === 401) {
      return {
        success: false,
        status: 'denied',
        message: 'Invalid pairing secret or unauthorized',
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Status check failed (${response.status}): ${errText}`);
    }

    const data: PairingStatusResponse = await response.json();
    return data;
  }

  /**
   * Polls the pairing session status until 'approved', 'denied', 'expired', or timeout.
   */
  static async pollPairingStatus(
    hubUrl: string,
    pairingId: string,
    deviceSecret: string,
    options: PollOptions = {}
  ): Promise<PairingStatusResponse> {
    const maxAttempts = options.maxAttempts ?? 60; // 60 attempts * 2s = 120s
    const intervalMs = options.intervalMs ?? 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('Pairing status polling aborted');
      }

      const statusRes = await this.checkPairingStatus(hubUrl, pairingId, deviceSecret);
      options.onStatusChange?.(statusRes.status);

      if (statusRes.status === 'approved') {
        return statusRes;
      }

      if (
        statusRes.status === 'denied' ||
        statusRes.status === 'expired' ||
        statusRes.status === 'rejected'
      ) {
        return statusRes;
      }

      if (statusRes.status === 'consumed') {
        throw new Error('Pairing session was already consumed by another client');
      }

      // Wait interval before next poll attempt
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Pairing timed out waiting for approval');
  }

  /**
   * Completes device pairing by storing token and session configuration into hardware SecureStorage.
   */
  static async completePairing(
    payload: PairingQrPayload | PairingStatusResponse,
    hubUrlOverride?: string
  ): Promise<CompletedPairingSession> {
    let token: string | undefined;
    let url: string | undefined;
    let workspaceId: number | undefined;
    let workspaceName: string | undefined;
    let projectId: number | undefined;
    let projectTitle: string | undefined;
    let userEmail: string | undefined;
    let userName: string | undefined;

    if ('type' in payload && payload.type === 'taskhub_pairing') {
      // Direct QR Code payload with token or direct credentials
      token = payload.token || payload.device_secret;
      url = payload.task_hub_url;
      workspaceId = payload.workspace_id;
    } else if ('mcp_token' in payload && payload.mcp_token) {
      // Approved status polling response
      token = payload.mcp_token;
      url = payload.task_hub_url || hubUrlOverride;
      workspaceId = payload.workspace_id;
      workspaceName = payload.workspace_name;
      projectId = payload.project_id;
      projectTitle = payload.project_title;
      userEmail = payload.user_email;
      userName = payload.user_name;
    }

    if (!token) {
      throw new Error('No authentication token available to complete pairing');
    }

    const cleanUrl = normalizeApiUrl(url || hubUrlOverride || 'http://localhost:8000');

    // Persist into hardware-backed keychain
    await SecureStorageService.saveToken(token);
    await SecureStorageService.saveConfig('api_url', cleanUrl);

    if (workspaceId !== undefined) {
      await SecureStorageService.saveConfig('workspace_id', String(workspaceId));
    }
    if (workspaceName) {
      await SecureStorageService.saveConfig('workspace_name', workspaceName);
    }
    if (projectId !== undefined) {
      await SecureStorageService.saveConfig('project_id', String(projectId));
    }
    if (projectTitle) {
      await SecureStorageService.saveConfig('project_title', projectTitle);
    }
    if (userEmail) {
      await SecureStorageService.saveConfig('user_email', userEmail);
    }
    if (userName) {
      await SecureStorageService.saveConfig('user_name', userName);
    }

    return {
      token,
      apiUrl: cleanUrl,
      workspaceId,
      workspaceName,
      projectId,
      projectTitle,
      userEmail,
      userName,
    };
  }
}
