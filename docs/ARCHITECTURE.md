# Task Hub architecture

As-of commit: `ed247be11f5f7de7870c50a8c98306498e1278af`  
As-of date: 2026-08-21

## Purpose

Describe the implemented component boundaries, request paths, persistence ownership, and supervised execution lifecycle of the Task Hub repository.

## Scope

This covers the monorepo applications, shared contracts, Laravel HTTP/console layers, migrations/models, Desktop IPC/UI boundary, runner protocol, Docker topology, GitHub integration, and credential handling.

## Current State

- `apps/hub` is the system of record. Laravel routes dispatch to controllers, services, Eloquent models, queues, and scheduled console commands.
- Hub configuration targets PostgreSQL and Redis. `infra/docker/compose.yml` defines web, worker, scheduler, runner, PostgreSQL, Redis, volumes, port 8080, and runner resource/security settings.
- `apps/desktop` is an Electron/Vue client. Renderer code calls preload-exposed `desktopApi`; the Electron main process owns filesystem/worktree and child-process operations.
- `apps/runner` is a Node process that registers at `/api/v1/runners/register`, heartbeats, claims provider jobs, resolves scoped credentials, clones repositories, runs providers, and posts events/logs/status.
- `packages/contracts` contains the OpenAPI document, agent-handoff and runner-registration schemas, and a presence/readability validator.
- Migrations establish workspaces/members, canonical projects, tasks/sprints, documents, agent runs/events/logs/evidence, runners, credentials, pairing sessions, GitHub integration/events, releases, usage, and supporting tables.

## Constraints

- Tenant boundaries rely on workspace context/middleware, project and workspace IDs, pairing session tokens, and project MCP token checks; new endpoints must preserve these checks.
- Secrets enter through configuration or credential records. Runner credentials are scoped per run, askpass files are removed after clone, and streamed output is redacted.
- Runner Compose settings include read-only filesystem, dropped capabilities, `no-new-privileges`, `/tmp`, and CPU/memory limits.
- Legacy/unscoped API aliases coexist with workspace-prefixed/versioned routes. Deprecation/removal policy: TODO.
- A separate API gateway, distributed tracing, and production deployment manifest are not present in the inspected repository: TODO: confirm whether external systems provide them.

## Open Questions

- TODO: What is the production topology and how are migrations, workers, scheduler, and runners scaled?
- TODO: What formal threat model governs MCP tokens, pairing secrets, OAuth, and repository credentials?
- TODO: How are idempotency, retries, lease expiry, and runner failover operated?
- TODO: Which API aliases are compatibility commitments and which are legacy?

## Key flows

Desktop: preflight provider/repository → create or reuse worktree → pair and obtain approval → configure MCP → build context → create/update run → execute provider → capture result → submit handoff → human review.

Server: register → heartbeat → atomically claim provider job → resolve credential → depth-1 clone/branch → run provider with redacted logs → post events/status → await handoff/review.

Source paths inspected: `apps/hub/routes/web.php`, `apps/hub/routes/console.php`, `apps/hub/bootstrap/app.php`, `apps/hub/app/Services/TaskHubContextPackService.php`, `apps/hub/app/Services/CredentialVaultService.php`, `apps/hub/app/Http/Controllers/Api/ApiAgentRunnerController.php`, `apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php`, `apps/desktop/electron/main.ts`, `apps/desktop/electron/preload.ts`, `apps/runner/src/index.mjs`, `apps/runner/src/provider.mjs`, `infra/docker/compose.yml`, `apps/hub/database/migrations`, `packages/contracts`.
