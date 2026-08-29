<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Workspace extends Model
{
    protected $fillable = ['slug', 'name', 'owner_id', 'is_system', 'plan', 'agent_concurrency_limit'];
    protected $casts = ['is_system' => 'boolean', 'agent_concurrency_limit' => 'integer'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_members')->withPivot('role')->withTimestamps();
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function credentials(): HasMany
    {
        return $this->hasMany(WorkspaceCredential::class);
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(WorkspaceSubscription::class)->latestOfMany();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(WorkspaceSubscription::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function activeSubscription(): ?WorkspaceSubscription
    {
        $sub = $this->subscription()->with('plan')->first();
        if ($sub && $sub->isActive()) {
            return $sub;
        }

        return null;
    }

    public function activePlan(): Plan
    {
        $sub = $this->activeSubscription();
        if ($sub && $sub->plan) {
            return $sub->plan;
        }

        $planSlug = $this->plan ?: 'community';
        if ($planSlug === 'free') {
            $planSlug = 'community';
        }

        $plan = Plan::where('slug', $planSlug)->first();
        if ($plan) {
            return $plan;
        }

        $community = Plan::where('slug', 'community')->first();
        if ($community) {
            return $community;
        }

        return new Plan([
            'slug' => 'community',
            'name' => 'Community',
            'max_runners' => 1,
            'max_seats' => 1,
            'max_projects' => 3,
            'price_monthly' => 0.0,
            'price_yearly' => 0.0,
            'features' => [],
            'limits' => [],
            'is_active' => true,
        ]);
    }

    public function syncPlanAndLimits(?Plan $plan = null, int $extraRunners = 0): void
    {
        $plan = $plan ?? $this->activePlan();
        $this->plan = $plan->slug;
        $this->agent_concurrency_limit = $plan->isUnlimitedRunners() ? 999999 : ((int) $plan->max_runners + $extraRunners);
        $this->save();
    }

    public function effectiveRunnerLimit(): ?int
    {
        $sub = $this->activeSubscription();
        if ($sub) {
            return $sub->effectiveMaxRunners();
        }

        $plan = $this->activePlan();
        return $plan->isUnlimitedRunners() ? null : (int) $plan->max_runners;
    }

    public function effectiveSeatLimit(): ?int
    {
        $sub = $this->activeSubscription();
        if ($sub) {
            return $sub->effectiveMaxSeats();
        }

        $plan = $this->activePlan();
        return $plan->isUnlimitedSeats() ? null : (int) $plan->max_seats;
    }

    public function effectiveProjectLimit(): ?int
    {
        $sub = $this->activeSubscription();
        if ($sub) {
            return $sub->effectiveMaxProjects();
        }

        $plan = $this->activePlan();
        return $plan->isUnlimitedProjects() ? null : (int) $plan->max_projects;
    }

    public function effectiveRetentionDays(): int
    {
        $plan = $this->activePlan();
        return $plan->getRetentionDays();
    }
}

