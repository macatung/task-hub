<?php

namespace App\Services;

use App\Mail\WeeklyTaskReportMail;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\Sprint;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

class WeeklyTaskReportService
{
    /**
     * Get report configuration settings.
     */
    public function getSettings(): array
    {
        $raw = SiteSetting::get('task_report_settings');
        if (!empty($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return array_merge($this->defaultSettings(), $decoded);
            }
        }

        return $this->defaultSettings();
    }

    /**
     * Default report settings.
     */
    public function defaultSettings(): array
    {
        return [
            'is_enabled' => false,
            'recipients' => '', // comma-separated emails
            'day_of_week' => 'monday', // monday, friday, sunday, etc.
            'send_time' => '08:00', // HH:mm
            'report_title' => 'Weekly Executive Progress & Sprint Report',
            'selected_project_ids' => ['all'], // array of project IDs or ['all']
            'include_upcoming' => true,
            'include_warnings' => true,
            'last_sent_at' => null,
        ];
    }

    /**
     * Save report settings.
     */
    public function saveSettings(array $data): array
    {
        $settings = array_merge($this->getSettings(), $data);
        SiteSetting::set('task_report_settings', json_encode($settings), 'Cấu hình gửi email báo cáo tuần cho sếp & quản lý');
        return $settings;
    }

    /**
     * Aggregate report data for the past 7 days across selected projects.
     *
     * @param array|int|string|null $projectIds
     */
    public function generateReportData(mixed $projectIds = null): array
    {
        $now = Carbon::now();
        $startDate = $now->copy()->subDays(7)->startOfDay();
        $endDate = $now->copy()->endOfDay();

        // 1. Normalize Project IDs array
        $targetProjectIds = [];
        $isAllProjects = true;

        if ($projectIds !== null) {
            if (is_array($projectIds)) {
                $targetProjectIds = $projectIds;
            } elseif (is_numeric($projectIds)) {
                $targetProjectIds = [(int) $projectIds];
            } elseif (is_string($projectIds) && $projectIds !== 'all') {
                $targetProjectIds = array_filter(array_map('trim', explode(',', $projectIds)));
            }
        } else {
            $settings = $this->getSettings();
            $targetProjectIds = $settings['selected_project_ids'] ?? ['all'];
        }

        if (is_array($targetProjectIds)) {
            $isAllProjects = in_array('all', $targetProjectIds) || empty($targetProjectIds);
        }

        $numericProjectIds = array_values(array_filter(array_map('intval', (array) $targetProjectIds), fn ($id) => $id > 0));

        // Get project names for header display
        $selectedProjectsLabel = 'All Projects';
        if (!$isAllProjects && !empty($numericProjectIds)) {
            $projectNames = Project::whereIn('id', $numericProjectIds)->pluck('title')->toArray();
            if (!empty($projectNames)) {
                $selectedProjectsLabel = implode(', ', $projectNames);
            }
        }

        // 2. Base Task Query
        $baseQuery = Task::with(['project', 'sprint', 'epic']);
        if (!$isAllProjects && !empty($numericProjectIds)) {
            $baseQuery->whereIn('project_id', $numericProjectIds);
        }

        // 3. Completed Tasks in Last 7 Days
        $completedTasks = (clone $baseQuery)
            ->where('status', 'done')
            ->where(function ($q) use ($startDate) {
                $q->where('completed_at', '>=', $startDate)
                  ->orWhere(function ($sub) use ($startDate) {
                      $sub->whereNull('completed_at')
                          ->where('updated_at', '>=', $startDate);
                  });
            })
            ->orderBy('completed_at', 'desc')
            ->get();

        $completedStoryPoints = $completedTasks->sum('story_points');

        // 4. Active Sprint Status
        $activeSprint = Sprint::with(['tasks' => function ($q) use ($isAllProjects, $numericProjectIds) {
            $q->with('project');
            if (!$isAllProjects && !empty($numericProjectIds)) {
                $q->whereIn('project_id', $numericProjectIds);
            }
        }])->where('status', 'active')->first();

        $sprintMetrics = null;
        if ($activeSprint) {
            $totalSprintTasks = $activeSprint->tasks->count();
            $doneSprintTasks = $activeSprint->tasks->where('status', 'done')->count();
            $sprintPoints = $activeSprint->tasks->sum('story_points');
            $sprintDonePoints = $activeSprint->tasks->where('status', 'done')->sum('story_points');

            $sprintMetrics = [
                'name' => $activeSprint->name,
                'goal' => $activeSprint->goal,
                'start_date' => $activeSprint->start_date ? Carbon::parse($activeSprint->start_date)->format('d M Y') : null,
                'end_date' => $activeSprint->end_date ? Carbon::parse($activeSprint->end_date)->format('d M Y') : null,
                'total_tasks' => $totalSprintTasks,
                'done_tasks' => $doneSprintTasks,
                'progress_percent' => $totalSprintTasks > 0 ? round(($doneSprintTasks / $totalSprintTasks) * 100) : 0,
                'total_points' => $sprintPoints,
                'done_points' => $sprintDonePoints,
            ];
        }

        // 5. Upcoming Focus Tasks (In Progress, Review or High/Urgent Todo)
        $upcomingTasks = (clone $baseQuery)
            ->where(function ($q) {
                $q->whereIn('status', ['in_progress', 'review'])
                  ->orWhere(function ($sub) {
                      $sub->where('status', 'todo')
                          ->whereIn('priority', ['urgent', 'high']);
                  });
            })
            ->orderByRaw("CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 ELSE 3 END")
            ->orderBy('due_date', 'asc')
            ->take(10)
            ->get();

        // 6. Overdue and At-Risk Tasks
        $warningTasks = (clone $baseQuery)
            ->where('status', '!=', 'done')
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $now->copy()->addDays(2)->toDateString())
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(function ($task) use ($now) {
                $dueDate = Carbon::parse($task->due_date)->endOfDay();
                $isOverdue = $dueDate->isPast() && !$dueDate->isToday();
                $diffDays = (int) round($now->diffInDays($dueDate, false));

                return [
                    'id' => $task->id,
                    'issue_key' => $task->issue_key,
                    'title' => $task->title,
                    'priority' => $task->priority,
                    'due_date' => Carbon::parse($task->due_date)->format('d M Y'),
                    'project' => $task->project?->title ?? 'General',
                    'is_overdue' => $isOverdue,
                    'days_overdue' => $isOverdue ? (int) max(1, abs($diffDays)) : 0,
                    'days_remaining' => !$isOverdue ? (int) max(0, $diffDays) : 0,
                    'status' => $task->status,
                ];
            });

