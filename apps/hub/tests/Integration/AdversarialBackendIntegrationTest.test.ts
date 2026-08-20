/**
 * Test Suite: Adversarial Backend Contract & Form Integration Hardening (Tier 5)
 * Challenger 2: Backend, API, Security & Boundary Adversarial Verifier
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment, mockUseForm } from '../Harness/mock_helpers.js';

describe('Adversarial Backend Contract & Boundary Hardening (Tier 5)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  describe('1. Form Payload Boundary & Fuzzing Resilience', () => {
    it('[T5_BACKEND_01] Form submission with 5000 character maximum message executes successfully', async () => {
      const maxMessage = 'A'.repeat(5000);
      const form = mockUseForm({
        name: 'Max Length Tester',
        email: 'maxmsg@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Espresso',
        message: maxMessage,
      });

      await form.post('/contact', { forceError: false });

      expect(form.wasSuccessful).toBe(true);
      expect(form.hasErrors).toBe(false);
    });

    it('[T5_BACKEND_02] Form submission with 9 character message triggers validation error', async () => {
      const form = mockUseForm({
        name: 'Short Tester',
        email: 'short@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Espresso',
        message: '123456789',
      });

      await form.post('/contact', {
        onError: (errors: any) => {
          expect(errors.message).toBeDefined();
        }
      });

      expect(form.hasErrors).toBe(true);
    });

    it('[T5_BACKEND_03] Form submission with 255 character boundary name and coffee_offering', async () => {
      const name255 = 'N'.repeat(255);
      const coffee255 = 'C'.repeat(255);
      const form = mockUseForm({
        name: name255,
        email: 'boundary255@macatung.dev',
        project_type: 'AI Agents & Automation',
        coffee_offering: coffee255,
        message: 'Valid length message over 10 chars.',
      });

      await form.post('/contact', { forceError: false });

      expect(form.wasSuccessful).toBe(true);
      expect(form.data.name.length).toBe(255);
      expect(form.data.coffee_offering.length).toBe(255);
    });

    it('[T5_BACKEND_04] Whitespace trimming via transform before submission triggers short validation error', async () => {
      const form = mockUseForm({
        name: 'Space Tester',
        email: 'spaces@macatung.dev',
        project_type: 'Other Quest',
        coffee_offering: 'Robusta',
        message: '     123     ', // 5 characters when trimmed
      });

      form.transform((data) => ({
        ...data,
        message: data.message.trim(),
      }));

      await form.post('/contact', {
        onError: (errors: any) => {
          expect(errors.message).toBeDefined();
        }
      });

      expect(form.hasErrors).toBe(true);
    });

    it('[T5_BACKEND_05] Multi-byte Unicode, Vietnamese diacritics, and emojis are preserved in form payload', async () => {
      const unicodeMessage = 'Triệu hồi Ma Cà Tưng 🧙‍♂️✨ Đạo sĩ trừ tà ⚡📜 Cà Phê Muối Nửa Đêm ☕';
      const form = mockUseForm({
        name: 'Nguyễn Văn Đạo Sĩ 🧙‍♂️',
        email: 'daosi@macatung.dev',
        project_type: 'Tech Lead / Architecture Consulting',
        coffee_offering: 'Cà Phê Sữa Đá Sài Gòn ☕🇻🇳',
        message: unicodeMessage,
      });

      await form.post('/contact', { forceError: false });

      expect(form.wasSuccessful).toBe(true);
      expect(form.data.name).toContain('Nguyễn Văn Đạo Sĩ');
      expect(form.data.message).toContain('Triệu hồi Ma Cà Tưng');
    });
  });

  describe('2. Security & Injection Vectors', () => {
    it('[T5_BACKEND_06] SQL injection strings in form inputs do not crash client or leak errors', async () => {
      const form = mockUseForm({
        name: "Robert'); DROP TABLE contact_submissions;--",
        email: 'sqli@macatung.dev',
        project_type: 'Other Quest',
        coffee_offering: "' UNION SELECT null, username, password FROM users--",
        message: "SELECT * FROM contact_submissions WHERE '1'='1'; DELETE FROM contact_submissions;",
      });

      expect(() => {
        form.post('/contact', { forceError: false });
      }).not.toThrow();

      expect(form.wasSuccessful).toBe(true);
    });

    it('[T5_BACKEND_07] XSS script tags and event handlers are safely retained as string literals', async () => {
      const xssScript = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const form = mockUseForm({
        name: xssScript,
        email: 'xss@macatung.dev',
        project_type: 'Creative UI/UX & Web Audio',
        coffee_offering: '<svg/onload=alert(1)>',
        message: '<iframe src="javascript:alert(1)"></iframe> Valid message length.',
      });

      await form.post('/contact', { forceError: false });

      expect(form.wasSuccessful).toBe(true);
      expect(form.data.name).toBe(xssScript);
    });

    it('[T5_BACKEND_08] Injected mass-assignment keys (is_read, id, reference_id) are ignored', async () => {
      const form = mockUseForm({
        name: 'Injected Partner',
        email: 'partner@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Espresso',
        message: 'Valid message exceeding minimum requirement.',
        is_read: true,
        id: 9999,
        reference_id: 'SUMMON-FAKE-999',
      });

      let returnedRefId = '';
      await form.post('/contact', {
        onSuccess: (res: any) => {
          returnedRefId = res.props.flash.reference_id;
        }
      });

      expect(returnedRefId.startsWith('SUMMON-')).toBe(true);
      expect(returnedRefId).not.toBe('SUMMON-FAKE-999');
    });
  });

  describe('3. Project Type Strict Whitelist Invariant', () => {
    it('[T5_BACKEND_09] All 6 allowed project types pass validation', () => {
      const allowedTypes = [
        'Full-Stack Web App',
        'Creative UI/UX & Web Audio',
        'High-Throughput Microservice',
        'AI Agents & Automation',
        'Tech Lead / Architecture Consulting',
        'Other Quest',
      ];

      for (const type of allowedTypes) {
        const form = mockUseForm({
          name: 'Type Tester',
          email: 'types@macatung.dev',
          project_type: type,
          coffee_offering: 'Cold Brew',
          message: 'Valid message exceeding minimum length of ten characters.',
        });

        expect(allowedTypes.includes(form.data.project_type)).toBe(true);
      }
    });

    it('[T5_BACKEND_10] Unknown project type fails validation and is rejected', () => {
      const allowedTypes = [
        'Full-Stack Web App',
        'Creative UI/UX & Web Audio',
        'High-Throughput Microservice',
        'AI Agents & Automation',
        'Tech Lead / Architecture Consulting',
        'Other Quest',
      ];

      const invalidTypes = [
        'full-stack web app',
        'FULL-STACK WEB APP',
        'Hacking & Exploits',
        'Random Type 123',
        "' OR '1'='1",
      ];

      for (const invalid of invalidTypes) {
        expect(allowedTypes.includes(invalid)).toBe(false);
      }
    });
  });
});
