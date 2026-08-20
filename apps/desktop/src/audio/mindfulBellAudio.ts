/**
 * Mindful Bell Synthesizer (Tibetan Singing Bowl Web Audio API)
 * Pure, resonant acoustic harmonic synthesis without external audio files.
 */
class MindfulBellAudio {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Ring the resonant meditation bell with authentic harmonic overtones
   * @param fundamentalFreq Fundamental frequency (default 432Hz for deep tranquility)
   * @param duration Sustain duration in seconds (default 6.0s)
   */
  public ringBell(fundamentalFreq: number = 432, duration: number = 6.0) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.4, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Lowpass filter for warm acoustic warmth
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4800, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + duration);

      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      // Tibetan Singing Bowl Harmonic Spectrum:
      // 1. Fundamental Root (1.0x) - Deep meditative vibration
      // 2. Harmonic Overtone 1 (2.76x) - Resonant singing wall
      // 3. Harmonic Overtone 2 (5.40x) - Crystal overtone
      // 4. Harmonic Overtone 3 (8.90x) - Subtle bronze shimmer
      const harmonics = [
        { mult: 1.0, gainVal: 0.85, decayMult: 1.0 },
        { mult: 2.76, gainVal: 0.48, decayMult: 0.88 },
        { mult: 5.4, gainVal: 0.22, decayMult: 0.65 },
        { mult: 8.9, gainVal: 0.09, decayMult: 0.35 },
      ];

      harmonics.forEach(({ mult, gainVal, decayMult }) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamentalFreq * mult, now);

        // Strike envelope with smooth attack and exponential decay
        oscGain.gain.setValueAtTime(0.001, now);
        oscGain.gain.exponentialRampToValueAtTime(gainVal, now + 0.035);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * decayMult);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + duration * decayMult);
      });
    } catch (e) {
      console.warn('Audio playback not ready:', e);
    }
  }
}

export const mindfulBell = new MindfulBellAudio();
