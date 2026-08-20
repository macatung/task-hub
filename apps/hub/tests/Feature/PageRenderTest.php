<?php

namespace Tests\Feature;

use Tests\TestCase;
use Inertia\Testing\AssertableInertia as Assert;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PageRenderTest extends TestCase
{
    use RefreshDatabase;
    /**
     * @tier: 1
     * @feature: F01_FOUNDATION
     * Test that the home page root route returns 200 HTTP OK.
     */
    public function test_home_page_returns_200_status(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
    }

    /**
     * @tier: 1
     * @feature: F01_FOUNDATION
     * Test that the home page renders the Inertia "Home" component with title.
     */
    public function test_home_page_renders_home_inertia_component(): void
    {
        $response = $this->get('/');

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->has('title')
        );
    }

    /**
     * @tier: 1
     * @feature: F01_FOUNDATION
     * Test that Inertia shared props include appName and flash bag.
     */
    public function test_inertia_shares_global_props(): void
    {
        $response = $this->get('/');

        $response->assertInertia(fn (Assert $page) => $page
            ->has('appName')
            ->has('flash')
        );
    }

    /**
     * @tier: 2
     * @feature: F01_FOUNDATION
     * Test that requesting with X-Inertia header receives Inertia JSON payload.
     */
    public function test_inertia_header_returns_json_response(): void
    {
        $middleware = app(\App\Http\Middleware\HandleInertiaRequests::class);
        $version = $middleware->version(\Illuminate\Http\Request::create('/'));

        $headers = ['X-Inertia' => 'true'];
        if ($version) {
            $headers['X-Inertia-Version'] = $version;
        }

        $response = $this->get('/', $headers);

        $response->assertStatus(200);
        $response->assertHeader('X-Inertia', 'true');
        $response->assertJsonPath('component', 'Home');
    }

    /**
     * @tier: 2
     * @feature: F01_FOUNDATION
     * Test that non-existent routes return 404 Not Found.
     */
    public function test_non_existent_route_returns_404(): void
    {
        $response = $this->get('/non-existent-spectral-dimension');
        $response->assertStatus(404);
    }
}
