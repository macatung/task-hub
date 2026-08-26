<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('client_request_id', 128)->nullable()->after('workspace_id');
            $table->unique(['project_id', 'client_request_id'], 'tasks_project_client_request_unique');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropUnique('tasks_project_client_request_unique');
            $table->dropColumn('client_request_id');
        });
    }
};
