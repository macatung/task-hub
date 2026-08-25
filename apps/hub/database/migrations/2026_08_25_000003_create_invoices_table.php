<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number', 50)->unique();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained('workspace_subscriptions')->nullOnDelete();
            $table->string('plan_name', 100);
            $table->string('billing_cycle', 20);
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('USD');
            $table->string('status', 30)->default('paid');
            $table->string('billing_reason', 50);
            $table->string('description', 255);
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('period_start')->nullable();
            $table->timestamp('period_end')->nullable();
            $table->string('pdf_url', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('workspace_id', 'idx_invoices_workspace');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
