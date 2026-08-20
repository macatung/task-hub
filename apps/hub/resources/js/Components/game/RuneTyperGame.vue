<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { GameMode, FallingRune, GameStats, HighScoreRecord, Particle } from '@/types/game';
import { beginnerSpells, normalSpells, bossSpells } from '@/data/spellsData';
import { gameAudio } from '@/audio/gameAudio';
import { sound } from '@/audio/soundEffects';
import MiniMascotLogo from '@/Components/mascot/MiniMascotLogo.vue';
import MacatungMascot from '@/Components/mascot/MacatungMascot.vue';
import Icons from '@/Components/ui/Icons.vue';

// Game Configuration & State
const selectedMode = ref<GameMode>('beginner');
const currentTargetId = ref<string | null>(null);
const activeCandidateIds = ref<string[]>([]);
const fallingRunes = ref<FallingRune[]>([]);
const isFullscreen = ref(false);
const isMuted = ref(false);
const showLeaderboard = ref(false);
const hiddenInputRef = ref<HTMLInputElement | null>(null);
const particleCanvasRef = ref<HTMLCanvasElement | null>(null);
const mascotReaction = ref<'idle' | 'hop' | 'cast' | 'hurt'>('idle');
const mascotHopCount = ref(0);

const stats = reactive<GameStats>({
  score: 0,
  wpm: 0,
  accuracy: 100,
  wordsCleared: 0,
  totalKeystrokes: 0,
  correctKeystrokes: 0,
  wrongKeystrokes: 0,
  comboStreak: 0,
  maxComboStreak: 0,
  lives: 5,
  timeRemaining: 30,
  isGameOver: false,
  isPlaying: false,
  isPaused: false,
});

let timerIntervalId: any = null;
let gameLoopId: any = null;
let lastRuneSpawnTime = 0;
let gameStartTime = 0;
let particles: Particle[] = [];

// High Scores Local Storage
const highScores = ref<HighScoreRecord[]>([]);

const loadHighScores = () => {
  try {
    const raw = localStorage.getItem('macatung_rune_typer_scores');
    if (raw) {
      highScores.value = JSON.parse(raw);
    }
  } catch {}
};

const comboMultiplier = computed(() => {
  if (stats.comboStreak >= 20) return 5;
  if (stats.comboStreak >= 15) return 4;
  if (stats.comboStreak >= 10) return 3;
  if (stats.comboStreak >= 5) return 2;
  return 1;
});

const titleBadgeEarned = computed(() => {
  if (stats.score >= 3500) return '🧙‍♂️ Thần Phím Đại Tông Sư (Master Exorcist)';
  if (stats.score >= 2000) return '⚡ Pháp Sư Trảm Bug (Bug Slayer)';
  if (stats.score >= 1000) return '🌙 Đạo Sĩ Luyện Code (Rune Coder)';
  return '🌱 Tập Sự 0 Bug (Apprentice)';
});

const saveCurrentScore = () => {
  const newRecord: HighScoreRecord = {
    id: String(Date.now()),
    playerName: 'Midnight Dev',
    score: stats.score,
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    mode: selectedMode.value,
    date: new Date().toISOString().split('T')[0],
    titleBadge: titleBadgeEarned.value,
  };
  highScores.value = [newRecord, ...highScores.value].sort((a, b) => b.score - a.score).slice(0, 10);
  try {
    localStorage.setItem('macatung_rune_typer_scores', JSON.stringify(highScores.value));
  } catch {}
};

