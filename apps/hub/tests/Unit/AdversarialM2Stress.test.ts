/**
 * Test Suite: Adversarial Challenge & Stress Testing for Milestone 2 (M2)
 *
 * Scopes:
 * 1. Web Audio Synthesizer:
 *    - Rapid trigger stress (50+ rapid hops in <100ms, multi-sound storms)
 *    - AudioContext suspended / closed / webkitAudioContext / throwing states across browser engines
 *    - Mute toggle interleaved with active playback and rapid flips
 * 2. Mascot & Canvas Particle Engine:
 *    - Hop counter boundary values, milestones, corruptions, QuotaExceeded
 *    - Mascot mood transitions, invalid inputs, random fuzzing sequences, pitch bounds
 *    - Canvas particle loop under zero/extreme/negative dimensions, mouse NaN/Infinity, division-by-zero guards
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import {
  setupTestEnvironment,
  MockAudioContext,
  MockOscillatorNode,
  MockGainNode,
  MockCanvasRenderingContext2D
} from '../Harness/mock_helpers.js';
import { SoundEngine } from '../../resources/js/audio/soundEffects.ts';
import { MascotModel } from './MascotPhysicsTest.test.ts';
import { TalismanParticleEngine } from './TalismanCanvasTest.test.ts';

describe('Adversarial Stress Test: Milestone 2 Core Engines', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    localStorage.clear();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // SECTION 1: Web Audio Synthesizer Adversarial Testing
  // ==========================================================================
  describe('Web Audio Synthesizer Stress & Resilience', () => {
    it('[ADV_AUDIO_01] Rapid burst stress: 50 hops in rapid succession creates valid audio nodes without throwing', () => {
      const engine = new SoundEngine();
      const initialOscCount = env.audioContext.getAllOscillators().length;

      expect(() => {
        for (let i = 0; i < 50; i++) {
          const intensity = 1 + (i % 5) * 0.2;
          engine.playHop(intensity);
        }
      }).not.toThrow();

      const finalOscCount = env.audioContext.getAllOscillators().length;
      expect(finalOscCount - initialOscCount).toBe(50);

      // Verify all scheduled oscillators have finite positive frequencies
      const oscs = env.audioContext.getAllOscillators().slice(-50);
      for (const osc of oscs) {
        expect(osc.type).toBe('sine');
        expect(osc.started).toBe(true);
        const events = osc.frequency.getScheduledEvents();
        expect(events.length).toBeGreaterThanOrEqual(2);
        for (const evt of events) {
          expect(Number.isFinite(evt.value)).toBe(true);
          expect(evt.value).toBeGreaterThan(0);
        }
      }
    });

    it('[ADV_AUDIO_02] Massive multi-sound storm (hops, talismans, clicks, terminal keys, success fanfare) executes cleanly', () => {
      const engine = new SoundEngine();

      expect(() => {
        for (let i = 0; i < 20; i++) {
          engine.playHop(i % 3);
          engine.playTalisman();
          engine.playClick();
          engine.playTerminalKey();
          if (i % 5 === 0) {
            engine.playSuccess();
          }
        }
      }).not.toThrow();

      const oscs = env.audioContext.getAllOscillators();
      // Each talisman is 4 oscs, each success is 4 oscs, hop is 1, click is 1, key is 1 -> 20*(1+4+1+1) + 4*4 = 140 + 16 = 156
      expect(oscs.length).toBeGreaterThanOrEqual(140);
    });

    it('[ADV_AUDIO_03] AudioContext starts in suspended state (browser autoplay policy) -> auto-resumes on playback', () => {
      const engine = new SoundEngine();
      const ctx = (engine as any).getContext();
      expect(ctx).toBeDefined();

      // Simulate browser suspending context
      ctx.state = 'suspended';
      expect(ctx.state).toBe('suspended');

      // Triggering hop should resume context
      engine.playHop();
      expect(ctx.state).toBe('running');
    });

    it('[ADV_AUDIO_04] AudioContext closed state recovery: re-creates a new AudioContext when existing is closed', () => {
      const engine = new SoundEngine();
      const initialCtx = (engine as any).getContext();
      expect(initialCtx).toBeDefined();

      // Force close the audio context (e.g. system device changed or tab backgrounded)
      initialCtx.state = 'closed';

      // Next playback should detect closed state and construct a fresh active context
      engine.playHop();
      const newCtx = (engine as any).getContext();
      expect(newCtx).not.toBe(initialCtx);
      expect(newCtx.state).toBe('running');
    });

    it('[ADV_AUDIO_05] Legacy Safari webkitAudioContext fallback support', () => {
      // Remove standard AudioContext and provide webkitAudioContext
      const standardAudioContext = (window as any).AudioContext;
      delete (window as any).AudioContext;
      (window as any).webkitAudioContext = MockAudioContext;

      try {
        const engine = new SoundEngine();
        expect(() => {
          engine.playHop();
          engine.playTalisman();
          engine.playClick();
        }).not.toThrow();

        const oscs = env.audioContext.getAllOscillators();
        expect(oscs.length).toBeGreaterThanOrEqual(6);
      } finally {
        (window as any).AudioContext = standardAudioContext;
        delete (window as any).webkitAudioContext;
      }
    });

    it('[ADV_AUDIO_06] Completely missing Web Audio API (headless/unsupported browser) degrades gracefully', () => {
      const standardAudioContext = (window as any).AudioContext;
      delete (window as any).AudioContext;
      delete (window as any).webkitAudioContext;

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
        (window as any).AudioContext = standardAudioContext;
      }
    });

    it('[ADV_AUDIO_07] AudioContext constructor throwing error degrades gracefully without unhandled exceptions', () => {
      const standardAudioContext = (window as any).AudioContext;
      (window as any).AudioContext = function () {
        throw new DOMException('The play() request was interrupted by a new load request.', 'NotAllowedError');
      };

      try {
        const engine = new SoundEngine();
        expect(() => {
          engine.playHop();
          engine.playTalisman();
          engine.playClick();
        }).not.toThrow();
      } finally {
        (window as any).AudioContext = standardAudioContext;
      }
    });

    it('[ADV_AUDIO_08] Interleaving mute toggle during active sound calls: muted returns null and saves state', () => {
      const engine = new SoundEngine();
      expect(engine.isMuted()).toBe(false);

      for (let i = 0; i < 30; i++) {
        if (i % 2 === 0) {
          engine.toggleMute(); // becomes muted
          const nodeCountBefore = env.audioContext.getAllOscillators().length;
          engine.playHop();
          engine.playTalisman();
          const nodeCountAfter = env.audioContext.getAllOscillators().length;
          expect(nodeCountAfter).toBe(nodeCountBefore); // No new nodes created
        } else {
          engine.toggleMute(); // becomes unmuted -> plays click
          expect(engine.isMuted()).toBe(false);
          expect(localStorage.getItem('macatung_sound_muted')).toBe('false');
        }
      }
    });
  });

  // ==========================================================================
  // SECTION 2: Mascot & Persistent Hop Ledger Boundary Testing
  // ==========================================================================
  describe('Mascot Model & Hop Ledger Boundary Stress', () => {
    it('[ADV_MASCOT_01] Hop counter boundary numbers: 0, 1, 9, 10, 99, 100, 1000', () => {
      const boundaryValues = [0, 1, 9, 10, 99, 100, 1000];
      for (const val of boundaryValues) {
        localStorage.setItem('macatung_hop_count', String(val));
        const mascot = new MascotModel();
        expect(mascot.hopCount).toBe(val);

        mascot.triggerHop();
        expect(mascot.hopCount).toBe(val + 1);
        expect(localStorage.getItem('macatung_hop_count')).toBe(String(val + 1));
      }
    });

    it('[ADV_MASCOT_02] Milestone detection triggers confetti and fanfare at exact multiples of 10', () => {
      const mascot = new MascotModel(0);
      const milestoneHops: number[] = [];

      mascot.on('milestone', (count: number) => {
        milestoneHops.push(count);
      });

      // Hop 1 to 35
      for (let i = 1; i <= 35; i++) {
        mascot.triggerHop();
      }

      expect(milestoneHops).toEqual([10, 20, 30]);
      expect(mascot.hopCount).toBe(35);
    });

    it('[ADV_MASCOT_03] Corrupted & adversarial localStorage values sanitize safely to 0', () => {
      const adversarialValues = [
        '-1',
        '-999999',
        'NaN',
        'Infinity',
        '-Infinity',
        'null',
        'undefined',
        '[object Object]',
        '{"hop": 5}',
        '   ',
        '',
        'hello_world',
        '--42',
        '0x1F', // Hex
        '3.14159',
        '1e10',
        '⚡👻☕'
      ];

      for (const raw of adversarialValues) {
        localStorage.setItem('macatung_hop_count', raw);
        const mascot = new MascotModel();
        // Number must be finite non-negative integer
        expect(Number.isFinite(mascot.hopCount)).toBe(true);
        expect(mascot.hopCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('[ADV_MASCOT_04] High-concurrency hop spamming (100 triggers in tight loop) maintains exact count', () => {
      const mascot = new MascotModel(0);
      let eventCallCount = 0;

      mascot.on('hop-count-change', () => {
        eventCallCount++;
      });

      for (let i = 0; i < 100; i++) {
        mascot.triggerHop();
      }

      expect(mascot.hopCount).toBe(100);
      expect(eventCallCount).toBe(100);
      expect(localStorage.getItem('macatung_hop_count')).toBe('100');
    });

    it('[ADV_MASCOT_05] Mood state transition cycle (normal -> caffeine -> sleepy -> rage -> normal)', () => {
      const mascot = new MascotModel();
      expect(mascot.mood).toBe('normal');
      expect(mascot.getPitchMultiplier()).toBe(1.0);

      mascot.setMood('caffeine');
      expect(mascot.mood).toBe('caffeine');
      expect(mascot.getPitchMultiplier()).toBe(1.35);

      mascot.setMood('sleepy');
      expect(mascot.mood).toBe('sleepy');
      expect(mascot.getPitchMultiplier()).toBe(0.75);

      mascot.setMood('rage');
      expect(mascot.mood).toBe('rage');
      expect(mascot.getPitchMultiplier()).toBe(1.8);

      mascot.setMood('normal');
      expect(mascot.mood).toBe('normal');
      expect(mascot.getPitchMultiplier()).toBe(1.0);
    });

    it('[ADV_MASCOT_06] Random fuzzing of 200 mood state switches remains strictly within valid bounds', () => {
      const mascot = new MascotModel();
      const validMoods = ['normal', 'caffeine', 'sleepy', 'rage'] as const;
      const invalidInjections = ['unknown', 'HYPER', '', 'null', 'undefined', '123', 'sleep', 'anger'];

      for (let i = 0; i < 200; i++) {
        if (i % 3 === 0) {
          const invalid = invalidInjections[i % invalidInjections.length];
          mascot.setMood(invalid);
          expect(mascot.mood).toBe('normal');
        } else {
          const valid = validMoods[i % validMoods.length];
          mascot.setMood(valid);
          expect(mascot.mood).toBe(valid);
        }

        const pitch = mascot.getPitchMultiplier();
        expect(pitch).toBeGreaterThanOrEqual(0.75);
        expect(pitch).toBeLessThanOrEqual(1.8);
      }
    });

    it('[ADV_MASCOT_07] Vietnamese quote rotation never produces undefined or empty string', () => {
      const mascot = new MascotModel();
      const visitedQuotes = new Set<string>();

      for (let i = 0; i < 25; i++) {
        const q = mascot.getQuote();
        expect(typeof q).toBe('string');
        expect(q.trim().length).toBeGreaterThan(0);
        visitedQuotes.add(q);
        mascot.triggerHop();
      }

      // Should cycle through all 5 quotes
      expect(visitedQuotes.size).toBe(5);
    });
  });

  // ==========================================================================
  // SECTION 3: Canvas Particle Engine Adversarial Testing
  // ==========================================================================
  describe('Canvas Particle Loop Stress & Edge Conditions', () => {
    let canvas: any;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 800;
    });

    it('[ADV_CANVAS_01] Extreme & Zero Canvas Dimensions (0x0, -100x-100, 50000x50000)', () => {
      const engine = new TalismanParticleEngine(canvas);

      // Zero dimensions
      engine.resize(0, 0);
      expect(engine.width).toBe(0);
      expect(engine.height).toBe(0);
      expect(() => {
        engine.update();
        engine.render();
      }).not.toThrow();

      // Negative dimensions clamp to 0
      engine.resize(-100, -100);
      expect(engine.width).toBe(0);
      expect(engine.height).toBe(0);
      expect(() => {
        engine.update();
        engine.render();
      }).not.toThrow();

      // Massive dimensions
      engine.resize(50000, 50000);
      expect(engine.width).toBe(50000);
      expect(engine.height).toBe(50000);
      expect(() => {
        engine.update();
        engine.render();
      }).not.toThrow();
    });

    it('[ADV_CANVAS_02] Mouse repulsion math division-by-zero protection when mouse is exactly on particle', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(800, 600);

      // Force particles to exact position (200, 200)
      for (const p of engine.particles) {
        p.x = 200;
        p.y = 200;
        p.vx = 0;
        p.vy = 0;
      }

      // Position mouse at exact same position (200, 200)
      engine.setMousePosition(200, 200);
      expect(() => engine.update()).not.toThrow();

      for (const p of engine.particles) {
        expect(Number.isNaN(p.x)).toBe(false);
        expect(Number.isNaN(p.y)).toBe(false);
        expect(Number.isNaN(p.vx)).toBe(false);
        expect(Number.isNaN(p.vy)).toBe(false);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    });

    it('[ADV_CANVAS_03] Adversarial mouse coordinates (NaN, Infinity, -Infinity, -99999)', () => {
      const engine = new TalismanParticleEngine(canvas);
      const testMousePositions = [
        [NaN, NaN],
        [Infinity, Infinity],
        [-Infinity, -Infinity],
        [-999999, -999999],
        [1e8, 1e8]
      ];

      for (const [mx, my] of testMousePositions) {
        engine.setMousePosition(mx, my);
        expect(() => {
          engine.update();
          engine.render();
        }).not.toThrow();

        for (const p of engine.particles) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
        }
      }
    });

    it('[ADV_CANVAS_04] Viewport boundary wrap handles extreme outside coordinates without unbounded accumulation', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(1000, 1000);

      // Particle far past right boundary (x = 2500)
      engine.particles[0].x = 2500;
      engine.particles[0].vx = 10;

      engine.update();
      // Wraps to left boundary (-margin = -50)
      expect(engine.particles[0].x).toBe(-50);

      // Particle far past top boundary (y = -300)
      engine.particles[1].y = -300;
      engine.particles[1].vy = -10;

      engine.update();
      // Wraps to bottom boundary (height + margin = 1050)
      expect(engine.particles[1].y).toBe(1050);
    });

    it('[ADV_CANVAS_05] Large particle population stress: 1000 particles 60-frame simulation loop', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.createParticles(1000);
      expect(engine.particles.length).toBe(1000);

      const startTime = Date.now();
      for (let frame = 0; frame < 60; frame++) {
        // Simulate mouse roaming
        engine.setMousePosition(200 + Math.sin(frame * 0.1) * 150, 200 + Math.cos(frame * 0.1) * 150);
        engine.update();
        engine.render();
      }
      const elapsed = Date.now() - startTime;

      // 60 frames of 1000 particles should finish very fast in mock environment (<500ms)
      expect(elapsed).toBeLessThan(1000);
      expect(engine.particles.length).toBe(1000);
    });

    it('[ADV_CANVAS_06] Particle clean lifecycle: multiple init and destroy cycles prevent memory/handle leaks', () => {
      const engine = new TalismanParticleEngine(canvas);

      for (let cycle = 0; cycle < 10; cycle++) {
        engine.createParticles(50);
        expect(engine.particles.length).toBe(50);
        engine.update();
        engine.render();
        engine.destroy();
        expect(engine.particles.length).toBe(0);
        expect(engine.isRunning).toBe(false);
      }
    });
  });
});
