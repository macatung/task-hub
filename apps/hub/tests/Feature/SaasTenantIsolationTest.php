<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaasTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(string $name): array
    {
        $user = User::factory()->create(['name' => $name]);
        $workspace = Workspace::create(['name' => $name, 'slug' => strtolower($name) . '-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        return [$user, $workspace];
    }

    public function test_workspace_scoped_project_api_hides_another_tenant(): void
    {
        [$alice, $workspaceA] = $this->tenant('Alice');
        [$bob, $workspaceB] = $this->tenant('Bob');
        Project::create(['workspace_id' => $workspaceB->id, 'user_id' => $bob->id, 'slug' => 'bob-project', 'title' => 'Bob Secret', 'tagline' => 'Secret', 'description' => 'Tenant B', 'type' => 'work', 'category' => 'tools']);

        $this->actingAs($alice)->withHeaders(['X-Workspace-Id' => $workspaceA->id])->getJson('/api/v1/projects')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($alice)->withHeaders(['X-Workspace-Id' => $workspaceA->id])->getJson('/api/v1/workspaces/' . $workspaceB->id . '/projects')->assertForbidden();
    }

    public function test_credential_api_only_returns_metadata_and_ciphertext_is_not_plaintext(): void
    {
        [$user, $workspace] = $this->tenant('Credential');
        $secret = 'github_pat_sensitive_value';
        $response = $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])->postJson('/api/v1/workspaces/' . $workspace->id . '/credentials', ['provider' => 'github', 'secret' => $secret])->assertCreated();
        $response->assertJsonMissing(['secret' => $secret])->assertJsonMissingPath('data.ciphertext');
        $this->assertDatabaseMissing('workspace_credentials', ['ciphertext' => $secret]);
        $this->assertDatabaseHas('workspace_credentials', ['workspace_id' => $workspace->id, 'provider' => 'github', 'status' => 'active']);
    }

    public function test_member_role_can_be_changed_only_by_workspace_admin(): void
    {
        [$owner, $workspace] = $this->tenant('Owner');
        [$member] = $this->tenant('Member');
        $workspace->members()->attach($member->id, ['role' => 'viewer']);
        $this->actingAs($member)->withHeaders(['X-Workspace-Id' => $workspace->id])->postJson('/api/v1/workspaces/' . $workspace->id . '/members', ['user_id' => $owner->id, 'role' => 'developer'])->assertForbidden();
        $this->actingAs($owner)->withHeaders(['X-Workspace-Id' => $workspace->id])->patchJson('/api/v1/workspaces/' . $workspace->id . '/members/' . $member->id, ['role' => 'developer'])->assertOk();
        $this->assertDatabaseHas('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $member->id, 'role' => 'developer']);
    }
}
