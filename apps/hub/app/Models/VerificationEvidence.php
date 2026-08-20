<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VerificationEvidence extends Model
{
    use HasFactory;

    protected $table = 'verification_evidence';
    protected $fillable = [
        'agent_run_id', 'task_id', 'evidence_type', 'status', 'command',
        'summary', 'artifact_url', 'commit_sha', 'metadata',
    ];
    protected $casts = ['metadata' => 'array'];

    public function agentRun() { return $this->belongsTo(AgentRun::class); }
    public function task() { return $this->belongsTo(Task::class); }
}
