<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\TaskUsageEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Carbon\Carbon;

class ApiTaskController extends Controller
{
    public function index(Request $request)
    {
        $query = Task::with(['project', 'sprint', 'epic', 'documents']);

        if ($request->has("project_id") && $request->query("project_id") !== 'all') {
            if ($request->query("project_id") === 'unassigned') {
                $query->whereNull("project_id");
            } else {
                $query->where("project_id", $request->query("project_id"));
            }
        }

        if ($request->has("sprint_id")) {
            if ($request->query("sprint_id") === 'backlog') {
                $query->whereNull("sprint_id");
            } elseif ($request->query("sprint_id") !== 'all') {
                $query->where("sprint_id", $request->query("sprint_id"));
            }
        }

        if ($request->has("issue_type") && $request->query("issue_type") !== 'all') {
            $query->where("issue_type", $request->query("issue_type"));
        }

        if ($request->has("status")) {
            $query->where("status", $request->query("status"));
        }

        if ($request->has("today")) {
            $query->where(function ($q) {
                $q->whereDate("due_date", Carbon::today())
                  ->orWhereNull("due_date")
                  ->orWhere("status", "in_progress");
            });
        }

        $tasks = $query->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 WHEN status = 'todo' THEN 2 WHEN status = 'review' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 3 ELSE 4 END")
            ->orderBy("created_at", "desc")
            ->get();

        return response()->json([
            "success" => true,
            "data" => $tasks,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            "project_id" => "nullable|exists:projects,id",
            "issue_key" => "nullable|string|max:20",
            "issue_type" => "nullable|in:epic,story,task,bug",
            "title" => "required|string|max:255",
            "description" => "nullable|string",
            "status" => "nullable|in:todo,in_progress,review,done",
            "priority" => "nullable|in:urgent,high,medium,low",
            "category" => "nullable|string",
            "story_points" => "nullable|integer|min:0|max:100",
            "sprint_id" => "nullable|exists:sprints,id",
            "epic_id" => "nullable|exists:tasks,id",
            "estimated_pomodoros" => "nullable|integer|min:1|max:20",
            "start_date" => "nullable|date",
            "due_date" => "nullable|date",
            "notes" => "nullable|string",
            "acceptance_criteria" => "nullable|string|max:10000",
            "definition_of_done" => "nullable|string|max:10000",
            "risk_level" => "nullable|in:low,medium,high,critical",
        ]);

        if (empty($validated["due_date"])) {
            $validated["due_date"] = Carbon::today()->toDateString();
        }

        $task = Task::create($validated);
        $task->load(['project', 'sprint', 'epic', 'documents']);
        $this->track('task_created', 'task', $task->id);

        return response()->json([
            "success" => true,
            "message" => "Task created successfully",
            "data" => $task,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $task = Task::findOrFail($id);

        $validated = $request->validate([
            "project_id" => "nullable|exists:projects,id",
            "issue_key" => "nullable|string|max:20",
            "issue_type" => "nullable|in:epic,story,task,bug",
            "title" => "sometimes|string|max:255",
            "description" => "nullable|string",
            "status" => "sometimes|in:todo,in_progress,review,done",
            "priority" => "sometimes|in:urgent,high,medium,low",
            "category" => "sometimes|string",
            "story_points" => "nullable|integer|min:0|max:100",
            "sprint_id" => "nullable",
            "epic_id" => "nullable",
            "estimated_pomodoros" => "sometimes|integer|min:1|max:20",
            "completed_pomodoros" => "sometimes|integer|min:0",
            "start_date" => "nullable|date",
            "due_date" => "nullable|date",
            "notes" => "nullable|string",
            "acceptance_criteria" => "nullable|string|max:10000",
            "definition_of_done" => "nullable|string|max:10000",
            "risk_level" => "sometimes|in:low,medium,high,critical",
        ]);

        if (isset($validated["status"]) && $validated["status"] === "done" && $task->status !== "done") {
            $validated["completed_at"] = Carbon::now();
        } elseif (isset($validated["status"]) && $validated["status"] !== "done") {
            $validated["completed_at"] = null;
        }

        $task->update($validated);
        $task->load(['project', 'sprint', 'epic', 'documents']);
        if (($validated['status'] ?? null) === 'done') {
            $this->track('task_completed', 'task', $task->id);
        }

        return response()->json([
            "success" => true,
            "message" => "Task updated successfully",
            "data" => $task,
        ]);
    }

    public function destroy($id)
    {
        $task = Task::findOrFail($id);
        $task->delete();

        return response()->json([
            "success" => true,
            "message" => "Task deleted successfully",
        ]);
    }

    // Daily Quest Dispatch for Mascot
    public function dailyDispatch()
    {
        $todayTasks = Task::with('project')
            ->where(function ($q) {
                $q->whereDate("due_date", Carbon::today())
                  ->orWhereNull("due_date")
                  ->orWhere("status", "in_progress");
            })
            ->where("status", "!=", "done")
            ->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 ELSE 2 END")
            ->orderByRaw("CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 3 ELSE 4 END")
            ->take(3)
            ->get();

        $completedToday = Task::where("status", "done")
            ->whereDate("completed_at", Carbon::today())
            ->count();

        return response()->json([
            "success" => true,
            "dispatch_date" => Carbon::today()->toDateString(),
            "active_tasks" => $todayTasks,
            "completed_today_count" => $completedToday,
            "overdue_count" => Task::where('status', '!=', 'done')->whereDate('due_date', '<', Carbon::today())->count(),
            "focus_limit" => 3,
            "greeting" => "Chào buổi sáng! Hãy cùng Ma Cà Tưng chinh phục các nhiệm vụ trọng tâm hôm nay 🚀",
        ]);
    }

    // Daily Retrospective / Review for Mascot
    public function dailyReview()
    {
        $today = Carbon::today();

        $completedTasks = Task::with('project')
            ->where("status", "done")
            ->whereDate("completed_at", $today)
            ->get();

        $incompletedTasks = Task::with('project')
            ->where("status", "!=", "done")
            ->where(function ($q) use ($today) {
                $q->whereDate("due_date", $today)
                  ->orWhere("status", "in_progress");
            })
            ->get();

        $totalPomodorosDone = Task::whereDate("updated_at", $today)->sum("completed_pomodoros");

        return response()->json([
            "success" => true,
            "review_date" => $today->toDateString(),
            "completed_count" => $completedTasks->count(),
            "incompleted_count" => $incompletedTasks->count(),
            "total_pomodoros_done" => $totalPomodorosDone,
            "completed_tasks" => $completedTasks,
            "incompleted_tasks" => $incompletedTasks,
            "wisdom_quote" => "Chiến thắng vĩ đại nhất của bậc trượng phu là tự thắng sự lười biếng và giữ tâm bất động trước nghịch cảnh.",
        ]);
    }

    public function nextAction()
    {
        $task = Task::with('project')
            ->where('status', '!=', 'done')
            ->orderByRaw("CASE WHEN status = 'in_progress' THEN 1 WHEN priority = 'urgent' THEN 2 WHEN priority = 'high' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE WHEN due_date IS NULL THEN 1 ELSE 0 END")
            ->orderBy('due_date')
            ->orderBy('estimated_pomodoros')
            ->first();

        return response()->json(['success' => true, 'data' => $task]);
    }

    /**
     * AI / Smart Project Breakdown Preview
     */
    public function aiPreview(Request $request, \App\Services\SmartProjectBreakdownService $service)
    {
        $validated = $request->validate([
            'prompt' => 'required|string|min:5',
            'project_title' => 'nullable|string|max:255',
            'project_key' => 'nullable|string|max:10',
            'project_type' => 'nullable|in:work,personal',
            'project_color' => 'nullable|string',
            'sprint_count' => 'nullable|integer|min:1|max:5',
            'sprint_duration_weeks' => 'nullable|integer|min:1|max:4',
            'start_date' => 'nullable|date',
        ]);

        $plan = $service->generatePlanWithProvider($validated['prompt'], $validated);
        $this->track('ai_plan_previewed', null, null, ['provider' => $service->planningSettings()['provider']]);

        return response()->json($plan);
    }

    /**
     * AI / Smart Project Breakdown Commit / Execute
     */
    public function aiGenerate(Request $request, \App\Services\SmartProjectBreakdownService $service)
    {
        $validated = $request->validate([
            'prompt' => 'nullable|string',
            'project_id' => 'nullable',
            'plan' => 'required|array',
            'plan.project' => 'required|array',
            'plan.sprints' => 'required|array',
        ]);

        $result = $service->executePlan($validated['plan'], [
            'project_id' => $validated['project_id'] ?? null,
        ]);
        $this->track('ai_plan_committed', 'project', $result['project_id'] ?? null, ['task_count' => count($result['task_ids'] ?? [])]);

        return response()->json($result, 201);
    }

    public function getAiSettings(\App\Services\SmartProjectBreakdownService $service)
    {
        $settings = $service->planningSettings();
        unset($settings['api_key']);
        $settings['has_api_key'] = !empty($service->planningSettings()['api_key']);

        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function saveAiSettings(Request $request)
    {
        $validated = $request->validate([
            'provider' => 'required|in:template,openai_compatible',
            'base_url' => 'required|url|max:255',
            'model' => 'required|string|max:128',
            'temperature' => 'nullable|numeric|min:0|max:2',
            'api_key' => 'nullable|string|max:500',
            'clear_api_key' => 'nullable|boolean',
        ]);

        SiteSetting::set('tasks_ai_provider', $validated['provider']);
        SiteSetting::set('tasks_ai_base_url', rtrim($validated['base_url'], '/'));
        SiteSetting::set('tasks_ai_model', $validated['model']);
        SiteSetting::set('tasks_ai_temperature', (string) ($validated['temperature'] ?? 0.2));

        if (($validated['clear_api_key'] ?? false) === true) {
            SiteSetting::set('tasks_ai_api_key', null);
        } elseif (!empty($validated['api_key'])) {
            SiteSetting::set('tasks_ai_api_key', Crypt::encryptString($validated['api_key']));
        }

        return response()->json(['success' => true, 'message' => 'AI settings saved securely.']);
    }

    /**
     * Get Weekly Report Settings
     */
    public function getReportSettings(\App\Services\WeeklyTaskReportService $reportService)
    {
        $settings = $reportService->getSettings();
        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Save Weekly Report Settings
     */
    public function saveReportSettings(Request $request, \App\Services\WeeklyTaskReportService $reportService)
    {
        $validated = $request->validate([
            'is_enabled' => 'nullable|boolean',
            'recipients' => 'nullable|string',
            'day_of_week' => 'nullable|string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'send_time' => 'nullable|string',
            'report_title' => 'nullable|string|max:255',
            'selected_project_ids' => 'nullable',
            'project_filter' => 'nullable',
            'include_upcoming' => 'nullable|boolean',
            'include_warnings' => 'nullable|boolean',
        ]);

        $settings = $reportService->saveSettings($validated);

        return response()->json([
            'success' => true,
            'message' => 'Settings successfully saved',
            'data' => $settings,
        ]);
    }

    /**
     * Trigger sending weekly report immediately
     */
    public function sendReportNow(Request $request, \App\Services\WeeklyTaskReportService $reportService)
    {
        $validated = $request->validate([
            'email' => 'nullable|string',
            'project_ids' => 'nullable',
            'project_id' => 'nullable',
        ]);

        $projectIds = $validated['project_ids'] ?? $validated['project_id'] ?? null;
        $result = $reportService->sendReport($validated['email'] ?? null, $projectIds);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    private function track(string $eventType, ?string $entityType = null, ?int $entityId = null, array $metadata = []): void
    {
        TaskUsageEvent::create([
            'event_type' => $eventType,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata' => $metadata,
            'occurred_at' => now(),
        ]);
    }
}
