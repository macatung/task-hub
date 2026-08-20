<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('type')->default('work')->after('category'); // 'work' or 'personal'
            $table->string('color')->nullable()->after('type'); // e.g. '#00f5a0', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899'
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['type', 'color']);
        });
    }
};