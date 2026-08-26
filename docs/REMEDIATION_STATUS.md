# Task Hub remediation status

This document tracks the security and reliability findings from the August 2026
architecture review.  Items are fixed in priority order; a check mark means the
code change and its focused regression coverage have both been completed.

| Priority | Finding | Status | Evidence |
| --- | --- | --- | --- |
| Critical | Sprint APIs can be used without authentication or tenant checks. | Fixed | `auth + workspace` boundary, scoped controller queries, and regression test. |
| Critical | Desktop runner registration can fall back to the first workspace. | Fixed | Registration now requires an approved pairing credential or authenticated workspace user. |
| High | MCP configuration responses disclose a reusable bearer token. | Fixed | Existing tokens are never returned; generated tokens are one-time responses. |
| High | MCP authentication decrypts every project token on a request. | Fixed | Indexed SHA-256 token hash with migration backfill; explicit-project fallback only. |
| High | Desktop offline changes have no durable retry/outbox. | Fixed | Persistent per-project outbox, ordered replay, and server-side create idempotency. |
| Medium | Desktop credentials fall back to reversible Base64 storage. | Fixed | Credential persistence now fails closed without OS secure storage. |
| Medium | Core orchestration is mixed with content/experience features. | Accepted architecture debt | Requires a separate module-extraction project; no safe small code fix. |

## Verification policy

Each completed row must have a focused automated test plus the relevant build or
type check recorded in the final verification section of this file.

## Verification log

- `npm --workspace apps/desktop run typecheck` — passed.
- `npm run contracts:validate` — passed.
- PHP 8.2 container lint for all modified PHP files and the new feature test — passed.
- `php artisan test tests/Feature/SecurityRemediationTest.php` — passed in a PHP 8.2 Docker container with SQLite enabled.
