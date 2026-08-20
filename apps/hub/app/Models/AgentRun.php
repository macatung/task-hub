<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgentRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id', 'provider', 'agent_session_id', 'repository', 'branch',
        'commit_sha', 'pull_request_url', 'status', 'run_type', 'context_hash',
        'instruction_hash', 'summary', 'failure_reason', 'metadata',
        'started_at', 'finished_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function task() { return $this->belongsTo(Task::class); }
    public function evidence() { return $this->hasMany(VerificationEvidence::class); }
    public function events() { return $this->hasMany(AgentRunEvent::class); }
}
