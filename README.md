# Task Hub

Task Hub is an open-source execution workspace for product teams and AI coding agents. It combines project/task management, GitHub-backed delivery context, MCP tools, structured agent handoffs, and the Task Companion desktop client.

## Repository layout

- `apps/hub` — Laravel 11 + Inertia/Vue Hub, REST API, MCP and device pairing.
- `apps/desktop` — Electron client for supervised Codex, Claude Code and Antigravity runs.
- `packages/contracts` — versioned OpenAPI and JSON Schema contracts.
- `infra/docker` — self-hosted PostgreSQL, Redis, web, worker and scheduler topology.

## Quick start

```bash
cp apps/hub/.env.example apps/hub/.env
# Set APP_KEY, POSTGRES_PASSWORD and GitHub OAuth credentials.
# Task Companion executes Codex, Claude Code and Antigravity locally using the
# user's existing local installation and account. Hub does not need model API
# keys for these agents.
docker compose -f infra/docker/compose.yml up -d --build
docker compose -f infra/docker/compose.yml exec hub php artisan migrate --force
```

Open `http://localhost:8080`. Configure the Desktop app with this base URL; it verifies `/api/v1/capabilities` before device pairing.

## Local agent execution

The current release is desktop-only for agent execution. Task Companion checks
the local Codex, Claude Code or Antigravity installation, creates an isolated
worktree, starts the local agent, and reports lifecycle/evidence back to Hub.
The server-side runner code and contracts remain reserved for a later release
and are disabled by default.

## Compatibility

Hub and Desktop are released using semantic versions. Desktop v1 requires Hub API `v1` and MCP protocol `2024-11-05`. See [contracts](packages/contracts) before extending REST or MCP interfaces.

## Migration from the legacy portfolio

1. Freeze writes on the legacy Task Hub.
2. Run `php artisan taskhub:export-legacy /secure/task-hub-export.json` in the legacy application.
3. Run `php artisan taskhub:import-legacy /secure/task-hub-export.json --dry-run`, then rerun without `--dry-run` in this Hub.
4. Validate counts/checksums, reconnect GitHub, regenerate MCP credentials, then enable writes.

Exports intentionally omit passwords, OAuth tokens, webhook secrets and MCP credentials.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and the [public roadmap](docs/ROADMAP.md). Task Hub is licensed under [MIT](LICENSE).
