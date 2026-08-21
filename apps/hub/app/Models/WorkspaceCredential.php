<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkspaceCredential extends Model
{
    protected $fillable = ['workspace_id', 'project_id', 'provider', 'ciphertext', 'key_version', 'fingerprint', 'status', 'last_validated_at', 'revoked_at'];
    protected $hidden = ['ciphertext'];
    protected $casts = ['last_validated_at' => 'datetime', 'revoked_at' => 'datetime'];

    public function workspace() { return $this->belongsTo(Workspace::class); }
    public function project() { return $this->belongsTo(Project::class); }
}
