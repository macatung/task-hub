<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceMembersRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createTenant(string $name = 'Dev Team', string $plan = 'community'): array
    {
        $owner = User::factory()->create(['name' => $name . ' Owner', 'email' => strtolower(str_replace(' ', '', $name)) . '@task-hub.dev']);
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => 'workspace-' . $owner->id,
            'owner_id' => $owner->id,
            'plan' => $plan,
            'agent_concurrency_limit' => 1,
        ]);
        $workspace->members()->attach($owner->id, ['role' => 'owner']);

        return [$owner, $workspace];
    }

    public function test_members_index_returns_list_and_seat_metrics(): void
    {
        [$owner, $workspace] = $this->createTenant('Metrics Team', 'team');

        $dev = User::factory()->create(['name' => 'Alice Developer', 'email' => 'alice@dev.com']);
        $workspace->members()->attach($dev->id, ['role' => 'developer']);

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson("/api/v1/workspaces/{$workspace->id}/members")
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('seats.used', 2);
        $response->assertJsonPath('seats.limit', 10);
        $response->assertJsonPath('seats.remaining', 8);
    }

    public function test_owner_can_invite_member_by_email(): void
    {
        [$owner, $workspace] = $this->createTenant('Invite Team', 'team');

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/members", [
                'email_or_username' => 'newdev@company.com',
                'role' => 'developer',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.email', 'newdev@company.com');
        $response->assertJsonPath('data.role', 'developer');

        $this->assertDatabaseHas('users', ['email' => 'newdev@company.com']);
        $this->assertTrue($workspace->members()->where('email', 'newdev@company.com')->exists());
    }

    public function test_owner_can_invite_member_by_github_username(): void
    {
        [$owner, $workspace] = $this->createTenant('Github Team', 'team');

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/members", [
                'email_or_username' => 'octocat',
                'role' => 'admin',
            ])
            ->assertStatus(201);

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.github_login', 'octocat');
        $response->assertJsonPath('data.role', 'admin');

        $this->assertDatabaseHas('users', ['github_login' => 'octocat']);
        $this->assertTrue($workspace->members()->where('github_login', 'octocat')->exists());
    }

    public function test_invite_member_blocked_by_seat_quota(): void
    {
        // Community plan has max_seats = 1
        [$owner, $workspace] = $this->createTenant('Solo Workspace', 'community');

        // Owner already takes 1 seat. Attempting to invite 2nd member should trigger 422 quota exceeded
        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/members", [
                'email_or_username' => 'extra@dev.com',
                'role' => 'developer',
            ])
            ->assertStatus(422);

        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error_code', 'PLAN_QUOTA_EXCEEDED');
        $response->assertJsonPath('quota.resource', 'seats');
        $response->assertJsonPath('quota.current_usage', 1);
        $response->assertJsonPath('quota.limit', 1);
    }

    public function test_admin_can_update_member_role(): void
    {
        [$owner, $workspace] = $this->createTenant('Admin Update Team', 'team');

        $admin = User::factory()->create(['name' => 'Bob Admin']);
        $dev = User::factory()->create(['name' => 'Charlie Dev']);

        $workspace->members()->attach($admin->id, ['role' => 'admin']);
        $workspace->members()->attach($dev->id, ['role' => 'developer']);

        $response = $this->actingAs($admin)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->patchJson("/api/v1/workspaces/{$workspace->id}/members/{$dev->id}", [
                'role' => 'viewer',
            ])
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.role', 'viewer');

        $this->assertEquals('viewer', $workspace->members()->where('users.id', $dev->id)->first()->pivot->role);
    }

    public function test_cannot_change_or_demote_owner_role(): void
    {
        [$owner, $workspace] = $this->createTenant('Protected Owner Team', 'team');

        $admin = User::factory()->create(['name' => 'David Admin']);
        $workspace->members()->attach($admin->id, ['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->patchJson("/api/v1/workspaces/{$workspace->id}/members/{$owner->id}", [
                'role' => 'developer',
            ])
            ->assertStatus(422);

        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', 'Workspace owner role cannot be changed.');
    }

    public function test_cannot_remove_workspace_owner(): void
    {
        [$owner, $workspace] = $this->createTenant('Delete Owner Team', 'team');

        $admin = User::factory()->create(['name' => 'Eve Admin']);
        $workspace->members()->attach($admin->id, ['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->deleteJson("/api/v1/workspaces/{$workspace->id}/members/{$owner->id}")
            ->assertStatus(422);

        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', 'Cannot remove workspace owner.');
    }

    public function test_owner_can_remove_member(): void
    {
        [$owner, $workspace] = $this->createTenant('Remove Member Team', 'team');

        $dev = User::factory()->create(['name' => 'Frank Dev']);
        $workspace->members()->attach($dev->id, ['role' => 'developer']);

        $this->assertTrue($workspace->members()->where('users.id', $dev->id)->exists());

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->deleteJson("/api/v1/workspaces/{$workspace->id}/members/{$dev->id}")
            ->assertOk();

        $response->assertJsonPath('success', true);
        $this->assertFalse($workspace->members()->where('users.id', $dev->id)->exists());
    }

    public function test_developer_and_viewer_cannot_manage_members(): void
    {
        [$owner, $workspace] = $this->createTenant('RBAC Guard Team', 'team');

        $dev = User::factory()->create(['name' => 'Grace Dev']);
        $viewer = User::factory()->create(['name' => 'Heidi Viewer']);
        $target = User::factory()->create(['name' => 'Target User']);

        $workspace->members()->attach($dev->id, ['role' => 'developer']);
        $workspace->members()->attach($viewer->id, ['role' => 'viewer']);
        $workspace->members()->attach($target->id, ['role' => 'developer']);

        // Developer trying to invite -> 403
        $this->actingAs($dev)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/members", [
                'email_or_username' => 'another@dev.com',
                'role' => 'developer',
            ])
            ->assertStatus(403);

        // Viewer trying to update role -> 403
        $this->actingAs($viewer)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->patchJson("/api/v1/workspaces/{$workspace->id}/members/{$target->id}", [
                'role' => 'admin',
            ])
            ->assertStatus(403);

        // Viewer trying to remove member -> 403
        $this->actingAs($viewer)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->deleteJson("/api/v1/workspaces/{$workspace->id}/members/{$target->id}")
            ->assertStatus(403);
    }

    public function test_web_controller_renders_members_page(): void
    {
        [$owner, $workspace] = $this->createTenant('Inertia Render Team', 'team');

        $response = $this->actingAs($owner)
            ->get("/workspaces/{$workspace->id}/members")
            ->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Workspaces/Members/Index')
            ->has('workspace')
            ->has('members')
            ->has('seats')
            ->where('workspace.id', $workspace->id)
            ->where('workspace.user_role', 'owner')
        );
    }
}
