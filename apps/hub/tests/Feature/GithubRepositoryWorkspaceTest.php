<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use App\Services\CredentialVaultService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GithubRepositoryWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_repository_listing_uses_the_active_workspace_credential(): void
    {
        $user = User::factory()->create(['github_access_token' => null]);
        $first = Workspace::create(['name' => 'First', 'slug' => 'first-' . $user->id, 'owner_id' => $user->id]);
        $active = Workspace::create(['name' => 'Active', 'slug' => 'active-' . $user->id, 'owner_id' => $user->id]);
        $first->members()->attach($user->id, ['role' => 'owner']);
        $active->members()->attach($user->id, ['role' => 'owner']);
        app(CredentialVaultService::class)->put($active, null, 'github', 'active-workspace-token');

        Http::fake(['https://api.github.com/user/repos*' => Http::response([
            ['id' => 42, 'name' => 'demo', 'full_name' => 'acme/demo', 'owner' => ['login' => 'acme']],
        ])]);

        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $active->id])
            ->getJson('/api/projects/github/repositories')
            ->assertOk()
            ->assertJsonPath('data.0.full_name', 'acme/demo');

        Http::assertSent(fn (ClientRequest $request) => $request->hasHeader('Authorization', 'Bearer active-workspace-token'));
    }
}
