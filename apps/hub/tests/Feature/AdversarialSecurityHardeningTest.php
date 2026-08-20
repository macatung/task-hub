<?php

namespace Tests\Feature;

use App\Http\Requests\ContactRequest;
use App\Models\ContactSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdversarialSecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Standard valid payload generator.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    protected function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Midnight Sorcerer',
            'email' => 'sorcerer@macatung.dev',
            'project_type' => 'Full-Stack Web App',
            'coffee_offering' => 'Cà Phê Muối Nửa Đêm ☕',
            'message' => 'Seeking full-stack consulting for distributed nocturnal web platform.',
        ], $overrides);
    }

    /**
     * @tier: 5
     * @challenge: Mass Assignment and Parameter Tampering Hardening
     * Injected attributes in request payload must NOT override model attributes or protected state.
     */
    public function test_mass_assignment_and_parameter_tampering_injection(): void
    {
        $maliciousPayload = $this->validPayload([
            'id' => 99999,
            'reference_id' => 'SUMMON-HACKED-12345',
            'is_read' => true,
            'created_at' => '1970-01-01 00:00:00',
            'updated_at' => '1970-01-01 00:00:00',
            'ip_address' => '255.255.255.255',
            'user_agent' => 'TamperedUA/1.0',
            'admin' => 1,
            'role' => 'superuser',
        ]);

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => '10.0.0.42',
            'HTTP_USER_AGENT' => 'LegitimateClient/2.0',
        ])->post('/contact', $maliciousPayload);

        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $submission = ContactSubmission::first();
        $this->assertNotNull($submission);

        // ID must NOT be 99999
        $this->assertEquals(1, $submission->id);

        // reference_id must NOT be the injected 'SUMMON-HACKED-12345'
        $this->assertNotEquals('SUMMON-HACKED-12345', $submission->reference_id);
        $this->assertMatchesRegularExpression('/^SUMMON-[A-Z0-9]{6}$/', $submission->reference_id);

        // is_read must be false by default
        $this->assertFalse((bool) $submission->is_read);

        // ip_address and user_agent must come from request server variables, not body payload
        $this->assertEquals('10.0.0.42', $submission->ip_address);
        $this->assertEquals('LegitimateClient/2.0', $submission->user_agent);

        // created_at must be recent, not 1970
        $this->assertGreaterThan('2020-01-01', $submission->created_at->toDateTimeString());
    }

    /**
     * @tier: 5
     * @challenge: Array and Non-Scalar Type Juggling Injection
     * Passing arrays, nested objects, or non-scalar types to string fields must cleanly fail validation without 500 error.
     */
    public function test_array_and_non_scalar_type_juggling_rejection(): void
    {
        $testCases = [
            'name as array' => ['name' => ['first' => 'John', 'last' => 'Doe']],
            'email as array' => ['email' => ['injected@macatung.dev']],
            'project_type as array' => ['project_type' => ['Full-Stack Web App']],
            'coffee_offering as array' => ['coffee_offering' => ['shots' => 2]],
            'message as array' => ['message' => ['nested' => 'Long message with more than ten characters.']],
            'name as integer' => ['name' => 123456],
            'message as boolean' => ['message' => false],
            'project_type as null' => ['project_type' => null],
        ];

        foreach ($testCases as $caseName => $override) {
            $payload = $this->validPayload($override);
            $response = $this->post('/contact', $payload);

            $response->assertStatus(302, "Failed on test case: $caseName (expected 302 redirect with errors)");
            $fieldKey = array_key_first($override);
            $response->assertSessionHasErrors([$fieldKey], "Field '$fieldKey' should have validation errors in case '$caseName'");
        }

        $this->assertDatabaseCount('contact_submissions', 0);
    }

    /**
     * @tier: 5
     * @challenge: Advanced SQL Injection & Stacked Query Hardening
     * Payloads containing SQLite commands, SQLite meta-commands, and stacked SQL must be safely parameterized.
     */
    public function test_advanced_sqlite_injection_payloads(): void
    {
        $sqlitePayloads = [
            'name' => "'; ATTACH DATABASE ':memory:' AS evil; --",
            'email' => 'sqli_defense@macatung.dev',
            'project_type' => 'Other Quest',
            'coffee_offering' => "' OR (SELECT COUNT(*) FROM contact_submissions) > 0 --",
            'message' => "'; UPDATE contact_submissions SET is_read = 1; -- Valid length message here",
        ];

        $response = $this->post('/contact', $sqlitePayloads);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $this->assertDatabaseCount('contact_submissions', 1);
        $submission = ContactSubmission::first();
        $this->assertNotNull($submission);
        $this->assertEquals("'; ATTACH DATABASE ':memory:' AS evil; --", $submission->name);
        $this->assertEquals("' OR (SELECT COUNT(*) FROM contact_submissions) > 0 --", $submission->coffee_offering);
        $this->assertEquals("'; UPDATE contact_submissions SET is_read = 1; -- Valid length message here", $submission->message);
        $this->assertFalse((bool) $submission->is_read);
    }

    /**
     * @tier: 5
     * @challenge: Polyglot XSS and Event Handler Script Injection
     * Polyglot XSS strings, SVG onload, and iframe javascript vectors must be stored verbatim without corruption.
     */
    public function test_polyglot_xss_and_script_vectors(): void
    {
        $polyglotXss = 'jaVasCript:/*-/*`/*\`/*\'/*"/**/(/* */onerror=alert(1) )//%0D%0A%0d%0a//</SCRIPT>">\'><svg/onload=alert(1)>';
        $attrXss = '<a href="javascript:void(0)" onmouseover="alert(\'xss\')">Click Altar</a>';
        $unicodeXss = '\u003cscript\u003ealert(\'xss\')\u003c/script\u003e';

        $payload = [
            'name' => 'XSS Tester ' . substr($unicodeXss, 0, 50),
            'email' => 'xss_polyglot@macatung.dev',
            'project_type' => 'Creative UI/UX & Web Audio',
            'coffee_offering' => $attrXss,
            'message' => $polyglotXss . ' - Valid length message content over 10 chars.',
        ];

        $response = $this->post('/contact', $payload);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $submission = ContactSubmission::where('email', 'xss_polyglot@macatung.dev')->first();
        $this->assertNotNull($submission);
        $this->assertEquals($attrXss, $submission->coffee_offering);
        $this->assertStringContainsString($polyglotXss, $submission->message);
    }

    /**
     * @tier: 5
     * @challenge: Multi-byte Unicode, Vietnamese Diacritics, CJK, and Astral Plane Emojis
     * Full UTF-8 spectrum validation and database persistence without truncation or character corruption.
     */
    public function test_full_unicode_spectrum_and_vietnamese_diacritics(): void
    {
        $vietnamesePoem = 'Trương Vĩnh Ký: Trăm năm trong cõi người ta, chữ tài chữ mệnh khéo là ghét nhau. Trải qua một cuộc bể dâu, những điều trông thấy mà đau đớn lòng.';
        $cjkLore = '真夜中のハッキング呪文・封印解除・マカタング道士';
        $astralEmojis = '🧙‍♂️👻🦇📜🔥✨👾☕🌙💖🦾🧠⚡🔮';
        $rtlOverride = "Normal Text \u{202E} desrever txeT \u{202C} End Text";
        $zeroWidths = "Zero\u{200B}Width\u{200C}Joiner\u{200D}Space\u{FEFF}Test";

        $payload = [
            'name' => 'Đạo Sĩ Ma Cà Tưng 🧙‍♂️ ' . $cjkLore,
            'email' => 'dao.si@macatung.dev',
            'project_type' => 'Tech Lead / Architecture Consulting',
            'coffee_offering' => 'Cà Phê Trứng Hà Nội ☕🥚 + Cà Phê Cốt Dừa 🥥',
            'message' => $vietnamesePoem . "\n" . $astralEmojis . "\n" . $rtlOverride . "\n" . $zeroWidths,
        ];

        $response = $this->post('/contact', $payload);
        $response->assertStatus(302);
        $response->assertSessionDoesntHaveErrors();

        $submission = ContactSubmission::where('email', 'dao.si@macatung.dev')->first();
        $this->assertNotNull($submission);
        $this->assertStringContainsString('Đạo Sĩ Ma Cà Tưng', $submission->name);
        $this->assertStringContainsString('🧙‍♂️', $submission->name);
        $this->assertStringContainsString('Cà Phê Trứng Hà Nội', $submission->coffee_offering);
        $this->assertStringContainsString('Trương Vĩnh Ký', $submission->message);
        $this->assertStringContainsString($astralEmojis, $submission->message);
        $this->assertStringContainsString($zeroWidths, $submission->message);
    }

    /**
     * @tier: 5
     * @challenge: Boundary Length Analysis (0, 9, 10, 255, 256, 5000, 5001, 10000)
     */
    public function test_strict_boundary_lengths_across_all_fields(): void
    {
        // 1. Message: 0 chars -> Fails
        $this->post('/contact', $this->validPayload(['message' => '']))
            ->assertSessionHasErrors(['message']);

        // 2. Message: 9 chars -> Fails
        $this->post('/contact', $this->validPayload(['message' => '123456789']))
            ->assertSessionHasErrors(['message']);

        // 3. Message: 10 chars -> Passes
        $this->post('/contact', $this->validPayload(['message' => '1234567890', 'email' => 'b10@macatung.dev']))
            ->assertSessionDoesntHaveErrors();

        // 4. Message: 5000 chars -> Passes
        $msg5000 = str_repeat('M', 5000);
        $this->post('/contact', $this->validPayload(['message' => $msg5000, 'email' => 'b5000@macatung.dev']))
            ->assertSessionDoesntHaveErrors();

        // 5. Message: 5001 chars -> Fails
        $msg5001 = str_repeat('M', 5001);
        $this->post('/contact', $this->validPayload(['message' => $msg5001]))
            ->assertSessionHasErrors(['message']);

        // 6. Message: 10000 chars -> Fails
        $msg10000 = str_repeat('M', 10000);
        $this->post('/contact', $this->validPayload(['message' => $msg10000]))
            ->assertSessionHasErrors(['message']);

        // 7. Name: 255 chars -> Passes
        $name255 = str_repeat('N', 255);
        $this->post('/contact', $this->validPayload(['name' => $name255, 'email' => 'name255@macatung.dev']))
            ->assertSessionDoesntHaveErrors();

        // 8. Name: 256 chars -> Fails
        $name256 = str_repeat('N', 256);
        $this->post('/contact', $this->validPayload(['name' => $name256]))
            ->assertSessionHasErrors(['name']);

        // 9. Coffee: 255 chars -> Passes
        $coffee255 = str_repeat('C', 255);
        $this->post('/contact', $this->validPayload(['coffee_offering' => $coffee255, 'email' => 'coffee255@macatung.dev']))
            ->assertSessionDoesntHaveErrors();

        // 10. Coffee: 256 chars -> Fails
        $coffee256 = str_repeat('C', 256);
        $this->post('/contact', $this->validPayload(['coffee_offering' => $coffee256]))
            ->assertSessionHasErrors(['coffee_offering']);
    }

    /**
     * @tier: 5
     * @challenge: Whitespace Bypasses & Sanity Trimming
     * Whitespace-only strings (spaces, tabs, carriage returns, newlines) must be trimmed to empty and fail required validation.
     */
    public function test_whitespace_and_control_char_bypasses(): void
    {
        $whitespaceCases = [
            'spaces' => "    \t  \n  \r  ",
            'tabs_only' => "\t\t\t\t\t\t\t\t\t\t",
            'newlines_only' => "\n\n\n\n\n\n\n\n\n\n",
            'mixed_whitespace' => " \t \n \r \t \n ",
        ];

        foreach ($whitespaceCases as $desc => $ws) {
            $response = $this->post('/contact', [
                'name' => $ws,
                'email' => $ws,
                'project_type' => $ws,
                'coffee_offering' => $ws,
                'message' => $ws,
            ]);

            $response->assertSessionHasErrors(['name', 'email', 'project_type', 'coffee_offering', 'message'],
                "Expected all whitespace fields to fail for case '$desc'");
        }

        $this->assertDatabaseCount('contact_submissions', 0);
    }

    /**
     * @tier: 5
     * @challenge: Email Header Injection and CRLF Attacks
     * Attempts to inject SMTP headers or CRLF control characters in email must be rejected.
     */
    public function test_email_crlf_and_smtp_header_injection(): void
    {
        $crlfEmails = [
            "victim@example.com\r\nBcc: attacker@evil.com",
            "victim@example.com\nSubject: Injected Subject",
            "victim@example.com%0ABcc:attacker@evil.com",
            "attacker@evil.com\r\n\r\nContent-Type: text/html",
        ];

        foreach ($crlfEmails as $badEmail) {
            $response = $this->post('/contact', $this->validPayload(['email' => $badEmail]));
            $response->assertSessionHasErrors(['email'], "Expected email validation error for CRLF email: $badEmail");
        }
    }

    /**
     * @tier: 5
     * @challenge: High Volume Sequential Fuzzing and 0 Collision Rate (150 requests)
     * High volume sequential requests must maintain 100% reference_id uniqueness and schema integrity.
     */
    public function test_high_volume_fuzzing_and_zero_collision(): void
    {
        $count = 150;
        $referenceIds = [];

        for ($i = 0; $i < $count; $i++) {
            $email = "fuzz_{$i}_" . Str::random(5) . '@macatung.dev';
            $response = $this->post('/contact', [
                'name' => "Fuzz User #$i",
                'email' => $email,
                'project_type' => ContactRequest::ALLOWED_PROJECT_TYPES[$i % count(ContactRequest::ALLOWED_PROJECT_TYPES)],
                'coffee_offering' => 'Espresso Shot #' . $i,
                'message' => "High volume stress testing message iteration $i of $count.",
            ]);

            $response->assertStatus(302);
            $response->assertSessionHas('reference_id');
            $refId = session('reference_id');

            $this->assertMatchesRegularExpression('/^SUMMON-[A-Z0-9]{6}$/', $refId);
            $this->assertNotContains($refId, $referenceIds, "Collision detected for Reference ID: $refId on iteration $i");
            $referenceIds[] = $refId;
        }

        $this->assertCount($count, $referenceIds);
        $this->assertCount($count, array_unique($referenceIds));
        $this->assertDatabaseCount('contact_submissions', $count);
    }

    /**
     * @tier: 5
     * @challenge: HTTP Method and Protocol Fuzzing
     * Only POST method on /contact and /summon allowed; GET, PUT, PATCH, DELETE must return 405.
     */
    public function test_http_methods_boundary_and_unregistered_routes(): void
    {
        $routes = ['/contact', '/summon'];

        foreach ($routes as $route) {
            $this->get($route)->assertStatus(405);
            $this->put($route, [])->assertStatus(405);
            $this->patch($route, [])->assertStatus(405);
            $this->delete($route)->assertStatus(405);
        }

        $this->get('/non-existent-altar-route')->assertStatus(404);
        $this->post('/non-existent-altar-route', [])->assertStatus(404);
    }
}
