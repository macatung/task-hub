<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GithubEvent extends Model
{
    use HasFactory;

    protected $fillable = ['project_id', 'provider_event_id', 'event_name', 'repository', 'payload', 'occurred_at'];
    protected $casts = ['payload' => 'array', 'occurred_at' => 'datetime'];
}
