<?php

namespace Tests\Feature;

use App\Models\AgentRunner;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskDependency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EpicDispatchDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_epic_dispatch_explains_a_dependency_cycle_without_queuing_a_desktop_run(): void
    {
        $project = Project::create([
            'title' => 'Dispatch diagnostics',
            'slug' => 'dispatch-diagnostics',
            'key' => 'DD',
            'tagline' => 'Dispatch diagnostics',
            'description' => 'Test project',
        ]);
        $epic = Task::create(['project_id' => $project->id, 'issue_type' => 'epic', 'title' => 'Cyclic Epic']);
        $first = Task::create(['project_id' => $project->id, 'epic_id' => $epic->id, 'title' => 'First child', 'status' => 'todo']);
        $second = Task::create(['project_id' => $project->id, 'epic_id' => $epic->id, 'title' => 'Second child', 'status' => 'todo']);
        TaskDependency::create(['task_id' => $first->id, 'depends_on_task_id' => $second->id]);
        TaskDependency::create(['task_id' => $second->id, 'depends_on_task_id' => $first->id]);
        $runner = AgentRunner::create(['name' => 'Desktop', 'token_hash' => hash('sha256', 'diagnostic-runner')]);

        $response = $this->postJson("/api/v1/tasks/{$epic->id}/dispatch-sequence", [
            'runner_id' => $runner->id,
            'provider' => 'codex',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'epic_dependency_cycle')
            ->assertJsonPath('dispatch_diagnostics.blocked.0.issue_key', $first->issue_key);
        $this->assertNotEmpty($response->json('dispatch_diagnostics.cycles'));
        $this->assertDatabaseCount('agent_runs', 0);
    }

    public function test_epic_dispatch_explains_the_specific_unfinished_prerequisite(): void
    {
        $project = Project::create([
            'title' => 'Blocked dispatch',
            'slug' => 'blocked-dispatch',
            'key' => 'BD',
            'tagline' => 'Blocked dispatch',
            'description' => 'Test project',
        ]);
        $epic = Task::create(['project_id' => $project->id, 'issue_type' => 'epic', 'title' => 'Blocked Epic']);
        $external = Task::create(['project_id' => $project->id, 'title' => 'External prerequisite', 'status' => 'todo']);
        $child = Task::create(['project_id' => $project->id, 'epic_id' => $epic->id, 'title' => 'Blocked child', 'status' => 'todo']);
        TaskDependency::create(['task_id' => $child->id, 'depends_on_task_id' => $external->id]);
        $runner = AgentRunner::create(['name' => 'Desktop', 'token_hash' => hash('sha256', 'blocked-runner')]);

        $this->postJson("/api/v1/tasks/{$epic->id}/dispatch-sequence", [
            'runner_id' => $runner->id,
            'provider' => 'codex',
        ])->assertUnprocessable()
            ->assertJsonPath('error_code', 'epic_no_dispatchable_child')
            ->assertJsonPath('dispatch_diagnostics.blocked.0.issue_key', $child->issue_key)
            ->assertJsonPath('dispatch_diagnostics.blocked.0.blocked_by.0.issue_key', $external->issue_key)
            ->assertJsonPath('dispatch_diagnostics.blocked.0.blocked_by.0.status', 'todo');
    }
}
