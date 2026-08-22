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

        $epics = $tasks->where('issue_type', 'epic');
        $this->assertGreaterThanOrEqual(1, $epics->count());
        foreach ($epics as $epic) {
            $this->assertNull($epic->sprint_id, 'Epic sprint_id must remain null to separate from sprint backlog.');
        }

        $childWorkItems = $tasks->where('issue_type', '!=', 'epic');
        $this->assertGreaterThanOrEqual(2, $childWorkItems->count());
        foreach ($childWorkItems as $workItem) {
            $this->assertNotNull($workItem->sprint_id, 'Child stories/tasks must be assigned to sprint.');
            $this->assertNotNull($workItem->epic_id, 'Child stories/tasks must be linked to parent epic.');
        }

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

    public function test_ai_plan_preview_and_normalization_has_zero_double_counting(): void
    {
        $service = new SmartProjectBreakdownService();
        $plan = [
            'project' => ['title' => 'Test AI Plan', 'key' => 'TAP'],
            'sprints' => [
                [
                    'name' => 'Sprint 1',
                    'tasks' => [
                        ['title' => 'Core Architecture Epic', 'issue_type' => 'epic', 'story_points' => 13, 'estimated_pomodoros' => 5],
                        ['title' => 'User Auth Story', 'issue_type' => 'story', 'story_points' => 5, 'estimated_pomodoros' => 3],
                        ['title' => 'Database Migration Task', 'issue_type' => 'task', 'story_points' => 3, 'estimated_pomodoros' => 2],
                    ],
                ],
            ],
        ];

        $normalized = $service->normalizePlan($plan);
        // Story points should ONLY sum stories/tasks: 5 + 3 = 8 pts, not 13 + 5 + 3 = 21.
        $this->assertEquals(8, $normalized['summary']['total_story_points']);
        $this->assertEquals(2, $normalized['summary']['total_tasks']);
        $this->assertEquals(5, $normalized['summary']['total_pomodoros']);
    }

    public function test_task_creation_and_update_forces_epic_sprint_id_null(): void
    {
        $user = \App\Models\User::factory()->create();
        $workspace = \App\Models\Workspace::create([
            'name' => 'Test WS',
            'slug' => 'test-ws-' . $user->id,
            'owner_id' => $user->id,
        ]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $project = Project::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'slug' => 'epic-test-proj',
            'title' => 'Epic Separation Proj',
            'tagline' => 'Testing epic vs sprint',
            'description' => 'Test',
            'key' => 'ETP',
        ]);
        $sprint = Sprint::create([
            'project_id' => $project->id,
            'workspace_id' => $workspace->id,
            'name' => 'Sprint Alpha',
            'status' => 'active',
        ]);

        // 1. Create Epic with explicit sprint_id -> Must be nullified
        $res = $this->actingAs($user)->postJson('/api/tasks', [
            'project_id' => $project->id,
            'title' => 'Payment Epic',
            'issue_type' => 'epic',
            'story_points' => 8,
            'sprint_id' => $sprint->id,
        ])->assertCreated();

        $epicId = $res->json('data.id');
        $this->assertNull($res->json('data.sprint_id'));
        $this->assertDatabaseHas('tasks', ['id' => $epicId, 'sprint_id' => null, 'issue_type' => 'epic']);

        // 2. Create Task under sprint
        $taskRes = $this->actingAs($user)->postJson('/api/tasks', [
            'project_id' => $project->id,
            'title' => 'Stripe Webhook',
            'issue_type' => 'task',
            'story_points' => 5,
            'sprint_id' => $sprint->id,
            'epic_id' => $epicId,
        ])->assertCreated();
        $taskId = $taskRes->json('data.id');
        $this->assertEquals($sprint->id, $taskRes->json('data.sprint_id'));

        // 3. Convert existing Task to Epic -> sprint_id and epic_id must clear to null
        $updateRes = $this->actingAs($user)->patchJson("/api/tasks/{$taskId}", [
            'issue_type' => 'epic',
        ])->assertOk();
        $this->assertNull($updateRes->json('data.sprint_id'));
        $this->assertNull($updateRes->json('data.epic_id'));
        $this->assertDatabaseHas('tasks', ['id' => $taskId, 'sprint_id' => null, 'epic_id' => null, 'issue_type' => 'epic']);
    }

    public function test_api_sprints_excludes_epic_points_and_tasks(): void
    {
        $project = Project::create([
            'slug' => 'sprint-stats-proj',
            'title' => 'Sprint Stats Proj',
            'tagline' => 'Testing stats rollup',
            'description' => 'Test',
            'key' => 'SSP',
        ]);
        $sprint = Sprint::create([
            'project_id' => $project->id,
            'name' => 'Sprint 1',
            'status' => 'active',
        ]);

        // Create child tasks in sprint
        Task::create(['project_id' => $project->id, 'sprint_id' => $sprint->id, 'title' => 'Task A', 'issue_type' => 'story', 'status' => 'done', 'story_points' => 5]);
        Task::create(['project_id' => $project->id, 'sprint_id' => $sprint->id, 'title' => 'Task B', 'issue_type' => 'task', 'status' => 'todo', 'story_points' => 3]);

        // Legacy / stray epic with sprint_id
        Task::create(['project_id' => $project->id, 'sprint_id' => $sprint->id, 'title' => 'Legacy Epic', 'issue_type' => 'epic', 'status' => 'done', 'story_points' => 13]);

        $res = $this->getJson("/api/sprints?project_id={$project->id}")->assertOk();
        $sprintData = $res->json('data.0');

        // Total points should be 5 + 3 = 8 (Epic 13 excluded)
        $this->assertEquals(8, $sprintData['total_points']);
        $this->assertEquals(5, $sprintData['done_points']);
        $this->assertEquals(2, $sprintData['total_tasks']);
        $this->assertEquals(1, $sprintData['done_tasks']);
    }

    public function test_api_sprints_move_tasks_guards_epics(): void
    {
        $project = Project::create([
            'slug' => 'sprint-move-proj',
            'title' => 'Sprint Move Proj',
            'tagline' => 'Testing move tasks guard',
            'description' => 'Test',
            'key' => 'SMP',
        ]);
        $sprint = Sprint::create([
            'project_id' => $project->id,
            'name' => 'Sprint Target',
            'status' => 'active',
        ]);

        $epic = Task::create(['project_id' => $project->id, 'sprint_id' => null, 'title' => 'Main Epic', 'issue_type' => 'epic', 'story_points' => 13]);
        $task = Task::create(['project_id' => $project->id, 'sprint_id' => null, 'title' => 'Sub Task', 'issue_type' => 'task', 'story_points' => 3]);

        $this->postJson('/api/sprints/move-tasks', [
            'task_ids' => [$epic->id, $task->id],
            'sprint_id' => $sprint->id,
        ])->assertOk();

        // Epic must remain null; Task must be moved
        $this->assertNull($epic->fresh()->sprint_id);
        $this->assertEquals($sprint->id, $task->fresh()->sprint_id);
    }

    public function test_generate_plan_direct_call_has_zero_double_counting(): void
    {
        $service = new SmartProjectBreakdownService();
        $plan = $service->generatePlan('E-commerce with authentication and payment gateway', [
            'sprint_count' => 3,
            'sprint_duration_weeks' => 2,
        ]);

        $allTasks = collect($plan['sprints'])->flatMap(fn ($s) => $s['tasks']);
        $epics = $allTasks->where('issue_type', 'epic');
        $workTasks = $allTasks->where('issue_type', '!=', 'epic');

        $this->assertGreaterThanOrEqual(1, $epics->count());
        $this->assertEquals($workTasks->count(), $plan['summary']['total_tasks']);
        $this->assertEquals($workTasks->sum('story_points'), $plan['summary']['total_story_points']);
        $this->assertEquals($workTasks->sum('estimated_pomodoros'), $plan['summary']['total_pomodoros']);
    }

    public function test_sprint_complete_guards_incomplete_epics_from_target_sprint(): void
    {
        $project = Project::create([
            'slug' => 'sprint-complete-guard-proj',
            'title' => 'Sprint Complete Guard Proj',
            'tagline' => 'Testing sprint completion',
            'description' => 'Test',
            'key' => 'SCG',
        ]);
        $sprintCurrent = Sprint::create([
            'project_id' => $project->id,
            'name' => 'Current Sprint',
            'status' => 'active',
        ]);
        $sprintNext = Sprint::create([
            'project_id' => $project->id,
            'name' => 'Next Sprint',
            'status' => 'future',
        ]);

        // Legacy / accidentally attached epic and normal task
        $epic = Task::create(['project_id' => $project->id, 'sprint_id' => $sprintCurrent->id, 'title' => 'Incomplete Epic', 'issue_type' => 'epic', 'status' => 'in_progress', 'story_points' => 13]);
        $task = Task::create(['project_id' => $project->id, 'sprint_id' => $sprintCurrent->id, 'title' => 'Incomplete Task', 'issue_type' => 'task', 'status' => 'todo', 'story_points' => 5]);

        $this->postJson("/api/sprints/{$sprintCurrent->id}/complete", [
            'move_incomplete_to' => (string) $sprintNext->id,
        ])->assertOk();

        // Non-epic task moved to next sprint; Epic decoupled to null
        $this->assertEquals($sprintNext->id, $task->fresh()->sprint_id);
        $this->assertNull($epic->fresh()->sprint_id);
    }

    public function test_daily_review_strictly_excludes_epics(): void
    {
        $project = Project::create(['slug' => 'daily-rev-proj', 'title' => 'Daily Review Proj', 'tagline' => 'Daily Review Tagline', 'description' => 'Desc', 'key' => 'DRP']);
        $today = now()->toDateString();

        // Done task & Done epic completed today
        Task::create(['project_id' => $project->id, 'title' => 'Done Story', 'issue_type' => 'story', 'status' => 'done', 'completed_at' => now(), 'completed_pomodoros' => 3]);
        Task::create(['project_id' => $project->id, 'title' => 'Done Epic', 'issue_type' => 'epic', 'status' => 'done', 'completed_at' => now(), 'completed_pomodoros' => 10]);

        // Incomplete task & Incomplete epic due today
        Task::create(['project_id' => $project->id, 'title' => 'Active Story', 'issue_type' => 'story', 'status' => 'in_progress', 'due_date' => $today]);
        Task::create(['project_id' => $project->id, 'title' => 'Active Epic', 'issue_type' => 'epic', 'status' => 'in_progress', 'due_date' => $today]);

        $res = $this->getJson('/api/tasks/daily-review')->assertOk();

        $this->assertEquals(1, $res->json('completed_count'));
        $this->assertEquals(1, $res->json('incompleted_count'));
        $this->assertEquals(3, $res->json('total_pomodoros_done'));
        $this->assertEquals('Done Story', $res->json('completed_tasks.0.title'));
        $this->assertEquals('Active Story', $res->json('incompleted_tasks.0.title'));
    }

    public function test_daily_dispatch_strictly_excludes_epics_from_completed_and_overdue_counts(): void
    {
        $project = Project::create(['slug' => 'daily-disp-proj', 'title' => 'Daily Dispatch Proj', 'tagline' => 'Daily Dispatch Tagline', 'description' => 'Desc', 'key' => 'DDP']);
        $today = now()->toDateString();
        $yesterday = now()->subDays(2)->toDateString();

        // 1. Done Story & Done Epic completed today
        Task::create(['project_id' => $project->id, 'title' => 'Done Story Today', 'issue_type' => 'story', 'status' => 'done', 'completed_at' => now()]);
        Task::create(['project_id' => $project->id, 'title' => 'Done Epic Today', 'issue_type' => 'epic', 'status' => 'done', 'completed_at' => now()]);

        // 2. Overdue Story & Overdue Epic
        Task::create(['project_id' => $project->id, 'title' => 'Overdue Story', 'issue_type' => 'story', 'status' => 'todo', 'due_date' => $yesterday]);
        Task::create(['project_id' => $project->id, 'title' => 'Overdue Epic', 'issue_type' => 'epic', 'status' => 'in_progress', 'due_date' => $yesterday]);

        // 3. Active Story for today
        Task::create(['project_id' => $project->id, 'title' => 'Active Story Today', 'issue_type' => 'story', 'status' => 'in_progress', 'due_date' => $today]);

        $res = $this->getJson('/api/tasks/daily-dispatch')->assertOk();

        // Completed count should be 1 (only the story, epic excluded)
        $this->assertEquals(1, $res->json('completed_today_count'));

        // Overdue count should be 1 (only the story, epic excluded)
        $this->assertEquals(1, $res->json('overdue_count'));

        // Active tasks should not contain epics
        $activeTitles = collect($res->json('active_tasks'))->pluck('title')->all();
        $this->assertContains('Active Story Today', $activeTitles);
        $this->assertNotContains('Overdue Epic', $activeTitles);
        $this->assertNotContains('Done Epic Today', $activeTitles);
    }

    public function test_task_model_saving_hook_enforces_epic_sprint_id_null(): void
    {
        $project = Project::create(['slug' => 'model-hook-proj', 'title' => 'Model Hook Proj', 'tagline' => 'Hook Tagline', 'description' => 'Desc', 'key' => 'MHP']);
        $sprint = Sprint::create(['project_id' => $project->id, 'name' => 'Sprint Hook', 'status' => 'active']);

        // Direct Eloquent creation with non-null sprint_id and epic_id
        $epic = Task::create([
            'project_id' => $project->id,
            'title' => 'Direct Eloquent Epic',
            'issue_type' => 'epic',
            'sprint_id' => $sprint->id,
            'epic_id' => 999,
        ]);

        $this->assertNull($epic->sprint_id);
        $this->assertNull($epic->epic_id);

        // Direct Eloquent update
        $story = Task::create([
            'project_id' => $project->id,
            'title' => 'Direct Eloquent Story',
            'issue_type' => 'story',
            'sprint_id' => $sprint->id,
        ]);
        $this->assertEquals($sprint->id, $story->sprint_id);

        $story->update(['issue_type' => 'epic', 'sprint_id' => $sprint->id]);
        $this->assertNull($story->fresh()->sprint_id);
        $this->assertNull($story->fresh()->epic_id);
    }
}
