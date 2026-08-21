<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_runners', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('token_hash', 128)->unique();
            $table->string('hostname', 255)->nullable();
            $table->string('version', 40)->nullable();
            $table->json('capabilities')->nullable();
            $table->string('status', 30)->default('offline');
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['status', 'last_heartbeat_at']);
        });

        Schema::table('agent_runs', function (Blueprint $table) {
            $table->foreignId('runner_id')->nullable()->after('task_id')->constrained('agent_runners')->nullOnDelete();
            $table->string('execution_mode', 20)->default('desktop')->after('run_type');
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('lease_expires_at')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('cancel_requested_at')->nullable();
            $table->integer('exit_code')->nullable();
            $table->index(['execution_mode', 'status']);
            $table->index(['runner_id', 'lease_expires_at']);
        });

        Schema::create('agent_run_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_run_id')->constrained('agent_runs')->cascadeOnDelete();
            $table->unsignedBigInteger('sequence');
            $table->string('stream', 20)->default('stdout');
            $table->text('content');
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->unique(['agent_run_id', 'sequence']);
            $table->index(['agent_run_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_run_logs');
        Schema::table('agent_runs', function (Blueprint $table) {
            $table->dropForeign(['runner_id']);
            $table->dropColumn(['runner_id', 'execution_mode', 'claimed_at', 'lease_expires_at', 'queued_at', 'cancel_requested_at', 'exit_code']);
        });
        Schema::dropIfExists('agent_runners');
    }
};
