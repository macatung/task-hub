<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('projects') && !Schema::hasColumn('projects', 'tags')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->json('tags')->nullable()->after('description');
            });
        }

        if (!Schema::hasTable('tasks') || !Schema::hasColumn('tasks', 'project_id')) {
            return;
        }

        // Every tenant gets a private inbox project for legacy/orphan tasks.
        // New writes are rejected when project_id is missing; this only repairs
        // historical data during the transition.
        $workspaces = DB::table('tasks')
            ->whereNull('project_id')
            ->whereNotNull('workspace_id')
            ->distinct()
            ->pluck('workspace_id');

        foreach ($workspaces as $workspaceId) {
            $project = DB::table('projects')
                ->where('workspace_id', $workspaceId)
                ->where('slug', 'workspace-inbox')
                ->first();

            if (!$project) {
                $projectId = DB::table('projects')->insertGetId([
                    'workspace_id' => $workspaceId,
                    'slug' => 'workspace-inbox',
                    'key' => 'INBOX',
                    'title' => 'Workspace Inbox',
                    'tagline' => 'Legacy tasks awaiting project organization',
                    'description' => 'Temporary project for tasks imported without a project. Move them into a canonical project.',
                    'category' => 'tools',
                    'type' => 'work',
                    'color' => '#64748b',
                    'tags' => json_encode(['legacy', 'needs-triage']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $projectId = $project->id;
            }

            DB::table('tasks')
                ->where('workspace_id', $workspaceId)
                ->whereNull('project_id')
                ->update(['project_id' => $projectId]);
        }

        // A task without workspace belongs to the legacy quarantine and must
        // still be attached to a project before the constraint is tightened.
        $legacyWorkspace = DB::table('workspaces')->where('is_system', true)->orderBy('id')->first();
        if ($legacyWorkspace) {
            DB::table('tasks')->whereNull('workspace_id')->update(['workspace_id' => $legacyWorkspace->id]);
            $project = DB::table('projects')
                ->where('workspace_id', $legacyWorkspace->id)
                ->where('slug', 'workspace-inbox')
                ->first();
            if (!$project) {
                $projectId = DB::table('projects')->insertGetId([
                    'workspace_id' => $legacyWorkspace->id,
                    'slug' => 'workspace-inbox',
                    'key' => 'INBOX',
                    'title' => 'Workspace Inbox',
                    'tagline' => 'Legacy tasks awaiting project organization',
                    'description' => 'Temporary project for quarantined legacy tasks.',
                    'category' => 'tools',
                    'type' => 'work',
                    'color' => '#64748b',
                    'tags' => json_encode(['legacy', 'needs-triage']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $projectId = $project->id;
            }
            DB::table('tasks')->whereNull('project_id')->update(['project_id' => $projectId]);
        }

        if (DB::table('tasks')->whereNull('project_id')->exists()) {
            throw new RuntimeException('Cannot enforce canonical projects: orphan tasks remain.');
        }

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable(false)->change();
        });
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('tasks') && Schema::hasColumn('tasks', 'project_id')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign(['project_id']);
            });
            Schema::table('tasks', function (Blueprint $table) {
                $table->foreignId('project_id')->nullable()->change();
                $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
            });
        }
    }
};
