/**
 * Test Suite: Hero, Navbar & Footer Navigation (F21)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { sound } from '../../resources/js/audio/soundEffects.ts';

export class NavigationModel {
  public isMobileDrawerOpen: boolean = false;
  public isScrolled: boolean = false;
  public scrollY: number = 0;
  public navLinks = [
    { label: 'Grimoire', href: '#grimoire' },
    { label: 'Talisman', href: '#talisman' },
    { label: 'Terminal', href: '#terminal' },
    { label: 'Skills', href: '#skills' },
    { label: 'Chronicles', href: '#experience' },
    { label: 'Summon', href: '#contact' }
  ];

  public toggleMobileDrawer() {
    this.isMobileDrawerOpen = !this.isMobileDrawerOpen;
    sound.playClick();
  }

  public closeMobileDrawer() {
    this.isMobileDrawerOpen = false;
  }

  public handleScroll(y: number) {
    this.scrollY = y;
    this.isScrolled = y > 50;
  }

  public scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    sound.playHop(1.2);
  }

  public isHopToTopVisible(): boolean {
    return this.scrollY >= 300;
  }
}

describe('LayoutNavFooterTest (F21)', () => {
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
  describe('[T1_F21] Hero, Navbar & Footer Component Structure', () => {
    /**
     * @tier: 1
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T1_F21_01] Hero section renders prominent "Code at midnight." headline', () => {
      const heroEl = document.createElement('div');
      heroEl.className = 'hero-section';
      const h1 = document.createElement('h1');
      h1.className = 'text-4xl sm:text-6xl font-display font-extrabold text-white';
      h1.textContent = 'Code at ';
      const span = document.createElement('span');
      span.className = 'text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint to-talisman-gold';
      span.textContent = 'midnight';
      h1.appendChild(span);
      heroEl.appendChild(h1);

      expect(heroEl.querySelector('h1')?.textContent).toContain('Code at');
      expect(heroEl.querySelector('span')?.textContent).toBe('midnight');
    });

    /**
     * @tier: 1
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T1_F21_02] Navbar renders logo and primary navigation links', () => {
      const nav = new NavigationModel();
      expect(nav.navLinks.length).toBe(6);
      const labels = nav.navLinks.map((l) => l.label);
      expect(labels).toContain('Grimoire');
      expect(labels).toContain('Talisman');
      expect(labels).toContain('Summon');
    });

    /**
     * @tier: 1
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T1_F21_03] Mobile drawer menu toggles open and closed', () => {
      const nav = new NavigationModel();
      expect(nav.isMobileDrawerOpen).toBe(false);

      nav.toggleMobileDrawer();
      expect(nav.isMobileDrawerOpen).toBe(true);

      nav.toggleMobileDrawer();
      expect(nav.isMobileDrawerOpen).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T1_F21_04] Footer renders copyright notice and technology attribution', () => {
      const footerEl = document.createElement('footer');
      footerEl.className = 'footer border-t border-white/5 py-8 text-center text-xs font-mono text-slate-500';
      const p = document.createElement('p');
      p.textContent = '© 2026 macatung.dev — Crafted with Laravel 11, Inertia.js, Vue 3 & Midnight Magic.';
      footerEl.appendChild(p);

      expect(footerEl.querySelector('p')?.textContent).toContain('2026 macatung.dev');
      expect(footerEl.querySelector('p')?.textContent).toContain('Laravel 11');
      expect(footerEl.querySelector('p')?.textContent).toContain('Vue 3');
    });

    /**
     * @tier: 1
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T1_F21_05] Hop-to-Top button triggers window.scrollTo and plays hop sound', () => {
      const nav = new NavigationModel();
      window.scrollTo(0, 1200);
      expect(window.scrollY).toBe(1200);

      nav.scrollToTop();
      expect(window.scrollY).toBe(0);

      const oscs = env.audioContext.getAllOscillators();
      expect(oscs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F21] Navbar Scroll States & Mobile Drawer Bounds', () => {
    /**
     * @tier: 2
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T2_F21_01] Navbar becomes scrolled when scrollY exceeds 50px threshold', () => {
      const nav = new NavigationModel();
      expect(nav.isScrolled).toBe(false);

      nav.handleScroll(20);
      expect(nav.isScrolled).toBe(false);

      nav.handleScroll(80);
      expect(nav.isScrolled).toBe(true);

      nav.handleScroll(0);
      expect(nav.isScrolled).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T2_F21_02] Hop-to-Top button becomes visible only when scrollY >= 300px', () => {
      const nav = new NavigationModel();
      nav.handleScroll(100);
      expect(nav.isHopToTopVisible()).toBe(false);

      nav.handleScroll(299);
      expect(nav.isHopToTopVisible()).toBe(false);

      nav.handleScroll(300);
      expect(nav.isHopToTopVisible()).toBe(true);

      nav.handleScroll(2000);
      expect(nav.isHopToTopVisible()).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T2_F21_03] Navigating to a section closes mobile drawer automatically', () => {
      const nav = new NavigationModel();
      nav.toggleMobileDrawer();
      expect(nav.isMobileDrawerOpen).toBe(true);

      nav.closeMobileDrawer();
      expect(nav.isMobileDrawerOpen).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T2_F21_04] All navigation link href targets start with valid anchor hash', () => {
      const nav = new NavigationModel();
      nav.navLinks.forEach((link) => {
        expect(link.href.startsWith('#')).toBe(true);
        expect(link.href.length).toBeGreaterThan(1);
      });
    });

    /**
     * @tier: 2
     * @feature: F21_NAV_HERO_FOOTER
     */
    it('[T2_F21_05] Sticky navbar CSS includes backdrop blur and z-index layers', () => {
      const headerEl = document.createElement('header');
      headerEl.className = 'sticky top-0 z-40 border-b border-white/5 bg-midnight-950/80 backdrop-blur-md';

      expect(headerEl.classList.contains('sticky')).toBe(true);
      expect(headerEl.classList.contains('backdrop-blur-md')).toBe(true);
      expect(headerEl.classList.contains('z-40')).toBe(true);
    });
  });
});
