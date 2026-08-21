# Task Hub product requirements document

As-of commit: `ed247be11f5f7de7870c50a8c98306498e1278af`  
As-of date: 2026-08-21

## Purpose

Describe the observable product behavior represented by the inspected implementation: workspace work management plus controlled AI-agent execution with context, evidence, and human review.

## Scope

Requirements cover authenticated workspaces and members; projects and GitHub links; tasks and sprints; project knowledge documents and task references; releases; REST/MCP interfaces; Desktop pairing and task sync; supervised agent runs; server runner registration/leasing; and AI planning previews.

## Current State

- Tasks support statuses `todo`, `in_progress`, `review`, and `done`, priorities `urgent`, `high`, `medium`, and `low`, acceptance criteria, definition of done, risk, sprint/epic relationships, and workspace/project associations.
- Project documents expose registry metadata such as title, repository path, version, content hash, status, owner, access level, tags, source update time, and verification time; documents can be attached to tasks.
- MCP tools include work-item/context reads, project-document/state reads, agent-run lifecycle, verification evidence, structured handoff, human approval, next action, repository context/file reads, and project-breakdown preview.
- Desktop pairing returns an approved session token for subsequent MCP use; its agent flow performs preflight, worktree setup, MCP configuration, process execution, and handoff submission.
- The handoff JSON Schema requires `run_id`, `summary`, at least one `changed_files` entry, and at least one `tests` entry, and rejects additional properties.

## Constraints

- Project-breakdown preview returns `requires_human_approval`; completed handoffs move into a review-oriented lifecycle in the controller implementation.
- Runner provider support is headless for Codex and Claude Code; Antigravity is declared `external_only` by the runner provider adapter.
- Runner output is redacted for bearer tokens, common token/API-key/password/secret forms, and GitHub token prefixes.
- The OpenAPI file and implemented routes are not identical in breadth: TODO: reconcile and maintain the full public API contract.

## Open Questions

- TODO: Which behaviors are release-blocking requirements versus already-delivered implementation?
- TODO: What roles and permissions are intended beyond observed workspace membership and middleware checks?
- TODO: What limits apply to tasks, documents, runner concurrency, logs, and repositories?
- TODO: What is the required behavior for expired pairing, stale runs, runner loss, and partial handoffs?

## Capability requirements

1. Work management: create and manage workspace-scoped projects, tasks, sprints, priorities, statuses, and next actions.
2. Project knowledge: register canonical documents, import a repository manifest, attach task references, and surface freshness/gaps.
3. Agent supervision: select a task/provider, provide context, execute in a worktree, observe/stop, attach evidence, and submit a structured handoff.
4. Integrations: pair Desktop, connect GitHub, consume repository snapshots/events, and resolve workspace/project credentials.
5. Release visibility: record version, environment, status, summary, changes, commit SHA, URL, actor, and deployment time.

Source paths inspected: `apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php`, `apps/hub/app/Services/TaskHubContextPackService.php`, `apps/hub/app/Services/ProjectKnowledgeService.php`, `apps/hub/app/Http/Controllers/Api/ApiProjectDocumentController.php`, `apps/hub/app/Http/Controllers/DesktopPairingController.php`, `apps/desktop/src/components/AgentConsoleModal.vue`, `packages/contracts/schemas/agent-handoff.schema.json`, `packages/contracts/task-hub.openapi.yaml`.
