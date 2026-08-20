<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DesktopPairingTest extends TestCase
{
    use RefreshDatabase;

    public function test_pairing_approval_creates_and_releases_mcp_token_once(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'user_id' => $user->id,
            'slug' => 'pairing-project',
            'title' => 'Pairing project',
            'tagline' => 'Agent pairing',
            'description' => 'Desktop pairing test',
            'type' => 'work',
            'category' => 'tools',
        ]);

        $start = $this->postJson('/api/desktop/pairing/start', ['project_id' => $project->id])->assertCreated();
        $pairingId = $start->json('pairing_id');
        $secret = $start->json('device_secret');
        $code = $start->json('code');

        $this->actingAs($user)->post('/desktop/pairing/' . $pairingId . '/approve', ['code' => $code])->assertOk();

        $status = $this->withHeaders(['X-Desktop-Pairing-Secret' => $secret])
            ->getJson('/api/desktop/pairing/' . $pairingId . '/status')
            ->assertOk();
        $status->assertJsonPath('status', 'approved');
        $this->assertNotEmpty($status->json('mcp_token'));

        $this->withHeaders(['X-Desktop-Pairing-Secret' => $secret])
            ->getJson('/api/desktop/pairing/' . $pairingId . '/status')
            ->assertJsonPath('status', 'consumed')
            ->assertJsonMissingPath('mcp_token');
    }

    public function test_pairing_rejects_an_invalid_secret(): void
    {
        $project = Project::create([
            'slug' => 'pairing-secret-project',
            'title' => 'Pairing secret project',
            'tagline' => 'Agent pairing',
            'description' => 'Desktop pairing test',
            'type' => 'work',
            'category' => 'tools',
        ]);

        $start = $this->postJson('/api/desktop/pairing/start', ['project_id' => $project->id])->assertCreated();
        $this->withHeaders(['X-Desktop-Pairing-Secret' => 'wrong-secret'])
            ->getJson('/api/desktop/pairing/' . $start->json('pairing_id') . '/status')
            ->assertUnauthorized();
    }
}
