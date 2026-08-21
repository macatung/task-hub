# Task Hub Server Agent Runner

The runner registers with Task Hub, leases server-mode jobs, requests a short-lived credential scoped to the claimed workspace/project, creates an isolated checkout and runs a configured headless provider CLI. Credentials are never configured globally on the runner.

Antigravity is reported as `external_only` unless a compatible headless `agy` command is installed. Desktop Task Companion remains the supported GUI path.
