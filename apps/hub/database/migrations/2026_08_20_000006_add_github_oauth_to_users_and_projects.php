<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('github_id', 80)->nullable()->unique();
            $table->string('github_login', 255)->nullable();
            $table->string('github_avatar_url', 500)->nullable();
            $table->text('github_access_token')->nullable();
            $table->text('github_scopes')->nullable();
            $table->timestamp('github_connected_at')->nullable();
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
            $table->index(['user_id', 'github_repository']);
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['user_id', 'github_repository']);
            $table->dropColumn('user_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['github_id']);
            $table->dropColumn(['github_id', 'github_login', 'github_avatar_url', 'github_access_token', 'github_scopes', 'github_connected_at']);
        });
    }
};
