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
        // 1. Page Views Table (Traffic Analytics)
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->index();
            $table->string('ip_hash', 64)->nullable()->index();
            $table->string('url', 255)->default('/');
            $table->string('referrer', 255)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('device_type', 32)->default('desktop'); // desktop, mobile, tablet
            $table->string('browser', 32)->default('Chrome');
            $table->boolean('is_midnight')->default(false); // Visited between 00:00 - 05:00 AM
            $table->timestamp('created_at')->useCurrent()->index();
        });

        // 2. Analytics Events Table (Interactions tracking)
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->string('session_id', 64)->index();
            $table->string('event_type', 64)->index(); // hop_mascot, cv_download, cli_executed, talisman_blessed, contact_submitted
            $table->json('event_data')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });

        // 3. Skills Table (Tech Arsenal CMS)
        Schema::create('skills', function (Blueprint $table) {
            $table->id();
            $table->string('name', 128);
            $table->string('category', 64)->default('frontend'); // frontend, backend, cloud, ai
            $table->integer('level')->default(90); // 1-100%
            $table->string('rune', 32)->default('⚡');
            $table->string('tag', 64)->default('Core');
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 4. Experiences Table (Career Chronicles CMS)
        Schema::create('experiences', function (Blueprint $table) {
            $table->id();
            $table->string('role', 128);
            $table->string('company', 128);
            $table->string('period', 64);
            $table->string('type', 64)->default('Full-Time');
            $table->string('location', 64)->default('Remote / Ho Chi Minh City');
            $table->text('summary');
            $table->json('achievements')->nullable();
            $table->json('technologies')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });

        // 5. Articles Table (Midnight Tech Notes CMS)
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->string('excerpt', 500)->nullable();
            $table->longText('content');
            $table->json('tags')->nullable();
            $table->integer('reading_time_min')->default(5);
            $table->boolean('is_published')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        // 6. Site Settings Table (Portfolio Profile & Meta CMS)
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 128)->unique();
            $table->text('value')->nullable();
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_settings');
        Schema::dropIfExists('articles');
        Schema::dropIfExists('experiences');
        Schema::dropIfExists('skills');
        Schema::dropIfExists('analytics_events');
        Schema::dropIfExists('page_views');
    }
};
