<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkspaceSubscription extends Model
{
    protected $fillable = [
        'workspace_id',
        'plan_id',
        'billing_cycle',
        'status',
        'seat_quantity',
        'extra_runners_quantity',
        'current_period_starts_at',
        'current_period_ends_at',
        'canceled_at',
        'trial_ends_at',
        'payment_method',
        'external_reference_id',
        'metadata',
    ];

    protected $casts = [
        'seat_quantity' => 'integer',
        'extra_runners_quantity' => 'integer',
        'current_period_starts_at' => 'datetime',
        'current_period_ends_at' => 'datetime',
        'canceled_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'subscription_id');
    }

    public function isActive(): bool
    {
        if (!in_array($this->status, ['active', 'trialing'], true)) {
            return false;
        }

        if ($this->current_period_ends_at !== null && $this->current_period_ends_at->isPast()) {
            return false;
        }

        return true;
    }

    public function isCanceled(): bool
    {
        return $this->status === 'canceled' || $this->canceled_at !== null;
    }

    public function effectiveMaxRunners(): ?int
    {
        if ($this->plan && $this->plan->isUnlimitedRunners()) {
            return null;
        }

        $base = $this->plan ? $this->plan->max_runners : 1;
        return (int) $base + (int) $this->extra_runners_quantity;
    }

    public function effectiveMaxSeats(): ?int
    {
        if ($this->plan && $this->plan->isUnlimitedSeats()) {
            return null;
        }

        $base = $this->plan ? $this->plan->max_seats : 1;
        return max((int) $base, (int) $this->seat_quantity);
    }

    public function effectiveMaxProjects(): ?int
    {
        if ($this->plan && $this->plan->isUnlimitedProjects()) {
            return null;
        }

        return $this->plan ? $this->plan->max_projects : 3;
    }
}
