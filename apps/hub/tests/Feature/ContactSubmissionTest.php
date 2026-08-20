<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\ContactSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class ContactSubmissionTest extends TestCase
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
     * @tier: 1
     * @feature: F23_DB_SCHEMA, F24_BACKEND_CTRL
     * Test valid submission creates database record, captures IP/UA, and redirects with session flash.
     */
    public function test_valid_contact_submission_persists_to_database_and_redirects(): void
    {
        $payload = [
            'name' => 'Midnight Alchemist',
            'email' => 'alchemist@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => '1 Ly Cà Phê Muối Nửa Đêm',
            'message' => 'Seeking full-stack consulting for distributed nocturnal web platform.',
        ];

        $response = $this->from('/')
            ->withServerVariables(['REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'NocturnalTestRunner/1.0'])
            ->post('/contact', $payload);

        $response->assertStatus(302);
        $response->assertRedirect('/');
        $response->assertSessionHas('flash.reference_id');
        $response->assertSessionHas('flash.success');
        $response->assertSessionHas('success');
        $response->assertSessionHas('reference_id');

        // Verify database persistence
        $this->assertDatabaseCount('contact_submissions', 1);
        $this->assertDatabaseHas('contact_submissions', [
            'name' => 'Midnight Alchemist',
            'email' => 'alchemist@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => '1 Ly Cà Phê Muối Nửa Đêm',
            'ip_address' => '127.0.0.1',
        ]);

        $submission = ContactSubmission::first();
        $this->assertNotNull($submission);
        $this->assertMatchesRegularExpression('/^SUMMON-[A-Z0-9]{4,8}$/', $submission->reference_id);
    }

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     * Backward-compatible alias for valid submission assertion.
     */
    public function test_valid_contact_submission_persists_and_redirects(): void
    {
        $payload = [
            'name' => 'Midnight Alchemist',
            'email' => 'alchemist@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => 'Cà phê muối 2 shot',
            'message' => 'Seeking full-stack consulting for distributed nocturnal web platform.',
        ];

        $response = $this->post('/contact', $payload);

        $response->assertStatus(302);
        $response->assertSessionHas('flash.reference_id');
        $response->assertSessionHas('flash.success');
    }

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     * Test valid submission via /summon route alias.
     */
    public function test_valid_submission_via_summon_route_alias(): void
    {
        $payload = [
            'name' => 'Summoner X',
            'email' => 'summoner@realm.org',
            'project_type' => 'Creative UI/UX & Web Audio',
            'coffee_offering' => 'Cold Brew Robusta 100%',
            'message' => 'Synthesizing procedural audio web canvas magic.',
        ];

        $response = $this->post('/summon', $payload);

        $response->assertStatus(302);
        $response->assertSessionHas('success');
        $response->assertSessionHas('reference_id');
        $response->assertSessionHas('flash.success');
        $response->assertSessionHas('flash.reference_id');
        $this->assertDatabaseHas('contact_submissions', [
            'email' => 'summoner@realm.org',
        ]);
    }

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     * Test missing required fields fail validation with 302 redirect and session error bags.
     */
    public function test_missing_required_fields_fails_validation(): void
    {
        $response = $this->post('/contact', [
            'name' => '',
            'email' => '',
            'message' => '',
        ]);

        $response->assertStatus(302);
        $response->assertSessionHasErrors(['name', 'email', 'message']);
        $this->assertDatabaseCount('contact_submissions', 0);
    }

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     * Test invalid email formats are rejected.
     */
    public function test_invalid_email_format_fails_validation(): void
    {
        $invalidEmails = ['plainaddress', 'missingdomain@', '@missingusername.com', 'spaces in@mail.com'];

        foreach ($invalidEmails as $email) {
            $response = $this->post('/contact', [
                'name' => 'Valid Name',
                'email' => $email,
                'project_type' => 'Other Quest',
                'coffee_offering' => 'Trà Đào Cam Sả',
                'message' => 'Valid message exceeding minimum length of ten characters.',
            ]);

            $response->assertSessionHasErrors(['email']);
        }
    }

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     * Test short message under 10 characters fails min validation.
     */
    public function test_short_message_fails_minimum_length_validation(): void
    {
        $response = $this->post('/contact', [
            'name' => 'Valid Name',
            'email' => 'valid@macatung.dev',
            'project_type' => 'Creative UI/UX & Web Audio',
            'coffee_offering' => 'Trà Đào Cam Sả',
            'message' => 'Too short', // 9 chars
        ]);

        $response->assertSessionHasErrors(['message']);
        $this->assertDatabaseCount('contact_submissions', 0);
    }

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     * Test invalid project type is rejected.
     */
    public function test_invalid_project_type_fails_validation(): void
    {
        $response = $this->post('/contact', [
            'name' => 'Valid Name',
            'email' => 'valid@macatung.dev',
            'project_type' => 'Invalid Mystery Type That Is Not In Allowed List',
            'coffee_offering' => 'Cold Brew Robusta 100%',
            'message' => 'Detailed message exceeding the minimum requirement of ten characters.',
        ]);

        $response->assertSessionHasErrors(['project_type']);
    }

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     * Test invalid coffee offering is rejected when exceeding max length.
     */
    public function test_invalid_coffee_offering_fails_validation(): void
    {
        $response = $this->post('/contact', [
            'name' => 'Valid Name',
            'email' => 'valid@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => str_repeat('C', 256),
            'message' => 'Detailed message exceeding the minimum requirement of ten characters.',
        ]);

        $response->assertSessionHasErrors(['coffee_offering']);
    }

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     * Test maximum character length boundaries for name, email, and message.
     */
    public function test_field_maximum_length_constraints(): void
    {
        // Name > 255 chars
        $responseName = $this->post('/contact', [
            'name' => str_repeat('A', 256),
            'email' => 'valid@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => 'Cold Brew Robusta 100%',
            'message' => 'Valid message exceeding 10 characters.',
        ]);
        $responseName->assertSessionHasErrors(['name']);

        // Message > 5000 chars
        $responseMsg = $this->post('/contact', [
            'name' => 'Valid Name',
            'email' => 'valid@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => 'Cold Brew Robusta 100%',
            'message' => str_repeat('M', 5001),
        ]);
        $responseMsg->assertSessionHasErrors(['message']);
    }

    /**
     * @tier: 2
     * @feature: F23_DB_SCHEMA
     * Test long message (up to 4,500 characters) is accepted without truncation.
     */
    public function test_long_message_within_limit_passes(): void
    {
        $longMessage = str_repeat('Midnight architecture excellence. ', 100); // ~3,500 chars

        $response = $this->post('/contact', [
            'name' => 'Architect',
            'email' => 'architect@macatung.dev',
            'project_type' => 'Tech Lead / Architecture Consulting',
            'coffee_offering' => 'Espresso Đậm Đặc Double Shot',
            'message' => $longMessage,
        ]);

        $response->assertSessionDoesntHaveErrors();
        $response->assertStatus(302);
        $this->assertDatabaseHas('contact_submissions', [
            'email' => 'architect@macatung.dev',
            'message' => trim($longMessage),
        ]);
    }

    /**
     * @tier: 2
     * @feature: F23_DB_SCHEMA, F24_BACKEND_CTRL
     * Test special characters and SQL strings are safely stored without crash or injection.
     */
    public function test_special_characters_and_sql_strings_handled_safely(): void
    {
        $payload = [
            'name' => 'O\'Connor <script>alert(1)</script>',
            'email' => 'special+filter@sub.domain.co',
            'project_type' => 'Other Quest',
            'coffee_offering' => '1 Ly Cà Phê Muối Nửa Đêm',
            'message' => 'DROP TABLE contact_submissions; SELECT * FROM users WHERE "1"="1"; -- comment',
        ];

        $response = $this->post('/contact', $payload);

        $response->assertStatus(302);
        $this->assertDatabaseHas('contact_submissions', [
            'email' => 'special+filter@sub.domain.co',
            'name' => 'O\'Connor <script>alert(1)</script>',
        ]);
    }

    /**
     * @tier: 1
     * @feature: F01_FOUNDATION, F24_BACKEND_CTRL
     * Test Inertia session flash is properly shared with client upon subsequent visit.
     */
    public function test_inertia_receives_flash_props_after_submission(): void
    {
        $payload = [
            'name' => 'Inertia Tester',
            'email' => 'inertia@macatung.dev',
            'project_type' => 'AI Agents & Automation',
            'coffee_offering' => 'Cold Brew Robusta 100%',
            'message' => 'Testing Inertia protocol flash payload delivery.',
        ];

        // Post submission from home page
        $postResponse = $this->from('/')->post('/contact', $payload);
        $postResponse->assertStatus(302);

        $refId = session('reference_id');
        $this->assertNotNull($refId);

        $headers = [
            'X-Inertia' => 'true',
        ];
        if ($version = $this->getInertiaVersion()) {
            $headers['X-Inertia-Version'] = $version;
        }

        // Follow redirect to home page with X-Inertia header
        $inertiaResponse = $this->get('/', $headers);

        $inertiaResponse->assertStatus(200);
        $inertiaResponse->assertJsonPath('props.flash.reference_id', $refId);
        $this->assertStringContainsString('Tín hiệu đã được truyền đi qua màn đêm', $inertiaResponse->json('props.flash.success'));
    }
}
