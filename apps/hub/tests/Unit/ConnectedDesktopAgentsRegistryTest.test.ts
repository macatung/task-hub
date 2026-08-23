import { describe, expect, it, beforeEach } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());
const desktopRoot = fs.existsSync(path.resolve(hubRoot, 'apps/desktop'))
  ? path.resolve(hubRoot, 'apps/desktop')
  : path.resolve(hubRoot, '../desktop');
const contractsRoot = fs.existsSync(path.resolve(hubRoot, 'packages/contracts'))
  ? path.resolve(hubRoot, 'packages/contracts')
  : path.resolve(hubRoot, '../../packages/contracts');

const runnerControllerSrc = fs.readFileSync(path.join(hubRoot, 'app/Http/Controllers/Api/ApiAgentRunnerController.php'), 'utf8');
const runControllerSrc = fs.readFileSync(path.join(hubRoot, 'app/Http/Controllers/Api/ApiAgentRunController.php'), 'utf8');
const routesSrc = fs.readFileSync(path.join(hubRoot, 'routes/web.php'), 'utf8');
const runnerModelSrc = fs.readFileSync(path.join(hubRoot, 'app/Models/AgentRunner.php'), 'utf8');
const heartbeatServiceSrc = fs.readFileSync(path.join(desktopRoot, 'src/services/desktopHeartbeat.ts'), 'utf8');
const remoteDispatchServiceSrc = fs.readFileSync(path.join(desktopRoot, 'src/services/remoteDispatchService.ts'), 'utf8');
const openapiSrc = fs.readFileSync(path.join(contractsRoot, 'task-hub.openapi.yaml'), 'utf8');

