<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ContactSubmission extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'contact_submissions';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'reference_id',
        'name',
        'email',
        'project_type',
        'coffee_offering',
        'message',
        'ip_address',
        'user_agent',
        'is_read',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::creating(function (ContactSubmission $submission) {
            if (empty($submission->reference_id)) {
                $submission->reference_id = self::generateReferenceId();
            }
        });
    }

    /**
     * Generate a unique Summoning Altar reference ID.
     */
    public static function generateReferenceId(): string
    {
        do {
            $id = 'SUMMON-' . strtoupper(Str::random(6));
        } while (static::where('reference_id', $id)->exists());

        return $id;
    }

    /**
     * Scope a query to only include unread submissions.
     */
    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }

    /**
     * Scope a query to order by most recent submissions.
     */
    public function scopeRecent(Builder $query): Builder
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Scope a query to filter by project type.
     */
    public function scopeByProjectType(Builder $query, string $type): Builder
    {
        return $query->where('project_type', $type);
    }
}
