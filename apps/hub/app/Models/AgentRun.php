<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgentRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id', 'workspace_id', 'runner_id', 'provider', 'agent_session_id', 'repository', 'branch',
        'commit_sha', 'pull_request_url', 'status', 'run_type', 'context_hash',
        'execution_mode', 'instruction_hash', 'summary', 'failure_reason', 'metadata',
        'claimed_at', 'lease_expires_at', 'queued_at', 'cancel_requested_at', 'exit_code',
        'started_at', 'finished_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'claimed_at' => 'datetime',
        'lease_expires_at' => 'datetime',
        'queued_at' => 'datetime',
        'cancel_requested_at' => 'datetime',
        'exit_code' => 'integer',
    ];

    public function task() { return $this->belongsTo(Task::class); }
    public function evidence() { return $this->hasMany(VerificationEvidence::class); }
    public function events() { return $this->hasMany(AgentRunEvent::class); }
    public function runner() { return $this->belongsTo(AgentRunner::class, 'runner_id'); }
    public function workspace() { return $this->belongsTo(Workspace::class); }
    public function logs() { return $this->hasMany(AgentRunLog::class); }
}
