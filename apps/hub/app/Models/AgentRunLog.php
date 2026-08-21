<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentRunLog extends Model
{
    protected $fillable = ['agent_run_id', 'sequence', 'stream', 'content', 'occurred_at'];
    protected $casts = ['occurred_at' => 'datetime'];

    public function agentRun() { return $this->belongsTo(AgentRun::class); }
}
