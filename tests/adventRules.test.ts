import { describe, expect, it } from "vitest";
import {
  getActiveTodayDay,
  getAdventDayByNumber,
  getStarVisualState,
  isAnniversaryCodeValid,
  isDayUnlocked,
  isFinaleUnlocked,
} from "../src/domain/adventRules";

describe("isAnniversaryCodeValid", () => {
  it("accepts configured anniversary date formats with whitespace normalization", () => {
    expect(isAnniversaryCodeValid("01.12.2021")).toBe(true);
    expect(isAnniversaryCodeValid(" 01122021 ")).toBe(true);
    expect(isAnniversaryCodeValid("01.12.")).toBe(true);
    expect(isAnniversaryCodeValid("1.12.2021")).toBe(true);
    expect(isAnniversaryCodeValid("5")).toBe(true);
  });

  it("rejects empty or incorrect codes", () => {
    expect(isAnniversaryCodeValid("")).toBe(false);
    expect(isAnniversaryCodeValid("   ")).toBe(false);
    expect(isAnniversaryCodeValid("25.12.2021")).toBe(false);
  });
});

describe("isDayUnlocked", () => {
  it("locks all days in November 2026 unless previewAll is true", () => {
    const nov2026 = new Date(2026, 10, 20, 12, 0, 0);
    expect(isDayUnlocked(1, nov2026, false)).toBe(false);
    expect(isDayUnlocked(1, nov2026, true)).toBe(true);
    expect(isDayUnlocked(24, nov2026, true)).toBe(true);
  });

  it("unlocks days up to current date in December 2026", () => {
    const dec10 = new Date(2026, 11, 10, 9, 0, 0);
    expect(isDayUnlocked(1, dec10, false)).toBe(true);
    expect(isDayUnlocked(10, dec10, false)).toBe(true);
    expect(isDayUnlocked(11, dec10, false)).toBe(false);
    expect(isDayUnlocked(24, dec10, false)).toBe(false);
  });

  it("keeps days unlocked after December 2026 and rejects out-of-range days", () => {
    const jan2027 = new Date(2027, 0, 2, 12, 0, 0);
    expect(isDayUnlocked(24, jan2027, false)).toBe(true);
    expect(isDayUnlocked(0, jan2027, true)).toBe(false);
    expect(isDayUnlocked(25, jan2027, true)).toBe(false);
  });
});

describe("getStarVisualState & getActiveTodayDay", () => {
  it("distinguishes locked, available_today, available_past, and opened in December", () => {
    const dec5 = new Date(2026, 11, 5, 10, 0, 0);
    const opened = new Set<number>([1, 2]);

    expect(getActiveTodayDay(dec5, opened, false)).toBe(5);
    expect(getStarVisualState(1, opened, dec5, false)).toBe("opened");
    expect(getStarVisualState(3, opened, dec5, false)).toBe("available_past");
    expect(getStarVisualState(5, opened, dec5, false)).toBe("available_today");
    expect(getStarVisualState(6, opened, dec5, false)).toBe("locked");
  });

  it("points to the next unopened day in preview mode outside December", () => {
    const nov16 = new Date(2026, 10, 16, 12, 0, 0);
    const opened = new Set<number>([1, 2]);

    expect(getActiveTodayDay(nov16, opened, false)).toBeNull();
    expect(getActiveTodayDay(nov16, opened, true)).toBe(3);
    expect(getStarVisualState(3, opened, nov16, true)).toBe("available_today");
  });
});

describe("isFinaleUnlocked", () => {
  it("activates only when day 24 is unlocked and opened", () => {
    const dec23 = new Date(2026, 11, 23, 20, 0, 0);
    const dec24 = new Date(2026, 11, 24, 18, 0, 0);

    expect(isFinaleUnlocked(new Set([24]), dec23, false)).toBe(false);
    expect(isFinaleUnlocked(new Set([1, 2]), dec24, false)).toBe(false);
    expect(isFinaleUnlocked(new Set([24]), dec24, false)).toBe(true);
    expect(isFinaleUnlocked(new Set([24]), dec23, true)).toBe(true);
  });

  it("finds entries by day number", () => {
    expect(getAdventDayByNumber(1)?.day).toBe(1);
    expect(getAdventDayByNumber(24)?.day).toBe(24);
    expect(getAdventDayByNumber(99)).toBeUndefined();
  });
});
