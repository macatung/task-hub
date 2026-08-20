<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 40);
            $table->string('title');
            $table->string('url', 1000)->nullable();
            $table->string('repository_path', 500)->nullable();
            $table->string('version', 100)->nullable();
            $table->string('content_hash', 64)->nullable();
            $table->string('status', 20)->default('active');
            $table->string('owner', 120)->nullable();
            $table->string('access_level', 20)->default('team');
            $table->json('tags')->nullable();
            $table->timestamp('source_updated_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'document_type', 'title']);
            $table->index(['project_id', 'status']);
        });

        Schema::create('task_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_document_id')->constrained('project_documents')->cascadeOnDelete();
            $table->boolean('is_required')->default(false);
            $table->string('purpose', 500)->nullable();
            $table->timestamps();
            $table->unique(['task_id', 'project_document_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_documents');
        Schema::dropIfExists('project_documents');
    }
};
