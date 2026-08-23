<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\AgentRunLog;
use App\Models\GithubEvent;
use App\Models\Task;
use App\Models\Project;
use App\Models\VerificationEvidence;
use App\Services\TaskHubContextPackService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\WorkspaceContext;

class ApiAgentRunController extends Controller
{
    private const PROVIDERS = ['antigravity', 'codex', 'claude_code'];
    private const STATUSES = ['queued', 'claimed', 'preparing', 'running', 'waiting_input', 'needs_review', 'verified', 'failed', 'cancelled'];

    public function index(Request $request)
    {
        $query = AgentRun::with(['task.project', 'evidence'])->latest();
        if ($request->user()) $query->where('workspace_id', app(WorkspaceContext::class)->resolve($request)->id);
        if ($request->filled('task_id')) $query->where('task_id', $request->integer('task_id'));
        if ($request->filled('status')) $query->where('status', $request->string('status'));
        return response()->json(['success' => true, 'data' => $query->limit(50)->get()]);
    }

    public function show(AgentRun $agentRun)
    {
        if (request()->user()) abort_unless((int) $agentRun->workspace_id === (int) app(WorkspaceContext::class)->resolve(request())->id, 404);
        return response()->json(['success' => true, 'data' => $agentRun->load(['task.project', 'evidence', 'events'])]);
    }

    /**
     * Lightweight SSE feed for the web UI. Runner delivery remains HTTP polling;
     * this only projects the persisted event/log timeline to authenticated users.
     */
    public function stream(Request $request)
    {
        $workspace = app(WorkspaceContext::class)->resolve($request);
        $after = max(0, $request->integer('after', 0));
        $afterLog = max(0, $request->integer('after_log', 0));
        $runId = $request->integer('run_id');
        return response()->stream(function () use ($workspace, $after, $runId) {
            $events = AgentRunEvent::query()->where('id', '>', $after)
                ->whereHas('agentRun', fn ($q) => $q->where('workspace_id', $workspace->id))
                ->when($runId, fn ($q) => $q->where('agent_run_id', $runId))
                ->orderBy('id')->limit(100)->get();
            foreach ($events as $event) {
                echo 'id: ' . $event->id . "\n";
                echo "event: agent-run\n";
                echo 'data: ' . json_encode(['id' => $event->id, 'run_id' => $event->agent_run_id, 'type' => $event->event_type, 'status' => $event->status, 'payload' => $event->payload, 'occurred_at' => $event->occurred_at?->toIso8601String()], JSON_UNESCAPED_UNICODE) . "\n\n";
            }
            $logs = AgentRunLog::query()->where('id', '>', $afterLog)
                ->whereHas('agentRun', fn ($q) => $q->where('workspace_id', $workspace->id))
                ->when($runId, fn ($q) => $q->where('agent_run_id', $runId))
                ->orderBy('id')->limit(100)->get();
            foreach ($logs as $log) {
                echo 'id: log-' . $log->id . "\n";
                echo "event: agent-log\n";
                echo 'data: ' . json_encode(['id' => $log->id, 'run_id' => $log->agent_run_id, 'stream' => $log->stream, 'content' => $log->content, 'occurred_at' => $log->occurred_at?->toIso8601String()], JSON_UNESCAPED_UNICODE) . "\n\n";
            }
            echo ": keepalive\n\n";
            if (function_exists('ob_flush')) @ob_flush();
            flush();
        }, 200, ['Content-Type' => 'text/event-stream', 'Cache-Control' => 'no-cache, no-transform', 'X-Accel-Buffering' => 'no']);
    }

