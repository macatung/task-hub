/**
 * Test Suite: Portfolio Types & Static Data Layer (F03)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect } from '../Harness/index.js';
import { projectsData } from '../../resources/js/data/projectsData.ts';
import { skillsData } from '../../resources/js/data/skillsData.ts';
import { experienceData, developerStats } from '../../resources/js/data/experienceData.ts';
import { talismanPresets } from '../../resources/js/data/talismanData.ts';
import type { Project, SkillCategory, ExperienceItem, DeveloperStat, TalismanPreset } from '../../resources/js/types/portfolio.ts';

describe('PortfolioDataTest (F03)', () => {
  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F03] Static Datasets & Model Conformance', () => {
    /**
     * @tier: 1
     * @feature: F03_TYPES_DATA
     */
    it('[T1_F03_01] projectsData contains 6 projects conforming to Project schema', () => {
      expect(projectsData.length).toBe(6);

      projectsData.forEach((project: Project) => {
        expect(typeof project.id).toBe('string');
        expect(project.id.length).toBeGreaterThan(0);
        expect(typeof project.title).toBe('string');
        expect(typeof project.tagline).toBe('string');
        expect(typeof project.description).toBe('string');
        expect(['fullstack', 'creative', 'ai-web3', 'tools']).toContain(project.category);
        expect(Array.isArray(project.tags)).toBe(true);
        expect(Array.isArray(project.techStack)).toBe(true);
        expect(Array.isArray(project.metrics)).toBe(true);
        expect(Array.isArray(project.architectureHighlights)).toBe(true);
        expect(typeof project.midnightFact).toBe('string');
      });
    });

    /**
     * @tier: 1
     * @feature: F03_TYPES_DATA
     */
    it('[T1_F03_02] skillsData contains 4 categories and 18 total skill items', () => {
      expect(skillsData.length).toBe(4);

      const expectedCategories = [
        'AI Agents & LLM Architecture',
        'Backend Mastery & Distributed Systems',
        'Telecom, GIS & Network Systems',
        'Frontend Sorcery, Cloud & DevOps'
      ];

      const titles = skillsData.map((c) => c.title);
      expect(titles).toEqual(expectedCategories);

      const totalSkills = skillsData.reduce((acc, cat) => acc + cat.skills.length, 0);
      expect(totalSkills).toBe(18);

      skillsData.forEach((category: SkillCategory) => {
        expect(typeof category.badge).toBe('string');
        expect(typeof category.iconName).toBe('string');
        category.skills.forEach((s) => {
          expect(typeof s.name).toBe('string');
          expect(typeof s.level).toBe('number');
          expect(typeof s.rune).toBe('string');
          expect(typeof s.tag).toBe('string');
          expect(typeof s.description).toBe('string');
        });
      });
    });

    /**
     * @tier: 1
     * @feature: F03_TYPES_DATA
     */
    it('[T1_F03_03] experienceData contains 4 chronological timeline entries', () => {
      expect(experienceData.length).toBe(4);

      experienceData.forEach((item: ExperienceItem) => {
        expect(typeof item.id).toBe('string');
        expect(typeof item.period).toBe('string');
        expect(typeof item.role).toBe('string');
        expect(typeof item.company).toBe('string');
        expect(typeof item.location).toBe('string');
        expect(['Full-time', 'Contract', 'Open Source', 'Venture', 'Education & Awards']).toContain(item.type);
        expect(Array.isArray(item.achievements)).toBe(true);
        expect(item.achievements.length).toBeGreaterThan(0);
        expect(Array.isArray(item.technologies)).toBe(true);
        expect(typeof item.midnightQuest).toBe('string');
      });
    });

    /**
     * @tier: 1
     * @feature: F03_TYPES_DATA
     */
    it('[T1_F03_04] developerStats contains 4 primary stats cards', () => {
      expect(developerStats.length).toBe(4);

      developerStats.forEach((stat: DeveloperStat) => {
        expect(typeof stat.label).toBe('string');
        expect(typeof stat.value).toBe('string');
        expect(typeof stat.iconName).toBe('string');
        expect(typeof stat.description).toBe('string');
      });
    });

    /**
     * @tier: 1
     * @feature: F03_TYPES_DATA
     */
    it('[T1_F03_05] talismanPresets contains 6 preset developer spells', () => {
      expect(talismanPresets.length).toBe(6);

      talismanPresets.forEach((preset: TalismanPreset) => {
        expect(typeof preset.id).toBe('string');
        expect(typeof preset.title).toBe('string');
        expect(typeof preset.runeTop).toBe('string');
        expect(typeof preset.codeSnippet).toBe('string');
        expect(typeof preset.meaning).toBe('string');
        expect(['yellow', 'crimson', 'cyan', 'purple']).toContain(preset.colorScheme);
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F03] Data Integrity & Boundary Constraints', () => {
    /**
     * @tier: 2
     * @feature: F03_TYPES_DATA
     */
    it('[T2_F03_01] All project and experience IDs are completely unique', () => {
      const projectIds = projectsData.map((p) => p.id);
      const uniqueProjectIds = new Set(projectIds);
      expect(uniqueProjectIds.size).toBe(projectIds.length);

      const expIds = experienceData.map((e) => e.id);
      const uniqueExpIds = new Set(expIds);
      expect(uniqueExpIds.size).toBe(expIds.length);
    });

    /**
     * @tier: 2
     * @feature: F03_TYPES_DATA
     */
    it('[T2_F03_02] Live and GitHub URLs in projects have valid http/https format when present', () => {
      projectsData.forEach((p) => {
        if (p.liveUrl) {
          expect(p.liveUrl.startsWith('https://') || p.liveUrl.startsWith('http://')).toBe(true);
        }
        if (p.githubUrl) {
          expect(p.githubUrl.startsWith('https://github.com/')).toBe(true);
        }
      });
    });

    /**
     * @tier: 2
     * @feature: F03_TYPES_DATA
     */
    it('[T2_F03_03] Skill proficiency levels strictly satisfy range bounds 82 <= level <= 100', () => {
      skillsData.forEach((category) => {
        category.skills.forEach((s) => {
          expect(s.level).toBeGreaterThanOrEqual(82);
          expect(s.level).toBeLessThanOrEqual(100);
          expect(Number.isInteger(s.level)).toBe(true);
        });
      });
    });

    /**
     * @tier: 2
     * @feature: F03_TYPES_DATA
     */
    it('[T2_F03_04] Experience timeline follows reverse chronological order (newest to oldest)', () => {
      const periods = experienceData.map((e) => e.period);
      expect(periods[0]).toContain('2025');
      expect(periods[1]).toContain('2022');
      expect(periods[2]).toContain('2017');
      expect(periods[3]).toContain('2013');
    });

    /**
     * @tier: 2
     * @feature: F03_TYPES_DATA
     */
    it('[T2_F03_05] Talisman presets contain no empty strings and colorSchemes match allowed union', () => {
      talismanPresets.forEach((tp) => {
        expect(tp.title.trim().length).toBeGreaterThan(0);
        expect(tp.runeTop.trim().length).toBeGreaterThan(0);
        expect(tp.codeSnippet.trim().length).toBeGreaterThan(0);
        expect(tp.meaning.trim().length).toBeGreaterThan(0);
        expect(['yellow', 'crimson', 'cyan', 'purple']).toContain(tp.colorScheme);
      });
    });
  });
});
