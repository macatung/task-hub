<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\Plan;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\Carbon;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createTenant(string $name = 'Analytics Team', string $plan = 'team'): array
    {
        $owner = User::factory()->create(['name' => $name . ' Owner', 'email' => strtolower(str_replace(' ', '', $name)) . '@example.com']);
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => 'workspace-' . $owner->id . '-' . substr(md5(uniqid()), 0, 6),
            'owner_id' => $owner->id,
            'plan' => $plan,
            'agent_concurrency_limit' => 10,
        ]);
        $workspace->members()->attach($owner->id, ['role' => 'owner']);

        return [$owner, $workspace];
    }

    public function test_unauthenticated_user_redirected_to_github_login(): void
    {
        [$owner, $workspace] = $this->createTenant('Alpha Team', 'team');

        $response = $this->get("/workspaces/{$workspace->id}/analytics");
        $response->assertStatus(302);
        $response->assertRedirect('/auth/github');
    }

    public function test_non_member_cannot_access_analytics_page(): void
    {
        [$owner, $workspace] = $this->createTenant('Alpha Team', 'team');
        $intruder = User::factory()->create(['name' => 'Intruder']);

        $response = $this->actingAs($intruder)->get("/workspaces/{$workspace->id}/analytics");
        $response->assertStatus(403);
    }

    public function test_analytics_page_renders_for_authenticated_workspace_member(): void
    {
        [$owner, $workspace] = $this->createTenant('Beta Corp', 'team');

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->get("/workspaces/{$workspace->id}/analytics");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Workspaces/Analytics/Index')
            ->has('workspace')
            ->has('analytics')
            ->where('canAccessAnalytics', true)
        );
    }

    public function test_community_and_pro_plans_receive_403_upgrade_required_on_api(): void
    {
        [$ownerCommunity, $wsCommunity] = $this->createTenant('Community Dev', 'community');
        [$ownerPro, $wsPro] = $this->createTenant('Pro Dev', 'pro');

        $resCommunity = $this->actingAs($ownerCommunity)
            ->withHeaders(['X-Workspace-Id' => $wsCommunity->id])
            ->getJson("/api/v1/workspaces/{$wsCommunity->id}/analytics");

        $resCommunity->assertStatus(403);
        $resCommunity->assertJsonPath('success', false);
        $resCommunity->assertJsonPath('error_code', 'UPGRADE_REQUIRED');
        $resCommunity->assertJsonPath('quota.suggested_plan', 'team');

        $resPro = $this->actingAs($ownerPro)
            ->withHeaders(['X-Workspace-Id' => $wsPro->id])
            ->getJson("/api/v1/workspaces/{$wsPro->id}/analytics");

        $resPro->assertStatus(403);
        $resPro->assertJsonPath('success', false);
        $resPro->assertJsonPath('error_code', 'UPGRADE_REQUIRED');
    }

    public function test_team_workspace_api_returns_complete_metrics_payload(): void
    {
        [$owner, $workspace] = $this->createTenant('Metrics Team', 'team');

        // Create tasks
        Task::create([
            'workspace_id' => $workspace->id,
            'title' => 'Completed Task 1',
            'status' => 'done',
            'story_points' => 5,
            'completed_at' => Carbon::now()->subDays(2),
        ]);

        Task::create([
            'workspace_id' => $workspace->id,
            'title' => 'Completed Task 2',
            'status' => 'done',
            'story_points' => 8,
            'completed_at' => Carbon::now()->subDays(5),
        ]);

        // Create agent runs
        AgentRun::create([
            'workspace_id' => $workspace->id,
            'provider' => 'gemini',
            'status' => 'completed',
            'metadata' => [
                'model' => 'gemini-2.5-pro',
                'tokens_used' => 4500,
            ],
            'started_at' => Carbon::now()->subMinutes(30),
            'finished_at' => Carbon::now()->subMinutes(25),
        ]);

        AgentRun::create([
            'workspace_id' => $workspace->id,
            'provider' => 'anthropic',
            'status' => 'completed',
            'metadata' => [
                'model' => 'claude-3-7-sonnet',
                'tokens_used' => 3200,
            ],
            'started_at' => Carbon::now()->subMinutes(20),
            'finished_at' => Carbon::now()->subMinutes(18),
        ]);

        AgentRun::create([
            'workspace_id' => $workspace->id,
            'provider' => 'openai',
            'status' => 'failed',
            'failure_reason' => 'Linter / TypeCheck Failure',
            'metadata' => [
                'model' => 'gpt-4o',
                'tokens_used' => 1500,
            ],
            'started_at' => Carbon::now()->subMinutes(10),
            'finished_at' => Carbon::now()->subMinutes(9),
        ]);

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/analytics?time_range=30d");

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.plan', 'team');
        $response->assertJsonPath('data.throughput.total_tasks_completed', 2);
        $response->assertJsonPath('data.success_rate.total_runs', 3);
        $response->assertJsonPath('data.success_rate.successful_runs', 2);
        $response->assertJsonPath('data.success_rate.failed_runs', 1);
        $response->assertJsonPath('data.success_rate.failure_reasons.0.reason', 'Linter / TypeCheck Failure');
        $response->assertJsonPath('data.ai_models.total_model_invocations', 3);
    }

    public function test_date_range_filtering_works_for_7d_30d_90d_1y(): void
    {
        [$owner, $workspace] = $this->createTenant('Range Team', 'team');

        // Task 10 days ago (outside 7d, inside 30d)
        Task::create([
            'workspace_id' => $workspace->id,
            'title' => 'Old Task',
            'status' => 'done',
            'story_points' => 3,
            'completed_at' => Carbon::now()->subDays(10),
        ]);

        // Task 2 days ago (inside 7d and 30d)
        Task::create([
            'workspace_id' => $workspace->id,
            'title' => 'Recent Task',
            'status' => 'done',
            'story_points' => 5,
            'completed_at' => Carbon::now()->subDays(2),
        ]);

        $res7d = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/analytics?time_range=7d");

        $res7d->assertStatus(200);
        $res7d->assertJsonPath('data.throughput.total_tasks_completed', 1);

        $res30d = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/analytics?time_range=30d");

        $res30d->assertStatus(200);
        $res30d->assertJsonPath('data.throughput.total_tasks_completed', 2);
    }

    public function test_zero_runs_workspace_returns_zeroed_metrics_without_division_by_zero(): void
    {
        [$owner, $workspace] = $this->createTenant('Empty Team', 'team');

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/analytics");

        $response->assertStatus(200);
        $response->assertJsonPath('data.throughput.total_tasks_completed', 0);
        $response->assertJsonPath('data.throughput.velocity_points_per_week', 0);
        $response->assertJsonPath('data.success_rate.total_runs', 0);
        $response->assertJsonPath('data.success_rate.success_percentage', 0);
        $response->assertJsonPath('data.ai_models.total_model_invocations', 0);
        $response->assertJsonPath('data.turnaround_time.avg_run_duration_seconds', 0);
    }

    public function test_sub_second_agent_runs_calculate_precise_durations(): void
    {
        [$owner, $workspace] = $this->createTenant('Fast Team', 'team');

        $now = Carbon::now();
        AgentRun::create([
            'workspace_id' => $workspace->id,
            'provider' => 'gemini',
            'status' => 'completed',
            'started_at' => $now->copy()->subSeconds(2),
            'finished_at' => $now->copy()->subSeconds(1),
        ]);

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/analytics");

        $response->assertStatus(200);
        $this->assertGreaterThan(0, $response->json('data.turnaround_time.avg_run_duration_seconds'));
    }
}
