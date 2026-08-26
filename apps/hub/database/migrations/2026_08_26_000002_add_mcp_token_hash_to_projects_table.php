<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->char('task_hub_mcp_token_hash', 64)->nullable()->index()->after('task_hub_mcp_token');
        });

        DB::table('projects')->whereNotNull('task_hub_mcp_token')->orderBy('id')->each(function ($project) {
            try {
                $token = Crypt::decryptString($project->task_hub_mcp_token);
                DB::table('projects')->where('id', $project->id)->update([
                    'task_hub_mcp_token_hash' => hash('sha256', $token),
                ]);
            } catch (\Throwable) {
                // A malformed legacy token stays usable only when its project is
                // explicitly selected; it is never used for a global scan.
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['task_hub_mcp_token_hash']);
            $table->dropColumn('task_hub_mcp_token_hash');
        });
    }
};
