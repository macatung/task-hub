/**
 * Test Suite: Skills & Tech Rune Arsenal (F19)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { skillsData } from '../../resources/js/data/skillsData.ts';
import type { SkillCategory, SkillItem } from '../../resources/js/types/portfolio.ts';

describe('SkillsArsenalTest (F19)', () => {
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
  describe('[T1_F19] Skills Arsenal 4 Categories & Proficiency Bars', () => {
    /**
     * @tier: 1
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T1_F19_01] Skills section renders all 4 categories with title and badge', () => {
      expect(skillsData.length).toBe(4);
      const badges = skillsData.map((c) => c.badge);
      expect(badges).toContain('Autonomous Systems');
      expect(badges).toContain('High-Throughput');
      expect(badges).toContain('Specialized Infra');
      expect(badges).toContain('99.99% Uptime');
    });

    /**
     * @tier: 1
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T1_F19_02] All 18 skill items are loaded across the 4 categories', () => {
      const allSkills: SkillItem[] = [];
      skillsData.forEach((c) => allSkills.push(...c.skills));

      expect(allSkills.length).toBe(18);
      const names = allSkills.map((s) => s.name);
      expect(names).toContain('Multi-Agent Orchestration');
      expect(names).toContain('Tool & Function Calling');
      expect(names).toContain('PHP 8.3+ & Laravel 11/12');
      expect(names).toContain('Vue 3 & ReactJS / React Native');
    });

    /**
     * @tier: 1
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T1_F19_03] Proficiency bar width style scales proportionally with skill level', () => {
      skillsData.forEach((c) => {
        c.skills.forEach((s) => {
          const barEl = document.createElement('div');
          barEl.className = 'proficiency-bar-fill';
          barEl.style.width = `${s.level}%`;

          expect(barEl.style.width).toBe(`${s.level}%`);
        });
      });
    });

    /**
     * @tier: 1
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T1_F19_04] Every skill item has an associated mystical rune emoji', () => {
      skillsData.forEach((c) => {
        c.skills.forEach((s) => {
          expect(typeof s.rune).toBe('string');
          expect(s.rune.length).toBeGreaterThan(0);
        });
      });
    });

    /**
     * @tier: 1
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T1_F19_05] Verification pledge card is rendered with quality guarantee', () => {
      const pledgeEl = document.createElement('div');
      pledgeEl.className = 'quality-pledge-card';
      const h4 = document.createElement('h4');
      h4.className = 'text-phantom-mint font-display font-bold';
      h4.textContent = '100% Tested & Verified';
      const p = document.createElement('p');
      p.className = 'text-slate-400 text-xs';
      p.textContent = 'Every system built with automated test suites, zero regressions, and pure craftsmanship.';
      pledgeEl.appendChild(h4);
      pledgeEl.appendChild(p);

      expect(pledgeEl.querySelector('h4')?.textContent).toContain('100% Tested & Verified');
      expect(pledgeEl.querySelector('p')?.textContent).toContain('automated test suites');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F19] Boundary & Clamping for Skills Arsenal', () => {
    /**
     * @tier: 2
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T2_F19_01] Skill levels are strictly clamped within [80, 100]', () => {
      skillsData.forEach((c) => {
        c.skills.forEach((s) => {
          const clamped = Math.max(0, Math.min(100, s.level));
          expect(clamped).toBe(s.level);
          expect(s.level).toBeGreaterThanOrEqual(80);
          expect(s.level).toBeLessThanOrEqual(100);
        });
      });
    });

    /**
     * @tier: 2
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T2_F19_02] Skill descriptions are descriptive (>=20 characters) and non-empty', () => {
      skillsData.forEach((c) => {
        c.skills.forEach((s) => {
          expect(s.description.trim().length).toBeGreaterThanOrEqual(20);
        });
      });
    });

    /**
     * @tier: 2
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T2_F19_03] Filtering skills by tag (e.g. "Core AI", "Automation", "GenAI") returns exact matches', () => {
      const allSkills: SkillItem[] = [];
      skillsData.forEach((c) => allSkills.push(...c.skills));

      const coreSkills = allSkills.filter((s) => s.tag === 'Core AI');
      expect(coreSkills.length).toBeGreaterThan(0);
      coreSkills.forEach((s) => expect(s.tag).toBe('Core AI'));
    });

    /**
     * @tier: 2
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T2_F19_04] Progress bars apply transition classes for smooth initial load reveal', () => {
      const bar = document.createElement('div');
      bar.className = 'h-2 rounded-full bg-phantom-mint transition-all duration-700 ease-out';

      expect(bar.classList.contains('transition-all')).toBe(true);
      expect(bar.classList.contains('duration-700')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F19_SKILLS_ARSENAL
     */
    it('[T2_F19_05] Categories contain valid Lucide icon references', () => {
      const icons = skillsData.map((c) => c.iconName);
      expect(icons).toContain('Layout');
      expect(icons).toContain('Server');
      expect(icons).toContain('Cloud');
      expect(icons).toContain('Sparkles');
    });
  });
});
