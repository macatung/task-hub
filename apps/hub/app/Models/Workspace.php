<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workspace extends Model
{
    protected $fillable = ['slug', 'name', 'owner_id', 'is_system', 'plan', 'agent_concurrency_limit'];
    protected $casts = ['is_system' => 'boolean', 'agent_concurrency_limit' => 'integer'];

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function members(): BelongsToMany { return $this->belongsToMany(User::class, 'workspace_members')->withPivot('role')->withTimestamps(); }
    public function projects(): HasMany { return $this->hasMany(Project::class); }
}
