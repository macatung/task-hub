import { describe, expect, it } from 'vitest';
import { CodexQuotaCollector, collectAntigravityQuota, collectClaudeCodeQuota } from './quotaCollectors';

describe('quota collectors', () => {
  it('collects Codex JSON usage once per turn and session', () => {
    const event = { type: 'turn.completed', turn_id: 'turn-1', usage: { input_tokens: 120, output_tokens: 30 } };
    const firstSession = new CodexQuotaCollector('session-a');
    expect(firstSession.collect(event)).toMatchObject({ status: 'available', usedTokens: 150 });
    expect(firstSession.collect(event)).toMatchObject({ status: 'available', usedTokens: 0 });
    expect(new CodexQuotaCollector('session-b').collect(event)).toMatchObject({ status: 'available', usedTokens: 150 });
  });

  it('rejects malformed and unsupported Codex events with safe reasons', () => {
    const collector = new CodexQuotaCollector('session-a');
    expect(collector.collect('{secret')).toEqual({ status: 'unavailable', provider: 'codex', reason: 'invalid_json' });
    expect(collector.collect({ type: 'message', usage: { input_tokens: 1, output_tokens: 2 } }))
      .toEqual({ status: 'unavailable', provider: 'codex', reason: 'unsupported_source' });
    expect(collector.collect({ type: 'turn.completed', usage: { input_tokens: -1, output_tokens: 2 } }))
      .toEqual({ status: 'unavailable', provider: 'codex', reason: 'invalid_usage' });
  });

  it('parses only supported Claude Code result usage', () => {
    expect(collectClaudeCodeQuota({ type: 'result', uuid: 'r1', usage: { input_tokens: 40, output_tokens: 2 } }, 's1'))
      .toMatchObject({ status: 'available', usedTokens: 42, source: 'claude_stream_json_result' });
    expect(collectClaudeCodeQuota({ type: 'assistant', usage: { input_tokens: 40, output_tokens: 2 } }, 's1'))
      .toEqual({ status: 'unavailable', provider: 'claude_code', reason: 'unsupported_source' });
  });

  it('parses only supported Antigravity result usage', () => {
    expect(collectAntigravityQuota({ event: 'result', result: { usage: { total_tokens: 99 } } }, 's1'))
      .toMatchObject({ status: 'available', usedTokens: 99, source: 'antigravity_stream_json_result' });
    expect(collectAntigravityQuota({ event: 'step_update', usage: { total_tokens: 99 } }, 's1'))
      .toEqual({ status: 'unavailable', provider: 'antigravity', reason: 'unsupported_source' });
  });

  it('never leaks parser input in unavailable reasons', () => {
    const sensitive = 'token=do-not-expose';
    expect(JSON.stringify(collectClaudeCodeQuota(sensitive, 's1'))).not.toContain(sensitive);
    expect(JSON.stringify(collectAntigravityQuota(sensitive, 's1'))).not.toContain(sensitive);
  });
});
