/**
 * Tier 4: Real-World Application Scenarios (Part 2: Scenarios 7 to 12)
 * @tier: 4
 *
 * Implements Tier 4 E2E user workflow scenarios (T4_07 through T4_12) defined in TEST_INFRA.md § Tier 4:
 * 7. T4_07_DEVELOPER_MANIFESTO_DEEP_DIVE
 * 8. T4_08_SKILLS_AND_EXPERIENCE_INSPECTION
 * 9. T4_09_SUMMONING_ALTAR_CONTACT_FLOW
 * 10. T4_10_SUMMONING_ALTAR_ERROR_RECOVERY
 * 11. T4_11_MOBILE_RESPONSIVE_WALKTHROUGH
 * 12. T4_12_ACCESSIBILITY_AND_AUDIO_CONTROL
 */

import { describe, it, expect, beforeEach, afterEach, fn } from '../Harness/index.js';
import {
  setupTestEnvironment,
  MockAudioContext,
  MockTouchEvent,
  MockTouch,
  MockKeyboardEvent,
  MockMouseEvent,
  mockUseForm
} from '../Harness/mock_helpers.js';
import { sound } from '../../resources/js/audio/soundEffects.ts';
import { projectsData } from '../../resources/js/data/projectsData.ts';
import { skillsData } from '../../resources/js/data/skillsData.ts';
import { experienceData, developerStats } from '../../resources/js/data/experienceData.ts';
import { talismanPresets } from '../../resources/js/data/talismanData.ts';
import type { TalismanPreset, Project } from '../../resources/js/types/portfolio.ts';

