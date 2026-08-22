<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\AgentRunner;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServerAgentRunnerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // The server runner is deferred in production, but these contract
        // tests remain enabled as coverage for the future opt-in release.
        config(['services.task_hub.server_runner_enabled' => true]);
    }

    public function test_runner_registration_issues_a_token_once_and_heartbeat_is_authenticated(): void
    {
        config(['services.task_hub.runner_registration_token' => 'bootstrap-secret']);
        $response = $this->withHeaders(['X-Task-Hub-Runner-Registration' => 'bootstrap-secret'])->postJson('/api/v1/runners/register', [
            'name' => 'ci-runner', 'hostname' => 'runner-1', 'capabilities' => ['codex' => ['headless']],
        ])->assertCreated();

        $token = $response->json('token');
        $runnerId = $response->json('runner.id');
        $this->assertNotEmpty($token);
        $this->assertDatabaseMissing('agent_runners', ['token_hash' => $token]);

        $this->withToken($token)->postJson('/api/v1/runners/' . $runnerId . '/heartbeat', ['status' => 'online'])->assertOk();
        $this->withToken('wrong')->postJson('/api/v1/runners/' . $runnerId . '/heartbeat', ['status' => 'online'])->assertUnauthorized();
    }

    public function test_server_run_can_be_claimed_once_and_logs_are_idempotent_and_redacted(): void
    {
        config(['services.task_hub.runner_registration_token' => 'bootstrap-secret']);
        $registration = $this->withHeaders(['X-Task-Hub-Runner-Registration' => 'bootstrap-secret'])->postJson('/api/v1/runners/register', [
            'name' => 'codex-runner', 'capabilities' => ['codex' => ['headless']],
        ])->assertCreated();
        $token = $registration->json('token');
        $runnerId = $registration->json('runner.id');
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Tenant', 'slug' => 'tenant-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $run = AgentRun::create([
            'workspace_id' => $workspace->id, 'provider' => 'codex', 'status' => 'queued', 'execution_mode' => 'server',
            'repository' => 'acme/demo', 'queued_at' => now(), 'metadata' => ['context' => ['work_item' => ['title' => 'Demo']]],
        ]);

        $claimed = $this->withToken($token)->getJson('/api/v1/runners/' . $runnerId . '/jobs/claim?provider=codex')->assertOk();
        $claimed->assertJsonPath('data.id', $run->id)->assertJsonPath('data.status', 'claimed');
        $this->withToken($token)->getJson('/api/v1/runners/' . $runnerId . '/jobs/claim?provider=codex')->assertOk()->assertJsonPath('data', null);

        $eventId = '11111111-1111-4111-8111-111111111111';
        $this->withToken($token)->postJson('/api/v1/agent-runs/' . $run->id . '/events', ['event_id' => $eventId, 'event_type' => 'started', 'status' => 'running'])->assertOk();
        $this->withToken($token)->postJson('/api/v1/agent-runs/' . $run->id . '/events', ['event_id' => $eventId, 'event_type' => 'started', 'status' => 'running'])->assertJsonPath('duplicate', true);
        $this->withToken($token)->postJson('/api/v1/agent-runs/' . $run->id . '/logs', ['sequence' => 1, 'content' => 'Authorization: Bearer super-secret-token'])->assertOk();
        $this->withToken($token)->postJson('/api/v1/agent-runs/' . $run->id . '/logs', ['sequence' => 1, 'content' => 'duplicate'])->assertOk();
        $this->assertDatabaseCount('agent_run_logs', 1);
        $this->assertDatabaseHas('agent_run_logs', ['agent_run_id' => $run->id, 'content' => 'Authorization: Bearer [REDACTED]']);
    }

    public function test_heartbeat_renews_active_lease_and_delivers_cancellation_command(): void
    {
        config(['services.task_hub.runner_registration_token' => 'bootstrap-secret']);
        $registration = $this->withHeaders(['X-Task-Hub-Runner-Registration' => 'bootstrap-secret'])
            ->postJson('/api/v1/runners/register', ['name' => 'codex-runner'])->assertCreated();
        $token = $registration->json('token');
        $runnerId = $registration->json('runner.id');
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Tenant', 'slug' => 'tenant-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $run = AgentRun::create([
            'workspace_id' => $workspace->id, 'runner_id' => $runnerId, 'provider' => 'codex',
            'status' => 'running', 'execution_mode' => 'server', 'cancel_requested_at' => now(),
            'lease_expires_at' => now()->subMinute(),
        ]);

        $response = $this->withToken($token)->postJson('/api/v1/runners/' . $runnerId . '/heartbeat', [
            'status' => 'busy', 'active_run_ids' => [$run->id],
        ])->assertOk();

        $response->assertJsonPath('commands.0.type', 'cancel')->assertJsonPath('commands.0.run_id', $run->id);
        $this->assertTrue($run->fresh()->lease_expires_at->isFuture());
    }

    public function test_runner_cannot_write_to_a_run_owned_by_another_runner(): void
    {
        config(['services.task_hub.runner_registration_token' => 'bootstrap-secret']);
        $first = $this->withHeaders(['X-Task-Hub-Runner-Registration' => 'bootstrap-secret'])->postJson('/api/v1/runners/register', ['name' => 'one'])->assertCreated();
        $second = $this->withHeaders(['X-Task-Hub-Runner-Registration' => 'bootstrap-secret'])->postJson('/api/v1/runners/register', ['name' => 'two'])->assertCreated();
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'Tenant', 'slug' => 'tenant-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $run = AgentRun::create(['workspace_id' => $workspace->id, 'provider' => 'codex', 'status' => 'queued', 'execution_mode' => 'server', 'queued_at' => now()]);
        $this->withToken($first->json('token'))->getJson('/api/v1/runners/' . $first->json('runner.id') . '/jobs/claim?provider=codex')->assertOk();
        $this->withToken($second->json('token'))->postJson('/api/v1/agent-runs/' . $run->id . '/cancel')->assertUnauthorized();
    }
}
