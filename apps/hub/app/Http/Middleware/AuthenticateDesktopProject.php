<?php

namespace App\Http\Middleware;

use App\Models\Project;
use App\Models\DesktopPairingSession;
use App\Services\GithubProjectIntegrationService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateDesktopProject
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->bearerToken();
        $projectId = (string) $request->header('X-Task-Hub-Project');

        if ($token === '') {
            return response()->json(['success' => false, 'message' => 'Desktop Task Hub authentication is required.'], 401);
        }

        $workspaceSession = DesktopPairingSession::with('workspace')
            ->where('workspace_token_hash', hash('sha256', $token))
            ->where('status', 'approved')
            ->latest('id')
            ->first();
        if ($workspaceSession?->workspace) {
            Auth::onceUsingId($workspaceSession->user_id);
            $request->attributes->set('desktop_workspace_id', $workspaceSession->workspace_id);
            $request->attributes->set('desktop_workspace_token', true);
            return $next($request);
        }
        if (!ctype_digit($projectId)) return response()->json(['success' => false, 'message' => 'Desktop Task Hub authentication is required.'], 401);

        $project = Project::with('workspace')->find((int) $projectId);
        $secret = $project?->task_hub_mcp_token
            ? app(GithubProjectIntegrationService::class)->secret($project->task_hub_mcp_token)
            : null;

        if (!$project || !$secret || !hash_equals($secret, $token) || !$project->workspace_id || !$project->workspace) {
            return response()->json(['success' => false, 'message' => 'Desktop project credential is invalid or expired.'], 401);
        }

        $ownerId = $project->user_id ?: $project->workspace->owner_id;
        if (!$ownerId) {
            return response()->json(['success' => false, 'message' => 'The project has no SaaS workspace owner.'], 422);
        }

        Auth::onceUsingId($ownerId);
        $request->attributes->set('desktop_project', $project);
        $request->attributes->set('desktop_workspace_id', $project->workspace_id);

        return $next($request);
    }
}
