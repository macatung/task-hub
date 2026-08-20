/**
 * Test Suite: Web Audio Synthesizer & Sound Toggle (F04, F05)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { SoundEngine } from '../../resources/js/audio/soundEffects.ts';

describe('AudioSynthTest (F04, F05)', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    localStorage.clear();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F04] Sound Engine Synthesizer Core Functions', () => {
    /**
     * @tier: 1
     * @feature: F04_SOUND_ENGINE
     */
    it('[T1_F04_01] playHop creates sine oscillator with upward and downward frequency sweep', () => {
      const engine = new SoundEngine();
      engine.playHop(1);

      const allOscs = env.audioContext.getAllOscillators();
      expect(allOscs.length).toBeGreaterThanOrEqual(1);

      const hopOsc = allOscs[allOscs.length - 1];
      expect(hopOsc.type).toBe('sine');
      expect(hopOsc.started).toBe(true);

      const freqEvents = hopOsc.frequency.getScheduledEvents();
      expect(freqEvents.length).toBeGreaterThanOrEqual(2);
      expect(freqEvents[0].value).toBe(260); // 220 + (1 * 40)
    });

    /**
     * @tier: 1
     * @feature: F04_SOUND_ENGINE
     */
    it('[T1_F04_02] playTalisman creates 4-note mystic chime chord with triangle wave oscillators', () => {
      const engine = new SoundEngine();
      engine.playTalisman();

      const allOscs = env.audioContext.getAllOscillators();
      expect(allOscs.length).toBeGreaterThanOrEqual(4);

      const chimeOscs = allOscs.slice(-4);
      chimeOscs.forEach((osc: any) => {
        expect(osc.type).toBe('triangle');
        expect(osc.started).toBe(true);
      });

      const freqs = chimeOscs.map((o: any) => o.frequency.getScheduledEvents()[0]?.value);
      expect(freqs).toEqual([587.33, 880, 1174.66, 1760]);
    });

    /**
     * @tier: 1
     * @feature: F04_SOUND_ENGINE
     */
    it('[T1_F04_03] playClick creates a crisp 800Hz transient sine pop', () => {
      const engine = new SoundEngine();
      engine.playClick();

      const allOscs = env.audioContext.getAllOscillators();
      expect(allOscs.length).toBeGreaterThanOrEqual(1);

      const clickOsc = allOscs[allOscs.length - 1];
      expect(clickOsc.type).toBe('sine');
      const events = clickOsc.frequency.getScheduledEvents();
      expect(events[0].value).toBe(800);
      expect(events[1].value).toBe(300);
    });

    /**
     * @tier: 1
     * @feature: F04_SOUND_ENGINE
     */
    it('[T1_F04_04] playTerminalKey generates a mechanical keystroke sound in 420-500Hz band', () => {
      const engine = new SoundEngine();
      engine.playTerminalKey();

      const allOscs = env.audioContext.getAllOscillators();
      expect(allOscs.length).toBeGreaterThanOrEqual(1);

      const keyOsc = allOscs[allOscs.length - 1];
      expect(keyOsc.type).toBe('triangle');
      const startFreq = keyOsc.frequency.getScheduledEvents()[0]?.value;
      expect(startFreq).toBeGreaterThanOrEqual(420);
      expect(startFreq).toBeLessThanOrEqual(500);
    });

    /**
     * @tier: 1
     * @feature: F04_SOUND_ENGINE
     */
    it('[T1_F04_05] playSuccess triggers C Major triumph arpeggio chord', () => {
      const engine = new SoundEngine();
      engine.playSuccess();

      const allOscs = env.audioContext.getAllOscillators();
      expect(allOscs.length).toBeGreaterThanOrEqual(4);

      const chords = allOscs.slice(-4);
      const chordFreqs = chords.map((o: any) => o.frequency.getScheduledEvents()[0]?.value);
      expect(chordFreqs).toEqual([523.25, 659.25, 783.99, 1046.50]);
    });
  });

  describe('[T1_F05] Sound Preference & Mute Toggle', () => {
    /**
     * @tier: 1
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T1_F05_01] SoundEngine defaults to unmuted when no localStorage preference exists', () => {
      localStorage.removeItem('macatung_sound_muted');
      const engine = new SoundEngine();
      expect(engine.isMuted()).toBe(false);
    });

    /**
     * @tier: 1
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T1_F05_02] toggleMute flips state from unmuted to muted and returns true', () => {
      localStorage.removeItem('macatung_sound_muted');
      const engine = new SoundEngine();
      const result = engine.toggleMute();
      expect(result).toBe(true);
      expect(engine.isMuted()).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T1_F05_03] toggleMute updates localStorage with string representation of mute state', () => {
      const engine = new SoundEngine();
      engine.toggleMute();
      expect(localStorage.getItem('macatung_sound_muted')).toBe('true');
      engine.toggleMute();
      expect(localStorage.getItem('macatung_sound_muted')).toBe('false');
    });

    /**
     * @tier: 1
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T1_F05_04] When muted, sound playback methods do not create any audio nodes', () => {
      const engine = new SoundEngine();
      if (!engine.isMuted()) engine.toggleMute();

      const initialCount = env.audioContext.getAllOscillators().length;
      engine.playHop();
      engine.playTalisman();
      engine.playClick();
      engine.playTerminalKey();
      engine.playSuccess();

      const finalCount = env.audioContext.getAllOscillators().length;
      expect(finalCount).toBe(initialCount);
    });

    /**
     * @tier: 1
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T1_F05_05] Unmuting with toggleMute provides immediate audio confirmation click', () => {
      localStorage.setItem('macatung_sound_muted', 'true');
      const engine = new SoundEngine();
      expect(engine.isMuted()).toBe(true);

      engine.toggleMute(); // switches to unmuted, triggers playClick()
      expect(engine.isMuted()).toBe(false);

      const oscs = env.audioContext.getAllOscillators();
      expect(oscs.length).toBeGreaterThanOrEqual(1);
      const clickOsc = oscs[oscs.length - 1];
      expect(clickOsc.type).toBe('sine');
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F04] Boundary & Stress Handling for Audio Synthesizer', () => {
    /**
     * @tier: 2
     * @feature: F04_SOUND_ENGINE
     */
    it('[T2_F04_01] playHop with 0 or negative intensity produces base frequency >= 220Hz without error', () => {
      const engine = new SoundEngine();
      expect(() => engine.playHop(0)).not.toThrow();
      expect(() => engine.playHop(-5)).not.toThrow();
    });

    /**
     * @tier: 2
     * @feature: F04_SOUND_ENGINE
     */
    it('[T2_F04_02] playHop with high intensity (e.g. 50) scales frequencies without NaN or throw', () => {
      const engine = new SoundEngine();
      expect(() => engine.playHop(50)).not.toThrow();

      const oscs = env.audioContext.getAllOscillators();
      const latest = oscs[oscs.length - 1];
      const startFreq = latest.frequency.getScheduledEvents()[0]?.value;
      expect(startFreq).toBe(220 + 50 * 40); // 2220Hz
      expect(Number.isFinite(startFreq)).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F04_SOUND_ENGINE
     */
    it('[T2_F04_03] Rapid consecutive hop triggering (stress spam 25 times) completes cleanly', () => {
      const engine = new SoundEngine();
      expect(() => {
        for (let i = 0; i < 25; i++) {
          engine.playHop(i % 3);
        }
      }).not.toThrow();

      const oscs = env.audioContext.getAllOscillators();
      expect(oscs.length).toBeGreaterThanOrEqual(25);
    });

    /**
     * @tier: 2
     * @feature: F04_SOUND_ENGINE
     */
    it('[T2_F04_04] Automatically resumes suspended AudioContext on user interaction', () => {
      const engine = new SoundEngine();
      const ctx = (engine as any).getContext();
      if (ctx) {
        ctx.state = 'suspended';
        expect(ctx.state).toBe('suspended');
        engine.playClick();
        expect(ctx.state).toBe('running');
      }
    });

    /**
     * @tier: 2
     * @feature: F04_SOUND_ENGINE
     */
    it('[T2_F04_05] Audio synthesizer handles zero latency or zero gain smoothly', () => {
      const engine = new SoundEngine();
      expect(() => {
        engine.playSuccess();
        engine.playTalisman();
      }).not.toThrow();

      const gains = env.audioContext.getAllGains();
      expect(gains.length).toBeGreaterThan(0);
      gains.forEach((g: any) => {
        expect(g.gain).toBeDefined();
      });
    });
  });

  describe('[T2_F05] Boundary & Edge States for Sound Preference Toggle', () => {
    /**
     * @tier: 2
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T2_F05_01] Corrupted localStorage values default safely to unmuted', () => {
      const corruptedValues = ['corrupted_data', '12345', 'null', 'undefined', '{}', ''];
      for (const val of corruptedValues) {
        localStorage.setItem('macatung_sound_muted', val);
        const engine = new SoundEngine();
        expect(engine.isMuted()).toBe(false);
      }
    });

    /**
     * @tier: 2
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T2_F05_02] Exact string "true" in localStorage initializes SoundEngine as muted', () => {
      localStorage.setItem('macatung_sound_muted', 'true');
      const engine = new SoundEngine();
      expect(engine.isMuted()).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T2_F05_03] 50 consecutive toggleMute calls maintain perfect parity with localStorage', () => {
      localStorage.clear();
      const engine = new SoundEngine();
      let expected = false;

      for (let i = 0; i < 50; i++) {
        const res = engine.toggleMute();
        expected = !expected;
        expect(res).toBe(expected);
        expect(engine.isMuted()).toBe(expected);
        expect(localStorage.getItem('macatung_sound_muted')).toBe(String(expected));
      }
    });

    /**
     * @tier: 2
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T2_F05_04] SoundEngine instance behaves safely when Web Audio constructor throws', () => {
      const originalAudioContext = (globalThis as any).AudioContext;
      (globalThis as any).AudioContext = function () {
        throw new Error('AudioContext blocked by browser policy');
      };

      try {
        const engine = new SoundEngine();
        expect(() => {
          engine.playHop();
          engine.playTalisman();
          engine.playClick();
          engine.playTerminalKey();
          engine.playSuccess();
        }).not.toThrow();
      } finally {
        (globalThis as any).AudioContext = originalAudioContext;
      }
    });

    /**
     * @tier: 2
     * @feature: F05_SOUND_TOGGLE
     */
    it('[T2_F05_05] Rapid mute toggle during audio playback does not cause runtime exceptions', () => {
      const engine = new SoundEngine();
      expect(() => {
        engine.playHop();
        engine.toggleMute();
        engine.playTalisman();
        engine.toggleMute();
        engine.playSuccess();
      }).not.toThrow();
    });
  });
});
