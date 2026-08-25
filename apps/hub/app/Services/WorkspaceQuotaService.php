<?php

namespace App\Services;

use App\Exceptions\PlanQuotaExceededException;
use App\Models\AgentRun;
use App\Models\Workspace;

class WorkspaceQuotaService
{
    /**
     * Get real-time usage summary and limit percentages for a workspace.
     *
     * @return array{runners: array{active: int, limit: ?int, percent: float}, seats: array{active: int, limit: ?int, percent: float}, projects: array{active: int, limit: ?int, percent: float}}
     */
    public function getUsageSummary(Workspace $workspace): array
    {
        $activeRunners = AgentRun::where('workspace_id', $workspace->id)
            ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
            ->count();
        $runnerLimit = $workspace->effectiveRunnerLimit();
        $runnerPercent = ($runnerLimit && $runnerLimit > 0)
            ? round(($activeRunners / $runnerLimit) * 100, 1)
            : 0.0;

        $memberCount = $workspace->members()->count();
        $activeSeats = max(1, $memberCount);
        $seatLimit = $workspace->effectiveSeatLimit();
        $seatPercent = ($seatLimit && $seatLimit > 0)
            ? round(($activeSeats / $seatLimit) * 100, 1)
            : 0.0;

        $activeProjects = $workspace->projects()->count();
        $projectLimit = $workspace->effectiveProjectLimit();
        $projectPercent = ($projectLimit && $projectLimit > 0)
            ? round(($activeProjects / $projectLimit) * 100, 1)
            : 0.0;

        return [
            'runners' => [
                'active' => $activeRunners,
                'limit' => $runnerLimit,
                'percent' => $runnerPercent,
            ],
            'seats' => [
                'active' => $activeSeats,
                'limit' => $seatLimit,
                'percent' => $seatPercent,
            ],
            'projects' => [
                'active' => $activeProjects,
                'limit' => $projectLimit,
                'percent' => $projectPercent,
            ],
        ];
    }

    /**
     * Check if workspace has available concurrency capacity to dispatch a new agent task.
     *
     * @throws PlanQuotaExceededException
     */
    public function assertCanDispatchTask(Workspace $workspace): void
    {
        $limit = $workspace->effectiveRunnerLimit();
        if ($limit === null) {
            return; // Unlimited runners
        }

        $activeRunners = AgentRun::where('workspace_id', $workspace->id)
            ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
            ->count();

        if ($activeRunners >= $limit) {
            $currentPlan = $workspace->activePlan()->slug;
            $suggestedPlan = match ($currentPlan) {
                'community' => 'pro',
                'pro' => 'team',
                default => 'enterprise',
            };

            throw new PlanQuotaExceededException(
                resource: 'runners',
                currentUsage: $activeRunners,
                limit: $limit,
                currentPlan: $currentPlan,
                suggestedPlan: $suggestedPlan,
                upgradeUrl: "/workspaces/{$workspace->id}/billing",
                message: "Runner concurrency limit reached ({$activeRunners}/{$limit} active). Upgrade your plan to run more agents simultaneously."
            );
        }
    }

    /**
     * Check if workspace can add another team member within plan seat limits.
     *
     * @throws PlanQuotaExceededException
     */
    public function assertCanAddMember(Workspace $workspace): void
    {
        $limit = $workspace->effectiveSeatLimit();
        if ($limit === null) {
            return; // Unlimited seats
        }

        $currentSeats = $workspace->members()->count();

        if ($currentSeats >= $limit) {
            $currentPlan = $workspace->activePlan()->slug;
            $suggestedPlan = match ($currentPlan) {
                'community', 'pro' => 'team',
                default => 'enterprise',
            };

            throw new PlanQuotaExceededException(
                resource: 'seats',
                currentUsage: $currentSeats,
                limit: $limit,
                currentPlan: $currentPlan,
                suggestedPlan: $suggestedPlan,
                upgradeUrl: "/workspaces/{$workspace->id}/billing",
                message: "Workspace seat limit reached ({$currentSeats}/{$limit} members). Upgrade your plan to invite more team members."
            );
        }
    }

    /**
     * Check if workspace can create another project within plan limits.
     *
     * @throws PlanQuotaExceededException
     */
    public function assertCanCreateProject(Workspace $workspace): void
    {
        $limit = $workspace->effectiveProjectLimit();
        if ($limit === null) {
            return; // Unlimited projects
        }

        $currentProjects = $workspace->projects()->count();

        if ($currentProjects >= $limit) {
            $currentPlan = $workspace->activePlan()->slug;
            $suggestedPlan = match ($currentPlan) {
                'community' => 'pro',
                'pro' => 'team',
                default => 'enterprise',
            };

            throw new PlanQuotaExceededException(
                resource: 'projects',
                currentUsage: $currentProjects,
                limit: $limit,
                currentPlan: $currentPlan,
                suggestedPlan: $suggestedPlan,
                upgradeUrl: "/workspaces/{$workspace->id}/billing",
                message: "Project limit reached ({$currentProjects}/{$limit} projects). Upgrade your plan to create unlimited projects."
            );
        }
    }
}
