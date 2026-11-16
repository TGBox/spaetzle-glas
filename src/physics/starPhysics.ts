export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StarBody {
  readonly day: number;
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3;
  angularVelocity: Vec3;
  readonly radius: number;
  readonly targetConstellationPos: Vec3;
}

export interface CollisionEvent {
  readonly dayA: number;
  readonly dayB: number;
  readonly intensity: number;
}

export interface JarPhysicsConfig {
  readonly starCount: number;
  readonly jarRadius: number;
  readonly jarMinY: number;
  readonly jarMaxY: number;
  readonly starRadius: number;
  readonly restitution: number;
  readonly wallRestitution: number;
  readonly collisionSoundThreshold: number;
}

export const DEFAULT_JAR_PHYSICS_CONFIG: JarPhysicsConfig = {
  starCount: 24,
  jarRadius: 1.62,
  jarMinY: -1.95,
  jarMaxY: 1.85,
  starRadius: 0.3,
  restitution: 0.58,
  wallRestitution: 0.48,
  collisionSoundThreshold: 0.65,
};

const ZERO_VECTOR: Vec3 = { x: 0, y: 0, z: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createHeartConstellationPosition(
  index: number,
  total: number,
  config: JarPhysicsConfig
): Vec3 {
  const t = (index / total) * Math.PI * 2;
  const rawX = 16 * Math.pow(Math.sin(t), 3);
  const rawY =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);

  const usableRadius = Math.max(0.4, config.jarRadius - config.starRadius - 0.14);
  const scale = usableRadius / 16.5;

  const x = rawX * scale;
  const y = clamp(
    (rawY + 2.4) * scale * 0.96,
    config.jarMinY + config.starRadius + 0.15,
    config.jarMaxY - config.starRadius - 0.15
  );
  const z = Math.sin(t * 2) * 0.24;

  return { x, y, z };
}

/**
 * Pure TypeScript 3D physics world simulating 24 origami stars inside a cylindrical jar.
 * Supports tilt gravity, shake impulses, buoyancy for today's star, and 3D constellation morphing.
 */
export class StarPhysicsWorld {
  public readonly config: JarPhysicsConfig;
  public readonly bodies: StarBody[];
  private elapsedSeconds = 0;

  constructor(config: JarPhysicsConfig = DEFAULT_JAR_PHYSICS_CONFIG) {
    this.config = config;
    this.bodies = this.createInitialBodies();
  }

  private createInitialBodies(): StarBody[] {
    const bodies: StarBody[] = [];
    const usableRadius = Math.max(0.3, this.config.jarRadius - this.config.starRadius - 0.1);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < this.config.starCount; i++) {
      const day = i + 1;
      const layerFraction = i / Math.max(1, this.config.starCount - 1);
      const radialFraction = Math.sqrt(((i * 7) % this.config.starCount + 1) / this.config.starCount);
      const angle = i * goldenAngle;
      const r = radialFraction * usableRadius * 0.85;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y =
        this.config.jarMinY +
        this.config.starRadius +
        0.15 +
        layerFraction * (this.config.jarMaxY - this.config.jarMinY - 1.3);

      bodies.push({
        day,
        position: { x, y, z },
        velocity: {
          x: Math.cos(angle * 2) * 0.12,
          y: 0,
          z: Math.sin(angle * 2) * 0.12,
        },
        rotation: {
          x: (i * 0.7) % (Math.PI * 2),
          y: (i * 1.1) % (Math.PI * 2),
          z: (i * 0.4) % (Math.PI * 2),
        },
        angularVelocity: {
          x: ((i % 3) - 1) * 0.25,
          y: (((i + 1) % 3) - 1) * 0.35,
          z: (((i + 2) % 3) - 1) * 0.2,
        },
        radius: this.config.starRadius,
        targetConstellationPos: createHeartConstellationPosition(
          i,
          this.config.starCount,
          this.config
        ),
      });
    }

