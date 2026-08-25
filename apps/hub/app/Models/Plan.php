<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'tagline',
        'description',
        'price_monthly',
        'price_yearly',
        'currency',
        'max_runners',
        'max_seats',
        'max_projects',
        'features',
        'limits',
        'is_active',
        'is_popular',
        'sort_order',
    ];

    protected $casts = [
        'price_monthly' => 'float',
        'price_yearly' => 'float',
        'max_runners' => 'integer',
        'max_seats' => 'integer',
        'max_projects' => 'integer',
        'features' => 'array',
        'limits' => 'array',
        'is_active' => 'boolean',
        'is_popular' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function subscriptions(): HasMany
    {
        return $this->hasMany(WorkspaceSubscription::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function isUnlimitedRunners(): bool
    {
        return is_null($this->max_runners);
    }

    public function isUnlimitedSeats(): bool
    {
        return is_null($this->max_seats);
    }

    public function isUnlimitedProjects(): bool
    {
        return is_null($this->max_projects);
    }

    public function getPriceForCycle(string $cycle = 'monthly'): float
    {
        return $cycle === 'yearly' ? (float) $this->price_yearly : (float) $this->price_monthly;
    }
}
