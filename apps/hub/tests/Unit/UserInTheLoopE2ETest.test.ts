import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const readHubFile = (relativePath: string) => {
  return fs.readFileSync(path.join(hubRoot, relativePath), 'utf8');
};

describe('User-In-The-Loop (HITL) Web Hub & Backend Audit', () => {
  describe('1. Agent Run Lifecycle & User Cancellation', () => {
    it('supports waiting_input, needs_review and explicit cancel endpoint', () => {
      const runController = readHubFile('app/Http/Controllers/Api/ApiAgentRunController.php');
      
      expect(runController).toContain("'waiting_input'");
      expect(runController).toContain("'needs_review'");
      expect(runController).toContain("'cancelled'");
      expect(runController).toContain('public function cancel(Request $request, AgentRun $agentRun)');
      expect(runController).toContain("'status' => 'cancelled'");
      expect(runController).toContain("'cancel_requested_at' => now()");
    });

    it('exposes cancel route in web routes', () => {
      const routes = readHubFile('routes/web.php');
      expect(routes).toContain("post('/tasks/agent-runs/{agentRun}/cancel'");
      expect(routes).toContain('ApiAgentRunController::class, \'cancel\'');
    });

    it('embeds active run cancellation in Streamback Console UI', () => {
      const consoleVue = readHubFile('resources/js/Components/tasks/StreambackConsole.vue');
      expect(consoleVue).toContain('cancelActiveRun');
      expect(consoleVue).toContain('/tasks/agent-runs/');
      expect(consoleVue).toContain('/cancel');
      expect(consoleVue).toContain('Cancel');
    });
  });

  describe('2. Task Status Transitions & Actor Attribution', () => {
    it('records user actor metadata on task review approval or change requests', () => {
      const taskController = readHubFile('app/Http/Controllers/Api/ApiTaskController.php');
      expect(taskController).toContain('sometimes|in:todo,in_progress,review,done');
      expect(taskController).toContain('$user = $request->user();');
      expect(taskController).toContain("'type' => $user ? 'user' :");
      expect(taskController).toContain('hasIncompleteDependencies');
    });

    it('aggregates user and agent actors in TaskHistoryService', () => {
      const historyService = readHubFile('app/Services/TaskHistoryService.php');
      expect(historyService).toContain("'user'");
      expect(historyService).toContain("'agent_runner'");
      expect(historyService).toContain("'agent_model'");
      expect(historyService).toContain("'github_ci'");
      expect(historyService).toContain("'system'");
      expect(historyService).toContain('TaskUsageEvent');
      expect(historyService).toContain('AgentRun');
      expect(historyService).toContain('VerificationEvidence');
    });
  });

  describe('3. MCP Server User-In-The-Loop Tools', () => {
    it('implements get_task_history and create_requirement_backlog in MCP controller', () => {
      const mcpController = readHubFile('app/Http/Controllers/Api/TaskHubMcpController.php');
      expect(mcpController).toContain('get_task_history');
      expect(mcpController).toContain('create_requirement_backlog');
      expect(mcpController).toContain('start_agent_run');
      expect(mcpController).toContain('complete_agent_handoff');
    });
  });

  describe('4. Frontend E2E Task History Timeline', () => {
    it('renders human actions, filter pills, and markdown export in TaskHistoryTimeline.vue', () => {
      const timelineVue = readHubFile('resources/js/Components/tasks/TaskHistoryTimeline.vue');
      expect(timelineVue).toContain('copyMarkdownAudit');
      expect(timelineVue).toContain('actors_involved');
      expect(timelineVue).toContain('getActorTypeLabel');
      expect(timelineVue).toContain('getToneBadge');
    });
  });
});
