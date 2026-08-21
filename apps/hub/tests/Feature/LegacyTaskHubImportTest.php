<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class LegacyTaskHubImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_imports_sanitized_legacy_data_idempotently(): void
    {
        $tables = [
            'users' => [['id' => 7, 'name' => 'Owner', 'email' => 'owner@example.test', 'password' => '', 'created_at' => now(), 'updated_at' => now()]],
            'projects' => [['id' => 9, 'slug' => 'legacy', 'title' => 'Legacy', 'tagline' => 'Legacy', 'description' => 'Imported', 'category' => 'tools', 'cover_gradient' => 'none', 'created_at' => now(), 'updated_at' => now()]],
            'sprints' => [], 'tasks' => [['id' => 11, 'project_id' => 9, 'title' => 'Preserved task', 'status' => 'todo', 'priority' => 'medium', 'category' => 'general', 'estimated_pomodoros' => 1, 'completed_pomodoros' => 0, 'sort_order' => 0, 'created_at' => now(), 'updated_at' => now()]],
            'project_documents' => [], 'task_documents' => [], 'project_releases' => [], 'agent_runs' => [], 'verification_evidence' => [], 'agent_run_events' => [], 'github_events' => [],
        ];
        $checksums = collect($tables)->map(fn ($rows) => hash('sha256', json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)))->all();
        $path = storage_path('framework/legacy-task-hub.json');
        File::put($path, json_encode(['format' => 'task-hub-legacy-export/v1', 'tables' => $tables, 'checksums' => $checksums]));

        $this->artisan('taskhub:import-legacy', ['file' => $path])->assertSuccessful();
        $this->artisan('taskhub:import-legacy', ['file' => $path])->assertSuccessful();

        $this->assertDatabaseHas('projects', ['id' => 9]);
        $this->assertDatabaseHas('tasks', ['id' => 11, 'project_id' => 9]);
        $this->assertDatabaseCount('legacy_imports', 3);
    }
}
