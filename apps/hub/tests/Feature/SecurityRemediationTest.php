<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Sprint;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityRemediationTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(string $name): array
    {
        $user = User::factory()->create(['name' => $name]);
        $workspace = Workspace::create(['name' => $name, 'slug' => strtolower($name) . '-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $project = Project::create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'slug' => strtolower($name) . '-project', 'title' => $name, 'tagline' => 'Test', 'description' => 'Test', 'category' => 'software']);
        return [$user, $workspace, $project];
    }

    public function test_sprints_require_authentication_and_are_workspace_scoped(): void
    {
        [$user, $workspace, $project] = $this->tenant('Alpha');
        [, $otherWorkspace, $otherProject] = $this->tenant('Beta');
        $sprint = Sprint::create(['workspace_id' => $otherWorkspace->id, 'project_id' => $otherProject->id, 'name' => 'Private']);

        $this->getJson('/api/v1/sprints')->assertUnauthorized();
        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson('/api/v1/sprints')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->patchJson('/api/v1/sprints/' . $sprint->id, ['name' => 'Attempt'])->assertNotFound();
        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/sprints', ['project_id' => $project->id, 'name' => 'Allowed'])->assertCreated();
    }

    public function test_desktop_registration_requires_an_approved_pairing_token(): void
    {
        $this->postJson('/api/v1/desktop/agents/register', ['client_id' => 'untrusted-client'])->assertUnauthorized();
    }

    public function test_existing_mcp_token_is_not_disclosed_by_info_endpoint(): void
    {
        [$user, $workspace, $project] = $this->tenant('Gamma');
        $token = 'th_mcp_test_token';
        $project->task_hub_mcp_token = encrypt($token);
        $project->task_hub_mcp_token_hash = hash('sha256', $token);
        $project->save();

        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson('/api/v1/projects/' . $project->id . '/mcp')
            ->assertOk()->assertJsonPath('data.token', null)->assertJsonMissing(['token' => $token]);
    }
}
