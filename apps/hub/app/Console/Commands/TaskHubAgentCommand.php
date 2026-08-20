<?php

namespace App\Console\Commands;

use App\Models\AgentRun;
use App\Models\VerificationEvidence;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TaskHubAgentCommand extends Command
{
    protected $signature = 'taskhub:agent
        {action : start|status|evidence|finish|session-start|session-stop}
        {--run= : Agent run ID}
        {--work-item= : Task ID}
        {--provider=codex : antigravity|codex|claude_code}
        {--status= : Lifecycle status}
        {--command= : Verification command}
        {--type= : Verification evidence type}
        {--summary= : Summary or evidence result}
        {--pr= : Pull request URL}
        {--branch= : Branch name}
        {--commit= : Commit SHA}';

    protected $description = 'Bridge agent lifecycle events into Task Hub';

    public function handle(): int
    {
        $action = $this->argument('action');
        $run = $this->option('run') ? AgentRun::find($this->option('run')) : null;

        if (in_array($action, ['session-start', 'session-stop'], true)) {
            $this->line('Task Hub hook received: ' . $action);
            return self::SUCCESS;
        }

        if ($action === 'start') {
            $run = AgentRun::create([
                'task_id' => $this->option('work-item'),
                'provider' => $this->option('provider'),
                'agent_session_id' => (string) \Illuminate\Support\Str::uuid(),
                'status' => 'running',
                'branch' => $this->option('branch'),
                'started_at' => now(),
            ]);
            $this->info((string) $run->id);
            return self::SUCCESS;
        }

        if (!$run) {
            $this->error('A valid --run is required.');
            return self::INVALID;
        }

        if ($action === 'status' || $action === 'finish') {
            $status = $this->option('status') ?: ($action === 'finish' ? 'needs_review' : null);
            $run->update(array_filter([
                'status' => $status,
                'branch' => $this->option('branch'),
                'commit_sha' => $this->option('commit'),
                'pull_request_url' => $this->option('pr'),
                'summary' => $this->option('summary'),
                'finished_at' => in_array($status, ['verified', 'failed', 'cancelled', 'needs_review'], true) ? now() : null,
            ], fn ($value) => $value !== null));
            $this->info('Updated agent run ' . $run->id);
            return self::SUCCESS;
        }

        if ($action === 'evidence') {
            VerificationEvidence::create([
                'agent_run_id' => $run->id,
                'task_id' => $run->task_id,
                'evidence_type' => $this->option('type') ?: 'command',
                'status' => $this->option('status') ?: 'passed',
                'command' => $this->option('command'),
                'summary' => $this->option('summary'),
                'commit_sha' => $this->option('commit'),
            ]);
            $this->info('Evidence attached to run ' . $run->id);
            return self::SUCCESS;
        }

        $this->error('Unknown action.');
        return self::INVALID;
    }
}
