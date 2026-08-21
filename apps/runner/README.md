# Task Hub Server Agent Runner

The runner registers with Task Hub, leases server-mode jobs, creates an isolated checkout and runs a configured headless provider CLI. Configure provider login profiles and `RUNNER_GITHUB_TOKEN` on the runner host/container; credentials are never sent to the Hub.

Antigravity is reported as `external_only` unless a compatible headless `agy` command is installed. Desktop Task Companion remains the supported GUI path.
