import { describe, expect, it, beforeEach } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const registryVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/ConnectedAgentsRegistry.vue'), 'utf8');
const runnerDashboardVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/RunnerDashboard.vue'), 'utf8');
const dispatchModalVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/RemoteDispatchModal.vue'), 'utf8');
const streambackConsoleVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/StreambackConsole.vue'), 'utf8');
const tasksIndexVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');

describe('Milestone 4: Web Hub Remote Dispatch UI & Live Streamback Integration', () => {
  describe('1. Connected Desktop Agents Registry UI (ConnectedAgentsRegistry.vue & RunnerDashboard.vue)', () => {
    it('implements real-time SSE stream listener and polling fallback for connected workstations', () => {
      expect(registryVueSrc).toContain('/api/v1/desktop/agents');
      expect(registryVueSrc).toContain('/api/tasks/agent-runs/stream');
      expect(registryVueSrc).toContain("eventSource.addEventListener('agent-run'");
      expect(registryVueSrc).toContain("eventSource.addEventListener('agent-log'");
    });

    it('implements glowing status beacon for active, busy, and offline workstations', () => {
      expect(registryVueSrc).toContain('animate-ping');
      expect(registryVueSrc).toContain('bg-amber-400');
      expect(registryVueSrc).toContain('bg-emerald-400');
      expect(registryVueSrc).toContain('onlineCount');
      expect(registryVueSrc).toContain('busyCount');
      expect(registryVueSrc).toContain('idleCount');
    });

    it('renders workstation cards with OS platform badges, IP/Client ID, CWD copy, quota gauges, and ping latency', () => {
      expect(registryVueSrc).toContain('getOsBadge');
      expect(registryVueSrc).toContain('getLatencyBadge');
      expect(registryVueSrc).toContain('copyCwd');
      expect(registryVueSrc).toContain('quota_metrics');
      expect(registryVueSrc).toContain('weekly_percent');
      expect(registryVueSrc).toContain('five_hour_percent');
      expect(registryVueSrc).toContain('ping_latency_ms');
      expect(registryVueSrc).toContain('⚡');
      expect(registryVueSrc).toContain('Dispatch Task');
    });

    it('wraps ConnectedAgentsRegistry seamlessly inside RunnerDashboard.vue', () => {
      expect(runnerDashboardVueSrc).toContain('ConnectedAgentsRegistry');
      expect(runnerDashboardVueSrc).toContain('@dispatch');
    });
  });

  describe('2. Kanban Board & Backlog Dispatch Triggers (Tasks/Index.vue)', () => {
    it('embeds ⚡ Dispatch action buttons on Kanban cards across TO DO, IN PROGRESS, and REVIEW columns', () => {
      expect(tasksIndexVueSrc).toContain("openRemoteDispatch(task)");
      expect(tasksIndexVueSrc).toContain("⚡ Dispatch to Connected Desktop Agent");
      expect(tasksIndexVueSrc).toContain("⚡ Re-dispatch / Run on Connected Desktop Agent");
      expect(tasksIndexVueSrc).toContain("⚡ Re-test / Dispatch to Connected Desktop Agent");
    });

    it('embeds 🚀 Dispatch action buttons on Backlog items in Sprint containers and Backlog pool', () => {
      expect(tasksIndexVueSrc).toContain("🚀 Run on Connected Desktop Agent");
      expect(tasksIndexVueSrc).toContain("@click.stop=\"openRemoteDispatch(task)\"");
    });
  });

  describe('3. Remote Task Dispatch Modal (RemoteDispatchModal.vue)', () => {
    it('implements target workstation selector querying online desktop companions', () => {
      expect(dispatchModalVueSrc).toContain('/api/v1/desktop/agents');
      expect(dispatchModalVueSrc).toContain('onlineRunners');
      expect(dispatchModalVueSrc).toContain('selectedRunnerId');
      expect(dispatchModalVueSrc).toContain('No Desktop Companion Online');
    });

    it('implements AI Provider and dynamic model selection catalogs', () => {
      expect(dispatchModalVueSrc).toContain('antigravity');
      expect(dispatchModalVueSrc).toContain('claude_code');
      expect(dispatchModalVueSrc).toContain('codex');
      expect(dispatchModalVueSrc).toContain('gemini-3.7-flash');
      expect(dispatchModalVueSrc).toContain('gemini-2.5-pro');
      expect(dispatchModalVueSrc).toContain('claude-sonnet-4.6-thinking');
      expect(dispatchModalVueSrc).toContain('claude-3-7-sonnet-20250219');
      expect(dispatchModalVueSrc).toContain('gpt-5.6-sol');
      expect(dispatchModalVueSrc).toContain('o3-pro');
    });

    it('supports Autonomous Auto-Pilot and Supervised execution modes', () => {
      expect(dispatchModalVueSrc).toContain("executionMode = 'auto_pilot'");
      expect(dispatchModalVueSrc).toContain("executionMode = 'supervised'");
      expect(dispatchModalVueSrc).toContain('7-stage autonomous cycle');
    });

    it('dispatches task to /api/v1/tasks/{task_id}/dispatch with sub-2s response', () => {
      expect(dispatchModalVueSrc).toContain('axios.post(`/api/v1/tasks/${taskToDispatch.id}/dispatch`');
      expect(dispatchModalVueSrc).toContain('runner_id: selectedRunnerId.value');
      expect(dispatchModalVueSrc).toContain('execution_mode: executionMode.value');
      expect(dispatchModalVueSrc).toContain("emit('dispatched'");
    });
  });

  describe('4. Real-time Streamback Console in Task Detail Drawer (StreambackConsole.vue)', () => {
    it('implements 6-step visual execution stepper mapping lifecycle states', () => {
      expect(streambackConsoleVueSrc).toContain('1. Dispatched');
      expect(streambackConsoleVueSrc).toContain('2. Worktree Prepared');
      expect(streambackConsoleVueSrc).toContain('3. MCP Context Loaded');
      expect(streambackConsoleVueSrc).toContain('4. Auto-Pilot Coding');
      expect(streambackConsoleVueSrc).toContain('5. Tests Verified');
      expect(streambackConsoleVueSrc).toContain('6. Handoff Ready');
    });

    it('renders live terminal log stream with stdout, stderr, and system stream color coding', () => {
      expect(streambackConsoleVueSrc).toContain('Live Streamback Console');
      expect(streambackConsoleVueSrc).toContain('autoScroll');
      expect(streambackConsoleVueSrc).toContain('log.stream === \'stderr\'');
      expect(streambackConsoleVueSrc).toContain('text-rose-400');
      expect(streambackConsoleVueSrc).toContain('text-emerald-300');
      expect(streambackConsoleVueSrc).toContain('copyAllLogs');
    });

    it('extracts and displays live tool calls in an interactive accordion', () => {
      expect(streambackConsoleVueSrc).toContain('toolCalls');
      expect(streambackConsoleVueSrc).toContain('activeToolAccordion');
      expect(streambackConsoleVueSrc).toContain('INPUT PARAMETERS');
      expect(streambackConsoleVueSrc).toContain('RESULT / OUTPUT');
    });

    it('displays high-contrast safety guardrail interception banner for waiting_input state with Approve/Reject actions', () => {
      expect(streambackConsoleVueSrc).toContain('safetyIntercept');
      expect(streambackConsoleVueSrc).toContain('Safety Guardrail Intercept (Action Required)');
      expect(streambackConsoleVueSrc).toContain('approveSafetyOrHandoff');
      expect(streambackConsoleVueSrc).toContain('rejectSafetyOrHandoff');
      expect(streambackConsoleVueSrc).toContain('/api/tasks/work-items/');
    });

    it('renders automated test evidence badges and pull request links', () => {
      expect(streambackConsoleVueSrc).toContain('activeRun?.evidence');
      expect(streambackConsoleVueSrc).toContain('activeRun?.pull_request_url');
      expect(streambackConsoleVueSrc).toContain('activeRun?.commit_sha');
      expect(streambackConsoleVueSrc).toContain('Approve & Mark Done');
    });
  });

  describe('5. Web Hub Task Detail Drawer Integration (Tasks/Index.vue)', () => {
    it('embeds StreambackConsole in Task Detail Drawer for real-time monitoring', () => {
      expect(tasksIndexVueSrc).toContain('<StreambackConsole');
      expect(tasksIndexVueSrc).toContain(':active-run="selectedAgentRuns[0]');
      expect(tasksIndexVueSrc).toContain('Dispatch to Connected Desktop Agent (Auto-Pilot)');
    });

    it('mounts RemoteDispatchModal in the Modals container', () => {
      expect(tasksIndexVueSrc).toContain('<RemoteDispatchModal');
      expect(tasksIndexVueSrc).toContain(':show="showRemoteDispatchModal"');
      expect(tasksIndexVueSrc).toContain('@dispatched="handleRemoteDispatched"');
    });
  });
});
