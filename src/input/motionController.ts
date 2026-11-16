import type { Vec3 } from "../physics/starPhysics";

interface PermissionCapableEvent {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface MotionCallbacks {
  readonly onShake: (impulse: Vec3) => void;
  readonly onGravityChange: (gravity: Vec3) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Handles iOS DeviceMotion / DeviceOrientation permission requests, tilt gravity,
 * shake detection, and manual shake triggers for macOS or denied permissions.
 */
export class MotionController {
  private readonly callbacks: MotionCallbacks;
  private isListening = false;
  private hasMotionAccess = false;
  private hasRequestedPermission = false;
  private lastShakeTimestampMs = 0;
  private lastTotalAccel: Vec3 | null = null;

  constructor(callbacks: MotionCallbacks) {
    this.callbacks = callbacks;
  }

  public hasSensorAccess(): boolean {
    return this.hasMotionAccess;
  }

  /**
   * Must be called inside a user gesture handler to satisfy iOS 13+ permission prompts.
   */
  public async requestPermissionsFromUserGesture(): Promise<boolean> {
    if (typeof window === "undefined") {
      return false;
    }
    if (this.hasRequestedPermission) {
      return this.hasMotionAccess;
    }
    this.hasRequestedPermission = true;

    let granted = true;

    try {
      const motionEvent = window.DeviceMotionEvent as unknown as
        | PermissionCapableEvent
        | undefined;
      if (motionEvent && typeof motionEvent.requestPermission === "function") {
        const result = await motionEvent.requestPermission();
        if (result !== "granted") {
          granted = false;
        }
      }
    } catch {
      granted = false;
    }

    try {
      const orientationEvent = window.DeviceOrientationEvent as unknown as
        | PermissionCapableEvent
        | undefined;
      if (
        orientationEvent &&
        typeof orientationEvent.requestPermission === "function"
      ) {
        await orientationEvent.requestPermission();
      }
    } catch {
      // Orientation permission is optional; shake / manual fallback still works.
    }

    this.hasMotionAccess = granted;
    this.startListening();
    return granted;
  }

  public startListening(): void {
    if (this.isListening || typeof window === "undefined") {
      return;
    }

    this.isListening = true;
    window.addEventListener("devicemotion", this.handleDeviceMotion);
    window.addEventListener("deviceorientation", this.handleDeviceOrientation);
  }

  /**
   * Triggers a realistic swirling shake impulse manually (for Mac or button click).
   */
  public triggerManualShake(strength = 1.0): void {
    const angle = Math.random() * Math.PI * 2;
    this.callbacks.onShake({
      x: Math.cos(angle) * 2.2 * strength,
      y: 3.4 * strength,
      z: Math.sin(angle) * 2.2 * strength,
    });
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
    this.isListening = false;
  }

  private readonly handleDeviceOrientation = (
    event: DeviceOrientationEvent
  ): void => {
    if (event.gamma === null && event.beta === null) {
      return;
    }

    const gamma = clamp(event.gamma ?? 0, -45, 45);
    const betaOffset = clamp((event.beta ?? 45) - 45, -45, 45);

    const gx = (gamma / 45) * 3.2;
    const gz = (betaOffset / 45) * 2.1;
    const gy = -4.2;

    this.callbacks.onGravityChange({ x: gx, y: gy, z: gz });
  };

  private readonly handleDeviceMotion = (event: DeviceMotionEvent): void => {
    const nowMs = performance.now();
    if (nowMs - this.lastShakeTimestampMs < 180) {
      return;
    }

    const linear = event.acceleration;
    if (
      linear &&
      linear.x !== null &&
      linear.y !== null &&
      linear.z !== null
    ) {
      const mag = Math.sqrt(
        linear.x * linear.x + linear.y * linear.y + linear.z * linear.z
      );
      if (mag > 12.5) {
        this.lastShakeTimestampMs = nowMs;
        const scale = clamp(mag / 18, 0.7, 1.5);
        this.callbacks.onShake({
          x: clamp(linear.x * 0.22, -3.5, 3.5),
          y: 2.8 * scale,
          z: clamp(linear.z * 0.22, -3.5, 3.5),
        });
      }
      return;
    }

    const withGravity = event.accelerationIncludingGravity;
    if (
      !withGravity ||
      withGravity.x === null ||
      withGravity.y === null ||
      withGravity.z === null
    ) {
      return;
    }

    const current: Vec3 = {
      x: withGravity.x,
      y: withGravity.y,
      z: withGravity.z,
    };

    if (this.lastTotalAccel) {
      const dx = current.x - this.lastTotalAccel.x;
      const dy = current.y - this.lastTotalAccel.y;
      const dz = current.z - this.lastTotalAccel.z;
      const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (delta > 11.5) {
        this.lastShakeTimestampMs = nowMs;
        const scale = clamp(delta / 16, 0.7, 1.45);
        this.callbacks.onShake({
          x: clamp(dx * 0.18, -3.2, 3.2),
          y: 2.6 * scale,
          z: clamp(dz * 0.18, -3.2, 3.2),
        });
      }
    }

    this.lastTotalAccel = current;
  };
}
