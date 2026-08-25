<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\AgentRunner;
use App\Models\Project;
use App\Models\Sprint;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskE2EHistoryAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_e2e_task_history_tracks_creator_transitions_agent_runs_evidence_and_actors(): void
    {
        // 1. Create Tenant User & Project
        $user = User::factory()->create(['name' => 'Alice Developer', 'email' => 'alice@example.com']);
        $workspace = Workspace::create(['name' => 'Acme Workspace', 'slug' => 'acme-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        $project = Project::create([
            'workspace_id' => $workspace->id,
            'title' => 'Payment Gateway',
            'slug' => 'payment-gw',
            'key' => 'PAY',
            'tagline' => 'Payments',
            'description' => 'E-commerce payment gateway integration',
            'type' => 'work',
            'category' => 'software',
        ]);

        $headers = ['X-Workspace-Id' => $workspace->id];

        // 2. Create Task as Alice
        $createRes = $this->actingAs($user)->withHeaders($headers)->postJson('/api/v1/tasks', [
            'project_id' => $project->id,
            'title' => 'Implement Stripe Webhook',
            'description' => 'Listen for payment_intent.succeeded events.',
            'status' => 'todo',
            'priority' => 'high',
            'story_points' => 5,
        ])->assertCreated();

        $taskId = $createRes->json('data.id');

        // 3. Update Task: Transition from 'todo' to 'in_progress'
        $this->actingAs($user)->withHeaders($headers)->patchJson("/api/v1/tasks/{$taskId}", [
            'status' => 'in_progress',
            'transition_reason' => 'Bắt đầu phát triển webhook handler',
        ])->assertOk();

        // 4. Register Desktop Runner
        $runner = AgentRunner::create([
            'workspace_id' => $workspace->id,
            'name' => 'Alice Mac Studio',
            'hostname' => 'mac-studio-m2.local',
            'machine_name' => 'mac-studio',
            'os_platform' => 'darwin',
            'token_hash' => hash('sha256', 'runner-secret-token'),
        ]);

        // 5. Dispatch Task to Desktop Runner (with Gemini 3.7 Flash)
        $dispatchRes = $this->actingAs($user)->withHeaders($headers)->postJson("/api/v1/tasks/{$taskId}/dispatch", [
            'runner_id' => $runner->id,
            'provider' => 'antigravity',
            'model' => 'gemini-3.7-flash',
            'execution_mode' => 'auto_pilot',
            'custom_instruction' => 'Build idempotent webhook verification',
        ])->assertCreated();

        $runId = $dispatchRes->json('run_id');

        // 6. Agent Run submits structured handoff with test evidence
        $run = AgentRun::findOrFail($runId);
        $this->actingAs($user)->withHeaders($headers)->postJson("/api/v1/tasks/agent-runs/{$runId}/handoff", [
            'summary' => 'Hoàn tất webhook handler và xử lý chữ ký Stripe.',
            'changed_files' => [
                'app/Http/Controllers/StripeWebhookController.php',
                'tests/Feature/StripeWebhookTest.php',
            ],
            'tests' => [
                [
                    'command' => 'php artisan test --filter=StripeWebhookTest',
                    'status' => 'passed',
                    'summary' => '3 passed (12 assertions)',
                ],
            ],
            'commit_sha' => str_repeat('c', 40),
        ])->assertOk();

        // 7. Human Reviewer (Bob) approves the task
        $bob = User::factory()->create(['name' => 'Bob Lead', 'email' => 'bob@example.com']);
        $workspace->members()->attach($bob->id, ['role' => 'admin']);

        $this->actingAs($bob)->withHeaders($headers)->postJson("/api/v1/tasks/work-items/{$taskId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        // 8. Fetch E2E History
        $historyRes = $this->actingAs($user)->withHeaders($headers)->getJson("/api/v1/tasks/{$taskId}/history")
            ->assertOk();

        $history = $historyRes->json();

        // Verify summary
        $this->assertTrue($history['success']);
        $this->assertSame($taskId, $history['task']['id']);
        $this->assertSame('done', $history['task']['status']);
        $this->assertGreaterThanOrEqual(4, $history['summary']['total_events']);
        $this->assertContains('Alice Developer', $history['summary']['actors_involved']);
        $this->assertContains('Bob Lead', $history['summary']['actors_involved']);

        // Verify timeline contains all key transitions
        $eventTypes = collect($history['timeline'])->pluck('event_type')->all();
        $this->assertContains('task_created', $eventTypes);
        $this->assertContains('status_transition', $eventTypes);
        $this->assertContains('task_dispatched', $eventTypes);
        $this->assertContains('handoff_submitted', $eventTypes);
        $this->assertContains('evidence_verified', $eventTypes);

        // Verify Actor Attribution on Dispatch and Approval
        $dispatchItem = collect($history['timeline'])->firstWhere('event_type', 'task_dispatched');
        $this->assertNotNull($dispatchItem);
        $this->assertSame('Alice Developer', $dispatchItem['actor']['name']);
        $this->assertSame('gemini-3.7-flash', $dispatchItem['metadata']['model']);

        $evidenceItem = collect($history['timeline'])->firstWhere('event_type', 'evidence_verified');
        $this->assertNotNull($evidenceItem);
        $this->assertSame('ok', $evidenceItem['tone']);
        $this->assertSame('passed', $evidenceItem['evidence'][0]['status']);
    }

    public function test_cross_tenant_task_history_is_forbidden(): void
    {
        $alice = User::factory()->create(['name' => 'Alice']);
        $workspaceA = Workspace::create(['name' => 'Workspace A', 'slug' => 'ws-a-' . $alice->id, 'owner_id' => $alice->id]);
        $workspaceA->members()->attach($alice->id, ['role' => 'owner']);

        $bob = User::factory()->create(['name' => 'Bob']);
        $workspaceB = Workspace::create(['name' => 'Workspace B', 'slug' => 'ws-b-' . $bob->id, 'owner_id' => $bob->id]);
        $workspaceB->members()->attach($bob->id, ['role' => 'owner']);

        $projectA = Project::create(['workspace_id' => $workspaceA->id, 'title' => 'Project A', 'slug' => 'proj-a']);
        $taskA = Task::create(['project_id' => $projectA->id, 'workspace_id' => $workspaceA->id, 'title' => 'Secret Task A']);

        // Bob tries to read Alice's task history -> 404
        $this->actingAs($bob)->withHeaders(['X-Workspace-Id' => $workspaceB->id])
            ->getJson("/api/v1/tasks/{$taskA->id}/history")
            ->assertNotFound();
    }

    public function test_mcp_can_query_task_history(): void
    {
        config(['app.env' => 'testing']);
        $user = User::factory()->create(['github_id' => 'github-history-user']);
        $workspace = Workspace::create(['name' => 'MCP History WS', 'slug' => 'mcp-hist-' . $user->id, 'owner_id' => $user->id]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);
        $project = Project::create(['workspace_id' => $workspace->id, 'title' => 'MCP Project', 'slug' => 'mcp-proj']);

        $task = Task::create([
            'project_id' => $project->id,
            'workspace_id' => $workspace->id,
            'title' => 'Audited MCP Task',
            'status' => 'in_progress',
        ]);

        $this->actingAs($user)->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson("/api/projects/{$project->id}/github/connect", [
                'github_repository' => 'acme/audit',
                'task_hub_mcp_token' => 'mcp-history-token',
            ])->assertOk();

        $headers = [
            'Authorization' => 'Bearer mcp-history-token',
            'X-Task-Hub-Project' => (string) $project->id,
        ];

        $res = $this->withHeaders($headers)->postJson('/api/tasks/mcp', [
            'jsonrpc' => '2.0',
            'id' => 10,
            'method' => 'tools/call',
            'params' => [
                'name' => 'get_task_history',
                'arguments' => ['task_id' => $task->id],
            ],
        ])->assertOk();

        $content = $res->json('result.content.0.text');
        $this->assertNotEmpty($content);
        $payload = json_decode($content, true);
        $this->assertTrue($payload['success']);
        $this->assertSame($task->id, $payload['task']['id']);
        $this->assertNotEmpty($payload['timeline']);
    }
}