// Spawn Falling Rune (Relaxed & Slower Speed Tuning)
const spawnRune = () => {
  let wordPool = selectedMode.value === 'beginner' ? beginnerSpells : normalSpells;
  let word = wordPool[Math.floor(Math.random() * wordPool.length)];

  // If in boss survival mode, occasional boss spawn
  let isBoss = false;
  let bossHp = 1;
  let bossMaxHp = 1;

  if (selectedMode.value === 'boss_survival' && Math.random() < 0.15 && !fallingRunes.value.some(r => r.isBoss)) {
    const boss = bossSpells[Math.floor(Math.random() * bossSpells.length)];
    word = boss.spells[0];
    isBoss = true;
    bossHp = boss.hp;
    bossMaxHp = boss.hp;
  }

  // Prevent exact duplicate words on screen
  if (fallingRunes.value.some(r => r.word.toLowerCase() === word.toLowerCase())) {
    return;
  }

  const colors = [
    { color: '#00f5a0', glow: 'rgba(0, 245, 160, 0.4)' }, // mint
    { color: '#00d2ff', glow: 'rgba(0, 210, 255, 0.4)' }, // cyan
    { color: '#ffd166', glow: 'rgba(255, 209, 102, 0.4)' }, // talisman gold
    { color: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)' }, // purple
  ];
  const chosenColor = isBoss
    ? { color: '#ff4d6d', glow: 'rgba(255, 77, 109, 0.6)' }
    : colors[Math.floor(Math.random() * colors.length)];

  // Relaxed ~40% slower fall speed for maximum playability
  let speed = selectedMode.value === 'beginner' ? 3.6 : selectedMode.value === 'normal' ? 5.5 : 6.8;
  if (isBoss) speed = 3.2;

  const newRune: FallingRune = {
    id: Math.random().toString(36).substring(2, 9),
    word,
    typedLength: 0,
    x: Math.floor(Math.random() * 60) + 5, // 5% to 65% width
    y: 0,
    speed,
    category: isBoss ? 'boss' : 'spell',
    points: word.length * 10 * (isBoss ? 5 : 1),
    isBoss,
    bossHp,
    bossMaxHp,
    colorHex: chosenColor.color,
    glowHex: chosenColor.glow,
  };

  fallingRunes.value.push(newRune);
};

// Particles Burst
const spawnBurst = (xPercent: number, yPercent: number, color: string) => {
  if (!particleCanvasRef.value) return;
  const canvas = particleCanvasRef.value;
  const pixelX = (xPercent / 100) * canvas.width;
  const pixelY = (yPercent / 100) * canvas.height;

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    particles.push({
      x: pixelX,
      y: pixelY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 3 + 1.5,
      color,
      alpha: 1,
      life: 0,
      maxLife: 25 + Math.random() * 15,
    });
  }
};

// Start / Restart Game
const startGame = (mode: GameMode = selectedMode.value) => {
  selectedMode.value = mode;
  stats.score = 0;
  stats.wordsCleared = 0;
  stats.totalKeystrokes = 0;
  stats.correctKeystrokes = 0;
  stats.wrongKeystrokes = 0;
  stats.comboStreak = 0;
  stats.maxComboStreak = 0;
  stats.wpm = 0;
  stats.accuracy = 100;
  stats.lives = 5; // 5 Lives for relaxed survival mode
  stats.timeRemaining = mode === 'beginner' ? 30 : mode === 'normal' ? 60 : 999;
  stats.isGameOver = false;
  stats.isPlaying = true;
  stats.isPaused = false;
  fallingRunes.value = [];
  currentTargetId.value = null;
  activeCandidateIds.value = [];
  particles = [];
  gameStartTime = Date.now();
  lastRuneSpawnTime = Date.now();

  sound.playTalisman();
  focusInput();

  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(gameTimerTick, 1000);

  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = requestAnimationFrame(gameLoop);
};

const pauseGame = () => {
  stats.isPaused = !stats.isPaused;
  sound.playClick();
};

const endGame = () => {
  stats.isPlaying = false;
  stats.isGameOver = true;
  currentTargetId.value = null;
  activeCandidateIds.value = [];
  if (timerIntervalId) clearInterval(timerIntervalId);
  if (gameLoopId) cancelAnimationFrame(gameLoopId);

  gameAudio.playGameOver();
  saveCurrentScore();
};

// Timer Tick
const gameTimerTick = () => {
  if (!stats.isPlaying || stats.isPaused) return;

  if (selectedMode.value !== 'boss_survival') {
    stats.timeRemaining--;
    if (stats.timeRemaining <= 0) {
      endGame();
    }
  }

  // Update real-time WPM
  const elapsedMinutes = Math.max((Date.now() - gameStartTime) / 60000, 0.1);
  stats.wpm = Math.round((stats.correctKeystrokes / 5) / elapsedMinutes);
};

// Main Game Loop (Canvas & Movement with Relaxed Spawn Interval)
const gameLoop = () => {
  if (stats.isPlaying && !stats.isPaused) {
    const now = Date.now();

    // Spawn Runes with Relaxed Spacing
    const spawnInterval = selectedMode.value === 'beginner' ? 2800 : selectedMode.value === 'normal' ? 2200 : 1800;
    if (now - lastRuneSpawnTime > spawnInterval && fallingRunes.value.length < 6) {
      spawnRune();
      lastRuneSpawnTime = now;
    }

    // Move Runes Downward
    const dt = 0.016; // ~60fps
    for (let i = fallingRunes.value.length - 1; i >= 0; i--) {
      const rune = fallingRunes.value[i];
      rune.y += rune.speed * dt;

      // Check Bottom Collision (Missed Rune)
      if (rune.y >= 88) {
        handleMissedRune(rune, i);
      }
    }

    // Render Particles
    renderParticles();
  }

  if (stats.isPlaying) {
    gameLoopId = requestAnimationFrame(gameLoop);
  }
};

