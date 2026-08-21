# Task Hub release runbook

As-of commit: `ed247be11f5f7de7870c50a8c98306498e1278af`  
As-of date: 2026-08-21

## Purpose

Provide evidence-based release and rollback guidance for Hub, runner, contracts, and Windows Desktop artifacts while preserving human approval for external changes.

## Scope

This covers pre-release validation, self-hosted Compose/migration operations, Desktop tag releases, release records, backup/restore checks, smoke checks, and rollback decision points. It does not authorize deployment from this worktree.

## Current State

- CI is configured for pushes to `main` and pull requests; the Desktop workflow targets `desktop-v*`, checks the package version, builds, and publishes through `electron-builder --win --publish always` with `GITHUB_TOKEN`.
- README documents `docker compose -f infra/docker/compose.yml up -d --build` and `php artisan migrate --force` in the Hub container. Compose includes Hub, worker, scheduler, runner, PostgreSQL, and Redis.
- Hub has a project-release API/model with version, environment, status (`deployed`, `rolled_back`, `failed`), summary, changes, commit SHA, release URL, actor, and deployment time.
- `docs/operations/backup-and-restore.md` provides PostgreSQL dump, volume preservation, isolated restore, migration, and smoke-check guidance.
- A complete production deployment workflow, rollback script, current deployment inventory, and release approval ownership are not present: TODO.

## Constraints

- Do not publish, deploy, merge, or alter deployment state while generating these documents.
- Keep `APP_KEY`, database passwords, OAuth secrets, MCP tokens, webhook secrets, and runner registration tokens in approved secret management; never commit or log them.
- Apply migrations only through the approved target-environment process and verify backup/restore readiness before promotion.
- Desktop releases require a `desktop-v*` tag and a passing version check. Hub/runner sequencing and compatibility enforcement: TODO.

## Open Questions

- TODO: Who approves production release and rollback, and where is that approval recorded?
- TODO: What environments, domains, registries, and secret stores are authoritative?
- TODO: Is rollback an image, migration, Desktop artifact, or coordinated release set?
- TODO: What backup schedule, retention, encryption, restore RTO/RPO, and evidence retention apply?
- TODO: Where are release notes, deployment logs, health dashboards, and incidents stored?

## Procedure

1. Confirm target commit, change summary, migration impact, compatibility, and human approval.
2. Run the QA gates in `docs/QA_PLAN.md`; save outputs and verification evidence.
3. Confirm backup freshness and restore readiness using `docs/operations/backup-and-restore.md`.
4. Under the approved deployment process, start the Compose topology, migrate, and smoke-test health, capabilities, auth, pairing, MCP, queues, scheduler, and runners.
5. For Desktop, verify the package version, create the approved `desktop-v<version>` tag, and verify the Windows artifact/update metadata. Artifact acceptance checks: TODO.
6. Record the release through the project-release API with commit SHA, environment, status, summary, changes, actor, and deployment time.
7. On a failed gate or smoke check, stop promotion, preserve evidence, mark the release failed, and use the approved rollback procedure. Concrete rollback commands: TODO.

## Smoke checks

Check `/up`, `/api/v1/capabilities`, authenticated workspace/project/task reads, MCP `initialize` and `tools/list`, Desktop pairing approval/status, context-pack retrieval, a non-destructive agent lifecycle, runner heartbeat/claim where enabled, release visibility, and absence of credentials in logs.

Source paths inspected: `.github/workflows/ci.yml`, `.github/workflows/desktop-release.yml`, `README.md`, `infra/docker/compose.yml`, `apps/hub/docker/entrypoint.sh`, `apps/hub/app/Http/Controllers/Api/ApiProjectReleaseController.php`, `apps/hub/app/Models/ProjectRelease.php`, `docs/operations/backup-and-restore.md`, `packages/contracts/task-hub.openapi.yaml`.