    public function store(Request $request, TaskHubContextPackService $contextService)
    {
        $validated = $request->validate([
            'task_id' => 'nullable|exists:tasks,id',
            'provider' => 'required|in:' . implode(',', self::PROVIDERS),
            'model' => 'nullable|string|max:120',
            'agent_session_id' => 'nullable|string|max:191',
            'repository' => 'nullable|string|max:255',
            'branch' => 'nullable|string|max:255',
            'run_type' => 'nullable|string|max:30',
            'instruction' => 'nullable|array',
            'context' => 'nullable|array',
            // Agent execution is local-only in the current product phase.
            'execution_mode' => 'nullable|in:desktop',
        ]);

        $taskId = $request->input('task_id');
        $task = null;
        if (!empty($taskId)) {
            $task = is_numeric($taskId)
                ? Task::with('project.workspace')->find((int) $taskId)
                : Task::with('project.workspace')->where('issue_key', trim((string) $taskId))->first();
            if (!$task) {
                return response()->json([
                    'success' => false,
                    'message' => "Không tìm thấy nhiệm vụ #{$taskId}. Vui lòng làm mới danh sách nhiệm vụ.",
                ], 404);
            }
        }
        if ($task?->hasIncompleteDependencies()) {
            return response()->json([
                'success' => false,
                'message' => 'Task is blocked until all dependency tasks are done.',
                'blocked_by' => $task->dependencies()->with('dependsOn:id,issue_key,title,status')->get(),
            ], 422);
        }
        $workspace = $task?->project?->workspace;
        if ($request->user()) {
            $resolved = app(WorkspaceContext::class)->resolve($request, false);
            if ($resolved) {
                $workspace = $resolved;
            }
        }
        $workspace ??= ($task?->workspace ?? \App\Models\Workspace::first());
        if ($task?->project && $task->project->workspace_id && $workspace && (int) $task->project->workspace_id !== (int) $workspace->id) {
            abort(403, 'Task does not belong to the selected workspace.');
        }
        $context = $validated['context'] ?? $contextService->build($task, $validated);
        $instruction = $validated['instruction'] ?? [];
        $selectedModel = $validated['model'] ?? ($context['model'] ?? ($instruction['model'] ?? null));

        $run = DB::transaction(function () use ($validated, $context, $instruction, $contextService, $task, $workspace, $selectedModel) {
            $run = AgentRun::create([
                'task_id' => $task?->id,
                'workspace_id' => $workspace?->id,
                'provider' => $validated['provider'],
                'agent_session_id' => $validated['agent_session_id'] ?? (string) Str::uuid(),
                'repository' => $validated['repository'] ?? ($context['repository'] ?? (config('services.task_hub.repository') ?: env('TASK_HUB_REPOSITORY'))),
                'branch' => $validated['branch'] ?? ($context['branch'] ?? null),
                'status' => 'queued',
                'execution_mode' => $validated['execution_mode'] ?? 'desktop',
                'queued_at' => now(),
                'run_type' => $validated['run_type'] ?? 'implementation',
                'context_hash' => $context['context_hash'] ?? null,
                'instruction_hash' => $contextService->instructionHash($instruction),
                'metadata' => array_merge(['context' => $context], $selectedModel ? ['model' => $selectedModel] : []),
            ]);
            $this->recordEvent($run, 'run_created', 'queued', array_merge(['context_hash' => $run->context_hash], $selectedModel ? ['model' => $selectedModel] : []));
            return $run;
        });

        return response()->json(['success' => true, 'data' => $run->load('task'), 'context' => $context], 201);
    }

    public function update(Request $request, AgentRun $agentRun)
    {
        $validated = $request->validate([
            'status' => 'sometimes|in:' . implode(',', self::STATUSES),
            'branch' => 'nullable|string|max:255',
            'commit_sha' => 'nullable|string|max:80',
            'pull_request_url' => 'nullable|url|max:500',
            'summary' => 'nullable|string|max:10000',
            'failure_reason' => 'nullable|string|max:10000',
            'metadata' => 'nullable|array',
        ]);
        $this->applyLifecycleFields($validated);
        $agentRun->update($validated);
        $this->recordEvent($agentRun, 'run_updated', $agentRun->status, $validated);
        return response()->json(['success' => true, 'data' => $agentRun->fresh()->load('evidence')]);
    }

