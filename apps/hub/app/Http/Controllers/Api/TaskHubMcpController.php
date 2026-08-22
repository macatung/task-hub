<?php

namespace App\Http\Controllers\Api;

use App\Models\AgentRun;
use App\Models\DesktopPairingSession;
use App\Models\Project;
use App\Models\Task;
use App\Services\TaskHubContextPackService;
use Illuminate\Http\Request;
use App\Services\GithubProjectIntegrationService;
use App\Services\SmartProjectBreakdownService;

class TaskHubMcpController extends \App\Http\Controllers\Controller
{
    public function handle(Request $request)
    {
        if ($request->isMethod('OPTIONS')) {
            return response('', 200, [
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers' => 'Authorization, Content-Type, X-Task-Hub-Project, X-Task-Hub-Workspace, X-Requested-With',
            ]);
        }

        if ($request->isMethod('GET')) {
            return response()->json([
                'name' => 'task-hub',
                'protocolVersion' => '2024-11-05',
                'version' => '1.0.0',
                'status' => 'online',
                'capabilities' => [
                    'tools' => (object) [],
                    'experimental' => [
                        'task_hub' => [
                            'api_version' => 'v1',
                            'structured_handoff' => true,
                            'device_pairing' => true
                        ]
                    ]
                ],
                'tools' => $this->tools()
            ]);
        }

        $payload = [];
        try {
            $payload = $request->json()->all() ?: [];
            if (!$this->validProjectOrWorkspaceToken($request, $payload)) {
                return response()->json(['jsonrpc' => '2.0', 'error' => ['code' => -32001, 'message' => 'Invalid project or workspace MCP token']], 401);
            }

            $id = $payload['id'] ?? null;
            $method = $payload['method'] ?? '';
            $params = $payload['params'] ?? [];

            $result = match ($method) {
                'initialize' => [
                    'protocolVersion' => '2024-11-05',
                    'serverInfo' => [
                        'name' => 'task-hub',
                        'version' => '1.0.0'
                    ],
                    'capabilities' => [
                        'tools' => (object) [],
                        'experimental' => [
                            'task_hub' => [
                                'api_version' => 'v1',
                                'structured_handoff' => true,
                                'device_pairing' => true
                            ]
                        ]
                    ]
                ],
                'notifications/initialized', 'initialized' => (object) [],
                'ping' => (object) [],
                'tools/list' => ['tools' => $this->tools()],
                'tools/call' => $this->callTool($params, $request, $payload),
                default => throw new \InvalidArgumentException('Method not found: ' . $method),
            };
            $response = ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result];
            return response()->json($response);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('MCP Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['jsonrpc' => '2.0', 'id' => $payload['id'] ?? null, 'error' => ['code' => -32000, 'message' => $e->getMessage()]], 200);
        }
    }

