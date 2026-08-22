<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Sprint;
use App\Models\Task;
use App\Services\SmartProjectBreakdownService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RequirementBacklogDependencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_requirement_is_grouped_in_one_epic_and_active_sprint_with_dependencies(): void
    {
        $project = Project::create([
            'title' => 'Task Hub',
            'slug' => 'task-hub',
            'key' => 'TH',
            'tagline' => 'Task Hub',
            'description' => 'Test project',
        ]);
        $sprint = Sprint::create([
            'project_id' => $project->id,
            'name' => 'Sprint 8',
            'start_date' => '2026-08-22',
            'end_date' => '2026-09-05',
            'status' => 'active',
        ]);

        $result = app(SmartProjectBreakdownService::class)->createRequirementBacklog([
            'project_id' => $project->id,
            'epic' => ['title' => 'Requirement Discovery backlog', 'story_points' => 8],
            'tasks' => [
                ['ref' => 'schema', 'issue_type' => 'story', 'title' => 'Persist task dependencies', 'story_points' => 3],
                ['ref' => 'api', 'issue_type' => 'task', 'title' => 'Expose dependency-aware MCP tools', 'story_points' => 5, 'depends_on' => ['schema']],
            ],
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame($sprint->id, $result['sprint']->id);
        $this->assertCount(2, $result['tasks']);

        $epic = $result['epic'];
        $this->assertNull($epic->sprint_id);
        $this->assertSame('epic', $epic->issue_type);
        foreach ($result['tasks'] as $task) {
            $this->assertSame($epic->id, $task->epic_id);
            $this->assertSame($sprint->id, $task->sprint_id);
            $this->assertNotSame('epic', $task->issue_type);
        }

        $schema = Task::where('title', 'Persist task dependencies')->firstOrFail();
        $api = Task::where('title', 'Expose dependency-aware MCP tools')->firstOrFail();
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $api->id,
            'depends_on_task_id' => $schema->id,
        ]);

        $this->getJson('/api/tasks/next-action')->assertOk()->assertJsonPath('data.id', $schema->id);

        $schema->markAsCompleted();
        $this->getJson('/api/tasks/next-action')->assertOk()->assertJsonPath('data.id', $api->id);
    }

    public function test_dependency_cycle_is_rejected_without_writing_any_backlog(): void
    {
        $project = Project::create([
            'title' => 'Task Hub',
            'slug' => 'task-hub',
            'key' => 'TH',
            'tagline' => 'Task Hub',
            'description' => 'Test project',
        ]);

        try {
            app(SmartProjectBreakdownService::class)->createRequirementBacklog([
                'project_id' => $project->id,
                'epic' => ['title' => 'Invalid cycle'],
                'tasks' => [
                    ['ref' => 'a', 'title' => 'A', 'depends_on' => ['b']],
                    ['ref' => 'b', 'title' => 'B', 'depends_on' => ['a']],
                ],
            ]);
            $this->fail('Expected a dependency cycle exception.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('Dependency cycle', $exception->getMessage());
        }

        $this->assertDatabaseCount('tasks', 0);
        $this->assertDatabaseCount('task_dependencies', 0);
    }
}
