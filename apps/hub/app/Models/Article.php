<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    use HasFactory;

    protected $fillable = [
        'site_domain',
        'title',
        'pali_title',
        'slug',
        'category',
        'excerpt',
        'author',
        'content',
        'tags',
        'pali_terms',
        'audio_chanting_url',
        'reading_time_min',
        'is_published',
        'published_at',
    ];

    protected $casts = [
        'tags' => 'array',
        'pali_terms' => 'array',
        'is_published' => 'boolean',
        'reading_time_min' => 'integer',
        'published_at' => 'datetime',
    ];

    public function scopePublished($query)
    {
        return $query->where('is_published', true)->orderBy('published_at', 'desc');
    }

    public function scopeForMain($query)
    {
        return $query->where('site_domain', 'main');
    }

    public function scopeForTheravada($query)
    {
        return $query->where('site_domain', 'theravada');
    }
}