const handleMissedRune = (rune: FallingRune, index: number) => {
  fallingRunes.value.splice(index, 1);
  if (currentTargetId.value === rune.id) {
    currentTargetId.value = null;
  }
  activeCandidateIds.value = activeCandidateIds.value.filter(id => id !== rune.id);

  stats.comboStreak = 0;
  mascotReaction.value = 'hurt';
  setTimeout(() => { mascotReaction.value = 'idle'; }, 400);
  gameAudio.playHurt();

  if (selectedMode.value === 'boss_survival') {
    stats.lives--;
    if (stats.lives <= 0) {
      endGame();
    }
  } else {
    stats.score = Math.max(stats.score - 30, 0);
  }
};

/**
 * Prefix Disambiguation Typing Engine:
 * 1. If key matches multiple runes, highlight all candidates.
 * 2. On subsequent keys, filter candidates. Lock target when only 1 candidate matches prefix.
 * 3. Supports Backspace / Escape to undo or cancel target.
 */
const handleTypingKey = (key: string) => {
  if (!stats.isPlaying || stats.isPaused || stats.isGameOver) return;

  if (key === 'Escape') {
    // Reset all candidate runes typedLength
    fallingRunes.value.forEach(r => { r.typedLength = 0; });
    activeCandidateIds.value = [];
    currentTargetId.value = null;
    return;
  }

  if (key === 'Backspace') {
    if (currentTargetId.value) {
      const target = fallingRunes.value.find(r => r.id === currentTargetId.value);
      if (target && target.typedLength > 0) {
        target.typedLength--;
        if (target.typedLength === 0) {
          currentTargetId.value = null;
          activeCandidateIds.value = [];
        }
      }
    } else if (activeCandidateIds.value.length > 0) {
      fallingRunes.value.forEach(r => {
        if (activeCandidateIds.value.includes(r.id) && r.typedLength > 0) {
          r.typedLength--;
        }
      });
      activeCandidateIds.value = [];
    }
    return;
  }

  if (key.length !== 1) return; // Process printable single characters

  stats.totalKeystrokes++;
  let matched = false;

  // 1. If currently locked onto a single target rune
  if (currentTargetId.value) {
    const target = fallingRunes.value.find(r => r.id === currentTargetId.value);
    if (target) {
      const expectedChar = target.word[target.typedLength];
      if (expectedChar && expectedChar.toLowerCase() === key.toLowerCase()) {
        target.typedLength++;
        matched = true;
        stats.correctKeystrokes++;
        stats.comboStreak++;
        if (stats.comboStreak > stats.maxComboStreak) {
          stats.maxComboStreak = stats.comboStreak;
        }

        mascotHopCount.value++;
        mascotReaction.value = 'hop';
        setTimeout(() => { mascotReaction.value = 'idle'; }, 200);

        gameAudio.playKeypress(true);

        if (target.typedLength >= target.word.length) {
          handleRuneCompleted(target);
          currentTargetId.value = null;
          activeCandidateIds.value = [];
        }
      } else {
        stats.wrongKeystrokes++;
        stats.comboStreak = 0;
        mascotReaction.value = 'hurt';
        setTimeout(() => { mascotReaction.value = 'idle'; }, 200);
        gameAudio.playKeypress(false);
      }
      stats.accuracy = Math.round((stats.correctKeystrokes / Math.max(stats.totalKeystrokes, 1)) * 100);
      return;
    } else {
      currentTargetId.value = null;
    }
  }

  // 2. If multiple candidates are currently active
  if (activeCandidateIds.value.length > 0) {
    const candidates = fallingRunes.value.filter(r => activeCandidateIds.value.includes(r.id));
    const matchingNext: FallingRune[] = [];

    for (const rune of candidates) {
      const expectedChar = rune.word[rune.typedLength];
      if (expectedChar && expectedChar.toLowerCase() === key.toLowerCase()) {
        rune.typedLength++;
        matchingNext.push(rune);
      } else {
        // Did not match next char -> reset this candidate
        rune.typedLength = 0;
      }
    }

    if (matchingNext.length > 0) {
      matched = true;
      stats.correctKeystrokes++;
      stats.comboStreak++;
      if (stats.comboStreak > stats.maxComboStreak) {
        stats.maxComboStreak = stats.comboStreak;
      }

      mascotHopCount.value++;
      mascotReaction.value = 'hop';
      setTimeout(() => { mascotReaction.value = 'idle'; }, 200);
      gameAudio.playKeypress(true);

      if (matchingNext.length === 1) {
        // Exactly 1 rune matched -> LOCK TARGET!
        const locked = matchingNext[0];
        currentTargetId.value = locked.id;
        activeCandidateIds.value = [];

        if (locked.typedLength >= locked.word.length) {
          handleRuneCompleted(locked);
          currentTargetId.value = null;
        }
      } else {
        // Still multiple candidates matching prefix
        activeCandidateIds.value = matchingNext.map(r => r.id);
      }
    } else {
      // None matched next char
      stats.wrongKeystrokes++;
      stats.comboStreak = 0;
      mascotReaction.value = 'hurt';
      setTimeout(() => { mascotReaction.value = 'idle'; }, 200);
      gameAudio.playKeypress(false);
    }

    stats.accuracy = Math.round((stats.correctKeystrokes / Math.max(stats.totalKeystrokes, 1)) * 100);
    return;
  }

  // 3. No target and no active candidates: Match all runes starting with this key
  const initialMatches = fallingRunes.value.filter(r => {
    return r.word.length > 0 && r.word[0].toLowerCase() === key.toLowerCase();
  });

  if (initialMatches.length > 0) {
    matched = true;
    stats.correctKeystrokes++;
    stats.comboStreak++;
    if (stats.comboStreak > stats.maxComboStreak) {
      stats.maxComboStreak = stats.comboStreak;
    }

    mascotHopCount.value++;
    mascotReaction.value = 'hop';
    setTimeout(() => { mascotReaction.value = 'idle'; }, 200);
    gameAudio.playKeypress(true);

    if (initialMatches.length === 1) {
      // Exactly 1 rune matched initial character -> Lock target immediately
      const target = initialMatches[0];
      target.typedLength = 1;
      currentTargetId.value = target.id;
      activeCandidateIds.value = [];

      if (target.typedLength >= target.word.length) {
        handleRuneCompleted(target);
        currentTargetId.value = null;
      }
    } else {
      // Multiple runes match initial character -> Highlight all & track candidates
      initialMatches.forEach(r => { r.typedLength = 1; });
      activeCandidateIds.value = initialMatches.map(r => r.id);
    }
  } else {
    // No rune starts with this key
    stats.wrongKeystrokes++;
    stats.comboStreak = 0;
    mascotReaction.value = 'hurt';
    setTimeout(() => { mascotReaction.value = 'idle'; }, 200);
    gameAudio.playKeypress(false);
  }

  // Recalculate Accuracy
  stats.accuracy = Math.round((stats.correctKeystrokes / Math.max(stats.totalKeystrokes, 1)) * 100);
};

