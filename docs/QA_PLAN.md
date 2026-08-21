# Task Hub QA plan

As-of commit: `ed247be11f5f7de7870c50a8c98306498e1278af`  
As-of date: 2026-08-21

## Purpose

Provide a repeatable quality strategy for contracts, Hub behavior, Desktop integration, runner execution, security boundaries, and release readiness.

## Scope

The plan covers repository test commands and CI checks, plus manual validation for flows represented in code but not proven by a recorded run.

## Current State

- CI configuration runs contract validation, Hub dependency/build work, `php artisan test`, Desktop typecheck/build, and the Desktop release workflow on `desktop-v*` tags.
- Hub tests are organized into Feature, Unit, Integration, Components, E2E, and Harness directories. Files cover tenancy, pairing, runner/agent workflows, AI/delay behavior, security, imports, reporting, routing, and UI scenarios.
- Runner tests use Node’s built-in test runner at `apps/runner/test/provider.test.mjs`; root `npm run runner:test` invokes them.
- Desktop has typecheck and Vue build scripts, but no Desktop behavioral test suite was found in the inspected file list: TODO.
- Contract validation checks that the OpenAPI and two JSON Schema files are present and readable; it does not establish runtime compatibility by itself.

## Constraints

- No test command was executed for this documentation task; pass/fail status is unknown.
- Tests requiring PostgreSQL, Redis, OAuth, provider executables, or external repositories need controlled fixtures and credentials. Sanctioned CI service/secret setup: TODO.
- Security validation must cover tenant isolation, token scope, pairing authorization, credential redaction, runner ownership, and log leakage.
- Contract changes require coordinated updates to contract artifacts and their validation/fixtures; the handoff schema requires non-empty changed files and tests and disallows extra properties.

## Open Questions

- TODO: What coverage thresholds and failure policies block release?
- TODO: Which tests are deterministic in CI versus service/network dependent?
- TODO: What browser, OS, and Desktop device matrix is required?
- TODO: What load, lease-expiry, queue, log-volume, backup/restore, and disaster-recovery tests are required?

## Test matrix

| Area | Command/evidence | Checks |
| --- | --- | --- |
| Contracts | `node packages/contracts/validate.mjs` | Contract artifacts are present/readable |
| Hub backend | `cd apps/hub; php artisan test` | API, auth, tenancy, migrations, pairing, agents, runners, reports |
| Hub frontend | `cd apps/hub; npm run build` | Vite compilation and assets |
| Desktop static/build | `cd apps/desktop; npx vue-tsc --noEmit`; `npm run build:vue` | Typecheck and Vue bundle |
| Runner | `npm run runner:test` | Provider mapping and redaction |
| Manual/E2E | `apps/hub/tests/E2E` plus Desktop Agent Console | Pairing, context, run, stop, evidence, handoff, recovery |

## Release gates

Run contract validation, Hub tests/build, Desktop typecheck/build, and runner tests. For Desktop tags, run the version check and approved Windows publishing workflow. Record results as evidence or a release record. Exact thresholds: TODO.

Source paths inspected: `.github/workflows/ci.yml`, `.github/workflows/desktop-release.yml`, `package.json`, `apps/hub/package.json`, `apps/desktop/package.json`, `apps/runner/package.json`, `apps/hub/tests`, `apps/hub/tests/run_all_tests.js`, `apps/runner/test/provider.test.mjs`, `packages/contracts/validate.mjs`, `packages/contracts/schemas/agent-handoff.schema.json`.
