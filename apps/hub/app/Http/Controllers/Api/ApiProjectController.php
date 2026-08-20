<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Services\GithubProjectIntegrationService;

class ApiProjectController extends Controller
{
    public function githubRepositories(Request $request, GithubProjectIntegrationService $integration)
    {
        try { return response()->json(['success' => true, 'data' => $integration->repositories($request->user())]); }
        catch (\Throwable $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 422); }
    }

    public function storeFromGithub(Request $request, GithubProjectIntegrationService $integration)
    {
        $validated = $request->validate(['repository' => ['required', 'regex:/^[^\/\s]+\/[^\/\s]+$/', 'max:255'], 'type' => 'required|in:work,personal', 'color' => 'nullable|string|max:50']);
        try {
            $project = $integration->createFromRepository($request->user(), $validated);
            return response()->json(['success' => true, 'message' => 'Dự án đã được tạo từ GitHub repository.', 'data' => $project->loadCount('tasks')], 201);
        } catch (\Throwable $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 422); }
    }

    public function index(Request $request)
    {
        $query = Project::withCount('tasks');

        if ($request->has('type') && in_array($request->query('type'), ['work', 'personal'])) {
            $query->where('type', $request->query('type'));
        }

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
            'type' => 'required|in:work,personal',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ]);

        $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(5);
        $validated['tagline'] = $validated['tagline'] ?? (!empty($validated['description']) ? Str::limit($validated['description'], 100) : $validated['title']);
        $validated['category'] = $validated['type'] === 'work' ? 'web' : 'creative';
        $validated['color'] = $validated['color'] ?? ($validated['type'] === 'work' ? '#00f5a0' : '#ffd166');

        $project = Project::create($validated);
        $project->tasks_count = 0;

        return response()->json([
            'success' => true,
            'message' => 'Dự án đã được tạo thành công',
            'data' => $project,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $project = Project::withCount('tasks')->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|in:work,personal',
            'color' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ]);

        if (isset($validated['title']) && $validated['title'] !== $project->title) {
            $validated['slug'] = Str::slug($validated['title']) . '-' . Str::random(4);
        }

        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Dự án đã được cập nhật',
            'data' => $project,
        ]);
    }

    public function destroy($id)
    {
        $project = Project::findOrFail($id);
        
        // Tasks have project_id nullOnDelete, so all tasks are safely preserved as Unassigned
        $project->delete();

        return response()->json([
            'success' => true,
            'message' => 'Dự án đã được xóa (Các nhiệm vụ liên quan đã được chuyển an toàn sang mục Chung)',
        ]);
    }

    public function githubStatus(Project $project, GithubProjectIntegrationService $integration)
    {
        return response()->json(['success' => true, 'data' => $integration->status($project)]);
    }

    public function connectGithub(Request $request, Project $project, GithubProjectIntegrationService $integration)
    {
        if ($project->user_id && $project->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Project này đã thuộc tài khoản GitHub khác.'], 403);
        }
        $userToken = $integration->secret($request->user()->github_access_token);
        $projectToken = $integration->secret($project->github_token);
        if (!$userToken && !$projectToken) {
            return response()->json(['success' => false, 'message' => 'Tài khoản GitHub chưa được cấp quyền. Hãy đăng nhập lại bằng GitHub.'], 422);
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
        return response()->json(['success' => true, 'message' => 'Đã lưu cấu hình tích hợp riêng cho project.', 'data' => $integration->status($project)]);
    }

    public function syncGithub(Project $project, GithubProjectIntegrationService $integration)
    {
        if ($project->user_id && $project->user_id !== request()->user()->id) {
            return response()->json(['success' => false, 'message' => 'Bạn không có quyền sync Project này.'], 403);
        }
        try {
            $project = $integration->sync($project);
            return response()->json(['success' => true, 'message' => 'GitHub đã được đồng bộ.', 'data' => $integration->status($project)]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Không thể đồng bộ GitHub: ' . $e->getMessage()], 422);
        }
    }
}
