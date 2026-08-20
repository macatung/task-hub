<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\ContactSubmission;
use App\Models\Experience;
use App\Models\PageView;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SiteSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCmsTest extends TestCase
{
    use RefreshDatabase;

    protected function authenticateAdmin(): void
    {
        SiteSetting::set('admin_password', 'macatung@midnight2026');
        $this->withSession(['admin_authenticated' => true]);
    }

    public function test_guest_is_redirected_to_admin_login(): void
    {
        $response = $this->get('/admin');
        $response->assertRedirect('/admin/login');
    }

    public function test_admin_can_login_with_valid_password(): void
    {
        SiteSetting::set('admin_password', 'secret_midnight_key');

        $response = $this->post('/admin/login', [
            'password' => 'secret_midnight_key',
        ]);

        $response->assertRedirect('/admin');
        $this->assertTrue(session('admin_authenticated'));
    }

    public function test_admin_login_fails_with_invalid_password(): void
    {
        SiteSetting::set('admin_password', 'correct_key');

        $response = $this->post('/admin/login', [
            'password' => 'wrong_password_123',
        ]);

        $response->assertSessionHasErrors('password');
        $this->assertFalse(session()->get('admin_authenticated', false));
    }

    public function test_admin_can_logout(): void
    {
        $this->authenticateAdmin();

        $response = $this->post('/admin/logout');
        $response->assertRedirect('/admin/login');
        $this->assertFalse(session()->get('admin_authenticated', false));
    }

    public function test_admin_dashboard_renders_successfully(): void
    {
        $this->authenticateAdmin();

        ContactSubmission::create([
            'reference_id' => 'SUMMON-TEST1',
            'name' => 'Tech Lead Minh',
            'email' => 'minh@startup.vn',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => '1 Ly Cà Phê Muối Nửa Đêm',
            'message' => 'Cần tư vấn kiến trúc microservices và xây dựng MVP.',
        ]);

        $response = $this->get('/admin');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Dashboard')
            ->has('stats')
            ->has('recent_contacts')
            ->where('stats.total_contacts', 1)
        );
    }

    public function test_admin_analytics_dashboard_renders(): void
    {
        $this->authenticateAdmin();

        PageView::create([
            'session_id' => 'sess_test_123',
            'url' => '/',
            'device_type' => 'desktop',
            'browser' => 'Chrome',
            'is_midnight' => true,
        ]);

        $response = $this->get('/admin/analytics');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Analytics/Index')
            ->has('overview')
            ->has('daily_trend')
            ->has('hourly_stats')
            ->has('device_breakdown')
            ->where('overview.total_pageviews', 1)
        );
    }

    public function test_analytics_beacon_event_api(): void
    {
        $response = $this->postJson('/api/analytics/event', [
            'event_type' => 'hop_mascot',
            'event_data' => ['hop_count' => 5],
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('analytics_events', [
            'event_type' => 'hop_mascot',
        ]);
    }

    public function test_visitor_traffic_middleware_logs_public_pageview(): void
    {
        $this->get('/');

        $this->assertDatabaseHas('page_views', [
            'url' => '/',
        ]);
    }

    public function test_skills_crud_operations(): void
    {
        $this->authenticateAdmin();

        // 1. Create
        $response = $this->post('/admin/skills', [
            'name' => 'Rust WASM Engine',
            'category' => 'backend',
            'level' => 95,
            'rune' => '🦀',
            'tag' => 'High-Performance',
            'order' => 1,
        ]);
        $response->assertRedirect('/admin/skills');
        $this->assertDatabaseHas('skills', ['name' => 'Rust WASM Engine']);

        $skill = Skill::where('name', 'Rust WASM Engine')->first();

        // 2. Update
        $this->put("/admin/skills/{$skill->id}", [
            'name' => 'Rust WASM (Updated)',
            'category' => 'backend',
            'level' => 99,
            'rune' => '🦀',
            'tag' => 'Ultra-Fast',
            'order' => 2,
        ])->assertRedirect('/admin/skills');

        $this->assertDatabaseHas('skills', ['name' => 'Rust WASM (Updated)', 'level' => 99]);

        // 3. Delete
        $this->delete("/admin/skills/{$skill->id}")->assertRedirect('/admin/skills');
        $this->assertDatabaseMissing('skills', ['id' => $skill->id]);
    }

    public function test_experiences_crud_operations(): void
    {
        $this->authenticateAdmin();

        // 1. Create
        $response = $this->post('/admin/experiences', [
            'role' => 'Principal Architect',
            'company' => 'Starlight Cloud',
            'period' => '2025 — 2026',
            'type' => 'Full-Time',
            'location' => 'Remote',
            'summary' => 'Architected edge computing clusters.',
            'achievements' => ['Sub-millisecond routing'],
            'technologies' => ['Rust', 'Laravel', 'Vue 3'],
            'order' => 1,
        ]);
        $response->assertRedirect('/admin/experiences');
        $this->assertDatabaseHas('experiences', ['role' => 'Principal Architect']);

        $exp = Experience::where('role', 'Principal Architect')->first();

        // 2. Delete
        $this->delete("/admin/experiences/{$exp->id}")->assertRedirect('/admin/experiences');
        $this->assertDatabaseMissing('experiences', ['id' => $exp->id]);
    }

    public function test_articles_crud_operations(): void
    {
        $this->authenticateAdmin();

        // 1. Create
        $response = $this->post('/admin/articles', [
            'title' => 'Nghệ Thuật Lập Trình Lúc Nửa Đêm',
            'slug' => 'nghe-thuat-code-nua-dem',
            'excerpt' => 'Vùng tĩnh lặng khi thành phố ngủ.',
            'content' => '## Markdown Title\nNội dung bài viết...',
            'tags' => ['Culture', 'Midnight'],
            'reading_time_min' => 4,
            'is_published' => true,
        ]);
        $response->assertRedirect('/admin/articles');
        $this->assertDatabaseHas('articles', ['slug' => 'nghe-thuat-code-nua-dem']);

        $article = Article::where('slug', 'nghe-thuat-code-nua-dem')->first();

        // 2. Delete
        $this->delete("/admin/articles/{$article->id}")->assertRedirect('/admin/articles');
        $this->assertDatabaseMissing('articles', ['id' => $article->id]);
    }

    public function test_settings_update(): void
    {
        $this->authenticateAdmin();

        $response = $this->put('/admin/settings', [
            'slogan' => 'Code at midnight. Deploy at dawn.',
            'site_name' => 'macatung.dev',
            'contact_email' => 'contact@macatung.dev',
        ]);

        $response->assertRedirect('/admin/settings');
        $this->assertEquals('Code at midnight. Deploy at dawn.', SiteSetting::get('slogan'));
        $this->assertEquals('contact@macatung.dev', SiteSetting::get('contact_email'));
    }
}