// When a Rune Word is completely typed
const handleRuneCompleted = (rune: FallingRune) => {
  // If it's a boss with more HP, advance boss spell
  if (rune.isBoss && rune.bossHp && rune.bossHp > 1) {
    rune.bossHp--;
    rune.typedLength = 0;
    const bossObj = bossSpells.find(b => b.name.includes(rune.word) || b.spells.includes(rune.word));
    if (bossObj) {
      const nextSpellIdx = bossObj.hp - rune.bossHp;
      rune.word = bossObj.spells[nextSpellIdx] || 'purge.corrupted.nodes';
    }
    stats.score += 150 * comboMultiplier.value;
    spawnBurst(rune.x + 10, rune.y, '#ff4d6d');
    gameAudio.playSpellCleared(true);
    return;
  }

  // Remove rune
  const idx = fallingRunes.value.findIndex(r => r.id === rune.id);
  if (idx !== -1) {
    fallingRunes.value.splice(idx, 1);
  }
  currentTargetId.value = null;
  activeCandidateIds.value = activeCandidateIds.value.filter(id => id !== rune.id);

  stats.wordsCleared++;
  stats.score += rune.points * comboMultiplier.value;

  // Mascot Cast Animation
  mascotReaction.value = 'cast';
  setTimeout(() => { mascotReaction.value = 'idle'; }, 300);

  // Particles & Audio
  spawnBurst(rune.x + 10, rune.y, rune.colorHex);
  gameAudio.playSpellCleared(rune.isBoss);

  // Combo Sound Chime
  if (stats.comboStreak % 5 === 0) {
    gameAudio.playComboPowerup(comboMultiplier.value);
  }
};

