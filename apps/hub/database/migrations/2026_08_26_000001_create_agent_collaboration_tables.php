<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('agent_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('agent_key', 120);
            $table->string('name', 120);
            $table->string('role', 80)->nullable();
            $table->string('provider', 40)->nullable();
            $table->string('model', 120)->nullable();
            $table->string('status', 32)->default('offline');
            $table->foreignId('active_run_id')->nullable()->constrained('agent_runs')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('status_updated_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'agent_key']);
            $table->index(['workspace_id', 'status']);
        });

        Schema::create('agent_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('thread_id')->index();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_agent_id')->nullable()->constrained('agent_profiles')->nullOnDelete();
            $table->foreignId('recipient_agent_id')->constrained('agent_profiles')->cascadeOnDelete();
            $table->string('subject', 200);
            $table->text('body');
            $table->string('status', 32)->default('queued');
            $table->json('payload')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();
            $table->index(['recipient_agent_id', 'status']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('agent_messages');
        Schema::dropIfExists('agent_profiles');
    }
};
