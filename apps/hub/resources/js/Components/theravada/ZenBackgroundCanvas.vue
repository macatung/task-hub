<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useZenTimeCycle } from '@/composables/useZenTimeCycle';
import { useZenAtmosphere } from '@/composables/useZenAtmosphere';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const { activeZenPhase } = useZenTimeCycle();
const { isLeavesEnabled } = useZenAtmosphere();

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  type: 'lotus' | 'bodhi' | 'dust';
  hue: number;
}

interface Smoke {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  opacity: number;
  maxLife: number;
  life: number;
}

let animationFrameId: number;
let petals: Petal[] = [];
let smokes: Smoke[] = [];
let mouseX = -1000;
let mouseY = -1000;
let wheelAngle = 0;

const initCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const handleResize = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  };

  handleResize();
  window.addEventListener('resize', handleResize, { passive: true });

  // Spawn Petals & Bodhi leaves (Drastically reduced count & ultra-soft opacity to prevent distraction)
  const petalCount = window.innerWidth < 768 ? 4 : 8;
  petals = Array.from({ length: petalCount }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: 8 + Math.random() * 8, // Smaller subtle size
    speedY: 0.15 + Math.random() * 0.25, // Gentle meditative drift
    speedX: -0.15 + Math.random() * 0.3,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.008,
    opacity: 0.08 + Math.random() * 0.14, // Very soft opacity
    type: Math.random() > 0.5 ? 'lotus' : Math.random() > 0.3 ? 'bodhi' : 'dust',
    hue: 35 + Math.random() * 15 // Amber/Gold tones
  }));

  // Mouse move effect
  const handleMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };
  window.addEventListener('mousemove', handleMouseMove, { passive: true });

  const drawDhammaWheel = (centerX: number, centerY: number, radius: number, alpha: number) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(wheelAngle);

    ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.12})`;
    ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.04})`;
    ctx.lineWidth = 1.2;

    // Outer Hub & Rim
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    // Center Hub (Nirodha / Nibbana Core)
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 8 Sacred Spokes (Ariya Aṭṭhaṅgika Magga - Bát Chánh Đạo)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius * 0.22), Math.sin(angle) * (radius * 0.22));
      ctx.lineTo(Math.cos(angle) * (radius * 0.82), Math.sin(angle) * (radius * 0.82));
      ctx.stroke();

      // Little decorative pearls on rim
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * 0.91, Math.sin(angle) * radius * 0.91, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.4})`;
      ctx.fill();
    }

    ctx.restore();
  };

  const drawLotusPetal = (x: number, y: number, size: number, rotation: number, opacity: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = `rgba(251, 191, 36, ${opacity})`;
    ctx.strokeStyle = `rgba(245, 158, 11, ${opacity * 0.8})`;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.6, -size * 0.5, size * 0.6, size * 0.5, 0, size);
    ctx.bezierCurveTo(-size * 0.6, size * 0.5, -size * 0.6, -size * 0.5, 0, -size);
    ctx.fill();
    ctx.stroke();

    // Midrib vein
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.8);
    ctx.lineTo(0, size * 0.7);
    ctx.strokeStyle = `rgba(217, 119, 6, ${opacity * 0.6})`;
    ctx.stroke();

    ctx.restore();
  };

  const drawBodhiLeaf = (x: number, y: number, size: number, rotation: number, opacity: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = `rgba(180, 130, 45, ${opacity * 0.85})`;
    ctx.strokeStyle = `rgba(217, 119, 6, ${opacity * 0.7})`;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, -size * 1.3); // elongated tip
    ctx.quadraticCurveTo(size * 0.8, -size * 0.2, size * 0.7, size * 0.6);
    ctx.quadraticCurveTo(size * 0.4, size, 0, size * 0.8);
    ctx.quadraticCurveTo(-size * 0.4, size, -size * 0.7, size * 0.6);
    ctx.quadraticCurveTo(-size * 0.8, -size * 0.2, 0, -size * 1.3);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const drawGoldenDust = (x: number, y: number, size: number, opacity: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(253, 230, 138, ${opacity * 0.9})`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  };

  const render = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Sacred Background Dhamma Wheel
    wheelAngle += 0.0006;
    drawDhammaWheel(width * 0.82, height * 0.45, Math.min(width * 0.35, 280), 0.55);
    drawDhammaWheel(width * 0.12, height * 0.85, Math.min(width * 0.25, 180), 0.35);

    // 2. Spawn and update Incense Smoke
    if (Math.random() < 0.08 && smokes.length < 25) {
      smokes.push({
        x: (width * 0.2) + Math.random() * (width * 0.6),
        y: height + 10,
        radius: 12 + Math.random() * 20,
        speedY: 0.5 + Math.random() * 0.7,
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: 0.15 + Math.random() * 0.15,
        maxLife: 280 + Math.random() * 150,
        life: 0
      });
    }

    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.life++;
      s.y -= s.speedY;
      s.x += s.speedX + Math.sin(s.life * 0.03) * 0.3;
      s.radius += 0.12;

      const progress = s.life / s.maxLife;
      const currentOpacity = s.opacity * Math.sin(progress * Math.PI);

      if (progress >= 1 || s.y < -50) {
        smokes.splice(i, 1);
        continue;
      }

      ctx.save();
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
      grad.addColorStop(0, `rgba(217, 119, 6, ${currentOpacity * 0.8})`);
      grad.addColorStop(0.5, `rgba(168, 85, 247, ${currentOpacity * 0.2})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Update & Draw Petals / Bodhi Leaves (Only if leaves atmosphere is enabled)
    if (isLeavesEnabled.value) {
      for (const p of petals) {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.01) * 0.4;
        p.rotation += p.rotationSpeed;

        // Mouse repulsion / breeze effect
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          const force = (100 - dist) / 100;
          p.x += (dx / dist) * force * 1.5;
          p.y += (dy / dist) * force * 1.5;
        }

        // Wrap around edges
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        if (p.type === 'lotus') {
          drawLotusPetal(p.x, p.y, p.size, p.rotation, p.opacity);
        } else if (p.type === 'bodhi') {
          drawBodhiLeaf(p.x, p.y, p.size, p.rotation, p.opacity);
        } else {
          drawGoldenDust(p.x, p.y, p.size, p.opacity);
        }
      }
    }

    animationFrameId = requestAnimationFrame(render);
  };

  render();

  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('mousemove', handleMouseMove);
    cancelAnimationFrame(animationFrameId);
  };
};

onMounted(() => {
  const cleanup = initCanvas();
  onUnmounted(() => {
    if (cleanup) cleanup();
  });
});
</script>

<template>
  <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
    <canvas ref="canvasRef" class="w-full h-full block" />
  </div>
</template>