    public function event(Request $request, AgentRun $agentRun)
    {
        $validated = $request->validate([
            'event_id' => 'required|uuid',
            'event_type' => 'required|string|max:60',
            'status' => 'nullable|in:' . implode(',', self::STATUSES),
            'payload' => 'nullable|array',
            'occurred_at' => 'nullable|date',
        ]);
        if (AgentRunEvent::where('event_id', $validated['event_id'])->exists()) {
            return response()->json(['success' => true, 'duplicate' => true]);
        }
        DB::transaction(function () use ($agentRun, $validated) {
            if (!empty($validated['status'])) {
                $fields = ['status' => $validated['status']];
                $this->applyLifecycleFields($fields);
                $agentRun->update($fields);
            }
            $this->recordEvent($agentRun, $validated['event_type'], $validated['status'] ?? null, $validated['payload'] ?? [], $validated['event_id'], $validated['occurred_at'] ?? null);
        });
        return response()->json(['success' => true, 'data' => $agentRun->fresh()]);
    }

    public function evidence(Request $request, AgentRun $agentRun)
    {
        $validated = $request->validate([
            'task_id' => 'nullable|exists:tasks,id',
            'evidence_type' => 'required|string|max:40',
            'status' => 'required|in:passed,failed,skipped,pending',
            'command' => 'nullable|string|max:500',
            'summary' => 'nullable|string|max:10000',
            'artifact_url' => 'nullable|url|max:500',
            'commit_sha' => 'nullable|string|max:80',
            'metadata' => 'nullable|array',
            'idempotency_key' => 'nullable|uuid',
        ]);
        $idempotencyKey = $validated['idempotency_key'] ?? $request->header('Idempotency-Key');
        if ($idempotencyKey) {
            $existing = $agentRun->evidence()->where('metadata->idempotency_key', $idempotencyKey)->first();
            if ($existing) return response()->json(['success' => true, 'duplicate' => true, 'data' => $existing]);
        }
        unset($validated['idempotency_key']);
        $validated['task_id'] = $validated['task_id'] ?? $agentRun->task_id;
        $validated['metadata'] = array_merge($validated['metadata'] ?? [], $idempotencyKey ? ['idempotency_key' => $idempotencyKey] : []);
        $evidence = $agentRun->evidence()->create($validated);
        $this->recordEvent($agentRun, 'evidence_attached', $agentRun->status, ['evidence_id' => $evidence->id, 'type' => $evidence->evidence_type]);
        return response()->json(['success' => true, 'data' => $evidence], 201);
    }

