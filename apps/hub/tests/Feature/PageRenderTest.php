<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;
use Inertia\Testing\AssertableInertia as Assert;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PageRenderTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the home page root route returns 200 HTTP OK for guest.
     */
    public function test_home_page_returns_200_status(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
    }

    /**
     * Test that the home page renders the Inertia "Hub/Index" SaaS landing component.
     */
    public function test_home_page_renders_hub_inertia_component(): void
    {
        $response = $this->get('/');

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Hub/Index')
            ->has('stats')
        );
    }

    /**
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
     * Test that accessing /tasks without authentication redirects to GitHub OAuth.
     */
    public function test_tasks_workspace_requires_authentication(): void
    {
        $response = $this->get('/tasks');
        $response->assertRedirect('/auth/github');
    }

    /**
     * Test that authenticated user can access /tasks workspace.
     */
    public function test_authenticated_user_can_access_workspace(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/tasks');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Tasks/Index')
            ->has('tasks')
            ->has('projects')
        );
    }
}
