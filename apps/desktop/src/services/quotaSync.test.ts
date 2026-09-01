import { describe, expect, it, vi } from 'vitest';
import { pushQuotaToTaskHub } from './quotaSync';

const credential = { taskHubUrl: 'https://hub.example.test/custom/path', token: 'secret-token', projectId: '42' };

describe('pushQuotaToTaskHub', () => {
  it('uses the secured credential pair and canonical desktop endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    const result = await pushQuotaToTaskHub({ codex: { usedTokens: 12 } }, credential, fetcher);

    expect(result.status).toBe('synced');
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://hub.example.test/api/v1/desktop/agent/quota');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
      'X-Task-Hub-Project': '42',
    });
  });

  it('does not make a public request when the secure credential is absent', async () => {
    const fetcher = vi.fn();
    const result = await pushQuotaToTaskHub({}, null, fetcher);
    expect(result.status).toBe('not_configured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns an actionable authentication status', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Credential expired.' }),
    });
    const result = await pushQuotaToTaskHub({}, credential, fetcher);
    expect(result).toMatchObject({ ok: false, status: 'invalid_credential', httpStatus: 401, message: 'Credential expired.' });
  });

  it('rejects a malformed URL without sending the token', async () => {
    const fetcher = vi.fn();
    const result = await pushQuotaToTaskHub({}, { ...credential, taskHubUrl: 'javascript:alert(1)' }, fetcher);
    expect(result.status).toBe('invalid_credential');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