    public function handoff(Request $request, AgentRun $agentRun)
    {
        $validated = $request->validate([
            'summary' => 'required|string|max:10000',
            'changed_files' => 'required|array|min:1',
            'changed_files.*' => 'string|max:500',
            'tests' => 'required|array|min:1',
            'tests.*.command' => 'required|string|max:500',
            'tests.*.status' => 'required|in:passed,failed,skipped',
            'tests.*.summary' => 'nullable|string|max:10000',
            'commit_sha' => 'nullable|string|max:80',
            'pull_request_url' => 'nullable|url|max:500',
            'blockers' => 'nullable|string|max:10000',
            'idempotency_key' => 'nullable|uuid',
        ]);
        $idempotencyKey = $validated['idempotency_key'] ?? $request->header('Idempotency-Key');
        if ($idempotencyKey && data_get($agentRun->metadata, 'handoff.idempotency_key') === $idempotencyKey) {
            return response()->json(['success' => true, 'duplicate' => true, 'data' => $agentRun->fresh()->load(['evidence', 'events'])]);
        }
        unset($validated['idempotency_key']);

        $run = DB::transaction(function () use ($agentRun, $validated, $idempotencyKey) {
            $metadata = array_merge($agentRun->metadata ?: [], [
                'handoff' => [
                    'changed_files' => array_values($validated['changed_files']),
                    'blockers' => $validated['blockers'] ?? null,
                    'idempotency_key' => $idempotencyKey,
                    'submitted_at' => now()->toIso8601String(),
                ],
            ]);
            $agentRun->update([
                'status' => 'needs_review', 'summary' => $validated['summary'],
                'commit_sha' => $validated['commit_sha'] ?? $agentRun->commit_sha,
                'pull_request_url' => $validated['pull_request_url'] ?? $agentRun->pull_request_url,
                'metadata' => $metadata,
            ]);
            foreach ($validated['tests'] as $test) {
                $agentRun->evidence()->create([
                    'task_id' => $agentRun->task_id, 'evidence_type' => 'test',
                    'status' => $test['status'], 'command' => $test['command'],
                    'summary' => $test['summary'] ?? null, 'commit_sha' => $validated['commit_sha'] ?? $agentRun->commit_sha,
                    'metadata' => ['source' => 'desktop_handoff'],
                ]);
            }
            $this->recordEvent($agentRun, 'handoff_completed', 'needs_review', ['changed_files' => $validated['changed_files'], 'test_count' => count($validated['tests'])]);
            return $agentRun->fresh()->load(['evidence', 'events']);
        });
        return response()->json(['success' => true, 'data' => $run]);
    }

    public function context(Request $request, TaskHubContextPackService $contextService)
    {
        $taskId = $request->input('task_id');
        $task = null;
        if (!empty($taskId)) {
            $task = is_numeric($taskId)
                ? Task::find((int) $taskId)
                : Task::where('issue_key', trim((string) $taskId))->first();
            if (!$task) {
                return response()->json([
                    'success' => false,
                    'message' => "Không tìm thấy nhiệm vụ #{$taskId}.",
                ], 404);
            }
        }
        return response()->json(['success' => true, 'data' => $contextService->build($task, $request->all())]);
    }

    public function approve(Task $task)
    {
        $latest = $task->agentRuns()->latest()->first();
        if (!$latest || !$latest->evidence()->where('status', 'passed')->exists()) {
            return response()->json(['success' => false, 'message' => 'Cần verification evidence đạt trước khi approve.'], 422);
        }
        $task->update(['status' => 'done', 'completed_at' => now()]);
        if ($latest->status !== 'verified') $latest->update(['status' => 'verified', 'finished_at' => now()]);
        $this->recordEvent($latest, 'human_approved', 'verified', ['task_id' => $task->id]);
        return response()->json(['success' => true, 'data' => $task->fresh()]);
    }

    public function reject(Request $request, Task $task)
    {
        $validated = $request->validate(['reason' => 'required|string|max:5000']);
        if ($task->status === 'review' || $task->status === 'done') {
            $task->update(['status' => 'in_progress']);
        }
        $latest = $task->agentRuns()->latest()->first();
        if ($latest) {
            $latest->update(['status' => 'waiting_input', 'failure_reason' => $validated['reason']]);
            $this->recordEvent($latest, 'human_rejected', 'waiting_input', $validated);
        }
        return response()->json(['success' => true, 'message' => 'Đã trả task về trạng thái cần bổ sung.', 'data' => $task->fresh()]);
    }

