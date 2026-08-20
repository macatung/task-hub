<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Carbon\Carbon;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'issue_key',
        'issue_type', // 'epic', 'story', 'task', 'bug'
        'title',
        'description',
        'status',
        'priority',
        'category',
        'story_points',
        'sprint_id',
        'epic_id',
        'estimated_pomodoros',
        'completed_pomodoros',
        'start_date',
        'due_date',
        'completed_at',
        'notes',
        'sort_order',
        'acceptance_criteria',
        'definition_of_done',
        'risk_level',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'sprint_id' => 'integer',
        'epic_id' => 'integer',
        'story_points' => 'integer',
        'start_date' => 'date:Y-m-d',
        'due_date' => 'date:Y-m-d',
        'completed_at' => 'datetime',
        'estimated_pomodoros' => 'integer',
        'completed_pomodoros' => 'integer',
        'sort_order' => 'integer',
    ];

    public function agentRuns()
    {
        return $this->hasMany(AgentRun::class);
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(ProjectDocument::class, 'task_documents')->withPivot(['is_required', 'purpose'])->withTimestamps();
    }

    protected static function booted()
    {
        static::creating(function ($task) {
            if (empty($task->issue_type)) {
                $task->issue_type = 'task';
            }
            if (empty($task->issue_key)) {
                $prefix = 'MCT';
                if ($task->project_id) {
                    $project = Project::find($task->project_id);
                    if ($project) {
                        $prefix = $project->effective_key;
                    }
                }
                $maxId = static::where('project_id', $task->project_id)->count() + 1;
                $task->issue_key = $prefix . '-' . $maxId;
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function sprint(): BelongsTo
    {
        return $this->belongsTo(Sprint::class);
    }

    public function epic(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'epic_id');
    }

    public function stories()
    {
        return $this->hasMany(Task::class, 'epic_id');
    }

    public function scopeToday($query)
    {
        return $query->whereDate('due_date', Carbon::today())
            ->orWhereNull('due_date')
            ->orWhere('status', 'in_progress');
    }

    public function scopeTodo($query)
    {
        return $query->where('status', 'todo');
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    public function scopeDone($query)
    {
        return $query->where('status', 'done');
    }

    public function markAsCompleted(): self
    {
        $this->update([
            'status' => 'done',
            'completed_at' => Carbon::now(),
        ]);
        return $this;
    }
}