    private function tools(): array
    {
        return [
            ['name' => 'get_work_item', 'description' => 'Read a Task Hub work item.', 'inputSchema' => ['type' => 'object', 'properties' => ['task_id' => ['type' => 'integer']], 'required' => ['task_id']]],
            ['name' => 'get_context_pack', 'description' => 'Build the current context pack for a task.', 'inputSchema' => ['type' => 'object', 'properties' => ['task_id' => ['type' => 'integer']], 'required' => ['task_id']]],
            ['name' => 'list_project_documents', 'description' => 'Read the project document registry, including document freshness and gaps.', 'inputSchema' => ['type' => 'object', 'properties' => ['project_id' => ['type' => 'integer']], 'required' => ['project_id']]],
            ['name' => 'get_task_references', 'description' => 'Read project documents relevant to one task; required references are flagged.', 'inputSchema' => ['type' => 'object', 'properties' => ['task_id' => ['type' => 'integer']], 'required' => ['task_id']]],
            ['name' => 'start_agent_run', 'description' => 'Create an auditable agent run for the selected task.', 'inputSchema' => ['type' => 'object', 'properties' => ['task_id' => ['type' => 'integer'], 'provider' => ['type' => 'string'], 'agent_session_id' => ['type' => 'string'], 'repository' => ['type' => 'string'], 'branch' => ['type' => 'string'], 'context' => ['type' => 'object'], 'instruction' => ['type' => 'object']], 'required' => ['task_id', 'provider']]],
            ['name' => 'update_agent_run', 'description' => 'Update agent lifecycle and repository references.', 'inputSchema' => ['type' => 'object', 'properties' => ['run_id' => ['type' => 'integer'], 'status' => ['type' => 'string'], 'summary' => ['type' => 'string']], 'required' => ['run_id']]],
            ['name' => 'attach_verification_evidence', 'description' => 'Attach test/build/security evidence to an agent run.', 'inputSchema' => ['type' => 'object', 'properties' => ['run_id' => ['type' => 'integer'], 'evidence_type' => ['type' => 'string'], 'status' => ['type' => 'string'], 'command' => ['type' => 'string'], 'summary' => ['type' => 'string']], 'required' => ['run_id', 'evidence_type', 'status']]],
            ['name' => 'complete_agent_handoff', 'description' => 'Atomically submit a structured handoff with changed files and test evidence, then request review.', 'inputSchema' => ['type' => 'object', 'properties' => ['run_id' => ['type' => 'integer'], 'summary' => ['type' => 'string'], 'changed_files' => ['type' => 'array', 'items' => ['type' => 'string']], 'tests' => ['type' => 'array'], 'commit_sha' => ['type' => 'string'], 'pull_request_url' => ['type' => 'string'], 'blockers' => ['type' => 'string']], 'required' => ['run_id', 'summary', 'changed_files', 'tests']]],
            ['name' => 'request_human_approval', 'description' => 'Request human approval after evidence is attached.', 'inputSchema' => ['type' => 'object', 'properties' => ['task_id' => ['type' => 'integer']], 'required' => ['task_id']]],
            ['name' => 'get_next_action', 'description' => 'Return the next smallest actionable task.', 'inputSchema' => ['type' => 'object', 'properties' => ['project_id' => ['type' => 'integer']]]],
            ['name' => 'get_project_state', 'description' => 'Read the current project state before planning more work: progress, sprints, blockers, agent runs, verification and GitHub snapshot.', 'inputSchema' => ['type' => 'object', 'properties' => ['project_id' => ['type' => 'integer']], 'required' => ['project_id']]],
            ['name' => 'get_repository_context', 'description' => 'Read repository tree, recent commits, open pull requests and open issues. Read-only.', 'inputSchema' => ['type' => 'object', 'properties' => ['project_id' => ['type' => 'integer']], 'required' => ['project_id']]],
            ['name' => 'get_repository_file', 'description' => 'Read one text file from the linked repository. Read-only and truncated to 30,000 characters.', 'inputSchema' => ['type' => 'object', 'properties' => ['project_id' => ['type' => 'integer'], 'path' => ['type' => 'string']], 'required' => ['project_id', 'path']]],
            ['name' => 'preview_project_breakdown', 'description' => 'Generate and validate a project plan without writing to the database. Human approval is required before commit.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'prompt' => ['type' => 'string', 'description' => 'Project idea or requirement.'],
                'project_title' => ['type' => 'string'], 'project_key' => ['type' => 'string'],
                'sprint_count' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 5],
                'sprint_duration_weeks' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 4],
                'start_date' => ['type' => 'string', 'description' => 'ISO date, e.g. 2026-08-20'],
                'project_id' => ['type' => 'integer'],
            ], 'required' => ['prompt']]],
            ['name' => 'create_workspace', 'description' => 'Create a new Workspace in Task Hub.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'name' => ['type' => 'string'],
                'slug' => ['type' => 'string'],
                'plan' => ['type' => 'string', 'default' => 'enterprise'],
            ], 'required' => ['name']]],
            ['name' => 'create_project', 'description' => 'Create a new Project in a Workspace.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'workspace_id' => ['type' => 'integer'],
                'title' => ['type' => 'string'],
                'key' => ['type' => 'string'],
                'slug' => ['type' => 'string'],
                'tagline' => ['type' => 'string'],
                'description' => ['type' => 'string'],
                'category' => ['type' => 'string', 'default' => 'fullstack'],
                'color' => ['type' => 'string', 'default' => '#3b82f6'],
                'tags' => ['type' => 'array', 'items' => ['type' => 'string']],
                'tech_stack' => ['type' => 'array', 'items' => ['type' => 'string']],
            ], 'required' => ['title', 'key']]],
            ['name' => 'create_sprint', 'description' => 'Create a new Sprint for a Project.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'project_id' => ['type' => 'integer'],
                'name' => ['type' => 'string'],
                'goal' => ['type' => 'string'],
                'start_date' => ['type' => 'string'],
                'end_date' => ['type' => 'string'],
                'status' => ['type' => 'string', 'default' => 'active'],
            ], 'required' => ['project_id', 'name']]],
            ['name' => 'create_work_item', 'description' => 'Create a new Task/Epic/Story work item in Task Hub.', 'inputSchema' => ['type' => 'object', 'properties' => [
                'project_id' => ['type' => 'integer'],
                'workspace_id' => ['type' => 'integer'],
                'sprint_id' => ['type' => 'integer'],
                'issue_key' => ['type' => 'string'],
                'issue_type' => ['type' => 'string', 'default' => 'task'],
                'title' => ['type' => 'string'],
                'description' => ['type' => 'string'],
                'status' => ['type' => 'string', 'default' => 'todo'],
                'priority' => ['type' => 'string', 'default' => 'medium'],
                'category' => ['type' => 'string', 'default' => 'backend'],
                'story_points' => ['type' => 'integer', 'default' => 5],
                'start_date' => ['type' => 'string'],
                'due_date' => ['type' => 'string'],
                'notes' => ['type' => 'string'],
            ], 'required' => ['project_id', 'title']]],
        ];
    }

    private function callTool(array $params, Request $request, array $payload): array
    {
        $name = $params['name'] ?? '';
        $args = $params['arguments'] ?? [];
        $contextService = app(TaskHubContextPackService::class);
        $planningService = app(SmartProjectBreakdownService::class);
        $githubService = app(GithubProjectIntegrationService::class);
        $runController = app(ApiAgentRunController::class);

        $data = match ($name) {
            'get_work_item' => Task::with(['project', 'sprint', 'agentRuns.evidence'])->findOrFail($args['task_id']),
            'get_context_pack' => $contextService->build(Task::findOrFail($args['task_id']), $args),
            'list_project_documents' => ['success' => true, 'data' => app(\App\Services\ProjectKnowledgeService::class)->projectState(Project::findOrFail((int) $args['project_id']))],
            'get_task_references' => ['success' => true, 'data' => app(\App\Services\ProjectKnowledgeService::class)->documentsForTask(Task::findOrFail((int) $args['task_id']))],
            'start_agent_run' => $runController->store(Request::create('/', 'POST', [
                'task_id' => $args['task_id'] ?? null,
                'provider' => $args['provider'],
                'agent_session_id' => $args['agent_session_id'] ?? null,
                'repository' => $args['repository'] ?? null,
                'branch' => $args['branch'] ?? null,
                'context' => $args['context'] ?? null,
                'instruction' => $args['instruction'] ?? null,
            ]), $contextService)->getData(true),
            'update_agent_run' => $runController->update(Request::create('/', 'PATCH', $args), AgentRun::findOrFail($args['run_id']))->getData(true),
            'attach_verification_evidence' => $runController->evidence(Request::create('/', 'POST', $args), AgentRun::findOrFail($args['run_id']))->getData(true),
            'complete_agent_handoff' => $runController->handoff(Request::create('/', 'POST', $args), AgentRun::findOrFail($args['run_id']))->getData(true),
            'request_human_approval' => $runController->approve(Task::findOrFail($args['task_id']))->getData(true),
            'get_next_action' => $this->getNextAction($request, $payload),
            'get_project_state' => ['success' => true, 'data' => $this->projectState((int) $args['project_id'])],
            'get_repository_context' => ['success' => true, 'data' => $githubService->repositoryContext(Project::findOrFail((int) $args['project_id']))],
            'get_repository_file' => ['success' => true, 'data' => $githubService->repositoryFile(Project::findOrFail((int) $args['project_id']), (string) ($args['path'] ?? ''))],
            'preview_project_breakdown' => $this->previewProjectBreakdown($args, $planningService),
            'create_workspace' => $this->createWorkspaceTool($args),
            'create_project' => $this->createProjectTool($args),
            'create_sprint' => $this->createSprintTool($args),
            'create_work_item' => $this->createWorkItemTool($args),
            default => throw new \InvalidArgumentException('Unknown tool: ' . $name),
        };
        return ['content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]]];
    }

    private function createWorkspaceTool(array $args): array
    {
        $slug = $args['slug'] ?? \Illuminate\Support\Str::slug($args['name']);
        $owner = \App\Models\User::first();
        $ws = \App\Models\Workspace::updateOrCreate(
            ['slug' => $slug],
            [
                'name' => $args['name'],
                'owner_id' => $owner?->id,
                'plan' => $args['plan'] ?? 'enterprise',
            ]
        );
        if ($owner) {
            $ws->members()->syncWithoutDetaching([$owner->id => ['role' => 'admin']]);
        }
        return ['success' => true, 'workspace' => $ws];
    }

    private function createProjectTool(array $args): array
    {
        $slug = $args['slug'] ?? \Illuminate\Support\Str::slug($args['title']);
        $project = \App\Models\Project::updateOrCreate(
            ['slug' => $slug],
            [
                'workspace_id' => $args['workspace_id'] ?? null,
                'title' => $args['title'],
                'key' => strtoupper($args['key']),
                'tagline' => $args['tagline'] ?? $args['title'],
                'description' => $args['description'] ?? '',
                'category' => $args['category'] ?? 'fullstack',
                'color' => $args['color'] ?? '#3b82f6',
                'tags' => $args['tags'] ?? [],
                'tech_stack' => $args['tech_stack'] ?? [],
                'featured' => true,
            ]
        );
        return ['success' => true, 'project' => $project];
    }

    private function createSprintTool(array $args): array
    {
        $sprint = \App\Models\Sprint::updateOrCreate(
            ['project_id' => (int) $args['project_id'], 'name' => $args['name']],
            [
                'goal' => $args['goal'] ?? null,
                'start_date' => $args['start_date'] ?? null,
                'end_date' => $args['end_date'] ?? null,
                'status' => $args['status'] ?? 'active',
            ]
        );
        return ['success' => true, 'sprint' => $sprint];
    }

    private function createWorkItemTool(array $args): array
    {
        $project = \App\Models\Project::findOrFail((int) $args['project_id']);
        $count = \App\Models\Task::where('project_id', $project->id)->count() + 1;
        $key = $args['issue_key'] ?? ($project->key . '-' . $count);

        $task = \App\Models\Task::updateOrCreate(
            ['issue_key' => $key],
            [
                'project_id' => $project->id,
                'workspace_id' => $args['workspace_id'] ?? $project->workspace_id,
                'sprint_id' => $args['sprint_id'] ?? null,
                'issue_type' => $args['issue_type'] ?? 'task',
                'title' => $args['title'],
                'description' => $args['description'] ?? null,
                'status' => $args['status'] ?? 'todo',
                'priority' => $args['priority'] ?? 'medium',
                'category' => $args['category'] ?? 'backend',
                'story_points' => $args['story_points'] ?? 5,
                'start_date' => $args['start_date'] ?? null,
                'due_date' => $args['due_date'] ?? null,
                'notes' => $args['notes'] ?? null,
            ]
        );
        return ['success' => true, 'task' => $task];
    }

    private function getNextAction(Request $request, array $payload): array
    {
        $args = data_get($payload, 'params.arguments', []);
        $projectId = $args['project_id'] ?? null;
        $provided = (string) $request->bearerToken();
        $query = Task::with('project')->where('status', '!=', 'done');

        if ($projectId) {
            $query->where('project_id', $projectId);
        } else {
            $integration = app(GithubProjectIntegrationService::class);
            $matchedProject = Project::whereNotNull('task_hub_mcp_token')->get()->first(function ($p) use ($integration, $provided) {
                return $integration->secret($p->task_hub_mcp_token) === $provided;
            });
            if ($matchedProject) {
                $query->where('project_id', $matchedProject->id);
            }
        }

        $task = $query->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 WHEN priority = 'urgent' THEN 2 WHEN priority = 'high' THEN 3 ELSE 4 END")->orderBy('due_date')->first();
        return ['success' => true, 'data' => $task];
    }

    private function previewProjectBreakdown(array $args, SmartProjectBreakdownService $planningService): array
    {
        $prompt = trim((string) ($args['prompt'] ?? ''));
        if (mb_strlen($prompt) < 5) throw new \InvalidArgumentException('prompt must contain at least 5 characters.');
        $options = array_filter([
            'project_title' => $args['project_title'] ?? null,
            'project_key' => $args['project_key'] ?? null,
            'sprint_count' => $args['sprint_count'] ?? null,
            'sprint_duration_weeks' => $args['sprint_duration_weeks'] ?? null,
            'start_date' => $args['start_date'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');
        if (!empty($args['project_id'])) {
            $state = $this->projectState((int) $args['project_id']);
            $prompt .= "\n\nCURRENT PROJECT STATE (use this to plan only the next valuable work; do not repeat done items):\n" . json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $plan = $planningService->generatePlanWithProvider($prompt, $options);
        return ['success' => true, 'mode' => 'preview', 'provider' => $planningService->planningSettings()['provider'] ?? 'template', 'requires_human_approval' => true, 'data' => $plan];
    }

    private function projectState(int $projectId): array
    {
        $project = Project::findOrFail($projectId);
        $tasks = Task::where('project_id', $projectId);
        $taskRows = (clone $tasks)->with('sprint:id,name,status')->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 WHEN status = 'review' THEN 2 WHEN priority = 'urgent' THEN 3 ELSE 4 END")->orderBy('due_date')->limit(100)->get();
        $sprints = $project->sprints()->withCount(['tasks', 'tasks as completed_tasks_count' => fn ($query) => $query->where('status', 'done')])->orderByDesc('start_date')->get(['id', 'name', 'goal', 'start_date', 'end_date', 'status']);
        $runs = AgentRun::whereHas('task', fn ($query) => $query->where('project_id', $projectId))->with('evidence')->latest()->limit(20)->get();
        $releases = $project->releases()->latest('deployed_at')->limit(20)->get();

        return [
            'project' => [
                'id' => $project->id, 'title' => $project->title, 'description' => $project->description,
                'type' => $project->type, 'github_repository' => $project->github_repository,
                'github_default_branch' => $project->github_default_branch, 'github_sync_status' => $project->github_sync_status,
                'github_last_sync_at' => $project->github_last_sync_at?->toIso8601String(), 'github_snapshot' => $project->github_snapshot,
            ],
            'summary' => [
                'total_tasks' => (clone $tasks)->count(), 'done' => (clone $tasks)->where('status', 'done')->count(),
                'in_progress' => (clone $tasks)->where('status', 'in_progress')->count(), 'review' => (clone $tasks)->where('status', 'review')->count(),
                'todo' => (clone $tasks)->where('status', 'todo')->count(), 'overdue' => (clone $tasks)->where('status', '!=', 'done')->whereDate('due_date', '<', now()->toDateString())->count(),
            ],
            'sprints' => $sprints, 'tasks' => $taskRows, 'agent_runs' => $runs, 'releases' => $releases,
            'project_knowledge' => app(\App\Services\ProjectKnowledgeService::class)->projectState($project),
        ];
    }

    private function validProjectOrWorkspaceToken(Request $request, array $payload): bool
    {
        try {
            $provided = (string) $request->bearerToken();
            if ($provided === '') {
                $authHeader = (string) ($request->header('Authorization') ?: $request->header('authorization'));
                if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
                    $provided = $matches[1];
                }
            }
            if ($provided === '') return false;

            $workspaceToken = config('services.mcp.token') ?: env('TASK_HUB_MCP_TOKEN');
            if ($workspaceToken && hash_equals($workspaceToken, $provided)) return true;

            $desktopSession = DesktopPairingSession::where('workspace_token_hash', hash('sha256', $provided))->where('status', 'approved')->latest('id')->first();
            if ($desktopSession?->workspace_id) {
                $candidate = data_get($payload, 'params.arguments.project_id');
                if ($candidate && (int) Project::whereKey($candidate)->value('workspace_id') !== (int) $desktopSession->workspace_id) return false;
                return true;
            }

            $args = data_get($payload, 'params.arguments', []);
            $project = null;
            $headerProjectId = $request->header('X-Task-Hub-Project');
            if (!empty($args['project_id'])) $project = Project::find($args['project_id']);
            if (!$project && $headerProjectId) $project = Project::find($headerProjectId);
            if (!$project && !empty($args['task_id'])) $project = Task::with('project')->find($args['task_id'])?->project;
            if (!$project && !empty($args['run_id'])) $project = AgentRun::with('task.project')->find($args['run_id'])?->task?->project;

            $integration = app(GithubProjectIntegrationService::class);

            $matchedProject = Project::whereNotNull('task_hub_mcp_token')->get()->first(function ($p) use ($integration, $provided) {
                $decrypted = $integration->secret($p->task_hub_mcp_token);
                return ($decrypted && hash_equals($decrypted, $provided)) || hash_equals($p->task_hub_mcp_token, $provided);
            });

            if ($matchedProject) {
                $workspaceId = $request->header('X-Task-Hub-Workspace');
                if ($workspaceId && (int) $matchedProject->workspace_id !== (int) $workspaceId) return false;
                return true;
            }

            if ($project && $project->task_hub_mcp_token) {
                $decrypted = $integration->secret($project->task_hub_mcp_token);
                return ($decrypted && hash_equals($decrypted, $provided)) || hash_equals($project->task_hub_mcp_token, $provided);
            }

            return false;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('MCP Auth Error: ' . $e->getMessage());
            return false;
        }
    }
}
