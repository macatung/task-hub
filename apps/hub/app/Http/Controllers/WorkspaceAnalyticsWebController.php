<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Services\WorkspaceAnalyticsService;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceAnalyticsWebController extends Controller
{
    /**
     * Display the workspace velocity & analytics dashboard page.
     */
    public function index(
        Request $request,
        $workspace,
        WorkspaceContext $context,
        WorkspaceAnalyticsService $analyticsService
    ) {
        if (!Auth::check()) {
            $request->session()->put('github_oauth_intended', $request->fullUrl());
            return redirect('/auth/github')->with('info', 'Please sign in with GitHub to access Workspace Analytics.');
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

        $canAccessAnalytics = $analyticsService->canAccessAnalytics($resolvedWorkspace);
        $timeRange = $request->query('time_range') ?: $request->query('window') ?: '30d';
        if (!in_array($timeRange, ['7d', '30d', '90d', '1y'], true)) {
            $timeRange = '30d';
        }

        $analyticsData = null;
        if ($canAccessAnalytics) {
            $analyticsData = $analyticsService->getAnalytics($resolvedWorkspace, $timeRange);
        } else {
            // Provide a clean preview structure for locked UI rendering
            $analyticsData = [
                'workspace_id' => $resolvedWorkspace->id,
                'plan' => strtolower($resolvedWorkspace->plan ?: 'community'),
                'time_range' => $timeRange,
                'throughput' => [
                    'total_tasks_completed' => 0,
                    'velocity_points_per_week' => 0,
                    'run_throughput_24h' => 0,
                    'throughput_history' => [],
                ],
                'success_rate' => [
                    'total_runs' => 0,
                    'successful_runs' => 0,
                    'failed_runs' => 0,
                    'cancelled_runs' => 0,
                    'success_percentage' => 0,
                    'failure_reasons' => [],
                ],
                'ai_models' => [
                    'total_model_invocations' => 0,
                    'distribution' => [],
                ],
                'turnaround_time' => [
                    'avg_run_duration_seconds' => 0,
                    'p95_duration_seconds' => 0,
                    'avg_queue_wait_seconds' => 0,
                    'avg_review_turnaround_seconds' => 0,
                ],
            ];
        }

        $plan = $resolvedWorkspace->activePlan();
        $workspaces = $user->workspaces()->where('is_system', false)->get(['workspaces.id', 'name', 'slug', 'plan']);
        $userRole = $user->id === $resolvedWorkspace->owner_id ? 'owner' : ($context->role($request, $resolvedWorkspace) ?? 'developer');

        return Inertia::render('Workspaces/Analytics/Index', [
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
            'analytics' => $analyticsData,
            'canAccessAnalytics' => $canAccessAnalytics,
            'timeRange' => $timeRange,
            'workspaces' => $workspaces,
            'currentWorkspaceId' => $resolvedWorkspace->id,
        ]);
    }
}
