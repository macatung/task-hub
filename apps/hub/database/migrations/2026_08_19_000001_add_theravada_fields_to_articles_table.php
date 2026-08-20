<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->string('site_domain', 32)->default('main')->index()->after('id');
            $table->string('category', 64)->nullable()->index()->after('slug');
            $table->string('pali_title', 255)->nullable()->after('title');
            $table->string('author', 128)->nullable()->after('excerpt');
            $table->json('pali_terms')->nullable()->after('tags');
            $table->string('audio_chanting_url', 500)->nullable()->after('pali_terms');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn([
                'site_domain',
                'category',
                'pali_title',
                'author',
                'pali_terms',
                'audio_chanting_url'
            ]);
        });
    }
};