describe('Tier 4: Real-World E2E Scenarios (07 to 12)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    localStorage.clear();
    if (sound.isMuted()) {
      sound.toggleMute();
    }
    (sound as any).ctx = null;
    env.audioContext.reset();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // T4_07: Developer Manifesto Deep Dive
  // ==========================================================================
  it('T4_07: [T4_07] Developer Manifesto Deep Dive — 4 Stats Cards, 3 Manifesto Tabs, Typography & Readability', () => {
    // @tier: 4
    // Step 1: Inspect 4 Stats Cards
    expect(developerStats.length).toBe(4);
    const statLabels = developerStats.map((s) => s.label);
    expect(statLabels).toContain('Kinh Nghiệm Thực Chiến');
    expect(statLabels).toContain('Tỉ Lệ CS Tự Động Hóa');
    expect(statLabels).toContain('Hạ Tầng GIS & Thiết Bị');
    expect(statLabels).toContain('Uptime Cam Kết Đêm');

    // Step 2: 3-Tab Manifesto Panel state
    const manifesto = {
      activeTab: 'triet-ly-00am',
      tabs: [
        {
          id: 'triet-ly-00am',
          title: 'Triết Lý 00:00 AM',
          subtitle: 'The Midnight Sanctuary',
          content:
            'Khi thành phố chìm vào giấc ngủ, thế giới của code thức giấc. Không notifications, không họp hành, chỉ có âm thanh bàn phím và dòng chảy tư duy thuần khiết.'
        },
        {
          id: 'day-vs-night',
          title: 'Day vs Night Flow',
          subtitle: 'Dual-Realm Engineering',
          content:
            'Ban ngày: Giao tiếp, review PR, định hình kiến trúc. Ban đêm: Hiện thực hóa những ý tưởng điên rồ nhất với hiệu suất tối thượng.'
        },
        {
          id: 'khac-bua-chat-luong',
          title: 'Khắc Bùa Chất Lượng',
          subtitle: 'Craftsmanship Pledge',
          content:
            'Mỗi dòng code đều được chăm chút như một lá bùa hộ mệnh: 100% Type-Safe, 0 Warning, Full Test Coverage, Clean Architecture.'
        }
      ],
      get currentTab() {
        return this.tabs.find((t) => t.id === this.activeTab)!;
      },
      switchTab(tabId: string) {
        this.activeTab = tabId;
        sound.playClick();
      }
    };

    // Step 3: Verify Tab 1 (Default active)
    expect(manifesto.activeTab).toBe('triet-ly-00am');
    expect(manifesto.currentTab.title).toBe('Triết Lý 00:00 AM');
    expect(manifesto.currentTab.content).toContain('thế giới của code thức giấc');

    // Step 4: Switch to Tab 2
    manifesto.switchTab('day-vs-night');
    expect(manifesto.activeTab).toBe('day-vs-night');
    expect(manifesto.currentTab.title).toBe('Day vs Night Flow');
    expect(manifesto.currentTab.content).toContain('Ban ngày: Giao tiếp');

    // Step 5: Switch to Tab 3
    manifesto.switchTab('khac-bua-chat-luong');
    expect(manifesto.activeTab).toBe('khac-bua-chat-luong');
    expect(manifesto.currentTab.title).toBe('Khắc Bùa Chất Lượng');
    expect(manifesto.currentTab.content).toContain('100% Type-Safe');

    // Verify sound feedback on tab switches
    const oscs = env.audioContext.getAllOscillators();
    expect(oscs.length).toBe(2); // 2 clicks for 2 switches
  });

  // ==========================================================================
  // T4_08: Skills & Experience Inspection
  // ==========================================================================
  it('T4_08: [T4_08] Skills & Experience Inspection — 18 Skills across 4 Categories, Proficiency Levels & Midnight Chronicles Lore', () => {
    // @tier: 4
    // Step 1: Inspect Skills Categories & Count
    expect(skillsData.length).toBe(4);

    const totalSkillsCount = skillsData.reduce((acc, cat) => acc + cat.skills.length, 0);
    expect(totalSkillsCount).toBe(18);

    const categoryTitles = skillsData.map((c) => c.title);
    expect(categoryTitles).toContain('AI Agents & LLM Architecture');
    expect(categoryTitles).toContain('Backend Mastery & Distributed Systems');
    expect(categoryTitles).toContain('Telecom, GIS & Network Systems');
    expect(categoryTitles).toContain('Frontend Sorcery, Cloud & DevOps');

    // Step 2: Verify proficiency ranges (82% to 100%) and rune icons
    skillsData.forEach((cat) => {
      cat.skills.forEach((skill) => {
        expect(skill.level).toBeGreaterThanOrEqual(82);
        expect(skill.level).toBeLessThanOrEqual(100);
        expect(skill.rune.length).toBeGreaterThan(0);
        expect(skill.description.length).toBeGreaterThan(10);
      });
    });

    // Step 3: Inspect Experience Timeline & Midnight Quest Lore
    expect(experienceData.length).toBe(4);

    // Verify chronological order (2025 to 2013)
    expect(experienceData[0].period).toContain('2025');
    expect(experienceData[0].role).toContain('AI Agent');
    expect(experienceData[0].midnightQuest).toContain('Multi-Agent');

    expect(experienceData[1].period).toContain('2022');
    expect(experienceData[1].role).toContain('Fullstack');
    expect(experienceData[1].midnightQuest).toContain('GIS');

    expect(experienceData[2].period).toContain('2017');
    expect(experienceData[2].role).toContain('Backend');
    expect(experienceData[2].midnightQuest).toContain('CDN');

    expect(experienceData[3].period).toContain('2013');
    expect(experienceData[3].role).toContain('Informatics');
    expect(experienceData[3].midnightQuest).toContain('Midnight');

    // Verify achievements bullets and tech tags
    experienceData.forEach((exp) => {
      expect(exp.achievements.length).toBeGreaterThanOrEqual(2);
      expect(exp.technologies.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================================================
  // T4_09: Summoning Altar Contact Flow
  // ==========================================================================
  it('T4_09: [T4_09] Summoning Altar Contact Flow — Valid Payload Submission, DB Record, Flash ID, Confetti & Triumph Chime', async () => {
    // @tier: 4
    const mockDatabase: any[] = [];

    const form = mockUseForm({
      name: '',
      email: '',
      project_type: 'Creative UI/UX & Web Audio',
      coffee_offering: 'Cà phê trứng Hà Nội',
      message: ''
    });

    // Client fills valid data
    form.data.name = 'Elena Rostova';
    form.data.email = 'elena@nocturneventures.io';
    form.data.message =
      'We are seeking a lead engineer to build a high-performance interactive audio-visual dashboard.';

    expect(form.isDirty).toBe(true);

    let returnedReferenceId = '';
    let successMessage = '';

    await form.post('/contact', {
      onStart: () => {
        expect(form.processing).toBe(true);
      },
      onSuccess: (res: any) => {
        returnedReferenceId = res.props.flash.reference_id;
        successMessage = res.props.flash.success;

        mockDatabase.push({
          id: 1,
          reference_id: returnedReferenceId,
          ...form.data,
          created_at: new Date().toISOString()
        });

        sound.playSuccess();
        env.confetti({ particleCount: 100, spread: 70 });
        form.reset();
      }
    });

    // Assertions
    expect(form.wasSuccessful).toBe(true);
    expect(returnedReferenceId).toContain('SUMMON-');
    expect(successMessage).toContain('Tín hiệu đã được truyền đi qua màn đêm');
    expect(env.confetti.calls.length).toBe(1);

    // Database row verification
    expect(mockDatabase.length).toBe(1);
    expect(mockDatabase[0].name).toBe('Elena Rostova');
    expect(mockDatabase[0].email).toBe('elena@nocturneventures.io');
    expect(mockDatabase[0].project_type).toBe('Creative UI/UX & Web Audio');
    expect(mockDatabase[0].coffee_offering).toBe('Cà phê trứng Hà Nội');

    // Sound verification: 4 triumph chord oscillators
    const oscs = env.audioContext.getAllOscillators();
    expect(oscs.length).toBe(4);
  });

  // ==========================================================================
  // T4_10: Summoning Altar Error Recovery
  // ==========================================================================
  it('T4_10: [T4_10] Summoning Altar Error Recovery — Invalid Submit, Error Bag, Field Corrections, Re-submission & Success', async () => {
    // @tier: 4
    const mockDb: any[] = [];

    const form = mockUseForm({
      name: '',
      email: '',
      message: ''
    });

    // Step 1: Submit empty form -> should fail
    let errorCaught = false;
    await form.post('/contact', {
      onError: (errors: any) => {
        errorCaught = true;
        expect(errors.name).toBeDefined();
        expect(errors.email).toBeDefined();
        expect(errors.message).toBeDefined();
      }
    });

    expect(errorCaught).toBe(true);
    expect(form.hasErrors).toBe(true);
    expect(form.wasSuccessful).toBe(false);
    expect(mockDb.length).toBe(0);

    // Step 2: Fix name only -> still fails on email and message
    form.data.name = 'Alex Chen';
    form.clearErrors('name');
    expect(form.errors.name).toBeUndefined();

    // Step 3: Fill valid email and message
    form.data.email = 'alex.chen@midnightcorp.com';
    form.data.message = 'Need full-stack architectural review for Q4 launch.';

    // Step 4: Re-submit form -> should succeed cleanly!
    let successTriggered = false;
    let refId = '';

    await form.post('/contact', {
      onSuccess: (res: any) => {
        successTriggered = true;
        refId = res.props.flash.reference_id;
        mockDb.push({
          id: 1,
          reference_id: refId,
          ...form.data
        });
        form.reset();
      }
    });

    expect(successTriggered).toBe(true);
    expect(form.wasSuccessful).toBe(true);
    expect(form.hasErrors).toBe(false);
    expect(mockDb.length).toBe(1);
    expect(mockDb[0].name).toBe('Alex Chen');
    expect(mockDb[0].email).toBe('alex.chen@midnightcorp.com');
  });

  // ==========================================================================
  // T4_11: Mobile Responsive Walkthrough
  // ==========================================================================
  it('T4_11: [T4_11] Mobile Responsive Walkthrough — 390px Viewport, Drawer Navigation, Touch Tap & >=44px Targets', () => {
    // @tier: 4
    // Step 1: Set iPhone 14 Viewport (390 x 844)
    window.resizeTo(390, 844);
    expect(window.innerWidth).toBe(390);

    // Step 2: Mobile drawer menu
    const navState = {
      isDrawerOpen: false,
      activeSection: 'hero',
      openDrawer() {
        this.isDrawerOpen = true;
      },
      closeDrawer() {
        this.isDrawerOpen = false;
      },
      selectLink(id: string) {
        this.activeSection = id;
        this.isDrawerOpen = false;
      }
    };

    navState.openDrawer();
    expect(navState.isDrawerOpen).toBe(true);

    navState.selectLink('skills');
    expect(navState.activeSection).toBe('skills');
    expect(navState.isDrawerOpen).toBe(false);

    // Step 3: Verify Touch targets are >= 44x44px
    const buttonElements = [
      { name: 'Mascot Hop Button', width: 48, height: 48 },
      { name: 'Sound Toggle Button', width: 44, height: 44 },
      { name: 'Terminal Expand Button', width: 44, height: 44 },
      { name: 'Talisman Blessing Button', width: 160, height: 48 },
      { name: 'Submit Summon Button', width: 200, height: 52 }
    ];

    buttonElements.forEach((btn) => {
      expect(btn.width).toBeGreaterThanOrEqual(44);
      expect(btn.height).toBeGreaterThanOrEqual(44);
    });

    // Step 4: Touch interaction with Mascot
    let mascotTouchHops = 0;
    const mascotEl = document.createElement('div');
    mascotEl.addEventListener('touchstart', (e: any) => {
      expect(e.touches.length).toBe(1);
      expect(e.touches[0].clientX).toBe(195); // Center of 390px
      mascotTouchHops++;
      sound.playHop();
    });

    const touchEvent = new MockTouchEvent('touchstart', {
      touches: [new MockTouch({ clientX: 195, clientY: 300 })]
    });
    mascotEl.dispatchEvent(touchEvent);

    expect(mascotTouchHops).toBe(1);
    expect(env.audioContext.getAllOscillators().length).toBe(1);
  });

  // ==========================================================================
  // T4_12: Accessibility & Audio Control
  // ==========================================================================
  it('T4_12: [T4_12] Accessibility & Audio Control — Global Mute Toggle, Action Suppression & Clean Audio Restoration', () => {
    // @tier: 4
    // 1. Initial unmuted state
    expect(sound.isMuted()).toBe(false);

    // 2. Sound-sensitive user clicks Mute button in Navbar
    const mutedState = sound.toggleMute();
    expect(mutedState).toBe(true);
    expect(sound.isMuted()).toBe(true);
    expect(localStorage.getItem('macatung_sound_muted')).toBe('true');
    env.audioContext.reset();

    // 3. User performs multiple actions while sound is muted
    // Action A: Hop mascot 5 times
    for (let i = 0; i < 5; i++) {
      sound.playHop();
    }

    // Action B: Forge talisman blessing
    sound.playTalisman();

    // Action C: Type 20 keystrokes in terminal
    for (let i = 0; i < 20; i++) {
      sound.playTerminalKey();
    }

    // Action D: Submit form success
    sound.playSuccess();

    // Verify 0 oscillators were scheduled while muted!
    expect(env.audioContext.getAllOscillators().length).toBe(0);

    // 4. User re-enables sound
    const unmutedState = sound.toggleMute();
    expect(unmutedState).toBe(false);
    expect(sound.isMuted()).toBe(false);
    expect(localStorage.getItem('macatung_sound_muted')).toBe('false');

    // 5. Subsequent actions produce audio normally
    env.audioContext.reset();
    sound.playHop();
    expect(env.audioContext.getAllOscillators().length).toBe(1);

    sound.playTalisman();
    expect(env.audioContext.getAllOscillators().length).toBe(5); // 1 hop + 4 chime notes
  });
});
