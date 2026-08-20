/**
 * Test Suite: Talisman & Firefly Particles 2D Canvas Loop (F09)
 * Tier 1: Feature Coverage (Isolation)
 * Tier 2: Boundary & Corner Cases
 */

import { describe, it, expect, beforeEach, afterEach } from '../Harness/index.js';
import { setupTestEnvironment, MockCanvasRenderingContext2D } from '../Harness/mock_helpers.js';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'talisman' | 'firefly' | 'ember';
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  runeText?: string;
}

export class TalismanParticleEngine {
  public canvas: any;
  public ctx: MockCanvasRenderingContext2D | null = null;
  public particles: Particle[] = [];
  public width: number = 800;
  public height: number = 600;
  public isRunning: boolean = false;
  public animFrameId: number | null = null;
  public mouseX: number = -1000;
  public mouseY: number = -1000;

  constructor(canvas?: any) {
    if (canvas) {
      this.init(canvas);
    }
  }

  public init(canvas: any) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize(canvas.width || 800, canvas.height || 600);
    this.createParticles(40);
    this.isRunning = true;
  }

  public resize(w: number, h: number) {
    this.width = Math.max(0, w);
    this.height = Math.max(0, h);
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  public createParticles(count: number = 40) {
    this.particles = [];
    const runes = ['勅令', '安鎮', '淨身', '護身', '辟邪', '靈符'];

    for (let i = 0; i < count; i++) {
      const typeChoice = i % 3 === 0 ? 'talisman' : i % 3 === 1 ? 'firefly' : 'ember';
      this.particles.push({
        id: i,
        x: Math.random() * (this.width || 800),
        y: Math.random() * (this.height || 600),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.2, // slight upward float
        size: typeChoice === 'talisman' ? 24 : typeChoice === 'firefly' ? 4 : 2,
        type: typeChoice,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        alpha: 0.3 + Math.random() * 0.6,
        runeText: typeChoice === 'talisman' ? runes[i % runes.length] : undefined
      });
    }
  }

  public setMousePosition(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  public update() {
    const margin = 50;
    const repulsionRadius = 120;

    for (const p of this.particles) {
      // 1. Mouse Repulsion Physics
      const dx = p.x - this.mouseX;
      const dy = p.y - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < repulsionRadius && dist >= 0) {
        // Safe division guard
        const safeDist = Math.max(dist, 0.001);
        const force = (repulsionRadius - dist) / repulsionRadius;
        p.vx += (dx / safeDist) * force * 0.8;
        p.vy += (dy / safeDist) * force * 0.8;
      }

      // 2. Velocity damping & position integration
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      // 3. Screen Edge Coordinate Wrap
      if (this.width > 0 && this.height > 0) {
        if (p.x < -margin) p.x = this.width + margin;
        else if (p.x > this.width + margin) p.x = -margin;

        if (p.y < -margin) p.y = this.height + margin;
        else if (p.y > this.height + margin) p.y = -margin;
      }
    }
  }

  public render() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.width, this.height);

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'talisman') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
        if (p.runeText) {
          ctx.font = '10px monospace';
          ctx.fillStyle = '#ff0054';
          ctx.fillText(p.runeText, -p.size / 4, 0);
        }
      } else if (p.type === 'firefly') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = '#00f5a0';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd166';
        ctx.fill();
      }

      ctx.restore();
    }
  }

  public destroy() {
    this.isRunning = false;
    this.particles = [];
    if (this.animFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

describe('TalismanCanvasTest (F09)', () => {
  let env: any;
  let canvas: any;

  beforeEach(() => {
    env = setupTestEnvironment();
    canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
  });

  afterEach(() => {
    env.teardown();
  });

  // ==========================================================================
  // TIER 1: Feature Coverage (Isolation)
  // ==========================================================================
  describe('[T1_F09] Talisman & Firefly Particles 2D Canvas Engine', () => {
    /**
     * @tier: 1
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T1_F09_01] Particle engine initializes canvas and generates particle collection', () => {
      const engine = new TalismanParticleEngine(canvas);
      expect(engine.width).toBe(1024);
      expect(engine.height).toBe(768);
      expect(engine.particles.length).toBe(40);
      expect(engine.isRunning).toBe(true);
    });

    /**
     * @tier: 1
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T1_F09_02] Particle collection contains talisman, firefly, and ember types with runes', () => {
      const engine = new TalismanParticleEngine(canvas);
      const types = engine.particles.map((p) => p.type);
      expect(types).toContain('talisman');
      expect(types).toContain('firefly');
      expect(types).toContain('ember');

      const talismanParticles = engine.particles.filter((p) => p.type === 'talisman');
      expect(talismanParticles.length).toBeGreaterThan(0);
      expect(talismanParticles[0].runeText).toBeDefined();
    });

    /**
     * @tier: 1
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T1_F09_03] Canvas render loop draws runes and rectangles for talisman papers', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.render();

      const ctx = engine.ctx as MockCanvasRenderingContext2D;
      const rects = ctx.getDrawnRects();
      const texts = ctx.getDrawnTexts();

      expect(rects.length).toBeGreaterThan(0);
      expect(texts.length).toBeGreaterThan(0);
      expect(texts[0].text).toBeDefined();
    });

    /**
     * @tier: 1
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T1_F09_04] Canvas render loop draws glowing circles for fireflies and embers', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.render();

      const ctx = engine.ctx as MockCanvasRenderingContext2D;
      const arcs = ctx.getDrawnArcs();
      expect(arcs.length).toBeGreaterThan(0);
    });

    /**
     * @tier: 1
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T1_F09_05] Particles moving beyond viewport boundaries execute screen coordinate wrap', () => {
      const engine = new TalismanParticleEngine(canvas);
      // Place particle 1 past right edge (x = 1024 + 60 = 1084)
      engine.particles[0].x = 1090;
      engine.particles[0].vx = 5;

      engine.update();
      // Wraps around to left edge (-50)
      expect(engine.particles[0].x).toBe(-50);
    });
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================
  describe('[T2_F09] Boundary, Math & Stress Handling for Canvas Engine', () => {
    /**
     * @tier: 2
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T2_F09_01] Mouse repulsion physics handles cursor at exact particle position (distance = 0) without NaN', () => {
      const engine = new TalismanParticleEngine(canvas);
      const p = engine.particles[0];
      p.x = 200;
      p.y = 200;
      p.vx = 0;
      p.vy = 0;

      // Mouse exactly on particle
      engine.setMousePosition(200, 200);
      expect(() => engine.update()).not.toThrow();

      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.vx)).toBe(true);
      expect(Number.isFinite(p.vy)).toBe(true);
    });

    /**
     * @tier: 2
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T2_F09_02] Canvas resize to 0x0 or negative dimensions clamps safely to 0', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.resize(0, 0);
      expect(engine.width).toBe(0);
      expect(engine.height).toBe(0);

      engine.resize(-500, -300);
      expect(engine.width).toBe(0);
      expect(engine.height).toBe(0);

      expect(() => {
        engine.update();
        engine.render();
      }).not.toThrow();
    });

    /**
     * @tier: 2
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T2_F09_03] Stress test with 500 particles updates and renders within normal memory limits', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.createParticles(500);
      expect(engine.particles.length).toBe(500);

      expect(() => {
        for (let i = 0; i < 10; i++) {
          engine.update();
          engine.render();
        }
      }).not.toThrow();
    });

    /**
     * @tier: 2
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T2_F09_04] Mouse positioned far off-screen (-9999, -9999) exerts zero repulsion force', () => {
      const engine = new TalismanParticleEngine(canvas);
      engine.setMousePosition(-9999, -9999);

      const initialVx = engine.particles[0].vx;
      engine.update();

      // Velocity only subjected to 0.98 damping, no repulsion acceleration
      expect(Math.abs(engine.particles[0].vx)).toBeCloseTo(Math.abs(initialVx * 0.98), 2);
    });

    /**
     * @tier: 2
     * @feature: F09_TALISMAN_CANVAS
     */
    it('[T2_F09_05] Destroy cleans up particle arrays and sets running state to false', () => {
      const engine = new TalismanParticleEngine(canvas);
      expect(engine.isRunning).toBe(true);

      engine.destroy();
      expect(engine.isRunning).toBe(false);
      expect(engine.particles.length).toBe(0);
    });
  });
});
