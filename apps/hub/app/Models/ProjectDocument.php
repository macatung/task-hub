<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProjectDocument extends Model
{
    use HasFactory;

    public const TYPES = ['brief', 'prd', 'architecture', 'adr', 'design', 'api_contract', 'coding_standard', 'qa_plan', 'release_runbook', 'decision_log', 'risk_log', 'changelog', 'other'];

    protected $fillable = ['project_id', 'document_type', 'title', 'url', 'repository_path', 'version', 'content_hash', 'status', 'owner', 'access_level', 'tags', 'source_updated_at', 'last_verified_at'];

    protected $casts = ['tags' => 'array', 'source_updated_at' => 'datetime', 'last_verified_at' => 'datetime'];

    protected $appends = ['is_stale'];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function tasks(): BelongsToMany { return $this->belongsToMany(Task::class, 'task_documents')->withPivot(['is_required', 'purpose'])->withTimestamps(); }

    public function getIsStaleAttribute(): bool
    {
        return $this->status !== 'active' || (!$this->last_verified_at || $this->last_verified_at->lt(now()->subDays(30)));
    }
}
