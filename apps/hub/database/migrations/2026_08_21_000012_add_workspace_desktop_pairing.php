<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('desktop_pairing_sessions', function (Blueprint $table) {
            $table->foreignId('workspace_id')->nullable()->after('project_id')->constrained('workspaces')->nullOnDelete();
            $table->string('workspace_token_hash', 128)->nullable()->after('code_hash')->index();
        });
        Schema::table('desktop_pairing_sessions', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('desktop_pairing_sessions', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->dropColumn(['workspace_id', 'workspace_token_hash']);
        });
    }
};
