<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentRun;
use App\Models\AgentRunEvent;
use App\Models\AgentRunLog;
use App\Models\AgentRunner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\CredentialVaultService;

class ApiAgentRunnerController extends Controller
{
    private const PROVIDERS = ['codex', 'claude_code', 'antigravity'];

    private function ensureEnabled(): void
    {
        abort_unless((bool) config('services.task_hub.server_runner_enabled'), 404, 'Server-side agent runners are disabled in this release.');
    }

    public function register(Request $request)
    {
        $this->ensureEnabled();
        $bootstrap = (string) $request->header('X-Task-Hub-Runner-Registration');
        $expected = (string) (config('services.task_hub.runner_registration_token') ?: env('TASK_HUB_RUNNER_REGISTRATION_TOKEN'));
        if ($expected === '' || !hash_equals($expected, $bootstrap)) return response()->json(['message' => 'Invalid runner registration token.'], 401);

        $data = $request->validate([
            'name' => 'required|string|max:120', 'hostname' => 'nullable|string|max:255',
            'version' => 'nullable|string|max:40', 'capabilities' => 'nullable|array', 'metadata' => 'nullable|array',
        ]);
        $token = Str::random(80);
        $runner = AgentRunner::create(array_merge($data, [
            'token_hash' => hash('sha256', $token), 'status' => 'online', 'last_heartbeat_at' => now(),
        ]));
        return response()->json(['success' => true, 'runner' => $runner, 'token' => $token], 201);
    }

    public function index(Request $request)
    {
        $this->ensureEnabled();
        $this->runner($request);
        return response()->json(['success' => true, 'data' => AgentRunner::latest()->get()]);
    }

