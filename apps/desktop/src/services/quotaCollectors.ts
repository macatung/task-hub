export type QuotaProvider = 'codex' | 'claude_code' | 'antigravity';

export type QuotaCollection =
  | { status: 'available'; provider: QuotaProvider; usedTokens: number; source: string; dedupeKey: string }
  | { status: 'unavailable'; provider: QuotaProvider; reason: QuotaUnavailableReason };

export type QuotaUnavailableReason =
  | 'invalid_json'
  | 'invalid_usage'
  | 'unsupported_source';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function parseEvent(input: unknown): JsonRecord | QuotaUnavailableReason {
  if (isRecord(input)) return input;
  if (typeof input !== 'string') return 'invalid_json';
  try {
    const parsed: unknown = JSON.parse(input);
    return isRecord(parsed) ? parsed : 'invalid_json';
  } catch {
    return 'invalid_json';
  }
}

function unavailable(provider: QuotaProvider, reason: QuotaUnavailableReason): QuotaCollection {
  return { status: 'unavailable', provider, reason };
}

/** Parses only Claude Code's documented stream-json result usage object. */
export function collectClaudeCodeQuota(input: unknown, sessionId: string): QuotaCollection {
  const event = parseEvent(input);
  if (typeof event === 'string') return unavailable('claude_code', event);
  if (event.type !== 'result' || !isRecord(event.usage)) return unavailable('claude_code', 'unsupported_source');

  const inputTokens = nonNegativeInteger(event.usage.input_tokens);
  const outputTokens = nonNegativeInteger(event.usage.output_tokens);
  if (inputTokens === undefined || outputTokens === undefined) return unavailable('claude_code', 'invalid_usage');

  const resultId = typeof event.uuid === 'string' ? event.uuid : typeof event.session_id === 'string' ? event.session_id : 'result';
  return {
    status: 'available', provider: 'claude_code', usedTokens: inputTokens + outputTokens,
    source: 'claude_stream_json_result', dedupeKey: `${sessionId}:${resultId}`,
  };
}

/** Parses only Antigravity stream-json result events with an explicit total. */
export function collectAntigravityQuota(input: unknown, sessionId: string): QuotaCollection {
  const event = parseEvent(input);
  if (typeof event === 'string') return unavailable('antigravity', event);
  if (event.event !== 'result' || !isRecord(event.result) || !isRecord(event.result.usage)) {
    return unavailable('antigravity', 'unsupported_source');
  }

  const total = nonNegativeInteger(event.result.usage.total_tokens);
  if (total === undefined) return unavailable('antigravity', 'invalid_usage');
  const resultId = typeof event.conversation_id === 'string' ? event.conversation_id : 'result';
  return {
    status: 'available', provider: 'antigravity', usedTokens: total,
    source: 'antigravity_stream_json_result', dedupeKey: `${sessionId}:${resultId}`,
  };
}

/**
 * Collects Codex usage from turn.completed JSON events. A collector belongs to
 * one process session; retaining its keys prevents a replayed turn from being
 * charged twice without mixing independent sessions.
 */
export class CodexQuotaCollector {
  private readonly seenTurns = new Set<string>();

  constructor(private readonly sessionId: string) {}

  collect(input: unknown): QuotaCollection {
    const event = parseEvent(input);
    if (typeof event === 'string') return unavailable('codex', event);
    if (event.type !== 'turn.completed' || !isRecord(event.usage)) {
      return unavailable('codex', 'unsupported_source');
    }

    const inputTokens = nonNegativeInteger(event.usage.input_tokens);
    const outputTokens = nonNegativeInteger(event.usage.output_tokens);
    if (inputTokens === undefined || outputTokens === undefined) return unavailable('codex', 'invalid_usage');

    // Newer Codex versions expose turn_id; the fallback fingerprint protects
    // against replay of the same terminal event on older versions.
    const explicitTurnId = typeof event.turn_id === 'string' ? event.turn_id : undefined;
    const fingerprint = explicitTurnId ?? `${inputTokens}:${outputTokens}:${JSON.stringify(event.usage)}`;
    const dedupeKey = `${this.sessionId}:${fingerprint}`;
    if (this.seenTurns.has(dedupeKey)) {
      return { status: 'available', provider: 'codex', usedTokens: 0, source: 'codex_turn_completed_duplicate', dedupeKey };
    }
    this.seenTurns.add(dedupeKey);
    return {
      status: 'available', provider: 'codex', usedTokens: inputTokens + outputTokens,
      source: 'codex_turn_completed', dedupeKey,
    };
  }
}
