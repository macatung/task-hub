/**
 * 🧘 Theravāda Mindful Bell Sound Engine (Web Audio API)
 * Pure procedural harmonic synthesis for Tibetan Singing Bowl & Theravāda Bronze Bell.
 */

class MindfulBellAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Thỉnh Chuông Chánh Niệm (Mindful Bronze / Singing Bell)
   * Fundamental frequency with rich non-harmonic overtone series (432Hz golden ratio base)
   */
  public ringBell(baseFreq: number = 432, durationSec: number = 5.5) {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);

      // Attack and exponential natural decay
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      // Harmonics ratios for bronze singing bowl
      const harmonics = [
        { mult: 1.0, gain: 0.6 },
        { mult: 2.76, gain: 0.25 },
        { mult: 4.48, gain: 0.12 },
        { mult: 6.82, gain: 0.06 }
      ];

      harmonics.forEach(({ mult, gain: hGain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * mult, now);

        // Gentle tremolo (beating frequency)
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(1.5, now);
        lfoGain.gain.setValueAtTime(1.5, now);
        lfo.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + durationSec);

        g.gain.setValueAtTime(hGain, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(now);
        osc.stop(now + durationSec);
      });
    } catch (e) {
      // Audio safety fallback
    }
  }

  /**
   * Gõ Tiếng Mõ Thiền (Wooden Fish Chime)
   */
  public strikeWoodenFish() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const mindfulBell = new MindfulBellAudioEngine();
