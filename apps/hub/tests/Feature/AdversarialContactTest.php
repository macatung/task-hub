<?php

namespace Tests\Feature;

use App\Models\ContactSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdversarialContactTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to build a valid base payload.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    protected function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Alchemist Tester',
            'email' => 'alchemist@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => '1 Ly Cà Phê Muối Nửa Đêm',
            'message' => 'This is a valid test message with more than 10 characters.',
        ], $overrides);
    }

    /**
     * @tier: 5
     * @challenge: Message Boundary Analysis (9 chars vs 10 chars)
     */
    public function test_boundary_message_length_exact_9_fails_and_exact_10_passes(): void
    {
        // 9 characters (exact failure boundary)
        $payload9 = $this->validPayload(['message' => '123456789']);
        $response9 = $this->post('/contact', $payload9);
        $response9->assertSessionHasErrors(['message']);
        $this->assertDatabaseCount('contact_submissions', 0);

        // 10 characters (exact minimum success boundary)
        $payload10 = $this->validPayload(['message' => '1234567890']);
        $response10 = $this->post('/contact', $payload10);
        $response10->assertSessionDoesntHaveErrors();
        $response10->assertStatus(302);
        $this->assertDatabaseCount('contact_submissions', 1);
        $this->assertDatabaseHas('contact_submissions', [
            'message' => '1234567890',
        ]);
    }

    /**
     * @tier: 5
     * @challenge: Message Boundary Analysis (5000 chars vs 5001 chars)
     */
    public function test_boundary_message_length_exact_5000_passes_and_exact_5001_fails(): void
    {
        // 5000 characters (exact maximum allowed)
        $msg5000 = str_repeat('A', 5000);
        $payload5000 = $this->validPayload(['message' => $msg5000]);
        $response5000 = $this->post('/contact', $payload5000);
        $response5000->assertSessionDoesntHaveErrors();
        $response5000->assertStatus(302);
        $this->assertDatabaseCount('contact_submissions', 1);
        $this->assertDatabaseHas('contact_submissions', [
            'message' => $msg5000,
        ]);

        // 5001 characters (exact boundary exceed)
        $msg5001 = str_repeat('B', 5001);
        $payload5001 = $this->validPayload(['message' => $msg5001]);
        $response5001 = $this->post('/contact', $payload5001);
        $response5001->assertSessionHasErrors(['message']);
        $this->assertDatabaseCount('contact_submissions', 1); // still only the first 1
    }

    /**
     * @tier: 5
     * @challenge: Whitespace trimming and empty payload edge cases
     */
    public function test_whitespace_trimming_and_empty_payload_behavior(): void
    {
        // Empty payload
        $responseEmpty = $this->post('/contact', []);
        $responseEmpty->assertSessionHasErrors(['name', 'email', 'project_type', 'coffee_offering', 'message']);
        $this->assertDatabaseCount('contact_submissions', 0);

        // All whitespace fields
        $responseSpaces = $this->post('/contact', [
            'name' => '     ',
            'email' => '     ',
            'project_type' => '     ',
            'coffee_offering' => '     ',
            'message' => '               ', // 15 spaces
        ]);
        $responseSpaces->assertSessionHasErrors(['name', 'email', 'project_type', 'coffee_offering', 'message']);
        $this->assertDatabaseCount('contact_submissions', 0);

        // 9 characters + 10 padding spaces (total 19 chars raw, but 9 chars trimmed -> must fail)
        $responsePadded9 = $this->post('/contact', $this->validPayload([
            'message' => '   123456789   ',
        ]));
        $responsePadded9->assertSessionHasErrors(['message']);

        // 10 characters with whitespace padding -> must pass and be trimmed in DB
        $responsePadded10 = $this->post('/contact', $this->validPayload([
            'name' => '   Nocturnal Coder   ',
            'email' => '   padded@macatung.dev   ',
            'message' => '   1234567890   ',
        ]));
        $responsePadded10->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', [
            'name' => 'Nocturnal Coder',
            'email' => 'padded@macatung.dev',
            'message' => '1234567890',
        ]);
    }

    /**
     * @tier: 5
     * @challenge: Name and Email Boundary Limits (1, 255, 256 chars)
     */
    public function test_boundary_name_and_email_length_constraints(): void
    {
        // 1 char name -> passes
        $response1 = $this->post('/contact', $this->validPayload(['name' => 'X']));
        $response1->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', ['name' => 'X']);

        // 255 chars name -> passes
        $name255 = str_repeat('N', 255);
        $response255 = $this->post('/contact', $this->validPayload(['name' => $name255]));
        $response255->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', ['name' => $name255]);

        // 256 chars name -> fails
        $name256 = str_repeat('N', 256);
        $response256 = $this->post('/contact', $this->validPayload(['name' => $name256]));
        $response256->assertSessionHasErrors(['name']);

        // 256 chars email -> fails
        $longEmail = str_repeat('a', 244) . '@example.com'; // 256 chars
        $responseEmail256 = $this->post('/contact', $this->validPayload(['email' => $longEmail]));
        $responseEmail256->assertSessionHasErrors(['email']);
    }

    /**
     * @tier: 5
     * @challenge: Email malformed variations
     */
    public function test_malformed_email_variations(): void
    {
        $malformedEmails = [
            'missing-at-sign.com',
            '@no-user.com',
            'user@',
            'user@.com',
            'user@domain..com',
            'user name@domain.com',
            'user<script>@domain.com',
            'user@domain,com',
            'user@@domain.com',
        ];

        foreach ($malformedEmails as $badEmail) {
            $response = $this->post('/contact', $this->validPayload(['email' => $badEmail]));
            $response->assertSessionHasErrors(['email'], "Expected email validation error for '$badEmail'");
        }
    }

    /**
     * @tier: 5
     * @challenge: All 6 Allowed Project Types Pass and Invalid Types are Rejected
     */
    public function test_all_six_project_types_pass_and_adversarial_types_rejected(): void
    {
        $allowedTypes = [
            'Full-Stack Web App',
            'Creative UI/UX & Web Audio',
            'High-Throughput Microservice',
            'AI Agents & Automation',
            'Tech Lead / Architecture Consulting',
            'Other Quest',
        ];

        foreach ($allowedTypes as $index => $type) {
            $response = $this->post('/contact', $this->validPayload([
                'email' => "type_{$index}@macatung.dev",
                'project_type' => $type,
            ]));
            $response->assertSessionDoesntHaveErrors();
            $this->assertDatabaseHas('contact_submissions', [
                'email' => "type_{$index}@macatung.dev",
                'project_type' => $type,
            ]);
        }

        $adversarialTypes = [
            'full-stack web app', // lowercase
            'FULL-STACK WEB APP', // uppercase
            'Hacking & Exploits',
            'Random String 12345',
            "' OR '1'='1",
            '<script>alert(1)</script>',
            'Other', // incomplete
        ];

        foreach ($adversarialTypes as $badType) {
            $response = $this->post('/contact', $this->validPayload(['project_type' => $badType]));
            $response->assertSessionHasErrors(['project_type'], "Expected project_type validation error for '$badType'");
        }
    }

    /**
     * @tier: 5
     * @challenge: Coffee Offering Boundary (1 char, 255 chars, 256 chars, custom drinks)
     */
    public function test_coffee_offering_boundary_and_custom_options(): void
    {
        // 1 char -> passes
        $response1 = $this->post('/contact', $this->validPayload(['coffee_offering' => 'C']));
        $response1->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', ['coffee_offering' => 'C']);

        // Custom Vietnamese specialty drink -> passes
        $customDrink = 'Trà Sữa Trân Châu Đường Đen 50% Đường 30% Đá + Pudding Trứng 🍮';
        $responseCustom = $this->post('/contact', $this->validPayload(['coffee_offering' => $customDrink]));
        $responseCustom->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', ['coffee_offering' => $customDrink]);

        // 255 chars -> passes
        $coffee255 = str_repeat('K', 255);
        $response255 = $this->post('/contact', $this->validPayload(['coffee_offering' => $coffee255]));
        $response255->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('contact_submissions', ['coffee_offering' => $coffee255]);

        // 256 chars -> fails
        $coffee256 = str_repeat('K', 256);
        $response256 = $this->post('/contact', $this->validPayload(['coffee_offering' => $coffee256]));
        $response256->assertSessionHasErrors(['coffee_offering']);
    }

    /**
     * @tier: 5
     * @challenge: SQL Injection strings across all fields
     */
    public function test_sql_injection_payloads_do_not_corrupt_database(): void
    {
        $sqlInjectionPayload = [
            'name' => "Robert'); DROP TABLE contact_submissions;--",
            'email' => 'sqlinject@macatung.dev',
            'project_type' => 'Other Quest',
            'coffee_offering' => "' UNION SELECT null, null, username, password FROM users--",
            'message' => "SELECT * FROM contact_submissions WHERE '1'='1'; DELETE FROM contact_submissions WHERE id > 0;",
        ];

        $response = $this->post('/contact', $sqlInjectionPayload);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        // Verify table still exists and data was stored verbatim safely
        $this->assertDatabaseCount('contact_submissions', 1);
        $this->assertDatabaseHas('contact_submissions', [
            'name' => "Robert'); DROP TABLE contact_submissions;--",
            'email' => 'sqlinject@macatung.dev',
            'coffee_offering' => "' UNION SELECT null, null, username, password FROM users--",
            'message' => "SELECT * FROM contact_submissions WHERE '1'='1'; DELETE FROM contact_submissions WHERE id > 0;",
        ]);
    }

    /**
     * @tier: 5
     * @challenge: XSS & HTML Script Tag Payloads safely stored
     */
    public function test_xss_payloads_stored_safely(): void
    {
        $xssPayload = [
            'name' => '<script>alert("XSS_NAME")</script>',
            'email' => 'xss@macatung.dev',
            'project_type' => 'Creative UI/UX & Web Audio',
            'coffee_offering' => '<img src=x onerror=alert(1)>',
            'message' => '<svg/onload=alert("XSS_MESSAGE")><iframe src="javascript:alert(1)"></iframe>',
        ];

        $response = $this->post('/contact', $xssPayload);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('contact_submissions', [
            'name' => '<script>alert("XSS_NAME")</script>',
            'coffee_offering' => '<img src=x onerror=alert(1)>',
            'message' => '<svg/onload=alert("XSS_MESSAGE")><iframe src="javascript:alert(1)"></iframe>',
        ]);
    }

    /**
     * @tier: 5
     * @challenge: Multi-byte Unicode, Vietnamese diacritics, CJK, and 4-byte Emojis
     */
    public function test_multibyte_unicode_and_emojis_persistence(): void
    {
        $unicodePayload = [
            'name' => 'Nguyễn Quốc Hùng 🧙‍♂️✨ (Ma Cà Tưng)',
            'email' => 'hung.nguyen@macatung.dev',
            'project_type' => 'AI Agents & Automation',
            'coffee_offering' => 'Cà Phê Sữa Đá Sài Gòn ☕🇻🇳 + 1 Bánh Mì',
            'message' => "Dự án phát triển Hệ Thống Triệu Hồi Tự Động.\nマカタング・夜間召喚システム。\n⚡🔥📜👾 Multi-line text with emojis and runes.",
        ];

        $response = $this->post('/contact', $unicodePayload);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $submission = ContactSubmission::first();
        $this->assertNotNull($submission);
        $this->assertEquals('Nguyễn Quốc Hùng 🧙‍♂️✨ (Ma Cà Tưng)', $submission->name);
        $this->assertEquals('Cà Phê Sữa Đá Sài Gòn ☕🇻🇳 + 1 Bánh Mì', $submission->coffee_offering);
        $this->assertStringContainsString('マカタング・夜間召喚システム。', $submission->message);
        $this->assertStringContainsString('⚡🔥📜👾', $submission->message);
    }

    /**
     * @tier: 5
     * @challenge: Uniqueness of Reference IDs under high volume (100 iterations)
     */
    public function test_reference_id_uniqueness_and_format_under_high_volume(): void
    {
        $generatedIds = [];

        for ($i = 0; $i < 100; $i++) {
            $id = ContactSubmission::generateReferenceId();
            $this->assertMatchesRegularExpression('/^SUMMON-[A-Z0-9]{6}$/', $id);
            $this->assertNotContains($id, $generatedIds, "Collision detected on iteration $i for ID $id");
            $generatedIds[] = $id;

            // Store in DB
            ContactSubmission::create([
                'reference_id' => $id,
                'name' => "Batch User $i",
                'email' => "batch{$i}@macatung.dev",
                'project_type' => 'Other Quest',
                'coffee_offering' => 'Robusta',
                'message' => "Batch inquiry iteration number $i with minimum characters.",
            ]);
        }

        $this->assertDatabaseCount('contact_submissions', 100);
        $this->assertCount(100, array_unique($generatedIds));
    }

    /**
     * @tier: 5
     * @challenge: Both /contact and /summon routes with JSON and HTTP Methods integrity
     */
    public function test_routes_method_and_content_type_integrity(): void
    {
        // POST /summon works identically to POST /contact
        $responseSummon = $this->post('/summon', $this->validPayload(['email' => 'summon_route@macatung.dev']));
        $responseSummon->assertStatus(302);
        $responseSummon->assertSessionHas('reference_id');
        $this->assertDatabaseHas('contact_submissions', ['email' => 'summon_route@macatung.dev']);

        // Invalid HTTP methods on /contact
        $this->get('/contact')->assertStatus(405);
        $this->put('/contact', [])->assertStatus(405);
        $this->delete('/contact')->assertStatus(405);

        // Invalid HTTP methods on /summon
        $this->get('/summon')->assertStatus(405);
        $this->put('/summon', [])->assertStatus(405);
        $this->delete('/summon')->assertStatus(405);
    }

    /**
     * @tier: 5
     * @challenge: Client Network Metadata (IPv4, IPv6, User Agent edge cases)
     */
    public function test_client_network_metadata_capture(): void
    {
        // IPv6 address
        $ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        $longUserAgent = 'Mozilla/5.0 ' . str_repeat('CustomBot/2.0 ', 50); // ~750 chars

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => $ipv6,
            'HTTP_USER_AGENT' => $longUserAgent,
        ])->post('/contact', $this->validPayload(['email' => 'ipv6@macatung.dev']));

        $response->assertStatus(302);
        $this->assertDatabaseHas('contact_submissions', [
            'email' => 'ipv6@macatung.dev',
            'ip_address' => $ipv6,
            'user_agent' => $longUserAgent,
        ]);
    }

    /**
     * @tier: 5
     * @challenge: Eloquent Model Scopes, Casts, and Event Hooks
     */
    public function test_eloquent_model_scopes_and_casts(): void
    {
        // Create 3 submissions: 2 unread, 1 read
        $sub1 = ContactSubmission::create($this->validPayload([
            'email' => 'scope1@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'is_read' => false,
        ]));

        $sub2 = ContactSubmission::create($this->validPayload([
            'email' => 'scope2@macatung.dev',
            'project_type' => 'AI Agents & Automation',
            'is_read' => true,
        ]));

        $sub3 = ContactSubmission::create($this->validPayload([
            'email' => 'scope3@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'is_read' => false,
        ]));

        // Test unread scope
        $unread = ContactSubmission::unread()->get();
        $this->assertCount(2, $unread);
        $this->assertTrue($unread->contains('id', $sub1->id));
        $this->assertTrue($unread->contains('id', $sub3->id));
        $this->assertFalse($unread->contains('id', $sub2->id));

        // Test project type scope
        $fullstack = ContactSubmission::byProjectType('Full-Stack Web App')->get();
        $this->assertCount(2, $fullstack);
        $this->assertTrue($fullstack->contains('id', $sub1->id));
        $this->assertTrue($fullstack->contains('id', $sub3->id));

        // Test boolean casting
        $this->assertIsBool($sub1->fresh()->is_read);
        $this->assertFalse($sub1->fresh()->is_read);
        $this->assertTrue($sub2->fresh()->is_read);

        // Test model auto-generation of reference_id when omitted
        $this->assertNotEmpty($sub1->reference_id);
        $this->assertStringStartsWith('SUMMON-', $sub1->reference_id);

        // Test explicit reference_id preservation
        $subCustom = ContactSubmission::create(array_merge($this->validPayload(), [
            'reference_id' => 'CUSTOM-ID-999',
            'email' => 'custom_ref@macatung.dev',
        ]));
        $this->assertEquals('CUSTOM-ID-999', $subCustom->reference_id);
    }
}
