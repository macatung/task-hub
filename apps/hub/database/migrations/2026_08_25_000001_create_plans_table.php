<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 50)->unique();
            $table->string('name', 100);
            $table->string('tagline', 255)->nullable();
            $table->text('description')->nullable();
            $table->decimal('price_monthly', 8, 2)->default(0.00);
            $table->decimal('price_yearly', 8, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->unsignedInteger('max_runners')->nullable();
            $table->unsignedInteger('max_seats')->nullable();
            $table->unsignedInteger('max_projects')->nullable();
            $table->json('features');
            $table->json('limits');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_popular')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
