<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentMessage extends Model
{
    protected $fillable = ['thread_id', 'workspace_id', 'project_id', 'sender_agent_id', 'recipient_agent_id', 'subject', 'body', 'status', 'payload', 'delivered_at', 'read_at', 'acknowledged_at'];
    protected $casts = ['payload' => 'array', 'delivered_at' => 'datetime', 'read_at' => 'datetime', 'acknowledged_at' => 'datetime'];
    public function sender() { return $this->belongsTo(AgentProfile::class, 'sender_agent_id'); }
    public function recipient() { return $this->belongsTo(AgentProfile::class, 'recipient_agent_id'); }
}
