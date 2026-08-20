/**
 * Self-Verification Test Suite for macatung.dev Test Harness
 * Verifies that mock doubles, test runner matchers, spies, async execution, and environment setup work perfectly.
 */

import { describe, it, expect, beforeEach, afterEach, fn, spyOn } from './index.js';
import {
  MockAudioContext,
  MockKeyboardEvent,
  MockTouchEvent,
  MockTouch,
  mockUseForm,
  setupTestEnvironment
} from './mock_helpers.js';

describe('[Harness Self-Verification] Test Runner & Mock Doubles', () => {
  let env;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  describe('1. Matcher Suite Verification', () => {
    it('verifies basic equality and truthiness matchers', () => {
      expect(1 + 1).toBe(2);
      expect('macatung').toBe('macatung');
      expect(true).toBeTruthy();
      expect(false).toBeFalsy();
      expect(null).toBeNull();
      expect(undefined).toBeUndefined();
      expect(0).toBeDefined();
      expect(Number.NaN).toBeNaN();
      expect(5).not.toBe(6);
      expect('dark').not.toBeNull();
    });

    it('verifies deep equality for objects and arrays', () => {
      const obj1 = { name: 'Ma Cà Tưng', stats: [10, 20, { mood: 'caffeine' }] };
      const obj2 = { name: 'Ma Cà Tưng', stats: [10, 20, { mood: 'caffeine' }] };
      expect(obj1).toEqual(obj2);
      expect([1, 2, 3]).toEqual([1, 2, 3]);
      expect({ a: 1 }).not.toEqual({ a: 2 });
    });

    it('verifies numeric comparisons and floating point precision', () => {
      expect(10).toBeGreaterThan(5);
      expect(10).toBeGreaterThanOrEqual(10);
      expect(3).toBeLessThan(8);
      expect(3).toBeLessThanOrEqual(3);
      expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
      expect(1.0001).not.toBeCloseTo(2.0, 1);
    });

    it('verifies collections, strings, properties, and regex matching', () => {
      expect('Code at midnight.').toContain('midnight');
      expect(['vue', 'laravel', 'tailwind']).toContain('laravel');
      expect('macatung-cli').toMatch(/^macatung/);
      expect({ title: 'Grimoire', author: { name: 'Tưng' } }).toHaveProperty('author.name', 'Tưng');
      expect([1, 2, 3, 4]).toHaveLength(4);
      expect('seal').toHaveLength(4);
    });

    it('verifies error throwing and exception matching', () => {
      const throwFn = () => {
        throw new Error('Caffeine Level Exceeded');
      };
      expect(throwFn).toThrow('Caffeine');
      expect(throwFn).toThrow(/Level Exceeded/);
      expect(() => {}).not.toThrow();
    });

    it('verifies async promise resolution and rejection matchers', async () => {
      const pSuccess = Promise.resolve('khai_quang_sealed');
      const pFail = Promise.reject(new Error('AudioContext Suspended'));

      await expect(pSuccess).resolves.toBe('khai_quang_sealed');
      await expect(pFail).rejects.toThrow('AudioContext Suspended');
    });

    it('verifies spy / mock function assertions', () => {
      const mockCallback = fn((x) => x * 2);
      mockCallback(21);
      mockCallback(50);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenCalledWith(21);
      expect(mockCallback).toHaveBeenLastCalledWith(50);
      expect(mockCallback.results[0].value).toBe(42);

      const testObj = {
        compute: (v) => v + 10
      };
      const spy = spyOn(testObj, 'compute');
      testObj.compute(5);
      expect(spy).toHaveBeenCalledWith(5);
      spy.mockRestore();
      expect(testObj.compute(5)).toBe(15);
    });
  });

  describe('2. DOM Test Double Verification', () => {
    it('creates elements, manipulates attributes and classes', () => {
      const el = document.createElement('div');
      el.id = 'midnight-terminal';
      el.className = 'font-mono text-xs bg-obsidian';
      el.setAttribute('data-state', 'expanded');

      expect(el.id).toBe('midnight-terminal');
      expect(el.classList.contains('font-mono')).toBe(true);
      expect(el.classList.contains('bg-obsidian')).toBe(true);
      expect(el.getAttribute('data-state')).toBe('expanded');
      expect(el.dataset.state).toBe('expanded');

      el.classList.add('p-4');
      expect(el.classList.contains('p-4')).toBe(true);
      el.classList.remove('font-mono');
      expect(el.classList.contains('font-mono')).toBe(false);
    });

    it('manages styles, dimensions, and bounding boxes', () => {
      const el = document.createElement('button');
      el.style.display = 'flex';
      el.style.transform = 'translateY(-10px)';
      el.style.opacity = '0.9';
      el.offsetWidth = 48;
      el.offsetHeight = 48;

      expect(el.style.display).toBe('flex');
      expect(el.style.transform).toBe('translateY(-10px)');
      const rect = el.getBoundingClientRect();
      expect(rect.width).toBe(48);
      expect(rect.height).toBe(48);
    });

    it('executes DOM tree traversal and query selectors', () => {
      const parent = document.createElement('div');
      parent.className = 'grimoire-grid';

      const card1 = document.createElement('div');
      card1.className = 'project-card active';
      card1.id = 'project-1';
      card1.textContent = 'Ma Cà Tưng Portfolio';

      const card2 = document.createElement('div');
      card2.className = 'project-card';
      card2.id = 'project-2';
      card2.textContent = 'Midnight Audio Engine';

      parent.appendChild(card1);
      parent.appendChild(card2);

      expect(parent.children.length).toBe(2);
      expect(parent.querySelector('#project-1')?.textContent).toBe('Ma Cà Tưng Portfolio');
      expect(parent.querySelectorAll('.project-card').length).toBe(2);
      expect(card1.closest('.grimoire-grid')).toBe(parent);
    });

    it('dispatches and handles mouse, keyboard, and touch events', () => {
      const btn = document.createElement('button');
      let clicked = false;
      let touched = false;
      let keyPressed = '';

      btn.addEventListener('click', () => {
        clicked = true;
      });
      btn.addEventListener('touchstart', (e) => {
        touched = true;
        expect(e.touches.length).toBe(1);
      });
      btn.addEventListener('keydown', (e) => {
        keyPressed = e.key;
      });

      btn.click();
      expect(clicked).toBe(true);

      const touchEv = new MockTouchEvent('touchstart', {
        touches: [new MockTouch({ clientX: 120, clientY: 240 })]
      });
      btn.dispatchEvent(touchEv);
      expect(touched).toBe(true);

      const keyEv = new MockKeyboardEvent('keydown', { key: 'Enter' });
      btn.dispatchEvent(keyEv);
      expect(keyPressed).toBe('Enter');
    });
  });

  describe('3. Web Audio Synthesizer Test Double Verification', () => {
    it('creates oscillators, gain nodes, and schedules automation params', () => {
      const ctx = new MockAudioContext();
      expect(ctx.state).toBe('running');

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, 0);
      osc.frequency.exponentialRampToValueAtTime(880, 0.3);

      gain.gain.setValueAtTime(0.5, 0);
      gain.gain.linearRampToValueAtTime(0.01, 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(0);
      osc.stop(0.3);

      expect(osc.started).toBe(true);
      expect(osc.type).toBe('sawtooth');
      expect(osc.frequency.getScheduledEvents().length).toBe(2);
      expect(gain.gain.getScheduledEvents().length).toBe(2);
      expect(ctx.getAllOscillators().length).toBe(1);
      expect(ctx.getAllGains().length).toBe(1);
    });

    it('manages audio context state transitions (resume, suspend, close)', async () => {
      const ctx = new MockAudioContext({ state: 'suspended' });
      expect(ctx.state).toBe('suspended');

      await ctx.resume();
      expect(ctx.state).toBe('running');

      await ctx.suspend();
      expect(ctx.state).toBe('suspended');

      await ctx.close();
      expect(ctx.state).toBe('closed');
    });
  });

  describe('4. HTML5 Canvas 2D Test Double Verification', () => {
    it('records 2D rendering commands, path operations, and gradients', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 800;

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();

      ctx.clearRect(0, 0, 1000, 800);
      ctx.fillStyle = '#00f5a0';
      ctx.fillRect(50, 50, 200, 100);

      ctx.beginPath();
      ctx.arc(300, 200, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '14px monospace';
      ctx.fillText('ĐÃ KHAI QUANG', 100, 300);

      const drawnRects = ctx.getDrawnRects();
      const drawnTexts = ctx.getDrawnTexts();
      const drawnArcs = ctx.getDrawnArcs();

      expect(drawnRects.length).toBe(2); // 1 clearRect + 1 fillRect
      expect(drawnTexts.length).toBe(1);
      expect(drawnTexts[0].text).toBe('ĐÃ KHAI QUANG');
      expect(drawnArcs.length).toBe(1);
      expect(drawnArcs[0].radius).toBe(25);
    });
  });

  describe('5. Storage, Viewport & Inertia Form Doubles Verification', () => {
    it('verifies localStorage operations and persistence', () => {
      localStorage.setItem('macatung_hop_count', '42');
      localStorage.setItem('macatung_sound_muted', 'false');

      expect(localStorage.getItem('macatung_hop_count')).toBe('42');
      expect(localStorage.getItem('macatung_sound_muted')).toBe('false');
      expect(localStorage.length).toBe(2);

      localStorage.removeItem('macatung_sound_muted');
      expect(localStorage.getItem('macatung_sound_muted')).toBeNull();

      localStorage.clear();
      expect(localStorage.length).toBe(0);
    });

    it('verifies window resize, scroll, and matchMedia', () => {
      let resized = false;
      let scrolled = false;

      window.addEventListener('resize', () => {
        resized = true;
      });
      window.addEventListener('scroll', () => {
        scrolled = true;
      });

      window.resizeTo(390, 844);
      expect(window.innerWidth).toBe(390);
      expect(resized).toBe(true);

      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      expect(isMobile).toBe(true);

      window.scrollTo(0, 500);
      expect(window.scrollY).toBe(500);
      expect(scrolled).toBe(true);
    });

    it('verifies Inertia useForm helper lifecycle and error handling', async () => {
      const form = mockUseForm({
        name: '',
        email: '',
        message: ''
      });

      expect(form.isDirty).toBe(false);

      form.data.name = 'Midnight Alchemist';
      expect(form.isDirty).toBe(true);

      // Submit with missing email -> triggers validation error
      let errorTriggered = false;
      await form.post('/contact', {
        onError: (errors) => {
          errorTriggered = true;
          expect(errors.email).toBeDefined();
        }
      });
      expect(errorTriggered).toBe(true);
      expect(form.hasErrors).toBe(true);
      expect(form.wasSuccessful).toBe(false);

      // Fix email & message -> submit succeeds
      form.data.email = 'alchemist@macatung.dev';
      form.data.message = 'Seeking full-stack consulting for midnight realm.';

      let successTriggered = false;
      await form.post('/contact', {
        onSuccess: (res) => {
          successTriggered = true;
          expect(res.props.flash.reference_id).toContain('SUMMON-');
        }
      });

      expect(successTriggered).toBe(true);
      expect(form.wasSuccessful).toBe(true);
    });
  });
});
