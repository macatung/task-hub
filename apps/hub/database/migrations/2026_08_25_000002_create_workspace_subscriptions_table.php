<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('billing_cycle', 20)->default('monthly');
            $table->string('status', 30)->default('active');
            $table->unsignedInteger('seat_quantity')->default(1);
            $table->unsignedInteger('extra_runners_quantity')->default(0);
            $table->timestamp('current_period_starts_at')->useCurrent();
            $table->timestamp('current_period_ends_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->string('payment_method', 50)->nullable()->default('simulation');
            $table->string('external_reference_id', 191)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'status'], 'idx_ws_sub_workspace_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_subscriptions');
    }
};
