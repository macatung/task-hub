export interface EnvConfig {
  apiUrl: string;
  wsUrl: string;
  environment: 'development' | 'staging' | 'production';
  defaultTimeoutMs: number;
  sseReconnectIntervalMs: number;
  maxSseReconnectAttempts: number;
  appName: string;
  appVersion: string;
}

export const DEFAULT_DEV_API_URL = 'http://localhost:8000';
export const DEFAULT_STAGING_API_URL = 'https://staging.taskhub.dev';
export const DEFAULT_PROD_API_URL = 'https://app.taskhub.dev';

export function normalizeApiUrl(inputUrl: string): string {
  if (!inputUrl) return DEFAULT_DEV_API_URL;
  let clean = inputUrl.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  return clean;
}

export const env: EnvConfig = {
  apiUrl: DEFAULT_DEV_API_URL,
  wsUrl: DEFAULT_DEV_API_URL.replace(/^http/, 'ws'),
  environment: 'development',
  defaultTimeoutMs: 15000,
  sseReconnectIntervalMs: 2000,
  maxSseReconnectAttempts: 10,
  appName: 'Task Hub',
  appVersion: '1.0.0',
};
