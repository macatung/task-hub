import { spawn } from 'node:child_process';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { commandFor, PROVIDER_CAPABILITIES, redact } from './provider.mjs';

const HUB_URL = (process.env.TASK_HUB_URL || 'http://hub:8080').replace(/\/$/, '');
const NAME = process.env.RUNNER_NAME || `${os.hostname()}-runner`;
const PROVIDERS = (process.env.RUNNER_PROVIDERS || 'codex,claude_code,antigravity').split(',').map((v) => v.trim()).filter(Boolean);
const POLL_MS = Number(process.env.RUNNER_POLL_MS || 3000);
const WORK_ROOT = process.env.RUNNER_WORK_ROOT || '/tmp/task-hub-runs';
let runnerId = process.env.RUNNER_ID || null;
let token = process.env.TASK_HUB_RUNNER_TOKEN || null;
let stopping = false;
const active = new Map();
const cancelledRuns = new Set();

const capabilities = Object.fromEntries(PROVIDERS.map((provider) => [provider, PROVIDER_CAPABILITIES[provider] || []]));

async function request(url, options = {}) {
  const retries = Number(process.env.RUNNER_REQUEST_RETRIES || 4);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${HUB_URL}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body;
      // Authentication and validation errors are permanent; retries would only duplicate work.
      if ([400, 401, 403, 404, 409, 422].includes(response.status)) throw new Error(body.message || `Hub request failed (${response.status})`);
      lastError = new Error(body.message || `Hub request failed (${response.status})`);
    } catch (error) {
      lastError = error;
      if (/\((400|401|403|404|409|422)\)$/.test(error.message)) throw error;
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * (2 ** attempt), 8000) + Math.floor(Math.random() * 250)));
  }
  throw lastError;
}

async function register() {
  if (runnerId && token) return;
  const body = await fetch(`${HUB_URL}/api/v1/runners/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Task-Hub-Runner-Registration': process.env.TASK_HUB_RUNNER_REGISTRATION_TOKEN || '' }, body: JSON.stringify({ name: NAME, hostname: os.hostname(), version: '1.0.0', capabilities, metadata: { platform: process.platform, arch: process.arch } }) }).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.message || 'Runner registration failed'); return b; });
  runnerId = body.runner.id; token = body.token;
  console.log(JSON.stringify({ event: 'runner_registered', runner_id: runnerId, name: NAME, providers: PROVIDERS }));
}

async function heartbeat(status = 'online') {
  if (!runnerId) return;
  const body = await request(`/api/v1/runners/${runnerId}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ status, capabilities, active_run_ids: [...active.keys()] }),
  });
  for (const command of body.commands || []) {
    if (command.type !== 'cancel') continue;
    const firstCancellation = !cancelledRuns.has(command.run_id);
    cancelledRuns.add(command.run_id);
    const child = active.get(command.run_id);
    if (child && !child.killed) child.kill('SIGTERM');
    if (firstCancellation) await emit(command.run_id, 'run_cancelled', 'cancelled', { requested_at: command.requested_at });
  }
}

function emit(runId, eventType, status, payload = {}) {
  return request(`/api/v1/agent-runs/${runId}/events`, { method: 'POST', body: JSON.stringify({ event_id: crypto.randomUUID(), event_type: eventType, status, payload }) }).catch(() => {});
}

function log(runId, sequence, stream, content) {
  return request(`/api/v1/agent-runs/${runId}/logs`, { method: 'POST', body: JSON.stringify({ sequence, stream, content }) }).catch(() => {});
}

function runProcess(command, args, cwd, prompt, runId, captureLogs = true, envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', CI: '1', ...envOverrides }, stdio: ['pipe', 'pipe', 'pipe'] });
    active.set(runId, child);
    let sequence = 0;
    const consume = (stream, data) => { const text = redact(data.toString()); process.stdout.write(`[${runId}] ${text}`); if (captureLogs) void log(runId, sequence++, stream, text); };
    child.stdout.on('data', (data) => consume('stdout', data)); child.stderr.on('data', (data) => consume('stderr', data));
    child.on('error', (error) => resolve({ code: 127, error: error.message }));
    child.on('close', (code, signal) => { active.delete(runId); resolve({ code: code ?? 1, signal }); });
    child.stdin.end(prompt);
  });
}

