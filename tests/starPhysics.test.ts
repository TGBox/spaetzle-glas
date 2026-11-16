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
});
