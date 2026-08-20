<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('github_events') && !Schema::hasColumn('github_events', 'project_id')) {
            Schema::table('github_events', function (Blueprint $table) {
                $table->foreignId('project_id')->nullable()->after('id')->constrained('projects')->nullOnDelete();
                $table->index(['project_id', 'event_name']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('github_events') && Schema::hasColumn('github_events', 'project_id')) {
            Schema::table('github_events', function (Blueprint $table) {
                $table->dropForeign(['project_id']);
                $table->dropIndex(['project_id', 'event_name']);
                $table->dropColumn('project_id');
            });
        }
    }
};
