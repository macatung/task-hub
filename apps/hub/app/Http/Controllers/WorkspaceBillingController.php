<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Workspace;
use App\Services\WorkspaceContext;
use App\Services\WorkspaceQuotaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceBillingController extends Controller
{
    /**
     * Display the workspace billing dashboard and subscription management page.
     */
    public function show(
        Request $request,
        $workspace,
        WorkspaceContext $context,
        WorkspaceQuotaService $quotaService
    ) {
        if (!Auth::check()) {
            $request->session()->put('github_oauth_intended', $request->fullUrl());
            return redirect('/auth/github')->with('info', 'Please sign in with GitHub to access Workspace Billing.');
        }

        $user = $request->user();
        $resolvedWorkspace = $workspace instanceof Workspace
            ? $workspace
            : (is_numeric($workspace) ? Workspace::find($workspace) : Workspace::where('slug', $workspace)->first() ?? Workspace::find($workspace));

        if (!$resolvedWorkspace) {
            $resolvedWorkspace = $context->resolve($request);
        } else {
            // Verify user has membership in this workspace
            if (!$resolvedWorkspace->members()->whereKey($user->id)->exists()) {
                abort(403, 'A valid workspace membership is required.');
            }
            $request->attributes->set('workspace', $resolvedWorkspace);
            $request->session()->put('current_workspace_id', $resolvedWorkspace->id);
        }

        $subscription = $resolvedWorkspace->activeSubscription();
        $plan = $resolvedWorkspace->activePlan();

        $subData = [
            'id' => $subscription?->id,
            'plan_slug' => $plan->slug,
            'plan_name' => $plan->name,
            'billing_cycle' => $subscription?->billing_cycle ?? 'monthly',
            'status' => $subscription?->status ?? 'active',
            'seat_quantity' => $subscription?->seat_quantity ?? ($plan->max_seats ?? 1),
            'extra_runners_quantity' => $subscription?->extra_runners_quantity ?? 0,
            'current_period_starts_at' => $subscription?->current_period_starts_at?->toIso8601String() ?? now()->toIso8601String(),
            'current_period_ends_at' => $subscription?->current_period_ends_at?->toIso8601String() ?? now()->addMonth()->toIso8601String(),
            'canceled_at' => $subscription?->canceled_at?->toIso8601String(),
        ];

        $usage = $quotaService->getUsageSummary($resolvedWorkspace);
        $plans = Plan::active()->get();
        $invoices = $resolvedWorkspace->invoices()->latest()->take(20)->get();
        $workspaces = $user->workspaces()->where('is_system', false)->get(['workspaces.id', 'name', 'slug', 'plan']);

        return Inertia::render('Workspaces/Billing/Index', [
            'workspace' => [
                'id' => $resolvedWorkspace->id,
                'name' => $resolvedWorkspace->name,
                'slug' => $resolvedWorkspace->slug,
                'plan' => $resolvedWorkspace->plan,
                'agent_concurrency_limit' => $resolvedWorkspace->agent_concurrency_limit,
                'owner_id' => $resolvedWorkspace->owner_id,
                'user_role' => $context->role($request, $resolvedWorkspace) ?? 'member',
            ],
            'subscription' => $subData,
            'usage' => $usage,
            'plans' => $plans,
            'invoices' => $invoices,
            'workspaces' => $workspaces,
            'currentWorkspaceId' => $resolvedWorkspace->id,
        ]);
    }
}
