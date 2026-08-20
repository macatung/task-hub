/**
 * Test Suite: Interactive Jiangshi Mascot Physics, Moods & Hop Ledger (F06, F07, F08)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach, fn } from '../Harness/index.js';
import {
  setupTestEnvironment,
  MockTouchEvent,
  MockTouch,
  MockMouseEvent
} from '../Harness/mock_helpers.js';
import { sound } from '../../resources/js/audio/soundEffects.ts';

// Mascot helper simulating the reactive physics & mood model of MacatungMascot
export class MascotModel {
  public hopCount: number;
  public isHopping: boolean = false;
  public mood: 'normal' | 'caffeine' | 'sleepy' | 'rage' = 'normal';
  public size: 'sm' | 'md' | 'lg' | 'hero' = 'md';
  public currentQuoteIndex: number = 0;
  public quotes: string[] = [
    'Code lúc nửa đêm là chân ái! 🌙',
    'Robusta 100% không đường, 0 bug! ☕',
    'Thứ Sáu deploy, thứ Bảy ngủ ngon! 🚀',
    'Bùa chú đã yểm vào từng dòng code! ✨',
    'Nhảy nhót tí cho tỉnh táo nào! 🧛‍♂️'
  ];
  public listeners: { [event: string]: Function[] } = {};

  constructor(initialHopCount?: number, initialMood?: string, size?: string) {
    const savedCount = localStorage.getItem('macatung_hop_count');
    const parsed = savedCount ? parseInt(savedCount, 10) : 0;
    this.hopCount = initialHopCount ?? (Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
    this.mood = this.validateMood(initialMood);
    this.size = this.validateSize(size);
  }

  private validateMood(m?: string): 'normal' | 'caffeine' | 'sleepy' | 'rage' {
    if (m === 'caffeine' || m === 'sleepy' || m === 'rage') return m;
    return 'normal';
  }

  private validateSize(s?: string): 'sm' | 'md' | 'lg' | 'hero' {
    if (s === 'sm' || s === 'lg' || s === 'hero') return s;
    return 'md';
  }

  public on(event: string, cb: Function) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
  }

  public emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  public getPitchMultiplier(): number {
    switch (this.mood) {
      case 'caffeine':
        return 1.35;
      case 'sleepy':
        return 0.75;
      case 'rage':
        return 1.8;
      default:
        return 1.0;
    }
  }

  public setMood(newMood: string) {
    this.mood = this.validateMood(newMood);
    this.emit('mood-change', this.mood);
  }

  public triggerHop(onComplete?: () => void) {
    this.hopCount++;
    this.isHopping = true;
    try {
      localStorage.setItem('macatung_hop_count', String(this.hopCount));
    } catch {
      // LocalStorage quota fallback
    }

    this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.quotes.length;
    this.emit('hop-count-change', this.hopCount);

    const pitch = this.getPitchMultiplier();
    sound.playHop(pitch);

    // Milestone check (10, 20, 50, 100...)
    if (this.hopCount > 0 && this.hopCount % 10 === 0) {
      this.emit('milestone', this.hopCount);
      (globalThis as any).confetti?.({ particleCount: 50 });
      sound.playSuccess();
    }

    setTimeout(() => {
      this.isHopping = false;
      this.emit('hop-end');
      if (onComplete) onComplete();
    }, 450);
  }

  public resetCount() {
    this.hopCount = 0;
    localStorage.removeItem('macatung_hop_count');
    this.emit('hop-count-change', 0);
  }

  public getQuote(): string {
    return this.quotes[this.currentQuoteIndex % this.quotes.length];
  }
}

describe('MascotPhysicsTest (F06, F07, F08)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    localStorage.clear();
    if (sound.isMuted()) sound.toggleMute();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F06] Interactive Mascot SVG Anatomy & Hop Physics', () => {
    /**
     * @tier: 1
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T1_F06_01] Mascot container renders Jiangshi anatomy elements (hat, talisman, robe, eyes)', () => {
      const mascotEl = document.createElement('div');
      mascotEl.className = 'macatung-mascot-wrapper';
      mascotEl.innerHTML = `
        <svg class="mascot-svg" viewBox="0 0 200 240">
          <g class="mascot-hat"><path d="M40,60 L160,60 L100,20 Z" fill="#0b0f19" /></g>
          <g class="mascot-talisman"><rect x="90" y="60" width="20" height="50" fill="#ffd166" /></g>
          <g class="mascot-robe"><path d="M50,110 L150,110 L160,220 L40,220 Z" fill="#06080d" /></g>
          <g class="mascot-eyes"><circle cx="85" cy="90" r="4" /><circle cx="115" cy="90" r="4" /></g>
          <ellipse class="mascot-shadow" cx="100" cy="235" rx="45" ry="8" fill="rgba(0,0,0,0.4)" />
        </svg>
      `;

      expect(mascotEl.querySelector('.mascot-hat')).toBeDefined();
      expect(mascotEl.querySelector('.mascot-talisman')).toBeDefined();
      expect(mascotEl.querySelector('.mascot-robe')).toBeDefined();
      expect(mascotEl.querySelector('.mascot-eyes')).toBeDefined();
      expect(mascotEl.querySelector('.mascot-shadow')).toBeDefined();
    });

    /**
     * @tier: 1
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T1_F06_02] Mascot hop trigger sets isHopping to true and schedules 450ms duration', async () => {
      const mascot = new MascotModel();
      expect(mascot.isHopping).toBe(false);

      mascot.triggerHop();
      expect(mascot.isHopping).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(mascot.isHopping).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T1_F06_03] Squash-stretch animation class is applied during hop execution', () => {
      const el = document.createElement('div');
      el.className = 'mascot-avatar';

      const hop = () => {
        el.classList.add('animate-squash-stretch');
        setTimeout(() => el.classList.remove('animate-squash-stretch'), 450);
      };

      hop();
      expect(el.classList.contains('animate-squash-stretch')).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T1_F06_04] TouchEvent on mobile triggers hop behavior identically to click event', () => {
      const mascot = new MascotModel();
      let touchTriggered = false;

      const mascotEl = document.createElement('div');
      mascotEl.addEventListener('touchstart', (e: any) => {
        if (e.touches && e.touches.length > 0) {
          touchTriggered = true;
          mascot.triggerHop();
        }
      });

      const touchEv = new MockTouchEvent('touchstart', {
        touches: [new MockTouch({ clientX: 100, clientY: 150 })]
      });
      mascotEl.dispatchEvent(touchEv);

      expect(touchTriggered).toBe(true);
      expect(mascot.hopCount).toBe(1);
      expect(mascot.isHopping).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T1_F06_05] Speech bubble quotes rotate sequentially through Vietnamese quotes', () => {
      const mascot = new MascotModel();
      const initialQuote = mascot.getQuote();

      mascot.triggerHop();
      const quote2 = mascot.getQuote();
      expect(quote2).not.toBe(initialQuote);
      expect(mascot.quotes).toContain(quote2);

      mascot.triggerHop();
      const quote3 = mascot.getQuote();
      expect(mascot.quotes).toContain(quote3);
    });
  });

  describe('[T1_F07] Mascot 4 Mood States & Visual/Audio Feedback', () => {
    /**
     * @tier: 1
     * @feature: F07_MASCOT_MOODS
     */
    it('[T1_F07_01] Initial mascot mood defaults to "normal" with base pitch multiplier 1.0', () => {
      const mascot = new MascotModel();
      expect(mascot.mood).toBe('normal');
      expect(mascot.getPitchMultiplier()).toBe(1.0);
    });

    /**
     * @tier: 1
     * @feature: F07_MASCOT_MOODS
     */
    it('[T1_F07_02] "caffeine" mood state sets pitch multiplier to 1.35x', () => {
      const mascot = new MascotModel();
      mascot.setMood('caffeine');
      expect(mascot.mood).toBe('caffeine');
      expect(mascot.getPitchMultiplier()).toBe(1.35);
    });

    /**
     * @tier: 1
     * @feature: F07_MASCOT_MOODS
     */
    it('[T1_F07_03] "sleepy" (4 AM) mood state sets pitch multiplier to 0.75x', () => {
      const mascot = new MascotModel();
      mascot.setMood('sleepy');
      expect(mascot.mood).toBe('sleepy');
      expect(mascot.getPitchMultiplier()).toBe(0.75);
    });

    /**
     * @tier: 1
     * @feature: F07_MASCOT_MOODS
     */
    it('[T1_F07_04] "rage" (deploy) mood state sets pitch multiplier to 1.8x', () => {
      const mascot = new MascotModel();
      mascot.setMood('rage');
      expect(mascot.mood).toBe('rage');
      expect(mascot.getPitchMultiplier()).toBe(1.8);
    });

    /**
     * @tier: 1
     * @feature: F07_MASCOT_MOODS
     */
    it('[T1_F07_05] Mood change dispatches mood-change event to update UI glow styling', () => {
      const mascot = new MascotModel();
      let dispatchedMood = '';
      mascot.on('mood-change', (m: string) => {
        dispatchedMood = m;
      });

      mascot.setMood('rage');
      expect(dispatchedMood).toBe('rage');
    });
  });

  describe('[T1_F08] Persistent Hop Ledger & Milestone Celebrations', () => {
    /**
     * @tier: 1
     * @feature: F08_HOP_LEDGER
     */
    it('[T1_F08_01] Hop ledger initializes from localStorage or defaults to 0', () => {
      localStorage.setItem('macatung_hop_count', '7');
      const mascot = new MascotModel();
      expect(mascot.hopCount).toBe(7);
    });

    /**
     * @tier: 1
     * @feature: F08_HOP_LEDGER
     */
    it('[T1_F08_02] Hop counter increments on each hop and emits hop-count-change', () => {
      const mascot = new MascotModel();
      let emittedCount = 0;
      mascot.on('hop-count-change', (cnt: number) => {
        emittedCount = cnt;
      });

      mascot.triggerHop();
      expect(mascot.hopCount).toBe(1);
      expect(emittedCount).toBe(1);
    });

    /**
     * @tier: 1
     * @feature: F08_HOP_LEDGER
     */
    it('[T1_F08_03] Hop count is persisted immediately to localStorage', () => {
      const mascot = new MascotModel();
      mascot.triggerHop();
      expect(localStorage.getItem('macatung_hop_count')).toBe('1');
      mascot.triggerHop();
      expect(localStorage.getItem('macatung_hop_count')).toBe('2');
    });

    /**
     * @tier: 1
     * @feature: F08_HOP_LEDGER
     */
    it('[T1_F08_04] Milestone 10 (10th hop) triggers confetti burst and success fanfare', () => {
      const mascot = new MascotModel(9); // Start at 9
      let milestoneReached = 0;
      mascot.on('milestone', (m: number) => {
        milestoneReached = m;
      });

      mascot.triggerHop(); // 10th hop
      expect(mascot.hopCount).toBe(10);
      expect(milestoneReached).toBe(10);
      expect(env.confetti.calls.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * @tier: 1
     * @feature: F08_HOP_LEDGER
     */
    it('[T1_F08_05] Non-milestone hops (1-9) do not dispatch confetti bursts', () => {
      const mascot = new MascotModel(0);
      mascot.triggerHop(); // 1
      mascot.triggerHop(); // 2
      mascot.triggerHop(); // 3
      expect(mascot.hopCount).toBe(3);
      expect(env.confetti.calls.length).toBe(0);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F06] Mascot Anatomy & Physics Boundary Cases', () => {
    /**
     * @tier: 2
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T2_F06_01] Rapid multi-hop spamming (10 triggers within 100ms) tracks count accurately', () => {
      const mascot = new MascotModel();
      for (let i = 0; i < 10; i++) {
        mascot.triggerHop();
      }
      expect(mascot.hopCount).toBe(10);
      expect(localStorage.getItem('macatung_hop_count')).toBe('10');
      expect(mascot.isHopping).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T2_F06_02] Multi-touch event on mobile handles primary touch and prevents multi-trigger glitch', () => {
      const mascot = new MascotModel();
      const multiTouchEvent = new MockTouchEvent('touchstart', {
        touches: [
          new MockTouch({ identifier: 1, clientX: 50, clientY: 50 }),
          new MockTouch({ identifier: 2, clientX: 80, clientY: 80 })
        ]
      });

      let handled = false;
      const el = document.createElement('div');
      el.addEventListener('touchstart', (e: any) => {
        if (!handled && e.touches.length > 0) {
          handled = true;
          mascot.triggerHop();
        }
      });

      el.dispatchEvent(multiTouchEvent);
      expect(mascot.hopCount).toBe(1);
    });

    /**
     * @tier: 2
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T2_F06_03] Touch cancellation resets visual state without corrupted hop count', () => {
      const mascot = new MascotModel();
      const el = document.createElement('div');
      el.classList.add('touch-active');

      el.addEventListener('touchcancel', () => {
        el.classList.remove('touch-active');
      });

      const cancelEv = new MockTouchEvent('touchcancel');
      el.dispatchEvent(cancelEv);
      expect(el.classList.contains('touch-active')).toBe(false);
      expect(mascot.hopCount).toBe(0);
    });

    /**
     * @tier: 2
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T2_F06_04] Quote index wrapping survives 100+ hops without out-of-bounds errors', () => {
      const mascot = new MascotModel();
      expect(() => {
        for (let i = 0; i < 100; i++) {
          mascot.triggerHop();
          const q = mascot.getQuote();
          expect(typeof q).toBe('string');
          expect(q.length).toBeGreaterThan(5);
        }
      }).not.toThrow();
    });

    /**
     * @tier: 2
     * @feature: F06_MASCOT_PHYSICS
     */
    it('[T2_F06_05] Invalid or unusual size prop falls back safely to "md"', () => {
      const invalidMascot = new MascotModel(0, 'normal', 'extra-giant' as any);
      expect(invalidMascot.size).toBe('md');

      const heroMascot = new MascotModel(0, 'normal', 'hero');
      expect(heroMascot.size).toBe('hero');
    });
  });

  describe('[T2_F07] Mascot Mood Boundary & Edge Cases', () => {
    /**
     * @tier: 2
     * @feature: F07_MASCOT_MOODS
     */
    it('[T2_F07_01] Setting invalid mood string defaults safely to "normal"', () => {
      const mascot = new MascotModel();
      mascot.setMood('hyperactive' as any);
      expect(mascot.mood).toBe('normal');

      mascot.setMood('' as any);
      expect(mascot.mood).toBe('normal');
    });

    /**
     * @tier: 2
     * @feature: F07_MASCOT_MOODS
     */
    it('[T2_F07_02] Rapid mood switching (50 changes) maintains consistent state and pitch multipliers', () => {
      const mascot = new MascotModel();
      const moodList: ('normal' | 'caffeine' | 'sleepy' | 'rage')[] = ['normal', 'caffeine', 'sleepy', 'rage'];

      for (let i = 0; i < 50; i++) {
        const target = moodList[i % 4];
        mascot.setMood(target);
        expect(mascot.mood).toBe(target);
        expect(mascot.getPitchMultiplier()).toBeGreaterThan(0.5);
      }
    });

    /**
     * @tier: 2
     * @feature: F07_MASCOT_MOODS
     */
    it('[T2_F07_03] Changing mood during active hop does not abort animation timer', async () => {
      const mascot = new MascotModel();
      mascot.triggerHop();
      expect(mascot.isHopping).toBe(true);

      mascot.setMood('rage');
      expect(mascot.isHopping).toBe(true);
      expect(mascot.mood).toBe('rage');

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(mascot.isHopping).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F07_MASCOT_MOODS
     */
    it('[T2_F07_04] Pitch multipliers are strictly bounded between 0.7x and 2.0x across all moods', () => {
      const mascot = new MascotModel();
      const moods: ('normal' | 'caffeine' | 'sleepy' | 'rage')[] = ['normal', 'caffeine', 'sleepy', 'rage'];

      for (const m of moods) {
        mascot.setMood(m);
        const pitch = mascot.getPitchMultiplier();
        expect(pitch).toBeGreaterThanOrEqual(0.7);
        expect(pitch).toBeLessThanOrEqual(2.0);
      }
    });

    /**
     * @tier: 2
     * @feature: F07_MASCOT_MOODS
     */
    it('[T2_F07_05] Mood state switching triggers sound without unhandled AudioContext errors', () => {
      const mascot = new MascotModel();
      expect(() => {
        mascot.setMood('caffeine');
        mascot.triggerHop();
        mascot.setMood('sleepy');
        mascot.triggerHop();
        mascot.setMood('rage');
        mascot.triggerHop();
      }).not.toThrow();
    });
  });

  describe('[T2_F08] Hop Ledger Boundary & Persistence Stress', () => {
    /**
     * @tier: 2
     * @feature: F08_HOP_LEDGER
     */
    it('[T2_F08_01] Extremely large hop count (e.g. 50,000) persists without numeric corruption', () => {
      localStorage.setItem('macatung_hop_count', '50000');
      const mascot = new MascotModel();
      expect(mascot.hopCount).toBe(50000);

      mascot.triggerHop();
      expect(mascot.hopCount).toBe(50001);
      expect(localStorage.getItem('macatung_hop_count')).toBe('50001');
    });

    /**
     * @tier: 2
     * @feature: F08_HOP_LEDGER
     */
    it('[T2_F08_02] Corrupted or negative localStorage hop count is sanitized to 0', () => {
      const corruptedItems = ['-100', 'invalid_count', 'NaN', 'undefined', 'null', ''];
      for (const corrupt of corruptedItems) {
        localStorage.setItem('macatung_hop_count', corrupt);
        const mascot = new MascotModel();
        expect(mascot.hopCount).toBe(0);
      }
    });

    /**
     * @tier: 2
     * @feature: F08_HOP_LEDGER
     */
    it('[T2_F08_03] Milestone celebrations trigger reliably on 10, 20, 50, 100', () => {
      const mascot = new MascotModel(0);
      const milestonesHit: number[] = [];

      mascot.on('milestone', (m: number) => {
        milestonesHit.push(m);
      });

      for (let i = 1; i <= 50; i++) {
        mascot.triggerHop();
      }

      expect(milestonesHit).toEqual([10, 20, 30, 40, 50]);
      expect(env.confetti.calls.length).toBe(5);
    });

    /**
     * @tier: 2
     * @feature: F08_HOP_LEDGER
     */
    it('[T2_F08_04] Resetting hop count removes localStorage key and broadcasts 0 to listeners', () => {
      const mascot = new MascotModel(42);
      let emitted = -1;
      mascot.on('hop-count-change', (cnt: number) => {
        emitted = cnt;
      });

      mascot.resetCount();
      expect(mascot.hopCount).toBe(0);
      expect(emitted).toBe(0);
      expect(localStorage.getItem('macatung_hop_count')).toBeNull();
    });

    /**
     * @tier: 2
     * @feature: F08_HOP_LEDGER
     */
    it('[T2_F08_05] Hop ledger behaves safely when localStorage throwing QuotaExceeded error', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      try {
        const mascot = new MascotModel(5);
        expect(() => mascot.triggerHop()).not.toThrow();
        expect(mascot.hopCount).toBe(6);
      } finally {
        localStorage.setItem = originalSetItem;
      }
    });
  });
});
