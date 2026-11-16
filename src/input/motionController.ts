import type { Vec3 } from "../physics/starPhysics";

interface PermissionCapableEvent {
  requestPermission?: () => Promise<string>;
}

export interface MotionCallbacks {
  /** Unit vector pointing "down" in screen space (x right, y up, z toward the viewer). */
  readonly onGravityDirection: (direction: Vec3) => void;
  /** Linear device acceleration in screen space (m/s^2, gravity removed). */
  readonly onLinearAcceleration: (acceleration: Vec3) => void;
  /** Rotation rate around the screen's vertical axis in rad/s (twisting the jar). */
  readonly onTwist: (radiansPerSecond: number) => void;
  /** A distinct shake was detected; strength is normalized to 0..1. */
  readonly onShake: (strength: number) => void;
  /** Fired once when the first real sensor reading arrives. */
  readonly onSensorsLive?: () => void;
}

const DEG_TO_RAD = Math.PI / 180;
const SHAKE_THRESHOLD = 11; // m/s^2 of linear acceleration
const SHAKE_FULL_STRENGTH = 30; // m/s^2 that maps to strength 1
const SHAKE_REFRACTORY_MS = 220;
const ACCELERATION_DEAD_ZONE = 0.6; // m/s^2, hides sensor noise while resting
const STALE_MOTION_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rotates a device-frame vector into the screen frame for the current screen rotation.
 */
export function rotateToScreenFrame(vector: Vec3, screenAngleDeg: number): Vec3 {
  const angle = screenAngleDeg * DEG_TO_RAD;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
    z: vector.z,
  };
}

/**
 * Converts DeviceOrientation angles into the direction of gravity as seen on screen.
 * Derived from the W3C Z-X'-Y'' convention, so it behaves the same on iOS and Android
 * (unlike `accelerationIncludingGravity`, whose sign differs between platforms).
 */
export function gravityDirectionFromOrientation(
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg = 0
): Vec3 {
  const beta = betaDeg * DEG_TO_RAD;
  const gamma = gammaDeg * DEG_TO_RAD;
  const deviceFrame: Vec3 = {
    x: Math.cos(beta) * Math.sin(gamma),
    y: -Math.sin(beta),
    z: -Math.cos(beta) * Math.cos(gamma),
  };
  return rotateToScreenFrame(deviceFrame, screenAngleDeg);
}

/**
 * Maps a linear acceleration magnitude (m/s^2) to a shake strength, or 0 below the threshold.
 */
export function shakeStrengthFromAcceleration(magnitude: number): number {
  if (magnitude < SHAKE_THRESHOLD) {
    return 0;
  }
  return clamp(
    (magnitude - SHAKE_THRESHOLD) / (SHAKE_FULL_STRENGTH - SHAKE_THRESHOLD),
    0.15,
    1
  );
}

