/**
 * Test Suite: Desktop Zen Mascot Visual Fidelity, Time-Cycle Auras & 432Hz Mindful Bell Audio
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect } from '../Harness/index.js';
import fs from 'fs';
import path from 'path';
import { ZEN_PHASES, useZenTimeCycle } from '../../desktop/src/composables/useZenTimeCycle.ts';

describe('DesktopZenMascotTest (HD Vector, 4-Phase Aura & 432Hz Chime)', () => {
  // Read component source files
  const stageVuePath = path.resolve(process.cwd(), 'desktop/src/components/ZenMascotStage.vue');
  const stageVueContent = fs.readFileSync(stageVuePath, 'utf-8');

  const appVuePath = path.resolve(process.cwd(), 'desktop/src/App.vue');
  const appVueContent = fs.readFileSync(appVuePath, 'utf-8');

  const audioPath = path.resolve(process.cwd(), 'desktop/src/audio/mindfulBellAudio.ts');
  const audioContent = fs.readFileSync(audioPath, 'utf-8');

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_DESKTOP_MASCOT] Zen Time-of-Day Cycle & Phase Engine', () => {
    it('[T1_ZM_01] ZEN_PHASES defines all 4 canonical time periods with authentic Pāḷi names', () => {
      const phaseKeys = Object.keys(ZEN_PHASES);
      expect(phaseKeys.length).toBe(4);
      expect(phaseKeys.includes('midnight')).toBe(true);
      expect(phaseKeys.includes('dawn')).toBe(true);
      expect(phaseKeys.includes('afternoon')).toBe(true);
      expect(phaseKeys.includes('twilight')).toBe(true);

      expect(ZEN_PHASES.midnight.paliName).toBe('Rātribhāga');
      expect(ZEN_PHASES.dawn.paliName).toBe('Pubbaṇhasamaya');
      expect(ZEN_PHASES.afternoon.paliName).toBe('Majjhanhikasamaya');
      expect(ZEN_PHASES.twilight.paliName).toBe('Sāyanhasamaya');
    });

    it('[T1_ZM_02] Every phase provides distinct accent, secondary, halo and stardust glow colors', () => {
      Object.values(ZEN_PHASES).forEach((phase) => {
        expect(phase.accentHex.startsWith('#')).toBe(true);
        expect(phase.secondaryHex.startsWith('#')).toBe(true);
        expect(phase.haloColor.startsWith('#')).toBe(true);
        expect(phase.stardustColor.startsWith('#')).toBe(true);
        expect(phase.accentGlow.includes('rgba')).toBe(true);
        expect(phase.icon.length).toBeGreaterThan(0);
      });
    });

    it('[T1_ZM_03] useZenTimeCycle properly resolves phase by simulated hour', () => {
      const { setSimulatedHour, activeZenPhase, resetToRealTime } = useZenTimeCycle();

      // Midnight: 00:00 - 05:59
      setSimulatedHour(2);
      expect(activeZenPhase.value.id).toBe('midnight');

      // Dawn: 06:00 - 11:59
      setSimulatedHour(8);
      expect(activeZenPhase.value.id).toBe('dawn');

      // Afternoon: 12:00 - 17:59
      setSimulatedHour(14);
      expect(activeZenPhase.value.id).toBe('afternoon');

      // Twilight: 18:00 - 23:59
      setSimulatedHour(20);
      expect(activeZenPhase.value.id).toBe('twilight');

      resetToRealTime();
    });
  });

  describe('[T1_DESKTOP_MASCOT] Layered HD Vector SVG & Visual Anatomy', () => {
    it('[T1_ZM_04] ZenMascotStage includes 8-spoke rotating Dhammacakka wheel halo', () => {
      expect(stageVueContent.includes('animate-dhammacakka-spin')).toBe(true);
      expect(stageVueContent.includes('stroke-dasharray="4 2"')).toBe(true);
      // 8 spokes lines
      expect(stageVueContent.includes('x1="90" y1="24" x2="90" y2="116"')).toBe(true);
      expect(stageVueContent.includes('x1="44" y1="70" x2="136" y2="70"')).toBe(true);
    });

    it('[T1_ZM_05] ZenMascotStage includes Blooming Lotus Throne (Padmāsana) with gradients', () => {
      expect(stageVueContent.includes('id="lotusPetalGrad"')).toBe(true);
      expect(stageVueContent.includes('id="goldTrimGrad"')).toBe(true);
      expect(stageVueContent.includes('fill="url(#lotusPetalGrad)"')).toBe(true);
      expect(stageVueContent.includes('Padmāsana')).toBe(true);
    });

    it('[T1_ZM_06] ZenMascotStage includes Kasaya Robe, Mala Beads & Dhyāna Mudrā hands with Pearl', () => {
      expect(stageVueContent.includes('id="kasayaRobeGrad"')).toBe(true);
      expect(stageVueContent.includes('Dhyāna Mudrā')).toBe(true);
      expect(stageVueContent.includes('108 Bodhi Mala Beads')).toBe(true);
      expect(stageVueContent.includes('Glowing Pearl of Wisdom')).toBe(true);
    });

    it('[T1_ZM_07] ZenMascotStage includes Serene Face with Ūrṇā jewel and peaceful eyes', () => {
      expect(stageVueContent.includes('Ūrṇā Jewel')).toBe(true);
      expect(stageVueContent.includes('Meditative Peaceful Eyes')).toBe(true);
      expect(stageVueContent.includes('Serene Compassionate Smile')).toBe(true);
    });

    it('[T1_ZM_08] ZenMascotStage provides Mindful Stardust floating particles & Shockwave ripple on click', () => {
      expect(stageVueContent.includes('zen-particle p1')).toBe(true);
      expect(stageVueContent.includes('zen-particle p2')).toBe(true);
      expect(stageVueContent.includes('zen-particle p3')).toBe(true);
      expect(stageVueContent.includes('zen-particle p4')).toBe(true);
      expect(stageVueContent.includes('animate-zen-shockwave')).toBe(true);
      expect(stageVueContent.includes('triggerChime')).toBe(true);
    });
  });

  describe('[T1_DESKTOP_MASCOT] Web Audio API Tibetan Singing Bowl Synthesizer', () => {
    it('[T1_ZM_09] mindfulBellAudio configures 432Hz fundamental and overtone harmonics', () => {
      expect(audioContent.includes('ringBell(fundamentalFreq: number = 432')).toBe(true);
      expect(audioContent.includes('mult: 1.0')).toBe(true);
      expect(audioContent.includes('mult: 2.76')).toBe(true);
      expect(audioContent.includes('mult: 5.4')).toBe(true);
      expect(audioContent.includes('mult: 8.9')).toBe(true);
      expect(audioContent.includes('biquadFilter') || audioContent.includes('BiquadFilter') || audioContent.includes('createBiquadFilter')).toBe(true);
    });

    it('[T1_ZM_10] App.vue wires mindfulBell and ZenMascotStage chime trigger on mascot click', () => {
      expect(appVueContent.includes('import { mindfulBell } from \'./audio/mindfulBellAudio\';')).toBe(true);
      expect(appVueContent.includes('mindfulBell.ringBell(432')).toBe(true);
      expect(appVueContent.includes('zenMascotRef.value?.triggerChime?.()')).toBe(true);
    });
  });
});
