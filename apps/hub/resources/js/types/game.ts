export type GameMode = 'beginner' | 'normal' | 'boss_survival';

export interface FallingRune {
  id: string;
  word: string;
  typedLength: number;
  x: number; // 0% - 85% width
  y: number; // 0% - 100% height
  speed: number; // percentage per second
  category: 'keyword' | 'function' | 'spell' | 'boss';
  points: number;
  isBoss?: boolean;
  bossHp?: number;
  bossMaxHp?: number;
  colorHex: string;
  glowHex: string;
}

export interface GameStats {
  score: number;
  wordsCleared: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  comboStreak: number;
  maxComboStreak: number;
  wpm: number;
  accuracy: number;
  lives: number;
  timeRemaining: number;
  isGameOver: boolean;
  isPlaying: boolean;
  isPaused: boolean;
}

export interface HighScoreRecord {
  id: string;
  playerName: string;
  score: number;
  wpm: number;
  accuracy: number;
  mode: GameMode;
  date: string;
  titleBadge: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}
