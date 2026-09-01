export type QuotaAggregationRule = 'most_constrained';

export interface LatestQuotaRecord {
  deviceId: string;
  deviceName: string;
  provider: string;
  model?: string;
  remainingPercent: number;
  usedTokens: number;
  tokenLimit: number;
  capturedAt: string;
}

export interface LatestQuotaViewModel {
  workspace: { id: string; name: string };
  records: LatestQuotaRecord[];
  devices: Array<{ id: string; name: string }>;
  providers: string[];
  summary: { remainingPercent: number | null; usedTokens: number; tokenLimit: number };
  aggregation: {
    rule: QuotaAggregationRule;
    label: string;
    description: string;
  };
  syncedAt: string | null;
}

export interface LatestQuotaQuery {
  baseUrl: string;
  workspaceId: string | number;
  token: string;
  device?: string;
  provider?: string;
  fetchFn?: typeof fetch;
}

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value: unknown): number =>
  Math.min(100, Math.max(0, finiteNumber(value)));

/**
 * Converts the Hub's snake_case quota contract into a presentation-safe model.
 * The summary deliberately uses the lowest remaining percentage: adding devices
 * must never make a workspace appear to have more usable quota than it really has.
 */
export function toLatestQuotaViewModel(payload: any, expectedWorkspaceId?: string | number): LatestQuotaViewModel {
  const data = payload?.data ?? payload ?? {};
  const workspace = data.workspace ?? {};
  const workspaceId = String(workspace.id ?? data.workspace_id ?? '');

  if (expectedWorkspaceId !== undefined && workspaceId !== String(expectedWorkspaceId)) {
    throw new Error('Hub returned quota for a different workspace.');
  }

  const rawRecords = Array.isArray(data.records)
    ? data.records
    : Array.isArray(data.quotas)
      ? data.quotas
      : [];
  const records: LatestQuotaRecord[] = rawRecords.map((record: any) => ({
    deviceId: String(record.device_id ?? record.deviceId ?? ''),
    deviceName: String(record.device_name ?? record.deviceName ?? record.machine_name ?? 'Unknown device'),
    provider: String(record.provider ?? 'unknown'),
    model: record.model ? String(record.model) : undefined,
    remainingPercent: clampPercent(record.remaining_percent ?? record.remainingPercent),
    usedTokens: Math.max(0, finiteNumber(record.used_tokens ?? record.usedTokens)),
    tokenLimit: Math.max(0, finiteNumber(record.token_limit ?? record.tokenLimit ?? record.limit)),
    capturedAt: String(record.captured_at ?? record.capturedAt ?? record.updated_at ?? ''),
  }));

  const deviceMap = new Map<string, string>();
  records.forEach(record => deviceMap.set(record.deviceId, record.deviceName));
  const remaining = records.map(record => record.remainingPercent);

  return {
    workspace: { id: workspaceId, name: String(workspace.name ?? data.workspace_name ?? 'Workspace') },
    records,
    devices: Array.from(deviceMap, ([id, name]) => ({ id, name })),
    providers: Array.from(new Set(records.map(record => record.provider))).sort(),
    summary: {
      remainingPercent: remaining.length ? Math.min(...remaining) : null,
      usedTokens: records.reduce((sum, record) => sum + record.usedTokens, 0),
      tokenLimit: records.reduce((sum, record) => sum + record.tokenLimit, 0),
    },
    aggregation: {
      rule: 'most_constrained',
      label: 'Most constrained quota',
      description: 'Remaining quota is the lowest value across the filtered devices and providers; token usage is summed.',
    },
    syncedAt: data.synced_at ?? data.updated_at ?? null,
  };
}

export async function fetchLatestWorkspaceQuota(query: LatestQuotaQuery): Promise<LatestQuotaViewModel> {
  const fetchFn = query.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  if (!fetchFn) throw new Error('Fetch is not available.');

  const params = new URLSearchParams();
  if (query.device) params.set('device', query.device);
  if (query.provider) params.set('provider', query.provider);
  const suffix = params.size ? `?${params.toString()}` : '';
  const url = `${query.baseUrl.replace(/\/$/, '')}/api/v1/workspaces/${encodeURIComponent(String(query.workspaceId))}/latest-quota${suffix}`;
  const response = await fetchFn(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${query.token}` },
  });

  if (response.status === 403) throw new Error('You do not have access to this workspace quota.');
  if (!response.ok) throw new Error(`Could not load latest quota (HTTP ${response.status}).`);
  return toLatestQuotaViewModel(await response.json(), query.workspaceId);
}
