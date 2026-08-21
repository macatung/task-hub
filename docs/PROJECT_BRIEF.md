# Task Hub project brief

As-of commit: `ed247be11f5f7de7870c50a8c98306498e1278af`  
As-of date: 2026-08-21

## Purpose

Task Hub is an open-source execution workspace for product teams and AI coding agents. The inspected repository combines project/task management, GitHub-backed delivery context, MCP tools, structured agent handoffs, and a Task Companion desktop client.

## Scope

The repository contains three application surfaces: the Laravel/Vue Hub, the Electron/Vue Desktop client, and the Node server runner. It also contains shared OpenAPI/JSON Schema contracts, Docker Compose infrastructure, database migrations, and automated tests.

The documented product scope includes workspaces, projects, tasks, sprints, project documents, releases, GitHub integration, desktop pairing, supervised agent runs, runner leasing, and AI planning previews. Production ownership, SLOs, deployment inventory, and support commitments are not established by inspected files: TODO.

## Current State

- The root workspace declares `apps/desktop`, `apps/hub`, and `apps/runner`; root scripts expose Hub/Desktop builds, contract validation, and runner tests.
- Hub is Laravel 11 on PHP 8.2 with Inertia/Vue. Its routes include web pages, REST APIs, MCP JSON-RPC, desktop pairing, GitHub OAuth, and runner/agent APIs.
- Desktop exposes Task Hub pairing/MCP calls and agent operations through Electron preload IPC. The main process handles credentials, worktrees, provider processes, and updates.
- The runner registers with Hub, heartbeats, claims server jobs, clones repositories into `/tmp/task-hub-runs`, runs supported providers, redacts streamed output, and reports events/logs/status.
- Migrations and models cover workspace tenancy, projects/tasks/sprints, project knowledge, agent runs/events/logs/evidence, runners, credentials, pairing, GitHub events, usage, releases, and supporting CMS/analytics data.

## Constraints

- Agent prompts and Desktop guardrails require human control over push, merge, deploy, secret access, and other external changes.
- Workspace/project checks and scoped tokens are part of the Hub API/MCP implementation; credentials are stored and exposed through credential-vault abstractions rather than public plaintext views.
- README compatibility states Hub API `v1` and MCP protocol `2024-11-05` for Desktop v1.
- This brief is based on repository evidence only. Unverified deployment, operational, performance, and ownership claims remain TODO.

## Open Questions

- TODO: Who owns production operations, security response, and release approval?
- TODO: Which Hub, runner, and Desktop versions are supported together?
- TODO: What availability, latency, backup-retention, and recovery objectives apply?
- TODO: Which providers and repository-hosting modes are approved for production?
- TODO: What is the authoritative roadmap and release success definition?

Source paths inspected: `README.md`, `package.json`, `apps/hub/composer.json`, `apps/hub/package.json`, `apps/desktop/package.json`, `apps/runner/package.json`, `apps/hub/routes/web.php`, `apps/hub/bootstrap/app.php`, `apps/desktop/electron/main.ts`, `apps/desktop/electron/preload.ts`, `apps/runner/src/index.mjs`, `packages/contracts/task-hub.openapi.yaml`, `packages/contracts/schemas/agent-handoff.schema.json`, `infra/docker/compose.yml`.
