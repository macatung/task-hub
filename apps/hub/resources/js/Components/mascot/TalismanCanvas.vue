<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTimeCycle } from '@/composables/useTimeCycle';

const { activePhase } = useTimeCycle();

interface Particle {
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

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
let particles: Particle[] = [];
let mouseX = -1000;
let mouseY = -1000;
let width = 0;
let height = 0;

const runes = ['0 BUG', '</>', '⚡', 'DEV', '☕', 'HOP', '12AM', '勅令', '安鎮', '靈符'];

const createParticles = (count: number) => {
  particles = [];
  for (let i = 0; i < count; i++) {
    const typeChoice: 'talisman' | 'firefly' | 'ember' = i % 3 === 0 ? 'talisman' : i % 3 === 1 ? 'firefly' : 'ember';
    particles.push({
      id: i,
      x: Math.random() * (width || 800),
      y: Math.random() * (height || 600),
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2 - 0.2, // Slight upward atmospheric drift
      size: typeChoice === 'talisman' ? 24 : typeChoice === 'firefly' ? 4 : 2,
      type: typeChoice,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      alpha: 0.25 + Math.random() * 0.55,
      runeText: typeChoice === 'talisman' ? runes[i % runes.length] : undefined,
    });
  }
};

const handleResize = () => {
  if (!canvasRef.value) return;
  width = Math.max(0, window.innerWidth);
  height = Math.max(0, window.innerHeight);
  canvasRef.value.width = width;
  canvasRef.value.height = height;

  const count = Math.min(36, Math.max(14, Math.floor(width / 45)));
  if (particles.length === 0 || Math.abs(particles.length - count) > 10) {
    createParticles(count);
  }
};

const handleMouseMove = (e: MouseEvent) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
};

const handleMouseLeave = () => {
  mouseX = -1000;
  mouseY = -1000;
};

const update = () => {
  const margin = 50;
  const repulsionRadius = 120;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // 1. Mouse Repulsion Physics
    const dx = p.x - mouseX;
    const dy = p.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < repulsionRadius && dist >= 0) {
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
    if (width > 0 && height > 0) {
      if (p.x < -margin) p.x = width + margin;
      else if (p.x > width + margin) p.x = -margin;

      if (p.y < -margin) p.y = height + margin;
      else if (p.y > height + margin) p.y = -margin;
    }
  }
};

const render = (ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, width, height);
  const palette = activePhase.value.particlePalette;
  const primaryColor = palette[0] || '#00f5a0';
  const secondaryColor = palette[1] || '#ffd166';
  const tertiaryColor = palette[2] || '#00d2ff';

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (p.type === 'talisman') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Phase-specific Talisman Paper Body
      ctx.fillStyle = secondaryColor;
      ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);

      // Paper border
      ctx.strokeStyle = 'rgba(230, 57, 70, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-p.size / 2, -p.size, p.size, p.size * 2);

      // Red Top Seal Dot
      ctx.beginPath();
      ctx.arc(0, -p.size + 4, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ef233c';
      ctx.fill();

      // Rune Inscription
      if (p.runeText) {
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#c9182b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.runeText, 0, 2);
      }
    } else if (p.type === 'firefly') {
      // Glowing Firefly (Phase Primary Color)
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
      ctx.fill();
    } else {
      // Cosmic Ember (Phase Tertiary Color)
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = tertiaryColor;
      ctx.shadowColor = tertiaryColor;
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    ctx.restore();
  }
};

const loop = () => {
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (ctx) {
    update();
    render(ctx);
  }
  animationFrameId = requestAnimationFrame(loop);
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animationFrameId = requestAnimationFrame(loop);
  }
});

onUnmounted(() => {
  if (animationFrameId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseleave', handleMouseLeave);
  }
  particles = [];
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 pointer-events-none z-0 w-full h-full"
    aria-hidden="true"
  />
</template>
