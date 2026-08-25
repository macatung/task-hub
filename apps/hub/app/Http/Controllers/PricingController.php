<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Services\WorkspaceContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class PricingController extends Controller
{
    /**
     * Display the public pricing page.
     */
    public function index(Request $request): Response
    {
        $plans = Plan::active()->get();
        $workspaces = collect();
        $currentWorkspaceId = null;

        if (Auth::check()) {
            $user = $request->user();
            $workspaces = $user->workspaces()
                ->where('is_system', false)
                ->get(['workspaces.id', 'name', 'slug', 'plan']);

            $resolvedWorkspace = app(WorkspaceContext::class)->resolve($request, false);
            $currentWorkspaceId = $resolvedWorkspace?->id;
        }

        return Inertia::render('Pricing/Index', [
            'plans' => $plans,
            'workspaces' => $workspaces,
            'currentWorkspaceId' => $currentWorkspaceId,
        ]);
    }
}
