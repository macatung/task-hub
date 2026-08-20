<?php

namespace Tests\Feature;

use App\Models\AgentRun;
use App\Models\Task;
use App\Models\Project;
use App\Models\User;
use App\Models\ProjectDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class TaskHubAgentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_run_receives_context_and_can_attach_evidence(): void
    {
        $task = Task::create([
            'title' => 'Implement sync adapter',
            'description' => 'Connect the task hub to coding agents.',
            'acceptance_criteria' => "- MCP returns the work item\n- Evidence is stored",
            'definition_of_done' => 'Tests pass and human review is requested.',
            'risk_level' => 'medium',
        ]);

        $response = $this->postJson('/api/tasks/agent-runs', [
            'task_id' => $task->id,
            'provider' => 'codex',
            'agent_session_id' => 'codex-session-1',
        ])->assertCreated();

        $runId = $response->json('data.id');
        $response->assertJsonPath('data.context_hash', fn ($value) => is_string($value) && strlen($value) === 64);
        $response->assertJsonPath('context.work_item.acceptance_criteria', "- MCP returns the work item\n- Evidence is stored");

        $this->patchJson('/api/tasks/agent-runs/' . $runId, [
            'status' => 'needs_review',
            'branch' => 'agent/task-1',
            'commit_sha' => str_repeat('a', 40),
        ])->assertOk();

        $this->postJson('/api/tasks/agent-runs/' . $runId . '/evidence', [
            'evidence_type' => 'test',
            'status' => 'passed',
            'command' => 'npm test',
            'summary' => 'All tests passed.',
        ])->assertCreated();

        $this->postJson('/api/tasks/work-items/' . $task->id . '/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        $this->assertDatabaseHas('agent_runs', ['id' => $runId, 'status' => 'verified']);
        $this->assertDatabaseHas('verification_evidence', ['agent_run_id' => $runId, 'status' => 'passed']);
    }

    public function test_agent_events_and_github_webhooks_are_idempotent(): void
    {
        $run = AgentRun::create(['provider' => 'claude_code', 'agent_session_id' => 'session-2']);
        $eventId = '11111111-1111-4111-8111-111111111111';

        $payload = ['event_id' => $eventId, 'event_type' => 'test_finished', 'status' => 'needs_review', 'payload' => ['passed' => true]];
        $this->postJson('/api/tasks/agent-runs/' . $run->id . '/events', $payload)->assertOk();
        $this->postJson('/api/tasks/agent-runs/' . $run->id . '/events', $payload)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertDatabaseCount('agent_run_events', 1);

        $webhook = $this->withHeaders(['X-GitHub-Delivery' => '22222222-2222-4222-8222-222222222222', 'X-GitHub-Event' => 'check_run'])
            ->postJson('/api/tasks/github/webhook', ['repository' => ['full_name' => 'owner/repo'], 'check_run' => ['head_sha' => str_repeat('b', 40), 'conclusion' => 'success']]);
        $webhook->assertStatus(202);
        $this->withHeaders(['X-GitHub-Delivery' => '22222222-2222-4222-8222-222222222222', 'X-GitHub-Event' => 'check_run'])
            ->postJson('/api/tasks/github/webhook', ['repository' => ['full_name' => 'owner/repo']])
            ->assertJsonPath('duplicate', true);
        $this->assertDatabaseCount('github_events', 1);
    }

    public function test_mcp_lists_tools_and_requires_token_when_configured(): void
    {
        config(['app.env' => 'testing']);
        $user = User::factory()->create(['github_id' => 'github-mcp-user']);
        $user->forceFill(['github_access_token' => Crypt::encryptString('project-github-token')])->save();
        $project = Project::create([
            'slug' => 'mcp-project', 'title' => 'MCP Project', 'tagline' => 'MCP',
            'description' => 'MCP project', 'type' => 'work', 'category' => 'tools',
        ]);
        $this->actingAs($user)->postJson('/api/projects/' . $project->id . '/github/connect', [
            'github_repository' => 'acme/mcp', 'task_hub_mcp_token' => 'project-mcp-token',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer project-mcp-token', 'X-Task-Hub-Project' => (string) $project->id];
        $this->withHeaders($headers)->postJson('/api/tasks/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
            ->assertOk()
            ->assertJsonPath('result.tools.0.name', 'get_work_item');

        $task = Task::create(['title' => 'MCP context task', 'project_id' => $project->id]);
        $this->withHeaders($headers)->postJson('/api/tasks/mcp', [
            'jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/call',
            'params' => ['name' => 'get_context_pack', 'arguments' => ['task_id' => $task->id]],
        ])->assertOk()->assertJsonPath('result.content.0.type', 'text');

        $this->withHeaders($headers)->postJson('/api/tasks/mcp', [
            'jsonrpc' => '2.0', 'id' => 4, 'method' => 'tools/call',
            'params' => ['name' => 'get_project_state', 'arguments' => ['project_id' => $project->id]],
        ])->assertOk()->assertJsonPath('result.content.0.type', 'text');

        $this->withHeaders($headers)->postJson('/api/tasks/mcp', [
            'jsonrpc' => '2.0', 'id' => 3, 'method' => 'tools/call',
            'params' => ['name' => 'preview_project_breakdown', 'arguments' => [
                'prompt' => 'Xây dựng dashboard quản lý repository GitHub cho nhóm indie',
                'sprint_count' => 1,
            ]],
        ])->assertOk()->assertJsonPath('result.content.0.type', 'text');
    }

    public function test_project_document_registry_is_imported_linked_and_delivered_to_agent_context(): void
    {
        $project = Project::create(['slug' => 'knowledge-project', 'title' => 'Knowledge Project', 'tagline' => 'Knowledge', 'description' => 'Project docs', 'type' => 'work', 'category' => 'tools']);
        $manifest = "| type | title | path_or_url | owner | version | tags |\n| --- | --- | --- | --- | --- | --- |\n| brief | Project Brief | docs/BRIEF.md | PM | 2.0 | scope |\n| architecture | System Design | docs/ARCH.md | Tech Lead | 1.1 | api |";
        $this->postJson('/api/projects/' . $project->id . '/documents/import-manifest', ['content' => $manifest])
            ->assertOk()->assertJsonPath('data.imported', 2);
        $brief = ProjectDocument::where('project_id', $project->id)->where('document_type', 'brief')->firstOrFail();
        $task = Task::create(['project_id' => $project->id, 'title' => 'Use the specification']);
        $this->postJson('/api/tasks/' . $task->id . '/documents', ['project_document_id' => $brief->id, 'is_required' => true, 'purpose' => 'Defines scope'])
            ->assertOk();

        $context = $this->getJson('/api/tasks/context-pack?task_id=' . $task->id)->assertOk();
        $context->assertJsonPath('data.project_knowledge.0.type', 'brief')
            ->assertJsonPath('data.project_knowledge.0.required_for_task', true);
        $this->getJson('/api/projects/' . $project->id . '/documents')->assertOk()
            ->assertJsonPath('data.summary.total', 2)
            ->assertJsonPath('data.summary.missing_core.0', 'prd');
    }

    public function test_project_release_log_keeps_each_deployment(): void
    {
        $project = Project::create(['slug' => 'release-project', 'title' => 'Release Project', 'tagline' => 'Release', 'description' => 'Release history', 'type' => 'work', 'category' => 'tools']);
        $this->postJson('/api/projects/' . $project->id . '/releases', [
            'version' => 'v1.2.0', 'environment' => 'production', 'summary' => 'Knowledge layer deployed.',
            'changes' => ['Document registry', 'Desktop cockpit'], 'commit_sha' => str_repeat('a', 40), 'deployed_by' => 'release-bot',
        ])->assertCreated()->assertJsonPath('data.version', 'v1.2.0');
        $this->getJson('/api/projects/' . $project->id . '/releases')->assertOk()
            ->assertJsonPath('data.0.environment', 'production')
            ->assertJsonPath('data.0.changes.1', 'Desktop cockpit');
    }

    public function test_structured_handoff_creates_evidence_and_requests_review(): void
    {
        $task = Task::create(['title' => 'Finish agent handoff']);
        $run = AgentRun::create(['task_id' => $task->id, 'provider' => 'codex', 'agent_session_id' => 'handoff-session', 'status' => 'running']);
        $this->postJson('/api/tasks/agent-runs/' . $run->id . '/handoff', [
            'summary' => 'Implemented the requested agent workspace.',
            'changed_files' => ['desktop/src/components/AgentConsoleModal.vue'],
            'tests' => [['command' => 'npm test', 'status' => 'passed', 'summary' => 'All tests passed.']],
            'commit_sha' => str_repeat('a', 40), 'blockers' => null,
        ])->assertOk()->assertJsonPath('data.status', 'needs_review');
        $this->assertDatabaseHas('verification_evidence', ['agent_run_id' => $run->id, 'command' => 'npm test', 'status' => 'passed']);
    }

    public function test_project_github_configuration_is_encrypted_and_syncs_snapshot(): void
    {
        $project = Project::create([
            'slug' => 'agent-sync-project', 'title' => 'Agent Sync Project', 'tagline' => 'Sync',
            'description' => 'Project integration test', 'type' => 'work', 'category' => 'tools',
        ]);
        $user = User::factory()->create(['github_id' => 'github-sync-user']);
        $user->forceFill(['github_access_token' => Crypt::encryptString('github-user-token')])->save();

        $this->actingAs($user)->postJson('/api/projects/' . $project->id . '/github/connect', [
            'github_repository' => 'acme/demo',
            'github_default_branch' => 'develop',
            'github_webhook_secret' => 'project-webhook-secret',
            'task_hub_mcp_token' => 'project-mcp-secret',
        ])->assertOk()
            ->assertJsonPath('data.repository', 'acme/demo')
            ->assertJsonPath('data.has_github_access', true)
            ->assertJsonPath('data.has_mcp_token', true);

        $this->assertDatabaseMissing('projects', ['github_token' => 'github-secret-token']);
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'github_repository' => 'acme/demo']);

        $task = Task::create(['project_id' => $project->id, 'title' => 'Use project repository']);
        $this->postJson('/api/tasks/agent-runs', ['task_id' => $task->id, 'provider' => 'codex'])
            ->assertCreated()
            ->assertJsonPath('data.repository', 'acme/demo')
            ->assertJsonPath('data.branch', 'develop');

        Http::fake([
            'https://api.github.com/repos/acme/demo' => Http::response(['full_name' => 'acme/demo', 'default_branch' => 'develop', 'private' => true, 'html_url' => 'https://github.com/acme/demo'], 200),
            'https://api.github.com/repos/acme/demo/issues*' => Http::response([['number' => 1, 'title' => 'Issue one', 'state' => 'open', 'html_url' => 'https://github.com/acme/demo/issues/1', 'labels' => []]], 200),
            'https://api.github.com/repos/acme/demo/pulls*' => Http::response([['number' => 2, 'title' => 'Pull one', 'state' => 'open', 'draft' => false, 'html_url' => 'https://github.com/acme/demo/pull/2', 'head' => ['ref' => 'agent/task-1']]], 200),
        ]);

        $this->actingAs($user)->postJson('/api/projects/' . $project->id . '/github/sync')
            ->assertOk()
            ->assertJsonPath('data.sync_status', 'synced')
            ->assertJsonPath('data.snapshot.repository.full_name', 'acme/demo');
    }

    public function test_github_oauth_callback_logs_user_in_and_encrypts_access_token(): void
    {
        putenv('GITHUB_CLIENT_ID=test-client');
        putenv('GITHUB_CLIENT_SECRET=test-secret');
        Http::fake([
            'https://github.com/login/oauth/access_token' => Http::response(['access_token' => 'oauth-access-token', 'scope' => 'read:user,user:email,repo'], 200),
            'https://api.github.com/user' => Http::response(['id' => 9876, 'login' => 'octocat', 'name' => 'Octo Cat', 'avatar_url' => 'https://avatars.example/octo.png', 'email' => null], 200),
            'https://api.github.com/user/emails' => Http::response([['email' => 'octo@example.com', 'primary' => true, 'verified' => true]], 200),
        ]);

        $this->withSession(['github_oauth_state' => 'oauth-state', 'github_oauth_intended' => '/tasks'])
            ->get('/auth/github/callback?code=oauth-code&state=oauth-state')
            ->assertRedirect('/tasks');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', ['github_id' => '9876', 'github_login' => 'octocat']);
        $this->assertDatabaseMissing('users', ['github_access_token' => 'oauth-access-token']);
        putenv('GITHUB_CLIENT_ID');
        putenv('GITHUB_CLIENT_SECRET');
    }

    public function test_github_oauth_fallback_redirects_to_tasks_subdomain_root(): void
    {
        $this->get('https://tasks.macatung.dev/auth/github/callback?state=invalid')
            ->assertRedirect('https://tasks.macatung.dev/');
    }
}
