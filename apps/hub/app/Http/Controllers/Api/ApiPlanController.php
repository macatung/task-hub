<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;

class ApiPlanController extends Controller
{
    /**
     * List all active subscription plans.
     */
    public function index(): JsonResponse
    {
        $plans = Plan::active()->get();

        return response()->json([
            'success' => true,
            'data' => $plans,
        ]);
    }
}
