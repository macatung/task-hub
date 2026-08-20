<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesktopPairingSession extends Model
{
    protected $fillable = [
        'pairing_id', 'project_id', 'user_id', 'verifier_hash', 'code_hash',
        'status', 'expires_at', 'approved_at', 'consumed_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'approved_at' => 'datetime',
        'consumed_at' => 'datetime',
    ];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
