<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('workspace_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20)->default('developer');
            $table->timestamps();
            $table->unique(['workspace_id', 'user_id']);
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('workspace_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        Schema::create('legacy_imports', function (Blueprint $table) {
            $table->id();
            $table->string('source', 100);
            $table->string('entity_type', 100);
            $table->unsignedBigInteger('legacy_id');
            $table->unsignedBigInteger('target_id')->nullable();
            $table->json('checksum')->nullable();
            $table->timestamps();
            $table->unique(['source', 'entity_type', 'legacy_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_imports');
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('workspace_id');
        });
        Schema::dropIfExists('workspace_members');
        Schema::dropIfExists('workspaces');
    }
};
