<?php

namespace App\Console\Commands;

use App\Models\AgentRun;
use App\Models\Workspace;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PruneWorkspaceRetentionHistoryCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'task-history:prune 
        {--workspace= : The ID of the workspace to prune} 
        {--days= : Override retention days} 
        {--chunk=500 : Batch size for chunking} 
        {--dry-run : Simulate pruning without deleting records}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prune expired agent run history and cascading logs based on workspace plan retention policies';

    /**
     * Protected in-flight agent run statuses that must never be pruned.
     */
    protected const PROTECTED_STATUSES = [
        'queued',
        'claimed',
        'preparing',
        'running',
        'waiting_input',
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $workspaceOption = $this->option('workspace');
        $isDryRun = (bool) $this->option('dry-run');
        $daysOverride = $this->option('days') !== null ? (int) $this->option('days') : null;
        $chunkSize = max(10, (int) ($this->option('chunk') ?: 500));

        $startTime = microtime(true);
        $referenceTime = Carbon::now();

        $this->info(sprintf(
            '[RetentionPrune] Starting retention pruning process at %s (dry-run: %s)...',
            $referenceTime->toIso8601String(),
            $isDryRun ? 'true' : 'false'
        ));

        // 1. Resolve Workspaces Target
        if ($workspaceOption !== null) {
            $workspaceId = (int) $workspaceOption;
            $workspace = Workspace::find($workspaceId);

            if (!$workspace) {
                $errorMsg = "[Error] Workspace with ID {$workspaceId} not found.";
                $this->error($errorMsg);
                Log::warning($errorMsg);
                return self::FAILURE;
            }

            $workspaces = collect([$workspace]);
        } else {
            $workspaces = Workspace::all();
        }

        $totalScannedWorkspaces = 0;
        $totalPrunedRuns = 0;
        $totalPrunedLogs = 0;
        $totalPrunedEvents = 0;
        $totalPrunedEvidence = 0;

        $tableRows = [];

        // 2. Iterate each Workspace
        foreach ($workspaces as $workspace) {
            $totalScannedWorkspaces++;

            $retentionDays = $daysOverride ?? $workspace->effectiveRetentionDays();
            $cutoffDate = (clone $referenceTime)->subDays($retentionDays);
            $planSlug = $workspace->activePlan()->slug;

            // Query expired runs with terminal status
            $expiredQuery = AgentRun::where('workspace_id', $workspace->id)
                ->whereNotIn('status', self::PROTECTED_STATUSES)
                ->where('created_at', '<', $cutoffDate);

            $expiredCount = (clone $expiredQuery)->count();

            $wsDeletedRuns = 0;
            $wsDeletedLogs = 0;
            $wsDeletedEvents = 0;
            $wsDeletedEvidence = 0;

            if ($expiredCount > 0) {
                if ($isDryRun) {
                    $runIds = (clone $expiredQuery)->pluck('id');
                    $wsDeletedRuns = $expiredCount;
                    $wsDeletedLogs = DB::table('agent_run_logs')->whereIn('agent_run_id', $runIds)->count();
                    $wsDeletedEvents = DB::table('agent_run_events')->whereIn('agent_run_id', $runIds)->count();
                    $wsDeletedEvidence = DB::table('verification_evidence')->whereIn('agent_run_id', $runIds)->count();
                } else {
                    // Chunk-based deletion to preserve memory and lock efficiency
                    (clone $expiredQuery)->chunkById($chunkSize, function ($runs) use (
                        &$wsDeletedRuns,
                        &$wsDeletedLogs,
                        &$wsDeletedEvents,
                        &$wsDeletedEvidence
                    ) {
                        $chunkIds = $runs->pluck('id')->all();

                        DB::transaction(function () use (
                            $chunkIds,
                            &$wsDeletedRuns,
                            &$wsDeletedLogs,
                            &$wsDeletedEvents,
                            &$wsDeletedEvidence
                        ) {
                            $wsDeletedLogs += DB::table('agent_run_logs')->whereIn('agent_run_id', $chunkIds)->delete();
                            $wsDeletedEvents += DB::table('agent_run_events')->whereIn('agent_run_id', $chunkIds)->delete();
                            $wsDeletedEvidence += DB::table('verification_evidence')->whereIn('agent_run_id', $chunkIds)->delete();
                            $wsDeletedRuns += DB::table('agent_runs')->whereIn('id', $chunkIds)->delete();
                        });
                    });
                }
            }

            $this->line(sprintf(
                '[RetentionPrune] Workspace #%d (%s) [Plan: %s, Retention: %dd]: Found %d expired runs.',
                $workspace->id,
                $workspace->name,
                $planSlug,
                $retentionDays,
                $expiredCount
            ));

            $totalPrunedRuns += $wsDeletedRuns;
            $totalPrunedLogs += $wsDeletedLogs;
            $totalPrunedEvents += $wsDeletedEvents;
            $totalPrunedEvidence += $wsDeletedEvidence;

            $tableRows[] = [
                $workspace->id,
                $workspace->name,
                $planSlug,
                "{$retentionDays}d",
                $cutoffDate->toDateString(),
                $wsDeletedRuns,
                $wsDeletedLogs,
                $wsDeletedEvents,
                $wsDeletedEvidence,
            ];
        }

        $elapsed = round(microtime(true) - $startTime, 2);

        $this->newLine();
        $this->table(
            ['WS ID', 'Workspace Name', 'Plan', 'Retention', 'Cutoff Date', 'Runs', 'Logs', 'Events', 'Evidence'],
            $tableRows
        );

        $summaryMsg = sprintf(
            '[RetentionPrune] Finished. Total runs pruned: %d, cascade logs: %d, events: %d, evidence: %d. (Elapsed: %ss, Workspaces: %d)',
            $totalPrunedRuns,
            $totalPrunedLogs,
            $totalPrunedEvents,
            $totalPrunedEvidence,
            $elapsed,
            $totalScannedWorkspaces
        );

        $this->info($summaryMsg);

        Log::info('Task history retention pruning completed', [
            'dry_run' => $isDryRun,
            'scanned_workspaces' => $totalScannedWorkspaces,
            'pruned_runs' => $totalPrunedRuns,
            'pruned_logs' => $totalPrunedLogs,
            'pruned_events' => $totalPrunedEvents,
            'pruned_evidence' => $totalPrunedEvidence,
            'elapsed_seconds' => $elapsed,
        ]);

        return self::SUCCESS;
    }
}
