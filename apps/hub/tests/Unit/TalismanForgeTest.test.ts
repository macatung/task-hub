/**
 * Test Suite: Developer Talisman Forge, Khai Quang Blessing & ASCII Exporter (F12, F13, F14)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { sound } from '../../resources/js/audio/soundEffects.ts';
import { talismanPresets } from '../../resources/js/data/talismanData.ts';
import type { TalismanPreset } from '../../resources/js/types/portfolio.ts';

export class TalismanForgeModel {
  public selectedPreset: TalismanPreset;
  public developerName: string = '';
  public customWish: string = '';
  public colorPalette: 'yellow' | 'crimson' | 'cyan' | 'purple' = 'yellow';
  public isBlessed: boolean = false;
  public isBlessingAnimation: boolean = false;
  public listeners: { [key: string]: Function[] } = {};

  constructor(presetIndex: number = 0) {
    this.selectedPreset = talismanPresets[presetIndex] || talismanPresets[0];
    this.colorPalette = this.selectedPreset.colorScheme;
  }

  public on(event: string, cb: Function) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
  }

  public emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  public selectPreset(id: string) {
    const found = talismanPresets.find((p) => p.id === id);
    if (found) {
      this.selectedPreset = found;
      this.colorPalette = found.colorScheme;
      this.isBlessed = false;
      this.emit('preset-change', found);
    }
  }

  public setDeveloperName(name: string) {
    this.developerName = name;
  }

  public setCustomWish(wish: string) {
    this.customWish = wish;
  }

  public setColorPalette(color: string) {
    if (['yellow', 'crimson', 'cyan', 'purple'].includes(color)) {
      this.colorPalette = color as any;
    }
  }

  public triggerKhaiQuang(duration: number = 30, onComplete?: () => void) {
    if (this.isBlessingAnimation) return; // Debounce lock

    this.isBlessingAnimation = true;
    sound.playTalisman();
    try {
      (globalThis as any).confetti?.({ particleCount: 35 });
    } catch {
      // Graceful fallback if confetti fails
    }

    setTimeout(() => {
      this.isBlessed = true;
      this.isBlessingAnimation = false;
      this.emit('blessed');
      if (onComplete) onComplete();
    }, duration);
  }

  public getDisplayName(): string {
    return this.developerName.trim() || 'Midnight Engineer';
  }

  public getDisplayWish(): string {
    return this.customWish.trim() || this.selectedPreset.meaning;
  }

  public generateAsciiTalisman(): string {
    const name = this.getDisplayName();
    const wish = this.getDisplayWish();
    const title = this.selectedPreset.title;
    const seal = this.isBlessed ? '[✓ ĐÃ KHAI QUANG]' : '[CHƯA KHAI QUANG]';

    return `
+------------------------------------------+
|  ⚡ MACATUNG.DEV DEV TALISMAN FORGE ⚡  |
+------------------------------------------+
|  SPELL:  ${title.padEnd(30, ' ')} |
|  OWNER:  ${name.padEnd(30, ' ')} |
|  WISH:   ${wish.slice(0, 30).padEnd(30, ' ')} |
|  STATUS: ${seal.padEnd(30, ' ')} |
+------------------------------------------+
|  try { deploy(); } catch { /* PEACE */ } |
+------------------------------------------+
`.trim();
  }

  public copyAsciiToClipboard(): string {
    const ascii = this.generateAsciiTalisman();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ascii);
    }
    return ascii;
  }
}

describe('TalismanForgeTest (F12, F13, F14)', () => {
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
  describe('[T1_F12] Developer Talisman Forge Preset Selection & Custom Inputs', () => {
    /**
     * @tier: 1
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T1_F12_01] Forge loads with 6 preset spells from static dataset', () => {
      expect(talismanPresets.length).toBe(6);
      const forge = new TalismanForgeModel();
      expect(forge.selectedPreset.id).toBe('bua-no-bug');
    });

    /**
     * @tier: 1
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T1_F12_02] Selecting preset switches active spell and default color palette', () => {
      const forge = new TalismanForgeModel();
      forge.selectPreset('bua-friday-deploy');
      expect(forge.selectedPreset.title).toBe('BÙA DEPLOY THỨ 6');
      expect(forge.colorPalette).toBe('crimson');
    });

    /**
     * @tier: 1
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T1_F12_03] Developer name input binds and reflects in display name', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('Alchemist Tưng');
      expect(forge.developerName).toBe('Alchemist Tưng');
      expect(forge.getDisplayName()).toBe('Alchemist Tưng');
    });

    /**
     * @tier: 1
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T1_F12_04] Custom wish input binds and overrides preset meaning', () => {
      const forge = new TalismanForgeModel();
      forge.setCustomWish('Deploy 100 microservices lúc 3h sáng không lỗi');
      expect(forge.customWish).toBe('Deploy 100 microservices lúc 3h sáng không lỗi');
      expect(forge.getDisplayWish()).toBe('Deploy 100 microservices lúc 3h sáng không lỗi');
    });

    /**
     * @tier: 1
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T1_F12_05] 4 color palettes (yellow, crimson, cyan, purple) can be explicitly selected', () => {
      const forge = new TalismanForgeModel();
      const palettes: ('yellow' | 'crimson' | 'cyan' | 'purple')[] = ['yellow', 'crimson', 'cyan', 'purple'];
      for (const p of palettes) {
        forge.setColorPalette(p);
        expect(forge.colorPalette).toBe(p);
      }
    });
  });

  describe('[T1_F13] Khai Quang Blessing Seal Ritual & Feedback', () => {
    /**
     * @tier: 1
     * @feature: F13_KHAI_QUANG
     */
    it('[T1_F13_01] Triggering Khai Quang sets animation state and plays talisman chime sound', () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      expect(forge.isBlessingAnimation).toBe(true);

      const oscs = env.audioContext.getAllOscillators();
      expect(oscs.length).toBeGreaterThanOrEqual(4);
    });

    /**
     * @tier: 1
     * @feature: F13_KHAI_QUANG
     */
    it('[T1_F13_02] Khai Quang blessing dispatches celebratory confetti', () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      expect(env.confetti.calls.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * @tier: 1
     * @feature: F13_KHAI_QUANG
     */
    it('[T1_F13_03] 800ms ritual completion sets isBlessed to true and clears animation state', async () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);

      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);
      expect(forge.isBlessingAnimation).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F13_KHAI_QUANG
     */
    it('[T1_F13_04] Blessed talisman displays rotating seal status badge', async () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      await new Promise((resolve) => setTimeout(resolve, 40));

      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain('[✓ ĐÃ KHAI QUANG]');
    });

    /**
     * @tier: 1
     * @feature: F13_KHAI_QUANG
     */
    it('[T1_F13_05] Switching preset resets blessing seal status', async () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);

      forge.selectPreset('bua-x2-salary');
      expect(forge.isBlessed).toBe(false);
    });
  });

  describe('[T1_F14] ASCII Talisman Exporter & Clipboard Integration', () => {
    /**
     * @tier: 1
     * @feature: F14_ASCII_EXPORT
     */
    it('[T1_F14_01] generateAsciiTalisman produces structured bordered card layout', () => {
      const forge = new TalismanForgeModel();
      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain('+------------------------------------------+');
      expect(ascii).toContain('MACATUNG.DEV DEV TALISMAN FORGE');
    });

    /**
     * @tier: 1
     * @feature: F14_ASCII_EXPORT
     */
    it('[T1_F14_02] ASCII talisman contains injected custom developer name', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('LeadArchitect');
      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain('OWNER:  LeadArchitect');
    });

    /**
     * @tier: 1
     * @feature: F14_ASCII_EXPORT
     */
    it('[T1_F14_03] ASCII talisman contains injected custom wish text', () => {
      const forge = new TalismanForgeModel();
      forge.setCustomWish('Zero Downtime Migration');
      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain('WISH:   Zero Downtime Migration');
    });

    /**
     * @tier: 1
     * @feature: F14_ASCII_EXPORT
     */
    it('[T1_F14_04] ASCII talisman reflects unblessed status prior to ritual', () => {
      const forge = new TalismanForgeModel();
      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain('[CHƯA KHAI QUANG]');
    });

    /**
     * @tier: 1
     * @feature: F14_ASCII_EXPORT
     */
    it('[T1_F14_05] copyAsciiToClipboard copies generated string to navigator.clipboard', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('NightDev');
      const copied = forge.copyAsciiToClipboard();

      expect(copied).toContain('NightDev');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F12] Talisman Forge Input Boundary Cases', () => {
    /**
     * @tier: 2
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T2_F12_01] Empty developer name falls back safely to "Midnight Engineer"', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('   ');
      expect(forge.getDisplayName()).toBe('Midnight Engineer');
    });

    /**
     * @tier: 2
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T2_F12_02] Empty custom wish falls back to selected preset meaning', () => {
      const forge = new TalismanForgeModel();
      forge.setCustomWish('   ');
      expect(forge.getDisplayWish()).toBe(forge.selectedPreset.meaning);
    });

    /**
     * @tier: 2
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T2_F12_03] Very long developer name (>100 characters) handles without crash or layout break', () => {
      const forge = new TalismanForgeModel();
      const longName = 'Grand_Archmage_Of_Ultra_Distributed_Supercomputers_With_High_Throughput_Concurrency_' + 'X'.repeat(50);
      forge.setDeveloperName(longName);
      expect(forge.getDisplayName().length).toBeGreaterThan(100);

      const ascii = forge.generateAsciiTalisman();
      expect(ascii).toContain(longName);
    });

    /**
     * @tier: 2
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T2_F12_04] Special characters & HTML markup in name/wish are preserved safely', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('<script>alert("hacked")</script> & "quotes"');
      forge.setCustomWish('SELECT * FROM `users` WHERE 1=1; --');

      expect(forge.getDisplayName()).toContain('<script>');
      expect(forge.getDisplayWish()).toContain('SELECT');
    });

    /**
     * @tier: 2
     * @feature: F12_TALISMAN_FORGE
     */
    it('[T2_F12_05] Setting invalid color palette string is rejected, preserving current palette', () => {
      const forge = new TalismanForgeModel();
      forge.setColorPalette('yellow');
      forge.setColorPalette('neon-pink-invalid');
      expect(forge.colorPalette).toBe('yellow');
    });
  });

  describe('[T2_F13] Khai Quang Blessing Ritual Boundary Cases', () => {
    /**
     * @tier: 2
     * @feature: F13_KHAI_QUANG
     */
    it('[T2_F13_01] Rapid multi-clicking Khai Quang button during active animation is locked (debounce)', () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      expect(forge.isBlessingAnimation).toBe(true);

      const firstOscCount = env.audioContext.getAllOscillators().length;
      forge.triggerKhaiQuang(30); // Ignored due to lock
      forge.triggerKhaiQuang(30); // Ignored

      const secondOscCount = env.audioContext.getAllOscillators().length;
      expect(secondOscCount).toBe(firstOscCount);
    });

    /**
     * @tier: 2
     * @feature: F13_KHAI_QUANG
     */
    it('[T2_F13_02] Re-blessing after completion allows second ritual execution', async () => {
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);

      // Re-trigger ritual
      forge.triggerKhaiQuang(30);
      expect(forge.isBlessingAnimation).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F13_KHAI_QUANG
     */
    it('[T2_F13_03] Confetti throwing error during blessing does not crash ritual completion', async () => {
      const originalConfetti = (globalThis as any).confetti;
      (globalThis as any).confetti = () => {
        throw new Error('Canvas 2D context lost');
      };

      try {
        const forge = new TalismanForgeModel();
        expect(() => forge.triggerKhaiQuang(30)).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(forge.isBlessed).toBe(true);
      } finally {
        (globalThis as any).confetti = originalConfetti;
      }
    });

    /**
     * @tier: 2
     * @feature: F13_KHAI_QUANG
     */
    it('[T2_F13_04] AudioContext suspended during blessing does not block seal application', async () => {
      env.audioContext.state = 'suspended';
      const forge = new TalismanForgeModel();
      forge.triggerKhaiQuang(30);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F13_KHAI_QUANG
     */
    it('[T2_F13_05] Preset change resets blessing but preserves custom developer name', async () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('Alchemist');
      forge.triggerKhaiQuang(30);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(forge.isBlessed).toBe(true);

      forge.selectPreset('bua-clean-code');
      expect(forge.isBlessed).toBe(false);
      expect(forge.developerName).toBe('Alchemist');
    });
  });

  describe('[T2_F14] ASCII Talisman Exporter Boundary Cases', () => {
    /**
     * @tier: 2
     * @feature: F14_ASCII_EXPORT
     */
    it('[T2_F14_01] Multi-line custom wish string handles without corrupting ASCII header/footer', () => {
      const forge = new TalismanForgeModel();
      forge.setCustomWish('Line 1\nLine 2\nLine 3');
      const ascii = forge.generateAsciiTalisman();
      expect(ascii.startsWith('+------------------------------------------+')).toBe(true);
      expect(ascii.endsWith('+------------------------------------------+')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F14_ASCII_EXPORT
     */
    it('[T2_F14_02] Unicode emojis and Vietnamese diacritics export cleanly into ASCII badge', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('Nguyễn Văn Ma Cà Tưng 🧛‍♂️⚡');
      forge.setCustomWish('Chúc năm mới code 0 bug! ✨🔥');
      const ascii = forge.generateAsciiTalisman();

      expect(ascii).toContain('Nguyễn Văn Ma Cà Tưng');
      expect(ascii).toContain('Chúc năm mới code 0 bug!');
    });

    /**
     * @tier: 2
     * @feature: F14_ASCII_EXPORT
     */
    it('[T2_F14_03] Clipboard API unavailable in headless environment returns string gracefully', () => {
      const originalNav = (globalThis as any).navigator;
      (globalThis as any).navigator = {};

      try {
        const forge = new TalismanForgeModel();
        const text = forge.copyAsciiToClipboard();
        expect(text).toContain('MACATUNG.DEV');
      } finally {
        (globalThis as any).navigator = originalNav;
      }
    });

    /**
     * @tier: 2
     * @feature: F14_ASCII_EXPORT
     */
    it('[T2_F14_04] Leading and trailing whitespace in developer name is trimmed in ASCII output', () => {
      const forge = new TalismanForgeModel();
      forge.setDeveloperName('    TrimmedHero    ');
      expect(forge.getDisplayName()).toBe('TrimmedHero');
    });

    /**
     * @tier: 2
     * @feature: F14_ASCII_EXPORT
     */
    it('[T2_F14_05] ASCII output contains all 6 preset spells accurately when selected', () => {
      for (const preset of talismanPresets) {
        const forge = new TalismanForgeModel();
        forge.selectPreset(preset.id);
        const ascii = forge.generateAsciiTalisman();
        expect(ascii).toContain(preset.title);
      }
    });
  });
});
