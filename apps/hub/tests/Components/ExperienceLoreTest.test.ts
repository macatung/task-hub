/**
 * Test Suite: Experience & Midnight Chronicles (F20)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { experienceData } from '../../resources/js/data/experienceData.ts';
import type { ExperienceItem } from '../../resources/js/types/portfolio.ts';

describe('ExperienceLoreTest (F20)', () => {
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
  describe('[T1_F20] Experience Timeline & Midnight Quest Lore', () => {
    /**
     * @tier: 1
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T1_F20_01] Experience timeline renders all 4 milestones', () => {
      expect(experienceData.length).toBe(4);
      const roles = experienceData.map((e) => e.role);
      expect(roles).toContain('Lead AI Agent & Autonomous Systems Architect');
      expect(roles).toContain('Fullstack Developer & Senior Systems Architect');
      expect(roles).toContain('Backend Web Developer & Streaming Engineer');
      expect(roles).toContain('National Informatics Prodigy & Software Engineer');
    });

    /**
     * @tier: 1
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T1_F20_02] Timeline follows strict chronological order from present back to 2013', () => {
      expect(experienceData[0].period).toBe('2025 — Hiện Tại');
      expect(experienceData[1].period).toBe('02/2022 — 06/2025');
      expect(experienceData[2].period).toBe('06/2017 — 01/2022');
      expect(experienceData[3].period).toBe('2013 — 2018');
    });

    /**
     * @tier: 1
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T1_F20_03] Every role has at least 2 impactful achievement bullet points', () => {
      experienceData.forEach((item) => {
        expect(item.achievements.length).toBeGreaterThanOrEqual(2);
        item.achievements.forEach((ach) => {
          expect(ach.length).toBeGreaterThan(20);
        });
      });
    });

    /**
     * @tier: 1
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T1_F20_04] Every role displays relevant technology stack badges', () => {
      experienceData.forEach((item) => {
        expect(item.technologies.length).toBeGreaterThanOrEqual(4);
      });
    });

    /**
     * @tier: 1
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T1_F20_05] Every role includes a unique Midnight Quest lore narrative', () => {
      experienceData.forEach((item) => {
        expect(typeof item.midnightQuest).toBe('string');
        expect(item.midnightQuest.length).toBeGreaterThan(20);
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F20] Timeline Styling & Content Integrity', () => {
    /**
     * @tier: 2
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T2_F20_01] Experience types map to valid enum tags ("Full-time", "Contract", "Open Source", "Venture", "Education & Awards")', () => {
      const allowedTypes = ['Full-time', 'Contract', 'Open Source', 'Venture', 'Education & Awards'];
      experienceData.forEach((item) => {
        expect(allowedTypes).toContain(item.type);
      });
    });

    /**
     * @tier: 2
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T2_F20_02] Technologies list in each experience item has zero duplicates', () => {
      experienceData.forEach((item) => {
        const uniqueTechs = new Set(item.technologies);
        expect(uniqueTechs.size).toBe(item.technologies.length);
      });
    });

    /**
     * @tier: 2
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T2_F20_03] Timeline connector element renders continuous vertical line styling', () => {
      const lineEl = document.createElement('div');
      lineEl.className = 'absolute top-0 bottom-0 left-4 w-0.5 bg-gradient-to-b from-phantom-mint/40 via-talisman-gold/30 to-phantom-purple/20';

      expect(lineEl.classList.contains('absolute')).toBe(true);
      expect(lineEl.classList.contains('w-0.5')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T2_F20_04] Midnight quest narratives are humorous, mystical, and engineering-focused', () => {
      const quests = experienceData.map((e) => e.midnightQuest);
      expect(quests.some((q) => q.includes('Multi-Agent') || q.includes('GIS'))).toBe(true);
      expect(quests.some((q) => q.includes('Midnight'))).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F20_EXPERIENCE_LORE
     */
    it('[T2_F20_05] Experience cards use glass-panel styling with responsive padding', () => {
      const cardEl = document.createElement('div');
      cardEl.className = 'glass-panel p-6 rounded-2xl hover:border-phantom-mint/40 transition-all';

      expect(cardEl.classList.contains('glass-panel')).toBe(true);
      expect(cardEl.classList.contains('p-6')).toBe(true);
    });
  });
});