    public function githubWebhook(Request $request)
    {
        $signature = $request->header('X-Hub-Signature-256');
        $repository = data_get($request->all(), 'repository.full_name');
        $project = $repository ? Project::where('github_repository', $repository)->first() : null;
        $secret = $project?->github_webhook_secret ? app(\App\Services\GithubProjectIntegrationService::class)->secret($project->github_webhook_secret) : (config('services.webhook.secret') ?: env('TASK_HUB_GITHUB_WEBHOOK_SECRET'));
        if (app()->environment('production') && !$secret) {
            return response()->json(['success' => false, 'message' => 'GitHub webhook secret is not configured.'], 503);
        }
        if ($secret && (!is_string($signature) || !hash_equals('sha256=' . hash_hmac('sha256', $request->getContent(), $secret), $signature))) {
            return response()->json(['success' => false, 'message' => 'Invalid webhook signature.'], 401);
        }
        $eventId = $request->header('X-GitHub-Delivery');
        if (!$eventId || !Str::isUuid($eventId)) $eventId = (string) Str::uuid();
        if (GithubEvent::where('provider_event_id', $eventId)->exists()) return response()->json(['success' => true, 'duplicate' => true]);
        $event = GithubEvent::create([
            'provider_event_id' => $eventId,
            'event_name' => $request->header('X-GitHub-Event', 'unknown'),
            'project_id' => $project?->id,
            'repository' => $repository,
            'payload' => $request->all(),
            'occurred_at' => now(),
        ]);
        $this->syncGithubEvent($event->event_name, $event->payload);
        return response()->json(['success' => true, 'event_id' => $eventId], 202);
    }

    private function applyLifecycleFields(array &$fields): void
    {
        if (($fields['status'] ?? null) === 'running') $fields['started_at'] = $fields['started_at'] ?? now();
        if (in_array($fields['status'] ?? null, ['verified', 'failed', 'cancelled'], true)) $fields['finished_at'] = $fields['finished_at'] ?? now();
    }

    private function recordEvent(AgentRun $run, string $type, ?string $status, array $payload = [], ?string $eventId = null, $occurredAt = null): AgentRunEvent
    {
        return AgentRunEvent::create([
            'agent_run_id' => $run->id,
            'event_id' => $eventId ?: (string) Str::uuid(),
            'event_type' => $type,
            'status' => $status,
            'payload' => $payload,
            'occurred_at' => $occurredAt ?: now(),
        ]);
    }

    private function syncGithubEvent(string $eventName, array $payload): void
    {
        $repository = data_get($payload, 'repository.full_name');
        $branch = data_get($payload, 'ref');
        $branch = is_string($branch) ? preg_replace('#^refs/heads/#', '', $branch) : null;
        $commit = data_get($payload, 'after') ?: data_get($payload, 'check_run.head_sha') ?: data_get($payload, 'pull_request.head.sha');
        if (!$repository || (!$branch && !$commit)) return;
        $query = AgentRun::query();
        if ($repository) $query->where('repository', $repository);
        $runs = $query->where(function ($q) use ($branch, $commit) {
            if ($branch) $q->where('branch', $branch);
            if ($commit) $q->orWhere('commit_sha', $commit);
        })->get();

        foreach ($runs as $run) {
            $fields = ['metadata' => array_merge($run->metadata ?: [], ['last_github_event' => $eventName, 'github_payload_summary' => [
                'action' => data_get($payload, 'action'),
                'conclusion' => data_get($payload, 'check_run.conclusion'),
                'merged' => data_get($payload, 'pull_request.merged'),
            ]])];
            if ($commit) $fields['commit_sha'] = $commit;
            if ($eventName === 'pull_request') {
                $fields['pull_request_url'] = data_get($payload, 'pull_request.html_url');
                if (in_array(data_get($payload, 'action'), ['opened', 'reopened', 'synchronize'], true)) $fields['status'] = 'needs_review';
                if ($fields['pull_request_url']) $run->evidence()->create([
                    'task_id' => $run->task_id, 'evidence_type' => 'pull_request', 'status' => 'passed',
                    'artifact_url' => $fields['pull_request_url'], 'commit_sha' => $commit,
                    'summary' => 'GitHub pull request ' . data_get($payload, 'action', 'updated'),
                    'metadata' => ['source' => 'github_webhook', 'event' => $eventName],
                ]);
            }
            if ($eventName === 'check_run' && data_get($payload, 'check_run.conclusion')) {
                $passed = data_get($payload, 'check_run.conclusion') === 'success';
                $run->evidence()->create([
                    'task_id' => $run->task_id, 'evidence_type' => 'ci_check', 'status' => $passed ? 'passed' : 'failed',
                    'command' => data_get($payload, 'check_run.name'), 'artifact_url' => data_get($payload, 'check_run.details_url'),
                    'commit_sha' => $commit, 'summary' => 'GitHub check: ' . data_get($payload, 'check_run.conclusion'),
                    'metadata' => ['source' => 'github_webhook', 'event' => $eventName],
                ]);
                if (!$passed) {
                    $fields['status'] = 'failed';
                    $fields['failure_reason'] = 'GitHub check failed: ' . data_get($payload, 'check_run.name', 'unknown check');
                }
            }
            $run->update($fields);
            $this->recordEvent($run, 'github_' . $eventName, $fields['status'] ?? $run->status, ['repository' => $repository, 'commit_sha' => $commit]);
        }
    }

