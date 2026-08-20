<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PageView extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'ip_hash',
        'url',
        'referrer',
        'user_agent',
        'device_type',
        'browser',
        'is_midnight',
        'created_at',
    ];

    protected $casts = [
        'is_midnight' => 'boolean',
        'created_at' => 'datetime',
    ];
}
