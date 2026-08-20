<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Experience extends Model
{
    use HasFactory;

    protected $fillable = [
        'role',
        'company',
        'period',
        'type',
        'location',
        'summary',
        'achievements',
        'technologies',
        'order',
    ];

    protected $casts = [
        'achievements' => 'array',
        'technologies' => 'array',
        'order' => 'integer',
    ];

    public function scopeOrdered($query)
    {
        return $query->orderBy('order', 'asc')->orderBy('id', 'desc');
    }
}