// Render Particle Effects on Canvas
const renderParticles = () => {
  if (!particleCanvasRef.value) return;
  const canvas = particleCanvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life++;
    p.alpha = Math.max(1 - p.life / p.maxLife, 0);

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
    }
  }
};

const focusInput = () => {
  nextTick(() => {
    hiddenInputRef.value?.focus();
  });
};

const handleWindowKeyDown = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement && e.target !== hiddenInputRef.value) return;
  if (e.target instanceof HTMLTextAreaElement) return;

  if (stats.isPlaying) {
    if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Escape' || e.key.length === 1) {
      e.preventDefault();
      handleTypingKey(e.key);
    }
  }
};

const toggleAudio = () => {
  isMuted.value = !isMuted.value;
  sound.playClick();
};

const toggleFullscreenMode = () => {
  isFullscreen.value = !isFullscreen.value;
  sound.playClick();
};

onMounted(() => {
  loadHighScores();
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleWindowKeyDown);
  }
  if (particleCanvasRef.value) {
    particleCanvasRef.value.width = particleCanvasRef.value.offsetWidth;
    particleCanvasRef.value.height = particleCanvasRef.value.offsetHeight;
  }
});

onUnmounted(() => {
  if (timerIntervalId) clearInterval(timerIntervalId);
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleWindowKeyDown);
  }
});
</script>

