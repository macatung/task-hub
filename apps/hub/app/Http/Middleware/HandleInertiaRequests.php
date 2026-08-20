<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'appName' => config('app.name', 'Macatung Portfolio'),
            'flash' => [
                'success' => fn () => $request->session()->get('flash.success') ?? $request->session()->get('success'),
                'error' => fn () => $request->session()->get('flash.error') ?? $request->session()->get('error'),
                'reference_id' => fn () => $request->session()->get('flash.reference_id') ?? $request->session()->get('reference_id'),
            ],
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'github_login' => $request->user()->github_login,
                    'github_avatar_url' => $request->user()->github_avatar_url,
                ] : null,
            ],
        ]);
    }
}
