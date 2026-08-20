/**
 * Test Suite: Midnight Clock & Live Status (F17)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

export class MidnightClockModel {
  public currentTime: Date;
  public manualOverridePhase: string | null = null;
  public pingMs: number = 18;

  constructor(initialDate?: Date) {
    this.currentTime = initialDate || new Date();
  }

  public setTime(date: Date) {
    this.currentTime = date;
  }

  public getFormattedTime(): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = pad(this.currentTime.getHours());
    const minutes = pad(this.currentTime.getMinutes());
    const seconds = pad(this.currentTime.getSeconds());
    return `${hours}:${minutes}:${seconds}`;
  }

  public getRealPhase(): 'midnight' | 'dawn' | 'afternoon' | 'twilight' {
    const hour = this.currentTime.getHours();
    if (hour >= 0 && hour < 6) return 'midnight';
    if (hour >= 6 && hour < 12) return 'dawn';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'twilight';
  }

  public getActivePhase(): 'midnight' | 'dawn' | 'afternoon' | 'twilight' {
    if (this.manualOverridePhase && ['midnight', 'dawn', 'afternoon', 'twilight'].includes(this.manualOverridePhase)) {
      return this.manualOverridePhase as any;
    }
    return this.getRealPhase();
  }

  public setPhaseOverride(phase: 'midnight' | 'dawn' | 'afternoon' | 'twilight') {
    this.manualOverridePhase = phase;
  }

  public resetToRealTime() {
    this.manualOverridePhase = null;
  }

  public isMidnightMode(): boolean {
    return this.getActivePhase() === 'midnight';
  }

  public getStatusBadge(): { mode: 'midnight' | 'daylight'; text: string } {
    if (this.isMidnightMode()) {
      return { mode: 'midnight', text: '🌙 Midnight Mode — Maximum Flow' };
    }
    return { mode: 'daylight', text: '☀️ Daylight Prep — Recharging' };
  }

  public getCaffeineLevel(): number {
    const phase = this.getActivePhase();
    if (phase === 'midnight') return 100;
    if (phase === 'twilight') return 80;
    if (phase === 'afternoon') return 65;
    return 45; // dawn
  }

  public getSimulatedPing(): number {
    return Math.max(8, Math.min(48, Math.floor(14 + Math.random() * 10)));
  }

  public tick(): string {
    this.currentTime = new Date(this.currentTime.getTime() + 1000);
    return this.getFormattedTime();
  }
}

describe('MidnightClockTest (F17)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F17] Midnight Clock & Real-time Live Status', () => {
    /**
     * @tier: 1
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T1_F17_01] Clock formats time string strictly as HH:mm:ss with 2-digit zero padding', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T03:07:09'));
      expect(clock.getFormattedTime()).toBe('03:07:09');
    });

    /**
     * @tier: 1
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T1_F17_02] 03:00 AM activates Midnight Mode badge', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T03:00:00'));
      expect(clock.isMidnightMode()).toBe(true);
      expect(clock.getStatusBadge().mode).toBe('midnight');
      expect(clock.getStatusBadge().text).toContain('Midnight Mode');
    });

    /**
     * @tier: 1
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T1_F17_03] 14:00 PM activates Daylight Prep badge', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T14:00:00'));
      expect(clock.isMidnightMode()).toBe(false);
      expect(clock.getStatusBadge().mode).toBe('daylight');
      expect(clock.getStatusBadge().text).toContain('Daylight Prep');
    });

    /**
     * @tier: 1
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T1_F17_04] Caffeine level calculator computes 100% peak during 01:00-04:00 AM', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T02:30:00'));
      expect(clock.getCaffeineLevel()).toBe(100);
    });

    /**
     * @tier: 1
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T1_F17_05] Clock tick increments time by 1 second', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T23:59:58'));
      expect(clock.getFormattedTime()).toBe('23:59:58');
      expect(clock.tick()).toBe('23:59:59');
      expect(clock.tick()).toBe('00:00:00');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F17] Boundary & Time Transition Handling', () => {
    /**
     * @tier: 2
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T2_F17_01] Exact midnight boundary 00:00:00 triggers Midnight Mode transition', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T00:00:00'));
      expect(clock.isMidnightMode()).toBe(true);
      expect(clock.getRealPhase()).toBe('midnight');
      expect(clock.getFormattedTime()).toBe('00:00:00');
      expect(clock.getStatusBadge().mode).toBe('midnight');
    });

    /**
     * @tier: 2
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T2_F17_02] Exact 06:00:00 morning boundary transitions cleanly to Golden Dawn', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T06:00:00'));
      expect(clock.isMidnightMode()).toBe(false);
      expect(clock.getRealPhase()).toBe('dawn');
      expect(clock.getFormattedTime()).toBe('06:00:00');
      expect(clock.getStatusBadge().mode).toBe('daylight');
    });

    /**
     * @tier: 2
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T2_F17_03] 23:59:59 late night boundary is in Twilight Dusk before rollover to Midnight', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T23:59:59'));
      expect(clock.getRealPhase()).toBe('twilight');
      clock.tick();
      expect(clock.isMidnightMode()).toBe(true); // rolls over to 00:00:00
      expect(clock.getRealPhase()).toBe('midnight');
    });

    /**
     * @tier: 2
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T2_F17_04] Time Travel overrides active phase and resets cleanly to real time', () => {
      const clock = new MidnightClockModel(new Date('2026-08-17T14:00:00')); // Real is afternoon
      expect(clock.getRealPhase()).toBe('afternoon');
      expect(clock.getActivePhase()).toBe('afternoon');

      // Warp to midnight
      clock.setPhaseOverride('midnight');
      expect(clock.getActivePhase()).toBe('midnight');
      expect(clock.isMidnightMode()).toBe(true);
      expect(clock.getCaffeineLevel()).toBe(100);

      // Reset to real time
      clock.resetToRealTime();
      expect(clock.getActivePhase()).toBe('afternoon');
      expect(clock.isMidnightMode()).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F17_MIDNIGHT_CLOCK
     */
    it('[T2_F17_05] Simulated ping returns positive integer ms strictly under 100ms', () => {
      const clock = new MidnightClockModel();
      for (let i = 0; i < 20; i++) {
        const ping = clock.getSimulatedPing();
        expect(ping).toBeGreaterThan(0);
        expect(ping).toBeLessThan(100);
      }
    });
  });
});
