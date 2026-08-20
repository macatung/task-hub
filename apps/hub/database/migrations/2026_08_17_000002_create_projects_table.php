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
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('tagline');
            $table->text('description');
            $table->string('category')->default('fullstack'); // fullstack, creative, ai-web3, tools
            $table->string('cover_gradient')->default('from-emerald-950 via-teal-900 to-slate-950');
            $table->json('tags')->nullable();
            $table->json('tech_stack')->nullable();
            $table->json('metrics')->nullable();
            $table->json('architecture_highlights')->nullable();
            $table->text('midnight_fact')->nullable();
            $table->string('live_url')->nullable();
            $table->string('github_url')->nullable();
            $table->boolean('featured')->default(false);
            $table->integer('order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
