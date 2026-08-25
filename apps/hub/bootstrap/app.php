<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TrackVisitorAnalytics;
use App\Http\Middleware\AdminAuthMiddleware;
use App\Http\Middleware\ResolveWorkspace;
use App\Http\Middleware\AuthenticateDesktopProject;
use App\Http\Middleware\EnsureWorkspacePlanLimits;
use App\Http\Middleware\LegacyApiDeprecation;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        // API routes and MCP endpoints are consumed by agents and tools
        // authenticating with bearer/device credentials, not browser session CSRF cookies.
        $middleware->validateCsrfTokens(except: [
            'mcp',
            'mcp/*',
            'api/*',
            'api/v1/*',
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            TrackVisitorAnalytics::class,
        ]);

        $middleware->alias([
            'admin.auth' => AdminAuthMiddleware::class,
            'workspace' => ResolveWorkspace::class,
            'desktop.project' => AuthenticateDesktopProject::class,
            'legacy.api' => LegacyApiDeprecation::class,
            'plan.limits' => EnsureWorkspacePlanLimits::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