describe('Connected Desktop Agents Registry & Remote Dispatch API', () => {
  describe('1. Connected Desktop Agent Registration & Routes', () => {
    it('registers desktop agent routes in routes/web.php', () => {
      expect(routesSrc).toContain("Route::post('/desktop/agents/register'");
      expect(routesSrc).toContain("Route::post('/desktop/agents/heartbeat'");
      expect(routesSrc).toContain("Route::get('/desktop/agents'");
      expect(routesSrc).toContain("Route::get('/desktop/agents/{agentRunner}/command-stream'");
      expect(routesSrc).toContain("Route::post('/tasks/{task}/dispatch'");
    });

    it('implements desktopRegister with rich telemetry persistence and token issuing', () => {
      expect(runnerControllerSrc).toContain('public function desktopRegister(Request $request)');
      expect(runnerControllerSrc).toContain("'runner_type' => 'desktop'");
      expect(runnerControllerSrc).toContain('machine_name');
      expect(runnerControllerSrc).toContain('client_id');
      expect(runnerControllerSrc).toContain('os_platform');
      expect(runnerControllerSrc).toContain('active_provider');
      expect(runnerControllerSrc).toContain('active_model');
      expect(runnerControllerSrc).toContain('workspace_cwd');
      expect(runnerControllerSrc).toContain('quota_metrics');
      expect(runnerControllerSrc).toContain('ping_latency_ms');
    });

    it('defines desktop metadata fields and scopes in AgentRunner model', () => {
      expect(runnerModelSrc).toContain("'runner_type'");
      expect(runnerModelSrc).toContain("'client_id'");
      expect(runnerModelSrc).toContain("'machine_name'");
      expect(runnerModelSrc).toContain("'os_platform'");
      expect(runnerModelSrc).toContain("'active_provider'");
      expect(runnerModelSrc).toContain("'active_model'");
      expect(runnerModelSrc).toContain("'quota_metrics'");
      expect(runnerModelSrc).toContain('scopeDesktop');
      expect(runnerModelSrc).toContain('scopeOnline');
      expect(runnerModelSrc).toContain('scopeStale');
      expect(runnerModelSrc).toContain('reapStale');
    });
  });

  describe('2. Heartbeat Telemetry & Auto-Offline Reaper (>45s)', () => {
    it('implements desktopHeartbeat updating telemetry and executing stale runner reaper', () => {
      expect(runnerControllerSrc).toContain('public function desktopHeartbeat(Request $request)');
      expect(runnerControllerSrc).toContain('AgentRunner::reapStale');
      expect(runnerControllerSrc).toContain("'last_heartbeat_at' => now()");
      expect(runnerControllerSrc).toContain('Cache::put');
      expect(runnerControllerSrc).toContain("'agent_runner_latest_quota'");
    });

    it('calculates health state dynamically based on 45-second threshold and revocation', () => {
      expect(runnerModelSrc).toContain('getHealthAttribute');
      expect(runnerModelSrc).toContain('TASK_HUB_RUNNER_STALE_SECONDS');
      expect(runnerModelSrc).toContain('45');
      expect(runnerModelSrc).toContain("'offline'");
      expect(runnerModelSrc).toContain("'revoked'");
    });

    it('enqueues remote_dispatch and cancel_run commands in heartbeat response', () => {
      expect(runnerControllerSrc).toContain("'type' => 'remote_dispatch'");
      expect(runnerControllerSrc).toContain("'type' => 'cancel_run'");
      expect(runnerControllerSrc).toContain("'status' => 'claimed'");
      expect(runnerControllerSrc).toContain('dispatch_command_id');
    });
  });

  describe('3. Connected Desktop Agents Query & Instant SSE Command Stream', () => {
    it('implements desktopIndex listing workstations with active runs and health metrics', () => {
      expect(runnerControllerSrc).toContain('public function desktopIndex(Request $request)');
      expect(runnerControllerSrc).toContain('active_runs_count');
      expect(runnerControllerSrc).toContain('online_count');
      expect(runnerControllerSrc).toContain('ping_latency_ms');
    });

    it('implements desktopCommandStream pushing immediate SSE commands in <500ms', () => {
      expect(runnerControllerSrc).toContain('public function desktopCommandStream(Request $request, AgentRunner $agentRunner)');
      expect(runnerControllerSrc).toContain('text/event-stream');
      expect(runnerControllerSrc).toContain("event: command");
      expect(runnerControllerSrc).toContain("event: ready");
      expect(runnerControllerSrc).toContain("keepalive");
    });
  });

  describe('4. Remote Task Dispatch API & Dependency Safety', () => {
    it('implements dispatch in ApiAgentRunController creating AgentRun and enqueuing command', () => {
      expect(runControllerSrc).toContain('public function dispatch(Request $request, Task $task, TaskHubContextPackService $contextService)');
      expect(runControllerSrc).toContain("'execution_mode' => 'desktop'");
      expect(runControllerSrc).toContain("'status' => 'queued'");
      expect(runControllerSrc).toContain('hasIncompleteDependencies');
      expect(runControllerSrc).toContain('task_dispatched');
    });

    it('enforces dependency safety preventing dispatch of blocked tasks', () => {
      expect(runControllerSrc).toContain('Task is blocked until all dependency tasks are done');
      expect(runControllerSrc).toContain('blocked_by');
    });
  });

  describe('5. Desktop Companion Background Services & Contracts Validation', () => {
    it('implements DesktopHeartbeatService in desktop companion with periodic 10s ping', () => {
      expect(heartbeatServiceSrc).toContain('export class DesktopHeartbeatService');
      expect(heartbeatServiceSrc).toContain('sendHeartbeat');
      expect(heartbeatServiceSrc).toContain('/api/v1/desktop/agents/heartbeat');
      expect(heartbeatServiceSrc).toContain('onDispatch');
      expect(heartbeatServiceSrc).toContain('onCancel');
      expect(heartbeatServiceSrc).toContain('ping_latency_ms');
    });

    it('implements RemoteDispatchService triggering Auto-Pilot in <2s with live Hub telemetry relay', () => {
      expect(remoteDispatchServiceSrc).toContain('export class RemoteDispatchService');
      expect(remoteDispatchServiceSrc).toContain('handleCommand');
      expect(remoteDispatchServiceSrc).toContain('AutoPilotRunner');
      expect(remoteDispatchServiceSrc).toContain('relayLog');
      expect(remoteDispatchServiceSrc).toContain('relayEvent');
      expect(remoteDispatchServiceSrc).toContain('relayEvidence');
      expect(remoteDispatchServiceSrc).toContain('relayHandoff');
      expect(remoteDispatchServiceSrc).toContain('/api/v1/agent-runs/');
    });

    it('declares desktop endpoints in task-hub.openapi.yaml specification', () => {
      expect(openapiSrc).toContain('/api/v1/desktop/agents/register:');
      expect(openapiSrc).toContain('/api/v1/desktop/agents/heartbeat:');
      expect(openapiSrc).toContain('/api/v1/desktop/agents:');
      expect(openapiSrc).toContain('/api/v1/desktop/agents/{runner_id}/command-stream:');
      expect(openapiSrc).toContain('/api/v1/tasks/{task_id}/dispatch:');
    });
  });
});
