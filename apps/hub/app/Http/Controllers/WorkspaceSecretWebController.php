<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Services\CredentialVaultService;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceSecretWebController extends Controller
{
    /**
     * Display the Team Credential Vault & Shared Secrets page.
     */
    public function index(
        Request $request,
        $workspace,
        WorkspaceContext $context,
        CredentialVaultService $vault
    ) {
        if (!Auth::check()) {
            $request->session()->put('github_oauth_intended', $request->fullUrl());
            return redirect('/auth/github')->with('info', 'Please sign in with GitHub to access Team Secrets.');
        }

        $user = $request->user();
        $resolvedWorkspace = $workspace instanceof Workspace
            ? $workspace
            : (is_numeric($workspace) ? Workspace::find($workspace) : Workspace::where('slug', $workspace)->first() ?? Workspace::find($workspace));

        if (!$resolvedWorkspace) {
            $resolvedWorkspace = $context->resolve($request);
        } else {
            $isMemberOrOwner = $resolvedWorkspace->owner_id === $user->id || $resolvedWorkspace->members()->whereKey($user->id)->exists();
            if (!$isMemberOrOwner) {
                abort(403, 'A valid workspace membership is required.');
            }
            $request->attributes->set('workspace', $resolvedWorkspace);
            $request->session()->put('current_workspace_id', $resolvedWorkspace->id);
        }

        $planSlug = strtolower($resolvedWorkspace->plan ?: ($resolvedWorkspace->activePlan()?->slug ?? 'community'));
        $canAccessVault = in_array($planSlug, ['team', 'enterprise'], true);

        $credentials = [];
        if ($canAccessVault) {
            $credentials = $resolvedWorkspace->credentials()
                ->with('project')
                ->whereNull('revoked_at')
                ->where('status', 'active')
                ->orderByDesc('id')
                ->get()
                ->map(fn ($item) => $vault->publicView($item))
                ->values();
        }

        $projects = $resolvedWorkspace->projects()
            ->select('id', 'title', 'slug')
            ->orderBy('title')
            ->get();

        $plan = $resolvedWorkspace->activePlan();
        $workspaces = $user->workspaces()->where('is_system', false)->get(['workspaces.id', 'name', 'slug', 'plan']);
        $userRole = $user->id === $resolvedWorkspace->owner_id ? 'owner' : ($context->role($request, $resolvedWorkspace) ?? 'developer');

        return Inertia::render('Workspaces/Secrets/Index', [
            'workspace' => [
                'id' => $resolvedWorkspace->id,
                'name' => $resolvedWorkspace->name,
                'slug' => $resolvedWorkspace->slug,
                'plan' => $resolvedWorkspace->plan,
                'plan_name' => $plan->name,
                'agent_concurrency_limit' => $resolvedWorkspace->agent_concurrency_limit,
                'owner_id' => $resolvedWorkspace->owner_id,
                'user_role' => $userRole,
            ],
            'credentials' => $credentials,
            'canAccessVault' => $canAccessVault,
            'projects' => $projects,
            'workspaces' => $workspaces,
            'currentWorkspaceId' => $resolvedWorkspace->id,
        ]);
    }
}
