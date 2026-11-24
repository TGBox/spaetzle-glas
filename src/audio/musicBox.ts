/** Energy lost per second; a full wind-up runs down in about four seconds. */
const ENERGY_DECAY_PER_SECOND = 0.25;
/** Below this the music box stops and pauses at the current position. */
const STOP_THRESHOLD = 0.02;
const MAX_GAIN = 0.85;
/** Playback speed when almost run down; the pitch drops with it like a real music box. */
const MIN_RATE = 0.82;
const TICK_MS = 50;

export interface MusicBoxLevels {
  readonly playing: boolean;
  readonly gain: number;
  readonly rate: number;
}

/** Lets the wind-up energy run down over `dtSeconds`. */
export function decayMusicBoxEnergy(energy: number, dtSeconds: number): number {
  return Math.max(0, energy - ENERGY_DECAY_PER_SECOND * dtSeconds);
}

/**
 * Maps wind-up energy (0..1) to volume and speed: quiet and slow when it runs down,
 * full volume and normal speed from about half a wind-up.
 */
export function musicBoxLevels(energy: number): MusicBoxLevels {
  const clamped = Math.max(0, Math.min(1, energy));
  if (clamped < STOP_THRESHOLD) {
    return { playing: false, gain: 0, rate: 1 };
  }
  const drive = Math.min(1, clamped * 2);
  // Smoothstep so fading in and out sounds natural rather than linear.
  const eased = drive * drive * (3 - 2 * drive);
  return {
    playing: true,
    gain: eased * MAX_GAIN,
    rate: MIN_RATE + (1 - MIN_RATE) * eased,
  };
}

interface PitchCapableAudio extends HTMLAudioElement {
  webkitPreservesPitch?: boolean;
}

/**
 * Plays a song like a wind-up music box: shaking winds it up, the song plays while
 * there is energy left and slows down and fades out as it runs down, then pauses
 * at that position and continues there on the next shake.
 *
 * The audio element is routed through the soundscape's master gain so the mute
 * button also silences it (iOS ignores `HTMLMediaElement.volume`).
 */
export class MusicBox {
  private readonly audio: PitchCapableAudio;
  private gainNode: GainNode | null = null;
  private energy = 0;
  private suspended = false;
  private available = true;
  private lastTickMs = 0;
  private tickId: number | null = null;

  constructor(url: string) {
    this.audio = new Audio(url) as PitchCapableAudio;
    this.audio.loop = true;
    this.audio.preload = "auto";
    this.audio.preservesPitch = false;
    this.audio.webkitPreservesPitch = false;
    this.audio.addEventListener("error", () => {
      // Missing or unsupported file: the jar falls back to its random chimes.
      this.available = false;
      this.energy = 0;
    });
  }

  /** False when the song file could not be loaded. */
  public isAvailable(): boolean {
    return this.available;
  }

  /** True while the song is audible (used to quiet the random chimes). */
  public isPlaying(): boolean {
    return this.available && !this.audio.paused;
  }

  /**
   * Connects the song to the soundscape. Must run inside a user gesture on iOS:
   * the silent play-and-pause unlocks the element for later playback without a tap.
   */
  public attach(context: AudioContext, destination: AudioNode): void {
    if (this.gainNode) {
      return;
    }
    try {
      const source = context.createMediaElementSource(this.audio);
      this.gainNode = context.createGain();
      this.gainNode.gain.value = 0;
      source.connect(this.gainNode);
      this.gainNode.connect(destination);
    } catch {
      this.available = false;
      return;
    }

    this.audio
      .play()
      .then(() => {
        if (this.energy < STOP_THRESHOLD) {
          this.audio.pause();
        }
      })
      .catch(() => {
        // Autoplay refused; a later shake inside a gesture will try again.
      });

    this.lastTickMs = performance.now();
    this.tickId = window.setInterval(this.tick, TICK_MS);
  }

  /** Adds wind-up energy (0..1). */
  public windUp(amount: number): void {
    if (!this.available || amount <= 0) {
      return;
    }
    this.energy = Math.min(1, this.energy + amount);
  }

  /** Pauses while a card is open or the app is in the background. */
  public setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (suspended) {
      this.energy = 0;
    }
  }

  public dispose(): void {
    if (this.tickId !== null) {
      window.clearInterval(this.tickId);
      this.tickId = null;
    }
    this.audio.pause();
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTickMs) / 1000);
    this.lastTickMs = now;
    this.energy = decayMusicBoxEnergy(this.energy, dt);

    const levels = this.suspended
      ? musicBoxLevels(0)
      : musicBoxLevels(this.energy);
    if (this.gainNode) {
      const ctx = this.gainNode.context;
      this.gainNode.gain.setTargetAtTime(levels.gain, ctx.currentTime, 0.08);
    }

    if (levels.playing) {
      this.audio.playbackRate = levels.rate;
      if (this.audio.paused) {
        this.audio.play().catch(() => {
          // Will be retried on the next tick while energy remains.
        });
      }
    } else if (!this.audio.paused && (this.gainNode?.gain.value ?? 0) < 0.01) {
      // Pause only after the fade-out so it never cuts off abruptly.
      this.audio.pause();
    }
  };
}
