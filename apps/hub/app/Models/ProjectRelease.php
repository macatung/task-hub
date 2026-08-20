<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectRelease extends Model
{
    protected $fillable = ['project_id', 'version', 'environment', 'status', 'summary', 'changes', 'commit_sha', 'release_url', 'deployed_by', 'deployed_at'];
    protected $casts = ['changes' => 'array', 'deployed_at' => 'datetime'];
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
}
