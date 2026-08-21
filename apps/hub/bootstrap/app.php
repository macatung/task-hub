<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TrackVisitorAnalytics;
use App\Http\Middleware\AdminAuthMiddleware;
use App\Http\Middleware\ResolveWorkspace;
use App\Http\Middleware\AuthenticateDesktopProject;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            HandleInertiaRequests::class,
            TrackVisitorAnalytics::class,
        ]);

        $middleware->alias([
            'admin.auth' => AdminAuthMiddleware::class,
            'workspace' => ResolveWorkspace::class,
            'desktop.project' => AuthenticateDesktopProject::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
