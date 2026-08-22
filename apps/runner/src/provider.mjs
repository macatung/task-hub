export const PROVIDER_CAPABILITIES = {
  codex: ['headless', 'stream', 'cancel', 'handoff'],
  claude_code: ['headless', 'stream', 'cancel', 'handoff'],
  antigravity: ['external_only'],
};

export function commandFor(provider, env = {}, model = null) {
  const modelStr = model && model !== 'default' ? String(model).trim() : null;
  if (provider === 'codex') return [env.CODEX_COMMAND || 'codex', ['exec', '--full-auto', ...(modelStr ? ['-m', modelStr] : [])]];
  if (provider === 'claude_code') return [env.CLAUDE_COMMAND || 'claude', ['-p', ...(modelStr ? ['--model', modelStr] : [])]];
  if (provider === 'antigravity') return [env.ANTIGRAVITY_COMMAND || 'agy', [...(modelStr ? ['--model', modelStr] : [])]];
  throw new Error(`Unsupported provider: ${provider}`);
}

export function redact(value) {
  return value
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:token|api[_-]?key|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[REDACTED]');
}
