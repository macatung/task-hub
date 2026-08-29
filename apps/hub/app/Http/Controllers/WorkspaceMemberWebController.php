<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Services\WorkspaceContext;
use App\Services\WorkspaceQuotaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceMemberWebController extends Controller
{
    /**
     * Display the workspace members and RBAC management dashboard.
     */
    public function index(
        Request $request,
        $workspace,
        WorkspaceContext $context,
        WorkspaceQuotaService $quotaService
    ) {
        if (!Auth::check()) {
            $request->session()->put('github_oauth_intended', $request->fullUrl());
            return redirect('/auth/github')->with('info', 'Please sign in with GitHub to access Workspace Members.');
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

        $members = $resolvedWorkspace->members()
            ->select('users.id', 'users.name', 'users.email', 'users.github_login', 'users.github_avatar_url', 'users.created_at as user_created_at')
            ->withPivot('role', 'created_at')
            ->get()
            ->map(function ($member) use ($resolvedWorkspace) {
                return [
                    'id' => $member->id,
                    'name' => $member->name ?: ($member->github_login ?: 'Member #' . $member->id),
                    'email' => $member->email,
                    'github_login' => $member->github_login,
                    'github_avatar_url' => $member->github_avatar_url,
                    'role' => $member->id === $resolvedWorkspace->owner_id ? 'owner' : ($member->pivot->role ?? 'developer'),
                    'is_owner' => $member->id === $resolvedWorkspace->owner_id,
                    'joined_at' => $member->pivot->created_at?->toIso8601String() ?? $member->user_created_at?->toIso8601String(),
                ];
            });

        // Ensure owner is included in the members list if not already attached via pivot
        if (!$members->contains('id', $resolvedWorkspace->owner_id) && $resolvedWorkspace->owner) {
            $ownerUser = $resolvedWorkspace->owner;
            $members->prepend([
                'id' => $ownerUser->id,
                'name' => $ownerUser->name ?: ($ownerUser->github_login ?: 'Owner'),
                'email' => $ownerUser->email,
                'github_login' => $ownerUser->github_login,
                'github_avatar_url' => $ownerUser->github_avatar_url,
                'role' => 'owner',
                'is_owner' => true,
                'joined_at' => $resolvedWorkspace->created_at?->toIso8601String(),
            ]);
        }

        $usage = $quotaService->getUsageSummary($resolvedWorkspace);
        $plan = $resolvedWorkspace->activePlan();
        $workspaces = $user->workspaces()->where('is_system', false)->get(['workspaces.id', 'name', 'slug', 'plan']);

        $seatLimit = $resolvedWorkspace->effectiveSeatLimit();
        $activeSeats = $usage['seats']['active'];
        $remainingSeats = $seatLimit !== null ? max(0, $seatLimit - $activeSeats) : null;

        $userRole = $user->id === $resolvedWorkspace->owner_id ? 'owner' : ($context->role($request, $resolvedWorkspace) ?? 'developer');

        return Inertia::render('Workspaces/Members/Index', [
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
            'members' => $members->values(),
            'seats' => [
                'used' => $activeSeats,
                'limit' => $seatLimit,
                'remaining' => $remainingSeats,
                'percent' => $usage['seats']['percent'],
            ],
            'workspaces' => $workspaces,
            'currentWorkspaceId' => $resolvedWorkspace->id,
        ]);
    }
}
