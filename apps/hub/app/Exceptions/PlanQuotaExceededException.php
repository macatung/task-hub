<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanQuotaExceededException extends Exception
{
    public string $resource;
    public int $currentUsage;
    public ?int $limit;
    public string $currentPlan;
    public string $suggestedPlan;
    public string $upgradeUrl;

    public function __construct(
        string $resource,
        int $currentUsage,
        ?int $limit,
        string $currentPlan,
        string $suggestedPlan = 'pro',
        string $upgradeUrl = '/workspaces/billing',
        string $message = ''
    ) {
        $this->resource = $resource;
        $this->currentUsage = $currentUsage;
        $this->limit = $limit;
        $this->currentPlan = $currentPlan;
        $this->suggestedPlan = $suggestedPlan;
        $this->upgradeUrl = $upgradeUrl;

        if (empty($message)) {
            $message = match ($resource) {
                'runners' => "Runner concurrency limit reached ({$currentUsage}/" . ($limit ?? '∞') . " active). Upgrade your plan to run more agents simultaneously.",
                'seats' => "Workspace seat limit reached ({$currentUsage}/" . ($limit ?? '∞') . " members). Upgrade your plan to invite more team members.",
                'projects' => "Project limit reached ({$currentUsage}/" . ($limit ?? '∞') . " projects). Upgrade your plan to create unlimited projects.",
                default => "Plan limit reached for {$resource}.",
            };
        }

        parent::__construct($message, 422);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error_code' => 'PLAN_QUOTA_EXCEEDED',
            'message' => $this->getMessage(),
            'quota' => [
                'resource' => $this->resource,
                'current_usage' => $this->currentUsage,
                'limit' => $this->limit,
                'current_plan' => $this->currentPlan,
                'suggested_plan' => $this->suggestedPlan,
                'upgrade_url' => $this->upgradeUrl,
            ],
        ], 422);
    }
}
