<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AgentRunner extends Model
{
    protected $fillable = [
        'workspace_id',
        'name',
        'machine_name',
        'token_hash',
        'client_id',
        'runner_type',
        'hostname',
        'os_platform',
        'os_version',
        'ip_address',
        'version',
        'capabilities',
        'status',
        'active_provider',
        'active_model',
        'workspace_cwd',
        'quota_metrics',
        'ping_latency_ms',
        'last_heartbeat_at',
        'revoked_at',
        'metadata',
    ];

    protected $hidden = ['token_hash'];

    protected $casts = [
        'capabilities' => 'array',
        'metadata' => 'array',
        'quota_metrics' => 'array',
        'ping_latency_ms' => 'integer',
        'last_heartbeat_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    protected $appends = ['health'];

    public function runs(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'runner_id');
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function getHealthAttribute(): string
    {
        if ($this->revoked_at) {
            return 'revoked';
        }
        $staleAfter = now()->subSeconds((int) env('TASK_HUB_RUNNER_STALE_SECONDS', 45));
        if (!$this->last_heartbeat_at || $this->last_heartbeat_at->lt($staleAfter)) {
            return 'offline';
        }
        return $this->status ?: 'online';
    }

    public function scopeDesktop(Builder $query): Builder
    {
        return $query->where('runner_type', 'desktop');
    }

    public function scopeOnline(Builder $query, int $staleSeconds = 45): Builder
    {
        return $query->whereNull('revoked_at')
            ->where('status', '!=', 'offline')
            ->whereNotNull('last_heartbeat_at')
            ->where('last_heartbeat_at', '>=', now()->subSeconds($staleSeconds));
    }

    public function scopeStale(Builder $query, int $staleSeconds = 45): Builder
    {
        return $query->whereNull('revoked_at')
            ->where(function (Builder $q) use ($staleSeconds) {
                $q->whereNull('last_heartbeat_at')
                    ->orWhere('last_heartbeat_at', '<', now()->subSeconds($staleSeconds));
            })
            ->where('status', '!=', 'offline');
    }

    public static function reapStale(int $staleSeconds = 45): int
    {
        return static::stale($staleSeconds)->update(['status' => 'offline']);
    }
}

