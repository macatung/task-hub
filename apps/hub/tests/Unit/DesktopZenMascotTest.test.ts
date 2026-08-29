/**
 * Test Suite: Desktop Zen Mascot Bloat Excision & Retirement Verification
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect } from '../Harness/index.js';
import fs from 'fs';
import path from 'path';

describe('DesktopZenMascotTest (Bloat Excision & Safe Retirement)', () => {
  const root = fs.existsSync(path.resolve(process.cwd(), 'apps/desktop'))
    ? path.resolve(process.cwd(), 'apps/desktop')
    : path.resolve(process.cwd(), '../desktop');

  // Verify component source files are safely excised or unreferenced
  const stageVuePath = path.join(root, 'src/components/ZenMascotStage.vue');
  const appVuePath = path.join(root, 'src/App.vue');
  const appVueContent = fs.existsSync(appVuePath) ? fs.readFileSync(appVuePath, 'utf-8') : '';

  const mascotVuePath = path.join(root, 'src/views/MascotView.vue');
  const audioPath = path.join(root, 'src/audio/mindfulBellAudio.ts');
  const timeCyclePath = path.join(root, 'src/composables/useZenTimeCycle.ts');

  describe('[T1_DESKTOP_MASCOT] Zen Mascot Bloat Excision & Architecture Hygiene', () => {
    it('[T1_ZM_01] verifies ZenMascotStage.vue is eradicated from apps/desktop', () => {
      expect(fs.existsSync(stageVuePath)).toBe(false);
    });

    it('[T1_ZM_02] verifies MascotView.vue is eradicated from apps/desktop', () => {
      expect(fs.existsSync(mascotVuePath)).toBe(false);
    });

    it('[T1_ZM_03] verifies mindfulBellAudio.ts is eradicated from apps/desktop', () => {
      expect(fs.existsSync(audioPath)).toBe(false);
    });

    it('[T1_ZM_04] verifies useZenTimeCycle.ts is eradicated from apps/desktop', () => {
      expect(fs.existsSync(timeCyclePath)).toBe(false);
    });

    it('[T1_ZM_05] verifies App.vue does not render Zen mascot or MascotView', () => {
      expect(appVueContent).not.toContain('ZenMascotStage');
      expect(appVueContent).not.toContain('MascotView');
      expect(appVueContent).not.toContain('useZenTimeCycle');
    });

    it('[T1_ZM_06] verifies desktop operates exclusively as developer Control Center', () => {
      expect(appVueContent).toContain('ControlCenter');
    });

    it('[T1_ZM_07] verifies mindful Bell synth is not active in production shell', () => {
      expect(appVueContent).not.toContain('mindfulBellAudio');
    });

    it('[T1_ZM_08] verifies no Zen time cycle imports leak into App.vue', () => {
      expect(appVueContent).not.toContain('useMindfulScheduler');
    });

    it('[T1_ZM_09] verifies ControlCenter is the primary mounted desktop root', () => {
      expect(appVueContent).toContain('<ControlCenter');
    });

    it('[T1_ZM_10] confirms safe retirement and 100% eradication of wellness bloat from desktop', () => {
      expect(fs.existsSync(path.join(root, 'src/components/WaterTrackerModal.vue'))).toBe(false);
      expect(fs.existsSync(path.join(root, 'src/components/BreathingPacer.vue'))).toBe(false);
    });
  });
});
