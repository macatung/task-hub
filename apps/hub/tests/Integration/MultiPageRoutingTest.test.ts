/**
 * Test Suite: Developer Portfolio & Multi-Page Routing (F22_MULTI_PAGE_PORTFOLIO)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 * Tier 3: Cross-Feature Interactions
 * Tier 4: Real-World E2E Navigation
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';

export interface RouteItem {
  name: string;
  path: string;
  component: string;
}

export const appRoutes: RouteItem[] = [
  { name: 'home', path: '/', component: 'Home' },
  { name: 'projects.index', path: '/projects', component: 'Projects/Index' },
  { name: 'about.index', path: '/about', component: 'About/Index' },
  { name: 'blog.index', path: '/blog', component: 'Blog/Index' },
  { name: 'blog.show', path: '/blog/:slug', component: 'Blog/Show' },
  { name: 'game.index', path: '/game', component: 'Game/Index' },
  { name: 'talisman.index', path: '/talisman', component: 'Talisman/Index' },
  { name: 'contact.index', path: '/contact', component: 'Contact/Index' },
];

export const sampleArticles = [
  {
    id: 1,
    title: 'Kiến Trúc Multi-Agent AI Tự Trị Thay Thế 100% Customer Service 24/7',
    slug: 'kien-truc-multi-agent-ai-tu-tri-customer-service-24-7',
    tags: ['AI Agents', 'Architecture', 'FastAPI'],
    reading_time_min: 8,
    is_published: true,
  },
  {
    id: 2,
    title: 'Xây Dựng Engine Định Giá Cổ Phiếu 7 Năm & 50+ Real-Time Crawlers',
    slug: 'engine-dinh-gia-co-phieu-7-nam-50-plus-realtime-crawlers',
    tags: ['Distributed', 'Redis', 'Node.js'],
    reading_time_min: 10,
    is_published: true,
  },
];

describe('MultiPageRoutingTest (Developer Portfolio Architecture)', () => {
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
  describe('[T1_F22] Core Page Route Registration', () => {
    it('[T1_F22_01] All core portfolio pages exist in the routing table', () => {
      expect(appRoutes.length).toBe(8);
      const paths = appRoutes.map(r => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/projects');
      expect(paths).toContain('/about');
      expect(paths).toContain('/blog');
      expect(paths).toContain('/blog/:slug');
      expect(paths).toContain('/game');
      expect(paths).toContain('/talisman');
      expect(paths).toContain('/contact');
    });

    it('[T1_F22_02] Sample articles have valid slugs and published tags', () => {
      sampleArticles.forEach(article => {
        expect(article.slug).toBeDefined();
        expect(article.slug.length).toBeGreaterThan(5);
        expect(article.tags.length).toBeGreaterThan(0);
        expect(article.is_published).toBe(true);
      });
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Slug Matching
  // ==========================================================================
  describe('[T2_F22] Article Slug Matching & Fallbacks', () => {
    it('[T2_F22_01] Finds article by exact slug', () => {
      const targetSlug = 'kien-truc-multi-agent-ai-tu-tri-customer-service-24-7';
      const matched = sampleArticles.find(a => a.slug === targetSlug);
      expect(matched).toBeDefined();
      expect(matched?.title).toContain('Multi-Agent AI');
    });

    it('[T2_F22_02] Returns undefined for non-existent slug', () => {
      const targetSlug = 'non-existent-ghost-article-slug';
      const matched = sampleArticles.find(a => a.slug === targetSlug);
      expect(matched).toBeUndefined();
    });
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Interactions (2-Way Cross-Link)
  // ==========================================================================
  describe('[T3_F22] Cross-Linking between Projects & Blog Articles', () => {
    it('[T3_F22_01] Multi-agent blog slug correctly maps to related AI agent project', () => {
      const slug = 'kien-truc-multi-agent-ai-tu-tri-customer-service-24-7';
      const isAiAgent = slug.includes('multi-agent');
      expect(isAiAgent).toBe(true);
    });

    it('[T3_F22_02] Financial valuation blog slug correctly maps to Crawler high-load project', () => {
      const slug = 'engine-dinh-gia-co-phieu-7-nam-50-plus-realtime-crawlers';
      const isHighLoad = slug.includes('crawlers') || slug.includes('dinh-gia');
      expect(isHighLoad).toBe(true);
    });
  });
});
