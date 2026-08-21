<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Workspace;
use App\Models\WorkspaceCredential;
use App\Services\CredentialVaultService;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;

class WorkspaceCredentialController extends Controller
{
    public function index(Request $request, Workspace $workspace, CredentialVaultService $vault)
    {
        $this->workspace($request, $workspace)->authorizeRole($request, ['owner', 'admin', 'developer', 'viewer']);
        return response()->json(['success' => true, 'data' => WorkspaceCredential::where('workspace_id', $workspace->id)->get()->map(fn ($item) => $vault->publicView($item))->values()]);
    }

    public function store(Request $request, Workspace $workspace, CredentialVaultService $vault)
    {
        $this->workspace($request, $workspace)->authorizeRole($request, ['owner', 'admin']);
        $data = $request->validate(['provider' => 'required|in:github,codex,claude_code,antigravity', 'secret' => 'required|string|max:10000', 'project_id' => 'nullable|integer|exists:projects,id']);
        $project = !empty($data['project_id']) ? Project::where('workspace_id', $workspace->id)->findOrFail($data['project_id']) : null;
        $credential = $vault->put($workspace, $project, $data['provider'], $data['secret']);
        return response()->json(['success' => true, 'data' => $vault->publicView($credential)], 201);
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceCredential $credential, CredentialVaultService $vault)
    {
        $this->workspace($request, $workspace)->authorizeRole($request, ['owner', 'admin']);
        abort_unless((int) $credential->workspace_id === (int) $workspace->id, 404);
        $vault->revoke($credential);
        return response()->json(['success' => true]);
    }

    private function workspace(Request $request, Workspace $workspace): WorkspaceContext
    {
        $request->headers->set('X-Workspace-Id', (string) $workspace->id);
        return app(WorkspaceContext::class);
    }
}
