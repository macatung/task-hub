<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\AgentRunLog;
use App\Models\Plan;
use App\Models\User;
use App\Models\VerificationEvidence;
use App\Models\Workspace;
use Carbon\Carbon;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RetentionPruningCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createWorkspace(string $name, string $planSlug): Workspace
    {
        $user = User::factory()->create(['name' => $name . ' Owner']);
        $ws = Workspace::create([
            'name' => $name,
            'slug' => Str::slug($name) . '-' . $user->id,
            'owner_id' => $user->id,
            'plan' => $planSlug,
            'agent_concurrency_limit' => 1,
        ]);
        $ws->members()->attach($user->id, ['role' => 'owner']);
        return $ws;
    }

    private function createRun(Workspace $ws, string $status, int $daysOld, int $logs = 2, int $events = 2, int $evidence = 1): AgentRun
    {
        $createdAt = Carbon::now()->subDays($daysOld)->subHours(1);
        $run = AgentRun::create([
            'workspace_id' => $ws->id,
            'provider' => 'gemini',
            'status' => $status,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        for ($i = 1; $i <= $logs; $i++) {
            AgentRunLog::create([
                'agent_run_id' => $run->id,
                'sequence' => $i,
                'stream' => 'stdout',
                'content' => "Log message {$i}",
                'occurred_at' => $createdAt,
            ]);
        }

        for ($j = 1; $j <= $events; $j++) {
            AgentRunEvent::create([
                'agent_run_id' => $run->id,
                'event_id' => (string) Str::uuid(),
                'event_type' => 'step_progress',
                'status' => 'ok',
                'occurred_at' => $createdAt,
            ]);
        }

        for ($k = 1; $k <= $evidence; $k++) {
            VerificationEvidence::create([
                'agent_run_id' => $run->id,
                'evidence_type' => 'test_suite',
                'status' => 'passed',
                'command' => 'npm test',
                'created_at' => $createdAt,
            ]);
        }

        return $run;
    }

    public function test_prunes_expired_runs_across_all_plans(): void
    {
        $wsCommunity = $this->createWorkspace('Community WS', 'community'); // 7d
        $wsPro = $this->createWorkspace('Pro WS', 'pro');             // 90d
        $wsTeam = $this->createWorkspace('Team WS', 'team');           // 365d
        $wsEnt = $this->createWorkspace('Enterprise WS', 'enterprise'); // 730d

        $r1 = $this->createRun($wsCommunity, 'completed', 10); // EXPIRED
        $r2 = $this->createRun($wsCommunity, 'completed', 3);  // KEEP
        $r3 = $this->createRun($wsPro, 'completed', 100);      // EXPIRED
        $r4 = $this->createRun($wsPro, 'completed', 50);       // KEEP
        $r5 = $this->createRun($wsTeam, 'completed', 400);     // EXPIRED
        $r6 = $this->createRun($wsTeam, 'completed', 200);     // KEEP
        $r7 = $this->createRun($wsEnt, 'completed', 800);      // EXPIRED
        $r8 = $this->createRun($wsEnt, 'completed', 500);      // KEEP

        $this->artisan('task-history:prune')
            ->expectsOutputToContain('Finished. Total runs pruned: 4')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('agent_runs', ['id' => $r1->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $r2->id]);
        $this->assertDatabaseMissing('agent_runs', ['id' => $r3->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $r4->id]);
        $this->assertDatabaseMissing('agent_runs', ['id' => $r5->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $r6->id]);
        $this->assertDatabaseMissing('agent_runs', ['id' => $r7->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $r8->id]);
    }

    public function test_cascades_deletion_to_logs_events_and_evidence(): void
    {
        $ws = $this->createWorkspace('Cascade WS', 'community');
        $run = $this->createRun($ws, 'completed', 15, 3, 4, 2);

        $this->assertDatabaseHas('agent_run_logs', ['agent_run_id' => $run->id]);
        $this->assertDatabaseHas('agent_run_events', ['agent_run_id' => $run->id]);
        $this->assertDatabaseHas('verification_evidence', ['agent_run_id' => $run->id]);

        $this->artisan('task-history:prune')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('agent_runs', ['id' => $run->id]);
        $this->assertDatabaseMissing('agent_run_logs', ['agent_run_id' => $run->id]);
        $this->assertDatabaseMissing('agent_run_events', ['agent_run_id' => $run->id]);
        $this->assertDatabaseMissing('verification_evidence', ['agent_run_id' => $run->id]);
    }

    public function test_dry_run_leaves_database_records_intact(): void
    {
        $ws = $this->createWorkspace('DryRun WS', 'community');
        $run = $this->createRun($ws, 'completed', 20);

        $this->artisan('task-history:prune', ['--dry-run' => true])
            ->expectsOutputToContain('dry-run: true')
            ->assertExitCode(0);

        $this->assertDatabaseHas('agent_runs', ['id' => $run->id]);
    }

    public function test_workspace_option_targets_single_workspace(): void
    {
        $ws1 = $this->createWorkspace('WS One', 'community');
        $ws2 = $this->createWorkspace('WS Two', 'community');

        $r1 = $this->createRun($ws1, 'completed', 20);
        $r2 = $this->createRun($ws2, 'completed', 20);

        $this->artisan('task-history:prune', ['--workspace' => $ws1->id])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('agent_runs', ['id' => $r1->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $r2->id]);
    }

    public function test_days_override_option_applies_to_execution(): void
    {
        $ws = $this->createWorkspace('Override WS', 'team'); // Normal: 365d
        $run = $this->createRun($ws, 'completed', 30);       // Not expired under 365d, but expired under 15d

        $this->artisan('task-history:prune', ['--workspace' => $ws->id, '--days' => 15])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('agent_runs', ['id' => $run->id]);
    }

    public function test_active_and_in_progress_runs_are_protected(): void
    {
        $ws = $this->createWorkspace('Protected WS', 'community');
        $rRunning = $this->createRun($ws, 'running', 40);
        $rWaiting = $this->createRun($ws, 'waiting_input', 40);
        $rClaimed = $this->createRun($ws, 'claimed', 40);

        $this->artisan('task-history:prune', ['--workspace' => $ws->id])
            ->assertExitCode(0);

        $this->assertDatabaseHas('agent_runs', ['id' => $rRunning->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $rWaiting->id]);
        $this->assertDatabaseHas('agent_runs', ['id' => $rClaimed->id]);
    }

    public function test_invalid_workspace_id_returns_failure(): void
    {
        $this->artisan('task-history:prune', ['--workspace' => 99999])
            ->expectsOutputToContain('not found')
            ->assertExitCode(1);
    }

    public function test_chunk_size_option_processes_records(): void
    {
        $ws = $this->createWorkspace('Chunk WS', 'community');
        $r1 = $this->createRun($ws, 'completed', 20);
        $r2 = $this->createRun($ws, 'completed', 25);

        $this->artisan('task-history:prune', ['--workspace' => $ws->id, '--chunk' => 1])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('agent_runs', ['id' => $r1->id]);
        $this->assertDatabaseMissing('agent_runs', ['id' => $r2->id]);
    }
}
