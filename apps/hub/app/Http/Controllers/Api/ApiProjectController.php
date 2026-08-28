<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use App\Services\GithubProjectIntegrationService;
use App\Services\WorkspaceContext;
use App\Services\WorkspaceProjectAccess;

class ApiProjectController extends Controller
{
    public function githubRepositories(Request $request, GithubProjectIntegrationService $integration)
    {
        try {
            $workspace = app(WorkspaceContext::class)->resolve($request);
            return response()->json(['success' => true, 'data' => $integration->repositories($request->user(), $workspace)]);
        }
        catch (\Throwable $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 422); }
    }

    public function storeFromGithub(Request $request, GithubProjectIntegrationService $integration)
    {
        $validated = $request->validate(['repository' => ['required', 'regex:/^[^\/\s]+\/[^\/\s]+$/', 'max:255'], 'color' => 'nullable|string|max:50']);
        try {
            $workspace = app(WorkspaceContext::class)->resolve($request);
            if ($workspace) {
                app(\App\Services\WorkspaceQuotaService::class)->assertCanCreateProject($workspace);
                $validated['workspace_id'] = $workspace->id;
            }
            $project = $integration->createFromRepository($request->user(), $validated);
            return response()->json(['success' => true, 'message' => 'Project created from the GitHub repository.', 'data' => $project->loadCount('tasks')], 201);
        } catch (\App\Exceptions\PlanQuotaExceededException $e) {
            return $e->render($request);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function index(Request $request)
    {
        $workspace = app(WorkspaceContext::class)->resolve($request);
        $projects = Project::where('workspace_id', $workspace->id)
            ->withCount('tasks')
            ->orderBy('title')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    public function desktopBootstrap(Request $request)
    {
        $project = $request->attributes->get('desktop_project');
        abort_unless($project instanceof Project, 401);

        $project->loadCount('tasks');
        return response()->json([
            'success' => true,
            'data' => [
                'project' => $project->only(['id', 'title', 'slug', 'key', 'description', 'category', 'color', 'tags']),
                'tasks_endpoint' => '/api/v1/desktop/tasks?project_id=' . $project->id,
                'authenticated_via' => 'desktop_project_credential',
            ],
        ]);
    }

    public function show(Request $request, $id)
    {
        $project = Project::withCount('tasks')->findOrFail($id);
        if ($request->user()) abort_unless((int) $project->workspace_id === (int) app(WorkspaceContext::class)->resolve($request)->id, 404);

        return response()->json([
            'success' => true,
            'data' => [
                'project' => $project->only(['id', 'title', 'slug', 'key', 'description', 'category', 'color', 'tags']),
                'tasks_endpoint' => '/api/v1/desktop/tasks?project_id=' . $project->id,
                'authenticated_via' => 'desktop_project_credential',
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'tags' => 'nullable|array|max:20',
            'tags.*' => 'string|max:40',
        ]);

        $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(5);
        $validated['tagline'] = $validated['tagline'] ?? (!empty($validated['description']) ? Str::limit($validated['description'], 100) : $validated['title']);
        $validated['category'] = $validated['category'] ?? 'software';
        $validated['color'] = $validated['color'] ?? '#00f5a0';
        if ($request->user()) {
            $workspace = app(WorkspaceContext::class)->resolve($request);
            if ($workspace) {
                app(\App\Services\WorkspaceQuotaService::class)->assertCanCreateProject($workspace);
                $validated['workspace_id'] = $workspace->id;
            }
        }

        $project = Project::create($validated);
        $project->tasks_count = 0;

        return response()->json([
            'success' => true,
            'message' => 'Project created successfully.',
            'data' => $project,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $project = Project::withCount('tasks')->findOrFail($id);
        if ($request->user()) abort_unless((int) $project->workspace_id === (int) app(WorkspaceContext::class)->resolve($request)->id, 404);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'tags' => 'nullable|array|max:20',
            'tags.*' => 'string|max:40',
            'task_hub_mcp_token' => 'nullable|string|max:500',
            'clear_task_hub_mcp_token' => 'nullable|boolean',
        ]);

        if (isset($validated['title']) && $validated['title'] !== $project->title) {
            $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(4);
        }

        if (!empty($validated['clear_task_hub_mcp_token'])) {
            $project->task_hub_mcp_token = null;
            $project->task_hub_mcp_token_hash = null;
        } elseif (!empty($validated['task_hub_mcp_token'])) {
            $token = trim($validated['task_hub_mcp_token']);
            $project->task_hub_mcp_token = Crypt::encryptString($token);
            $project->task_hub_mcp_token_hash = hash('sha256', $token);
        }
        unset($validated['task_hub_mcp_token'], $validated['clear_task_hub_mcp_token']);

        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Project updated successfully.',
            'data' => $project,
        ]);
    }

    public function destroy($id)
    {
        $project = Project::findOrFail($id);
        if (request()->user()) abort_unless((int) $project->workspace_id === (int) app(WorkspaceContext::class)->resolve(request())->id, 404);
        if ($project->tasks()->exists()) {
            return response()->json(['success' => false, 'message' => 'Move or delete the project tasks before deleting this project.'], 422);
        }
        
        $project->delete();

        return response()->json([
            'success' => true,
            'message' => 'Project deleted successfully.',
        ]);
    }

    public function githubStatus(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project);
        return response()->json(['success' => true, 'data' => $integration->status($project)]);
    }

    public function connectGithub(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin']);
        if ($project->user_id && $project->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'This project belongs to another GitHub account.'], 403);
        }
        $userToken = $integration->secret($request->user()->github_access_token);
        $projectToken = $integration->secret($project->github_token);
        if (!$userToken && !$projectToken && empty($request->input('task_hub_mcp_token')) && empty($project->task_hub_mcp_token)) {
            return response()->json(['success' => false, 'message' => 'GitHub access is not available. Please sign in with GitHub again.'], 422);
        }
        $validated = $request->validate([
            'github_repository' => ['required', 'regex:/^[^\/\s]+\/[^\/\s]+$/', 'max:255'],
            'github_default_branch' => 'nullable|string|max:255',
            'github_webhook_secret' => 'nullable|string|max:500',
            'task_hub_mcp_token' => 'nullable|string|max:500',
            'clear_github_token' => 'nullable|boolean',
            'clear_github_webhook_secret' => 'nullable|boolean',
            'clear_task_hub_mcp_token' => 'nullable|boolean',
        ]);
        $project = $integration->connect($project, $validated);
        return response()->json(['success' => true, 'message' => 'Project integration settings saved.', 'data' => $integration->status($project)]);
    }

    public function syncGithub(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin', 'developer']);
        if ($project->user_id && $project->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'You do not have permission to sync this project.'], 403);
        }
        try {
            $project = $integration->sync($project);
            return response()->json(['success' => true, 'message' => 'GitHub synchronized successfully.', 'data' => $integration->status($project)]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Unable to synchronize GitHub: ' . $e->getMessage()], 422);
        }
    }

    public function getMcpInfo(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin']);
        $hasToken = !empty($project->task_hub_mcp_token);
        $mcpUrl = url('/mcp');

        return response()->json([
            'success' => true,
            'data' => [
                'project_id' => $project->id,
                'project_title' => $project->title,
                'has_token' => $hasToken,
                'token' => null,
                'masked_token' => null,
                'token_notice' => 'For security, existing tokens are never returned. Generate or rotate a token and copy it from the one-time response.',
                'server_url' => $mcpUrl,
                'configs' => [
                    'antigravity' => [
                        'mcpServers' => [
                            'task-hub' => [
                                'serverUrl' => $mcpUrl,
                                'headers' => [
                                    'Authorization' => 'Bearer YOUR_TASK_HUB_MCP_TOKEN',
                                    'X-Task-Hub-Project' => (string) $project->id,
                                ],
                            ],
                        ],
                    ],
                    'cursor' => [
                        'mcpServers' => [
                            'task-hub' => [
                                'url' => $mcpUrl,
                                'headers' => [
                                    'Authorization' => 'Bearer YOUR_TASK_HUB_MCP_TOKEN',
                                    'X-Task-Hub-Project' => (string) $project->id,
                                ],
                            ],
                        ],
                    ],
                    'claude_desktop' => [
                        'mcpServers' => [
                            'task-hub' => [
                                'url' => $mcpUrl,
                                'headers' => [
                                    'Authorization' => 'Bearer YOUR_TASK_HUB_MCP_TOKEN',
                                    'X-Task-Hub-Project' => (string) $project->id,
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);
    }

    public function generateMcpToken(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin']);
        $token = 'th_mcp_' . Str::random(48);
        $project->task_hub_mcp_token = Crypt::encryptString($token);
        $project->task_hub_mcp_token_hash = hash('sha256', $token);
        $project->save();

        $response = $this->getMcpInfo($request, $project, $integration, $access)->getData(true);
        $response['data']['token'] = $token;
        $response['data']['token_notice'] = 'Copy this token now. It will not be shown again.';
        return response()->json($response);
    }

    public function saveMcpToken(Request $request, Project $project, GithubProjectIntegrationService $integration, WorkspaceProjectAccess $access)
    {
        $access->authorize($request, $project, ['owner', 'admin']);
        $validated = $request->validate([
            'token' => 'nullable|string|max:500',
            'clear' => 'nullable|boolean',
        ]);

        if (!empty($validated['clear'])) {
            $project->task_hub_mcp_token = null;
            $project->task_hub_mcp_token_hash = null;
        } elseif (!empty($validated['token'])) {
            $token = trim($validated['token']);
            $project->task_hub_mcp_token = Crypt::encryptString($token);
            $project->task_hub_mcp_token_hash = hash('sha256', $token);
        }
        $project->save();

        return $this->getMcpInfo($request, $project, $integration, $access);
    }
}
