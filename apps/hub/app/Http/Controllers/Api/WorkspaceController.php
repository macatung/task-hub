<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user(), 401);
        return response()->json(['success' => true, 'data' => $request->user()->workspaces()->where('is_system', false)->withCount('members', 'projects')->get()]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user(), 401);
        $data = $request->validate(['name' => 'required|string|max:120']);
        $workspace = Workspace::create(['name' => $data['name'], 'slug' => Str::slug($data['name']) . '-' . Str::lower(Str::random(5)), 'owner_id' => $request->user()->id, 'plan' => 'free', 'agent_concurrency_limit' => 1]);
        $workspace->members()->attach($request->user()->id, ['role' => 'owner']);
        $request->session()->put('current_workspace_id', $workspace->id);
        return response()->json(['success' => true, 'data' => $workspace], 201);
    }

    public function switch(Request $request, Workspace $workspace, WorkspaceContext $context)
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->resolve($request);
        $request->session()->put('current_workspace_id', $workspace->id);
        return response()->json(['success' => true, 'data' => $workspace]);
    }

    public function addMember(Request $request, Workspace $workspace, WorkspaceContext $context, \App\Services\WorkspaceQuotaService $quotaService)
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->authorizeRole($request, ['owner', 'admin']);
        $data = $request->validate(['user_id' => 'required|exists:users,id', 'role' => 'required|in:admin,developer,viewer']);
        
        $alreadyMember = $workspace->members()->where('users.id', $data['user_id'])->exists();
        if (!$alreadyMember) {
            $quotaService->assertCanAddMember($workspace);
        }

        $workspace->members()->syncWithoutDetaching([$data['user_id'] => ['role' => $data['role']]]);
        return response()->json(['success' => true]);
    }

    public function updateMember(Request $request, Workspace $workspace, User $user, WorkspaceContext $context)
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        $context->authorizeRole($request, ['owner', 'admin']);
        $data = $request->validate(['role' => 'required|in:admin,developer,viewer']);
        abort_if($workspace->owner_id === $user->id, 422, 'Workspace owner role cannot be changed.');
        $workspace->members()->updateExistingPivot($user->id, ['role' => $data['role']]);
        return response()->json(['success' => true]);
    }
}