async function git(cwd, args, envOverrides = {}) {
  const result = await runProcess('git', args, cwd, '', `git-${Date.now()}`, false, envOverrides);
  if (result.code !== 0) throw new Error(`git ${args[0]} failed`);
}

async function prepare(run, githubToken = null) {
  if (!run.repository) throw new Error('Run has no repository.');
  if (run.provider === 'antigravity') throw new Error('Antigravity is external_only on server runners; use Desktop Task Companion.');
  const dir = path.join(WORK_ROOT, `run-${run.id}`);
  await rm(dir, { recursive: true, force: true }); await mkdir(WORK_ROOT, { recursive: true });
  const tokenValue = githubToken;
  const remote = run.repository.startsWith('git@') ? run.repository : (tokenValue ? `https://x-access-token@github.com/${run.repository}.git` : `https://github.com/${run.repository}.git`);
  let askpass;
  const gitEnv = {};
  if (tokenValue && remote.startsWith('https://')) {
    askpass = path.join(WORK_ROOT, `.askpass-${run.id}.sh`);
    await writeFile(askpass, `#!/bin/sh\nprintf '%s\\n' '${tokenValue.replace(/'/g, "'\\''")}'\n`, { mode: 0o700 });
    await chmod(askpass, 0o700);
    gitEnv.GIT_ASKPASS = askpass; gitEnv.GIT_USERNAME = 'x-access-token'; gitEnv.GIT_TERMINAL_PROMPT = '0';
  }
  try { await git(WORK_ROOT, ['clone', '--depth', '1', remote, dir], gitEnv); } finally { if (askpass) await rm(askpass, { force: true }); }
  const branch = run.branch || `agent/task-${run.task_id || run.id}`;
  await git(dir, ['checkout', '-b', branch]);
  return { dir, branch };
}

async function execute(run) {
  await emit(run.id, 'preparing', 'preparing');
  const credential = await request(`/api/v1/runners/${runnerId}/jobs/${run.id}/credential?provider=github`).catch(() => ({}));
  const workspace = await prepare(run, credential.credential || null);
  if (cancelledRuns.delete(run.id)) return;
  const model = run.metadata?.model || run.model || run.metadata?.context?.model || null;
  const [command, args] = commandFor(run.provider, process.env, model);
  const context = run.metadata?.context || {};
  const prompt = `Task Hub supervised server run. Work only on task ${run.task_id || run.id}. Do not merge, deploy, access secrets, or perform external changes. Implement the task, run the declared tests, and finish with a structured handoff.\n\n${JSON.stringify(context)}`;
  const result = await runProcess(command, args, workspace.dir, prompt, run.id);
  if (cancelledRuns.delete(run.id)) return;
  if (result.code !== 0) { await emit(run.id, 'agent_failed', 'failed', { exit_code: result.code, signal: result.signal }); return; }
  await emit(run.id, 'agent_finished', 'waiting_input', { exit_code: 0, branch: workspace.branch });
  await request(`/api/v1/agent-runs/${run.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'waiting_input', branch: workspace.branch, metadata: { runner_workspace: workspace.dir } }) }).catch(() => {});
}

async function poll(provider) {
  const body = await request(`/api/v1/runners/${runnerId}/jobs/claim?provider=${encodeURIComponent(provider)}`);
  if (body.data) { void execute(body.data).catch(async (error) => { await emit(body.data.id, 'runner_failed', 'failed', { message: error.message }); }); }
}

async function main() {
  await register();
  const timer = setInterval(() => { void heartbeat(active.size ? 'busy' : 'online').catch(() => {}); }, 30000);
  process.on('SIGTERM', () => { stopping = true; clearInterval(timer); for (const child of active.values()) child.kill('SIGTERM'); });
  while (!stopping) { for (const provider of PROVIDERS) { try { await poll(provider); } catch (error) { console.error(error.message); } } await new Promise((resolve) => setTimeout(resolve, POLL_MS)); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
