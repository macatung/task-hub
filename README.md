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
# Managed SaaS runners receive scoped credentials per run; do not configure a
# global GitHub token for the runner.
docker compose -f infra/docker/compose.yml up -d --build
docker compose -f infra/docker/compose.yml exec hub php artisan migrate --force
```

Open `http://localhost:8080`. Configure the Desktop app with this base URL; it verifies `/api/v1/capabilities` before device pairing.

## Server agent runner

The managed `runner` service leases `execution_mode=server` agent runs, creates an isolated worktree, and runs headless Codex or Claude Code. GitHub credentials are connected from Workspace Integrations and delivered only as scoped, short-lived run credentials. `TASK_HUB_RUNNER_REGISTRATION_TOKEN` is an internal platform-enrollment setting and is not part of customer setup. Antigravity is reported as `external_only` unless a compatible headless `agy` executable is installed; use Task Companion Desktop for the normal GUI flow.

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
