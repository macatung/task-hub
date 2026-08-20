<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('provider', 40);
            $table->string('agent_session_id', 191)->nullable();
            $table->string('repository', 255)->nullable();
            $table->string('branch', 255)->nullable();
            $table->string('commit_sha', 80)->nullable();
            $table->string('pull_request_url', 500)->nullable();
            $table->string('status', 30)->default('queued');
            $table->string('run_type', 30)->default('implementation');
            $table->string('context_hash', 128)->nullable();
            $table->string('instruction_hash', 128)->nullable();
            $table->text('summary')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['provider', 'status']);
            $table->index('agent_session_id');
        });

        Schema::create('verification_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_run_id')->constrained('agent_runs')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->string('evidence_type', 40);
            $table->string('status', 20)->default('passed');
            $table->string('command', 500)->nullable();
            $table->text('summary')->nullable();
            $table->string('artifact_url', 500)->nullable();
            $table->string('commit_sha', 80)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['agent_run_id', 'status']);
        });

        Schema::create('agent_run_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_run_id')->constrained('agent_runs')->cascadeOnDelete();
            $table->uuid('event_id')->unique();
            $table->string('event_type', 60);
            $table->string('status', 30)->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['agent_run_id', 'occurred_at']);
        });

        Schema::create('github_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('provider_event_id')->unique();
            $table->string('event_name', 80);
            $table->string('repository', 255)->nullable();
            $table->json('payload');
            $table->timestamp('occurred_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('github_events');
        Schema::dropIfExists('agent_run_events');
        Schema::dropIfExists('verification_evidence');
        Schema::dropIfExists('agent_runs');
    }
};