        // 7. Overall Stats
        $selectedProjectsCount = $isAllProjects ? Project::count() : count($numericProjectIds);
        $totalActiveTasks = (clone $baseQuery)->where('status', '!=', 'done')->count();

        return [
            'report_period' => [
                'start_date' => $startDate->format('d M Y'),
                'end_date' => $endDate->format('d M Y'),
                'generated_at' => $now->format('d M Y, H:i'),
                'week_number' => $now->weekOfYear,
                'year' => $now->year,
            ],
            'scope' => [
                'is_all_projects' => $isAllProjects,
                'selected_projects_label' => $selectedProjectsLabel,
                'projects_count' => $selectedProjectsCount,
            ],
            'kpis' => [
                'completed_tasks_count' => $completedTasks->count(),
                'completed_story_points' => $completedStoryPoints,
                'sprint_progress_percent' => $sprintMetrics ? $sprintMetrics['progress_percent'] : 0,
                'warning_tasks_count' => $warningTasks->count(),
                'total_active_tasks' => $totalActiveTasks,
            ],
            'sprint_metrics' => $sprintMetrics,
            'completed_tasks' => $completedTasks,
            'upcoming_tasks' => $upcomingTasks,
            'warning_tasks' => $warningTasks,
        ];
    }

    /**
     * Send Weekly Report email to recipients.
     */
    public function sendReport(?string $customEmail = null, mixed $projectIds = null): array
    {
        $settings = $this->getSettings();
        $recipientsStr = $customEmail ?: ($settings['recipients'] ?? '');
        
        $recipients = array_filter(array_map('trim', explode(',', $recipientsStr)));
        if (empty($recipients)) {
            return [
                'success' => false,
                'message' => 'No recipient email addresses found. Please configure the recipient list.',
            ];
        }

        $targetProjectIds = $projectIds !== null ? $projectIds : ($settings['selected_project_ids'] ?? ['all']);
        $reportData = $this->generateReportData($targetProjectIds);
        $mailable = new WeeklyTaskReportMail($reportData, $settings['report_title'] ?? 'Weekly Executive Progress & Sprint Report');

        Mail::to($recipients)->send($mailable);

        // Update last_sent_at
        $this->saveSettings(['last_sent_at' => Carbon::now()->format('d M Y, H:i')]);

        return [
            'success' => true,
            'message' => 'Weekly Executive Report successfully sent to: ' . implode(', ', $recipients),
            'recipients' => $recipients,
            'sent_at' => Carbon::now()->format('d M Y, H:i'),
            'scope' => $reportData['scope']['selected_projects_label'],
            'kpis' => $reportData['kpis'],
        ];
    }
}
