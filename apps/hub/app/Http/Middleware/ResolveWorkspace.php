<?php

namespace App\Http\Middleware;

use App\Services\WorkspaceContext;
use Closure;
use Illuminate\Http\Request;

class ResolveWorkspace
{
    public function handle(Request $request, Closure $next)
    {
        app(WorkspaceContext::class)->resolve($request);
        return $next($request);
    }
}
