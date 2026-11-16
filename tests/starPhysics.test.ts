import { describe, expect, it } from "vitest";
import {
  DEFAULT_JAR_PHYSICS_CONFIG,
  StarPhysicsWorld,
} from "../src/physics/starPhysics";

describe("StarPhysicsWorld", () => {
  it("initializes 24 bodies inside jar boundaries", () => {
    const world = new StarPhysicsWorld();
    expect(world.bodies).toHaveLength(24);

    for (const body of world.bodies) {
      const radial = Math.hypot(body.position.x, body.position.z);
      expect(radial).toBeLessThanOrEqual(
        DEFAULT_JAR_PHYSICS_CONFIG.jarRadius - body.radius + 0.001
      );
      expect(body.position.y).toBeGreaterThanOrEqual(
        DEFAULT_JAR_PHYSICS_CONFIG.jarMinY + body.radius - 0.001
      );
      expect(body.position.y).toBeLessThanOrEqual(
        DEFAULT_JAR_PHYSICS_CONFIG.jarMaxY - body.radius + 0.001
      );
    }
  });

  it("keeps all stars contained during heavy shake impulses and emits collision events", () => {
    const world = new StarPhysicsWorld();
    world.applyShakeImpulse({ x: 3.5, y: 5.5, z: -2.8 }, 3.2);

    let totalCollisions = 0;
    for (let stepIdx = 0; stepIdx < 120; stepIdx++) {
      const events = world.step(1 / 60, { x: 0, y: -4.2, z: 0 }, 0, 5);
      totalCollisions += events.length;

      for (const body of world.bodies) {
        const radial = Math.hypot(body.position.x, body.position.z);
        expect(radial).toBeLessThanOrEqual(
          DEFAULT_JAR_PHYSICS_CONFIG.jarRadius - body.radius + 0.01
        );
        expect(body.position.y).toBeGreaterThanOrEqual(
          DEFAULT_JAR_PHYSICS_CONFIG.jarMinY + body.radius - 0.01
        );
        expect(body.position.y).toBeLessThanOrEqual(
          DEFAULT_JAR_PHYSICS_CONFIG.jarMaxY - body.radius + 0.01
        );
      }
    }

    expect(totalCollisions).toBeGreaterThan(0);
  });

  it("converges stars toward their 3D heart constellation targets when constellationBlend is 1", () => {
    const world = new StarPhysicsWorld();

    for (let stepIdx = 0; stepIdx < 240; stepIdx++) {
      world.step(1 / 60, { x: 0, y: -4.2, z: 0 }, 1.0, null);
    }

    for (const body of world.bodies) {
      const dist = Math.hypot(
        body.position.x - body.targetConstellationPos.x,
        body.position.y - body.targetConstellationPos.y,
        body.position.z - body.targetConstellationPos.z
      );
      expect(dist).toBeLessThan(0.32);
    }
  });

  it("lets the pile follow gravity in any direction, e.g. onto the lid when held upside down", () => {
    const world = new StarPhysicsWorld();

    for (let stepIdx = 0; stepIdx < 360; stepIdx++) {
      world.step(1 / 60, { x: 0, y: 5.2, z: 0 }, 0, null);
    }

    const averageY =
      world.bodies.reduce((sum, body) => sum + body.position.y, 0) /
      world.bodies.length;
    expect(averageY).toBeGreaterThan(0.6);
  });

  it("keeps today's star hovering even when gravity points sideways", () => {
    const world = new StarPhysicsWorld();

    for (let stepIdx = 0; stepIdx < 360; stepIdx++) {
      world.step(1 / 60, { x: 5.2, y: 0, z: 0 }, 0, 12);
    }

    const today = world.bodies[11];
    expect(today.position.y).toBeGreaterThan(0.2);
  });

  it("swirls stars against the jar's spin and pushes them away from a knock", () => {
    const world = new StarPhysicsWorld();
    const body = world.bodies[5];
    const before = { ...body.velocity };

    world.applySwirl(2);
    expect(body.velocity.x - before.x).toBeCloseTo(-2 * body.position.z, 6);
    expect(body.velocity.z - before.z).toBeCloseTo(2 * body.position.x, 6);

    const speedBefore = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z);
    world.applyKnock(
      { x: body.position.x + 0.3, y: body.position.y, z: body.position.z },
      1
    );
    expect(body.velocity.x).toBeLessThan(before.x - 2 * body.position.z);
    expect(
      Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z)
    ).not.toBe(speedBefore);
  });

  it("nudges a single star without touching the others", () => {
    const world = new StarPhysicsWorld();
    const otherBefore = { ...world.bodies[0].velocity };
    const targetBefore = { ...world.bodies[6].velocity };

    world.nudgeBody(7, { x: 1, y: 2, z: -1 });

    expect(world.bodies[6].velocity.x).toBeCloseTo(targetBefore.x + 1, 6);
    expect(world.bodies[6].velocity.y).toBeCloseTo(targetBefore.y + 2, 6);
    expect(world.bodies[0].velocity).toEqual(otherBefore);
  });
});
