<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FoundationChallengeTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to get current asset version.
     */
    protected function getInertiaVersion(): ?string
    {
        $middleware = app(HandleInertiaRequests::class);
        return $middleware->version(Request::create('/'));
    }

    /**
     * Test standard HTML response includes Inertia container and required meta tags.
     */
    public function test_standard_http_request_renders_inertia_root_template(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $this->assertMatchesRegularExpression('/text\/html;\s*charset=UTF-8/i', $response->headers->get('Content-Type'));
        
        // Assert HTML structure and asset tags
        $content = $response->getContent();
        $this->assertStringContainsString('<div id="app" data-page="', $content);
        $this->assertStringContainsString('<!DOCTYPE html>', $content);
        $this->assertStringContainsString('<title inertia>Macatung Portfolio</title>', $content);
        $this->assertStringContainsString('fonts.googleapis.com', $content);
        $this->assertMatchesRegularExpression('/<link[^>]+href="[^"]*build\/assets\/app-[^"]+\.css"|<link[^>]+href="[^"]*resources\/css\/app\.css"/', $content);
        $this->assertMatchesRegularExpression('/<script[^>]+src="[^"]*build\/assets\/app-[^"]+\.js"|<script[^>]+src="[^"]*resources\/js\/app\.ts"/', $content);
    }

    /**
     * Test Inertia protocol header X-Inertia: true with matching version returns pure JSON.
     */
    public function test_inertia_header_request_returns_pure_json_payload(): void
    {
        $headers = [
            'X-Inertia' => 'true',
        ];
        if ($version = $this->getInertiaVersion()) {
            $headers['X-Inertia-Version'] = $version;
        }

        $response = $this->get('/', $headers);

        $response->assertStatus(200);
        $response->assertHeader('X-Inertia', 'true');
        $response->assertHeader('Vary', 'X-Inertia');
        
        $response->assertJson([
            'component' => 'Home',
            'url' => '/',
            'props' => [
                'title' => 'Code at midnight',
                'appName' => config('app.name', 'Macatung Portfolio'),
                'flash' => [
                    'success' => null,
                    'error' => null,
                    'reference_id' => null,
                ],
                'auth' => [
                    'user' => null,
                ],
            ],
        ]);
    }

    /**
     * Test Inertia protocol asset version mismatch triggers 409 Conflict with X-Inertia-Location.
     */
    public function test_inertia_asset_version_mismatch_returns_409_conflict(): void
    {
        $response = $this->get('/', [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => 'outdated-asset-hash-999',
        ]);

        $response->assertStatus(409);
        $response->assertHeader('X-Inertia-Location', url('/'));
    }

    /**
     * Test HandleInertiaRequests evaluates flash data lazily from session.
     */
    public function test_inertia_evaluates_and_shares_flash_session_data(): void
    {
        $flashData = [
            'success' => 'Tín hiệu đã được truyền đi qua màn đêm! ☕✨',
            'error' => 'Phép thuật thất bại: Lỗi kết nối.',
            'reference_id' => 'SUMMON-ALPHA-777',
        ];

        $headers = ['X-Inertia' => 'true'];
        if ($version = $this->getInertiaVersion()) {
            $headers['X-Inertia-Version'] = $version;
        }

        $response = $this->withSession($flashData)->get('/', $headers);

        $response->assertStatus(200);
        $response->assertJsonPath('props.flash.success', $flashData['success']);
        $response->assertJsonPath('props.flash.error', $flashData['error']);
        $response->assertJsonPath('props.flash.reference_id', $flashData['reference_id']);
    }

    /**
     * Test HandleInertiaRequests evaluates flash data via fluent Inertia assertion.
     */
    public function test_inertia_fluent_assertion_with_flash_session(): void
    {
        $flashData = [
            'success' => 'Bùa chú kích hoạt thành công!',
            'error' => null,
            'reference_id' => 'SUMMON-BETA-888',
        ];

        $response = $this->withSession($flashData)->get('/');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->where('flash.success', 'Bùa chú kích hoạt thành công!')
            ->where('flash.error', null)
            ->where('flash.reference_id', 'SUMMON-BETA-888')
            ->has('title')
            ->has('appName')
        );
    }

    /**
     * Test HandleInertiaRequests securely shares authenticated user without leaking secrets.
     */
    public function test_inertia_shares_authenticated_user_safely(): void
    {
        $user = new User([
            'name' => 'Midnight Sorcerer',
            'email' => 'sorcerer@macatung.dev',
            'password' => bcrypt('supersecret'),
        ]);
        $user->id = 42;

        $headers = ['X-Inertia' => 'true'];
        if ($version = $this->getInertiaVersion()) {
            $headers['X-Inertia-Version'] = $version;
        }

        $response = $this->actingAs($user)->get('/', $headers);

        $response->assertStatus(200);
        $response->assertJsonPath('props.auth.user.id', 42);
        $response->assertJsonPath('props.auth.user.name', 'Midnight Sorcerer');
        $response->assertJsonPath('props.auth.user.email', 'sorcerer@macatung.dev');

        // Verify sensitive fields are not leaked
        $json = $response->json();
        $this->assertArrayNotHasKey('password', $json['props']['auth']['user']);
        $this->assertArrayNotHasKey('remember_token', $json['props']['auth']['user']);
    }

    /**
     * Test partial reload only fetches specified props.
     */
    public function test_inertia_partial_reload_support(): void
    {
        $headers = [
            'X-Inertia' => 'true',
            'X-Inertia-Partial-Component' => 'Home',
            'X-Inertia-Partial-Data' => 'title',
        ];
        if ($version = $this->getInertiaVersion()) {
            $headers['X-Inertia-Version'] = $version;
        }

        $response = $this->get('/', $headers);

        $response->assertStatus(200);
        $response->assertJsonPath('props.title', 'Code at midnight');
    }

    /**
     * Test application health endpoint /up.
     */
    public function test_health_check_endpoint(): void
    {
        $response = $this->get('/up');
        $response->assertStatus(200);
    }

    /**
     * Test 404 behavior for unregistered route.
     */
    public function test_unregistered_route_returns_404(): void
    {
        $response = $this->get('/non-existent-challenge-route-404');
        $response->assertStatus(404);
    }

    /**
     * Test HTTP method constraint: POST to GET-only route.
     */
    public function test_invalid_http_method_on_home_route(): void
    {
        $response = $this->post('/', []);
        $response->assertStatus(405);
    }
}
