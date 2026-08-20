<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('github_repository', 255)->nullable();
            $table->string('github_default_branch', 255)->default('main');
            $table->text('github_token')->nullable();
            $table->text('github_webhook_secret')->nullable();
            $table->text('task_hub_mcp_token')->nullable();
            $table->timestamp('github_connected_at')->nullable();
            $table->timestamp('github_last_sync_at')->nullable();
            $table->string('github_sync_status', 30)->default('not_connected');
            $table->text('github_sync_error')->nullable();
            $table->json('github_snapshot')->nullable();
            $table->index('github_repository');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['github_repository']);
            $table->dropColumn([
                'github_repository', 'github_default_branch', 'github_token',
                'github_webhook_secret', 'task_hub_mcp_token', 'github_connected_at',
                'github_last_sync_at', 'github_sync_status', 'github_sync_error',
                'github_snapshot',
            ]);
        });
    }
};
