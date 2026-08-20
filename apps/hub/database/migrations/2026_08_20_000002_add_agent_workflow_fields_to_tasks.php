<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tasks')) return;

        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'acceptance_criteria')) {
                $table->text('acceptance_criteria')->nullable();
            }
            if (!Schema::hasColumn('tasks', 'definition_of_done')) {
                $table->text('definition_of_done')->nullable();
            }
            if (!Schema::hasColumn('tasks', 'risk_level')) {
                $table->string('risk_level', 20)->default('low');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('tasks')) {
            Schema::table('tasks', function (Blueprint $table) {
                foreach (['acceptance_criteria', 'definition_of_done', 'risk_level'] as $column) {
                    if (Schema::hasColumn('tasks', $column)) $table->dropColumn($column);
                }
            });
        }
    }
};