    return bodies;
  }

  /**
   * Adds an immediate linear and angular shake impulse to all stars in the jar.
   */
  public applyShakeImpulse(impulse: Vec3, turbulence = 2.6): void {
    const count = this.bodies.length;
    for (let i = 0; i < count; i++) {
      const body = this.bodies[i];
      const phase = this.elapsedSeconds * 3.1 + i * 1.73;
      const swirlX = Math.cos(phase) * turbulence * 0.55;
      const swirlY = (0.45 + 0.55 * Math.abs(Math.sin(phase * 1.3))) * turbulence;
      const swirlZ = Math.sin(phase * 0.9) * turbulence * 0.55;

      body.velocity.x += impulse.x + swirlX;
      body.velocity.y += impulse.y + swirlY;
      body.velocity.z += impulse.z + swirlZ;

      body.angularVelocity.x += Math.sin(phase) * 3.8;
      body.angularVelocity.y += Math.cos(phase * 1.2) * 4.2;
      body.angularVelocity.z += Math.sin(phase * 0.7) * 3.4;
    }
  }

  /**
   * Makes the stars lag behind when the jar's spin around its vertical axis changes.
   * `deltaAngularVelocity` is the change of the jar's angular velocity in rad/s.
   */
  public applySwirl(deltaAngularVelocity: number): void {
    if (deltaAngularVelocity === 0) {
      return;
    }
    for (const body of this.bodies) {
      // Relative to the jar, a star moves with -(omega x r).
      body.velocity.x -= deltaAngularVelocity * body.position.z;
      body.velocity.z += deltaAngularVelocity * body.position.x;
      body.angularVelocity.y -= deltaAngularVelocity * 0.6;
    }
  }

  /**
   * Adds a velocity change to a single star (used for stirring with a finger or the mouse).
   */
  public nudgeBody(day: number, deltaVelocity: Vec3): void {
    const body = this.bodies[day - 1];
    if (!body) {
      return;
    }
    body.velocity.x += deltaVelocity.x;
    body.velocity.y += deltaVelocity.y;
    body.velocity.z += deltaVelocity.z;
    body.angularVelocity.x += deltaVelocity.y * 1.4;
    body.angularVelocity.z -= deltaVelocity.x * 1.4;
  }

  /**
   * Pushes nearby stars away from a point on the glass, like knocking on the jar.
   */
  public applyKnock(point: Vec3, strength = 1, reach = 1.5): void {
    for (const body of this.bodies) {
      const dx = body.position.x - point.x;
      const dy = body.position.y - point.y;
      const dz = body.position.z - point.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist >= reach || dist < 0.0001) {
        continue;
      }
      const push = (1 - dist / reach) * 3.2 * strength;
      body.velocity.x += (dx / dist) * push;
      body.velocity.y += (dy / dist) * push;
      body.velocity.z += (dz / dist) * push;
      body.angularVelocity.x += push * 0.9;
      body.angularVelocity.y -= push * 0.7;
    }
  }

  /**
   * Advances the physics simulation by `dt` seconds and returns significant star collisions.
   * `gravity` may point in any direction (the jar follows the phone's real orientation);
   * `inertia` is an extra acceleration from moving the jar that also affects today's star.
   */
  public step(
    dt: number,
    gravity: Vec3 = { x: 0, y: -4.2, z: 0 },
    constellationBlend = 0,
    todayDay: number | null = null,
    inertia: Vec3 = ZERO_VECTOR
  ): CollisionEvent[] {
    const clampedDt = clamp(dt, 0.001, 0.04);
    const blend = clamp(constellationBlend, 0, 1);
    this.elapsedSeconds += clampedDt;

    const gravityScale = 1 - blend;
    const damping = Math.pow(blend > 0.2 ? 0.14 : 0.45, clampedDt);
    const angularDamping = Math.pow(0.5, clampedDt);

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];

      // Ambient warm shimmer drift so stars feel alive rather than dead weight.
      const shimmerPhase = this.elapsedSeconds * 1.35 + i * 0.85;
      const shimmerX = Math.cos(shimmerPhase) * 0.35;
      const shimmerZ = Math.sin(shimmerPhase * 0.9) * 0.35;

      body.velocity.x +=
        ((gravity.x + inertia.x) * gravityScale + shimmerX) * clampedDt;
      body.velocity.y += (gravity.y + inertia.y) * gravityScale * clampedDt;
      body.velocity.z +=
        ((gravity.z + inertia.z) * gravityScale + shimmerZ) * clampedDt;

      // Today's star is weightless: it cancels gravity (whichever way it points)
      // and hovers prominently above the pile, but still reacts to shaking.
      if (todayDay !== null && body.day === todayDay && blend < 0.5) {
        const targetFloatY = 0.72 + Math.sin(this.elapsedSeconds * 1.8) * 0.12;
        const heightError = targetFloatY - body.position.y;
        const lift = clamp(heightError * 5.0, -2.5, 4.5);
        body.velocity.x -= gravity.x * gravityScale * clampedDt;
        body.velocity.y += (lift - gravity.y) * gravityScale * clampedDt;
        body.velocity.z -= gravity.z * gravityScale * clampedDt;
      }

      // Spring attraction toward the 3D Heart Constellation when constellation mode is active.
      if (blend > 0.001) {
        const spring = 14.0 * blend;
        body.velocity.x +=
          (body.targetConstellationPos.x - body.position.x) * spring * clampedDt;
        body.velocity.y +=
          (body.targetConstellationPos.y - body.position.y) * spring * clampedDt;
        body.velocity.z +=
          (body.targetConstellationPos.z - body.position.z) * spring * clampedDt;
      }

      body.velocity.x *= damping;
      body.velocity.y *= damping;
      body.velocity.z *= damping;

      // Cap extreme velocities to preserve stability inside the jar.
      const maxSpeed = 12;
      const speedSq =
        body.velocity.x * body.velocity.x +
        body.velocity.y * body.velocity.y +
        body.velocity.z * body.velocity.z;
      if (speedSq > maxSpeed * maxSpeed) {
        const scale = maxSpeed / Math.sqrt(speedSq);
        body.velocity.x *= scale;
        body.velocity.y *= scale;
        body.velocity.z *= scale;
      }

      body.position.x += body.velocity.x * clampedDt;
      body.position.y += body.velocity.y * clampedDt;
      body.position.z += body.velocity.z * clampedDt;

      body.angularVelocity.x *= angularDamping;
      body.angularVelocity.y *= angularDamping;
      body.angularVelocity.z *= angularDamping;

      body.rotation.x += body.angularVelocity.x * clampedDt;
      body.rotation.y += body.angularVelocity.y * clampedDt;
      body.rotation.z += body.angularVelocity.z * clampedDt;
    }

    const collisions = this.resolveStarCollisions(blend);
    this.constrainAllToJar();

    return collisions;
  }

  private resolveStarCollisions(constellationBlend: number): CollisionEvent[] {
    const events: CollisionEvent[] = [];
    const count = this.bodies.length;
    const restitution = this.config.restitution * (1 - constellationBlend * 0.7);
    // Stars shrink their collision size in constellation mode so the heart can form.
    const sizeScale = 1 - constellationBlend * 0.55;

    for (let i = 0; i < count; i++) {
      const a = this.bodies[i];
      for (let j = i + 1; j < count; j++) {
        const b = this.bodies[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dz = b.position.z - a.position.z;
        const minDist = (a.radius + b.radius) * sizeScale;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq >= minDist * minDist) {
          continue;
        }

        const dist = Math.sqrt(distSq);
        let nx: number;
        let ny: number;
        let nz: number;

        if (dist > 0.0001) {
          nx = dx / dist;
          ny = dy / dist;
          nz = dz / dist;
        } else {
          nx = 0;
          ny = 1;
          nz = 0;
        }

        const overlap = minDist - dist;
        const correction = overlap * 0.5;
        a.position.x -= nx * correction;
        a.position.y -= ny * correction;
        a.position.z -= nz * correction;
        b.position.x += nx * correction;
        b.position.y += ny * correction;
        b.position.z += nz * correction;

        const rvx = b.velocity.x - a.velocity.x;
        const rvy = b.velocity.y - a.velocity.y;
        const rvz = b.velocity.z - a.velocity.z;
        const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

        if (velAlongNormal < 0) {
          const impulse = -(1 + restitution) * velAlongNormal * 0.5;
          a.velocity.x -= impulse * nx;
          a.velocity.y -= impulse * ny;
          a.velocity.z -= impulse * nz;
          b.velocity.x += impulse * nx;
          b.velocity.y += impulse * ny;
          b.velocity.z += impulse * nz;

          // Subtle tumble spin from grazing collisions.
          a.angularVelocity.z += (ny - nx) * impulse * 0.5;
          b.angularVelocity.z -= (ny - nx) * impulse * 0.5;

          const impactSpeed = -velAlongNormal;
          if (
            constellationBlend < 0.5 &&
            impactSpeed > this.config.collisionSoundThreshold
          ) {
            const intensity = clamp(
              (impactSpeed - this.config.collisionSoundThreshold) / 3.8,
              0.12,
              1.0
            );
            events.push({
              dayA: a.day,
              dayB: b.day,
              intensity,
            });
          }
        }
      }
    }

    return events;
  }

  private constrainAllToJar(): void {
    const rest = this.config.wallRestitution;

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      // Taper slightly near the neck/top of the jar to match jar silhouette.
      const neckTaper =
        body.position.y > this.config.jarMaxY - 0.55 ? 0.84 : 1.0;
      const maxRadial = Math.max(
        0.2,
        this.config.jarRadius * neckTaper - body.radius
      );

      const radialDistSq =
        body.position.x * body.position.x + body.position.z * body.position.z;
      if (radialDistSq > maxRadial * maxRadial) {
        const radialDist = Math.sqrt(radialDistSq);
        const nx = body.position.x / radialDist;
        const nz = body.position.z / radialDist;

        body.position.x = nx * maxRadial;
        body.position.z = nz * maxRadial;

        const radialVel = body.velocity.x * nx + body.velocity.z * nz;
        if (radialVel > 0) {
          body.velocity.x -= (1 + rest) * radialVel * nx;
          body.velocity.z -= (1 + rest) * radialVel * nz;
        }
      }

      const minY = this.config.jarMinY + body.radius;
      const maxY = this.config.jarMaxY - body.radius;

      if (body.position.y < minY) {
        body.position.y = minY;
        if (body.velocity.y < 0) {
          body.velocity.y = -body.velocity.y * rest;
        }
      } else if (body.position.y > maxY) {
        body.position.y = maxY;
        if (body.velocity.y > 0) {
          body.velocity.y = -body.velocity.y * rest;
        }
      }
    }
  }
}
