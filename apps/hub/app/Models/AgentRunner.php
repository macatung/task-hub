<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AgentRunner extends Model
{
    protected $fillable = ['workspace_id', 'name', 'token_hash', 'hostname', 'version', 'capabilities', 'status', 'last_heartbeat_at', 'revoked_at', 'metadata'];

    protected $hidden = ['token_hash'];

    protected $casts = ['capabilities' => 'array', 'metadata' => 'array', 'last_heartbeat_at' => 'datetime', 'revoked_at' => 'datetime'];

    public function runs(): HasMany
    {
        return $this->hasMany(AgentRun::class, 'runner_id');
    }

    public function workspace() { return $this->belongsTo(Workspace::class); }
}