    public function models(Request $request)
    {
        $provider = $request->string('provider')->toString();
        $models = [
            'antigravity' => [
                ['id' => 'gemini-3.7-flash', 'name' => 'Gemini 3.7 Flash', 'badges' => ['High', 'Fast'], 'description' => 'Mô hình thế hệ mới nhất, tối ưu tốc độ và agentic reasoning'],
                ['id' => 'gemini-3.6-flash', 'name' => 'Gemini 3.6 Flash', 'badges' => ['Medium', 'Fast'], 'description' => 'Cân bằng tốc độ cao và năng lực suy luận'],
                ['id' => 'gemini-3.5-flash', 'name' => 'Gemini 3.5 Flash', 'badges' => ['Medium', 'Fast'], 'description' => 'Phản hồi nhanh cho các tác vụ lập trình phổ biến'],
                ['id' => 'gemini-3.1-pro', 'name' => 'Gemini 3.1 Pro', 'badges' => ['Low'], 'description' => 'Mô hình tiêu chuẩn cho tác vụ nhẹ'],
                ['id' => 'claude-sonnet-4.6-thinking', 'name' => 'Claude Sonnet 4.6 (Thinking)', 'badges' => ['Thinking'], 'description' => 'Suy luận mở rộng và phân tích kiến trúc mã nguồn chuyên sâu'],
                ['id' => 'claude-opus-4.6-thinking', 'name' => 'Claude Opus 4.6 (Thinking)', 'badges' => ['Thinking'], 'description' => 'Mô hình phân tích cấp cao nhất cho bài toán phức tạp'],
                ['id' => 'gpt-oss-120b', 'name' => 'GPT-OSS 120B (Medium)', 'badges' => ['Open Weights', 'Medium'], 'description' => 'Mô hình mã nguồn mở 120B hiệu năng cao'],
                ['id' => 'gemini-2.5-pro', 'name' => 'Gemini 2.5 Pro', 'badges' => ['Recommended', '1M+ Context'], 'description' => 'Mô hình mạnh nhất của DeepMind, context 1M+'],
                ['id' => 'gemini-2.5-flash', 'name' => 'Gemini 2.5 Flash', 'badges' => ['Fast & Smart'], 'description' => 'Tốc độ cao kèm khả năng suy luận xuất sắc'],
                ['id' => 'gemini-2.0-flash', 'name' => 'Gemini 2.0 Flash', 'badges' => ['Ultra Fast'], 'description' => 'Phản hồi tức thì cho các tác vụ lặp lại'],
                ['id' => 'gemini-2.0-pro-exp', 'name' => 'Gemini 2.0 Pro Exp', 'badges' => ['Experimental'], 'description' => 'Bản thử nghiệm năng lực giải thuật và code gen'],
                ['id' => 'default', 'name' => 'IDE / CLI Default', 'badges' => ['Default'], 'description' => 'Cấu hình mặc định của Antigravity'],
            ],
            'claude_code' => [
                ['id' => 'claude-3-7-sonnet-20250219', 'name' => 'Claude 3.7 Sonnet', 'badges' => ['High', 'Recommended'], 'description' => 'Tối ưu hoá cao nhất cho coding, kiến trúc & hybrid reasoning'],
                ['id' => 'claude-3-7-sonnet-thinking', 'name' => 'Claude 3.7 (Thinking)', 'badges' => ['High', 'Thinking'], 'description' => 'Kích hoạt extended thinking cho các refactor phức tạp'],
                ['id' => 'claude-sonnet-4.6-thinking', 'name' => 'Claude Sonnet 4.6 (Thinking)', 'badges' => ['Next-Gen', 'Thinking'], 'description' => 'Mô hình Sonnet thế hệ mới tối ưu agentic workflow'],
                ['id' => 'claude-opus-4.6-thinking', 'name' => 'Claude Opus 4.6 (Thinking)', 'badges' => ['Deep Analysis', 'Thinking'], 'description' => 'Phân tích hệ thống lớn & cấu trúc logic phức tạp'],
                ['id' => 'claude-3-5-sonnet-20241022', 'name' => 'Claude 3.5 Sonnet (v2)', 'badges' => ['Balanced', 'Fast'], 'description' => 'Mô hình lập trình tiêu chuẩn ổn định'],
                ['id' => 'claude-3-5-haiku-20241022', 'name' => 'Claude 3.5 Haiku', 'badges' => ['Super Fast'], 'description' => 'Tốc độ cực nhanh cho tasks nhỏ và refactor nhẹ'],
                ['id' => 'claude-3-opus-20240229', 'name' => 'Claude 3 Opus', 'badges' => ['Deep Analysis'], 'description' => 'Phân tích hệ thống lớn & bài toán phức tạp'],
                ['id' => 'default', 'name' => 'CLI Default', 'badges' => ['Default'], 'description' => 'Cấu hình mặc định của Claude Code CLI'],
            ],
            'codex' => [
                ['id' => 'gpt-5.6-sol', 'name' => 'GPT-5.6 Sol', 'badges' => ['High', 'Flagship'], 'description' => 'Mô hình flagship mạnh nhất thế hệ GPT-5.6 cho reasoning, research & agentic coding'],
                ['id' => 'gpt-5.6-terra', 'name' => 'GPT-5.6 Terra', 'badges' => ['Medium', 'Fast'], 'description' => 'Mô hình cân bằng hoàn hảo giữa trí tuệ và tốc độ cho tác vụ production'],
                ['id' => 'gpt-5.6-luna', 'name' => 'GPT-5.6 Luna', 'badges' => ['Low', 'Ultra Fast'], 'description' => 'Mô hình nhẹ tối ưu tốc độ và chi phí cho khối lượng công việc lớn'],
                ['id' => 'gpt-5.6-cyber', 'name' => 'GPT-5.6 Cyber', 'badges' => ['Specialized', 'Security'], 'description' => 'Mô hình chuyên biệt phân tích an toàn thông tin & audit bảo mật mã nguồn'],
                ['id' => 'o3-pro', 'name' => 'o3-pro', 'badges' => ['High', 'Deep Reasoning'], 'description' => 'Suy luận chuyên sâu mở rộng cho các bài toán kiến trúc & giải thuật khó'],
                ['id' => 'o3', 'name' => 'o3', 'badges' => ['High', 'Reasoning'], 'description' => 'Mô hình suy luận logic đa bước mạnh mẽ thế hệ o-series'],
                ['id' => 'o3-mini', 'name' => 'o3-mini', 'badges' => ['Fast Reasoning', 'High'], 'description' => 'Suy luận logic cao cấp với tốc độ phản hồi nhanh chóng'],
                ['id' => 'gpt-5', 'name' => 'GPT-5 (Foundational)', 'badges' => ['High', 'Foundational'], 'description' => 'Mô hình nền tảng thế hệ GPT-5'],
                ['id' => 'gpt-4.1', 'name' => 'GPT-4.1', 'badges' => ['Balanced', 'Fast'], 'description' => 'Phiên bản tối ưu hiệu năng cao cho tasks coding hàng ngày'],
                ['id' => 'gpt-4.1-mini', 'name' => 'GPT-4.1 mini', 'badges' => ['Ultra Fast'], 'description' => 'Mô hình siêu nhẹ tốc độ cao'],
                ['id' => 'o1', 'name' => 'o1', 'badges' => ['Deep Reasoning'], 'description' => 'Suy luận từng bước giải quyết bài toán khó'],
                ['id' => 'gpt-4.5-preview', 'name' => 'GPT-4.5 Preview', 'badges' => ['High Quality', 'Large Context'], 'description' => 'Khả năng hiểu ngữ cảnh sâu và kiến trúc phức tạp'],
                ['id' => 'gpt-4o', 'name' => 'GPT-4o', 'badges' => ['Omni', 'Fast'], 'description' => 'Cân bằng tốc độ và chất lượng thực thi'],
                ['id' => 'gpt-4o-mini', 'name' => 'GPT-4o mini', 'badges' => ['Ultra Fast'], 'description' => 'Mô hình nhỏ gọn tốc độ cao'],
                ['id' => 'gpt-oss-120b', 'name' => 'GPT-OSS 120B (Medium)', 'badges' => ['Open Weights', 'Medium'], 'description' => 'Mô hình mã nguồn mở 120B tham số'],
                ['id' => 'default', 'name' => 'CLI Default', 'badges' => ['Default'], 'description' => 'Cấu hình mặc định của Codex CLI'],
            ],
        ];

        if ($provider && isset($models[$provider])) {
            return response()->json([
                'success' => true,
                'provider' => $provider,
                'updated_at' => now()->toIso8601String(),
                'data' => $models[$provider]
            ]);
        }

        return response()->json([
            'success' => true,
            'updated_at' => now()->toIso8601String(),
            'data' => $models
        ]);
    }

