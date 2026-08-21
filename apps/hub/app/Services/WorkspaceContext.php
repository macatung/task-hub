<?php

namespace App\Services;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;

class WorkspaceContext
{
    public function resolve(Request $request, bool $required = true): ?Workspace
    {
        $routeWorkspace = $request->route('workspace');
        $id = $routeWorkspace ?: $request->attributes->get('desktop_workspace_id') ?: $request->header('X-Workspace-Id') ?: $request->session()->get('current_workspace_id');
        $workspace = $routeWorkspace instanceof Workspace
            ? $routeWorkspace
            : ($id ? Workspace::find($id) : $this->defaultFor($request->user()));
        if (!$workspace || !$request->user() || !$workspace->members()->whereKey($request->user()->id)->exists()) {
            if ($required) abort($request->user() ? 403 : 401, 'A valid workspace membership is required.');
            return null;
        }
        $request->attributes->set('workspace', $workspace);
        $request->session()->put('current_workspace_id', $workspace->id);
        return $workspace;
    }

    public function role(Request $request, ?Workspace $workspace = null): ?string
    {
        $workspace ??= $request->attributes->get('workspace');
        return $workspace && $request->user() ? $workspace->members()->whereKey($request->user()->id)->first()?->pivot?->role : null;
    }

    public function authorizeRole(Request $request, array $roles): Workspace
    {
        $workspace = $this->resolve($request);
        abort_unless(in_array($this->role($request, $workspace), $roles, true), 403, 'Insufficient workspace role.');
        return $workspace;
    }

    private function defaultFor(?User $user): ?Workspace
    {
        if (!$user) return null;
        $workspace = $user->workspaces()->where('is_system', false)->orderBy('workspaces.id')->first();
        if (!$workspace) {
            $workspace = Workspace::create([
                'name' => ($user->name ?: 'My') . ' Workspace',
                'slug' => 'workspace-' . $user->id . '-' . substr(md5(uniqid()), 0, 6),
                'owner_id' => $user->id,
                'is_system' => false,
            ]);
            $workspace->members()->attach($user->id, ['role' => 'admin']);
        }
        return $workspace;
    }
}
