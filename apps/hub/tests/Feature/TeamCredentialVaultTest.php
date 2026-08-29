<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamCredentialVaultTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createTenant(string $name = 'Vault Team', string $plan = 'team'): array
    {
        $owner = User::factory()->create(['name' => $name . ' Owner']);
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => 'workspace-' . $owner->id,
            'owner_id' => $owner->id,
            'plan' => $plan,
            'agent_concurrency_limit' => 10,
        ]);
        $workspace->members()->attach($owner->id, ['role' => 'owner']);

        return [$owner, $workspace];
    }

    public function test_community_and_pro_plans_are_blocked_with_403_upgrade_required(): void
    {
        [$owner, $workspace] = $this->createTenant('Solo Dev', 'community');

        $response = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", [
                'provider' => 'openai',
                'name' => 'Blocked Secret',
                'secret_value' => 'sk-blocked-secret-12345',
            ]);

        $response->assertStatus(403);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error_code', 'UPGRADE_REQUIRED');
    }

    public function test_team_workspace_can_store_multiple_providers(): void
    {
        [$owner, $workspace] = $this->createTenant('AI Startup', 'team');

        $providers = [
            ['provider' => 'openai', 'name' => 'OpenAI GPT-4o Key', 'secret_value' => 'sk-proj-openai-key-123456789'],
            ['provider' => 'anthropic', 'name' => 'Claude 3.7 Key', 'secret_value' => 'sk-ant-claude-key-987654321'],
            ['provider' => 'gemini', 'name' => 'Gemini 2.5 Flash Key', 'secret_value' => 'AIzaSyD-gemini-key-111222333'],
            ['provider' => 'github', 'name' => 'GitHub Deployment PAT', 'secret_value' => 'github_pat_11AAAAAAA_bbbbbbb'],
            ['provider' => 'custom', 'name' => 'Internal LLM Key', 'secret_value' => 'custom_token_abcdef123456'],
        ];

        foreach ($providers as $item) {
            $res = $this->actingAs($owner)
                ->withHeaders(['X-Workspace-Id' => $workspace->id])
                ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", $item);

            $res->assertStatus(201);
            $res->assertJsonPath('success', true);
            $res->assertJsonPath('data.name', $item['name']);
            $res->assertJsonPath('data.provider', $item['provider']);
            $res->assertJsonPath('data.masked_value', '••••••••');
        }

        $this->assertDatabaseCount('workspace_credentials', 5);
    }

    public function test_ciphertext_is_encrypted_and_never_exposed_as_plaintext(): void
    {
        [$owner, $workspace] = $this->createTenant('Crypto Team', 'team');
        $rawSecret = 'super_secret_unencrypted_api_token_2026';

        $res = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", [
                'provider' => 'gemini',
                'name' => 'Crypto Gemini Key',
                'secret_value' => $rawSecret,
            ]);

        $res->assertStatus(201);
        $res->assertJsonMissing(['secret_value' => $rawSecret]);
        $this->assertDatabaseMissing('workspace_credentials', ['ciphertext' => $rawSecret]);

        $cred = WorkspaceCredential::where('workspace_id', $workspace->id)->first();
        $this->assertNotEquals($rawSecret, $cred->ciphertext);
        $this->assertStringStartsWith('sha256_', $res->json('data.fingerprint'));
    }

    public function test_owner_and_admin_can_reveal_secret(): void
    {
        [$owner, $workspace] = $this->createTenant('Reveal Team', 'team');
        $admin = User::factory()->create();
        $workspace->members()->attach($admin->id, ['role' => 'admin']);

        $rawSecret = 'sk-proj-reveal-me-safely-12345';
        $cred = app(\App\Services\CredentialVaultService::class)->put($workspace, null, 'openai', $rawSecret, 'Test OpenAI Key');

        // Owner reveal
        $ownerRes = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials/{$cred->id}/reveal");

        $ownerRes->assertOk();
        $ownerRes->assertJsonPath('secret_value', $rawSecret);

        // Admin reveal
        $adminRes = $this->actingAs($admin)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials/{$cred->id}/reveal");

        $adminRes->assertOk();
        $adminRes->assertJsonPath('secret_value', $rawSecret);
    }

    public function test_developer_and_viewer_cannot_reveal_secret(): void
    {
        [$owner, $workspace] = $this->createTenant('RBAC Guard Team', 'team');
        $dev = User::factory()->create();
        $viewer = User::factory()->create();
        $workspace->members()->attach($dev->id, ['role' => 'developer']);
        $workspace->members()->attach($viewer->id, ['role' => 'viewer']);

        $cred = app(\App\Services\CredentialVaultService::class)->put($workspace, null, 'anthropic', 'sk-ant-secret-key-12345', 'Anthropic Guard Key');

        // Developer attempt -> 403
        $this->actingAs($dev)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials/{$cred->id}/reveal")
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'UNAUTHORIZED_REVEAL');

        // Viewer attempt -> 403
        $this->actingAs($viewer)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials/{$cred->id}/reveal")
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'UNAUTHORIZED_REVEAL');
    }

    public function test_developer_can_create_secret_but_viewer_cannot(): void
    {
        [$owner, $workspace] = $this->createTenant('Role Create Team', 'team');
        $dev = User::factory()->create();
        $viewer = User::factory()->create();
        $workspace->members()->attach($dev->id, ['role' => 'developer']);
        $workspace->members()->attach($viewer->id, ['role' => 'viewer']);

        // Developer creates -> 201
        $this->actingAs($dev)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", [
                'provider' => 'github',
                'name' => 'Dev Deployment PAT',
                'secret_value' => 'github_pat_valid_key_123456789',
            ])
            ->assertStatus(201);

        // Viewer creates -> 403
        $this->actingAs($viewer)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", [
                'provider' => 'github',
                'name' => 'Viewer Blocked PAT',
                'secret_value' => 'github_pat_blocked_key_123456789',
            ])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'UNAUTHORIZED_ACTION');
    }

    public function test_owner_and_admin_can_delete_secret(): void
    {
        [$owner, $workspace] = $this->createTenant('Delete Team', 'team');
        $cred = app(\App\Services\CredentialVaultService::class)->put($workspace, null, 'openai', 'sk-test-delete', 'To Delete');

        $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->deleteJson("/api/v1/workspaces/{$workspace->id}/credentials/{$cred->id}")
            ->assertOk();

        $this->assertDatabaseMissing('workspace_credentials', ['id' => $cred->id]);
    }

    public function test_duplicate_credential_name_returns_422(): void
    {
        [$owner, $workspace] = $this->createTenant('Dup Team', 'team');
        app(\App\Services\CredentialVaultService::class)->put($workspace, null, 'openai', 'sk-proj-original', 'Same Name');

        $res = $this->actingAs($owner)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/v1/workspaces/{$workspace->id}/credentials", [
                'provider' => 'gemini',
                'name' => 'Same Name',
                'secret_value' => 'AIzaSyD-different-key',
            ]);

        $res->assertStatus(422);
        $res->assertJsonPath('error_code', 'DUPLICATE_CREDENTIAL_NAME');
    }

    public function test_tenant_isolation_prevents_access_to_foreign_workspace_secrets(): void
    {
        [$ownerA, $workspaceA] = $this->createTenant('Tenant A', 'team');
        [$ownerB, $workspaceB] = $this->createTenant('Tenant B', 'team');

        $credB = app(\App\Services\CredentialVaultService::class)->put($workspaceB, null, 'anthropic', 'sk-ant-tenant-b-secret', 'Tenant B Key');

        // Owner A cannot reveal Tenant B's secret
        $this->actingAs($ownerA)
            ->withHeaders(['X-Workspace-Id' => $workspaceA->id])
            ->postJson("/api/v1/workspaces/{$workspaceA->id}/credentials/{$credB->id}/reveal")
            ->assertStatus(404);
    }
}
