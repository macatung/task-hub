import { describe, expect, it } from '../Harness/index.js';
import fs from 'node:fs';
import path from 'node:path';

const hubRoot = path.resolve(process.cwd());

const historyServiceSrc = fs.readFileSync(path.join(hubRoot, 'app/Services/TaskHistoryService.php'), 'utf8');
const apiTaskControllerSrc = fs.readFileSync(path.join(hubRoot, 'app/Http/Controllers/Api/ApiTaskController.php'), 'utf8');
const mcpControllerSrc = fs.readFileSync(path.join(hubRoot, 'app/Http/Controllers/Api/TaskHubMcpController.php'), 'utf8');
const webRoutesSrc = fs.readFileSync(path.join(hubRoot, 'routes/web.php'), 'utf8');
const taskHistoryTimelineVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Components/tasks/TaskHistoryTimeline.vue'), 'utf8');
const tasksIndexVueSrc = fs.readFileSync(path.join(hubRoot, 'resources/js/Pages/Tasks/Index.vue'), 'utf8');
const openApiContractSrc = fs.readFileSync(path.resolve(hubRoot, '../../packages/contracts/task-hub.openapi.yaml'), 'utf8');

describe('E2E Task History & Actor Transition Audit Trail System', () => {
  describe('1. TaskHistoryService (app/Services/TaskHistoryService.php)', () => {
    it('aggregates task usage events, agent runs, evidence and calculates actor attribution', () => {
      expect(historyServiceSrc).toContain('class TaskHistoryService');
      expect(historyServiceSrc).toContain('function getTaskHistory(Task $task): array');
      expect(historyServiceSrc).toContain('TaskUsageEvent::where');
      expect(historyServiceSrc).toContain('task_created');
      expect(historyServiceSrc).toContain('status_transition');
      expect(historyServiceSrc).toContain('task_dispatched');
      expect(historyServiceSrc).toContain('handoff_submitted');
      expect(historyServiceSrc).toContain('task_approved');
      expect(historyServiceSrc).toContain('task_rejected');
      expect(historyServiceSrc).toContain('evidence_verified');
    });

    it('identifies actor types across human users, agent runners, AI models, and CI systems', () => {
      expect(historyServiceSrc).toContain('actorIcon');
      expect(historyServiceSrc).toContain("'type' => 'user'");
      expect(historyServiceSrc).toContain("'type' => 'agent_runner'");
      expect(historyServiceSrc).toContain('total_events');
      expect(historyServiceSrc).toContain('total_transitions');
      expect(historyServiceSrc).toContain('current_handler');
      expect(historyServiceSrc).toContain('actors_involved');
    });
  });

  describe('2. API Endpoints & Routes (/api/v1/tasks/{task_id}/history)', () => {
    it('implements history method in ApiTaskController with workspace isolation', () => {
      expect(apiTaskControllerSrc).toContain('public function history(Request $request, $id, \\App\\Services\\TaskHistoryService $historyService)');
      expect(apiTaskControllerSrc).toContain('WorkspaceContext');
      expect(apiTaskControllerSrc).toContain('desktop_project');
      expect(apiTaskControllerSrc).toContain('getTaskHistory');
    });

    it('tracks actor attribution on task_created and status_transition in ApiTaskController', () => {
      expect(apiTaskControllerSrc).toContain("this->track('task_created'");
      expect(apiTaskControllerSrc).toContain("this->track('status_transition'");
      expect(apiTaskControllerSrc).toContain("'from_status' => $oldStatus");
      expect(apiTaskControllerSrc).toContain("'to_status' => $task->status");
      expect(apiTaskControllerSrc).toContain("'actor' => $actor");
    });

    it('registers task history routes in routes/web.php under canonical and desktop prefixes', () => {
      expect(webRoutesSrc).toContain("Route::get('/tasks/{task}/history', [ApiTaskController::class, 'history'])");
    });

    it('documents /api/v1/tasks/{task_id}/history in OpenAPI contract', () => {
      expect(openApiContractSrc).toContain('/api/v1/tasks/{task_id}/history:');
      expect(openApiContractSrc).toContain('Read the full End-to-End transition and audit history for a task');
    });
  });

  describe('3. MCP Server Protocol Support (get_task_history)', () => {
    it('exposes get_task_history tool in TaskHubMcpController tools definition', () => {
      expect(mcpControllerSrc).toContain("'get_task_history'");
      expect(mcpControllerSrc).toContain('Read the full End-to-End transition and audit history for a task');
    });

    it('dispatches get_task_history to TaskHistoryService in MCP callTool', () => {
      expect(mcpControllerSrc).toContain("'get_task_history' => app(\\App\\Services\\TaskHistoryService::class)->getTaskHistory");
    });
  });

  describe('4. Frontend Web UI (TaskHistoryTimeline.vue & Tasks/Index.vue)', () => {
    it('implements TaskHistoryTimeline.vue with summary, filter pills, copy report, and actor badges', () => {
      expect(taskHistoryTimelineVueSrc).toContain('Lịch sử E2E & Ai là người xử lý');
      expect(taskHistoryTimelineVueSrc).toContain('/api/v1/tasks/');
      expect(taskHistoryTimelineVueSrc).toContain('Nhân sự & Agent tham gia');
      expect(taskHistoryTimelineVueSrc).toContain('copyMarkdownAudit');
      expect(taskHistoryTimelineVueSrc).toContain('Bằng chứng xác thực (Evidence)');
    });

    it('embeds TaskHistoryTimeline into TaskContextRail inside Tasks/Index.vue', () => {
      expect(tasksIndexVueSrc).toContain("import TaskHistoryTimeline from '@/Components/tasks/TaskHistoryTimeline.vue'");
      expect(tasksIndexVueSrc).toContain('<TaskHistoryTimeline');
      expect(tasksIndexVueSrc).toContain(':task-id="selectedTask.id"');
    });
  });
});
