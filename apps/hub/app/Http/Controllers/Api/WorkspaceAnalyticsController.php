<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\WorkspaceAnalyticsService;
use App\Services\WorkspaceContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceAnalyticsController extends Controller
{
    /**
     * Return aggregated velocity and analytics metrics for a workspace.
     */
    public function show(
        Request $request,
        Workspace $workspace,
        WorkspaceAnalyticsService $analyticsService,
        WorkspaceContext $context
    ): JsonResponse {
        $resolvedWorkspace = $workspace->exists ? $workspace : $context->resolve($request, false);
        if (!$resolvedWorkspace) {
            // Attempt to resolve by route param if model binding didn't resolve
            $routeWorkspace = $request->route('workspace');
            if ($routeWorkspace) {
                $resolvedWorkspace = is_numeric($routeWorkspace)
                    ? Workspace::find($routeWorkspace)
                    : Workspace::where('slug', $routeWorkspace)->first() ?? Workspace::find($routeWorkspace);
            }
        }

        if (!$resolvedWorkspace) {
            abort(404, 'Workspace not found.');
        }

        // Authorize user has access to this workspace
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        $isMember = $resolvedWorkspace->owner_id === $user->id || $resolvedWorkspace->members()->whereKey($user->id)->exists();
        if (!$isMember) {
            abort(403, 'A valid workspace membership is required.');
        }

        // Set workspace context header
        $request->headers->set('X-Workspace-Id', (string) $resolvedWorkspace->id);

        // Plan Gating: Team and Enterprise only
        if (!$analyticsService->canAccessAnalytics($resolvedWorkspace)) {
            $currentPlan = strtolower($resolvedWorkspace->plan ?: ($resolvedWorkspace->activePlan()?->slug ?? 'community'));
            return response()->json([
                'success' => false,
                'error_code' => 'UPGRADE_REQUIRED',
                'message' => 'Team Velocity & Analytics Dashboard is an exclusive Team and Enterprise feature. Please upgrade.',
                'quota' => [
                    'resource' => 'analytics',
                    'current_usage' => 0,
                    'limit' => 0,
                    'current_plan' => $currentPlan,
                    'suggested_plan' => 'team',
                    'upgrade_url' => "/workspaces/{$resolvedWorkspace->id}/billing",
                ],
            ], 403);
        }

        $timeRange = $request->query('time_range') ?: $request->query('window') ?: '30d';
        if (!in_array($timeRange, ['7d', '30d', '90d', '1y'], true)) {
            $timeRange = '30d';
        }

        $data = $analyticsService->getAnalytics($resolvedWorkspace, $timeRange);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
