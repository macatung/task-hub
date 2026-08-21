<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sprint;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Models\Project;
use App\Services\WorkspaceContext;

class ApiSprintController extends Controller
{
    /**
     * Get sprints for a project
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sprint::with(['tasks' => function ($q) {
            $q->select('id', 'sprint_id', 'status', 'story_points');
        }]);

        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        $sprints = $query->orderBy('created_at', 'desc')->get()->map(function ($sprint) {
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

        return response()->json([
            'success' => true,
            'data' => $sprints,
        ]);
    }

    /**
     * Create a new sprint
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'name' => 'required|string|max:255',
            'goal' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'status' => 'nullable|in:future,active,completed',
        ]);

        $workspace = $request->user() ? app(WorkspaceContext::class)->resolve($request) : null;
        if ($workspace) Project::where('workspace_id', $workspace->id)->findOrFail($validated['project_id']);
        $sprint = Sprint::create([
            'project_id' => $validated['project_id'],
            'workspace_id' => $workspace?->id,
            'name' => $validated['name'],
            'goal' => $validated['goal'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'status' => $validated['status'] ?? 'future',
        ]);

        return response()->json([
            'success' => true,
            'data' => $sprint,
            'message' => 'Sprint created successfully.',
        ], 201);
    }

    /**
     * Update sprint
     */
    public function update(Request $request, Sprint $sprint): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'goal' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'status' => 'sometimes|in:future,active,completed',
        ]);

        $sprint->update($validated);

        return response()->json([
            'success' => true,
            'data' => $sprint,
            'message' => 'Sprint updated successfully.',
        ]);
    }

    /**
     * Start sprint
     */
    public function start(Request $request, Sprint $sprint): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'duration_weeks' => 'nullable|integer|min:1|max:4',
        ]);

        $startDate = !empty($validated['start_date']) ? Carbon::parse($validated['start_date']) : Carbon::now();
        $endDate = !empty($validated['end_date'])
            ? Carbon::parse($validated['end_date'])
            : $startDate->copy()->addWeeks($validated['duration_weeks'] ?? 2);

        $sprint->update([
            'status' => 'active',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $sprint,
            'message' => "Sprint '{$sprint->name}' has started.",
        ]);
    }

    /**
     * Complete sprint
     */
    public function complete(Request $request, Sprint $sprint): JsonResponse
    {
        $validated = $request->validate([
            'move_incomplete_to' => 'nullable|string', // 'backlog' or sprint_id
        ]);

        $sprint->update([
            'status' => 'completed',
        ]);

        // Handle incomplete tasks
        $targetSprintId = is_numeric($validated['move_incomplete_to'] ?? null)
            ? (int)$validated['move_incomplete_to']
            : null;

        Task::where('sprint_id', $sprint->id)
            ->where('status', '!=', 'done')
            ->update(['sprint_id' => $targetSprintId]);

        return response()->json([
            'success' => true,
            'data' => $sprint,
            'message' => "Sprint '{$sprint->name}' has been completed.",
        ]);
    }

    /**
     * Delete sprint
     */
    public function destroy(Sprint $sprint): JsonResponse
    {
        // Move all tasks in this sprint to backlog
        Task::where('sprint_id', $sprint->id)->update(['sprint_id' => null]);
        $sprint->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sprint deleted and its tasks moved to the backlog.',
        ]);
    }

    /**
     * Bulk move tasks into a sprint or backlog
     */
    public function moveTasks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_ids' => 'required|array',
            'task_ids.*' => 'exists:tasks,id',
            'sprint_id' => 'nullable|exists:sprints,id',
        ]);

        Task::whereIn('id', $validated['task_ids'])->update([
            'sprint_id' => $validated['sprint_id'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Task list moved successfully.',
        ]);
    }
}
