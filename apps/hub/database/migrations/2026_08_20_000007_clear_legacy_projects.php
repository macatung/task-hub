<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            DB::table('tasks')->whereNotNull('project_id')->delete();
            DB::table('sprints')->delete();
            DB::table('projects')->delete();
        });
    }
    public function down(): void {}
};
