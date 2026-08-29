<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceCredential extends Model
{
    protected $fillable = [
        'workspace_id',
        'project_id',
        'name',
        'provider',
        'ciphertext',
        'key_version',
        'fingerprint',
        'status',
        'last_validated_at',
        'revoked_at',
    ];

    protected $hidden = [
        'ciphertext',
    ];

    protected $casts = [
        'last_validated_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function isRevoked(): bool
    {
        return $this->status === 'revoked' || !is_null($this->revoked_at);
    }
}
