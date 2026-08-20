<?php

namespace App\Console\Commands;

use App\Models\Workspace;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class ImportLegacyTaskHubCommand extends Command
{
    protected $signature = 'taskhub:import-legacy {file : JSON export produced by the legacy application} {--workspace=legacy-import : Workspace slug for imported projects} {--dry-run : Validate only; do not write}';
    protected $description = 'Idempotently import a sanitized Task Hub export while preserving legacy identifiers.';

    private const TABLES = ['users', 'projects', 'sprints', 'tasks', 'project_documents', 'task_documents', 'project_releases', 'agent_runs', 'verification_evidence', 'agent_run_events', 'github_events'];

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (!File::exists($path)) return $this->failure("Export not found: {$path}");
        $export = json_decode(File::get($path), true);
        if (!is_array($export) || ($export['format'] ?? null) !== 'task-hub-legacy-export/v1') return $this->failure('Unsupported or invalid Task Hub export.');

        foreach (self::TABLES as $table) {
            $rows = $export['tables'][$table] ?? [];
            if (!is_array($rows)) return $this->failure("Invalid rows for {$table}.");
            $checksum = hash('sha256', json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            if (($export['checksums'][$table] ?? null) !== $checksum) return $this->failure("Checksum mismatch for {$table}.");
        }

        if ($this->option('dry-run')) {
            foreach (self::TABLES as $table) $this->line("{$table}: " . count($export['tables'][$table] ?? []) . ' records');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($export) {
            foreach (self::TABLES as $table) {
                if (!DB::getSchemaBuilder()->hasTable($table)) continue;
                foreach ($export['tables'][$table] ?? [] as $row) {
                    if (!isset($row['id']) && $table !== 'task_documents') continue;
                    if ($table === 'task_documents') {
                        DB::table($table)->updateOrInsert(['task_id' => $row['task_id'], 'project_document_id' => $row['project_document_id']], $row);
                        continue;
                    }
                    DB::table($table)->updateOrInsert(['id' => $row['id']], $row);
                    DB::table('legacy_imports')->updateOrInsert(
                        ['source' => 'portfolio', 'entity_type' => $table, 'legacy_id' => $row['id']],
                        ['target_id' => $row['id'], 'checksum' => json_encode(['row' => hash('sha256', json_encode($row))]), 'updated_at' => now(), 'created_at' => now()]
                    );
                }
            }

            $ownerId = DB::table('users')->orderBy('id')->value('id');
            if (!$ownerId) throw new \RuntimeException('Legacy export has no users; create an owner before importing.');
            $slug = (string) $this->option('workspace');
            $workspace = Workspace::firstOrCreate(['slug' => $slug], ['name' => 'Imported Task Hub', 'owner_id' => $ownerId]);
            $workspace->members()->syncWithoutDetaching([$ownerId => ['role' => 'owner']]);
            DB::table('projects')->whereNull('workspace_id')->update(['workspace_id' => $workspace->id]);
        });

        $this->info('Legacy data imported. Re-authorize GitHub and regenerate MCP credentials before enabling writes.');
        return self::SUCCESS;
    }

    private function failure(string $message): int
    {
        $this->error($message);
        return self::FAILURE;
    }
}
