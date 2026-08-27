<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\AgentRunLog;
use App\Models\AgentRunner;
use App\Models\GithubEvent;
use App\Models\Task;
use App\Models\Project;
use App\Models\VerificationEvidence;
use App\Services\TaskHubContextPackService;
use App\Services\WorkspaceQuotaService;
use App\Exceptions\PlanQuotaExceededException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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
        return response()->json(['success' => true, 'data' => $agentRun->load(['task.project', 'evidence', 'events', 'runner', 'logs'])]);
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
        return response()->stream(function () use ($workspace, $after, $afterLog, $runId) {
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
            'metadata' => 'nullable|array',
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
                    'message' => "Task #{$taskId} not found. Please refresh the task list.",
                ], 404);
            }
        }
        if ($task && in_array($task->status, ['review', 'done'], true)) {
            return response()->json([
                'success' => false,
                'message' => $task->status === 'review'
                    ? 'Task is waiting for Hub review. Approve or request changes before starting another run.'
                    : 'Task is already done. Reopen it before starting another run.',
            ], 422);
        }
        $localCaoEpicChild = $task
            && $task->issue_type !== 'epic'
            && data_get($request->input('metadata'), 'epic_sequence.local_cao') === true;
        if ($task?->hasIncompleteDependencies() && !($localCaoEpicChild && $this->localCaoDependenciesVerified($task, (array) $request->input('metadata')))) {
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
                'metadata' => array_merge(['context' => $context], $selectedModel ? ['model' => $selectedModel] : [], $validated['metadata'] ?? []),
            ]);
            $this->recordEvent($run, 'run_created', 'queued', array_merge(['context_hash' => $run->context_hash], $selectedModel ? ['model' => $selectedModel] : []));
            return $run;
        });

        return response()->json(['success' => true, 'data' => $run->load('task'), 'context' => $context], 201);
    }

    public function dispatch(Request $request, Task $task, TaskHubContextPackService $contextService)
    {
        $validated = $request->validate([
            'runner_id' => 'required|integer|exists:agent_runners,id',
            'provider' => 'nullable|in:' . implode(',', self::PROVIDERS),
            'model' => 'nullable|string|max:120',
            'execution_mode' => 'nullable|in:auto_pilot,supervised,desktop',
            'custom_instruction' => 'nullable|string|max:10000',
            'epic_sequence' => 'nullable|array',
        ]);

        if (in_array($task->status, ['review', 'done'], true)) {
            return response()->json([
                'success' => false,
                'message' => $task->status === 'review'
                    ? 'Task is waiting for Hub review. Approve or request changes before dispatching again.'
                    : 'Task is already done. Reopen it before dispatching again.',
            ], 422);
        }
        if ($task->hasIncompleteDependencies()) {
            return response()->json([
                'success' => false,
                'message' => 'Task is blocked until all dependency tasks are done.',
                'blocked_by' => $task->dependencies()->with('dependsOn:id,issue_key,title,status')->get(),
            ], 422);
        }

        $runner = AgentRunner::findOrFail($validated['runner_id']);
        $provider = $validated['provider'] ?? 'antigravity';
        $model = $validated['model'] ?? 'gemini-3.7-flash';
        $mode = $validated['execution_mode'] ?? 'auto_pilot';
        $customInstruction = $validated['custom_instruction'] ?? null;
        $epicSequence = $validated['epic_sequence'] ?? null;

        $context = $contextService->build($task, ['provider' => $provider, 'model' => $model]);
        $instruction = [
            'prompt' => $customInstruction ?: ($task->description ?: 'Autonomous task execution'),
            'model' => $model,
        ];

        $workspace = $task->project?->workspace ?? ($runner->workspace ?? \App\Models\Workspace::first());

        if ($workspace) {
            try {
                app(WorkspaceQuotaService::class)->assertCanDispatchTask($workspace);
            } catch (PlanQuotaExceededException $e) {
                return $e->render($request);
            }
        }

        $run = DB::transaction(function () use ($task, $runner, $workspace, $provider, $model, $mode, $customInstruction, $epicSequence, $context, $instruction, $contextService, $request) {
            $commandId = 'cmd-' . Str::uuid();
            $run = AgentRun::create([
                'task_id' => $task->id,
                'workspace_id' => $workspace?->id,
                'runner_id' => $runner->id,
                'provider' => $provider,
                'agent_session_id' => (string) Str::uuid(),
                'repository' => $context['repository'] ?? (config('services.task_hub.repository') ?: env('TASK_HUB_REPOSITORY')),
                'branch' => $context['branch'] ?? null,
                'status' => 'queued',
                'execution_mode' => 'desktop',
                'run_type' => 'implementation',
                'queued_at' => now(),
                'context_hash' => $context['context_hash'] ?? null,
                'instruction_hash' => $contextService->instructionHash($instruction),
                'metadata' => [
                    'mode' => $mode,
                    'model' => $model,
                    'custom_instruction' => $customInstruction,
                    'context' => $context,
                    'dispatch_command_id' => $commandId,
                    'dispatched_at' => now()->toIso8601String(),
                    'dispatched_by' => $request->user()?->id,
                    'target_runner' => [
                        'id' => $runner->id,
                        'name' => $runner->name,
                        'hostname' => $runner->hostname,
                    ],
                    ...($epicSequence ? ['epic_sequence' => $epicSequence] : []),
                ],
            ]);

            $this->recordEvent($run, 'task_dispatched', 'queued', [
                'runner_id' => $runner->id,
                'command_id' => $commandId,
                'mode' => $mode,
                'model' => $model,
            ]);

            if (in_array($task->status, ['todo', 'backlog'], true)) {
                $task->update(['status' => 'in_progress']);
            }

            return $run;
        });

        return response()->json([
            'success' => true,
            'run_id' => $run->id,
            'status' => 'queued',
            'dispatched_at' => now()->toIso8601String(),
            'target_runner' => [
                'id' => $runner->id,
                'name' => $runner->name,
                'hostname' => $runner->hostname,
            ],
            'data' => $run->load('task.project'),
        ], 201);
    }

    /** Start an Epic safely: dispatch only the first dependency-ready child. Each
     * subsequent child is queued only after the preceding task is approved. */
    public function dispatchEpic(Request $request, Task $task, TaskHubContextPackService $contextService)
    {
        if ($task->issue_type !== 'epic') return response()->json(['success' => false, 'message' => 'Only an Epic can run as a sequence.'], 422);
        $validated = $request->validate([
            'runner_id' => 'required|integer|exists:agent_runners,id',
            'provider' => 'nullable|in:' . implode(',', self::PROVIDERS),
            'model' => 'nullable|string|max:120',
            'execution_mode' => 'nullable|in:auto_pilot,supervised,desktop',
            'custom_instruction' => 'nullable|string|max:10000',
        ]);
        $children = Task::where('epic_id', $task->id)
            ->where('status', '!=', 'done')
            ->with('dependencies.dependsOn:id,issue_key,title,status')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        if ($children->isEmpty()) return response()->json(['success' => false, 'message' => 'This Epic has no open child tasks to run.'], 422);
        $next = $children->first(fn (Task $child) => $this->isEpicChildDispatchable($child));
        if (!$next) {
            $diagnostics = $this->epicDispatchDiagnostics($children);
            return response()->json([
                'success' => false,
                'error_code' => $diagnostics['cycles'] !== [] ? 'epic_dependency_cycle' : 'epic_no_dispatchable_child',
                'message' => $diagnostics['message'],
                'dispatch_diagnostics' => $diagnostics,
            ], 422);
        }
        $sequence = [
            'epic_id' => $task->id,
            'task_ids' => $children->pluck('id')->values()->all(),
            'runner_id' => $validated['runner_id'],
            'provider' => $validated['provider'] ?? 'antigravity',
            'model' => $validated['model'] ?? 'gemini-3.7-flash',
            'execution_mode' => $validated['execution_mode'] ?? 'auto_pilot',
            'custom_instruction' => $validated['custom_instruction'] ?? null,
        ];
        $task->update(['status' => 'in_progress']);
        return $this->dispatch(Request::create('/', 'POST', array_merge($validated, ['epic_sequence' => $sequence])), $next, $contextService);
    }

    /**
     * An Epic is a scheduler, never work itself. Keep the decision and the
     * explanation together so a cloud dispatch failure is actionable instead
     * of looking like a desktop delivery failure.
     */
    private function isEpicChildDispatchable(Task $task): bool
    {
        return in_array($task->status, ['todo', 'backlog'], true)
            && $this->unfinishedDependencies($task)->isEmpty();
    }

    private function unfinishedDependencies(Task $task): Collection
    {
        return $task->dependencies->filter(fn ($dependency) => $dependency->dependsOn?->status !== 'done')->values();
    }

    /** @return array{message:string,ready:array,blocked:array,active:array,cycles:array} */
    private function epicDispatchDiagnostics(Collection $children): array
    {
        $ready = [];
        $blocked = [];
        $active = [];

        foreach ($children as $child) {
            $task = [
                'id' => $child->id,
                'issue_key' => $child->issue_key,
                'title' => $child->title,
                'status' => $child->status,
            ];
            $unfinished = $this->unfinishedDependencies($child)->map(fn ($dependency) => [
                'id' => $dependency->dependsOn?->id,
                'issue_key' => $dependency->dependsOn?->issue_key,
                'title' => $dependency->dependsOn?->title,
                'status' => $dependency->dependsOn?->status,
            ])->values()->all();

            if (in_array($child->status, ['todo', 'backlog'], true)) {
                if ($unfinished === []) {
                    $ready[] = $task;
                } else {
                    $blocked[] = [...$task, 'blocked_by' => $unfinished];
                }
            } else {
                $active[] = $task;
            }
        }

        $cycles = $this->findEpicDependencyCycles($children);
        $message = $cycles !== []
            ? 'This Epic cannot start because its remaining tasks contain a dependency cycle. Review the blocking tasks and remove one dependency before dispatching.'
            : ($active !== []
                ? 'This Epic has no task ready to dispatch. Finish, approve, or return the active/review task before starting another child.'
                : 'This Epic has no task ready to dispatch. Every open task is waiting on an unfinished dependency.');

        return compact('message', 'ready', 'blocked', 'active', 'cycles');
    }

    /** @return array<int, array<int, array{id:int,issue_key:?string,title:string}>> */
    private function findEpicDependencyCycles(Collection $children): array
    {
        $childrenById = $children->keyBy('id');
        $visiting = [];
        $visited = [];
        $stack = [];
        $cycles = [];
        $seen = [];

        $visit = function (Task $task) use (&$visit, &$visiting, &$visited, &$stack, &$cycles, &$seen, $childrenById): void {
            if (isset($visited[$task->id])) return;
            if (isset($visiting[$task->id])) {
                $start = array_search($task->id, $stack, true);
                $cycleIds = array_slice($stack, $start === false ? 0 : $start);
                $cycleIds[] = $task->id;
                $key = implode('-', $cycleIds);
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $cycles[] = array_map(fn ($id) => [
                        'id' => $id,
                        'issue_key' => $childrenById[$id]->issue_key,
                        'title' => $childrenById[$id]->title,
                    ], $cycleIds);
                }
                return;
            }

            $visiting[$task->id] = true;
            $stack[] = $task->id;
            foreach ($task->dependencies as $dependency) {
                $predecessor = $dependency->dependsOn;
                if ($predecessor && $childrenById->has($predecessor->id)) $visit($childrenById[$predecessor->id]);
            }
            array_pop($stack);
            unset($visiting[$task->id]);
            $visited[$task->id] = true;
        };

        foreach ($children as $child) $visit($child);
        return $cycles;
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
        if (array_key_exists('metadata', $validated)) {
            $validated['metadata'] = array_merge($agentRun->metadata ?: [], $validated['metadata'] ?: []);
        }
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
            // Verification-only runs may not have a local diff. Treat an omitted
            // or empty changed-file list as an explicit empty list so automatic
            // handoff still reaches Hub review.
            'changed_files' => 'nullable|array',
            'changed_files.*' => 'string|max:500',
            'tests' => 'required|array|min:1',
            'tests.*.command' => 'required|string|max:500',
            'tests.*.status' => 'required|in:passed,failed,skipped',
            'tests.*.summary' => 'nullable|string|max:10000',
            'commit_sha' => 'nullable|string|max:80',
            'pull_request_url' => 'nullable|url|max:500',
            'blockers' => 'nullable|string|max:10000',
            'review' => 'nullable|array',
            'review.status' => 'nullable|string|in:idle,reviewing,changes_requested,approved,max_iterations,failed',
            'review.reviewer_provider' => 'nullable|in:codex,claude_code,antigravity',
            'review.reviewer_run_id' => 'nullable|integer',
            'review.iterations' => 'nullable|integer|min:0|max:20',
            'review.feedback' => 'nullable|string|max:10000',
            'auto_approved' => 'nullable|boolean',
            'idempotency_key' => 'nullable|uuid',
        ]);
        $validated['changed_files'] = array_values($validated['changed_files'] ?? []);
        $idempotencyKey = $validated['idempotency_key'] ?? $request->header('Idempotency-Key');
        if ($idempotencyKey && data_get($agentRun->metadata, 'handoff.idempotency_key') === $idempotencyKey) {
            return response()->json(['success' => true, 'duplicate' => true, 'data' => $agentRun->fresh()->load(['evidence', 'events'])]);
        }
        unset($validated['idempotency_key']);

        $autoApproved = (bool) ($validated['auto_approved'] ?? false);
        if ($autoApproved) {
            $reviewerRunId = (int) data_get($validated, 'review.reviewer_run_id', 0);
            $reviewerRun = AgentRun::query()->find($reviewerRunId);
            $hasIndependentPassedReview = $reviewerRun
                && (int) $reviewerRun->id !== (int) $agentRun->id
                && (int) $reviewerRun->task_id === (int) $agentRun->task_id
                && $reviewerRun->evidence()
                    ->where('evidence_type', 'independent_review')
                    ->where('status', 'passed')
                    ->exists();
            $isVerifiedLocalCaoEpic = $agentRun->run_type === 'epic'
                && $agentRun->task?->issue_type === 'epic'
                && data_get($agentRun->metadata, 'epic_sequence.local_cao') === true
                && !Task::query()->where('epic_id', $agentRun->task_id)->where('status', '!=', 'done')->exists();
            if ((!$hasIndependentPassedReview && !$isVerifiedLocalCaoEpic) || data_get($validated, 'review.status') !== 'approved') {
                return response()->json([
                    'success' => false,
                    'message' => 'Auto-approval requires passed evidence from a separate independent reviewer run.',
                ], 422);
            }
        }

        $run = DB::transaction(function () use ($agentRun, $validated, $idempotencyKey, $autoApproved) {
            $metadata = array_merge($agentRun->metadata ?: [], [
                'handoff' => [
                    'changed_files' => array_values($validated['changed_files']),
                    'blockers' => $validated['blockers'] ?? null,
                    'auto_review' => $validated['review'] ?? null,
                    'idempotency_key' => $idempotencyKey,
                    'submitted_at' => now()->toIso8601String(),
                    'auto_approved' => $autoApproved,
                ],
            ]);
            $agentRun->update([
                'status' => $autoApproved ? 'verified' : 'needs_review', 'summary' => $validated['summary'],
                'commit_sha' => $validated['commit_sha'] ?? $agentRun->commit_sha,
                'pull_request_url' => $validated['pull_request_url'] ?? $agentRun->pull_request_url,
                'metadata' => $metadata,
                'finished_at' => $autoApproved ? now() : $agentRun->finished_at,
            ]);
            if ($agentRun->task && $agentRun->task->status !== 'done') {
                $agentRun->task->update($autoApproved
                    ? ['status' => 'done', 'completed_at' => now()]
                    : ['status' => 'review']);
            }
            foreach ($validated['tests'] as $test) {
                $agentRun->evidence()->create([
                    'task_id' => $agentRun->task_id, 'evidence_type' => 'test',
                    'status' => $test['status'], 'command' => $test['command'],
                    'summary' => $test['summary'] ?? null, 'commit_sha' => $validated['commit_sha'] ?? $agentRun->commit_sha,
                    'metadata' => ['source' => 'desktop_handoff'],
                ]);
            }
            $this->recordEvent(
                $agentRun,
                $autoApproved ? 'auto_handoff_approved' : 'handoff_completed',
                $autoApproved ? 'verified' : 'needs_review',
                ['changed_files' => $validated['changed_files'], 'test_count' => count($validated['tests']), 'reviewer_run_id' => data_get($validated, 'review.reviewer_run_id')],
            );
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
                    'message' => "Task #{$taskId} not found.",
                ], 404);
            }
        }
        return response()->json(['success' => true, 'data' => $contextService->build($task, $request->all())]);
    }

    public function approve(Task $task)
    {
        // A reviewer run is created after the implementation run; approvals
        // must evaluate the implementation handoff evidence rather than a
        // read-only reviewer session.
        $latest = $task->agentRuns()->where('run_type', '!=', 'review')->latest()->first();
        if (!$latest || !$latest->evidence()->where('status', 'passed')->exists()) {
            return response()->json(['success' => false, 'message' => 'Passing verification evidence is required before approval.'], 422);
        }

        $sequence = data_get($latest->metadata, 'epic_sequence');
        $isLocalCaoEpic = $task->issue_type === 'epic'
            && $latest->run_type === 'epic'
            && data_get($sequence, 'local_cao') === true;
        if ($isLocalCaoEpic) {
            $childIds = collect(data_get($sequence, 'child_task_ids', []))
                ->filter(fn ($id) => is_numeric($id))
                ->map(fn ($id) => (int) $id)
                ->values();
            $children = Task::query()
                ->where('epic_id', $task->id)
                ->whereIn('id', $childIds)
                ->get();
            if ($children->count() !== $childIds->count()) {
                return response()->json(['success' => false, 'message' => 'Epic handoff is incomplete: one or more child tasks are missing.'], 422);
            }
            $childRunIds = collect(data_get($sequence, 'child_run_ids', []))
                ->filter(fn ($id) => is_numeric($id))
                ->map(fn ($id) => (int) $id)
                ->values();
            $now = now();
            DB::transaction(function () use ($task, $latest, $children, $childRunIds, $now) {
                $task->update(['status' => 'done', 'completed_at' => $now]);
                $latest->update(['status' => 'verified', 'finished_at' => $now]);
                if ($children->isNotEmpty()) {
                    Task::whereIn('id', $children->pluck('id'))
                        ->update(['status' => 'done', 'completed_at' => $now]);
                }
                if ($childRunIds->isNotEmpty()) {
                    AgentRun::whereIn('id', $childRunIds)
                        ->whereIn('task_id', $children->pluck('id'))
                        ->update(['status' => 'verified', 'finished_at' => $now]);
                }
                $this->recordEvent($latest, 'epic_human_approved', 'verified', [
                    'task_id' => $task->id,
                    'child_task_ids' => $children->pluck('id')->values()->all(),
                    'child_run_ids' => $childRunIds->all(),
                ]);
            });
            return response()->json([
                'success' => true,
                'message' => 'Epic approved; all CAO child tasks were marked Done.',
                'data' => $task->fresh(),
            ]);
        }

        $task->update(['status' => 'done', 'completed_at' => now()]);
        if ($latest->status !== 'verified') $latest->update(['status' => 'verified', 'finished_at' => now()]);
        $this->recordEvent($latest, 'human_approved', 'verified', ['task_id' => $task->id]);
        if (is_array($sequence) && !empty($sequence['task_ids'])) {
            $remaining = collect($sequence['task_ids'])->map(fn ($id) => Task::find($id))->filter(fn ($candidate) => $candidate && $candidate->status !== 'done');
            $next = $remaining->first(fn (Task $candidate) => in_array($candidate->status, ['todo', 'backlog'], true) && !$candidate->hasIncompleteDependencies());
            if ($next) {
                $payload = [
                    'runner_id' => $sequence['runner_id'], 'provider' => $sequence['provider'] ?? 'antigravity',
                    'model' => $sequence['model'] ?? null, 'execution_mode' => $sequence['execution_mode'] ?? 'auto_pilot',
                    'custom_instruction' => $sequence['custom_instruction'] ?? null, 'epic_sequence' => $sequence,
                ];
                $this->dispatch(Request::create('/', 'POST', $payload), $next, app(TaskHubContextPackService::class));
            } else {
                $epic = Task::find($sequence['epic_id'] ?? null);
                if ($epic && !Task::where('epic_id', $epic->id)->where('status', '!=', 'done')->exists()) $epic->update(['status' => 'done', 'completed_at' => now()]);
            }
        }
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
            $isLocalCaoEpic = $task->issue_type === 'epic'
                && $latest->run_type === 'epic'
                && data_get($latest->metadata, 'epic_sequence.local_cao') === true;
            $this->recordEvent(
                $latest,
                $isLocalCaoEpic ? 'epic_human_rejected' : 'human_rejected',
                'waiting_input',
                $validated,
            );
            if ($isLocalCaoEpic) {
                return response()->json([
                    'success' => true,
                    'message' => 'Epic returned for changes. No child task was auto-started.',
                    'data' => $task->fresh(),
                ]);
            }
        }
        return response()->json(['success' => true, 'message' => 'Task returned to changes requested.', 'data' => $task->fresh()]);
    }

    public function cancel(Request $request, AgentRun $agentRun)
    {
        if ($request->user()) {
            abort_unless((int) $agentRun->workspace_id === (int) app(WorkspaceContext::class)->resolve($request)->id, 404);
        }
        if (in_array($agentRun->status, ['verified', 'failed', 'cancelled'], true)) {
            return response()->json(['success' => true, 'data' => $agentRun]);
        }
        $agentRun->update(['cancel_requested_at' => now(), 'status' => 'cancelled', 'finished_at' => now()]);
        $this->recordEvent($agentRun, 'run_cancelled', 'cancelled', ['reason' => $request->input('reason', 'User requested cancel')]);
        return response()->json(['success' => true, 'data' => $agentRun->fresh()]);
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

    /**
     * A local CAO Epic verifies each child in the shared parent run before
     * starting the next dependency-ready child. Child task rows intentionally
     * remain open until the single final Epic approval, so dependency checks
     * must also accept that durable verification evidence.
     */
    private function localCaoDependenciesVerified(Task $task, array $metadata): bool
    {
        $parentRunId = (int) data_get($metadata, 'epic_sequence.parent_run_id', 0);
        if (!$parentRunId) return false;
        $parent = AgentRun::query()->whereKey($parentRunId)->where('run_type', 'epic')->first();
        if (!$parent || (int) $parent->task_id !== (int) $task->epic_id) return false;
        $verifiedChildIds = collect(data_get($parent->metadata, 'epic_sequence.children', []))
            ->filter(fn ($child) => is_array($child))
            ->map(fn ($child) => $child['taskId'] ?? $child['task_id'] ?? null)
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id);
        return $task->dependencies->every(function ($dependency) use ($verifiedChildIds) {
            $dependencyId = (int) $dependency->depends_on_task_id;
            return $dependency->dependsOn?->status === 'done' || $verifiedChildIds->contains($dependencyId);
        });
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
                ['id' => 'gemini-3.7-flash', 'name' => 'Gemini 3.7 Flash', 'badges' => ['High', 'Fast'], 'description' => 'Next-generation model optimized for speed and agentic reasoning'],
                ['id' => 'gemini-3.6-flash', 'name' => 'Gemini 3.6 Flash', 'badges' => ['Medium', 'Fast'], 'description' => 'Balances high throughput with strong reasoning capabilities'],
                ['id' => 'gemini-3.5-flash', 'name' => 'Gemini 3.5 Flash', 'badges' => ['Medium', 'Fast'], 'description' => 'Fast responses for common development workflows'],
                ['id' => 'gemini-3.1-pro', 'name' => 'Gemini 3.1 Pro', 'badges' => ['Low'], 'description' => 'Standard model for lightweight tasks'],
                ['id' => 'claude-sonnet-4.6-thinking', 'name' => 'Claude Sonnet 4.6 (Thinking)', 'badges' => ['Thinking'], 'description' => 'Extended reasoning and deep codebase architecture analysis'],
                ['id' => 'claude-opus-4.6-thinking', 'name' => 'Claude Opus 4.6 (Thinking)', 'badges' => ['Thinking'], 'description' => 'Top-tier analytical model for complex engineering challenges'],
                ['id' => 'gpt-oss-120b', 'name' => 'GPT-OSS 120B (Medium)', 'badges' => ['Open Weights', 'Medium'], 'description' => 'High-performance 120B open-weights model'],
                ['id' => 'gemini-2.5-pro', 'name' => 'Gemini 2.5 Pro', 'badges' => ['Recommended', '1M+ Context'], 'description' => 'Flagship multimodal model with 1M+ token context window'],
                ['id' => 'gemini-2.5-flash', 'name' => 'Gemini 2.5 Flash', 'badges' => ['Fast & Smart'], 'description' => 'High speed paired with excellent reasoning capabilities'],
                ['id' => 'gemini-2.0-flash', 'name' => 'Gemini 2.0 Flash', 'badges' => ['Ultra Fast'], 'description' => 'Instant turnaround for iterative workflows'],
                ['id' => 'gemini-2.0-pro-exp', 'name' => 'Gemini 2.0 Pro Exp', 'badges' => ['Experimental'], 'description' => 'Experimental release for algorithmic reasoning and code generation'],
                ['id' => 'default', 'name' => 'IDE / CLI Default', 'badges' => ['Default'], 'description' => 'Default runtime configuration for Antigravity'],
            ],
            'claude_code' => [
                ['id' => 'claude-3-7-sonnet-20250219', 'name' => 'Claude 3.7 Sonnet', 'badges' => ['High', 'Recommended'], 'description' => 'Highly optimized for coding, architecture, and hybrid reasoning'],
                ['id' => 'claude-3-7-sonnet-thinking', 'name' => 'Claude 3.7 (Thinking)', 'badges' => ['High', 'Thinking'], 'description' => 'Enables extended thinking for complex multi-file refactors'],
                ['id' => 'claude-sonnet-4.6-thinking', 'name' => 'Claude Sonnet 4.6 (Thinking)', 'badges' => ['Next-Gen', 'Thinking'], 'description' => 'Next-gen Sonnet model optimized for agentic workflows'],
                ['id' => 'claude-opus-4.6-thinking', 'name' => 'Claude Opus 4.6 (Thinking)', 'badges' => ['Deep Analysis', 'Thinking'], 'description' => 'Deep analysis for large codebases and complex logic structures'],
                ['id' => 'claude-3-5-sonnet-20241022', 'name' => 'Claude 3.5 Sonnet (v2)', 'badges' => ['Balanced', 'Fast'], 'description' => 'Battle-tested, dependable coding model'],
                ['id' => 'claude-3-5-haiku-20241022', 'name' => 'Claude 3.5 Haiku', 'badges' => ['Super Fast'], 'description' => 'Ultra-fast execution for targeted tasks and small refactors'],
                ['id' => 'claude-3-opus-20240229', 'name' => 'Claude 3 Opus', 'badges' => ['Deep Analysis'], 'description' => 'Large-scale system reasoning and complex problem solving'],
                ['id' => 'default', 'name' => 'CLI Default', 'badges' => ['Default'], 'description' => 'Default configuration for Claude Code CLI'],
            ],
            'codex' => [
                ['id' => 'gpt-5.6-sol', 'name' => 'GPT-5.6 Sol', 'badges' => ['High', 'Flagship'], 'description' => 'Flagship GPT-5.6 generation model for reasoning, research, and agentic coding'],
                ['id' => 'gpt-5.6-terra', 'name' => 'GPT-5.6 Terra', 'badges' => ['Medium', 'Fast'], 'description' => 'Balanced intelligence and low latency for production tasks'],
                ['id' => 'gpt-5.6-luna', 'name' => 'GPT-5.6 Luna', 'badges' => ['Low', 'Ultra Fast'], 'description' => 'Lightweight model optimized for high throughput and cost efficiency'],
                ['id' => 'gpt-5.6-cyber', 'name' => 'GPT-5.6 Cyber', 'badges' => ['Specialized', 'Security'], 'description' => 'Specialized model for security auditing and vulnerability analysis'],
                ['id' => 'o3-pro', 'name' => 'o3-pro', 'badges' => ['High', 'Deep Reasoning'], 'description' => 'Deep extended reasoning for challenging algorithmic and architectural problems'],
                ['id' => 'o3', 'name' => 'o3', 'badges' => ['High', 'Reasoning'], 'description' => 'Multi-step logic reasoning powered by the o-series engine'],
                ['id' => 'o3-mini', 'name' => 'o3-mini', 'badges' => ['Fast Reasoning', 'High'], 'description' => 'High-order logic reasoning with quick response times'],
                ['id' => 'gpt-5', 'name' => 'GPT-5 (Foundational)', 'badges' => ['High', 'Foundational'], 'description' => 'Foundational GPT-5 architecture model'],
                ['id' => 'gpt-4.1', 'name' => 'GPT-4.1', 'badges' => ['Balanced', 'Fast'], 'description' => 'High-performance edition optimized for day-to-day engineering tasks'],
                ['id' => 'gpt-4.1-mini', 'name' => 'GPT-4.1 mini', 'badges' => ['Ultra Fast'], 'description' => 'Super lightweight high-speed model'],
                ['id' => 'o1', 'name' => 'o1', 'badges' => ['Deep Reasoning'], 'description' => 'Step-by-step reasoning for hard engineering problems'],
                ['id' => 'gpt-4.5-preview', 'name' => 'GPT-4.5 Preview', 'badges' => ['High Quality', 'Large Context'], 'description' => 'Deep contextual understanding and complex architecture analysis'],
                ['id' => 'gpt-4o', 'name' => 'GPT-4o', 'badges' => ['Omni', 'Fast'], 'description' => 'Balanced execution speed and generation quality'],
                ['id' => 'gpt-4o-mini', 'name' => 'GPT-4o mini', 'badges' => ['Ultra Fast'], 'description' => 'Compact model with rapid response times'],
                ['id' => 'gpt-oss-120b', 'name' => 'GPT-OSS 120B (Medium)', 'badges' => ['Open Weights', 'Medium'], 'description' => '120B parameter open-weights model'],
                ['id' => 'default', 'name' => 'CLI Default', 'badges' => ['Default'], 'description' => 'Default configuration for Codex CLI'],
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
