<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add 'key' to projects table
        if (Schema::hasTable('projects') && !Schema::hasColumn('projects', 'key')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->string('key', 10)->nullable()->after('slug');
            });
        }

        // 2. Create sprints table
        if (!Schema::hasTable('sprints')) {
            Schema::create('sprints', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->string('name');
                $table->text('goal')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('status')->default('future'); // 'future', 'active', 'completed'
                $table->timestamps();
            });
        }

        // 3. Upgrade tasks table with Jira fields
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table) {
                if (!Schema::hasColumn('tasks', 'issue_key')) {
                    $table->string('issue_key', 20)->nullable()->after('project_id');
                }
                if (!Schema::hasColumn('tasks', 'issue_type')) {
                    $table->string('issue_type', 20)->default('task')->after('issue_key'); // 'epic', 'story', 'task', 'bug'
                }
                if (!Schema::hasColumn('tasks', 'story_points')) {
                    $table->integer('story_points')->nullable()->after('category');
                }
                if (!Schema::hasColumn('tasks', 'sprint_id')) {
                    $table->foreignId('sprint_id')->nullable()->after('story_points')->constrained('sprints')->nullOnDelete();
                }
                if (!Schema::hasColumn('tasks', 'epic_id')) {
                    $table->foreignId('epic_id')->nullable()->after('sprint_id')->constrained('tasks')->nullOnDelete();
                }
                if (!Schema::hasColumn('tasks', 'start_date')) {
                    $table->date('start_date')->nullable()->after('due_date');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign(['sprint_id']);
                $table->dropForeign(['epic_id']);
                $table->dropColumn(['issue_key', 'issue_type', 'story_points', 'sprint_id', 'epic_id', 'start_date']);
            });
        }

        Schema::dropIfExists('sprints');

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'key')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropColumn('key');
            });
        }
    }
};
