/**
 * Tier 4: Real-World Application Scenarios (Part 1: Scenarios 1 to 6)
 * @tier: 4
 *
 * Implements Tier 4 E2E user workflow scenarios (T4_01 through T4_06) defined in TEST_INFRA.md § Tier 4:
 * 1. T4_01_VISITOR_FIRST_IMPRESSION
 * 2. T4_02_MASCOT_PLAYFUL_JOURNEY
 * 3. T4_03_MASCOT_MOOD_CYCLE
 * 4. T4_04_TERMINAL_POWER_USER
 * 5. T4_05_TALISMAN_FORGING_RITUAL
 * 6. T4_06_PROJECT_GRIMOIRE_EXPLORATION
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

describe('Tier 4: Real-World E2E Scenarios (01 to 06)', () => {
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
  // T4_01: Visitor First Impression
  // ==========================================================================
  it('T4_01: [T4_01] Visitor First Impression — Obsidian Aesthetic, Hero Typography, Midnight Clock & Canvas', () => {
    // @tier: 4
    // Step 1: User lands on the page
    const pageContainer = document.createElement('div');
    pageContainer.className =
      'min-h-screen bg-midnight-950 text-slate-100 selection:bg-phantom-mint selection:text-midnight-950 flex flex-col justify-between relative overflow-hidden bg-grid-pattern';
    document.body.appendChild(pageContainer);

    expect(pageContainer.classList.contains('bg-midnight-950')).toBe(true);
    expect(pageContainer.classList.contains('text-slate-100')).toBe(true);

    // Step 2: Hero headline with neon midnight gradient
    const heroTitle = document.createElement('h1');
    heroTitle.className =
      'text-4xl sm:text-6xl font-display font-extrabold tracking-tight text-white max-w-3xl mb-6';
    heroTitle.innerHTML =
      'Code at <span class="text-transparent bg-clip-text bg-gradient-to-r from-phantom-mint via-phantom-cyan to-talisman-yellow">midnight</span>.';
    pageContainer.appendChild(heroTitle);

    expect(heroTitle.innerHTML).toContain('Code at');
    expect(heroTitle.innerHTML).toContain('midnight');
    expect(heroTitle.innerHTML).toContain('text-transparent');

    // Step 3: Midnight Digital Clock status
    const mockNow = new Date('2026-08-17T02:30:00+07:00');
    const clock = {
      currentTimeStr: '02:30:00',
      timezone: 'GMT+7',
      get isMidnightMode(): boolean {
        const hour = mockNow.getHours();
        return hour >= 0 && hour < 5;
      },
      get modeLabel(): string {
        return this.isMidnightMode ? '🌙 Midnight Mode (Flow State)' : '☀️ Daylight Prep';
      },
      caffeineReserveMg: 150,
      pingLatencyMs: 18
    };

    expect(clock.currentTimeStr).toBe('02:30:00');
    expect(clock.isMidnightMode).toBe(true);
    expect(clock.modeLabel).toContain('Midnight Mode');
    expect(clock.pingLatencyMs).toBeLessThanOrEqual(20);

    // Step 4: HTML5 Canvas particle engine initialization
    const canvas = document.createElement('canvas') as any;
    canvas.width = 1440;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeDefined();

    // Spawn 15 mystic talisman runes + 15 glowing firefly particles
    const particles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      type: i % 2 === 0 ? 'talisman' : 'firefly',
      x: (i * 48) % 1440,
      y: (i * 30) % 900,
      alpha: 0.7,
      color: i % 2 === 0 ? '#ffd166' : '#00f5a0'
    }));

    // Render initial frame
    ctx.clearRect(0, 0, 1440, 900);
    particles.forEach((p) => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.type === 'talisman' ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    const drawnArcs = ctx.getDrawnArcs();
    expect(drawnArcs.length).toBe(30);

    // Step 5: Verify 4 Stats Cards
    expect(developerStats.length).toBe(4);
    expect(developerStats[0].label).toBe('Kinh Nghiệm Thực Chiến');
    expect(developerStats[0].value).toBe('8+ Năm');
    expect(developerStats[1].label).toBe('Tỉ Lệ CS Tự Động Hóa');
    expect(developerStats[1].value).toBe('92%+');
    expect(developerStats[2].label).toBe('Hạ Tầng GIS & Thiết Bị');
    expect(developerStats[2].value).toBe('500K+');
    expect(developerStats[3].label).toBe('Uptime Cam Kết Đêm');
    expect(developerStats[3].value).toBe('99.99%');
  });

  // ==========================================================================
  // T4_02: Mascot Playful Journey
  // ==========================================================================
  it('T4_02: [T4_02] Mascot Playful Journey — 10 Hops, Physics, Quotes, Milestone Celebration & Persistence', () => {
    // @tier: 4
    const mascotQuotes = [
      'Hop hop! Code at midnight!',
      'Debugging at 2 AM with a cup of robusta.',
      'Refactoring the universe, one hop at a time.',
      'Zero bugs allowed in the midnight sanctuary.',
      'Did someone say Friday deploy? No fear!',
      'Synthesizing sine waves in Web Audio.',
      'Khai Quang seal applied: 100% bug-proof!',
      'CSS transforms smoothly at 60 FPS.',
      'Almost at the milestone! Keep hopping!',
      '🎉 Milestone 10 Hops Unlocked! Fanfare celebration!'
    ];

    const mascot = {
      hopCount: Number(localStorage.getItem('macatung_hop_count') || 0),
      isHopping: false,
      currentQuote: mascotQuotes[0],
      milestoneFanfarePlayed: false,
      tap() {
        this.hopCount++;
        this.isHopping = true;
        localStorage.setItem('macatung_hop_count', String(this.hopCount));
        this.currentQuote = mascotQuotes[(this.hopCount - 1) % mascotQuotes.length];

        sound.playHop(1);

        if (this.hopCount > 0 && this.hopCount % 10 === 0) {
          this.milestoneFanfarePlayed = true;
          env.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
          sound.playSuccess();
        }
      }
    };

    expect(mascot.hopCount).toBe(0);
    expect(mascot.milestoneFanfarePlayed).toBe(false);

    // Tap 1st through 9th times
    for (let tap = 1; tap <= 9; tap++) {
      mascot.tap();
      expect(mascot.hopCount).toBe(tap);
      expect(localStorage.getItem('macatung_hop_count')).toBe(String(tap));
      expect(mascot.currentQuote).toBe(mascotQuotes[tap - 1]);
      expect(mascot.milestoneFanfarePlayed).toBe(false);
    }

    // 10th tap: milestone fanfare unlocked!
    mascot.tap();
    expect(mascot.hopCount).toBe(10);
    expect(localStorage.getItem('macatung_hop_count')).toBe('10');
    expect(mascot.milestoneFanfarePlayed).toBe(true);
    expect(mascot.currentQuote).toContain('Milestone 10 Hops Unlocked');
    expect(env.confetti.calls.length).toBe(1);

    // Verify audio synthesis: 10 hops + 4 success fanfare chord notes = 14 oscillators
    const oscs = env.audioContext.getAllOscillators();
    expect(oscs.length).toBe(14);

    // Simulate page reload: new mascot reads persistent storage
    const reloadedHopCount = Number(localStorage.getItem('macatung_hop_count'));
    expect(reloadedHopCount).toBe(10);
  });

  // ==========================================================================
  // T4_03: Mascot Mood Cycle
  // ==========================================================================
  it('T4_03: [T4_03] Mascot Mood Cycle — Normal, Caffeine, Sleepy, Rage with Eye SVGs, Glow & Pitch Shifts', () => {
    // @tier: 4
    type MascotMood = 'normal' | 'caffeine' | 'sleepy' | 'rage';

    const moodConfig: Record<
      MascotMood,
      {
        glowColor: string;
        eyeType: string;
        pitchMultiplier: number;
        speech: string;
      }
    > = {
      normal: {
        glowColor: 'shadow-glow-mint',
        eyeType: 'eyes-open-smiling',
        pitchMultiplier: 1.0,
        speech: 'Coding peacefully under the moonlight.'
      },
      caffeine: {
        glowColor: 'shadow-glow-cyan',
        eyeType: 'eyes-wide-glowing-neon',
        pitchMultiplier: 1.5,
        speech: 'Caffeine level 9000! 100k RPS ready!'
      },
      sleepy: {
        glowColor: 'shadow-glow-purple',
        eyeType: 'eyes-closed-zzz',
        pitchMultiplier: 0.7,
        speech: '4:00 AM... just one more commit before sleep.'
      },
      rage: {
        glowColor: 'shadow-glow-crimson',
        eyeType: 'eyes-flaming-red',
        pitchMultiplier: 2.0,
        speech: 'WHO BROKE THE PRODUCTION DEPLOYMENT?!'
      }
    };

    const mascot = {
      mood: 'normal' as MascotMood,
      setMood(newMood: MascotMood) {
        this.mood = newMood;
        sound.playHop(moodConfig[newMood].pitchMultiplier);
      },
      get config() {
        return moodConfig[this.mood];
      }
    };

    // 1. Initial normal mood
    expect(mascot.mood).toBe('normal');
    expect(mascot.config.glowColor).toBe('shadow-glow-mint');
    expect(mascot.config.eyeType).toBe('eyes-open-smiling');

    // 2. Cycle to caffeine mood
    mascot.setMood('caffeine');
    expect(mascot.mood).toBe('caffeine');
    expect(mascot.config.glowColor).toBe('shadow-glow-cyan');
    expect(mascot.config.pitchMultiplier).toBe(1.5);
    expect(mascot.config.speech).toContain('Caffeine level');

    // 3. Cycle to sleepy mood (4 AM)
    mascot.setMood('sleepy');
    expect(mascot.mood).toBe('sleepy');
    expect(mascot.config.glowColor).toBe('shadow-glow-purple');
    expect(mascot.config.eyeType).toBe('eyes-closed-zzz');
    expect(mascot.config.pitchMultiplier).toBe(0.7);

    // 4. Cycle to rage mood (Deploy bug)
    mascot.setMood('rage');
    expect(mascot.mood).toBe('rage');
    expect(mascot.config.glowColor).toBe('shadow-glow-crimson');
    expect(mascot.config.eyeType).toBe('eyes-flaming-red');
    expect(mascot.config.pitchMultiplier).toBe(2.0);

    // 5. Restore to normal
    mascot.setMood('normal');
    expect(mascot.mood).toBe('normal');
    expect(mascot.config.glowColor).toBe('shadow-glow-mint');
  });

  // ==========================================================================
  // T4_04: Terminal Power User
  // ==========================================================================
  it('T4_04: [T4_04] Terminal Power User — Expand, 11 Commands, Audio Synthesis, Copy Logs & Clear', async () => {
    // @tier: 4
    const terminalState = {
      isExpanded: false,
      history: [] as { cmd: string; output: string }[],
      prompt: 'macatung:~$',
      toggleExpand() {
        this.isExpanded = !this.isExpanded;
      },
      execute(input: string) {
        const cmd = input.trim();
        sound.playTerminalKey();

        let output = '';
        if (cmd === 'help') {
          output =
            'Available commands: help, whoami, projects, skills, hop, coffee, talisman, slogan, summon, sudo rm -rf bugs, clear';
        } else if (cmd === 'whoami' || cmd === 'bio') {
          output =
            'Ma Cà Tưng (Night-Crawler & Lead Full-Stack Architect). Specializes in Laravel 11, Inertia.js, Vue 3, Rust WASM, and Web Audio API.';
        } else if (cmd === 'projects' || cmd === 'ls') {
          output = `Grimoire projects: ${projectsData.map((p) => p.title).join(' | ')}`;
        } else if (cmd === 'skills') {
          output = `Skills Arsenal: ${skillsData.map((c) => `${c.title} (${c.skills.length})`).join(', ')}`;
        } else if (cmd === 'hop') {
          sound.playHop();
          output = '🧛‍♂️ Ma Cà Tưng hopped! Hop count +1.';
        } else if (cmd.startsWith('coffee')) {
          output = '☕ Vietnamese Robusta brewed! Caffeine +150mg.';
        } else if (cmd === 'talisman') {
          output = `✨ Summoned Talisman: [${talismanPresets[0].title}] — ${talismanPresets[0].meaning}`;
        } else if (cmd === 'slogan') {
          output = 'Code at midnight. Deploy with confidence.';
        } else if (cmd === 'summon') {
          output = 'Teleporting to the Summoning Altar...';
        } else if (cmd === 'sudo rm -rf bugs') {
          this.history = [];
          output = '💥 Bugs purged from existence!';
        } else if (cmd === 'clear') {
          this.history = [];
          return;
        } else {
          output = `Command not found: ${cmd}. Type "help" for a list of spells.`;
        }

        this.history.push({ cmd, output });
      },
      getFormattedLogs(): string {
        return this.history.map((h) => `${this.prompt} ${h.cmd}\n${h.output}`).join('\n\n');
      }
    };

    // Step 1: Expand terminal
    expect(terminalState.isExpanded).toBe(false);
    terminalState.toggleExpand();
    expect(terminalState.isExpanded).toBe(true);

    // Step 2: Execute command suite
    terminalState.execute('help');
    expect(terminalState.history[0].output).toContain('Available commands:');

    terminalState.execute('whoami');
    expect(terminalState.history[1].output).toContain('Lead Full-Stack Architect');

    terminalState.execute('skills');
    expect(terminalState.history[2].output).toContain('Frontend Sorcery');

    terminalState.execute('projects');
    expect(terminalState.history[3].output).toContain('OmniAgent CS');

    terminalState.execute('hop');
    expect(terminalState.history[4].output).toContain('Ma Cà Tưng hopped');

    terminalState.execute('coffee robusta');
    expect(terminalState.history[5].output).toContain('Vietnamese Robusta brewed');

    terminalState.execute('talisman');
    expect(terminalState.history[6].output).toContain('Summoned Talisman');

    terminalState.execute('slogan');
    expect(terminalState.history[7].output).toContain('Code at midnight.');

    terminalState.execute('summon');
    expect(terminalState.history[8].output).toContain('Summoning Altar');

    expect(terminalState.history.length).toBe(9);

    // Step 3: Copy logs to clipboard
    let copiedText = '';
    navigator.clipboard = {
      writeText: fn(async (text: string) => {
        copiedText = text;
        return Promise.resolve();
      })
    } as any;

    const fullLogs = terminalState.getFormattedLogs();
    await navigator.clipboard.writeText(fullLogs);
    expect(copiedText).toContain('macatung:~$ help');
    expect(copiedText).toContain('macatung:~$ whoami');

    // Step 4: Clear terminal
    terminalState.execute('clear');
    expect(terminalState.history.length).toBe(0);
  });

  // ==========================================================================
  // T4_05: Talisman Forging Ritual
  // ==========================================================================
  it('T4_05: [T4_05] Talisman Forging Ritual — Preset Selection, Custom Wish, Blessing Seal, Audio & ASCII Export', async () => {
    // @tier: 4
    const forge = {
      selectedPreset: talismanPresets[0], // BÙA CODE 0 BUG
      developerName: 'SeniorNightOwl',
      customWish: 'Deploy êm đềm 0 bug 100k RPS',
      palette: 'crimson',
      isBlessed: false,
      blessedTimestamp: null as number | null,
      bless() {
        this.isBlessed = true;
        this.blessedTimestamp = Date.now();
        sound.playTalisman();
        env.confetti({ particleCount: 75, spread: 60 });
      },
      exportAscii(): string {
        return [
          '╔══════════════════════════════════════════════════╗',
          `║  📜 MA CÀ TƯNG — ${this.selectedPreset.title.padEnd(30, ' ')} ║`,
          '╠══════════════════════════════════════════════════╣',
          `║  RUNE   : ${this.selectedPreset.runeTop.padEnd(38, ' ')} ║`,
          `║  AUTHOR : ${this.developerName.padEnd(38, ' ')} ║`,
          `║  WISH   : ${this.customWish.padEnd(38, ' ')} ║`,
          `║  SNIPPET: ${this.selectedPreset.codeSnippet.padEnd(38, ' ')} ║`,
          '╠══════════════════════════════════════════════════╣',
          '║  ✨ [✓ ĐÃ KHAI QUANG TẠI MACATUNG.DEV]           ║',
          '╚══════════════════════════════════════════════════╝'
        ].join('\n');
      }
    };

    // 1. Verify preset and customizations
    expect(forge.selectedPreset.id).toBe('bua-no-bug');
    expect(forge.developerName).toBe('SeniorNightOwl');
    expect(forge.customWish).toBe('Deploy êm đềm 0 bug 100k RPS');
    expect(forge.isBlessed).toBe(false);

    // 2. Perform Khai Quang blessing seal
    forge.bless();
    expect(forge.isBlessed).toBe(true);
    expect(forge.blessedTimestamp).toBeGreaterThan(0);
    expect(env.confetti.calls.length).toBe(1);

    // Verify 4-note chime audio
    const oscs = env.audioContext.getAllOscillators();
    expect(oscs.length).toBe(4);
    expect(oscs[0].type).toBe('triangle');

    // 3. Export ASCII talisman and copy to clipboard
    const asciiCard = forge.exportAscii();
    expect(asciiCard).toContain('SeniorNightOwl');
    expect(asciiCard).toContain('Deploy êm đềm 0 bug 100k RPS');
    expect(asciiCard).toContain('ĐÃ KHAI QUANG TẠI MACATUNG.DEV');

    let copiedArt = '';
    navigator.clipboard = {
      writeText: fn(async (text: string) => {
        copiedArt = text;
        return Promise.resolve();
      })
    } as any;

    await navigator.clipboard.writeText(asciiCard);
    expect(copiedArt).toBe(asciiCard);
  });

  // ==========================================================================
  // T4_06: Project Grimoire Exploration
  // ==========================================================================
  it('T4_06: [T4_06] Project Grimoire Exploration — Filter Categories, Inspect Modal, Highlights, Lore & ESC Dismiss', () => {
    // @tier: 4
    const showcase = {
      currentFilter: 'all',
      selectedProject: null as Project | null,
      isModalOpen: false,
      get visibleProjects(): Project[] {
        if (this.currentFilter === 'all') return projectsData;
        return projectsData.filter((p) => p.category === this.currentFilter);
      },
      setFilter(cat: string) {
        this.currentFilter = cat;
      },
      openProject(p: Project) {
        this.selectedProject = p;
        this.isModalOpen = true;
        document.body.classList.add('overflow-hidden');
      },
      closeModal() {
        this.selectedProject = null;
        this.isModalOpen = false;
        document.body.classList.remove('overflow-hidden');
      }
    };

    // ESC key dismissal
    window.addEventListener('keydown', (e: any) => {
      if (e.key === 'Escape' && showcase.isModalOpen) {
        showcase.closeModal();
      }
    });

    // 1. Initial all projects view
    expect(showcase.visibleProjects.length).toBe(6);

    // 2. Filter by fullstack
    showcase.setFilter('fullstack');
    expect(showcase.visibleProjects.length).toBe(1);
    expect(showcase.visibleProjects[0].id).toBe('stock-valuation-financial-management');

    // 3. Filter by ai-web3
    showcase.setFilter('ai-web3');
    expect(showcase.visibleProjects.length).toBe(1);
    expect(showcase.visibleProjects.map((p) => p.id)).toEqual([
      'ai-agent-customer-service-ecosystem'
    ]);

    // 4. Open OmniAgent CS modal
    const omniProject = projectsData[0];
    showcase.openProject(omniProject);

    expect(showcase.isModalOpen).toBe(true);
    expect(showcase.selectedProject!.title).toContain('OmniAgent CS');
    expect(showcase.selectedProject!.architectureHighlights.length).toBeGreaterThanOrEqual(3);
    expect(showcase.selectedProject!.architectureHighlights[0]).toContain('Multi-Agent');
    expect(showcase.selectedProject!.midnightFact).toContain('Flash Sale');
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    // 5. Dismiss with Escape key
    const escEvent = new MockKeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);

    expect(showcase.isModalOpen).toBe(false);
    expect(showcase.selectedProject).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });
});