    /** Dashboard projection for the current workspace; it never exposes runner tokens. */
    public function dashboard(Request $request)
    {
        $workspace = app(\App\Services\WorkspaceContext::class)->resolve($request);
        $staleAfter = now()->subSeconds((int) env('TASK_HUB_RUNNER_STALE_SECONDS', 90));
        $runners = AgentRunner::query()->whereHas('runs', fn ($q) => $q->where('workspace_id', $workspace->id))
            ->withCount(['runs as active_runs_count' => fn ($q) => $q->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])])
            ->withMin(['runs as next_lease_expires_at' => fn ($q) => $q->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])], 'lease_expires_at')
            ->latest('last_heartbeat_at')->get()->map(function (AgentRunner $runner) use ($staleAfter) {
                $health = $runner->revoked_at ? 'revoked' : (!$runner->last_heartbeat_at || $runner->last_heartbeat_at->lt($staleAfter) ? 'offline' : $runner->status);
                return ['id' => $runner->id, 'name' => $runner->name, 'hostname' => $runner->hostname, 'version' => $runner->version,
                    'capabilities' => $runner->capabilities, 'health' => $health, 'last_heartbeat_at' => $runner->last_heartbeat_at?->toIso8601String(),
                    'active_runs_count' => $runner->active_runs_count, 'next_lease_expires_at' => $runner->next_lease_expires_at ? \Carbon\Carbon::parse($runner->next_lease_expires_at)->toIso8601String() : null,
                    'latest_error' => $runner->runs()->whereNotNull('failure_reason')->latest('updated_at')->value('failure_reason')];
            })->values();
        return response()->json(['success' => true, 'data' => $runners, 'generated_at' => now()->toIso8601String()]);
    }

    public function heartbeat(Request $request, AgentRunner $agentRunner)
    {
        $this->ensureEnabled();
        $this->runner($request, $agentRunner);
        $data = $request->validate([
            'status' => 'nullable|in:online,busy,offline', 'capabilities' => 'nullable|array', 'metadata' => 'nullable|array',
            'active_run_ids' => 'nullable|array', 'active_run_ids.*' => 'integer',
        ]);
        $activeRunIds = collect($data['active_run_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        unset($data['active_run_ids']);
        $agentRunner->update(array_merge($data, ['last_heartbeat_at' => now(), 'status' => $data['status'] ?? 'online']));
        $leaseSeconds = (int) env('TASK_HUB_RUNNER_LEASE_SECONDS', 120);
        if ($activeRunIds->isNotEmpty()) {
            AgentRun::where('runner_id', $agentRunner->id)->whereIn('id', $activeRunIds)
                ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
                ->update(['lease_expires_at' => now()->addSeconds($leaseSeconds)]);
        }
        $commands = AgentRun::where('runner_id', $agentRunner->id)->whereNotNull('cancel_requested_at')
            ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
            ->get(['id', 'cancel_requested_at'])
            ->map(fn (AgentRun $run) => ['type' => 'cancel', 'run_id' => $run->id, 'requested_at' => $run->cancel_requested_at?->toIso8601String()])
            ->values();
        return response()->json(['success' => true, 'data' => $agentRunner->fresh(), 'commands' => $commands]);
    }

    public function revoke(Request $request, AgentRunner $agentRunner)
    {
        $this->ensureEnabled();
        $this->runner($request, $agentRunner, true);
        $agentRunner->update(['status' => 'revoked', 'revoked_at' => now()]);
        return response()->json(['success' => true, 'data' => $agentRunner->fresh()]);
    }

    public function claim(Request $request, AgentRunner $agentRunner)
    {
        $this->ensureEnabled();
        $this->runner($request, $agentRunner);
        $provider = $request->string('provider')->toString();
        if (!in_array($provider, self::PROVIDERS, true)) return response()->json(['message' => 'Unsupported provider.'], 422);

        $run = DB::transaction(function () use ($agentRunner, $provider) {
            $now = now();
            $workspaceIds = AgentRun::query()->whereNotNull('workspace_id')->where('execution_mode', 'server')->whereIn('status', ['claimed', 'preparing', 'running'])->pluck('workspace_id');
            $query = AgentRun::query()->whereNotNull('workspace_id')->where('execution_mode', 'server')->where('provider', $provider)
                ->when($agentRunner->workspace_id, fn ($q) => $q->where('workspace_id', $agentRunner->workspace_id))
                ->where(function ($q) use ($now) { $q->where('status', 'queued')->orWhere(fn ($q) => $q->where('status', 'claimed')->where('lease_expires_at', '<', $now)); })
                ->orderBy('queued_at')->orderBy('id')->lock('for update');
            $run = $query->first();
            if (!$run) return null;
            $limit = (int) ($run->workspace?->agent_concurrency_limit ?? 1);
            if ($limit < 1 || $workspaceIds->filter(fn ($id) => (int) $id === (int) $run->workspace_id)->count() >= $limit) return null;
            $run->update(['runner_id' => $agentRunner->id, 'status' => 'claimed', 'claimed_at' => $now, 'lease_expires_at' => $now->copy()->addSeconds((int) env('TASK_HUB_RUNNER_LEASE_SECONDS', 120))]);
            AgentRunEvent::create(['agent_run_id' => $run->id, 'event_id' => (string) Str::uuid(), 'event_type' => 'run_claimed', 'status' => 'claimed', 'payload' => ['runner_id' => $agentRunner->id], 'occurred_at' => $now]);
            $agentRunner->update(['status' => 'busy', 'last_heartbeat_at' => $now]);
            return $run->load('task.project');
        });
        return response()->json(['success' => true, 'data' => $run]);
    }

    public function event(Request $request, AgentRun $agentRun)
    {
        $this->ensureEnabled();
        $this->runnerForRun($request, $agentRun);
        $data = $request->validate(['event_id' => 'required|uuid', 'event_type' => 'required|string|max:60', 'status' => 'nullable|string|max:30', 'payload' => 'nullable|array']);
        if (AgentRunEvent::where('event_id', $data['event_id'])->exists()) return response()->json(['success' => true, 'duplicate' => true]);
        DB::transaction(function () use ($agentRun, $data) {
            $fields = array_filter(['status' => $data['status'] ?? null], fn ($v) => $v !== null);
            if ($fields) $agentRun->update($fields);
            AgentRunEvent::create(array_merge($data, ['agent_run_id' => $agentRun->id, 'occurred_at' => now()]));
        });
        return response()->json(['success' => true]);
    }

    public function log(Request $request, AgentRun $agentRun)
    {
        $this->ensureEnabled();
        $this->runnerForRun($request, $agentRun);
        $data = $request->validate(['sequence' => 'required|integer|min:0', 'stream' => 'nullable|in:stdout,stderr,system', 'content' => 'required|string|max:50000']);
        $content = preg_replace('/(authorization\s*:\s*bearer\s+)[^\s,;]+/i', '$1[REDACTED]', $data['content']);
        $content = preg_replace('/((?:token|api[_-]?key|password|secret)\s*[:=]\s*)[^\s,;]+/i', '$1[REDACTED]', $content);
        $content = preg_replace('/gh[pousr]_[A-Za-z0-9_]+/', '[REDACTED]', $content);
        AgentRunLog::firstOrCreate(['agent_run_id' => $agentRun->id, 'sequence' => $data['sequence']], ['stream' => $data['stream'] ?? 'stdout', 'content' => $content, 'occurred_at' => now()]);
        return response()->json(['success' => true]);
    }

    public function cancel(Request $request, AgentRun $agentRun)
    {
        $this->ensureEnabled();
        $this->runnerForRun($request, $agentRun);
        if (in_array($agentRun->status, ['verified', 'failed', 'cancelled'], true)) return response()->json(['success' => true, 'data' => $agentRun]);
        $agentRun->update(['cancel_requested_at' => now()]);
        return response()->json(['success' => true, 'data' => $agentRun->fresh()]);
    }

    public function credential(Request $request, AgentRunner $agentRunner, AgentRun $agentRun, CredentialVaultService $vault)
    {
        $this->ensureEnabled();
        $this->runner($request, $agentRunner);
        abort_unless((int) $agentRun->runner_id === (int) $agentRunner->id, 403);
        $provider = $request->string('provider')->toString();
        $credential = $vault->resolve($agentRun->workspace, $agentRun->task?->project, $provider);
        if (!$credential) return response()->json(['success' => false, 'message' => 'Credential unavailable.'], 404);
        return response()->json(['success' => true, 'credential' => $vault->reveal($credential), 'expires_at' => now()->addMinutes(10)->toIso8601String()]);
    }

    public function desktopRegister(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:120',
            'machine_name' => 'nullable|string|max:120',
            'hostname' => 'nullable|string|max:255',
            'client_id' => 'nullable|string|max:128',
            'platform' => 'nullable|string|max:50',
            'os_platform' => 'nullable|string|max:50',
            'os_release' => 'nullable|string|max:120',
            'os_version' => 'nullable|string|max:120',
            'version' => 'nullable|string|max:40',
            'capabilities' => 'nullable|array',
            'active_providers' => 'nullable|array',
            'active_model' => 'nullable|string|max:120',
            'workspace_cwd' => 'nullable|string|max:500',
            'quota_metrics' => 'nullable|array',
            'ping_latency_ms' => 'nullable|integer',
            'metadata' => 'nullable|array',
            'workspace_id' => 'nullable|integer',
        ]);

        $name = $data['machine_name'] ?? ($data['name'] ?? ($data['hostname'] ?? 'Desktop Agent'));
        $machineName = $data['machine_name'] ?? $name;
        $osPlatform = $data['os_platform'] ?? ($data['platform'] ?? (PHP_OS_FAMILY === 'Windows' ? 'win32' : strtolower(PHP_OS_FAMILY)));
        $osVersion = $data['os_version'] ?? ($data['os_release'] ?? php_uname('r'));
        $clientId = $data['client_id'] ?? (string) Str::uuid();

        $workspace = null;
        if ($request->user()) {
            $workspace = app(\App\Services\WorkspaceContext::class)->resolve($request, false);
        } else {
            $token = (string) $request->bearerToken();
            abort_if($token === '', 401, 'An approved desktop pairing credential is required.');
            $session = \App\Models\DesktopPairingSession::where('workspace_token_hash', hash('sha256', $token))
                ->where('status', 'approved')
                ->whereNotNull('workspace_id')
                ->first();
            abort_unless($session?->workspace, 401, 'Invalid desktop pairing credential.');
            $workspace = $session->workspace;
        }

        if (!empty($data['workspace_id'])) {
            abort_unless((int) $data['workspace_id'] === (int) $workspace->id, 403, 'Workspace does not match the authenticated principal.');
        }

        $activeProviders = $data['active_providers'] ?? ['antigravity', 'claude_code', 'codex'];
        $activeProvider = $data['active_provider'] ?? (is_array($activeProviders) && count($activeProviders) ? $activeProviders[0] : 'antigravity');

        $runner = null;
        if (!empty($data['client_id'])) {
            $runner = AgentRunner::where('client_id', $data['client_id'])->where('workspace_id', $workspace->id)->first();
        }

        $token = Str::random(80);
        $tokenHash = hash('sha256', $token);

        $attributes = [
            'workspace_id' => $workspace?->id,
            'name' => $name,
            'machine_name' => $machineName,
            'client_id' => $clientId,
            'runner_type' => 'desktop',
            'token_hash' => $tokenHash,
            'hostname' => $data['hostname'] ?? gethostname(),
            'os_platform' => $osPlatform,
            'os_version' => $osVersion,
            'ip_address' => $request->ip(),
            'version' => $data['version'] ?? '1.0.7',
            'capabilities' => $data['capabilities'] ?? ['desktop_execution', 'worktree_isolation', 'test_runner'],
            'status' => 'online',
            'active_provider' => $activeProvider,
            'active_model' => $data['active_model'] ?? 'gemini-3.7-flash',
            'workspace_cwd' => $data['workspace_cwd'] ?? null,
            'quota_metrics' => $data['quota_metrics'] ?? null,
            'ping_latency_ms' => $data['ping_latency_ms'] ?? 0,
            'last_heartbeat_at' => now(),
            'metadata' => $data['metadata'] ?? [],
        ];

        if ($runner) {
            $runner->update($attributes);
        } else {
            $runner = AgentRunner::create($attributes);
        }

        return response()->json([
            'success' => true,
            'runner' => $runner->fresh(),
            'token' => $token,
            'registered_at' => now()->toIso8601String(),
        ], 201);
    }

    public function desktopHeartbeat(Request $request)
    {
        $data = $request->validate([
            'client_id' => 'nullable|string|max:128',
            'runner_id' => 'nullable|integer',
            'name' => 'nullable|string|max:120',
            'machine_name' => 'nullable|string|max:120',
            'hostname' => 'nullable|string|max:255',
            'platform' => 'nullable|string|max:50',
            'os_platform' => 'nullable|string|max:50',
            'arch' => 'nullable|string|max:20',
            'os_release' => 'nullable|string|max:120',
            'os_version' => 'nullable|string|max:120',
            'version' => 'nullable|string|max:40',
            'status' => 'nullable|in:idle,busy,offline,online',
            'active_providers' => 'nullable|array',
            'active_model' => 'nullable|string|max:120',
            'workspace_cwd' => 'nullable|string|max:500',
            'active_run_ids' => 'nullable|array',
            'active_run_ids.*' => 'integer',
            'quota_metrics' => 'nullable|array',
            'ping_latency_ms' => 'nullable|integer',
            'capabilities' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        AgentRunner::reapStale((int) env('TASK_HUB_RUNNER_STALE_SECONDS', 45));

        $runner = null;
        $session = null;
        $bearer = (string) $request->bearerToken();
        if ($bearer !== '') {
            $runner = AgentRunner::where('token_hash', hash('sha256', $bearer))->first();
            if (!$runner) {
                $session = \App\Models\DesktopPairingSession::where('workspace_token_hash', hash('sha256', $bearer))->first();
                if ($session) {
                    $runner = AgentRunner::where('workspace_id', $session->workspace_id)
                        ->where('runner_type', 'desktop')
                        ->first();
                }
            }
        }
        if (!$runner && !empty($data['client_id'])) {
            $runner = AgentRunner::where('client_id', $data['client_id'])->first();
        }
        if (!$runner && !empty($data['runner_id'])) {
            $runner = AgentRunner::find($data['runner_id']);
        }
        if (!$runner) {
            $workspace = $session?->workspace ?: (($request->user() ? app(\App\Services\WorkspaceContext::class)->resolve($request, false) : null) ?: \App\Models\Workspace::first());
            $token = Str::random(80);
            $runner = AgentRunner::create([
                'workspace_id' => $session?->workspace_id ?? $workspace?->id,
                'client_id' => $data['client_id'] ?? (string) Str::uuid(),
                'runner_type' => 'desktop',
                'name' => $data['machine_name'] ?? ($data['name'] ?? ($data['hostname'] ?? 'Desktop Agent')),
                'machine_name' => $data['machine_name'] ?? ($data['name'] ?? 'Desktop Agent'),
                'hostname' => $data['hostname'] ?? gethostname(),
                'token_hash' => hash('sha256', $token),
                'os_platform' => $data['os_platform'] ?? ($data['platform'] ?? 'win32'),
                'os_version' => $data['os_version'] ?? ($data['os_release'] ?? ''),
                'ip_address' => $request->ip(),
                'version' => $data['version'] ?? '1.0.7',
                'status' => 'online',
                'last_heartbeat_at' => now(),
            ]);
        }

        $activeProviders = $data['active_providers'] ?? null;
        $activeProvider = is_array($activeProviders) && count($activeProviders) ? $activeProviders[0] : ($runner->active_provider ?: 'antigravity');
        $rawStatus = $data['status'] ?? 'online';
        $status = in_array($rawStatus, ['busy', 'offline'], true) ? $rawStatus : 'online';

        $updateFields = [
            'status' => $status,
            'last_heartbeat_at' => now(),
            'ip_address' => $request->ip(),
        ];
        if ($session?->workspace_id && !$runner->workspace_id) {
            $updateFields['workspace_id'] = $session->workspace_id;
        }
        if (!empty($data['machine_name'])) $updateFields['machine_name'] = $data['machine_name'];
        if (!empty($data['hostname'])) $updateFields['hostname'] = $data['hostname'];
        if (!empty($data['platform']) || !empty($data['os_platform'])) $updateFields['os_platform'] = $data['os_platform'] ?? $data['platform'];
        if (!empty($data['os_release']) || !empty($data['os_version'])) $updateFields['os_version'] = $data['os_version'] ?? $data['os_release'];
        if (!empty($data['version'])) $updateFields['version'] = $data['version'];
        if (!empty($data['active_model'])) $updateFields['active_model'] = $data['active_model'];
        if ($activeProvider) $updateFields['active_provider'] = $activeProvider;
        if (!empty($data['workspace_cwd'])) $updateFields['workspace_cwd'] = $data['workspace_cwd'];
        if (isset($data['quota_metrics'])) $updateFields['quota_metrics'] = $data['quota_metrics'];
        if (isset($data['ping_latency_ms'])) $updateFields['ping_latency_ms'] = $data['ping_latency_ms'];
        if (isset($data['capabilities'])) $updateFields['capabilities'] = $data['capabilities'];

        $runner->update($updateFields);

        if (!empty($data['quota_metrics'])) {
            \Illuminate\Support\Facades\Cache::put('agent_runner_latest_quota', $data['quota_metrics'], now()->addDays(7));
        }

        $activeRunIds = collect($data['active_run_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        if ($activeRunIds->isNotEmpty()) {
            AgentRun::where('runner_id', $runner->id)
                ->whereIn('id', $activeRunIds)
                ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
                ->update(['lease_expires_at' => now()->addSeconds(120)]);
        }

        $dispatchCommands = AgentRun::where('status', 'queued')
            ->where(function ($q) use ($runner) {
                $q->where('runner_id', $runner->id);
                if ($runner->workspace_id) {
                    $q->orWhere(function ($sub) use ($runner) {
                        $sub->whereNull('runner_id')
                            ->where('workspace_id', $runner->workspace_id)
                            ->where('execution_mode', 'desktop');
                    });
                }
            })
            ->with('task.project')
            ->get()
            ->map(function (AgentRun $run) use ($runner) {
                $run->update([
                    'runner_id' => $runner->id,
                    'status' => 'claimed',
                    'claimed_at' => now(),
                    'lease_expires_at' => now()->addSeconds(120),
                ]);
                AgentRunEvent::create([
                    'agent_run_id' => $run->id,
                    'event_id' => (string) Str::uuid(),
                    'event_type' => 'run_claimed',
                    'status' => 'claimed',
                    'payload' => ['runner_id' => $runner->id, 'channel' => 'heartbeat'],
                    'occurred_at' => now(),
                ]);
                return [
                    'type' => 'remote_dispatch',
                    'command_id' => data_get($run->metadata, 'dispatch_command_id', 'cmd-' . Str::uuid()),
                    'run_id' => $run->id,
                    'task_id' => $run->task_id,
                    'issue_key' => $run->task?->issue_key ?: ('TASK-' . $run->task_id),
                    'title' => $run->task?->title,
                    'description' => $run->task?->description,
                    'mode' => data_get($run->metadata, 'mode', 'auto_pilot'),
                    'provider' => $run->provider ?: 'antigravity',
                    'model' => data_get($run->metadata, 'model', 'gemini-3.7-flash'),
                    'instruction' => data_get($run->metadata, 'custom_instruction') ?: ($run->task?->description ?: 'Autonomous task execution'),
                    'context' => data_get($run->metadata, 'context', []),
                    'dispatched_at' => data_get($run->metadata, 'dispatched_at', now()->toIso8601String()),
                ];
            });

        $cancelCommands = AgentRun::where('runner_id', $runner->id)
            ->whereNotNull('cancel_requested_at')
            ->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])
            ->get()
            ->map(fn (AgentRun $run) => [
                'type' => 'cancel_run',
                'command_id' => 'cmd-cancel-' . $run->id,
                'run_id' => $run->id,
                'task_id' => $run->task_id,
                'requested_at' => $run->cancel_requested_at?->toIso8601String(),
            ]);

        $allCommands = $dispatchCommands->concat($cancelCommands)->values();

        return response()->json([
            'success' => true,
            'health' => $runner->health,
            'server_time' => now()->toIso8601String(),
            'commands' => $allCommands,
            'data' => $runner->fresh(),
        ]);
    }

    public function desktopIndex(Request $request)
    {
        AgentRunner::reapStale((int) env('TASK_HUB_RUNNER_STALE_SECONDS', 45));

        $workspace = null;
        if ($request->user()) {
            $workspace = app(\App\Services\WorkspaceContext::class)->resolve($request, false);
        }

        $query = AgentRunner::desktop();
        if ($workspace) {
            $query->where(function ($q) use ($workspace) {
                $q->where('workspace_id', $workspace->id)->orWhereNull('workspace_id');
            });
        }

        $runners = $query->withCount(['runs as active_runs_count' => fn ($q) => $q->whereIn('status', ['claimed', 'preparing', 'running', 'waiting_input'])])
            ->latest('last_heartbeat_at')
            ->get()
            ->map(function (AgentRunner $r) {
                return [
                    'id' => $r->id,
                    'client_id' => $r->client_id,
                    'name' => $r->name,
                    'machine_name' => $r->machine_name ?: $r->name,
                    'hostname' => $r->hostname,
                    'os_platform' => $r->os_platform,
                    'os_version' => $r->os_version,
                    'ip_address' => $r->ip_address,
                    'version' => $r->version,
                    'status' => $r->status,
                    'health' => $r->health,
                    'active_provider' => $r->active_provider,
                    'active_model' => $r->active_model,
                    'workspace_cwd' => $r->workspace_cwd,
                    'quota_metrics' => $r->quota_metrics,
                    'ping_latency_ms' => $r->ping_latency_ms,
                    'last_heartbeat_at' => $r->last_heartbeat_at?->toIso8601String(),
                    'active_runs_count' => $r->active_runs_count,
                    'capabilities' => $r->capabilities,
                    'metadata' => $r->metadata,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $runners,
            'count' => $runners->count(),
            'online_count' => $runners->where('health', '!=', 'offline')->where('health', '!=', 'revoked')->count(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    public function desktopCommandStream(Request $request, AgentRunner $agentRunner)
    {
        return response()->stream(function () use ($agentRunner) {
            echo "event: ready\n";
            echo 'data: ' . json_encode(['status' => 'connected', 'runner_id' => $agentRunner->id, 'server_time' => now()->toIso8601String()], JSON_UNESCAPED_UNICODE) . "\n\n";

            $queuedRuns = AgentRun::where('runner_id', $agentRunner->id)
                ->where('status', 'queued')
                ->with('task.project')
                ->get();

            foreach ($queuedRuns as $run) {
                $run->update([
                    'status' => 'claimed',
                    'claimed_at' => now(),
                    'lease_expires_at' => now()->addSeconds(120),
                ]);
                AgentRunEvent::create([
                    'agent_run_id' => $run->id,
                    'event_id' => (string) Str::uuid(),
                    'event_type' => 'run_claimed',
                    'status' => 'claimed',
                    'payload' => ['runner_id' => $agentRunner->id, 'channel' => 'sse_command_stream'],
                    'occurred_at' => now(),
                ]);
                $cmd = [
                    'type' => 'remote_dispatch',
                    'command_id' => data_get($run->metadata, 'dispatch_command_id', 'cmd-' . Str::uuid()),
                    'run_id' => $run->id,
                    'task_id' => $run->task_id,
                    'issue_key' => $run->task?->issue_key ?: ('TASK-' . $run->task_id),
                    'title' => $run->task?->title,
                    'description' => $run->task?->description,
                    'mode' => data_get($run->metadata, 'mode', 'auto_pilot'),
                    'provider' => $run->provider ?: 'antigravity',
                    'model' => data_get($run->metadata, 'model', 'gemini-3.7-flash'),
                    'instruction' => data_get($run->metadata, 'custom_instruction') ?: ($run->task?->description ?: 'Autonomous task execution'),
                    'context' => data_get($run->metadata, 'context', []),
                    'dispatched_at' => data_get($run->metadata, 'dispatched_at', now()->toIso8601String()),
                ];
                echo "event: command\n";
                echo 'data: ' . json_encode($cmd, JSON_UNESCAPED_UNICODE) . "\n\n";
            }

            echo ": keepalive\n\n";
            if (function_exists('ob_flush')) @ob_flush();
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function runnerForRun(Request $request, AgentRun $run): AgentRunner
    {
        if (!$run->runner_id) abort(403, 'Run is not assigned to a runner.');
        return $this->runner($request, $run->runner ?: null);
    }

    private function runner(Request $request, ?AgentRunner $expected = null, bool $allowRevoked = false): AgentRunner
    {
        $token = (string) $request->bearerToken();
        $runner = AgentRunner::where('token_hash', hash('sha256', $token))->first();
        if (!$runner || (!$allowRevoked && ($runner->revoked_at || ($expected && $expected->id !== $runner->id)))) abort(401, 'Invalid runner token.');
        return $runner;
    }
}

