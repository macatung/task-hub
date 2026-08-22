import test from 'node:test';
import assert from 'node:assert/strict';
import { commandFor, PROVIDER_CAPABILITIES, redact } from '../src/provider.mjs';

test('provider adapters expose safe headless commands and capabilities', () => {
  assert.deepEqual(commandFor('codex', { CODEX_COMMAND: '/usr/local/bin/codex' }), ['/usr/local/bin/codex', ['exec', '--full-auto']]);
  assert.deepEqual(commandFor('codex', {}, 'gpt-5'), ['codex', ['exec', '--full-auto', '-m', 'gpt-5']]);
  assert.deepEqual(commandFor('claude_code'), ['claude', ['-p']]);
  assert.deepEqual(commandFor('claude_code', {}, 'claude-3-7-sonnet-20250219'), ['claude', ['-p', '--model', 'claude-3-7-sonnet-20250219']]);
  assert.deepEqual(commandFor('antigravity', {}, 'gemini-2.5-pro'), ['agy', ['--model', 'gemini-2.5-pro']]);
  assert.deepEqual(PROVIDER_CAPABILITIES.antigravity, ['external_only']);
  assert.throws(() => commandFor('unknown'));
});

test('log redaction removes bearer and GitHub token patterns', () => {
  assert.equal(redact('Authorization: Bearer abc123 ghp_secretvalue'), 'Authorization: Bearer [REDACTED] [REDACTED]');
});
