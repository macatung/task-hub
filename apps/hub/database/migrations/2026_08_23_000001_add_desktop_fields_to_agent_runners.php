<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_runners', function (Blueprint $table) {
            if (!Schema::hasColumn('agent_runners', 'runner_type')) {
                $table->string('runner_type', 30)->default('desktop')->after('status');
            }
            if (!Schema::hasColumn('agent_runners', 'client_id')) {
                $table->string('client_id', 128)->nullable()->after('token_hash');
                $table->index('client_id');
            }
            if (!Schema::hasColumn('agent_runners', 'machine_name')) {
                $table->string('machine_name', 120)->nullable()->after('name');
            }
            if (!Schema::hasColumn('agent_runners', 'os_platform')) {
                $table->string('os_platform', 40)->nullable()->after('hostname');
            }
            if (!Schema::hasColumn('agent_runners', 'os_version')) {
                $table->string('os_version', 120)->nullable()->after('os_platform');
            }
            if (!Schema::hasColumn('agent_runners', 'ip_address')) {
                $table->string('ip_address', 60)->nullable()->after('os_version');
            }
            if (!Schema::hasColumn('agent_runners', 'active_provider')) {
                $table->string('active_provider', 40)->nullable()->after('ip_address');
            }
            if (!Schema::hasColumn('agent_runners', 'active_model')) {
                $table->string('active_model', 120)->nullable()->after('active_provider');
            }
            if (!Schema::hasColumn('agent_runners', 'workspace_cwd')) {
                $table->string('workspace_cwd', 500)->nullable()->after('active_model');
            }
            if (!Schema::hasColumn('agent_runners', 'quota_metrics')) {
                $table->json('quota_metrics')->nullable()->after('metadata');
            }
            if (!Schema::hasColumn('agent_runners', 'ping_latency_ms')) {
                $table->integer('ping_latency_ms')->nullable()->after('quota_metrics');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agent_runners', function (Blueprint $table) {
            $columns = [
                'runner_type', 'client_id', 'machine_name', 'os_platform',
                'os_version', 'ip_address', 'active_provider', 'active_model',
                'workspace_cwd', 'quota_metrics', 'ping_latency_ms'
            ];
            foreach ($columns as $column) {
                if (Schema::hasColumn('agent_runners', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
