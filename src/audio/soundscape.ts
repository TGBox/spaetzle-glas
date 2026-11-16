const PENTATONIC_FREQUENCIES: readonly number[] = [
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  880.0, // A5
  987.77, // B5
  1174.66, // D6
  1318.51, // E6
  1479.98, // F#6
  1760.0, // A6
];

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Procedural Web Audio synthesizer generating pentatonic wind chimes,
 * warm star-opening arpeggios, cork-pop unlock effects, and tactile stamps.
 */
export class SoundscapeController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private lastChimeTimeMs = 0;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0 : 0.6;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  /**
   * Must be invoked inside a direct user gesture (click / touchend) for iOS Safari.
   */
  public async unlock(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as WebkitWindow).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.6;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore resume failure if browser policies block audio before interaction.
      }
    }
  }

  /**
   * Plays a rate-limited pentatonic chime when stars collide inside the jar.
   */
  public playCollisionChime(intensity: number, day: number): void {
    if (this.muted || !this.ctx || !this.masterGain) {
      return;
    }

    const nowMs = performance.now();
    if (nowMs - this.lastChimeTimeMs < 75) {
      return;
    }
    this.lastChimeTimeMs = nowMs;

    const freqIndex =
      Math.abs(day * 3 + Math.round(intensity * 5)) %
      PENTATONIC_FREQUENCIES.length;
    const freq = PENTATONIC_FREQUENCIES[freqIndex];
    const volume = Math.min(0.18, 0.03 + intensity * 0.14);

    this.playBellTone(freq, this.ctx.currentTime, 0.95, volume);
  }

  /**
   * Plays a soft muted wood/glass knock when tapping a future locked star.
   */
  public playLockedTap(): void {
    if (this.muted || !this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.085);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Plays a warm ascending pentatonic arpeggio when opening an advent star.
   */
  public playStarOpen(day: number): void {
    if (this.muted || !this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const rootOffset = day % 3;
    const indices = [
      rootOffset,
      rootOffset + 2,
      rootOffset + 3,
      rootOffset + 5,
    ];

    indices.forEach((idx, step) => {
      const freq =
        PENTATONIC_FREQUENCIES[idx % PENTATONIC_FREQUENCIES.length];
      this.playBellTone(freq, now + step * 0.07, 1.45, 0.16);
    });
  }

  /**
   * Plays a cork-pop + shimmering welcome chord upon unlocking the anniversary gate.
   */
  public playJarUnlock(): void {
    if (this.muted || !this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;

    // Gentle cork pop.
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(175, now);
    popOsc.frequency.exponentialRampToValueAtTime(460, now + 0.075);

    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.22, now + 0.012);
    popGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);

    popOsc.connect(popGain);
    popGain.connect(this.masterGain);
    popOsc.start(now);
    popOsc.stop(now + 0.1);

    // Warm Dmaj9 shimmer chord.
    const chord = [293.66, 440.0, 659.25, 739.99, 1174.66];
    chord.forEach((freq, i) => {
      this.playBellTone(freq, now + 0.08 + i * 0.055, 1.85, 0.12);
    });
  }

  /**
   * Plays a tactile stamp thud followed by a sparkle chime when redeeming a voucher.
   */
  public playVoucherRedeem(): void {
    if (this.muted || !this.ctx || !this.masterGain) {
      return;
    }

    const now = this.ctx.currentTime;

    const stampOsc = this.ctx.createOscillator();
    const stampGain = this.ctx.createGain();
    stampOsc.type = "sine";
    stampOsc.frequency.setValueAtTime(140, now);
    stampOsc.frequency.exponentialRampToValueAtTime(58, now + 0.11);

    stampGain.gain.setValueAtTime(0.24, now);
    stampGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    stampOsc.connect(stampGain);
    stampGain.connect(this.masterGain);
    stampOsc.start(now);
    stampOsc.stop(now + 0.14);

    this.playBellTone(880.0, now + 0.09, 0.9, 0.14);
    this.playBellTone(1174.66, now + 0.17, 1.2, 0.16);
  }

  private playBellTone(
    frequency: number,
    startTime: number,
    duration: number,
    peakVolume: number
  ): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    const oscFundamental = this.ctx.createOscillator();
    const oscOvertone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    oscFundamental.type = "sine";
    oscFundamental.frequency.setValueAtTime(frequency, startTime);

    // Subtle glass harmonic overtone at 2.0x frequency.
    oscOvertone.type = "sine";
    oscOvertone.frequency.setValueAtTime(frequency * 2.0, startTime);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.22;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakVolume, startTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    oscFundamental.connect(gain);
    oscOvertone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.masterGain);

    oscFundamental.start(startTime);
    oscOvertone.start(startTime);
    oscFundamental.stop(startTime + duration + 0.02);
    oscOvertone.stop(startTime + duration + 0.02);
  }
}
