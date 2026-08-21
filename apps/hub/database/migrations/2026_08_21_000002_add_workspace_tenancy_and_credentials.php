<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->boolean('is_system')->default(false)->after('owner_id');
            $table->string('plan', 30)->default('free')->after('is_system');
            $table->unsignedInteger('agent_concurrency_limit')->default(1)->after('plan');
        });

        foreach (['projects', 'tasks', 'sprints', 'project_documents', 'project_releases', 'agent_runs', 'agent_runners'] as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'workspace_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreignId('workspace_id')->nullable()->after('id')->constrained('workspaces')->nullOnDelete();
                    $table->index('workspace_id');
                });
            }
        }

        Schema::create('workspace_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->string('provider', 40);
            $table->text('ciphertext');
            $table->string('key_version', 80)->nullable();
            $table->string('fingerprint', 128);
            $table->string('status', 30)->default('active');
            $table->timestamp('last_validated_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->index(['workspace_id', 'provider', 'status']);
            $table->unique(['workspace_id', 'project_id', 'provider']);
        });

        $legacyOwner = DB::table('users')->orderBy('id')->value('id');
        if (!$legacyOwner) {
            $legacyOwner = DB::table('users')->insertGetId([
                'name' => 'Task Hub System', 'email' => 'system@taskhub.invalid',
                'password' => Hash::make(Str::random(64)), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $legacyWorkspaceId = DB::table('workspaces')->where('slug', 'legacy')->value('id');
        if (!$legacyWorkspaceId) {
            $legacyWorkspaceId = DB::table('workspaces')->insertGetId([
                'slug' => 'legacy', 'name' => 'Legacy (Quarantined)', 'owner_id' => $legacyOwner,
                'is_system' => true, 'plan' => 'free', 'agent_concurrency_limit' => 0,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $users = DB::table('users')->pluck('id');
        foreach ($users as $userId) {
            $projectCount = DB::table('projects')->where('user_id', $userId)->count();
            if (!$projectCount) continue;
            $workspaceId = DB::table('workspaces')->where('owner_id', $userId)->where('is_system', false)->value('id');
            if (!$workspaceId) {
                $user = DB::table('users')->where('id', $userId)->first();
                $workspaceId = DB::table('workspaces')->insertGetId([
                    'slug' => Str::slug(($user->name ?: 'workspace') . '-' . $userId),
                    'name' => ($user->name ?: 'My') . ' Workspace', 'owner_id' => $userId,
                    'is_system' => false, 'plan' => 'free', 'agent_concurrency_limit' => 1,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('workspace_members')->insert(['workspace_id' => $workspaceId, 'user_id' => $userId, 'role' => 'owner', 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('projects')->where('user_id', $userId)->whereNull('workspace_id')->update(['workspace_id' => $workspaceId]);
        }

        DB::table('projects')->whereNull('workspace_id')->update(['workspace_id' => $legacyWorkspaceId]);
        DB::table('workspace_members')->insertOrIgnore(['workspace_id' => $legacyWorkspaceId, 'user_id' => $legacyOwner, 'role' => 'owner', 'created_at' => now(), 'updated_at' => now()]);

        foreach (['tasks', 'sprints', 'project_documents', 'project_releases'] as $tableName) {
            DB::table($tableName)->whereNull('workspace_id')->whereNotNull('project_id')->get(['id', 'project_id'])->each(function ($row) use ($tableName) {
                $workspaceId = DB::table('projects')->where('id', $row->project_id)->value('workspace_id');
                if ($workspaceId) DB::table($tableName)->where('id', $row->id)->update(['workspace_id' => $workspaceId]);
            });
        }
        DB::table('agent_runs')->whereNull('workspace_id')->whereNotNull('task_id')->get(['id', 'task_id'])->each(function ($row) {
            $workspaceId = DB::table('tasks')->where('id', $row->task_id)->value('workspace_id');
            if ($workspaceId) DB::table('agent_runs')->where('id', $row->id)->update(['workspace_id' => $workspaceId]);
        });
        DB::statement('UPDATE agent_runners SET workspace_id = ? WHERE workspace_id IS NULL AND status != ?', [$legacyWorkspaceId, 'online']);
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_credentials');
        foreach (['agent_runners', 'agent_runs', 'project_releases', 'project_documents', 'sprints', 'tasks', 'projects'] as $tableName) {
            if (Schema::hasColumn($tableName, 'workspace_id')) Schema::table($tableName, fn (Blueprint $table) => $table->dropConstrainedForeignId('workspace_id'));
        }
        Schema::table('workspaces', function (Blueprint $table) { $table->dropColumn(['is_system', 'plan', 'agent_concurrency_limit']); });
    }
};
