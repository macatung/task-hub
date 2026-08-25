<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Marks unversioned /api routes as compatibility aliases for the v1 contract. */
class LegacyApiDeprecation
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $legacyPath = '/' . ltrim($request->path(), '/');
        $successor = match ($legacyPath) {
            '/api/mcp', '/api/tasks/mcp' => '/api/v1/mcp',
            default => preg_replace('#^/api/#', '/api/v1/', $legacyPath) ?: '/api/v1',
        };
        $response->headers->set('Deprecation', 'true');
        $response->headers->set('Link', '<' . $successor . '>; rel="successor-version"');
        return $response;
    }
}
