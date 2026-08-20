<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectRelease;
use Illuminate\Http\Request;

class ApiProjectReleaseController extends Controller
{
    public function index(Project $project)
    {
        return response()->json(['success' => true, 'data' => $project->releases()->latest('deployed_at')->latest()->limit(50)->get()]);
    }

    public function store(Request $request, Project $project)
    {
        $release = $project->releases()->create($this->validated($request) + ['deployed_at' => $request->input('deployed_at', now())]);
        return response()->json(['success' => true, 'data' => $release], 201);
    }

    public function update(Request $request, ProjectRelease $release)
    {
        $release->update($this->validated($request, true));
        return response()->json(['success' => true, 'data' => $release->fresh()]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'version' => ($partial ? 'sometimes|' : 'required|') . 'string|max:100',
            'environment' => 'nullable|in:production,staging,development', 'status' => 'nullable|in:deployed,rolled_back,failed',
            'summary' => ($partial ? 'sometimes|' : 'required|') . 'string|max:10000', 'changes' => 'nullable|array',
            'changes.*' => 'string|max:1000', 'commit_sha' => 'nullable|string|max:80', 'release_url' => 'nullable|url|max:1000',
            'deployed_by' => 'nullable|string|max:120', 'deployed_at' => 'nullable|date',
        ]);
    }
}
