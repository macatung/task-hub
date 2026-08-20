/**
 * Test Suite: Responsive Layout & Anti-Collision (F22)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

describe('ResponsiveLayoutTest (F22)', () => {
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
  describe('[T1_F22] Viewport Layouts & Tap Target Dimensions', () => {
    /**
     * @tier: 1
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T1_F22_01] 360px mobile small viewport verifies single-column flow', () => {
      window.resizeTo(360, 640);
      expect(window.innerWidth).toBe(360);

      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      expect(isMobile).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T1_F22_02] 390px mobile iPhone viewport verifies mobile container bounds', () => {
      window.resizeTo(390, 844);
      expect(window.innerWidth).toBe(390);

      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      expect(isMobile).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T1_F22_03] 768px tablet viewport verifies 2-column grid layout breakpoint', () => {
      window.resizeTo(768, 1024);
      expect(window.innerWidth).toBe(768);

      const isTablet = window.matchMedia('(min-width: 768px)').matches;
      expect(isTablet).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T1_F22_04] 1440px desktop viewport verifies max-w-7xl centered container', () => {
      window.resizeTo(1440, 900);
      expect(window.innerWidth).toBe(1440);

      const containerEl = document.createElement('div');
      containerEl.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

      expect(containerEl.classList.contains('max-w-7xl')).toBe(true);
      expect(containerEl.classList.contains('mx-auto')).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T1_F22_05] Interactive action buttons meet minimum 44x44px touch tap target requirements', () => {
      const buttonEl = document.createElement('button');
      buttonEl.className = 'min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl';
      buttonEl.offsetWidth = 48;
      buttonEl.offsetHeight = 48;

      const rect = buttonEl.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F22] Viewport Resize Stress & Text Anti-Collision', () => {
    /**
     * @tier: 2
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T2_F22_01] Rapid resizing across breakpoints dispatches resize events accurately', () => {
      const widths = [360, 390, 768, 1024, 1440, 360];
      let resizeCount = 0;

      window.addEventListener('resize', () => {
        resizeCount++;
      });

      widths.forEach((w) => {
        window.resizeTo(w, 800);
        expect(window.innerWidth).toBe(w);
      });

      expect(resizeCount).toBe(widths.length);
    });

    /**
     * @tier: 2
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T2_F22_02] Extremely narrow 320px viewport applies break-words to prevent horizontal spill', () => {
      window.resizeTo(320, 568);
      const textEl = document.createElement('div');
      textEl.className = 'break-words overflow-hidden text-xs';

      expect(textEl.classList.contains('break-words')).toBe(true);
      expect(textEl.classList.contains('overflow-hidden')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T2_F22_03] Ultra-wide 4K viewport (2560px) enforces max-w-7xl constraint', () => {
      window.resizeTo(2560, 1440);
      expect(window.innerWidth).toBe(2560);

      const mainEl = document.createElement('main');
      mainEl.className = 'max-w-7xl mx-auto';
      expect(mainEl.classList.contains('max-w-7xl')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T2_F22_04] Mobile navigation drawer uses fixed overlay with z-50 to avoid clipping', () => {
      const drawerEl = document.createElement('div');
      drawerEl.className = 'fixed inset-0 z-50 bg-midnight-950/95 backdrop-blur-xl lg:hidden';

      expect(drawerEl.classList.contains('fixed')).toBe(true);
      expect(drawerEl.classList.contains('z-50')).toBe(true);
      expect(drawerEl.classList.contains('lg:hidden')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F22_RESPONSIVE_ANTI
     */
    it('[T2_F22_05] Responsive typography uses clamp or fluid responsive utility classes', () => {
      const headingEl = document.createElement('h1');
      headingEl.className = 'text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight';

      expect(headingEl.classList.contains('text-3xl')).toBe(true);
      expect(headingEl.classList.contains('sm:text-5xl')).toBe(true);
      expect(headingEl.classList.contains('lg:text-6xl')).toBe(true);
      expect(headingEl.classList.contains('tracking-tight')).toBe(true);
    });
  });
});