    public function quota(Request $request)
    {
        if ($request->isMethod('post')) {
            $quota = $request->input('quota', []);
            \Illuminate\Support\Facades\Cache::put('agent_runner_latest_quota', $quota, now()->addDays(7));
            return response()->json([
                'success' => true,
                'message' => 'Quota usage synced successfully.',
                'data' => $quota
            ]);
        }

        $cachedQuota = \Illuminate\Support\Facades\Cache::get('agent_runner_latest_quota', [
            'plan' => 'Google AI Ultra',
            'planTier' => 'Highest rate limits',
            'enableCreditOverages' => false,
            'gemini' => [
                'id' => 'gemini',
                'name' => 'Gemini Models',
                'provider' => 'antigravity',
                'weeklyRemainingPercent' => 69,
                'weeklyResetIn' => '4 days, 9 hours',
                'fiveHourRemainingPercent' => 93,
                'fiveHourResetIn' => '3 hours, 50 minutes',
            ],
            'claudeGpt' => [
                'id' => 'claude_gpt',
                'name' => 'Claude and GPT models',
                'provider' => 'claude_code',
                'weeklyRemainingPercent' => 100,
                'weeklyResetIn' => '7 days',
                'fiveHourRemainingPercent' => 100,
                'fiveHourResetIn' => '5 hours',
            ],
            'codex' => [
                'id' => 'codex',
                'name' => 'Codex Models',
                'provider' => 'codex',
                'weeklyRemainingPercent' => 98,
                'weeklyResetIn' => '6 days, 20 hours',
                'fiveHourRemainingPercent' => 95,
                'fiveHourResetIn' => '4 hours, 30 minutes',
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => $cachedQuota
        ]);
    }
}
