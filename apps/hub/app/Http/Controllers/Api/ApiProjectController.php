<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\GithubProjectIntegrationService;
use App\Services\WorkspaceContext;

class ApiProjectController extends Controller
{
    public function githubRepositories(Request $request, GithubProjectIntegrationService $integration)
    {
        try { return response()->json(['success' => true, 'data' => $integration->repositories($request->user())]); }
        catch (\Throwable $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 422); }
    }

    public function storeFromGithub(Request $request, GithubProjectIntegrationService $integration)
    {
        $validated = $request->validate(['repository' => ['required', 'regex:/^[^\/\s]+\/[^\/\s]+$/', 'max:255'], 'color' => 'nullable|string|max:50']);
        try {
            $validated['workspace_id'] = app(WorkspaceContext::class)->resolve($request)->id;
            $project = $integration->createFromRepository($request->user(), $validated);
            return response()->json(['success' => true, 'message' => 'Project created from the GitHub repository.', 'data' => $project->loadCount('tasks')], 201);
        } catch (\Throwable $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 422); }
    }

    public function index(Request $request)
    {
        $query = Project::withCount('tasks');
        if ($request->user()) $query->where('workspace_id', app(WorkspaceContext::class)->resolve($request)->id);

        $projects = $query->orderBy('title', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $projects,
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
        if ($request->user()) $validated['workspace_id'] = app(WorkspaceContext::class)->resolve($request)->id;

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
        ]);

        if (isset($validated['title']) && $validated['title'] !== $project->title) {
            $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(4);
        }

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

    public function githubStatus(Project $project, GithubProjectIntegrationService $integration)
    {
        return response()->json(['success' => true, 'data' => $integration->status($project)]);
    }

    public function connectGithub(Request $request, Project $project, GithubProjectIntegrationService $integration)
    {
        if ($project->user_id && $project->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'This project belongs to another GitHub account.'], 403);
        }
        $userToken = $integration->secret($request->user()->github_access_token);
        $projectToken = $integration->secret($project->github_token);
        if (!$userToken && !$projectToken) {
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

    public function syncGithub(Project $project, GithubProjectIntegrationService $integration)
    {
        if ($project->user_id && $project->user_id !== request()->user()->id) {
            return response()->json(['success' => false, 'message' => 'You do not have permission to sync this project.'], 403);
        }
        try {
            $project = $integration->sync($project);
            return response()->json(['success' => true, 'message' => 'GitHub synchronized successfully.', 'data' => $integration->status($project)]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Unable to synchronize GitHub: ' . $e->getMessage()], 422);
        }
    }
}
