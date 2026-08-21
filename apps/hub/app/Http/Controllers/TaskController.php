<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Project;
use App\Models\Sprint;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->query("date", Carbon::today()->toDateString());
        $projectId = $request->query("project_id");
        
        $query = Task::with(['project', 'sprint', 'epic', 'documents']);

        if ($projectId && $projectId !== 'all') {
            if ($projectId === 'unassigned') {
                $query->whereNull('project_id');
            } else {
                $query->where('project_id', $projectId);
            }
        }

        $tasks = $query->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 WHEN status = 'todo' THEN 2 WHEN status = 'review' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 3 ELSE 4 END")
            ->orderBy("created_at", "desc")
            ->get();

        $projects = Project::select('id', 'title', 'slug', 'key', 'category', 'type', 'color', 'description', 'github_repository', 'github_default_branch')
            ->withCount('tasks')
            ->orderBy('title')
            ->get();

        $sprintsQuery = Sprint::with(['tasks' => function ($q) {
            $q->select('id', 'sprint_id', 'status', 'story_points');
        }]);

        if ($projectId && $projectId !== 'all' && $projectId !== 'unassigned') {
            $sprintsQuery->where('project_id', $projectId);
        }

        $sprints = $sprintsQuery->orderBy('created_at', 'desc')->get()->map(function ($sprint) {
            $totalPoints = $sprint->tasks->sum('story_points');
            $donePoints = $sprint->tasks->where('status', 'done')->sum('story_points');
            $totalTasks = $sprint->tasks->count();
            $doneTasks = $sprint->tasks->where('status', 'done')->count();

            return array_merge($sprint->toArray(), [
                'total_points' => $totalPoints,
                'done_points' => $donePoints,
                'total_tasks' => $totalTasks,
                'done_tasks' => $doneTasks,
            ]);
        });

        $epics = Task::where('issue_type', 'epic')->get(['id', 'project_id', 'issue_key', 'title', 'category']);

        $stats = [
            "total" => $tasks->count(),
            "todo" => $tasks->where("status", "todo")->count(),
            "in_progress" => $tasks->where("status", "in_progress")->count(),
            "review" => $tasks->where("status", "review")->count(),
            "done" => $tasks->where("status", "done")->count(),
            "total_story_points" => $tasks->sum("story_points"),
            "completed_story_points" => $tasks->where("status", "done")->sum("story_points"),
            "total_pomodoros_estimated" => $tasks->sum("estimated_pomodoros"),
            "total_pomodoros_completed" => $tasks->sum("completed_pomodoros"),
            "completion_rate" => $tasks->count() > 0 ? round(($tasks->where("status", "done")->count() / $tasks->count()) * 100) : 0,
        ];

        return Inertia::render("Tasks/Index", [
            "tasks" => $tasks,
            "projects" => $projects,
            "sprints" => $sprints,
            "epics" => $epics,
            "stats" => $stats,
            "selectedDate" => $date,
            "selectedProjectId" => $projectId ?: 'all',
            "projectKnowledge" => $projectId && $projectId !== 'all' && $projectId !== 'unassigned'
                ? app(\App\Services\ProjectKnowledgeService::class)->projectState(Project::findOrFail($projectId)) : null,
        ]);
    }
}
