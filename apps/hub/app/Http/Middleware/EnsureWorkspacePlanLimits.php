<?php

namespace App\Http\Middleware;

use App\Services\WorkspaceContext;
use App\Services\WorkspaceQuotaService;
use Closure;
use Illuminate\Http\Request;

class EnsureWorkspacePlanLimits
{
    public function __construct(
        protected WorkspaceContext $workspaceContext,
        protected WorkspaceQuotaService $quotaService
    ) {}

    public function handle(Request $request, Closure $next, string $resource = 'runners')
    {
        $workspace = $this->workspaceContext->resolve($request);

        if ($workspace) {
            match ($resource) {
                'runners' => $this->quotaService->assertCanDispatchTask($workspace),
                'seats' => $this->quotaService->assertCanAddMember($workspace),
                'projects' => $this->quotaService->assertCanCreateProject($workspace),
                default => null,
            };
        }

        return $next($request);
    }
}
