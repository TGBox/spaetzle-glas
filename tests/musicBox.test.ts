import { describe, expect, it } from "vitest";
import { decayMusicBoxEnergy, musicBoxLevels } from "../src/audio/musicBox";

describe("music box levels", () => {
  it("stays silent and paused without energy", () => {
    expect(musicBoxLevels(0)).toEqual({ playing: false, gain: 0, rate: 1 });
    expect(musicBoxLevels(0.01).playing).toBe(false);
  });

  it("plays at full volume and normal speed from half a wind-up", () => {
    const half = musicBoxLevels(0.5);
    expect(half.playing).toBe(true);
    expect(half.rate).toBeCloseTo(1, 6);
    expect(musicBoxLevels(1)).toEqual(half);
  });

  it("gets quieter and slower as it runs down", () => {
    const strong = musicBoxLevels(0.3);
    const weak = musicBoxLevels(0.05);
    expect(weak.gain).toBeLessThan(strong.gain);
    expect(weak.rate).toBeLessThan(strong.rate);
    expect(weak.rate).toBeGreaterThanOrEqual(0.82);
  });

  it("runs down completely in about four seconds", () => {
    expect(decayMusicBoxEnergy(1, 2)).toBeCloseTo(0.5, 6);
    expect(decayMusicBoxEnergy(1, 4)).toBe(0);
    expect(decayMusicBoxEnergy(0.1, 10)).toBe(0);
  });
});
