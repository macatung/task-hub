<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceBillingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    private function createTenant(string $name = 'Acme Corp'): array
    {
        $user = User::factory()->create(['name' => $name . ' Owner']);
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => 'workspace-' . $user->id,
            'owner_id' => $user->id,
            'plan' => 'community',
            'agent_concurrency_limit' => 1,
        ]);
        $workspace->members()->attach($user->id, ['role' => 'owner']);

        return [$user, $workspace];
    }

    public function test_public_plans_api_returns_all_four_tiers(): void
    {
        $response = $this->getJson('/api/v1/plans')->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonCount(4, 'data');

        $slugs = collect($response->json('data'))->pluck('slug')->all();
        $this->assertEquals(['community', 'pro', 'team', 'enterprise'], $slugs);

        $pro = collect($response->json('data'))->firstWhere('slug', 'pro');
        $this->assertEquals(19.00, $pro['price_monthly']);
        $this->assertEquals(180.00, $pro['price_yearly']);
        $this->assertEquals(3, $pro['max_runners']);
        $this->assertTrue($pro['is_popular']);
    }

    public function test_workspace_subscription_show_returns_active_plan_and_usage(): void
    {
        [$user, $workspace] = $this->createTenant('Hacker Inc');

        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson('/api/v1/workspaces/' . $workspace->id . '/subscription')
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.subscription.plan_slug', 'community');
        $response->assertJsonPath('data.usage.runners.limit', 1);
        $response->assertJsonPath('data.usage.seats.active', 1);
        $response->assertJsonPath('data.usage.projects.limit', 3);
    }

    public function test_workspace_subscription_upgrade_generates_invoice_and_updates_concurrency(): void
    {
        [$user, $workspace] = $this->createTenant('Startup Team');

        $payload = [
            'plan_slug' => 'pro',
            'billing_cycle' => 'monthly',
            'seat_quantity' => 1,
            'extra_runners_quantity' => 0,
        ];

        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/workspaces/' . $workspace->id . '/subscription', $payload)
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.subscription.plan_slug', 'pro');
        $response->assertJsonPath('data.invoice.amount', 19.00);
        $response->assertJsonPath('data.invoice.status', 'paid');

        $this->assertDatabaseHas('workspaces', [
            'id' => $workspace->id,
            'plan' => 'pro',
            'agent_concurrency_limit' => 3,
        ]);

        $this->assertDatabaseHas('invoices', [
            'workspace_id' => $workspace->id,
            'plan_name' => 'Pro Developer',
            'amount' => 19.00,
            'status' => 'paid',
        ]);
    }

    public function test_workspace_subscription_cancel_marks_canceled_at(): void
    {
        [$user, $workspace] = $this->createTenant('Canceling Corp');

        // Upgrade first
        $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/workspaces/' . $workspace->id . '/subscription', [
                'plan_slug' => 'pro',
                'billing_cycle' => 'monthly',
            ])->assertOk();

        // Cancel
        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/workspaces/' . $workspace->id . '/subscription/cancel')
            ->assertOk();

        $response->assertJsonPath('success', true);

        $this->assertDatabaseHas('workspace_subscriptions', [
            'workspace_id' => $workspace->id,
            'status' => 'canceled',
        ]);
    }

    public function test_invoices_api_returns_transaction_history(): void
    {
        [$user, $workspace] = $this->createTenant('Invoice Co');

        // Upgrade twice to produce invoices
        $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/workspaces/' . $workspace->id . '/subscription', [
                'plan_slug' => 'pro',
                'billing_cycle' => 'monthly',
            ])->assertOk();

        $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->postJson('/api/v1/workspaces/' . $workspace->id . '/subscription', [
                'plan_slug' => 'team',
                'billing_cycle' => 'yearly',
            ])->assertOk();

        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson('/api/v1/workspaces/' . $workspace->id . '/invoices')
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonCount(2, 'data');
    }

    public function test_workspace_quota_endpoint_returns_lightweight_metrics(): void
    {
        [$user, $workspace] = $this->createTenant('Quota Lab');

        $response = $this->actingAs($user)
            ->withHeaders(['X-Workspace-Id' => $workspace->id])
            ->getJson('/api/v1/workspaces/' . $workspace->id . '/quota')
            ->assertOk();

        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.plan', 'community');
        $response->assertJsonPath('data.usage.runners.limit', 1);
        $response->assertJsonPath('data.usage.seats.limit', 1);
        $response->assertJsonPath('data.usage.projects.limit', 3);
    }
}
