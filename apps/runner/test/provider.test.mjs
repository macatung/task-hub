import test from 'node:test';
import assert from 'node:assert/strict';
import { commandFor, PROVIDER_CAPABILITIES, redact } from '../src/provider.mjs';

test('provider adapters expose safe headless commands and capabilities', () => {
  assert.deepEqual(commandFor('codex', { CODEX_COMMAND: '/usr/local/bin/codex' }), ['/usr/local/bin/codex', ['exec', '--full-auto']]);
  assert.deepEqual(commandFor('claude_code'), ['claude', ['-p']]);
  assert.deepEqual(PROVIDER_CAPABILITIES.antigravity, ['external_only']);
  assert.throws(() => commandFor('unknown'));
});

test('log redaction removes bearer and GitHub token patterns', () => {
  assert.equal(redact('Authorization: Bearer abc123 ghp_secretvalue'), 'Authorization: Bearer [REDACTED] [REDACTED]');
});
