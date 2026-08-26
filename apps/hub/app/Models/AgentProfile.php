<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentProfile extends Model
{
    protected $fillable = ['workspace_id', 'project_id', 'agent_key', 'name', 'role', 'provider', 'model', 'status', 'active_run_id', 'metadata', 'status_updated_at'];
    protected $casts = ['metadata' => 'array', 'status_updated_at' => 'datetime'];
    public function project() { return $this->belongsTo(Project::class); }
    public function activeRun() { return $this->belongsTo(AgentRun::class, 'active_run_id'); }
    public function inbox() { return $this->hasMany(AgentMessage::class, 'recipient_agent_id'); }
}
