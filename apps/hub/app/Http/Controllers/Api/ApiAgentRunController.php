<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\GithubEvent;
use App\Models\Task;
use App\Models\Project;
use App\Models\VerificationEvidence;
use App\Services\TaskHubContextPackService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ApiAgentRunController extends Controller
{
    private const PROVIDERS = ['antigravity', 'codex', 'claude_code'];
    private const STATUSES = ['queued', 'running', 'waiting_input', 'needs_review', 'verified', 'failed', 'cancelled'];

    public function index(Request $request)
    {
        $query = AgentRun::with(['task.project', 'evidence'])->latest();
        if ($request->filled('task_id')) $query->where('task_id', $request->integer('task_id'));
        if ($request->filled('status')) $query->where('status', $request->string('status'));
        return response()->json(['success' => true, 'data' => $query->limit(50)->get()]);
    }

    public function show(AgentRun $agentRun)
    {
        return response()->json(['success' => true, 'data' => $agentRun->load(['task.project', 'evidence', 'events'])]);
    }

    public function store(Request $request, TaskHubContextPackService $contextService)
    {
        $validated = $request->validate([
            'task_id' => 'nullable|exists:tasks,id',
            'provider' => 'required|in:' . implode(',', self::PROVIDERS),
            'agent_session_id' => 'nullable|string|max:191',
            'repository' => 'nullable|string|max:255',
            'branch' => 'nullable|string|max:255',
            'run_type' => 'nullable|string|max:30',
            'instruction' => 'nullable|array',
            'context' => 'nullable|array',
        ]);

        $task = !empty($validated['task_id']) ? Task::findOrFail($validated['task_id']) : null;
        $context = $validated['context'] ?? $contextService->build($task, $validated);
        $instruction = $validated['instruction'] ?? [];

        $run = DB::transaction(function () use ($validated, $context, $instruction, $contextService, $task) {
            $run = AgentRun::create([
                'task_id' => $task?->id,
                'provider' => $validated['provider'],
                'agent_session_id' => $validated['agent_session_id'] ?? (string) Str::uuid(),
                'repository' => $validated['repository'] ?? ($context['repository'] ?? env('TASK_HUB_REPOSITORY')),
                'branch' => $validated['branch'] ?? ($context['branch'] ?? null),
                'status' => 'queued',
                'run_type' => $validated['run_type'] ?? 'implementation',
                'context_hash' => $context['context_hash'] ?? null,
                'instruction_hash' => $contextService->instructionHash($instruction),
                'metadata' => ['context' => $context],
            ]);
            $this->recordEvent($run, 'run_created', 'queued', ['context_hash' => $run->context_hash]);
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
        ]);
        $validated['task_id'] = $validated['task_id'] ?? $agentRun->task_id;
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
        ]);

        $run = DB::transaction(function () use ($agentRun, $validated) {
            $metadata = array_merge($agentRun->metadata ?: [], [
                'handoff' => [
                    'changed_files' => array_values($validated['changed_files']),
                    'blockers' => $validated['blockers'] ?? null,
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
        $task = $request->filled('task_id') ? Task::findOrFail($request->integer('task_id')) : null;
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
        $latest = $task->agentRuns()->latest()->first();
        if ($latest) {
            $latest->update(['status' => 'waiting_input', 'failure_reason' => $validated['reason']]);
            $this->recordEvent($latest, 'human_rejected', 'waiting_input', $validated);
        }
        return response()->json(['success' => true, 'message' => 'Đã trả task về trạng thái cần bổ sung.']);
    }

    public function githubWebhook(Request $request)
    {
        $signature = $request->header('X-Hub-Signature-256');
        $repository = data_get($request->all(), 'repository.full_name');
        $project = $repository ? Project::where('github_repository', $repository)->first() : null;
        $secret = $project?->github_webhook_secret ? app(\App\Services\GithubProjectIntegrationService::class)->secret($project->github_webhook_secret) : env('TASK_HUB_GITHUB_WEBHOOK_SECRET');
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
            }
            if ($eventName === 'check_run' && data_get($payload, 'check_run.conclusion') === 'failure') {
                $fields['status'] = 'failed';
                $fields['failure_reason'] = 'GitHub check failed: ' . data_get($payload, 'check_run.name', 'unknown check');
            }
            $run->update($fields);
            $this->recordEvent($run, 'github_' . $eventName, $fields['status'] ?? $run->status, ['repository' => $repository, 'commit_sha' => $commit]);
        }
    }
}
