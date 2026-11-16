import { describe, expect, it } from "vitest";
import {
  gravityDirectionFromOrientation,
  rotateToScreenFrame,
  shakeStrengthFromAcceleration,
} from "../src/input/motionController";

describe("gravityDirectionFromOrientation", () => {
  it("points down the screen when the phone is held upright", () => {
    const gravity = gravityDirectionFromOrientation(90, 0);
    expect(gravity.x).toBeCloseTo(0, 6);
    expect(gravity.y).toBeCloseTo(-1, 6);
    expect(gravity.z).toBeCloseTo(0, 6);
  });

  it("points into the screen when the phone lies flat on its back", () => {
    const gravity = gravityDirectionFromOrientation(0, 0);
    expect(gravity.x).toBeCloseTo(0, 6);
    expect(gravity.y).toBeCloseTo(0, 6);
    expect(gravity.z).toBeCloseTo(-1, 6);
  });

  it("points up the screen when the phone is held upside down", () => {
    const gravity = gravityDirectionFromOrientation(-90, 0);
    expect(gravity.y).toBeCloseTo(1, 6);
  });

  it("points to the right edge when the phone is tilted onto its right side", () => {
    const gravity = gravityDirectionFromOrientation(0, 90);
    expect(gravity.x).toBeCloseTo(1, 6);
    expect(gravity.z).toBeCloseTo(0, 6);
  });

  it("always returns a unit vector", () => {
    const gravity = gravityDirectionFromOrientation(37, -52);
    expect(Math.hypot(gravity.x, gravity.y, gravity.z)).toBeCloseTo(1, 6);
  });
});

describe("rotateToScreenFrame", () => {
  it("leaves vectors untouched in portrait and remaps x/y in landscape", () => {
    expect(rotateToScreenFrame({ x: 1, y: 2, z: 3 }, 0)).toEqual({
      x: 1,
      y: 2,
      z: 3,
    });

    const rotated = rotateToScreenFrame({ x: 1, y: 0, z: 3 }, 90);
    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBeCloseTo(1, 6);
    expect(rotated.z).toBe(3);
  });
});

describe("shakeStrengthFromAcceleration", () => {
  it("ignores gentle movement and saturates for hard shakes", () => {
    expect(shakeStrengthFromAcceleration(3)).toBe(0);
    expect(shakeStrengthFromAcceleration(10.9)).toBe(0);
    expect(shakeStrengthFromAcceleration(12)).toBeGreaterThan(0);
    expect(shakeStrengthFromAcceleration(60)).toBe(1);
  });
});
