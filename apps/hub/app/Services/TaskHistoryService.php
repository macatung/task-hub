<?php
namespace App\Services;

use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\Task;
use App\Models\TaskUsageEvent;
use App\Models\VerificationEvidence;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class TaskHistoryService
{
    /**
     * Build the full End-to-End transition and audit history for a task.
     *
     * @param Task $task
     * @return array
     */
    public function getTaskHistory(Task $task): array
    {
        $task->loadMissing([
            'project.workspace.owner',
            'sprint',
            'epic',
            'agentRuns.runner',
            'agentRuns.events',
            'agentRuns.evidence',
            'dependencies.dependsOn',
        ]);

        $events = collect();

        // 1. Task Usage Events (direct status transitions, creations, rejections, manual updates)
        $usageEvents = TaskUsageEvent::where('entity_type', 'task')
            ->where('entity_id', $task->id)
            ->get();

        $hasCreatedEvent = false;
        foreach ($usageEvents as $event) {
            if ($event->event_type === 'task_created') {
                $hasCreatedEvent = true;
            }
            $events->push($this->formatUsageEvent($event, $task));
        }

        // Synthesize task creation if not present in usage events
        if (!$hasCreatedEvent) {
            $events->push([
                'id' => 'evt-init-' . $task->id,
                'event_type' => 'task_created',
                'title' => 'Tạo mới nhiệm vụ (Task Created)',
                'description' => "Nhiệm vụ #{$task->issue_key} được khởi tạo với trạng thái ban đầu.",
                'from_status' => null,
                'to_status' => 'todo',
                'tone' => 'muted',
                'actor' => [
                    'type' => 'user',
                    'name' => $task->project?->workspace?->owner?->name ?? 'Người khởi tạo dự án',
                    'email' => $task->project?->workspace?->owner?->email ?? null,
                    'role' => 'Creator',
                    'details' => 'Project: ' . ($task->project?->title ?? 'Default'),
                    'avatar_icon' => 'user-plus',
                ],
                'evidence' => [],
                'metadata' => [
                    'initial_status' => 'todo',
                    'priority' => $task->priority,
                    'story_points' => $task->story_points,
                    'issue_type' => $task->issue_type,
                ],
                'occurred_at' => ($task->created_at ?: now())->toIso8601String(),
            ]);
        }

        // 2. Agent Runs & Child Events (Dispatches, Claims, Handoffs, Approvals, Test Verifications)
        foreach ($task->agentRuns as $run) {
            $events = $events->merge($this->formatAgentRunHistory($run, $task));
        }

        // 3. Sort all timeline events in chronological order (newest first for audit trail view)
        $sortedTimeline = $events
            ->filter(fn ($e) => !empty($e['occurred_at']))
            ->sortByDesc(fn ($e) => Carbon::parse($e['occurred_at'])->getTimestampMs())
            ->values();

        // 4. Compute High-Level Summary & Metrics
        $uniqueActors = $sortedTimeline
            ->pluck('actor.name')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $transitions = $sortedTimeline
            ->filter(fn ($e) => !empty($e['to_status']) && !empty($e['from_status']) && $e['to_status'] !== $e['from_status'])
            ->count();

        $latestRun = $task->agentRuns->sortByDesc('created_at')->first();
        $currentHandler = null;
        if ($task->status === 'in_progress' && $latestRun && in_array($latestRun->status, ['claimed', 'preparing', 'running'])) {
            $runnerName = $latestRun->runner?->name ?: ($latestRun->runner?->hostname ?: 'Local Runner');
            $modelName = data_get($latestRun->metadata, 'model', $latestRun->provider);
            $currentHandler = "AI Agent: {$runnerName} ({$modelName})";
        } elseif ($task->status === 'review') {
            $currentHandler = 'Chờ người dùng review & phê duyệt (Awaiting Human Review)';
        } elseif ($task->status === 'done') {
            $currentHandler = 'Đã hoàn thành & xác minh (Completed & Verified)';
        } else {
            $currentHandler = 'Sẵn sàng tiếp nhận (Ready in Backlog / To Do)';
        }

        return [
            'success' => true,
            'task' => [
                'id' => $task->id,
                'issue_key' => $task->issue_key ?: 'TASK-' . $task->id,
                'title' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
                'story_points' => $task->story_points,
                'created_at' => $task->created_at?->toIso8601String(),
                'completed_at' => $task->completed_at?->toIso8601String(),
            ],
            'summary' => [
                'total_events' => $sortedTimeline->count(),
                'total_transitions' => $transitions,
                'current_handler' => $currentHandler,
                'actors_involved' => $uniqueActors,
                'agent_runs_count' => $task->agentRuns->count(),
                'verification_count' => $task->agentRuns->flatMap->evidence->count(),
            ],
            'timeline' => $sortedTimeline->all(),
        ];
    }

    private function formatUsageEvent(TaskUsageEvent $event, Task $task): array
    {
        $meta = $event->metadata ?: [];
        $actorMeta = $meta['actor'] ?? [];

        $actor = [
            'type' => $actorMeta['type'] ?? 'user',
            'name' => $actorMeta['name'] ?? ($actorMeta['email'] ?? 'Thành viên nhóm'),
            'email' => $actorMeta['email'] ?? null,
            'role' => $actorMeta['role'] ?? ($actorMeta['type'] === 'user' ? 'Developer' : 'System'),
            'details' => $actorMeta['details'] ?? ($actorMeta['ip_address'] ?? null),
            'avatar_icon' => $this->actorIcon($actorMeta['type'] ?? 'user'),
        ];

        $fromStatus = $meta['from_status'] ?? null;
        $toStatus = $meta['to_status'] ?? null;
        $tone = 'ok';
        $title = 'Cập nhật nhiệm vụ';
        $description = '';

        switch ($event->event_type) {
            case 'task_created':
                $title = 'Khởi tạo nhiệm vụ (Task Created)';
                $toStatus = $meta['initial_status'] ?? 'todo';
                $tone = 'muted';
                $description = "Nhiệm vụ được tạo mới với độ ưu tiên '{$task->priority}' và {$task->story_points} story points.";
                break;

            case 'status_transition':
                $fromLabel = strtoupper($fromStatus ?: 'UNKNOWN');
                $toLabel = strtoupper($toStatus ?: 'UNKNOWN');
                $title = "Chuyển trạng thái: {$fromLabel} ➔ {$toLabel}";
                $tone = $toStatus === 'done' ? 'ok' : ($toStatus === 'review' ? 'active' : 'tool');
                $description = !empty($meta['reason']) ? "Lý do: {$meta['reason']}" : "Trạng thái được cập nhật bởi {$actor['name']}.";
                break;

            case 'task_completed':
                $title = 'Hoàn thành nhiệm vụ (Task Completed)';
                $fromStatus = 'in_progress';
                $toStatus = 'done';
                $tone = 'ok';
                $description = 'Nhiệm vụ đã được đánh dấu hoàn tất.';
                break;

            case 'task_dispatched':
                $targetRunner = $meta['target_runner'] ?? [];
                $runnerName = $targetRunner['name'] ?? ($targetRunner['hostname'] ?? 'Desktop Runner');
                $model = $meta['model'] ?? 'AI';
                $title = "Điều phối thực thi: {$runnerName}";
                $fromStatus = 'todo';
                $toStatus = 'in_progress';
                $tone = 'active';
                $description = "Nhiệm vụ được điều phối tới {$runnerName} với mô hình {$model} (Chế độ: " . ($meta['mode'] ?? 'auto_pilot') . ').';
                break;

            case 'task_approved':
                $title = 'Phê duyệt & Nghiệm thu (Human Approved)';
                $fromStatus = 'review';
                $toStatus = 'done';
                $tone = 'ok';
                $description = "Người dùng {$actor['name']} đã phê duyệt kết quả thực thi và xác nhận hoàn thành.";
                break;

            case 'task_rejected':
                $title = 'Yêu cầu chỉnh sửa lại (Human Rejected / Changes Requested)';
                $fromStatus = 'review';
                $toStatus = 'in_progress';
                $tone = 'error';
                $description = "Người dùng {$actor['name']} yêu cầu làm lại. Phản hồi: \"" . ($meta['reason'] ?? 'Cần bổ sung') . '"';
                break;

            case 'handoff_submitted':
                $title = 'Bàn giao kết quả & Bằng chứng kiểm thử (Handoff Submitted)';
                $fromStatus = 'in_progress';
                $toStatus = 'review';
                $tone = 'active';
                $testCount = is_array($meta['tests'] ?? null) ? count($meta['tests']) : 0;
                $fileCount = is_array($meta['changed_files'] ?? null) ? count($meta['changed_files']) : 0;
                $description = "Agent nộp báo cáo bàn giao: {$fileCount} tệp thay đổi, {$testCount} bài kiểm thử đã chạy. Tóm tắt: " . ($meta['summary'] ?? '');
                break;

            default:
                $title = 'Sự kiện: ' . str_replace('_', ' ', $event->event_type);
                $description = json_encode($meta, JSON_UNESCAPED_UNICODE);
                break;
        }

        return [
            'id' => 'evt-usage-' . $event->id,
            'event_type' => $event->event_type,
            'title' => $title,
            'description' => $description,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'tone' => $tone,
            'actor' => $actor,
            'evidence' => [],
            'metadata' => $meta,
            'occurred_at' => $event->occurred_at->toIso8601String(),
        ];
    }

    private function formatAgentRunHistory(AgentRun $run, Task $task): Collection
    {
        $events = collect();
        $runner = $run->runner;
        $runnerName = $runner?->name ?: ($runner?->hostname ?: ($runner?->machine_name ?: 'Local Runner'));
        $model = data_get($run->metadata, 'model', $run->provider);

        $agentActor = [
            'type' => 'agent_runner',
            'name' => "{$runnerName} ({$model})",
            'email' => null,
            'role' => 'Autonomous Agent (' . strtoupper($run->provider) . ')',
            'details' => $runner ? "Platform: {$runner->os_platform} | Host: {$runner->hostname}" : "Provider: {$run->provider}",
            'avatar_icon' => 'cpu',
        ];

        // 1. Run Dispatch Event
        if ($run->queued_at) {
            $events->push([
                'id' => 'run-dispatch-' . $run->id,
                'event_type' => 'task_dispatched',
                'title' => "Điều phối Run #{$run->id} tới {$runnerName}",
                'description' => "Đã tạo phiên thực thi Run #{$run->id} với provider [{$run->provider}] và model [{$model}].",
                'from_status' => 'todo',
                'to_status' => 'queued',
                'tone' => 'active',
                'actor' => [
                    'type' => 'user',
                    'name' => 'Developer / Dispatcher',
                    'role' => 'Dispatcher',
                    'details' => "Session ID: {$run->agent_session_id}",
                    'avatar_icon' => 'send',
                ],
                'evidence' => [],
                'metadata' => [
                    'run_id' => $run->id,
                    'provider' => $run->provider,
                    'model' => $model,
                    'execution_mode' => $run->execution_mode,
                ],
                'occurred_at' => $run->queued_at->toIso8601String(),
            ]);
        }

        // 2. Run Claimed Event
        if ($run->claimed_at) {
            $events->push([
                'id' => 'run-claim-' . $run->id,
                'event_type' => 'run_claimed',
                'title' => "Runner {$runnerName} đã nhận Lease",
                'description' => "Runner {$runnerName} nhận quyền thực thi task và duy trì qua heartbeat.",
                'from_status' => 'queued',
                'to_status' => 'claimed',
                'tone' => 'active',
                'actor' => $agentActor,
                'evidence' => [],
                'metadata' => [
                    'run_id' => $run->id,
                    'lease_expires_at' => $run->lease_expires_at?->toIso8601String(),
                ],
                'occurred_at' => $run->claimed_at->toIso8601String(),
            ]);
        }

        // 3. Run Events (preparing, running, custom steps)
        foreach ($run->events as $rev) {
            if (in_array($rev->event_type, ['task_dispatched', 'run_claimed', 'handoff_completed', 'human_approved', 'human_rejected'])) {
                continue; // Handled specially
            }
            $events->push([
                'id' => 'run-event-' . $rev->id,
                'event_type' => $rev->event_type,
                'title' => 'Agent Progress: ' . str_replace('_', ' ', $rev->event_type),
                'description' => json_encode($rev->payload, JSON_UNESCAPED_UNICODE),
                'from_status' => null,
                'to_status' => $rev->status,
                'tone' => $rev->status === 'failed' ? 'error' : 'tool',
                'actor' => $agentActor,
                'evidence' => [],
                'metadata' => $rev->payload ?: [],
                'occurred_at' => $rev->occurred_at->toIso8601String(),
            ]);
        }

        // 4. Verification Evidence (automated tests, PR, commit proofs)
        foreach ($run->evidence as $evi) {
            $isPassed = $evi->status === 'passed';
            $events->push([
                'id' => 'run-evidence-' . $evi->id,
                'event_type' => 'evidence_verified',
                'title' => "Bằng chứng kiểm thử [{$evi->evidence_type}]: " . ($isPassed ? 'PASSED ✅' : 'FAILED ❌'),
                'description' => $evi->summary ?: ($evi->command ? "Lệnh chạy: `{$evi->command}`" : 'Kiểm thử hoàn tất.'),
                'from_status' => null,
                'to_status' => null,
                'tone' => $isPassed ? 'ok' : 'error',
                'actor' => [
                    'type' => 'agent_runner',
                    'name' => "Test Runner ({$run->provider})",
                    'role' => 'Automated QA Engine',
                    'details' => $evi->command ? "Command: {$evi->command}" : null,
                    'avatar_icon' => $isPassed ? 'check-circle' : 'alert-circle',
                ],
                'evidence' => [
                    [
                        'id' => $evi->id,
                        'type' => $evi->evidence_type,
                        'status' => $evi->status,
                        'command' => $evi->command,
                        'summary' => $evi->summary,
                        'commit_sha' => $evi->commit_sha,
                        'artifact_url' => $evi->artifact_url,
                    ],
                ],
                'metadata' => $evi->metadata ?: [],
                'occurred_at' => $evi->created_at->toIso8601String(),
            ]);
        }

        // 5. Final Handoff or Failure
        if ($run->status === 'needs_review' || data_get($run->metadata, 'handoff')) {
            $handoff = data_get($run->metadata, 'handoff', []);
            $events->push([
                'id' => 'run-handoff-' . $run->id,
                'event_type' => 'handoff_submitted',
                'title' => "Bàn giao kết quả từ Agent Run #{$run->id}",
                'description' => $run->summary ?: 'Agent hoàn thành công việc và gửi bàn giao kèm bằng chứng.',
                'from_status' => 'in_progress',
                'to_status' => 'review',
                'tone' => 'active',
                'actor' => $agentActor,
                'evidence' => [],
                'metadata' => [
                    'changed_files' => $handoff['changed_files'] ?? [],
                    'blockers' => $handoff['blockers'] ?? null,
                    'commit_sha' => $run->commit_sha,
                    'pull_request_url' => $run->pull_request_url,
                ],
                'occurred_at' => ($run->finished_at ?: ($run->updated_at ?: now()))->toIso8601String(),
            ]);
        } elseif ($run->status === 'failed') {
            $events->push([
                'id' => 'run-failed-' . $run->id,
                'event_type' => 'agent_failed',
                'title' => "Phiên Agent Run #{$run->id} thất bại",
                'description' => $run->failure_reason ?: ($run->summary ?: 'Quá trình thực thi gặp lỗi không thể tiếp tục.'),
                'from_status' => 'in_progress',
                'to_status' => 'failed',
                'tone' => 'error',
                'actor' => $agentActor,
                'evidence' => [],
                'metadata' => [
                    'exit_code' => $run->exit_code,
                    'failure_reason' => $run->failure_reason,
                ],
                'occurred_at' => ($run->finished_at ?: now())->toIso8601String(),
            ]);
        }

        return $events;
    }

    private function actorIcon(string $type): string
    {
        return match ($type) {
            'agent_runner', 'agent_model' => 'cpu',
            'github_ci', 'github' => 'github',
            'system' => 'settings',
            default => 'user',
        };
    }
}