function readScreenAngle(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const modern = window.screen?.orientation?.angle;
  if (typeof modern === "number") {
    return modern;
  }
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

/**
 * Turns the phone's motion sensors into jar physics input:
 * gravity follows the real "down", the accelerometer shoves the stars around,
 * the gyroscope swirls them, and distinct shakes are reported separately.
 * Handles the iOS permission prompt and offers a manual shake for devices without sensors.
 */
export class MotionController {
  private readonly callbacks: MotionCallbacks;
  private isListening = false;
  private permissionGranted = false;
  private sensorsLive = false;
  private lastShakeTimestampMs = 0;
  private lastMotionTimestampMs = 0;
  private staleTimerId: number | null = null;

  constructor(callbacks: MotionCallbacks) {
    this.callbacks = callbacks;
  }

  /** True once real sensor readings have arrived (iPhone yes, Mac no). */
  public hasLiveSensors(): boolean {
    return this.sensorsLive;
  }

  /**
   * Must be called synchronously inside a user gesture handler (click / touchend).
   * iOS shows its permission prompt once per app launch; later calls resolve silently.
   * Resolves to false only when the user explicitly denied access.
   */
  public async requestPermissionsFromUserGesture(): Promise<boolean> {
    if (typeof window === "undefined") {
      return false;
    }
    if (this.permissionGranted) {
      return true;
    }

    // Both requests are started before the first await so they share the user activation.
    const requests = [window.DeviceMotionEvent, window.DeviceOrientationEvent].map(
      (eventClass): Promise<string> => {
        const candidate = eventClass as unknown as
          | PermissionCapableEvent
          | undefined;
        if (candidate && typeof candidate.requestPermission === "function") {
          return candidate.requestPermission().catch(() => "denied");
        }
        return Promise.resolve("granted");
      }
    );

    const results = await Promise.all(requests);
    this.permissionGranted = results.every((result) => result === "granted");

    // Listen in every case: browsers may answer with other states (e.g. "prompt")
    // and still deliver events. Without access the events simply never arrive.
    this.startListening();
    return !results.includes("denied");
  }

  public startListening(): void {
    if (this.isListening || typeof window === "undefined") {
      return;
    }

    this.isListening = true;
    window.addEventListener("devicemotion", this.handleDeviceMotion);
    window.addEventListener("deviceorientation", this.handleDeviceOrientation);
    this.staleTimerId = window.setInterval(this.resetStaleMotion, STALE_MOTION_MS);
  }

  /**
   * Reports a shake without sensors (Mac, denied permission, or the shake button).
   */
  public triggerManualShake(strength = 1.0): void {
    this.callbacks.onShake(clamp(strength, 0, 1));
  }

  public dispose(): void {
    if (!this.isListening || typeof window === "undefined") {
      return;
    }
    window.removeEventListener("devicemotion", this.handleDeviceMotion);
    window.removeEventListener(
      "deviceorientation",
      this.handleDeviceOrientation
    );
    if (this.staleTimerId !== null) {
      window.clearInterval(this.staleTimerId);
      this.staleTimerId = null;
    }
    this.isListening = false;
  }

  private markSensorsLive(): void {
    if (this.sensorsLive) {
      return;
    }
    this.sensorsLive = true;
    this.callbacks.onSensorsLive?.();
  }

  /** Clears inertia and twist when motion events stop (app in background, sensor paused). */
  private readonly resetStaleMotion = (): void => {
    if (
      this.lastMotionTimestampMs > 0 &&
      performance.now() - this.lastMotionTimestampMs > STALE_MOTION_MS
    ) {
      this.lastMotionTimestampMs = 0;
      this.callbacks.onLinearAcceleration({ x: 0, y: 0, z: 0 });
      this.callbacks.onTwist(0);
    }
  };

  private readonly handleDeviceOrientation = (
    event: DeviceOrientationEvent
  ): void => {
    // Desktop browsers fire a single event with null angles; ignore it.
    if (event.beta === null || event.gamma === null) {
      return;
    }

    this.markSensorsLive();
    this.callbacks.onGravityDirection(
      gravityDirectionFromOrientation(event.beta, event.gamma, readScreenAngle())
    );
  };

  private readonly handleDeviceMotion = (event: DeviceMotionEvent): void => {
    const screenAngle = readScreenAngle();
    const nowMs = performance.now();

    const linear = event.acceleration;
    if (linear && linear.x !== null && linear.y !== null && linear.z !== null) {
      this.lastMotionTimestampMs = nowMs;
      const magnitude = Math.hypot(linear.x, linear.y, linear.z);

      if (magnitude < ACCELERATION_DEAD_ZONE) {
        this.callbacks.onLinearAcceleration({ x: 0, y: 0, z: 0 });
      } else {
        this.callbacks.onLinearAcceleration(
          rotateToScreenFrame(
            { x: linear.x, y: linear.y, z: linear.z },
            screenAngle
          )
        );
      }

      const strength = shakeStrengthFromAcceleration(magnitude);
      if (
        strength > 0 &&
        nowMs - this.lastShakeTimestampMs > SHAKE_REFRACTORY_MS
      ) {
        this.lastShakeTimestampMs = nowMs;
        this.callbacks.onShake(strength);
      }
    }

    const rate = event.rotationRate;
    if (rate && rate.beta !== null && rate.gamma !== null) {
      // rotationRate: beta is around the device x axis, gamma around y, alpha around z (deg/s).
      const screenRate = rotateToScreenFrame(
        { x: rate.beta, y: rate.gamma, z: rate.alpha ?? 0 },
        screenAngle
      );
      this.callbacks.onTwist(screenRate.y * DEG_TO_RAD);
    }
  };
}
