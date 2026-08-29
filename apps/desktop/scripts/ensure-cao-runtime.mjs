import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') process.exit(0);

const distro = process.env.TASK_HUB_CAO_WSL_DISTRO || 'Ubuntu-24.04';
const user = process.env.TASK_HUB_CAO_WSL_USER || 'rss';
const minimumVersion = '2.5.0';
const script = [
  'set -e',
  'export HOME="$(getent passwd $(whoami) 2>/dev/null | cut -d: -f6 || echo /home/$(whoami))"',
  'export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"',
  `required="${minimumVersion}"`,
  'current="$(cao --version 2>/dev/null | sed -n "s/.*version //p" || true)"',
  'if command -v cao >/dev/null && command -v cao-server >/dev/null && [ -n "$current" ] && [ "$(printf "%s\\n" "$current" "$required" | sort -V | head -n 1)" = "$required" ]; then echo "[CAO] WSL runtime ready ($current)"; exit 0; fi',
  'command -v uv >/dev/null || { echo "[CAO] uv is required in WSL to bootstrap cli-agent-orchestrator" >&2; exit 2; }',
  `echo "[CAO] Installing/upgrading cli-agent-orchestrator >= ${minimumVersion} in WSL..."`,
  'if command -v cao >/dev/null; then uv tool upgrade cli-agent-orchestrator; else uv tool install cli-agent-orchestrator; fi',
  'command -v cao >/dev/null && command -v cao-server >/dev/null || { echo "[CAO] Installation did not expose cao/cao-server" >&2; exit 3; }',
  'cao install code_supervisor >/dev/null 2>&1 || true',
  'echo "[CAO] WSL runtime ready"',
].join('\n');
const encoded = Buffer.from(script, 'utf8').toString('base64');
const result = spawnSync('wsl.exe', ['-d', distro, '-u', user, '--', '/bin/bash', '-lc', `echo ${encoded} | base64 -d | bash`], {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(`[CAO] Could not invoke WSL (${result.error.message}).`);
  process.exit(10);
}
if (result.status !== 0) {
  console.error('[CAO] Runtime bootstrap failed. Install uv in the configured WSL distro, then run: uv tool install cli-agent-orchestrator');
  process.exit(result.status || 11);
}
