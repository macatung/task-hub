<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\AgentRunner;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanQuotaEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createWorkspaceWithRunner(string $name = 'Quota Tenant'): array
    {
        $user = User::factory()->create(['name' => $name . ' Owner']);
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => 'workspace-' . $user->id,
            'owner_id' => $user->id,
            'plan' => 'community',
            'agent_concurrency_limit' => 1,
        ]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $project = Project::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'slug' => 'project-' . $user->id,
            'title' => 'Project 1',
            'tagline' => 'First project',
            'category' => 'software',
        ]);

        $runner = AgentRunner::create([
            'workspace_id' => $workspace->id,
            'name' => 'Desktop Runner 1',
            'token_hash' => hash('sha256', 'token-' . $user->id),
            'status' => 'online',
            'last_heartbeat_at' => now(),
            'platform' => 'win32',
            'hostname' => 'WORKSTATION',
        ]);

        return [$user, $workspace, $project, $runner];
    }

    public function test_cannot_dispatch_more_runners_than_plan_limit(): void
    {
        [$user, $workspace, $project, $runner] = $this->createWorkspaceWithRunner('Runner Quota Test');

        $task1 = Task::create([
            'project_id' => $project->id,
            'issue_key' => 'TSK-1',
            'title' => 'Task 1',
            'status' => 'in_progress',
        ]);

        $task2 = Task::create([
            'project_id' => $project->id,
            'issue_key' => 'TSK-2',
            'title' => 'Task 2',
            'status' => 'todo',
        ]);

        // Active run 1 in progress (consumes 1 concurrency slot)
        AgentRun::create([
            'workspace_id' => $workspace->id,
            'task_id' => $task1->id,
            'runner_id' => $runner->id,
            'provider' => 'antigravity',
            'agent_session_id' => 'session-1',
            'status' => 'running',
            'run_type' => 'implementation',
            'execution_mode' => 'desktop',
            'queued_at' => now(),
        ]);

        // Try to dispatch task 2 while runner limit is 1/1
        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/tasks/{$task2->id}/dispatch", [
                'runner_id' => $runner->id,
                'provider' => 'antigravity',
                'model' => 'gemini-3.7-flash',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error_code', 'PLAN_QUOTA_EXCEEDED');
        $response->assertJsonPath('quota.resource', 'runners');
        $response->assertJsonPath('quota.current_usage', 1);
        $response->assertJsonPath('quota.limit', 1);
        $response->assertJsonPath('quota.current_plan', 'community');
        $response->assertJsonPath('quota.suggested_plan', 'pro');
    }

    public function test_cannot_add_members_exceeding_seat_limit(): void
    {
        [$user, $workspace] = $this->createWorkspaceWithRunner('Seat Quota Test');
        $newUser = User::factory()->create(['name' => 'Second Dev']);

        // Workspace has Community plan (max_seats = 1), and owner is already 1 member
        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/members", [
                'user_id' => $newUser->id,
                'role' => 'developer',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error_code', 'PLAN_QUOTA_EXCEEDED');
        $response->assertJsonPath('quota.resource', 'seats');
        $response->assertJsonPath('quota.current_usage', 1);
        $response->assertJsonPath('quota.limit', 1);
    }

    public function test_cannot_create_projects_exceeding_project_limit(): void
    {
        [$user, $workspace, $project1] = $this->createWorkspaceWithRunner('Project Quota Test');

        // Community allows 3 projects. Project 1 already exists. Create 2 and 3.
        Project::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'slug' => 'project-2',
            'title' => 'Project 2',
            'category' => 'software',
        ]);

        Project::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'slug' => 'project-3',
            'title' => 'Project 3',
            'category' => 'software',
        ]);

        // Attempting to create 4th project should be blocked
        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/projects', [
                'title' => 'Project 4 (Blocked)',
                'description' => 'Should fail quota',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error_code', 'PLAN_QUOTA_EXCEEDED');
        $response->assertJsonPath('quota.resource', 'projects');
        $response->assertJsonPath('quota.current_usage', 3);
        $response->assertJsonPath('quota.limit', 3);
    }

    public function test_upgrading_to_pro_allows_more_runners_and_unlimited_projects(): void
    {
        [$user, $workspace, $project, $runner] = $this->createWorkspaceWithRunner('Upgrade Validation');

        // Upgrade to Pro
        $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/subscription", [
                'plan_slug' => 'pro',
                'billing_cycle' => 'monthly',
            ])->assertOk();

        // Should now be able to create 4th, 5th projects
        for ($i = 2; $i <= 5; $i++) {
            $this->actingAs($user)
                ->withHeaders(['X-Workspace-Id' => $workspace->id])
                ->postJson('/api/v1/projects', [
                    'title' => "Project {$i}",
                ])->assertCreated();
        }

        // Active run 1
        $task1 = Task::create(['project_id' => $project->id, 'issue_key' => 'TSK-10', 'title' => 'Task 10']);
        AgentRun::create([
            'workspace_id' => $workspace->id,
            'task_id' => $task1->id,
            'runner_id' => $runner->id,
            'provider' => 'antigravity',
            'agent_session_id' => 'session-10',
            'status' => 'running',
            'run_type' => 'implementation',
            'execution_mode' => 'desktop',
            'queued_at' => now(),
        ]);

        // Dispatch task 2 (2/3 concurrent runners) -> Success!
        $task2 = Task::create(['project_id' => $project->id, 'issue_key' => 'TSK-11', 'title' => 'Task 11']);
        $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/tasks/{$task2->id}/dispatch", [
                'runner_id' => $runner->id,
            ])->assertCreated();
    }
}
