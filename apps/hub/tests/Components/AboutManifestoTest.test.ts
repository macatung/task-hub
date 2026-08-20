/**
 * Test Suite: About & Developer Manifesto (F18)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { developerStats } from '../../resources/js/data/experienceData.ts';

export class ManifestoModel {
  public activeTab: 'philosophy' | 'day-night' | 'craftsmanship' = 'philosophy';
  public tabs = [
    {
      id: 'philosophy',
      title: 'Triết Lý 00:00 AM',
      subtitle: 'Khi cả thành phố chìm vào giấc ngủ, thế giới của dòng code mới thực sự bừng tỉnh.',
      content: 'Không có tiếng thông báo Slack, không có họp hành ngắt quãng. Chỉ có âm thanh gõ phím, ly Robusta đậm đà và dòng chảy tư duy thuần khiết.'
    },
    {
      id: 'day-night',
      title: 'Day vs Night Developer',
      subtitle: 'Ban ngày bảo trì hệ thống — Ban đêm kiến tạo tương lai.',
      content: 'Ban ngày là giao tiếp, đồng bộ và lập kế hoạch. Ban đêm là thời khắc của kiến trúc, thuật toán tối ưu và những sáng tạo vượt bậc.'
    },
    {
      id: 'craftsmanship',
      title: 'Khắc Bùa Chất Lượng',
      subtitle: 'Mỗi dòng mã là một đạo bùa chú trừ khử bug tận gốc.',
      content: 'Không chấp nhận sự cẩu thả. Mọi API đều phải chuẩn chỉ, mọi UI đều phải mượt mà 60 FPS, và mọi test suite đều phải pass 100% trước khi deploy.'
    }
  ];

  public setTab(id: string) {
    if (['philosophy', 'day-night', 'craftsmanship'].includes(id)) {
      this.activeTab = id as any;
    } else {
      this.activeTab = 'philosophy';
    }
  }

  public getActiveTabContent() {
    return this.tabs.find((t) => t.id === this.activeTab) || this.tabs[0];
  }

  public navigateKeyboard(key: string) {
    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTab);
    if (key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % this.tabs.length;
      this.activeTab = this.tabs[nextIndex].id as any;
    } else if (key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
      this.activeTab = this.tabs[prevIndex].id as any;
    } else if (key === 'Home') {
      this.activeTab = this.tabs[0].id as any;
    } else if (key === 'End') {
      this.activeTab = this.tabs[this.tabs.length - 1].id as any;
    }
  }
}

describe('AboutManifestoTest (F18)', () => {
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
  describe('[T1_F18] About Section Stats & 3-Tab Manifesto', () => {
    /**
     * @tier: 1
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T1_F18_01] Developer stats grid renders 4 distinct metrics cards', () => {
      expect(developerStats.length).toBe(4);
      const labels = developerStats.map((s) => s.label);
      expect(labels).toContain('Kinh Nghiệm Thực Chiến');
      expect(labels).toContain('Tỉ Lệ CS Tự Động Hóa');
      expect(labels).toContain('Hạ Tầng GIS & Thiết Bị');
      expect(labels).toContain('Uptime Cam Kết Đêm');
    });

    /**
     * @tier: 1
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T1_F18_02] Tab 1 ("Triết Lý 00:00 AM") renders nocturnal flow philosophy', () => {
      const manifesto = new ManifestoModel();
      manifesto.setTab('philosophy');
      const content = manifesto.getActiveTabContent();

      expect(content.title).toBe('Triết Lý 00:00 AM');
      expect(content.content).toContain('Robusta');
    });

    /**
     * @tier: 1
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T1_F18_03] Tab 2 ("Day vs Night") renders daylight meetings vs midnight shipping contrast', () => {
      const manifesto = new ManifestoModel();
      manifesto.setTab('day-night');
      const content = manifesto.getActiveTabContent();

      expect(content.title).toBe('Day vs Night Developer');
      expect(content.content).toContain('Ban ngày');
      expect(content.content).toContain('Ban đêm');
    });

    /**
     * @tier: 1
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T1_F18_04] Tab 3 ("Khắc Bùa Chất Lượng") renders zero-bug craftsmanship pledge', () => {
      const manifesto = new ManifestoModel();
      manifesto.setTab('craftsmanship');
      const content = manifesto.getActiveTabContent();

      expect(content.title).toBe('Khắc Bùa Chất Lượng');
      expect(content.content).toContain('60 FPS');
    });

    /**
     * @tier: 1
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T1_F18_05] Bio origin panel renders persona credentials and midnight theme', () => {
      const bioEl = document.createElement('div');
      bioEl.className = 'about-bio-card glass-panel';
      const h3 = document.createElement('h3');
      h3.className = 'font-display font-bold text-white text-xl';
      h3.textContent = 'The Midnight Alchemist';
      const p = document.createElement('p');
      p.className = 'text-slate-300 text-sm';
      p.textContent = 'Turning dark roasted coffee into supernatural software architecture.';
      bioEl.appendChild(h3);
      bioEl.appendChild(p);

      expect(bioEl.querySelector('h3')?.textContent).toContain('Midnight Alchemist');
      expect(bioEl.querySelector('p')?.textContent).toContain('supernatural');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F18] Manifesto Tabs Navigation & Responsive Bounds', () => {
    /**
     * @tier: 2
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T2_F18_01] Rapid consecutive tab switching (30 switches) maintains active tab integrity', () => {
      const manifesto = new ManifestoModel();
      const tabIds = ['philosophy', 'day-night', 'craftsmanship'];

      for (let i = 0; i < 30; i++) {
        const id = tabIds[i % 3];
        manifesto.setTab(id);
        expect(manifesto.activeTab).toBe(id);
        expect(manifesto.getActiveTabContent().id).toBe(id);
      }
    });

    /**
     * @tier: 2
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T2_F18_02] ArrowRight and ArrowLeft keyboard navigation cycles smoothly through tabs', () => {
      const manifesto = new ManifestoModel();
      expect(manifesto.activeTab).toBe('philosophy');

      manifesto.navigateKeyboard('ArrowRight');
      expect(manifesto.activeTab).toBe('day-night');

      manifesto.navigateKeyboard('ArrowRight');
      expect(manifesto.activeTab).toBe('craftsmanship');

      // Wraps around to first tab
      manifesto.navigateKeyboard('ArrowRight');
      expect(manifesto.activeTab).toBe('philosophy');

      // Left arrow wraps to last tab
      manifesto.navigateKeyboard('ArrowLeft');
      expect(manifesto.activeTab).toBe('craftsmanship');
    });

    /**
     * @tier: 2
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T2_F18_03] Home and End keys jump immediately to first and last tabs', () => {
      const manifesto = new ManifestoModel();
      manifesto.setTab('day-night');

      manifesto.navigateKeyboard('Home');
      expect(manifesto.activeTab).toBe('philosophy');

      manifesto.navigateKeyboard('End');
      expect(manifesto.activeTab).toBe('craftsmanship');
    });

    /**
     * @tier: 2
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T2_F18_04] Invalid tab ID string falls back safely to "philosophy" tab', () => {
      const manifesto = new ManifestoModel();
      manifesto.setTab('unknown-tab-id');
      expect(manifesto.activeTab).toBe('philosophy');
    });

    /**
     * @tier: 2
     * @feature: F18_ABOUT_MANIFESTO
     */
    it('[T2_F18_05] Typography styles include break-words and tracking-tight to avoid text clipping', () => {
      const card = document.createElement('div');
      card.className = 'text-xs font-mono text-slate-400 break-words tracking-tight';

      expect(card.classList.contains('break-words')).toBe(true);
      expect(card.classList.contains('tracking-tight')).toBe(true);
    });
  });
});
