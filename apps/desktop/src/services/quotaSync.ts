export type QuotaSyncStatus =
  | 'synced'
  | 'not_configured'
  | 'invalid_credential'
  | 'forbidden'
  | 'rejected'
  | 'network_error';

export interface QuotaSyncCredential {
  taskHubUrl: string;
  token: string;
  projectId: string;
}

export interface QuotaSyncResult {
  ok: boolean;
  status: QuotaSyncStatus;
  attemptedAt: string;
  httpStatus?: number;
  message: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

function failure(status: QuotaSyncStatus, message: string, attemptedAt: string, httpStatus?: number): QuotaSyncResult {
  return { ok: false, status, message, attemptedAt, ...(httpStatus ? { httpStatus } : {}) };
}

/**
 * Sends quota only through the authenticated, project-scoped desktop API.
 * The endpoint is derived exclusively from the encrypted main-process
 * credential; renderer/localStorage values never participate in routing.
 */
export async function pushQuotaToTaskHub(
  quota: unknown,
  credential: QuotaSyncCredential | null,
  fetcher: FetchLike = fetch,
): Promise<QuotaSyncResult> {
  const attemptedAt = new Date().toISOString();
  if (!credential?.taskHubUrl || !credential.token || !credential.projectId) {
    return failure('not_configured', 'Connect Task Hub before syncing quota.', attemptedAt);
  }

  let endpoint: URL;
  try {
    const base = new URL(credential.taskHubUrl);
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Unsupported protocol');
    endpoint = new URL('/api/v1/desktop/agent/quota', base);
  } catch {
    return failure('invalid_credential', 'The saved Task Hub URL is invalid.', attemptedAt);
  }

  try {
    const response = await fetcher(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credential.token}`,
        'X-Task-Hub-Project': credential.projectId,
      },
      body: JSON.stringify({ quota, updated_at: attemptedAt }),
      signal: AbortSignal.timeout(5_000),
    });

    if (response.ok) {
      return { ok: true, status: 'synced', attemptedAt, httpStatus: response.status, message: 'Quota synced with Task Hub.' };
    }

    let serverMessage = '';
    try {
      const body = await response.json() as { message?: unknown };
      if (typeof body?.message === 'string') serverMessage = body.message;
    } catch { /* An error body is optional. */ }

    if (response.status === 401) return failure('invalid_credential', serverMessage || 'Task Hub credential is invalid or expired.', attemptedAt, 401);
    if (response.status === 403) return failure('forbidden', serverMessage || 'This credential cannot sync quota for the selected project.', attemptedAt, 403);
    return failure('rejected', serverMessage || `Task Hub rejected quota sync (${response.status}).`, attemptedAt, response.status);
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Task Hub quota sync timed out.'
      : 'Task Hub is unreachable. Local quota remains available.';
    return failure('network_error', message, attemptedAt);
  }
}
