<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('version', 100);
            $table->string('environment', 30)->default('production');
            $table->string('status', 20)->default('deployed');
            $table->text('summary');
            $table->json('changes')->nullable();
            $table->string('commit_sha', 80)->nullable();
            $table->string('release_url', 1000)->nullable();
            $table->string('deployed_by', 120)->nullable();
            $table->timestamp('deployed_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'version', 'environment']);
            $table->index(['project_id', 'deployed_at']);
        });
    }

    public function down(): void { Schema::dropIfExists('project_releases'); }
};