<template>
  <section
    id="game"
    class="scroll-mt-24 w-full py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none"
    :class="{ 'fixed inset-0 z-50 p-0 max-w-none bg-midnight-950': isFullscreen }"
    @click="focusInput"
  >
    <!-- Hidden input for mobile virtual keyboard focus -->
    <input
      ref="hiddenInputRef"
      type="text"
      class="opacity-0 absolute -top-96 left-0 pointer-events-none"
      autocapitalize="none"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
    />

    <!-- Header Section (Only shown when not fullscreen) -->
    <div v-if="!isFullscreen" class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 text-left">
      <div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-phantom-mint/10 border border-phantom-mint/30 text-phantom-mint text-xs font-mono mb-3 shadow-glow-mint">
          🎮 Cyber Goth Arcade
        </span>
        <h2 class="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight">
          Ma Cà Tưng: <span class="text-transparent bg-clip-text bg-gradient-to-r from-talisman-gold via-phantom-mint to-phantom-cyan">Rune Typer</span>
        </h2>
        <p class="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl font-sans">
          Gõ code thần chú rơi từ bầu trời đêm để trấn yểm Bug và rèn luyện phản xạ bàn phím cơ.
        </p>
      </div>

      <!-- Mode Selector Pills -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border select-none cursor-pointer flex items-center gap-1.5"
          :class="selectedMode === 'beginner'
            ? 'bg-phantom-mint text-midnight-950 border-phantom-mint shadow-glow-mint'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          :disabled="stats.isPlaying"
          @click="selectedMode = 'beginner'"
        >
          <span>🟢</span>
          <span>Tập Sự 0 Bug (30s)</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border select-none cursor-pointer flex items-center gap-1.5"
          :class="selectedMode === 'normal'
            ? 'bg-talisman-gold text-midnight-950 border-talisman-gold shadow-glow-talisman'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          :disabled="stats.isPlaying"
          @click="selectedMode = 'normal'"
        >
          <span>🟡</span>
          <span>Ma Đạo 00:00 AM (60s)</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border select-none cursor-pointer flex items-center gap-1.5"
          :class="selectedMode === 'boss_survival'
            ? 'bg-rose-500 text-white border-rose-500 shadow-glow-talisman'
            : 'bg-midnight-900/80 text-slate-400 border-white/5 hover:border-white/20 hover:text-white'"
          :disabled="stats.isPlaying"
          @click="selectedMode = 'boss_survival'"
        >
          <span>🔴</span>
          <span>Sinh Tồn Boss Bug (5 ❤️)</span>
        </button>
      </div>
    </div>

    <!-- Main Arcade Cabinet Container -->
    <div
      class="glass-panel rounded-3xl border border-white/15 overflow-hidden shadow-2xl relative flex flex-col bg-midnight-950/90"
      :class="isFullscreen ? 'h-screen rounded-none border-none' : 'h-[580px] sm:h-[620px]'"
    >
      <!-- Top HUD Status Bar -->
      <div class="px-5 py-3.5 bg-midnight-900/90 border-b border-white/10 flex items-center justify-between gap-4 z-30 shrink-0">
        <!-- Score & Multiplier -->
        <div class="flex items-center gap-4 sm:gap-6 text-left">
          <div>
            <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Điểm Số</div>
            <div class="text-lg sm:text-xl font-display font-extrabold text-talisman-gold flex items-center gap-1.5">
              <span>{{ stats.score.toLocaleString() }}</span>
              <span
                v-if="comboMultiplier > 1"
                class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse font-mono"
              >
                x{{ comboMultiplier }}
              </span>
            </div>
          </div>

          <!-- Timer / Lives -->
          <div>
            <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              {{ selectedMode === 'boss_survival' ? 'Mạng Sống' : 'Thời Gian' }}
            </div>
            <div class="text-base sm:text-lg font-mono font-bold text-phantom-mint">
              <span v-if="selectedMode === 'boss_survival'">
                {{ '❤️'.repeat(Math.max(stats.lives, 0)) }}
              </span>
              <span v-else>{{ stats.timeRemaining }}s</span>
            </div>
          </div>

          <!-- WPM & Accuracy -->
          <div class="hidden sm:block">
            <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Tốc Độ</div>
            <div class="text-base font-mono font-bold text-slate-200">{{ stats.wpm }} WPM</div>
          </div>

          <div class="hidden sm:block">
            <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Chính Xác</div>
            <div class="text-base font-mono font-bold text-phantom-cyan">{{ stats.accuracy }}%</div>
          </div>
        </div>

        <!-- Right Controls -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-white/30 text-slate-300 hover:text-white transition-all text-xs min-h-[38px] flex items-center gap-1.5 cursor-pointer"
            @click="showLeaderboard = true"
          >
            <span>🏆</span>
            <span class="hidden sm:inline">Kỷ Lục</span>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-white/30 text-slate-300 hover:text-white transition-all text-xs min-h-[38px] cursor-pointer"
            :title="isMuted ? 'Bật Âm Thanh' : 'Tắt Âm Thanh'"
            @click="toggleAudio"
          >
            <span>{{ isMuted ? '🔇' : '🔊' }}</span>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl bg-midnight-900 border border-white/10 hover:border-white/30 text-slate-300 hover:text-white transition-all text-xs min-h-[38px] cursor-pointer"
            title="Toàn Màn Hình"
            @click="toggleFullscreenMode"
          >
            <span>⛶</span>
          </button>

          <button
            v-if="stats.isPlaying"
            type="button"
            class="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition-all min-h-[38px] cursor-pointer"
            @click="pauseGame"
          >
            {{ stats.isPaused ? '▶ Tiếp Tục' : '⏸ Tạm Dừng' }}
          </button>
        </div>
      </div>

      <!-- Main Game Arena Viewport -->
      <div class="flex-1 relative overflow-hidden bg-midnight-950/60 select-none">
        <!-- Scanlines Subtle Overlay -->
        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-phantom-mint/[0.02] to-transparent pointer-events-none" />

        <!-- Particle Canvas Overlay -->
        <canvas
          ref="particleCanvasRef"
          class="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        <!-- Idle Start Screen Overlay (Pure Vector Transparent Mascot) -->
        <div
          v-if="!stats.isPlaying && !stats.isGameOver"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-midnight-950/70 backdrop-blur-sm"
        >
          <!-- Dynamic Floating Transparent Vector Mascot without box wrapper -->
          <div class="relative mb-2 flex flex-col items-center select-none pointer-events-none">
            <div class="w-36 h-36 flex items-center justify-center animate-bounce-subtle">
              <MacatungMascot size="sm" :show-controls="false" />
            </div>
            <!-- Glowing Foot Aura -->
            <div class="w-28 h-4 bg-phantom-mint/25 rounded-full blur-md -mt-2 shadow-glow-mint" />
          </div>

          <h3 class="text-2xl sm:text-3xl font-display font-extrabold text-white mb-2">
            Rune Typer: Niệm Chú Trừ Tà
          </h3>
          <p class="text-sm text-slate-300 max-w-md mb-6 font-sans">
            Gõ phím theo các dòng code thần chú bay xuống từ bầu trời đêm để diệt Bug và tích lũy điểm kinh nghiệm.
          </p>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              class="px-8 py-3.5 rounded-2xl bg-phantom-mint text-midnight-950 font-display font-bold text-sm sm:text-base hover:brightness-110 shadow-glow-mint transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              @click="startGame(selectedMode)"
            >
              <span>Vào Chơi Ngay (Start)</span>
              <span>⚡</span>
            </button>
          </div>
          <p class="text-xs font-mono text-slate-500 mt-4">Nhấn phím bất kỳ hoặc click để bắt đầu gõ</p>
        </div>

        <!-- Pause Screen Overlay -->
        <div
          v-if="stats.isPaused"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-midnight-950/80 backdrop-blur-md"
        >
          <h3 class="text-2xl font-display font-bold text-talisman-gold mb-2">⏸ Đang Tạm Dừng</h3>
          <p class="text-xs font-mono text-slate-400 mb-6">Nghỉ tay uống ngụm cà phê Robusta</p>
          <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-phantom-mint text-midnight-950 font-display font-bold text-sm hover:brightness-110 shadow-glow-mint transition-all cursor-pointer"
            @click="pauseGame"
          >
            Tiếp Tục [ESC]
          </button>
        </div>

        <!-- Game Over / Victory Screen -->
        <div
          v-if="stats.isGameOver"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-midnight-950/90 backdrop-blur-md"
        >
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-talisman-gold/10 text-talisman-gold border border-talisman-gold/30 text-xs font-mono mb-3 font-bold">
            {{ titleBadgeEarned }}
          </div>
          <h3 class="text-3xl sm:text-4xl font-display font-extrabold text-white mb-2">
            Kết Thúc Phiên Trừ Tà!
          </h3>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 max-w-lg w-full">
            <div class="p-3 rounded-xl bg-midnight-900 border border-white/10">
              <div class="text-[10px] font-mono text-slate-400">Tổng Điểm</div>
              <div class="text-lg sm:text-xl font-bold text-talisman-gold">{{ stats.score.toLocaleString() }}</div>
            </div>
            <div class="p-3 rounded-xl bg-midnight-900 border border-white/10">
              <div class="text-[10px] font-mono text-slate-400">Tốc Độ Gõ</div>
              <div class="text-lg sm:text-xl font-bold text-phantom-mint">{{ stats.wpm }} WPM</div>
            </div>
            <div class="p-3 rounded-xl bg-midnight-900 border border-white/10">
              <div class="text-[10px] font-mono text-slate-400">Chính Xác</div>
              <div class="text-lg sm:text-xl font-bold text-phantom-cyan">{{ stats.accuracy }}%</div>
            </div>
            <div class="p-3 rounded-xl bg-midnight-900 border border-white/10">
              <div class="text-[10px] font-mono text-slate-400">Max Combo</div>
              <div class="text-lg sm:text-xl font-bold text-amber-400">x{{ stats.maxComboStreak }}</div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              class="px-6 py-3 rounded-xl bg-phantom-mint text-midnight-950 font-display font-bold text-sm hover:brightness-110 shadow-glow-mint transition-all cursor-pointer"
              @click="startGame(selectedMode)"
            >
              Chơi Lại 🔄
            </button>
            <button
              type="button"
              class="px-4 py-3 rounded-xl bg-midnight-900 border border-white/10 hover:border-white/30 text-white font-mono text-xs transition-all cursor-pointer"
              @click="showLeaderboard = true"
            >
              Xem Kỷ Lục 🏆
            </button>
          </div>
        </div>

        <!-- Falling Runes Elements (with Prefix Matching Highlighting) -->
        <div
          v-for="rune in fallingRunes"
          :key="rune.id"
          class="absolute transition-transform font-mono text-xs sm:text-sm px-3 py-1.5 rounded-xl border backdrop-blur-md flex flex-col items-center select-none z-20"
          :class="[
            rune.isBoss
              ? 'bg-rose-950/90 border-rose-500/60 shadow-lg shadow-rose-500/30'
              : currentTargetId === rune.id
                ? 'bg-midnight-900/95 border-phantom-mint shadow-glow-mint ring-2 ring-phantom-mint/40 scale-105'
                : activeCandidateIds.includes(rune.id)
                  ? 'bg-midnight-900/90 border-talisman-gold shadow-glow-talisman ring-1 ring-talisman-gold/40'
                  : 'bg-midnight-900/80 border-white/15 shadow-md'
          ]"
          :style="{
            left: `${rune.x}%`,
            top: `${rune.y}%`,
            borderColor: currentTargetId === rune.id ? '#00f5a0' : activeCandidateIds.includes(rune.id) ? '#ffd166' : rune.colorHex,
          }"
        >
          <!-- Boss HP Bar -->
          <div v-if="rune.isBoss && rune.bossMaxHp" class="w-full h-1.5 bg-black/50 rounded-full mb-1 overflow-hidden border border-white/10">
            <div
              class="h-full bg-rose-500 transition-all duration-200"
              :style="{ width: `${((rune.bossHp || 1) / rune.bossMaxHp) * 100}%` }"
            />
          </div>

          <!-- Word Spell with Typed Prefix Highlighted -->
          <div class="flex items-center font-bold tracking-wide">
            <span class="text-phantom-mint bg-phantom-mint/20 px-0.5 rounded">{{ rune.word.slice(0, rune.typedLength) }}</span>
            <span class="text-slate-100">{{ rune.word.slice(rune.typedLength) }}</span>
          </div>

          <span v-if="rune.isBoss" class="text-[9px] font-mono text-rose-400 mt-0.5 uppercase tracking-widest">
            👹 BOSS BUG
          </span>
        </div>

        <!-- Mascot Companion Sidekick Booth (Bottom-Right Corner, completely clear of central words) -->
        <div class="absolute bottom-5 right-6 flex flex-col items-center pointer-events-none z-30 select-none">
          <!-- Dynamic Reaction Speech Pill -->
          <div
            class="mb-2 px-3 py-1 rounded-xl bg-midnight-900/95 border border-white/20 text-[11px] font-mono shadow-lg transition-all duration-150 flex items-center gap-1.5"
            :class="{
              'border-phantom-mint text-phantom-mint shadow-glow-mint scale-105': mascotReaction === 'hop',
              'border-talisman-gold text-talisman-gold shadow-glow-talisman scale-110': mascotReaction === 'cast',
              'border-rose-500 text-rose-400 scale-95': mascotReaction === 'hurt',
              'text-slate-400 opacity-70': mascotReaction === 'idle'
            }"
          >
            <span v-if="mascotReaction === 'hop'">⚡ Hop!</span>
            <span v-else-if="mascotReaction === 'cast'">✨ Trảm Bug!</span>
            <span v-else-if="mascotReaction === 'hurt'">💦 Miss!</span>
            <span v-else>🌙 Ready</span>
          </div>

          <!-- Compact Mascot Badge -->
          <div
            class="w-14 h-14 rounded-2xl bg-midnight-900/90 border border-white/15 p-1 flex items-center justify-center transition-all duration-150 shadow-xl"
            :class="{
              '-translate-y-2.5 scale-110 border-phantom-mint shadow-glow-mint': mascotReaction === 'hop',
              'scale-120 rotate-6 border-talisman-gold shadow-glow-talisman': mascotReaction === 'cast',
              'translate-y-1 -rotate-6 opacity-60 border-rose-500': mascotReaction === 'hurt',
            }"
          >
            <MiniMascotLogo size="lg" :animated="true" />
          </div>
          <div class="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-widest">Sidekick</div>
        </div>
      </div>
    </div>

    <!-- Leaderboard Modal -->
    <div
      v-if="showLeaderboard"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      @click.self="showLeaderboard = false"
    >
      <div class="w-full max-w-lg rounded-3xl bg-midnight-900 border border-white/15 p-6 sm:p-8 text-left shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🏆</span>
            <h3 class="text-xl font-display font-extrabold text-white">Bảng Phong Thần Rune Typer</h3>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/80 text-white flex items-center justify-center text-xs cursor-pointer"
            @click="showLeaderboard = false"
          >
            ✕
          </button>
        </div>

        <div v-if="highScores.length === 0" class="text-center py-8 text-slate-400 text-xs font-mono">
          Chưa có kỷ lục nào. Hãy là người đầu tiên ghi danh!
        </div>

        <div v-else class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          <div
            v-for="(rec, i) in highScores"
            :key="rec.id"
            class="p-3 rounded-2xl bg-midnight-950 border border-white/5 flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold"
                :class="i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-slate-400'"
              >
                {{ i + 1 }}
              </span>
              <div>
                <div class="font-display font-bold text-white">{{ rec.titleBadge }}</div>
                <div class="text-[10px] font-mono text-slate-400">{{ rec.date }} · Mode: {{ rec.mode }}</div>
              </div>
            </div>

            <div class="text-right">
              <div class="font-mono font-bold text-talisman-gold">{{ rec.score.toLocaleString() }} pts</div>
              <div class="text-[10px] font-mono text-phantom-mint">{{ rec.wpm }} WPM ({{ rec.accuracy }}%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
