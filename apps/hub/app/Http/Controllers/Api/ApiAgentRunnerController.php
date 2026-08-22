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
