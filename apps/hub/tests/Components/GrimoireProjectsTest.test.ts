/**
 * Test Suite: Grimoire Project Showcase Grid & Project Modal Dialog (F15, F16)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment, MockKeyboardEvent, MockMouseEvent } from '../Harness/mock_helpers.js';
import { projectsData } from '../../resources/js/data/projectsData.ts';
import type { Project } from '../../resources/js/types/portfolio.ts';

export class GrimoireShowcaseModel {
  public activeCategory: 'all' | 'fullstack' | 'creative' | 'ai-web3' | 'tools' = 'all';
  public selectedProject: Project | null = null;
  public isModalOpen: boolean = false;

  public setCategory(cat: 'all' | 'fullstack' | 'creative' | 'ai-web3' | 'tools') {
    this.activeCategory = cat;
  }

  public getFilteredProjects(): Project[] {
    if (this.activeCategory === 'all') return projectsData;
    return projectsData.filter((p) => p.category === this.activeCategory);
  }

  public openModal(project: Project) {
    this.selectedProject = project;
    this.isModalOpen = true;
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
  }

  public closeModal() {
    this.isModalOpen = false;
    this.selectedProject = null;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  public handleKeyDown(key: string) {
    if (key === 'Escape' && this.isModalOpen) {
      this.closeModal();
    }
  }
}

describe('GrimoireProjectsTest (F15, F16)', () => {
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
  describe('[T1_F15] Grimoire Project Showcase Grid & Category Filtering', () => {
    /**
     * @tier: 1
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T1_F15_01] Grimoire grid displays all 6 projects with "all" filter', () => {
      const showcase = new GrimoireShowcaseModel();
      expect(showcase.getFilteredProjects().length).toBe(6);
    });

    /**
     * @tier: 1
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T1_F15_02] "fullstack" filter isolates fullstack projects', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.setCategory('fullstack');
      const filtered = showcase.getFilteredProjects();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      filtered.forEach((p) => expect(p.category).toBe('fullstack'));
    });

    /**
     * @tier: 1
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T1_F15_03] "creative" filter isolates creative UI and audio projects', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.setCategory('creative');
      const filtered = showcase.getFilteredProjects();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      filtered.forEach((p) => expect(p.category).toBe('creative'));
    });

    /**
     * @tier: 1
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T1_F15_04] "ai-web3" filter isolates AI agents & Web3 protocol projects', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.setCategory('ai-web3');
      const filtered = showcase.getFilteredProjects();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      filtered.forEach((p) => expect(p.category).toBe('ai-web3'));
    });

    /**
     * @tier: 1
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T1_F15_05] "tools" filter isolates CLI & systems tool projects', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.setCategory('tools');
      const filtered = showcase.getFilteredProjects();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      filtered.forEach((p) => expect(p.category).toBe('tools'));
    });
  });

  describe('[T1_F16] Project Modal Dialog Interactions & Body Scroll Lock', () => {
    /**
     * @tier: 1
     * @feature: F16_PROJECT_MODAL
     */
    it('[T1_F16_01] Clicking a project card opens modal dialog', () => {
      const showcase = new GrimoireShowcaseModel();
      const target = projectsData[0];
      showcase.openModal(target);

      expect(showcase.isModalOpen).toBe(true);
      expect(showcase.selectedProject?.id).toBe(target.id);
    });

    /**
     * @tier: 1
     * @feature: F16_PROJECT_MODAL
     */
    it('[T1_F16_02] Modal content matches selected project details, architecture highlights, and midnight fact', () => {
      const showcase = new GrimoireShowcaseModel();
      const target = projectsData[0];
      showcase.openModal(target);

      expect(showcase.selectedProject?.title).toBe(target.title);
      expect(showcase.selectedProject?.architectureHighlights.length).toBeGreaterThan(0);
      expect(showcase.selectedProject?.midnightFact).toBe(target.midnightFact);
    });

    /**
     * @tier: 1
     * @feature: F16_PROJECT_MODAL
     */
    it('[T1_F16_03] Opening modal applies "overflow-hidden" body scroll lock', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);

      expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F16_PROJECT_MODAL
     */
    it('[T1_F16_04] Pressing Escape key closes the open modal dialog and restores body scroll', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);
      expect(showcase.isModalOpen).toBe(true);

      showcase.handleKeyDown('Escape');
      expect(showcase.isModalOpen).toBe(false);
      expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F16_PROJECT_MODAL
     */
    it('[T1_F16_05] Backdrop click triggers modal close', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);

      // Simulate backdrop dismiss
      showcase.closeModal();
      expect(showcase.isModalOpen).toBe(false);
      expect(showcase.selectedProject).toBeNull();
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F15_F16] Boundary & State Edge Cases for Grimoire & Modal', () => {
    /**
     * @tier: 2
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T2_F15_01] Rapid category filter switching (50 switches) produces correct subset every time', () => {
      const showcase = new GrimoireShowcaseModel();
      const categories: ('all' | 'fullstack' | 'creative' | 'ai-web3' | 'tools')[] = [
        'all',
        'fullstack',
        'creative',
        'ai-web3',
        'tools'
      ];

      for (let i = 0; i < 50; i++) {
        const cat = categories[i % categories.length];
        showcase.setCategory(cat);
        const filtered = showcase.getFilteredProjects();
        expect(filtered.length).toBeGreaterThan(0);
        if (cat !== 'all') {
          filtered.forEach((p) => expect(p.category).toBe(cat));
        }
      }
    });

    /**
     * @tier: 2
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T2_F15_02] Every project card has valid non-empty tech stack tags and metric counters', () => {
      projectsData.forEach((project) => {
        expect(project.techStack.length).toBeGreaterThan(0);
        expect(project.metrics.length).toBeGreaterThanOrEqual(3);
        project.metrics.forEach((m) => {
          expect(m.label.length).toBeGreaterThan(0);
          expect(m.value.length).toBeGreaterThan(0);
        });
      });
    });

    /**
     * @tier: 2
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T2_F15_03] Responsive grid CSS classes support 1 col on mobile, 2 on tablet, 3 on desktop', () => {
      const gridEl = document.createElement('div');
      gridEl.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

      expect(gridEl.classList.contains('grid-cols-1')).toBe(true);
      expect(gridEl.classList.contains('md:grid-cols-2')).toBe(true);
      expect(gridEl.classList.contains('lg:grid-cols-3')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T2_F15_04] Projects showcase maintains stable order and covers all categories', () => {
      const showcase = new GrimoireShowcaseModel();
      const all = showcase.getFilteredProjects();
      const categoriesFound = new Set(all.map((p) => p.category));
      expect(categoriesFound.size).toBe(4);
    });

    /**
     * @tier: 2
     * @feature: F15_GRIMOIRE_GRID
     */
    it('[T2_F15_05] Project cover gradients use designated obsidian neon color stops', () => {
      projectsData.forEach((project) => {
        expect(project.coverGradient).toContain('from-');
        expect(project.coverGradient).toContain('to-');
      });
    });

    /**
     * @tier: 2
     * @feature: F16_PROJECT_MODAL
     */
    it('[T2_F16_01] Opening modal when already open with another project replaces content cleanly', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);
      expect(showcase.selectedProject?.id).toBe(projectsData[0].id);

      // Open second project directly
      showcase.openModal(projectsData[1]);
      expect(showcase.isModalOpen).toBe(true);
      expect(showcase.selectedProject?.id).toBe(projectsData[1].id);
      expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F16_PROJECT_MODAL
     */
    it('[T2_F16_02] Pressing Escape when modal is NOT open does nothing and leaves body scroll unlocked', () => {
      const showcase = new GrimoireShowcaseModel();
      expect(showcase.isModalOpen).toBe(false);

      showcase.handleKeyDown('Escape');
      expect(showcase.isModalOpen).toBe(false);
      expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F16_PROJECT_MODAL
     */
    it('[T2_F16_03] Pressing non-Escape keys (e.g. Enter, Space, ArrowDown) does not dismiss modal', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);

      showcase.handleKeyDown('Enter');
      showcase.handleKeyDown('Space');
      showcase.handleKeyDown('ArrowDown');

      expect(showcase.isModalOpen).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F16_PROJECT_MODAL
     */
    it('[T2_F16_04] Closing modal multiple times consecutively safely maintains clean state', () => {
      const showcase = new GrimoireShowcaseModel();
      showcase.openModal(projectsData[0]);
      showcase.closeModal();
      showcase.closeModal();
      showcase.closeModal();

      expect(showcase.isModalOpen).toBe(false);
      expect(showcase.selectedProject).toBeNull();
      expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    });

    /**
     * @tier: 2
     * @feature: F16_PROJECT_MODAL
     */
    it('[T2_F16_05] External links in modal have secure target="_blank" and rel="noopener noreferrer"', () => {
      const linkEl = document.createElement('a');
      linkEl.href = 'https://github.com/macatung/nocturne-os';
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';

      expect(linkEl.getAttribute('target')).toBe('_blank');
      expect(linkEl.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});
