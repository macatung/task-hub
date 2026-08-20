/**
 * Test Suite: Rune Typer Dev Mini-Game (F21_RUNE_TYPER)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 * Tier 3: Cross-Feature Interactions
 * Tier 4: Real-World E2E Scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment } from '../Harness/mock_helpers.js';
import { beginnerSpells, normalSpells, bossSpells, getTitleBadge } from '../../resources/js/data/spellsData.ts';
import type { GameMode, FallingRune, GameStats, HighScoreRecord } from '../../resources/js/types/game.ts';

export class RuneTyperGameModel {
  public selectedMode: GameMode = 'normal';
  public stats: GameStats = {
    score: 0,
    wordsCleared: 0,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    wrongKeystrokes: 0,
    comboStreak: 0,
    maxComboStreak: 0,
    wpm: 0,
    accuracy: 100,
    lives: 5,
    timeRemaining: 60,
    isGameOver: false,
    isPlaying: false,
    isPaused: false,
  };
  public fallingRunes: FallingRune[] = [];
  public currentTargetId: string | null = null;
  public activeCandidateIds: string[] = [];
  public highScores: HighScoreRecord[] = [];

  public startGame(mode: GameMode = 'normal') {
    this.selectedMode = mode;
    this.stats.score = 0;
    this.stats.wordsCleared = 0;
    this.stats.totalKeystrokes = 0;
    this.stats.correctKeystrokes = 0;
    this.stats.wrongKeystrokes = 0;
    this.stats.comboStreak = 0;
    this.stats.maxComboStreak = 0;
    this.stats.wpm = 0;
    this.stats.accuracy = 100;
    this.stats.lives = 5;
    this.stats.timeRemaining = mode === 'beginner' ? 30 : mode === 'normal' ? 60 : 999;
    this.stats.isGameOver = false;
    this.stats.isPlaying = true;
    this.stats.isPaused = false;
    this.fallingRunes = [];
    this.currentTargetId = null;
    this.activeCandidateIds = [];
  }

  public getComboMultiplier(): number {
    if (this.stats.comboStreak >= 20) return 5;
    if (this.stats.comboStreak >= 10) return 3;
    if (this.stats.comboStreak >= 5) return 2;
    return 1;
  }

  public spawnRune(customWord?: string, isBoss: boolean = false): FallingRune {
    const wordPool = this.selectedMode === 'beginner' ? beginnerSpells : normalSpells;
    const word = customWord || wordPool[Math.floor(Math.random() * wordPool.length)];
    const rune: FallingRune = {
      id: Math.random().toString(36).substring(2, 9),
      word,
      typedLength: 0,
      x: 30,
      y: 0,
      speed: this.selectedMode === 'beginner' ? 3.6 : 5.5,
      category: isBoss ? 'boss' : 'spell',
      points: word.length * 10 * (isBoss ? 5 : 1),
      isBoss,
      bossHp: isBoss ? 3 : 1,
      bossMaxHp: isBoss ? 3 : 1,
      colorHex: isBoss ? '#ff4d6d' : '#00f5a0',
      glowHex: 'rgba(0, 245, 160, 0.4)',
    };
    this.fallingRunes.push(rune);
    return rune;
  }

  public typeKey(key: string): boolean {
    if (!this.stats.isPlaying || this.stats.isPaused || this.stats.isGameOver) return false;
    this.stats.totalKeystrokes++;
    let matched = false;

    // 1. If currently locked onto a single target rune
    if (this.currentTargetId) {
      const target = this.fallingRunes.find(r => r.id === this.currentTargetId);
      if (target) {
        const expectedChar = target.word[target.typedLength];
        if (expectedChar && expectedChar.toLowerCase() === key.toLowerCase()) {
          target.typedLength++;
          matched = true;
          this.stats.correctKeystrokes++;
          this.stats.comboStreak++;
          if (this.stats.comboStreak > this.stats.maxComboStreak) {
            this.stats.maxComboStreak = this.stats.comboStreak;
          }

          if (target.typedLength >= target.word.length) {
            this.clearRune(target);
          }
        } else {
          this.stats.wrongKeystrokes++;
          this.stats.comboStreak = 0;
        }
        this.stats.accuracy = Math.round((this.stats.correctKeystrokes / Math.max(this.stats.totalKeystrokes, 1)) * 100);
        return matched;
      }
    }

    // 2. If multiple candidates are active
    if (this.activeCandidateIds.length > 0) {
      const candidates = this.fallingRunes.filter(r => this.activeCandidateIds.includes(r.id));
      const matchingNext: FallingRune[] = [];

      for (const rune of candidates) {
        const expectedChar = rune.word[rune.typedLength];
        if (expectedChar && expectedChar.toLowerCase() === key.toLowerCase()) {
          rune.typedLength++;
          matchingNext.push(rune);
        } else {
          rune.typedLength = 0;
        }
      }

      if (matchingNext.length > 0) {
        matched = true;
        this.stats.correctKeystrokes++;
        this.stats.comboStreak++;
        if (this.stats.comboStreak > this.stats.maxComboStreak) {
          this.stats.maxComboStreak = this.stats.comboStreak;
        }

        if (matchingNext.length === 1) {
          const locked = matchingNext[0];
          this.currentTargetId = locked.id;
          this.activeCandidateIds = [];

          if (locked.typedLength >= locked.word.length) {
            this.clearRune(locked);
          }
        } else {
          this.activeCandidateIds = matchingNext.map(r => r.id);
        }
      } else {
        this.stats.wrongKeystrokes++;
        this.stats.comboStreak = 0;
      }

      this.stats.accuracy = Math.round((this.stats.correctKeystrokes / Math.max(this.stats.totalKeystrokes, 1)) * 100);
      return matched;
    }

    // 3. No target & no candidates -> Match all starting with key
    const initialMatches = this.fallingRunes.filter(r => {
      return r.word.length > 0 && r.word[0].toLowerCase() === key.toLowerCase();
    });

    if (initialMatches.length > 0) {
      matched = true;
      this.stats.correctKeystrokes++;
      this.stats.comboStreak++;
      if (this.stats.comboStreak > this.stats.maxComboStreak) {
        this.stats.maxComboStreak = this.stats.comboStreak;
      }

      if (initialMatches.length === 1) {
        const target = initialMatches[0];
        target.typedLength = 1;
        this.currentTargetId = target.id;
        this.activeCandidateIds = [];

        if (target.typedLength >= target.word.length) {
          this.clearRune(target);
        }
      } else {
        initialMatches.forEach(r => { r.typedLength = 1; });
        this.activeCandidateIds = initialMatches.map(r => r.id);
      }
    } else {
      this.stats.wrongKeystrokes++;
      this.stats.comboStreak = 0;
    }

    this.stats.accuracy = Math.round((this.stats.correctKeystrokes / Math.max(this.stats.totalKeystrokes, 1)) * 100);
    return matched;
  }

  public clearRune(rune: FallingRune) {
    if (rune.isBoss && rune.bossHp && rune.bossHp > 1) {
      rune.bossHp--;
      rune.typedLength = 0;
      rune.word = 'next.boss.phase';
      this.stats.score += 150 * this.getComboMultiplier();
      return;
    }

    const idx = this.fallingRunes.findIndex(r => r.id === rune.id);
    if (idx !== -1) {
      this.fallingRunes.splice(idx, 1);
    }
    this.currentTargetId = null;
    this.activeCandidateIds = [];
    this.stats.wordsCleared++;
    this.stats.score += rune.points * this.getComboMultiplier();
  }

  public missRune(rune: FallingRune) {
    const idx = this.fallingRunes.findIndex(r => r.id === rune.id);
    if (idx !== -1) {
      this.fallingRunes.splice(idx, 1);
    }
    if (this.currentTargetId === rune.id) {
      this.currentTargetId = null;
    }
    this.activeCandidateIds = this.activeCandidateIds.filter(id => id !== rune.id);
    this.stats.comboStreak = 0;
    if (this.selectedMode === 'boss_survival') {
      this.stats.lives--;
      if (this.stats.lives <= 0) {
        this.stats.isPlaying = false;
        this.stats.isGameOver = true;
      }
    } else {
      this.stats.score = Math.max(this.stats.score - 30, 0);
    }
  }

  public saveScore() {
    const record: HighScoreRecord = {
      id: String(Date.now()),
      playerName: 'Midnight Dev',
      score: this.stats.score,
      wpm: this.stats.wpm,
      accuracy: this.stats.accuracy,
      mode: this.selectedMode,
      date: '2026-08-17',
      titleBadge: getTitleBadge(this.stats.score, this.stats.wpm),
    };
    this.highScores.push(record);
  }
}

describe('RuneTyperGameTest (F21_RUNE_TYPER)', () => {
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
  describe('[T1_F21] Core Game Loop & Typing Verification', () => {
    it('[T1_F21_01] Starting game initializes stats, timer and resets active runes with 5 lives', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');

      expect(game.stats.isPlaying).toBe(true);
      expect(game.stats.isGameOver).toBe(false);
      expect(game.stats.score).toBe(0);
      expect(game.stats.lives).toBe(5);
      expect(game.stats.timeRemaining).toBe(60);
      expect(game.fallingRunes.length).toBe(0);
    });

    it('[T1_F21_02] Typing matching first character targets the rune and advances typed length', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');
      const rune = game.spawnRune('git.commit');

      const matched = game.typeKey('g');
      expect(matched).toBe(true);
      expect(rune.typedLength).toBe(1);
      expect(game.currentTargetId).toBe(rune.id);
      expect(game.stats.correctKeystrokes).toBe(1);
      expect(game.stats.comboStreak).toBe(1);
    });

    it('[T1_F21_03] Multi-candidate prefix matching highlights all matching runes on first key', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');
      const rune1 = game.spawnRune('docker.build');
      const rune2 = game.spawnRune('deploy.prod');

      // Type 'd' -> matches both
      const matched = game.typeKey('d');
      expect(matched).toBe(true);
      expect(rune1.typedLength).toBe(1);
      expect(rune2.typedLength).toBe(1);
      expect(game.activeCandidateIds).toContain(rune1.id);
      expect(game.activeCandidateIds).toContain(rune2.id);
      expect(game.currentTargetId).toBe(null); // Not locked yet!

      // Type 'e' -> matches deploy.prod only!
      const matched2 = game.typeKey('e');
      expect(matched2).toBe(true);
      expect(rune2.typedLength).toBe(2);
      expect(rune1.typedLength).toBe(0); // reset docker.build
      expect(game.currentTargetId).toBe(rune2.id); // Locked on deploy!
      expect(game.activeCandidateIds.length).toBe(0);
    });

    it('[T1_F21_04] Typing wrong character breaks combo streak', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');
      game.spawnRune('laravel');

      game.typeKey('l');
      expect(game.stats.comboStreak).toBe(1);

      game.typeKey('z'); // Typo
      expect(game.stats.comboStreak).toBe(0);
      expect(game.stats.wrongKeystrokes).toBe(1);
    });

    it('[T1_F21_05] Fully typing a rune removes it from arena and awards points with combo multiplier', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');
      const rune = game.spawnRune('php');

      game.typeKey('p');
      game.typeKey('h');
      game.typeKey('p');

      expect(game.fallingRunes.length).toBe(0);
      expect(game.stats.wordsCleared).toBe(1);
      expect(game.stats.score).toBeGreaterThan(0);
      expect(game.currentTargetId).toBe(null);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F21] Boss Multi-Stage & Survival Lives', () => {
    it('[T2_F21_01] Boss Bug requires multiple word phases before being exorcised', () => {
      const game = new RuneTyperGameModel();
      game.startGame('boss_survival');
      const bossRune = game.spawnRune('memory.leak', true);

      expect(bossRune.isBoss).toBe(true);
      expect(bossRune.bossHp).toBe(3);

      // Phase 1
      for (const char of 'memory.leak') {
        game.typeKey(char);
      }
      expect(bossRune.bossHp).toBe(2);
      expect(game.fallingRunes.length).toBe(1); // Still alive!

      // Phase 2
      for (const char of 'next.boss.phase') {
        game.typeKey(char);
      }
      expect(bossRune.bossHp).toBe(1);
      expect(game.fallingRunes.length).toBe(1);

      // Phase 3 (Final Blow)
      for (const char of 'next.boss.phase') {
        game.typeKey(char);
      }
      expect(game.fallingRunes.length).toBe(0); // Exorcised!
      expect(game.stats.wordsCleared).toBe(1);
    });

    it('[T2_F21_02] Missing 5 runes in boss survival mode ends the game with 5 lives', () => {
      const game = new RuneTyperGameModel();
      game.startGame('boss_survival');
      expect(game.stats.lives).toBe(5);

      for (let i = 0; i < 5; i++) {
        const rune = game.spawnRune('bug' + i);
        game.missRune(rune);
      }

      expect(game.stats.lives).toBe(0);
      expect(game.stats.isGameOver).toBe(true);
      expect(game.stats.isPlaying).toBe(false);
    });
  });

  // ==========================================================================
  // TIER 3 & TIER 4: Leaderboard & Score Persistence
  // ==========================================================================
  describe('[T4_F21] High Scores and Titles', () => {
    it('[T4_F21_01] High score calculation awards Master Exorcist for score >= 3000 and wpm >= 70', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');
      game.stats.score = 3600;
      game.stats.wpm = 85;

      game.saveScore();
      expect(game.highScores.length).toBe(1);
      expect(game.highScores[0].titleBadge).toContain('Thần Phím Nửa Đêm');
    });

    it('[T4_F21_02] Apprentice badge is awarded for entry-level score', () => {
      const game = new RuneTyperGameModel();
      game.startGame('beginner');
      game.stats.score = 250;
      game.stats.wpm = 25;

      game.saveScore();
      expect(game.highScores[0].titleBadge).toContain('Tập Sự Trừ Tà');
    });

    it('[T4_F21_03] Combo multiplier scales x2 at 5, x3 at 10, x5 at 20', () => {
      const game = new RuneTyperGameModel();
      game.startGame('normal');

      game.stats.comboStreak = 4;
      expect(game.getComboMultiplier()).toBe(1);

      game.stats.comboStreak = 5;
      expect(game.getComboMultiplier()).toBe(2);

      game.stats.comboStreak = 10;
      expect(game.getComboMultiplier()).toBe(3);

      game.stats.comboStreak = 20;
      expect(game.getComboMultiplier()).toBe(5);
    });
  });
});
