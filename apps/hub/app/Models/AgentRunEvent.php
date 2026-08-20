<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgentRunEvent extends Model
{
    use HasFactory;

    protected $fillable = ['agent_run_id', 'event_id', 'event_type', 'status', 'payload', 'occurred_at'];
    protected $casts = ['payload' => 'array', 'occurred_at' => 'datetime'];

    public function agentRun() { return $this->belongsTo(AgentRun::class); }
}
