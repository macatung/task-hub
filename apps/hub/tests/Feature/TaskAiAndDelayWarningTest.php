<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Sprint;
use App\Models\Task;
use App\Services\SmartProjectBreakdownService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskAiAndDelayWarningTest extends TestCase
{
    use RefreshDatabase;

    public function test_ai_breakdown_service_generates_structured_plan(): void
    {
        $service = new SmartProjectBreakdownService();
        $prompt = "Xây dựng sàn thương mại điện tử tích hợp cổng thanh toán VNPay, giỏ hàng, xác thực OAuth2 và quản lý đơn hàng";

        $plan = $service->generatePlan($prompt, [
            'sprint_count' => 3,
            'sprint_duration_weeks' => 2,
        ]);

        $this->assertNotEmpty($plan);
        $this->assertArrayHasKey('project', $plan);
        $this->assertArrayHasKey('sprints', $plan);
        $this->assertArrayHasKey('summary', $plan);

        $this->assertCount(3, $plan['sprints']);
        $this->assertGreaterThanOrEqual(6, $plan['summary']['total_tasks']);
        $this->assertGreaterThan(0, $plan['summary']['total_story_points']);

        // Check sprint structure
        $firstSprint = $plan['sprints'][0];
        $this->assertNotEmpty($firstSprint['name']);
        $this->assertNotEmpty($firstSprint['tasks']);

        // Check task structure
        $firstTask = $firstSprint['tasks'][0];
        $this->assertNotEmpty($firstTask['title']);
        $this->assertNotEmpty($firstTask['priority']);
        $this->assertGreaterThan(0, $firstTask['story_points']);
        $this->assertIsArray($firstTask['subtasks']);
    }

    public function test_ai_breakdown_service_commits_plan_to_database(): void
    {
        $service = new SmartProjectBreakdownService();
        $prompt = "Phát triển ứng dụng di động Fintech Mobile Banking với Flutter, bảo mật OTP và lịch sử giao dịch";

        $plan = $service->generatePlan($prompt, [
            'sprint_count' => 2,
            'sprint_duration_weeks' => 2,
        ]);

        $result = $service->executePlan($plan, [
            'project_type' => 'work',
        ]);

        $this->assertTrue($result['success']);
        $this->assertNotNull($result['project_id']);
        $this->assertCount(2, $result['sprint_ids']);
        $this->assertGreaterThanOrEqual(4, count($result['task_ids']));

        // Verify project in DB
        $project = Project::find($result['project_id']);
        $this->assertNotNull($project);
        $this->assertEquals('work', $project->type);

        // Verify Sprints in DB
        $sprints = Sprint::where('project_id', $project->id)->get();
        $this->assertCount(2, $sprints);

        // Verify Tasks in DB
        $tasks = Task::where('project_id', $project->id)->get();
        $this->assertGreaterThanOrEqual(4, $tasks->count());

        foreach ($tasks as $task) {
            $this->assertNotNull($task->issue_key);
            $this->assertStringStartsWith($project->key, $task->issue_key);
            if (!empty($task->notes)) {
                $subtasks = json_decode($task->notes, true);
                $this->assertIsArray($subtasks);
            }
        }
    }

    public function test_api_tasks_ai_preview_endpoint(): void
    {
        $response = $this->postJson('/api/tasks/ai-preview', [
            'prompt' => 'Xây dựng trợ lý AI RAG chatbot hỏi đáp tài liệu thông minh',
            'sprint_count' => 2,
            'sprint_duration_weeks' => 2,
        ]);

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'project',
            'sprints',
            'summary',
        ]);
        $this->assertTrue($response->json('success'));
    }

    public function test_api_tasks_ai_generate_endpoint_creates_records(): void
    {
        $service = new SmartProjectBreakdownService();
        $plan = $service->generatePlan('Hệ thống Quản lý kho hàng & logistics realtime', [
            'sprint_count' => 2,
        ]);

        $response = $this->postJson('/api/tasks/ai-generate', [
            'plan' => $plan,
            'project_id' => 'new',
            'project_type' => 'work',
        ]);

        $response->assertCreated();
        $response->assertJsonStructure([
            'success',
            'project_id',
            'sprint_ids',
            'task_ids',
            'message',
        ]);

        $this->assertTrue($response->json('success'));
        $projectId = $response->json('project_id');
        $this->assertDatabaseHas('projects', ['id' => $projectId]);
    }
}
