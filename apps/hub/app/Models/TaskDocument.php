<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

class TaskDocument extends Pivot
{
    protected $table = 'task_documents';
    protected $fillable = ['task_id', 'project_document_id', 'is_required', 'purpose'];
    protected $casts = ['is_required' => 'boolean'];
    public function task(): BelongsTo { return $this->belongsTo(Task::class); }
    public function document(): BelongsTo { return $this->belongsTo(ProjectDocument::class, 'project_document_id'); }
}
