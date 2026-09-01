import { describe, expect, it, vi } from 'vitest';
import { fetchLatestWorkspaceQuota, toLatestQuotaViewModel } from './latestQuotaViewModel';

const payload = {
  data: {
    workspace: { id: 7, name: 'Core' },
    synced_at: '2026-09-01T10:00:00Z',
    records: [
      { device_id: 'a', device_name: 'Laptop', provider: 'codex', remaining_percent: 72, used_tokens: 20, token_limit: 100 },
      { device_id: 'b', device_name: 'Build box', provider: 'claude', remaining_percent: 41, used_tokens: 30, token_limit: 200 },
    ],
  },
};

describe('latest quota view model', () => {
  it('normalizes records and makes the aggregation rule explicit', () => {
    const model = toLatestQuotaViewModel(payload, 7);
    expect(model.workspace.name).toBe('Core');
    expect(model.summary).toEqual({ remainingPercent: 41, usedTokens: 50, tokenLimit: 300 });
    expect(model.devices).toHaveLength(2);
    expect(model.providers).toEqual(['claude', 'codex']);
    expect(model.aggregation.rule).toBe('most_constrained');
  });

  it('rejects cross-workspace responses', () => {
    expect(() => toLatestQuotaViewModel(payload, 8)).toThrow(/different workspace/i);
  });

  it('passes device/provider filters and bearer authorization to the scoped endpoint', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
    await fetchLatestWorkspaceQuota({ baseUrl: 'https://hub.test/', workspaceId: 7, token: 'secret', device: 'a', provider: 'codex', fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://hub.test/api/v1/workspaces/7/latest-quota?device=a&provider=codex',
      { headers: { Accept: 'application/json', Authorization: 'Bearer secret' } },
    );
  });

  it('uses a clear access error for forbidden workspaces', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchLatestWorkspaceQuota({ baseUrl: 'https://hub.test', workspaceId: 7, token: 'secret', fetchFn }))
      .rejects.toThrow(/do not have access/i);
  });
});
