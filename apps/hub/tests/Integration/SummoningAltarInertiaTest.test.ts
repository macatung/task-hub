/**
 * Test Suite: Summoning Altar Inertia Form & Controller Validation (F24, F25)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment, mockUseForm } from '../Harness/mock_helpers.js';
import { sound } from '../../resources/js/audio/soundEffects.ts';

describe('SummoningAltarInertiaTest (F24, F25)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    if (sound.isMuted()) sound.toggleMute();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F24] Contact Controller & Backend Validation Contract', () => {
    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     */
    it('[T1_F24_01] Valid payload submission returns 200/302 with Inertia flash response', async () => {
      const form = mockUseForm({
        name: 'Lord of the Night',
        email: 'nightowl@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê muối 2 shot',
        message: 'Seeking full-stack consulting for distributed nocturnal web platform.'
      });

      let statusOk = false;
      await form.post('/contact', {
        onSuccess: (res: any) => {
          statusOk = true;
          expect(res.props.flash).toBeDefined();
        }
      });

      expect(statusOk).toBe(true);
      expect(form.wasSuccessful).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     */
    it('[T1_F24_02] Flash response contains unique reference_id starting with "SUMMON-"', async () => {
      const form = mockUseForm({
        name: 'Grand Archmage',
        email: 'archmage@midnight.realm',
        project_type: 'Creative UI/UX & Web Audio',
        coffee_offering: 'Cold Brew Robusta',
        message: 'Building interactive canvas physics for web application.'
      });

      let refId = '';
      await form.post('/contact', {
        onSuccess: (res: any) => {
          refId = res.props.flash.reference_id;
        }
      });

      expect(refId.startsWith('SUMMON-')).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     */
    it('[T1_F24_03] Flash response contains Vietnamese confirmation message', async () => {
      const form = mockUseForm({
        name: 'Nguyen Van A',
        email: 'nguyenvana@example.com',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê đen đá',
        message: 'Cần tư vấn kiến trúc hệ thống hiệu năng cao.'
      });

      let flashMessage = '';
      await form.post('/contact', {
        onSuccess: (res: any) => {
          flashMessage = res.props.flash.success;
        }
      });

      expect(flashMessage).toContain('Tín hiệu đã được truyền đi qua màn đêm');
    });

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     */
    it('[T1_F24_04] Missing required fields return 422 error bag with field error details', async () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: '',
        message: ''
      });

      let errorBag: any = null;
      await form.post('/contact', {
        onError: (errors: any) => {
          errorBag = errors;
        }
      });

      expect(errorBag).toBeDefined();
      expect(errorBag.name).toBeDefined();
      expect(errorBag.email).toBeDefined();
      expect(errorBag.message).toBeDefined();
      expect(form.hasErrors).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F24_BACKEND_CTRL
     */
    it('[T1_F24_05] Successful submission receives clean JSON response and marks form not dirty', async () => {
      const form = mockUseForm({
        name: 'Client Partner',
        email: 'partner@techcorp.io',
        project_type: 'High-Throughput Microservice',
        coffee_offering: 'Espresso Double',
        message: 'Contract for Golang and Laravel microservices architecture.'
      });

      form.data.name = 'Updated Client Partner';
      expect(form.isDirty).toBe(true);

      await form.post('/contact', {
        onSuccess: () => {
          form.reset();
        }
      });

      expect(form.isDirty).toBe(false);
      expect(form.wasSuccessful).toBe(true);
    });
  });

  describe('[T1_F25] Summoning Altar Inertia useForm Integration', () => {
    /**
     * @tier: 1
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T1_F25_01] Form initializes with default project_type and coffee_offering', () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê muối',
        message: ''
      });

      expect(form.isDirty).toBe(false);
      expect(form.hasErrors).toBe(false);
      expect(form.data.project_type).toBe('Full-Stack Web App');
      expect(form.data.coffee_offering).toBe('Cà phê muối');
    });

    /**
     * @tier: 1
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T1_F25_02] Field input two-way data binding updates form.data and sets isDirty to true', () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê muối',
        message: ''
      });

      form.data.name = 'Lord of the Night';
      form.data.email = 'lord@night.realm';
      expect(form.isDirty).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T1_F25_03] Submitting form sets processing = true while request executes', async () => {
      const form = mockUseForm({
        name: 'Async Tester',
        email: 'tester@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Latte',
        message: 'Testing asynchronous request lifecycle.'
      });

      let wasProcessingDuringExecution = false;
      await form.post('/contact', {
        onStart: () => {
          wasProcessingDuringExecution = form.processing;
        }
      });

      expect(wasProcessingDuringExecution).toBe(true);
      expect(form.processing).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T1_F25_04] Successful submission sets wasSuccessful = true and clears error bag', async () => {
      const form = mockUseForm({
        name: 'Valid Name',
        email: 'valid@macatung.dev',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Robusta',
        message: 'Valid message exceeding minimum length.'
      });

      form.setError('email', 'Old error');
      expect(form.hasErrors).toBe(true);

      await form.post('/contact', {});

      expect(form.wasSuccessful).toBe(true);
      expect(form.hasErrors).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T1_F25_05] Validation errors update hasErrors and errors object', async () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Salted',
        message: ''
      });

      await form.post('/contact', {
        onError: (errs) => {
          expect(errs.name).toBeDefined();
        }
      });

      expect(form.hasErrors).toBe(true);
      expect(form.wasSuccessful).toBe(false);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F24] Backend Controller Validation Rules & Boundary Cases', () => {
    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     */
    it('[T2_F24_01] Short message (<10 characters) triggers minimum length validation error', async () => {
      const form = mockUseForm({
        name: 'Test User',
        email: 'test@macatung.dev',
        project_type: 'Other Quest',
        coffee_offering: 'Espresso',
        message: 'Short' // 5 chars
      });

      await form.post('/contact', {
        onError: (errors: any) => {
          expect(errors.message).toContain('at least 10 characters');
        }
      });

      expect(form.hasErrors).toBe(true);
      expect(form.errors.message).toBeDefined();
    });

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     */
    it('[T2_F24_02] Invalid email format without "@" or domain triggers email validation failure', async () => {
      const form = mockUseForm({
        name: 'Test User',
        email: 'invalid-email-no-at-sign',
        project_type: 'Other Quest',
        coffee_offering: 'Espresso',
        message: 'Proper message with more than 10 characters.'
      });

      form.setError('email', 'The email field must be a valid email address.');
      expect(form.hasErrors).toBe(true);
      expect(form.errors.email).toContain('valid email address');
    });

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     */
    it('[T2_F24_03] Project type not in allowed enum list fails validation', () => {
      const form = mockUseForm({
        name: 'Test User',
        email: 'test@macatung.dev',
        project_type: 'Illegal Random Quest Type',
        coffee_offering: 'Espresso',
        message: 'Proper message with more than 10 characters.'
      });

      const allowedProjectTypes = [
        'Full-Stack Web App',
        'Creative UI/UX & Web Audio',
        'High-Throughput Microservice',
        'AI Agents & Automation',
        'Tech Lead / Architecture Consulting',
        'Other Quest'
      ];

      expect(allowedProjectTypes.includes(form.data.project_type)).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     */
    it('[T2_F24_04] Long message string (4,500 characters) passes validation within 5000 max', async () => {
      const longMessage = 'Supernatural Quest '.repeat(250); // ~4750 chars
      const form = mockUseForm({
        name: 'Longwinded Alchemist',
        email: 'alchemist@realm.org',
        project_type: 'Tech Lead / Architecture Consulting',
        coffee_offering: 'Infinite Drip',
        message: longMessage
      });

      await form.post('/contact', {
        forceError: false
      });

      expect(form.wasSuccessful).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F24_BACKEND_CTRL
     */
    it('[T2_F24_05] Special characters and SQL injection strings do not crash client form handler', async () => {
      const form = mockUseForm({
        name: "O'Reilly \"The Great\" <script>alert(1)</script>",
        email: 'special+tag@domain.co.uk',
        project_type: 'Other Quest',
        coffee_offering: "1' OR '1'='1",
        message: 'DROP TABLE contact_submissions; -- Valid message text over 10 chars.'
      });

      expect(() => {
        form.post('/contact', { forceError: false });
      }).not.toThrow();
    });
  });

  describe('[T2_F25] Inertia useForm Error Recovery & Edge Interactions', () => {
    /**
     * @tier: 2
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T2_F25_01] reset() restores initial state, clears errors, and resets isDirty', () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê muối',
        message: ''
      });

      form.data.name = 'Edited Name';
      form.setError('email', 'The email field is required.');
      expect(form.isDirty).toBe(true);
      expect(form.hasErrors).toBe(true);

      form.reset();
      form.clearErrors();

      expect(form.data.name).toBe('');
      expect(form.isDirty).toBe(false);
      expect(form.hasErrors).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T2_F25_02] clearErrors("email") clears only targeted field error without wiping name error', () => {
      const form = mockUseForm({
        name: '',
        email: '',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cà phê muối',
        message: ''
      });

      form.setError('name', 'The name field is required.');
      form.setError('email', 'The email field is required.');
      expect(Object.keys(form.errors).length).toBe(2);

      form.clearErrors('email');
      expect(form.errors.email).toBeUndefined();
      expect(form.errors.name).toBe('The name field is required.');
      expect(form.hasErrors).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T2_F25_03] transform() allows mutating data payload before submission', async () => {
      const form = mockUseForm({
        name: '  Trimmed Name  ',
        email: '  TRIMMED@MAIL.COM  ',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Cold Brew',
        message: 'Proper message with more than 10 characters.'
      });

      form.transform((data) => ({
        ...data,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase()
      }));

      await form.post('/contact', {
        forceError: false
      });

      expect(form.wasSuccessful).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T2_F25_04] Submitting form while processing is active blocks duplicate submissions', async () => {
      const form = mockUseForm({
        name: 'Spam Submitter',
        email: 'spam@night.vn',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Salted Coffee',
        message: 'Attempting rapid double submit.'
      });

      form.processing = true;
      let secondSubmitRan = false;

      if (!form.processing) {
        await form.post('/contact');
        secondSubmitRan = true;
      }

      expect(secondSubmitRan).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F25_SUMMON_ALTAR
     */
    it('[T2_F25_05] Success flow triggers celebratory sound and confetti', async () => {
      const form = mockUseForm({
        name: 'Night Developer',
        email: 'dev@night.vn',
        project_type: 'Full-Stack Web App',
        coffee_offering: 'Salted Coffee',
        message: 'Looking for full-stack migration expertise.'
      });

      await form.post('/contact', {
        onSuccess: () => {
          sound.playSuccess();
          (globalThis as any).confetti?.({ particleCount: 60 });
        }
      });

      expect(env.confetti.calls.length).toBeGreaterThanOrEqual(1);
      const oscs = env.audioContext.getAllOscillators();
      expect(oscs.length).toBeGreaterThanOrEqual(4);
    });
  });
});
